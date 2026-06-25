const { getFreshSession, sendJson } = require('./_utils');
const { EVENTOLOG_ROLE_ID, fetchActiveBookingsForUser } = require('./_eventBookings');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return sendJson(res, 405, { ok:false, error:'Method not allowed' });

  try {
    const access = await getFreshSession(req, res);
    if (!access.session) return sendJson(res, 200, { ok:true, bookings:[], reason:'not_authenticated' });
    if (!access.fresh) return sendJson(res, 200, { ok:true, bookings:[], reason:'roles_not_fresh' });

    const roles = (access.roles || []).map(String);
    if (!roles.includes(EVENTOLOG_ROLE_ID)) {
      return sendJson(res, 200, { ok:true, bookings:[], reason:'not_eventolog' });
    }

    const userId = access.session.user?.id || '';
    const bookings = await fetchActiveBookingsForUser(userId);
    return sendJson(res, 200, { ok:true, bookings });
  } catch (err) {
    return sendJson(res, 500, { ok:false, error:String(err.message || err) });
  }
};
