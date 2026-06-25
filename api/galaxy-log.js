const { getFreshSession, sendJson } = require('./_utils');
const { getSamAccess } = require('./_samAuth');

const CHANNEL_ID = process.env.DISCORD_MAP_LOG_CHANNEL_ID || '1512549066058236014';
const MAP_LOG_MENTION_ROLE_IDS = ['1493983291152400444', '1305567485218521169'];
const MAP_LOG_MENTION_TEXT = MAP_LOG_MENTION_ROLE_IDS.map(id => `<@&${id}>`).join(' ');

function clampText(value, max=1024){
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}
function factionName(value){
  if (value === 'republic') return 'ВАР / Галактическая Республика';
  if (value === 'cis') return 'КНС';
  if (value === 'neutral') return 'Нейтральная сторона';
  return 'Неизвестно';
}
function shortFaction(value){
  if (value === 'republic') return 'ВАР';
  if (value === 'cis') return 'КНС';
  if (value === 'neutral') return 'нейтралитет';
  return 'неизвестно';
}
function actorName(session, samAccess){
  if (samAccess && samAccess.permissions && samAccess.permissions.canEditAll) {
    const name = samAccess.displayName || samAccess.steam?.steamId64 || 'Steam admin';
    return `${name} (SAM: ${samAccess.sam?.rank || 'admin'})`;
  }
  const user = session && session.user ? session.user : null;
  if (!user) return 'Неизвестный оператор';
  const name = user.global_name || user.username || user.id || 'Пользователь Discord';
  return user.id ? `${name} (<@${user.id}>)` : name;
}
function planetLine(data){
  const sector = data.sector ? `Сектор ${String(data.sector).padStart(2, '0')}` : 'Сектор неизвестен';
  const region = data.region ? String(data.region) : 'Регион неизвестен';
  return `${data.target || 'Неизвестная планета'} • ${sector} • ${region}`;
}
function resultPhrase(data){
  const target = data.target || 'Планета';
  const result = data.result === 'republic' ? 'republic' : 'cis';
  const previous = data.previousControl || '';
  if (result === 'republic') {
    return `${target} ${previous === 'republic' ? 'осталась' : 'перешла'} под контроль ВАР.`;
  }
  return `${target} ${previous === 'cis' ? 'осталась' : 'перешла'} под контроль КНС.`;
}
function buildEmbed(event, data, actor){
  const target = clampText(data.target || 'Неизвестная планета', 120);
  const base = {
    timestamp: new Date().toISOString(),
    footer: { text: 'Галактическая карта • EOTG' },
    fields: [
      { name:'Оператор', value:clampText(actor, 1024), inline:false },
      { name:'Планета', value:clampText(planetLine(data), 1024), inline:false }
    ]
  };

  if (event === 'fleet_launch') {
    return {
      ...base,
      color: 0x2fbcff,
      title: '⚠️ ВНИМАНИЕ! Venator выдвинулись',
      description: `Ударная группа Venator вышла из системы **${clampText(data.origin || 'неизвестно', 120)}** и направляется в сектор к планете **${target}**. Возможно боевое столкновение с силами КНС.`,
      fields: [
        ...base.fields,
        { name:'Тип операции', value:'Боевой вылет / захват', inline:true },
        { name:'Статус', value:'Флот в пути', inline:true }
      ]
    };
  }

  if (event === 'diplomacy_launch') {
    return {
      ...base,
      color: 0xffd166,
      title: '🕊️ Начата дипломатическая миссия',
      description: `К нейтральной планете **${target}** направлена дипломатическая группа под охраной Venator. Цель миссии — склонить систему к союзу до вмешательства КНС.`,
      fields: [
        ...base.fields,
        { name:'Тип операции', value:'Дипломатическая миссия', inline:true },
        { name:'Статус', value:'Миссия в пути', inline:true }
      ]
    };
  }

  if (event === 'fleet_battle_result') {
    const winner = data.winner === 'republic' ? 'ВАР / Venator' : 'КНС / Мунифиценты';
    return {
      ...base,
      color: data.winner === 'republic' ? 0x48d9ff : 0xff3b5f,
      title: data.early ? '⏱️ Битва флота завершена досрочно' : '⚔️ Битва флота завершена',
      description: `Орбитальное столкновение у планеты **${target}** завершено. Рандомный исход битвы флота: **победили ${winner}**.`,
      fields: [
        ...base.fields,
        { name:'Победитель битвы флота', value:winner, inline:true },
        { name:'Завершение', value:data.early ? 'Досрочно администратором' : 'По таймеру боя', inline:true }
      ]
    };
  }

  if (event === 'operation_final_result') {
    const diplomacy = data.operation === 'diplomacy';
    const phrase = resultPhrase(data);
    return {
      ...base,
      color: data.result === 'republic' ? 0x3fe6ff : 0xff385c,
      title: diplomacy ? '📜 Итог дипломатической миссии' : '🏁 Итог боевого вылета',
      description: `**${phrase}**`,
      fields: [
        ...base.fields,
        { name:'Тип операции', value:diplomacy ? 'Дипломатическая миссия' : 'Боевой вылет', inline:true },
        { name:'Итоговый контроль', value:factionName(data.result), inline:true },
        { name:'Предыдущий статус', value:factionName(data.previousControl), inline:true }
      ]
    };
  }

  return {
    ...base,
    color: 0x8aa4ff,
    title: 'Событие галактической карты',
    description: clampText(data.message || event || 'Неизвестное событие', 2048)
  };
}


