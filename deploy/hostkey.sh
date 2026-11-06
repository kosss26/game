#!/usr/bin/env bash
# Dedicated installation for root@77.91.112.63; does not use the upstream Caddy stack.
set -Eeuo pipefail
umask 077
ROOT=/opt/polnoch-stories
STATE=/var/lib/polnoch-stories
ENV=/etc/polnoch-stories/app.env
ACME=/var/www/polnoch-stories-acme
PROJECT=polnoch_stories
BRANCH=deploy/hostkey-nginx
DOMAIN_DEFAULT=stories.77.91.112.63.nip.io
SITE=/etc/nginx/sites-available/polnoch-stories.conf
LINK=/etc/nginx/sites-enabled/polnoch-stories.conf
CERT_IMAGE=certbot/certbot:v2.11.0
MODE=${1:-status}
die() { printf '\nОШИБКА: %s\n' "$*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }
[[ $EUID == 0 ]] || die 'Запустите от root'
case "$MODE" in init|install|update|bot|status|startup-check|renew|relay-config|relay-apply) ;; *) die 'Режимы: init | install | update | bot | status | startup-check | renew | relay-config | relay-apply' ;; esac
for cmd in docker git python3 curl openssl flock ss; do command -v "$cmd" >/dev/null || die "Не найдена команда $cmd"; done
[[ ! -L "$STATE" && ! -L /etc/polnoch-stories && ! -L "$ACME" ]] || die 'Каталоги установки не должны быть символическими ссылками'
mkdir -p "$STATE" /etc/polnoch-stories
chmod 700 "$STATE" /etc/polnoch-stories
exec 9>"$STATE/lock"
flock -n 9 || die 'Установка уже выполняется'
docker info >/dev/null
get_env() {
  python3 - "$ENV" "$1" <<'PY'
import sys
for line in open(sys.argv[1]):
    key, sep, value = line.rstrip('\n').partition('=')
    if sep and key == sys.argv[2]:
        print(value); break
PY
}
compose() {
  local sha
  sha=$(git -C "$ROOT" rev-parse --short=12 HEAD)
  POLNOCH_ENV_FILE="$ENV" APP_TAG="polnoch-stories:app-$sha" TOOLS_TAG="polnoch-stories:tools-$sha" docker compose --env-file "$ENV" --project-directory "$ROOT" -p "$PROJECT" -f "$ROOT/deploy/hostkey.compose.yml" "$@"
}
ready() {
  [[ -f "$STATE/initialized" && -f "$ENV" && -d "$ROOT/.git" ]] || die 'Сначала выполните init'
  [[ $(git -C "$ROOT" remote get-url origin) == https://github.com/kosss26/game.git ]] || die 'Неожиданный репозиторий'
  [[ $(git -C "$ROOT" branch --show-current) == "$BRANCH" ]] || die 'Неожиданная ветка установки'
}
init() {
  [[ ! -e "$ENV" && ! -e "$STATE/initialized" ]] || die 'Настройки уже существуют: не перезаписываю пароли. Используйте install или status.'
  [[ ! -e "$ROOT" ]] || die "$ROOT уже существует: остановка без изменений"
  [[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT") ]] || die 'Имя Compose-проекта уже занято'
  [[ -z $(ss -H -lnt '( sport = :3500 )') ]] || die 'Порт 3500 уже занят'
  [[ -t 0 ]] || die 'init требует интерактивный SSH-терминал'
  local domain token username shortname adminids adminpass
  read -rp "Домен [$DOMAIN_DEFAULT]: " domain
  domain=${domain:-$DOMAIN_DEFAULT}
  [[ "$domain" =~ ^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$ ]] || die 'Нужен домен без https:// и пути'
  read -rsp 'Токен отдельного бота (ввод скрыт): ' token; printf '\n'
  [[ "$token" =~ ^[0-9]+:[A-Za-z0-9_-]{20,}$ ]] || die 'Неверный формат токена'
  read -rp 'Username этого бота без @: ' username
  username=${username#@}
  [[ "$username" =~ ^[A-Za-z0-9_]{5,32}$ ]] || die 'Неверный username'
  read -rp 'Короткое имя Mini App (Enter, если ещё не задано): ' shortname
  [[ -z "$shortname" || "$shortname" =~ ^[A-Za-z0-9_]{1,64}$ ]] || die 'Неверное короткое имя'
  read -rp 'Ваш Telegram ID для админки (Enter — вход только по паролю): ' adminids
  [[ -z "$adminids" || "$adminids" =~ ^[0-9,\ ]+$ ]] || die 'Нужен числовой Telegram ID'
  git clone --single-branch --branch "$BRANCH" https://github.com/kosss26/game.git "$ROOT"
  adminpass=$(openssl rand -hex 16)
  {
    printf '%s\n' "DOMAIN=$domain" "APP_URL=https://$domain" "TELEGRAM_BOT_TOKEN=$token" "BOT_USERNAME=$username" "APP_SHORT_NAME=$shortname" "ADMIN_TELEGRAM_IDS=$adminids"
    printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)"
    printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'TELEGRAM_WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 24)"
    printf 'CRON_SECRET=%s\n' "$(openssl rand -hex 24)"
    printf '%s\n' "ADMIN_PASSWORD=$adminpass" 'DATA_SOURCE=postgres' 'ALLOW_WEB_GUESTS=false' 'PRICE_SKIP_DAY_STARS=15' 'PRICE_SEASON_PASS_STARS=99' 'REFERRAL_BONUS_SKIPS=1' 'DEFAULT_WAIT_HOURS=12'
  } > "$ENV.tmp"
  chmod 600 "$ENV.tmp"
  mv "$ENV.tmp" "$ENV"
  printf 'https://%s/admin/login\nПароль: %s\n' "$domain" "$adminpass" > "$STATE/admin-login.txt"
  touch "$STATE/initialized"
  unset token adminpass
  say 'Настройки сохранены. Токен и пароли в лог не выводятся.'
  printf 'Пароль студии: %s/admin-login.txt\nСледующий шаг: bash %s/deploy/hostkey.sh install\n' "$STATE" "$ROOT"
}
wait_health() {
  local attempt
  for ((attempt=0;attempt<90;attempt++)); do
    if curl -fsS --max-time 3 http://127.0.0.1:3500/api/health >/dev/null; then return; fi
    sleep 2
  done
  die 'Приложение не прошло health check. Смотрите: bash /opt/polnoch-stories/deploy/hostkey.sh status'
}
write_site() {
  local tls=$1 domain previous=$STATE/nginx.previous next=$STATE/nginx.next had_file=0 had_link=0
  domain=$(get_env DOMAIN)
  [[ ! -e "$SITE" || $(head -n 1 "$SITE") == '# polnoch-stories managed vhost' ]] || die "$SITE занят чужой конфигурацией"
  [[ ! -e "$LINK" && ! -L "$LINK" || $(readlink "$LINK") == "$SITE" ]] || die "$LINK занят"
  [[ -e "$SITE" ]] && { cp -p "$SITE" "$previous"; had_file=1; }
  [[ -L "$LINK" ]] && had_link=1
  python3 - "$next" "$domain" "$STATE" "$tls" "$ACME" <<'PY'
import sys
path, domain, state, tls, acme = sys.argv[1:]
http = f'''# polnoch-stories managed vhost
server {{
    listen 80;
    server_name {domain};
    location ^~ /.well-known/acme-challenge/ {{ root {acme}; }}
    location / {{ {'return 301 https://$host$request_uri;' if tls == 'yes' else 'return 503;'} }}
}}
'''
https = f'''server {{
    listen 443 ssl http2;
    server_name {domain};
    ssl_certificate {state}/pki/live/polnoch-stories/fullchain.pem;
    ssl_certificate_key {state}/pki/live/polnoch-stories/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 3m;
    location / {{
        proxy_pass http://127.0.0.1:3500;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 120s;
    }}
}}
'''
open(path, 'w').write(http + (https if tls == 'yes' else ''))
PY
  install -m 644 "$next" "$SITE"
  ln -sfn "$SITE" "$LINK"
  if ! nginx -t || ! systemctl reload nginx; then
    if ((had_file)); then cp -p "$previous" "$SITE"; else rm -f "$SITE"; fi
    if ((!had_link)); then rm -f "$LINK"; fi
    die 'Новый vhost не включён. Предыдущий файл восстановлен; остальные конфиги не изменялись.'
  fi
}
certbot() {
  docker run --rm --memory=256m --cpus=0.5 --pids-limit=64 -v "$STATE/pki:/etc/letsencrypt" -v "$ACME:/var/www/acme" "$CERT_IMAGE" "$@"
}
install_renew_timer() {
  local file
  for file in /etc/systemd/system/polnoch-stories-cert-renew.service /etc/systemd/system/polnoch-stories-cert-renew.timer; do
    [[ ! -e "$file" || $(head -n 1 "$file") == '# polnoch-stories managed timer' ]] || die "$file уже занят"
  done
  cat > /etc/systemd/system/polnoch-stories-cert-renew.service <<'UNIT'
# polnoch-stories managed timer
[Unit]
Description=Renew only the Polnoch Stories certificate
After=network-online.target docker.service
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/polnoch-stories/deploy/hostkey.sh renew
UNIT
  cat > /etc/systemd/system/polnoch-stories-cert-renew.timer <<'UNIT'
# polnoch-stories managed timer
[Unit]
Description=Daily Polnoch Stories certificate check
[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now polnoch-stories-cert-renew.timer
}
install_app() {
  ready
  command -v nginx >/dev/null || die 'Не найден nginx'
  command -v systemctl >/dev/null || die 'Не найден systemctl'
  [[ -d /etc/nginx/sites-enabled && -d /etc/nginx/sites-available ]] || die 'Ожидается стандартная структура nginx Ubuntu'
  [[ -z $(git -C "$ROOT" status --porcelain) ]] || die 'В исходниках есть локальные изменения'
  if [[ -n $(ss -H -lnt '( sport = :3500 )') && -z $(compose ps -q app) ]]; then die 'Порт 3500 занят другим процессом'; fi
  nginx -t
  python3 - "$(get_env DOMAIN)" "$SITE" <<'PYDOMAIN'
import pathlib, re, sys
host, own = sys.argv[1], pathlib.Path(sys.argv[2])
for folder in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
    for path in pathlib.Path(folder).glob('*'):
        if not path.is_file() or path.resolve() == own: continue
        content = re.sub(r'(?m)#.*$', '', path.read_text(errors='ignore'))
        for names in re.findall(r'\bserver_name\s+([^;]+);', content):
            if host in names.split(): raise SystemExit(f'Домен уже настроен в {path}; остановка без изменения nginx')
PYDOMAIN
  compose config --quiet
  mkdir -p "$STATE/backups" "$ACME/.well-known/acme-challenge" "$STATE/pki"
  chmod 755 "$ACME" "$ACME/.well-known" "$ACME/.well-known/acme-challenge"
  say 'Собираю только новый проект'
  compose build app tools
  say 'Запускаю новую базу и приложение'
  compose up -d --no-build db app
  wait_health
  if [[ ! -f "$STATE/seeded" ]]; then
    compose run --rm --no-deps tools npm run seed
    touch "$STATE/seeded"
  fi
  compose up -d --no-build cron backup
  say 'Подключаю отдельный домен к существующему nginx'
  if [[ ! -s "$STATE/pki/live/polnoch-stories/fullchain.pem" ]]; then
    write_site no
  fi
  certbot certonly --webroot -w /var/www/acme --cert-name polnoch-stories -d "$(get_env DOMAIN)" --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
  write_site yes
  install_renew_timer
  curl -fsS --max-time 20 "https://$(get_env DOMAIN)/api/health"
  printf '\nГотово: https://%s\nСтудия: https://%s/admin/login\nПароль: %s/admin-login.txt\nНастройка отдельного бота: bash %s/deploy/hostkey.sh bot\n' "$(get_env DOMAIN)" "$(get_env DOMAIN)" "$STATE" "$ROOT"
}
update_app() {
  ready
  [[ -z $(git -C "$ROOT" status --porcelain) ]] || die 'В исходниках есть локальные изменения: обновление остановлено'
  say 'Резервная копия базы перед обновлением'
  mkdir -p "$STATE/backups"
  local dump="$STATE/backups/before-update-$(date -u +%Y%m%d-%H%M%S).dump"
  compose exec -T db pg_dump -U polnoch -d polnoch -Fc > "$dump.tmp" || { rm -f "$dump.tmp"; die 'Не удалось сделать резервную копию'; }
  mv "$dump.tmp" "$dump"
  printf 'Копия: %s\n' "$dump"
  say 'Получаю обновления'
  local before after
  before=$(git -C "$ROOT" rev-parse HEAD)
  git -C "$ROOT" pull --ff-only origin "$BRANCH"
  after=$(git -C "$ROOT" rev-parse HEAD)
  [[ "$before" != "$after" ]] || printf 'Новых изменений нет, пересобираю текущую версию\n'
  compose config --quiet
  say 'Собираю новую версию'
  compose build app tools
  say 'Перезапускаю приложение'
  compose up -d --no-build db app
  wait_health
  say 'Загружаю истории'
  compose run --rm --no-deps tools npm run seed
  touch "$STATE/seeded"
  compose up -d --no-build cron backup
  curl -fsS --max-time 20 "https://$(get_env DOMAIN)/api/health" || true
  printf '\nОбновлено до %s\n' "$(git -C "$ROOT" log --oneline -1)"
}
relay_config() {
  ready
  python3 - "$ENV" "$STATE" <<'PYRELAY'
import pathlib, secrets, sys, os
path, state = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
original = path.read_text()
values = dict(line.split('=', 1) for line in original.splitlines() if '=' in line and not line.startswith('#'))
bot_id = values['TELEGRAM_BOT_TOKEN'].split(':', 1)[0]
assert bot_id.isdigit(), 'Invalid bot ID'
relay_secret = values.get('STORIES_RELAY_SECRET') or secrets.token_hex(24)
base = 'https://battleship-relay.kosyakov.workers.dev'
values.update(TELEGRAM_API_URL=base, TELEGRAM_API_BASE=base, TELEGRAM_RELAY_SECRET=relay_secret, STORIES_RELAY_SECRET=relay_secret, TELEGRAM_WEBHOOK_URL=base+'/stories/webhook')
backup = state / 'app.env.before-relay'
if not backup.exists(): backup.write_text(original); backup.chmod(0o600)
next_file = path.with_suffix('.relay.tmp')
next_file.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
next_file.chmod(0o600); os.replace(next_file, path)
settings = state / 'cloudflare-stories.txt'
settings.write_text(f"Variables (Text):\nSTORIES_BOT_ID={bot_id}\nSTORIES_ORIGIN_WEBHOOK={values['APP_URL'].rstrip('/')}/api/telegram/webhook\n\nSecrets:\nSTORIES_RELAY_SECRET={relay_secret}\nSTORIES_WEBHOOK_SECRET={values['TELEGRAM_WEBHOOK_SECRET']}\n")
settings.chmod(0o600)
print('Настройки Cloudflare сохранены в /var/lib/polnoch-stories/cloudflare-stories.txt (600).')
print('Токен бота не передаётся в Cloudflare Variables и не выводится.')
print('Сначала обновите Worker и добавьте четыре новые настройки, затем выполните relay-apply.')
PYRELAY
}
relay_apply() {
  ready
  [[ -n $(get_env TELEGRAM_API_BASE) && -n $(get_env TELEGRAM_RELAY_SECRET) && -n $(get_env TELEGRAM_WEBHOOK_URL) ]] || die 'Сначала выполните relay-config'
  [[ -z $(git -C "$ROOT" status --porcelain) ]] || die 'В исходниках есть локальные изменения'
  compose config --quiet
  say 'Собираю приложение и инструменты с поддержкой реле'
  compose build app tools
  compose up -d --no-build --no-deps app
  wait_health
  compose run --rm --no-deps tools npm run bot:setup
  printf '\nГотово: исходящие запросы и webhook нового бота используют реле.\n'
}
case "$MODE" in
  relay-config) relay_config ;;
  relay-apply) relay_apply ;;
  init) init ;;
  install) install_app ;;
  update) update_app ;;
  bot)
    ready
    curl -fsS --max-time 20 "https://$(get_env DOMAIN)/api/health" >/dev/null
    compose run --rm --no-deps tools npm run bot:setup
    ;;
  status)
    ready
    compose ps
    curl -fsS --max-time 5 http://127.0.0.1:3500/api/health || true
    ;;
  startup-check)
    ready
    say 'Проверка запуска «Полночи» (без изменения сервисов)'
    git -C "$ROOT" rev-parse --short=12 HEAD
    compose ps
    app_id=$(compose ps -aq app)
    if [[ -n "$app_id" ]]; then
      docker inspect --format 'App: status={{.State.Status}} restarts={{.RestartCount}} oom={{.State.OOMKilled}} started={{.State.StartedAt}}' "$app_id"
    fi
    curl -sS --max-time 5 http://127.0.0.1:3500/api/health || true
    printf '\n'
    python3 "$ROOT/scripts/check-startup.py" --url "https://$(get_env DOMAIN)"
    ;;
  renew)
    ready
    before=$(sha256sum "$STATE/pki/live/polnoch-stories/fullchain.pem")
    certbot renew --webroot -w /var/www/acme --non-interactive --quiet
    after=$(sha256sum "$STATE/pki/live/polnoch-stories/fullchain.pem")
    if [[ "$before" != "$after" ]]; then nginx -t; systemctl reload nginx; fi
    ;;
esac
