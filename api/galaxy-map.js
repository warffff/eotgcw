const fs = require('fs/promises');
const path = require('path');
const { getFreshSession, clearSessionCookie, sendJson } = require('./_utils');
const { getSamAccess } = require('./_samAuth');

const MAP_ADMIN_ROLES = ['1305567485218521169'];
const MAP_PATH = process.env.GITHUB_GALAXY_MAP_PATH || 'data/galaxy-map.json';

function githubConfigured(){ return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO); }
function githubHeaders(){
  return {
    Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'Edge-of-the-Galaxy-Site'
  };
}
function ghBaseUrl(filePath){
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g,'/')}`;
}
function hasMapAdminRole(roles=[]){ return roles.map(String).some(r => MAP_ADMIN_ROLES.includes(r)); }
function cleanPlanet(p){
  const name = String(p?.name || '').trim().slice(0, 80);
  if (!name) return null;
  const control = ['republic','cis','neutral'].includes(p.control) ? p.control : 'neutral';
  const sector = Math.max(1, Math.min(99, Number(p.sector) || 1));
  const x = Math.max(0, Math.min(1280, Number(p.x) || 640));
  const y = Math.max(0, Math.min(820, Number(p.y) || 410));
  return {
    name,
    sector,
    region:String(p.region || 'Внешнее Кольцо').trim().slice(0, 80),
    control,
    value:String(p.value || 'Система').trim().slice(0, 120),
    x:Math.round(x * 10) / 10,
    y:Math.round(y * 10) / 10,
    desc:String(p.desc || 'Описание системы не задано.').trim().slice(0, 420)
  };
}
function cleanPlanets(planets){
  if (!Array.isArray(planets)) return [];
  const used = new Set();
  const clean = [];
  for (const raw of planets) {
    const p = cleanPlanet(raw);
    if (!p) continue;
    const key = p.name.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    clean.push(p);
  }
  return clean.slice(0, 240);
}
async function readGithubMap(){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const r = await fetch(`${ghBaseUrl(MAP_PATH)}?ref=${encodeURIComponent(branch)}`, { headers:githubHeaders() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub read failed: HTTP ${r.status}`);
  const data = await r.json();
  const raw = Buffer.from(String(data.content || '').replace(/\n/g,''), 'base64').toString('utf8');
  return { json:JSON.parse(raw), sha:data.sha, path:MAP_PATH };
}
async function readLocalMap(){
  const p = path.join(process.cwd(), MAP_PATH);
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
}
async function writeGithubMap(planets, editor){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const current = await readGithubMap().catch(err => {
    if (String(err.message || '').includes('HTTP 404')) return null;
    throw err;
  });
  const payload = { version:1, updatedAt:new Date().toISOString(), updatedBy:editor || 'unknown', planets };
  const body = {
    message:`site: update galaxy map layout`,
    content:Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64'),
    branch,
    committer:{
      name:process.env.GITHUB_COMMITTER_NAME || 'Edge of the Galaxy Site',
      email:process.env.GITHUB_COMMITTER_EMAIL || 'site-bot@users.noreply.github.com'
    }
  };
  if (current?.sha) body.sha = current.sha;
  const r = await fetch(ghBaseUrl(MAP_PATH), { method:'PUT', headers:{...githubHeaders(), 'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub write failed: HTTP ${r.status}`);
  return { path:MAP_PATH, commitUrl:data.commit?.html_url || data.content?.html_url || null };
}
async function writeLocalMap(planets, editor){
  const p = path.join(process.cwd(), MAP_PATH);
  await fs.mkdir(path.dirname(p), { recursive:true });
  await fs.writeFile(p, JSON.stringify({ version:1, updatedAt:new Date().toISOString(), updatedBy:editor, planets }, null, 2), 'utf8');
  return { path:MAP_PATH };
}
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      let map = null;
      if (githubConfigured()) { try { map = (await readGithubMap())?.json || null; } catch (_) {} }
      if (!map) map = await readLocalMap();
      const planets = cleanPlanets(map?.planets || []);
      return sendJson(res, 200, { ok:true, planets, updatedAt:map?.updatedAt || '', updatedBy:map?.updatedBy || '' });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'Method not allowed' });

    const samAccess = await getSamAccess(req);
    let access = null;
    let editor = samAccess.permissions?.canEditAll ? (samAccess.displayName || samAccess.steam?.steamId64 || 'Steam admin') : '';

    if (!samAccess.permissions?.canEditAll) {
      access = await getFreshSession(req, res);
      if (!access.session) return sendJson(res, 403, { ok:false, error:'Нужно авторизоваться через Steam с SAM rank admin/superadmin или через Discord' });
      if (!access.fresh) return sendJson(res, 403, { ok:false, error:'Не удалось актуально проверить роли Discord' });
      if (!hasMapAdminRole(access.roles || [])) {
        clearSessionCookie(res);
        return sendJson(res, 403, { ok:false, error:'Недостаточно прав: нужна роль ивентолога или SAM rank admin/superadmin для редактирования карты' });
      }
      editor = access.session.user?.global_name || access.session.user?.username || access.session.user?.id || 'unknown';
    }

    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    const planets = cleanPlanets(body.planets || []);
    if (!planets.length) return sendJson(res, 400, { ok:false, error:'Карта не может быть пустой' });
    const result = githubConfigured() ? await writeGithubMap(planets, editor) : await writeLocalMap(planets, editor);
    return sendJson(res, 200, { ok:true, savedTo:githubConfigured() ? 'github' : 'local', ...result });
  } catch (err) {
    return sendJson(res, 500, { ok:false, error:String(err.message || err) });
  }
};
