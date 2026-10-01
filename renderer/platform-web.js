// === ETHER — Plateforme web ===
//
// Expose window.etherDesktop, l'API de plateforme qu'utilise tout le renderer
// (le nom vient de l'ancienne version Electron). Chaque appel passe en HTTP
// par le worker Cloudflare, qui detient les cles API.

(function() {
    'use strict';

    // === Config ===
    var API_BASE = window.ETHER_API_BASE || location.origin;
    var TOKEN_KEY = 'ether_auth_token';

    function getToken() {
        try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
    }
    function setToken(t) {
        try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
    }

    function headers() {
        var h = { 'Content-Type': 'application/json' };
        var t = getToken();
        if (t) h['Authorization'] = 'Bearer ' + t;
        return h;
    }

    // === COMPTES ===
    // Connexion par email + mot de passe (routes /api/auth/* du worker).
    // L'ancienne inscription automatique donnait un compte a quiconque tapait
    // l'email de quelqu'un d'autre : elle n'existe plus.

    // === CODE D'INVITATION ===
    // Transmis par le lien : https://.../?code=XXXX
    // On le memorise pour que l'utilisateur n'ait a l'avoir qu'une fois.
    var INVITE_KEY = 'ether_invite_code';

    function inviteCode() {
        try {
            var url = new URL(window.location.href);
            var fromUrl = url.searchParams.get('code');
            if (fromUrl) {
                localStorage.setItem(INVITE_KEY, fromUrl);
                // Retirer le code de la barre d'adresse une fois memorise.
                url.searchParams.delete('code');
                window.history.replaceState({}, '', url.toString());
                return fromUrl;
            }
            return localStorage.getItem(INVITE_KEY) || '';
        } catch (e) { return ''; }
    }

    function showInviteError(message) {
        if (document.getElementById('ETHER-INVITE-ERR')) return;
        var box = document.createElement('div');
        box.id = 'ETHER-INVITE-ERR';
        box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;' +
            'align-items:center;justify-content:center;background:rgba(0,0,0,.55);' +
            'font-family:system-ui,-apple-system,sans-serif;padding:24px';
        box.innerHTML = '<div style="background:#fff;color:#111;max-width:420px;' +
            'border-radius:16px;padding:28px;text-align:center;line-height:1.6">' +
            '<div style="font-size:2rem;margin-bottom:8px">🔒</div>' +
            '<div style="font-weight:700;font-size:1.1rem;margin-bottom:10px">Acces sur invitation</div>' +
            '<div style="font-size:.9rem;color:#555">' + message + '</div></div>';
        document.body.appendChild(box);
    }

    function tokenPayload() {
        try {
            var b = (getToken().split('.')[1]) || '';
            if (!b) return null;
            b = b.replace(/-/g, '+').replace(/_/g, '/');
            while (b.length % 4) b += '=';
            return JSON.parse(atob(b));
        } catch (e) { return null; }
    }

    // Le serveur a refuse le jeton : on affiche l'ecran de connexion. Un jeton
    // d'avant les mots de passe (sans "tv") ouvre directement la creation du
    // mot de passe avec l'email de cet appareil : c'est ce jeton, renvoye a
    // l'inscription, qui prouve au serveur que les conversations sont a lui.
    var _loginShown = false;
    function authRequired(message) {
        // Sans jeton, l'app affiche deja l'ecran de connexion.
        if (_loginShown || !getToken()) return;
        _loginShown = true;
        var p = tokenPayload();
        var legacy = !!(p && p.email && typeof p.tv !== 'number');
        var info = {
            email: p && p.email,
            legacy: legacy,
            message: legacy
                ? 'ETHER a maintenant des mots de passe. Cree le tien pour retrouver tes conversations.'
                : (getToken() ? 'Ta session a expire, reconnecte-toi.' : '')
        };
        var show = function() {
            if (typeof window.etherShowLogin === 'function') window.etherShowLogin(info);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
        else setTimeout(show, 0);
    }

    function authCall(path, body) {
        return rawRequest(path, body).then(function(r) {
            if (r && r.token) { setToken(r.token); _loginShown = false; }
            else if (r && r.needCode) {
                try { localStorage.removeItem(INVITE_KEY); } catch (e) {}
                showInviteError(inviteCode()
                    ? 'Le code de votre lien n est pas valide. Demandez un lien a jour.'
                    : 'Ether AI est sur invitation. Ouvrez le lien qui vous a ete transmis, il contient le code d acces.');
            }
            return r;
        });
    }

    // Limite journaliere du serveur : on previent l'utilisateur au lieu de
    // laisser croire a une panne de connexion.
    function checkQuota(res) {
        if (res && res.ok === false && /Quota journalier/i.test(res.error || '') && typeof window.showQuotaExhausted === 'function') {
            window.showQuotaExhausted();
        }
        return res;
    }

    function isAuthError(res) {
        return res && res.ok === false && (res.authRequired || /Authorization required|Token invalide|Session expiree/i.test(res.error || ''));
    }

    function rawRequest(path, body, method) {
        return fetch(API_BASE + path, {
            method: method || (body ? 'POST' : 'GET'),
            headers: headers(),
            body: body ? JSON.stringify(body) : undefined
        }).then(function(r) {
            return r.json().catch(function() { return { ok: false, error: 'Reponse illisible (HTTP ' + r.status + ')' }; });
        }).catch(function(e) {
            return { ok: false, error: 'Reseau indisponible : ' + e.message };
        });
    }

    // Appel JSON generique : un refus d'authentification ouvre l'ecran de connexion.
    function request(path, body, method) {
        return rawRequest(path, body, method).then(function(res) {
            if (isAuthError(res)) authRequired(res.error);
            return res;
        });
    }

    // === Stockage local (IndexedDB) ===
    // Remplace persist-* / modes-* / custom-providers-* qui ecrivaient sur disque.
    var DB_NAME = 'ether';
    var STORE = 'kv';
    var _db = null;

    function db() {
        if (_db) return Promise.resolve(_db);
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function() {
                if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
            };
            req.onsuccess = function() { _db = req.result; resolve(_db); };
            req.onerror = function() { reject(req.error); };
        });
    }

    function idbGet(key) {
        return db().then(function(d) {
            return new Promise(function(resolve) {
                var r = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
                r.onsuccess = function() { resolve(r.result); };
                r.onerror = function() { resolve(undefined); };
            });
        }).catch(function() { return undefined; });
    }

    function idbSet(key, value) {
        return db().then(function(d) {
            return new Promise(function(resolve) {
                var r = d.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
                r.onsuccess = function() { resolve({ ok: true }); };
                r.onerror = function() { resolve({ ok: false, error: String(r.error) }); };
            });
        }).catch(function(e) { return { ok: false, error: String(e) }; });
    }

    // === Streaming SSE ===
    // preload.js poussait les chunks par evenements IPC. On reproduit le meme
    // contrat : onChunk/onDone enregistrent des callbacks, le stream les appelle.
    var _chunkCallbacks = [];
    var _doneCallbacks = [];
    var _abort = null;

    function emitChunk(text) {
        for (var i = 0; i < _chunkCallbacks.length; i++) {
            try { _chunkCallbacks[i](text); } catch (e) { console.error('[ETHER] onChunk', e); }
        }
    }
    function emitDone(full) {
        for (var i = 0; i < _doneCallbacks.length; i++) {
            try { _doneCallbacks[i](full); } catch (e) { console.error('[ETHER] onDone', e); }
        }
    }

    // Extrait le texte d'une ligne SSE, quel que soit le provider.
    function extractDelta(payload) {
        try {
            var o = JSON.parse(payload);
            // OpenAI / Groq / Cerebras / Mistral
            if (o.choices && o.choices[0]) {
                var c = o.choices[0];
                if (c.delta && typeof c.delta.content === 'string') return c.delta.content;
                if (typeof c.text === 'string') return c.text;
            }
            // Gemini
            if (o.candidates && o.candidates[0] && o.candidates[0].content) {
                var parts = o.candidates[0].content.parts || [];
                if (parts[0] && typeof parts[0].text === 'string') return parts[0].text;
            }
            // Anthropic
            if (o.type === 'content_block_delta' && o.delta && typeof o.delta.text === 'string') return o.delta.text;
        } catch (e) { /* ligne non-JSON : ignoree */ }
        return '';
    }

    // === CLES PERSONNELLES ===
    // Gardees dans CE navigateur uniquement. Envoyees dans l'en-tete
    // X-Provider-Key : le worker les relaie au fournisseur sans les stocker.
    // Le nom n'a pas le prefixe ether_ : core.js purge et synchronise ces cles-la.
    var USER_KEYS = 'etherx_provider_keys';
    function userKeys() {
        try { return JSON.parse(localStorage.getItem(USER_KEYS) || '{}') || {}; } catch (e) { return {}; }
    }
    function saveUserKeys(o) {
        try { localStorage.setItem(USER_KEYS, JSON.stringify(o)); return true; } catch (e) { return false; }
    }

    // Ce qu'il faut ajouter a une requete pour ce fournisseur : la cle perso,
    // et pour un fournisseur personnalise son URL et son modele.
    function providerContext(provider, data) {
        if (provider === 'custom') {
            return idbGet('customProviders').then(function(list) {
                var id = data && data.providerId, found = null;
                for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) found = list[i];
                if (!found) return { error: 'Fournisseur personnalise introuvable' };
                return { key: found.apiKey || '', baseUrl: found.baseUrl, model: (data && data.model) || found.model };
            });
        }
        return Promise.resolve({ key: userKeys()[provider] || '' });
    }

    // Quota : chaque action de l'utilisateur ouvre un tour, avec un identifiant
    // aleatoire envoye a chaque appel IA. Le serveur compte le premier appel du
    // tour comme un vrai message ; les suivants (resume, memoire, etapes de la
    // reflexion approfondie, replis) sont gratuits dans la limite qu'il fixe.
    // Le premier appel part seul : les appels paralleles du meme tour attendent
    // sa reponse, sinon chacun serait compte comme un nouveau message.
    var _turn = null, _turnStarted = false, _turnGate = null;
    function newTurnId() {
        var b = new Uint8Array(16);
        crypto.getRandomValues(b);
        return Array.prototype.map.call(b, function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }
    function enterTurn() {
        var noop = function() {};
        if (!_turn) return Promise.resolve({ turn: null, release: noop });
        var turn = _turn;
        if (!_turnStarted) {
            _turnStarted = true;
            var release;
            _turnGate = new Promise(function(r) { release = r; setTimeout(r, 15000); });
            return Promise.resolve({ turn: turn, release: release });
        }
        return _turnGate.then(function() { return { turn: turn, release: noop }; });
    }

    function chatHeaders(ctx) {
        var h = headers();
        if (ctx.key) h['X-Provider-Key'] = ctx.key;
        return h;
    }

    function chatBody(provider, data, ctx, turn) {
        return JSON.stringify({
            provider: provider,
            turn: turn,
            model: ctx.model || (data && data.model),
            messages: data && data.messages,
            temperature: data && data.temperature,
            max_tokens: data && (data.max_tokens || data.maxTokens),
            baseUrl: ctx.baseUrl
        });
    }

    function stream(provider, data) {
        var full = '';
        _abort = new AbortController();
        var signal = _abort.signal;

        return providerContext(provider, data).then(function(ctx) {
            if (ctx.error) throw new Error(ctx.error);
            return enterTurn().then(function(tr) {
                return fetch(API_BASE + '/api/chat/stream', {
                    method: 'POST',
                    headers: chatHeaders(ctx),
                    signal: signal,
                    body: chatBody(provider, data, ctx, tr.turn)
                })['finally'](tr.release);
            });
        }).then(function(resp) {
            if (resp.status === 401) authRequired();
            if (!resp.ok || !resp.body) {
                return resp.text().then(function(t) {
                    try { checkQuota(JSON.parse(t)); } catch (e) {}
                    throw new Error('HTTP ' + resp.status + ' ' + t.slice(0, 200));
                });
            }
            var reader = resp.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            function pump() {
                return reader.read().then(function(res) {
                    if (res.done) { emitDone(full); return { ok: true, text: full }; }

                    buffer += decoder.decode(res.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop(); // garder la ligne incomplete

                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (!line || line.indexOf('data:') !== 0) continue;
                        var payload = line.slice(5).trim();
                        if (payload === '[DONE]') { emitDone(full); return { ok: true, text: full }; }
                        var delta = extractDelta(payload);
                        if (delta) { full += delta; emitChunk(delta); }
                    }
                    return pump();
                });
            }
            return pump();
        }).catch(function(e) {
            if (e.name === 'AbortError') { emitDone(full); return { ok: true, text: full, stopped: true }; }
            emitDone(full);
            return { ok: false, error: e.message, text: full };
        }).finally(function() { _abort = null; });
    }

    function chat(provider, data) {
        return providerContext(provider, data).then(function(ctx) {
            if (ctx.error) return { ok: false, error: ctx.error };
            return enterTurn().then(function(tr) {
                return fetch(API_BASE + '/api/chat', {
                    method: 'POST', headers: chatHeaders(ctx), body: chatBody(provider, data, ctx, tr.turn)
                })['finally'](tr.release);
            }).then(function(r) {
                return r.json().catch(function() { return { ok: false, error: 'Reponse illisible (HTTP ' + r.status + ')' }; });
            }).then(function(res) {
                if (isAuthError(res)) authRequired(res.error);
                return checkQuota(res);
            });
        })['catch'](function(e) { return { ok: false, error: 'Reseau indisponible : ' + e.message }; });
    }

    function wipeLocal() {
        var keep = { ether_theme: 1, ether_lang: 1, ether_invite_code: 1 };
        try {
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var k = localStorage.key(i);
                if (k && (k.indexOf('ether') === 0) && !keep[k]) localStorage.removeItem(k);
            }
        } catch (e) {}
        _syncData = {}; _syncTimes = {};
        return idbSet('customProviders', []).then(function() { return { ok: true }; }, function() { return { ok: true }; });
    }

    // Liste sans les cles : elles ne quittent jamais IndexedDB.
    function publicProviders(list) {
        return (list || []).map(function(p) {
            return { id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model, hasKey: !!p.apiKey };
        });
    }

    // Methodes qui n'ont pas de sens dans un navigateur.
    // On echoue explicitement plutot que de renvoyer un faux succes silencieux.
    function unavailable(name) {
        return function() {
            console.warn('[ETHER] ' + name + ' indisponible en web');
            return Promise.resolve({ ok: false, error: name + ' est indisponible dans la version web', unavailable: true });
        };
    }

    // === SYNCHRONISATION MULTI-APPAREILS ===
    // L'app appelle deja persistSet/persistRead a chaque ecriture et au
    // demarrage (voir sSet et restoreFromPersist dans core.js). On se
    // contente de rediriger ces appels vers le worker.
    var _syncData = {};
    var _syncTimes = {};
    var _pushTimer = null;
    var CACHE_KEY = 'ether__sync_cache';

    function loadLocalCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return;
            var c = JSON.parse(raw);
            _syncData = c.data || {};
            _syncTimes = c.keyTimes || {};
        } catch (e) { /* cache illisible : on repart de zero */ }
    }

    function saveLocalCache() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: _syncData, keyTimes: _syncTimes }));
        } catch (e) { /* quota plein : le serveur reste la source de verite */ }
    }

    // Recupere le coffre serveur, fusionne par horodatage, et applique dans
    // localStorage les cles plus recentes cote serveur — c'est ce qui fait
    // apparaitre les conversations d'un autre ordinateur.
    function syncPull() {
        if (!getToken()) return Promise.resolve(_syncData);
        return request('/api/persist').then(function(r) {
            if (!r || !r.ok) return _syncData;

            var srvData = r.data || {};
            var srvTimes = r.keyTimes || {};

            for (var k in srvData) {
                if (!srvData.hasOwnProperty(k)) continue;
                var srvT = srvTimes[k] || 0;
                var locT = _syncTimes[k] || 0;
                if (srvT >= locT) {
                    _syncData[k] = srvData[k];
                    _syncTimes[k] = srvT;
                    // Ecrire directement dans localStorage : restoreFromPersist
                    // ne remplit que les cles absentes, il ne rafraichit pas
                    // une cle locale devenue obsolete.
                    try { localStorage.setItem('ether_' + k, JSON.stringify(srvData[k])); } catch (e) {}
                }
            }
            saveLocalCache();
            return _syncData;
        }).catch(function() { return _syncData; });
    }

    function syncPush() {
        if (!getToken()) return Promise.resolve({ ok: false });
        return request('/api/persist', { data: _syncData, keyTimes: _syncTimes })
            .catch(function() { return { ok: false }; });
    }

    // Les ecritures sont nombreuses (chaque frappe sauvegardee) : on regroupe.
    function schedulePush() {
        if (_pushTimer) clearTimeout(_pushTimer);
        _pushTimer = setTimeout(function() { _pushTimer = null; syncPush(); }, 1500);
    }

    loadLocalCache();
    // Memoriser le code du lien d'invitation des l'ouverture, avant tout rechargement.
    inviteCode();

    // Dernier envoi quand l'onglet se ferme, pour ne pas perdre les 1,5 s
    // de regroupement.
    window.addEventListener('pagehide', function() {
        if (!_pushTimer) return;
        clearTimeout(_pushTimer); _pushTimer = null;
        // fetch + keepalive plutot que sendBeacon : sendBeacon ne permet pas
        // d'en-tetes, ce qui obligerait a mettre le token dans l'URL — or une
        // URL finit dans les journaux d'acces.
        try {
            fetch(API_BASE + '/api/persist', {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ data: _syncData, keyTimes: _syncTimes }),
                keepalive: true
            });
        } catch (e) { /* au pire, la prochaine ouverture renverra le cache */ }
    });

    window.etherDesktop = {
        isWeb: true,

        // === IA (cles cote serveur, jamais dans le navigateur) ===
        groqChat:        function(d) { return chat('groq', d); },
        groqStream:      function(d) { return stream('groq', d); },
        geminiChat:      function(d) { return chat('gemini', d); },
        geminiStream:    function(d) { return stream('gemini', d); },
        mistralChat:     function(d) { return chat('mistral', d); },
        mistralStream:   function(d) { return stream('mistral', d); },
        cerebrasChat:    function(d) { return chat('cerebras', d); },
        cerebrasStream:  function(d) { return stream('cerebras', d); },
        openaiChat:      function(d) { return chat('openai', d); },
        openaiStream:    function(d) { return stream('openai', d); },
        anthropicChat:   function(d) { return chat('anthropic', d); },
        anthropicStream: function(d) { return stream('anthropic', d); },
        customChat:      function(d) { return chat('custom', d); },
        customStream:    function(d) { return stream('custom', d); },
        openrouterChat:   function(d) { return chat('openrouter', d); },
        openrouterStream: function(d) { return stream('openrouter', d); },
        pollinationsChat: function(d) { return chat('pollinations', d); },
        workersaiChat:    function(d) { return chat('workersai', d); },
        workersaiStream:  function(d) { return stream('workersai', d); },
        geminiVision:    function(d) { return request('/api/vision', d); },

        groqTest:  function() { return request('/api/providers'); },
        // A appeler a chaque action de l'utilisateur qui produit une reponse.
        markUserMessage: function() { _turn = newTurnId(); _turnStarted = false; _turnGate = null; },
        groqStop:  function() { if (_abort) _abort.abort(); return Promise.resolve({ ok: true }); },
        getModels: function() { return request('/api/models'); },
        testAllProviders: function() { return request('/api/providers'); },

        // === Streaming : meme contrat que le pont IPC ===
        onChunk: function(cb) { _chunkCallbacks.push(cb); },
        onDone:  function(cb) { _doneCallbacks.push(cb); },
        removeStreamListeners: function() { _chunkCallbacks = []; _doneCallbacks = []; },

        // === Cles personnelles (optionnelles) ===
        // Sans cle perso, le serveur utilise les siennes. Seule la PRESENCE
        // d'une cle est renvoyee a l'interface, jamais sa valeur.
        providerKeysStatus: function() {
            var k = userKeys(), out = {};
            for (var p in k) if (k.hasOwnProperty(p) && k[p]) out[p] = true;
            return Promise.resolve(out);
        },
        providerKeysSet: function(p, v) {
            var k = userKeys();
            v = String(v || '').trim();
            if (v) k[p] = v; else delete k[p];
            return Promise.resolve(saveUserKeys(k) ? { ok: true } : { ok: false, error: 'Stockage du navigateur indisponible' });
        },
        providerKeysClear: function(p) {
            var k = userKeys(); delete k[p];
            return Promise.resolve({ ok: saveUserKeys(k) });
        },
        providerKeysTest: function(p) {
            if (userKeys()[p]) {
                return chat(p, { messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 })
                    .then(function(r) { return { ok: !!(r && r.ok), error: r && r.error }; });
            }
            return request('/api/providers').then(function(r) {
                var list = (r && r.providers) || [];
                for (var i = 0; i < list.length; i++) if (list[i].provider === p) return { ok: !!list[i].ok, error: list[i].error };
                return { ok: false, error: 'Non configure' };
            });
        },
        // Pas de chiffrement systeme dans un navigateur : les cles restent en clair
        // dans le stockage local de ce navigateur, a l'abri des autres sites.
        secureStorageAvailable: function() { return Promise.resolve(true); },
        setApiKey:        function() { return Promise.resolve({ ok: false, managed: true }); },
        setGroqKey:       function() { return Promise.resolve({ ok: false, managed: true }); },
        setMistralKey:    function() { return Promise.resolve({ ok: false, managed: true }); },
        getGroqKeyStatus: function() { return Promise.resolve({ set: true, managed: true }); },

        // === Fournisseurs personnalises (stockes dans ce navigateur) ===
        customProvidersList: function() {
            return idbGet('customProviders').then(publicProviders);
        },
        customProvidersSave: function(d) {
            d = d || {};
            if (!d.name || !d.model || !/^https:\/\//i.test(d.baseUrl || '')) {
                return Promise.resolve({ ok: false, error: 'Nom, modele et URL en https:// requis' });
            }
            return idbGet('customProviders').then(function(list) {
                list = list || [];
                var cur = null;
                for (var i = 0; i < list.length; i++) if (d.id && list[i].id === d.id) cur = list[i];
                if (!cur) { cur = { id: 'c' + Date.now() }; list.push(cur); }
                cur.name = d.name; cur.baseUrl = d.baseUrl; cur.model = d.model;
                // Champ laisse vide en modification : la cle existante est conservee.
                if (typeof d.apiKey === 'string') cur.apiKey = d.apiKey.trim();
                return idbSet('customProviders', list).then(function() {
                    return { ok: true, providers: publicProviders(list) };
                });
            });
        },
        customProvidersDelete: function(id) {
            return idbGet('customProviders').then(function(list) {
                list = (list || []).filter(function(p) { return p.id !== id; });
                return idbSet('customProviders', list).then(function() {
                    return { ok: true, providers: publicProviders(list) };
                });
            });
        },
        customProvidersTest: function(id) {
            return chat('custom', { providerId: id, messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 })
                .then(function(r) { return { ok: !!(r && r.ok), error: r && r.error }; });
        },

        // === Memoire persistante → serveur (+ IndexedDB en cache) ===
        // C'est ce qui permet de retrouver ses conversations depuis
        // n'importe quel ordinateur. Voir syncPull/syncPush plus bas.
        persistRead:  syncPull,
        persistWrite: function(d) {
            _syncData = d || {};
            var now = Date.now();
            for (var k in _syncData) { if (_syncData.hasOwnProperty(k)) _syncTimes[k] = now; }
            saveLocalCache();
            return syncPush().then(function() { return { ok: true }; });
        },
        persistGet:   function(k) { return syncPull().then(function(v) { return (v || {})[k]; }); },
        persistSet:   function(k, val) {
            _syncData[k] = val;
            _syncTimes[k] = Date.now();
            saveLocalCache();
            schedulePush();
            return Promise.resolve({ ok: true });
        },

        // === Modes / Skills → IndexedDB ===
        modesList: function() { return idbGet('modes').then(function(v) { return v || []; }); },
        modeSave:  function(mode) {
            return idbGet('modes').then(function(list) {
                list = list || [];
                var found = false;
                for (var i = 0; i < list.length; i++) if (list[i].id === mode.id) { list[i] = mode; found = true; }
                if (!found) list.push(mode);
                return idbSet('modes', list);
            });
        },
        modeDelete: function(id) {
            return idbGet('modes').then(function(list) {
                list = (list || []).filter(function(m) { return m.id !== id; });
                return idbSet('modes', list);
            });
        },
        modeResourceList:   function(id) { return idbGet('res_' + id).then(function(v) { return v || []; }); },
        modeResourceAdd:    function(id, file) {
            return idbGet('res_' + id).then(function(list) {
                list = list || []; list.push(file); return idbSet('res_' + id, list);
            });
        },
        modeResourceDelete: function(id, resId) {
            return idbGet('res_' + id).then(function(list) {
                list = (list || []).filter(function(r) { return r.id !== resId; });
                return idbSet('res_' + id, list);
            });
        },

        // === Fichiers → API navigateur ===
        openFile: function() {
            return new Promise(function(resolve) {
                var input = document.createElement('input');
                input.type = 'file';
                input.onchange = function() {
                    var f = input.files && input.files[0];
                    if (!f) return resolve({ ok: false, canceled: true });
                    var reader = new FileReader();
                    reader.onload = function() { resolve({ ok: true, name: f.name, content: reader.result }); };
                    reader.onerror = function() { resolve({ ok: false, error: 'Lecture impossible' }); };
                    reader.readAsText(f);
                };
                input.click();
            });
        },
        saveFile: function(data) {
            try {
                var content = (data && data.content) || '';
                var name = (data && data.name) || 'ether.txt';
                var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = name;
                a.click();
                setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
                return Promise.resolve({ ok: true });
            } catch (e) { return Promise.resolve({ ok: false, error: e.message }); }
        },
        readFile:    unavailable('readFile'),
        browseFolder: unavailable('browseFolder'),

        // === Reseau / contenu ===
        fetchUrlContent: function(url) { return request('/api/fetch', { url: url }); },
        fetchImage:      function(url) { return request('/api/image', { url: url }); },
        imagine:         function(d) { return request('/api/imagine', d); },
        webSearch:       function(q) { return request('/api/search', { query: q }); },
        transcribeAudio: function(buf) { return request('/api/transcribe', { audio: buf }); },

        // === Quotas (cote serveur) ===
        quotaCheck:     function() { return request('/api/quota'); },
        quotaUse:       function(k) { return request('/api/quota/use', { key: k }); },

        // === Theme systeme → matchMedia ===
        getSystemTheme: function() {
            var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            return Promise.resolve(dark ? 'dark' : 'light');
        },
        onSystemThemeChanged: function(cb) {
            if (!window.matchMedia) return;
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var handler = function(e) { cb(e.matches ? 'dark' : 'light'); };
            if (mq.addEventListener) mq.addEventListener('change', handler);
            else if (mq.addListener) mq.addListener(handler);
        },

        // === Focus fenetre → evenements navigateur ===
        onFocusState: function(cb) {
            window.addEventListener('focus', function() { cb(true); });
            window.addEventListener('blur', function() { cb(false); });
        },

        // === Divers ===
        openExternal: function(url) {
            if (!url || typeof url !== 'string') return Promise.resolve();
            if (!/^https?:\/\//.test(url) && !/^mailto:/.test(url)) return Promise.resolve();
            window.open(url, '_blank', 'noopener,noreferrer');
            return Promise.resolve({ ok: true });
        },

        // === Comptes ===
        authSignup: function(d) {
            return authCall('/api/auth/signup', { name: d.name, email: d.email, password: d.password, code: inviteCode() });
        },
        authLogin:   function(d) { return authCall('/api/auth/login', { email: d.email, password: d.password }); },
        authRecover: function(d) { return authCall('/api/auth/recover', { email: d.email, recoveryCode: d.recoveryCode, newPassword: d.newPassword }); },
        // Apres connexion : recuperer le coffre du compte, puis recharger pour
        // que l'app demarre sur ces donnees.
        authFinish: function() {
            return syncPull().then(function() { location.reload(); });
        },
        // Deconnexion : dernier envoi, puis rien du compte ne reste dans ce
        // navigateur (ordinateur partage). Theme, langue et invitation restent.
        authLogout: function() {
            if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
            var push = getToken() ? syncPush() : Promise.resolve();
            var timeout = new Promise(function(r) { setTimeout(r, 3000); });
            return Promise.race([push, timeout]).then(wipeLocal);
        },
        accountExport: function() { return request('/api/account/export'); },
        aiUsage:       function() { return request('/api/usage'); },
        // Apres suppression, surtout pas de dernier envoi : il recreerait le coffre.
        accountDelete: function(password) {
            if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
            return request('/api/account/delete', { password: password }).then(function(r) {
                if (!r || !r.ok) return r;
                return wipeLocal().then(function() { return r; });
            });
        },
        authToken: getToken,

        // === Heritage desktop : sans objet dans un navigateur ===
        installUpdate:     unavailable('installUpdate'),
        onUpdateAvailable:  function() {},  // web : toujours a jour
        onUpdateDownloaded: function() {},
        getUserDataPath:   unavailable('getUserDataPath'),
        getApiPort:        unavailable('getApiPort'),
        getLocalIp:        unavailable('getLocalIp'),
        setNetworkMode:    unavailable('setNetworkMode'),

        isDesktop: false
    };

    // === ADAPTATION DE L'INTERFACE EN MODE WEB ===
    // Les champs de cles API n'ont plus de sens : les cles vivent dans les
    // Cloudflare Secrets et l'utilisateur n'en saisit aucune. On les masque
    // et on explique pourquoi, plutot que de laisser des champs inertes.
    function applyWebModeUI() {
        if (document.getElementById('ETHER-WEB-MODE-STYLE')) return;

        var style = document.createElement('style');
        style.id = 'ETHER-WEB-MODE-STYLE';
        style.textContent = [
            '#API-KEY-DISPLAY,#API-KEY-VIS{display:none !important}',
            '.ether-web-note{background:var(--b1);border:1px solid var(--bd);',
            'border-radius:14px;padding:12px 16px;margin-bottom:14px;',
            'font-size:.82rem;color:var(--t2);line-height:1.5}',
            '.ether-web-note strong{color:var(--t1)}'
        ].join('');
        document.head.appendChild(style);

        // Bandeau explicatif en tete de la section Fournisseurs
        var grid = document.querySelector('.prov-grid');
        if (grid && !document.querySelector('.ether-web-note')) {
            var note = document.createElement('div');
            note.className = 'ether-web-note';
            note.innerHTML = '<strong>Aucune cle requise.</strong> ' +
                'Par defaut, ETHER utilise les cles du serveur. Tu peux ajouter ' +
                'ta propre cle : elle reste dans ce navigateur, le serveur la ' +
                'transmet au fournisseur sans jamais l\'enregistrer, et tes ' +
                'messages ne comptent alors plus dans le quota.';
            grid.parentNode.insertBefore(note, grid);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyWebModeUI);
    } else {
        applyWebModeUI();
    }
    // Les reglages peuvent etre rendus apres coup : on repasse une fois.
    setTimeout(applyWebModeUI, 2000);

    console.log('[ETHER] Plateforme web active — API : ' + API_BASE);
})();
