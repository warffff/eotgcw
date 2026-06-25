const { sendJson } = require('../_utils');
const { getSamAccess } = require('../_samAuth');

module.exports = async (req, res) => {
  try {
    const access = await getSamAccess(req);
    if (!access.authenticated) return sendJson(res, 200, {
      authenticated:false,
      steam:null,
      sam:access.sam,
      permissions:access.permissions
    });
    return sendJson(res, 200, {
      authenticated:true,
      steam:access.steam,
      sam:access.sam,
      permissions:access.permissions,
      displayName:access.displayName
    });
  } catch (err) {
    return sendJson(res, 500, { authenticated:false, steam:null, error:String(err.message || err) });
  }
};
