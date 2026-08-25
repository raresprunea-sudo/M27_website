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

  // Background is ~#D6E8F2 (214, 232, 242)
  // Text pixels are ~#7B2910 (reddish-brown)
  // → make bg transparent, recolor text to baby blue #D6E8F2
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    const dr = Math.abs(r - 214), dg = Math.abs(g - 232), db = Math.abs(b - 242);
    if (dr < 35 && dg < 35 && db < 35) {
      // Background pixel → transparent
      d[i+3] = 0;
    } else {
      // Text pixel → recolor to baby blue
      d[i]   = 214; // R
      d[i+1] = 232; // G
      d[i+2] = 242; // B
      // keep alpha as-is (255)
    }
  }
  ctx.putImageData(id, 0, 0);

  // Find the "LIFE IS A MOVIE" band — rows 603–626 in 1040px image
  // Scan to find the actual bounds of that lower text band
  const rowHasPixel = [];
  for (let y = 0; y < H; y++) {
    let has = false;
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 30) { has = true; break; }
    }
    rowHasPixel.push(has);
  }

  const bands = [];
  let inBand = false, start = 0;
  for (let y = 0; y < H; y++) {
    if (rowHasPixel[y] && !inBand)  { inBand = true; start = y; }
    else if (!rowHasPixel[y] && inBand) { bands.push([start, y - 1]); inBand = false; }
  }
  if (inBand) bands.push([start, H - 1]);

  // Second largest band = "LIFE IS A MOVIE"
  bands.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const [topY, botY] = bands[1]; // second largest

  // Find horizontal bounds
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
  const cropH = botY - topY + 1;
  const pad = 4;
  const out = document.createElement('canvas');
  out.width = cropW + pad * 2;
  out.height = cropH + pad * 2;
  out.getContext('2d').drawImage(c, minX, topY, cropW, cropH, pad, pad, cropW, cropH);

  return { png: out.toDataURL('image/png').split(',')[1], band: bands[1] };
}, b64);

writeFileSync('/Users/raresprunea/Demo Site Claude/brand_assets/tagline.png', Buffer.from(pngData.png, 'base64'));
console.log('Tagline band:', pngData.band, '→ saved tagline.png');
await browser.close();
