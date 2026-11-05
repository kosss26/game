#!/usr/bin/env python3
"""No network requests: validate binding preservation, backup and rollback."""
import copy
import io
import urllib.error
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deployer', pathlib.Path(__file__).with_name('deploy-cloudflare-relay.py'))
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
VALUES = dict(TELEGRAM_BOT_TOKEN='222:fixture', APP_URL='https://stories.invalid', TELEGRAM_RELAY_SECRET='new-private', TELEGRAM_WEBHOOK_SECRET='new-webhook', BOT_USERNAME='stories_bot')
OLD = [dict(name='BOT_ID', type='plain_text', text='111'), dict(name='ORIGIN_WEBHOOK', type='plain_text', text='https://old.invalid/webhook'), dict(name='RELAY_SECRET', type='secret_text'), dict(name='WEBHOOK_SECRET', type='secret_text'), dict(name='UNRELATED', type='plain_text', text='unchanged')]


class FakeCloudflare:
    path = '/fixture'
    def __init__(self, bindings=None):
        self.current = copy.deepcopy(OLD if bindings is None else bindings)
        self.uploads = []
    def settings(self):
        return dict(bindings=copy.deepcopy(self.current), compatibility_date='2026-01-01', compatibility_flags=['nodejs_compat'])
    def request(self, path, raw=False):
        return 'application/javascript', b'export default {fetch(){return new Response("old")}};'
    def upload(self, settings, bindings, modules):
        self.uploads.append((copy.deepcopy(bindings), modules))
        old = {b['name']: b for b in self.current}
        self.current = [copy.deepcopy(old[b['name']]) if b['type'] == 'inherit' else copy.deepcopy(b) for b in bindings]
        for b in self.current:
            if b['type'] == 'secret_text': b.pop('text', None)


class DeploymentTests(unittest.TestCase):
    def test_account_url_or_id(self):
        account = 'a' * 32
        self.assertEqual(d.account_id(account), account)
        self.assertEqual(d.account_id('https://dash.cloudflare.com/' + account + '/workers/services/view/battleship-relay'), account)
        with self.assertRaises(d.DeploymentError): d.account_id('https://other.invalid/' + account)

    def test_token_input_accepts_token_quotes_bearer_and_cloudflare_curl(self):
        token = 'cfut_fixture_token_at_least_20_chars'
        for value in [token, '"' + token + '"', 'Bearer ' + token,
                      'curl "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer ' + token + '"']:
            self.assertEqual(d.token_value(value), token)
        for value in ['', 'curl unrelated', 'bad token value']:
            with self.assertRaises(d.DeploymentError): d.token_value(value)

    def test_error_only_shows_numeric_codes_without_echoed_secret(self):
        body = json.dumps({'errors': [{'code': 6003, 'message': 'private_fixture'}, {'code': 6111}]}).encode()
        error = str(d.api_error(400, body))
        self.assertIn('6111', error)
        self.assertIn('формат', error)
        self.assertNotIn('private_fixture', error)
        self.assertNotIn('private_fixture', str(d.api_error(400, b'private_fixture')))

    def test_bot_username_mismatch_is_reported_without_token(self):
        payload = json.dumps({'ok': True, 'result': {'username': 'actual_bot'}}).encode()
        with patch.object(d.urllib.request, 'urlopen', return_value=io.BytesIO(payload)):
            with self.assertRaises(d.DeploymentError) as caught: d.verify_bot(VALUES)
        self.assertIn('@actual_bot', str(caught.exception))
        self.assertIn('@stories_bot', str(caught.exception))
        self.assertNotIn(VALUES['TELEGRAM_BOT_TOKEN'], str(caught.exception))

    def test_bot_http_error_is_reported_without_response_body(self):
        error = urllib.error.HTTPError('https://relay.invalid', 403, 'Forbidden', {}, io.BytesIO(b'private'))
        with patch.object(d.urllib.request, 'urlopen', side_effect=error), patch.object(d.time, 'sleep'):
            with self.assertRaises(d.DeploymentError) as caught: d.verify_bot(VALUES)
        self.assertIn('HTTP 403', str(caught.exception))
        self.assertNotIn('private', str(caught.exception))

    def test_multipart_backup_parser(self):
        source = b'export default {fetch(){}};'
        body, kind = d.multipart({'main_module': 'worker.js'}, [('worker.js', 'application/javascript+module', source)])
        _, modules = d.original_module(kind, body)
        self.assertEqual(modules[0][2], source)
        with self.assertRaises(d.DeploymentError): d.original_module('text/html', b'error page')

    def test_preserves_every_old_binding_and_backs_up(self):
        client = FakeCloudflare()
        with tempfile.TemporaryDirectory() as tmp, patch.object(d, 'verify_bot') as verify:
            path = pathlib.Path(tmp) / 'backup'
            d.deploy(client, VALUES, b'export default {};', path)
            verify.assert_called_once_with(VALUES)
            self.assertEqual(json.loads((path / 'settings.json').read_text())['bindings'], OLD)
            self.assertEqual((path / 'settings.json').stat().st_mode & 0o777, 0o600)
        uploaded = {b['name']: b for b in client.uploads[0][0]}
        for b in OLD: self.assertEqual(uploaded[b['name']]['type'], 'inherit')
        self.assertEqual(uploaded['STORIES_RELAY_SECRET']['text'], 'new-private')
        self.assertFalse(any('222:fixture' in json.dumps(b) for b in uploaded.values()))

    def test_failed_verification_restores_old_module_and_all_bindings(self):
        client = FakeCloudflare()
        with tempfile.TemporaryDirectory() as tmp, patch.object(d, 'verify_bot', side_effect=d.DeploymentError('fixture')):
            with self.assertRaises(d.DeploymentError):
                d.deploy(client, VALUES, b'new module', pathlib.Path(tmp) / 'backup')
        self.assertEqual(len(client.uploads), 2)
        self.assertEqual(client.current, OLD)
        self.assertIn(b'new Response("old")', client.uploads[-1][1][0][2])

    def test_repeat_run_preserves_unreadable_stories_secrets(self):
        bindings = OLD + [dict(name='STORIES_RELAY_SECRET', type='secret_text'), dict(name='STORIES_WEBHOOK_SECRET', type='secret_text')]
        client = FakeCloudflare(bindings)
        with tempfile.TemporaryDirectory() as tmp, patch.object(d, 'verify_bot'):
            d.deploy(client, VALUES, b'new module', pathlib.Path(tmp) / 'backup')
        for b in client.uploads[0][0]:
            if b['name'].endswith('_SECRET'): self.assertEqual(b['type'], 'inherit')

    def test_foreign_worker_or_duplicate_bot_is_untouched(self):
        for bindings in [[], [dict(b, text='222') if b['name'] == 'BOT_ID' else b for b in OLD]]:
            client = FakeCloudflare(bindings)
            with tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(d.DeploymentError): d.deploy(client, VALUES, b'new', pathlib.Path(tmp) / 'backup')
            self.assertEqual(client.uploads, [])


if __name__ == '__main__':
    unittest.main()
