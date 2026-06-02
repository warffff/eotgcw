const fs = require('fs/promises');
const path = require('path');
const { readSession, readSteamSession, sendJson } = require('./_utils');

const STATS_PATH = process.env.PLAYER_STATS_PATH || 'content/player-stats.json';
const LINKS_PATH = process.env.PLAYER_LINKS_PATH || 'content/player-links.json';
const MODEL_IMAGES_PATH = process.env.PLAYER_MODEL_IMAGES_PATH || 'content/model-images.json';

function githubConfigured(){
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
}
function githubHeaders(){
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Edge-of-the-Galaxy-Stats'
  };
}
function ghBaseUrl(filePath){
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g,'/')}`;
}
async function readGithubText(filePath){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const r = await fetch(`${ghBaseUrl(filePath)}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders() });
  if (r.status === 404) return { text:null, sha:null };
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub read failed: HTTP ${r.status}`);
  const raw = String(data.content || '').replace(/\n/g, '');
  return { text: Buffer.from(raw, 'base64').toString('utf8'), sha:data.sha || null };
}
async function writeGithubText(filePath, text, message){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const current = await readGithubText(filePath).catch(() => ({ text:null, sha:null }));
  const body = {
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch,
    committer: {
      name: process.env.GITHUB_COMMITTER_NAME || 'Edge of the Galaxy Site',
      email: process.env.GITHUB_COMMITTER_EMAIL || 'site-bot@users.noreply.github.com'
    }
  };
  if (current.sha) body.sha = current.sha;
  const r = await fetch(ghBaseUrl(filePath), {
    method:'PUT',
    headers:{ ...githubHeaders(), 'Content-Type':'application/json' },
    body:JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub write failed: HTTP ${r.status}`);
  return data;
}
async function readLocalText(filePath){
  try { return await fs.readFile(path.join(process.cwd(), filePath), 'utf8'); } catch { return null; }
}
async function writeLocalText(filePath, text){
  const full = path.join(process.cwd(), filePath);
  await fs.mkdir(path.dirname(full), { recursive:true });
  await fs.writeFile(full, text, 'utf8');
}
async function readJson(filePath, fallback){
  let text = null;
  if (githubConfigured()) {
    try { text = (await readGithubText(filePath)).text; } catch (_) {}
  }
  if (!text) text = await readLocalText(filePath);
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}
async function writeJson(filePath, data, message){
  const text = JSON.stringify(data, null, 2) + '\n';
  if (githubConfigured()) return writeGithubText(filePath, text, message);
  await writeLocalText(filePath, text);
  return { local:true };
}
function cleanString(value, max=200){
  const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return text.length > max ? text.slice(0, max) : text;
}
function cleanSteamId64(value){
  const text = String(value || '').trim();
  return /^\d{15,20}$/.test(text) ? text : '';
}

