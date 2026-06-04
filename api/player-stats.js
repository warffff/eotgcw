function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  return sendJson(res, 410, { ok: false, disabled: true, error: 'Player statistics are disabled for this project.' });
};
