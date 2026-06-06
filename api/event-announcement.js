const { getFreshSession, getBaseUrl, sendJson } = require('./_utils');
const { EVENTOLOG_ROLE_ID, fetchActiveBookingsForUser, clampText } = require('./_eventBookings');

const DEFAULT_EVENT_WEBHOOK = 'https://discord.com/api/webhooks/1234960427008528395/4FQko8X4i9QP8gaAgWtuLCpafJ8upftVNzMORbCPEStWQ03wqyZIY7W88jWz7LCXJxHU';
const ANNOUNCE_ROLE_ID = process.env.EVENT_ANNOUNCE_ROLE_ID || '1305565266197090346';
const ANNOUNCE_MENTION = process.env.EVENT_ANNOUNCE_MENTION || `|| <@&${ANNOUNCE_ROLE_ID}> ||`;

const COLORS = [
  0x690e1d, // бордовый
  0x38bdf8, // небесно-голубой
  0x22c55e, // зелёный
  0x8b909a  // серый
];
const IMAGES = [
  'maul.jpg',
  'battlefield.jpg',
  'senate.jpg',
  'inquisitor.jpg',
  'ahsoka.jpg'
];

function pick(list){ return list[Math.floor(Math.random() * list.length)] || list[0]; }
function normalizeLines(value, max=900){
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  return clampText(text || 'Будет уточнено.', max);
}
function cleanTitle(value, fallback){
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return clampText(text || fallback || 'Оперативный вылет', 220);
}
function imageName(value){
  const name = String(value || '').trim();
  return IMAGES.includes(name) ? name : pick(IMAGES);
}
function operationName(booking){
  return booking?.operation === 'diplomacy' ? 'Дипломатическая миссия' : 'Боевой вылет';
}
function buildEmbed({ body, booking, editorName, baseUrl }){
  const image = imageName(body.image);
  const title = cleanTitle(body.title, `${operationName(booking)}: ${booking.planet}`);
  const description = normalizeLines(body.description || `Координация операции у планеты ${booking.planet}. Подразделения готовятся к выполнению приказа командования.`, 1700);
  const time = normalizeLines(body.time, 420);
  const addons = normalizeLines(body.addons, 900);
  const units = normalizeLines(body.units, 900);
  const color = pick(COLORS);

  return {
    title,
    description,
    color,
    author:{
      name:'Edge of the Galaxy • Roleplay Project',
      url:'https://discord.gg/eotg',
      icon_url:'https://cdn-icons-png.flaticon.com/512/1539/1539194.png'
    },
    fields:[
      { name:'Время проведения', value:time, inline:false },
      { name:'Состав операции', value:units, inline:false },
      { name:'Необходимые аддоны', value:addons, inline:false },
      { name:'Планета / направление', value:clampText(`${booking.planet} • ${operationName(booking)}`, 900), inline:false },
      { name:'Ивентолог', value:clampText(editorName, 900), inline:true }
    ],
    image:{ url:`${baseUrl}/assets/event-banners/${image}` },
    footer:{ text:'EOTG Tactical Dispatch • краткий боевой протокол' },
    timestamp:new Date().toISOString()
  };
}
async function readBody(req){
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || '{}');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'Method not allowed' });

  try {
    const access = await getFreshSession(req, res);
    if (!access.session) return sendJson(res, 403, { ok:false, error:'Нужно авторизоваться через Discord.' });
    if (!access.fresh) return sendJson(res, 403, { ok:false, error:'Не удалось актуально проверить роли Discord.' });

    const roles = (access.roles || []).map(String);
    if (!roles.includes(EVENTOLOG_ROLE_ID)) {
      return sendJson(res, 403, { ok:false, error:'Отправлять анонсы может только ивентолог.' });
    }

    const body = await readBody(req);
    const bookings = await fetchActiveBookingsForUser(access.session.user?.id);
    const key = String(body.bookingKey || body.bookingId || '').trim();
    const booking = bookings.find(b => b.key === key || b.bookingMessageId === key || b.sourceMessageId === key) || (bookings.length === 1 ? bookings[0] : null);
    if (!booking) return sendJson(res, 403, { ok:false, error:'Активная бронь этого ивентолога не найдена.' });

    const webhook = process.env.EVENT_ANNOUNCE_WEBHOOK || DEFAULT_EVENT_WEBHOOK;
    if (!webhook) return sendJson(res, 500, { ok:false, error:'EVENT_ANNOUNCE_WEBHOOK is not configured.' });

    const editorName = access.session.user?.global_name || access.session.user?.username || access.session.user?.id || 'Ивентолог';
    const embed = buildEmbed({ body, booking, editorName:`${editorName} (<@${access.session.user?.id}>)`, baseUrl:getBaseUrl(req) });

    const payload = {
      username:'Edge of the Galaxy • Ивенты',
      avatar_url:'https://cdn.discordapp.com/embed/avatars/0.png',
      content:ANNOUNCE_MENTION,
      embeds:[embed],
      allowed_mentions:{ roles:[ANNOUNCE_ROLE_ID] }
    };

    const r = await fetch(webhook, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload)
    });
    const text = await r.text().catch(() => '');
    if (!r.ok) return sendJson(res, 502, { ok:false, error:`Webhook send failed: HTTP ${r.status}`, detail:text.slice(0, 400) });

    return sendJson(res, 200, { ok:true });
  } catch (err) {
    return sendJson(res, 500, { ok:false, error:String(err.message || err) });
  }
};
