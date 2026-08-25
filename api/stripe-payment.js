const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROMO_CODES = { CODE: { percent: 99 } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, metadata, code } = req.body || {};
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Stock guard: verify availability before creating a PaymentIntent
  if (metadata && metadata.items && SUPABASE_URL && SERVICE_KEY) {
    let cartItems = [];
    try { cartItems = JSON.parse(metadata.items); } catch (_) {}

    const pids = cartItems.filter(i => i.pid).map(i => i.pid);
    if (pids.length > 0) {
      try {
        const stockRes = await fetch(
          `${SUPABASE_URL}/rest/v1/products?id=in.(${pids.join(',')})&select=id,name,stock_quantity`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        if (stockRes.ok) {
          const stocks = await stockRes.json();
          const stockMap = {};
          stocks.forEach(s => { stockMap[s.id] = { qty: s.stock_quantity, name: s.name }; });

          for (const item of cartItems) {
            if (!item.pid) continue;
            const info  = stockMap[item.pid];
            const avail = info ? info.qty : 0;
            if (avail < (item.q || 1)) {
              const label = (item.m && item.c) ? `${item.m} — ${item.c}` : (info ? info.name : 'Produs');
              return res.status(409).json({ error: `${label} este epuizat. Te rugăm să actualizezi coșul.` });
            }
          }
        }
      } catch (stockErr) {
        // Non-fatal: if Supabase is unreachable, proceed (best-effort guard)
        console.error('Stock check error (non-fatal):', stockErr.message);
      }
    }
  }

  // Apply promo code discount server-side
  let finalAmount = amount;
  if (code) {
    const promo = PROMO_CODES[(code || '').trim().toUpperCase()];
    if (promo) {
      finalAmount = Math.max(1, amount * (1 - promo.percent / 100));
    }
  }

  try {
    const params = {
      amount: Math.round(finalAmount * 100), // RON → bani
      currency: 'ron',
      automatic_payment_methods: { enabled: true },
    };
    if (metadata && typeof metadata === 'object') {
      // Stripe metadata: string values only, max 500 chars each
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
