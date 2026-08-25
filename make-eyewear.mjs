import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';

const b64 = readFileSync('/Users/raresprunea/Demo Site Claude/website items/m27 eyewear.png').toString('base64');

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

  // Background ~#D6E8F2 (214,232,242) → transparent
  // Text pixels (non-background) → black #1a1a1a
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    const dr = Math.abs(r - 214), dg = Math.abs(g - 232), db = Math.abs(b - 242);
    if (dr < 35 && dg < 35 && db < 35) {
      d[i+3] = 0; // transparent
    } else {
      d[i] = 26; d[i+1] = 26; d[i+2] = 26; // #1a1a1a
    }
  }
  ctx.putImageData(id, 0, 0);

  // Auto-trim transparent edges
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 2;
  const cw = maxX - minX + 1 + pad * 2;
  const ch = maxY - minY + 1 + pad * 2;
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(c, minX - pad, minY - pad, cw, ch, 0, 0, cw, ch);

  return out.toDataURL('image/png').split(',')[1];
}, b64);

writeFileSync('/Users/raresprunea/Demo Site Claude/brand_assets/m27-eyewear-black.png', Buffer.from(pngData, 'base64'));
console.log('Saved m27-eyewear-black.png');
await browser.close();
