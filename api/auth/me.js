const { getFreshSession, clearSessionCookie, sendJson } = require('../_utils');

module.exports = async (req, res) => {
  try {
    const access = await getFreshSession(req, res);
    if (!access.session) return sendJson(res, 200, { user:null, canEdit:false, roles:[] });

    if (!access.fresh) {
      clearSessionCookie(res);
      return sendJson(res, 200, {
        user:null,
        canEdit:false,
        roles:[],
        error:'Невозможно проверить роли Discord. Настройте DISCORD_BOT_TOKEN и авторизуйтесь заново.'
      });
    }

    if (!access.canEdit) {
      clearSessionCookie(res);
      return sendJson(res, 200, { user:null, canEdit:false, roles:[] });
    }

    sendJson(res, 200, {
      user: access.session.user,
      canEdit: true,
      roles: access.roles
    });
  } catch (err) {
    clearSessionCookie(res);
    sendJson(res, 200, {
      user:null,
      canEdit:false,
      roles:[],
      error:'Не удалось проверить роли Discord. Авторизуйтесь заново.'
    });
  }
};
