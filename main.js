var electron = require('electron');
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var ipcMain = electron.ipcMain;
var dialog = electron.dialog;
var autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch(e) { /* not available in dev */ }
var pdfParse = require('pdf-parse');
var mammoth = require('mammoth');
var XLSX = require('xlsx');
var shell = electron.shell;
var path = require('path');
var fs = require('fs');
// Charger les variables d'environnement depuis .env (jamais commité)
require('dotenv').config({ path: path.join(__dirname, '.env') });
var http = require('http');
var https = require('https');
var StringDecoder = require('string_decoder').StringDecoder;

// === CONFIGURATION ===
var API_PORT = 3456;

// === 3 PROVIDERS: Gemini + Groq + Cerebras ===
var GROQ_MODELS = {
    main: 'llama-3.3-70b-versatile',
    reasoning: 'qwen/qwen3-32b',
    fast: 'llama-3.1-8b-instant'
};
var GEMINI_MODELS = { main: 'gemini-2.5-flash', fast: 'gemini-2.5-flash-lite' };
// Legacy Cerebras — garde pour fallback
var CEREBRAS_MODELS = { main: 'qwen-3-235b-a22b-instruct-2507', fast: 'llama3.1-8b' };

var apiKeyStore = null;
var networkMode = false;
var apiServer = null;
var appStartTime = Date.now();
var os = require('os');

// === CLES API ===
// Chargées depuis .env — aucune clé en dur dans le code source
var GROQ_KEY = process.env.GROQ_KEY || '';
var CEREBRAS_KEY = process.env.CEREBRAS_KEY || '';
var DEFAULT_GROQ_KEY = GROQ_KEY;

// Gemini — rotation automatique entre les clés disponibles dans .env
var GEMINI_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3
].filter(Boolean);
var _geminiKeyIndex = 0;
var _geminiKeyBlocked = [false, false, false];

function getGeminiKey() {
    // Si la cle actuelle est bloquee, essayer l'autre
    if (_geminiKeyBlocked[_geminiKeyIndex]) {
        var other = (_geminiKeyIndex + 1) % GEMINI_KEYS.length;
        if (!_geminiKeyBlocked[other]) {
            _geminiKeyIndex = other;
        }
    }
    return GEMINI_KEYS[_geminiKeyIndex];
}

function rotateGeminiKey() {
    // Marquer la cle actuelle comme bloquee temporairement
    _geminiKeyBlocked[_geminiKeyIndex] = true;
    // Debloquer apres 60s
    var blockedIdx = _geminiKeyIndex;
    setTimeout(function() { _geminiKeyBlocked[blockedIdx] = false; }, 60000);
    // Basculer sur l'autre cle
    _geminiKeyIndex = (_geminiKeyIndex + 1) % GEMINI_KEYS.length;
    console.log('[GEMINI] Rotated to key #' + (_geminiKeyIndex + 1));
    return GEMINI_KEYS[_geminiKeyIndex];
}

var GEMINI_KEY = GEMINI_KEYS[0];

function loadApiConfig() {
    try {
        var configPath = path.join(app.getPath('userData'), 'api-config.json');
        if (fs.existsSync(configPath)) {
            var config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.groqKey) GROQ_KEY = config.groqKey;
            if (config.geminiKey) GEMINI_KEY = config.geminiKey;
            if (config.cerebrasKey) CEREBRAS_KEY = config.cerebrasKey;
            if (config.models) {
                for (var k in config.models) { if (config.models[k]) GROQ_MODELS[k] = config.models[k]; }
            }
            console.log('[CONFIG] Loaded — Groq: OK | Gemini:', GEMINI_KEY ? 'OK' : '-', '| Cerebras:', CEREBRAS_KEY ? 'OK' : '-');
        }
    } catch(e) { console.warn('[CONFIG] Failed to load config:', e.message); }
}

function saveApiConfig() {
    try {
        var configPath = path.join(app.getPath('userData'), 'api-config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            groqKey: GROQ_KEY,
            geminiKey: GEMINI_KEY,
            cerebrasKey: CEREBRAS_KEY,
            models: GROQ_MODELS
        }, null, 2), 'utf8');
        return true;
    } catch(e) { console.error('[CONFIG] Failed to save:', e.message); return false; }
}

// Charger la config au demarrage (apres app.whenReady)
// On le met dans un try/catch car getPath n'est pas dispo avant whenReady
try { loadApiConfig(); } catch(e) { /* will retry after whenReady */ }

// === HELPER: HTTPS request ===
function httpsRequest(options, postData) {
    return new Promise(function(resolve, reject) {
        var req = https.request(options, function(res) {
            var body = '';
            res.on('data', function(c) { body += c; });
            res.on('end', function() {
                resolve({ status: res.statusCode, body: body, headers: res.headers });
            });
        });
        req.on('error', reject);
        req.setTimeout(25000, function() { req.destroy(); reject(new Error('Timeout')); });
        if (postData) req.write(postData);
        req.end();
    });
}

function httpGet(url) {
    return new Promise(function(resolve, reject) {
        var mod = url.indexOf('https') === 0 ? https : http;
        mod.get(url, function(res) {
            var body = '';
            res.on('data', function(c) { body += c; });
            res.on('end', function() {
                try { resolve(JSON.parse(body)); } catch(e) { resolve(null); }
            });
        }).on('error', function() { resolve(null); })
          .setTimeout(6000, function() { resolve(null); });
    });
}

// === DuckDuckGo HTML Search (pas de cle API requise) ===
function httpGetRaw(url, headers) {
    return new Promise(function(resolve, reject) {
        var mod = url.indexOf('https') === 0 ? https : http;
        var urlObj = new (require('url').URL)(url);
        var opts = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: headers || { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        };
        mod.get(url, { headers: opts.headers }, function(res) {
            var body = '';
            res.on('data', function(c) { body += c; });
            res.on('end', function() { resolve(body); });
        }).on('error', function() { resolve(''); })
          .setTimeout(8000, function() { resolve(''); });
    });
}

function duckDuckGoSearch(query) {
    var url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    return httpGetRaw(url, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://duckduckgo.com/'
    }).then(function(html) {
        var results = [];
        if (!html || html.length < 500) return results;
        html = html.replace(/&nbsp;/g, ' ');
        var resultBlocks = html.split(/class="[^"]*result\b[^"]*"/);
        for (var i = 1; i < resultBlocks.length && results.length < 5; i++) {
            var block = resultBlocks[i];
            var titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/) ||
                            block.match(/<a[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/);
            var title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            var snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) ||
                              block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);
            var snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            var urlMatch = block.match(/class="result__url"[^>]*>([\s\S]*?)<\/a>/) ||
                          block.match(/href="([^"]+)"/);
            var resultUrl = urlMatch ? urlMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            if (resultUrl && resultUrl.indexOf('//') === 0) resultUrl = 'https:' + resultUrl;
            var cleanText = function(str) { return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'"); };
            title = cleanText(title); snippet = cleanText(snippet);
            if (title && snippet && snippet.length > 20) {
                results.push({ title: title, snippet: snippet, url: resultUrl, source: 'DuckDuckGo' + (resultUrl ? ' — ' + resultUrl.split('/')[2] : '') });
            }
        }
        return results;
    }).catch(function() { return []; });
}

function swisscowsSearch(query) {
    var url = 'https://swisscows.com/fr/web?query=' + encodeURIComponent(query);
    return httpGetRaw(url, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    }).then(function(html) {
        var results = [];
        if (!html) return results;
        var blocks = html.split(/<article/);
        for (var i = 1; i < blocks.length && results.length < 3; i++) {
            var block = blocks[i];
            var titleMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
            var snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            var urlMatch = block.match(/href="([^"]+)"/);
            if (titleMatch && snippetMatch) {
                var title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
                var snippet = snippetMatch[1].replace(/<[^>]*>/g, '').trim();
                var resultUrl = urlMatch ? urlMatch[1] : '';
                results.push({ title: title, snippet: snippet, url: resultUrl, source: 'Swisscows' + (resultUrl ? ' — ' + resultUrl.split('/')[2] : '') });
            }
        }
        return results;
    }).catch(function() { return []; });
}

