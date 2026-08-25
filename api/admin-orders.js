const SUPABASE_URL   = process.env.SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET   = process.env.ADMIN_SECRET;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check — must come before any Supabase access
  const provided = req.headers['x-admin-secret'] || '';
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const headers = {
    apikey:         SERVICE_KEY,
    Authorization:  `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (req.method === 'GET') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?select=*,order_items(*,products(model,colorway))&order=created_at.desc`,
      { headers }
    );
    if (!r.ok) return res.status(500).json({ error: 'Supabase error', detail: await r.text() });
    return res.status(200).json(await r.json());
  }

  if (req.method === 'PATCH') {
    const { order_id, status } = req.body || {};
    if (!order_id || !status) return res.status(400).json({ error: 'Missing fields' });
    const valid = ['pending', 'paid', 'confirmed', 'shipped', 'delivered'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
      method:  'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body:    JSON.stringify({ status }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Update failed', detail: await r.text() });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
