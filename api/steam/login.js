const { getBaseUrl } = require('../_utils');
module.exports = async (req, res) => {
  const base = getBaseUrl(req);
  const returnTo = `${base}/api/steam/callback`;
  const params = new URLSearchParams({
    'openid.ns':'http://specs.openid.net/auth/2.0',
    'openid.mode':'checkid_setup',
    'openid.return_to':returnTo,
    'openid.realm':base,
    'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select'
  });
  res.statusCode = 302;
  res.setHeader('Location', `https://steamcommunity.com/openid/login?${params.toString()}`);
  res.end();
};
