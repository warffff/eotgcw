const { readSession, setSessionCookie, setUserHintCookie, fetchDiscordMemberRoles, canEditFromRoles, sendJson } = require('../_utils');

module.exports = async (req, res) => {
  const session = readSession(req);
  if (!session || !session.user || !session.user.id) {
    return sendJson(res, 200, { user:null, canEdit:false, roles:[] });
  }

  let roles = Array.isArray(session.roles) ? session.roles : [];
  let fresh = false;
  let roleCheckError = null;

  try {
    const freshRoles = await fetchDiscordMemberRoles(session.user.id);
    if (Array.isArray(freshRoles)) {
      roles = freshRoles;
      fresh = true;
    } else {
      roleCheckError = 'DISCORD_BOT_TOKEN не настроен, актуальная проверка ролей недоступна.';
    }
  } catch (err) {
    roleCheckError = 'Не удалось актуально проверить роли Discord.';
  }

  const canEdit = fresh ? canEditFromRoles(roles) : false;
  const freshSession = { ...session, roles, canEdit };
  setSessionCookie(res, freshSession);
  setUserHintCookie(res, freshSession.user);

  return sendJson(res, 200, {
    user: freshSession.user,
    canEdit,
    roles,
    fresh,
    error: roleCheckError
  });
};
