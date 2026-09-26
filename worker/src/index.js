/**
 * ETHER API — Cloudflare Worker
 * Proxy securise entre le client (web ou Electron) et les providers IA.
 * Les cles API sont dans les Cloudflare Secrets, jamais exposees au client.
 */

// Registre des providers : evite tout repli silencieux sur un provider par defaut.
const PROVIDERS = {
  groq:     { key: 'GROQ_KEY',     chat: callGroq,     stream: (env, m, ms, t, mt) => streamOpenAICompat(env, 'api.groq.com', env.GROQ_KEY, m || 'openai/gpt-oss-120b', ms, t, mt) },
  gemini:   { key: 'GEMINI_KEY',   chat: callGemini,   stream: streamGemini },
  cerebras: { key: 'CEREBRAS_KEY', chat: callCerebras, stream: (env, m, ms, t, mt) => streamOpenAICompat(env, 'api.cerebras.ai', env.CEREBRAS_KEY, m || 'gpt-oss-120b', ms, t, mt) },
  mistral:  { key: 'MISTRAL_KEY',  chat: callMistral,  stream: (env, m, ms, t, mt) => streamOpenAICompat(env, 'api.mistral.ai', env.MISTRAL_KEY, m || 'mistral-medium-latest', ms, t, mt) },
  openrouter: { key: 'OPENROUTER_KEY', chat: callOpenRouter, stream: (env, m, ms, t, mt) => streamOpenRouter(env, m, ms, t, mt) },
  // Pollinations : palier anonyme, aucune cle requise.
  // Attention : l'alias "openai" tape sur un compte credite et renvoie une
  // erreur DANS un HTTP 200. Le modele anonyme est "openai-fast".
  pollinations: { keyless: true, chat: callPollinations, stream: streamPollinations }
};

