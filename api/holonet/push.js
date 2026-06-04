const { getJSON, setJSON } = require('./_kv')
const discordToken = process.env.DISCORD_BOT_TOKEN
const newsChannel = process.env.DISCORD_HOLONET_CHANNEL_ID || process.env.DISCORD_STATUS_CHANNEL_ID
async function discord(path, body) {
  if (!discordToken || !newsChannel) return null
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: 'POST',
    headers: { Authorization: `Bot ${discordToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Discord ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}
function clip(s, n) {
  s = String(s || '')
  return s.length > n ? s.slice(0, n - 3) + '...' : s
}
function embedFor(event, payload) {
  const color = 0x6ed7ff
  if (event === 'operation_start') return { title: 'Операция началась', description: `**${clip(payload.name, 120)}**\nКомандир: ${clip(payload.commander, 80)}`, color }
  if (event === 'operation_phase') return { title: 'Новая фаза операции', description: clip(payload.phase, 350), color }
  if (event === 'operation_report') return { title: `Отчёт операции: ${clip(payload.name, 100)}`, description: clip(payload.result, 700), color, fields: [{ name: 'Участники', value: String(Object.keys(payload.participants || {}).length), inline: true }, { name: 'Потери', value: String(Object.keys(payload.deaths || {}).length), inline: true }] }
  if (event === 'hero') return { title: 'Герой операции', description: `**${clip(payload.name, 80)}**\n${clip(payload.reason, 700)}`, color: 0xffd447 }
  if (event === 'document') return { title: `Новый документ: ${clip(payload.title, 100)}`, description: clip(payload.body, 700), color }
  if (event === 'reputation') return { title: `Репутация: ${clip(payload.battalion, 80)}`, description: `${payload.amount > 0 ? '+' : ''}${payload.amount}\n${clip(payload.reason, 500)}`, color }
  return null
}
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
    const body = req.body || {}
    if (!process.env.GMOD_STATUS_SECRET || body.secret !== process.env.GMOD_STATUS_SECRET) return res.status(401).json({ ok: false, error: 'Bad secret' })
    const state = body.state || {}
    state.updated_at = Date.now()
    await setJSON('eotg:holonet:state', state)
    const log = await getJSON('eotg:holonet:events', [])
    log.unshift({ event: body.event || 'state', payload: body.payload || {}, time: Date.now() })
    while (log.length > 200) log.pop()
    await setJSON('eotg:holonet:events', log)
    const emb = body.discord !== false ? embedFor(body.event, body.payload || {}) : null
    if (emb && newsChannel) await discord(`/channels/${newsChannel}/messages`, { embeds: [emb] })
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
