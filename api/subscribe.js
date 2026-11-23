const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Welcome-email HTML — mirrors the order-confirmation email: light ground, dark text,
// #7A1F01 as the only accent, table-based inline styles for Gmail / Apple Mail / Outlook.
function welcomeEmailHtml() {
  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
<body style="margin:0;padding:0;background-color:#f2f0ed;font-family:Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f2f0ed;">
  <tr><td align="center" style="padding:32px 16px 40px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;">

      <tr><td style="background-color:#7A1F01;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

      <tr><td style="padding:32px 48px 0;">
        <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7A1F01;font-weight:700;">M27 Eyewear</p>
      </td></tr>

      <tr><td style="padding:20px 48px 24px;">
        <h1 style="margin:0 0 14px;font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:-0.02em;line-height:1.2;">Bun venit la M27</h1>
        <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.65;">Mulțumim că te-ai abonat. Ca început, ai <strong>5% reducere</strong> la prima ta comandă.</p>
      </td></tr>

      <tr><td style="padding:0 48px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="background-color:#f9f6f4;border:1px dashed #7A1F01;padding:24px;text-align:center;">
            <p style="margin:0;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a0a4a8;font-weight:700;">Codul tău</p>
            <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#7A1F01;letter-spacing:0.14em;">WELCOME5</p>
            <p style="margin:8px 0 0;font-size:13px;color:#6d7175;">−5% la prima comandă</p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:28px 48px 4px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background-color:#7A1F01;" align="center">
            <a href="https://m27.ro/collection.html" style="display:inline-block;padding:15px 40px;font-size:14px;font-weight:700;letter-spacing:0.04em;color:#ffffff;text-decoration:none;">Vezi colecția</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:22px 48px 0;">
        <p style="margin:0;font-size:13px;color:#6d7175;line-height:1.65;">Introdu codul la finalizarea comenzii. Valabil la prima comandă.</p>
      </td></tr>

      <tr><td style="padding:28px 48px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid #ece8e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

      <tr><td style="padding:24px 48px 36px;">
        <p style="margin:0;font-size:13px;color:#6d7175;line-height:1.65;">Ai întrebări? Scrie-ne la <a href="mailto:contact@m27.ro" style="color:#7A1F01;text-decoration:none;font-weight:600;">contact@m27.ro</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Fire-and-return welcome email. A failure here must NEVER fail the subscription:
// it is logged as [CRITICAL] with the recipient and swallowed.
async function sendWelcomeEmail(to) {
  if (!RESEND_KEY) {
    console.error('[CRITICAL] subscribe: RESEND_API_KEY missing | recipient:', to, '— welcome email NOT sent');
    return;
  }
  try {
    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'M27 Eyewear <comenzi@m27.ro>',
        to,
        subject: 'Bun venit la M27 — 5% la prima comandă',
        html:    welcomeEmailHtml(),
      }),
    });
    if (!mailRes.ok) {
      const detail = await mailRes.text().catch(() => '(unreadable)');
      console.error('[CRITICAL] subscribe: welcome email failed | recipient:', to, '| HTTP', mailRes.status, '|', detail);
    }
  } catch (err) {
    console.error('[CRITICAL] subscribe: welcome email error | recipient:', to, '|', err.message);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { email, source } = req.body || {};

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const emailTo = email.trim().toLowerCase();

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        // ON CONFLICT DO NOTHING — duplicate emails return 200, not an error
        Prefer:        'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email:  emailTo,
        source: source || 'footer',
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Supabase subscribe error:', r.status, detail);
      return res.status(500).json({ error: 'Could not save subscription' });
    }

    // Send the welcome email on every successful subscribe — including returning
    // subscribers (ignore-duplicates means we can't distinguish them, and a returning
    // subscriber should never be left with nothing). sendWelcomeEmail never throws,
    // so a mail failure is logged [CRITICAL] but the subscription still returns success.
    await sendWelcomeEmail(emailTo);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe handler error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