// Verifie qu'un provider existe ET qu'il est configure. Renvoie une Response
// d'erreur explicite, ou null si tout va bien.
function checkProvider(provider, env) {
  const p = PROVIDERS[provider];
  if (!p) {
    return json({ ok: false, error: `Provider inconnu : ${provider}`, available: Object.keys(PROVIDERS) }, 400, env);
  }
  if (p.keyless) return null;
  if (!env[p.key]) {
    return json({ ok: false, error: `Provider non configure sur le serveur : ${provider}`, hint: `Deployer la cle avec : npx wrangler secret put ${p.key}` }, 503, env);
  }
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // --- HEALTH ---
      if (path === '/api/health') {
        return json({ status: 'ok', name: 'ETHER API', version: '2.1', providers: configuredProviders(env) }, 200, env);
      }

      // --- AUTH sur les routes protegees ---
      if (path.startsWith('/api/chat') || path.startsWith('/api/quota') ||
          path.startsWith('/api/vision') || path.startsWith('/api/transcribe') ||
          path.startsWith('/api/fetch') || path.startsWith('/api/image') ||
          path.startsWith('/api/search')) {
        const authErr = await verifyAuth(request, env);
        if (authErr) return authErr;
      }

      // --- CHAT ---
      if (path === '/api/chat' && request.method === 'POST') {
        const body = await request.json();
        const provider = body.provider || 'gemini';

        const bad = checkProvider(provider, env);
        if (bad) return bad;

        const messages = body.messages;
        if (!messages || !messages.length) return json({ ok: false, error: 'Messages required' }, 400, env);

        // Quota impose ici : un client ne peut pas le contourner en
        // sautant l'appel a /api/quota/use.
        const q = await quotaConsume(request, env);
        if (!q.ok) return json(q, 429, env);

        const result = await PROVIDERS[provider].chat(
          env, body.model, messages, body.temperature ?? 0.7, body.max_tokens || 4000
        );
        return json(result, result.ok ? 200 : 502, env);
      }

      // --- CHAT STREAM (SSE) ---
      if (path === '/api/chat/stream' && request.method === 'POST') {
        const body = await request.json();
        const provider = body.provider || 'gemini';

        const bad = checkProvider(provider, env);
        if (bad) return bad;

        const messages = body.messages;
        if (!messages || !messages.length) return json({ ok: false, error: 'Messages required' }, 400, env);

        const q = await quotaConsume(request, env);
        if (!q.ok) return json(q, 429, env);

        return PROVIDERS[provider].stream(
          env, body.model, messages, body.temperature ?? 0.7, body.max_tokens || 4000
        );
      }

      // --- MODELS : catalogue par provider ---
      if (path === '/api/models') {
        // Liste vivante : evite que des identifiants de modeles perimes
        // provoquent des 404 silencieux comme avant.
        let models = MODELS;
        try {
          const live = await diagnose(env);
          const merged = {};
          for (const p of Object.keys(PROVIDERS)) {
            const l = live[p];
            merged[p] = (l && l.models && l.models.length) ? l.models : (MODELS[p] || []);
          }
          models = merged;
        } catch (e) { /* repli sur le catalogue statique */ }
        return json({ ok: true, models, configured: configuredProviders(env) }, 200, env);
      }

      // --- VISION (Gemini) ---
      if (path === '/api/vision' && request.method === 'POST') {
        const bad = checkProvider('gemini', env);
        if (bad) return bad;
        const body = await request.json();
        return json(await callGeminiVision(env, body), 200, env);
      }

      // --- TRANSCRIPTION AUDIO (Whisper via Groq) ---
      if (path === '/api/transcribe' && request.method === 'POST') {
        const bad = checkProvider('groq', env);
        if (bad) return bad;
        return json(await transcribeAudio(env, request), 200, env);
      }

      // --- PROXY DE CONTENU (avec garde SSRF) ---
      if (path === '/api/fetch' && request.method === 'POST') {
        const body = await request.json();
        return json(await proxyFetch(body.url, 'text'), 200, env);
      }
      if (path === '/api/image' && request.method === 'POST') {
        const body = await request.json();
        return json(await proxyFetch(body.url, 'image'), 200, env);
      }

      // --- RECHERCHE WEB ---
      // Meme contrat que l'IPC 'web-search' du desktop : { results, extract }.
      if (path === '/api/search') {
        const query = request.method === 'POST'
          ? ((await request.json().catch(() => ({}))).query || '')
          : (url.searchParams.get('q') || '');
        if (!String(query).trim()) return json({ ok: false, error: 'Requete vide' }, 400, env);
        return json(await webSearch(env, String(query).slice(0, 300)), 200, env);
      }

      // --- EMAIL : pas de service configure ---
      if (path === '/api/email') {
        return json({ ok: false, error: 'Envoi d email non configure', hint: 'Necessite un service type Resend : npx wrangler secret put RESEND_KEY' }, 501, env);
      }

      // --- REGISTER ---
      if (path === '/api/register' && request.method === 'POST') {
        const body = await request.json();
        if (!body.email || !body.name) return json({ ok: false, error: 'Email and name required' }, 400, env);
        if (!env.JWT_SECRET) return json({ ok: false, error: 'JWT_SECRET absent sur le serveur' }, 503, env);

        // Code d'invitation : sans lui, n'importe qui ayant le lien peut
        // creer un compte et consommer les quotas du proprietaire.
        // Si INVITE_CODE n'est pas defini, l'inscription reste ouverte.
        if (env.INVITE_CODE) {
          const fourni = (body.code || '').trim();
          if (!fourni) {
            return json({ ok: false, error: 'Code d invitation requis', needCode: true }, 403, env);
          }
          if (!timingSafeEqual(fourni, env.INVITE_CODE)) {
            return json({ ok: false, error: 'Code d invitation invalide', needCode: true }, 403, env);
          }
        }

        const token = await createJWT({ email: body.email, name: body.name, pro: false }, env.JWT_SECRET);
        return json({ ok: true, token }, 200, env);
      }

      // --- VERIFY TOKEN ---
      if (path === '/api/verify' && request.method === 'POST') {
        const body = await request.json();
        const payload = await verifyJWT(body.token, env.JWT_SECRET);
        if (payload) return json({ ok: true, user: payload }, 200, env);
        return json({ ok: false, error: 'Invalid token' }, 401, env);
      }

      // --- QUOTAS ---
      if (path === '/api/quota' && request.method === 'GET') {
        return json(await quotaRead(request, env), 200, env);
      }
      if (path === '/api/quota/use' && request.method === 'POST') {
        return json(await quotaConsume(request, env), 200, env);
      }
      if (path === '/api/quota/bonus' && request.method === 'POST') {
        const body = await request.json();
        return json(await quotaBonus(request, env, body.bonus), 200, env);
      }
      if (path === '/api/quota/pro' && request.method === 'GET') {
        const user = await currentUser(request, env);
        return json({ ok: true, pro: !!(user && user.pro) }, 200, env);
      }

      // --- DIAG : modeles reellement disponibles chez chaque provider ---
      if (path === '/api/diag') {
        return json({ ok: true, diag: await diagnose(env) }, 200, env);
      }

      // --- PERSISTANCE UTILISATEUR (synchronisation multi-appareils) ---
      if (path === '/api/persist') {
        const authErr = await verifyAuth(request, env);
        if (authErr) return authErr;
        const user = await currentUser(request, env);
        if (request.method === 'GET')  return json(await persistRead(env, user), 200, env);
        if (request.method === 'POST') return json(await persistWrite(env, user, await request.json()), 200, env);
      }

      // --- PROVIDERS STATUS ---
      if (path === '/api/providers') {
        return json({ ok: true, providers: await testProviders(env) }, 200, env);
      }
      if (path === '/api/providers/test' && request.method === 'POST') {
        const body = await request.json();
        const bad = checkProvider(body.id, env);
        if (bad) return bad;
        const r = await PROVIDERS[body.id].chat(env, null, [{ role: 'user', content: 'ok' }], 0.1, 5);
        return json({ ok: r.ok, error: r.error }, 200, env);
      }

      // --- STRIPE: checkout ---
      if (path === '/api/stripe/checkout' && request.method === 'POST') {
        if (!env.STRIPE_SECRET) return json({ error: 'Stripe non configure' }, 503, env);
        const body = await request.json();
        if (!body.email) return json({ error: 'Email required' }, 400, env);

        const session = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(env.STRIPE_SECRET + ':'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            'mode': 'subscription',
            'customer_email': body.email,
            'line_items[0][price]': env.STRIPE_PRICE_ID || 'price_placeholder',
            'line_items[0][quantity]': '1',
            'success_url': 'https://ether-ai.app/success?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url': 'https://ether-ai.app/cancel',
            'metadata[app]': 'ether'
          }).toString()
        });
        const data = await session.json();
        if (data.url) return json({ ok: true, url: data.url }, 200, env);
        return json({ ok: false, error: data.error?.message || 'Stripe error' }, 400, env);
      }

      // --- STRIPE: webhook ---
      if (path === '/api/stripe/webhook' && request.method === 'POST') {
        if (!env.STRIPE_SECRET) return json({ error: 'Stripe non configure' }, 503, env);
        const body = await request.text();
        try {
          const event = JSON.parse(body);
          if (event.type === 'checkout.session.completed') {
            console.log('[STRIPE] Pro active pour:', event.data.object.customer_email);
          }
          if (event.type === 'customer.subscription.deleted') {
            console.log('[STRIPE] Pro desactive pour customer:', event.data.object.customer);
          }
          return json({ received: true }, 200, env);
        } catch (e) {
          return json({ error: 'Invalid webhook payload' }, 400, env);
        }
      }

      // --- STRIPE: statut Pro ---
      if (path === '/api/stripe/status' && request.method === 'POST') {
        const body = await request.json();
        if (!body.email) return json({ error: 'Email required' }, 400, env);
        return json({ ok: true, pro: false, email: body.email }, 200, env);
      }

      return json({ error: 'Not found' }, 404, env);

    } catch (err) {
      return json({ error: err.message || 'Internal error' }, 500, env);
    }
  }
};

