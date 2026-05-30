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
    wizardStep: 0,
    wizardData: { name: '', goal: '', traits: '', length: '' },

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

            card.innerHTML = `
                <div class="sk-top">
                    <div class="sk-icon">${esc(emoji)}</div>
                    <div class="sk-actions">
                        <button class="sk-btn sk-export" title="Exporter"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" transform="rotate(180 12 12)"/></svg></button>
                        <button class="sk-btn sk-edit" title="Modifier">✎</button>
                        <button class="sk-btn sk-del" title="Supprimer">×</button>
                    </div>
                </div>
                <div class="sk-name">${esc(m.name)}</div>
                <div class="sk-desc">${esc(m.description || m.systemPrompt || m.instructions || '')}</div>
                <div class="sk-date">${esc(dateStr)}</div>
            `;

            // Card click -> select mode
            card.onclick = (function(mode) { return function(e) {
                if (e.target.closest('.sk-btn')) return;
                self.selectMode(mode);
            };})(m);

            // Button actions
            card.querySelector('.sk-export').onclick = (function(mode) { return function() { self.exportMode(mode); }; })(m);
            card.querySelector('.sk-edit').onclick = (function(mode) { return function() { openEditCustomMode(mode.id); }; })(m);
            card.querySelector('.sk-del').onclick = (function(mode) { return function() { self.deleteMode(mode.id); }; })(m);

            grid.appendChild(card);
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

    // === AI GUIDED FLOW ===
    startAIWizard: function() {
        this.isWizardActive = true;
        this.wizardStep = 1;
        this.wizardData = { name: '', goal: '', traits: '', length: '' };
        G('SKILL-LIST-VIEW').classList.add('hidden');
        G('SKILL-AI-FLOW').classList.remove('hidden');
        G('SKILL-AI-MESSAGES').innerHTML = '';
        this.addWizardMsg('ia', "Bonjour ! Je vais t'aider à créer un mode sur mesure. Pour commencer, quel **nom** souhaites-tu donner à ce mode ? (ex: Coach de Boxe, Expert SQL, Philologue...)");
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
        var inp = G('SKILL-AI-INP');
        var text = inp.value.trim();
        if (!text) return;
        inp.value = '';
        inp.style.height = 'auto';

        this.addWizardMsg('u', text);

        if (this.wizardStep === 1) {
            this.wizardData.name = text;
            this.wizardStep = 2;
            this.addWizardMsg('ia', "C'est noté. Quel est l'**objectif principal** de ce mode ? Que doit-il accomplir pour toi ?");
        } else if (this.wizardStep === 2) {
            this.wizardData.goal = text;
            this.wizardStep = 3;
            this.addWizardMsg('ia', "Très bien. Quels sont les **traits de caractère** ou le **style** que tu souhaites lui donner ? (ex: direct et motivant, calme et pédagogique, cynique et drôle...)");
        } else if (this.wizardStep === 3) {
            this.wizardData.traits = text;
            this.wizardStep = 4;
            this.addWizardMsg('ia', "Dernière question : quelle doit être la **longueur habituelle** des réponses ? (ex: très courtes et percutantes, détaillées avec des exemples, ou adaptatives...)");
        } else if (this.wizardStep === 4) {
            this.wizardData.length = text;
            this.wizardStep = 5;
            this.synthesizeSkill();
        } else if (this.wizardStep === 5) {
            if (text.toUpperCase() === 'OUI') {
                this.saveAISkill();
            } else {
                this.addWizardMsg('ia', "C'est entendu. Dis-moi ce que tu souhaites changer dans ce profil.");
                // Optionnel: logic to refine based on feedback
            }
        }
    },

    synthesizeSkill: function() {
        var self = this;
        this.addWizardMsg('ia', "*Synthèse en cours... je prépare ton mode personnalisé.*");

        var prompt = `Agis comme un architecte de prompts expert. À partir des informations suivantes, rédige un SYSTEM PROMPT complet et efficace pour une IA.
Nom : ${this.wizardData.name}
Objectif : ${this.wizardData.goal}
Traits/Style : ${this.wizardData.traits}
Longueur : ${this.wizardData.length}

Le prompt doit être rédigé à la deuxième personne (ex: "Tu es..."). Il doit être structuré et inclure des règles claires.
Réponds UNIQUEMENT avec le contenu du system prompt, sans texte autour.`;

        if (typeof ETHER_ENGINE !== 'undefined') {
            ETHER_ENGINE.generateResponse(prompt).then(function(res) {
                var sysPrompt = (res.raw || res.answer || '').replace(/<[^>]+>/g, '').trim();
                self.proposedPrompt = sysPrompt;
                self.addWizardMsg('ia', "Voici le profil que j'ai généré pour **" + self.wizardData.name + "** :\n\n" +
                    "```\n" + sysPrompt + "\n```\n\nEst-ce que cela te convient ? Réponds **'OUI'** pour enregistrer, ou décris les modifications souhaitées.");
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
