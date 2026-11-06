#!/usr/bin/env python3
"""Public, read-only startup probes. Never reads an env file or sends auth data."""
import argparse
import json
import subprocess
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        value = values.get('src') if tag == 'script' else values.get('href') if tag == 'link' and values.get('rel') == 'stylesheet' else None
        if value and '/_next/static/' in value and not value.startswith('data:'):
            self.urls.append(value)

def probe(url, label):
    result = subprocess.run(['curl', '--silent', '--show-error', '--location', '--max-redirs', '2', '--connect-timeout', '5', '--max-time', '12', '--max-filesize', '2097152', '--write-out', '\n%{json}', url], text=True, capture_output=True)
    try:
        body, raw = result.stdout.rsplit('\n', 1)
        metrics = json.loads(raw)
    except (ValueError, TypeError):
        print(f'{label}: curl failed ({result.returncode})')
        return False, ''
    ok = result.returncode == 0 and metrics.get('http_code') == 200
    print(f'{label}: HTTP {metrics.get("http_code", 0)}, DNS {metrics.get("time_namelookup", 0):.2f}s, TLS {metrics.get("time_appconnect", 0):.2f}s, first byte {metrics.get("time_starttransfer", 0):.2f}s, total {metrics.get("time_total", 0):.2f}s, curl={result.returncode}')
    return ok, body

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    args = parser.parse_args()
    parts = urlsplit(args.url)
    if parts.scheme not in ('http', 'https') or not parts.netloc or parts.username or parts.password or parts.query or parts.fragment:
        parser.error('Expected an HTTP(S) site URL without credentials, query or fragment')
    base = f'{parts.scheme}://{parts.netloc}'
    good = True
    html = ''
    for index in range(3):
        ok, body = probe(base + '/', f'HTML {index + 1}')
        good &= ok
        if ok: html = body
    ok, _ = probe(base + '/api/health', 'App + database')
    good &= ok
    early = 'polnoch-early-ready-v2' in html
    print('Early native ready: ' + ('installed' if early else 'not found in current HTML'))
    assets = Assets()
    assets.feed(html)
    if 'telegram-web-app.124bdff7.js' in html:
        assets.urls.append('/vendor/telegram-web-app.124bdff7.js')
    urls = list(dict.fromkeys(assets.urls))[:16]
    for value in urls:
        url = urljoin(base, value)
        if urlsplit(url).netloc != parts.netloc: continue
        ok, _ = probe(url, urlsplit(url).path)
        good &= ok
    print('HTTP checks: ' + ('PASS' if good else 'FAIL'))
    print('These probes run on this machine; they do not measure the phone network or prove native Telegram delivery.')
    return 0 if good else 1

if __name__ == '__main__':
    raise SystemExit(main())
