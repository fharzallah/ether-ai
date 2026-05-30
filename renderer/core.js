// === ETHER — App Core (globals, storage, boot) ===

// Global error handler — log toutes les erreurs non capturees
window.onerror = function(msg, src, line, col, err) {
    console.error('[ETHER ERROR] ' + msg + ' at L' + line + ':' + col + (err ? ' — ' + err.stack : ''));
    return false;
};

// Configure marked for safe rendering
if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });
}
// Sanitize HTML — strip dangerous tags and attributes to prevent XSS
function sanitizeHTML(html) {
    if (!html) return '';
    // Remove script/iframe/object/embed/form tags entirely
    html = html.replace(/<(script|iframe|object|embed|form|base|meta|link|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    html = html.replace(/<(script|iframe|object|embed|form|base|meta|link)\b[^>]*\/?>/gi, '');
    // Remove event handler attributes (onclick, onerror, onload, etc.)
    html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    // Remove javascript: and data: URLs in href/src attributes
    html = html.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');
    html = html.replace(/(href|src|action)\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, function(m, attr) {
        // Allow data: for images only
        if (attr === 'src' && /data:image\//i.test(m)) return m;
        return attr + '=""';
    });
    return html;
}

function renderMarkdown(md) {
    if (!md) return '';
    // Si c'est deja du HTML (contient des balises), sanitiser et retourner
    if (/<(p|ul|ol|div|h[1-6]|table|blockquote)\b/i.test(md)) return sanitizeHTML(md);
    if (typeof marked !== 'undefined' && marked.parse) {
        try { return sanitizeHTML(marked.parse(md)); } catch(e) { /* fallback below */ }
    }
    // Fallback: conversion basique markdown -> HTML
    var html = md
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^(\d+)\.\s+(.*)$/gm, '<li>$2</li>')
        .replace(/^[-\u2022]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\n?)+/g, function(m) { return '<ul>' + m + '</ul>'; });
    html = html.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    if (html.indexOf('<p>') !== 0) html = '<p>' + html + '</p>';
    return sanitizeHTML(html);
}

// === APP CODE ===
var G = function(id) { return document.getElementById(id); };

// Escaping for HTML/Attributes
function esc(t) {
    if (!t) return '';
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}
function escAttr(t) {
    if (!t) return '';
    return t.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

// Variables globales disponibles pour tous les scripts suivants
// (initialisées ici pour éviter les ReferenceError dans ui.js chargé avant app-main.js)
var isPro = false; // sera écrasé par sGet('pro', false) dans app-main.js au boot
function sSet(k,v) {
    // 1. Sauvegarder dans le localStorage (cache rapide, mais limite)
    try {
        localStorage.setItem('ether_'+k, JSON.stringify(v));
    } catch(e) {
        console.warn('[STORAGE] localStorage full, using only filesystem for', k);
        // Si localStorage est plein, on ne bloque pas, car on a le filesystem en backup
    }

    // 2. Sauvegarder dans le système de fichiers (persistance réelle et illimitée)
    if (window.etherDesktop && window.etherDesktop.persistSet) {
        window.etherDesktop.persistSet(k, v);
    }
}
function sGet(k,d) {
    try {
        var v = localStorage.getItem('ether_'+k);
        if (v === null || v === undefined || v === "undefined") return d;
        var parsed = JSON.parse(v);
        return (parsed !== null && parsed !== undefined) ? parsed : d;
    } catch(e) {
        console.warn('[STORAGE] Failed to parse', k, ':', e.message);
        return d;
    }
}

// Au demarrage, restaurer les donnees du fichier persistant dans le localStorage (cache)
function restoreFromPersist() {
    if (!window.etherDesktop || !window.etherDesktop.persistRead) return Promise.resolve();
    return window.etherDesktop.persistRead().then(function(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            // Valider la cle — uniquement des caracteres alphanumeriques et underscores
            if (!/^[\w-]+$/.test(k)) continue;
            try {
                // On restaure systématiquement pour s'assurer que le cache est à jour avec le filesystem
                localStorage.setItem('ether_' + k, JSON.stringify(data[k]));
            } catch(e) {
                // Si ça échoue, c'est que localStorage est plein, on laisse tomber pour cette clé
            }
        }
    })['catch'](function(e) { console.warn('[PERSIST] Restore failed:', e); });
}
// === ETHER — Internationalization ===

// === I18N TRANSLATIONS ===
var TRANSLATIONS = {
fr: {
login_sub:'IA franche, mesuree et transparente',login_name:'Prenom',login_lastname:'Nom (facultatif)',login_email:'Adresse email',login_start:'Commencer',
welc_help:'Comment puis-je vous aider?',
chip_relativity:'La relativite simplement',chip_remote:'Pour/contre le teletravail',chip_app:"Developper une idee d'app",chip_sleep:'Mieux dormir',
mode_ether:'ETHER',mode_teacher:'Teacher',mode_debate:'Debat',mode_creative:'Creatif',mode_writer:'Ecriture',mode_image:'Image',mode_custom:'Mes modes',
input_placeholder:'Envoie un message...',
sb_chats:'Discussions',sb_projects:'Projets',sb_content:'Contenu',sb_trash:'Corbeille',sb_search:'Rechercher...',sb_no_chats:'Aucune discussion',sb_no_projects:'Aucun projet',sb_trash_empty:'Corbeille vide',sb_new_project:'+ Nouveau projet',
set_title:'Parametres',set_theme:'Theme',set_lang:'Langue',set_profession:'Profession',set_profession_ph:'Ex : Developpeur, Etudiant...',set_instructions:'Instructions personnalisees',set_instructions_desc:'Dis comment ETHER doit se comporter.',set_instructions_ph:'Ex : Tutoie-moi. Sois concis...',set_memory:'Memoire',set_memory_desc:'Ce qu ETHER a retenu sur toi.',set_memory_ph:'Ajouter un souvenir...',set_no_memory:'Aucun souvenir',set_subscription:'Abonnement',set_providers:'Fournisseurs IA',set_api:'API Developpeurs',set_account:'Compte',set_data:'Donnees',
btn_copy:'Copier',btn_regen:'Regenerer',btn_good:'Bien',btn_bad:'Pas bien',btn_listen:'Ecouter',btn_save:'Sauvegarder',btn_delete:'Supprimer',btn_add:'Ajouter',btn_create:'Creer',btn_cancel:'Annuler',btn_test:'Tester',
quota_remaining:'messages restants',quota_ad:'Regarder une pub (+5)',
badge_verified:'Info verifiee',badge_to_verify:'Info a verifier',badge_unverified:'Info non verifiee',
think_base:'Analyse en cours...',think_teacher:'Preparation de la question...',think_debate:'Construction du contre-argument...',think_creative:"Generation d'idees...",think_writer:'Redaction en cours...',
new_chat:'Nouveau chat',reasoning:'Raisonnement',ephemeral_on:'Discussion ephemere activee',create_mode:'Creer un mode',custom_modes_title:'MODES PERSONNALISES',
greeting_morning:'Bonjour',greeting_evening:'Bonsoir',
hist_today:"Aujourd'hui",hist_yesterday:'Hier',hist_week:'Cette semaine',hist_month:'30 derniers jours',hist_older:'Plus ancien',hist_show_all:'Voir toutes les discussions',btn_rename:'Renommer'
},
en: {
login_sub:'Honest, measured and transparent AI',login_name:'First name',login_lastname:'Last name (optional)',login_email:'Email address',login_start:'Get started',
welc_help:'How can I help you?',
chip_relativity:'Relativity simply explained',chip_remote:'Pros/cons of remote work',chip_app:'Develop an app idea',chip_sleep:'Sleep better',
mode_ether:'ETHER',mode_teacher:'Teacher',mode_debate:'Debate',mode_creative:'Creative',mode_writer:'Writing',mode_image:'Image',mode_custom:'My modes',
input_placeholder:'Send a message...',
sb_chats:'Chats',sb_projects:'Projects',sb_content:'Content',sb_trash:'Trash',sb_search:'Search...',sb_no_chats:'No chats',sb_no_projects:'No projects',sb_trash_empty:'Trash is empty',sb_new_project:'+ New project',
set_title:'Settings',set_theme:'Theme',set_lang:'Language',set_profession:'Profession',set_profession_ph:'Ex: Developer, Student...',set_instructions:'Custom instructions',set_instructions_desc:'Tell ETHER how to behave.',set_instructions_ph:'Ex: Be concise...',set_memory:'Memory',set_memory_desc:'What ETHER remembers about you.',set_memory_ph:'Add a memory...',set_no_memory:'No memories',set_subscription:'Subscription',set_providers:'AI Providers',set_api:'Developer API',set_account:'Account',set_data:'Data',
btn_copy:'Copy',btn_regen:'Regenerate',btn_good:'Good',btn_bad:'Bad',btn_listen:'Listen',btn_save:'Save',btn_delete:'Delete',btn_add:'Add',btn_create:'Create',btn_cancel:'Cancel',btn_test:'Test',
quota_remaining:'messages remaining',quota_ad:'Watch an ad (+5)',
badge_verified:'Verified info',badge_to_verify:'To verify',badge_unverified:'Unverified info',
think_base:'Analyzing...',think_teacher:'Preparing question...',think_debate:'Building counter-argument...',think_creative:'Generating ideas...',think_writer:'Writing in progress...',
new_chat:'New chat',reasoning:'Reasoning',ephemeral_on:'Ephemeral chat enabled',create_mode:'Create a mode',custom_modes_title:'CUSTOM MODES',
greeting_morning:'Hello',greeting_evening:'Good evening',
hist_today:'Today',hist_yesterday:'Yesterday',hist_week:'This week',hist_month:'Last 30 days',hist_older:'Older',hist_show_all:'View all conversations',btn_rename:'Rename'
},
es: {
login_sub:'IA franca, mesurada y transparente',login_name:'Nombre',login_lastname:'Apellido (opcional)',login_email:'Correo electronico',login_start:'Comenzar',
welc_help:'Como puedo ayudarte?',
chip_relativity:'La relatividad simplemente',chip_remote:'Pros/contras del teletrabajo',chip_app:'Desarrollar una idea de app',chip_sleep:'Dormir mejor',
mode_ether:'ETHER',mode_teacher:'Teacher',mode_debate:'Debate',mode_creative:'Creativo',mode_writer:'Escritura',mode_image:'Imagen',mode_custom:'Mis modos',
input_placeholder:'Envia un mensaje...',
sb_chats:'Conversaciones',sb_projects:'Proyectos',sb_content:'Contenido',sb_trash:'Papelera',sb_search:'Buscar...',sb_no_chats:'Sin conversaciones',sb_no_projects:'Sin proyectos',sb_trash_empty:'Papelera vacia',sb_new_project:'+ Nuevo proyecto',
set_title:'Ajustes',set_theme:'Tema',set_lang:'Idioma',set_profession:'Profesion',set_profession_ph:'Ej: Desarrollador, Estudiante...',set_instructions:'Instrucciones personalizadas',set_instructions_desc:'Indica como debe comportarse ETHER.',set_instructions_ph:'Ej: Tuteame. Se conciso...',set_memory:'Memoria',set_memory_desc:'Lo que ETHER recuerda de ti.',set_memory_ph:'Anadir un recuerdo...',set_no_memory:'Sin recuerdos',set_subscription:'Suscripcion',set_providers:'Proveedores IA',set_api:'API Desarrolladores',set_account:'Cuenta',set_data:'Datos',
btn_copy:'Copiar',btn_regen:'Regenerar',btn_good:'Bien',btn_bad:'Mal',btn_listen:'Escuchar',btn_save:'Guardar',btn_delete:'Eliminar',btn_add:'Anadir',btn_create:'Crear',btn_cancel:'Cancelar',btn_test:'Probar',
quota_remaining:'mensajes restantes',quota_ad:'Ver un anuncio (+5)',
badge_verified:'Info verificada',badge_to_verify:'Info por verificar',badge_unverified:'Info no verificada',
think_base:'Analizando...',think_teacher:'Preparando pregunta...',think_debate:'Construyendo contraargumento...',think_creative:'Generando ideas...',think_writer:'Redactando...',
new_chat:'Nuevo chat',reasoning:'Razonamiento',ephemeral_on:'Chat efimero activado',create_mode:'Crear un modo',custom_modes_title:'MODOS PERSONALIZADOS',
greeting_morning:'Buenos dias',greeting_evening:'Buenas noches'
},
ar: {
login_sub:'ذكاء اصطناعي صريح ومتوازن وشفاف',login_name:'الاسم الاول',login_lastname:'اللقب (اختياري)',login_email:'البريد الالكتروني',login_start:'ابدا',
welc_help:'كيف يمكنني مساعدتك؟',
chip_relativity:'النسبية ببساطة',chip_remote:'مع/ضد العمل عن بعد',chip_app:'تطوير فكرة تطبيق',chip_sleep:'النوم بشكل افضل',
mode_ether:'ETHER',mode_teacher:'معلم',mode_debate:'نقاش',mode_creative:'ابداعي',mode_writer:'كتابة',mode_image:'صورة',mode_custom:'اوضاعي',
input_placeholder:'ارسل رسالة...',
sb_chats:'المحادثات',sb_projects:'المشاريع',sb_content:'المحتوى',sb_trash:'سلة المحذوفات',sb_search:'بحث...',sb_no_chats:'لا محادثات',sb_no_projects:'لا مشاريع',sb_trash_empty:'السلة فارغة',sb_new_project:'+ مشروع جديد',
set_title:'الاعدادات',set_theme:'المظهر',set_lang:'اللغة',set_profession:'المهنة',set_profession_ph:'مثال: مطور، طالب...',set_instructions:'تعليمات مخصصة',set_instructions_desc:'اخبر ETHER كيف يتصرف.',set_instructions_ph:'مثال: كن مختصرا...',set_memory:'الذاكرة',set_memory_desc:'ما يتذكره ETHER عنك.',set_memory_ph:'اضف ذكرى...',set_no_memory:'لا ذكريات',set_subscription:'الاشتراك',set_providers:'مزودو الذكاء الاصطناعي',set_api:'API للمطورين',set_account:'الحساب',set_data:'البيانات',
btn_copy:'نسخ',btn_regen:'اعادة',btn_good:'جيد',btn_bad:'سيئ',btn_listen:'استماع',btn_save:'حفظ',btn_delete:'حذف',btn_add:'اضافة',btn_create:'انشاء',btn_cancel:'الغاء',btn_test:'اختبار',
quota_remaining:'رسائل متبقية',quota_ad:'شاهد اعلانا (+5)',
badge_verified:'معلومة موثقة',badge_to_verify:'معلومة للتحقق',badge_unverified:'معلومة غير موثقة',
think_base:'جاري التحليل...',think_teacher:'تحضير السؤال...',think_debate:'بناء الحجة المضادة...',think_creative:'توليد الافكار...',think_writer:'جاري الكتابة...',
new_chat:'محادثة جديدة',reasoning:'التفكير',ephemeral_on:'المحادثة المؤقتة مفعلة',create_mode:'انشاء وضع',custom_modes_title:'اوضاع مخصصة',
greeting_morning:'مرحبا',greeting_evening:'مساء الخير'
},
de: {
login_sub:'Ehrliche, ausgewogene und transparente KI',login_name:'Vorname',login_lastname:'Nachname (optional)',login_email:'E-Mail-Adresse',login_start:'Starten',
welc_help:'Wie kann ich Ihnen helfen?',
chip_relativity:'Relativitaet einfach erklaert',chip_remote:'Vor-/Nachteile Homeoffice',chip_app:'App-Idee entwickeln',chip_sleep:'Besser schlafen',
mode_ether:'ETHER',mode_teacher:'Teacher',mode_debate:'Debatte',mode_creative:'Kreativ',mode_writer:'Schreiben',mode_image:'Bild',mode_custom:'Meine Modi',
input_placeholder:'Nachricht senden...',
sb_chats:'Chats',sb_projects:'Projekte',sb_content:'Inhalte',sb_trash:'Papierkorb',sb_search:'Suchen...',sb_no_chats:'Keine Chats',sb_no_projects:'Keine Projekte',sb_trash_empty:'Papierkorb leer',sb_new_project:'+ Neues Projekt',
set_title:'Einstellungen',set_theme:'Design',set_lang:'Sprache',set_profession:'Beruf',set_profession_ph:'Z.B.: Entwickler, Student...',set_instructions:'Eigene Anweisungen',set_instructions_desc:'Sag ETHER wie es sich verhalten soll.',set_instructions_ph:'Z.B.: Duze mich. Sei knapp...',set_memory:'Gedaechtnis',set_memory_desc:'Was ETHER ueber dich weiss.',set_memory_ph:'Erinnerung hinzufuegen...',set_no_memory:'Keine Erinnerungen',set_subscription:'Abonnement',set_providers:'KI-Anbieter',set_api:'Entwickler-API',set_account:'Konto',set_data:'Daten',
btn_copy:'Kopieren',btn_regen:'Neu generieren',btn_good:'Gut',btn_bad:'Schlecht',btn_listen:'Anhoeren',btn_save:'Speichern',btn_delete:'Loeschen',btn_add:'Hinzufuegen',btn_create:'Erstellen',btn_cancel:'Abbrechen',btn_test:'Testen',
quota_remaining:'Nachrichten uebrig',quota_ad:'Werbung ansehen (+5)',
badge_verified:'Verifiziert',badge_to_verify:'Zu pruefen',badge_unverified:'Nicht verifiziert',
think_base:'Analyse laeuft...',think_teacher:'Frage wird vorbereitet...',think_debate:'Gegenargument wird aufgebaut...',think_creative:'Ideen werden generiert...',think_writer:'Wird geschrieben...',
new_chat:'Neuer Chat',reasoning:'Begruendung',ephemeral_on:'Fluechtige Unterhaltung aktiv',create_mode:'Modus erstellen',custom_modes_title:'EIGENE MODI',
greeting_morning:'Guten Tag',greeting_evening:'Guten Abend'
},
it: {
login_sub:'IA onesta, misurata e trasparente',login_name:'Nome',login_lastname:'Cognome (facoltativo)',login_email:'Indirizzo email',login_start:'Inizia',
welc_help:'Come posso aiutarti?',
chip_relativity:'La relativita semplicemente',chip_remote:'Pro/contro del telelavoro',chip_app:"Sviluppare un'idea di app",chip_sleep:'Dormire meglio',
mode_ether:'ETHER',mode_teacher:'Teacher',mode_debate:'Dibattito',mode_creative:'Creativo',mode_writer:'Scrittura',mode_image:'Immagine',mode_custom:'I miei modi',
input_placeholder:'Invia un messaggio...',
sb_chats:'Conversazioni',sb_projects:'Progetti',sb_content:'Contenuto',sb_trash:'Cestino',sb_search:'Cerca...',sb_no_chats:'Nessuna conversazione',sb_no_projects:'Nessun progetto',sb_trash_empty:'Cestino vuoto',sb_new_project:'+ Nuovo progetto',
set_title:'Impostazioni',set_theme:'Tema',set_lang:'Lingua',set_profession:'Professione',set_profession_ph:'Es: Sviluppatore, Studente...',set_instructions:'Istruzioni personalizzate',set_instructions_desc:'Di a ETHER come comportarsi.',set_instructions_ph:'Es: Dammi del tu. Sii conciso...',set_memory:'Memoria',set_memory_desc:'Cosa ETHER ricorda di te.',set_memory_ph:'Aggiungi un ricordo...',set_no_memory:'Nessun ricordo',set_subscription:'Abbonamento',set_providers:'Fornitori IA',set_api:'API Sviluppatori',set_account:'Account',set_data:'Dati',
btn_copy:'Copia',btn_regen:'Rigenera',btn_good:'Bene',btn_bad:'Male',btn_listen:'Ascolta',btn_save:'Salva',btn_delete:'Elimina',btn_add:'Aggiungi',btn_create:'Crea',btn_cancel:'Annulla',btn_test:'Testa',
quota_remaining:'messaggi rimanenti',quota_ad:'Guarda una pubblicita (+5)',
badge_verified:'Info verificata',badge_to_verify:'Da verificare',badge_unverified:'Info non verificata',
think_base:'Analisi in corso...',think_teacher:'Preparazione domanda...',think_debate:'Costruzione controargomento...',think_creative:'Generazione idee...',think_writer:'Scrittura in corso...',
new_chat:'Nuova chat',reasoning:'Ragionamento',ephemeral_on:'Chat effimera attivata',create_mode:'Crea un modo',custom_modes_title:'MODI PERSONALIZZATI',
greeting_morning:'Buongiorno',greeting_evening:'Buonasera'
},
pt: {
login_sub:'IA franca, equilibrada e transparente',login_name:'Nome',login_lastname:'Sobrenome (opcional)',login_email:'Endereco de email',login_start:'Comecar',
welc_help:'Como posso ajudar?',
chip_relativity:'A relatividade simplesmente',chip_remote:'Pros/contras do teletrabalho',chip_app:'Desenvolver uma ideia de app',chip_sleep:'Dormir melhor',
mode_ether:'ETHER',mode_teacher:'Teacher',mode_debate:'Debate',mode_creative:'Criativo',mode_writer:'Escrita',mode_image:'Imagem',mode_custom:'Meus modos',
input_placeholder:'Envie uma mensagem...',
sb_chats:'Conversas',sb_projects:'Projetos',sb_content:'Conteudo',sb_trash:'Lixeira',sb_search:'Pesquisar...',sb_no_chats:'Sem conversas',sb_no_projects:'Sem projetos',sb_trash_empty:'Lixeira vazia',sb_new_project:'+ Novo projeto',
set_title:'Configuracoes',set_theme:'Tema',set_lang:'Idioma',set_profession:'Profissao',set_profession_ph:'Ex: Desenvolvedor, Estudante...',set_instructions:'Instrucoes personalizadas',set_instructions_desc:'Diga como ETHER deve se comportar.',set_instructions_ph:'Ex: Me tuteia. Seja conciso...',set_memory:'Memoria',set_memory_desc:'O que ETHER lembra de voce.',set_memory_ph:'Adicionar uma lembranca...',set_no_memory:'Sem lembrancas',set_subscription:'Assinatura',set_providers:'Provedores IA',set_api:'API Desenvolvedores',set_account:'Conta',set_data:'Dados',
btn_copy:'Copiar',btn_regen:'Regenerar',btn_good:'Bom',btn_bad:'Ruim',btn_listen:'Ouvir',btn_save:'Salvar',btn_delete:'Excluir',btn_add:'Adicionar',btn_create:'Criar',btn_cancel:'Cancelar',btn_test:'Testar',
quota_remaining:'mensagens restantes',quota_ad:'Assistir anuncio (+5)',
badge_verified:'Info verificada',badge_to_verify:'A verificar',badge_unverified:'Info nao verificada',
think_base:'Analisando...',think_teacher:'Preparando pergunta...',think_debate:'Construindo contra-argumento...',think_creative:'Gerando ideias...',think_writer:'Escrevendo...',
new_chat:'Novo chat',reasoning:'Raciocinio',ephemeral_on:'Chat efemero ativado',create_mode:'Criar um modo',custom_modes_title:'MODOS PERSONALIZADOS',
greeting_morning:'Bom dia',greeting_evening:'Boa noite'
},
zh: {
login_sub:'坦诚、客观、透明的AI',login_name:'名字',login_lastname:'姓氏（可选）',login_email:'邮箱地址',login_start:'开始',
welc_help:'我能帮您什么？',
chip_relativity:'简单解释相对论',chip_remote:'远程办公的利弊',chip_app:'开发一个应用想法',chip_sleep:'睡得更好',
mode_ether:'ETHER',mode_teacher:'教师',mode_debate:'辩论',mode_creative:'创意',mode_writer:'写作',mode_image:'图片',mode_custom:'我的模式',
input_placeholder:'发送消息...',
sb_chats:'对话',sb_projects:'项目',sb_content:'内容',sb_trash:'回收站',sb_search:'搜索...',sb_no_chats:'没有对话',sb_no_projects:'没有项目',sb_trash_empty:'回收站为空',sb_new_project:'+ 新项目',
set_title:'设置',set_theme:'主题',set_lang:'语言',set_profession:'职业',set_profession_ph:'例：开发者、学生...',set_instructions:'自定义指令',set_instructions_desc:'告诉ETHER如何表现。',set_instructions_ph:'例：简洁回答...',set_memory:'记忆',set_memory_desc:'ETHER记住的关于你的信息。',set_memory_ph:'添加记忆...',set_no_memory:'没有记忆',set_subscription:'订阅',set_providers:'AI供应商',set_api:'开发者API',set_account:'账户',set_data:'数据',
btn_copy:'复制',btn_regen:'重新生成',btn_good:'好',btn_bad:'差',btn_listen:'听',btn_save:'保存',btn_delete:'删除',btn_add:'添加',btn_create:'创建',btn_cancel:'取消',btn_test:'测试',
quota_remaining:'条消息剩余',quota_ad:'看广告 (+5)',
badge_verified:'已验证',badge_to_verify:'待验证',badge_unverified:'未验证',
think_base:'分析中...',think_teacher:'准备问题...',think_debate:'构建反论...',think_creative:'生成想法...',think_writer:'撰写中...',
new_chat:'新对话',reasoning:'推理',ephemeral_on:'临时对话已启用',create_mode:'创建模式',custom_modes_title:'自定义模式',
greeting_morning:'你好',greeting_evening:'晚上好'
},
ja: {
login_sub:'正直で公平で透明なAI',login_name:'名前',login_lastname:'姓（任意）',login_email:'メールアドレス',login_start:'始める',
welc_help:'何かお手伝いできますか？',
chip_relativity:'相対性理論を簡単に',chip_remote:'テレワークの賛否',chip_app:'アプリのアイデアを開発',chip_sleep:'よく眠る',
mode_ether:'ETHER',mode_teacher:'先生',mode_debate:'討論',mode_creative:'創造',mode_writer:'執筆',mode_image:'画像',mode_custom:'マイモード',
input_placeholder:'メッセージを送信...',
sb_chats:'チャット',sb_projects:'プロジェクト',sb_content:'コンテンツ',sb_trash:'ゴミ箱',sb_search:'検索...',sb_no_chats:'チャットなし',sb_no_projects:'プロジェクトなし',sb_trash_empty:'ゴミ箱は空です',sb_new_project:'+ 新規プロジェクト',
set_title:'設定',set_theme:'テーマ',set_lang:'言語',set_profession:'職業',set_profession_ph:'例：開発者、学生...',set_instructions:'カスタム指示',set_instructions_desc:'ETHERの振る舞いを設定。',set_instructions_ph:'例：簡潔に答えて...',set_memory:'メモリ',set_memory_desc:'ETHERがあなたについて覚えていること。',set_memory_ph:'メモリを追加...',set_no_memory:'メモリなし',set_subscription:'サブスクリプション',set_providers:'AIプロバイダー',set_api:'開発者API',set_account:'アカウント',set_data:'データ',
btn_copy:'コピー',btn_regen:'再生成',btn_good:'良い',btn_bad:'悪い',btn_listen:'聞く',btn_save:'保存',btn_delete:'削除',btn_add:'追加',btn_create:'作成',btn_cancel:'キャンセル',btn_test:'テスト',
quota_remaining:'メッセージ残り',quota_ad:'広告を見る (+5)',
badge_verified:'検証済み',badge_to_verify:'要確認',badge_unverified:'未検証',
think_base:'分析中...',think_teacher:'質問準備中...',think_debate:'反論構築中...',think_creative:'アイデア生成中...',think_writer:'執筆中...',
new_chat:'新しいチャット',reasoning:'推論',ephemeral_on:'一時チャット有効',create_mode:'モードを作成',custom_modes_title:'カスタムモード',
greeting_morning:'こんにちは',greeting_evening:'こんばんは'
},
ko: {
login_sub:'솔직하고 균형 잡힌 투명한 AI',login_name:'이름',login_lastname:'성 (선택)',login_email:'이메일 주소',login_start:'시작',
welc_help:'무엇을 도와드릴까요?',
chip_relativity:'상대성이론 쉽게',chip_remote:'재택근무 장단점',chip_app:'앱 아이디어 개발',chip_sleep:'잠 잘 자기',
mode_ether:'ETHER',mode_teacher:'선생님',mode_debate:'토론',mode_creative:'창작',mode_writer:'글쓰기',mode_image:'이미지',mode_custom:'내 모드',
input_placeholder:'메시지 보내기...',
sb_chats:'대화',sb_projects:'프로젝트',sb_content:'콘텐츠',sb_trash:'휴지통',sb_search:'검색...',sb_no_chats:'대화 없음',sb_no_projects:'프로젝트 없음',sb_trash_empty:'휴지통 비어있음',sb_new_project:'+ 새 프로젝트',
set_title:'설정',set_theme:'테마',set_lang:'언어',set_profession:'직업',set_profession_ph:'예: 개발자, 학생...',set_instructions:'맞춤 지시',set_instructions_desc:'ETHER의 행동 방식을 설정하세요.',set_instructions_ph:'예: 간결하게 답해줘...',set_memory:'메모리',set_memory_desc:'ETHER가 기억하는 정보.',set_memory_ph:'기억 추가...',set_no_memory:'기억 없음',set_subscription:'구독',set_providers:'AI 제공자',set_api:'개발자 API',set_account:'계정',set_data:'데이터',
btn_copy:'복사',btn_regen:'재생성',btn_good:'좋아요',btn_bad:'싫어요',btn_listen:'듣기',btn_save:'저장',btn_delete:'삭제',btn_add:'추가',btn_create:'만들기',btn_cancel:'취소',btn_test:'테스트',
quota_remaining:'메시지 남음',quota_ad:'광고 보기 (+5)',
badge_verified:'검증됨',badge_to_verify:'확인 필요',badge_unverified:'미검증',
think_base:'분석 중...',think_teacher:'질문 준비 중...',think_debate:'반론 구성 중...',think_creative:'아이디어 생성 중...',think_writer:'작성 중...',
new_chat:'새 대화',reasoning:'추론',ephemeral_on:'임시 대화 활성화',create_mode:'모드 만들기',custom_modes_title:'사용자 모드',
greeting_morning:'안녕하세요',greeting_evening:'안녕하세요'
},
tr: {
login_sub:'Durust, olculu ve seffaf yapay zeka',login_name:'Ad',login_lastname:'Soyad (istege bagli)',login_email:'E-posta adresi',login_start:'Basla',
welc_help:'Size nasil yardimci olabilirim?',
chip_relativity:'Goreliligi basitce',chip_remote:'Uzaktan calisma artilari/eksileri',chip_app:'Uygulama fikri gelistir',chip_sleep:'Daha iyi uyumak',
mode_ether:'ETHER',mode_teacher:'Ogretmen',mode_debate:'Tartisma',mode_creative:'Yaratici',mode_writer:'Yazim',mode_image:'Gorsel',mode_custom:'Modlarim',
input_placeholder:'Mesaj gonder...',
sb_chats:'Sohbetler',sb_projects:'Projeler',sb_content:'Icerik',sb_trash:'Cop kutusu',sb_search:'Ara...',sb_no_chats:'Sohbet yok',sb_no_projects:'Proje yok',sb_trash_empty:'Cop kutusu bos',sb_new_project:'+ Yeni proje',
set_title:'Ayarlar',set_theme:'Tema',set_lang:'Dil',set_profession:'Meslek',set_profession_ph:'Orn: Gelistirici, Ogrenci...',set_instructions:'Ozel talimatlar',set_instructions_desc:"ETHER'in nasil davranacagini belirle.",set_instructions_ph:'Orn: Kisa cevap ver...',set_memory:'Hafiza',set_memory_desc:"ETHER'in senin hakkinda bildikleri.",set_memory_ph:'Bir anisi ekle...',set_no_memory:'Hatirlanan yok',set_subscription:'Abonelik',set_providers:'Yapay Zeka Saglayicilari',set_api:'Gelistirici API',set_account:'Hesap',set_data:'Veriler',
btn_copy:'Kopyala',btn_regen:'Yeniden olustur',btn_good:'Iyi',btn_bad:'Kotu',btn_listen:'Dinle',btn_save:'Kaydet',btn_delete:'Sil',btn_add:'Ekle',btn_create:'Olustur',btn_cancel:'Iptal',btn_test:'Test et',
quota_remaining:'mesaj kaldi',quota_ad:'Reklam izle (+5)',
badge_verified:'Dogrulanmis bilgi',badge_to_verify:'Dogrulanacak',badge_unverified:'Dogrulanmamis',
think_base:'Analiz ediliyor...',think_teacher:'Soru hazirlaniyor...',think_debate:'Karsi arguman olusturuluyor...',think_creative:'Fikirler uretiliyor...',think_writer:'Yaziliyor...',
new_chat:'Yeni sohbet',reasoning:'Akil yurume',ephemeral_on:'Gecici sohbet aktif',create_mode:'Mod olustur',custom_modes_title:'OZEL MODLAR',
greeting_morning:'Merhaba',greeting_evening:'Iyi aksamlar'
},
ru: {
login_sub:'Честный, взвешенный и прозрачный ИИ',login_name:'Имя',login_lastname:'Фамилия (необязательно)',login_email:'Электронная почта',login_start:'Начать',
welc_help:'Чем я могу помочь?',
chip_relativity:'Теория относительности просто',chip_remote:'За/против удаленной работы',chip_app:'Разработать идею приложения',chip_sleep:'Лучше спать',
mode_ether:'ETHER',mode_teacher:'Учитель',mode_debate:'Дебаты',mode_creative:'Креатив',mode_writer:'Письмо',mode_image:'Изображение',mode_custom:'Мои режимы',
input_placeholder:'Отправить сообщение...',
sb_chats:'Чаты',sb_projects:'Проекты',sb_content:'Контент',sb_trash:'Корзина',sb_search:'Поиск...',sb_no_chats:'Нет чатов',sb_no_projects:'Нет проектов',sb_trash_empty:'Корзина пуста',sb_new_project:'+ Новый проект',
set_title:'Настройки',set_theme:'Тема',set_lang:'Язык',set_profession:'Профессия',set_profession_ph:'Напр.: Разработчик, Студент...',set_instructions:'Пользовательские инструкции',set_instructions_desc:'Скажите ETHER как себя вести.',set_instructions_ph:'Напр.: Будь кратким...',set_memory:'Память',set_memory_desc:'Что ETHER помнит о вас.',set_memory_ph:'Добавить воспоминание...',set_no_memory:'Нет воспоминаний',set_subscription:'Подписка',set_providers:'Провайдеры ИИ',set_api:'API для разработчиков',set_account:'Аккаунт',set_data:'Данные',
btn_copy:'Копировать',btn_regen:'Перегенерировать',btn_good:'Хорошо',btn_bad:'Плохо',btn_listen:'Слушать',btn_save:'Сохранить',btn_delete:'Удалить',btn_add:'Добавить',btn_create:'Создать',btn_cancel:'Отмена',btn_test:'Тест',
quota_remaining:'сообщений осталось',quota_ad:'Посмотреть рекламу (+5)',
badge_verified:'Проверено',badge_to_verify:'Требует проверки',badge_unverified:'Не проверено',
think_base:'Анализ...',think_teacher:'Подготовка вопроса...',think_debate:'Построение контраргумента...',think_creative:'Генерация идей...',think_writer:'Идет написание...',
new_chat:'Новый чат',reasoning:'Рассуждение',ephemeral_on:'Временный чат включен',create_mode:'Создать режим',custom_modes_title:'ПОЛЬЗОВАТЕЛЬСКИЕ РЕЖИМЫ',
greeting_morning:'Здравствуйте',greeting_evening:'Добрый вечер'
}
};

// Language codes for speech recognition/synthesis
var LANG_CODES = {fr:'fr-FR',en:'en-US',es:'es-ES',ar:'ar-SA',de:'de-DE',it:'it-IT',pt:'pt-BR',zh:'zh-CN',ja:'ja-JP',ko:'ko-KR',tr:'tr-TR',ru:'ru-RU',nl:'nl-NL',pl:'pl-PL',sv:'sv-SE',hi:'hi-IN',vi:'vi-VN',th:'th-TH',id:'id-ID',ro:'ro-RO',el:'el-GR',cs:'cs-CZ',uk:'uk-UA',he:'he-IL',da:'da-DK',fi:'fi-FI',no:'nb-NO',hu:'hu-HU',ms:'ms-MY',bn:'bn-BD',sw:'sw-KE'};

function t(key) {
    var lang = curLang || 'fr';
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) return TRANSLATIONS[lang][key];
    if (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) return TRANSLATIONS['en'][key];
    return TRANSLATIONS['fr'][key] || key;
}

