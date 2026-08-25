/**
 * screenshot.mjs — Puppeteer screenshot utility
 * Usage: node screenshot.mjs [url] [label]
 *   url   — defaults to http://localhost:3000
 *   label — optional suffix: screenshot-N-label.png
 *
 * Saves to ./temporary screenshots/screenshot-N[-label].png
 * Auto-increments N so no file is ever overwritten.
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, 'temporary screenshots');

const [,, url = 'http://localhost:3000', label] = process.argv;

// Ensure output directory exists
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function nextFilename(label) {
  let n = 1;
  while (true) {
    const name = label
      ? `screenshot-${n}-${label}.png`
      : `screenshot-${n}.png`;
    if (!fs.existsSync(path.join(SCREENSHOTS_DIR, name))) return name;
    n++;
  }
}

const filename = nextFilename(label);
const outputPath = path.join(SCREENSHOTS_DIR, filename);

console.log(`Launching browser → ${url}`);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
});

const page = await browser.newPage();

// 1440×900 @ 2x for crisp retina output
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await new Promise(r => setTimeout(r, 1500));

// Wait for web fonts
await page.evaluateHandle('document.fonts.ready');

// Let scroll animations and transitions settle
await new Promise(r => setTimeout(r, 900));

await page.screenshot({ path: outputPath, fullPage: false });
await browser.close();

console.log(`Saved → ${outputPath}`);
