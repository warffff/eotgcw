
const { clearSessionCookie, sendJson } = require('../_utils');
module.exports = async (req, res) => { clearSessionCookie(res); sendJson(res, 200, {ok:true}); };
