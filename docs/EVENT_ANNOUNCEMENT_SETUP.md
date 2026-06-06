# Event announcement composer

## Что добавлено

Когда ивентолог с ролью `1305567485218521169` бронирует вылет/дипломатию через Discord-кнопку, сайт видит эту бронь через канал бронирований `1512560293740548146`.

После входа через Discord на вкладке **Галактическая карта** только у этого ивентолога появляется панель отправки анонса.

## Env

Основной webhook уже прописан в серверном API, но безопаснее переопределить его через Vercel env:

```env
EVENT_ANNOUNCE_WEBHOOK=https://discord.com/api/webhooks/...
```

Также можно переопределить роль пинга:

```env
EVENT_ANNOUNCE_ROLE_ID=1305565266197090346
EVENT_ANNOUNCE_MENTION=|| <@&1305565266197090346> ||
```

Обязательные env для проверки Discord и чтения бронирований:

```env
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...
```

## Баннеры

Файлы баннеров лежат здесь:

```text
assets/event-banners/maul.jpg
assets/event-banners/battlefield.jpg
assets/event-banners/senate.jpg
assets/event-banners/inquisitor.jpg
assets/event-banners/ahsoka.jpg
```

Цвет embed выбирается случайно при каждой отправке: бордовый, небесно-голубой, зелёный или серый.
