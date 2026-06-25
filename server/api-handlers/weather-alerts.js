const mysql = require('mysql2/promise');
const { sendJson } = require('./_utils');

let pool = null;
let memoryEvents = [];
let memoryId = 0;

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function mysqlConfigured(){
  return Boolean(env('SAM_DB_HOST') && env('SAM_DB_USER') && env('SAM_DB_NAME'));
}

function safeIdentifier(value, fallback){
  const text = String(value || fallback || '').replace(/[^a-zA-Z0-9_]/g, '');
  return text || fallback;
}

function tableName(){
  return `\`${safeIdentifier(env('WEATHER_ALERT_TABLE', 'site_weather_alerts'), 'site_weather_alerts')}\``;
}

function getPool(){
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

async function readBody(req){
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 64) reject(new Error('Payload too large'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function ensureTable(){
  const db = getPool();
  if (!db) return false;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${tableName()} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      weather_type VARCHAR(64) NOT NULL DEFAULT '',
      weather_name VARCHAR(128) NOT NULL DEFAULT '',
      stage VARCHAR(32) NOT NULL DEFAULT '',
      severity VARCHAR(32) NOT NULL DEFAULT 'low',
      message VARCHAR(512) NOT NULL DEFAULT '',
      source VARCHAR(64) NOT NULL DEFAULT '',
      map_name VARCHAR(128) NOT NULL DEFAULT '',
      occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created_id (created_at, id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  return true;
}

function normalizeEvent(input = {}){
  const now = new Date();
  let occurredAt = now;
  const rawOccurred = input.occurredAt || input.occurred_at;
  if (typeof rawOccurred === 'number' && Number.isFinite(rawOccurred)) {
    occurredAt = new Date(rawOccurred > 1000000000000 ? rawOccurred : rawOccurred * 1000);
  } else if (rawOccurred) {
    const parsed = new Date(rawOccurred);
    if (!Number.isNaN(parsed.getTime())) occurredAt = parsed;
  }

  return {
    weatherType: String(input.weatherType || input.weather_type || 'unknown').slice(0, 64),
    weatherName: String(input.weatherName || input.weather_name || 'Погодная активность').slice(0, 128),
    stage: String(input.stage || 'change').slice(0, 32),
    severity: String(input.severity || 'low').slice(0, 32),
    message: String(input.message || 'Датчики базы зафиксировали сейсмические изменения в погоде.').slice(0, 512),
    source: String(input.source || 'gmod').slice(0, 64),
    map: String(input.map || input.mapName || '').slice(0, 128),
    occurredAt: occurredAt.toISOString()
  };
}

function publicEvent(row){
  if (!row) return null;
  if ('weather_type' in row) {
    return {
      id: Number(row.id || 0),
      weatherType: String(row.weather_type || ''),
      weatherName: String(row.weather_name || ''),
      stage: String(row.stage || ''),
      severity: String(row.severity || 'low'),
      message: String(row.message || ''),
      source: String(row.source || ''),
      map: String(row.map_name || ''),
      occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
    };
  }
  return row;
}

function secretMatches(req){
  const configured = env('WEATHER_ALERT_SECRET') || env('EOTG_WEATHER_ALERT_SECRET');
  if (!configured) return true;
  const header = req.headers['x-eotg-weather-secret'] || req.headers['x-weather-alert-secret'];
  return String(header || '') === String(configured);
}

async function insertEvent(evt){
  const db = getPool();
  if (!db) {
    const item = { ...evt, id: ++memoryId, createdAt: new Date().toISOString() };
    memoryEvents.unshift(item);
    memoryEvents = memoryEvents.slice(0, 50);
    return item;
  }

  await ensureTable();
  const [result] = await db.execute(
    `INSERT INTO ${tableName()} (weather_type, weather_name, stage, severity, message, source, map_name, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [evt.weatherType, evt.weatherName, evt.stage, evt.severity, evt.message, evt.source, evt.map, new Date(evt.occurredAt)]
  );
  return { ...evt, id: Number(result.insertId || 0), createdAt: new Date().toISOString() };
}

async function listEvents(since = 0, limit = 20){
  const db = getPool();
  limit = Math.max(1, Math.min(Number(limit) || 20, 50));
  since = Math.max(0, Number(since) || 0);

  if (!db) {
    return memoryEvents.filter(x => Number(x.id || 0) > since).slice(0, limit);
  }

  await ensureTable();
  const [rows] = await db.execute(
    `SELECT id, weather_type, weather_name, stage, severity, message, source, map_name, occurred_at, created_at
     FROM ${tableName()}
     WHERE id > ?
     ORDER BY id DESC
     LIMIT ${limit}`,
    [since]
  );
  return (rows || []).map(publicEvent);
}

module.exports = async function weatherAlerts(req, res){
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
      const since = url.searchParams.get('since') || '0';
      const limit = url.searchParams.get('limit') || '20';
      const events = await listEvents(since, limit);
      return sendJson(res, 200, { ok:true, events, mysqlConfigured:mysqlConfigured() });
    }

    if (req.method === 'POST') {
      if (!secretMatches(req)) return sendJson(res, 403, { ok:false, error:'Bad weather alert secret' });
      const raw = await readBody(req);
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = {}; }
      const event = normalizeEvent(body);
      const saved = await insertEvent(event);
      return sendJson(res, 200, { ok:true, event:saved });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok:false, error:'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok:false, error:err.message || 'Weather alert API failed' });
  }
};
