// === ETHER — Advanced Memory & RAG System ===

// =============================================
// 1. MEMOIRE CONVERSATIONNELLE AVANCEE
// =============================================
// Categorie les souvenirs, les pondere, detecte les mises a jour

var MEMORY = {
    // Categories de memoire
    CATEGORIES: {
        identity: { label: 'Identite', icon: 'U', color: '#4285F4' },    // nom, age, lieu
        work: { label: 'Travail', icon: 'W', color: '#22c55e' },         // metier, entreprise, competences
        interests: { label: 'Interets', icon: 'I', color: '#f59e0b' },   // hobbies, passions
        projects: { label: 'Projets', icon: 'P', color: '#8b5cf6' },     // objectifs, projets en cours
        preferences: { label: 'Preferences', icon: 'S', color: '#ec4899' }, // style de communication, gouts
        relations: { label: 'Relations', icon: 'R', color: '#0ea5e9' }   // famille, amis mentionnes
    },

    // Charger la memoire structuree
    load: function() {
        var mem = sGet('memory_v2', null);
        if (mem && mem.version === 2) return mem;
        // Migration depuis l'ancien format (liste plate)
        var oldMem = sGet('mem', []);
        var newMem = { version: 2, facts: [], lastUpdate: Date.now() };
        for (var i = 0; i < oldMem.length; i++) {
            newMem.facts.push({
                text: oldMem[i],
                category: 'identity',
                confidence: 0.7,
                created: Date.now(),
                updated: Date.now(),
                mentions: 1
            });
        }
        if (oldMem.length > 0) sSet('memory_v2', newMem);
        return newMem;
    },

    // Sauvegarder
    save: function(mem) {
        mem.lastUpdate = Date.now();
        sSet('memory_v2', mem);
        // Garder l'ancien format sync pour le system prompt
        var flat = mem.facts.map(function(f) { return f.text; });
        sSet('mem', flat);
        if (typeof renMem === 'function') renMem();
    },

    // Ajouter ou mettre a jour un fait
    addFact: function(text, category, confidence) {
        var mem = this.load();
        category = category || 'identity';
        confidence = confidence || 0.8;

        // Deduplication + mise a jour intelligente
        for (var i = 0; i < mem.facts.length; i++) {
            var existing = mem.facts[i];
            var similarity = this._similarity(existing.text, text);
            if (similarity > 0.6) {
                // Mise a jour — garder le texte le plus long/detaille
                if (text.length > existing.text.length) {
                    existing.text = text;
                }
                existing.confidence = Math.min(1, existing.confidence + 0.1);
                existing.mentions++;
                existing.updated = Date.now();
                existing.category = category;
                this.save(mem);
                return 'updated';
            }
        }

        // Nouveau fait
        mem.facts.push({
            text: text,
            category: category,
            confidence: confidence,
            created: Date.now(),
            updated: Date.now(),
            mentions: 1
        });

        // Limiter a 50 faits — supprimer les moins pertinents
        if (mem.facts.length > 50) {
            mem.facts.sort(function(a, b) {
                return (b.confidence * b.mentions) - (a.confidence * a.mentions);
            });
            mem.facts = mem.facts.slice(0, 50);
        }

        this.save(mem);
        return 'added';
    },

    // Supprimer un fait par index
    removeFact: function(index) {
        var mem = this.load();
        if (index >= 0 && index < mem.facts.length) {
            mem.facts.splice(index, 1);
            this.save(mem);
        }
    },

    // Obtenir la memoire formatee pour le system prompt
    getPromptContext: function() {
        var mem = this.load();
        if (!mem.facts.length) return '';

        // Trier par categorie puis par confiance
        var byCategory = {};
        for (var i = 0; i < mem.facts.length; i++) {
            var f = mem.facts[i];
            if (!byCategory[f.category]) byCategory[f.category] = [];
            byCategory[f.category].push(f);
        }

        var lines = [];
        var catLabels = this.CATEGORIES;
        var order = ['identity', 'work', 'projects', 'interests', 'preferences', 'relations'];
        for (var c = 0; c < order.length; c++) {
            var cat = order[c];
            if (!byCategory[cat] || !byCategory[cat].length) continue;
            var items = byCategory[cat].sort(function(a, b) { return b.confidence - a.confidence; });
            lines.push('[' + catLabels[cat].label + '] ' + items.map(function(f) { return f.text; }).join('; '));
        }

        if (!lines.length) return '';
        return '\n\nMEMOIRE UTILISATEUR (utilise ces infos pour personnaliser):\n' + lines.join('\n');
    },

    // Similarite simple entre deux textes (Jaccard sur les mots)
    _similarity: function(a, b) {
        var wa = a.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
        var wb = b.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
        if (!wa.length || !wb.length) return 0;
        var common = 0;
        for (var i = 0; i < wa.length; i++) {
            if (wb.indexOf(wa[i]) !== -1) common++;
        }
        return common / Math.max(wa.length, wb.length);
    },

    // Extraction automatique amelioree via LLM
    extractFromConversation: function(userMessage, aiAnswer) {
        if (!window.etherDesktop) return;
        if (!userMessage || userMessage.length < 10) return;
        if (/^(salut|bonjour|bonsoir|hello|hi|hey|merci|ok|oui|non|super|cool|bien|d'accord|top)[.!?\s]*$/i.test(userMessage.trim())) return;

        var mem = this.load();
        var existingContext = mem.facts.length > 0
            ? '\nFaits deja connus: ' + mem.facts.map(function(f) { return '[' + f.category + '] ' + f.text; }).join('; ')
            : '';
        var cleanAnswer = (aiAnswer || '').replace(/<[^>]+>/g, '').substring(0, 400);
        var self = this;

        window.etherDesktop.groqChat({
            model: GROQ_MODELS.fast,
            messages: [
                { role: 'system', content: 'Extrais les informations de PROFIL de l\'utilisateur. Reponds UNIQUEMENT en JSON.\n\n'
                    + 'CATEGORIES: identity (nom, age, lieu, nationalite), work (metier, entreprise, competences), interests (hobbies, passions), projects (objectifs, projets), preferences (style communication, gouts), relations (famille, amis)\n\n'
                    + 'REGLES:\n- UNIQUEMENT ce que l\'utilisateur dit SUR LUI-MEME\n- Pas les questions posees, pas les sujets de discussion\n- Chaque fait = 3-15 mots\n- Max 2 faits\n- Si rien de personnel: {"facts":[]}\n\n'
                    + 'Format: {"facts":[{"text":"fait","category":"identity|work|interests|projects|preferences|relations"}]}' },
                { role: 'user', content: 'Message: "' + userMessage.substring(0, 500) + '"\nReponse IA: "' + cleanAnswer + '"' + existingContext }
            ],
            temperature: 0.1,
            max_tokens: 200
        }).then(function(res) {
            if (!res.ok || !res.text) return;
            try {
                var cleaned = res.text.trim().replace(/```json?\s*/g, '').replace(/```/g, '');
                var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (!jsonMatch) return;
                var parsed = JSON.parse(jsonMatch[0]);
                if (!parsed.facts || !parsed.facts.length) return;

                var addedAny = false;
                for (var i = 0; i < parsed.facts.length; i++) {
                    var f = parsed.facts[i];
                    if (!f.text || f.text.length < 3 || f.text.length > 200) continue;
                    if (/aucun|pas de fait|rien|none|no fact/i.test(f.text)) continue;
                    var cat = f.category || 'identity';
                    if (!self.CATEGORIES[cat]) cat = 'identity';
                    var result = self.addFact(f.text, cat, 0.8);
                    if (result === 'added') addedAny = true;
                }

                // Toast discret si nouveau souvenir ajoute
                if (addedAny && typeof showMemoryToast === 'function') {
                    showMemoryToast();
                }
            } catch(e) { /* ignore */ }
        })['catch'](function() {});
    }
};


// =============================================
// 2. RAG — Retrieval Augmented Generation
// =============================================
// Indexe les documents uploades, cherche par mots-cles, injecte le contexte

var RAG = {
    // Index des documents (stocke dans localStorage/persist)
    _index: null,

    // Charger l'index
    load: function() {
        if (this._index) return this._index;
        this._index = sGet('rag_index', { documents: [], version: 1 });
        return this._index;
    },

    // Sauvegarder l'index
    save: function() {
        if (this._index) {
            sSet('rag_index', this._index);
        }
    },

    // Ajouter un document a l'index
    addDocument: function(name, content, source) {
        var index = this.load();
        if (!content || content.length < 10) return false;

        // Verifier si le document existe deja
        for (var i = 0; i < index.documents.length; i++) {
            if (index.documents[i].name === name) {
                // Mettre a jour
                index.documents[i].content = content;
                index.documents[i].chunks = this._chunkText(content);
                index.documents[i].keywords = this._extractKeywords(content);
                index.documents[i].updated = Date.now();
                this.save();
                return 'updated';
            }
        }

        // Nouveau document
        var doc = {
            id: 'doc_' + Date.now(),
            name: name,
            content: content.substring(0, 100000), // max 100K chars
            chunks: this._chunkText(content),
            keywords: this._extractKeywords(content),
            source: source || 'upload',
            added: Date.now(),
            updated: Date.now()
        };

        index.documents.push(doc);

        // Limiter a 20 documents
        if (index.documents.length > 20) {
            index.documents = index.documents.slice(-20);
        }

        this.save();
        return 'added';
    },

    // Supprimer un document
    removeDocument: function(docId) {
        var index = this.load();
        index.documents = index.documents.filter(function(d) { return d.id !== docId; });
        this.save();
    },

    // Lister les documents indexes
    listDocuments: function() {
        var index = this.load();
        return index.documents.map(function(d) {
            return { id: d.id, name: d.name, size: d.content.length, added: d.added, chunks: d.chunks.length };
        });
    },

    // Chercher dans les documents indexes (recherche par mots-cles + TF-IDF simplifie)
    search: function(query, maxResults) {
        maxResults = maxResults || 5;
        var index = this.load();
        if (!index.documents.length) return [];

        var queryWords = this._tokenize(query);
        if (!queryWords.length) return [];

        var results = [];

        for (var d = 0; d < index.documents.length; d++) {
            var doc = index.documents[d];
            for (var c = 0; c < doc.chunks.length; c++) {
                var chunk = doc.chunks[c];
                var chunkWords = this._tokenize(chunk);
                var score = this._relevanceScore(queryWords, chunkWords);
                if (score > 0) {
                    results.push({
                        docName: doc.name,
                        docId: doc.id,
                        chunk: chunk,
                        chunkIndex: c,
                        score: score
                    });
                }
            }
        }

        // Trier par score et retourner les meilleurs
        results.sort(function(a, b) { return b.score - a.score; });
        return results.slice(0, maxResults);
    },

    // Construire le contexte RAG pour le system prompt
    getContext: function(userMessage) {
        if (!userMessage) return '';
        var results = this.search(userMessage, 4);
        if (!results.length) return '';

        var context = '\n\n=== DOCUMENTS DE REFERENCE (base de connaissances de l\'utilisateur) ===\n';
        var seenDocs = {};
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            if (!seenDocs[r.docName]) {
                context += '\n--- ' + r.docName + ' ---\n';
                seenDocs[r.docName] = true;
            }
            context += r.chunk + '\n';
        }
        context += '\n=== Utilise ces extraits pour enrichir ta reponse si pertinent. Cite le document source. ===';
        return context;
    },

    // Decouper un texte en chunks de ~500 chars avec chevauchement
    _chunkText: function(text) {
        var chunks = [];
        var CHUNK_SIZE = 500;
        var OVERLAP = 100;
        // Decouper par paragraphes d'abord
        var paragraphs = text.split(/\n\n+/);
        var currentChunk = '';

        for (var p = 0; p < paragraphs.length; p++) {
            var para = paragraphs[p].trim();
            if (!para) continue;

            if (currentChunk.length + para.length < CHUNK_SIZE) {
                currentChunk += (currentChunk ? '\n' : '') + para;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                // Si le paragraphe est tres long, le decouper
                if (para.length > CHUNK_SIZE) {
                    var words = para.split(/\s+/);
                    currentChunk = '';
                    for (var w = 0; w < words.length; w++) {
                        if (currentChunk.length + words[w].length > CHUNK_SIZE) {
                            chunks.push(currentChunk);
                            // Overlap: reprendre les derniers mots
                            var overlapWords = currentChunk.split(/\s+/).slice(-Math.floor(OVERLAP / 5));
                            currentChunk = overlapWords.join(' ') + ' ' + words[w];
                        } else {
                            currentChunk += (currentChunk ? ' ' : '') + words[w];
                        }
                    }
                } else {
                    currentChunk = para;
                }
            }
        }
        if (currentChunk) chunks.push(currentChunk);

        return chunks;
    },

    // Extraire les mots-cles d'un texte
    _extractKeywords: function(text) {
        var words = this._tokenize(text);
        var freq = {};
        for (var i = 0; i < words.length; i++) {
            freq[words[i]] = (freq[words[i]] || 0) + 1;
        }
        // Trier par frequence
        var sorted = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
        return sorted.slice(0, 30);
    },

    // Tokenizer simplifie
    _tokenize: function(text) {
        return (text || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(function(w) { return w.length > 2 && STOPWORDS.indexOf(w) === -1; });
    },

    // Score de pertinence (TF-IDF simplifie)
    _relevanceScore: function(queryWords, chunkWords) {
        if (!chunkWords.length) return 0;
        var matches = 0;
        var chunkSet = {};
        for (var c = 0; c < chunkWords.length; c++) chunkSet[chunkWords[c]] = true;
        for (var q = 0; q < queryWords.length; q++) {
            if (chunkSet[queryWords[q]]) matches++;
        }
        // Normaliser par la taille de la requete
        return matches / queryWords.length;
    }
};

// Stop words FR/EN pour le tokenizer
var STOPWORDS = ['les','des','une','pour','dans','par','sur','avec','que','qui','est','pas',
    'son','ses','aux','mais','cette','tout','tous','elle','ont','sont','etre','avoir','fait',
    'plus','aussi','bien','comme','sans','peut','entre','nous','vous','leur','the','and',
    'for','that','this','with','from','not','are','was','were','been','has','had','will',
    'would','could','should','about','into','than','then','them','each','which','their'];

// =============================================
// 3. INTEGRATION — Indexer automatiquement les fichiers uploades
// =============================================

// Hook: quand un fichier est uploade, l'indexer dans le RAG
function ragIndexUploadedFile(file) {
    if (!file || !file.content || !file.name) return;
    var result = RAG.addDocument(file.name, file.content, 'upload');
    if (result === 'added') {
        console.log('[RAG] Indexed new document:', file.name, '(' + file.content.length + ' chars)');
    }
}

// =============================================
// 4. MEMOIRE TEACHER
// =============================================
// Stocke le niveau par sujet, la progression, les sujets maitrises

var TEACHER_MEMORY = {
    load: function() {
        return sGet('teacher_mem', {
            calibrated: false,        // true apres le premier diagnostic
            globalLevel: 'unknown',   // unknown, debutant, intermediaire, avance, expert
            subjects: {},             // { "mathematiques": { level: "intermediaire", sessions: 3, mastered: ["fractions","equations"] } }
            lastCalibration: null
        });
    },

    save: function(data) {
        sSet('teacher_mem', data);
    },

    // Verifier si le niveau a ete calibre
    isCalibrated: function() {
        var data = this.load();
        return data.calibrated && data.globalLevel !== 'unknown';
    },

    // Enregistrer le resultat du diagnostic
    calibrate: function(level, subject) {
        var data = this.load();
        data.calibrated = true;
        data.globalLevel = level;
        data.lastCalibration = Date.now();
        if (subject) {
            if (!data.subjects[subject]) data.subjects[subject] = { level: level, sessions: 0, mastered: [] };
            data.subjects[subject].level = level;
        }
        this.save(data);
        // Sauvegarder aussi dans la memoire generale
        if (typeof MEMORY !== 'undefined') {
            MEMORY.addFact('Niveau Teacher: ' + level + (subject ? ' en ' + subject : ''), 'preferences', 0.9);
        }
    },

    // Obtenir le niveau pour un sujet (ou le niveau global)
    getLevel: function(subject) {
        var data = this.load();
        if (subject && data.subjects[subject]) return data.subjects[subject].level;
        return data.globalLevel || 'unknown';
    },

    // Enregistrer une session d'apprentissage
    trackSession: function(subject, topic) {
        var data = this.load();
        if (!subject) return;
        var subjectKey = subject.toLowerCase().trim();
        if (!data.subjects[subjectKey]) {
            data.subjects[subjectKey] = { level: data.globalLevel || 'intermediaire', sessions: 0, mastered: [] };
        }
        data.subjects[subjectKey].sessions++;
        if (topic && data.subjects[subjectKey].mastered.indexOf(topic) === -1) {
            data.subjects[subjectKey].mastered.push(topic);
            // Limiter a 30 sujets maitrises
            if (data.subjects[subjectKey].mastered.length > 30) {
                data.subjects[subjectKey].mastered = data.subjects[subjectKey].mastered.slice(-30);
            }
        }
        this.save(data);
    },

    // Obtenir le contexte pour le system prompt
    getPromptContext: function() {
        var data = this.load();
        if (!data.calibrated) return '\n\nNIVEAU: Non calibre. C\'est la premiere session Teacher. Tu dois evaluer le niveau de l\'utilisateur.';
        var ctx = '\n\nNIVEAU DE L\'UTILISATEUR: ' + data.globalLevel;
        var subjects = Object.keys(data.subjects);
        if (subjects.length > 0) {
            ctx += '\nSUJETS ETUDIES:';
            for (var i = 0; i < Math.min(subjects.length, 5); i++) {
                var s = data.subjects[subjects[i]];
                ctx += '\n- ' + subjects[i] + ' (niveau: ' + s.level + ', ' + s.sessions + ' sessions';
                if (s.mastered && s.mastered.length > 0) ctx += ', maitrise: ' + s.mastered.slice(-5).join(', ');
                ctx += ')';
            }
        }
        return ctx;
    },

    // Analyser la reponse de l'utilisateur au diagnostic pour determiner le niveau
    analyzeCalibration: function(userMessage, aiQuestion) {
        if (!window.etherDesktop) return;
        var self = this;
        window.etherDesktop.groqChat({
            model: GROQ_MODELS.fast,
            messages: [
                { role: 'system', content: 'Analyse la reponse d\'un eleve a une question pedagogique et determine son niveau. Reponds UNIQUEMENT en JSON:\n{"level":"debutant|intermediaire|avance|expert","subject":"le sujet detecte","reasoning":"pourquoi ce niveau en 1 phrase"}' },
                { role: 'user', content: 'Question posee: ' + (aiQuestion || '').substring(0, 300) + '\nReponse de l\'eleve: ' + userMessage.substring(0, 500) }
            ],
            temperature: 0.1, max_tokens: 150
        }).then(function(res) {
            if (!res.ok || !res.text) return;
            try {
                var jsonMatch = res.text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) return;
                var parsed = JSON.parse(jsonMatch[0]);
                if (parsed.level && ['debutant', 'intermediaire', 'avance', 'expert'].indexOf(parsed.level) !== -1) {
                    self.calibrate(parsed.level, parsed.subject || '');
                    console.log('[TEACHER] Calibrated: level=' + parsed.level + ', subject=' + (parsed.subject || 'general'));
                }
            } catch(e) {}
        })['catch'](function() {});
    }
};

// =============================================
// 5. VERIFICATION ANTI-HALLUCINATION
// =============================================
// Verifie les affirmations factuelles via un 2e modele + recherche web

function verifyResponse(answer, msgEl) {
    if (!window.etherDesktop || !answer) return;
    var plainText = (answer || '').replace(/<[^>]+>/g, '').trim();
    if (plainText.length < 50) return; // Trop court pour verifier

    // Trouver le message dans le DOM
    if (!msgEl) {
        var aiMsgs = G('MG').querySelectorAll('.msg.a');
        if (aiMsgs.length > 0) msgEl = aiMsgs[aiMsgs.length - 1];
    }
    if (!msgEl) return;

    // Inserer l'indicateur de verification
    var mbd = msgEl.querySelector('.mbd');
    if (!mbd) return;
    var verifyEl = document.createElement('div');
    verifyEl.className = 'verify-bar checking';
    verifyEl.innerHTML = '<svg class="verify-spinner" viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31" stroke-dashoffset="10"/></svg><span>Verification en cours...</span>';
    var actionBar = mbd.querySelector('.ma');
    if (actionBar) mbd.insertBefore(verifyEl, actionBar);
    else mbd.appendChild(verifyEl);

    // ETAPE 1: Extraire les affirmations factuelles (Groq Llama 8B, ultra-rapide)
    window.etherDesktop.groqChat({
        model: GROQ_MODELS.fast,
        messages: [
            { role: 'system', content: 'Extrais les 3-4 affirmations factuelles VERIFIABLES de ce texte. Uniquement des FAITS concrets: chiffres, dates, noms propres, evenements, statistiques. PAS d\'opinions ni de generalites.\nFormat: chaque affirmation sur une ligne, separees par |. Chaque affirmation doit etre une phrase complete et autonome.\nExemple: Microsoft a investi 13 milliards dans OpenAI|Emmanuel Macron est president depuis 2017|La population de la France est de 67 millions\nSi aucun fait verifiable: AUCUN' },
            { role: 'user', content: plainText.substring(0, 1500) }
        ],
        temperature: 0.1, max_tokens: 300
    }).then(function(res) {
        if (!res.ok || !res.text) { showVerifyResult(verifyEl, 'skip'); return; }
        var claims = res.text.trim();
        if (claims === 'AUCUN' || claims.length < 5) { verifyEl.style.display = 'none'; return; }

        var claimList = claims.split('|').map(function(c) { return c.trim().replace(/^\d+[\.\)]\s*/, ''); }).filter(function(c) { return c.length > 10; }).slice(0, 4);
        if (!claimList.length) { verifyEl.style.display = 'none'; return; }

        verifyEl.querySelector('span').textContent = 'Verification de ' + claimList.length + ' affirmations...';

        // ETAPE 2: Recherche web sur les affirmations
        var searchQuery = claimList.join(' ');
        webSearch(searchQuery).then(function(webData) {
            var webContext = '';
            if (webData && webData.extract) webContext += webData.extract;
            if (webData && webData.results) {
                for (var r = 0; r < webData.results.length; r++) {
                    if (webData.results[r].snippet) webContext += '\n' + webData.results[r].snippet;
                }
            }

            if (!webContext || webContext.length < 30) {
                showVerifyResult(verifyEl, 'no-source');
                return;
            }

            // ETAPE 3: Comparer les affirmations avec les sources web (Groq rapide)
            window.etherDesktop.groqChat({
                model: GROQ_MODELS.fast,
                messages: [
                    { role: 'system', content: 'Tu es un verificateur de faits. Compare chaque affirmation avec les sources web.\n\nREGLES STRICTES:\n- VRAI = les sources confirment OU ne contredisent pas cette information. En cas de doute, mets VRAI.\n- FAUX = les sources contredisent EXPLICITEMENT avec un chiffre/fait/date different et prouve. UNIQUEMENT si la contradiction est flagrante et indiscutable.\n- INCERTAIN = les sources ne parlent absolument pas de ce sujet.\n\nIMPORTANT: Tu dois etre GENEREUX. La plupart des affirmations doivent etre VRAI sauf contradiction EVIDENTE. Ne mets JAMAIS FAUX pour des approximations ou des formulations differentes.\n\nFormat: texte|VRAI ou FAUX ou INCERTAIN. Une par ligne.' },
                    { role: 'user', content: 'AFFIRMATIONS A VERIFIER:\n' + claimList.join('\n') + '\n\nSOURCES WEB DE REFERENCE:\n' + webContext.substring(0, 2500) }
                ],
                temperature: 0.1, max_tokens: 400
            }).then(function(vRes) {
                if (!vRes.ok || !vRes.text) { showVerifyResult(verifyEl, 'error'); return; }

                // Parser les resultats
                var lines = vRes.text.trim().split('\n');
                var verified = 0, uncertain = 0, contradicted = 0;
                var details = [];
                for (var l = 0; l < lines.length; l++) {
                    var line = lines[l].trim();
                    if (!line) continue;
                    var verdict = 'INCERTAIN';
                    if (/VRAI/i.test(line)) { verdict = 'VRAI'; verified++; }
                    else if (/FAUX/i.test(line)) { verdict = 'FAUX'; contradicted++; }
                    else { uncertain++; }
                    var claim = line.replace(/\|?\s*(VRAI|FAUX|INCERTAIN)\s*$/i, '').replace(/^\|/, '').trim();
                    if (claim) details.push({ claim: claim, verdict: verdict });
                }

                var total = verified + uncertain + contradicted;
                if (total === 0) { showVerifyResult(verifyEl, 'no-facts'); return; }

                var score = contradicted > 0 ? 'warning' : (uncertain > verified ? 'uncertain' : 'verified');
                showVerifyResult(verifyEl, score, details, verified, uncertain, contradicted);

            })['catch'](function() { showVerifyResult(verifyEl, 'error'); });
        })['catch'](function() { showVerifyResult(verifyEl, 'no-source'); });
    })['catch'](function() { showVerifyResult(verifyEl, 'skip'); });
}