function getLangCode() {
    return LANG_CODES[curLang] || LANG_CODES['fr'];
}

function applyLanguage() {
    var lang = curLang || 'fr';
    document.documentElement.lang = lang;
    // RTL support
    if (lang === 'ar' || lang === 'he') {
        document.body.style.direction = 'rtl';
        document.documentElement.style.direction = 'rtl';
    } else {
        document.body.style.direction = 'ltr';
        document.documentElement.style.direction = 'ltr';
    }
    // Update all data-i18n elements
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
        var key = els[i].getAttribute('data-i18n');
        els[i].textContent = t(key);
    }
    // Update all data-i18n-ph placeholders
    var phs = document.querySelectorAll('[data-i18n-ph]');
    for (var i = 0; i < phs.length; i++) {
        var key = phs[i].getAttribute('data-i18n-ph');
        phs[i].placeholder = t(key);
    }
    // Update mode buttons text (keep SVG icons)
    var modeMap = {base:'mode_ether',teacher:'mode_teacher',debate:'mode_debate',creative:'mode_creative',writer:'mode_writer',image:'mode_image'};
    var mpBtns = document.querySelectorAll('.mp[data-m]');
    for (var i = 0; i < mpBtns.length; i++) {
        var m = mpBtns[i].getAttribute('data-m');
        if (modeMap[m]) {
            var svg = mpBtns[i].querySelector('svg');
            var extra = mpBtns[i].querySelector('span');
            var svgHtml = svg ? svg.outerHTML : '';
            var extraHtml = extra ? extra.outerHTML : '';
            if (m === 'image') {
                mpBtns[i].innerHTML = svgHtml + t(modeMap[m]) + ' ' + extraHtml;
            } else {
                mpBtns[i].innerHTML = svgHtml + t(modeMap[m]);
            }
        }
    }
    // Update "Mes modes" button
    var ct = document.getElementById('CUSTOM-TOGGLE');
    if (ct) {
        var svg = ct.querySelector('svg');
        var span = ct.querySelector('span');
        var svgH = svg ? svg.outerHTML : '';
        var spanH = span ? span.outerHTML : '';
        ct.innerHTML = svgH + t('mode_custom') + ' ' + spanH;
    }
}