// === CORS ===
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env?.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status = 200, env = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) }
  });
}

function configuredProviders(env) {
  return Object.keys(PROVIDERS).filter(p => PROVIDERS[p].keyless || !!env[PROVIDERS[p].key]);
}

// === BASE64 URL-SAFE (gere les accents : btoa seul casse sur "Zoe" accentue) ===
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToString(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function bytesToB64url(buf) {
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// === AUTH (JWT HS256) ===
async function createJWT(payload, secret) {
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlEncode(JSON.stringify({
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000
  }));
  const data = header + '.' + body;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + bytesToB64url(sig);
}

async function verifyJWT(token, secret) {
  try {
    if (!token || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const data = header + '.' + body;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, b64urlToBytes(sig), new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(b64urlDecodeToString(body));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// Verifie REELLEMENT le token. L'ancienne version acceptait n'importe quel
// Bearer non vide, ce qui laissait les quotas ouverts a tout le monde.
async function verifyAuth(request, env) {
  if (!env.JWT_SECRET) return null; // dev local sans secret
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return json({ ok: false, error: 'Authorization required' }, 401, env);
  }
  const payload = await verifyJWT(auth.slice(7).trim(), env.JWT_SECRET);
  if (!payload) {
    return json({ ok: false, error: 'Token invalide ou expire' }, 401, env);
  }
  return null;
}

async function currentUser(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return await verifyJWT(auth.slice(7).trim(), env.JWT_SECRET);
}

// === QUOTAS ===
// Sans KV, le quota reste indicatif. Avec le binding ETHER_KV il devient reel.
const DAILY_LIMIT = 30;

function quotaKey(user) {
  const day = new Date().toISOString().slice(0, 10);
  return `quota:${(user && user.email) || 'anon'}:${day}`;
}

async function quotaRead(request, env) {
  const user = await currentUser(request, env);
  if (user && user.pro) return { ok: true, unlimited: true, pro: true };
  if (!env.ETHER_KV) return { ok: true, remaining: DAILY_LIMIT, limit: DAILY_LIMIT, tracked: false };
  const raw = await env.ETHER_KV.get(quotaKey(user));
  const used = raw ? parseInt(raw, 10) : 0;
  return { ok: true, remaining: Math.max(0, DAILY_LIMIT - used), limit: DAILY_LIMIT, tracked: true };
}

async function quotaConsume(request, env) {
  const user = await currentUser(request, env);
  if (user && user.pro) return { ok: true, unlimited: true };
  if (!env.ETHER_KV) return { ok: true, tracked: false };
  const k = quotaKey(user);
  const raw = await env.ETHER_KV.get(k);
  const used = (raw ? parseInt(raw, 10) : 0) + 1;
  if (used > DAILY_LIMIT) return { ok: false, error: 'Quota journalier atteint', remaining: 0 };
  await env.ETHER_KV.put(k, String(used), { expirationTtl: 172800 });
  return { ok: true, remaining: Math.max(0, DAILY_LIMIT - used), tracked: true };
}

async function quotaBonus(request, env, bonus) {
  const user = await currentUser(request, env);
  if (!env.ETHER_KV) return { ok: true, tracked: false };
  const n = Math.max(0, Math.min(10, parseInt(bonus, 10) || 0));
  const k = quotaKey(user);
  const raw = await env.ETHER_KV.get(k);
  const used = Math.max(0, (raw ? parseInt(raw, 10) : 0) - n);
  await env.ETHER_KV.put(k, String(used), { expirationTtl: 172800 });
  return { ok: true, remaining: Math.max(0, DAILY_LIMIT - used), tracked: true };
}

// === PROXY DE CONTENU (garde SSRF) ===
// Empeche le worker de servir de relais vers des adresses internes.
const BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|.*\.internal|.*\.local)$/i;

async function proxyFetch(target, kind) {
  let u;
  try { u = new URL(target); } catch { return { ok: false, error: 'URL invalide' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'Protocole non autorise' };
  }
  if (BLOCKED_HOSTS.test(u.hostname)) {
    return { ok: false, error: 'Adresse interne refusee' };
  }
  try {
    const resp = await fetch(u.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'EtherAI/2.1' },
      cf: { cacheTtl: 300 }
    });
    if (!resp.ok) return { ok: false, error: 'HTTP ' + resp.status };

    if (kind === 'image') {
      const ct = resp.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) return { ok: false, error: 'Pas une image' };
      const buf = await resp.arrayBuffer();
      if (buf.byteLength > 5 * 1024 * 1024) return { ok: false, error: 'Image trop volumineuse (>5 Mo)' };
      let bin = '';
      for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
      return { ok: true, dataUrl: `data:${ct};base64,` + btoa(bin) };
    }

    const text = await resp.text();
    return { ok: true, content: text.slice(0, 200000), truncated: text.length > 200000 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// === PROVIDERS ===

async function callOpenAICompat(hostname, apiKey, defaultModel, label, model, messages, temperature, maxTokens, extraHeaders) {
  const resp = await fetch(`https://${hostname}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey, ...(extraHeaders || {}) },
    body: JSON.stringify({ model: model || defaultModel, messages, temperature, max_tokens: maxTokens })
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return { ok: false, error: `${label} error ${resp.status}`, detail: detail.slice(0, 300), provider: label };
  }
  const data = await resp.json();
  return { ok: true, text: data.choices[0].message.content, model: model || defaultModel, provider: label };
}

function callGroq(env, model, messages, temperature, maxTokens) {
  return callOpenAICompat('api.groq.com/openai', env.GROQ_KEY, 'openai/gpt-oss-120b', 'groq', model, messages, temperature, maxTokens);
}

function callCerebras(env, model, messages, temperature, maxTokens) {
  return callOpenAICompat('api.cerebras.ai', env.CEREBRAS_KEY, 'gpt-oss-120b', 'cerebras', model, messages, temperature, maxTokens);
}

function callMistral(env, model, messages, temperature, maxTokens) {
  return callOpenAICompat('api.mistral.ai', env.MISTRAL_KEY, 'mistral-medium-latest', 'mistral', model, messages, temperature, maxTokens);
}

function geminiBody(messages, temperature, maxTokens, model) {
  const contents = [];
  let systemInstruction = null;
  for (const m of messages) {
    if (m.role === 'system') systemInstruction = { parts: [{ text: m.content }] };
    else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
  }
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature } };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (model.includes('2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };
  return body;
}

async function callGemini(env, model, messages, temperature, maxTokens) {
  model = model || 'gemini-flash-latest';
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody(messages, temperature, maxTokens, model))
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return { ok: false, error: 'Gemini error ' + resp.status, detail: detail.slice(0, 400), provider: 'gemini' };
  }
  const data = await resp.json();
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    let text = '';
    for (const p of data.candidates[0].content.parts) { if (!p.thought) text += p.text || ''; }
    return { ok: true, text, model, provider: 'gemini' };
  }
  return { ok: false, error: 'No candidates', provider: 'gemini' };
}

async function callGeminiVision(env, body) {
  const model = body.model || 'gemini-flash-latest';
  const parts = [{ text: body.prompt || 'Decris cette image.' }];
  if (body.image) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(body.image);
    if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    else parts.push({ inline_data: { mime_type: body.mimeType || 'image/png', data: body.image } });
  }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] })
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return { ok: false, error: 'Gemini vision error ' + resp.status, detail: detail.slice(0, 400) };
  }
  const data = await resp.json();
  const c = data.candidates && data.candidates[0];
  if (!c || !c.content) return { ok: false, error: 'No candidates' };
  let text = '';
  for (const p of c.content.parts) { if (!p.thought) text += p.text || ''; }
  return { ok: true, text, model, provider: 'gemini' };
}

async function transcribeAudio(env, request) {
  const form = await request.formData().catch(() => null);
  if (!form || !form.get('file')) {
    return { ok: false, error: 'Envoyer un multipart/form-data avec un champ "file"' };
  }
  const out = new FormData();
  out.append('file', form.get('file'));
  out.append('model', 'whisper-large-v3-turbo');
  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.GROQ_KEY },
    body: out
  });
  if (!resp.ok) return { ok: false, error: 'Whisper error ' + resp.status };
  const data = await resp.json();
  return { ok: true, text: data.text };
}

// === STREAMING ===

function streamGemini(env, model, messages, temperature, maxTokens) {
  model = model || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_KEY}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody(messages, temperature, maxTokens, model))
  }).then(resp => sseResponse(resp, env));
}

function streamOpenAICompat(env, hostname, apiKey, model, messages, temperature, maxTokens) {
  const base = hostname === 'api.groq.com' ? 'api.groq.com/openai' : hostname;
  return fetch(`https://${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true })
  }).then(resp => sseResponse(resp, env));
}

function sseResponse(resp, env) {
  return new Response(resp.body, {
    status: resp.ok ? 200 : resp.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders(env)
    }
  });
}

// === CATALOGUE MODELES ===
const MODELS = {
  groq:     ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound', 'groq/compound-mini', 'qwen/qwen3.8-27b'],
  gemini:   ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-pro-latest', 'gemini-2.5-pro'],
  cerebras: ['gpt-oss-120b', 'qwen-3.8-27b'],
  mistral:  ['mistral-medium-latest', 'mistral-small-latest', 'magistral-medium-latest', 'ministral-8b-latest', 'codestral-latest'],
  pollinations: ['openai-fast'],
  openrouter: [
    'openrouter/free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'deepseek/deepseek-v4-flash-0731:free',
    'qwen/qwen3.8-27b:free',
    'google/gemma-4-31b-it:free'
  ]
};

// === TEST PROVIDERS ===
async function testProviders(env) {
  const results = [];
  for (const name of Object.keys(PROVIDERS)) {
    if (!PROVIDERS[name].keyless && !env[PROVIDERS[name].key]) {
      results.push({ provider: name, ok: false, error: 'non configure' });
      continue;
    }
    try {
      const r = await PROVIDERS[name].chat(env, null, [{ role: 'user', content: 'ok' }], 0.1, 5);
      results.push({ provider: name, ok: r.ok, error: r.error, detail: r.detail });
    } catch (e) {
      results.push({ provider: name, ok: false, error: e.message });
    }
  }
  return results;
}

// === DIAGNOSTIC ===
// Interroge l'endpoint /v1/models de chaque provider pour connaitre les
// identifiants de modeles reellement acceptes par le compte.
const MODEL_ENDPOINTS = {
  groq:     { url: 'https://api.groq.com/openai/v1/models', key: 'GROQ_KEY' },
  cerebras: { url: 'https://api.cerebras.ai/v1/models',     key: 'CEREBRAS_KEY' },
  mistral:  { url: 'https://api.mistral.ai/v1/models',      key: 'MISTRAL_KEY' },
  openrouter: { url: 'https://openrouter.ai/api/v1/models', key: 'OPENROUTER_KEY' }
};

async function diagnose(env) {
  const out = {};
  for (const [name, cfg] of Object.entries(MODEL_ENDPOINTS)) {
    if (!env[cfg.key]) { out[name] = { configured: false }; continue; }
    try {
      const r = await fetch(cfg.url, { headers: { 'Authorization': 'Bearer ' + env[cfg.key] } });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        out[name] = { configured: true, status: r.status, error: t.slice(0, 300) };
        continue;
      }
      const d = await r.json();
      const ids = (d.data || []).map(m => m.id).sort();
      out[name] = { configured: true, status: 200, count: ids.length, models: ids.slice(0, 40) };
    } catch (e) {
      out[name] = { configured: true, error: e.message };
    }
  }
  // Gemini a une API differente
  if (env.GEMINI_KEY) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + env.GEMINI_KEY + '&pageSize=50');
      const d = await r.json();
      const ids = (d.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', '')).sort();
      out.gemini = { configured: true, status: r.status, count: ids.length, models: ids.slice(0, 40) };
    } catch (e) { out.gemini = { configured: true, error: e.message }; }
  }
  return out;
}

