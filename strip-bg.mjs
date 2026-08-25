import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';

const imagePath = '/Users/raresprunea/Demo Site Claude/brand_assets/logo.png';
const outPath = '/Users/raresprunea/Demo Site Claude/brand_assets/logo-transparent.png';

const imageBase64 = readFileSync(imagePath).toString('base64');

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const pngData = await page.evaluate(async (base64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + base64;
  await new Promise(r => { img.onload = r; });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = id.data;

  // Background is ~#D6E8F2 (214, 232, 242). Remove pixels close to it.
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    const dr = Math.abs(r - 214);
    const dg = Math.abs(g - 232);
    const db = Math.abs(b - 242);
    if (dr < 28 && dg < 28 && db < 28) {
      // Fade edges smoothly
      const dist = Math.max(dr, dg, db);
      d[i+3] = dist < 14 ? 0 : Math.round(255 * ((dist - 14) / 14));
    }
  }

  ctx.putImageData(id, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
}, imageBase64);

writeFileSync(outPath, Buffer.from(pngData, 'base64'));
await browser.close();
console.log('Saved logo-transparent.png');
