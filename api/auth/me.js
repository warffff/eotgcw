const { getFreshSession, clearSessionCookie, sendJson } = require('../_utils');

module.exports = async (req, res) => {
  try {
    const access = await getFreshSession(req, res);
    if (!access.session) return sendJson(res, 200, { user:null, canEdit:false, roles:[] });

    if (!access.fresh) {
      return sendJson(res, 200, {
        user: access.session.user,
        canEdit: false,
        roles: access.roles || [],
        error:'Не удалось актуально проверить роли Discord. Пользователь авторизован, но права редактирования недоступны до настройки DISCORD_BOT_TOKEN / DISCORD_GUILD_ID.'
      });
    }

    sendJson(res, 200, {
      user: access.session.user,
      canEdit: Boolean(access.canEdit),
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
