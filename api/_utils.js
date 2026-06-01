const crypto = require('crypto');

const EDIT_ROLES = ['943798033215279159','943798033215279158','943798033215279156','1223238731939708968','1230473183312744459','1495587971880190042'];
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID || '1510616159110828062';
const COOKIE_NAME = 'eotf_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const USER_HINT_COOKIE = 'eotg_user_hint';

function appendSetCookie(res, cookie){
  const current = res.getHeader('Set-Cookie');
  if (!current) return res.setHeader('Set-Cookie', cookie);
  if (Array.isArray(current)) return res.setHeader('Set-Cookie', [...current, cookie]);
  return res.setHeader('Set-Cookie', [current, cookie]);
}

function base64url(input){
  return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function unbase64url(input){
  input = input.replace(/-/g,'+').replace(/_/g,'/');
  while (input.length % 4) input += '=';
  return Buffer.from(input,'base64').toString();
}
function sign(payload){
  const secret = process.env.SESSION_SECRET || 'CHANGE_ME_SESSION_SECRET';
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function makeSession(data){
  const payload = base64url(JSON.stringify({...data, exp: Date.now()+1000*SESSION_MAX_AGE_SECONDS}));
  return `${payload}.${sign(payload)}`;
}
function readCookie(req, name){
  const cookie = req.headers.cookie || '';
  const found = cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return found ? decodeURIComponent(found.slice(name.length+1)) : '';
}
function readSession(req){
  const raw = readCookie(req, COOKIE_NAME);
  if (!raw || !raw.includes('.')) return null;
  const [payload, sig] = raw.split('.');
  if (sig !== sign(payload)) return null;
  try {
    const data = JSON.parse(unbase64url(payload));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}
function setSessionCookie(res, data){
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(res, `${COOKIE_NAME}=${encodeURIComponent(makeSession(data))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`);
}
function setUserHintCookie(res, user){
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const safeUser = {
    id: user?.id || '',
    username: user?.username || '',
    global_name: user?.global_name || user?.username || 'Пользователь',
    avatar_url: user?.avatar_url || ''
  };
  const encoded = Buffer.from(JSON.stringify(safeUser)).toString('base64url');
  appendSetCookie(res, `${USER_HINT_COOKIE}=${encoded}; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`);
}
function clearSessionCookie(res){
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    `${USER_HINT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secure}`
  ]);
}
function canEditFromRoles(roles=[]){ return roles.some(r => EDIT_ROLES.includes(String(r))); }

async function fetchDiscordMemberRoles(userId){
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken || !userId) return null;

  const memberRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${encodeURIComponent(userId)}`, {
    headers:{ Authorization:`Bot ${botToken}` }
  });

  if (memberRes.status === 404) return [];
  if (!memberRes.ok) throw new Error(`Discord role check failed: HTTP ${memberRes.status}`);

  const member = await memberRes.json();
  return Array.isArray(member.roles) ? member.roles : [];
}

async function getFreshSession(req, res){
  const session = readSession(req);
  if (!session || !session.user || !session.user.id) {
    return { session:null, roles:[], canEdit:false, fresh:false };
  }

  const roles = await fetchDiscordMemberRoles(session.user.id);
  if (!roles) {
    return { session, roles:session.roles || [], canEdit:Boolean(session.canEdit), fresh:false };
  }

  const freshSession = {
    ...session,
    roles,
    canEdit: canEditFromRoles(roles)
  };

  if (res) setSessionCookie(res, freshSession);
  return { session:freshSession, roles, canEdit:freshSession.canEdit, fresh:true };
}

function avatarUrl(user){
  if (!user || !user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}
function getBaseUrl(req){
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/,'');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}
function sendJson(res, status, body){
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function truncate(text, max=950){
  text = String(text || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return text.length > max ? text.slice(0,max-3)+'...' : text;
}
module.exports = { EDIT_ROLES, GUILD_ID, COOKIE_NAME, USER_HINT_COOKIE, makeSession, readSession, setSessionCookie, setUserHintCookie, clearSessionCookie, canEditFromRoles, fetchDiscordMemberRoles, getFreshSession, avatarUrl, getBaseUrl, sendJson, truncate };
