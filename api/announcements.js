const { GUILD_ID, sendJson } = require('./_utils');

const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID || '1486469051025850409';
const DISCORD_API = 'https://discord.com/api/v10';
const CROSSPOSTED_FLAG = 1 << 0;
const CACHE_TTL_MS = 60 * 1000;

let cache = { at: 0, data: null };

function stripMarkdown(value){
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/<@&?(\d+)>/g, '')
    .replace(/<#(\d+)>/g, '')
    .replace(/<a?:\w+:(\d+)>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function truncate(value, max){
  const text = stripMarkdown(value);
  return text.length > max ? text.slice(0, Math.max(0, max - 1)).trimEnd() + '…' : text;
}
function firstNonEmptyLine(text){
  return String(text || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
}
function normalizeMessage(message){
  const embeds = Array.isArray(message.embeds) ? message.embeds : [];
  const firstEmbed = embeds[0] || {};
  const content = String(message.content || '').trim();
  const embedTitle = String(firstEmbed.title || '').trim();
  const embedDescription = String(firstEmbed.description || '').trim();
  const rawTitle = embedTitle || firstNonEmptyLine(content) || firstNonEmptyLine(embedDescription) || 'Передача Голонета';
  let rawBody = '';

  if (content) {
    const lines = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    rawBody = lines.length > 1 ? lines.slice(1).join(' ') : content;
  }
  if (!rawBody) rawBody = embedDescription || firstEmbed.url || 'Сообщение опубликовано в канале объявлений.';

  const timestamp = message.timestamp || message.edited_timestamp || '';
  const guildId = message.guild_id || GUILD_ID;
  const channelId = message.channel_id || ANNOUNCEMENT_CHANNEL_ID;
  const id = message.id;

  return {
    id,
    title: truncate(rawTitle, 74),
    text: truncate(rawBody, 190),
    author: truncate(message.author?.global_name || message.author?.username || '', 42),
    timestamp,
    url: guildId && channelId && id ? `https://discord.com/channels/${guildId}/${channelId}/${id}` : '',
    isCrossposted: Boolean(Number(message.flags || 0) & CROSSPOSTED_FLAG)
  };
}

module.exports = async (req, res) => {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL_MS) return sendJson(res, 200, cache.data);

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return sendJson(res, 200, { ok:false, announcements:[], error:'DISCORD_BOT_TOKEN не настроен.' });
  }

  try {
    const response = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(ANNOUNCEMENT_CHANNEL_ID)}/messages?limit=25`, {
      headers:{ Authorization:`Bot ${token}` }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return sendJson(res, 200, { ok:false, announcements:[], error:`Discord API HTTP ${response.status}`, detail:text.slice(0, 240) });
    }

    const messages = await response.json();
    const announcements = (Array.isArray(messages) ? messages : [])
      .filter(message => Boolean(Number(message.flags || 0) & CROSSPOSTED_FLAG))
      .map(normalizeMessage)
      .filter(item => item.title || item.text)
      .slice(0, 2);

    const data = { ok:true, announcements, channelId:ANNOUNCEMENT_CHANNEL_ID, fetchedAt:new Date().toISOString() };
    cache = { at: now, data };
    return sendJson(res, 200, data);
  } catch (err) {
    return sendJson(res, 200, { ok:false, announcements:[], error:err.message || 'Не удалось получить Голонет-сводки.' });
  }
};
