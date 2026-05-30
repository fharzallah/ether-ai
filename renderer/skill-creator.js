// === ETHER — Skill Creator Modal Logic ===

var defaultCategories = [
    { id: 'cuisine', label: 'Cuisine', icon: 'C' },
    { id: 'sport', label: 'Sport', icon: 'S' },
    { id: 'droit', label: 'Droit', icon: 'D' },
    { id: 'musique', label: 'Musique', icon: 'M' },
    { id: 'design', label: 'Design', icon: 'Ds' },
    { id: 'business', label: 'Business', icon: 'B' },
    { id: 'science', label: 'Science', icon: 'Sc' },
    { id: 'sante', label: 'Sante', icon: 'Sa' },
    { id: 'finance', label: 'Finance', icon: 'F' },
    { id: 'voyage', label: 'Voyage', icon: 'V' },
    { id: 'jeux', label: 'Jeux', icon: 'J' },
    { id: 'education', label: 'Education', icon: 'E' },
    { id: 'marketing', label: 'Marketing', icon: 'Mk' },
    { id: 'psycho', label: 'Psychologie', icon: 'P' },
    { id: 'photo', label: 'Photo', icon: 'Ph' },
    { id: 'autre', label: 'Autre', icon: '+' }
];

var SKILL_CREATOR = {
    modes: [],
    currentTab: 'manual', // 'manual' | 'ai' | 'imported'
    isWizardActive: false,
    wizardConvId: null,
    wizardHistory: [],

    init: function() {
        var self = this;
        // Bind UI Elements
        G('SKILL-X').onclick = function() { self.close(); };
        G('SKILL-MODAL').querySelector('.modal-bk').onclick = function() { self.close(); };

        // Tabs
        var tabs = document.querySelectorAll('.stb');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].onclick = function() {
                var tab = this.getAttribute('data-tab');
                self.switchTab(tab);
            };
        }

        // Action Buttons
        G('SKILL-CREATE-AI').onclick = function() { self.startAIWizard(); };
        G('SKILL-CREATE-MANUAL').onclick = function() { openCreateCustomMode(); };
        G('SKILL-IMPORT-BTN').onclick = function() { G('SKILL-IMP-F').click(); };
        G('SKILL-IMP-F').onchange = function(e) { self.handleImport(e); };

        // Wizard UI
        G('SKILL-AI-BACK').onclick = function() { self.stopAIWizard(); };
        G('SKILL-AI-SEND').onclick = function() { self.handleWizardInput(); };
        G('SKILL-AI-INP').onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.handleWizardInput(); } };

        // Auto-expand textarea
        G('SKILL-AI-INP').oninput = function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        };

        this.loadModes();
    },

    open: function() {
        G('SKILL-MODAL').classList.remove('hidden');
        this.loadModes();
    },

    close: function() {
        G('SKILL-MODAL').classList.add('hidden');
        this.stopAIWizard();
    },

    loadModes: function() {
        var self = this;
        if (window.etherDesktop && window.etherDesktop.modesList) {
            window.etherDesktop.modesList().then(function(list) {
                self.modes = list || [];
                self.renderGrid();
            });
        } else {
            // Fallback to localStorage if not in desktop mode
            this.modes = sGet('custom_modes', []);
            this.renderGrid();
        }
    },

    switchTab: function(tab) {
        this.currentTab = tab;
        var tabs = document.querySelectorAll('.stb');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === tab);
        }
        this.renderGrid();
    },

    renderGrid: function() {
        var self = this;
        var grid = G('SKILL-GRID');
        grid.innerHTML = '';

        var filtered = this.modes.filter(function(m) {
            if (self.currentTab === 'manual') return m.source === 'manual' || !m.source;
            if (self.currentTab === 'ai') return m.source === 'ai';
            if (self.currentTab === 'imported') return m.source === 'imported';
            return false;
        });

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--t3)">Aucun mode dans cette catégorie.</div>';
            return;
        }

        for (var i = 0; i < filtered.length; i++) {
            var m = filtered[i];
            var card = document.createElement('div');
            card.className = 'sk-card';

            var dateStr = m.createdDate ? new Date(m.createdDate).toLocaleDateString() : '';
            var emoji = m.emoji || '🤖';
            // If emoji is an ID from categories, find label
            if (typeof defaultCategories !== 'undefined') {
                for(var c=0; c<defaultCategories.length; c++) {
                    if(defaultCategories[c].id === m.emoji) { emoji = defaultCategories[c].icon; break; }
                }
            }

            var convBtn = m.creationConvId ? `<button class="sk-btn sk-conv" title="Voir la conversation"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/></svg></button>` : '';

            card.innerHTML = `
                <div class="sk-top">
                    <div class="sk-icon">${esc(emoji)}</div>
                </div>
                <div class="sk-name">${esc(m.name)}</div>
                <div class="sk-desc">${esc(m.description || m.systemPrompt || m.instructions || '')}</div>
                <div class="sk-date">${esc(dateStr)}</div>
                <div class="sk-actions">
                    ${convBtn}
                    <button class="sk-btn sk-export" title="Exporter"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" transform="rotate(180 12 12)"/></svg></button>
                    <button class="sk-btn sk-edit" title="Modifier">✎</button>
                    <button class="sk-btn sk-del" title="Supprimer">×</button>
                </div>
            `;

            // Card click -> select mode
            card.onclick = (function(mode) { return function(e) {
                if (e.target.closest('.sk-btn')) return;
                self.selectMode(mode);
            };})(m);

            // Button actions
            if (m.creationConvId) {
                card.querySelector('.sk-conv').onclick = (function(cid) { return function() { self.viewCreationConv(cid); }; })(m.creationConvId);
            }
            card.querySelector('.sk-export').onclick = (function(mode) { return function() { self.exportMode(mode); }; })(m);
            card.querySelector('.sk-edit').onclick = (function(mode) { return function() { openEditCustomMode(mode.id); }; })(m);
            card.querySelector('.sk-del').onclick = (function(mode) { return function() { self.deleteMode(mode.id); }; })(m);

            grid.appendChild(card);
        }
    },

    viewCreationConv: function(convId) {
        if (typeof loadConv === 'function') {
            this.close();
            loadConv(convId);
        }
    },

    selectMode: function(mode) {
        // Switch to the mode in the main UI
        var modeId = 'custom_' + mode.id;
        ETHER_ENGINE.currentMode = modeId;

        // Update main UI buttons
        var modes = document.querySelectorAll('.mp');
        for (var j = 0; j < modes.length; j++) modes[j].classList.remove('on');
        G('CUSTOM-TOGGLE').classList.add('on');

        this.close();
        if (typeof showKbHint === 'function') showKbHint('Mode actif : ' + mode.name);
    },

    deleteMode: function(id) {
        if (!confirm('Supprimer ce mode ?')) return;
        var self = this;
        if (window.etherDesktop && window.etherDesktop.modeDelete) {
            window.etherDesktop.modeDelete(id).then(function() { self.loadModes(); });
        } else {
            var cms = sGet('custom_modes', []);
            cms = cms.filter(function(m) { return m.id !== id; });
            sSet('custom_modes', cms);
            self.loadModes();
        }
    },

    // === AI GUIDED FLOW ("Créer avec ETHER") ===
    startAIWizard: function() {
        this.isWizardActive = true;
        this.wizardHistory = [];
        this.wizardConvId = 'skill_conv_' + Date.now();

        G('SKILL-LIST-VIEW').classList.add('hidden');
        G('SKILL-AI-FLOW').classList.remove('hidden');
        G('SKILL-AI-MESSAGES').innerHTML = '';

        var self = this;
        var welcomeMsg = "Bonjour ! Je suis ETHER. Je vais t'aider à concevoir un mode sur mesure. Décris-moi ton idée, ou dis-moi simplement quel type d'assistant tu souhaites créer.";
        this.addWizardMsg('ia', welcomeMsg);
        this.wizardHistory.push({ role: 'assistant', content: welcomeMsg });

        G('SKILL-AI-INP').focus();
    },

    stopAIWizard: function() {
        this.isWizardActive = false;
        G('SKILL-AI-FLOW').classList.add('hidden');
        G('SKILL-LIST-VIEW').classList.remove('hidden');
    },

    addWizardMsg: function(role, text) {
        var div = document.createElement('div');
        div.className = 'smg ' + role;
        div.innerHTML = renderMarkdown(text);
        var container = G('SKILL-AI-MESSAGES');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    handleWizardInput: function() {
        var self = this;
        var inp = G('SKILL-AI-INP');
        var text = inp.value.trim();
        if (!text || this.isThinking) return;

        inp.value = '';
        inp.style.height = 'auto';

        this.addWizardMsg('u', text);
        this.wizardHistory.push({ role: 'user', content: text });

        // Logic dynamic flow via LLM
        this.isThinking = true;
        var systemPrompt = `Tu es l'architecte de modes d'ETHER. Ton but est de guider l'utilisateur dans une conversation naturelle pour définir son nouveau mode personnalisé.
Tu dois obtenir les informations suivantes : nom du mode, objectif, traits de caractère, et style de réponse.
Ne pose pas toutes les questions d'un coup. Sois conversationnel.
Quand tu as assez d'informations, propose une synthèse du SYSTEM PROMPT final dans un bloc de code et demande si l'utilisateur veut l'enregistrer.
Si l'utilisateur dit "OUI" ou "VALIDE" après ta proposition, termine ta réponse par le mot-clé unique: ###SAVE_NOW### suivi du nom du mode et du prompt final formatés en JSON.
Exemple de fin de conversation réussie: "C'est enregistré ! ###SAVE_NOW###{"name":"Chef","prompt":"Tu es un chef..."}`;

        var messages = [{ role: 'system', content: systemPrompt }].concat(this.wizardHistory);

        ETHER_ENGINE.generateResponse(text, { messages: messages, bypassHistory: true }).then(function(res) {
            self.isThinking = false;
            var aiText = (res.raw || res.answer || '').replace(/<[^>]+>/g, '').trim();

            // Check for save trigger
            if (aiText.indexOf('###SAVE_NOW###') !== -1) {
                var parts = aiText.split('###SAVE_NOW###');
                var displayMsg = parts[0];
                var jsonData = parts[1];
                self.addWizardMsg('ia', displayMsg);
                try {
                    var data = JSON.parse(jsonData);
                    self.saveAISkillFromWizard(data.name, data.prompt);
                } catch(e) { console.error("JSON parse error", e); }
            } else {
                self.addWizardMsg('ia', aiText);
                self.wizardHistory.push({ role: 'assistant', content: aiText });
            }
        })['catch'](function() { self.isThinking = false; });
    },

    saveAISkillFromWizard: function(name, prompt) {
        var self = this;
        // Save conversation to main history
        var conv = {
            id: this.wizardConvId,
            title: "Création : " + name,
            messages: this.wizardHistory.map(function(h) {
                if (h.role === 'user') {
                    return { r: 'u', t: h.content, ts: Date.now() };
                } else {
                    return { r: 'a', d: { answer: renderMarkdown(h.content), raw: h.content }, ts: Date.now() };
                }
            }),
            ts: new Date().toISOString()
        };

        // Update global convs object and storage
        if (typeof convs !== 'undefined') {
            convs[this.wizardConvId] = conv;
        }
        var currentConvs = sGet('convs', {});
        currentConvs[this.wizardConvId] = conv;
        sSet('convs', currentConvs);

        var mode = {
            id: 'mode_' + Date.now(),
            name: name,
            systemPrompt: prompt,
            createdDate: new Date().toISOString(),
            source: 'ai',
            creationConvId: this.wizardConvId
        };

        if (window.etherDesktop && window.etherDesktop.modeSave) {
            window.etherDesktop.modeSave(mode).then(function() {
                self.stopAIWizard();
                self.switchTab('ai');
                self.loadModes();
                if (typeof updHist === 'function') updHist();
            });
        }
    },

    saveAISkill: function() {
        var self = this;
        var mode = {
            id: 'mode_' + Date.now(),
            name: this.wizardData.name,
            description: this.wizardData.goal.substring(0, 100),
            systemPrompt: this.proposedPrompt,
            emoji: '🤖',
            createdDate: new Date().toISOString(),
            source: 'ai'
        };

        if (window.etherDesktop && window.etherDesktop.modeSave) {
            window.etherDesktop.modeSave(mode).then(function() {
                self.stopAIWizard();
                self.switchTab('ai');
                self.loadModes();
            });
        } else {
            var cms = sGet('custom_modes', []);
            cms.push(mode);
            sSet('custom_modes', cms);
            self.stopAIWizard();
            self.switchTab('ai');
            self.loadModes();
        }
    },

    // === IMPORT / EXPORT ===
    handleImport: function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var self = this;
        var reader = new FileReader();
        reader.onload = function(evt) {
            try {
                var mode = JSON.parse(evt.target.result);
                if (!mode.name || (!mode.systemPrompt && !mode.instructions)) throw new Error("Format invalide");
                mode.id = 'imp_' + Date.now();
                mode.source = 'imported';
                mode.createdDate = mode.createdDate || new Date().toISOString();

                if (window.etherDesktop && window.etherDesktop.modeSave) {
                    window.etherDesktop.modeSave(mode).then(function() {
                        self.switchTab('imported');
                        self.loadModes();
                    });
                } else {
                    var cms = sGet('custom_modes', []);
                    cms.push(mode);
                    sSet('custom_modes', cms);
                    self.switchTab('imported');
                    self.loadModes();
                }
            } catch(ex) { alert("Erreur lors de l'import : " + ex.message); }
        };
        reader.readAsText(file);
        G('SKILL-IMP-F').value = '';
    },

    exportMode: function(mode) {
        var blob = new Blob([JSON.stringify(mode, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (mode.name || 'mode').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }
};

// Initialisation au chargement
setTimeout(function() {
    SKILL_CREATOR.init();
}, 500);
