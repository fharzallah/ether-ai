// Audit de la page (serveur de développement : les crochets __ether y sont exposés).
//   node scripts/audit.mjs   → .reports/audit.json
// Accessibilité (axe, WCAG 2.2 AA), clavier et focus visible, mouvement réduit,
// sans WebGL, scroll réel (alignement des actes, images par seconde) et lien
// entre les fissures du prisme et les objections de la démo.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'http://localhost:5173';
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const report = {};
let failures = 0;
const note = (key, value, ok = true) => {
  report[key] = value;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${key} : ${typeof value === 'string' ? value : JSON.stringify(value)}`);
};

const up = () => fetch(BASE).then((r) => r.ok, () => false);
let server = null;
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
}

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

// Fait défiler toute la page pour déclencher l'apparition de chaque titre.
async function revealAll(page) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y <= h; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
  });
  await page.waitForTimeout(2600);
}

const browser = await chromium.launch({ args: GPU });
try {
  // 1. axe, FR et EN, ordinateur et téléphone.
  for (const lang of ['fr', 'en']) {
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext(vp);
      const page = await ctx.newPage();
      await page.goto(`${BASE}${lang === 'fr' ? '/' : '/en/'}`);
      await page.waitForLoadState('networkidle');
      await revealAll(page);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const v = res.violations.map((x) => `${x.id} ×${x.nodes.length}: ${x.nodes[0]?.target.join(' ')}`);
      note(`axe ${lang}/${name}`, v.length ? v : 'aucune violation', v.length === 0);
      await ctx.close();
    }
  }

  // 2. Clavier : ordre de tabulation et anneau de focus visible.
  {
    const ctx = await browser.newContext(VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    const seq = [];
    let invisible = 0;
    for (let i = 0; i < 34; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const a = document.activeElement;
        const cs = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        return {
          label: `${a.tagName.toLowerCase()}:${(a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32)}`,
          ring: cs.outlineStyle === 'solid' && cs.outlineColor === 'rgb(255, 116, 102)' && cs.outlineWidth === '2px',
          shown: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden',
        };
      });
      seq.push(f.label);
      // Après le dernier lien, le focus quitte la page (barre d'adresse) : body n'est pas un arrêt.
      if (f.label.startsWith('body:')) continue;
      if (!f.ring || !f.shown) invisible++;
    }
    note('clavier : premier élément', seq[0], seq[0].includes('Aller au contenu'));
    note('clavier : focus visible sur chaque arrêt', invisible === 0 ? '34/34' : `${invisible} arrêts sans anneau`, invisible === 0);
    report.keyboardOrder = seq;
    await ctx.close();
  }

  // 3. Mouvement réduit : poster, textes finaux, ni Lenis ni lettres découpées.
  {
    const ctx = await browser.newContext({ ...VIEWPORTS.desktop, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const s = await page.evaluate(() => ({
      canvas: !!document.querySelector('.scene-canvas'),
      poster: getComputedStyle(document.querySelector('.scene-poster')).display,
      split: document.querySelectorAll('.is-split').length,
      lenis: document.documentElement.classList.contains('lenis'),
      h1: getComputedStyle(document.querySelector('.h1')).opacity,
    }));
    note('mouvement réduit', s, !s.canvas && s.poster === 'block' && s.split === 0 && !s.lenis && s.h1 === '1');
    await ctx.close();
  }

  // 4. Sans WebGL : le poster remplace la scène, la page reste complète.
  {
    const noGl = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2'] });
    const page = await noGl.newPage(VIEWPORTS.desktop);
    const errors = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const s = await page.evaluate(() => ({
      fallback: document.documentElement.classList.contains('scene-fallback'),
      poster: getComputedStyle(document.querySelector('.scene-poster')).display,
      canvas: !!document.querySelector('.scene-canvas.is-ready'),
    }));
    note('sans WebGL', { ...s, console: errors.length }, s.fallback && s.poster === 'block' && !s.canvas && errors.length === 0);
    await noGl.close();
  }

  // 5. Scroll réel à la molette : alignement des actes et images par seconde.
  {
    const ctx = await browser.newContext(VIEWPORTS.desktop);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
    await page.goto(`${BASE}/`);
    await page.waitForSelector('.scene-canvas.is-ready', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const progressAtSection = async (index) => {
      await page.evaluate((i) => {
        const s = document.querySelectorAll('main > section')[i];
        window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2);
      }, index);
      await page.waitForTimeout(2600);
      return page.evaluate(() => +window.__ether.debug.state.sceneProgress.toFixed(3));
    };
    const expected = [0.12, 0.28, 0.44, 0.66, 0.8, 0.9];
    const acts = [];
    for (let i = 1; i <= 6; i++) acts.push({ section: i, expected: expected[i - 1], got: await progressAtSection(i) });
    const aligned = acts.every((a) => Math.abs(a.got - a.expected) < 0.02);
    note('actes alignés sur les sections (descente)', acts.map((a) => `${a.expected}→${a.got}`), aligned);
    const back = await progressAtSection(1);
    note('remontée : retour à l’acte 1', back, Math.abs(back - 0.12) < 0.02);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      window.__frames = [];
      const tick = (t) => {
        window.__frames.push(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.waitForTimeout(1500);
    await page.mouse.move(720, 450);
    const H = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y < H; y += 120) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(1500);
    const fps = await page.evaluate(() => {
      const f = window.__frames;
      const d = [];
      for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
      const sorted = d.slice().sort((a, b) => a - b);
      return {
        fps: +(1000 / ((f[f.length - 1] - f[0]) / (f.length - 1))).toFixed(1),
        p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
        over20ms: d.filter((x) => x > 20).length,
        frames: f.length,
        end: +window.__ether.debug.state.sceneProgress.toFixed(3),
      };
    });
    note('scroll molette (Chromium sans affichage, GPU Metal)', fps, fps.end > 0.98);
    note('console pendant le scroll', errors.length ? errors.slice(0, 3) : 'vide', errors.length === 0);
    await ctx.close();
  }

  // 6. Fissures ↔ objections (acte 2).
  {
    const ctx = await browser.newContext(VIEWPORTS.desktop);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?p=0.4`);
    await page.waitForSelector('.scene-canvas.is-ready', { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('[data-objection="1"]').scrollIntoView({ block: 'center' }));
    await page.hover('[data-objection="1"]');
    await page.waitForTimeout(450);
    const levels = await page.evaluate(() => window.__ether.debug.cracks.material.uniforms.uLevel.value.toArray().map((v) => +v.toFixed(2)));
    note('survol objection 2 → fissure 2 (3 → 6)', levels, levels[1] > 5.9 && levels[0] < 3.1 && levels[2] < 3.1);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(450);
    const linked = [];
    for (let k = 0; k < 3; k++) {
      const pt = await page.evaluate((i) => {
        const d = window.__ether.debug;
        const hit = d.cracks.hits[i];
        const pos = hit.geometry.attributes.position;
        // Centre du segment du milieu : moyenne de ses quatre coins.
        const first = Math.floor(pos.count / 8) * 4;
        const v = hit.position.clone().set(0, 0, 0);
        const c = v.clone();
        for (let k = 0; k < 4; k++) v.add(c.fromBufferAttribute(pos, first + k));
        v.multiplyScalar(0.25).applyMatrix4(hit.matrixWorld).project(d.camera);
        return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
      }, k);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForTimeout(350);
      linked.push(await page.evaluate(() => [...document.querySelectorAll('[data-objection]')].findIndex((li) => li.classList.contains('is-linked'))));
    }
    note('survol fissure k → objection k', linked, linked.join() === '0,1,2');
    await ctx.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

mkdirSync(`${ROOT}.reports`, { recursive: true });
writeFileSync(`${ROOT}.reports/audit.json`, JSON.stringify(report, null, 2));
console.log(`\n${failures ? `${failures} point(s) à corriger` : 'Tout est bon'} — rapport : .reports/audit.json`);
process.exit(failures ? 1 : 0);
