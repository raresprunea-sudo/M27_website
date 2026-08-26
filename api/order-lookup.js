const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Strict UUID v4 pattern — reject anything else before it reaches Supabase
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const orderId = (req.query.order_id || '').trim();
  if (!UUID_RE.test(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/orders` +
    `?id=eq.${orderId}` +
    `&select=id,customer_name,customer_email,delivery_type,address,total_amount,status,created_at,` +
    `order_items(quantity,price_at_purchase,products(model,colorway))`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!r.ok) return res.status(500).json({ error: 'Failed to fetch order' });

  const rows = await r.json();
  if (!rows.length) return res.status(404).json({ error: 'Order not found' });

  const o = rows[0];
  return res.status(200).json({
    id:             o.id,
    customer_name:  o.customer_name  || '',
    customer_email: o.customer_email || '',
    delivery_type:  o.delivery_type  || 'home',
    address:        o.address        || '',
    total_amount:   o.total_amount,
    status:         o.status,
    items: (o.order_items || []).map(i => ({
      model:    i.products?.model    || '',
      colorway: i.products?.colorway || '',
      quantity: i.quantity,
      price:    i.price_at_purchase,
    })),
  });
};
