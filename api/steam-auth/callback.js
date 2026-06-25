const { getBaseUrl, setSteamSessionCookie } = require('../_utils');

const STATE_COOKIE = 'eotg_steam_auth_state';

function readCookie(req, name){
  const cookie = req.headers.cookie || '';
  const found = cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
}
function appendSetCookie(res, cookie){
  const current = res.getHeader('Set-Cookie');
  if (!current) return res.setHeader('Set-Cookie', cookie);
  if (Array.isArray(current)) return res.setHeader('Set-Cookie', [...current, cookie]);
  return res.setHeader('Set-Cookie', [current, cookie]);
}
function clearStateCookie(res){
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(res, `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
async function fetchPersona(steamId64){
  const key = process.env.STEAM_WEB_API_KEY || '';
  if (!key || !steamId64) return { personaName:'', avatar:'' };
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(key)}&steamids=${encodeURIComponent(steamId64)}`;
    const response = await fetch(url);
    if (!response.ok) return { personaName:'', avatar:'' };
    const data = await response.json();
    const player = data?.response?.players?.[0] || {};
    return {
      personaName: String(player.personaname || ''),
      avatar: String(player.avatarfull || player.avatarmedium || player.avatar || '')
    };
  } catch {
    return { personaName:'', avatar:'' };
  }
}

module.exports = async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const url = new URL(req.url, baseUrl);
  const state = url.searchParams.get('state') || '';
  const savedState = readCookie(req, STATE_COOKIE);

  if (!state || !savedState || state !== savedState) {
    clearStateCookie(res);
    res.statusCode = 302;
    res.setHeader('Location', '/?steam_auth=failed');
    return res.end();
  }

  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'state') continue;
    params.set(key, value);
  }
  params.set('openid.mode', 'check_authentication');

  let valid = false;
  try {
    const checkRes = await fetch('https://steamcommunity.com/openid/login', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const text = await checkRes.text();
    valid = /is_valid\s*:\s*true/i.test(text);
  } catch {
    valid = false;
  }

  if (!valid) {
    clearStateCookie(res);
    res.statusCode = 302;
    res.setHeader('Location', '/?steam_auth=failed');
    return res.end();
  }

  const claimedId = url.searchParams.get('openid.claimed_id') || '';
  const match = claimedId.match(/\/id\/(\d{15,20})$/);
  const steamId64 = match ? match[1] : '';
  if (!steamId64) {
    clearStateCookie(res);
    res.statusCode = 302;
    res.setHeader('Location', '/?steam_auth=failed');
    return res.end();
  }

  const persona = await fetchPersona(steamId64);
  setSteamSessionCookie(res, { steamId64, ...persona });
  clearStateCookie(res);

  res.statusCode = 302;
  res.setHeader('Location', '/');
  res.end();
};
