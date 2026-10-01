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
        this.wizardData = { name: '', goal: '', when: '', traits: '', length: '', avoid: '' };
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
            // Cette reponse alimente la description, qui declenche le mode automatiquement.
            // C'est la question la plus importante du guide.
            this.addWizardMsg('ia', "Maintenant le plus important : **dans quelles situations** ce mode doit-il s'activer ?\n\nDonne-moi deux ou trois exemples de demandes typiques. C'est ce qui permettra à ETHER de le déclencher tout seul au bon moment.\n\n*(ex: « quand je colle un bout de SQL à optimiser », « quand je demande une explication de concept mathématique »)*");
        } else if (this.wizardStep === 3) {
            this.wizardData.when = text;
            this.wizardStep = 4;
            this.addWizardMsg('ia', "Quels sont les **traits de caractère** ou le **style** que tu souhaites lui donner ? (ex: direct et motivant, calme et pédagogique, cynique et drôle...)");
        } else if (this.wizardStep === 4) {
            this.wizardData.traits = text;
            this.wizardStep = 5;
            this.addWizardMsg('ia', "Quelle doit être la **longueur habituelle** des réponses ? (ex: très courtes et percutantes, détaillées avec des exemples, ou adaptatives...)");
        } else if (this.wizardStep === 5) {
            this.wizardData.length = text;
            this.wizardStep = 6;
            // Dire ce qu'il ne faut PAS faire cadre un mode bien mieux qu'une
            // accumulation de consignes positives.
            this.addWizardMsg('ia', "Dernière question, et elle vaut le détour : qu'est-ce que ce mode ne doit **jamais** faire ?\n\n*(ex: « ne jamais donner la réponse directement, seulement des indices », « ne jamais utiliser de jargon »)*\n\nRéponds **« rien »** si tu n'as pas d'interdit particulier.");
        } else if (this.wizardStep === 6) {
            this.wizardData.avoid = /^rien$/i.test(text) ? '' : text;
            this.wizardStep = 7;
            this.synthesizeSkill();
        } else if (this.wizardStep === 7) {
            if (text.toUpperCase() === 'OUI') {
                this.saveAISkill();
            } else if (/^test/i.test(text)) {
                this.testSkill();
            } else {
                this.refineSkill(text);
            }
        }
    },

    synthesizeSkill: function() {
        var self = this;
        this.addWizardMsg('ia', "*Synthèse en cours... je prépare ton mode personnalisé.*");

        // On demande DEUX choses : les instructions, et la description de
        // declenchement. Cette derniere pilote l'activation automatique, donc
        // elle doit enoncer des situations, pas resumer le mode.
        var prompt = 'Agis comme un architecte de prompts expert. Tu construis un mode personnalise pour une IA.\n\n'
            + 'Nom : ' + this.wizardData.name + '\n'
            + 'Objectif : ' + this.wizardData.goal + '\n'
            + 'Situations de declenchement decrites par l\'utilisateur : ' + this.wizardData.when + '\n'
            + 'Traits et style : ' + this.wizardData.traits + '\n'
            + 'Longueur attendue : ' + this.wizardData.length + '\n'
            + (this.wizardData.avoid ? 'A ne jamais faire : ' + this.wizardData.avoid + '\n' : '')
            + '\nRends EXACTEMENT ce format, sans rien autour :\n'
            + 'DESCRIPTION: <une phrase disant QUAND ce mode s\'applique, commencant par "Quand". '
            + 'Elle sert a declencher le mode automatiquement : elle doit enoncer des situations concretes et reconnaissables, '
            + 'pas resumer ce que le mode fait. Maximum 200 caracteres.>\n'
            + 'PROMPT:\n<le system prompt complet, redige a la deuxieme personne ("Tu es..."), structure, avec des regles claires'
            + (this.wizardData.avoid ? ' et une section des interdits' : '') + '.>';

        if (typeof ETHER_ENGINE !== 'undefined') {
            markUserMessage();
            ETHER_ENGINE.generateResponse(prompt).then(function(res) {
                var raw = (res.raw || res.answer || '').replace(/<[^>]+>/g, '').trim();
                var parsed = self.parseSynthesis(raw);
                self.proposedPrompt = parsed.prompt;
                self.proposedDescription = parsed.description;
                self.addWizardMsg('ia',
                    "Voici **" + self.wizardData.name + "** :\n\n"
                    + "**Se déclenche quand :** " + self.proposedDescription + "\n\n"
                    + "```\n" + self.proposedPrompt + "\n```\n\n"
                    + "Réponds **OUI** pour enregistrer, **TEST** pour l'essayer sur une question avant, "
                    + "ou décris ce que tu veux changer.");
            });
        }
    },

    // La reponse du modele peut deriver ; on retombe proprement sur des valeurs
    // utilisables plutot que d'enregistrer un mode a moitie vide.
    parseSynthesis: function(raw) {
        var desc = '';
        var prompt = raw;
        var dm = raw.match(/DESCRIPTION\s*:\s*(.+?)(?:\n|$)/i);
        if (dm) desc = dm[1].trim().replace(/^["'`]|["'`]$/g, '');
        var pi = raw.search(/PROMPT\s*:/i);
        if (pi !== -1) prompt = raw.slice(raw.indexOf('\n', pi) + 1).trim();
        prompt = prompt.replace(/^```[a-z]*\n?|```$/g, '').trim();
        if (!desc) {
            desc = 'Quand la demande concerne : ' + (this.wizardData.when || this.wizardData.goal || this.wizardData.name);
        }
        return { description: desc.substring(0, 200), prompt: prompt };
    },

    // Essayer le mode avant de l'enregistrer : un prompt se juge sur une reponse,
    // pas sur sa lecture.
    testSkill: function() {
        var self = this;
        this.addWizardMsg('ia', "*Essai en cours sur une question typique...*");
        var q = 'Pose-toi la question la plus representative de ce mode, puis reponds-y, '
            + 'en respectant strictement ces instructions :\n\n' + this.proposedPrompt
            + '\n\nCommence par "Question testée :" puis ta reponse.';
        if (typeof ETHER_ENGINE !== 'undefined') {
            markUserMessage();
            ETHER_ENGINE.generateResponse(q).then(function(res) {
                var out = (res.raw || res.answer || '').replace(/<[^>]+>/g, '').trim();
                self.addWizardMsg('ia', "Voici ce que donnerait ce mode :\n\n---\n\n" + out
                    + "\n\n---\n\nRéponds **OUI** pour enregistrer, ou dis-moi ce qu'il faut ajuster.");
            });
        }
    },

    // Affiner a partir du retour de l'utilisateur, sans repartir de zero.
    refineSkill: function(feedback) {
        var self = this;
        this.addWizardMsg('ia', "*J'ajuste le profil...*");
        var prompt = 'Voici un system prompt et sa description de declenchement.\n\n'
            + 'DESCRIPTION ACTUELLE: ' + this.proposedDescription + '\n\n'
            + 'PROMPT ACTUEL:\n' + this.proposedPrompt + '\n\n'
            + 'Demande de modification de l\'utilisateur : ' + feedback + '\n\n'
            + 'Reprends le meme format exactement, sans rien autour :\n'
            + 'DESCRIPTION: <phrase de declenchement commencant par "Quand", max 200 caracteres>\n'
            + 'PROMPT:\n<le system prompt revise>';
        if (typeof ETHER_ENGINE !== 'undefined') {
            markUserMessage();
            ETHER_ENGINE.generateResponse(prompt).then(function(res) {
                var raw = (res.raw || res.answer || '').replace(/<[^>]+>/g, '').trim();
                var parsed = self.parseSynthesis(raw);
                self.proposedPrompt = parsed.prompt;
                self.proposedDescription = parsed.description;
                self.addWizardMsg('ia',
                    "Version révisée :\n\n**Se déclenche quand :** " + self.proposedDescription + "\n\n"
                    + "```\n" + self.proposedPrompt + "\n```\n\n"
                    + "**OUI** pour enregistrer, **TEST** pour l'essayer, ou dis-moi quoi changer encore.");
            });
        }
    },

    saveAISkill: function() {
        var self = this;
        var mode = {
            id: 'mode_' + Date.now(),
            name: this.wizardData.name,
            description: this.proposedDescription || this.wizardData.when || this.wizardData.goal.substring(0, 200),
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