// === IPC: Appel Groq (vitesse, fallback fiable) ===
ipcMain.handle('groq-chat', function(event, data) {
    var postData = JSON.stringify({
        model: data.model || GROQ_MODELS.main,
        messages: data.messages,
        temperature: data.temperature || 0.6,
        max_tokens: data.max_tokens || 3000
    });
    return httpsRequest({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + GROQ_KEY,
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData).then(function(res) {
        if (res.status === 200) {
            var d = JSON.parse(res.body);
            return { ok: true, text: d.choices[0].message.content, model: data.model };
        }
        console.log('[CHAT] Error status:', res.status, res.body.substring(0, 200));
        return { ok: false, error: 'Status ' + res.status };
    }).catch(function(e) {
        console.log('[CHAT] Exception:', e.message);
        return { ok: false, error: e.message };
    });
});

// === IPC: Stopper le streaming en cours ===
var currentStreamReq = null;
ipcMain.handle('groq-stop', function() {
    if (currentStreamReq) {
        try { currentStreamReq.destroy(); } catch(e) {}
        currentStreamReq = null;
    }
    return { ok: true };
});

// === IPC: Appel Groq STREAMING (SSE) ===
ipcMain.handle('groq-stream', function(event, data) {
    if (!checkRateLimit('groq-stream')) {
        return Promise.resolve({ ok: false, error: 'Rate limit exceeded. Please wait.' });
    }
    console.log('[STREAM] Starting stream, model:', data.model);
    var postData = JSON.stringify({
        model: data.model || GROQ_MODELS.main,
        messages: data.messages,
        temperature: data.temperature || 0.6,
        max_tokens: data.max_tokens || 3000,
        stream: true
    });

    return new Promise(function(resolve) {
        var req = https.request({
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + GROQ_KEY,
                'Content-Length': Buffer.byteLength(postData)
            }
        }, function(res) {
            if (res.statusCode !== 200) {
                var errBody = '';
                res.on('data', function(c) { errBody += c; });
                res.on('end', function() {
                    console.log('[STREAM] Error status:', res.statusCode, errBody.substring(0, 200));
                    currentStreamReq = null;
                    resolve({ ok: false, error: 'Status ' + res.statusCode + ': ' + errBody.substring(0, 100) });
                });
                return;
            }
            var fullText = '';
            var buffer = '';
            var _decoder = new StringDecoder('utf8');
            res.on('data', function(chunk) {
                buffer += _decoder.write(chunk);
                var lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line || !line.startsWith('data: ')) continue;
                    var jsonStr = line.substring(6);
                    if (jsonStr === '[DONE]') continue;
                    try {
                        var parsed = JSON.parse(jsonStr);
                        var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
                        if (delta && delta.content) {
                            fullText += delta.content;
                            // Envoyer le chunk au renderer
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('groq-chunk', delta.content);
                            }
                        }
                    } catch(e) { /* skip bad JSON */ }
                }
            });
            res.on('end', function() {
                currentStreamReq = null;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('groq-done', fullText);
                }
                // Ne PAS resolve ici — laisser groq-done gerer la finalisation
                // resolve seulement pour signaler que le stream est fini sans erreur
                setTimeout(function() { resolve({ ok: true, text: fullText, model: data.model }); }, 100);
            });
        });
        req.on('error', function(e) { console.log('[STREAM] Request error:', e.message); currentStreamReq = null; resolve({ ok: false, error: e.message }); });
        req.setTimeout(30000, function() { console.log('[STREAM] Timeout'); currentStreamReq = null; req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
        req.write(postData);
        req.end();
        currentStreamReq = req;
    });
});

// === IPC: Test modèles disponibles ===
ipcMain.handle('groq-test', function() {
    var models = [GROQ_MODELS.main, GROQ_MODELS.reasoning, GROQ_MODELS.fast];
    return Promise.all(models.map(function(model) {
        var postData = JSON.stringify({ model: model, messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 });
        return httpsRequest({
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + GROQ_KEY,
                'Content-Length': Buffer.byteLength(postData)
            }
        }, postData).then(function(r) { return { model: model, ok: r.status === 200 }; })
          .catch(function() { return { model: model, ok: false }; });
    })).then(function(results) {
        var working = results.filter(function(r) { return r.ok; });
        return { models: working.map(function(r) { return r.model; }), count: working.length, total: models.length };
    });
});

