# Полночь на 77.91.112.63 рядом с существующими приложениями

Исходная ветка `release/v1` сохраняется. Эта ветка добавляет отдельную установку
на `stories.77.91.112.63.nip.io`, без Caddy и без изменения других Compose-проектов.

## Первый запуск

Сохраните `deploy/hostkey.sh` как `/root/polnoch-hostkey.sh`. В интерактивном SSH
терминале root запустите:

```bash
bash /root/polnoch-hostkey.sh init
```

Enter принимает предложенный домен. Затем вводятся токен **отдельного** бота
(скрытый ввод), его username, необязательное короткое имя Mini App и ваш Telegram
ID. Если короткое имя ещё не создано через BotFather, оставьте его пустым: меню
бота с web_app работает по HTTPS-адресу. Пароли и секреты генерируются на сервере.

Настройки хранятся в `/etc/polnoch-stories/app.env` (600), каталог — 700.
Пароль входа в студию сохранён отдельно в
`/var/lib/polnoch-stories/admin-login.txt` (600). Не публикуйте эти файлы.
Повторный `init` откажется перезаписывать существующие пароли.

После инициализации запустите установку в фоне:

```bash
nohup bash /opt/polnoch-stories/deploy/hostkey.sh install >/var/lib/polnoch-stories/install.log 2>&1 </dev/null &
```

```bash
 tail -n 40 /var/lib/polnoch-stories/install.log
```

Установка собирает приложение и инструменты, запускает **только** проект
`polnoch_stories`, проверяет `/api/health`, при первом запуске загружает истории,
включает резервные копии и планировщик. Затем создаёт отдельный vhost nginx,
получает сертификат через webroot и включает HTTPS. Во время выдачи сертификата
новый HTTP-домен возвращает 503, кроме ACME challenge. Существующие vhost-файлы
не редактируются. Перед каждым плавным `reload` выполняется `nginx -t`; при
ошибке проверки/перезагрузки предыдущий файл этого проекта восстанавливается.
Уже занятые порт, имя проекта, каталог или точное имя домена приводят к отказу,
а не к перезаписи чужой установки.

После успешного HTTPS отдельно настройте **этого** бота:

```bash
bash /opt/polnoch-stories/deploy/hostkey.sh bot
```

До изменения меню и webhook проверяются `getMe` и `getWebhookInfo`: username
должен совпадать с введённым, а webhook быть пустым или указывать на это же
приложение. Чужой webhook не заменяется. Ошибка Telegram API завершает команду
с ненулевым кодом. Команда задаёт webhook, меню, команды и описание, не отправляя
сообщений пользователям. Проверьте приложение кнопкой «Истории» в Telegram.

## Обновление

```bash
bash /opt/polnoch-stories/deploy/hostkey.sh update
```

Делает резервную копию базы (`/var/lib/polnoch-stories/backups/before-update-*.dump`),
выполняет `git pull --ff-only` этой ветки, пересобирает только этот проект,
дожидается health check и загружает новые/изменённые истории (`seed` идемпотентен,
прогресс игроков не трогается). Другие проекты и nginx не затрагиваются.

## Изоляция и данные

- Код: `/opt/polnoch-stories`.
- Compose: `deploy/hostkey.compose.yml`, проект `polnoch_stories`.
- Приложение: **127.0.0.1:3500 → 3000**, отдельный образ с SHA в теге.
- База: PostgreSQL 16, только внутренняя сеть, том `polnoch_stories_pgdata`.
- Сеть: `polnoch_stories_default`; host networking не используется.
- Секреты, SQL-бэкапы и сертификат — вне build context.
- Бэкапы: `/var/lib/polnoch-stories/backups`, атомарная запись, 14 последних.
- Сертификат: `/var/lib/polnoch-stories/pki`, отдельный certbot-контейнер
  без публикации 80/443. Чужие сертификаты в `/etc/letsencrypt` не затрагиваются.
- Общедоступный challenge-каталог: `/var/www/polnoch-stories-acme`; он отделён
  от закрытого каталога состояния, чтобы nginx мог прочитать challenge.
