#!/usr/bin/env python3
"""Read-only Compose validation and bot setup preflight regression (no real Telegram calls)."""
import json, os, pathlib, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='polnoch-hostkey-') as tmp:
    tmp = pathlib.Path(tmp)
    envfile = tmp / 'app.env'
    envfile.write_text('POSTGRES_PASSWORD=private_fixture\nCRON_SECRET=private_fixture_cron\n')
    env = dict(os.environ, APP_TAG='polnoch-qa:app', TOOLS_TAG='polnoch-qa:tools', POLNOCH_ENV_FILE=str(envfile))
    r = subprocess.run(['docker', 'compose', '--env-file', str(envfile), '--project-directory', str(root), '-p', 'polnoch_stories', '-f', str(root/'deploy/hostkey.compose.yml'), '--profile', 'tools', 'config', '--format', 'json'], env=env, text=True, capture_output=True, check=True)
    config = json.loads(r.stdout)
    services = config['services']
    assert set(services) == {'app','db','cron','backup','tools'}
    assert services['app']['build']['context'] == str(root)
    assert services['tools']['build']['context'] == str(root)
    assert services['app']['ports'][0]['host_ip'] == '127.0.0.1'
    assert services['app']['ports'][0]['published'] == '3500'
    assert all(not s.get('ports') for k,s in services.items() if k!='app')
    assert all(s.get('mem_limit') and s.get('cpus') and s.get('pids_limit') for s in services.values())
    assert config['volumes']['pgdata']['name'] == 'polnoch_stories_pgdata'
    assert config['networks']['default']['name'] == 'polnoch_stories_default'
    assert all(s.get('network_mode') != 'host' for s in services.values())
    assert services['app']['environment']['DATA_SOURCE'] == 'postgres'
    print('Compose: isolated project/network/volume, bounded resources, loopback-only application, private DB, correct build context: pass', flush=True)

    preload = tmp / 'fetch.mjs'
    calls = tmp / 'calls.json'
    preload.write_text('''import fs from 'node:fs';
const calls=[];
const R=o=>({status:200,json:async()=>o,text:async()=>JSON.stringify(o)});
globalThis.fetch=async function(url, init) {
 const method=String(url).split('/').at(-1); calls.push(method); fs.writeFileSync(process.env.QA_CALLS, JSON.stringify(calls));
 const mode=process.env.QA_CASE;
 if (process.env.TELEGRAM_API_BASE) {
  if (!String(url).startsWith('https://relay.invalid/bot')) throw new Error('wrong relay target');
  if (init.headers['X-Relay-Secret']!=='fixture_relay_secret') throw new Error('missing relay authorization');
 }
 if (method==='getMe') return R({ok:true,result:{username:mode==='wrong_bot'?'other_bot':'stories_qa_bot'}});
 if (method==='getWebhookInfo') return R({ok:true,result:{url:mode.includes('foreign_webhook')?'https://other.invalid/api/webhook':mode==='direct_to_relay'?'https://stories.invalid/api/telegram/webhook':''}});
 if (method==='setWebhook' && mode==='api_error') return R({ok:false,description:'fixture rejection'});
 return R({ok:true,result:true});
};
''')
    for case in ['wrong_bot','foreign_webhook','api_error','success','relay_success','relay_foreign_webhook','direct_to_relay']:
        e = dict(os.environ, TELEGRAM_BOT_TOKEN='123456:private_fixture_token_dont_print', BOT_USERNAME='stories_qa_bot', APP_URL='https://stories.invalid', TELEGRAM_WEBHOOK_SECRET='fixture_secret_at_least_16', QA_CALLS=str(calls), QA_CASE=case)
        if case.startswith('relay_') or case=='direct_to_relay':
            e.update(TELEGRAM_API_BASE='https://relay.invalid', TELEGRAM_RELAY_SECRET='fixture_relay_secret', TELEGRAM_WEBHOOK_URL='https://relay.invalid/stories/webhook')
        r = subprocess.run(['node','--import','tsx','--import',str(preload),'scripts/bot-setup.ts'],cwd=root,env=e,text=True,capture_output=True)
        methods=json.loads(calls.read_text())
        assert 'private_fixture_token_dont_print' not in r.stdout+r.stderr
        if case in ['success','relay_success','direct_to_relay']:
            assert r.returncode==0 and methods[-1]=='setMyDescription'
        else:
            assert r.returncode!=0 and 'Готово' not in r.stdout
            if case=='wrong_bot': assert methods==['getMe']
            elif 'foreign_webhook' in case: assert methods==['getMe','getWebhookInfo']
            else: assert methods[-1]=='setWebhook'
        print(f'Bot setup {case}: pass',flush=True)
    script = (root/'deploy/hostkey.sh').read_text()
    assert 'docker compose up' not in script  # all operations go through the explicit scoped wrapper
    assert 'docker compose --env-file "$ENV" --project-directory "$ROOT" -p "$PROJECT"' in script
    assert 'docker system prune' not in script and 'down -v' not in script
    assert 'ACME=/var/www/polnoch-stories-acme' in script
    assert 'chmod 700 "$STATE"' in script and 'chmod 600 "$ENV.tmp"' in script
    assert 'systemctl reload nginx' in script and 'systemctl restart nginx' not in script
    print('Installer source: explicit scope, private state, public challenge directory, graceful nginx reload and no global cleanup: pass',flush=True)

    import re
    code = re.search(r"python3 - \"\$ENV\" \"\$STATE\" <<'PYRELAY'\n(.*?)\nPYRELAY", script, re.S)[1]
    private_env=tmp/'private.env'
    original='APP_URL=https://stories.invalid\nTELEGRAM_BOT_TOKEN=222:fixture_token_do_not_print\nTELEGRAM_WEBHOOK_SECRET=own_webhook_fixture\nPOSTGRES_PASSWORD=unchanged_fixture\nTELEGRAM_RELAY_SECRET=legacy_fixture\n'
    private_env.write_text(original)
    for _ in range(2):
        result=subprocess.run(['python3','-',str(private_env),str(tmp)],input=code,text=True,capture_output=True,check=True)
        assert 'fixture_token_do_not_print' not in result.stdout+result.stderr
        current=dict(line.split('=',1) for line in private_env.read_text().splitlines())
        if _==0: relay_secret=current['TELEGRAM_RELAY_SECRET']
        else: assert current['TELEGRAM_RELAY_SECRET']==relay_secret
        assert current['TELEGRAM_RELAY_SECRET'] != 'legacy_fixture'
        assert current['TELEGRAM_API_URL'] == current['TELEGRAM_API_BASE']
        assert current['POSTGRES_PASSWORD']=='unchanged_fixture'
        assert current['TELEGRAM_WEBHOOK_URL'].endswith('/stories/webhook')
    settings=(tmp/'cloudflare-stories.txt').read_text()
    assert 'STORIES_BOT_ID=222' in settings and 'fixture_token_do_not_print' not in settings
    assert (tmp/'app.env.before-relay').read_text()==original
    assert private_env.stat().st_mode & 0o777 == 0o600
    assert (tmp/'cloudflare-stories.txt').stat().st_mode & 0o777 == 0o600
    print('Relay config: private files, original backup, stable separate secret, no token output and unchanged DB password: pass',flush=True)