// === IPC: GEMINI VISION — analyse d'images ===
ipcMain.handle('gemini-vision', function(event, data) {
    var currentKey = getGeminiKey();
    var model = 'gemini-2.5-flash';
    var url = '/v1beta/models/' + model + ':generateContent?key=' + currentKey;
    var contents = [{
        parts: [
            { text: data.prompt || 'Decris cette image en detail.' },
            { inlineData: { mimeType: data.mime || 'image/jpeg', data: data.base64 } }
        ]
    }];
    var body = { contents: contents, generationConfig: { maxOutputTokens: 4000, temperature: 0.5 } };
    if (data.systemPrompt) body.systemInstruction = { parts: [{ text: data.systemPrompt }] };
    var postData = JSON.stringify(body);
    return httpsRequest({
        hostname: 'generativelanguage.googleapis.com', path: url, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, postData).then(function(res) {
        if (res.status === 200) {
            var d = JSON.parse(res.body);
            if (d.candidates && d.candidates[0] && d.candidates[0].content) {
                var text = '';
                var parts = d.candidates[0].content.parts;
                for (var p = 0; p < parts.length; p++) { if (parts[p].text) text += parts[p].text; }
                return { ok: true, text: text, provider: 'gemini-vision' };
            }
            return { ok: false, error: 'No candidates' };
        }
        if (res.status === 429) {
            var newKey = rotateGeminiKey();
            var retryUrl = '/v1beta/models/' + model + ':generateContent?key=' + newKey;
            return httpsRequest({
                hostname: 'generativelanguage.googleapis.com', path: retryUrl, method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
            }, postData).then(function(r2) {
                if (r2.status === 200) {
                    var d2 = JSON.parse(r2.body);
                    if (d2.candidates && d2.candidates[0]) {
                        var t2 = ''; var pp = d2.candidates[0].content.parts;
                        for (var p2 = 0; p2 < pp.length; p2++) { if (pp[p2].text) t2 += pp[p2].text; }
                        return { ok: true, text: t2, provider: 'gemini-vision' };
                    }
                }
                return { ok: false, error: 'Rate limited' };
            });
        }
        return { ok: false, error: 'Status ' + res.status };
    })['catch'](function(e) { return { ok: false, error: e.message }; });
});

// === IPC: GEMINI API (Google) — rotation automatique des cles ===
ipcMain.handle('gemini-chat', function(event, data) {
    var model = data.model || GEMINI_MODELS.main;
    var currentKey = getGeminiKey();
    var url = '/v1beta/models/' + model + ':generateContent?key=' + currentKey;
    // Convertir le format OpenAI -> Gemini
    var contents = [];
    var systemInstruction = null;
    for (var i = 0; i < data.messages.length; i++) {
        var m = data.messages[i];
        if (m.role === 'system') {
            systemInstruction = { parts: [{ text: m.content }] };
        } else {
            contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
        }
    }
    var body = { contents: contents, generationConfig: { maxOutputTokens: data.max_tokens || 4000, temperature: data.temperature || 0.7 } };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    // Activer le thinking pour le modele 2.5
    if (model.indexOf('2.5') !== -1) {
        body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };
    }
    var postData = JSON.stringify(body);
    return httpsRequest({
        hostname: 'generativelanguage.googleapis.com',
        path: url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, postData).then(function(res) {
        if (res.status === 200) {
            var d = JSON.parse(res.body);
            if (d.candidates && d.candidates[0] && d.candidates[0].content) {
                var parts = d.candidates[0].content.parts;
                var text = '';
                var thinking = '';
                for (var p = 0; p < parts.length; p++) {
                    if (parts[p].thought) thinking += parts[p].text;
                    else text += parts[p].text;
                }
                return { ok: true, text: text, thinking: thinking, model: model, provider: 'gemini' };
            }
            return { ok: false, error: 'No candidates', provider: 'gemini' };
        }
        // Rate limit 429 → rotation de cle et retry
        if (res.status === 429) {
            var newKey = rotateGeminiKey();
            var retryUrl = '/v1beta/models/' + model + ':generateContent?key=' + newKey;
            return httpsRequest({
                hostname: 'generativelanguage.googleapis.com', path: retryUrl, method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
            }, postData).then(function(r2) {
                if (r2.status === 200) {
                    var d2 = JSON.parse(r2.body);
                    if (d2.candidates && d2.candidates[0] && d2.candidates[0].content) {
                        var parts2 = d2.candidates[0].content.parts; var text2 = ''; var thinking2 = '';
                        for (var p2 = 0; p2 < parts2.length; p2++) { if (parts2[p2].thought) thinking2 += parts2[p2].text; else text2 += parts2[p2].text; }
                        return { ok: true, text: text2, thinking: thinking2, model: model, provider: 'gemini' };
                    }
                }
                return { ok: false, error: 'Both keys rate limited', provider: 'gemini' };
            });
        }
        console.log('[GEMINI] Error:', res.status);
        return { ok: false, error: 'Status ' + res.status, provider: 'gemini' };
    })['catch'](function(e) {
        return { ok: false, error: e.message, provider: 'gemini' };
    });
});

// === IPC: GEMINI STREAMING (SSE) ===
ipcMain.handle('gemini-stream', function(event, data) {
    if (!checkRateLimit('gemini-stream')) {
        return Promise.resolve({ ok: false, error: 'Rate limit exceeded.', provider: 'gemini' });
    }
    var model = data.model || GEMINI_MODELS.main;
    var currentKey = getGeminiKey();
    var urlPath = '/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + currentKey;
    var contents = [];
    var systemInstruction = null;
    for (var i = 0; i < data.messages.length; i++) {
        var m = data.messages[i];
        if (m.role === 'system') systemInstruction = { parts: [{ text: m.content }] };
        else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
    var body = { contents: contents, generationConfig: { maxOutputTokens: data.max_tokens || 4000, temperature: data.temperature || 0.7 } };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    if (model.indexOf('2.5') !== -1) {
        body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };
    }
    var postData = JSON.stringify(body);

    return new Promise(function(resolve) {
        var req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: urlPath,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        }, function(res) {
            if (res.statusCode !== 200) {
                var errBody = '';
                res.on('data', function(c) { errBody += c; });
                res.on('end', function() {
                    console.log('[GEMINI-STREAM] Error:', res.statusCode);
                    // 429 → rotation de cle et retry en non-streaming (plus fiable)
                    if (res.statusCode === 429) {
                        var newKey = rotateGeminiKey();
                        var retryUrl = '/v1beta/models/' + model + ':generateContent?key=' + newKey;
                        httpsRequest({
                            hostname: 'generativelanguage.googleapis.com', path: retryUrl, method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
                        }, postData).then(function(r2) {
                            if (r2.status === 200) {
                                var d2 = JSON.parse(r2.body);
                                if (d2.candidates && d2.candidates[0] && d2.candidates[0].content) {
                                    var parts2 = d2.candidates[0].content.parts; var text2 = '';
                                    for (var p2 = 0; p2 < parts2.length; p2++) { if (!parts2[p2].thought && parts2[p2].text) text2 += parts2[p2].text; }
                                    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.webContents.send('groq-done', text2); }
                                    resolve({ ok: true, text: text2, model: model, provider: 'gemini' });
                                    return;
                                }
                            }
                            resolve({ ok: false, error: 'Both keys rate limited', provider: 'gemini' });
                        })['catch'](function() {
                            resolve({ ok: false, error: 'Retry failed', provider: 'gemini' });
                        });
                        return;
                    }
                    resolve({ ok: false, error: 'Status ' + res.statusCode, provider: 'gemini' });
                });
                return;
            }
            var fullText = '';
            var buffer = '';
            var _decoder = new StringDecoder('utf8');
            res.on('data', function(chunk) {
                buffer += _decoder.write(chunk);
                var lines = buffer.split('\n');
                buffer = lines.pop();
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line || !line.startsWith('data: ')) continue;
                    try {
                        var parsed = JSON.parse(line.substring(6));
                        if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
                            var parts = parsed.candidates[0].content.parts;
                            for (var p = 0; p < parts.length; p++) {
                                if (!parts[p].thought && parts[p].text) {
                                    fullText += parts[p].text;
                                    if (mainWindow && !mainWindow.isDestroyed()) {
                                        mainWindow.webContents.send('groq-chunk', parts[p].text);
                                    }
                                }
                            }
                        }
                    } catch(e) { /* skip */ }
                }
            });
            res.on('end', function() {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('groq-done', fullText);
                }
                setTimeout(function() { resolve({ ok: true, text: fullText, model: model, provider: 'gemini' }); }, 100);
            });
        });
        req.on('error', function(e) { resolve({ ok: false, error: e.message, provider: 'gemini' }); });
        req.setTimeout(60000, function() { req.destroy(); resolve({ ok: false, error: 'Timeout', provider: 'gemini' }); });
        req.write(postData);
        req.end();
    });
});

// === IPC: CEREBRAS API (format OpenAI-compatible) ===
ipcMain.handle('cerebras-chat', function(event, data) {
    var postData = JSON.stringify({
        model: data.model || CEREBRAS_MODELS.fast,
        messages: data.messages,
        temperature: data.temperature || 0.6,
        max_tokens: data.max_tokens || 3000
    });
    return httpsRequest({
        hostname: 'api.cerebras.ai',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CEREBRAS_KEY,
            'Content-Length': Buffer.byteLength(postData)
        }
    }, postData).then(function(res) {
        if (res.status === 200) {
            var d = JSON.parse(res.body);
            return { ok: true, text: d.choices[0].message.content, model: data.model, provider: 'cerebras' };
        }
        console.log('[CEREBRAS] Error:', res.status, res.body.substring(0, 200));
        return { ok: false, error: 'Status ' + res.status, provider: 'cerebras' };
    })['catch'](function(e) {
        console.log('[CEREBRAS] Exception:', e.message);
        return { ok: false, error: e.message, provider: 'cerebras' };
    });
});