// === POLLINATIONS (sans cle) ===
const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const POLLINATIONS_MODEL = 'openai-fast';

// Pollinations renvoie parfois un HTTP 200 dont le CONTENU est un message
// d'erreur (credits epuises). Sans ce controle, on afficherait une publicite
// de rechargement comme si c'etait la reponse de l'IA.
function pollinationsError(text) {
  if (!text) return null;
  if (/doesn't have enough credits|low_balance|top-up|top up/i.test(text)) {
    return 'Palier anonyme Pollinations indisponible (credits epuises cote fournisseur)';
  }
  return null;
}

async function callPollinations(env, model, messages, temperature, maxTokens) {
  const resp = await fetch(POLLINATIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || POLLINATIONS_MODEL, messages, temperature, max_tokens: maxTokens })
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return { ok: false, error: 'Pollinations error ' + resp.status, detail: detail.slice(0, 300), provider: 'pollinations' };
  }
  const raw = await resp.text();
  const bad = pollinationsError(raw);
  if (bad) return { ok: false, error: bad, provider: 'pollinations' };
  let data;
  try { data = JSON.parse(raw); } catch { return { ok: false, error: 'Reponse Pollinations illisible', provider: 'pollinations' }; }
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const bad2 = pollinationsError(text);
  if (bad2) return { ok: false, error: bad2, provider: 'pollinations' };
  if (!text) return { ok: false, error: 'Reponse Pollinations vide', provider: 'pollinations' };
  return { ok: true, text, model: model || POLLINATIONS_MODEL, provider: 'pollinations' };
}

