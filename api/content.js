const fs = require('fs/promises');
const path = require('path');
const { sendJson, truncate } = require('./_utils');
const { getSamAccess, canEditContentKey, getContentMeta, setContentMeta } = require('./_samAuth');

const ALLOWED = new Set(['rules','lore','charter']);
const LOG_WEBHOOK = process.env.GITHUB_CHANGE_LOG_WEBHOOK || '';

function sectionTitle(key){
  return key === 'rules' ? 'Правила' : key === 'lore' ? 'Лор' : key === 'charter' ? 'Документация' : 'Документ';
}

function contentPath(key){
  const envKey = `GITHUB_CONTENT_PATH_${key.toUpperCase()}`;
  return process.env[envKey] || `content/${key}.html`;
}

function githubConfigured(){
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
}

function githubHeaders(){
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Edge-of-the-Force-JVS-Site'
  };
}

function ghBaseUrl(filePath){
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g,'/')}`;
}

async function getGithubFile(key){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const filePath = contentPath(key);
  const r = await fetch(`${ghBaseUrl(filePath)}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub read failed: HTTP ${r.status}`);
  const data = await r.json();
  const raw = String(data.content || '').replace(/\n/g, '');
  return { html: Buffer.from(raw, 'base64').toString('utf8'), sha: data.sha, path: filePath, url: data.html_url };
}

async function getLocalFile(key){
  const p = path.join(process.cwd(), 'content', `${key}.html`);
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

async function getReadableContent(key){
  let html = null;
  if (githubConfigured()) {
    try {
      const gh = await getGithubFile(key);
      html = gh?.html || null;
    } catch (_) {}
  }

  const local = await getLocalFile(key);

  // Старые удалённые версии charter были текстовым уставом. Не даём им ломать новую систему папок.
  if (key === 'charter' && html && !/var-docs-layout|var-folder-grid|var-doc-detail/i.test(html)) {
    html = null;
  }

  if (!html) html = local;
  return html;
}

async function updateGithubFile(key, after, editor){
  const branch = process.env.GITHUB_BRANCH || 'main';
  const filePath = contentPath(key);
  const current = await getGithubFile(key).catch(err => {
    if (String(err.message || '').includes('HTTP 404')) return null;
    throw err;
  });
  const before = current?.html || await getLocalFile(key) || '';
  const body = {
    message: `site: update ${sectionTitle(key)} (${key})`,
    content: Buffer.from(after, 'utf8').toString('base64'),
    branch,
    committer: {
      name: process.env.GITHUB_COMMITTER_NAME || 'Edge of the Galaxy Site',
      email: process.env.GITHUB_COMMITTER_EMAIL || 'site-bot@users.noreply.github.com'
    }
  };
  if (current?.sha) body.sha = current.sha;
  const r = await fetch(ghBaseUrl(filePath), {
    method: 'PUT',
    headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub write failed: HTTP ${r.status}`);
  return { before, commitUrl: data.commit?.html_url || data.content?.html_url || null, path: filePath };
}

async function sendChangeLog({key, before, after, editor, steamId64, rank, commitUrl}){
  if (!LOG_WEBHOOK) return;
  const section = sectionTitle(key);
  await fetch(LOG_WEBHOOK, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      username:'Edge of the Galaxy • Логи сайта',
      avatar_url:'https://cdn.discordapp.com/embed/avatars/0.png',
      embeds:[{
        title:'Изменение документа на сайте',
        color:0x38bdf8,
        description:`**Раздел:** ${section}\n**Редактор:** ${editor}\n**SteamID64:** ${steamId64 || 'неизвестно'}\n**SAM rank:** ${rank || 'user'}${commitUrl ? `\n**GitHub commit:** ${commitUrl}` : ''}`,
        fields:[
          {name:'Было', value: truncate(before, 1000) || 'Пусто'},
          {name:'Стало', value: truncate(after, 1000) || 'Пусто'}
        ],
        timestamp:new Date().toISOString()
      }]
    })
  }).catch(() => {});
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://local');
      const key = url.searchParams.get('key');
      if (!ALLOWED.has(key)) return sendJson(res, 400, {error:'Unknown document'});
      const html = await getReadableContent(key);
      const meta = await getContentMeta(key);
      return sendJson(res, 200, {key, html, meta});
    }

    if (req.method !== 'POST') return sendJson(res, 405, {error:'Method not allowed'});

    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    const key = body.key;
    if (!ALLOWED.has(key)) return sendJson(res, 400, {error:'Unknown document'});

    const access = await getSamAccess(req);
    if (!access.authenticated) return sendJson(res, 403, {error:'Нужно авторизоваться через Steam.'});
    if (!canEditContentKey(access, key)) {
      return sendJson(res, 403, {error:'Недостаточно прав SAM для редактирования этого раздела.'});
    }

    if (!githubConfigured()) return sendJson(res, 500, {error:'GitHub env vars are not configured: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO'});

    const after = String(body.after || '');
    if (!after.trim()) return sendJson(res, 400, {error:'Документ не может быть пустым'});

    const editor = access.displayName || access.steam?.steamId64 || 'Steam пользователь';
    const result = await updateGithubFile(key, after, editor);
    const meta = await setContentMeta(key, access);
    await sendChangeLog({
      key,
      before: result.before,
      after,
      editor,
      steamId64: access.steam?.steamId64,
      rank: access.sam?.rank,
      commitUrl: result.commitUrl
    });

    sendJson(res, 200, {ok:true, savedTo:'github', path: result.path, commitUrl: result.commitUrl, meta});
  } catch (err) {
    sendJson(res, 500, {error:err.message});
  }
};