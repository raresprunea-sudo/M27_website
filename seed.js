const fs = require('fs');
const path = require('path');

// Parse .env.local manually (no dotenv dependency needed)
function loadEnv() {
  const raw = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ── PRODUCT DATA ─────────────────────────────────────────────────────────────

function makeProducts(model, colorways) {
  return colorways.map(colorway => ({
    name: model,
    model,
    colorway,
    price: 175.00,
    stock_quantity: 10,
    active: true,
    image_url: '',
  }));
}

const products = [
  ...makeProducts('Sulphur',   ['Full Black', 'Dark Green', 'Lime', 'Sky Blue']),
  ...makeProducts('Zirconium', ['Sky Blue', 'Full Black', 'Tiger', 'Tangerine', 'Bronze', 'Rose']),
  ...makeProducts('Cuprum',    ['Rose', 'Tangerine', 'Lime', 'Sky Blue', 'Kiwi']),
  ...makeProducts('Mercury',   ['Dark Purple', 'Black Yellow', 'Navy']),
  ...makeProducts('Titanium',  ['Panda', 'Tiger', 'Black']),
  ...makeProducts('Chlorine',  ['Tangerine', 'Lime', 'Sky Blue', 'Rose', 'Olive']),
  ...makeProducts('Palladium', ['Full Black', 'Volcano', 'Mustard', 'Dark Green', 'Champagne']),
  ...makeProducts('Selenium',  ['Full Black', 'Purple', 'Fig', 'Tiger']),
];

// ── INSERT ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${products.length} products into Supabase...`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(products),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Insert failed (${res.status}):`, err);
    process.exit(1);
  }

  const inserted = await res.json();
  console.log(`✓ ${inserted.length} rows inserted successfully.`);

  // Print summary by model
  const summary = {};
  for (const p of inserted) {
    summary[p.name] = (summary[p.name] || 0) + 1;
  }
  console.log('\nBreakdown:');
  for (const [model, count] of Object.entries(summary)) {
    console.log(`  ${model}: ${count} colorways`);
  }
}

seed().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