// Le flux natif de Pollinations peut livrer le message "credits epuises"
// comme s'il s'agissait de la reponse de l'IA. On ne le relaie donc pas :
// on passe par l'appel controle, puis on fabrique un SSE a partir du
// resultat verifie. La garde s'applique ainsi dans tous les cas.
async function streamPollinations(env, model, messages, temperature, maxTokens) {
  const r = await callPollinations(env, model, messages, temperature, maxTokens);

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode('data: ' + JSON.stringify(obj) + '\n\n'));

      if (!r.ok) {
        send({ error: { message: r.error } });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }

      // Decoupe en petits morceaux pour garder un rendu progressif a l'ecran.
      const text = r.text || '';
      const STEP = 24;
      for (let i = 0; i < text.length; i += STEP) {
        send({ choices: [{ index: 0, delta: { content: text.slice(i, i + STEP) } }] });
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(body, {
    status: r.ok ? 200 : 502,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders(env)
    }
  });
}

// === OPENROUTER ===
// OpenAI-compatible. Les en-tetes Referer/Title sont recommandes par
// OpenRouter pour identifier l'application appelante.
// Routeur automatique : choisit un modele gratuit disponible. Teste le
// 2026-09-20, c'est le seul avec nemotron a repondre de facon fiable ;
// les modeles gratuits pris individuellement tombent souvent en 429/504.
const OPENROUTER_MODEL = 'openrouter/free';
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://ether-api.ether-hichem.workers.dev',
  'X-Title': 'Ether AI'
};

