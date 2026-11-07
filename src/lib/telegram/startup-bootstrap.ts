/**
 * Tiny independent native handshake and recovery UI. Async data: script is
 * delivered with HTML and can execute even if stylesheets / app chunks stall.
 * Transport matches the pinned official Telegram SDK's WebView.postEvent.
 */
export const STARTUP_BOOTSTRAP = String.raw`(function () {
  if (window.__polnochBoot) return;
  var state = window.__polnochBoot = { hydrated: window.__polnochHydrated === true, assetFailed: false };
  var interactive = /^(\/$|\/story\/|\/play\/|\/profile(?:\/|$)|\/admin(?:\/|$))/.test(location.pathname);
  var watchdog;
  var startedAt = Date.now();
  var launchId = startedAt.toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  var reported = {};
  function report(phase) {
    if (reported[phase] || !interactive) return;
    reported[phase] = true;
    try {
      if (typeof window.fetch === 'function') window.fetch('/api/startup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', keepalive: true,
        body: JSON.stringify({ id: launchId, phase: phase, elapsed: Date.now() - startedAt,
          bridge: !!(window.TelegramWebviewProxy && window.TelegramWebviewProxy.postEvent) })
      }).catch(function () {});
    } catch (_) {}
  }
  report('document');
  if (state.hydrated) report('hydrated');
  function reloadFresh() {
    try {
      var url = new URL(location.href);
      url.searchParams.set('_pl_boot', String(Date.now()));
      location.replace(url.toString());
    } catch (_) { location.reload(); }
  }
  function ready() {
    try {
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.ready) {
        window.Telegram.WebApp.ready();
        report('ready');
      } else if (window.TelegramWebviewProxy && window.TelegramWebviewProxy.postEvent) {
        window.TelegramWebviewProxy.postEvent('web_app_ready', JSON.stringify(''));
        report('ready');
      } else if (window.external && typeof window.external.notify === 'function') {
        window.external.notify(JSON.stringify({ eventType: 'web_app_ready', eventData: '' }));
      } else if (window.parent !== window) {
        window.parent.postMessage(JSON.stringify({ eventType: 'web_app_ready', eventData: '' }), 'https://web.telegram.org');
      }
    } catch (_) {}
  }
  function showRecovery(text, attempt) {
    if (state.hydrated || !interactive) return;
    var box = document.getElementById('polnoch-startup-recovery');
    if (!box) {
      if ((attempt || 0) < 40) setTimeout(function () { showRecovery(text, (attempt || 0) + 1); }, 100);
      return;
    }
    document.getElementById('polnoch-startup-message').textContent = text;
    var button = document.getElementById('polnoch-startup-retry');
    if (!button.__polnochBound) {
      button.__polnochBound = true;
      button.addEventListener('click', reloadFresh);
    }
    box.hidden = false;
    report('recovery');
    ready();
  }
  function retryAssetOnce() {
    if (state.hydrated || !interactive || document.visibilityState === 'hidden' || /^\/admin(?:\/|$)/.test(location.pathname)) return;
    try {
      var now = Date.now();
      var previous = Number(sessionStorage.getItem('pl_boot_reload') || 0);
      if (previous && now - previous < 60000) return;
      sessionStorage.setItem('pl_boot_reload', String(now));
      reloadFresh();
    } catch (_) { /* No storage: manual retry, never an unbounded reload loop. */ }
  }
  window.addEventListener('polnoch:hydrated', function () {
    state.hydrated = true;
    report('hydrated');
    clearTimeout(watchdog);
    var box = document.getElementById('polnoch-startup-recovery');
    if (box) box.hidden = true;
  });
  window.addEventListener('error', function (event) {
    var target = event.target;
    var chunk = target && target.tagName === 'SCRIPT' && typeof target.src === 'string' && target.src.indexOf('/_next/static/') !== -1;
    if (state.hydrated || (!chunk && !/ChunkLoadError|Loading chunk .*failed/.test(event.message || ''))) return;
    state.assetFailed = true;
    showRecovery('Не удалось загрузить файлы приложения. Нажмите «Повторить».');
    setTimeout(retryAssetOnce, 400);
  }, true);
  window.addEventListener('polnoch:native-viewport', function () { report('viewport'); });
  window.addEventListener('pageshow', ready);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') ready(); });
  ready();
  [250, 1000, 3000].forEach(function (delay) { setTimeout(ready, delay); });
  watchdog = setTimeout(function () {
    showRecovery('Приложение пока не запустилось. Проверьте соединение и нажмите «Повторить».');
  }, 12000);
})();`;

export const STARTUP_BOOTSTRAP_SRC = `data:application/javascript;base64,${Buffer.from(STARTUP_BOOTSTRAP).toString("base64")}`;
