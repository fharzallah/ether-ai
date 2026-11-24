// Rendu des deux pages à la compilation : un seul gabarit (src/template.html),
// un dictionnaire par langue (src/i18n/*.json). Tout le texte arrive dans le
// HTML servi, jamais injecté plus tard par JavaScript.
//
// Syntaxe du gabarit :
//   {{ clé.chemin }}  texte échappé, lu dans le dictionnaire de la langue
//   {{ $.nom }}       valeur calculée (adresses, liens)
//   {{> nom }}        fragment HTML brut (logo, icône, script de tête)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logoSvg } from '../src/lib/logo.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const LANGS = ['fr', 'en'];
export const REPO_URL = 'https://github.com/fharzallah/ether-ai';
// URL du brief, avec la graisse de Fraunces élargie à 200 : l'animation des titres part de 200.
export const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,200..700,0..100,0..1&family=Geist:wght@400;500&family=Syne:wght@700&display=swap';

const DEV_DEFAULTS = {
  VITE_APP_URL: 'https://ton-instance.example',
  VITE_SITE_URL: 'http://localhost:5173',
};

export function loadDict(lang) {
  return JSON.parse(readFileSync(`${ROOT}src/i18n/${lang}.json`, 'utf8'));
}

function cleanUrl(value, name, isBuild) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) {
    if (isBuild) {
      throw new Error(`${name} manquant : copie landing/.env.example vers landing/.env.local et renseigne-le.`);
    }
    return DEV_DEFAULTS[name];
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} n'est pas une adresse valide : ${raw}`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) throw new Error(`${name} doit commencer par https:// (${raw})`);
  return raw;
}

/** Adresses dérivées des variables d'environnement. */
export function resolveLinks(env, { isBuild = false } = {}) {
  const appUrl = cleanUrl(env.VITE_APP_URL, 'VITE_APP_URL', isBuild);
  const siteUrl = cleanUrl(env.VITE_SITE_URL, 'VITE_SITE_URL', isBuild);
  const code = String(env.VITE_INVITE_CODE || '').trim();
  const cta = code ? `${appUrl}/?code=${encodeURIComponent(code)}` : `${appUrl}/`;
  return { appUrl, siteUrl, cta };
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ESC[c]);

// Typographie, sans toucher aux mots : apostrophe typographique, et espaces
// insécables là où une coupure de ligne serait fautive.
export function typeset(text, lang) {
  let s = text.replace(/'/g, '’').replace(/(\d) (?=\p{L})/gu, '$1 ');
  if (lang === 'fr') {
    s = s
      .replace(/ ([?!;])/g, ' $1')
      .replace(/ :/g, ' :')
      .replace(/« /g, '« ')
      .replace(/ »/g, ' »');
  }
  return s;
}

function lookup(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const HEAD_SCRIPT =
  "(function(d){var h=d.documentElement;h.className='js';var f=d.getElementById('fonts');if(!f)return;var on=function(){f.media='all'};if(f.sheet)on();else f.addEventListener('load',on)})(document)";

const MENU_ICON =
  '<svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9h16M4 15h16"/></svg>';

export function renderPage(lang, env, { isBuild = false } = {}) {
  if (!LANGS.includes(lang)) throw new Error(`Langue inconnue : ${lang}`);
  const template = readFileSync(`${ROOT}src/template.html`, 'utf8');
  const dict = loadDict(lang);
  const { siteUrl, cta } = resolveLinks(env, { isBuild });

  const computed = {
    cta,
    repo: REPO_URL,
    licence: `${REPO_URL}/blob/main/LICENSE`,
    security: `${REPO_URL}/blob/main/SECURITY.md`,
    canonical: `${siteUrl}${dict.path}`,
    urlFr: `${siteUrl}/`,
    urlEn: `${siteUrl}/en/`,
    ogImage: `${siteUrl}/${dict.meta.ogImage}`,
    fonts: FONTS_URL,
  };
  const partials = {
    headScript: HEAD_SCRIPT,
    menuIcon: MENU_ICON,
    logoSpin: logoSvg({ animated: true, className: 'logo logo-nav' }),
    logoStatic: logoSvg({ className: 'logo logo-answer' }),
  };

  return template
    .replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`Fragment inconnu : ${name}`);
      return partials[name];
    })
    .replace(/\{\{\s*([$\w.]+)\s*\}\}/g, (_, key) => {
      const value = key.startsWith('$.') ? computed[key.slice(2)] : lookup(dict, key);
      if (typeof value !== 'string') throw new Error(`Clé absente de ${lang}.json : ${key}`);
      return escapeHtml(key.startsWith('$.') ? value : typeset(value, lang));
    });
}
