const crypto = require('crypto');
const { getBaseUrl } = require('../_utils');

const STATE_COOKIE = 'eotg_steam_auth_state';
const STATE_MAX_AGE = 60 * 10;

function appendSetCookie(res, cookie){
  const current = res.getHeader('Set-Cookie');
  if (!current) return res.setHeader('Set-Cookie', cookie);
  if (Array.isArray(current)) return res.setHeader('Set-Cookie', [...current, cookie]);
  return res.setHeader('Set-Cookie', [current, cookie]);
}

module.exports = async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const returnTo = `${baseUrl}/api/steam-auth/callback`;
  const realm = baseUrl;
  const state = crypto.randomBytes(18).toString('hex');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(res, `${STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${STATE_MAX_AGE}${secure}`);

  const params = new URLSearchParams({
    'openid.ns':'http://specs.openid.net/auth/2.0',
    'openid.mode':'checkid_setup',
    'openid.return_to': `${returnTo}?state=${encodeURIComponent(state)}`,
    'openid.realm': realm,
    'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select'
  });

  res.statusCode = 302;
  res.setHeader('Location', `https://steamcommunity.com/openid/login?${params.toString()}`);
  res.end();
};
