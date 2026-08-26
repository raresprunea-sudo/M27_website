const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const ADMIN_EMAIL = 'm27office1@gmail.com';

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

function formatRON(v) {
  return Number(v).toFixed(2).replace('.', ',');
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
    // Awaited so failures surface before returning 200. Cannot throw here — Stripe retry
    // would skip order_items re-insert (idempotency returns early) and not fix the problem.
    // A [CRITICAL] log triggers a manual fix; the order record itself is safe.
    const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
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
    });
    if (!itemsRes.ok) {
      console.error('[CRITICAL] stripe-webhook: order_items insert failed | order_id:', order.id, '| error:', await itemsRes.text(), '| items:', JSON.stringify(validItems), '— order exists, payment captured, manual line-item fix needed');
    }
  }

  return order;
}

async function sendAdminNotificationEmail({ order_id, customer_name, customer_email, delivery_type, items, total }) {
  const orderRef     = (order_id || '').slice(0, 8).toUpperCase();
  const deliveryLabel = delivery_type === 'locker' ? 'Easybox' : 'Acasă';
  const itemsSummary  = (items || []).map(i => {
    const qty      = i.q || i.quantity || 1;
    const model    = i.model    || i.m || '?';
    const colorway = i.colorway || i.c || '';
    return `${qty}× ${model}${colorway ? ` (${colorway})` : ''}`;
  }).join(', ') || '—';

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'M27 Eyewear <comenzi@m27.ro>',
      to:      ADMIN_EMAIL,
      subject: `Comandă nouă #${orderRef} — ${formatRON(total)} RON`,
      html: `<p style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#222;">
        <strong>#${orderRef}</strong><br>
        Client: ${customer_name} &lt;${customer_email}&gt;<br>
        Produse: ${itemsSummary}<br>
        Total: <strong>${formatRON(total)} RON</strong><br>
        Livrare: ${deliveryLabel} &nbsp;|&nbsp; Plată: Card
      </p>`,
    }),
  });
  if (!emailRes.ok) console.error('Admin email (Resend) error:', await emailRes.text());
}

