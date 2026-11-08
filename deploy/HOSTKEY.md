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

Перед сборкой новая версия проходит проверку: типы, линтер и все тесты (включая
тысячи прохождений каждой истории) — отдельный этап Docker `--target test`, 2–4 минуты.
Если проверка не прошла, исходники откатываются к прежней версии и **приложение не
перезапускается** — игроки продолжают работать на старой версии. Выкатить срочное
исправление без проверки: `SKIP_TESTS=1 bash /opt/polnoch-stories/deploy/hostkey.sh update`.

Те же проверки запускаются в GitHub Actions на каждый push (`.github/workflows/ci.yml`,
вкладка **Actions** в репозитории). Зелёная галочка у коммита — можно обновлять сервер.

## Мониторинг и оповещения

Раз в 5 минут Cloudflare Worker (тот же, что служит посредником для Telegram) проверяет
сервер снаружи и пишет в Telegram, если:

- сайт не отвечает (после двух неудачных проверок подряд, чтобы не будить из-за одного сбоя сети);
- недоступна база данных;
- сервер не может достучаться до Telegram через посредника;
- Telegram не может доставить сообщения боту (ошибка вебхука или очередь больше 50);
- у игроков или на сервере появились новые ошибки.

О неустранённой проблеме — напоминание раз в час, после исправления — «✅ Восстановлено».
Подробности ошибок со стеком — в студии: **Аналитика → Ошибки за сутки**.

### Настройка (один раз, ~10 минут)

1. **Бот для оповещений.** В @BotFather создайте отдельного бота (например, `polnoch_alerts_bot`) —
   токен основного бота в Cloudflare не передаётся. Напишите новому боту `/start`.
2. **Ваш chat id.** Откройте `https://api.telegram.org/bot<ТОКЕН_БОТА_ОПОВЕЩЕНИЙ>/getUpdates`
   в браузере (с компьютера, где Telegram не заблокирован) и найдите `"chat":{"id":…}`.
   Для оповещений в группу добавьте бота в группу — id будет отрицательным.
3. **Секрет на сервере:**
   ```bash
   bash /opt/polnoch-stories/deploy/hostkey.sh monitor-config
   ```
   Создаёт `MONITOR_SECRET` (повторный запуск его не меняет), перезапускает приложение,
   показывает отчёт и сохраняет готовые значения в `/var/lib/polnoch-stories/cloudflare-monitor.txt`.
4. **Cloudflare → Workers → battleship-relay:**
   - вставьте обновлённый код из `deploy/cloudflare-relay.mjs` и нажмите **Deploy**;
   - **Settings → Variables and Secrets**: `MONITOR_URL`, `ALERT_CHAT_ID` (Text),
     `MONITOR_SECRET`, `ALERT_BOT_TOKEN` (Secret) — значения из файла шага 3;
   - **Settings → Triggers → Cron Triggers → Add**: `*/5 * * * *`;
   - необязательно, но лучше: **Storage → KV → Create namespace** `polnoch-monitor`, затем в
     Worker **Settings → Bindings → KV namespace** с именем `MONITOR_STATE`. Без KV воркер не
     помнит прошлые проверки и напоминает о проблеме дважды в час вместо «раз в час + восстановлено».
5. **Проверка:** с любого компьютера
   ```bash
   curl -H "X-Monitor-Secret: <MONITOR_SECRET>" https://battleship-relay.kosyakov.workers.dev/stories/monitor-test
   ```
   В Telegram придёт «✅ Полночь: всё работает» (или список проблем).

Отчёт с самого сервера в любой момент: `bash /opt/polnoch-stories/deploy/hostkey.sh monitor-check`.

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

### Автоматическая публикация из SSH

Если создан временный Cloudflare API Token с `Account → Workers Scripts → Edit`
для нужного аккаунта, ручной перенос bindings не требуется:

```bash
git -C /opt/polnoch-stories pull --ff-only && python3 /opt/polnoch-stories/scripts/deploy-cloudflare-relay.py
```

Скрипт запросит ссылку из адресной строки Cloudflare (или Account ID), затем токен
скрытым вводом. Токен не сохраняется в файл, аргументы процесса или историю shell.
Текущий Worker и настройки сохраняются в приватный каталог
`/var/lib/polnoch-stories/cloudflare-before-*`. Старые bindings наследуются через
`type: inherit` с `bindings_inherit=strict`; существующие Stories secrets также
наследуются при повторном запуске. Меняется только `battleship-relay`.

После публикации проверяются сохранение старых bindings и `getMe` отдельного бота.
При неудаче выполняется попытка восстановления прежнего кода и bindings; при
неудаче восстановления скрипт сообщает об этом и сохраняет копию для ручного
восстановления. Успешная публикация запускает `relay-apply` в фоне с логом
`/var/lib/polnoch-stories/relay.log`. После завершения удалите временный API Token
в Cloudflare. Проверки без обращения в Cloudflare:

```bash
python3 scripts/test-cloudflare-deploy.py
```

Проверка `getMe` в установщике выполняется через `curl`: на этом VPS Python urllib
получает HTTP 403 даже на корневом адресе Worker. URL с токеном и заголовок
секрета передаются curl через stdin, без временных файлов и без секретов в argv.

### Проверка в движке Cloudflare Workers

Worker использует `redirect: manual` и возвращает 502 на upstream 3xx. Режим
`redirect: error` не поддерживается workerd и приводит к HTTP 500.

```bash
npm install --prefix /tmp/polnoch-workerd-qa --no-audit --no-fund miniflare@4
MINIFLARE_MODULE=/tmp/polnoch-workerd-qa/node_modules/miniflare node scripts/cloudflare-relay.runtime-test.cjs
```

Тест запускает реальный workerd с локальным тестовым upstream без обращений в
Telegram: оба бота, оба webhook, несовпадающие секреты и отсутствие переходов
по перенаправлениям. Miniflare нужен только для проверки разработчиком.
