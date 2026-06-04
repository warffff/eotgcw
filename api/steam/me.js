const { readSteamSession, sendJson } = require('../_utils');
module.exports = async (req, res) => {
  const steam = readSteamSession(req);
  if (!steam) return sendJson(res, 200, { ok:true, steam:null });
  return sendJson(res, 200, { ok:true, steam:{ steamId64:steam.steamId64, personaName:steam.personaName || '', avatar:steam.avatar || '' } });
};