async function sendConfirmationEmail({ order_id, customer_name, customer_email, delivery_type, address, items, subtotal, discount, promo_discount, delivery, total }) {
  const orderRef  = (order_id || '').slice(0, 8).toUpperCase();
  const firstName = (customer_name || '').split(' ')[0];

  const itemRows = (items || []).map(i => {
    const model    = i.model || i.m || '';
    const colorway = i.colorway || i.c || '';
    const qty      = i.quantity || i.q || 1;
    const price    = parseFloat(i.price || i.p) || 0;
    const qtyTag   = qty > 1 ? `<span style="color:#a0a4a8;font-size:13px;"> \xD7${qty}</span>` : '';
    return `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0ece8;font-size:14px;color:#1a1a1a;">
        <strong style="font-weight:700;">${model}</strong><span style="color:#6d7175;"> — ${colorway}</span>${qtyTag}
      </td>
      <td style="padding:14px 0;border-bottom:1px solid #f0ece8;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">
        ${formatRON(price * qty)} RON
      </td>
    </tr>`;
  }).join('');

  const discountRow = parseFloat(discount) > 0 ? `<tr>
    <td style="font-size:13px;color:#2a7d44;padding-bottom:10px;">Reducere 50% OFF</td>
    <td style="font-size:13px;color:#2a7d44;text-align:right;padding-bottom:10px;white-space:nowrap;font-variant-numeric:tabular-nums;">−${formatRON(discount)} RON</td>
  </tr>` : '';

  const promoRow = parseFloat(promo_discount || 0) > 0 ? `<tr>
    <td style="font-size:13px;color:#2a7d44;padding-bottom:10px;">Cod promoțional</td>
    <td style="font-size:13px;color:#2a7d44;text-align:right;padding-bottom:10px;white-space:nowrap;font-variant-numeric:tabular-nums;">−${formatRON(promo_discount)} RON</td>
  </tr>` : '';

  const deliveryVal = parseFloat(delivery || 0) > 0
    ? `<span style="color:#6d7175;font-variant-numeric:tabular-nums;">${formatRON(delivery)} RON</span>`
    : `<span style="color:#2a7d44;font-weight:600;">Gratuit</span>`;

  const addressBlock = address ? `
    <tr>
      <td style="padding:32px 48px 0;">
        <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a0a4a8;font-weight:700;">Adresă de livrare</p>
        <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.7;">${address}</p>
      </td>
    </tr>` : '';

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
  if (!emailRes.ok) {
    const detail = await emailRes.text().catch(() => '(unreadable)');
    console.error('[CRITICAL] stripe-webhook: customer email failed | order_id:', order_id, '| recipient:', customer_email, '| HTTP', emailRes.status, '|', detail);
  }
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

  // Diagnostic — remove once env var is confirmed in Vercel production scope
  console.error('[stripe-webhook] SERVICE_KEY defined:', !!SERVICE_KEY, '| length:', (SERVICE_KEY || '').length, '| SUPABASE_URL defined:', !!SUPABASE_URL);

  // Only handle payment_intent.succeeded; acknowledge all others immediately
  if (event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true });
  }

  const pi   = event.data.object;
  const meta = pi.metadata || {};

  function reassembleItems(meta) {
    let combined = '';
    for (let i = 0; ; i++) {
      const chunk = meta['items_' + i];
      if (chunk === undefined) break;
      combined += chunk;
    }
    if (combined) { try { return JSON.parse(combined); } catch (_) {} }
    if (meta.items) { try { return JSON.parse(meta.items); } catch (_) {} }
    return [];
  }

  try {
    const items = reassembleItems(meta);

    const order = await findOrCreateOrder({
      customer_name:     meta.customer_name    || '',
      customer_email:    meta.customer_email   || '',
      customer_phone:    meta.customer_phone   || null,
      delivery_type:     meta.delivery_type    || 'home',
      address:           meta.address          || null,
      total_amount:      pi.amount / 100,      // actual Stripe charge, not client-claimed metadata
      stripe_payment_id: pi.id,
      items,
    });

    // Decrement stock atomically. Fatal — throws so the outer catch returns 500 and Stripe retries.
    // The findOrCreateOrder idempotency check means retries are safe (order won't be duplicated).
    const stockItems = items.filter(i => i.pid).map(i => ({ pid: i.pid, q: i.q || i.quantity || 1 }));
    if (stockItems.length > 0) {
      const stockRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/decrement_stock`, {
        method:  'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: stockItems }),
      });
      if (!stockRes.ok) {
        const detail = await stockRes.text();
        console.error('[CRITICAL] stripe-webhook: stock decrement failed | order_id:', order.id, '| pi_id:', pi.id, '| items:', JSON.stringify(stockItems), '| response:', detail);
        throw new Error(`Stock decrement failed for order ${order.id}: ${detail}`);
      }
    }

    // Send emails non-fatally — failures must not prevent the 200 response
    await sendConfirmationEmail({
      order_id:       order.id,
      customer_name:  meta.customer_name  || '',
      customer_email: meta.customer_email || '',
      delivery_type:  meta.delivery_type  || 'home',
      address:        meta.address        || null,
      items,
      subtotal:       meta.subtotal       || '0',
      discount:       meta.discount       || '0',
      promo_discount: meta.promo_discount || '0',
      delivery:       meta.delivery       || '0',
      total:          pi.amount / 100,
    }).catch(e => console.error('Customer email failed (non-fatal):', e.message));

    await sendAdminNotificationEmail({
      order_id:       order.id,
      customer_name:  meta.customer_name  || '',
      customer_email: meta.customer_email || '',
      delivery_type:  meta.delivery_type  || 'home',
      items,
      total:          pi.amount / 100,
    }).catch(e => console.error('Admin email failed (non-fatal):', e.message));

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    // Return 500 so Stripe retries
    return res.status(500).json({ error: err.message });
  }
};
