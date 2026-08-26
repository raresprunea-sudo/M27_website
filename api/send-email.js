const RESEND_KEY    = process.env.RESEND_API_KEY;
const ADMIN_SECRET  = process.env.ADMIN_SECRET;

function formatRON(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Server-side callers only — reject browser requests
  const provided = req.headers['x-admin-secret'] || '';
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    order_id,
    customer_name,
    customer_email,
    delivery_type,
    address,
    items,
    subtotal,
    discount,
    promo_discount,
    delivery,
    total,
  } = req.body || {};

  if (!customer_email || !order_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const orderRef  = (order_id || '').slice(0, 8).toUpperCase();
  const firstName = (customer_name || '').split(' ')[0];

  const itemRows = (items || []).map(i => {
    const qty    = i.quantity || 1;
    const qtyTag = qty > 1 ? `<span style="color:#a0a4a8;font-size:13px;"> \xD7${qty}</span>` : '';
    return `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0ece8;font-size:14px;color:#1a1a1a;">
        <strong style="font-weight:700;">${i.model}</strong><span style="color:#6d7175;"> — ${i.colorway}</span>${qtyTag}
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #f0ece8;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">
        ${formatRON(i.price * qty)} RON
      </td>
    </tr>`;
  }).join('');

  const discountRow = discount > 0 ? `<tr>
    <td style="font-size:13px;color:#2a7d44;padding-bottom:10px;">Reducere 50% OFF</td>
    <td style="font-size:13px;color:#2a7d44;text-align:right;padding-bottom:10px;white-space:nowrap;font-variant-numeric:tabular-nums;">−${formatRON(discount)} RON</td>
  </tr>` : '';

  const promoRow = (promo_discount || 0) > 0 ? `<tr>
    <td style="font-size:13px;color:#2a7d44;padding-bottom:10px;">Cod promoțional</td>
    <td style="font-size:13px;color:#2a7d44;text-align:right;padding-bottom:10px;white-space:nowrap;font-variant-numeric:tabular-nums;">−${formatRON(promo_discount)} RON</td>
  </tr>` : '';

  const deliveryVal = (delivery || 0) > 0
    ? `<span style="color:#6d7175;font-variant-numeric:tabular-nums;">${formatRON(delivery)} RON</span>`
    : `<span style="color:#2a7d44;font-weight:600;">Gratuit</span>`;

  const addressBlock = address ? `
    <tr><td style="padding:32px 48px 0;">
      <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a0a4a8;font-weight:700;">Adresă de livrare</p>
      <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.7;">${address}</p>
    </td></tr>` : '';

  const html = `<!DOCTYPE html>
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

      <tr><td style="padding:20px 48px 28px;">
        <h1 style="margin:0 0 14px;font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:-0.02em;line-height:1.2;">Comandă confirmată</h1>
        <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.65;">Bună ${firstName}, mulțumim pentru comandă!<br>O pregătim şi o expediem cât mai curând.</p>
      </td></tr>

      <tr><td style="padding:0 48px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background-color:#f9f6f4;border:1px solid #e4ded8;padding:13px 22px;">
            <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#a0a4a8;font-weight:600;">Număr comandă</p>
            <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#7A1F01;letter-spacing:0.08em;">#${orderRef}</p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 48px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid #ece8e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

      <tr><td style="padding:28px 48px 14px;">
        <p style="margin:0;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a0a4a8;font-weight:700;">Produse comandate</p>
      </td></tr>

      <tr><td style="padding:0 48px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${itemRows}
        </table>
      </td></tr>

      <tr><td style="padding:28px 48px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9f6f4;border-top:1px solid #e4ded8;border-bottom:1px solid #e4ded8;">
          <tr><td style="padding:22px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-size:13px;color:#6d7175;padding-bottom:10px;">Subtotal</td>
                <td style="font-size:13px;color:#6d7175;text-align:right;padding-bottom:10px;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatRON(subtotal)} RON</td>
              </tr>
              ${discountRow}
              ${promoRow}
              <tr>
                <td style="font-size:13px;color:#6d7175;padding-bottom:20px;">Livrare</td>
                <td style="text-align:right;padding-bottom:20px;white-space:nowrap;">${deliveryVal}</td>
              </tr>
              <tr><td colspan="2" style="border-top:1px solid #ddd8d2;font-size:0;line-height:0;padding-bottom:0;">&nbsp;</td></tr>
              <tr>
                <td style="font-size:15px;font-weight:700;color:#1a1a1a;padding-top:18px;">Total</td>
                <td style="font-size:22px;font-weight:700;color:#1a1a1a;text-align:right;padding-top:14px;white-space:nowrap;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;">${formatRON(total)} RON</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      ${addressBlock}

      <tr><td style="padding:32px 48px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid #ece8e3;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

      <tr><td style="padding:24px 48px 36px;">
        <p style="margin:0;font-size:13px;color:#6d7175;line-height:1.65;">Ai întrebări despre comandă? Scrie-ne la <a href="mailto:contact@m27.ro" style="color:#7A1F01;text-decoration:none;font-weight:600;">contact@m27.ro</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'M27 Eyewear <comenzi@m27.ro>',
        to:      customer_email,
        subject: `Confirmare comandă #${orderRef} — M27 Eyewear`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
