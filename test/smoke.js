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

const rendererFiles = ['platform-web.js', 'core.js', 'memory.js', 'engine.js', 'ui.js', 'skill-creator.js', 'docgen.js', 'docread.js', 'app-main.js'];
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

// === 5b. PIECES JOINTES ===
console.log('\n\x1b[36m5b. Pièces jointes\x1b[0m');

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app-main.js'), 'utf8');

// Extrait une fonction de premier niveau d'app-main.js (elle se termine par "\n}\n").
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert(start !== -1, name + ' introuvable');
  return src.slice(start, src.indexOf('\n}\n', start) + 2);
}
function loadStagedFileState() {
  const exts = appSrc.match(/var TEXT_EXTS = \[[^\]]*\];/);
  assert(exts, 'TEXT_EXTS introuvable');
  return new Function(exts[0] + '\n' + extractFn(appSrc, 'stagedFileState') + '\nreturn stagedFileState;')();
}

test('un fichier sans texte n\'est jamais annoncé comme "[Fichier joint]"', () => {
  assert(!appSrc.includes('[Fichier joint:'), 'processStagedFiles envoie encore "[Fichier joint: ...]"');
});

test('stagedFileState refuse les fichiers sans texte lisible', () => {
  const state = loadStagedFileState();
  const pdf = state({ name: 'a.pdf', ext: 'pdf', content: null });
  assert(!pdf.ok && /PDF/.test(pdf.error), 'Un PDF non lu doit être en erreur : ' + JSON.stringify(pdf));
  const empty = state({ name: 'a.txt', ext: 'txt', content: '   ' });
  assert(!empty.ok && empty.error, 'Un txt vide doit être en erreur');
  const reading = state({ name: 'a.txt', ext: 'txt', content: null, reading: true });
  assert(!reading.ok && reading.reading, 'Un txt en cours de lecture doit bloquer');
  const failed = state({ name: 'a.txt', ext: 'txt', content: null, readError: 'Lecture impossible.' });
  assert(!failed.ok && failed.error === 'Lecture impossible.', 'Une erreur de lecture doit remonter');
  const unknown = state({ name: 'a', ext: '', content: null });
  assert(!unknown.ok && unknown.error, 'Un type inconnu doit être en erreur');
});

test('stagedFileState accepte le texte lu et les images', () => {
  const state = loadStagedFileState();
  assert(state({ name: 'a.txt', ext: 'txt', content: 'Bonjour' }).ok, 'Un txt lu doit partir');
  assert(state({ name: 'a.pdf', ext: 'pdf', content: null, desktopFile: { content: 'Texte extrait' } }).ok, 'Un PDF extrait par le bureau doit partir');
  assert(!state({ name: 'a.pdf', ext: 'pdf', content: null, desktopFile: { content: '' } }).ok, 'Un PDF de bureau sans texte doit être refusé');
  assert(state({ name: 'a.png', ext: 'png', isImage: true }).ok, 'Une image passe par la vision');
});

test('sendMsg bloque l\'envoi si un fichier est illisible', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'ui.js'), 'utf8');
  const send = ui.slice(ui.indexOf('function sendMsg('), ui.indexOf('processStagedFiles(message)'));
  assert(/stagedFilesBlocking\(\)/.test(send), 'sendMsg doit appeler stagedFilesBlocking avant processStagedFiles');
});

test('le prompt système interdit d\'inventer un document non lu', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'engine.js'), 'utf8');
  assert(engine.includes('N\\\'invente jamais le contenu d\\\'un document que tu n\\\'as pas lu'), 'Règle DOCUMENTS absente du prompt système');
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
  // L'ancienne inscription par simple email n'existe plus : route inconnue, donc protegee.
  assert(!workerSrc.includes("'/api/register'"), '/api/register ne doit plus exister');
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
  '/api/verify', '/api/models', '/api/providers'];

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

