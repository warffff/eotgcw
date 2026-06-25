const mysql = require('mysql2/promise');
const { readSteamSession } = require('./_utils');

const SAM_ADMIN_RANKS = new Set(['admin', 'superadmin']);
const SAM_DOC_RANKS = new Set(['commander']);
const DEFAULT_RANK = 'user';

let pool = null;

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function mysqlConfigured() {
  return Boolean(env('SAM_DB_HOST') && env('SAM_DB_USER') && env('SAM_DB_NAME'));
}

function safeIdentifier(value, fallback) {
  const text = String(value || fallback || '').replace(/[^a-zA-Z0-9_]/g, '');
  return text || fallback;
}

function tableName(kind) {
  const prefix = safeIdentifier(env('SAM_DB_PREFIX', 'sam_'), 'sam_');
  if (kind === 'players') return `\`${prefix}players\``;
  if (kind === 'ranks') return `\`${prefix}ranks\``;
  return `\`${safeIdentifier(kind, kind)}\``;
}

function metaTableName() {
  return `\`${safeIdentifier(env('SITE_CONTENT_META_TABLE', 'site_content_meta'), 'site_content_meta')}\``;
}

function getPool() {
  if (pool) return pool;
  if (!mysqlConfigured()) return null;
  const sslEnabled = /^(1|true|yes|required)$/i.test(env('SAM_DB_SSL', ''));
  pool = mysql.createPool({
    host: env('SAM_DB_HOST'),
    port: Number(env('SAM_DB_PORT', '3306')) || 3306,
    user: env('SAM_DB_USER'),
    password: env('SAM_DB_PASSWORD'),
    database: env('SAM_DB_NAME'),
    waitForConnections: true,
    connectionLimit: Number(env('SAM_DB_CONNECTION_LIMIT', '4')) || 4,
    charset: 'utf8mb4',
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  });
  return pool;
}

function steamId64ToSteamId(steamId64) {
  try {
    const id = BigInt(String(steamId64));
    const base = 76561197960265728n;
    if (id < base) return '';
    const account = id - base;
    const y = account % 2n;
    const z = (account - y) / 2n;
    return `STEAM_0:${y.toString()}:${z.toString()}`;
  } catch (_) {
    return '';
  }
}

function permissionsForRank(rank) {
  const normalized = String(rank || DEFAULT_RANK).toLowerCase();
  const canEditAll = SAM_ADMIN_RANKS.has(normalized);
  const canEditDocs = canEditAll || SAM_DOC_RANKS.has(normalized);
  return {
    rank: normalized,
    canEditAll,
    canEditDocs,
    canEditAny: canEditAll || canEditDocs,
    canAccessAllTabs: canEditAll
  };
}

function canEditContentKey(access, key) {
  if (!access || !access.permissions) return false;
  if (access.permissions.canEditAll) return true;
  return Boolean(access.permissions.canEditDocs && key === 'charter');
}

async function getSamPlayerBySteam(steamId64) {
  const db = getPool();
  if (!db || !steamId64) return { row: null, error: mysqlConfigured() ? '' : 'SAM MySQL env vars are not configured.' };
  const steamId = steamId64ToSteamId(steamId64);
  const candidates = [String(steamId64), steamId].filter(Boolean);
  try {
    const [rows] = await db.execute(
      `SELECT steamid, name, rank, expiry_date, last_join FROM ${tableName('players')} WHERE steamid IN (${candidates.map(() => '?').join(',')}) LIMIT 1`,
      candidates
    );
    return { row: rows && rows[0] ? rows[0] : null, error: '' };
  } catch (err) {
    return { row: null, error: err.message || String(err) };
  }
}

async function getSamAccess(req) {
  const steam = readSteamSession(req);
  const base = {
    authenticated: Boolean(steam),
    steam,
    sam: { rank: DEFAULT_RANK, name: '', steamid: '', expiryDate: 0, configured: mysqlConfigured(), error: '' },
    permissions: permissionsForRank(DEFAULT_RANK),
    displayName: steam?.personaName || steam?.steamId64 || 'Steam пользователь'
  };
  if (!steam) return base;

  const result = await getSamPlayerBySteam(steam.steamId64);
  if (result.error) {
    base.sam.error = result.error;
    return base;
  }

  const row = result.row;
  if (!row) return base;

  let rank = String(row.rank || DEFAULT_RANK).toLowerCase();
  const expiry = Number(row.expiry_date || 0);
  if (expiry > 0 && expiry <= Math.floor(Date.now() / 1000)) rank = DEFAULT_RANK;

  base.sam = {
    rank,
    name: String(row.name || ''),
    steamid: String(row.steamid || ''),
    expiryDate: expiry,
    configured: true,
    error: ''
  };
  base.permissions = permissionsForRank(rank);
  base.displayName = steam.personaName || row.name || steam.steamId64;
  return base;
}

async function ensureContentMetaTable() {
  const db = getPool();
  if (!db) return false;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${metaTableName()} (
      doc_key VARCHAR(64) PRIMARY KEY,
      updated_by_steamid64 VARCHAR(32) NOT NULL DEFAULT '',
      updated_by_name VARCHAR(128) NOT NULL DEFAULT '',
      updated_by_rank VARCHAR(64) NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  return true;
}

async function getContentMeta(key) {
  const db = getPool();
  if (!db) return null;
  try {
    await ensureContentMetaTable();
    const [rows] = await db.execute(
      `SELECT doc_key, updated_by_steamid64, updated_by_name, updated_by_rank, updated_at FROM ${metaTableName()} WHERE doc_key = ? LIMIT 1`,
      [String(key || '')]
    );
    const row = rows && rows[0] ? rows[0] : null;
    if (!row) return null;
    return {
      docKey: String(row.doc_key || ''),
      updatedBySteamId64: String(row.updated_by_steamid64 || ''),
      updatedByName: String(row.updated_by_name || ''),
      updatedByRank: String(row.updated_by_rank || ''),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ''
    };
  } catch (_) {
    return null;
  }
}

async function setContentMeta(key, access) {
  const db = getPool();
  if (!db || !access || !access.steam) return null;
  await ensureContentMetaTable();
  const docKey = String(key || '').slice(0, 64);
  const steamId64 = String(access.steam.steamId64 || '').slice(0, 32);
  const name = String(access.displayName || access.sam?.name || steamId64 || 'Steam пользователь').slice(0, 128);
  const rank = String(access.sam?.rank || DEFAULT_RANK).slice(0, 64);
  await db.execute(
    `INSERT INTO ${metaTableName()} (doc_key, updated_by_steamid64, updated_by_name, updated_by_rank, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE updated_by_steamid64=VALUES(updated_by_steamid64), updated_by_name=VALUES(updated_by_name), updated_by_rank=VALUES(updated_by_rank), updated_at=CURRENT_TIMESTAMP`,
    [docKey, steamId64, name, rank]
  );
  return getContentMeta(docKey);
}

module.exports = {
  SAM_ADMIN_RANKS,
  SAM_DOC_RANKS,
  mysqlConfigured,
  steamId64ToSteamId,
  permissionsForRank,
  canEditContentKey,
  getSamAccess,
  getContentMeta,
  setContentMeta
};