
const { GUILD_ID, canEditFromRoles, avatarUrl, getBaseUrl, setSessionCookie } = require('../_utils');
module.exports = async (req, res) => {
  try {
    const code = new URL(req.url, getBaseUrl(req)).searchParams.get('code');
    if (!code) throw new Error('No OAuth code');
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Discord OAuth env vars are not configured');
    const redirect = process.env.DISCORD_REDIRECT_URI || `${getBaseUrl(req)}/api/auth/callback`;
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'authorization_code',code,redirect_uri:redirect})
    });
    if (!tokenRes.ok) throw new Error('Discord token exchange failed');
    const token = await tokenRes.json();
    const userRes = await fetch('https://discord.com/api/users/@me', {headers:{Authorization:`Bearer ${token.access_token}`}});
    if (!userRes.ok) throw new Error('Discord user request failed');
    const user = await userRes.json();
    let roles = [];
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (botToken) {
      const memberRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, {headers:{Authorization:`Bot ${botToken}`}});
      if (memberRes.ok) {
        const member = await memberRes.json();
        roles = member.roles || [];
      }
    }
    const sessionUser = { id:user.id, username:user.username, global_name:user.global_name || user.username, avatar_url: avatarUrl(user) };
    setSessionCookie(res, { user: sessionUser, roles, canEdit: canEditFromRoles(roles) });
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.end('Ошибка Discord-авторизации: ' + err.message);
  }
};
