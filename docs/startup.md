# Mini App startup

Telegram keeps its native loading screen until the page calls `WebApp.ready()`.
Previously the official SDK was fetched from telegram.org with Next.js
`beforeInteractive`. An indefinitely pending SDK request blocked hydration,
including the ready call and authentication. Reproduced against the public
application by holding that request: zero authentication requests after 7 s,
versus successful hydration when the SDK request completed. This explains one
failure mode; it does not establish the cause of every connection failure on
a particular phone.

The SDK now loads from a pinned, unmodified local asset with `afterInteractive`.
There is no request to telegram.org during startup. The local asset is included
in the existing Docker `public` copy. Its provenance and checksum are in
`public/vendor/README.md`.

The provider calls `ready()` before authentication. SDK readiness is bounded
to 8 s; authentication and the home catalog request to 15 s each. A failure
shows a retry action. Late results from failed/obsolete attempts do not replace
the current state. Missing SDK does not create a guest. Retry reloads the page
and restarts sign-in. A reload also releases the Next.js client action queue,
which could otherwise keep a retry behind a stalled server action. These client
deadlines do not cancel a server action already running.

## Checks

- Normal Telegram launch: native ready event precedes authentication response.
- Block all requests to telegram.org: local SDK and app still load.
- Delay the local SDK: React hydrates; after 8 s a retry action appears.
- Hold sign-in: ready is sent, then a recoverable error after 15 s.
- Hold catalog: recoverable catalog error after 15 s.
- Repeat after a failure: later responses cannot restore stale state.
- Check on a real phone after deployment on Wi-Fi and mobile data.

## Deploy

```sh
bash /opt/polnoch-stories/deploy/hostkey.sh update
```

No bot setup or Cloudflare change is required. This updates only the existing
Polnoch Compose project. Check `/api/health` and then reopen the Mini App.

If Telegram still never displays the page, check DNS/TLS/reachability to
stories.77.91.112.63.nip.io from the affected network. The application cannot
render an error before its own HTML/JavaScript reaches the device. The Bot API
Cloudflare relay handles bot messages; it does not proxy this Mini App URL.
