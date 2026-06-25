# API routing

All server endpoints are routed through `api/[...path].js` so Vercel Hobby sees one Serverless Function.

Legacy handler code lives in `server/api-handlers/`.
Old URLs are preserved, for example:
- `/api/auth/me`
- `/api/steam-auth/me`
- `/api/content`
- `/api/galaxy-map`
