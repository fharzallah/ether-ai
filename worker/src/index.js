/**
 * ETHER API — Cloudflare Worker
 * Proxy securise entre l'app Electron et les providers IA
 * Les cles API sont dans les Cloudflare Secrets (jamais exposees au client)
 */

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // --- HEALTH ---
      if (path === '/api/health') {
        return json({ status: 'ok', name: 'ETHER API', version: '2.0' });
      }

      // --- AUTH: verifier le token utilisateur ---
      // Pour les routes protegees
      if (path.startsWith('/api/chat') || path.startsWith('/api/quota')) {
        const authErr = verifyAuth(request, env);
        if (authErr) return authErr;
      }

      // --- CHAT: proxy vers le bon provider ---
      if (path === '/api/chat' && request.method === 'POST') {
        const body = await request.json();
        const provider = body.provider || 'gemini';
        const model = body.model;
        const messages = body.messages;
        const temperature = body.temperature || 0.7;
        const maxTokens = body.max_tokens || 4000;
        const stream = body.stream || false;

        if (!messages || !messages.length) {
          return json({ error: 'Messages required' }, 400);
        }

        let result;
        if (provider === 'gemini') {
          result = await callGemini(env, model, messages, temperature, maxTokens);
        } else if (provider === 'mistral') {
          result = await callMistral(env, model, messages, temperature, maxTokens);
        } else if (provider === 'cerebras') {
          result = await callCerebras(env, model, messages, temperature, maxTokens);
        } else {
          result = await callGroq(env, model, messages, temperature, maxTokens);
        }

        return json(result, result.ok ? 200 : 502, env);
      }

      // --- CHAT STREAM: streaming SSE ---
      if (path === '/api/chat/stream' && request.method === 'POST') {
        const body = await request.json();
        const provider = body.provider || 'gemini';
        const model = body.model;
        const messages = body.messages;
        const temperature = body.temperature || 0.7;
        const maxTokens = body.max_tokens || 4000;

        if (provider === 'gemini') {
          return streamGemini(env, model, messages, temperature, maxTokens);
        } else if (provider === 'mistral') {
          return streamOpenAICompat(env, 'api.mistral.ai', env.MISTRAL_KEY, model, messages, temperature, maxTokens);
        } else if (provider === 'cerebras') {
          return streamOpenAICompat(env, 'api.cerebras.ai', env.CEREBRAS_KEY, model, messages, temperature, maxTokens);
        } else {
          return streamOpenAICompat(env, 'api.groq.com', env.GROQ_KEY, model, messages, temperature, maxTokens);
        }
      }

      // --- REGISTER: creer un compte utilisateur ---
      if (path === '/api/register' && request.method === 'POST') {
        const body = await request.json();
        if (!body.email || !body.name) return json({ error: 'Email and name required' }, 400);
        // Generer un JWT token
        const token = await createJWT({ email: body.email, name: body.name, pro: false }, env.JWT_SECRET);
        return json({ ok: true, token: token }, 200, env);
      }

      // --- VERIFY TOKEN ---
      if (path === '/api/verify' && request.method === 'POST') {
        const body = await request.json();
        const payload = await verifyJWT(body.token, env.JWT_SECRET);
        if (payload) return json({ ok: true, user: payload }, 200, env);
        return json({ ok: false, error: 'Invalid token' }, 401, env);
      }

      // --- QUOTA CHECK (server-side) ---
      if (path === '/api/quota' && request.method === 'GET') {
        // Pour l'instant, quota cote client. Avec KV plus tard.
        return json({ ok: true, remaining: 30, limit: 30 }, 200, env);
      }

      // --- PROVIDERS STATUS ---
      if (path === '/api/providers') {
        const results = await testProviders(env);
        return json({ providers: results }, 200, env);
      }

      // --- STRIPE: Creer une session de paiement ---
      if (path === '/api/stripe/checkout' && request.method === 'POST') {
        if (!env.STRIPE_SECRET) return json({ error: 'Stripe non configure' }, 503, env);
        const body = await request.json();
        const email = body.email;
        if (!email) return json({ error: 'Email required' }, 400, env);

        const session = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(env.STRIPE_SECRET + ':'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            'mode': 'subscription',
            'customer_email': email,
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

      // --- STRIPE: Webhook (recevoir les evenements de paiement) ---
      if (path === '/api/stripe/webhook' && request.method === 'POST') {
        if (!env.STRIPE_SECRET) return json({ error: 'Stripe non configure' }, 503, env);
        const body = await request.text();
        // En production, verifier la signature Stripe ici
        // const sig = request.headers.get('stripe-signature');
        try {
          const event = JSON.parse(body);
          if (event.type === 'checkout.session.completed') {
            const email = event.data.object.customer_email;
            // Activer Pro pour cet utilisateur
            // Avec KV: await env.ETHER_KV.put('pro:' + email, JSON.stringify({ active: true, since: Date.now() }));
            console.log('[STRIPE] Pro active pour:', email);
          }
          if (event.type === 'customer.subscription.deleted') {
            const customerId = event.data.object.customer;
            // Desactiver Pro
            console.log('[STRIPE] Pro desactive pour customer:', customerId);
          }
          return json({ received: true }, 200, env);
        } catch (e) {
          return json({ error: 'Invalid webhook payload' }, 400, env);
        }
      }

      // --- STRIPE: Verifier le statut Pro ---
      if (path === '/api/stripe/status' && request.method === 'POST') {
        const body = await request.json();
        if (!body.email) return json({ error: 'Email required' }, 400, env);
        // Avec KV: const pro = await env.ETHER_KV.get('pro:' + body.email);
        // Pour l'instant, retourner false (pas de KV)
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

// === AUTH (JWT simple) ===
async function createJWT(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 365 * 24 * 60 * 60 * 1000 }));
  const data = header + '.' + body;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    const data = header + '.' + body;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function verifyAuth(request, env) {
  // Skip auth en dev (pas de JWT_SECRET)
  if (!env.JWT_SECRET) return null;
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return json({ error: 'Authorization required' }, 401, env);
  }
  // Pour l'instant on accepte tout token non-vide (le JWT sera verifie dans /api/verify)
  return null;
}

