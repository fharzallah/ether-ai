/**
 * ETHER — Smoke Tests
 * Vérifie la structure du site web et du worker Cloudflare
 * Usage: node test/smoke.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  \x1b[32m✓\x1b[0m ' + name);
    passed++;
  } catch (e) {
    console.log('  \x1b[31m✗\x1b[0m ' + name + ' — ' + e.message);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('\n\x1b[1mETHER — Smoke Tests\x1b[0m\n');

// === 1. STRUCTURE ===
console.log('\x1b[36m1. Structure des fichiers\x1b[0m');

test('index.html existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', 'index.html')));
});

test('style.css existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', 'style.css')));
});

test('_headers (CSP) existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', '_headers')));
});

const rendererFiles = ['platform-web.js', 'core.js', 'memory.js', 'engine.js', 'ui.js', 'skill-creator.js', 'docgen.js', 'app-main.js'];
rendererFiles.forEach(f => {
  test('renderer/' + f + ' existe', () => {
    assert(fs.existsSync(path.join(__dirname, '..', 'renderer', f)));
  });
});

test('marked.min.js existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', 'marked.min.js')));
});

// === 2. SYNTAXE ===
console.log('\n\x1b[36m2. Syntaxe JavaScript\x1b[0m');

rendererFiles.map(f => 'renderer/' + f).concat(['worker/src/index.js']).forEach(f => {
  test(f + ' syntaxe valide', () => {
    try {
      execSync('node --check "' + path.join(__dirname, '..', f) + '"', { stdio: 'pipe' });
    } catch (e) {
      throw new Error('Erreur de syntaxe: ' + e.stderr.toString().trim());
    }
  });
});

// === 3. HTML ===
console.log('\n\x1b[36m3. HTML structure\x1b[0m');

test('index.html contient les script tags', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(html.includes('renderer/core.js'), 'Missing core.js');
  assert(html.includes('renderer/engine.js'), 'Missing engine.js');
  assert(html.includes('renderer/ui.js'), 'Missing ui.js');
  assert(html.includes('renderer/app-main.js'), 'Missing app-main.js');
  assert(html.includes('marked.min.js'), 'Missing marked.min.js');
  assert(html.includes('style.css'), 'Missing style.css');
});

test('platform-web.js est charge avant core.js', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const shim = html.indexOf('renderer/platform-web.js');
  assert(shim !== -1, 'Missing platform-web.js');
  assert(shim < html.indexOf('renderer/core.js'), 'platform-web.js doit preceder core.js');
});

test('index.html contient les elements critiques', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(html.includes('id="LS"'), 'Missing login screen');
  assert(html.includes('id="APP"'), 'Missing app container');
  assert(html.includes('id="MG"'), 'Missing message grid');
  assert(html.includes('id="uinp"'), 'Missing input textarea');
  assert(html.includes('id="SND"'), 'Missing send button');
  assert(html.includes('id="SM"'), 'Missing settings modal');
});

// === 4. CSS ===
console.log('\n\x1b[36m4. CSS\x1b[0m');

test('style.css contient les themes', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert(css.includes('[data-theme="dark"]'), 'Missing dark theme');
  assert(css.includes('[data-theme="light"]'), 'Missing light theme');
  assert(css.includes('[data-theme="midnight"]'), 'Missing midnight theme');
});

// === 5. MOTEUR ===
console.log('\n\x1b[36m5. Engine\x1b[0m');

test('engine.js contient ETHER_ENGINE', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'engine.js'), 'utf8');
  assert(engine.includes('ETHER_ENGINE'), 'Missing ETHER_ENGINE');
  assert(engine.includes('generateResponse'), 'Missing generateResponse');
  assert(engine.includes('getSystemPrompt'), 'Missing getSystemPrompt');
  assert(engine.includes('parseResponse'), 'Missing parseResponse');
});

test('engine.js contient les 4 providers', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'engine.js'), 'utf8');
  assert(engine.includes('GEMINI_MODELS'), 'Missing GEMINI_MODELS');
  assert(engine.includes('MISTRAL_MODELS'), 'Missing MISTRAL_MODELS');
  assert(engine.includes('CEREBRAS_MODELS'), 'Missing CEREBRAS_MODELS');
  assert(engine.includes('GROQ_MODELS'), 'Missing GROQ_MODELS');
  assert(engine.includes('OPENROUTER_MODELS'), 'Missing OPENROUTER_MODELS');
  assert(engine.includes('getSmartRoute'), 'Missing getSmartRoute');
});

// === 6. SECURITE ===
console.log('\n\x1b[36m6. Securite\x1b[0m');

// Motifs de cles reelles : Groq, Google, OpenAI/Anthropic, Tavily, Brave, Stripe live.
const KEY_PATTERNS = /gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{30,}|tvly-[A-Za-z0-9]{20,}|BSA[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{20,}/;
const shipped = ['index.html', 'worker/src/index.js'].concat(rendererFiles.map(f => 'renderer/' + f));
shipped.forEach(f => {
  test(f + ' ne contient pas de cle en clair', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const m = src.match(KEY_PATTERNS);
    assert(!m, 'Cle suspecte : ' + (m && m[0].slice(0, 8)) + '...');
  });
});

test('le worker lit les cles depuis env (secrets)', () => {
  const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
  assert(worker.includes('env.GROQ_KEY'), 'Missing env.GROQ_KEY');
  assert(worker.includes('env.JWT_SECRET'), 'Missing env.JWT_SECRET');
});

test('_headers definit une CSP stricte', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');
  assert(h.includes('Content-Security-Policy'), 'Missing CSP');
  assert(h.includes("object-src 'none'"), "Missing object-src 'none'");
  assert(h.includes("frame-ancestors 'none'"), "Missing frame-ancestors 'none'");
});

// === 6b. NON-REGRESSION ===
test('updProjs tolere l absence de #CFP (bug envoi bloque apres rechargement)', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app-main.js'), 'utf8');
  assert(/var sel=G\('CFP'\);if\(!sel\)return;/.test(app), 'Garde manquant sur #CFP');
});

test('plus aucune reference a Ollama dans le renderer', () => {
  rendererFiles.forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', f), 'utf8');
    assert(!/ollama/i.test(src), 'ollama encore present dans ' + f);
  });
});

// === 6c. COMPTES ET CLES ===
console.log('\n\x1b[36m6c. Comptes, cles perso, SSRF\x1b[0m');
const workerSrc = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
const shimSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'platform-web.js'), 'utf8');

test('les routes de compte existent et l ancienne inscription est fermee', () => {
  ['/api/auth/signup', '/api/auth/login', '/api/auth/recover'].forEach(r => assert(workerSrc.includes(r), 'Missing ' + r));
  assert(/path === '\/api\/register'\)\s*\{\s*return json\(\{ ok: false/.test(workerSrc), '/api/register doit refuser');
});

test('mots de passe haches avec PBKDF2 et sel aleatoire', () => {
  assert(workerSrc.includes("name: 'PBKDF2'"), 'PBKDF2 absent');
  assert(workerSrc.includes('crypto.getRandomValues(new Uint8Array(16))'), 'Sel aleatoire absent');
});

test('pas de coffre partage "anonyme"', () => {
  assert(!/persist:'\s*\+\s*\(\(user && user\.email\) \|\| 'anonyme'\)/.test(workerSrc), 'Coffre anonyme partage');
});

test('les jetons sont revoques par numero de version (tv)', () => {
  assert(/rec\.tv !== payload\.tv/.test(workerSrc), 'Verification tv absente');
});

test('la cle perso passe par X-Provider-Key et n est jamais stockee cote serveur', () => {
  assert(shimSrc.includes("'X-Provider-Key'"), 'Front : en-tete absent');
  assert(workerSrc.includes("request.headers.get('X-Provider-Key')"), 'Worker : en-tete non lu');
  assert(!/ETHER_KV\.put\([^)]*userKey/.test(workerSrc), 'Cle perso ecrite dans KV');
});

test('BLOCKED_HOSTS bloque les adresses internes, pas les domaines publics', () => {
  const re = eval(workerSrc.match(/const BLOCKED_HOSTS = (\/.*\/i);/)[1]);
  const host = u => new URL(u).hostname;
  ['https://127.0.0.1/', 'https://10.1.2.3/', 'https://2130706433/', 'https://192.168.1.1/',
   'https://169.254.169.254/', 'https://[::1]/', 'https://[fd00::1]/', 'https://localhost/', 'https://x.local/']
    .forEach(u => assert(re.test(host(u)), 'Devrait etre bloque : ' + u));
  ['https://api.together.xyz/', 'https://10.example.com/', 'https://8.8.8.8/']
    .forEach(u => assert(!re.test(host(u)), 'Devrait etre autorise : ' + u));
});

test('images : FLUX via /api/imagine (auth), lecture /api/img/<id> par identifiant aleatoire', () => {
  assert(workerSrc.includes("path === '/api/imagine'") && !/PUBLIC_ROUTES = \[[^\]]*imagine/.test(workerSrc), '/api/imagine doit exiger une session');
  assert(workerSrc.includes('flux-1-schnell') && workerSrc.includes('flux-2-klein'), 'Modeles FLUX absents');
  assert(/\[0-9a-f\]\{32\}/.test(workerSrc), 'Identifiant d image non contraint');
  assert(shimSrc.includes("request('/api/imagine'"), 'Front : appel /api/imagine absent');
});

test('donnees du compte : export et suppression (mot de passe exige)', () => {
  assert(workerSrc.includes("'/api/account/export'") && workerSrc.includes("'/api/account/delete'"), 'Routes absentes');
  const del = workerSrc.slice(workerSrc.indexOf('async function accountDelete'));
  assert(del.indexOf('checkSecret(rec.pw') !== -1 && del.indexOf('checkSecret(rec.pw') < del.indexOf('ETHER_KV.delete'), 'Mot de passe verifie avant suppression');
  assert(!/pw|rc/.test((workerSrc.match(/account: \{[^}]*\}/) || [''])[0]), 'L export ne doit pas contenir les secrets');
});

test('plus de plan Pro ni de Stripe', () => {
  assert(!/stripe/i.test(workerSrc), 'Stripe encore present');
  assert(/var isPro = true;/.test(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'core.js'), 'utf8')), 'isPro doit etre actif');
});

test('quota Workers AI : comptage sans double du total de flux, coupure a 95 %', () => {
  assert(workerSrc.includes('const AI_SAFETY = 9500'), 'Seuil de coupure absent');
  assert(/u\.prompt_tokens > 0 && u\.completion_tokens > 0\) total = u\.neurons/.test(workerSrc), 'Total de flux non distingue');
});

// Logique de quota extraite du worker et executee pour de vrai.
function quotaLogic() {
  const pick = re => { const m = workerSrc.match(re); assert(m, 'Introuvable : ' + re); return m[0]; };
  const src = [
    pick(/const DAILY_LIMIT = \d+;/), pick(/const DAILY_CALL_LIMIT = \d+;/), pick(/const TURN_TASK_LIMIT = \d+;/),
    pick(/function cleanTurn\(v\) \{[\s\S]*?\n\}/), pick(/function parseQuota\(raw\) \{[\s\S]*?\n\}/),
    pick(/function quotaNext\(q, turnId\) \{[\s\S]*?\n\}/)
  ].join('\n');
  return new Function(src + '\nreturn { DAILY_LIMIT, DAILY_CALL_LIMIT, TURN_TASK_LIMIT, parseQuota, quotaNext };')();
}
// Simule un client : enchaine les appels et renvoie l'etat final.
function runCalls(Q, turns, start) {
  let q = start || Q.parseQuota(null), served = 0, last = null;
  for (const turn of turns) {
    last = Q.quotaNext(q, turn);
    if (!last.ok) break;
    q = last.q; served++;
  }
  return { q, served, last };
}
const tid = i => 'tour' + String(i).padStart(8, '0');

test('quota : un tour = 1 message, ses taches internes sont gratuites', () => {
  const Q = quotaLogic();
  assert(Q.DAILY_LIMIT === 100 && Q.DAILY_CALL_LIMIT === 400 && Q.TURN_TASK_LIMIT === 12, 'Limites inattendues');
  // 100 tours, chacun : 1 message + 2 taches (resume, memoire).
  const calls = [];
  for (let i = 0; i < 100; i++) calls.push(tid(i), tid(i), tid(i));
  const r = runCalls(Q, calls);
  assert(r.served === 300 && r.q.m === 100 && r.q.t === 300, '100 messages attendus, obtenu ' + r.q.m);
  const next = Q.quotaNext(r.q, tid(100));
  assert(!next.ok && next.reason === 'messages', 'Le 101e message doit etre refuse');
});

test('quota : un client qui etiquette tout en « task » paie chaque appel comme un message', () => {
  const Q = quotaLogic();
  const src = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
  assert(!/body\.kind/.test(src), 'Le serveur ne doit plus lire d etiquette envoyee par le client');
  // Sans identifiant de tour, ou avec un nouveau tour a chaque appel : tout compte.
  const sansTour = runCalls(Q, new Array(150).fill(undefined));
  assert(sansTour.served === 100 && sansTour.last.reason === 'messages', 'Sans tour, 100 appels maximum');
  const toursNeufs = runCalls(Q, Array.from({ length: 150 }, (_, i) => tid(i)));
  assert(toursNeufs.served === 100, 'Un tour neuf par appel : 100 appels maximum');
  assert(Q.quotaNext(Q.parseQuota(null), 'x').q.turn === null, 'Identifiant invalide ignore');
});

test('quota : reutiliser toujours le meme tour ne donne que 12 taches gratuites', () => {
  const Q = quotaLogic();
  const r = runCalls(Q, new Array(500).fill(tid(1)));
  // 1 message, 12 taches gratuites, puis chaque appel compte : 100 messages au total.
  assert(r.q.m === 100 && r.served === 100 + Q.TURN_TASK_LIMIT, 'Obtenu ' + r.served + ' appels, ' + r.q.m + ' messages');
  assert(r.last.reason === 'messages', 'Doit s arreter sur la limite de messages');
});

test('quota : une reflexion approfondie (5 etapes + replis) reste sous le plafond de taches', () => {
  const Q = quotaLogic();
  // Decomposition (message), analyse avec 2 replis, critique avec 1 repli,
  // synthese avec 1 repli, resume de l'historique et extraction de memoire.
  const t = tid(7);
  const tour = [t, t, t, t, t, t, t, t, t, t, t];
  const r = runCalls(Q, tour);
  assert(r.served === tour.length && r.q.m === 1, 'Un tour de Deep Think doit couter 1 message, obtenu ' + r.q.m);
  assert(r.q.tt === tour.length - 1 && r.q.tt <= Q.TURN_TASK_LIMIT, 'Plafond de taches depasse');
});

test('quota : plafond global de 400 appels, ancien format relu sans erreur', () => {
  const Q = quotaLogic();
  const r = runCalls(Q, [tid(1)], { m: 10, t: 400, turn: tid(1), tt: 0 });
  assert(r.served === 0 && r.last.reason === 'calls', 'Le plafond global doit bloquer meme une tache');
  const legacy = Q.parseQuota('42');
  assert(legacy.m === 0 && legacy.t === 42 && legacy.turn === null && legacy.tt === 0, 'Ancien entier mal relu');
  const cur = Q.parseQuota(JSON.stringify({ m: 7, t: 20, turn: tid(3), tt: 4 }));
  assert(cur.m === 7 && cur.t === 20 && cur.turn === tid(3) && cur.tt === 4, 'Format JSON mal relu');
  assert(Q.parseQuota('pas du json').t === 0, 'Valeur illisible non toleree');
});

test('quota : une seule ecriture KV par requete, le client envoie un tour aleatoire', () => {
  const fn = workerSrc.slice(workerSrc.indexOf('async function quotaConsume'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert((body.match(/ETHER_KV\.put/g) || []).length === 1, 'Une seule ecriture KV par requete');
  assert(workerSrc.includes('quotaConsume(request, env, body.turn)'), '/api/chat doit transmettre le tour');
  assert(/turn: turn,/.test(shimSrc) && shimSrc.includes('crypto.getRandomValues(b)'), 'Le client doit envoyer un tour aleatoire');
  assert(/_turnGate\.then/.test(shimSrc), 'Les appels paralleles doivent attendre le premier appel du tour');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'ui.js'), 'utf8');
  ['function sendMsg', 'function sendDeepThink', 'function regenResponse'].forEach(f => {
    const b = ui.slice(ui.indexOf(f), ui.indexOf('\n}\n', ui.indexOf(f)));
    assert(b.includes('markUserMessage();'), f + ' doit ouvrir un tour');
  });
});

test('aucun nom personnel ni adresse d instance code en dur', () => {
  // Le nom est encode pour ne pas l'ecrire en clair dans le depot.
  const NAME = new RegExp(Buffer.from('aGljaGVt', 'base64').toString(), 'i');
  const files = ['index.html', 'README.md', 'DEPLOY.md', 'worker/src/index.js', 'worker/wrangler.toml'].concat(rendererFiles.map(f => 'renderer/' + f));
  files.forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert(!NAME.test(src), 'Nom personnel dans ' + f);
    assert(!/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i.test(src.replace(/<ton-[^>]+>/g, '')), 'Adresse d instance en dur dans ' + f);
  });
});

test('les blocs de commandes de la doc sont copiables tels quels (zsh)', () => {
  // Sur macOS, zsh ne traite pas "#" comme un commentaire en mode interactif :
  // "cp a b   # note" passe "#" et "note" a cp.
  ['README.md', 'DEPLOY.md', 'CONTRIBUTING.md'].forEach(f => {
    const md = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const blocks = md.match(/```(?:bash|sh)?\n[\s\S]*?```/g) || [];
    blocks.forEach(b => assert(!/(^|\s)#/.test(b.replace(/^```.*\n/, '').replace(/```$/, '')), 'Commentaire dans un bloc de ' + f));
  });
});

// === 6d. PWA ===
console.log('\n\x1b[36m6d. PWA (installation)\x1b[0m');
const root = f => path.join(__dirname, '..', f);

test('manifest.webmanifest est un JSON valide avec ses champs obligatoires', () => {
  const m = JSON.parse(fs.readFileSync(root('manifest.webmanifest'), 'utf8'));
  ['name', 'short_name', 'start_url', 'display', 'lang', 'theme_color', 'background_color'].forEach(k => assert(m[k], 'Champ absent : ' + k));
  assert(m.display === 'standalone', 'display doit etre standalone');
  assert(m.lang === 'fr', 'lang doit etre fr');
  assert(m.start_url === '/', 'start_url doit etre /');
  const sizes = m.icons.map(i => i.sizes);
  assert(sizes.includes('192x192') && sizes.includes('512x512'), 'Icones 192 et 512 requises');
  assert(m.icons.some(i => /maskable/.test(i.purpose || '')), 'Icone maskable absente');
});

test('les icones du manifeste et apple-touch-icon existent (vrais PNG)', () => {
  const m = JSON.parse(fs.readFileSync(root('manifest.webmanifest'), 'utf8'));
  m.icons.map(i => i.src.replace(/^\//, '')).concat(['icons/apple-touch-icon.png']).forEach(f => {
    assert(fs.existsSync(root(f)), 'Icone absente : ' + f);
    assert(fs.readFileSync(root(f)).slice(0, 4).toString('hex') === '89504e47', 'Pas un PNG : ' + f);
  });
});

test('sw.js ne met jamais /api en cache et supprime les anciens caches', () => {
  const sw = fs.readFileSync(root('sw.js'), 'utf8');
  assert(/url\.pathname\.startsWith\('\/api\/'\)\) return false/.test(sw), 'Exclusion de /api absente');
  assert(/headers\.has\('Authorization'\)\) return false/.test(sw), 'Exclusion des requetes authentifiees absente');
  assert(!/['"]\/api\//.test(sw.replace(/startsWith\('\/api\/'\)/, '')), '/api ne doit pas figurer dans la coque');
  assert(/caches\.delete/.test(sw) && /CACHE_VERSION/.test(sw), 'Cache non versionne ou jamais nettoye');
  assert(sw.includes("'/offline'") && fs.existsSync(root('offline.html')), 'Page hors-ligne absente');
  // Cloudflare redirige les URL en .html : une reponse redirigee casse la navigation.
  const shell = sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];'));
  assert(!/\.html'/.test(shell), 'La coque doit utiliser des URL canoniques (sans .html)');
});

test('index.html relie le manifeste et enregistre le service worker', () => {
  const html = fs.readFileSync(root('index.html'), 'utf8');
  assert(html.includes('rel="manifest"'), 'Lien manifeste absent');
  assert(html.includes('rel="apple-touch-icon"'), 'apple-touch-icon absent');
  assert(html.includes('name="theme-color"'), 'theme-color absent');
  assert(html.includes("serviceWorker.register('/sw.js')"), 'Enregistrement du SW absent');
});

test('build:web copie les fichiers PWA, la CSP autorise le SW sans s affaiblir', () => {
  const build = JSON.parse(fs.readFileSync(root('package.json'), 'utf8')).scripts['build:web'];
  ['sw.js', 'manifest.webmanifest', 'offline.html', 'icons'].forEach(f => assert(build.includes(f), 'build:web ne copie pas ' + f));
  const h = fs.readFileSync(root('_headers'), 'utf8');
  assert(h.includes("worker-src 'self'"), "worker-src 'self' absent");
  assert(h.includes("frame-ancestors 'none'"), "frame-ancestors 'none' absent");
  assert(/\/sw\.js\n\s+Cache-Control: no-cache/.test(h), 'sw.js ne doit pas etre mis en cache longtemps');
});

test('la doc dit que JWT_SECRET est obligatoire en local et explique comment le generer', () => {
  const ex = fs.readFileSync(root('worker/.dev.vars.example'), 'utf8');
  assert(/^JWT_SECRET=$/m.test(ex), 'JWT_SECRET doit etre present et vide dans .dev.vars.example');
  assert(/OBLIGATOIRE/.test(ex) && !/laisse tout passer/.test(ex), 'Commentaire de .dev.vars.example perime');
  ['README.md', 'DEPLOY.md'].forEach(f => {
    const md = fs.readFileSync(root(f), 'utf8');
    assert(!/vide d[ée]sactive l'authentification/.test(md), f + ' dit encore que JWT_SECRET vide desactive l auth');
    assert(md.includes('randomBytes(32)') && md.includes('worker/.dev.vars'), f + ' : commande de generation absente');
  });
});

test('aucune doc ne dit que l authentification peut etre desactivee', () => {
  ['README.md', 'DEPLOY.md', 'SECURITY.md', 'CONTRIBUTING.md', 'worker/wrangler.toml', 'worker/.dev.vars.example'].forEach(f => {
    const src = fs.readFileSync(root(f), 'utf8');
    assert(!/(auth\w*|verifyAuth)[^\n]{0,40}(d[ée]sactiv|laisse tout passer)|d[ée]sactive l'auth/i.test(src), f + ' : phrase sur une auth desactivable');
    assert(!/quotas? (ne bloquent personne|ne sont qu'indicatifs)/i.test(src), f + ' : phrase sur un KV facultatif');
  });
});

// === 7. WORKER ===
console.log('\n\x1b[36m7. Worker (backend)\x1b[0m');

test('worker/src/index.js existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', 'worker', 'src', 'index.js')));
});

test('worker contient les routes API', () => {
  const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
  assert(worker.includes('/api/health'), 'Missing /api/health');
  assert(worker.includes('/api/chat'), 'Missing /api/chat');
  assert(worker.includes('/api/providers'), 'Missing /api/providers');
  assert(worker.includes('/api/search'), 'Missing /api/search');
  assert(worker.includes('/api/persist'), 'Missing /api/persist');
});

// === 7b. AUTH : FERMETURE PAR DEFAUT (le vrai worker, execute dans Node) ===
// Le handler fetch du worker est importe tel quel et appele sans reseau :
// chaque route protegee doit repondre avant d'atteindre un fournisseur.
async function testAsync(name, fn) {
  try { await fn(); console.log('  \x1b[32m✓\x1b[0m ' + name); passed++; }
  catch (e) { console.log('  \x1b[31m✗\x1b[0m ' + name + ' — ' + e.message); failed++; }
}

// Liste blanche documentee : la modifier oblige a modifier ce test.
const EXPECTED_PUBLIC = ['/api/health', '/api/auth/signup', '/api/auth/login', '/api/auth/recover',
  '/api/verify', '/api/register', '/api/email', '/api/models', '/api/providers'];

function memoryKV(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    get: async (k, type) => { const v = m.has(k) ? m.get(k) : null; return v !== null && type === 'json' ? JSON.parse(v) : v; },
    put: async (k, v) => { m.set(k, v); },
    delete: async k => { m.delete(k); }
  };
}

function signToken(payload, secret) {
  const b64 = x => Buffer.from(x).toString('base64url');
  const data = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64(JSON.stringify(payload));
  return data + '.' + require('crypto').createHmac('sha256', secret).update(data).digest('base64url');
}

async function runAuthTests() {
  console.log('\n\x1b[36m7b. Auth : fermeture par defaut\x1b[0m');
  const src = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
  const worker = (await import('data:text/javascript,' + encodeURIComponent(src))).default;
  const ctx = { waitUntil() {} };
  const call = (p, env, headers) => worker.fetch(new Request('http://localhost' + p, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: '{}'
  }), env, ctx);
  const SECRET = 'secret-de-test-0123456789abcdef';
  const EMAIL = 'test@example.com';
  const kvWithUser = () => memoryKV({ ['user:' + EMAIL]: JSON.stringify({ email: EMAIL, name: 'Test', tv: 1 }) });

  // Routes declarees dans le routeur du worker.
  const handler = src.slice(src.indexOf('async fetch(request, env, ctx)'), src.indexOf('// === CORS ==='));
  const declared = [...new Set([...handler.matchAll(/path (?:===|\.startsWith\() ?'(\/api\/[^']+)'/g)].map(m => m[1]))];
  const pubMatch = src.match(/const PUBLIC_ROUTES = (\[[\s\S]*?\]);/);
  const publicInSrc = pubMatch ? eval(pubMatch[1].replace(/\/\/.*$/gm, '')) : [];

  await testAsync('la liste des routes publiques est exactement celle documentee', async () => {
    assert(JSON.stringify(publicInSrc.slice().sort()) === JSON.stringify(EXPECTED_PUBLIC.slice().sort()),
      'Routes publiques du worker : ' + publicInSrc.join(', '));
    assert(!/if \(!env\.JWT_SECRET\) return null/.test(src), 'Il reste une exception « dev local »');
  });

  await testAsync('toute route declaree hors liste publique refuse une requete sans jeton (401)', async () => {
    const prot = declared.filter(p => !publicInSrc.includes(p));
    assert(prot.length >= 15, 'Trop peu de routes trouvees : ' + prot.length);
    for (const p of prot) {
      const r = await call(p, { JWT_SECRET: SECRET, ETHER_KV: kvWithUser() });
      assert(r.status === 401, p + ' est publique sans etre dans la liste (HTTP ' + r.status + ')');
    }
    const r = await call('/api/route-qui-nexiste-pas-encore', { JWT_SECRET: SECRET, ETHER_KV: kvWithUser() });
    assert(r.status === 401, 'Une nouvelle route doit etre protegee par defaut (HTTP ' + r.status + ')');
  });

  const SENSITIVE = ['/api/fetch', '/api/imagine', '/api/search', '/api/persist', '/api/chat', '/api/chat/stream',
    '/api/account/export', '/api/account/delete', '/api/diag', '/api/providers/test'];

  await testAsync('sans JWT_SECRET, les routes sensibles repondent 503 et jamais 200', async () => {
    for (const p of SENSITIVE) {
      const r = await call(p, { ETHER_KV: kvWithUser() }, { Authorization: 'Bearer ' + signToken({ email: EMAIL, tv: 1 }, 'x') });
      const body = await r.json();
      assert(r.status === 503 && /JWT_SECRET absent/.test(body.error), p + ' : HTTP ' + r.status);
    }
  });

  await testAsync('sans le binding ETHER_KV, les routes sensibles repondent 503, meme avec un jeton signe', async () => {
    const tok = signToken({ email: EMAIL, tv: 1, exp: Date.now() + 60000 }, SECRET);
    for (const p of SENSITIVE) {
      const r = await call(p, { JWT_SECRET: SECRET }, { Authorization: 'Bearer ' + tok });
      assert(r.status === 503, p + ' : HTTP ' + r.status);
    }
  });

  await testAsync('jeton invalide, expire, mal signe ou revoque : 401, jamais un passage', async () => {
    const env = () => ({ JWT_SECRET: SECRET, ETHER_KV: kvWithUser() });
    const bad = {
      'jeton illisible': 'pas-un-jwt',
      'jeton expire': signToken({ email: EMAIL, tv: 1, exp: Date.now() - 1000 }, SECRET),
      'autre secret': signToken({ email: EMAIL, tv: 1, exp: Date.now() + 60000 }, 'un-autre-secret'),
      'version revoquee': signToken({ email: EMAIL, tv: 0, exp: Date.now() + 60000 }, SECRET),
      'compte inexistant': signToken({ email: 'inconnu@example.com', tv: 1, exp: Date.now() + 60000 }, SECRET)
    };
    for (const [why, tok] of Object.entries(bad)) {
      for (const p of ['/api/fetch', '/api/persist', '/api/chat']) {
        const r = await call(p, env(), { Authorization: 'Bearer ' + tok });
        assert(r.status === 401, why + ' sur ' + p + ' : HTTP ' + r.status);
      }
    }
    // Controle positif : un vrai jeton passe la garde.
    const ok = await worker.fetch(new Request('http://localhost/api/quota', {
      headers: { Authorization: 'Bearer ' + signToken({ email: EMAIL, tv: 1, exp: Date.now() + 60000 }, SECRET) }
    }), env(), ctx);
    assert(ok.status === 200, 'Un jeton valide doit passer (HTTP ' + ok.status + ')');
  });

  await testAsync('les routes publiques restent accessibles sans jeton', async () => {
    const r = await worker.fetch(new Request('http://localhost/api/health'), {}, ctx);
    assert(r.status === 200, '/api/health : HTTP ' + r.status);
    const img = await worker.fetch(new Request('http://localhost/api/img/' + '0'.repeat(32) + '.jpg'), { JWT_SECRET: SECRET, ETHER_KV: memoryKV() }, ctx);
    assert(img.status !== 401 && img.status !== 503, 'Image publique bloquee (HTTP ' + img.status + ')');
  });
}

// === 8. API TESTS (si le worker local tourne) ===
console.log('\n\x1b[36m8. API live tests\x1b[0m');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function runApiTests() {
  const health = await httpGet('http://localhost:8787/api/health');
  if (!health) {
    console.log('  \x1b[33m⊘\x1b[0m Worker local non demarre (skip API tests)');
    return;
  }

  test('Worker /api/health repond', () => {
    assert(health.status === 'ok', 'Health check failed');
  });

  const providers = await httpGet('http://localhost:8787/api/providers');
  if (providers && providers.providers) {
    test('Au moins 1 provider actif', () => {
      const ok = providers.providers.filter(p => p.ok);
      assert(ok.length > 0, 'Aucun provider actif');
    });
  }
}

runAuthTests().catch(e => {
  console.log('  \x1b[31m✗\x1b[0m tests d auth interrompus — ' + e.message);
  failed++;
}).then(runApiTests).then(() => {
  // === RESUME ===
  console.log('\n\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[1m  ' + passed + ' passed, ' + failed + ' failed\x1b[0m');
  if (failed > 0) {
    console.log('\x1b[31m  ✗ ECHEC\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\x1b[32m  ✓ TOUT EST BON\x1b[0m\n');
    process.exit(0);
  }
});
