const { GUILD_ID, sendJson } = require('./_utils');

const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID || '1486469051025850409';
const DISCORD_API = 'https://discord.com/api/v10';
const CROSSPOSTED_FLAG = 1 << 0;
const CACHE_TTL_MS = 60 * 1000;
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { at: 0, data: null };
let roleCache = { at: 0, guildId: '', roles: new Map() };

function escapeMentionName(value){
  return String(value || '')
    .replace(/[@`*_~|<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadRoleMap(token, guildId){
  const safeGuildId = String(guildId || GUILD_ID || '').trim();
  if (!token || !safeGuildId) return new Map();

  const now = Date.now();
  if (roleCache.guildId === safeGuildId && roleCache.roles && now - roleCache.at < ROLE_CACHE_TTL_MS) {
    return roleCache.roles;
  }

  try {
    const response = await fetch(`${DISCORD_API}/guilds/${encodeURIComponent(safeGuildId)}/roles`, {
      headers:{ Authorization:`Bot ${token}` }
    });

    if (!response.ok) return roleCache.roles || new Map();

    const roles = await response.json();
    const map = new Map();
    for (const role of Array.isArray(roles) ? roles : []) {
      const id = String(role?.id || '').trim();
      const name = escapeMentionName(role?.name || '');
      if (id && name && name !== '@everyone') map.set(id, name);
    }

    roleCache = { at: now, guildId: safeGuildId, roles: map };
    return map;
  } catch {
    return roleCache.roles || new Map();
  }
}

function formatDiscordText(value, roleMap = new Map()){
  return String(value || '')
    .replace(/<@&(\d+)>/g, (_, id) => {
      const name = roleMap.get(String(id));
      return name ? `@${name}` : '@роль';
    })
    .replace(/<@!?(\d+)>/g, '@пользователь')
    .replace(/<#(\d+)>/g, '#канал')
    .replace(/<a?:(\w+):(\d+)>/g, ':$1:')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function truncate(value, max, roleMap){
  const text = formatDiscordText(value, roleMap);
  return text.length > max ? text.slice(0, Math.max(0, max - 1)).trimEnd() + '…' : text;
}
function firstNonEmptyLine(text){
  return String(text || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
}
function normalizeMessage(message, roleMap){
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
    title: truncate(rawTitle, 74, roleMap),
    text: truncate(rawBody, 190, roleMap),
    author: truncate(message.author?.global_name || message.author?.username || '', 42, roleMap),
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
    const safeMessages = Array.isArray(messages) ? messages : [];
    const guildId = safeMessages.find(message => message?.guild_id)?.guild_id || GUILD_ID;
    const roleMap = await loadRoleMap(token, guildId);

    const announcements = safeMessages
      .filter(message => Boolean(Number(message.flags || 0) & CROSSPOSTED_FLAG))
      .map(message => normalizeMessage(message, roleMap))
      .filter(item => item.title || item.text)
      .slice(0, 2);

    const data = { ok:true, announcements, channelId:ANNOUNCEMENT_CHANNEL_ID, fetchedAt:new Date().toISOString() };
    cache = { at: now, data };
    return sendJson(res, 200, data);
  } catch (err) {
    return sendJson(res, 200, { ok:false, announcements:[], error:err.message || 'Не удалось получить Голонет-сводки.' });
  }
};
