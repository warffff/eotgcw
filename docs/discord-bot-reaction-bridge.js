// Подключи этот файл в уже существующий Discord-бот.
// Без этого сайт НЕ может узнать, что кто-то поставил/убрал реакцию в Discord.
//
// Требуется:
// 1) Включить Gateway Intent: GuildMessageReactions
// 2) Если бот должен видеть реакции на старые сообщения после рестарта — включить partials:
//    Partials.Message, Partials.Channel, Partials.Reaction
// 3) SITE_BASE_URL=https://your-site.vercel.app
// 4) MAP_REACTION_BRIDGE_SECRET=<секрет> — опционально, но желательно.
//    Такой же секрет нужно поставить на сайте в env MAP_REACTION_BRIDGE_SECRET.

const MAP_LOG_CHANNEL_ID = '1512549066058236014';

function installGalaxyReactionBridge(client){
  async function sendGalaxyReaction(action, reaction, user){
    try {
      if (!reaction || !user || user.bot) return;

      if (reaction.partial) {
        try { await reaction.fetch(); } catch (err) {
          console.error('[galaxy reaction bridge] failed to fetch partial reaction:', err);
          return;
        }
      }

      if (reaction.message?.partial) {
        try { await reaction.message.fetch(); } catch (err) {
          console.error('[galaxy reaction bridge] failed to fetch partial message:', err);
          return;
        }
      }

      const channelId = reaction.message?.channelId || reaction.message?.channel_id;
      if (channelId !== MAP_LOG_CHANNEL_ID) return;

      const siteBaseUrl = process.env.SITE_BASE_URL;
      if (!siteBaseUrl) {
        console.error('[galaxy reaction bridge] SITE_BASE_URL is not set');
        return;
      }

      let roles = [];
      try {
        const member = reaction.message.guild
          ? await reaction.message.guild.members.fetch(user.id)
          : null;
        roles = member ? [...member.roles.cache.keys()] : [];
      } catch (err) {
        console.error('[galaxy reaction bridge] failed to fetch member roles:', err);
      }

      const response = await fetch(`${siteBaseUrl.replace(/\/$/, '')}/api/galaxy-reaction`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          ...(process.env.MAP_REACTION_BRIDGE_SECRET ? { 'x-map-reaction-secret':process.env.MAP_REACTION_BRIDGE_SECRET } : {})
        },
        body:JSON.stringify({
          action, // "add" или "remove"
          userId:user.id,
          channelId,
          messageId:reaction.message.id,
          emoji:reaction.emoji?.name || '',
          roles
        })
      });

      const text = await response.text();
      if (!response.ok) {
        console.error('[galaxy reaction bridge] site returned error:', response.status, text);
      } else {
        console.log('[galaxy reaction bridge] site response:', text);
      }
    } catch (err) {
      console.error('[galaxy reaction bridge] unexpected error:', err);
    }
  }

  client.on('messageReactionAdd', (reaction, user) => sendGalaxyReaction('add', reaction, user));
  client.on('messageReactionRemove', (reaction, user) => sendGalaxyReaction('remove', reaction, user));
}

module.exports = { installGalaxyReactionBridge };
