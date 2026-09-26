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

const rendererFiles = ['platform-web.js', 'core.js', 'memory.js', 'engine.js', 'ui.js', 'skill-creator.js', 'app-main.js'];
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

// === 7. WORKER ===
console.log('\n\x1b[36m7. Worker (backend)\x1b[0m');

test('worker/src/index.js existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', 'worker', 'src', 'index.js')));
});

test('worker contient les routes API', () => {
  const worker = fs.readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
  assert(worker.includes('/api/health'), 'Missing /api/health');
  assert(worker.includes('/api/chat'), 'Missing /api/chat');
  assert(worker.includes('/api/register'), 'Missing /api/register');
  assert(worker.includes('/api/providers'), 'Missing /api/providers');
  assert(worker.includes('/api/search'), 'Missing /api/search');
  assert(worker.includes('/api/persist'), 'Missing /api/persist');
  assert(worker.includes('/api/stripe/checkout'), 'Missing /api/stripe/checkout');
  assert(worker.includes('/api/stripe/webhook'), 'Missing /api/stripe/webhook');
});

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

runApiTests().then(() => {
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