// === 7c. ROUTES PUBLIQUES : AUCUN APPEL EXTERNE, CACHE DE L'ISOLATE ===
async function runPublicRouteTests() {
  console.log('\n\x1b[36m7c. Routes publiques : aucun appel externe, cache\x1b[0m');
  const src = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
  let n = 0;
  // Chaque import est un module neuf, donc un cache d'isolate vide.
  const freshWorker = async () => (await import('data:text/javascript,' + encodeURIComponent(src + '\n//' + (++n)))).default;
  const ctx = { waitUntil() {} };
  const SECRET = 'secret-de-test-0123456789abcdef';
  const EMAIL = 'test@example.com';
  const counters = { fetch: 0, ai: 0, put: 0, keys: [] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    counters.fetch++;
    return new Response(JSON.stringify({ data: [{ id: 'modele-test' }], choices: [{ message: { content: 'ok' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const env = () => {
    const kv = memoryKV({ ['user:' + EMAIL]: JSON.stringify({ email: EMAIL, name: 'Test', tv: 1 }) });
    const put = kv.put;
    kv.put = async (k, v, o) => { counters.put++; counters.keys.push(k); return put(k, v, o); };
    return {
      JWT_SECRET: SECRET, ETHER_KV: kv, GROQ_KEY: 'x', MISTRAL_KEY: 'x', CEREBRAS_KEY: 'x', OPENROUTER_KEY: 'x', GEMINI_KEY: 'x',
      AI: { run: async () => { counters.ai++; return { response: 'ok' }; } }
    };
  };
  const reset = () => { counters.fetch = 0; counters.ai = 0; counters.put = 0; counters.keys = []; };
  const auth = { Authorization: 'Bearer ' + signToken({ email: EMAIL, tv: 1, exp: Date.now() + 60000 }, SECRET) };
  const get = (w, p, e, h) => w.fetch(new Request('http://localhost' + p, { headers: h || {} }), e, ctx);

  try {
    await testAsync('sans compte, aucune route publique n appelle un fournisseur ni n ecrit dans KV', async () => {
      const w = await freshWorker();
      const e = env();
      reset();
      for (const p of EXPECTED_PUBLIC) {
        await get(w, p, e);
        await w.fetch(new Request('http://localhost' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), e, ctx);
      }
      await get(w, '/api/img/' + '0'.repeat(32) + '.jpg', e);
      assert(counters.fetch === 0 && counters.ai === 0, 'Appels externes : fetch=' + counters.fetch + ', AI=' + counters.ai);
      assert(counters.put === 0, 'Ecritures KV : ' + counters.put);
      const prov = await (await get(w, '/api/providers', e)).json();
      assert(Array.isArray(prov.providers) && prov.providers.length === 0 && prov.live === false, '/api/providers anonyme doit etre vide');
      const models = await (await get(w, '/api/models', e)).json();
      assert(models.models && models.models.groq && !('configured' in models), '/api/models anonyme : catalogue statique, sans configuration');
    });

    await testAsync('/api/health ne revele aucun detail de configuration', async () => {
      const w = await freshWorker();
      const body = await (await get(w, '/api/health', env())).text();
      const parsed = JSON.parse(body);
      assert(JSON.stringify(Object.keys(parsed).sort()) === JSON.stringify(['name', 'status', 'version']), 'Champs inattendus : ' + body);
      assert(!/groq|gemini|mistral|cerebras|openrouter|workersai|KEY|SECRET/i.test(body), 'Detail de configuration : ' + body);
    });

    await testAsync('deux appels rapproches de /api/models (connecte) ne declenchent qu une interrogation', async () => {
      const w = await freshWorker();
      const e = env();
      reset();
      await Promise.all([get(w, '/api/models', e, auth), get(w, '/api/models', e, auth)]);
      const once = counters.fetch;
      assert(once > 0, 'Avec un compte, /api/models doit interroger les fournisseurs');
      await get(w, '/api/models', e, auth);
      assert(counters.fetch === once, 'Appels fournisseurs : ' + counters.fetch + ' au lieu de ' + once);
      const r = await (await get(w, '/api/models', e, auth)).json();
      assert(r.live === true && Array.isArray(r.models.groq), 'Reponse en direct attendue');
    });

    await testAsync('/api/providers (connecte) : sondes en cache dans l isolate, aucune ecriture KV', async () => {
      const w = await freshWorker();
      const e = env();
      reset();
      await Promise.all([get(w, '/api/providers', e, auth), get(w, '/api/providers', e, auth)]);
      const once = counters.fetch + counters.ai;
      assert(once > 0, 'Avec un compte, les fournisseurs doivent etre sondes');
      const r = await (await get(w, '/api/providers', e, auth)).json();
      assert(counters.fetch + counters.ai === once, 'Sondes repetees : ' + (counters.fetch + counters.ai) + ' au lieu de ' + once);
      assert(r.live === true && r.providers.length > 0, 'Resultats en direct attendus');
      // Seule ecriture admise : le budget Workers AI, que la sonde consomme vraiment.
      const cacheWrites = counters.keys.filter(k => !/^aiusage:/.test(k));
      assert(cacheWrites.length === 0, 'Le cache ne doit plus ecrire dans KV : ' + cacheWrites.join(', '));
    });

    await testAsync('les routes mortes /api/register et /api/email ont disparu', async () => {
      assert(!/'\/api\/register'|'\/api\/email'/.test(src), 'Route morte encore declaree');
      assert(!/api\/email/.test(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'platform-web.js'), 'utf8')), 'Le front appelle encore /api/email');
      const w = await freshWorker();
      const r = await w.fetch(new Request('http://localhost/api/register', { method: 'POST', body: '{}' }), env(), ctx);
      assert(r.status === 401, '/api/register doit etre traitee comme une route inconnue protegee (HTTP ' + r.status + ')');
    });
  } finally {
    globalThis.fetch = realFetch;
  }
}

// === 7d. MODE INVITE : CHAT AVEC SA CLE, RIEN D'AUTRE ===
async function runGuestTests() {
  console.log('\n\x1b[36m7d. Mode invite\x1b[0m');
  // Delai reduit pour tester la coupure sans attendre une minute.
  const src = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8')
    .replace('const GUEST_TIMEOUT_MS = 60000;', 'const GUEST_TIMEOUT_MS = 150;');
  assert(/GUEST_TIMEOUT_MS = 150/.test(src), 'Constante GUEST_TIMEOUT_MS introuvable');
  let n = 0;
  const freshWorker = async () => (await import('data:text/javascript,' + encodeURIComponent(src + '\n//guest' + (++n)))).default;
  const ctx = { waitUntil() {} };
  const seen = { fetch: [], ai: 0, put: 0 };
  let hang = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.fetch.push({ url: String(url), headers: (init && init.headers) || {}, body: init && init.body });
    if (hang) return new Promise(() => {});
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const env = (over) => {
    const kv = memoryKV();
    const put = kv.put;
    kv.put = async (k, v, o) => { seen.put++; return put(k, v, o); };
    return Object.assign({
      JWT_SECRET: 'secret-de-test-0123456789abcdef', ETHER_KV: kv, GROQ_KEY: 'cle-serveur-groq',
      AI: { run: async () => { seen.ai++; return { response: 'ok' }; } }
    }, over || {});
  };
  const reset = () => { seen.fetch = []; seen.ai = 0; seen.put = 0; hang = false; };
  const guestCall = (w, p, body, e, extra) => w.fetch(new Request('http://localhost' + p, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'X-Provider-Key': 'cle-perso-invite', 'X-Evil': 'relaie-moi' }, extra || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }), e || env(), ctx);
  const msg = { messages: [{ role: 'user', content: 'bonjour' }] };

  try {
    await testAsync('invite : chat de base avec sa cle, relaye a Groq sans cle serveur ni en-tete arbitraire', async () => {
      const w = await freshWorker(); reset();
      const r = await guestCall(w, '/api/chat', Object.assign({ provider: 'groq', max_tokens: 999999 }, msg));
      assert(r.status === 200, 'HTTP ' + r.status);
      assert(seen.fetch.length === 1 && seen.fetch[0].url.startsWith('https://api.groq.com/'), 'Appel inattendu : ' + JSON.stringify(seen.fetch.map(f => f.url)));
      const h = JSON.stringify(seen.fetch[0].headers);
      assert(h.includes('Bearer cle-perso-invite') && !h.includes('cle-serveur-groq'), 'La cle de l invite doit etre la seule cle relayee');
      assert(!/X-Evil|relaie-moi/i.test(h), 'En-tete arbitraire relaye');
      assert(JSON.parse(seen.fetch[0].body).max_tokens <= 4000, 'max_tokens non plafonne');
      // Defense en profondeur : l'invite ne recoit ni cles serveur, ni KV, ni Workers AI.
      assert(/const args = \[guestEnv\(env, provider, userKey\),/.test(src), 'Le chat invite doit utiliser guestEnv');
      assert(/function guestEnv\(env, provider, userKey\) \{\s*return \{ CORS_ORIGIN: env\.CORS_ORIGIN, CTX: env\.CTX, \[PROVIDERS\[provider\]\.key\]: userKey \};/.test(src), 'guestEnv ne doit transmettre que la cle de l invite');
    });

    await testAsync('invite : aucune ecriture KV ni Workers AI, en chat comme en flux', async () => {
      const w = await freshWorker(); reset();
      for (const p of ['groq', 'gemini', 'mistral', 'openai', 'anthropic']) {
        await guestCall(w, '/api/chat', Object.assign({ provider: p }, msg));
        const s = await guestCall(w, '/api/chat/stream', Object.assign({ provider: p }, msg));
        if (s.body) await s.text().catch(() => '');
      }
      assert(seen.put === 0, seen.put + ' ecritures KV en mode invite');
      assert(seen.ai === 0, 'Workers AI appele en mode invite');
    });

    await testAsync('invite : URL personnalisee et fournisseurs du serveur refuses (403), sans aucun appel', async () => {
      const w = await freshWorker(); reset();
      for (const p of ['custom', 'workersai', 'openrouter', 'cerebras', 'pollinations', 'inconnu']) {
        const r = await guestCall(w, '/api/chat', Object.assign({ provider: p, baseUrl: 'https://169.254.169.254/latest' }, msg));
        assert(r.status === 403, p + ' : HTTP ' + r.status);
        const s = await guestCall(w, '/api/chat/stream', Object.assign({ provider: p, baseUrl: 'https://exemple.test/v1' }, msg));
        assert(s.status === 403, p + ' (flux) : HTTP ' + s.status);
      }
      assert(seen.fetch.length === 0 && seen.ai === 0, 'Appel sortant pour un fournisseur interdit');
    });

    await testAsync('invite : corps trop gros (413), delai depasse (504), sans cle (401), serveur mal configure (503)', async () => {
      const w = await freshWorker(); reset();
      const big = JSON.stringify(Object.assign({ provider: 'groq' }, { messages: [{ role: 'user', content: 'x'.repeat(140 * 1024) }] }));
      assert((await guestCall(w, '/api/chat', big)).status === 413, 'Corps trop gros accepte');
      assert(seen.fetch.length === 0, 'Corps trop gros relaye');
      hang = true;
      const t = await guestCall(w, '/api/chat', Object.assign({ provider: 'groq' }, msg));
      assert(t.status === 504, 'Delai non applique (HTTP ' + t.status + ')');
      const ts = await guestCall(w, '/api/chat/stream', Object.assign({ provider: 'groq' }, msg));
      assert(ts.status === 504, 'Delai du flux non applique (HTTP ' + ts.status + ')');
      hang = false;
      const nokey = await guestCall(w, '/api/chat', Object.assign({ provider: 'groq' }, msg), env(), { 'X-Provider-Key': '' });
      assert(nokey.status === 401, 'Sans cle ni compte : HTTP ' + nokey.status);
      const closed = await guestCall(w, '/api/chat', Object.assign({ provider: 'groq' }, msg), env({ JWT_SECRET: '' }));
      assert(closed.status === 503, 'Instance mal configuree : HTTP ' + closed.status);
    });

    await testAsync('invite : avec une cle mais sans jeton, chaque route sensible refuse (401)', async () => {
      const w = await freshWorker(); reset();
      for (const p of ['/api/fetch', '/api/imagine', '/api/persist', '/api/search', '/api/account/export', '/api/account/delete',
                       '/api/diag', '/api/providers/test', '/api/quota', '/api/quota/use', '/api/vision', '/api/transcribe', '/api/usage', '/api/image']) {
        const r = await guestCall(w, p, { url: 'https://example.com', query: 'x', provider: 'groq' });
        assert(r.status === 401, p + ' : HTTP ' + r.status);
      }
      assert(seen.fetch.length === 0 && seen.put === 0, 'Une route sensible a travaille pour un invite');
    });

    await testAsync('pas de coffre « anonyme » partage : le stockage exige toujours un compte', async () => {
      assert(!/persist:'\s*\+\s*\(\(user && user\.email\) \|\| 'anon/.test(src), 'Coffre anonyme reintroduit');
      assert(/function persistKey\(user\) \{\s*return 'persist:' \+ user\.email;/.test(src), 'persistKey doit dependre du compte');
      const w = await freshWorker();
      const r = await w.fetch(new Request('http://localhost/api/persist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}' }), env(), ctx);
      assert(r.status === 401, '/api/persist sans compte : HTTP ' + r.status);
    });
  } finally {
    globalThis.fetch = realFetch;
  }

  // Cote client : platform-web.js execute dans un navigateur simule.
  await testAsync('client invite : aucun appel a /api/persist ni aux routes de compte, rien dans le cache de synchro', async () => {
    const vm = require('vm');
    const store = new Map([['ether_guest_mode', '1'], ['etherx_provider_keys', JSON.stringify({ groq: 'cle-perso' })]]);
    const calls = [];
    const win = {
      ETHER_API_BASE: 'http://localhost', location: { origin: 'http://localhost', href: 'http://localhost/' },
      history: { replaceState() {} }, addEventListener() {}, dispatchEvent() {},
      localStorage: {
        getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k), key: i => [...store.keys()][i], get length() { return store.size; }
      },
      fetch: async (url) => { calls.push(String(url)); return new Response('{"ok":true,"providers":[]}', { status: 200 }); },
      console, setTimeout, clearTimeout, URL, Promise, JSON, Uint8Array, TextDecoder, Event: class { constructor(t) { this.type = t; } },
      crypto: require('crypto').webcrypto,
      document: {
        readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelector: () => null,
        createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
        body: { appendChild() {} }, head: { appendChild() {} }, documentElement: { setAttribute() {} }
      }
    };
    win.window = win; win.self = win;
    vm.createContext(win);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'platform-web.js'), 'utf8'), win);
    const D = win.etherDesktop;
    assert(D && D.isGuest() === true, 'Le mode invite doit etre actif');
    await D.persistSet('convs', { c1: { title: 'x' } });
    await D.persistWrite({ convs: {} });
    await D.persistRead();
    await D.persistGet('convs');
    const blocked = await Promise.all([D.accountExport(), D.aiUsage(), D.quotaCheck(), D.quotaUse(), D.accountDelete('x')]);
    assert(blocked.every(r => r && r.ok === false && r.guest), 'Les routes de compte doivent etre refusees cote client');
    await new Promise(r => setTimeout(r, 1700));
    assert(!calls.some(u => /\/api\/(persist|account|usage|quota)/.test(u)), 'Appel interdit : ' + calls.join(', '));
    const cache = store.get('ether__sync_cache');
    assert(!cache || !/c1/.test(cache), 'Les donnees de l invite ne doivent pas entrer dans le cache de synchronisation');
    const custom = await D.customChat({ providerId: 'x', messages: [{ role: 'user', content: 'x' }] });
    assert(custom && custom.ok === false, 'Fournisseur personnalise accepte pour un invite');
    assert(!calls.some(u => /\/api\/chat/.test(u)), 'Un fournisseur personnalise a ete relaye pour un invite');
  });
}

// === 5c. LECTURE WORD ET EXCEL (renderer/docread.js) ===
// Fabrique un vrai zip (entrees compressees en deflate, sauf `stored`).
function buildZip(files, stored) {
  const zlib = require('zlib');
  const locals = [], centrals = [];
  let offset = 0;
  Object.keys(files).forEach(name => {
    const raw = Buffer.from(files[name], 'utf8');
    const deflate = !(stored || []).includes(name);
    const data = deflate ? zlib.deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  });
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const buf = Buffer.concat(locals.concat([cd, end]));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

// Fabrique un PDF minimal : une page par element (texte, ou null pour une page sans texte).
function buildPdf(pages) {
  const objs = [];
  const kids = pages.map((_, i) => (4 + i * 2) + ' 0 R').join(' ');
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  pages.forEach((txt, i) => {
    const content = txt ? 'BT /F1 18 Tf 72 720 Td (' + txt + ') Tj ET' : '';
    objs[4 + i * 2] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (5 + i * 2) + ' 0 R >>';
    objs[5 + i * 2] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
  });
  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let n = 1; n < objs.length; n++) {
    offsets[n] = Buffer.byteLength(out, 'latin1');
    out += n + ' 0 obj\n' + objs[n] + '\nendobj\n';
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let n = 1; n < objs.length; n++) out += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  const buf = Buffer.from(out, 'latin1');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

async function runDocReadTests() {
  console.log('\n\x1b[36m5c. Lecture Word, Excel et PDF\x1b[0m');
  const src = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'docread.js'), 'utf8');
  const docread = new Function(src + '\nreturn ETHER_DOCREAD;')();

  const docx = buildZip({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': '<w:document><w:body>'
      + '<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:t>Bonjour &amp; </w:t></w:r><w:r><w:t xml:space="preserve">salut</w:t></w:r></w:p>'
      + '<w:p><w:r><w:t>Deuxième</w:t><w:tab/><w:t>ligne</w:t></w:r></w:p>'
      + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
      + '</w:body></w:document>'
  }, ['[Content_Types].xml']);
  const docxText = (await docread.read(docx, 'docx')).text;
  test('docread lit le texte d\'un .docx compressé', () => {
    assert(docxText.startsWith('Bonjour & salut\nDeuxième\tligne'), JSON.stringify(docxText));
    assert(/A1/.test(docxText) && /B1/.test(docxText), 'Texte des tableaux absent : ' + JSON.stringify(docxText));
  });

  const xlsx = buildZip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="Budget &amp; co" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>Poste</t></si><si><t>Montant</t></si><si><r><t>Lo</t></r><r><t>yer</t></r><rPh><t>X</t></rPh></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><cols><col min="1"/></cols><sheetData>'
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
      + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>650</v></c></row>'
      + '<row r="3"><c r="C3" t="inlineStr"><is><t>note</t></is></c><c r="D3" t="b"><v>1</v></c></row>'
      + '<row r="4"><c r="A4" s="2"/></row>'
      + '</sheetData></worksheet>'
  });
  const xlsxText = (await docread.read(xlsx, 'xlsx')).text;
  test('docread lit les feuilles d\'un .xlsx', () => {
    assert(xlsxText === '## Budget & co\nPoste\tMontant\nLoyer\t650\n\t\tnote\tVRAI', JSON.stringify(xlsxText));
  });

  const broken = await docread.read(new Uint8Array([1, 2, 3, 4]).buffer, 'docx').then(() => 'lu', e => e.message);
  test('docread rejette un fichier qui n\'est pas un zip', () => {
    assert(broken !== 'lu', 'Un fichier abîmé ne doit pas être lu');
  });

  // PDF : pdf.js heberge dans vendor/pdfjs (il demande Node 22 ou plus).
  const nodeMajor = parseInt(process.versions.node, 10);
  if (nodeMajor < 22) {
    console.log('  \x1b[33m⊘\x1b[0m pdf.js demande Node 22 ou plus (skip tests PDF)');
  } else {
    const { pathToFileURL } = require('url');
    const vendor = path.join(__dirname, '..', 'vendor', 'pdfjs');
    const pdfjs = await import(pathToFileURL(path.join(vendor, 'pdf.min.mjs')).href);
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(vendor, 'pdf.worker.min.mjs')).href;
    const textPdf = buildPdf(['Bonjour ETHER', 'Page deux']);
    const scanPdf = buildPdf([null]);
    const pdfRes = await docread.read(textPdf, 'pdf', { pdfjs });
    test('docread lit le texte d\'un PDF page par page', () => {
      assert(pdfRes.pageCount === 2 && pdfRes.pages === 2, 'Pages : ' + JSON.stringify(pdfRes));
      assert(/\[Page 1\]\nBonjour ETHER/.test(pdfRes.text) && /\[Page 2\]\nPage deux/.test(pdfRes.text), JSON.stringify(pdfRes.text));
    });
    const scanRes = await docread.read(scanPdf, 'pdf', { pdfjs });
    test('un PDF sans texte (scan) donne un texte vide et une erreur claire', () => {
      assert(scanRes.text === '' && scanRes.pageCount === 1, JSON.stringify(scanRes));
      const st = loadStagedFileState()({ name: 'scan.pdf', ext: 'pdf', content: scanRes.text });
      assert(!st.ok && /scan/.test(st.error), JSON.stringify(st));
    });
    const notPdf = await docread.read(new Uint8Array([1, 2, 3]).buffer, 'pdf', { pdfjs }).then(() => 'lu', e => e.message);
    test('docread rejette un faux PDF', () => {
      assert(notPdf !== 'lu', 'Un faux PDF ne doit pas être lu');
    });
  }

  test('stagedFileState refuse clairement .doc et .xls', () => {
    const state = loadStagedFileState();
    assert(/\.docx/.test(state({ name: 'a.doc', ext: 'doc', content: null }).error), 'Le .doc doit proposer le .docx');
    assert(/\.xlsx/.test(state({ name: 'a.xls', ext: 'xls', content: null }).error), 'Le .xls doit proposer le .xlsx');
    assert(/texte lisible/.test(state({ name: 'a.docx', ext: 'docx', content: '' }).error), 'Un .docx vide doit le dire');
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
  // Sans compte, la liste est vide par conception (pas de sonde en direct).
  if (providers && providers.providers && providers.live !== false) {
    test('Au moins 1 provider actif', () => {
      const ok = providers.providers.filter(p => p.ok);
      assert(ok.length > 0, 'Aucun provider actif');
    });
  }
}

runAuthTests().catch(e => {
  console.log('  \x1b[31m✗\x1b[0m tests d auth interrompus — ' + e.message);
  failed++;
}).then(() => runPublicRouteTests().catch(e => {
  console.log('  \x1b[31m✗\x1b[0m tests des routes publiques interrompus — ' + e.message);
  failed++;
})).then(() => runGuestTests().catch(e => {
  console.log('  \x1b[31m✗\x1b[0m tests du mode invite interrompus — ' + e.message);
  failed++;
})).then(() => runDocReadTests().catch(e => {
  console.log('  \x1b[31m✗\x1b[0m tests de lecture Word/Excel interrompus — ' + e.message);
  failed++;
})).then(runApiTests).then(() => {
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