function callOpenRouter(env, model, messages, temperature, maxTokens) {
  return callOpenAICompat('openrouter.ai/api', env.OPENROUTER_KEY, OPENROUTER_MODEL,
    'openrouter', model, messages, temperature, maxTokens, OPENROUTER_HEADERS);
}

function streamOpenRouter(env, model, messages, temperature, maxTokens) {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.OPENROUTER_KEY,
      ...OPENROUTER_HEADERS
    },
    body: JSON.stringify({
      model: model || OPENROUTER_MODEL,
      messages, temperature, max_tokens: maxTokens, stream: true
    })
  }).then(resp => sseResponse(resp, env));
}

// === PERSISTANCE UTILISATEUR ===
// Stocke le coffre de donnees d'un utilisateur (conversations, reglages,
// modes) pour qu'il le retrouve depuis n'importe quel ordinateur.
// Chaque cle porte un horodatage : en cas d'ecriture depuis deux machines,
// la plus recente gagne, cle par cle.
function persistKey(user) {
  return 'persist:' + ((user && user.email) || 'anonyme');
}

async function persistRead(env, user) {
  if (!env.ETHER_KV) return { ok: true, data: {}, keyTimes: {}, tracked: false };
  const raw = await env.ETHER_KV.get(persistKey(user));
  if (!raw) return { ok: true, data: {}, keyTimes: {}, tracked: true };
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, data: parsed.data || {}, keyTimes: parsed.keyTimes || {}, tracked: true };
  } catch {
    return { ok: true, data: {}, keyTimes: {}, tracked: true };
  }
}