function showVerifyResult(el, status, details, verified, uncertain, contradicted) {
    if (!el) return;
    el.className = 'verify-bar ' + status;

    var icons = {
        'verified': '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>',
        'uncertain': '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="currentColor"/></svg>',
        'warning': '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>',
        'no-facts': '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>'
    };

    var labels = {
        'verified': 'Informations verifiees',
        'uncertain': 'Informations a verifier',
        'warning': 'Contradiction detectee',
        'no-facts': 'Pas d\'affirmation factuelle',
        'no-source': 'Sources indisponibles',
        'error': 'Verification echouee',
        'skip': ''
    };

    if (status === 'skip' || status === 'error' || status === 'no-facts' || status === 'no-source') {
        el.style.display = 'none';
        return;
    }

    var icon = icons[status] || icons['uncertain'];
    var label = labels[status] || '';

    if (details && details.length > 0) {
        var detailHtml = '<div class="verify-details">';
        for (var d = 0; d < details.length; d++) {
            var vclass = details[d].verdict === 'VRAI' ? 'v-true' : details[d].verdict === 'FAUX' ? 'v-false' : 'v-uncertain';
            var vicon = details[d].verdict === 'VRAI' ? '✓' : details[d].verdict === 'FAUX' ? '✗' : '?';
            detailHtml += '<div class="verify-claim ' + vclass + '"><span class="verify-verdict">' + vicon + '</span>' + esc(details[d].claim) + '</div>';
        }
        detailHtml += '</div>';
        el.innerHTML = '<button class="verify-toggle" onclick="this.parentElement.classList.toggle(\'open\')">'
            + icon + '<span>' + label
            + (verified ? ' — ' + verified + ' ✓' : '')
            + (uncertain ? ' ' + uncertain + ' ?' : '')
            + (contradicted ? ' ' + contradicted + ' ✗' : '')
            + '</span></button>' + detailHtml;
    } else {
        el.innerHTML = icon + '<span>' + label + '</span>';
    }
}

// Toast memoire
function showMemoryToast() {
    var existing = document.querySelector('.memory-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'memory-toast';
    toast.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" style="flex-shrink:0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg><span>Souvenir enregistre</span>';
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300); }, 3000);
}