// === IPC: CEREBRAS STREAMING ===
ipcMain.handle('cerebras-stream', function(event, data) {
    if (!checkRateLimit('cerebras-stream')) {
        return Promise.resolve({ ok: false, error: 'Rate limit exceeded.', provider: 'cerebras' });
    }
    var postData = JSON.stringify({
        model: data.model || CEREBRAS_MODELS.fast,
        messages: data.messages,
        temperature: data.temperature || 0.6,
        max_tokens: data.max_tokens || 3000,
        stream: true
    });

    return new Promise(function(resolve) {
        var req = https.request({
            hostname: 'api.cerebras.ai',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + CEREBRAS_KEY,
                'Content-Length': Buffer.byteLength(postData)
            }
        }, function(res) {
            if (res.statusCode !== 200) {
                var errBody = '';
                res.on('data', function(c) { errBody += c; });
                res.on('end', function() {
                    resolve({ ok: false, error: 'Status ' + res.statusCode, provider: 'cerebras' });
                });
                return;
            }
            var fullText = '';
            var buffer = '';
            var _decoder = new StringDecoder('utf8');
            res.on('data', function(chunk) {
                buffer += _decoder.write(chunk);
                var lines = buffer.split('\n');
                buffer = lines.pop();
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line || !line.startsWith('data: ')) continue;
                    var jsonStr = line.substring(6);
                    if (jsonStr === '[DONE]') continue;
                    try {
                        var parsed = JSON.parse(jsonStr);
                        var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
                        if (delta && delta.content) {
                            fullText += delta.content;
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('groq-chunk', delta.content);
                            }
                        }
                    } catch(e) { /* skip */ }
                }
            });
            res.on('end', function() {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('groq-done', fullText);
                }
                setTimeout(function() { resolve({ ok: true, text: fullText, model: data.model, provider: 'cerebras' }); }, 100);
            });
        });
        req.on('error', function(e) { resolve({ ok: false, error: e.message, provider: 'cerebras' }); });
        req.setTimeout(30000, function() { req.destroy(); resolve({ ok: false, error: 'Timeout', provider: 'cerebras' }); });
        req.write(postData);
        req.end();
    });
});

// === IPC: Test tous les providers ===
ipcMain.handle('test-all-providers', function() {
    var tests = [];
    // Groq
    var groqData = JSON.stringify({ model: GROQ_MODELS.fast, messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 });
    tests.push(httpsRequest({ hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Length': Buffer.byteLength(groqData) } }, groqData).then(function(r) { return { provider: 'groq', ok: r.status === 200 }; })['catch'](function() { return { provider: 'groq', ok: false }; }));
    // Gemini (backup #3)
    tests.push(httpsRequest({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models?key=' + getGeminiKey() + '&pageSize=1', method: 'GET', headers: {} }, null).then(function(r) { return { provider: 'gemini', ok: r.status === 200 }; })['catch'](function() { return { provider: 'gemini', ok: false }; }));
    return Promise.all(tests);
});

// === IPC: Fetch URL content (pour resume de page web) ===
ipcMain.handle('fetch-url-content', function(event, url) {
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
        return Promise.resolve({ ok: false, error: 'Invalid URL' });
    }
    return httpGetRaw(url, {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    }).then(function(html) {
        if (!html || html.length < 100) return { ok: false, error: 'Empty page' };
        // Extraire le texte du HTML (supprimer les balises, scripts, styles)
        var text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s{2,}/g, ' ')
            .trim();
        // Extraire le titre
        var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        var title = titleMatch ? titleMatch[1].trim() : '';
        return { ok: true, text: text.substring(0, 8000), title: title, length: text.length };
    })['catch'](function(e) {
        return { ok: false, error: e.message };
    });
});

// === IPC: Pollinations AI (fallback, via main pour CSP) ===
ipcMain.handle('pollinations-chat', function(event, data) {
    var url = 'https://text.pollinations.ai/' + encodeURIComponent(data.prompt) + '?model=openai&jsonMode=true&seed=' + Math.floor(Math.random() * 99999);
    return httpGetRaw(url, { 'User-Agent': 'ETHER-AI/2.0', 'Accept': 'text/plain' }).then(function(text) {
        if (text && text.length > 5) return { ok: true, text: text };
        return { ok: false, error: 'Empty response' };
    })['catch'](function(e) {
        return { ok: false, error: e.message };
    });
});

// === IPC: Telecharger une image et la convertir en base64 (pour cache local) ===
ipcMain.handle('fetch-image', function(event, url) {
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
        return Promise.resolve({ ok: false, error: 'Invalid URL' });
    }
    // Limite: uniquement pollinations
    if (url.indexOf('image.pollinations.ai') === -1) {
        return Promise.resolve({ ok: false, error: 'Only Pollinations images allowed' });
    }
    return new Promise(function(resolve) {
        var mod = url.indexOf('https') === 0 ? https : http;
        mod.get(url, function(res) {
            if (res.statusCode !== 200) { resolve({ ok: false, error: 'Status ' + res.statusCode }); return; }
            var chunks = [];
            var totalSize = 0;
            res.on('data', function(chunk) {
                totalSize += chunk.length;
                if (totalSize > 10 * 1024 * 1024) { res.destroy(); resolve({ ok: false, error: 'Image too large' }); return; }
                chunks.push(chunk);
            });
            res.on('end', function() {
                var buf = Buffer.concat(chunks);
                var mime = res.headers['content-type'] || 'image/jpeg';
                resolve({ ok: true, base64: buf.toString('base64'), mime: mime });
            });
        }).on('error', function() { resolve({ ok: false, error: 'Network error' }); })
          .setTimeout(15000, function() { resolve({ ok: false, error: 'Timeout' }); });
    });
});

// === IPC: TRANSCRIPTION AUDIO (Groq Whisper) ===
ipcMain.handle('transcribe-audio', function(event, audioBuffer) {
    // audioBuffer est un ArrayBuffer envoyé depuis le renderer
    var buf = Buffer.from(audioBuffer);
    // Construire un multipart/form-data manuellement
    var boundary = '----EtherBoundary' + Date.now();
    var body = Buffer.concat([
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo\r\n'),
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="language"\r\n\r\nfr\r\n'),
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n'),
        buf,
        Buffer.from('\r\n--' + boundary + '--\r\n')
    ]);

    return httpsRequest({
        hostname: 'api.groq.com',
        path: '/openai/v1/audio/transcriptions',
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + GROQ_KEY,
            'Content-Type': 'multipart/form-data; boundary=' + boundary,
            'Content-Length': body.length
        }
    }, body).then(function(res) {
        if (res.status === 200) {
            var data = JSON.parse(res.body);
            return { ok: true, text: data.text || '' };
        }
        console.log('[WHISPER] Error:', res.status, res.body.substring(0, 200));
        return { ok: false, error: 'Status ' + res.status };
    })['catch'](function(e) {
        console.log('[WHISPER] Exception:', e.message);
        return { ok: false, error: e.message };
    });
});

// === IPC: Recherche web (pas de CORS en Node.js) ===
ipcMain.handle('web-search', function(event, query) {
    // Tout en parallele pour la vitesse

    // 1. LLM rapide → titres Wikipedia
    var smartTitlesPromise = (function() {
        var postData = JSON.stringify({
            model: GROQ_MODELS.fast,
            messages: [
                { role: 'system', content: 'Donne 3 titres de pages Wikipedia FR pertinents pour repondre a cette question. Separes par |. UNIQUEMENT les titres.' },
                { role: 'user', content: query }
            ],
            temperature: 0.1, max_tokens: 80
        });
        return httpsRequest({
            hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Length': Buffer.byteLength(postData) }
        }, postData).then(function(r) {
            if (r.status === 200) {
                var d = JSON.parse(r.body);
                return d.choices[0].message.content.trim().split('|').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 1 && s.length < 80; }).slice(0, 3);
            }
            return [];
        }).catch(function() { return []; });
    })();

    // 2. DuckDuckGo Instant Answer
    var ddgPromise = httpGet('https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1').then(function(data) {
        if (!data) return [];
        var results = [];
        if (data.Abstract) results.push({ title: data.Heading || query, snippet: data.Abstract, source: data.AbstractSource || 'DuckDuckGo' });
        if (data.Answer) results.push({ title: 'Reponse directe', snippet: data.Answer, source: 'DuckDuckGo' });
        if (data.RelatedTopics) {
            for (var i = 0; i < Math.min(data.RelatedTopics.length, 2); i++) {
                var rt = data.RelatedTopics[i];
                if (rt && rt.Text) results.push({ title: (rt.Text || '').substring(0, 60), snippet: rt.Text, source: 'DuckDuckGo' });
            }
        }
        return results;
    }).catch(function() { return []; });

    // 3. Wikipedia EN (souvent plus complet/a jour)
    var wikiEnPromise = httpGet('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(query) + '&format=json&srlimit=2&origin=*').then(function(data) {
        if (!data || !data.query || !data.query.search || !data.query.search.length) return '';
        var titles = data.query.search.map(function(s) { return s.title; });
        return httpGet('https://en.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(titles.join('|')) + '&prop=extracts&exintro=1&explaintext=1&format=json&origin=*').then(function(d) {
            if (!d || !d.query || !d.query.pages) return '';
            var extracts = [];
            for (var k in d.query.pages) {
                if (d.query.pages[k].extract && d.query.pages[k].extract.length > 50) {
                    extracts.push('=== ' + d.query.pages[k].title + ' (Wikipedia EN) ===\n' + d.query.pages[k].extract.substring(0, 600));
                }
            }
            return extracts.join('\n\n');
        });
    }).catch(function() { return ''; });

    // 4. Wikidata (donnees structurees — dates, chiffres, faits)
    var wikidataPromise = httpGet('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' + encodeURIComponent(query) + '&language=fr&format=json&limit=2').then(function(data) {
        if (!data || !data.search || !data.search.length) return [];
        return data.search.map(function(e) {
            return { title: e.label || '', snippet: e.description || '', source: 'Wikidata' };
        });
    }).catch(function() { return []; });

    // 5. DuckDuckGo HTML Search (vrais resultats web)
    var ddgHtmlPromise = duckDuckGoSearch(query);

    // 6. Swisscows (fallback)
    var swissPromise = swisscowsSearch(query);

    // Combiner tout
    return Promise.all([smartTitlesPromise, ddgPromise, wikiEnPromise, wikidataPromise, ddgHtmlPromise, swissPromise]).then(function(r) {
        var titles = r[0];
        var ddgResults = r[1];
        var wikiEnExtract = r[2];
        var wikidataResults = r[3];
        var ddgHtmlResults = r[4];
        var swissResults = r[5];

        // Wikipedia FR extraits
        var wikiFrPromise = titles.length > 0
            ? httpGet('https://fr.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(titles.join('|')) + '&prop=extracts&exintro=1&explaintext=1&format=json&origin=*')
            : Promise.resolve(null);

        return wikiFrPromise.then(function(wikiData) {
            var extract = '';
            var wikiResults = [];
            if (wikiData && wikiData.query && wikiData.query.pages) {
                var parts = [];
                for (var k in wikiData.query.pages) {
                    var p = wikiData.query.pages[k];
                    if (p.extract && p.extract.length > 50) {
                        parts.push('=== ' + p.title + ' (Wikipedia FR) ===\n' + p.extract.substring(0, 700));
                        wikiResults.push({ title: p.title, snippet: p.extract.substring(0, 120), source: 'Wikipedia FR' });
                    }
                }
                extract = parts.join('\n\n');
            }
            if (wikiEnExtract) extract += (extract ? '\n\n' : '') + wikiEnExtract;
            // Ajouter les snippets Web (DDG + Swisscows) a l'extract pour enrichir le contexte
            var webExtract = '';
            var allWebResults = (ddgHtmlResults || []).concat(swissResults || []);
            if (allWebResults.length > 0) {
                for (var d = 0; d < allWebResults.length; d++) {
                    webExtract += '\n[' + allWebResults[d].source + '] ' + allWebResults[d].title + ': ' + allWebResults[d].snippet;
                }
                if (webExtract) extract += (extract ? '\n\n=== Resultats Web ===\n' : '') + webExtract;
            }
            var allResults = wikiResults.concat(ddgResults).concat(ddgHtmlResults || []).concat(swissResults || []).concat(wikidataResults);
            return { results: allResults, extract: extract };
        });
    }).catch(function() {
        return { results: [], extract: '' };
    });
});

