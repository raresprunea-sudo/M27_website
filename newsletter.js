/* ─────────────────────────────────────────────────────────────────────────
   M27 — shared newsletter subscribe handler
   Included on every page that has the footer newsletter form, the same way
   cookie-consent.js is. One copy so the 14 pages can never drift apart again.

   Expects these elements (no-op if any are missing, so it's safe anywhere):
     #newsletter-input      email field
     #newsletter-btn        submit button
     #newsletter-form-wrap  wrapper hidden on success
     #newsletter-success    "Te-ai abonat ✓"            (shown only on real success)
     #newsletter-error      "A apărut o eroare…"        (shown on failure)

   Posts { email } to /api/subscribe (which sends the 5% welcome email).
   On failure it shows the error and re-enables the button — it never shows
   success for a request that did not succeed.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  function init() {
    var input    = document.getElementById('newsletter-input');
    var btn      = document.getElementById('newsletter-btn');
    var formWrap = document.getElementById('newsletter-form-wrap');
    var success  = document.getElementById('newsletter-success');
    var errEl    = document.getElementById('newsletter-error');
    if (!input || !btn || !formWrap || !success || !errEl) return; // no form on this page

    async function subscribe() {
      var email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      btn.disabled = true;
      errEl.style.display = 'none';
      try {
        var r = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email }),
        });
        if (!r.ok) throw new Error('server');
        formWrap.style.display = 'none';
        success.style.display = 'block';
      } catch (e) {
        errEl.style.display = 'block';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', subscribe);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') subscribe();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
