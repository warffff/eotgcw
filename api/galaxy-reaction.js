const { GUILD_ID, fetchDiscordMemberRoles, sendJson } = require('./_utils');

const MAP_LOG_CHANNEL_ID = process.env.DISCORD_MAP_LOG_CHANNEL_ID || '1512549066058236014';
const BOOKING_LOG_CHANNEL_ID = process.env.DISCORD_BOOKING_LOG_CHANNEL_ID || '1512560293740548146';
const EVENTOLOG_ROLE_ID = '1305567485218521169';
const EVENTOLOG_MENTION = `<@&${EVENTOLOG_ROLE_ID}>`;

function clampText(value, max=1024){
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}
function userMention(userId){ return userId ? `<@${userId}>` : 'Неизвестный ивентолог'; }
function messageLink(guildId, channelId, messageId){
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}
function isLaunchMessage(message){
  const title = message?.embeds?.[0]?.title || '';
  if (title.includes('Venator выдвинулись')) return 'battle';
  if (title.includes('Начата дипломатическая миссия')) return 'diplomacy';
  return null;
}
function extractField(message, name){
  const fields = message?.embeds?.[0]?.fields || [];
  return fields.find(f => String(f.name || '').toLowerCase() === name.toLowerCase())?.value || '';
}
function extractPlanetName(message){
  const planetField = extractField(message, 'Планета');
  if (planetField) return planetField.split('•')[0].trim();
  const desc = message?.embeds?.[0]?.description || '';
  const bold = desc.match(/\*\*([^*]+)\*\*/g);
  if (bold && bold.length) return bold[bold.length - 1].replace(/\*/g, '').trim();
  return 'неизвестная планета';
}
async function discordFetch(botToken, path, options={}){
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers:{
      Authorization:`Bot ${botToken}`,
      'Content-Type':'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Discord HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}
async function getOrCreateThread(botToken, message, operation, planet){
  if (message?.thread?.id) return message.thread;
  try {
    return await discordFetch(botToken, `/channels/${encodeURIComponent(MAP_LOG_CHANNEL_ID)}/messages/${encodeURIComponent(message.id)}/threads`, {
      method:'POST',
      body:JSON.stringify({
        name:`${operation === 'diplomacy' ? 'Дипломатия' : 'Боевой вылет'}: ${clampText(planet, 42)}`.slice(0, 95),
        auto_archive_duration:10080
      })
    });
  } catch (_) {
    return message?.thread || null;
  }
}
function buildBookingEmbed(action, operation, planet, userId, sourceUrl, threadUrl){
  const added = action === 'add';
  const battle = operation === 'battle';
  const opText = battle ? 'боевого вылета' : 'дипломатической миссии';
  return {
    color: added ? 0x57f287 : 0xff5c74,
    title: added ? '✅ Бронь проведения операции' : '❌ Отмена брони проведения операции',
    description: added
      ? `${userMention(userId)} забронировал проведение ${opText} у планеты **${clampText(planet, 120)}**. Все необходимые карты и аддоны, дату проведения, будут указаны в ветке этого сообщения.`
      : `${userMention(userId)} отменил бронь проведения ${opText} у планеты **${clampText(planet, 120)}**.`,
    fields:[
      { name:'Операция', value:battle ? 'Боевой вылет' : 'Дипломатическая миссия', inline:true },
      { name:'Планета', value:clampText(planet, 1024), inline:true },
      { name:'Исходное сообщение', value:`[Открыть сообщение](${sourceUrl})`, inline:false },
      { name:'Ветка операции', value:threadUrl ? `[Открыть ветку](${threadUrl})` : 'Ветка будет доступна под исходным сообщением.', inline:false }
    ],
    footer:{ text:'Галактическая карта • Бронирование ивента' },
    timestamp:new Date().toISOString()
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'Method not allowed' });

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return sendJson(res, 503, { ok:false, error:'DISCORD_BOT_TOKEN is not configured' });

  const bridgeSecret = process.env.MAP_REACTION_BRIDGE_SECRET;
  if (bridgeSecret && req.headers['x-map-reaction-secret'] !== bridgeSecret) {
    return sendJson(res, 401, { ok:false, error:'Invalid bridge secret' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (_) {
    return sendJson(res, 400, { ok:false, error:'Invalid JSON body' });
  }

  const action = String(body.action || body.type || '').toLowerCase().includes('remove') ? 'remove' : 'add';
  const userId = String(body.userId || body.user_id || '').trim();
  const messageId = String(body.messageId || body.message_id || '').trim();
  const channelId = String(body.channelId || body.channel_id || MAP_LOG_CHANNEL_ID).trim();

  if (!userId || !messageId) return sendJson(res, 400, { ok:false, error:'Missing userId or messageId' });
  if (channelId !== MAP_LOG_CHANNEL_ID) return sendJson(res, 200, { ok:false, ignored:true, reason:'not_map_log_channel' });

  const roles = await fetchDiscordMemberRoles(userId).catch(() => null);
  if (!Array.isArray(roles) || !roles.includes(EVENTOLOG_ROLE_ID)) {
    return sendJson(res, 200, { ok:false, ignored:true, reason:'user_has_no_eventolog_role' });
  }

  const message = await discordFetch(botToken, `/channels/${encodeURIComponent(MAP_LOG_CHANNEL_ID)}/messages/${encodeURIComponent(messageId)}`);
  const operation = isLaunchMessage(message);
  if (!operation) return sendJson(res, 200, { ok:false, ignored:true, reason:'not_launch_or_diplomacy_message' });

  const planet = extractPlanetName(message);
  const thread = await getOrCreateThread(botToken, message, operation, planet);
  const sourceUrl = messageLink(GUILD_ID, MAP_LOG_CHANNEL_ID, messageId);
  const threadUrl = thread?.id ? messageLink(GUILD_ID, thread.id, thread.id) : '';

  const embed = buildBookingEmbed(action, operation, planet, userId, sourceUrl, threadUrl);
  await discordFetch(botToken, `/channels/${encodeURIComponent(BOOKING_LOG_CHANNEL_ID)}/messages`, {
    method:'POST',
    body:JSON.stringify({
      content:EVENTOLOG_MENTION,
      embeds:[embed],
      allowed_mentions:{ roles:[EVENTOLOG_ROLE_ID], users:[userId] }
    })
  });

  return sendJson(res, 200, { ok:true, action, operation, planet, thread_id:thread?.id || null });
};
