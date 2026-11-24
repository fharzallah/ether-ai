// Captures et lecture de la console, FR et EN, ordinateur (1440×900) et
// téléphone (375×667). Démarre son propre serveur Vite si aucun ne répond.
//
//   node scripts/shots.mjs [--label etape1] [--base http://localhost:5173]
//                          [--browser chromium|webkit|firefox] [--reduced] [--no-webgl]
//                          [--sections]  (une capture par section, sinon le premier écran)
import { chromium, webkit, firefox } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = opt('base', 'http://localhost:5173');
const LABEL = opt('label', 'latest');
const BROWSER = opt('browser', 'chromium');
const OUT = `${ROOT}.screenshots/${LABEL}`;
const SECTIONS = ['top', 'problem', 'demo', 'how', 'features', 'why', 'source', 'final'];
const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: 'mobile', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: BROWSER !== 'firefox', hasTouch: true },
];
const PAGES = [
  { lang: 'fr', path: '/' },
  { lang: 'en', path: '/en/' },
];

async function up(url) {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await up(BASE)) return null;
  const child = spawn('npx', ['vite', '--port', new URL(BASE).port || '5173', '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    if (await up(BASE)) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`Le serveur ne répond pas sur ${BASE}`);
}

const engines = { chromium, webkit, firefox };

async function run() {
  mkdirSync(OUT, { recursive: true });
  const server = await ensureServer();
  const launchArgs = flag('no-webgl') && BROWSER === 'chromium' ? ['--disable-webgl', '--disable-webgl2'] : [];
  const browser = await engines[BROWSER].launch({ args: launchArgs });
  const summary = [];
  try {
    for (const vp of VIEWPORTS) {
      for (const pg of PAGES) {
        const context = await browser.newContext({
          viewport: vp.viewport,
          deviceScaleFactor: vp.deviceScaleFactor,
          isMobile: vp.isMobile,
          hasTouch: vp.hasTouch,
          reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
        });
        const page = await context.newPage();
        const errors = [];
        const warnings = [];
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
          if (m.type() === 'warning') warnings.push(m.text());
        });
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        await page.goto(BASE + pg.path, { waitUntil: 'load' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.evaluate(() => document.fonts && document.fonts.ready);
        await page.waitForTimeout(2600);

        const tag = `${pg.lang}-${vp.name}`;
        const cta = await page.evaluate(() => {
          const a = document.querySelector('.hero [data-primary-cta]');
          const r = a.getBoundingClientRect();
          return { href: a.href, visible: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0 };
        });
        await page.screenshot({ path: `${OUT}/${tag}-0-top.png` });

        if (flag('sections')) {
          for (let i = 1; i < SECTIONS.length; i++) {
            await page.evaluate((idx) => {
              const s = document.querySelectorAll('main > section')[idx];
              window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY);
            }, i);
            await page.waitForTimeout(1800);
            await page.screenshot({ path: `${OUT}/${tag}-${i}-${SECTIONS[i]}.png` });
          }
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(1800);
          await page.screenshot({ path: `${OUT}/${tag}-9-bottom.png` });
        }

        summary.push({ page: pg.lang, viewport: vp.name, ctaVisible: cta.visible, ctaHref: cta.href, errors, warnings });
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  for (const s of summary) {
    console.log(
      `${s.page}/${s.viewport}: bouton visible=${s.ctaVisible} erreurs=${s.errors.length} avertissements=${s.warnings.length}`,
    );
    for (const e of s.errors) console.log(`  ✗ ${e}`);
    for (const w of s.warnings) console.log(`  ! ${w}`);
  }
  console.log(`Captures : ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
