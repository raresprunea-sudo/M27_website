const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Pricing constants — must match checkout.html exactly
const SHIPPING_THRESHOLD = 300;
const SHIPPING_COST      = 19.99;
const ITEM_PRICE         = 175;
const PROMO_CODES        = { CODE: { percent: 99, freeShipping: true } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Origin check — stops bots that don't load the page first.
  // Not a cryptographic guarantee (any client can forge the header), but filters
  // automated abuse without adding friction to legitimate users.
  const origin  = req.headers.origin  || '';
  const referer = req.headers.referer || '';
  const source  = origin || referer;
  const allowed = source.startsWith('https://m27.ro') || source.startsWith('http://localhost');
  if (!allowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Diagnostic — remove once env var is confirmed in Vercel production scope
  console.error('[create-order] SERVICE_KEY defined:', !!SERVICE_KEY, '| length:', (SERVICE_KEY || '').length, '| SUPABASE_URL defined:', !!SUPABASE_URL);

  const {
    customer_name,
    customer_email,
    customer_phone,
    delivery_type,   // 'locker' | 'home'
    address,         // full address string
    locker_id,       // optional
    stripe_payment_id,
    items,           // [{ product_id, quantity, price }]
    subtotal,        // for confirmation email
    discount,        // for confirmation email
    promo_discount,  // for confirmation email (promo code discount)
    delivery,        // for confirmation email
    code,            // promo code — validated server-side
  } = req.body || {};

  // total_amount: for card orders this comes from the webhook (Stripe's actual charge);
  // for COD orders we recompute it below from Supabase prices — never trust the client.
  let total_amount = req.body?.total_amount;

  if (!customer_name || !customer_email || !delivery_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const headers = {
    apikey:          SERVICE_KEY,
    Authorization:   `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    Prefer:          'return=representation',
  };

  // Idempotency: if stripe_payment_id provided, check for existing order first
  if (stripe_payment_id) {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?stripe_payment_id=eq.${encodeURIComponent(stripe_payment_id)}&select=id,status`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing.length > 0) {
        return res.status(200).json({ id: existing[0].id, status: existing[0].status });
      }
    }
  }

  // 1a. For COD orders: recompute total_amount from Supabase prices and validate stock.
  //     The client-supplied total is ignored — never trust browser arithmetic.
  if (!stripe_payment_id) {
    const pids = (items || []).filter(i => i.product_id).map(i => i.product_id);

    if (pids.length === 0) {
      return res.status(400).json({ error: 'Coșul este gol.' });
    }

    let priceRes;
    try {
      // Include stock_quantity so we can validate before hitting the decrement RPC
      priceRes = await fetch(
        `${SUPABASE_URL}/rest/v1/products?id=in.(${pids.join(',')})&select=id,name,price,stock_quantity`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
    } catch (fetchErr) {
      console.error('Supabase price fetch error (COD):', fetchErr.message);
      return res.status(503).json({ error: 'Nu am putut verifica prețurile. Încearcă din nou.' });
    }

    if (!priceRes.ok) {
      return res.status(503).json({ error: 'Nu am putut verifica prețurile. Încearcă din nou.' });
    }

    const priceData = await priceRes.json();
    const productMap = {};
    priceData.forEach(p => { productMap[p.id] = p; });

    let sub = 0;
    let qty = 0;
    for (const item of (items || []).filter(i => i.product_id)) {
      const p = productMap[item.product_id];
      const itemQty = Number(item.quantity) || 1;
      console.error('[create-order] stock check | product_id:', item.product_id, '| qty requested:', itemQty, '| found:', !!p, '| stock_quantity:', p?.stock_quantity);
      if (!p) {
        return res.status(409).json({ error: 'Produs negăsit. Te rugăm să actualizezi coșul.' });
      }
      if (p.stock_quantity < itemQty) {
        return res.status(409).json({ error: `${p.name || 'Un produs'} nu mai este disponibil în cantitatea dorită.` });
      }
      sub += p.price * itemQty;
      qty += itemQty;
    }

    const bundleDiscount = Math.floor(qty / 2) * ITEM_PRICE * 0.5;
    const net            = sub - bundleDiscount;
    const ship           = net >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const promo          = code ? PROMO_CODES[(code || '').trim().toUpperCase()] : null;

    if (promo) {
      const discountedNet = net * (1 - promo.percent / 100);
      const effectiveShip = promo.freeShipping ? 0 : ship;
      total_amount = Math.max(1, discountedNet) + effectiveShip;
    } else {
      total_amount = net + ship;
    }
  }

  // Sanity check — total_amount must be positive after any recomputation.
  if (!total_amount || total_amount <= 0) {
    return res.status(400).json({ error: 'Invalid total amount' });
  }

  // 1b. For COD orders: decrement stock atomically before creating the order.
  //     Card orders are handled by the Stripe webhook after payment confirms.
  if (!stripe_payment_id) {
    const stockItems = (items || [])
      .filter(i => i.product_id)
      .map(i => ({ pid: i.product_id, q: i.quantity }));

    if (stockItems.length > 0) {
      // Body must be {"items": [...]} — PostgREST maps object keys to parameter names.
      // Sending a bare array ([...]) causes PostgREST to fail finding the function signature.
      const stockRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/decrement_stock`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: stockItems }),
      });
      if (!stockRes.ok) {
        const detail = await stockRes.text();
        console.error('[CRITICAL] create-order: stock decrement failed (COD) | customer:', customer_email, '| items:', JSON.stringify(stockItems), '| response:', detail);
        return res.status(409).json({ error: 'Unul sau mai multe produse nu mai sunt disponibile în stocul dorit.' });
      }
    }
  }

  // 2. Create order row
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer_name,
      customer_email,
      customer_phone:    customer_phone || null,
      delivery_type,
      address:           address || null,
      locker_id:         locker_id || null,
      total_amount,
      stripe_payment_id: stripe_payment_id || null,
      status:            stripe_payment_id ? 'paid' : 'pending',
    }),
  });

  if (!orderRes.ok) {
    const err = await orderRes.text();
    console.error('Supabase order error:', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }

  const [order] = await orderRes.json();

  // 3. Create order_items (only for items that have a product_id UUID)
  const validItems = (items || []).filter(i => i.product_id);
  if (validItems.length > 0) {
    const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
      method: 'POST',
      headers: { ...headers, Prefer: '' },
      body: JSON.stringify(
        validItems.map(i => ({
          order_id:          order.id,
          product_id:        i.product_id,
          quantity:          i.quantity,
          price_at_purchase: i.price,
        }))
      ),
    });

    if (!itemsRes.ok) {
      // Cannot return 500 here — order and stock decrement already committed; a client retry
      // would create a duplicate order. Log with full context so admin can fix manually.
      console.error('[CRITICAL] create-order: order_items insert failed | order_id:', order.id, '| customer:', customer_email, '| error:', await itemsRes.text(), '| items:', JSON.stringify(validItems), '— order exists but has no line items, manual fix needed');
    }
  }

  // 4. For COD orders: send confirmation email server-side (never from the browser).
  //    Card orders are emailed by stripe-webhook.js after payment_intent.succeeded.
  if (!stripe_payment_id) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl  = `${protocol}://${req.headers.host}`;
    fetch(`${baseUrl}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-admin-secret': ADMIN_SECRET || '',
      },
      body: JSON.stringify({
        order_id:       order.id,
        customer_name,
        customer_email,
        delivery_type,
        address:        address || '',
        items:          items   || [],
        subtotal:       subtotal       ?? total_amount,
        discount:       discount       ?? 0,
        promo_discount: promo_discount ?? 0,
        delivery:       delivery       ?? 0,
        total:          total_amount,
      }),
    }).catch(e => console.error('COD email error (non-fatal):', e.message));
  }

  return res.status(200).json({ id: order.id, status: order.status });
};
