const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pricing constants — must match checkout.html exactly
const SHIPPING_THRESHOLD = 300;
const SHIPPING_COST      = 19.99;
const ITEM_PRICE         = 175; // used for bundle-discount calculation

// Promo codes are defined server-side only. The client never decides the discount.
const PROMO_CODES = { CODE: { percent: 99, freeShipping: true } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // `amount` from the client is intentionally ignored — the server computes it.
  const { metadata, code } = req.body || {};

  // Parse cart items from metadata — the only source we accept for cart contents.
  let cartItems = [];
  if (metadata && metadata.items) {
    try { cartItems = JSON.parse(metadata.items); } catch (_) {}
  }

  const pids = cartItems.filter(i => i.pid).map(i => i.pid);
  if (pids.length === 0) {
    return res.status(400).json({ error: 'Coșul este gol.' });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(503).json({ error: 'Serviciu indisponibil. Încearcă din nou.' });
  }

  // ── Fetch authoritative prices and stock from Supabase ──────────────────────
  // This is the only source of truth for what a product costs.
  let productsRes;
  try {
    productsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=in.(${pids.join(',')})&select=id,name,price,stock_quantity`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
  } catch (fetchErr) {
    console.error('Supabase fetch error:', fetchErr.message);
    return res.status(503).json({ error: 'Nu am putut verifica prețurile. Încearcă din nou.' });
  }

  if (!productsRes.ok) {
    return res.status(503).json({ error: 'Nu am putut verifica prețurile. Încearcă din nou.' });
  }

  const products = await productsRes.json();
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  // ── Verify stock and compute subtotal from server prices ─────────────────────
  let subtotal = 0;
  let totalQty = 0;

  for (const item of cartItems) {
    if (!item.pid) continue;
    const p   = productMap[item.pid];
    const qty = item.q || item.quantity || 1;

    if (!p) {
      return res.status(409).json({ error: 'Produs negăsit. Te rugăm să actualizezi coșul.' });
    }
    if (p.stock_quantity < qty) {
      const label = (item.m && item.c) ? `${item.m} — ${item.c}` : p.name;
      return res.status(409).json({ error: `${label} este epuizat. Te rugăm să actualizezi coșul.` });
    }

    subtotal += p.price * qty;
    totalQty += qty;
  }

  // ── Compute total using the same rules as checkout.html ─────────────────────
  const bundleDiscount = Math.floor(totalQty / 2) * ITEM_PRICE * 0.5;
  const net            = subtotal - bundleDiscount;
  const shipping       = net >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  let finalAmount = net + shipping;

  // Apply promo code server-side — the validated code determines the discount,
  // not anything the caller claimed about the price.
  const promo = code ? PROMO_CODES[(code || '').trim().toUpperCase()] : null;
  if (promo) {
    const discountedNet = net * (1 - promo.percent / 100);
    const effectiveShip = promo.freeShipping ? 0 : shipping;
    finalAmount = discountedNet + effectiveShip;
  }

  const amountBani = Math.round(finalAmount * 100);

  console.error(
    '[stripe-payment] net:', net,
    '| promo:', promo ? code : 'none',
    '| finalAmount RON:', finalAmount.toFixed(4),
    '| amountBani:', amountBani
  );

  // Stripe minimum for RON is 200 bani (2.00 RON). Surface a clear error
  // instead of letting Stripe return a cryptic 500.
  if (amountBani < 200) {
    return res.status(400).json({
      error: 'Suma totală este prea mică pentru a procesa plata. Te rugăm să adaugi mai multe produse în coș.'
    });
  }

  try {
    const params = {
      amount:   amountBani, // RON → bani
      currency: 'ron',
      automatic_payment_methods: { enabled: true },
    };
    if (metadata && typeof metadata === 'object') {
      params.metadata = Object.fromEntries(
        Object.entries(metadata)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => [k, String(v).slice(0, 500)])
      );
    }
    const paymentIntent = await stripe.paymentIntents.create(params);
    return res.status(200).json({ client_secret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
