# Reaction booking setup

Сайт сам не получает события реакций Discord. Их должен переслать Discord-бот.

## Что нужно сделать в боте

1. Скопировать `docs/discord-bot-reaction-bridge.js` в проект бота.
2. В файле запуска бота добавить:

```js
const { installGalaxyReactionBridge } = require('./discord-bot-reaction-bridge');
installGalaxyReactionBridge(client);
```

3. У клиента Discord должны быть intent/partials:

```js
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
```

4. В env бота указать:

```env
SITE_BASE_URL=https://адрес-сайта
MAP_REACTION_BRIDGE_SECRET=любой-секрет
```

5. В env сайта указать тот же:

```env
MAP_REACTION_BRIDGE_SECRET=любой-секрет
```

Если после реакции ничего не отправляется, смотри логи бота: bridge теперь печатает ответ сайта.
