import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';

const b64 = readFileSync('/Users/raresprunea/Demo Site Claude/brand_assets/logo.png').toString('base64');

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const pngData = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await new Promise(r => img.onload = r);

  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;

  // Step 1: strip background (~#D6E8F2 = 214,232,242)
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    const dr = Math.abs(r - 214), dg = Math.abs(g - 232), db = Math.abs(b - 242);
    if (dr < 30 && dg < 30 && db < 30) {
      const dist = Math.max(dr, dg, db);
      d[i+3] = dist < 15 ? 0 : Math.round(255 * ((dist - 15) / 15));
    }
  }
  ctx.putImageData(id, 0, 0);

  // Step 2: find row occupancy — which rows have visible pixels
  const rowHasPixel = [];
  for (let y = 0; y < H; y++) {
    let has = false;
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 30) { has = true; break; }
    }
    rowHasPixel.push(has);
  }

  // Step 3: find content bands (groups of consecutive filled rows)
  const bands = [];
  let inBand = false, start = 0;
  for (let y = 0; y < H; y++) {
    if (rowHasPixel[y] && !inBand) { inBand = true; start = y; }
    else if (!rowHasPixel[y] && inBand) { bands.push([start, y - 1]); inBand = false; }
  }
  if (inBand) bands.push([start, H - 1]);

  // Pick the largest band (M27); ignore tiny artifact bands
  bands.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const [topY, botY] = bands[0];
  const cropH = botY - topY + 1;

  // Step 4: find left/right bounds of first band
  let minX = W, maxX = 0;
  for (let y = topY; y <= botY; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  const cropW = maxX - minX + 1;

  // Step 5: draw cropped region to new canvas
  const out = document.createElement('canvas');
  const pad = 8; // small padding
  out.width = cropW + pad * 2;
  out.height = cropH + pad * 2;
  const octx = out.getContext('2d');
  octx.drawImage(c, minX, topY, cropW, cropH, pad, pad, cropW, cropH);

  return { png: out.toDataURL('image/png').split(',')[1], bands };
}, b64);

writeFileSync('/Users/raresprunea/Demo Site Claude/brand_assets/logo-m27.png', Buffer.from(pngData.png, 'base64'));
console.log('Bands found:', JSON.stringify(pngData.bands));
console.log('Saved logo-m27.png');
await browser.close();