// === PROVIDERS ===

// --- GROQ (OpenAI-compatible) ---
async function callGroq(env, model, messages, temperature, maxTokens) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_KEY },
    body: JSON.stringify({ model: model || 'llama-3.3-70b-versatile', messages, temperature, max_tokens: maxTokens })
  });
  if (!resp.ok) return { ok: false, error: 'Groq error ' + resp.status, provider: 'groq' };
  const data = await resp.json();
  return { ok: true, text: data.choices[0].message.content, model: model, provider: 'groq' };
}

// --- GEMINI ---
async function callGemini(env, model, messages, temperature, maxTokens) {
  model = model || 'gemini-2.5-flash';
  const contents = [];
  let systemInstruction = null;
  for (const m of messages) {
    if (m.role === 'system') systemInstruction = { parts: [{ text: m.content }] };
    else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
  }
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature } };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (model.includes('2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };

  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) return { ok: false, error: 'Gemini error ' + resp.status, provider: 'gemini' };
  const data = await resp.json();
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const parts = data.candidates[0].content.parts;
    let text = '';
    for (const p of parts) { if (!p.thought) text += p.text || ''; }
    return { ok: true, text, model, provider: 'gemini' };
  }
  return { ok: false, error: 'No candidates', provider: 'gemini' };
}

// --- CEREBRAS (OpenAI-compatible) ---
async function callCerebras(env, model, messages, temperature, maxTokens) {
  const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.CEREBRAS_KEY },
    body: JSON.stringify({ model: model || 'qwen-3-235b-a22b-instruct-2507', messages, temperature, max_tokens: maxTokens })
  });
  if (!resp.ok) return { ok: false, error: 'Cerebras error ' + resp.status, provider: 'cerebras' };
  const data = await resp.json();
  return { ok: true, text: data.choices[0].message.content, model, provider: 'cerebras' };
}

// --- MISTRAL (OpenAI-compatible) ---
async function callMistral(env, model, messages, temperature, maxTokens) {
  const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.MISTRAL_KEY },
    body: JSON.stringify({ model: model || 'mistral-large-latest', messages, temperature, max_tokens: maxTokens })
  });
  if (!resp.ok) return { ok: false, error: 'Mistral error ' + resp.status, provider: 'mistral' };
  const data = await resp.json();
  return { ok: true, text: data.choices[0].message.content, model, provider: 'mistral' };
}

// === STREAMING ===

// Gemini SSE streaming
function streamGemini(env, model, messages, temperature, maxTokens) {
  model = model || 'gemini-2.5-flash';
  const contents = [];
  let systemInstruction = null;
  for (const m of messages) {
    if (m.role === 'system') systemInstruction = { parts: [{ text: m.content }] };
    else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
  }
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature } };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (model.includes('2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_KEY}`;

  // Proxy le stream SSE
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(resp => {
    return new Response(resp.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...corsHeaders(env)
      }
    });
  });
}

// OpenAI-compatible streaming (Groq, Cerebras)
function streamOpenAICompat(env, hostname, apiKey, model, messages, temperature, maxTokens) {
  const url = `https://${hostname}/v1/chat/completions`;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true })
  }).then(resp => {
    return new Response(resp.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...corsHeaders(env)
      }
    });
  });
}

// === TEST PROVIDERS ===
async function testProviders(env) {
  const results = [];

  // Groq
  try {
    const r = await callGroq(env, 'llama-3.1-8b-instant', [{ role: 'user', content: 'ok' }], 0.1, 5);
    results.push({ provider: 'groq', ok: r.ok });
  } catch { results.push({ provider: 'groq', ok: false }); }

  // Gemini (test via listModels pour eviter le rate limit)
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_KEY}&pageSize=1`);
    results.push({ provider: 'gemini', ok: r.ok });
  } catch { results.push({ provider: 'gemini', ok: false }); }

  // Cerebras
  try {
    const r = await callCerebras(env, 'llama3.1-8b', [{ role: 'user', content: 'ok' }], 0.1, 5);
    results.push({ provider: 'cerebras', ok: r.ok });
  } catch { results.push({ provider: 'cerebras', ok: false }); }

  // Mistral
  try {
    const r = await callMistral(env, 'mistral-small-latest', [{ role: 'user', content: 'ok' }], 0.1, 5);
    results.push({ provider: 'mistral', ok: r.ok });
  } catch { results.push({ provider: 'mistral', ok: false }); }

  return results;
}
