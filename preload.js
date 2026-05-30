var contextBridge = require('electron').contextBridge;
var ipcRenderer = require('electron').ipcRenderer;

// === Listeners tracking pour eviter les fuites memoire ===
var _chunkListeners = [];
var _doneListeners = [];

// Whitelist des canaux IPC autorises (defense en profondeur)
var ALLOWED_CHANNELS = [
    'groq-chat', 'groq-stream', 'groq-test', 'groq-stop',
    'gemini-chat', 'gemini-stream', 'cerebras-chat', 'cerebras-stream',
    'test-all-providers', 'transcribe-audio', 'pollinations-chat', 'fetch-image', 'fetch-url-content', 'gemini-vision',
    'web-search', 'get-models', 'open-file', 'save-file', 'browse-folder',
    'read-file', 'install-update', 'set-groq-key', 'get-groq-key-status',
    'quota-check', 'quota-use', 'quota-ad-bonus', 'quota-verify-pro',
    'persist-read', 'persist-write', 'persist-get', 'persist-set',
    'get-user-data-path', 'get-system-theme', 'open-external',
    'send-email', 'set-api-key', 'get-api-port', 'get-local-ip', 'set-network-mode'
];

function safeInvoke(channel, data) {
    if (ALLOWED_CHANNELS.indexOf(channel) === -1) {
        return Promise.reject(new Error('IPC channel not allowed: ' + channel));
    }
    return ipcRenderer.invoke(channel, data);
}

contextBridge.exposeInMainWorld('etherDesktop', {
    // === IA (cles securisees dans main.js) ===
    groqChat: function(data) { return safeInvoke('groq-chat', data); },
    groqStream: function(data) { return safeInvoke('groq-stream', data); },
    groqTest: function() { return safeInvoke('groq-test'); },
    groqStop: function() { return safeInvoke('groq-stop'); },
    geminiChat: function(data) { return safeInvoke('gemini-chat', data); },
    geminiStream: function(data) { return safeInvoke('gemini-stream', data); },
    cerebrasChat: function(data) { return safeInvoke('cerebras-chat', data); },
    cerebrasStream: function(data) { return safeInvoke('cerebras-stream', data); },
    testAllProviders: function() { return safeInvoke('test-all-providers'); },
    transcribeAudio: function(buffer) { return safeInvoke('transcribe-audio', buffer); },
    fetchUrlContent: function(url) { return safeInvoke('fetch-url-content', url); },
    geminiVision: function(data) { return safeInvoke('gemini-vision', data); },
    pollinationsChat: function(data) { return safeInvoke('pollinations-chat', data); },
    fetchImage: function(url) { return safeInvoke('fetch-image', url); },
    webSearch: function(query) { return safeInvoke('web-search', query); },
    getModels: function() { return safeInvoke('get-models'); },

    // Ecouter les chunks de streaming — avec tracking pour cleanup
    onChunk: function(callback) {
        var wrapped = function(event, chunk) { callback(chunk); };
        _chunkListeners.push(wrapped);
        ipcRenderer.on('groq-chunk', wrapped);
    },
    onDone: function(callback) {
        var wrapped = function(event, fullText) { callback(fullText); };
        _doneListeners.push(wrapped);
        ipcRenderer.on('groq-done', wrapped);
    },
    removeStreamListeners: function() {
        // Nettoyer proprement chaque listener individuellement
        for (var i = 0; i < _chunkListeners.length; i++) {
            ipcRenderer.removeListener('groq-chunk', _chunkListeners[i]);
        }
        for (var j = 0; j < _doneListeners.length; j++) {
            ipcRenderer.removeListener('groq-done', _doneListeners[j]);
        }
        _chunkListeners = [];
        _doneListeners = [];
    },

    // === Fichiers ===
    openFile: function() { return safeInvoke('open-file'); },
    saveFile: function(data) { return safeInvoke('save-file', data); },
    browseFolder: function() { return safeInvoke('browse-folder'); },
    readFile: function(filePath) { return safeInvoke('read-file', filePath); },

    // === Auto-updater ===
    installUpdate: function() { return safeInvoke('install-update'); },
    onUpdateAvailable: function(cb) { ipcRenderer.on('update-available', function(e, v) { cb(v); }); },
    onUpdateDownloaded: function(cb) { ipcRenderer.on('update-downloaded', function(e, v) { cb(v); }); },

    // === Config API securisee ===
    setGroqKey: function(key) { return safeInvoke('set-groq-key', key); },
    getGroqKeyStatus: function() { return safeInvoke('get-groq-key-status'); },

    // === Quotas securises ===
    quotaCheck: function(key) { return safeInvoke('quota-check', key); },
    quotaUse: function(key) { return safeInvoke('quota-use', key); },
    quotaAdBonus: function(key, bonus) { return ipcRenderer.invoke('quota-ad-bonus', key, bonus); },
    quotaVerifyPro: function() { return safeInvoke('quota-verify-pro'); },

    // === Memoire persistante ===
    persistRead: function() { return safeInvoke('persist-read'); },
    persistWrite: function(data) { return safeInvoke('persist-write', data); },
    persistGet: function(key) { return safeInvoke('persist-get', key); },
    persistSet: function(key, value) { return ipcRenderer.invoke('persist-set', key, value); },
    getUserDataPath: function() { return safeInvoke('get-user-data-path'); },

    // === Modes / Skills ===
    modesList: function() { return safeInvoke('modes-list'); },
    modeSave: function(mode) { return safeInvoke('mode-save', mode); },
    modeDelete: function(id) { return safeInvoke('mode-delete', id); },

    // === Theme systeme ===
    getSystemTheme: function() { return safeInvoke('get-system-theme'); },
    onSystemThemeChanged: function(callback) { ipcRenderer.on('system-theme-changed', function(event, theme) { callback(theme); }); },

    // === Notifications ===
    onFocusState: function(callback) {
        ipcRenderer.on('window-focus', function() { callback(true); });
        ipcRenderer.on('window-blur', function() { callback(false); });
    },

    // === Divers ===
    openExternal: function(url) {
        // Valider l'URL cote renderer aussi (defense en profondeur)
        if (!url || typeof url !== 'string') return Promise.resolve();
        if (!/^https?:\/\//.test(url) && !/^mailto:/.test(url)) return Promise.resolve();
        return safeInvoke('open-external', url);
    },
    sendEmail: function(data) { return safeInvoke('send-email', data); },
    setApiKey: function(key) { return safeInvoke('set-api-key', key); },
    getApiPort: function() { return safeInvoke('get-api-port'); },
    getLocalIp: function() { return safeInvoke('get-local-ip'); },
    setNetworkMode: function(enabled) { return safeInvoke('set-network-mode', enabled); },

    isDesktop: true
});
