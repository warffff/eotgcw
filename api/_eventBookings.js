const { GUILD_ID } = require('./_utils');

const BOOKING_LOG_CHANNEL_ID = process.env.DISCORD_BOOKING_LOG_CHANNEL_ID || '1512560293740548146';
const EVENTOLOG_ROLE_ID = '1305567485218521169';

function clampText(value, max=1024){
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
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
async function fetchBookingMessages(limit=300){
  const all = [];
  let before = '';
  while (all.length < limit) {
    const batchSize = Math.min(100, limit - all.length);
    const query = `limit=${batchSize}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
    const batch = await discordFetch(`/channels/${encodeURIComponent(BOOKING_LOG_CHANNEL_ID)}/messages?${query}`);
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    before = batch[batch.length - 1].id;
    if (batch.length < batchSize) break;
  }
  return all;
}
function embedField(embed, name){
  const fields = embed?.fields || [];
  return fields.find(f => String(f.name || '').trim().toLowerCase() === String(name).trim().toLowerCase())?.value || '';
}
function parseLink(value){
  const text = String(value || '');
  const md = text.match(/\((https:\/\/discord\.com\/channels\/[^)]+)\)/i);
  if (md) return md[1];
  const raw = text.match(/https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+/i);
  return raw ? raw[0] : '';
}
function parseMessageIdFromUrl(url){
  const parts = String(url || '').split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}
function parseUserId(embed){
  const source = `${embed?.description || ''}\n${(embed?.fields || []).map(f => `${f.name}\n${f.value}`).join('\n')}`;
  const m = source.match(/<@!?(\d+)>/);
  return m ? m[1] : '';
}
function parseBookingAction(embed){
  const title = String(embed?.title || '');
  if (title.includes('Бронь проведения операции')) return 'add';
  if (title.includes('Отмена брони проведения операции')) return 'remove';
  return '';
}
function parseOperation(value){
  const text = String(value || '').toLowerCase();
  if (text.includes('дип')) return 'diplomacy';
  return 'battle';
}
function parseBookingMessage(message){
  const embed = message?.embeds?.[0];
  if (!embed) return null;
  const action = parseBookingAction(embed);
  if (!action) return null;

  const userId = parseUserId(embed);
  const operationText = embedField(embed, 'Операция');
  const planet = embedField(embed, 'Планета') || 'Неизвестная планета';
  const sourceUrl = parseLink(embedField(embed, 'Исходное сообщение'));
  const sourceMessageId = parseMessageIdFromUrl(sourceUrl);
  if (!userId || !sourceMessageId) return null;

  const operation = parseOperation(operationText || embed.description || '');
  const threadId = message?.thread?.id || '';
  const threadUrl = threadId ? messageLink(GUILD_ID, threadId, threadId) : '';
  const key = `${sourceMessageId}:${userId}`;

  return {
    key,
    action,
    userId,
    operation,
    operationLabel: operation === 'diplomacy' ? 'Дипломатическая миссия' : 'Боевой вылет',
    planet: clampText(planet, 160),
    sourceMessageId,
    sourceUrl,
    bookingMessageId: message.id,
    bookingUrl: messageLink(GUILD_ID, BOOKING_LOG_CHANNEL_ID, message.id),
    threadId,
    threadUrl,
    createdAt: message.timestamp || '',
    rawTitle: embed.title || ''
  };
}
function reduceActiveBookings(messages){
  const active = new Map();
  const parsed = messages.map(parseBookingMessage).filter(Boolean).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const item of parsed) {
    if (item.action === 'add') active.set(item.key, item);
    if (item.action === 'remove') active.delete(item.key);
  }
  return [...active.values()].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}
async function fetchActiveBookings(){
  const messages = await fetchBookingMessages();
  return reduceActiveBookings(messages);
}
async function fetchActiveBookingsForUser(userId){
  const id = String(userId || '');
  if (!id) return [];
  const bookings = await fetchActiveBookings();
  return bookings.filter(b => b.userId === id);
}

module.exports = {
  BOOKING_LOG_CHANNEL_ID,
  EVENTOLOG_ROLE_ID,
  discordFetch,
  fetchActiveBookings,
  fetchActiveBookingsForUser,
  messageLink,
  clampText
};
