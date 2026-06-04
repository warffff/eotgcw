const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
async function redis(command, args = []) {
  if (!url || !token) throw new Error('Missing KV_REST_API_URL/KV_REST_API_TOKEN')
  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(JSON.stringify(json))
  return json.result
}
async function getJSON(key, fallback) {
  const v = await redis('get', [key])
  if (!v) return fallback
  try { return JSON.parse(v) } catch { return fallback }
}
async function setJSON(key, value) {
  return redis('set', [key, JSON.stringify(value)])
}
module.exports = { getJSON, setJSON }