function cleanBodygroups(value){
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed.bodygroups || parsed;
    } catch (_) {}
  }
  return {};
}
function cleanCharacter(raw, parent = {}){
  if (!raw || typeof raw !== 'object') return null;
  const now = new Date().toISOString();
  const steamId64 = cleanSteamId64(raw.steamId64 || parent.steamId64 || raw.communityId || parent.communityId || raw.steam_id64 || parent.steam_id64);
  if (!steamId64) return null;
  const model = cleanString(raw.model || parent.model || '', 220);
  const rpName = cleanString(raw.rpName || raw.rp_name || raw.characterName || raw.character_name || raw.name || '', 160);
  return {
    steamId64,
    steamId: cleanString(raw.steamId || parent.steamId || raw.steam_id || parent.steam_id || '', 64),
    characterId: cleanString(raw.characterId || raw.charId || raw.id || '', 80),
    nickname: cleanString(raw.nickname || parent.nickname || raw.nick || parent.nick || parent.name || 'Игрок', 120),
    rpName: rpName || cleanString(parent.rpName || parent.nickname || 'Игрок', 160),
    formation: cleanString(raw.formation || raw.jobName || raw.job || parent.formation || parent.jobName || 'Не указано', 120),
    formationId: cleanString(raw.formationId || raw.jobId || raw.job || parent.formationId || parent.jobId || '', 80),
    rank: cleanString(raw.rank || raw.rankName || parent.rank || parent.rankName || 'Не указано', 120),
    rankId: cleanString(raw.rankId || raw.rankAbr || raw.rank || parent.rankId || parent.rankAbr || '', 80),
    faction: cleanString(raw.faction || raw.factionName || parent.faction || parent.factionName || '', 120),
    factionId: cleanString(raw.factionId || parent.factionId || '', 80),
    model,
    modelImage: cleanString(raw.modelImage || parent.modelImage || '', 500),
    modelGltf: cleanString(raw.modelGltf || raw.modelGlb || raw.gltf || raw.glb || parent.modelGltf || parent.modelGlb || parent.gltf || parent.glb || '', 500),
    bodygroups: cleanBodygroups(raw.bodygroups || parent.bodygroups),
    skin: Number.isFinite(Number(raw.skin ?? parent.skin)) ? Number(raw.skin ?? parent.skin) : null,
    health: Number.isFinite(Number(raw.health ?? parent.health)) ? Number(raw.health ?? parent.health) : null,
    armor: Number.isFinite(Number(raw.armor ?? parent.armor)) ? Number(raw.armor ?? parent.armor) : null,
    online: Boolean(raw.online ?? parent.online),
    active: Boolean(raw.active),
    serverName: cleanString(raw.serverName || raw.server || parent.serverName || parent.server || 'Edge of the Galaxy', 120),
    updatedAt: cleanString(raw.updatedAt || parent.updatedAt || now, 80),
    lastSeen: cleanString(raw.lastSeen || parent.lastSeen || now, 80)
  };
}
function cleanPlayer(raw){
  const steamId64 = cleanSteamId64(raw.steamId64 || raw.communityId || raw.steam_id64);
  if (!steamId64) return null;
  const now = new Date().toISOString();
  const base = {
    steamId64,
    steamId: cleanString(raw.steamId || raw.steam_id || '', 64),
    nickname: cleanString(raw.nickname || raw.nick || raw.name || 'Игрок', 120),
    rpName: cleanString(raw.rpName || raw.rp_name || raw.characterName || raw.character_name || '', 160),
    formation: cleanString(raw.formation || raw.jobName || raw.job || 'Не указано', 120),
    formationId: cleanString(raw.formationId || raw.jobId || '', 80),
    rank: cleanString(raw.rank || raw.rankName || 'Не указано', 120),
    rankId: cleanString(raw.rankId || raw.rankAbr || '', 80),
    faction: cleanString(raw.faction || raw.factionName || '', 120),
    factionId: cleanString(raw.factionId || '', 80),
    model: cleanString(raw.model || '', 220),
    modelImage: cleanString(raw.modelImage || '', 500),
    modelGltf: cleanString(raw.modelGltf || raw.modelGlb || raw.gltf || raw.glb || '', 500),
    bodygroups: cleanBodygroups(raw.bodygroups),
    skin: Number.isFinite(Number(raw.skin)) ? Number(raw.skin) : null,
    health: Number.isFinite(Number(raw.health)) ? Number(raw.health) : null,
    armor: Number.isFinite(Number(raw.armor)) ? Number(raw.armor) : null,
    online: Boolean(raw.online),
    serverName: cleanString(raw.serverName || raw.server || 'Edge of the Galaxy', 120),
    updatedAt: cleanString(raw.updatedAt || now, 80),
    lastSeen: cleanString(raw.lastSeen || now, 80)
  };
  const sourceCharacters = Array.isArray(raw.characters) ? raw.characters : [];
  const characters = sourceCharacters.map(c => cleanCharacter(c, base)).filter(Boolean);
  if (!characters.length) characters.push(cleanCharacter(raw, base));
  const active = characters.find(c => c.active) || characters[0];
  return { ...base, ...active, characters };
}

