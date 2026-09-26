// === ETHER — Plateforme web ===
//
// Expose window.etherDesktop, l'API de plateforme qu'utilise tout le renderer
// (le nom vient de l'ancienne version Electron). Chaque appel passe en HTTP
// par le worker Cloudflare, qui detient les cles API.

(function() {
    'use strict';

    // === Config ===
    var API_BASE = window.ETHER_API_BASE || 'https://ether-api.workers.dev';
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

    // === Inscription automatique ===
    // L'onboarding de l'app (formulaire prenom/email) est purement local et
    // ne connait pas le worker. On reutilise l'identite qu'il a stockee pour
    // obtenir un JWT, de facon transparente pour le reste du code.
    var _tokenPromise = null;

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

    function profile() {
        try {
            var u = JSON.parse(localStorage.getItem('ether_user') || '{}');
            return {
                name: u.name || u.firstName || 'Utilisateur',
                email: u.email || 'anonyme@ether.local'
            };
        } catch (e) {
            return { name: 'Utilisateur', email: 'anonyme@ether.local' };
        }
    }

    // Email encode dans le JWT courant, pour detecter un changement d'identite.
    function tokenEmail() {
        try {
            var t = getToken();
            if (!t) return '';
            var b = t.split('.')[1];
            if (!b) return '';
            b = b.replace(/-/g, '+').replace(/_/g, '/');
            while (b.length % 4) b += '=';
            return (JSON.parse(atob(b)) || {}).email || '';
        } catch (e) { return ''; }
    }

    var RELOAD_FLAG = 'ether__sync_reload';

    function registerNow() {
        if (_tokenPromise) return _tokenPromise;
        var p = profile();
        p.code = inviteCode();
        _tokenPromise = fetch(API_BASE + '/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
        }).then(function(r) { return r.json(); })
          .then(function(j) {
              if (j && j.token) { setToken(j.token); }
              else if (j && j.needCode) {
                  try { localStorage.removeItem(INVITE_KEY); } catch (e) {}
                  showInviteError(inviteCode()
                      ? 'Le code de votre lien n est pas valide. Demandez un lien a jour.'
                      : 'Ether AI est sur invitation. Ouvrez le lien qui vous a ete transmis, il contient le code d acces.');
              }
              _tokenPromise = null;
              return getToken();
          })
          .catch(function() { _tokenPromise = null; return ''; });
        return _tokenPromise;
    }

    function ensureToken(force) {
        // Au premier chargement l'app n'a pas encore d'identite : on s'inscrit
        // en anonyme. Des que l'utilisateur saisit son email dans l'onboarding,
        // il faut reprendre un token a son nom — sinon il ne retrouve jamais
        // ses conversations.
        if (!force && getToken() && tokenEmail() !== profile().email) {
            setToken('');
            _syncData = {};
            _syncTimes = {};
            saveLocalCache();

            return registerNow().then(function(tok) {
                // restoreFromPersist() est deja passe au demarrage, avec un
                // coffre anonyme vide. On retire le vrai coffre et on
                // recharge une fois pour que l'app le prenne en compte.
                return syncPull().then(function(data) {
                    var restaure = data && Object.keys(data).length > 0;
                    var dejaRecharge = false;
                    try { dejaRecharge = !!sessionStorage.getItem(RELOAD_FLAG); } catch (e) {}
                    if (restaure && !dejaRecharge) {
                        try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (e) {}
                        setTimeout(function() { location.reload(); }, 150);
                    }
                    return tok;
                });
            });
        }
        if (!force && getToken()) return Promise.resolve(getToken());
        return registerNow();
    }

    function isAuthError(res) {
        return res && res.ok === false && /Authorization required|Token invalide/i.test(res.error || '');
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

    // Appel JSON generique : garantit un token, et en redemande un si le
    // serveur le refuse (expire, secret change cote worker...).
    function request(path, body, method) {
        return ensureToken().then(function() {
            return rawRequest(path, body, method);
        }).then(function(res) {
            if (!isAuthError(res)) return res;
            return ensureToken(true).then(function() { return rawRequest(path, body, method); });
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

    function stream(provider, data, _retried) {
        var full = '';
        _abort = new AbortController();

        return ensureToken().then(function() { return fetch(API_BASE + '/api/chat/stream', {
            method: 'POST',
            headers: headers(),
            signal: _abort.signal,
            body: JSON.stringify({
                provider: provider,
                model: data && data.model,
                messages: data && data.messages,
                temperature: data && data.temperature,
                max_tokens: data && (data.max_tokens || data.maxTokens)
            })
        }); }).then(function(resp) {
            // Token refuse : on se reinscrit et on rejoue une seule fois.
            if (resp.status === 401 && !_retried) {
                return ensureToken(true).then(function() { return stream(provider, data, true); });
            }
            if (!resp.ok || !resp.body) {
                return resp.text().then(function(t) {
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
        return request('/api/chat', {
            provider: provider,
            model: data && data.model,
            messages: data && data.messages,
            temperature: data && data.temperature,
            max_tokens: data && (data.max_tokens || data.maxTokens)
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
        return request('/api/persist', { data: _syncData, keyTimes: _syncTimes })
            .catch(function() { return { ok: false }; });
    }

    // Les ecritures sont nombreuses (chaque frappe sauvegardee) : on regroupe.
    function schedulePush() {
        if (_pushTimer) clearTimeout(_pushTimer);
        _pushTimer = setTimeout(function() { _pushTimer = null; syncPush(); }, 1500);
    }

    loadLocalCache();

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
        geminiVision:    function(d) { return request('/api/vision', d); },

        groqTest:  function() { return request('/api/providers'); },
        groqStop:  function() { if (_abort) _abort.abort(); return Promise.resolve({ ok: true }); },
        getModels: function() { return request('/api/models'); },
        testAllProviders: function() { return request('/api/providers'); },

        // === Streaming : meme contrat que le pont IPC ===
        onChunk: function(cb) { _chunkCallbacks.push(cb); },
        onDone:  function(cb) { _doneCallbacks.push(cb); },
        removeStreamListeners: function() { _chunkCallbacks = []; _doneCallbacks = []; },

        // === Cles API : disparaissent en web ===
        // Les cles vivent dans les Cloudflare Secrets. L'utilisateur n'en saisit aucune.
        providerKeysStatus: function() {
            return request('/api/providers').then(function(r) {
                var out = {};
                var list = (r && r.providers) || [];
                for (var i = 0; i < list.length; i++) out[list[i].provider] = { set: !!list[i].ok, managed: true };
                return out;
            });
        },
        providerKeysSet:    function() { return Promise.resolve({ ok: false, error: 'Les cles sont gerees par le serveur', managed: true }); },
        providerKeysClear:  function() { return Promise.resolve({ ok: false, error: 'Les cles sont gerees par le serveur', managed: true }); },
        providerKeysTest:   function(p) { return request('/api/providers').then(function(r) {
            var list = (r && r.providers) || [];
            for (var i = 0; i < list.length; i++) if (list[i].provider === p) return { ok: !!list[i].ok };
            return { ok: false, error: 'Provider inconnu' };
        }); },
        secureStorageAvailable: function() { return Promise.resolve(false); },
        setApiKey:        function() { return Promise.resolve({ ok: false, managed: true }); },
        setGroqKey:       function() { return Promise.resolve({ ok: false, managed: true }); },
        setMistralKey:    function() { return Promise.resolve({ ok: false, managed: true }); },
        getGroqKeyStatus: function() { return Promise.resolve({ set: true, managed: true }); },

        // === Fournisseurs personnalises (stockes localement) ===
        customProvidersList:   function() { return idbGet('customProviders').then(function(v) { return v || []; }); },
        customProvidersSave:   function(d) {
            return idbGet('customProviders').then(function(list) {
                list = list || [];
                var found = false;
                for (var i = 0; i < list.length; i++) if (list[i].id === d.id) { list[i] = d; found = true; }
                if (!found) list.push(d);
                return idbSet('customProviders', list);
            });
        },
        customProvidersDelete: function(id) {
            return idbGet('customProviders').then(function(list) {
                list = (list || []).filter(function(p) { return p.id !== id; });
                return idbSet('customProviders', list);
            });
        },
        customProvidersTest:   function(id) { return request('/api/providers/test', { id: id }); },

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
        webSearch:       function(q) { return request('/api/search', { query: q }); },
        transcribeAudio: function(buf) { return request('/api/transcribe', { audio: buf }); },
        sendEmail:       function(d) { return request('/api/email', d); },

        // === Quotas (cote serveur) ===
        quotaCheck:     function() { return request('/api/quota'); },
        quotaUse:       function(k) { return request('/api/quota/use', { key: k }); },
        quotaAdBonus:   function(k, b) { return request('/api/quota/bonus', { key: k, bonus: b }); },
        quotaVerifyPro: function() { return request('/api/quota/pro'); },

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

        // === Auth (propre au web) ===
        authRegister: function(d) {
            return request('/api/register', d).then(function(r) {
                if (r && r.token) setToken(r.token);
                return r;
            });
        },
        authToken:    getToken,
        authSetToken: function(t) { setToken(t); return Promise.resolve({ ok: true }); },

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
            '.prov-key-row{display:none !important}',
            '#SAVE-KEYS{display:none !important}',
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
            note.innerHTML = '<strong>Cles gerees par le serveur.</strong> ' +
                'Dans la version web, les cles API sont stockees de maniere ' +
                'securisee cote serveur et ne transitent jamais par votre ' +
                'navigateur. Vous n\'avez aucune cle a saisir.';
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