// ETHER ENGINE v6 - Multi-provider: Gemini + Groq + Cerebras
// Cles API = UNIQUEMENT dans main.js (jamais exposees au renderer)

// Defaults — seront remplacés par les valeurs de main.js via IPC au boot
var GROQ_MODELS = { main: 'llama-3.3-70b-versatile', reasoning: 'qwen/qwen3-32b', fast: 'llama-3.1-8b-instant' };
var GEMINI_MODELS = { main: 'gemini-2.5-flash', fast: 'gemini-2.5-flash-lite' };
var CEREBRAS_MODELS = { main: 'qwen-3-235b-a22b-instruct-2507', fast: 'llama3.1-8b' };

// Provider availability tracking
var providerStatus = { groq: true, gemini: true, cerebras: true };

// getSmartRoute et getSmartModel sont definis dans engine.js (routing intelligent)

if (window.etherDesktop) { window.etherDesktop.getModels().then(function(m) { if (m && m.groq) { GROQ_MODELS = m.groq; GEMINI_MODELS = m.gemini; CEREBRAS_MODELS = m.cerebras; } else if (m) { GROQ_MODELS = m; } }); }
var activeModel = null;
var apiAvailable = false;

// === ETHER — Logo & Wave Animations ===

// === LOGO ABSTRAIT ANIME (cristal geometrique rouge) ===
var logoList = [];
var logoThinking = false;