// === IPC: Obtenir les noms de modeles (sans exposer les cles) ===
ipcMain.handle('get-models', function() {
    return { groq: GROQ_MODELS, gemini: GEMINI_MODELS, cerebras: CEREBRAS_MODELS };
});

ipcMain.handle('set-api-key', function(event, key) {
    apiKeyStore = key;
    return true;
});

// Mettre a jour la cle Groq et sauvegarder dans le config
ipcMain.handle('set-groq-key', function(event, key) {
    if (key && key.trim()) {
        GROQ_KEY = key.trim();
        saveApiConfig();
        return { ok: true };
    }
    return { ok: false, error: 'Cle vide' };
});

ipcMain.handle('install-update', function() {
    if (autoUpdater) {
        autoUpdater.quitAndInstall();
        return true;
    }
    return false;
});

ipcMain.handle('get-groq-key-status', function() {
    return {
        hasKey: !!GROQ_KEY,
        isDefault: GROQ_KEY === DEFAULT_GROQ_KEY,
        preview: GROQ_KEY ? GROQ_KEY.substring(0, 8) + '...' + GROQ_KEY.substring(GROQ_KEY.length - 4) : ''
    };
});

ipcMain.handle('get-api-port', function() {
    return API_PORT;
});

// === IPC: Get local IP ===
ipcMain.handle('get-local-ip', function() {
    var interfaces = os.networkInterfaces();
    for (var name in interfaces) {
        var iface = interfaces[name];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
});

// === IPC: Set network mode ===
ipcMain.handle('set-network-mode', function(event, enabled) {
    networkMode = !!enabled;
    // Restart server with new binding
    if (apiServer) {
        apiServer.close(function() {
            startApiServer();
        });
    }
    return true;
});

// === SERVEUR API LOCAL ===
function checkApiAuth(req, res) {
    var authHeader = req.headers['authorization'] || '';
    var providedKey = authHeader.replace('Bearer ', '');
    if (!apiKeyStore || providedKey !== apiKeyStore) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API key' }));
        return false;
    }
    return true;
}

// === RATE LIMITING (IPC + API) ===
var _rateLimits = {};
var RATE_LIMIT_WINDOW = 60000; // 1 minute
var RATE_LIMIT_MAX = 30; // 30 requetes/minute par endpoint

function checkRateLimit(key) {
    var now = Date.now();
    if (!_rateLimits[key]) _rateLimits[key] = { count: 0, reset: now + RATE_LIMIT_WINDOW };
    if (now > _rateLimits[key].reset) { _rateLimits[key] = { count: 0, reset: now + RATE_LIMIT_WINDOW }; }
    _rateLimits[key].count++;
    return _rateLimits[key].count <= RATE_LIMIT_MAX;
}

