const { getJSON } = require('./_kv')
module.exports = async (req, res) => {
  try {
    const state = await getJSON('eotg:holonet:state', {})
    res.status(200).json({ ok: true, state })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
