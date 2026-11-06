# Telegram fullscreen

On every Telegram launch, the app sends `ready()` first, then expands and requests
native fullscreen when the SDK reports Mini Apps 8.0+ support. It never waits for
fullscreen approval before authentication. Unsupported clients, thrown errors,
and native `fullscreenFailed` events retain the expanded window. Exiting
fullscreen does not trigger another request until the app is opened again.

Insets update on safe-area and fullscreen events. The native device inset and
Telegram content inset are added; CSS takes the maximum of this sum and the
browser safe area, avoiding counting the same device inset twice. Header/content,
fixed navigation, story CTA and chat respect these zones. Horizontal safe areas
are also applied for rotation. System close/menu buttons remain Telegram's UI.

Validation: viewport unit tests, production build and browser checks with the
official SDK and a simulated native bridge: success, old client, rejection,
already-fullscreen, safe-area changes and leaving fullscreen. Browser simulation
does not establish native iOS/Android rendering: reopen on a real phone after
deploy and check home, profile, story CTA, chat and keyboard.

Deploy only Polnoch:

```sh
bash /opt/polnoch-stories/deploy/hostkey.sh update
```

No bot setup or Cloudflare changes are needed. The commit retains the previous
startup fix (locally served Telegram SDK, bounded startup requests).
