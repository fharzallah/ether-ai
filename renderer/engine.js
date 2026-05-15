// === ETHER — AI Engine (providers, routing, streaming) ===

// === RECHERCHE WEB (via main.js IPC — pas de CORS, cles securisees) ===
function webSearch(query) {
    if (window.etherDesktop) return window.etherDesktop.webSearch(query);
    // Fallback navigateur (ne devrait pas arriver en Electron)
    return Promise.resolve({ results: [], extract: '' });
}

// Détecteur de complexité (simple / medium / complex)
function detectComplexity(msg) {
    var m = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // 1. COMPLEX: raisonnement multi-étapes, code, débat, analyse
    var complexPatterns = [
        /(?:code|fonction|script|bug|erreur|algorithme|debug|programmation|java|python|javascript|cpp|html|css|php|rust|golang)/,
        /(?:analyse|examine|critique|etude approfondie|comparaison detaillee|decortique)/,
        /(?:raisonne|etape par etape|multi-etapes|logique|demonstration|pense)/,
        /(?:debat|argumente|contre-argument|avocat du diable|polemique|ton avis|ton opinion)/
    ];
    for (var i = 0; i < complexPatterns.length; i++) { if (complexPatterns[i].test(m)) return 'complex'; }

    // 2. MEDIUM: explication, résumé, traduction
    var mediumPatterns = [
        /(?:explique|comment fonctionne|pourquoi|vulgarise|eclaire-moi)/,
        /(?:resume|synthetise|recapitule|synthese|recap)/,
        /(?:traduis|traduction|en anglais|en francais|en espagnol|en allemand|en italien|en portugais|traduire)/
    ];
    for (var i = 0; i < mediumPatterns.length; i++) { if (mediumPatterns[i].test(m)) return 'medium'; }

    // 3. SIMPLE: salutation, question courte, reformulation
    var simplePatterns = [
        /^(salut|bonjour|bonsoir|hello|hi|hey|coucou|yo|slt|cc|wesh)/,
        /^(merci|ok|oui|non|d'accord|ca marche|super|cool|bien|genial|parfait|nickel)/,
        /(?:reformule|dis-le autrement|change le ton|redit|reformulation)/
    ];
    for (var i = 0; i < simplePatterns.length; i++) { if (simplePatterns[i].test(m)) return 'simple'; }

    // Question courte (moins de 50 caractères avec un point d'interrogation)
    if (m.length < 50 && m.indexOf('?') !== -1) return 'simple';

    // Par défaut, si c'est très court c'est simple, sinon medium
    return m.length < 30 ? 'simple' : 'medium';
}

// Detecter si une question est factuelle (necessite une recherche web)
function isFactualQuestion(msg) {
    var m = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Exclure les salutations, opinions, discussions, prompts courts informels
    var excluded = [/^(salut|bonjour|bonsoir|hello|hi|hey|coucou|yo|slt|cc|wesh)\s*[.!?]*$/, /^(merci|ok|oui|non|d'accord|ca marche|super|cool|bien|genial|parfait|nickel)\s*[.!?]*$/, /^(aide|aide-moi|help|aidez)$/, /(que penses|qu en penses|ton avis|donne.?moi.*avis|ton opinion)/, /(ecris|redige|invente|imagine|cree|genere|fais.?moi|raconte|propose)/, /^(comment vas|ca va|tu vas bien|comment tu)\b/];
    for (var e = 0; e < excluded.length; e++) { if (excluded[e].test(m)) return false; }
    // Questions factuelles explicites
    var factual = [
        /^(qui est|qui a|qui etait|qui sont|qui dirige|qui gouverne)/,
        /^(quelle? est|quels? sont|quelles? sont|quel est)/,
        /^(quand|en quelle annee|depuis quand|a quelle date)/,
        /^(combien|quel nombre|quel chiffre|quel taux|quel prix|quel age)/,
        /^(ou est|ou se trouve|ou se situe|dans quel pays|dans quelle ville)/,
        /^(c'est quoi|qu'est.ce que|qu est.ce qu|definition de)/,
        /(population|superficie|capitale|pib|monnaie|drapeau|hymne)/,
        /(president|premier ministre|roi|reine|dirigeant|chef d.etat|ministre|gouvernement)/,
        /(date de naissance|ne en|mort en|fonde en|cree en|invente en)/,
        /(distance entre|altitude|temperature|record|plus grand|plus petit|plus rapide)/,
        /(guerre|conflit|traite|accord|election|referendum|victoire|defaite)/,
        /(en 202[4-9]|en 203[0-9]|actuellement|aujourd'hui|recemment|dernierement)/,
        /(score|resultat|match|classement|championnat|coupe du monde)/
    ];
    for (var f = 0; f < factual.length; f++) { if (factual[f].test(m)) return true; }
    // Une question avec ? qui n'est pas une demande d'opinion
    if (/\?/.test(m.trim()) && m.length > 10 && m.length < 200) {
        if (!/(penses|avis|opinion|idee|conseil|suggestion|recommand|comment faire|comment puis)/.test(m)) return true;
    }
    return false;
}

// Health check des providers
var providerHealth = { groq: true, gemini: true, cerebras: true };

function checkProvidersHealth() {
    if (!window.etherDesktop || !window.etherDesktop.testAllProviders) return;

    console.log('[ENGINE] Checking providers health...');
    window.etherDesktop.testAllProviders().then(function(results) {
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            providerHealth[r.provider] = r.ok;
            // On synchronise aussi l'ancienne variable pour la compatibilité
            if (typeof providerStatus !== 'undefined') providerStatus[r.provider] = r.ok;
        }
        console.log('[ENGINE] Provider health:', JSON.stringify(providerHealth));
    })['catch'](function(err) {
        console.error('[ENGINE] Health check failed:', err);
    });
}

// Lancer le health check au démarrage
setTimeout(checkProvidersHealth, 2000);

function testApiKey() {
    if (window.etherDesktop) {
        return window.etherDesktop.groqTest().then(function(r) {
            return { success: true, apiWorks: r.count > 0, count: r.count, total: r.total, selected: r.models.join(', ') };
        });
    }
    return Promise.resolve({ success: false, apiWorks: false });
}

// Routing dynamique par règles
function getSmartRoute(message, mode) {
    if (typeof selectedModelOverride !== 'undefined' && selectedModelOverride) return selectedModelOverride;

    var complexity = detectComplexity(message);
    console.log('[ENGINE] Complexity detected:', complexity, 'Mode:', mode);

    // 1. Creative mode (all complexities) -> Gemini 2.5 Flash
    if (mode === 'creative' && providerHealth.gemini) {
        return { provider: 'gemini', model: GEMINI_MODELS.main };
    }

    // 2. Simple complexity (all modes) -> Groq fast
    if (complexity === 'simple' && providerHealth.groq) {
        return { provider: 'groq', model: GROQ_MODELS.fast };
    }

    // 3. Medium complexity (base mode) -> Groq main
    if (complexity === 'medium' && mode === 'base' && providerHealth.groq) {
        return { provider: 'groq', model: GROQ_MODELS.main };
    }

    // 4. Complex complexity
    if (complexity === 'complex') {
        if (mode === 'teacher' && providerHealth.groq) {
            return { provider: 'groq', model: GROQ_MODELS.reasoning };
        }
        if (mode === 'debate') {
            return { provider: 'collab', model: 'multi' };
        }
        if (mode === 'base' && providerHealth.gemini) {
            return { provider: 'gemini', model: GEMINI_MODELS.main };
        }
    }

    // Fallback cascade
    if (providerHealth.gemini) return { provider: 'gemini', model: GEMINI_MODELS.main };
    if (providerHealth.cerebras) return { provider: 'cerebras', model: CEREBRAS_MODELS.main };
    return { provider: 'groq', model: GROQ_MODELS.main };
}

function getSmartModel(message, mode) {
    var route = getSmartRoute(message, mode);
    return route.model;
}

// (ancien code de recherche web supprime — maintenant gere par main.js IPC)

var ETHER_ENGINE = {
    currentMode: 'base',
    teacherLevel: 'lycee',
    conversationHistory: [],
    conversationSummary: '', // Resume des anciens messages

    agents: {
        analyste: { name: 'Analyste', role: 'Examine les faits et la logique' },
        critique: { name: 'Critique', role: 'Cherche les failles et biais' },
        synthese: { name: 'Synthese', role: 'Unifie et conclut' }
    },

    // Choisir le modele selon le mode et la complexite du message
    getModelForMode: function(message) {
        if (message) return getSmartModel(message, this.currentMode);
        if (this.currentMode === 'teacher' || this.currentMode === 'debate') return GROQ_MODELS.reasoning;
        return GROQ_MODELS.main;
    },

    // === MEMOIRE CONTEXTUELLE LONGUE ===
    // Quand l'historique depasse 12 messages, resumer les anciens
    compactHistory: function() {
        var self = this;
        if (this.conversationHistory.length <= 12) return Promise.resolve();
        // Prendre les 8 premiers messages a resumer
        var toSummarize = this.conversationHistory.slice(0, this.conversationHistory.length - 6);
        var kept = this.conversationHistory.slice(this.conversationHistory.length - 6);
        var summaryText = '';
        for (var i = 0; i < toSummarize.length; i++) {
            var m = toSummarize[i];
            summaryText += (m.role === 'user' ? 'User' : 'ETHER') + ': ' + m.content.substring(0, 200) + '\n';
        }
        if (!window.etherDesktop) { self.conversationHistory = kept; return Promise.resolve(); }
        return window.etherDesktop.groqChat({
            model: GROQ_MODELS.fast,
            messages: [
                { role: 'system', content: 'Resume cette conversation en 2-3 phrases. Garde les faits importants, le contexte et les preferences. Francais. Resume UNIQUEMENT, rien d\'autre.' },
                { role: 'user', content: (self.conversationSummary ? 'Resume precedent: ' + self.conversationSummary + '\n\n' : '') + 'Nouveaux messages:\n' + summaryText }
            ],
            temperature: 0.2,
            max_tokens: 200
        }).then(function(res) {
            if (res.ok) self.conversationSummary = res.text.trim();
            self.conversationHistory = kept;
        })['catch'](function() {
            self.conversationHistory = kept;
        });
    },

    generateResponse: function(userMessage) {
        var self = this;
        var factual = isFactualQuestion(userMessage) && self.currentMode !== 'creative' && self.currentMode !== 'writer';
        // Toujours texte libre — le systeme de verification gere la confiance
        var useJson = false;
        var compactP = (this.conversationHistory.length > 12) ? self.compactHistory() : Promise.resolve();
        return compactP.then(function() {
            var shouldSearch = factual && canSearchWeb();

            if (shouldSearch) {
                useDaily('web');
                return webSearch(userMessage).then(function(webData) {
                    return self.callGroqWithWeb(userMessage, webData, false);
                })['catch'](function() {
                    return self.callGroq(userMessage, null, false);
                }).then(function(result) {
                    result._showBadge = false;
                    return result;
                });
            }
            return self.callGroq(userMessage, null, false)['catch'](function() {
                // Fallback ultime: appel NON-streaming a Groq (ne fail jamais)
                console.log('[ENGINE] Streaming failed — fallback non-streaming Groq');
                return window.etherDesktop.groqChat({
                    model: GROQ_MODELS.main,
                    messages: [{ role: 'system', content: self.getSystemPrompt(false) }].concat(
                        self.conversationHistory.slice(-10).map(function(h) { return { role: h.role === 'user' ? 'user' : 'assistant', content: h.content }; })
                    ).concat([{ role: 'user', content: userMessage }]),
                    temperature: 0.6, max_tokens: 3000
                }).then(function(r) {
                    if (r.ok && r.text) {
                        var ct = (r.text || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                        self.conversationHistory.push({ role: 'user', content: userMessage });
                        self.conversationHistory.push({ role: 'assistant', content: ct });
                        return self.parseResponse(ct);
                    }
                    return self.getSimulatedResponse(userMessage);
                })['catch'](function() {
                    return self.getSimulatedResponse(userMessage);
                });
            }).then(function(result) {
                result._showBadge = false;
                return result;
            });
        });
    },

    // === GROQ avec resultats web injectes ===
    callGroqWithWeb: function(userMessage, webData, useJson) {
        var self = this;
        var webContext = '';
        var webSources = [];

        if (webData && webData.extract) {
            webContext += '\n\n' + webData.extract;
        }
        if (webData && webData.results && webData.results.length > 0) {
            for (var i = 0; i < webData.results.length; i++) {
                var r = webData.results[i];
                if (r.snippet && r.snippet.length > 20) {
                    webContext += '\n[' + r.source + '] ' + r.title + ': ' + r.snippet;
                }
                if (r.source) webSources.push(r.source + (r.title ? ' — ' + r.title : ''));
            }
        }

        var enrichedPrompt = userMessage;
        if (webContext) {
            enrichedPrompt = userMessage + '\n\n---\nSOURCES WEB collectees:' + webContext + '\n---\nConsigne: reponds en combinant ces sources ET tes propres connaissances. Donne TOUS les details que tu connais meme si les sources ne les mentionnent pas. Chiffres, pourcentages, noms, dates. Sois exhaustif et precis.';
        }

        return self.callGroq(enrichedPrompt, webSources, useJson !== false);
    },

    // === MULTI-PROVIDER: Gemini → Groq → Cerebras → Pollinations ===
    callGroq: function(userMessage, forcedSources, useJson) {
        var self = this;
        var route = getSmartRoute(userMessage, self.currentMode);

        var sysPrompt = this.getSystemPrompt(useJson !== false);
        if (this.conversationSummary) {
            sysPrompt += '\n\nResume de la conversation precedente: ' + this.conversationSummary;
        }
        // Injecter la memoire avancee (categorisee)
        if (typeof MEMORY !== 'undefined') {
            sysPrompt += MEMORY.getPromptContext();
        }
        // Injecter le contexte RAG (documents de l'utilisateur)
        if (typeof RAG !== 'undefined') {
            sysPrompt += RAG.getContext(userMessage);
        }
        var messages = [{ role: 'system', content: sysPrompt }];
        var recent = this.conversationHistory.slice(-10);
        for (var i = 0; i < recent.length; i++) {
            messages.push({ role: recent[i].role === 'user' ? 'user' : 'assistant', content: recent[i].content });
        }
        messages.push({ role: 'user', content: userMessage });

        var requestData = {
            model: route.model,
            messages: messages,
            temperature: self.currentMode === 'creative' ? 0.9 : self.currentMode === 'debate' ? 0.8 : 0.6,
            max_tokens: 4000
        };

        if (!window.etherDesktop) return Promise.resolve(self.getSimulatedResponse(userMessage));

        // Mode COLLAB intelligent
        if (route.provider === 'collab') {
            return self._callCollab(userMessage, forcedSources, useJson);
        }

        // Streaming avec fallback automatique entre providers
        return self._streamMulti(requestData, forcedSources, route, useJson);
    },

    // === MODE COLLAB: 3 modeles en parallele + synthese ===
    _callCollab: function(userMessage, forcedSources, useJson) {
        var self = this;
        if (!window.etherDesktop) return Promise.resolve(self.getSimulatedResponse(userMessage));

        var langName = (G('SLG') && G('SLG').options[G('SLG').selectedIndex]) ? G('SLG').options[G('SLG').selectedIndex].text : 'Francais';
        var sysBase = 'Reponds a cette question de maniere complete, structuree et precise. Langue: ' + langName + '. Utilise du Markdown.';

        // Injecter les instructions custom
        try {
            var sett = JSON.parse(localStorage.getItem('ether_sett') || '{}');
            if (sett.profession) sysBase += ' L\'utilisateur est ' + sett.profession + '.';
            if (sett.instructions) sysBase += ' ' + sett.instructions;
        } catch(e) {}
        // Memoire avancee + RAG
        if (typeof MEMORY !== 'undefined') sysBase += MEMORY.getPromptContext();
        if (typeof RAG !== 'undefined') sysBase += RAG.getContext(userMessage);

        var contextMsgs = [];
        var recent = this.conversationHistory.slice(-6);
        for (var i = 0; i < recent.length; i++) {
            contextMsgs.push({ role: recent[i].role === 'user' ? 'user' : 'assistant', content: recent[i].content });
        }

        // Afficher un indicateur de progression
        hideThink();
        var collabEl = self._createCollabStreamElement();

        // Lancer 3 modeles differents en parallele
        var collabMsgs = [{ role: 'system', content: sysBase }].concat(contextMsgs).concat([{ role: 'user', content: userMessage }]);

        // 1. Gemini 2.5 Flash (thinking integre)
        var geminiP = providerStatus.gemini ? window.etherDesktop.geminiChat({
            model: GEMINI_MODELS.main,
            messages: collabMsgs,
            temperature: 0.6, max_tokens: 3000
        })['catch'](function() { return { ok: false }; }) : Promise.resolve({ ok: false });

        // 2. Groq Llama 3.3 70B (ultra-rapide)
        var groqP = window.etherDesktop.groqChat({
            model: GROQ_MODELS.main,
            messages: collabMsgs,
            temperature: 0.6, max_tokens: 3000
        })['catch'](function() { return { ok: false }; });

        // 3. Cerebras Qwen 235B
        var cerebrasP = providerStatus.cerebras ? window.etherDesktop.cerebrasChat({
            model: CEREBRAS_MODELS.main,
            messages: collabMsgs,
            temperature: 0.6, max_tokens: 3000
        })['catch'](function() { return { ok: false }; }) : Promise.resolve({ ok: false });

        var received = 0;
        var totalExpected = 1 + (providerStatus.gemini ? 1 : 0) + (providerStatus.cerebras ? 1 : 0);

        function updateProgress(name) {
            received++;
            if (collabEl) {
                var dots = '';
                for (var d = 0; d < received; d++) dots += '<span class="collab-dot done"></span>';
                for (var d2 = received; d2 < totalExpected; d2++) dots += '<span class="collab-dot"></span>';
                collabEl.innerHTML = '<div class="collab-progress">' + dots + '</div>'
                    + '<span class="collab-status">' + received + '/' + totalExpected + ' modeles ont repondu — ' + name + ' termine</span>';
                scr();
            }
        }

        geminiP = geminiP.then(function(r) { if (r.ok) updateProgress('Gemini'); return r; });
        groqP = groqP.then(function(r) { if (r.ok) updateProgress('Groq'); return r; });
        cerebrasP = cerebrasP.then(function(r) { if (r.ok) updateProgress('Cerebras'); return r; });

        return Promise.all([geminiP, groqP, cerebrasP]).then(function(results) {
            var responses = [];
            var providerNames = ['Gemini 2.5 Flash', 'Llama 3.3 70B (Groq)', 'Qwen 235B (Cerebras)'];
            for (var r = 0; r < results.length; r++) {
                if (results[r].ok && results[r].text) {
                    var cleanText = (results[r].text || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                    if (cleanText.length > 20) {
                        responses.push({ provider: providerNames[r], text: cleanText });
                    }
                }
            }

            if (responses.length === 0) {
                // Aucun modele n'a repondu
                if (collabEl) { var msgEl = collabEl.closest('.msg.a'); if (msgEl) msgEl.remove(); }
                return self.getSimulatedResponse(userMessage);
            }

            if (responses.length === 1) {
                // Un seul modele a repondu — utiliser directement
                if (collabEl) collabEl.innerHTML = '<span class="collab-status">Synthese...</span>';
                var soloResult = self.parseResponse(responses[0].text);
                soloResult._provider = 'collab';
                soloResult._model = 'collab';
                soloResult._streamed = true;
                soloResult._showBadge = false;
                soloResult._collabSources = [responses[0].provider];
                self.conversationHistory.push({ role: 'user', content: userMessage });
                self.conversationHistory.push({ role: 'assistant', content: responses[0].text });
                self._finalizeCollabElement(collabEl, soloResult, responses);
                return soloResult;
            }

            // 2+ reponses — synthese par un modele rapide
            if (collabEl) collabEl.innerHTML = '<div class="collab-progress"><span class="collab-dot done"></span><span class="collab-dot done"></span><span class="collab-dot done"></span></div><span class="collab-status">Synthese en cours...</span>';

            var synthPrompt = 'Tu es un expert en synthese. On t\'a donne ' + responses.length + ' reponses de differents modeles IA a la meme question. '
                + 'Cree UNE SEULE reponse optimale qui combine les meilleurs elements de chaque reponse. '
                + 'Prends les informations les plus precises, les meilleures formulations, les exemples les plus pertinents. '
                + 'Si les reponses se contredisent, indique-le et donne la version la plus fiable. '
                + 'Reponds en ' + langName + ' avec du Markdown. Ne mentionne PAS que tu synthetises plusieurs reponses.\n\n'
                + 'Question originale: ' + userMessage + '\n\n';

            for (var s = 0; s < responses.length; s++) {
                synthPrompt += '=== REPONSE ' + (s + 1) + ' (' + responses[s].provider + ') ===\n' + responses[s].text.substring(0, 2000) + '\n\n';
            }

            // Gemini pour la synthese (thinking integre)
            var synthFn = providerStatus.gemini ? window.etherDesktop.geminiChat : window.etherDesktop.groqChat;
            var synthModel = providerStatus.gemini ? GEMINI_MODELS.main : GROQ_MODELS.main;

            return synthFn({
                model: synthModel,
                messages: [
                    { role: 'system', content: 'Tu synthetises des reponses IA. Reponds en ' + langName + '. Markdown uniquement.' },
                    { role: 'user', content: synthPrompt }
                ],
                temperature: 0.4,
                max_tokens: 4000
            }).then(function(synthRes) {
                var finalText = synthRes.ok ? (synthRes.text || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim() : responses[0].text;
                var result = self.parseResponse(finalText);
                result._provider = 'collab';
                result._model = 'collab';
                result._streamed = true;
                result._showBadge = false;
                result._collabSources = responses.map(function(r) { return r.provider; });

                self.conversationHistory.push({ role: 'user', content: userMessage });
                self.conversationHistory.push({ role: 'assistant', content: finalText });

                self._finalizeCollabElement(collabEl, result, responses);
                return result;
            })['catch'](function() {
                // Fallback: utiliser la premiere reponse
                var result = self.parseResponse(responses[0].text);
                result._provider = 'collab';
                result._model = 'collab';
                result._streamed = true;
                result._showBadge = false;
                self.conversationHistory.push({ role: 'user', content: userMessage });
                self.conversationHistory.push({ role: 'assistant', content: responses[0].text });
                self._finalizeCollabElement(collabEl, result, responses);
                return result;
            });
        });
    },

    // Element de streaming pour le mode collab
    _createCollabStreamElement: function() {
        var d = document.createElement('div'); d.className = 'msg a collab-msg';
        d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt collab-stream">'
            + '<div class="collab-progress"><span class="collab-dot"></span><span class="collab-dot"></span><span class="collab-dot"></span></div>'
            + '<span class="collab-status">Les modeles reflechissent...</span>'
            + '</div></div>';
        G('MG').appendChild(d);
        var av = d.querySelector('.mav'); if (av) addMsgWave(av);
        scr();
        return d.querySelector('.collab-stream');
    },

    // Finaliser le message collab avec le resultat synthetise
    _finalizeCollabElement: function(collabEl, result, responses) {
        if (!collabEl) return;
        var msgDiv = collabEl.closest('.msg.a');
        if (!msgDiv) return;

        // Construire le bloc de contributions des modeles
        var contribHtml = '<div class="collab-contribs">'
            + '<button class="collab-toggle" onclick="this.parentElement.classList.toggle(\'open\')">'
            + '<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;margin-right:6px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>'
            + responses.length + ' modeles ont contribue'
            + '</button>'
            + '<div class="collab-details">';
        for (var c = 0; c < responses.length; c++) {
            var preview = responses[c].text.replace(/<[^>]+>/g, '').substring(0, 200);
            contribHtml += '<div class="collab-entry">'
                + '<div class="collab-name">' + esc(responses[c].provider) + '</div>'
                + '<div class="collab-preview">' + esc(preview) + '...</div>'
                + '</div>';
        }
        contribHtml += '</div></div>';

        // Badge collab
        var collabBadge = '<span class="cb collab-badge"><span class="cd"></span>Synthese collaborative</span>';

        var pt = (result.answer || '').replace(/<[^>]+>/g, '');
        var ptAttr = escAttr(pt);
        var mbd = msgDiv.querySelector('.mbd');
        mbd.innerHTML = contribHtml
            + '<div class="mt">' + sanitizeHTML(result.answer || '') + '</div>'
            + collabBadge
            + '<div class="ma"><button class="regen-btn" onclick="regenResponse(this)" title="Regenerer"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>' + t('btn_regen') + '</button><button class="mab" data-t="' + ptAttr + '" onclick="cpTxt(this)" title="Copier"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg></button></div>';
        msgDiv._etherData = result;
        processCodeBlocks(msgDiv);
        if (typeof generateFollowUpSuggestions === 'function' && result.answer) {
            generateFollowUpSuggestions(result.answer, null);
        }
    },

    // Streaming multi-provider avec cascade de fallback : groq -> gemini -> cerebras -> groq-chat
    _streamMulti: function(requestData, forcedSources, route, useJson) {
        var self = this;

        // Ordre de la cascade de streaming
        var cascade = [
            { provider: 'groq', model: route.provider === 'groq' ? route.model : GROQ_MODELS.main, stream: window.etherDesktop.groqStream },
            { provider: 'gemini', model: route.provider === 'gemini' ? route.model : GEMINI_MODELS.main, stream: window.etherDesktop.geminiStream },
            { provider: 'cerebras', model: route.provider === 'cerebras' ? route.model : CEREBRAS_MODELS.main, stream: window.etherDesktop.cerebrasStream }
        ];

        // On réordonne pour commencer par le provider recommandé par la route
        var startIdx = 0;
        for (var i = 0; i < cascade.length; i++) {
            if (cascade[i].provider === route.provider) { startIdx = i; break; }
        }
        var orderedCascade = cascade.slice(startIdx).concat(cascade.slice(0, startIdx));

        function tryStream(idx) {
            if (idx >= orderedCascade.length) {
                // FALLBACK ULTIME NON-STREAMING
                console.log('[ENGINE] All streams failed — fallback non-streaming Groq');
                return window.etherDesktop.groqChat({
                    model: GROQ_MODELS.main,
                    messages: requestData.messages,
                    temperature: requestData.temperature,
                    max_tokens: requestData.max_tokens
                }).then(function(r) {
                    if (r.ok && r.text) {
                        var ct = (r.text || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                        self.conversationHistory.push({ role: 'user', content: requestData.messages[requestData.messages.length - 1].content });
                        self.conversationHistory.push({ role: 'assistant', content: ct });
                        var result = self.parseResponse(ct);
                        result._provider = 'Groq-Chat';
                        result._model = GROQ_MODELS.main;
                        return result;
                    }
                    return self.getSimulatedResponse(requestData.messages[requestData.messages.length - 1].content);
                })['catch'](function() {
                    return self.getSimulatedResponse(requestData.messages[requestData.messages.length - 1].content);
                });
            }

            var step = orderedCascade[idx];

            // Skip si provider connu comme étant "down"
            if (!providerHealth[step.provider]) {
                console.log('[ENGINE] Skipping unhealthy provider:', step.provider);
                return tryStream(idx + 1);
            }

            console.log('[ENGINE] Trying stream: provider=' + step.provider + ', model=' + step.model);

            return self._streamWithProvider(step.stream, requestData, forcedSources, step.model, useJson, step.provider).catch(function(err) {
                console.log('[ENGINE] ' + step.provider + ' stream failed:', err && err.message);
                providerHealth[step.provider] = false;
                if (typeof providerStatus !== 'undefined') providerStatus[step.provider] = false;

                // Marquer pour re-test plus tard
                setTimeout(function() {
                    providerHealth[step.provider] = true;
                    if (typeof providerStatus !== 'undefined') providerStatus[step.provider] = true;
                }, 60000);

                return tryStream(idx + 1);
            });
        }

        return tryStream(0);
    },

    // Streaming via IPC — multi-provider
    _streamWithProvider: function(streamFn, requestData, forcedSources, model, useJson, providerName) {
        var self = this;
        return new Promise(function(resolve, reject) {
            var streamEl = self._createStreamElement();
            var resolved = false;
            isStreaming = true;
            showStopButton();

            function finalize(fullText, source) {
                if (resolved) return;
                resolved = true;
                isStreaming = false;
                hideStopButton();
                window.etherDesktop.removeStreamListeners();

                var cleanText = (fullText || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                if (!cleanText) cleanText = fullText || '';

                self.conversationHistory.push({ role: 'user', content: requestData.messages[requestData.messages.length - 1].content });
                self.conversationHistory.push({ role: 'assistant', content: cleanText });

                var result = self.parseResponse(cleanText);
                if (forcedSources && forcedSources.length > 0) {
                    result.sources = (result.sources || []).concat(forcedSources);
                }
                if (!forcedSources || !forcedSources.length) {
                    if (result.confidence === 'verified') result.confidence = 'to-verify';
                }
                result._model = model;
                result._provider = providerName || 'groq';
                result._streamed = true;
                result._showBadge = false;

                // === MoA ADAPTATIF (Mixture-of-Agents) ===
                var userMsg = requestData.messages[requestData.messages.length - 1].content;
                var plainAnswer = cleanText.replace(/<[^>]+>/g, '');
                var isSubstantial = userMsg.length > 20
                    && !/^(salut|bonjour|bonsoir|hello|hi|hey|merci|ok|oui|non|ca va|super|cool)/i.test(userMsg.trim());
                var isComplex = userMsg.length > 100
                    || /\b(compare|analyse|explique|avantages|inconvenients|difference|impact|consequence|enjeux|pourquoi|comment)\b/i.test(userMsg.toLowerCase())
                    || userMsg.split('?').length > 2;

                if (!isSubstantial || !window.etherDesktop) {
                    // Pas de collaboration pour les messages courts/salutations
                    self._finalizeStreamElement(streamEl, result);
                } else if (isComplex) {
                    // === MoA COMPLET: Critique + Reecriture (questions complexes) ===
                    // Couche 2: Critique — Qwen3 32B cherche les failles et manques
                    console.log('[MoA] Complex question detected — launching critique + rewrite');
                    window.etherDesktop.groqChat({
                        model: GROQ_MODELS.reasoning,
                        messages: [
                            { role: 'system', content: 'Tu es un CRITIQUE. Analyse cette reponse et liste:\n1. Les erreurs ou approximations a corriger\n2. Les infos manquantes (chiffres, exemples, perspectives)\n3. Les ameliorations de style possibles\nSois CONCIS. Max 5 points.' },
                            { role: 'user', content: 'Question: ' + userMsg + '\n\nReponse:\n' + plainAnswer.substring(0, 2500) }
                        ],
                        temperature: 0.3, max_tokens: 600
                    }).then(function(critiqueRes) {
                        var critique = (critiqueRes.ok && critiqueRes.text) ? critiqueRes.text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim() : 'Ameliorer le style et ajouter des exemples concrets.';

                        // Couche 3: TOUJOURS reecrire — Gemini reecrit avec un style journalistique
                        console.log('[MoA] Critique done (' + critique.length + ' chars) — launching rewrite');
                        var synthFn = providerStatus.gemini ? window.etherDesktop.geminiChat : window.etherDesktop.groqChat;
                        var synthModel = providerStatus.gemini ? GEMINI_MODELS.main : GROQ_MODELS.main;
                        synthFn({
                            model: synthModel,
                            messages: [
                                { role: 'system', content: 'Tu es un REECRIVAIN expert. On te donne un brouillon et des corrections a integrer.\n\nTon travail: REECRIS le contenu de ZERO avec un style JOURNALISTIQUE et ENGAGEANT.\n\nREGLES DE STYLE OBLIGATOIRES:\n- Commence par un fait marquant ou un chiffre percutant (pas par "Introduction" ou "L\'IA est en train de...")\n- INTERDICTION de faire des listes a puces de plus de 4 elements — utilise des paragraphes narratifs\n- INTERDICTION de repeter "l\'IA peut aider a" ou "selon [source]" plus de 2 fois\n- Utilise des exemples CONCRETS (pays, ecoles, chiffres reels)\n- Alterne entre paragraphes courts (2-3 lignes) et sous-titres en ## (pas de "Enjeux de...")\n- Ton direct, comme un article de journal, pas un devoir scolaire\n- Integre les corrections de la critique SANS mentionner la critique\n- Garde TOUTES les informations factuelles du brouillon' },
                                { role: 'user', content: 'BROUILLON A RECRIRE:\n' + plainAnswer.substring(0, 2500) + '\n\nCORRECTIONS A INTEGRER:\n' + critique.substring(0, 1000) + '\n\nReecris maintenant:' }
                            ],
                            temperature: 0.5, max_tokens: 4000
                        }).then(function(synthRes) {
                            if (synthRes.ok && synthRes.text && synthRes.text.length > 100) {
                                var improved = synthRes.text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                                result = self.parseResponse(improved);
                                result._provider = 'moa';
                                result._model = model;
                                result._streamed = true;
                                result._showBadge = false;
                                self.conversationHistory[self.conversationHistory.length - 1].content = improved;
                            }
                            self._finalizeStreamElement(streamEl, result);
                        })['catch'](function() {
                            self._finalizeStreamElement(streamEl, result);
                        });
                    })['catch'](function() {
                        self._finalizeStreamElement(streamEl, result);
                    });
                } else {
                    // === ENRICHISSEMENT SIMPLE (questions normales) ===
                    // Un seul appel rapide pour ajouter ce qui manque
                    window.etherDesktop.groqChat({
                        model: GROQ_MODELS.fast, // Llama 8B = ultra-rapide
                        messages: [
                            { role: 'system', content: 'On te donne une reponse. Ajoute UNIQUEMENT les infos manquantes (chiffres, dates, noms, exemples). NE REPETE RIEN. Si complet, reponds: COMPLET. Max 3 points.' },
                            { role: 'user', content: 'Q: ' + userMsg + '\nR: ' + plainAnswer.substring(0, 1500) + '\nManque:' }
                        ],
                        temperature: 0.2, max_tokens: 400
                    }).then(function(enrichRes) {
                        if (enrichRes.ok && enrichRes.text && enrichRes.text.length > 30 && !/^COMPLET/i.test(enrichRes.text)) {
                            var extra = enrichRes.text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                            if (extra.length > 30 && extra.length < plainAnswer.length) {
                                var combined = cleanText + '\n\n' + extra;
                                result = self.parseResponse(combined);
                                result._provider = 'moa-light';
                                result._model = model;
                                result._streamed = true;
                                result._showBadge = false;
                                self.conversationHistory[self.conversationHistory.length - 1].content = combined;
                            }
                        }
                        self._finalizeStreamElement(streamEl, result);
                    })['catch'](function() {
                        self._finalizeStreamElement(streamEl, result);
                    });
                }

                // Notification si fenetre pas au focus
                var notifText = (result.answer || '').replace(/<[^>]+>/g, '').substring(0, 100);
                sendNotif('ETHER a repondu', notifText);
                // Auto-detection memoire (systeme avance)
                if (typeof MEMORY !== 'undefined') {
                    MEMORY.extractFromConversation(requestData.messages[requestData.messages.length - 1].content, result.answer);
                }
                // Verification anti-hallucination (non-bloquant, apres affichage)
                if (typeof verifyResponse === 'function' && result.answer && !result._noSuggestions) {
                    var msgParent = streamEl ? streamEl.closest('.msg.a') : null;
                    verifyResponse(result.answer, msgParent);
                }
                // Generer les suggestions de suivi pour les messages streames
                if (typeof generateFollowUpSuggestions === 'function' && result.answer && !result._noSuggestions) {
                    var userQ = requestData.messages[requestData.messages.length - 1].content;
                    generateFollowUpSuggestions(result.answer, streamEl, userQ);
                }
                resolve(result);
            }

            function handleError(errMsg) {
                if (resolved) return;
                resolved = true;
                isStreaming = false;
                hideStopButton();
                window.etherDesktop.removeStreamListeners();
                if (streamEl) { var msgEl = streamEl.closest('.msg.a'); if (msgEl) msgEl.remove(); }
                reject(new Error(errMsg || 'Stream error'));
            }

            window.etherDesktop.removeStreamListeners();

            window.etherDesktop.onChunk(function(chunk) {
                if (!streamEl || resolved) return;
                var cur = streamEl.getAttribute('data-raw') || '';
                cur += chunk;
                streamEl.setAttribute('data-raw', cur);
                var display = cur.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                if (useJson !== false) {
                    // Mode JSON: extraire le champ "answer" du JSON en cours de construction
                    var answerMatch = display.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)("?)$/s);
                    if (answerMatch) {
                        var partial = answerMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, ' ').replace(/<\/p>/g, '</p>\n');
                        streamEl.innerHTML = partial + '<span class="stream-cursor"></span>';
                    }
                } else {
                    // Mode texte libre: convertir le markdown en temps reel
                    streamEl.innerHTML = renderMarkdown(display) + '<span class="stream-cursor"></span>';
                }
                scr();
            });

            window.etherDesktop.onDone(function(fullText) {
                finalize(fullText, 'onDone');
            });

            streamFn(requestData).then(function(res) {
                if (!res.ok) {
                    handleError(res.error);
                } else if (!resolved) {
                    // Filet de securite — finalize avec le texte de la Promise si onDone n'a pas ete recu
                    setTimeout(function() {
                        if (!resolved) finalize(res.text, 'promise-fallback');
                    }, 500);
                }
            })['catch'](function(e) {
                handleError(e.message);
            });
        });
    },

    // Creer l'element de message pour le streaming
    _createStreamElement: function() {
        hideThink();
        var d = document.createElement('div'); d.className = 'msg a';
        d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt stream-text"><span class="stream-cursor"></span></div></div>';
        G('MG').appendChild(d);
        var av = d.querySelector('.mav'); if (av) addMsgWave(av);
        return d.querySelector('.stream-text');
    },

    // Remplacer le contenu streaming par le message final
    _finalizeStreamElement: function(streamEl, result) {
        if (!streamEl) return;
        var msgDiv = streamEl.closest('.msg.a');
        if (!msgDiv) return;

        // Reconstruire le message complet
        var rh = '';
        if (result.reasoning) { var keys = ['analyste','critique','synthese']; var ah = ''; for (var i = 0; i < keys.length; i++) { var k = keys[i]; ah += '<div class="ra"><div class="an">' + ETHER_ENGINE.agents[k].name + '</div><div>' + (result.reasoning[k] || '') + '</div></div>'; } rh = '<button class="rt" onclick="togR(this)"><span class="ar">&#9654;</span> '+t('reasoning')+'</button><div class="rc">' + ah + '</div>'; }
        var pt = (result.answer || '').replace(/<[^>]+>/g, '');
        var mbd = msgDiv.querySelector('.mbd');
        mbd.innerHTML = rh + '<div class="mt">' + (result.answer || '') + '</div><div class="ma"><button class="regen-btn" onclick="regenResponse(this)" title="Regenerer"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>'+t('btn_regen')+'</button><button class="mab" onclick="vote(this)" title="Bien"><svg viewBox="0 0 24 24"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a4.8 4.8 0 00-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84A2.33 2.33 0 009.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" fill="currentColor"/></svg></button><button class="mab" onclick="vote(this)" title="Pas bien"><svg viewBox="0 0 24 24"><path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h5.5l-.92 4.65c-.05.22-.02.46.08.66.23.45.52.86.88 1.22L10 22l6.41-6.41c.38-.38.59-.89.59-1.42V6.34A2.33 2.33 0 0014.66 4H6.56c-.71 0-1.37.37-1.73.97L2.17 11.12z" fill="currentColor"/></svg></button><button class="mab" data-t="' + esc(pt) + '" onclick="cpTxt(this)" title="Copier"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg></button></div>';
        msgDiv._etherData = result;
        processCodeBlocks(msgDiv);
    },

    // === POLLINATIONS (dernier fallback) ===
    callPollinations: function(userMessage) {
        var self = this;
        var sp = this.getSystemPrompt();
        var ctx = '';
        var recent = this.conversationHistory.slice(-10);
        for (var i = 0; i < recent.length; i++) {
            if (recent[i].role === 'user') ctx += 'User: ' + recent[i].content + '\n';
            else ctx += 'ETHER: ' + recent[i].content + '\n';
        }
        var full = sp + '\n\n' + (ctx ? 'Historique:\n' + ctx + '\n' : '') + 'User: ' + userMessage;

        if (!window.etherDesktop || !window.etherDesktop.pollinationsChat) {
            return Promise.reject(new Error('Pollinations non disponible'));
        }
        return window.etherDesktop.pollinationsChat({ prompt: full }).then(function(res) {
            if (res.ok && res.text) {
                self.conversationHistory.push({ role: 'user', content: userMessage });
                self.conversationHistory.push({ role: 'assistant', content: res.text });
                var result = self.parseResponse(res.text);
                if (result.confidence === 'verified') result.confidence = 'to-verify';
                result._model = 'pollinations';
                return result;
            }
            throw new Error(res.error || 'Pollinations error');
        });
    },

    getSystemPrompt: function(useJson) {
        var langName = (G('SLG') && G('SLG').options[G('SLG').selectedIndex]) ? G('SLG').options[G('SLG').selectedIndex].text : 'Francais';
        var formatBlock = '';
        if (useJson === false) {
            formatBlock = '=== FORMAT ===\n'
+ 'Reponds en texte libre avec du Markdown. Pas de JSON.\n'
+ 'Structure ta reponse avec des paragraphes clairs. Utilise **gras**, *italique*, listes (- ou 1.), titres (## ##), blocs de code (```lang), tableaux si pertinent.\n'
+ 'Ne mets PAS de HTML. Utilise du Markdown pur.';
        } else {
            formatBlock = '=== FORMAT ===\n'
+ 'Reponds UNIQUEMENT en JSON brut, rien avant ni apres:\n'
+ '{"reasoning":{"analyste":"ton analyse factuelle","critique":"ce qui ne va pas ou les limites","synthese":"ta conclusion franche"},"answer":"reponse en Markdown","confidence":"verified|to-verify|unverified","sources":["source1"]}\n'
+ 'Regles: answer = texte Markdown (**gras**, listes, code, etc). Si SOURCES fournies = "verified". Sans sources = "to-verify" ou "unverified". Ne mets PAS de HTML dans answer, uniquement du Markdown.';
        }
        var base = 'Tu es ETHER.\n\n'
+ '=== QUI TU ES ===\n'
+ 'Tu n\'es pas un assistant complaisant. Tu es un partenaire intellectuel exigeant.\n'
+ 'Tu es franc, honnete, direct. Tu ne dis pas a l\'utilisateur ce qu\'il veut entendre — tu lui dis ce qu\'il a BESOIN d\'entendre.\n'
+ 'Si une idee est mauvaise, tu le dis clairement, tu expliques pourquoi, et tu proposes comment la rendre meilleure.\n'
+ 'Si l\'utilisateur dit n\'importe quoi, tu le corriges avec respect mais sans complaisance.\n'
+ 'Si une question est vague ou mal posee, tu le signales et tu aides a la reformuler.\n'
+ 'Tu ne flattes jamais. Tu ne fais jamais semblant d\'etre impressionne. Tu es authentique.\n'
+ 'Mais tu es aussi bienveillant : ton objectif est TOUJOURS d\'aider l\'utilisateur a progresser, a avoir de meilleures idees, a prendre de meilleures decisions.\n'
+ 'Tu es comme un ami brillant qui te respecte trop pour te mentir.\n\n'
+ '=== COMMENT TU REPONDS ===\n'
+ 'Tu tutoies l\'utilisateur sauf s\'il te vouvoie.\n'
+ 'Tu es concis quand la question est simple, detaille quand elle est complexe.\n'
+ 'Tu structures tes reponses avec des paragraphes clairs.\n'
+ 'Tu assumes tes positions. Tu ne dis pas "cela depend" quand tu as un avis — tu donnes ton avis et tu l\'argumentes.\n'
+ 'Quand tu n\'es pas sur, tu le dis franchement au lieu de broder.\n'
+ 'Tu utilises l\'humour quand c\'est pertinent, jamais force.\n\n'
+ '=== REGLES ABSOLUES ===\n'
+ 'Tu ne mentionnes JAMAIS ton "knowledge cutoff", ta "date d\'entrainement", tes "limites de connaissances" ou le fait que tes donnees datent de telle annee.\n'
+ 'Tu ne dis JAMAIS "je ne peux pas savoir car mes informations datent de..." ou "en tant qu\'IA, je n\'ai pas acces a...".\n'
+ 'Tu reponds comme si tu avais acces a toutes les informations actuelles. Si des sources web te sont fournies, utilise-les naturellement sans mentionner qu\'elles viennent d\'une recherche.\n'
+ 'Tu ne refuses JAMAIS de repondre a une question factuelle. Si tu n\'es pas certain, donne la meilleure reponse possible.\n\n'
+ '=== PRECISION ===\n'
+ 'Tu donnes TOUJOURS des reponses DETAILLEES et PRECISES.\n'
+ 'Pour les questions factuelles: donne les CHIFFRES, POURCENTAGES, NOMS, DATES, MONTANTS exacts quand tu les connais.\n'
+ 'Si tu as le chiffre exact, donne-le. Si tu ne l\'as pas, donne une estimation avec une fourchette et dis clairement "estime a environ X%".\n'
+ 'INTERDIT: repeter "une part significative", "un montant important", "une partie considerable" sans chiffre. C\'est VIDE et INUTILE.\n'
+ 'Si tu n\'as vraiment pas l\'info precise, dis-le franchement: "Le chiffre exact n\'est pas public" plutot que d\'etre vague.\n'
+ 'Quand tu listes des acteurs/elements, sois EXHAUSTIF — ne t\'arrete pas a 2-3 exemples si il y en a plus.\n'
+ 'Structure tes reponses avec des listes, des tableaux Markdown si pertinent, des sous-sections.\n'
+ 'Une bonne reponse = complete, precise, structuree, avec des donnees concretes.\n'
+ 'NE TE REPETE JAMAIS. Dis chaque information UNE SEULE FOIS. Pas de "en resume", "en conclusion", "pour resumer" qui repete ce qui a deja ete dit.\n'
+ 'NE GENERE JAMAIS de JSON dans ta reponse. Reponds toujours en texte libre avec du Markdown.\n\n'
+ '=== LANGUE ===\n'
+ 'Reponds TOUJOURS en ' + langName + '. Zero faute d\'orthographe.\n'
+ 'Tu TUTOIES TOUJOURS l\'utilisateur. Jamais de "vous", toujours "tu/te/ton/ta". C\'est une regle ABSOLUE.\n\n'
+ formatBlock;

        // Injecter les instructions personnalisees
        try {
            var sett = JSON.parse(localStorage.getItem('ether_sett') || '{}');
            if (sett.profession) base += '\nL\'utilisateur est ' + sett.profession + '. Adapte tes reponses a son niveau et son domaine.';
            if (sett.instructions) base += '\nInstructions de l\'utilisateur: ' + sett.instructions;
        } catch(e) {}

        // Memoire injectee dans callGroq() via MEMORY.getPromptContext()

        // Injecter le nom de l'utilisateur
        try {
            var usr = JSON.parse(localStorage.getItem('ether_user') || '{}');
            if (usr.name) base += '\nL\'utilisateur s\'appelle ' + usr.name + '.';
        } catch(e) {}

        var modes = {
            base: base + '\n\n=== MODE BASE ===\nAnalyse chaque question sous tous les angles. Donne les pour ET les contre. Si l\'utilisateur a tort, dis-le. Si son idee est bonne, ameliore-la. Ne sois jamais tiede.',
            teacher: base + '\n\n=== MODE TEACHER ===\n'
+ (typeof TEACHER_MEMORY !== 'undefined' ? TEACHER_MEMORY.getPromptContext() : '') + '\n\n'
+ 'Tu es un tuteur personnel brillant. Ton objectif: faire COMPRENDRE, pas reciter.\n\n'
+ 'PREMIERE SESSION (niveau non calibre):\n'
+ '- Donne une explication courte et accessible de ce que l\'utilisateur demande\n'
+ '- A la fin, ajoute EXACTEMENT 3 questions pour evaluer son niveau. Formule-les en tutoyant: "Pour que je m\'adapte a toi:"\n'
+ '- IMPORTANT: c\'est la SEULE FOIS que tu poses des questions diagnostiques. Apres la reponse de l\'utilisateur, tu passes en mode enseignement, tu ne reposes PAS de questions de diagnostic.\n\n'
+ 'APRES LE DIAGNOSTIC (l\'utilisateur a repondu aux questions):\n'
+ '- Analyse ses reponses pour determiner son niveau (debutant/intermediaire/avance/expert)\n'
+ '- Dis-lui clairement son niveau: "D\'apres tes reponses, je te situe au niveau [X]. Voici comment on va travailler:"\n'
+ '- Puis commence a enseigner directement avec la methode adaptee\n'
+ '- Ne repose PLUS de questions diagnostiques. Passe a l\'enseignement.\n\n'
+ 'SESSIONS SUIVANTES (niveau connu):\n'
+ '- DEBUTANT: vocabulaire simple, analogies du quotidien ("imagine que..."), etapes tres detaillees, exemples concrets, encourage beaucoup\n'
+ '- INTERMEDIAIRE: termes techniques introduits progressivement, exercices pratiques, liens entre concepts, "pourquoi" avant "comment"\n'
+ '- AVANCE: droit au coeur du sujet, nuances, cas limites, references academiques, defis intellectuels\n'
+ '- EXPERT: discussion de pair a pair, debat, frontieres du sujet, papiers de recherche, questions ouvertes\n\n'
+ 'METHODE PEDAGOGIQUE:\n'
+ '- Methode socratique: guide vers la reponse par des questions plutot que de la donner\n'
+ '- Si l\'eleve se trompe: "Non, ce n\'est pas ca." + explique POURQUOI c\'est faux + guide vers la bonne reponse\n'
+ '- Utilise des analogies concretes et visuelles\n'
+ '- Apres chaque point cle, verifie: pose UNE question de comprehension (pas un quiz)\n'
+ '- Felicite les vrais progres. Si la reponse est mediocre, dis-le franchement et aide a faire mieux\n'
+ '- Si l\'eleve maitrise, propose un niveau au-dessus ou un sujet connexe\n\n'
+ 'INTERDIT:\n'
+ '- Vouvoyer (TOUJOURS tutoyer)\n'
+ '- Reposer des questions diagnostiques apres la premiere serie\n'
+ '- Faire un cours magistral long — maximum 3-4 paragraphes puis une interaction\n'
+ '- Dire "C\'est tout a fait correct !" de maniere complaisante — sois authentique\n'
+ '- Etre condescendant',
            debate: base + '\n\n=== MODE DEBAT ===\n'
+ 'Tu es un partenaire de debat intelligent. Ton comportement depend du TYPE de message de l\'utilisateur:\n\n'
+ '1. SI L\'UTILISATEUR EXPRIME UNE OPINION OU UN AVIS (ex: "je pense que...", "a mon avis...", "le mieux c\'est...", "X est mieux que Y", une preference, un jugement de valeur):\n'
+ '   → Tu deviens l\'avocat du diable. Tu prends la position OPPOSEE. Tu deconstruis ses arguments. Tu cherches les failles logiques, les biais, les presupposes. Tu es percutant mais jamais mechant. L\'objectif : rendre son raisonnement inattaquable. Tu dois le challenger intellectuellement.\n\n'
+ '2. SI L\'UTILISATEUR ENONCE UN FAIT, UNE AFFIRMATION FACTUELLE OU UNE QUESTION (ex: "la Terre tourne autour du Soleil", "combien de...", "qui est...", une info, une donnee):\n'
+ '   → Tu ne contredis PAS. Tu confirmes si c\'est correct, tu corriges si c\'est faux, tu completes si c\'est incomplet.\n'
+ '   → Puis tu PROPOSES un sujet de debat en lien avec cette affirmation. Formule-le comme une question provocante ou un dilemme. Exemple: si l\'utilisateur dit "L\'IA remplace des emplois", tu confirmes le fait puis tu proposes: "Mais est-ce que la destruction d\'emplois par l\'IA est vraiment un probleme, ou une opportunite deguisee? Qu\'en penses-tu?"\n\n'
+ '3. SI LE MESSAGE N\'A PAS DE LIEN AVEC UN SUJET DEBATTABLE (salutation, question technique simple, etc.):\n'
+ '   → Reponds normalement, puis propose un sujet de debat interessant et actuel. Formule-le de maniere engageante pour donner envie a l\'utilisateur de debattre.\n\n'
+ 'STYLE: Sois passionne, structure tes arguments, utilise des exemples concrets et des contre-exemples. Ne sois jamais d\'accord trop vite — meme quand l\'utilisateur fait un bon argument, pousse-le a aller plus loin.',
            creative: base + '\n\n=== MODE CREATIF ===\n'
+ 'Tu es un directeur de creation et un expert en brainstorming. Ton role est de generer des idees brillantes ET actionnables.\n\n'
+ 'PROCESSUS CREATIF:\n'
+ '1. COMPRENDRE — Avant de generer, identifie le type de demande:\n'
+ '   - Idee business/produit → pense marche, utilisateur, monetisation\n'
+ '   - Idee artistique (scenario, histoire, musique) → pense emotion, originalite, structure narrative\n'
+ '   - Resolution de probleme → pense causes profondes, analogies avec d\'autres domaines\n'
+ '   - Nom/branding → pense sonorité, memorabilite, disponibilite\n'
+ '   - Contenu (post, video, campagne) → pense audience, viralite, hook\n\n'
+ '2. GENERER — Utilise des techniques creatives:\n'
+ '   - Inversion: "Et si on faisait exactement le contraire?"\n'
+ '   - Analogie: "Quel domaine totalement different a resolu un probleme similaire?"\n'
+ '   - Contrainte: "Et si on devait le faire avec zero budget / en 24h / pour des enfants?"\n'
+ '   - Combinaison: "Et si on fusionnait X avec Y?"\n'
+ '   - Exageration: "Et si on poussait cette idee a l\'extreme?"\n'
+ '   Genere au moins 5-8 idees, dont 2-3 volontairement audacieuses/folles.\n\n'
+ '3. TRIER — Pour chaque idee, donne:\n'
+ '   - Un titre accrocheur en gras\n'
+ '   - 1-2 phrases d\'explication\n'
+ '   - Un tag: [Realiste] [Ambitieux] [Experimental]\n\n'
+ '4. APPROFONDIR — Termine en developpant la meilleure idee: plan d\'action concret, premieres etapes, ressources necessaires.\n\n'
+ 'STYLE: Sois enthousiaste mais honnete. Dis clairement quand une idee est bancale. Ne censure aucune idee au stade du brainstorming — trie APRES avoir genere.',

            writer: base + '\n\n=== MODE ECRITURE ===\n'
+ 'Tu es un redacteur professionnel polyvalent. Tu maitrises tous les formats et tous les tons.\n\n'
+ 'PROCESSUS D\'ECRITURE:\n'
+ '1. CADRER — Si l\'utilisateur ne precise pas, demande (en UNE question concise):\n'
+ '   - Le format (email, article, post LinkedIn/Instagram, lettre, discours, essai, histoire, poeme, script, communique de presse, CV, rapport...)\n'
+ '   - Le ton (formel, decontracte, persuasif, emotionnel, humoristique, academique, journalistique...)\n'
+ '   - Le destinataire (collegue, client, grand public, recruteur, ami...)\n'
+ '   Si le contexte est EVIDENT (ex: "ecris un email a mon patron"), ne pose PAS de question — ecris directement.\n\n'
+ '2. REDIGER — Produis un texte:\n'
+ '   - Zero faute d\'orthographe ou de grammaire\n'
+ '   - Vocabulaire precis et adapte au registre\n'
+ '   - Structure claire (accroche, developpement, conclusion)\n'
+ '   - Phrases variees (courtes pour l\'impact, longues pour la nuance)\n'
+ '   - Pas de cliches, pas de formules creuses\n\n'
+ '3. AMELIORER — Apres le texte:\n'
+ '   - Propose 1-2 variantes de ton ou d\'angle si pertinent (ex: version formelle vs decontractee)\n'
+ '   - Signale ce qui pourrait etre ameliore et pourquoi\n'
+ '   - Si c\'est un email/lettre, propose un objet/sujet accrocheur\n\n'
+ 'REGLES:\n'
+ '- Adapte la longueur au format (un tweet ≠ un article de fond)\n'
+ '- Ne rajoute pas de texte meta ("voici le texte", "j\'espere que ca convient") — livre le contenu directement\n'
+ '- Si l\'utilisateur demande une reecriture ou correction, montre clairement les changements\n'
+ '- Pour les contenus longs, utilise des sous-titres et une structure visible',
        };
        // Modes personnalises
        if (this.currentMode && this.currentMode.indexOf('custom_') === 0) {
            var cmId = this.currentMode.replace('custom_', '');
            var cm = null;
            var cms = JSON.parse(localStorage.getItem('ether_custom_modes') || '[]');
            for (var ci = 0; ci < cms.length; ci++) { if (cms[ci].id === cmId) { cm = cms[ci]; break; } }
            if (cm) {
                var customPrompt = base + '\nTu es en mode "' + cm.name + '".';
                if (cm.specialty) customPrompt += ' Ta specialite: ' + cm.specialty + '.';
                if (cm.style) customPrompt += ' Style de reponse: ' + cm.style + '.';
                if (cm.instructions) customPrompt += ' Instructions: ' + cm.instructions;
                return customPrompt;
            }
        }
        return modes[this.currentMode] || modes.base;
    },

    getLevelLabel: function() {
        var labels = { college: 'collegien', lycee: 'lyceen', etudiant: 'etudiant', pro: 'professionnel' };
        return labels[this.teacherLevel] || 'lyceen';
    },

    parseResponse: function(text) {
        try {
            var cleaned = text.trim();
            // Enlever les blocs code markdown
            if (cleaned.indexOf('```') !== -1) cleaned = cleaned.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
            // Nettoyer les repetitions, conclusions parasites et JSON
            // Supprimer les blocs "En résumé/Conclusion/Pour conclure" en fin de réponse
            cleaned = cleaned.replace(/\n+\s*#{0,3}\s*(?:En r[eé]sum[eé]|Conclusion|Pour r[eé]sumer|En somme|En d[eé]finitive|Pour conclure|R[eé]capitulatif|Synth[eè]se finale|En bref|Pour r[eé]capituler)[^\n]*\n[\s\S]*$/i, '');
            cleaned = cleaned.replace(/\n+(?:En r[eé]sum[eé]|Conclusion)[,.:]\s*\n[\s\S]*$/i, '');
            // Supprimer les paragraphes qui commencent par "En résumé," au milieu du texte
            cleaned = cleaned.replace(/\n+(?:En r[eé]sum[eé],|Pour r[eé]sumer,|En d[eé]finitive,)[^\n]*(?:\n[^\n#]+)*/gi, '');
            // Supprimer le JSON parasite
            cleaned = cleaned.replace(/\{[\s]*"reasoning"[\s\S]*$/m, '');
            cleaned = cleaned.replace(/\{[\s]*"analyste"[\s\S]*$/m, '');
            cleaned = cleaned.replace(/\{[\s]*"answer"[\s\S]*$/m, '');
            // Supprimer les meta-commentaires
            cleaned = cleaned.replace(/\n+(?:Confiance|Confidence)\s*:\s*\w+[\s\S]*$/i, '');
            cleaned = cleaned.replace(/\n+Sources?\s*:\s*\n[\s\S]*$/i, '');
            cleaned = cleaned.trim();
            // Si le texte ne commence pas par { => traiter comme texte libre
            var firstChar = cleaned.charAt(0);
            if (firstChar !== '{') {
                var thinkM = cleaned.match(/<think>([\s\S]*?)<\/think>/);
                var cleanH = cleaned.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                if (!cleanH) cleanH = cleaned;
                cleanH = renderMarkdown(cleanH);
                var thinkReason = null;
                if (thinkM && thinkM[1] && thinkM[1].trim().length > 10) {
                    thinkReason = { analyste: thinkM[1].trim().substring(0, 200), critique: '', synthese: '' };
                }
                return { reasoning: thinkReason, answer: cleanH, confidence: 'to-verify', sources: [] };
            }
            // Extraire le PREMIER objet JSON valide du texte
            var jsonStart = cleaned.indexOf('{');
            if (jsonStart === -1) throw new Error('No JSON');
            // Trouver la fin du JSON en comptant les accolades
            var depth = 0; var jsonEnd = -1;
            for (var i = jsonStart; i < cleaned.length; i++) {
                if (cleaned[i] === '{') depth++;
                else if (cleaned[i] === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
            }
            if (jsonEnd === -1) throw new Error('Incomplete JSON');
            var jsonStr = cleaned.substring(jsonStart, jsonEnd);
            var parsed = JSON.parse(jsonStr);
            var conf = parsed.confidence;
            if (conf !== 'verified' && conf !== 'to-verify' && conf !== 'unverified') conf = 'to-verify';
            return {
                reasoning: parsed.reasoning || null,
                answer: renderMarkdown(parsed.answer || 'Reponse recue.'),
                confidence: conf,
                sources: Array.isArray(parsed.sources) ? parsed.sources : []
            };
        } catch(e) {
            // Fallback : traiter comme texte brut
            var thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
            var cleanText = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
            if (!cleanText) cleanText = text;
            // Nettoyer les residus JSON
            cleanText = cleanText.replace(/^\s*\{[\s\S]*?"answer"\s*:\s*"/, '').replace(/"\s*,\s*"confidence[\s\S]*$/, '').replace(/^```json?\s*/g, '').replace(/```\s*$/g, '').trim();
            // Convertir markdown en HTML via marked.js
            var html = renderMarkdown(cleanText);
            // Extraire le raisonnement du <think>
            var reasoning = null;
            if (thinkMatch && thinkMatch[1] && thinkMatch[1].trim().length > 10) {
                var thinkText = thinkMatch[1].trim();
                reasoning = { analyste: thinkText.substring(0, 200), critique: '', synthese: '' };
            }
            return {
                reasoning: reasoning,
                answer: html,
                confidence: 'to-verify',
                sources: []
            };
        }
    },

    getSimulatedResponse: function(userMessage) {
        return {
            reasoning: { analyste: 'Mode simule actif.', critique: 'L\'API Pollinations n\'a pas repondu.', synthese: 'Reponse generique.' },
            answer: '<p>Je suis desole, je n\'ai pas pu me connecter au serveur IA. Verifie ta connexion internet et reessaie.</p><p>En attendant, essaie un de ces sujets : relativite, teletravail, programmation, histoire, sport, psychologie, climat, finance.</p>',
            confidence: 'unverified',
            sources: []
        };
    },

    // === REFLEXION APPROFONDIE (Deep Think) ===
    // Pipeline multi-etapes: decomposition → recherche → analyse → critique → synthese
    deepThink: function(userMessage) {
        var self = this;
        if (!window.etherDesktop) return Promise.resolve(self.getSimulatedResponse(userMessage));

        var langName = (G('SLG') && G('SLG').options[G('SLG').selectedIndex]) ? G('SLG').options[G('SLG').selectedIndex].text : 'Francais';

        // Creer l'element UI de progression
        hideThink();
        var ws = G('WS'); if (ws && ws.parentNode) ws.parentNode.removeChild(ws);
        var container = document.createElement('div');
        container.className = 'msg a';
        container.innerHTML = '<div class="mav"></div><div class="mbd"><div class="deep-think-container" id="deep-think-panel">'
            + '<div style="font-size:.76rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;display:flex;align-items:center;gap:6px">'
            + '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>'
            + 'Reflexion approfondie</div>'
            + '<div class="deep-step" id="ds-1"><div class="deep-step-icon">1</div><div class="deep-step-content"><div class="deep-step-title">Decomposition</div><div class="deep-step-detail">Analyse de la question...</div></div></div>'
            + '<div class="deep-step" id="ds-2"><div class="deep-step-icon">2</div><div class="deep-step-content"><div class="deep-step-title">Recherche</div><div class="deep-step-detail">Collecte d\'informations...</div></div></div>'
            + '<div class="deep-step" id="ds-3"><div class="deep-step-icon">3</div><div class="deep-step-content"><div class="deep-step-title">Analyse</div><div class="deep-step-detail">Generation de la reponse...</div></div></div>'
            + '<div class="deep-step" id="ds-4"><div class="deep-step-icon">4</div><div class="deep-step-content"><div class="deep-step-title">Critique</div><div class="deep-step-detail">Verification et correction...</div></div></div>'
            + '<div class="deep-step" id="ds-5"><div class="deep-step-icon">5</div><div class="deep-step-content"><div class="deep-step-title">Synthese finale</div><div class="deep-step-detail">Redaction de la reponse definitive...</div></div></div>'
            + '</div></div>';
        G('MG').appendChild(container);
        var av = container.querySelector('.mav'); if (av) addMsgWave(av);
        scr();

        function setStep(n, status, detail) {
            var el = document.getElementById('ds-' + n);
            if (!el) return;
            el.className = 'deep-step ' + status;
            if (detail) el.querySelector('.deep-step-detail').textContent = detail;
            scr();
        }

        var webContext = '';
        var subQuestions = [];
        var mainAnalysis = '';
        var critique = '';

        // ETAPE 1: Decomposition (Groq, rapide)
        setStep(1, 'active', 'Decomposition de la question...');
        return window.etherDesktop.groqChat({
            model: GROQ_MODELS.fast,
            messages: [
                { role: 'system', content: 'Decompose cette question en 3-4 sous-questions precises pour y repondre completement. Reponds UNIQUEMENT avec les sous-questions, une par ligne, sans numerotation. ' + langName + '.' },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.3, max_tokens: 300
        }).then(function(res) {
            if (res.ok && res.text) {
                subQuestions = res.text.trim().split('\n').filter(function(q) { return q.trim().length > 5; }).slice(0, 4);
            }
            if (!subQuestions.length) subQuestions = [userMessage];
            setStep(1, 'done', subQuestions.length + ' sous-questions identifiees');

            // ETAPE 2: Recherche web (en parallele sur chaque sous-question)
            setStep(2, 'active', 'Recherche en cours sur ' + subQuestions.length + ' axes...');
            var searchPromises = subQuestions.map(function(q) {
                return webSearch(q)['catch'](function() { return { results: [], extract: '' }; });
            });
            return Promise.all(searchPromises);

        }).then(function(searchResults) {
            // Combiner les resultats de recherche
            for (var s = 0; s < searchResults.length; s++) {
                if (searchResults[s] && searchResults[s].extract) {
                    webContext += searchResults[s].extract + '\n';
                }
                if (searchResults[s] && searchResults[s].results) {
                    for (var r = 0; r < searchResults[s].results.length; r++) {
                        var res = searchResults[s].results[r];
                        if (res.snippet && res.snippet.length > 20) {
                            webContext += '[' + res.source + '] ' + res.snippet + '\n';
                        }
                    }
                }
            }
            var srcCount = webContext.split('\n').filter(function(l) { return l.trim().length > 10; }).length;
            setStep(2, 'done', srcCount + ' sources collectees');

            // ETAPE 3: Analyse detaillee — cascade: Gemini → Groq → Cerebras
            setStep(3, 'active', 'Analyse approfondie en cours...');
            var analysePrompt = 'Question principale: ' + userMessage + '\n\n'
                + 'Sous-questions a traiter:\n' + subQuestions.join('\n') + '\n\n'
                + (webContext ? 'INFORMATIONS COLLECTEES:\n' + webContext.substring(0, 4000) + '\n\n' : '')
                + 'Genere une analyse DETAILLEE et STRUCTUREE qui repond a chaque sous-question. Utilise les sources fournies. Sois precis, factuel, exhaustif. Markdown. ' + langName + '.';

            var analyseMsgs = [
                { role: 'system', content: 'Tu es un analyste expert. Reponds de maniere detaillee, structuree, factuelle. ' + langName + '. Markdown.' },
                { role: 'user', content: analysePrompt }
            ];
            var analyseOpts = { messages: analyseMsgs, temperature: 0.5, max_tokens: 6000 };

            // Essayer Gemini d'abord, puis Groq, puis Cerebras
            function tryAnalyse() {
                if (providerStatus.gemini) {
                    analyseOpts.model = GEMINI_MODELS.main;
                    return window.etherDesktop.geminiChat(analyseOpts).then(function(r) {
                        if (r.ok && r.text) return r;
                        // Gemini a echoue (429) — fallback Groq
                        analyseOpts.model = GROQ_MODELS.main;
                        return window.etherDesktop.groqChat(analyseOpts);
                    })['catch'](function() {
                        analyseOpts.model = GROQ_MODELS.main;
                        return window.etherDesktop.groqChat(analyseOpts);
                    });
                }
                analyseOpts.model = GROQ_MODELS.main;
                return window.etherDesktop.groqChat(analyseOpts)['catch'](function() {
                    if (providerStatus.cerebras) {
                        analyseOpts.model = CEREBRAS_MODELS.main;
                        return window.etherDesktop.cerebrasChat(analyseOpts);
                    }
                    return { ok: false };
                });
            }
            return tryAnalyse();

        }).then(function(analyseRes) {
            mainAnalysis = (analyseRes.ok && analyseRes.text) ? analyseRes.text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim() : '';
            setStep(3, 'done', mainAnalysis ? 'Analyse generee (' + mainAnalysis.length + ' car.)' : 'Analyse partielle');

            // ETAPE 4: Critique (Groq Qwen3 32B, fallback Groq Llama 70B)
            setStep(4, 'active', 'Verification des biais et erreurs...');
            var critiqueContent = mainAnalysis || userMessage; // Si pas d'analyse, critiquer la question directement
            return window.etherDesktop.groqChat({
                model: GROQ_MODELS.reasoning,
                messages: [
                    { role: 'system', content: 'Tu es un critique rigoureux. On te donne une analyse. Trouve les failles, biais, manques, erreurs factuelles ou logiques. Sois precis et constructif. Si l\'analyse est bonne, dis-le mais suggere des ameliorations. 3-5 points maximum. ' + langName + '.' },
                    { role: 'user', content: 'Question: ' + userMessage + '\n\nAnalyse a critiquer:\n' + critiqueContent.substring(0, 3000) }
                ],
                temperature: 0.4, max_tokens: 1000
            })['catch'](function() {
                // Fallback: pas de critique, on passe direct a la synthese
                return { ok: false, text: '' };
            });

        }).then(function(critiqueRes) {
            critique = (critiqueRes.ok && critiqueRes.text) ? critiqueRes.text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim() : '';
            setStep(4, 'done', critique ? 'Critique terminee' : 'Pas de critique majeure');

            // ETAPE 5: Synthese finale — cascade: Gemini → Groq → Cerebras
            setStep(5, 'active', 'Redaction de la reponse definitive...');
            var synthMsgs = [
                { role: 'system', content: 'Tu es ETHER, un expert en synthese. On te donne une analyse et sa critique. Produis une reponse DEFINITIVE qui integre les corrections de la critique. La reponse doit etre complete, structuree, precise, avec des exemples concrets. Utilise du Markdown riche (titres, listes, gras, tableaux si pertinent). ' + langName + '.' },
                { role: 'user', content: 'Question: ' + userMessage + '\n\nAnalyse initiale:\n' + (mainAnalysis || 'Pas d\'analyse disponible').substring(0, 3000) + '\n\n' + (critique ? 'Critique:\n' + critique.substring(0, 1500) + '\n\n' : '') + 'Redige la reponse finale optimale.' }
            ];
            var synthOpts = { messages: synthMsgs, temperature: 0.5, max_tokens: 8000 };

            function trySynth() {
                if (providerStatus.gemini) {
                    synthOpts.model = GEMINI_MODELS.main;
                    return window.etherDesktop.geminiChat(synthOpts).then(function(r) {
                        if (r.ok && r.text) return r;
                        synthOpts.model = GROQ_MODELS.main;
                        return window.etherDesktop.groqChat(synthOpts);
                    })['catch'](function() {
                        synthOpts.model = GROQ_MODELS.main;
                        return window.etherDesktop.groqChat(synthOpts);
                    });
                }
                synthOpts.model = GROQ_MODELS.main;
                return window.etherDesktop.groqChat(synthOpts)['catch'](function() {
                    return { ok: false };
                });
            }
            return trySynth();

        }).then(function(finalRes) {
            // Utiliser la synthese, ou l'analyse brute si la synthese a echoue, ou un message d'erreur
            var finalText = (finalRes.ok && finalRes.text) ? finalRes.text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim() : (mainAnalysis || 'La reflexion n\'a pas pu aboutir. Reessaie ou pose ta question en mode normal.');
            setStep(5, 'done', 'Reflexion terminee');

            // Remplacer le panneau de progression par la reponse finale
            var result = self.parseResponse(finalText);
            result._provider = 'deep-think';
            result._model = 'multi';
            result._showBadge = false;
            result._streamed = true;

            self.conversationHistory.push({ role: 'user', content: userMessage });
            self.conversationHistory.push({ role: 'assistant', content: finalText });

            // Construire le bloc de reflexion repliable
            var thinkDetails = '<div class="collab-contribs" style="margin-bottom:12px">'
                + '<button class="collab-toggle" onclick="this.parentElement.classList.toggle(\'open\')" style="background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.2)">'
                + '<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;margin-right:6px;color:#f59e0b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/><path d="M12 6c-2.21 0-4 1.79-4 4 0 1.48.81 2.77 2 3.46V14h4v-.54c1.19-.69 2-1.98 2-3.46 0-2.21-1.79-4-4-4z" fill="currentColor"/></svg>'
                + '5 etapes de reflexion'
                + '</button>'
                + '<div class="collab-details">'
                + '<div class="collab-entry"><div class="collab-name" style="color:#f59e0b">Decomposition</div><div class="collab-preview">' + esc(subQuestions.join(' | ')) + '</div></div>'
                + '<div class="collab-entry"><div class="collab-name" style="color:#0ea5e9">Recherche</div><div class="collab-preview">' + esc(webContext.substring(0, 200)) + '...</div></div>'
                + '<div class="collab-entry"><div class="collab-name" style="color:#22c55e">Analyse</div><div class="collab-preview">' + esc(mainAnalysis.substring(0, 200)) + '...</div></div>'
                + '<div class="collab-entry"><div class="collab-name" style="color:#ef4444">Critique</div><div class="collab-preview">' + esc(critique.substring(0, 200)) + '...</div></div>'
                + '<div class="collab-entry"><div class="collab-name" style="color:#8b5cf6">Synthese</div><div class="collab-preview">' + esc(finalText.substring(0, 200)) + '...</div></div>'
                + '</div></div>';

            var pt = (result.answer || '').replace(/<[^>]+>/g, '');
            var ptAttr = escAttr(pt);
            var mbd = container.querySelector('.mbd');
            mbd.innerHTML = thinkDetails
                + '<div class="mt">' + sanitizeHTML(result.answer || '') + '</div>'
                + '<span class="cb" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#f59e0b"><span class="cd" style="background:#f59e0b"></span>Reflexion approfondie</span>'
                + '<div class="ma"><button class="mab" data-t="' + ptAttr + '" onclick="cpTxt(this)" title="Copier"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg></button></div>';
            container._etherData = result;
            processCodeBlocks(container);

            if (typeof generateFollowUpSuggestions === 'function') {
                generateFollowUpSuggestions(result.answer, null, userMessage);
            }

            // Sauvegarder dans la conversation
            if (curConv && !isEphemeral) {
                convs[curConv].messages.push({ r: 'a', d: result, ts: Date.now() });
                sSet('convs', convs);
            }

            sendNotif('ETHER — Reflexion terminee', pt.substring(0, 80));
            scr();
            return result;

        })['catch'](function(err) {
            console.error('[DEEP-THINK] Error:', err);
            // Fallback: reponse normale
            var panel = document.getElementById('deep-think-panel');
            if (panel) panel.innerHTML = '<div style="color:var(--t3);font-size:.85rem;padding:10px">Reflexion interrompue — basculement en mode normal...</div>';
            return self.generateResponse(userMessage);
        });
    },

    resetHistory: function() {
        this.conversationHistory = [];
        this.conversationSummary = '';
        // Nettoyer les stream listeners en cours
        if (window.etherDesktop && window.etherDesktop.removeStreamListeners) {
            window.etherDesktop.removeStreamListeners();
        }
        if (typeof isStreaming !== 'undefined') isStreaming = false;
    },

    getThinkingText: function() {
        var m = { base: 'think_base', teacher: 'think_teacher', debate: 'think_debate', creative: 'think_creative', writer: 'think_writer' };
        return t(m[this.currentMode] || 'think_base');
    }
};

