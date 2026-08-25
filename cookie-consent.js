/* M27 Eyewear — Cookie Consent
 * Fires GA4 (G-5XVHKD724K) and Meta Pixel (1647139999722921)
 * only after explicit user consent. GDPR / ANSPDCP compliant.
 *
 * To re-prompt visitors when the policy changes: bump VER.
 * To reopen the panel from anywhere: call window.m27OpenCookieSettings()
 */
(function () {
  'use strict';

  var GA_ID = 'G-5XVHKD724K';
  var FB_ID = '1647139999722921';
  var STORE = 'm27_cookie_consent';
  var VER   = 1;

  /* ── LocalStorage ─────────────────────────────────────────────────────── */

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch (_) { return null; }
  }

  function save(prefs) {
    localStorage.setItem(STORE, JSON.stringify({
      v: VER,
      analytics: !!prefs.analytics,
      marketing: !!prefs.marketing,
    }));
  }

  /* ── Script injection ─────────────────────────────────────────────────── */

  function loadGA() {
    if (window.__m27_ga) return;
    window.__m27_ga = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function loadFB() {
    if (window.__m27_fb) return;
    window.__m27_fb = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', FB_ID);
    window.fbq('track', 'PageView');
  }

  function applyConsent(prefs) {
    if (prefs.analytics) loadGA();
    if (prefs.marketing) loadFB();
  }

  /* ── Banner ───────────────────────────────────────────────────────────── */

  var bannerEl = null;

  var CSS = [
    /* Container */
    '#m27cc{position:fixed;bottom:24px;right:24px;z-index:2147483647;width:344px;',
    'opacity:0;transform:translateY(10px);transition:opacity .3s ease,transform .3s ease;',
    'pointer-events:none;box-sizing:border-box}',
    '#m27cc.m27cc-in{opacity:1;transform:none;pointer-events:auto}',
    /* Card */
    '.m27cc-card{background:#fff;border-radius:16px;',
    'box-shadow:0 2px 8px rgba(0,0,0,.06),0 12px 40px rgba(0,0,0,.10);',
    'padding:20px 22px 18px;color:#1a1a1a;line-height:1.55;',
    'font-family:system-ui,-apple-system,Helvetica,sans-serif}',
    /* Text */
    '.m27cc-text{margin:0 0 14px;font-size:14px;color:#1a1a1a;line-height:1.55;font-weight:400}',
    '.m27cc-link{color:#1a1a1a;text-decoration:underline;text-underline-offset:2px;',
    'text-decoration-color:rgba(26,26,26,.4)}',
    '.m27cc-link:hover{text-decoration-color:#1a1a1a}',
    /* Button row */
    '.m27cc-row{display:flex;gap:6px;align-items:center;flex-wrap:nowrap}',
    /* Accept — outlined, matches reference */
    '.m27cc-ok{background:transparent;color:#1a1a1a;border:1.5px solid rgba(26,26,26,.55);',
    'border-radius:8px;padding:7px 16px;font-family:inherit;font-size:13.5px;font-weight:500;',
    'cursor:pointer;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;',
    'letter-spacing:0;text-transform:none}',
    '.m27cc-ok:hover{background:#1a1a1a;color:#fff;border-color:#1a1a1a}',
    /* Opt out — plain text medium */
    '.m27cc-mute{background:none;border:none;color:#444;font-family:inherit;',
    'font-size:13.5px;font-weight:400;cursor:pointer;padding:7px 8px;',
    'transition:color .15s;letter-spacing:0;text-transform:none;white-space:nowrap}',
    '.m27cc-mute:hover{color:#1a1a1a}',
    /* Privacy settings — muted */
    '.m27cc-tiny{background:none;border:none;color:#a0a0a0;font-family:inherit;',
    'font-size:13px;font-weight:400;cursor:pointer;padding:7px 4px;',
    'transition:color .15s;letter-spacing:0;text-transform:none;white-space:nowrap}',
    '.m27cc-tiny:hover{color:#555}',
    /* Settings panel */
    '.m27cc-stitle{margin:0 0 12px;font-size:12px;font-weight:600;',
    'letter-spacing:.08em;text-transform:uppercase;color:#1a1a1a}',
    '.m27cc-trow{display:flex;align-items:center;justify-content:space-between;',
    'padding:10px 0;border-bottom:1px solid #f0f0f0}',
    '.m27cc-tinfo{display:flex;flex-direction:column;gap:2px}',
    '.m27cc-tlbl{font-size:13px;font-weight:500;color:#1a1a1a}',
    '.m27cc-tdsc{font-size:11px;color:#999}',
    '.m27cc-fixed{font-size:11px;font-weight:500;color:#b0b0b0}',
    /* Toggle */
    '.m27cc-sw{position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0}',
    '.m27cc-sw input{opacity:0;width:0;height:0;position:absolute}',
    '.m27cc-trk{position:absolute;inset:0;background:#d8d8d8;border-radius:22px;cursor:pointer;transition:background .2s}',
    '.m27cc-trk::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;',
    'border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.18)}',
    '.m27cc-sw input:checked+.m27cc-trk{background:#1a1a1a}',
    '.m27cc-sw input:checked+.m27cc-trk::after{transform:translateX(16px)}',
    /* iPad (601–1024 px) */
    '@media(min-width:601px) and (max-width:1024px){#m27cc{bottom:20px;right:20px;width:320px}}',
    /* Mobile (≤600 px) — compact, stays bottom-right */
    '@media(max-width:600px){#m27cc{bottom:14px;right:14px;left:auto;width:288px}}',
    '@media(max-width:600px){.m27cc-card{padding:16px 18px 14px}}',
    '@media(max-width:600px){.m27cc-text{font-size:13px;margin-bottom:12px}}',
    '@media(max-width:600px){.m27cc-ok,.m27cc-mute,.m27cc-tiny{font-size:13px}}',
  ].join('');

  var HTML = [
    '<div class="m27cc-card">',
    /* Simple pane */
    '<div id="m27cc-s">',
    '<p class="m27cc-text">Folosim cookie-uri pentru a colecta date și a îmbunătăți serviciile. <a href="/privacy.html" class="m27cc-link">Află mai mult</a></p>',
    '<div class="m27cc-row">',
    '<button id="m27cc-a" class="m27cc-ok">Acceptă</button>',
    '<button id="m27cc-r" class="m27cc-mute">Refuză</button>',
    '<button id="m27cc-o" class="m27cc-tiny">Setări cookies</button>',
    '</div>',
    '</div>',
    /* Settings pane */
    '<div id="m27cc-p" style="display:none">',
    '<p class="m27cc-stitle">Setări cookie-uri</p>',
    '<div class="m27cc-trow">',
    '<div class="m27cc-tinfo">',
    '<span class="m27cc-tlbl">Necesare</span>',
    '<span class="m27cc-tdsc">Coș de cumpărături, sesiune</span>',
    '</div><span class="m27cc-fixed">Mereu activ</span>',
    '</div>',
    '<div class="m27cc-trow">',
    '<div class="m27cc-tinfo">',
    '<span class="m27cc-tlbl">Analytics</span>',
    '<span class="m27cc-tdsc">Google Analytics 4</span>',
    '</div>',
    '<label class="m27cc-sw"><input type="checkbox" id="m27cc-ca" checked><span class="m27cc-trk"></span></label>',
    '</div>',
    '<div class="m27cc-trow">',
    '<div class="m27cc-tinfo">',
    '<span class="m27cc-tlbl">Marketing</span>',
    '<span class="m27cc-tdsc">Meta Pixel</span>',
    '</div>',
    '<label class="m27cc-sw"><input type="checkbox" id="m27cc-cm" checked><span class="m27cc-trk"></span></label>',
    '</div>',
    '<div class="m27cc-row" style="margin-top:16px;gap:12px">',
    '<button id="m27cc-sv" class="m27cc-ok">Salvează preferințele</button>',
    '<button id="m27cc-b" class="m27cc-tiny">← Înapoi</button>',
    '</div>',
    '</div>',
    '</div>',
  ].join('');

  function injectCSS() {
    if (document.getElementById('m27cc-css')) return;
    var s = document.createElement('style');
    s.id = 'm27cc-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function bindEvents() {
    var paneS = document.getElementById('m27cc-s');
    var paneP = document.getElementById('m27cc-p');
    var chkA  = document.getElementById('m27cc-ca');
    var chkM  = document.getElementById('m27cc-cm');

    document.getElementById('m27cc-a').onclick = function () {
      save({ analytics: true, marketing: true });
      dismiss();
      applyConsent({ analytics: true, marketing: true });
    };
    document.getElementById('m27cc-r').onclick = function () {
      save({ analytics: false, marketing: false });
      dismiss();
    };
    document.getElementById('m27cc-o').onclick = function () {
      paneS.style.display = 'none';
      paneP.style.display = '';
    };
    document.getElementById('m27cc-b').onclick = function () {
      paneP.style.display = 'none';
      paneS.style.display = '';
    };
    document.getElementById('m27cc-sv').onclick = function () {
      var prefs = { analytics: chkA.checked, marketing: chkM.checked };
      save(prefs);
      dismiss();
      applyConsent(prefs);
    };
  }

  function createBanner(stored, openSettings) {
    if (bannerEl) return;
    injectCSS();

    var el = document.createElement('div');
    el.id = 'm27cc';
    el.innerHTML = HTML;
    document.body.appendChild(el);
    bannerEl = el;

    if (stored) {
      document.getElementById('m27cc-ca').checked = !!stored.analytics;
      document.getElementById('m27cc-cm').checked = !!stored.marketing;
    }

    bindEvents();

    if (openSettings) {
      document.getElementById('m27cc-s').style.display = 'none';
      document.getElementById('m27cc-p').style.display = '';
      el.classList.add('m27cc-in');
    } else {
      /* Fade in 1 s after page load so it doesn't fight the hero */
      setTimeout(function () {
        if (bannerEl) bannerEl.classList.add('m27cc-in');
      }, 1000);
    }
  }

  function dismiss() {
    if (!bannerEl) return;
    bannerEl.classList.remove('m27cc-in');
    var el = bannerEl;
    bannerEl = null;
    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 400);
  }

  /* ── Public API ───────────────────────────────────────────────────────── */

  window.m27OpenCookieSettings = function () {
    if (bannerEl) return; /* already open */
    createBanner(load(), true);
  };

  /* ── Bootstrap ────────────────────────────────────────────────────────── */

  function init() {
    var stored = load();
    if (!stored || stored.v !== VER) {
      createBanner(null, false);
    } else {
      applyConsent(stored);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
