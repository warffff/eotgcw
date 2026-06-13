const { getFreshSession, sendJson } = require('./_utils');
const { query, table } = require('./_commandCenterDb');

const COMMAND_CENTER_ROLE_ID = String(process.env.COMMAND_CENTER_ROLE_ID || '1493983291152400444');
const ONLINE_TTL_SECONDS = Number(process.env.COMMAND_CENTER_ONLINE_TTL || 20);

function hasCommandCenterRole(roles = []) {
  return roles.map(String).includes(COMMAND_CENTER_ROLE_ID);
}

async function requireAccess(req, res) {
  const access = await getFreshSession(req, res);
  if (!access.session) return { ok:false, status:403, error:'Нужно авторизоваться через Discord.' };
  if (!access.fresh) return { ok:false, status:403, error:'Не удалось актуально проверить роли Discord.' };
  if (!hasCommandCenterRole(access.roles || [])) {
    return { ok:false, status:403, error:`Недостаточно прав: нужна Discord-роль <@&${COMMAND_CENTER_ROLE_ID}>.` };
  }
  return { ok:true, access };
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32 * 1024) throw new Error('Payload too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function safeString(value, max = 128) {
  return String(value || '').trim().slice(0, max);
}

function parseRanks(raw) {
  if (!raw) return [];
  try {
    const ranks = JSON.parse(raw);
    return Array.isArray(ranks) ? ranks : [];
  } catch (_) {
    return [];
  }
}

function publicJob(row) {
  return {
    id: String(row.job_id || ''),
    name: String(row.job_name || row.job_id || ''),
    category: String(row.category || ''),
    factionId: String(row.faction_id || ''),
    defaultRank: String(row.default_rank || ''),
    fluidFaction: Number(row.fluid_faction || 0) === 1,
    ranks: parseRanks(row.ranks_json)
  };
}

function publicPlayer(row) {
  return {
    steamId: String(row.steam_id || ''),
    steamId64: String(row.steam_id64 || ''),
    playerName: String(row.player_name || ''),
    characterId: Number(row.character_id || 0),
    characterName: String(row.character_name || ''),
    job: String(row.job || ''),
    jobName: String(row.job_name || row.job || ''),
    rank: String(row.rank || ''),
    rankName: String(row.rank_name || row.rank || ''),
    factionId: String(row.faction_id || ''),
    updatedAt: Number(row.updated_at || 0)
  };
}

module.exports = async (req, res) => {
  try {
    const guard = await requireAccess(req, res);
    if (!guard.ok) return sendJson(res, guard.status, { ok:false, error:guard.error, roleId:COMMAND_CENTER_ROLE_ID });

    const now = Math.floor(Date.now() / 1000);

    if (req.method === 'GET') {
      const [players, jobs, commands] = await Promise.all([
        query(`SELECT * FROM ${table('site_command_center_online')} WHERE updated_at >= ? ORDER BY player_name ASC`, [now - ONLINE_TTL_SECONDS]),
        query(`SELECT * FROM ${table('site_command_center_jobs')} ORDER BY category ASC, job_name ASC`, []),
        query(`SELECT id, steam_id64, character_id, job, rank, faction_id, actor_name, status, error, created_at, processed_at FROM ${table('site_command_center_commands')} ORDER BY id DESC LIMIT 20`, [])
      ]);

      return sendJson(res, 200, {
        ok:true,
        roleId:COMMAND_CENTER_ROLE_ID,
        onlineTtl:ONLINE_TTL_SECONDS,
        players:players.map(publicPlayer),
        jobs:jobs.map(publicJob),
        recentCommands:commands.map(c => ({
          id:Number(c.id),
          steamId64:String(c.steam_id64 || ''),
          characterId:Number(c.character_id || 0),
          job:String(c.job || ''),
          rank:String(c.rank || ''),
          factionId:String(c.faction_id || ''),
          actorName:String(c.actor_name || ''),
          status:String(c.status || ''),
          error:String(c.error || ''),
          createdAt:Number(c.created_at || 0),
          processedAt:Number(c.processed_at || 0)
        }))
      });
    }

    if (req.method !== 'POST') return sendJson(res, 405, { ok:false, error:'Method not allowed' });

    const body = await readBody(req);
    const steamId64 = safeString(body.steamId64, 32);
    const characterId = Number(body.characterId || 0);
    const jobId = safeString(body.job, 64);
    let rankId = safeString(body.rank, 64);

    if (!/^\d{15,20}$/.test(steamId64)) return sendJson(res, 400, { ok:false, error:'Некорректный SteamID64.' });
    if (!Number.isInteger(characterId) || characterId <= 0) return sendJson(res, 400, { ok:false, error:'Некорректный ID персонажа.' });
    if (!/^[A-Za-z0-9_\-:.]+$/.test(jobId)) return sendJson(res, 400, { ok:false, error:'Некорректный ID профессии.' });

    const online = await query(`SELECT * FROM ${table('site_command_center_online')} WHERE steam_id64 = ? AND character_id = ? AND updated_at >= ? LIMIT 1`, [steamId64, characterId, now - ONLINE_TTL_SECONDS]);
    if (!online.length) return sendJson(res, 409, { ok:false, error:'Игрок уже не в сети или сменил активного персонажа.' });

    const jobs = await query(`SELECT * FROM ${table('site_command_center_jobs')} WHERE job_id = ? LIMIT 1`, [jobId]);
    if (!jobs.length) return sendJson(res, 400, { ok:false, error:'Профессия не найдена в каталоге сервера. Проверьте синхронизацию Lua-модуля.' });

    const job = publicJob(jobs[0]);
    if (!rankId) rankId = job.defaultRank || (job.ranks[0] && job.ranks[0].id) || '';
    if (rankId && !job.ranks.some(r => String(r.id) === rankId)) return sendJson(res, 400, { ok:false, error:'Звание не найдено у выбранной профессии.' });

    const factionId = safeString(body.factionId || job.factionId || online[0].faction_id, 64);
    const actor = guard.access.session.user || {};
    const actorName = safeString(actor.global_name || actor.username || actor.id || 'Командный центр', 128);
    const actorDiscordId = safeString(actor.id || '', 32);

    const result = await query(
      `INSERT INTO ${table('site_command_center_commands')} (steam_id64, character_id, job, rank, faction_id, actor_discord_id, actor_name, status, error, created_at, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, 0)`,
      [steamId64, characterId, jobId, rankId, factionId, actorDiscordId, actorName, now]
    );

    return sendJson(res, 200, { ok:true, commandId:Number(result.insertId || 0), status:'pending' });
  } catch (err) {
    return sendJson(res, 500, { ok:false, error:String(err.message || err) });
  }
};