async function persistWrite(env, user, incoming) {
  if (!env.ETHER_KV) return { ok: false, error: 'Stockage indisponible', tracked: false };
  if (!incoming || typeof incoming !== 'object') return { ok: false, error: 'Charge utile invalide' };

  const inData = incoming.data || {};
  const inTimes = incoming.keyTimes || {};

  const current = await persistRead(env, user);
  const data = { ...current.data };
  const keyTimes = { ...current.keyTimes };

  for (const k of Object.keys(inData)) {
    if (!/^[\w-]{1,120}$/.test(k)) continue;           // nom de cle plausible
    const t = Number(inTimes[k]) || Date.now();
    if (!keyTimes[k] || t >= keyTimes[k]) {             // la plus recente gagne
      data[k] = inData[k];
      keyTimes[k] = t;
    }
  }

  const body = JSON.stringify({ data, keyTimes });
  if (body.length > 20 * 1024 * 1024) {
    return { ok: false, error: 'Coffre trop volumineux (plus de 20 Mo)' };
  }
  await env.ETHER_KV.put(persistKey(user), body);
  return { ok: true, keys: Object.keys(data).length, bytes: body.length, tracked: true };
}

// Comparaison a duree constante : evite qu'on devine le code lettre par
// lettre en mesurant le temps de reponse.
function timingSafeEqual(a, b) {
  const ba = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  let diff = ba.length ^ bb.length;
  const n = Math.max(ba.length, bb.length);
  for (let i = 0; i < n; i++) {
    diff |= (ba[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0;
}

// === RECHERCHE WEB ===
// Sans cle : Wikipedia FR/EN + DuckDuckGo Instant Answer (gratuits, sans compte).
// Avec SEARCH_KEY : vrais resultats web en plus. Le fournisseur se deduit de la
// cle (tvly-... = Tavily, BSA... = Brave), sinon SEARCH_PROVIDER, sinon Serper.
function searchProvider(env) {
  const k = env.SEARCH_KEY || '';
  if (!k) return '';
  if (env.SEARCH_PROVIDER) return env.SEARCH_PROVIDER;
  if (k.startsWith('tvly-')) return 'tavily';
  if (k.startsWith('BSA')) return 'brave';
  return 'serper';
}

async function getJson(url, init) {
  try {
    // Wikimedia refuse les requetes sans User-Agent identifiable.
    const headers = { 'User-Agent': 'EtherAI/2.1 (https://github.com/fharzallah/ether-ai)', ...((init && init.headers) || {}) };
    const r = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(6000) });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

async function keyedSearch(env, query) {
  const provider = searchProvider(env);
  if (provider === 'tavily') {
    const d = await getJson('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.SEARCH_KEY },
      body: JSON.stringify({ query, max_results: 6, include_answer: true })
    });
    if (!d) return { results: [], extract: '' };
    return {
      results: (d.results || []).map(r => ({ title: r.title || '', snippet: r.content || '', source: hostOf(r.url), url: r.url })),
      extract: d.answer ? '=== Synthese web (Tavily) ===\n' + d.answer : ''
    };
  }
  if (provider === 'brave') {
    const d = await getJson('https://api.search.brave.com/res/v1/web/search?count=6&q=' + encodeURIComponent(query), {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': env.SEARCH_KEY }
    });
    const list = (d && d.web && d.web.results) || [];
    return { results: list.map(r => ({ title: r.title || '', snippet: stripTags(r.description || ''), source: hostOf(r.url), url: r.url })), extract: '' };
  }
  if (provider === 'serper') {
    const d = await getJson('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': env.SEARCH_KEY },
      body: JSON.stringify({ q: query, num: 6, hl: 'fr' })
    });
    if (!d) return { results: [], extract: '' };
    const results = (d.organic || []).map(r => ({ title: r.title || '', snippet: r.snippet || '', source: hostOf(r.link), url: r.link }));
    const box = d.answerBox && (d.answerBox.answer || d.answerBox.snippet);
    return { results, extract: box ? '=== Reponse directe (Google) ===\n' + box : '' };
  }
  return { results: [], extract: '' };
}

