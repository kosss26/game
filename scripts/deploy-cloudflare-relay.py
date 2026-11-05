#!/usr/bin/env python3
"""Interactive VPS deployment. Credentials stay in memory; modifies one named Worker."""
import argparse
import shlex
import email.policy
import getpass
import fcntl
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from email.parser import BytesParser

ROOT = pathlib.Path('/opt/polnoch-stories')
STATE = pathlib.Path('/var/lib/polnoch-stories')
ENV = pathlib.Path('/etc/polnoch-stories/app.env')
WORKER = 'battleship-relay'
BASE = 'https://battleship-relay.kosyakov.workers.dev'
NEW_NAMES = {'STORIES_BOT_ID', 'STORIES_ORIGIN_WEBHOOK', 'STORIES_RELAY_SECRET', 'STORIES_WEBHOOK_SECRET'}
OLD_NAMES = {'BOT_ID', 'ORIGIN_WEBHOOK', 'RELAY_SECRET', 'WEBHOOK_SECRET'}
SETTING_KEYS = ('compatibility_date', 'compatibility_flags', 'usage_model', 'logpush', 'tail_consumers', 'placement', 'observability', 'limits', 'tags')


class DeploymentError(Exception):
    pass


def account_id(value):
    match = re.fullmatch(r'[0-9a-fA-F]{32}', value.strip())
    if match:
        return match[0]
    url = urllib.parse.urlsplit(value.strip())
    if url.hostname == 'dash.cloudflare.com':
        match = re.match(r'/([0-9a-fA-F]{32})(?:/|$)', url.path)
        if match:
            return match[1]
    raise DeploymentError('Нужна ссылка вида https://dash.cloudflare.com/<account-id>/workers/... или Account ID из 32 символов.')


def token_value(value):
    value = value.strip()
    try:
        parts = shlex.split(value)
    except ValueError:
        raise DeploymentError("Не удалось прочитать токен: скопируйте его ещё раз без обрезания.") from None
    for part in parts:
        match = re.fullmatch(r'Authorization:\s*Bearer\s+(.+)', part, re.I)
        if match:
            value = match[1].strip()
            break
    else:
        if len(parts) == 1:
            value = parts[0]
        elif len(parts) == 2 and parts[0].lower() == 'bearer':
            value = parts[1]
    if not re.fullmatch(r'[A-Za-z0-9_.-]{20,512}', value):
        raise DeploymentError("Не распознан API Token. Вставьте токен или полную проверочную команду curl из Cloudflare.")
    return value


def api_error(status, body):
    # Only numeric codes and our own fixed messages are shown: API errors may echo secrets.
    try:
        codes = [item.get('code') for item in json.loads(body).get('errors', [])]
        codes = [code for code in codes if type(code) is int]
    except (ValueError, AttributeError, TypeError):
        codes = []
    detail = ('; коды ' + ', '.join(map(str, codes))) if codes else ''
    if 6111 in codes or 6003 in codes:
        hint = 'Неверный формат заголовка авторизации. Скопируйте API Token заново.'
    elif status in (401, 403) or 10000 in codes:
        hint = 'Токен не принят или не имеет доступа к этому аккаунту. Нужен Workers Scripts Edit.'
    elif status == 404:
        hint = 'Worker battleship-relay не найден в указанном аккаунте.'
    else:
        hint = 'Cloudflare отклонил запрос. Пришлите только эту строку ошибки.'
    return DeploymentError(f'Cloudflare HTTP {status}{detail}. {hint}')


def private_write(path, content):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as output:
        output.write(content)


