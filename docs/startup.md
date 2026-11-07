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

## Independent native startup (v2)

The native ready event no longer depends on React hydration, the Telegram SDK
request or stylesheets. A small async data-URL script is included in the initial
HTML. It uses the same native ready transport as the pinned official SDK and
retries during the first three seconds, on pageshow and when the page resumes.
It sends no user data and makes no external request. The async data URL is
intentional: a classic inline script may wait for a preceding stylesheet.

After 12 s without hydration, a server-rendered recovery panel appears with a
working retry button independent of React and CSS. It also appears on failed
app chunks. A failed chunk permits one automatic fresh-document retry per
minute; repeated failures stop at the recovery panel. Automatic retries are
skipped for author forms and when storage is unavailable. Retrying preserves the
launch fragment and adds a cache-busting query; nothing clears player progress.
Once the provider mounts, it hides the panel and stops startup recovery. Existing
SDK/auth/catalog timeouts remain in place. No automatic reload runs after
hydration or due to an ordinary slow catalog request.

Home's first greeting is deterministic during SSR/hydration; the local time
salutation is set after mounting. This avoids a hydration mismatch between a
statically built page and the reader's current hour/timezone.

### Diagnostics

```sh
bash /opt/polnoch-stories/deploy/hostkey.sh startup-check
```

This reports only Polnoch's source revision, Compose status, app restart/OOM
state, local health, public HTML/health timing and same-origin JS/CSS responses.
It does not print env files, bot tokens, cookies or database contents, and does
not restart containers or nginx. The HTTP checker is also standalone:

```sh
python3 scripts/check-startup.py --url https://stories.77.91.112.63.nip.io
```

A successful check from a server or our workspace does not prove reachability
from the phone. DNS/TLS/first-HTML failures cannot be recovered by code that the
device has not yet received. If the native Telegram splash remains after this
change, compare the diagnostic output and the same URL from the phone's network.

The launch document (`/`) is rendered dynamically with Next.js no-store headers,
so future launches do not reuse a long-lived static HTML document that references
chunks from an older deployment. JS/CSS assets keep their normal immutable cache.

Validation of v2: 17 targeted startup/viewport/deadline tests, type checking,
production build and shell syntax checks. Browser probes with the official SDK
and a simulated native bridge cover normal launch in another timezone, held app
JS, held CSS, both held, missing chunks (one retry only), held SDK, a late bridge,
late hydration recovery without reload and a separately held page bundle.
The prior build sent zero native ready events when app JS was held and produced
a React hydration mismatch for the static greeting in a different timezone.
The new launch response has no-store headers, normal startup has no hydration
errors, and the diagnostic checker correctly fails for a missing JS asset.
No test sent messages to real Telegram recipients. Native device confirmation
and actual VPS container restart/OOM history require the server-side check.

## Per-launch diagnostic events

The independent bootstrap now posts four bounded, best-effort phases to
`/api/startup`: document, ready (SDK/bridge call returned, not a native ACK),
hydrated, recovery. An ephemeral random launch ID correlates these events in
app logs. Only ID, phase, elapsed milliseconds and bridge presence are logged;
no initData, Telegram ID, token, URL, conversation or persistent device ID.
Requests omit cookies. Failure to report never blocks startup. The endpoint
limits request size and rate and discards all unknown fields.

After reproducing a failed launch, inspect only this app's log:

```sh
bash /opt/polnoch-stories/deploy/hostkey.sh startup-events
```

A ready event proves an attempted call, not that Telegram
hid its native loader. Missing events alone cannot distinguish no document
from a failed reporting request. Safari health success does not establish
that Telegram's WebView received HTML or the same network route.

## Native viewport acknowledgement before fullscreen

A phone report on 2026-11-07 correlated a failed final launch with document,
ready and hydration in 60 ms. These events establish page execution; they do
not establish native receipt of ready or successful rendering of the window.

Automatic fullscreen now waits for a native `viewportChanged` round trip and
300 ms before requesting the next transition. Listeners are installed before
expand and an explicit `web_app_request_viewport` probe. With no response the
app stays in expanded mode, without a speculative fullscreen transition. Cleanup
cancels a pending transition. Only one fullscreen request is allowed; user exits
are respected. Startup/ready and sign-in never wait for the viewport reply.
The diagnostic `viewport` phase records receipt of a native event, unlike ready,
which records an outbound call. Existing phase logging remains best-effort.

This is a mitigation for overlapping native transitions, not a confirmed root
cause or proof that the iOS placeholder issue has been eliminated. Native
confirmation requires repeated phone launches after deployment. Telegram's
current source has a native trust check before handling web_app_ready and
separate native window transitions:
https://github.com/TelegramMessenger/Telegram-iOS/blob/master/submodules/WebUI/Sources/WebAppController.swift

## Late bootstrap after hydration

A sustained gameplay check reproduced a separate race: the async bootstrap
could subscribe after the provider had already dispatched its one-shot hydrated
event. The page worked, but after 12 seconds the recovery panel obscured it.
Six consecutive browser probes reproduced this ordering.

The provider now sets a page-local `__polnochHydrated` flag before dispatching
the event. A late bootstrap reads it on initialization, records hydration and
does not show recovery. A regression test starts the bootstrap after hydration
and advances its watchdog beyond 12 seconds. This fixes the false recovery panel;
it does not establish the cause of Telegram's separate native placeholder issue.
