const handlers = {
  'auth/callback': () => require('../server/api-handlers/auth/callback'),
  'auth/login': () => require('../server/api-handlers/auth/login'),
  'auth/logout': () => require('../server/api-handlers/auth/logout'),
  'auth/me': () => require('../server/api-handlers/auth/me'),

  'steam-auth/login': () => require('../server/api-handlers/steam-auth/login'),
  'steam-auth/callback': () => require('../server/api-handlers/steam-auth/callback'),
  'steam-auth/me': () => require('../server/api-handlers/steam-auth/me'),

  'content': () => require('../server/api-handlers/content'),
  'command-center': () => require('../server/api-handlers/command-center'),
  'discord-interactions': () => require('../server/api-handlers/discord-interactions'),
  'event-announcement': () => require('../server/api-handlers/event-announcement'),
  'event-bookings': () => require('../server/api-handlers/event-bookings'),
  'galaxy-log': () => require('../server/api-handlers/galaxy-log'),
  'galaxy-map': () => require('../server/api-handlers/galaxy-map'),
  'announcements': () => require('../server/api-handlers/announcements'),
  'weather-alerts': () => require('../server/api-handlers/weather-alerts')
};

function getRoute(req){
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `https://${host}`);


  let route = String(url.searchParams.get('path') || '').trim();


  if (!route) {
    route = url.pathname
      .replace(/^\/api(?:\/index)?\/?/i, '')
      .replace(/^\/+|\/+$/g, '');
  }

  route = route.replace(/^\/+|\/+$/g, '').replace(/\/index$/i, '');
  return route || 'index';
}

module.exports = async (req, res) => {
  const route = getRoute(req);
  const load = handlers[route];

  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: false,
      error: 'API route not found',
      route
    }));
  }

  try {
    const handler = load();
    return handler(req, res);
  } catch (err) {
    console.error('[api-router]', route, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return res.end(JSON.stringify({
      ok: false,
      error: 'API router error'
    }));
  }
};