function getLogoColor() {
    var t = document.documentElement.getAttribute('data-theme') || 'dark';
    var m = { dark: '#c94a3f', light: '#c94a3f', midnight: '#7c5cf8', ocean: '#0d9de6', forest: '#1eb854', sunset: '#f59e0b', rose: '#ec4899', arctic: '#3b82f6' };
    return m[t] || '#e74c3c';
}

function drawLogo(cv, frame, isThinking) {
    var ctx = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    var cx = w / 2, cy = h / 2;
    var R = Math.min(w, h) * 0.43;
    var color = getLogoColor();
    var cr = parseInt(color.slice(1, 3), 16);
    var cg = parseInt(color.slice(3, 5), 16);
    var cb = parseInt(color.slice(5, 7), 16);
    ctx.clearRect(0, 0, w, h);
    var t = frame * (isThinking ? 0.025 : 0.008);
    var tp = isThinking ? (0.5 + Math.sin(frame * 0.1) * 0.5) : 0;
    ctx.save();
    ctx.translate(cx, cy);
    // Pentagones imbriques - dense et solide
    var layers = 6;
    var shrink = 0.78; // tres dense
    var lw = w > 100 ? 14 : w > 50 ? 9 : 3.5;
    for (var l = 0; l < layers; l++) {
        var lr = R * Math.pow(shrink, l);
        if (lr < 2) break;
        var rot = t * (l % 2 === 0 ? 1 : -0.7) + l * (Math.PI / 5);
        var alpha = 0.8 + l * 0.05 + tp * 0.15;
        if (alpha > 1) alpha = 1;
        var lineW = lw * (1 - l * 0.08);
        if (lineW < 2) lineW = 2;
        ctx.save();
        ctx.rotate(rot);
        ctx.beginPath();
        for (var i = 0; i < 5; i++) {
            var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            var x = Math.cos(a) * lr;
            var y = Math.sin(a) * lr;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        // Remplissage rouge entre les pentagones
        var fillAlpha = 0.25 - l * 0.03;
        if (fillAlpha < 0.08) fillAlpha = 0.08;
        ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (fillAlpha + tp * 0.05) + ')';
        ctx.fill();
        if (l === 0) {
        }
        // Contour
        ctx.strokeStyle = 'rgba(' + Math.min(cr + 40, 255) + ',' + cg + ',' + cb + ',' + (alpha + 0.1) + ')';
        ctx.lineWidth = lineW;
        ctx.lineJoin = 'round';
        ctx.stroke();
        // Points aux sommets (seulement couches 0 et 1)
        if (l < 2) {
            var dotR = (w > 50 ? 2.5 : 1.2) * (1 - l * 0.3);
            for (var i = 0; i < 5; i++) {
                var a = (i / 5) * Math.PI * 2 - Math.PI / 2;
                ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (alpha + 0.2) + ')';
                ctx.beginPath();
                ctx.arc(Math.cos(a) * lr, Math.sin(a) * lr, dotR, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
    // Triangle central
    var triR = R * Math.pow(shrink, layers) * 1.2;
    var triRot = -t * 1.5 + Math.PI / 10;
    ctx.save();
    ctx.rotate(triRot);
    ctx.beginPath();
    for (var i = 0; i < 3; i++) {
        var a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        var x = Math.cos(a) * triR;
        var y = Math.sin(a) * triR;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (0.7 + tp * 0.3) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + Math.min(cr + 60, 255) + ',' + Math.min(cg + 30, 255) + ',' + Math.min(cb + 30, 255) + ',' + (0.8 + tp * 0.2) + ')';
    ctx.lineWidth = w > 50 ? 1 : 0.5;
    ctx.stroke();
    ctx.restore();
    // Glow thinking
    if (isThinking) {
        var gl = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.2);
        gl.addColorStop(0, 'rgba(' + cr + ',' + cg + ',' + cb + ',' + (tp * 0.15) + ')');
        gl.addColorStop(1, 'transparent');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function addLogo(cv) { logoList.push({ cv: cv, frame: 0 }); }
function animLogos() {
    for (var i = 0; i < logoList.length; i++) {
        var l = logoList[i];
        if (l.cv && l.cv.parentNode) { drawLogo(l.cv, l.frame, logoThinking); l.frame++; }
    }
    requestAnimationFrame(animLogos);
}
animLogos();

function initLoginWave() { var c = document.getElementById('login-wv'); if (c) addLogo(c); }
function initAppWaves() { var c1 = document.getElementById('logo-wv'); if (c1) addLogo(c1); var c2 = document.getElementById('welc-wv'); if (c2) addLogo(c2); }
function updateWaveColors() { /* colors are read dynamically in drawLogo */ }
function addMsgWave(el) { var cv = document.createElement('canvas'); cv.width = 28; cv.height = 28; el.appendChild(cv); addLogo(cv); }
function getGreeting() { var h = new Date().getHours(); return (h >= 17 || h < 6) ? t('greeting_evening') : t('greeting_morning'); }
initLoginWave();