function launchComponents(event){
  if (!['fleet_launch', 'diplomacy_launch'].includes(event)) return [];
  return [{
    type:1,
    components:[
      {
        type:2,
        style:3,
        custom_id:'galaxy_booking_add',
        label:'Забронировать проведение',
        emoji:{ name:'✅' }
      },
      {
        type:2,
        style:4,
        custom_id:'galaxy_booking_remove',
        label:'Отменить бронь',
        emoji:{ name:'❌' }
      }
    ]
  }];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok:false, error:'Method not allowed' });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return sendJson(res, 503, { ok:false, error:'DISCORD_BOT_TOKEN is not configured' });
  }

  let body = {};
  try {
    body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
  } catch (_) {
    return sendJson(res, 400, { ok:false, error:'Invalid JSON body' });
  }

  const event = String(body.event || '').trim();
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  if (!event) {
    return sendJson(res, 400, { ok:false, error:'Missing event' });
  }

  let fresh = { session:null, canEdit:false };
  let samAccess = null;
  try {
    samAccess = await getSamAccess(req);
  } catch (_) {}
  try {
    fresh = await getFreshSession(req, res);
  } catch (_) {}

  const canAdminLog = Boolean(fresh.canEdit || samAccess?.permissions?.canEditAll);
  if ((event === 'fleet_battle_result' || event === 'operation_final_result') && !canAdminLog) {
    return sendJson(res, 403, { ok:false, error:'Admin role required for this log event' });
  }

  const embed = buildEmbed(event, data, actorName(fresh.session, samAccess));
  const discordRes = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(CHANNEL_ID)}/messages`, {
    method:'POST',
    headers:{
      Authorization:`Bot ${botToken}`,
      'Content-Type':'application/json'
    },
    body: JSON.stringify({
      content: MAP_LOG_MENTION_TEXT,
      embeds:[embed],
      components:launchComponents(event),
      allowed_mentions:{ roles:MAP_LOG_MENTION_ROLE_IDS }
    })
  });

  if (!discordRes.ok) {
    const text = await discordRes.text().catch(() => '');
    return sendJson(res, 502, { ok:false, error:`Discord send failed: HTTP ${discordRes.status}`, detail:text.slice(0, 500) });
  }

  return sendJson(res, 200, { ok:true });
};