def multipart(metadata, modules):
    boundary = 'polnoch-' + uuid.uuid4().hex
    parts = [('metadata', 'application/json', json.dumps(metadata).encode())] + modules
    body = bytearray()
    for name, kind, content in parts:
        if not re.fullmatch(r'[\w./-]+', name):
            raise DeploymentError('Неожиданное имя модуля Worker; публикация остановлена.')
        body.extend((f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{name}"\r\nContent-Type: {kind}\r\n\r\n').encode())
        body.extend(content)
        body.extend(b'\r\n')
    body.extend(f'--{boundary}--\r\n'.encode())
    return bytes(body), f'multipart/form-data; boundary={boundary}'


def original_module(content_type, raw):
    if content_type.lower().startswith('multipart/'):
        message = BytesParser(policy=email.policy.default).parsebytes(b'Content-Type: ' + content_type.encode() + b'\r\nMIME-Version: 1.0\r\n\r\n' + raw)
        modules = []
        for part in message.iter_parts():
            name = part.get_param('name', header='content-disposition') or part.get_filename()
            if name != 'metadata':
                modules.append((name, part.get_content_type(), part.get_payload(decode=True)))
        if len(modules) != 1 or not modules[0][0] or b'export default' not in modules[0][2]:
            raise DeploymentError('Текущий Worker отличается от ожидаемого одного ES-модуля. Он не изменён.')
        name, _, source = modules[0]
        return name, [('worker.js', 'application/javascript+module', source)]
    if b'export default' not in raw:
        raise DeploymentError('Не удалось распознать текущий ES-модуль. Worker не изменён.')
    return 'worker.js', [('worker.js', 'application/javascript+module', raw)]


class Cloudflare:
    def __init__(self, token, account):
        self.token, self.account = token, account
        self.path = f'/accounts/{account}/workers/scripts/{WORKER}'

    def request(self, path, method='GET', data=None, content_type=None, raw=False):
        headers = {'Authorization': 'Bearer ' + self.token}
        if content_type:
            headers['Content-Type'] = content_type
        req = urllib.request.Request('https://api.cloudflare.com/client/v4' + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                body, kind = response.read(), response.headers.get('Content-Type', '')
        except urllib.error.HTTPError as error:
            # Never print API bodies: they can echo uploaded secret values.
            raise api_error(error.code, error.read(16384)) from None
        except (urllib.error.URLError, TimeoutError):
            raise DeploymentError('Не удалось связаться с Cloudflare. Токен не сохранён.') from None
        if raw:
            return kind, body
        result = json.loads(body)
        if not result.get('success'):
            codes = ','.join(str(item.get('code', '?')) for item in result.get('errors', []))
            raise DeploymentError('Cloudflare отклонил запрос; коды: ' + codes)
        return result['result']

    def settings(self):
        return self.request(self.path + '/settings')

    def upload(self, settings, bindings, modules):
        metadata = {key: settings[key] for key in SETTING_KEYS if key in settings and settings[key] is not None}
        metadata.update(main_module='worker.js', bindings=bindings)
        body, kind = multipart(metadata, modules)
        return self.request(self.path + '?bindings_inherit=strict', 'PUT', body, kind)


def inherited(bindings):
    return [{'name': binding['name'], 'type': 'inherit'} for binding in bindings]


def new_bindings(values):
    return [
        {'name': 'STORIES_BOT_ID', 'type': 'plain_text', 'text': values['TELEGRAM_BOT_TOKEN'].split(':', 1)[0]},
        {'name': 'STORIES_ORIGIN_WEBHOOK', 'type': 'plain_text', 'text': values['APP_URL'].rstrip('/') + '/api/telegram/webhook'},
        {'name': 'STORIES_RELAY_SECRET', 'type': 'secret_text', 'text': values['TELEGRAM_RELAY_SECRET']},
        {'name': 'STORIES_WEBHOOK_SECRET', 'type': 'secret_text', 'text': values['TELEGRAM_WEBHOOK_SECRET']},
    ]


def verify_bot(values):
    req = urllib.request.Request(BASE + '/bot' + values['TELEGRAM_BOT_TOKEN'] + '/getMe', data=b'{}', headers={
        'Content-Type': 'application/json', 'X-Relay-Secret': values['TELEGRAM_RELAY_SECRET'],
    }, method='POST')
    reason = 'нет ответа'
    expected = values['BOT_USERNAME'].lstrip('@')
    safe_username = lambda name: name if re.fullmatch(r'[A-Za-z0-9_]{1,64}', name) else '(не распознан)'
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                result = json.load(response)
            if result.get('ok'):
                actual = str(result.get('result', {}).get('username', ''))
                if actual.lower() == expected.lower():
                    return
                raise DeploymentError(f"Токен принят, но username не совпадает: в настройках @{safe_username(expected)}, Telegram вернул @{safe_username(actual)}. Worker будет восстановлен.")
            code = result.get('error_code')
            reason = f'Telegram API code {code}' if type(code) is int else 'ответ без ok=true'
        except urllib.error.HTTPError as error:
            reason = f'HTTP {error.code}'
            try:
                payload = json.loads(error.read(8192))
                code = payload.get('error_code')
                if type(code) is int:
                    reason += f', Telegram API code {code}'
            except (ValueError, AttributeError):
                pass
        except (urllib.error.URLError, TimeoutError):
            reason = 'нет соединения или истекло время ожидания'
        except (ValueError, KeyError, AttributeError):
            reason = 'ответ не является ожидаемым Telegram JSON'
        if attempt < 5:
            time.sleep(3)
    hints = {
        'HTTP 403': 'реле отклонило секрет доступа',
        'HTTP 404': 'маршрут нового бота не найден или ещё не распространился',
        'HTTP 401': 'Telegram не принял токен бота',
        'HTTP 530': 'ошибка DNS или конфигурации Cloudflare',
    }
    hint = next((text for prefix, text in hints.items() if reason.startswith(prefix)), 'нужна проверка по указанному коду')
    raise DeploymentError(f'getMe через реле: {reason}; {hint}.')


def deploy(client, values, source, backup):
    settings = client.settings()
    bindings = settings.get('bindings', [])
    names = {item['name'] for item in bindings}
    if not OLD_NAMES <= names:
        raise DeploymentError('Не найдены четыре прежние настройки Battleship. Worker не изменён.')
    old_id = next((b.get('text') for b in bindings if b['name'] == 'BOT_ID'), None)
    if old_id and old_id == values['TELEGRAM_BOT_TOKEN'].split(':', 1)[0]:
        raise DeploymentError('Указан бот Battleship вместо отдельного бота историй.')
    kind, raw = client.request(client.path, raw=True)
    _, old_modules = original_module(kind, raw)
    backup.mkdir(mode=0o700)
    private_write(backup / 'worker-response.bin', raw)
    private_write(backup / 'settings.json', json.dumps(settings).encode())
    private_write(backup / 'worker.js', old_modules[0][2])
    additions = new_bindings(values)
    # Existing secret values cannot be read back; retain them for a repeat run.
    additions = [{'name': b['name'], 'type': 'inherit'} if b['type'] == 'secret_text' and b['name'] in names else b for b in additions]
    keep = [item for item in bindings if item['name'] not in NEW_NAMES]
    # Inherit all old bindings by name, including unreadable secret values.
    # strict makes Cloudflare reject a missing inheritance rather than silently dropping it.
    uploaded = False
    try:
        uploaded = True
        client.upload(settings, inherited(keep) + additions, [('worker.js', 'application/javascript+module', source)])
        after = client.settings().get('bindings', [])
        after_by_name = {item['name']: item for item in after}
        if not (names | NEW_NAMES) <= set(after_by_name):
            raise DeploymentError('Cloudflare не сохранил все настройки.')
        for item in keep:
            current = after_by_name[item['name']]
            if current['type'] != item['type'] or (item['type'] == 'plain_text' and current.get('text') != item.get('text')):
                raise DeploymentError('Проверка сохранения прежних настроек не пройдена.')
        verify_bot(values)
    except Exception:
        if uploaded:
            print('Проверка не пройдена. Восстанавливаю прежний Worker...', flush=True)
            try:
                rollback = inherited(keep) + [b for b in bindings if b['name'] in NEW_NAMES and b['type'] != 'secret_text']
                # Secret values were inherited on repeat runs, so rollback retains them.
                rollback += inherited([b for b in bindings if b['name'] in NEW_NAMES and b['type'] == 'secret_text'])
                client.upload(settings, rollback, old_modules)
                print('Прежний код и настройки Battleship восстановлены.', flush=True)
            except Exception:
                print('Автовосстановление не удалось. Верните прежнюю версию в Cloudflare Deployments. Копия: ' + str(backup), flush=True)
        raise


def main():
    os.umask(0o077)
    if os.geteuid() != 0 or not sys.stdin.isatty():
        raise DeploymentError('Запустите от root в интерактивном SSH-терминале.')
    if not (ROOT / 'deploy/cloudflare-relay.mjs').is_file():
        raise DeploymentError('Не найден checkout /opt/polnoch-stories.')
    STATE.mkdir(mode=0o700, exist_ok=True)
    lock = open(STATE / 'cloudflare-deploy.lock', 'a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise DeploymentError('Публикация уже выполняется.') from None
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--account', help='Cloudflare Account ID or dashboard URL')
    args = parser.parse_args()
    account = account_id(args.account or input('Вставьте ссылку из адресной строки Cloudflare (или Account ID): '))
    token = token_value(getpass.getpass('Временный Cloudflare API Token или команда curl (ввод скрыт): '))
    client = Cloudflare(token, account)
    # Read permissions and identity are checked before changing local configuration.
    client.settings()
    subprocess.run(['bash', str(ROOT / 'deploy/hostkey.sh'), 'relay-config'], check=True)
    values = dict(line.split('=', 1) for line in ENV.read_text().splitlines() if '=' in line and not line.startswith('#'))
    backup = STATE / ('cloudflare-before-' + time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6])
    print('Сохраняю прежний Worker и публикую поддержку двух ботов...', flush=True)
    deploy(client, values, (ROOT / 'deploy/cloudflare-relay.mjs').read_bytes(), backup)
    print('Worker опубликован. Новый бот ответил на getMe; прежние настройки сохранены.', flush=True)
    # Detached build survives closing the phone SSH app. Token is not passed to child.
    with open(STATE / 'relay.log', 'wb') as output:
        subprocess.Popen(['bash', str(ROOT / 'deploy/hostkey.sh'), 'relay-apply'], stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
    print('Запущена сборка приложения. Через 2–3 минуты проверьте:')
    print('tail -n 40 /var/lib/polnoch-stories/relay.log')
    print('API Token не сохранён. После завершения его можно удалить в Cloudflare.')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nОстановлено.', file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # Do not dump exceptions/tracebacks containing request URLs or bot tokens.
        print('ОШИБКА: ' + (str(error) if isinstance(error, DeploymentError) else 'Операция не завершена; секреты не выводятся.'), file=sys.stderr)
        sys.exit(1)
