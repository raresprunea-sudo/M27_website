// One-time script: update all Supabase products to price = 175.00
// Run: node update-prices.js

const fs   = require('fs');
const path = require('path');

function loadEnv() {
  const raw = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env         = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  // Filter "id is not null" matches every row; required because PostgREST blocks
  // unfiltered PATCH to prevent accidental mass updates without explicit intent
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=not.is.null`, {
    method: 'PATCH',
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
    },
    body: JSON.stringify({ price: 175.00 }),
  });

  if (!res.ok) {
    console.error('Failed:', res.status, await res.text());
    process.exit(1);
  }

  const updated = await res.json();
  console.log(`Updated ${updated.length} products → price = 175.00 RON`);
}

main().catch(err => { console.error(err); process.exit(1); });