function startApiServer() {
    var server = http.createServer(function(req, res) {
        // CORS restreint: localhost uniquement, pas wildcard
        var origin = req.headers.origin || '';
        var allowedOrigins = ['http://localhost:' + API_PORT, 'http://127.0.0.1:' + API_PORT];
        if (networkMode) {
            // En mode reseau, accepter les IPs locales
            allowedOrigins.push(origin);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

        // Rate limiting sur l'API
        var clientIp = req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit('api:' + clientIp)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Too many requests. Try again later.' }));
            return;
        }

        // GET /api/health
        if (req.method === 'GET' && req.url === '/api/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', name: 'ETHER AI', version: '2.0' }));
            return;
        }

        // GET /api/status
        if (req.method === 'GET' && req.url === '/api/status') {
            var models = [GROQ_MODELS.main, GROQ_MODELS.reasoning, GROQ_MODELS.fast];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                version: '2.0',
                uptime: Math.floor((Date.now() - appStartTime) / 1000),
                models_available: models.length,
                network_mode: networkMode
            }));
            return;
        }

        // GET /api/models
        if (req.method === 'GET' && req.url === '/api/models') {
            var modelList = [
                { id: GROQ_MODELS.main, name: 'Llama 3.3 70B', type: 'main', provider: 'groq' },
                { id: GROQ_MODELS.reasoning, name: 'Qwen3 32B', type: 'reasoning', provider: 'groq' },
                { id: GROQ_MODELS.fast, name: 'Llama 3.1 8B', type: 'fast', provider: 'groq' },
                { id: GEMINI_MODELS.main, name: 'Gemini 2.5 Flash', type: 'main', provider: 'gemini' },
                { id: CEREBRAS_MODELS.main, name: 'Qwen3 235B', type: 'reasoning', provider: 'cerebras' }
            ];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ models: modelList }));
            return;
        }

        // POST /api/chat
        if (req.method === 'POST' && req.url === '/api/chat') {
            var body = '';
            var bodySize = 0;
            var MAX_BODY = 1024 * 1024; // 1 MB max
            req.on('data', function(chunk) { bodySize += chunk.length; if (bodySize > MAX_BODY) { req.destroy(); return; } body += chunk; });
            req.on('end', function() {
                if (bodySize > MAX_BODY) { res.writeHead(413); res.end(JSON.stringify({ error: 'Request too large' })); return; }
                try {
                    var data = JSON.parse(body);
                    if (!checkApiAuth(req, res)) return;
                    var message = data.message || data.prompt || '';
                    if (!message) { res.writeHead(400); res.end(JSON.stringify({ error: 'Message required' })); return; }

                    var postData = JSON.stringify({
                        model: GROQ_MODELS.main,
                        messages: [
                            { role: 'system', content: 'Tu es ETHER AI, une IA franche. Reponds en francais. Mode: ' + (data.mode || 'base') },
                            { role: 'user', content: message }
                        ],
                        max_tokens: 2048
                    });
                    httpsRequest({
                        hostname: 'api.groq.com',
                        path: '/openai/v1/chat/completions',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Length': Buffer.byteLength(postData) }
                    }, postData).then(function(r) {
                        if (r.status === 200) {
                            var d = JSON.parse(r.body);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ response: d.choices[0].message.content, model: GROQ_MODELS.main }));
                        } else {
                            res.writeHead(500); res.end(JSON.stringify({ error: 'Groq error' }));
                        }
                    }).catch(function() { res.writeHead(500); res.end(JSON.stringify({ error: 'Network error' })); });
                } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); }
            });
            return;
        }

        // POST /api/search
        if (req.method === 'POST' && req.url === '/api/search') {
            var searchBody = '';
            req.on('data', function(chunk) { searchBody += chunk; });
            req.on('end', function() {
                try {
                    var data = JSON.parse(searchBody);
                    if (!checkApiAuth(req, res)) return;
                    var query = data.query || '';
                    if (!query) { res.writeHead(400); res.end(JSON.stringify({ error: 'Query required' })); return; }

                    // Use the same pipeline as web-search IPC
                    var smartTitlesPromise = (function() {
                        var postData = JSON.stringify({
                            model: GROQ_MODELS.fast,
                            messages: [
                                { role: 'system', content: 'Tu generes des titres de pages Wikipedia pertinents pour repondre a une question. Donne 3 titres Wikipedia FR separes par |. UNIQUEMENT les titres, rien d\'autre.' },
                                { role: 'user', content: query }
                            ],
                            temperature: 0.1,
                            max_tokens: 80
                        });
                        return httpsRequest({
                            hostname: 'api.groq.com',
                            path: '/openai/v1/chat/completions',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + GROQ_KEY,
                                'Content-Length': Buffer.byteLength(postData)
                            }
                        }, postData).then(function(r) {
                            if (r.status === 200) {
                                var d = JSON.parse(r.body);
                                var text = d.choices[0].message.content.trim();
                                return text.split('|').map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 1 && t.length < 80; }).slice(0, 4);
                            }
                            return [];
                        }).catch(function() { return []; });
                    })();

                    var ddgPromise = httpGet('https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1').then(function(data) {
                        if (!data) return [];
                        var results = [];
                        if (data.Abstract) results.push({ title: data.Heading || query, snippet: data.Abstract, source: data.AbstractSource || 'DuckDuckGo' });
                        if (data.Answer) results.push({ title: 'Reponse directe', snippet: data.Answer, source: 'DuckDuckGo' });
                        if (data.RelatedTopics) {
                            for (var i = 0; i < Math.min(data.RelatedTopics.length, 2); i++) {
                                var t = data.RelatedTopics[i];
                                if (t && t.Text) results.push({ title: (t.Text || '').substring(0, 60), snippet: t.Text, source: 'DuckDuckGo' });
                            }
                        }
                        return results;
                    });

                    Promise.all([smartTitlesPromise, ddgPromise]).then(function(r) {
                        var titles = r[0];
                        var ddgResults = r[1];
                        if (!titles.length) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ results: ddgResults, extract: '' }));
                            return;
                        }
                        var wikiUrl = 'https://fr.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(titles.join('|')) + '&prop=extracts&exintro=1&explaintext=1&format=json&origin=*';
                        httpGet(wikiUrl).then(function(wikiData) {
                            var extract = '';
                            if (wikiData && wikiData.query && wikiData.query.pages) {
                                var parts = [];
                                for (var k in wikiData.query.pages) {
                                    var p = wikiData.query.pages[k];
                                    if (p.extract && p.extract.length > 50) {
                                        parts.push('=== ' + p.title + ' ===\n' + p.extract.substring(0, 800));
                                    }
                                }
                                extract = parts.join('\n\n');
                            }
                            var wikiResults = titles.map(function(t) { return { title: t, snippet: '', source: 'Wikipedia' }; });
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ results: wikiResults.concat(ddgResults), extract: extract }));
                        });
                    }).catch(function() {
                        res.writeHead(500); res.end(JSON.stringify({ error: 'Search failed' }));
                    });
                } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); }
            });
            return;
        }

        res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.on('error', function(err) {
        if (err.code === 'EADDRINUSE') console.log('Port ' + API_PORT + ' already in use, skipping.');
        else console.error('API server error:', err);
    });
    var host = networkMode ? '0.0.0.0' : '127.0.0.1';
    server.listen(API_PORT, host, function() { console.log('ETHER API running on http://' + host + ':' + API_PORT); });
    apiServer = server;
}

var mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        title: 'ETHER AI',
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0d0d0d',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile('index.html');

    // === PERMISSIONS (micro, camera) ===
    mainWindow.webContents.session.setPermissionRequestHandler(function(webContents, permission, callback) {
        var allowed = ['media', 'microphone', 'speech', 'notifications', 'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'];
        callback(allowed.indexOf(permission) !== -1);
    });

    // === CONTENT SECURITY POLICY ===
    mainWindow.webContents.session.webRequest.onHeadersReceived(function(details, callback) {
        callback({
            responseHeaders: Object.assign({}, details.responseHeaders, {
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com; " +
                    "img-src 'self' data: blob: https://image.pollinations.ai https://*.wikipedia.org; " +
                    "connect-src 'self'; " +
                    "media-src 'self' blob:; " +
                    "object-src 'none'; " +
                    "base-uri 'self'; " +
                    "form-action 'none'"
                ]
            })
        });
    });

    // Log renderer console messages
    mainWindow.webContents.on('console-message', function(event, level, message, line, sourceId) {
        if (message.indexOf('[ENGINE]') !== -1 || message.indexOf('[VOICE]') !== -1 || level >= 2) {
            console.log('[R]', message.substring(0, 300));
        }
    });
    mainWindow.on('closed', function() { mainWindow = null; });

    // Notifier le renderer du focus/blur pour les notifications
    mainWindow.on('focus', function() {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('window-focus');
    });
    mainWindow.on('blur', function() {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('window-blur');
    });
}