- Продление: `polnoch-stories-cert-renew.timer`, nginx перезагружается только
  при изменении сертификата. Существующие таймеры не редактируются.
- Ограничения памяти/CPU/PID заданы для каждого сервиса. Next.js собирается
  с одним worker. Сборка использует общие ресурсы хоста; контейнеры других
  проектов не останавливаются и не пересоздаются.

```bash
bash /opt/polnoch-stories/deploy/hostkey.sh status
```

Используйте этот wrapper для команд установки. Обычный `docker compose up`
из корня репозитория запустит исходный стек с Caddy и займёт 80/443 — он здесь
не применяется. `install` повторно использует текущий checkout, не делает git
reset/pull, не пересоздаёт секреты и не импортирует контент заново. Обновления
исходников и восстановление SQL выполняются отдельно после сохранения бэкапа.

## Локальные проверки

```bash
bash -n deploy/hostkey.sh
python3 scripts/test-hostkey.py
npm run typecheck
npm test -- --runInBand
npm run build
```

`test-hostkey.py` проверяет реальную Compose-конфигурацию и запускает CLI
настройки бота с подменённым `fetch`, без запросов в Telegram: другой бот,
чужой webhook, ошибка API и успешный сценарий. Публичный TLS и реальный токен
окончательно проверяются на сервере при `install` и `bot`.

## Добавление «Полночи» в существующий Cloudflare Worker

`deploy/cloudflare-relay.mjs` содержит полный код для двух ботов. Он сохраняет
старые имена `BOT_ID`, `RELAY_SECRET`, `WEBHOOK_SECRET`, `ORIGIN_WEBHOOK` и путь
`/webhook` для Battleship. Их значения не меняются. Новое приложение использует
отдельные имена `STORIES_*` и путь `/stories/webhook`.

Обновите только checkout нового приложения:

```bash
git -C /opt/polnoch-stories pull --ff-only
bash /opt/polnoch-stories/deploy/hostkey.sh relay-config
```

Команда сохраняет резервную копию исходного env и генерирует отдельный секрет
реле. Повторный запуск не меняет его и не затрагивает пароль БД. Настройки для
Cloudflare записываются в `/var/lib/polnoch-stories/cloudflare-stories.txt` (600).
Этот файл содержит два секрета: копируйте значения в свою панель, не публикуйте
файл или его скриншот. Полный токен бота в него не включается.

В том же `battleship-relay` добавьте **новые** bindings:

| Имя | Тип |
|---|---|
| `STORIES_BOT_ID` | Variable / Text |
| `STORIES_ORIGIN_WEBHOOK` | Variable / Text |
| `STORIES_RELAY_SECRET` | Secret |
| `STORIES_WEBHOOK_SECRET` | Secret |

Замените код Worker содержимым `deploy/cloudflare-relay.mjs` и нажмите Deploy.
Не удаляйте и не переименовывайте старые bindings Battleship. Пока новые bindings
не заданы, новый маршрут запрещён, а старый продолжает использовать свои ключи.

После обновления Worker:

```bash
nohup bash /opt/polnoch-stories/deploy/hostkey.sh relay-apply >/var/lib/polnoch-stories/relay.log 2>&1 </dev/null &
```

```bash
tail -n 40 /var/lib/polnoch-stories/relay.log
```

Пересобираются app/tools; пересоздаётся **только приложение «Полночь»**. База,
backup, cron, nginx и Battleship не пересоздаются. Скрипт проверяет здоровье и
запускает настройку отдельного бота через реле. И CLI, и серверные уведомления,
инвойсы Stars и ответы Telegram используют один транспорт с таймаутом и отдельным
`X-Relay-Secret`. При прямом режиме этот секрет в Telegram не отправляется.

```bash
node scripts/cloudflare-relay.test.mjs
```

Тест использует подменённый fetch: оба старых маршрута, новые маршруты,
несовпадающие секреты, неизвестный/дублированный ID и отсутствие новых настроек.
Реальный Worker меняется только при Deploy в вашей Cloudflare-панели.
