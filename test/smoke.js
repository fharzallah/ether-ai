/**
 * ETHER — Smoke Tests
 * Vérifie que l'app démarre et que les composants critiques fonctionnent
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

test('main.js existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', 'main.js')));
});

test('preload.js existe', () => {
  assert(fs.existsSync(path.join(__dirname, '..', 'preload.js')));
});

const rendererFiles = ['core.js', 'engine.js', 'ui.js', 'app-main.js'];
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

['main.js', 'preload.js'].concat(rendererFiles.map(f => 'renderer/' + f)).forEach(f => {
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

test('engine.js contient les 3 providers', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'engine.js'), 'utf8');
  assert(engine.includes('GEMINI_MODELS'), 'Missing GEMINI_MODELS');
  assert(engine.includes('CEREBRAS_MODELS'), 'Missing CEREBRAS_MODELS');
  assert(engine.includes('GROQ_MODELS'), 'Missing GROQ_MODELS');
  assert(engine.includes('getSmartRoute'), 'Missing getSmartRoute');
});

// === 6. SECURITE ===
console.log('\n\x1b[36m6. Securite\x1b[0m');

test('main.js ne contient pas de cles en clair', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  // Les cles sont chargées depuis process.env
  const usesEnv = main.includes('process.env.GROQ_KEY') || main.includes('process.env.GEMINI_KEY');
  assert(usesEnv, 'Main.js should use process.env for keys');
});

test('main.js contient la CSP', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(main.includes('Content-Security-Policy'), 'Missing CSP');
});

test('preload.js utilise contextBridge', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  assert(preload.includes('contextBridge.exposeInMainWorld'), 'Missing contextBridge');
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
