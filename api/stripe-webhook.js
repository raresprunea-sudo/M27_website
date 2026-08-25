const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Vercel: disable body parsing so we can verify the raw signature
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function findOrCreateOrder({ customer_name, customer_email, customer_phone, delivery_type, address, total_amount, stripe_payment_id, items }) {
  const authHeaders = {
    apikey:        SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };

  // Idempotency: return existing order if already created
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?stripe_payment_id=eq.${encodeURIComponent(stripe_payment_id)}&select=id,status`,
    { headers: authHeaders }
  );
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing.length > 0) {
      console.log('Idempotent: order already exists for', stripe_payment_id);
      return existing[0];
    }
  }

  const headers = { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' };

  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer_name,
      customer_email,
      customer_phone:    customer_phone || null,
      delivery_type,
      address:           address || null,
      total_amount:      parseFloat(total_amount) || 0,
      stripe_payment_id,
      status:            'paid',
    }),
  });
  if (!orderRes.ok) throw new Error(`Supabase order error: ${await orderRes.text()}`);
  const [order] = await orderRes.json();

  const validItems = (items || []).filter(i => i.pid || i.product_id);
  if (validItems.length > 0) {
    fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
      method: 'POST',
      headers: { ...headers, Prefer: '' },
      body: JSON.stringify(
        validItems.map(i => ({
          order_id:          order.id,
          product_id:        i.pid || i.product_id,
          quantity:          i.q   || i.quantity,
          price_at_purchase: i.p   || i.price,
        }))
      ),
    }).catch(e => console.error('order_items insert error (non-fatal):', e.message));
  }

  return order;
}

async function sendConfirmationEmail({ order_id, customer_name, customer_email, delivery_type, address, items, subtotal, discount, delivery, total }) {
  const orderRef     = (order_id || '').slice(0, 8).toUpperCase();
  const firstName    = (customer_name || '').split(' ')[0];
  const deliveryLabel = delivery_type === 'locker' ? 'Locker Sameday' : 'Livrare acasă';

  const itemRows = (items || []).map(i => {
    const model    = i.model || i.m || '';
    const colorway = i.colorway || i.c || '';
    const qty      = i.quantity || i.q || 1;
    const price    = parseFloat(i.price || i.p) || 0;
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a1a">
        <strong>${model}</strong> — ${colorway}${qty > 1 ? ` <span style="color:#6d7175">×${qty}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a1a;text-align:right;white-space:nowrap">
        ${price * qty} RON
      </td>
    </tr>`;
  }).join('');

  const discountRow = parseFloat(discount) > 0 ? `<tr>
    <td style="padding:6px 0;font-size:13px;color:#2a7d44">Bundle 50% OFF</td>
    <td style="padding:6px 0;font-size:13px;color:#2a7d44;text-align:right">−${discount} RON</td>
  </tr>` : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff">
  <div style="padding:32px 40px 0;border-bottom:3px solid #1a1a1a">
    <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#b0b0b0">M27 Eyewear</p>
    <h1 style="margin:0 0 24px;font-size:28px;letter-spacing:0.12em;text-transform:uppercase;font-weight:300;color:#1a1a1a">Mulțumim!</h1>
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
      Dacă ai întrebări, ne poți scrie la <a href="mailto:contact@m27.ro" style="color:#1a1a1a">contact@m27.ro</a>
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

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'M27 Eyewear <comenzi@m27.ro>',
      to:      customer_email,
      subject: `Confirmare comandă #${orderRef} — M27 Eyewear`,
      html,
    }),
  });
  if (!emailRes.ok) console.error('Resend error:', await emailRes.text());
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  if (!sig || !WEBHOOK_SECRET) {
    console.error('Missing stripe-signature header or STRIPE_WEBHOOK_SECRET env var');
    return res.status(400).json({ error: 'Missing signature configuration' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // Only handle payment_intent.succeeded; acknowledge all others immediately
  if (event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true });
  }

  const pi   = event.data.object;
  const meta = pi.metadata || {};

  try {
    let items = [];
    try { items = JSON.parse(meta.items || '[]'); } catch (_) {}

    const order = await findOrCreateOrder({
      customer_name:     meta.customer_name    || '',
      customer_email:    meta.customer_email   || '',
      customer_phone:    meta.customer_phone   || null,
      delivery_type:     meta.delivery_type    || 'home',
      address:           meta.address          || null,
      total_amount:      meta.total_amount     || (pi.amount / 100),
      stripe_payment_id: pi.id,
      items,
    });

    // Decrement stock atomically — fire-and-forget (payment already captured)
    const stockItems = items.filter(i => i.pid).map(i => ({ pid: i.pid, q: i.q || i.quantity || 1 }));
    if (stockItems.length > 0) {
      fetch(`${SUPABASE_URL}/rest/v1/rpc/decrement_stock`, {
        method:  'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: stockItems }),
      }).catch(e => console.error('Stock decrement failed (non-fatal):', e.message));
    }

    // Send email non-fatally — a failed email must not prevent the 200 response
    await sendConfirmationEmail({
      order_id:       order.id,
      customer_name:  meta.customer_name  || '',
      customer_email: meta.customer_email || '',
      delivery_type:  meta.delivery_type  || 'home',
      address:        meta.address        || null,
      items,
      subtotal: meta.subtotal     || '0',
      discount: meta.discount     || '0',
      delivery: meta.delivery     || '0',
      total:    meta.total_amount || String(pi.amount / 100),
    }).catch(e => console.error('Email send failed (non-fatal):', e.message));

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    // Return 500 so Stripe retries
    return res.status(500).json({ error: err.message });
  }
};
