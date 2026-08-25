const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET   = process.env.ADMIN_SECRET;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!ADMIN_PASSWORD || !ADMIN_SECRET) {
    console.error('ADMIN_PASSWORD or ADMIN_SECRET env var not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Missing password' });
  }

  // Constant-time comparison to prevent timing attacks
  let match = false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(ADMIN_PASSWORD);
    match = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    match = false;
  }

  if (!match) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  return res.status(200).json({ secret: ADMIN_SECRET });
};
