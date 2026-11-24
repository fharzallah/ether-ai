// Garde-fous de la page d'accueil (npm test dans landing/).
// 1. Aucun fichier suivi par git ne contient d'adresse *.workers.dev, de nom
//    personnel ni de clé d'API (même règle que test/smoke.js à la racine).
// 2. Les deux dictionnaires ont les mêmes clés, aucune vide, toutes utilisées.
// 3. Chaque page rendue contient tous ses textes, ses liens hreflang réciproques
//    et un bouton « Essayer ETHER » construit à partir des variables d'environnement.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LANGS, loadDict, renderPage, typeset } from './render.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let failed = 0;
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name} : ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- 1. Contenu des fichiers commités -------------------------------------

// Le nom est encodé pour ne pas l'écrire en clair, comme dans test/smoke.js.
const NAME = new RegExp(Buffer.from('aGljaGVt', 'base64').toString(), 'i');
const WORKERS = /[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i;
const KEYS = /gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{30,}|tvly-[A-Za-z0-9]{20,}|BSA[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{20,}/;
const TEXT = /\.(m?js|json|html|css|md|txt|svg|example|gitignore)$/;

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '.'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => TEXT.test(f) || f.endsWith('.env.example'));

test(`${tracked.length} fichiers suivis : ni workers.dev, ni nom personnel, ni clé`, () => {
  for (const f of tracked) {
    const src = readFileSync(`${ROOT}${f}`, 'utf8');
    assert(!WORKERS.test(src), `adresse workers.dev dans ${f}`);
    assert(!NAME.test(src), `nom personnel dans ${f}`);
    assert(!KEYS.test(src), `clé d'API dans ${f}`);
  }
});

test('.env.local n’est pas suivi par git', () => {
  assert(!tracked.some((f) => /(^|\/)\.env\.local$/.test(f)), '.env.local est suivi');
});

// --- 2. Dictionnaires --------------------------------------------------------

const dicts = Object.fromEntries(LANGS.map((l) => [l, loadDict(l)]));
const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

test('FR et EN ont exactement les mêmes clés', () => {
  const fr = flat(dicts.fr).map(([k]) => k).sort();
  const en = flat(dicts.en).map(([k]) => k).sort();
  assert(JSON.stringify(fr) === JSON.stringify(en), `clés différentes : ${fr.filter((k) => !en.includes(k)).concat(en.filter((k) => !fr.includes(k)))}`);
});

test('aucun texte vide', () => {
  for (const l of LANGS) for (const [k, v] of flat(dicts[l])) assert(String(v).trim(), `${l}.${k} est vide`);
});

const template = readFileSync(`${ROOT}src/template.html`, 'utf8');
const INTERNAL = new Set(['lang', 'locale', 'path', 'alt.path', 'meta.ogImage']);
test('chaque clé du dictionnaire est utilisée par le gabarit', () => {
  for (const [k] of flat(dicts.fr)) {
    if (INTERNAL.has(k)) continue;
    assert(template.includes(`{{ ${k} }}`), `clé inutilisée : ${k}`);
  }
});

// --- 3. Pages rendues --------------------------------------------------------

const ENV = { VITE_APP_URL: 'https://ton-instance.example/', VITE_INVITE_CODE: 'CODE', VITE_SITE_URL: 'https://ton-site.example' };
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');

for (const lang of LANGS) {
  const html = renderPage(lang, ENV, { isBuild: true });
  const text = decode(html);

  test(`${lang} : tous les textes sont dans le HTML servi`, () => {
    for (const [k, v] of flat(dicts[lang])) {
      if (INTERNAL.has(k) || k.startsWith('ids.') || k.startsWith('alt.')) continue;
      assert(text.includes(typeset(v, lang)), `texte absent : ${k}`);
    }
    assert(!/\{\{|\}\}/.test(html), 'balise de gabarit non remplacée');
  });

  test(`${lang} : lang, title, description, Open Graph, canonical`, () => {
    assert(html.includes(`<html lang="${lang}"`), 'attribut lang');
    assert(/<title>[^<]+<\/title>/.test(html), 'title');
    assert(/<meta name="description" content="[^"]+">/.test(html), 'description');
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url', 'og:locale']) assert(html.includes(`property="${p}"`), p);
    assert(html.includes(`<link rel="canonical" href="https://ton-site.example${dicts[lang].path}">`), 'canonical');
  });

  test(`${lang} : hreflang réciproques et lien de langue réel`, () => {
    assert(html.includes('<link rel="alternate" hreflang="fr" href="https://ton-site.example/">'), 'hreflang fr');
    assert(html.includes('<link rel="alternate" hreflang="en" href="https://ton-site.example/en/">'), 'hreflang en');
    assert(html.includes(`href="${dicts[lang].alt.path}" hreflang="${dicts[lang].alt.lang}"`), 'lien vers l’autre langue');
  });

  test(`${lang} : le bouton principal mène à l'app avec le code`, () => {
    const links = [...html.matchAll(/<a class="btn btn-primary[^"]*" href="([^"]+)"/g)].map((m) => decode(m[1]));
    assert(links.length >= 3, `${links.length} boutons principaux`);
    for (const href of links) assert(href === 'https://ton-instance.example/?code=CODE', `lien inattendu : ${href}`);
  });
}

test('sans code d’invitation, le bouton mène à la racine de l’app', () => {
  const html = renderPage('fr', { ...ENV, VITE_INVITE_CODE: '' }, { isBuild: true });
  assert(html.includes('href="https://ton-instance.example/" data-primary-cta'), 'lien sans code');
});

test('la compilation refuse une adresse d’app absente', () => {
  let threw = false;
  try {
    renderPage('fr', { VITE_SITE_URL: 'https://ton-site.example' }, { isBuild: true });
  } catch {
    threw = true;
  }
  assert(threw, 'aucune erreur');
});

// --- 4. Fichiers produits (si la scène et le poster existent déjà) ----------

const limits = [
  ['public/shards-desktop.glb', 350 * 1024],
  ['public/shards-mobile.glb', 150 * 1024],
  ['public/poster.webp', 120 * 1024],
];
for (const [file, max] of limits) {
  if (!existsSync(`${ROOT}${file}`)) continue;
  test(`${file} pèse moins de ${max / 1024} Ko`, () => {
    const size = readFileSync(`${ROOT}${file}`).length;
    assert(size <= max, `${(size / 1024).toFixed(1)} Ko`);
  });
}

console.log(`\n  ${passed} réussis, ${failed} en échec`);
process.exit(failed ? 1 : 0);
