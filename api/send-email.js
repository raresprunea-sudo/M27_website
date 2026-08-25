const RESEND_KEY    = process.env.RESEND_API_KEY;
const ADMIN_SECRET  = process.env.ADMIN_SECRET;

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
    delivery,
    total,
  } = req.body || {};

  if (!customer_email || !order_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const orderRef = (order_id || '').slice(0, 8).toUpperCase();
  const firstName = (customer_name || '').split(' ')[0];

  const itemRows = (items || []).map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a1a">
        <strong>${i.model}</strong> — ${i.colorway}
        ${i.quantity > 1 ? `<span style="color:#6d7175"> ×${i.quantity}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a1a;text-align:right;white-space:nowrap">
        ${i.price * i.quantity} RON
      </td>
    </tr>`).join('');

  const discountRow = discount > 0 ? `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#2a7d44">Bundle 50% OFF</td>
      <td style="padding:6px 0;font-size:13px;color:#2a7d44;text-align:right">−${discount} RON</td>
    </tr>` : '';

  const deliveryLabel = delivery_type === 'locker' ? 'Locker Sameday' : 'Livrare acasă';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff">

  <div style="padding:32px 40px 0;border-bottom:3px solid #1a1a1a">
    <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#b0b0b0">M27 Eyewear</p>
    <h1 style="margin:0 0 24px;font-size:28px;letter-spacing:0.12em;text-transform:uppercase;font-weight:300;color:#1a1a1a">
      Mulțumim!
    </h1>
  </div>

  <div style="padding:32px 40px">
    <p style="margin:0 0 8px;font-size:15px;color:#1a1a1a">Bună ${firstName},</p>
    <p style="margin:0 0 28px;font-size:14px;color:#6d7175;line-height:1.6">
      Comanda ta <strong style="color:#1a1a1a">#${orderRef}</strong> a fost confirmată și va fi expediată în curând.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${itemRows}
      <tr>
        <td style="padding:10px 0;font-size:13px;color:#6d7175">Subtotal</td>
        <td style="padding:10px 0;font-size:13px;color:#6d7175;text-align:right">${subtotal} RON</td>
      </tr>
      ${discountRow}
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6d7175">${deliveryLabel}</td>
        <td style="padding:6px 0;font-size:13px;color:#6d7175;text-align:right">${delivery} RON</td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;font-size:15px;font-weight:700;color:#1a1a1a;border-top:1px solid #f0f0f0">Total</td>
        <td style="padding:14px 0 0;font-size:20px;font-weight:700;color:#1a1a1a;text-align:right;border-top:1px solid #f0f0f0">${total} RON</td>
      </tr>
    </table>

    ${address ? `<p style="font-size:13px;color:#6d7175;margin:0 0 4px"><strong style="color:#1a1a1a">Adresă livrare:</strong> ${address}</p>` : ''}

    <p style="margin:28px 0 0;font-size:12px;color:#a0a4a8;line-height:1.6">
      Dacă ai întrebări despre comandă, ne poți scrie la
      <a href="mailto:contact@m27.ro" style="color:#1a1a1a">contact@m27.ro</a>
    </p>
  </div>

  <div style="padding:20px 40px;background:#f8f8f8;border-top:1px solid #f0f0f0">
    <p style="margin:0;font-size:11px;color:#b0b0b0;letter-spacing:0.06em;text-transform:uppercase">
      M27 Eyewear · București, România · m27.ro
    </p>
  </div>

</div>
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
