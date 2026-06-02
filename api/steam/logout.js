const { clearSteamSessionCookie, sendJson } = require('../_utils');
module.exports = async (req, res) => { clearSteamSessionCookie(res); sendJson(res, 200, { ok:true }); };