app.whenReady().then(function() {
    loadApiConfig();
    loadEmailConfig();
    createWindow();
    startApiServer();

    // === AUTO-UPDATER ===
    if (autoUpdater) {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('update-available', function(info) {
            console.log('[UPDATE] Mise a jour disponible:', info.version);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-available', info.version);
            }
        });

        autoUpdater.on('update-downloaded', function(info) {
            console.log('[UPDATE] Mise a jour telechargee:', info.version);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-downloaded', info.version);
            }
        });

        autoUpdater.on('error', function(err) {
            console.log('[UPDATE] Erreur:', err.message);
        });

        // Verifier les mises a jour toutes les 4 heures
        try { autoUpdater.checkForUpdatesAndNotify(); } catch(e) { console.log('[UPDATE] Check failed:', e.message); }
        setInterval(function() {
            try { autoUpdater.checkForUpdatesAndNotify(); } catch(e) {}
        }, 4 * 60 * 60 * 1000);
    }
});
app.on('window-all-closed', function() { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', function() { if (mainWindow === null) createWindow(); });

// === MEMOIRE PERSISTANTE (Robuste — fichiers individuels) ===
var userDataPath = app.getPath('userData');
var storageDir = path.join(userDataPath, 'ether_storage');
if (!fs.existsSync(storageDir)) {
    try { fs.mkdirSync(storageDir, { recursive: true }); } catch(e) { console.error('[STORAGE] Failed to create dir:', e.message); }
}

function getSafeFilename(key) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
}

function readPersist() {
    // Legacy support for single file
    var legacyPath = path.join(userDataPath, 'ether-data.json');
    var allData = {};
    try {
        if (fs.existsSync(legacyPath)) allData = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
        // Read all files in storage dir
        if (fs.existsSync(storageDir)) {
            var files = fs.readdirSync(storageDir);
            for (var i = 0; i < files.length; i++) {
                if (!files[i].endsWith('.json')) continue;
                try {
                    var key = files[i].replace('.json', '');
                    allData[key] = JSON.parse(fs.readFileSync(path.join(storageDir, files[i]), 'utf8'));
                } catch(e) {}
            }
        }
    } catch(e) { console.error('[PERSIST] Read error:', e.message); }
    return allData;
}

ipcMain.handle('persist-read', function() {
    return readPersist();
});

ipcMain.handle('persist-get', function(event, key) {
    try {
        var filePath = path.join(storageDir, getSafeFilename(key));
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Fallback legacy single file
        var legacyPath = path.join(userDataPath, 'ether-data.json');
        if (fs.existsSync(legacyPath)) {
            var data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
            return data[key] !== undefined ? data[key] : null;
        }
    } catch(e) {}
    return null;
});

ipcMain.handle('persist-set', function(event, key, value) {
    try {
        var filePath = path.join(storageDir, getSafeFilename(key));
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
        return true;
    } catch(e) { console.error('[PERSIST] Write error for ' + key + ':', e.message); return false; }
});

ipcMain.handle('persist-delete', function(event, key) {
    try {
        var filePath = path.join(storageDir, getSafeFilename(key));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return true;
    } catch(e) { return false; }
});

ipcMain.handle('get-user-data-path', function() {
    return userDataPath;
});

// === QUOTAS SECURISES (cote main process, pas bypassable via DevTools) ===
var crypto = require('crypto');

// Generer ou charger un secret HMAC unique par installation (pas hardcode)
function getOrCreateQuotaSecret() {
    var secretPath = path.join(userDataPath, '.quota-secret');
    try {
        if (fs.existsSync(secretPath)) {
            return fs.readFileSync(secretPath, 'utf8').trim();
        }
    } catch(e) { /* regenerate */ }
    var secret = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(secretPath, secret, { mode: 0o600 }); } catch(e) { console.error('[QUOTA] Cannot save secret:', e.message); }
    return secret;
}
var QUOTA_SECRET = getOrCreateQuotaSecret();

function signQuota(obj) {
    var payload = obj.date + ':' + obj.count + ':' + (obj.adLevel || 0);
    return crypto.createHmac('sha256', QUOTA_SECRET).update(payload).digest('hex').substring(0, 16);
}

function verifyQuota(obj) {
    if (!obj || !obj.sig) return false;
    return obj.sig === signQuota(obj);
}

ipcMain.handle('quota-check', function(event, key) {
    var data = readPersist();
    var qKey = 'quota_' + key;
    var q = data[qKey] || { date: '', count: 0, adLevel: 0 };
    var today = new Date().toISOString().slice(0, 10);
    if (q.date !== today) {
        q = { date: today, count: 0, adLevel: 0 };
        q.sig = signQuota(q);
        data[qKey] = q;
        writePersist(data);
    } else if (!verifyQuota(q)) {
        // Signature invalide = quota tampered
        q = { date: today, count: 999, adLevel: 0 };
        q.sig = signQuota(q);
        data[qKey] = q;
        writePersist(data);
    }
    return q;
});

ipcMain.handle('quota-use', function(event, key) {
    var data = readPersist();
    var qKey = 'quota_' + key;
    var today = new Date().toISOString().slice(0, 10);
    var q = data[qKey] || { date: today, count: 0, adLevel: 0 };
    if (q.date !== today) q = { date: today, count: 0, adLevel: 0 };
    q.count++;
    q.sig = signQuota(q);
    data[qKey] = q;
    writePersist(data);
    return q;
});

ipcMain.handle('quota-ad-bonus', function(event, key, bonus) {
    var data = readPersist();
    var qKey = 'quota_' + key;
    var today = new Date().toISOString().slice(0, 10);
    var q = data[qKey] || { date: today, count: 0, adLevel: 0 };
    if (q.date !== today) q = { date: today, count: 0, adLevel: 0 };
    q.adLevel = Math.min((q.adLevel || 0) + 1, 5);
    q.sig = signQuota(q);
    data[qKey] = q;
    writePersist(data);
    return q;
});

ipcMain.handle('quota-verify-pro', function(event) {
    var data = readPersist();
    var pro = data.pro_status;
    if (!pro || !pro.sig) return false;
    var expected = crypto.createHmac('sha256', QUOTA_SECRET).update('pro:' + (pro.email || '')).digest('hex').substring(0, 16);
    return pro.sig === expected;
});

// === THEME SYSTEME ===
var nativeTheme = electron.nativeTheme;

ipcMain.handle('get-system-theme', function() {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// Notifier le renderer quand le theme systeme change
nativeTheme.on('updated', function() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
    }
});

// === IPC: FICHIERS ===
var fsPromises = require('fs').promises;

