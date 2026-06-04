const fs = require('fs/promises');
const path = require('path');
const { readSession, readSteamSession, sendJson } = require('./_utils');
const LINKS_PATH = process.env.PLAYER_LINKS_PATH || 'content/player-links.json';

function githubConfigured(){ return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO); }
function githubHeaders(){ return { Authorization:`Bearer ${process.env.GITHUB_TOKEN}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'Edge-of-the-Galaxy-Stats' }; }
function ghBaseUrl(filePath){ return `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${encodeURIComponent(filePath).replace(/%2F/g,'/')}`; }
async function readGithubText(filePath){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const r = await fetch(`${ghBaseUrl(filePath)}?ref=${encodeURIComponent(branch)}`, { headers:githubHeaders() });
  if (r.status === 404) return { text:null, sha:null };
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub read failed: HTTP ${r.status}`);
  return { text:Buffer.from(String(data.content || '').replace(/\n/g,''), 'base64').toString('utf8'), sha:data.sha || null };
}
async function writeGithubText(filePath, text, message){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const current = await readGithubText(filePath).catch(() => ({ text:null, sha:null }));
  const body = { message, content:Buffer.from(text, 'utf8').toString('base64'), branch, committer:{ name:process.env.GITHUB_COMMITTER_NAME || 'Edge of the Galaxy Site', email:process.env.GITHUB_COMMITTER_EMAIL || 'site-bot@users.noreply.github.com' } };
  if (current.sha) body.sha = current.sha;
  const r = await fetch(ghBaseUrl(filePath), { method:'PUT', headers:{...githubHeaders(), 'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub write failed: HTTP ${r.status}`);
  return data;
}
async function readLocalText(filePath){ try { return await fs.readFile(path.join(process.cwd(), filePath), 'utf8'); } catch { return null; } }
async function writeLocalText(filePath, text){ const full = path.join(process.cwd(), filePath); await fs.mkdir(path.dirname(full), {recursive:true}); await fs.writeFile(full, text, 'utf8'); }
async function readJson(filePath, fallback){
  let text = null;
  if (githubConfigured()) { try { text = (await readGithubText(filePath)).text; } catch (_) {} }
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
function cleanSteamId64(value){ const text = String(value || '').trim(); return /^\d{15,20}$/.test(text) ? text : ''; }
async function readBody(req){ let raw=''; for await (const c of req) raw += c; try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }

module.exports = async (req, res) => {
  try {
    const session = readSession(req);
    const steam = readSteamSession(req);
    const data = await readJson(LINKS_PATH, { links:{}, updatedAt:null });
    data.links = data.links || {};
    if (req.method === 'GET') {
      const linked = session?.user?.id ? cleanSteamId64(data.links[session.user.id]) : '';
      const steamId64 = linked || cleanSteamId64(steam?.steamId64);
      return sendJson(res, 200, { ok:true, steamId64, steamAuthorized:Boolean(steam?.steamId64), discordId:session?.user?.id || '' });
    }
    if (req.method === 'POST') {
      if (!session?.user?.id) return sendJson(res, 401, { ok:false, error:'Нужно авторизоваться через Discord' });
      const body = await readBody(req);
      const steamId64 = cleanSteamId64(body.steamId64 || body.steamId || steam?.steamId64);
      if (!steamId64) return sendJson(res, 400, { ok:false, error:'Укажите корректный SteamID64' });
      data.links[session.user.id] = steamId64;
      data.updatedAt = new Date().toISOString();
      await writeJson(LINKS_PATH, data, `site: link Discord ${session.user.id} to Steam ${steamId64}`);
      return sendJson(res, 200, { ok:true, steamId64 });
    }
    return sendJson(res, 405, { ok:false, error:'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok:false, error:err.message });
  }
};
