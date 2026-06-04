# EOTG Holonet на основном сайте

В сайт встроены:

- страница `/#holonet` и навигация «Голонет»;
- API `/api/holonet/push` для GMod addon;
- API `/api/holonet/public` для отображения данных на сайте;
- хранение состояния через Upstash Redis / Vercel KV.

## ENV на Vercel

```env
GMOD_STATUS_SECRET=одинаковый_секрет_с_GMod
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
DISCORD_BOT_TOKEN=...
DISCORD_HOLONET_CHANNEL_ID=id_канала_новостей
```

Можно также использовать переменные Upstash:

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## GMod server.cfg

```cfg
eotg_holonet_api_url "https://твой-сайт.vercel.app/api/holonet/push"
eotg_holonet_secret "тот_же_GMOD_STATUS_SECRET"
eotg_holonet_enabled "1"
eotg_holonet_discord "1"
```

Страница на сайте: `https://твой-сайт.vercel.app/#holonet` или `https://твой-сайт.vercel.app/holonet`.
