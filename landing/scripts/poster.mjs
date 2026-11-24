// Poster de secours (acte 2, fissures allumées) et images Open Graph.
//   node scripts/poster.mjs   → public/poster.webp (≤ 120 Ko), public/og-fr.jpg, public/og-en.jpg
// Démarre le serveur de développement si besoin : la scène s'y fige avec ?poster&p=0.4.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadDict, typeset, FONTS_URL } from './render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'http://localhost:5173';
const MAX = 120 * 1024;

const up = () => fetch(BASE).then((r) => r.ok, () => false);
let server = null;
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?poster&p=0.4`);
  await page.waitForSelector('.scene-canvas.is-ready', { timeout: 30000 });
  await page.waitForTimeout(2600);
  const png = (await page.screenshot({ type: 'png' })).toString('base64');

  // Encodage WebP par le navigateur, qualité réduite jusqu'à passer sous la limite.
  const webp = await page.evaluate(
    async ({ png, max }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      for (const q of [0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
        const blob = await new Promise((r) => c.toBlob(r, 'image/webp', q));
        if (blob.size <= max || q === 0.42) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let s = '';
          for (const b of bytes) s += String.fromCharCode(b);
          return { b64: btoa(s), q, size: blob.size };
        }
      }
    },
    { png, max: MAX - 2048 },
  );
  writeFileSync(`${ROOT}public/poster.webp`, Buffer.from(webp.b64, 'base64'));
  console.log(`poster.webp : ${(webp.size / 1024).toFixed(1)} Ko (qualité ${webp.q})`);

  // Image fixe de l'acte 0 : tient la place de la scène jusqu'à son démarrage.
  for (const [name, w, h, dpr] of [['desktop', 1440, 900, 1], ['mobile', 375, 667, 2]]) {
    const still = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await still.goto(`${BASE}/?poster&p=0`);
    await still.waitForSelector('.scene-canvas.is-ready', { timeout: 30000 });
    await still.waitForTimeout(2600);
    const shot = (await still.screenshot({ type: 'png' })).toString('base64');
    const out = await page.evaluate(
      async ({ png, max }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        for (const q of [0.8, 0.7, 0.6, 0.5]) {
          const blob = await new Promise((r) => c.toBlob(r, 'image/webp', q));
          if (blob.size <= max || q === 0.5) {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let s = '';
            for (const b of bytes) s += String.fromCharCode(b);
            return { b64: btoa(s), size: blob.size };
          }
        }
      },
      { png: shot, max: 40 * 1024 },
    );
    writeFileSync(`${ROOT}public/hero-${name}.webp`, Buffer.from(out.b64, 'base64'));
    console.log(`hero-${name}.webp : ${(out.size / 1024).toFixed(1)} Ko`);
    await still.close();
  }

  // Images Open Graph : le poster, le mot-symbole et le titre de la page.
  for (const lang of ['fr', 'en']) {
    const d = loadDict(lang);
    const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await og.setContent(`<!doctype html><html lang="${lang}"><head><link rel="stylesheet" href="${FONTS_URL}"><style>
      body{margin:0;width:1200px;height:630px;background:#0e0c0b url(data:image/png;base64,${png}) 78% 50%/cover no-repeat;color:#f3eee7;overflow:hidden}
      .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(14,12,11,.92) 0%,rgba(14,12,11,.7) 42%,rgba(14,12,11,0) 70%)}
      .copy{position:absolute;left:72px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center}
      .word{font:700 22px/1 Syne,sans-serif;letter-spacing:.32em;text-transform:uppercase}
      h1{margin:28px 0 0;font:340 64px/0.98 Fraunces,serif;font-variation-settings:"opsz" 144,"SOFT" 100;letter-spacing:-.02em}
    </style></head><body><div class="shade"></div><div class="copy"><div class="word">ETHER</div>
      <h1>${typeset(d.hero.title1, lang)}<br>${typeset(d.hero.title2, lang)}</h1></div></body></html>`);
    await og.evaluate(() => document.fonts.ready);
    await og.waitForTimeout(400);
    await og.screenshot({ path: `${ROOT}public/og-${lang}.jpg`, type: 'jpeg', quality: 84 });
    await og.close();
    console.log(`og-${lang}.jpg : écrite`);
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