async function wikipediaExtract(lang, query) {
  const s = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`);
  const hit = s && s.query && s.query.search && s.query.search[0];
  if (!hit) return '';
  const d = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=extracts&exintro=1&explaintext=1&format=json`);
  const pages = (d && d.query && d.query.pages) || {};
  for (const k in pages) {
    if (pages[k].extract) return `=== ${pages[k].title} (Wikipedia ${lang.toUpperCase()}) ===\n` + pages[k].extract.substring(0, 800);
  }
  return '';
}

async function ddgInstant(query) {
  const d = await getJson('https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(query));
  const out = [];
  if (!d) return out;
  if (d.Answer) out.push({ title: 'Reponse directe', snippet: String(d.Answer), source: 'DuckDuckGo' });
  if (d.Abstract) out.push({ title: d.Heading || query, snippet: d.Abstract, source: d.AbstractSource || 'DuckDuckGo', url: d.AbstractURL });
  return out;
}

async function webSearch(env, query) {
  const [keyed, frWiki, enWiki, ddg] = await Promise.all([
    keyedSearch(env, query), wikipediaExtract('fr', query), wikipediaExtract('en', query), ddgInstant(query)
  ]);
  const extract = [keyed.extract, frWiki, enWiki].filter(Boolean).join('\n\n');
  return { ok: true, provider: searchProvider(env) || 'libre', results: keyed.results.concat(ddg), extract };
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'web'; }
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, '');
}