function applyModelAssetToCharacter(character, modelImages){
  if (!character) return character;
  const model = String(character.model || '').trim();
  const entry = modelImages ? (modelImages[model] || modelImages[model.toLowerCase()]) : null;
  if (entry) {
    if (typeof entry === 'string') character.modelImage = character.modelImage || entry;
    else if (typeof entry === 'object') {
      character.modelImage = character.modelImage || entry.image || entry.png || entry.webp || '';
      character.modelGltf = character.modelGltf || entry.gltf || entry.glb || entry.model || '';
      character.modelManifest = character.modelManifest || entry.manifest || '';
    }
  }
  return character;
}
function withModelAssets(player, modelImages){
  if (!player) return player;
  if (Array.isArray(player.characters)) player.characters = player.characters.map(c => applyModelAssetToCharacter(c, modelImages));
  applyModelAssetToCharacter(player, modelImages);
  return player;
}
function markStaleOffline(player){
  if (!player) return player;
  const limitMinutes = Number(process.env.PLAYER_ONLINE_TIMEOUT_MINUTES || 5);
  const mark = (p) => {
    const t = new Date(p.updatedAt || p.lastSeen || 0).getTime();
    if (Number.isFinite(t) && t > 0 && Date.now() - t > limitMinutes * 60 * 1000) p.online = false;
    return p;
  };
  if (Array.isArray(player.characters)) player.characters = player.characters.map(mark);
  return mark(player);
}
function authorized(req, body){
  const expected = process.env.GMOD_STATS_SECRET;
  if (!expected) return false;
  const header = req.headers['x-gmod-stats-secret'];
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const supplied = body?.secret || header || bearer;
  return Boolean(supplied && String(supplied) === String(expected));
}
async function readBody(req){
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
async function handleGet(req, res){
  const url = new URL(req.url, 'http://local');
  const steamId = cleanSteamId64(url.searchParams.get('steamId'));
  const session = readSession(req);
  const steam = readSteamSession(req);
  const stats = await readJson(STATS_PATH, { players:{}, updatedAt:null });
  const links = await readJson(LINKS_PATH, { links:{} });
  const modelImages = await readJson(MODEL_IMAGES_PATH, {});
  const linkedSteamId = session?.user?.id ? cleanSteamId64(links.links?.[session.user.id]) : '';
  const steamSessionId = cleanSteamId64(steam?.steamId64);
  const targetSteamId = steamId || linkedSteamId || steamSessionId;
  if (!targetSteamId) {
    return sendJson(res, 200, { ok:true, player:null, linkedSteamId:'', total:Object.keys(stats.players || {}).length });
  }
  const player = markStaleOffline(withModelAssets((stats.players || {})[targetSteamId] || null, modelImages));
  const characters = Array.isArray(player?.characters) ? player.characters : (player ? [player] : []);
  return sendJson(res, 200, { ok:true, player, characters, linkedSteamId, steamId:targetSteamId, total:Object.keys(stats.players || {}).length });
}
async function handlePost(req, res){
  const body = await readBody(req);
  if (!authorized(req, body)) return sendJson(res, 401, { ok:false, error:'Invalid GMOD_STATS_SECRET' });
  const incoming = Array.isArray(body.players) ? body.players : [body.player || body];
  const cleaned = incoming.map(cleanPlayer).filter(Boolean);
  if (!cleaned.length) return sendJson(res, 400, { ok:false, error:'No valid players in payload' });
  const stats = await readJson(STATS_PATH, { players:{}, updatedAt:null });
  stats.players = stats.players || {};
  for (const p of cleaned) stats.players[p.steamId64] = { ...(stats.players[p.steamId64] || {}), ...p };
  stats.updatedAt = new Date().toISOString();
  await writeJson(STATS_PATH, stats, `site: update player stats (${cleaned.length})`);
  return sendJson(res, 200, { ok:true, updated:cleaned.length, storage:githubConfigured() ? 'github' : 'local' });
}
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return sendJson(res, 405, { ok:false, error:'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok:false, error:err.message });
  }
};
