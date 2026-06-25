const nacl = require('tweetnacl');
const { GUILD_ID } = require('./_utils');

const MAP_LOG_CHANNEL_ID = process.env.DISCORD_MAP_LOG_CHANNEL_ID || '1512549066058236014';
const BOOKING_LOG_CHANNEL_ID = process.env.DISCORD_BOOKING_LOG_CHANNEL_ID || '1512560293740548146';
const EVENTOLOG_ROLE_ID = '1305567485218521169';
const EVENTOLOG_MENTION = `<@&${EVENTOLOG_ROLE_ID}>`;

function sendJson(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function clampText(value, max=1024){
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}
async function readRawBody(req){
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.rawBody) return Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody);

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
function verifyDiscordRequest(req, rawBody){
  const publicKey = process.env.DISCORD_PUBLIC_KEY || process.env.DISCORD_APPLICATION_PUBLIC_KEY || process.env.APPLICATION_PUBLIC_KEY;
  if (!publicKey) throw new Error('DISCORD_PUBLIC_KEY is not configured');

  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  if (!signature || !timestamp) return false;

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(String(signature), 'hex'),
    Buffer.from(String(publicKey), 'hex')
  );
}
function interactionUserId(interaction){
  return interaction?.member?.user?.id || interaction?.user?.id || '';
}
function hasEventologRole(interaction){
  const roles = interaction?.member?.roles || [];
  return Array.isArray(roles) && roles.map(String).includes(EVENTOLOG_ROLE_ID);
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
function messageLink(guildId, channelId, messageId){
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}
async function discordFetch(path, options={}){
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) throw new Error('DISCORD_BOT_TOKEN is not configured');

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
    throw new Error(`Discord HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  if (res.status === 204) return null;
  return res.json().catch(() => null);
}
function buildBookingEmbed(action, operation, planet, userId, sourceUrl){
  const added = action === 'add';
  const battle = operation === 'battle';
  const opText = battle ? 'боевого вылета' : 'дипломатической миссии';

  return {
    color: added ? 0x57f287 : 0xff5c74,
    title: added ? '✅ Бронь проведения операции' : '❌ Отмена брони проведения операции',
    description: added
      ? `<@${userId}> забронировал проведение ${opText} у планеты **${clampText(planet, 120)}**. Ветка создаётся под этим сообщением; панель оформления анонса появится у ивентолога на вкладке «Галактическая карта».`
      : `<@${userId}> отменил бронь проведения ${opText} у планеты **${clampText(planet, 120)}**.`,
    fields:[
      { name:'Операция', value:battle ? 'Боевой вылет' : 'Дипломатическая миссия', inline:true },
      { name:'Планета', value:clampText(planet, 1024), inline:true },
      { name:'Исходное сообщение', value:`[Открыть сообщение](${sourceUrl})`, inline:false },
      { name:'Ветка операции', value:added ? 'Создаётся под этим сообщением в канале бронирований.' : 'Бронь отменена; ветка бронирования больше не актуальна.', inline:false },
      { name:'Анонс ивента', value:added ? 'Откройте сайт → Галактическая карта, чтобы заполнить и отправить webhook-анонс.' : 'Панель анонса на сайте будет скрыта после обновления списка броней.', inline:false }
    ],
    footer:{ text:'Галактическая карта • Бронирование ивента' },
    timestamp:new Date().toISOString()
  };
}
async function createBookingThread(bookingMessageId, operation, planet){
  const thread = await discordFetch(`/channels/${encodeURIComponent(BOOKING_LOG_CHANNEL_ID)}/messages/${encodeURIComponent(bookingMessageId)}/threads`, {
    method:'POST',
    body:JSON.stringify({
      name:`${operation === 'diplomacy' ? 'Дипломатия' : 'Боевой вылет'}: ${clampText(planet, 42)}`.slice(0, 95),
      auto_archive_duration:10080
    })
  });

  if (thread?.id) {
    await discordFetch(`/channels/${encodeURIComponent(thread.id)}/messages`, {
      method:'POST',
      body:JSON.stringify({
        content:'Здесь ивентолог указывает все необходимые карты и аддоны, дату и время проведения операции, а также дополнительные условия ивента.'
      })
    }).catch(() => {});
  }

  return thread;
}
async function handleBooking(interaction, action){
  const userId = interactionUserId(interaction);
  const message = interaction.message;
  const sourceChannelId = interaction.channel_id || message?.channel_id || MAP_LOG_CHANNEL_ID;

  if (String(sourceChannelId) !== MAP_LOG_CHANNEL_ID) {
    return { ok:false, message:'Эта кнопка работает только в канале логов карты.' };
  }

  if (!hasEventologRole(interaction)) {
    return { ok:false, message:'Бронировать проведение может только ивентолог с нужной ролью.' };
  }

  const operation = isLaunchMessage(message);
  if (!operation) {
    return { ok:false, message:'Это сообщение не является стартом боевого вылета или дипломатической миссии.' };
  }

  const planet = extractPlanetName(message);
  const sourceUrl = messageLink(interaction.guild_id || GUILD_ID, MAP_LOG_CHANNEL_ID, message?.id || '');

  const embed = buildBookingEmbed(action, operation, planet, userId, sourceUrl);
  const bookingMessage = await discordFetch(`/channels/${encodeURIComponent(BOOKING_LOG_CHANNEL_ID)}/messages`, {
    method:'POST',
    body:JSON.stringify({
      content:EVENTOLOG_MENTION,
      embeds:[embed],
      allowed_mentions:{ roles:[EVENTOLOG_ROLE_ID], users:[userId] }
    })
  });

  let thread = null;
  if (action === 'add' && bookingMessage?.id) {
    thread = await createBookingThread(bookingMessage.id, operation, planet).catch(() => null);
  }

  return {
    ok:true,
    message: action === 'add'
      ? `Бронь отправлена в канал бронирований${thread?.id ? ', ветка создана.' : '.'}`
      : 'Отмена брони отправлена в канал бронирований.'
  };
}

async function handler(req, res){
  if (req.method !== 'POST') return sendJson(res, 405, { error:'Method not allowed' });

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (_) {
    return sendJson(res, 400, { error:'Could not read body' });
  }

  try {
    if (!verifyDiscordRequest(req, rawBody)) {
      return sendJson(res, 401, { error:'invalid request signature' });
    }
  } catch (err) {
    return sendJson(res, 500, { error:String(err.message || err) });
  }

  let interaction = {};
  try {
    interaction = JSON.parse(rawBody || '{}');
  } catch (_) {
    return sendJson(res, 400, { error:'Invalid JSON' });
  }

  // Discord PING
  if (interaction.type === 1) {
    return sendJson(res, 200, { type:1 });
  }

  // MESSAGE_COMPONENT
  if (interaction.type === 3) {
    const customId = interaction?.data?.custom_id || '';
    const action = customId === 'galaxy_booking_add'
      ? 'add'
      : customId === 'galaxy_booking_remove'
        ? 'remove'
        : '';

    if (!action) {
      return sendJson(res, 200, {
        type:4,
        data:{ flags:64, content:'Неизвестная кнопка.' }
      });
    }

    try {
      const result = await handleBooking(interaction, action);
      return sendJson(res, 200, {
        type:4,
        data:{ flags:64, content:result.message }
      });
    } catch (err) {
      return sendJson(res, 200, {
        type:4,
        data:{ flags:64, content:`Ошибка обработки кнопки: ${String(err.message || err).slice(0, 300)}` }
      });
    }
  }

  return sendJson(res, 200, {
    type:4,
    data:{ flags:64, content:'Этот тип interaction пока не обрабатывается.' }
  });
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};

