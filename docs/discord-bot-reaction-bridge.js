// Подключи этот обработчик в уже существующий Discord-бот.
// Он пересылает reaction add/remove на сайт, а сайт уже проверяет роль и логирует бронь.
//
// Требуется env:
// SITE_BASE_URL=https://your-site.vercel.app
// MAP_REACTION_BRIDGE_SECRET=<любая_секретная_строка>  // опционально, если добавишь свою проверку в api/galaxy-reaction.js

const MAP_LOG_CHANNEL_ID = '1512549066058236014';

async function sendGalaxyReaction(action, reaction, user){
  if (!reaction || !user || user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  if (reaction.message?.partial) {
    try { await reaction.message.fetch(); } catch { return; }
  }
  if (reaction.message.channelId !== MAP_LOG_CHANNEL_ID) return;

  await fetch(`${process.env.SITE_BASE_URL}/api/galaxy-reaction`, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      ...(process.env.MAP_REACTION_BRIDGE_SECRET ? { 'x-map-reaction-secret':process.env.MAP_REACTION_BRIDGE_SECRET } : {})
    },
    body:JSON.stringify({
      action, // "add" или "remove"
      userId:user.id,
      messageId:reaction.message.id,
      channelId:reaction.message.channelId,
      emoji:reaction.emoji?.name || ''
    })
  }).catch(console.error);
}

// discord.js v14:
client.on('messageReactionAdd', (reaction, user) => sendGalaxyReaction('add', reaction, user));
client.on('messageReactionRemove', (reaction, user) => sendGalaxyReaction('remove', reaction, user));
