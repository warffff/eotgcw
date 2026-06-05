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
async function createBookingThread(botToken, bookingMessageId, operation, planet){
  const thread = await discordFetch(botToken, `/channels/${encodeURIComponent(BOOKING_LOG_CHANNEL_ID)}/messages/${encodeURIComponent(bookingMessageId)}/threads`, {
    method:'POST',
    body:JSON.stringify({
      name:`${operation === 'diplomacy' ? 'Дипломатия' : 'Боевой вылет'}: ${clampText(planet, 42)}`.slice(0, 95),
      auto_archive_duration:10080
    })
  });

  if (thread?.id) {
    await discordFetch(botToken, `/channels/${encodeURIComponent(thread.id)}/messages`, {
      method:'POST',
      body:JSON.stringify({
        content:'Здесь ивентолог указывает все необходимые карты и аддоны, дату и время проведения операции, а также дополнительные условия ивента.'
      })
    }).catch(() => {});
  }

  return thread;
}
function buildBookingEmbed(action, operation, planet, userId, sourceUrl){
  const added = action === 'add';
  const battle = operation === 'battle';
  const opText = battle ? 'боевого вылета' : 'дипломатической миссии';
  return {
    color: added ? 0x57f287 : 0xff5c74,
    title: added ? '✅ Бронь проведения операции' : '❌ Отмена брони проведения операции',
    description: added
      ? `${userMention(userId)} забронировал проведение ${opText} у планеты **${clampText(planet, 120)}**. Ветка создаётся под этим сообщением в канале бронирований; там будут указаны карты, аддоны и дата проведения.`
      : `${userMention(userId)} отменил бронь проведения ${opText} у планеты **${clampText(planet, 120)}**.`,
    fields:[
      { name:'Операция', value:battle ? 'Боевой вылет' : 'Дипломатическая миссия', inline:true },
      { name:'Планета', value:clampText(planet, 1024), inline:true },
      { name:'Исходное сообщение', value:`[Открыть сообщение](${sourceUrl})`, inline:false },
      { name:'Ветка операции', value:added ? 'Создаётся под этим сообщением в канале бронирований.' : 'Бронь отменена; ветка бронирования больше не актуальна.', inline:false }
    ],
    footer:{ text:'Галактическая карта • Бронирование ивента' },
    timestamp:new Date().toISOString()
  };
}
function readBodyValue(body, ...keys){
  for (const key of keys) {
    const value = key.split('.').reduce((obj, part) => obj && obj[part], body);
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
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

  const actionRaw = String(readBodyValue(body, 'action', 'type', 'event') || '').toLowerCase();
  const action = actionRaw.includes('remove') || actionRaw.includes('delete') ? 'remove' : 'add';
  const userId = String(readBodyValue(body, 'userId', 'user_id', 'user.id', 'member.user.id') || '').trim();
  const messageId = String(readBodyValue(body, 'messageId', 'message_id', 'message.id') || '').trim();
  const channelId = String(readBodyValue(body, 'channelId', 'channel_id', 'message.channelId', 'message.channel_id') || MAP_LOG_CHANNEL_ID).trim();

  if (!userId || !messageId) {
    return sendJson(res, 400, {
      ok:false,
      error:'Missing userId or messageId',
      received_keys:Object.keys(body)
    });
  }

  if (channelId !== MAP_LOG_CHANNEL_ID) {
    return sendJson(res, 200, { ok:false, ignored:true, reason:'not_map_log_channel', channelId, expected:MAP_LOG_CHANNEL_ID });
  }

  let roles = Array.isArray(body.roles) ? body.roles.map(String) : null;
  if (!roles && Array.isArray(body.member?.roles)) roles = body.member.roles.map(String);
  if (!roles) roles = await fetchDiscordMemberRoles(userId).catch(() => null);

  if (!Array.isArray(roles)) {
    return sendJson(res, 200, { ok:false, ignored:true, reason:'could_not_read_user_roles', userId });
  }

  if (!roles.includes(EVENTOLOG_ROLE_ID)) {
    return sendJson(res, 200, { ok:false, ignored:true, reason:'user_has_no_eventolog_role', userId, roles });
  }

  let message;
  try {
    message = await discordFetch(botToken, `/channels/${encodeURIComponent(MAP_LOG_CHANNEL_ID)}/messages/${encodeURIComponent(messageId)}`);
  } catch (err) {
    return sendJson(res, 502, { ok:false, error:'Could not fetch source message from Discord', detail:String(err.message || err).slice(0, 500) });
  }

  const operation = isLaunchMessage(message);
  if (!operation) {
    return sendJson(res, 200, {
      ok:false,
      ignored:true,
      reason:'not_launch_or_diplomacy_message',
      source_title:message?.embeds?.[0]?.title || ''
    });
  }

  const planet = extractPlanetName(message);
  const sourceUrl = messageLink(GUILD_ID, MAP_LOG_CHANNEL_ID, messageId);

  if (action === 'add') {
    const embed = buildBookingEmbed(action, operation, planet, userId, sourceUrl);
    const bookingMessage = await discordFetch(botToken, `/channels/${encodeURIComponent(BOOKING_LOG_CHANNEL_ID)}/messages`, {
      method:'POST',
      body:JSON.stringify({
        content:EVENTOLOG_MENTION,
        embeds:[embed],
        allowed_mentions:{ roles:[EVENTOLOG_ROLE_ID], users:[userId] }
      })
    });

    const thread = bookingMessage?.id
      ? await createBookingThread(botToken, bookingMessage.id, operation, planet).catch(() => null)
      : null;

    return sendJson(res, 200, { ok:true, action, operation, planet, booking_message_id:bookingMessage?.id || null, thread_id:thread?.id || null });
  }

  const embed = buildBookingEmbed(action, operation, planet, userId, sourceUrl);
  const cancelMessage = await discordFetch(botToken, `/channels/${encodeURIComponent(BOOKING_LOG_CHANNEL_ID)}/messages`, {
    method:'POST',
    body:JSON.stringify({
      content:EVENTOLOG_MENTION,
      embeds:[embed],
      allowed_mentions:{ roles:[EVENTOLOG_ROLE_ID], users:[userId] }
    })
  });

  return sendJson(res, 200, { ok:true, action, operation, planet, cancel_message_id:cancelMessage?.id || null });
};