ipcMain.handle('open-file', function() {
    var ALLOWED_EXTENSIONS = ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp',
        '.pdf','.doc','.docx','.txt','.csv','.xls','.xlsx','.pptx','.rtf','.md','.json',
        '.js','.html','.css','.py'];
    var TEXT_EXTENSIONS = ['.txt', '.csv', '.md', '.json', '.js', '.html', '.css', '.py', '.rtf'];
    var IMAGE_EXTENSIONS = ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp'];

    return dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'csv', 'xls', 'xlsx', 'pptx', 'rtf', 'md', 'json'] },
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'] }
        ]
    }).then(function(result) {
        if (result.canceled) return null;
        var files = [];
        var readPromises = [];

        for (var i = 0; i < result.filePaths.length; i++) {
            var fp = result.filePaths[i];
            var ext = path.extname(fp).toLowerCase();
            // Valider l'extension
            if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) continue;
            var stat = fs.statSync(fp);
            // Limite de taille: 50 MB
            if (stat.size > MAX_FILE_SIZE) { console.warn('[FILE] Skipping oversized file:', fp, stat.size); continue; }
            files.push({ name: path.basename(fp), path: fp, size: stat.size, ext: ext, content: null, isImage: IMAGE_EXTENSIONS.indexOf(ext) !== -1, base64: null });
        }

        // Lire les fichiers en async
        for (var fi = 0; fi < files.length; fi++) {
            (function(idx) {
                var f = files[idx];
                if (TEXT_EXTENSIONS.indexOf(f.ext) !== -1) {
                    readPromises.push(fsPromises.readFile(f.path, 'utf8').then(function(data) { f.content = data; })['catch'](function() { f.content = null; }));
                }
                if (f.isImage) {
                    readPromises.push(fsPromises.readFile(f.path).then(function(buf) {
                        f.base64 = buf.toString('base64');
                        f.mime = f.ext === '.png' ? 'image/png' : f.ext === '.gif' ? 'image/gif' : 'image/jpeg';
                    })['catch'](function() { f.base64 = null; }));
                }
                if (f.ext === '.pdf') {
                    readPromises.push(fsPromises.readFile(f.path).then(function(buf) { return pdfParse(buf); }).then(function(data) { f.content = data.text; })['catch'](function() { f.content = null; }));
                }
                if (f.ext === '.docx') {
                    readPromises.push(mammoth.extractRawText({ path: f.path }).then(function(result) { f.content = result.value; })['catch'](function() { f.content = null; }));
                }
                if (f.ext === '.xlsx' || f.ext === '.xls') {
                    readPromises.push(fsPromises.readFile(f.path).then(function(buf) {
                        var wb = XLSX.read(buf);
                        var text = '';
                        for (var s = 0; s < wb.SheetNames.length && s < 20; s++) {
                            text += '--- Feuille: ' + wb.SheetNames[s] + ' ---\n' + XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[s]]) + '\n\n';
                        }
                        f.content = text;
                    })['catch'](function() { f.content = null; }));
                }
                if (f.ext === '.pptx') {
                    readPromises.push((function() {
                        try {
                            var AdmZip = require('adm-zip');
                            var zip = new AdmZip(f.path);
                            var entries = zip.getEntries();
                            var text = '';
                            for (var e = 0; e < entries.length; e++) {
                                if (entries[e].entryName.indexOf('ppt/slides/slide') !== -1) {
                                    var xml = entries[e].getData().toString('utf8');
                                    var matches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
                                    if (matches) {
                                        for (var m = 0; m < matches.length; m++) text += matches[m].replace(/<[^>]+>/g, '') + ' ';
                                        text += '\n';
                                    }
                                }
                            }
                            f.content = text || null;
                        } catch(e) { f.content = null; }
                        return Promise.resolve();
                    })());
                }
            })(fi);
        }

        return Promise.all(readPromises).then(function() { return files; });
    });
});

ipcMain.handle('save-file', function(event, data) {
    return dialog.showSaveDialog(mainWindow, { defaultPath: data.name, filters: [{ name: 'Tous', extensions: ['*'] }] }).then(function(result) { if (result.canceled) return false; fs.writeFileSync(result.filePath, data.content); return true; });
});

ipcMain.handle('browse-folder', function() {
    return dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] }).then(function(result) {
        if (result.canceled) return null;
        var dirPath = result.filePaths[0];
        var items;
        try { items = fs.readdirSync(dirPath); } catch(e) { return null; }
        var files = [];
        // Limiter a 500 fichiers pour eviter les freezes sur de gros repertoires
        var maxItems = Math.min(items.length, 500);
        for (var i = 0; i < maxItems; i++) {
            try {
                var fp = path.join(dirPath, items[i]);
                // Ignorer les fichiers caches/systeme
                if (items[i].startsWith('.')) continue;
                var stat = fs.statSync(fp);
                files.push({ name: items[i], path: fp, size: stat.size, isDir: stat.isDirectory(), ext: path.extname(items[i]).toLowerCase() });
            } catch(e) {}
        }
        return { path: dirPath, files: files };
    });
});

// === Validation de chemin securisee ===
var MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB max
var ALLOWED_READ_DIRS = [
    os.homedir(),
    app.getPath('userData'),
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('temp')
];

function isPathAllowed(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    var resolved = path.resolve(filePath);
    // Bloquer les chemins systeme critiques
    var blocked = ['/etc', '/usr', '/bin', '/sbin', '/var', '/System', '/Library',
                   'C:\\Windows', 'C:\\Program Files'];
    for (var b = 0; b < blocked.length; b++) {
        if (resolved.startsWith(blocked[b])) return false;
    }
    // Autoriser les chemins dans les repertoires utilisateur
    for (var a = 0; a < ALLOWED_READ_DIRS.length; a++) {
        if (resolved.startsWith(ALLOWED_READ_DIRS[a])) return true;
    }
    return false;
}

ipcMain.handle('read-file', function(event, filePath) {
    try {
        if (!isPathAllowed(filePath)) {
            console.warn('[SECURITY] Blocked read-file access to:', filePath);
            return null;
        }
        var stat = fs.statSync(filePath);
        if (stat.size > MAX_FILE_SIZE) {
            console.warn('[SECURITY] File too large:', filePath, stat.size);
            return null;
        }
        return fs.readFileSync(filePath, 'utf8');
    } catch(e) { return null; }
});

ipcMain.handle('open-external', function(event, url) {
    // Valider l'URL — uniquement http/https
    if (!url || typeof url !== 'string') return;
    try {
        var parsed = new (require('url').URL)(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
            console.warn('[SECURITY] Blocked open-external with protocol:', parsed.protocol);
            return;
        }
        shell.openExternal(url);
    } catch(e) {
        console.warn('[SECURITY] Invalid URL for open-external:', url);
    }
});

// EmailJS credentials — chargees depuis la config, pas hardcodees
var EMAIL_CONFIG = {
    service_id: 'service_pofhwmo',
    template_id: 'template_qy7sylx',
    user_id: 'uvp3tvPMuJ14CLvc3'
};

function loadEmailConfig() {
    try {
        var configPath = path.join(app.getPath('userData'), 'email-config.json');
        if (fs.existsSync(configPath)) {
            var config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.service_id) EMAIL_CONFIG.service_id = config.service_id;
            if (config.template_id) EMAIL_CONFIG.template_id = config.template_id;
            if (config.user_id) EMAIL_CONFIG.user_id = config.user_id;
        } else {
            // Sauvegarder la config par defaut pour permettre la modification
            fs.writeFileSync(configPath, JSON.stringify(EMAIL_CONFIG, null, 2), 'utf8');
        }
    } catch(e) { /* use defaults */ }
}

ipcMain.handle('send-email', function(event, data) {
    // Valider les donnees d'entree
    if (!data || !data.email || typeof data.email !== 'string') {
        return Promise.reject(new Error('Invalid email data'));
    }
    // Valider le format email basique
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return Promise.reject(new Error('Invalid email format'));
    }
    // Rate limit: max 5 emails par minute
    if (!checkRateLimit('email')) {
        return Promise.reject(new Error('Too many email requests'));
    }
    var postData = JSON.stringify({
        service_id: EMAIL_CONFIG.service_id,
        template_id: EMAIL_CONFIG.template_id,
        user_id: EMAIL_CONFIG.user_id,
        template_params: { prenom: String(data.prenom || '').substring(0, 100), email: data.email, to_email: data.email }
    });
    return new Promise(function(resolve, reject) {
        var req = https.request({ hostname: 'api.emailjs.com', path: '/api/v1.0/email/send', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'Origin': 'https://ether-ai.app' } }, function(res) { var body = ''; res.on('data', function(c) { body += c; }); res.on('end', function() { if (res.statusCode === 200) resolve(true); else reject(new Error('Status ' + res.statusCode)); }); });
        req.on('error', function(e) { reject(e); }); req.write(postData); req.end();
    });
});
