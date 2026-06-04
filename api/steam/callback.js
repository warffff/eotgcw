const { getBaseUrl, setSteamSessionCookie } = require('../_utils');

function extractSteamId(claimed){
  const match = String(claimed || '').match(/https?:\/\/steamcommunity\.com\/openid\/id\/(\d{15,20})/i);
  return match ? match[1] : '';
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, getBaseUrl(req));
    const params = new URLSearchParams(url.searchParams);
    const steamId64 = extractSteamId(params.get('openid.claimed_id'));
    if (!steamId64) throw new Error('SteamID64 не найден в ответе Steam');

    params.set('openid.mode', 'check_authentication');
    const verify = await fetch('https://steamcommunity.com/openid/login', {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:params.toString()
    });
    const text = await verify.text();
    if (!verify.ok || !/is_valid\s*:\s*true/i.test(text)) throw new Error('Steam не подтвердил авторизацию');

    setSteamSessionCookie(res, { steamId64 });
    res.statusCode = 302;
    res.setHeader('Location', '/?steam=success#stats');
    res.end();
  } catch (err) {
    res.statusCode = 302;
    res.setHeader('Location', '/?steam=error#stats');
    res.end();
  }
};
