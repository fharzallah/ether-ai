// === ETHER — UI (messages, images, code blocks, export) ===

function scr(){var mg=G('MG');setTimeout(function(){mg.scrollTop=mg.scrollHeight;},50);}


function showThink(){thinking=true;logoThinking=true;var d=document.createElement('div');d.className='thi';d.id='THI';d.innerHTML='<div class="mav"></div><div class="thb"><div class="thd"><div class="thdd"></div><div class="thdd"></div><div class="thdd"></div></div><span class="tht">'+ETHER_ENGINE.getThinkingText()+'</span></div>';G('MG').appendChild(d);var av=d.querySelector('.mav');if(av)addMsgWave(av);scr();}
function hideThink(){thinking=false;logoThinking=false;var e=G('THI');if(e&&e.parentNode)e.parentNode.removeChild(e);}

function sendMsg(text){
    var hasFiles = stagedFiles && stagedFiles.length > 0;
    if((!text||!text.trim())&&!hasFiles||thinking)return;
    if (!canSendMessage()) {
        showQuotaExhausted();
        return;
    }
    var message=(text||'').trim(); uiEl.value=''; uiEl.style.height='auto'; sndEl.disabled=true;
    useDaily('msg');
    updQuotaUI();
    // Si un type de document est en attente, generer le document
    if(pendingDocFormat){
        var fmt=pendingDocFormat;
        pendingDocFormat=null;
        uiEl.placeholder='Envoie un message...';
        var badge=G('DOC-BADGE'); if(badge)badge.classList.add('hidden');
        addUserMsg('Genere un document '+fmt+' : '+message);
        genDoc(fmt, message);
        return;
    }
    var ws=G('WS'); if(ws&&ws.parentNode)ws.parentNode.removeChild(ws);
    if(!curConv&&!isEphemeral){
        curConv='c'+Date.now();
        convs[curConv]={title:(message||'Fichier joint').substring(0,45),messages:[],projectId:curProj,ts:new Date().toISOString()};
        sSet('convs',convs); updHist();
    }

    // Detecter si une IMAGE est staged → envoyer a Gemini Vision directement
    if (hasFiles && stagedFiles.some(function(f) { return f.isImage; }) && window.etherDesktop && window.etherDesktop.geminiVision) {
        var imgFile = null;
        for (var si = 0; si < stagedFiles.length; si++) {
            if (stagedFiles[si].isImage) { imgFile = stagedFiles[si]; break; }
        }
        if (imgFile) {
            // Attendre que le dataUrl soit pret (FileReader async)
            function processImage() {
                if (!imgFile.dataUrl) {
                    setTimeout(processImage, 100);
                    return;
                }
                var rawBase64 = imgFile.dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
                var imgMime = 'image/jpeg';
                var mimeMatch = imgFile.dataUrl.match(/^data:(image\/[^;]+);/);
                if (mimeMatch) imgMime = mimeMatch[1];

                // Afficher l'image dans le chat
            var imgMsg = document.createElement('div'); imgMsg.className = 'msg u';
            imgMsg.innerHTML = '<div class="mb"><img src="' + imgFile.dataUrl + '" style="max-width:220px;border-radius:12px;display:block;margin-bottom:6px"><span style="font-size:.78rem;color:rgba(255,255,255,.7)">' + esc(imgFile.name) + '</span>' + (message ? '<div style="margin-top:6px">' + esc(message) + '</div>' : '') + '</div>';
            G('MG').appendChild(imgMsg);
            if (curConv && !isEphemeral) convs[curConv].messages.push({ r: 'u', t: (message || '') + ' [Image: ' + imgFile.name + ']', ts: Date.now() });
            clearStagedFiles();
            showThink();
            window.etherDesktop.geminiVision({
                base64: rawBase64,
                mime: imgMime,
                prompt: message || 'Analyse cette image en detail. Decris ce que tu vois.',
                systemPrompt: 'Tu es ETHER AI. Analyse cette image avec precision. Decris ce que tu vois, identifie les elements importants, donne du contexte si possible. Reponds en Markdown.'
            }).then(function(vRes) {
                hideThink();
                if (vRes.ok && vRes.text) {
                    var cleanText = (vRes.text || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                    var result = ETHER_ENGINE.parseResponse(cleanText);
                    result._provider = 'gemini-vision';
                    result._noSuggestions = false;
                    addAIMsg(result);
                    ETHER_ENGINE.conversationHistory.push({ role: 'user', content: message || 'Analyse cette image' });
                    ETHER_ENGINE.conversationHistory.push({ role: 'assistant', content: cleanText });
                    if (curConv && !isEphemeral) { convs[curConv].messages.push({ r: 'a', d: result, ts: Date.now() }); sSet('convs', convs); }
                    scr();
                } else {
                    addAIMsg({ reasoning: null, answer: '<p><strong>L\'analyse d\'image a echoue.</strong> Reessaie ou decris l\'image manuellement.</p>', confidence: 'unverified', sources: [], _showBadge: false, _noSuggestions: true });
                }
            })['catch'](function() {
                hideThink();
                addAIMsg({ reasoning: null, answer: '<p><strong>Erreur d\'analyse d\'image.</strong> Le service est temporairement indisponible.</p>', confidence: 'unverified', sources: [], _showBadge: false, _noSuggestions: true });
            });
            }
            processImage();
            return;
        }
    }

    // Traiter les fichiers staged (non-images) s'il y en a
    var actualPrompt = message;
    if(hasFiles){
        actualPrompt = processStagedFiles(message);
    }

    // Detecter les URLs dans le message → fetch et injecter le contenu
    var urlMatch = message.match(/https?:\/\/[^\s<>"]+/);
    if (urlMatch && window.etherDesktop && window.etherDesktop.fetchUrlContent) {
        if(message) addUserMsg(message);
        if(curConv&&!isEphemeral) convs[curConv].messages.push({r:'u',t:message,ts:Date.now()});
        showThink();
        window.etherDesktop.fetchUrlContent(urlMatch[0]).then(function(page) {
            hideThink();
            if (page.ok && page.text) {
                var urlPrompt = message.replace(urlMatch[0], '').trim();
                if (!urlPrompt || urlPrompt.length < 3) urlPrompt = 'Resume cette page web de maniere structuree et detaillee';
                actualPrompt = urlPrompt + '\n\n--- CONTENU DE LA PAGE: ' + (page.title || urlMatch[0]) + ' ---\n' + page.text.substring(0, 6000);
                // Indexer dans le RAG
                if (typeof ragIndexUploadedFile === 'function') {
                    ragIndexUploadedFile({ name: page.title || urlMatch[0], content: page.text });
                }
            } else {
                actualPrompt = message;
            }
            showThink();
            doGenerate(actualPrompt);
        })['catch'](function() {
            doGenerate(message);
        });
        return;
    }

    if(message) addUserMsg(message);
    if(message&&curConv&&!isEphemeral) convs[curConv].messages.push({r:'u',t:message,ts:Date.now()});

    // Auto-detect image request
    var imgKw=['genere une image','genere moi une image','genere-moi une image','cree une image','dessine','fais une image','fais moi une image','generate an image','create an image','draw me'];
    var msgN=message.toLowerCase().replace(/[^\x00-\x7F]/g,'');
    var isImg=ETHER_ENGINE.currentMode==='image';
    if(!isImg){for(var ik=0;ik<imgKw.length;ik++){if(msgN.indexOf(imgKw[ik])!==-1){isImg=true;break;}}}

    if(isImg){
        var imgD=getImgCount();
        if(!isPro&&imgD.count>=5){addAIMsg({reasoning:null,answer:'<p><strong>Limite atteinte !</strong> 5 generations d\'images par jour en gratuit.</p><p style="font-size:.85rem;color:var(--t3)">Reviens demain ou passe au forfait Pro pour un acces illimite.</p>',confidence:'unverified',sources:[],_showBadge:false,_noSuggestions:true});return;}
        if(!isPro)useImg();
        // Person warning
        var realP=['poutine','putin','macron','trump','biden','musk','obama','merkel','zelensky','beyonce','ronaldo','messi','mbappe','zidane'];
        var warn='';
        for(var rp=0;rp<realP.length;rp++){if(message.toLowerCase().indexOf(realP[rp])!==-1){warn='<div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:.85rem;color:var(--t2)"><strong>Avertissement:</strong> La generation d\'images de personnes reelles est limitee par les modeles IA pour des raisons legales.</div>';break;}}
        showThink();
        generateImage(message, function(imgUrl) {
            hideThink();
            var remain = '';
            var imgId = 'img_' + Date.now();
            var resp = {
                reasoning: { analyste: 'Generation d\'image IA.', critique: 'Image generee par Pollinations AI (modele Flux).', synthese: 'Prompt optimise automatiquement.' },
                answer: warn
                    + '<p><strong>Image generee :</strong></p>'
                    + '<div id="' + imgId + '-wrap" style="margin:8px 0">'
                    + '<div id="' + imgId + '-loader" style="width:100%;max-width:512px;height:300px;background:var(--b3);border:1px solid var(--bd);border-radius:12px;display:flex;align-items:center;justify-content:center"><span style="color:var(--t3);font-size:.85rem">Chargement de l\'image...</span></div>'
                    + '<img id="' + imgId + '" data-url="' + esc(imgUrl) + '" style="max-width:100%;border-radius:12px;display:none;cursor:pointer">'
                    + '<div id="' + imgId + '-actions" style="display:none;margin-top:8px;display:none;gap:6px">'
                    + '<button class="btn-s" onclick="downloadImage(document.getElementById(\'' + imgId + '\').src)">Telecharger</button>'
                    + '<button class="btn-s" onclick="retryImg(\'' + imgId + '\')">Regenerer</button>'
                    + '</div></div>'
                    + '<p style="font-size:.8rem;color:var(--t3)">Prompt : <em>' + esc(message) + '</em></p>'
                    ,
                confidence: 'to-verify',
                sources: ['Pollinations AI'],
                _showBadge: false,
                _noSuggestions: true
            };
            addAIMsg(resp);
            // Charger l'image apres insertion dans le DOM
            setTimeout(function() { loadGenImage(imgId, imgUrl); }, 100);
            if (curConv && !isEphemeral) { convs[curConv].messages.push({ r: 'a', d: resp, ts: Date.now() }); sSet('convs', convs); }
            scr();
        });
        return;
    }

    // Normal mode
    doGenerate(actualPrompt);
}

function doGenerate(prompt) {
    showThink();

    // Construire les messages une seule fois
    var sysPrompt = ETHER_ENGINE.getSystemPrompt(false);
    if (typeof MEMORY !== 'undefined') sysPrompt += MEMORY.getPromptContext();
    if (typeof RAG !== 'undefined') sysPrompt += RAG.getContext(prompt);
    if (ETHER_ENGINE.conversationSummary) sysPrompt += '\n\nResume: ' + ETHER_ENGINE.conversationSummary;
    var msgs = [{ role: 'system', content: sysPrompt }];
    var recent = ETHER_ENGINE.conversationHistory.slice(-10);
    for (var ri = 0; ri < recent.length; ri++) msgs.push({ role: recent[ri].role === 'user' ? 'user' : 'assistant', content: recent[ri].content });
    msgs.push({ role: 'user', content: prompt });
    var reqData = { messages: msgs, temperature: 0.6, max_tokens: 4000 };

    // D'abord essayer le streaming normal (via generateResponse)
    ETHER_ENGINE.generateResponse(prompt).then(function(resp) {
        hideThink();
        if (!resp._streamed) addAIMsg(resp);
        sendNotif('ETHER AI', (resp.answer||'').replace(/<[^>]+>/g,'').substring(0,80));
        if (ETHER_ENGINE.currentMode === 'teacher') {
            trackTeacherSession(prompt); trackTeacherSessionV2(prompt, resp.answer||'');
            if (typeof TEACHER_MEMORY !== 'undefined' && !TEACHER_MEMORY.isCalibrated()) {
                TEACHER_MEMORY.analyzeCalibration(prompt, resp.answer||'');
            }
        }
        if (curConv && !isEphemeral) { convs[curConv].messages.push({ r: 'a', d: resp, ts: Date.now() }); sSet('convs', convs); }
        scr();
    })['catch'](function(err) {
        console.log('[UI] Streaming failed, trying emergency fallback cascade:', err && err.message);

        // === EMERGENCY FALLBACK CASCADE (non-streaming, incassable) ===
        var fallbacks = [
            { fn: window.etherDesktop.groqChat, model: GROQ_MODELS.main, name: 'Groq-Llama70B' },
            { fn: window.etherDesktop.groqChat, model: GROQ_MODELS.reasoning, name: 'Groq-Qwen32B' },
            { fn: window.etherDesktop.groqChat, model: GROQ_MODELS.fast, name: 'Groq-Llama8B' }
        ];

        function tryEmergency(idx) {
            if (idx >= fallbacks.length) {
                hideThink();
                addAIMsg({ reasoning: null, answer: '<p><strong>Tous les serveurs sont temporairement indisponibles.</strong> Reessaie dans quelques secondes.</p>', confidence: 'unverified', sources: [], _showBadge: false, _noSuggestions: true });
                return;
            }
            var fb = fallbacks[idx];
            console.log('[UI] Emergency fallback #' + (idx+1) + ': ' + fb.name);
            reqData.model = fb.model;
            fb.fn(reqData).then(function(r) {
                if (r.ok && r.text) {
                    hideThink();
                    var ct = (r.text || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
                    ETHER_ENGINE.conversationHistory.push({ role: 'user', content: prompt });
                    ETHER_ENGINE.conversationHistory.push({ role: 'assistant', content: ct });
                    var result = ETHER_ENGINE.parseResponse(ct);
                    result._model = fb.model;
                    result._provider = fb.name;
                    addAIMsg(result);
                    if (curConv && !isEphemeral) { convs[curConv].messages.push({ r: 'a', d: result, ts: Date.now() }); sSet('convs', convs); }
                    scr();
                } else {
                    tryEmergency(idx + 1);
                }
            })['catch'](function() {
                tryEmergency(idx + 1);
            });
        }
        tryEmergency(0);
    });
}

// === DEEP THINK (Reflexion approfondie) — 3/jour ===
var DEEP_THINK_LIMIT = 3;

function getDeepThinkCount() {
    var d = sGet('deep_think', { date: '', count: 0 });
    var today = new Date().toISOString().slice(0, 10);
    if (d.date !== today) return { date: today, count: 0 };
    return d;
}

function useDeepThink() {
    var d = getDeepThinkCount();
    d.count++;
    sSet('deep_think', d);
    updDeepThinkBtn();
}

function getDeepThinkRemaining() {
    return Math.max(0, DEEP_THINK_LIMIT - getDeepThinkCount().count);
}

function updDeepThinkBtn() {
    var btn = G('DEEP-BTN');
    if (!btn) return;
    var badge = btn.querySelector('.deep-count');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'deep-count';
        btn.appendChild(badge);
    }
    if (isPro) {
        badge.textContent = '∞';
        badge.style.color = '#f59e0b';
        btn.style.opacity = '1';
    } else {
        var remaining = getDeepThinkRemaining();
        badge.textContent = remaining;
        badge.style.color = remaining === 0 ? '#ef4444' : '#f59e0b';
        btn.style.opacity = remaining === 0 ? '0.4' : '1';
    }
}

function sendDeepThink() {
    var text = uiEl.value.trim();
    if (!text || thinking) return;

    var remaining = getDeepThinkRemaining();
    if (!isPro && remaining <= 0) {
        addAIMsg({
            reasoning: null,
            answer: '<p><strong>Reflexion approfondie epuisee pour aujourd\'hui.</strong></p><p>Tu as utilise tes 3 reflexions approfondies du jour. Elles se rechargent a minuit.</p><p style="font-size:.85rem;color:var(--t3)">En attendant, tu peux poser ta question normalement — ETHER repondra avec le mode standard.</p>',
            confidence: 'unverified', sources: [], _showBadge: false, _noSuggestions: true
        });
        scr();
        return;
    }

    var message = text;
    uiEl.value = '';
    uiEl.style.height = 'auto';
    sndEl.disabled = true;

    var ws = G('WS'); if (ws && ws.parentNode) ws.parentNode.removeChild(ws);
    if (!curConv && !isEphemeral) {
        curConv = 'c' + Date.now();
        convs[curConv] = { title: message.substring(0, 45), messages: [], projectId: curProj, ts: new Date().toISOString() };
        sSet('convs', convs); updHist();
    }

    addUserMsg(message);
    if (curConv && !isEphemeral) convs[curConv].messages.push({ r: 'u', t: message, ts: Date.now() });

    if (!isPro) useDeepThink();
    thinking = true;
    ETHER_ENGINE.deepThink(message).then(function() {
        thinking = false;
    })['catch'](function() {
        thinking = false;
    });
}

// Bouton Deep Think
if (G('DEEP-BTN')) {
    G('DEEP-BTN').onclick = function() {
        sendDeepThink();
    };
    updDeepThinkBtn();
}

// IMAGE GENERATION — multi-taille, multi-style

var IMG_SIZES = {
    square: { w: 1024, h: 1024, label: '1:1' },
    landscape: { w: 1344, h: 768, label: '16:9' },
    portrait: { w: 768, h: 1344, label: '9:16' },
    wide: { w: 1536, h: 640, label: 'Ultra-wide' }
};
var IMG_STYLES = {
    none: '',
    photo: ', photorealistic, 8k, professional photography',
    anime: ', anime style, vibrant colors, detailed',
    painting: ', oil painting, artistic, masterpiece',
    sketch: ', pencil sketch, hand-drawn, detailed linework',
    '3d': ', 3D render, octane render, volumetric lighting'
};
var currentImgSize = 'square';
var currentImgStyle = 'none';

function generateImage(prompt, callback) {
    var seed = Math.floor(Math.random() * 99999);
    var size = IMG_SIZES[currentImgSize] || IMG_SIZES.square;
    var styleSuffix = IMG_STYLES[currentImgStyle] || '';
    var called = false;

    function buildUrl(p) {
        return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(p) + '?width=' + size.w + '&height=' + size.h + '&nologo=true&seed=' + seed + '&model=flux';
    }

    function doCallback(url) {
        if (called) return;
        called = true;
        callback(url, seed);
    }

    if (window.etherDesktop) {
        // Timeout: si Groq ne repond pas en 8s, on envoie directement
        var timeout = setTimeout(function() {
            doCallback(buildUrl(prompt + styleSuffix));
        }, 8000);

        window.etherDesktop.groqChat({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: 'Translate and optimize this image generation prompt to English. Return ONLY the optimized prompt, nothing else. Keep it under 200 characters. Make it descriptive and visual.' + (styleSuffix ? ' Add style hint: ' + styleSuffix : '') },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 100
        }).then(function(res) {
            clearTimeout(timeout);
            var ep = prompt;
            if (res.ok && res.text && res.text.length > 3 && res.text.length < 300) {
                ep = res.text.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\n/g, ' ').trim();
            }
            ep += styleSuffix;
            doCallback(buildUrl(ep));
        })['catch'](function() {
            clearTimeout(timeout);
            doCallback(buildUrl(prompt + styleSuffix));
        });
    } else {
        doCallback(buildUrl(prompt + styleSuffix));
    }
}

function setImgSize(size, btn) {
    currentImgSize = size;
    var siblings = G('IMG-OPTIONS').querySelectorAll('[data-imgsize]');
    for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove('on');
    if (btn) btn.classList.add('on');
}
function setImgStyle(style, btn) {
    currentImgStyle = style;
    var siblings = G('IMG-OPTIONS').querySelectorAll('[data-imgstyle]');
    for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove('on');
    if (btn) btn.classList.add('on');
}

// Charger une image generee avec retry automatique + cache base64
function loadGenImage(imgId, imgUrl, attempt) {
    attempt = attempt || 0;
    var img = document.getElementById(imgId);
    var loader = document.getElementById(imgId + '-loader');
    var actions = document.getElementById(imgId + '-actions');
    if (!img) return;

    img.onload = function() {
        img.style.display = 'block';
        img.style.cursor = 'pointer';
        img.onclick = function() { openImagePreview(img.src); };
        if (loader) loader.style.display = 'none';
        if (actions) { actions.style.display = 'flex'; }
        // Cacher l'image en base64 pour un acces instantane plus tard
        cacheImageBase64(imgUrl);
    };
    img.onerror = function() {
        if (attempt < 3) {
            var delay = (attempt + 1) * 3000;
            if (loader) {
                var span = loader.querySelector('span');
                if (span) span.textContent = 'Generation en cours... (tentative ' + (attempt + 2) + '/4)';
            }
            setTimeout(function() {
                loadGenImage(imgId, imgUrl + '&retry=' + (attempt + 1), attempt + 1);
            }, delay);
        } else {
            if (loader) loader.innerHTML = '<div style="text-align:center;padding:16px"><p style="color:var(--t3);margin-bottom:10px">L\'image n\'a pas pu etre generee.</p><button class="btn-s" onclick="retryImg(\'' + imgId + '\')">Reessayer</button></div>';
        }
    };
    img.src = imgUrl;
}

// Cache d'images en base64 (stocke dans la conv active)
function cacheImageBase64(imgUrl) {
    if (!window.etherDesktop || !window.etherDesktop.fetchImage) return;
    if (!curConv || !convs[curConv]) return;
    // Verifier si deja cache
    var msgs = convs[curConv].messages;
    for (var i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].r === 'a' && msgs[i].d && msgs[i].d._imgCache) return; // deja cache
    }
    window.etherDesktop.fetchImage(imgUrl).then(function(res) {
        if (!res.ok || !res.base64) return;
        // Stocker dans le dernier message IA de la conv
        var msgs = convs[curConv] ? convs[curConv].messages : [];
        for (var i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].r === 'a' && msgs[i].d && msgs[i].d.answer && msgs[i].d.answer.indexOf('pollinations') !== -1) {
                msgs[i].d._imgCache = 'data:' + res.mime + ';base64,' + res.base64;
                sSet('convs', convs);
                break;
            }
        }
    })['catch'](function() {});
}

// Recuperer l'image cachee d'une conversation
function getCachedImage(cid) {
    if (!convs[cid]) return null;
    var msgs = convs[cid].messages;
    for (var i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].r === 'a' && msgs[i].d && msgs[i].d._imgCache) {
            return msgs[i].d._imgCache;
        }
    }
    return null;
}

// Restaurer les images Pollinations dans un message recharge
function restorePollinationsImages(msgEl) {
    if (!msgEl) return;
    var images = msgEl.querySelectorAll('img[data-url]');
    // Chercher le cache base64 dans la conversation active
    var cached = curConv ? getCachedImage(curConv) : null;

    for (var i = 0; i < images.length; i++) {
        (function(img) {
            var url = img.getAttribute('data-url');
            if (!url) return;
            var imgId = img.id;
            if (img.style.display === 'none' || !img.src) {
                if (!imgId) {
                    imgId = 'img_restore_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                    img.id = imgId;
                }
                var loader = document.getElementById(imgId + '-loader');
                var actions = document.getElementById(imgId + '-actions');

                img.onload = function() {
                    img.style.display = 'block';
                    img.style.cursor = 'pointer';
                    img.onclick = function() { openImagePreview(img.src); };
                    if (loader) loader.style.display = 'none';
                    if (actions) actions.style.display = 'flex';
                };
                img.onerror = function() {
                    // Cache rate et URL expiree — tenter l'URL originale si on etait sur le cache
                    if (cached && img.src === cached) {
                        img.src = url; // fallback URL
                        return;
                    }
                    if (loader) {
                        loader.innerHTML = '<div style="text-align:center;padding:16px">'
                            + '<svg viewBox="0 0 24 24" width="40" height="40" style="color:var(--t3);margin-bottom:8px"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/></svg>'
                            + '<p style="color:var(--t3);font-size:.82rem;margin-bottom:10px">Image expiree</p>'
                            + '<button class="btn-s" onclick="retryImg(\'' + imgId + '\')">Regenerer</button>'
                            + '</div>';
                    }
                };
                // Utiliser le cache base64 si disponible (instantane), sinon l'URL
                img.src = cached || url;
            } else if (img.src && img.complete) {
                img.style.cursor = 'pointer';
                img.onclick = function() { openImagePreview(img.src); };
            }
        })(images[i]);
    }
}

// Preview plein ecran d'une image
function openImagePreview(imgSrc) {
    if (!imgSrc) return;
    var overlay = document.createElement('div');
    overlay.className = 'img-preview-overlay';
    overlay.innerHTML = '<div class="img-preview-content">'
        + '<img src="' + escAttr(imgSrc) + '" class="img-preview-img">'
        + '<div class="img-preview-actions">'
        + '<button class="btn-s" onclick="downloadImage(\'' + escAttr(imgSrc) + '\')"><svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;margin-right:4px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>Telecharger</button>'
        + '<button class="btn-s" onclick="this.closest(\'.img-preview-overlay\').remove()">Fermer</button>'
        + '</div></div>';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// Regenerer une image
function retryImg(imgId) {
    var img = document.getElementById(imgId);
    if (!img) return;
    var origUrl = img.getAttribute('data-url');
    if (!origUrl) return;
    var loader = document.getElementById(imgId + '-loader');
    var actions = document.getElementById(imgId + '-actions');
    img.style.display = 'none';
    if (loader) { loader.style.display = 'flex'; loader.innerHTML = '<span style="color:var(--t3);font-size:.85rem">Regeneration...</span>'; }
    if (actions) actions.style.display = 'none';
    // Nouveau seed
    var newUrl = origUrl.replace(/&seed=\d+/, '&seed=' + Math.floor(Math.random() * 99999));
    img.setAttribute('data-url', newUrl);
    loadGenImage(imgId, newUrl, 0);
}

function downloadImage(imgUrl) {
    // Valider l'URL avant le telechargement
    if (!imgUrl || typeof imgUrl !== 'string') return;
    if (!/^https?:\/\//.test(imgUrl) && !/^data:image\//.test(imgUrl) && !/^blob:/.test(imgUrl)) return;
    var a = document.createElement('a');
    a.href = imgUrl;
    a.download = 'ether-image-' + Date.now() + '.png';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { if (a.parentNode) document.body.removeChild(a); }, 100);
}

function regenerateImage(imgEl, prompt) {
    var seed = Math.floor(Math.random() * 99999);
    var size = IMG_SIZES[currentImgSize] || IMG_SIZES.square;
    var oldSrc = imgEl.src;
    imgEl.style.opacity = '0.5';
    imgEl.src = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=' + size.w + '&height=' + size.h + '&nologo=true&seed=' + seed + '&model=flux';
    imgEl.onload = function() { imgEl.style.opacity = '1'; };
    imgEl.onerror = function() { imgEl.src = oldSrc; imgEl.style.opacity = '1'; };
}

// IMAGE COUNT
function getImgCount(){var d=sGet('imgcount',{date:'',count:0});var n=new Date();var today=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');if(d.date!==today)return{date:today,count:0};return d;}
function useImg(){var d=getImgCount();d.count++;sSet('imgcount',d);updImgCount();}
function updImgCount(){var d=getImgCount();var r=isPro?'':Math.max(0,5-d.count)+'/5';G('IMG-CT').textContent=r?'('+r+')':'';}

// ADD MESSAGES

function addUserMsg(text){
    var d=document.createElement('div');d.className='msg u';var et=esc(text);var eat=escAttr(text);
    var bgStyle=isEphemeral?' style="background:#b45309"':'';
    d.innerHTML='<div class="mb"'+bgStyle+'>'+et+'</div><div class="uma"><button class="mab" data-t="'+eat+'" title="Copier" onclick="cpTxt(this)"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg></button><button class="mab" data-t="'+eat+'" title="Modifier" onclick="edPr(this)"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg></button></div>';
    G('MG').appendChild(d); scr();
}
function addAIMsg(resp){
    var d=document.createElement('div');d.className='msg a';
    d._etherData=resp;
    if(isEphemeral) d.style.borderLeft='3px solid #f59e0b';
    var rh='';
    if(resp.reasoning){var keys=['analyste','critique','synthese'];var ah='';for(var i=0;i<keys.length;i++){var k=keys[i];ah+='<div class="ra"><div class="an">'+ETHER_ENGINE.agents[k].name+'</div><div>'+(resp.reasoning[k]||'')+'</div></div>';}rh='<button class="rt" onclick="togR(this)"><span class="ar">&#9654;</span> '+t('reasoning')+'</button><div class="rc">'+ah+'</div>';}
    var pt=(resp.answer||'').replace(/<[^>]+>/g,'');
    var ptAttr=escAttr(pt);
    d.innerHTML='<div class="mav"></div><div class="mbd">'+rh+'<div class="mt">'+sanitizeHTML(resp.answer||'')+'</div><div class="ma"><button class="regen-btn" onclick="regenResponse(this)" title="Regenerer"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>'+t('btn_regen')+'</button><button class="mab" onclick="vote(this)" title="Bien"><svg viewBox="0 0 24 24"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a4.8 4.8 0 00-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84A2.33 2.33 0 009.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" fill="currentColor"/></svg></button><button class="mab" onclick="vote(this)" title="Pas bien"><svg viewBox="0 0 24 24"><path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h5.5l-.92 4.65c-.05.22-.02.46.08.66.23.45.52.86.88 1.22L10 22l6.41-6.41c.38-.38.59-.89.59-1.42V6.34A2.33 2.33 0 0014.66 4H6.56c-.71 0-1.37.37-1.73.97L2.17 11.12z" fill="currentColor"/></svg></button><button class="mab" data-t="'+ptAttr+'" onclick="cpTxt(this)" title="Copier"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg></button><button class="mab" data-t="'+ptAttr+'" onclick="speakText(this.getAttribute(\'data-t\'))" title="Ecouter"><svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.47 4.47 0 002.5-3.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg></button></div></div>';
    G('MG').appendChild(d); var av=d.querySelector('.mav'); if(av)addMsgWave(av);
    processCodeBlocks(d);
    // Restaurer les images Pollinations (quand on recharge une conversation)
    restorePollinationsImages(d);
    scr();
    // Verification anti-hallucination (apres affichage, non-bloquant)
    if(window.etherDesktop && resp.answer && !resp._noSuggestions && !resp._skipVerify && typeof verifyResponse === 'function') {
        verifyResponse(resp.answer, d);
    }
    // Generate follow-up suggestions for non-streamed messages
    if(window.etherDesktop && resp.answer && !resp._noSuggestions) generateFollowUpSuggestions(resp.answer, null);
}

// MSG ACTIONS

function togR(btn){btn.classList.toggle('op');var n=btn.nextElementSibling;if(n)n.classList.toggle('vis');}
function vote(btn){var bs=btn.parentNode.querySelectorAll('.mab');for(var i=0;i<bs.length;i++)bs[i].classList.remove('vd');btn.classList.add('vd');}
function cpTxt(btn){
    var msgEl = btn.closest('.msg') || btn.closest('.mbd');
    var textEl = msgEl ? msgEl.querySelector('.mt') : null;
    var txt = '';
    if (textEl) {
        // Cloner le noeud pour ne pas modifier l'original
        var clone = textEl.cloneNode(true);
        // Supprimer les boutons et elements non-texte du clone
        var toRemove = clone.querySelectorAll('button, .ma, .cb, .sr, .rt, .rc, .follow-suggestions');
        for (var r = 0; r < toRemove.length; r++) toRemove[r].remove();
        txt = clone.innerText || clone.textContent || '';
    }
    if (!txt) {
        txt = (btn.getAttribute('data-t') || '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    }
    if (!txt || !txt.trim()) return;

    // Copier avec fallback
    var success = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt.trim()).then(function() {
            showCopyFeedback(btn);
        })['catch'](function() {
            fallbackCopy(txt.trim(), btn);
        });
        return;
    }
    fallbackCopy(txt.trim(), btn);
}

function fallbackCopy(text, btn) {
    // Fallback via textarea cachee
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showCopyFeedback(btn);
    } catch(e) {}
    document.body.removeChild(ta);
}

function showCopyFeedback(btn) {
    if (!btn) return;
    var old = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>';
    btn.style.color = '#22c55e';
    setTimeout(function(){ btn.innerHTML = old; btn.style.color = ''; }, 1500);
}
function edPr(btn){
    var t=(btn.getAttribute('data-t')||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    // Trouver le message utilisateur parent
    var userMsg=btn.closest('.msg.u');
    if(userMsg){
        // Trouver et supprimer la reponse IA correspondante (le prochain .msg.a)
        var nextEl=userMsg.nextElementSibling;
        while(nextEl && !nextEl.classList.contains('a') && !nextEl.classList.contains('u')) nextEl=nextEl.nextElementSibling;
        if(nextEl && nextEl.classList.contains('a')) {
            nextEl.remove();
            // Supprimer du stockage
            if(curConv && convs[curConv] && convs[curConv].messages.length > 0){
                var lastMsg=convs[curConv].messages[convs[curConv].messages.length-1];
                if(lastMsg.r==='a'){convs[curConv].messages.pop();}
            }
            // Supprimer de l'historique engine
            if(ETHER_ENGINE.conversationHistory.length>=2){
                ETHER_ENGINE.conversationHistory.pop();
            }
        }
        // Supprimer le message utilisateur
        userMsg.remove();
        if(curConv && convs[curConv] && convs[curConv].messages.length > 0){
            var lastU=convs[curConv].messages[convs[curConv].messages.length-1];
            if(lastU.r==='u'){convs[curConv].messages.pop();}
        }
        if(ETHER_ENGINE.conversationHistory.length>=1){
            var lastH=ETHER_ENGINE.conversationHistory[ETHER_ENGINE.conversationHistory.length-1];
            if(lastH.role==='user'){ETHER_ENGINE.conversationHistory.pop();}
        }
        if(curConv) sSet('convs',convs);
    }
    uiEl.value=t;uiEl.focus();sndEl.disabled=false;
}
var _bestVoice = null;
var _voicesLoaded = false;

function loadBestVoice() {
    if (_voicesLoaded) return;
    var voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    _voicesLoaded = true;
    var langCode = getLangCode();
    var langShort = langCode.split('-')[0];
    // Priorite : voix "enhanced" ou "premium" dans la bonne langue
    var preferred = ['Thomas', 'Amelie', 'Marie', 'Audrey', 'Daniel', 'Samantha', 'Karen'];
    for (var p = 0; p < preferred.length; p++) {
        for (var v = 0; v < voices.length; v++) {
            if (voices[v].name.indexOf(preferred[p]) !== -1 && voices[v].lang.indexOf(langShort) !== -1) {
                _bestVoice = voices[v]; return;
            }
        }
    }
    // Sinon la premiere voix dans la bonne langue
    for (var i = 0; i < voices.length; i++) {
        if (voices[i].lang.indexOf(langShort) !== -1) { _bestVoice = voices[i]; return; }
    }
}

if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadBestVoice;
    loadBestVoice();
}

function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var clean = text
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, function(m, c) { return String.fromCharCode(c); })
        .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
        .replace(/```[\s\S]*?```/g, ' bloc de code ')
        .replace(/`[^`]+`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n{2,}/g, '. ').replace(/\n/g, ' ');

    if (!_voicesLoaded) loadBestVoice();

    // Decouper en phrases courtes pour eviter que macOS coupe la lecture
    var sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    var chunks = [];
    var current = '';
    for (var i = 0; i < sentences.length; i++) {
        var s = sentences[i].trim();
        if (!s) continue;
        if ((current + ' ' + s).length > 200) {
            if (current) chunks.push(current.trim());
            current = s;
        } else {
            current += (current ? ' ' : '') + s;
        }
    }
    if (current.trim()) chunks.push(current.trim());

    // Limiter a 2000 caracteres total
    var totalLen = 0;
    var limitedChunks = [];
    for (var j = 0; j < chunks.length; j++) {
        if (totalLen + chunks[j].length > 2000) break;
        limitedChunks.push(chunks[j]);
        totalLen += chunks[j].length;
    }

    // Lire chaque chunk sequentiellement
    function speakChunk(idx) {
        if (idx >= limitedChunks.length) return;
        var u = new SpeechSynthesisUtterance(limitedChunks[idx]);
        u.lang = getLangCode();
        u.rate = 1.05;
        u.pitch = 1.0;
        if (_bestVoice) u.voice = _bestVoice;
        u.onend = function() { speakChunk(idx + 1); };
        u.onerror = function() { speakChunk(idx + 1); };
        window.speechSynthesis.speak(u);
    }
    speakChunk(0);
}

// === REGENERER UNE REPONSE ===

function regenResponse(btn) {
    var msgEl = btn.closest('.msg.a');
    if (!msgEl || thinking) return;
    if (!isPro) {
        var regenD = getDaily('regen');
        if (regenD.count >= 5) {
            alert('Limite atteinte : 5 regenerations par jour en gratuit.');
            return;
        }
        useDaily('regen');
    }
    // Trouver le dernier message utilisateur avant cette reponse
    var prev = msgEl.previousElementSibling;
    while (prev && !prev.classList.contains('u')) prev = prev.previousElementSibling;
    if (!prev) return;
    var userText = prev.querySelector('.mb');
    if (!userText) return;
    var originalPrompt = userText.textContent.trim();

    // Supprimer l'ancienne reponse IA
    msgEl.remove();
    // Supprimer aussi de l'historique de conversation
    if (ETHER_ENGINE.conversationHistory.length >= 2) {
        ETHER_ENGINE.conversationHistory.pop(); // enlever la reponse IA
    }
    // Supprimer du stockage si sauvegarde
    if (curConv && convs[curConv] && convs[curConv].messages.length > 0) {
        var last = convs[curConv].messages[convs[curConv].messages.length - 1];
        if (last.r === 'a') { convs[curConv].messages.pop(); sSet('convs', convs); }
    }

    // Detecter si c'etait une image (presence de Pollinations dans les sources ou d'une balise img)
    var wasImage = false;
    var oldData = msgEl._etherData;
    if (oldData && oldData.sources && oldData.sources.indexOf('Pollinations AI') !== -1) wasImage = true;
    if (!wasImage && msgEl.querySelector('img[data-url*="pollinations"]')) wasImage = true;

    if (wasImage || ETHER_ENGINE.currentMode === 'image') {
        // Regenerer comme image
        showThink();
        generateImage(originalPrompt, function(imgUrl) {
            hideThink();
            var imgId = 'img_' + Date.now();
            var resp = {
                reasoning: { analyste: 'Regeneration d\'image.', critique: 'Nouveau seed.', synthese: 'Image regeneree.' },
                answer: '<p><strong>Image regeneree :</strong></p>'
                    + '<div id="' + imgId + '-wrap" style="margin:8px 0">'
                    + '<div id="' + imgId + '-loader" style="width:100%;max-width:512px;height:300px;background:var(--b3);border:1px solid var(--bd);border-radius:12px;display:flex;align-items:center;justify-content:center"><span style="color:var(--t3);font-size:.85rem">Chargement...</span></div>'
                    + '<img id="' + imgId + '" data-url="' + esc(imgUrl) + '" style="max-width:100%;border-radius:12px;display:none;cursor:pointer">'
                    + '<div id="' + imgId + '-actions" style="display:none;margin-top:8px;display:none;gap:6px">'
                    + '<button class="btn-s" onclick="downloadImage(document.getElementById(\'' + imgId + '\').src)">Telecharger</button>'
                    + '<button class="btn-s" onclick="retryImg(\'' + imgId + '\')">Regenerer</button>'
                    + '</div></div>'
                    + '<p style="font-size:.8rem;color:var(--t3)">Prompt : <em>' + esc(originalPrompt) + '</em></p>',
                confidence: 'to-verify',
                sources: ['Pollinations AI'],
                _showBadge: false,
                _noSuggestions: true
            };
            addAIMsg(resp);
            setTimeout(function() { loadGenImage(imgId, imgUrl); }, 100);
            if (curConv && !isEphemeral) { convs[curConv].messages.push({ r: 'a', d: resp, ts: Date.now() }); sSet('convs', convs); }
            scr();
        });
        return;
    }

    // Regenerer en mode texte normal
    showThink();
    var regenRetry = 0;
    function attemptRegen() {
        ETHER_ENGINE.generateResponse(originalPrompt).then(function(resp) {
            hideThink();
            if (!resp._streamed) addAIMsg(resp);
            if (curConv && !isEphemeral) { convs[curConv].messages.push({ r: 'a', d: resp, ts: Date.now() }); sSet('convs', convs); }
            scr();
        })['catch'](function() {
            regenRetry++;
            if (regenRetry < 2) { attemptRegen(); return; }
            hideThink();
            addAIMsg({ reasoning: null, answer: '<p><strong>La regeneration a echoue.</strong> Le serveur est temporairement indisponible. Reessaie dans quelques secondes.</p>', confidence: 'unverified', sources: [], _showBadge: false });
        });
    }
    attemptRegen();
}


// === POST-TRAITEMENT DES BLOCS DE CODE ===
function processCodeBlocks(container) {
    if (!container) return;
    var pres = container.querySelectorAll('pre');
    for (var i = 0; i < pres.length; i++) {
        var pre = pres[i];
        if (pre.getAttribute('data-processed')) continue;
        pre.setAttribute('data-processed', '1');

        // Detecter le langage
        var code = pre.querySelector('code');
        var lang = '';
        if (code && code.className) {
            var match = code.className.match(/language-(\w+)/);
            if (match) lang = match[1];
        }

        // Ajouter le header avec le nom du langage et le bouton copier
        var header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = '<span>' + (lang || 'code') + '</span><button class="code-copy-btn" onclick="copyCodeBlock(this)">' + t('btn_copy') + '</button>';
        pre.parentNode.insertBefore(header, pre);
    }
}

function copyCodeBlock(btn) {
    var header = btn.closest('.code-header');
    var pre = header ? header.nextElementSibling : null;
    if (!pre) return;
    var text = pre.textContent;
    navigator.clipboard.writeText(text).then(function() {
        btn.textContent = 'Copie !';
        btn.style.color = '#22c55e';
        btn.style.borderColor = '#22c55e';
        setTimeout(function() { btn.textContent = t('btn_copy'); btn.style.color = ''; btn.style.borderColor = ''; }, 1500);
    });
}

// THINKING

// === DESKTOP FEATURES ===
var VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

function analyzeImageWithVision(base64, mime, fileName, callback) {
    if (!window.etherDesktop) { callback('Vision non disponible.'); return; }
    window.etherDesktop.groqChat({
        model: VISION_MODEL,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: 'Decris cette image en detail en francais. Dis ce que tu vois : objets, personnes, couleurs, texte, contexte. Sois precis.' },
                { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + base64 } }
            ]
        }],
        max_tokens: 1024
    }).then(function(res) {
        if (res.ok) callback(res.text || 'Impossible d\'analyser l\'image.');
        else callback('Erreur API vision.');
    })['catch'](function() { callback('Erreur reseau.'); });
}

// === FEATURE 1: STOP GENERATION ===
var sndSvgNormal = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 4l0 12M12 4l-5 5M12 4l5 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
var sndSvgStop = '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';

function showStopButton() {
    var btn = G('SND');
    btn.innerHTML = sndSvgStop;
    btn.classList.add('stop-mode');
    btn.disabled = false;
    btn.onclick = function() { stopGeneration(); };
}

function hideStopButton() {
    var btn = G('SND');
    btn.innerHTML = sndSvgNormal;
    btn.classList.remove('stop-mode');
    btn.disabled = !uiEl.value.trim();
    btn.onclick = function() { sendMsg(uiEl.value); };
}

function stopGeneration() {
    if (!isStreaming) return;
    isStreaming = false;
    hideStopButton();
    // Envoyer le signal d'arret au main process
    if (window.etherDesktop && window.etherDesktop.groqStop) {
        window.etherDesktop.groqStop();
    }
    window.etherDesktop.removeStreamListeners();
    // Finaliser le message avec le texte accumule
    var streamEls = G('MG').querySelectorAll('.stream-text');
    if (streamEls.length > 0) {
        var streamEl = streamEls[streamEls.length - 1];
        var rawText = streamEl.getAttribute('data-raw') || '';
        var cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (!cleanText) cleanText = streamEl.textContent.replace(/\u258C/g, '').trim();
        // Retirer le curseur de streaming
        var cursor = streamEl.querySelector('.stream-cursor');
        if (cursor) cursor.remove();
        // Parser et finaliser
        var result = ETHER_ENGINE.parseResponse(cleanText);
        result._model = ETHER_ENGINE.getModelForMode();
        result._streamed = true;
        result._stopped = true;
        ETHER_ENGINE.conversationHistory.push({ role: 'user', content: '(dernier prompt)' });
        ETHER_ENGINE.conversationHistory.push({ role: 'assistant', content: cleanText });
        ETHER_ENGINE._finalizeStreamElement(streamEl, result);
        // Ajouter un badge "arrete"
        var msgDiv = streamEl.closest('.msg.a');
        if (msgDiv) {
            var stopBadge = document.createElement('span');
            stopBadge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:.7rem;background:rgba(220,38,38,.12);color:#dc2626;border:1px solid rgba(220,38,38,.25);margin-left:6px';
            stopBadge.textContent = 'Generation arretee';
            var cb = msgDiv.querySelector('.cb');
            if (cb) cb.parentNode.insertBefore(stopBadge, cb.nextSibling);
        }
        if (curConv && !isEphemeral) {
            convs[curConv].messages.push({ r: 'a', d: result, ts: Date.now() });
            sSet('convs', convs);
        }
    }
    hideThink();
    thinking = false;
}

// === FEATURE 2: FOLLOW-UP SUGGESTIONS ===
function generateFollowUpSuggestions(answer, streamEl, userQuestion) {
    if (!window.etherDesktop || !answer) return;
    var plainAnswer = (answer || '').replace(/<[^>]+>/g, '').substring(0, 400);
    var msgDiv = streamEl ? streamEl.closest('.msg.a') : null;
    if (!msgDiv) {
        var aiMsgs = G('MG').querySelectorAll('.msg.a');
        if (aiMsgs.length > 0) msgDiv = aiMsgs[aiMsgs.length - 1];
    }
    if (!msgDiv) return;

    // Supprimer les anciennes suggestions dans d'autres messages
    var oldSuggestions = G('MG').querySelectorAll('.follow-suggestions');
    for (var os = 0; os < oldSuggestions.length; os++) oldSuggestions[os].remove();

    // Recuperer la question utilisateur si pas fournie
    if (!userQuestion) {
        var hist = ETHER_ENGINE.conversationHistory;
        for (var h = hist.length - 1; h >= 0; h--) {
            if (hist[h].role === 'user') { userQuestion = hist[h].content; break; }
        }
    }

    var langName = (G('SLG') && G('SLG').options[G('SLG').selectedIndex]) ? G('SLG').options[G('SLG').selectedIndex].text : 'Francais';
    var contextPrompt = '';
    if (userQuestion) {
        contextPrompt = 'Question de l\'utilisateur: ' + userQuestion.substring(0, 150) + '\n\nReponse de l\'IA: ' + plainAnswer;
    } else {
        contextPrompt = plainAnswer;
    }

    window.etherDesktop.groqChat({
        model: GROQ_MODELS.fast,
        messages: [
            { role: 'system', content: 'Genere entre 2 et 4 questions de suivi naturelles et pertinentes que l\'utilisateur pourrait poser apres cette conversation. Les questions doivent aller plus loin dans le sujet, explorer un angle different ou demander une precision. Separe-les par |. UNIQUEMENT les questions, rien d\'autre. Langue: ' + langName + '. Maximum 12 mots par question. Pas de numerotation.' },
            { role: 'user', content: contextPrompt }
        ],
        temperature: 0.8,
        max_tokens: 200
    }).then(function(res) {
        if (!res.ok || !res.text) return;
        var suggestions = res.text.trim()
            .replace(/^\d+[\.\)]\s*/gm, '') // enlever numerotation
            .split('|')
            .map(function(s) { return s.replace(/^[\s\-\u2022]+/, '').replace(/[?\s]+$/, '').trim() + ' ?'; })
            .filter(function(s) { return s.length > 5 && s.length < 120 && s !== ' ?'; })
            .slice(0, 4);
        if (suggestions.length < 1) return;

        var container = document.createElement('div');
        container.className = 'follow-suggestions';
        for (var i = 0; i < suggestions.length; i++) {
            var chip = document.createElement('button');
            chip.className = 'follow-chip';
            chip.textContent = suggestions[i];
            chip.setAttribute('aria-label', 'Poser la question : ' + suggestions[i]);
            chip.onclick = (function(text) {
                return function() {
                    // Supprimer les chips quand on clique
                    var allChips = G('MG').querySelectorAll('.follow-suggestions');
                    for (var c = 0; c < allChips.length; c++) allChips[c].remove();
                    sendMsg(text);
                };
            })(suggestions[i]);
            container.appendChild(chip);
        }
        // Inserer apres le contenu du message, avant les boutons d'action
        var mbd = msgDiv.querySelector('.mbd');
        var actionBar = msgDiv.querySelector('.ma');
        if (mbd && actionBar) {
            mbd.insertBefore(container, actionBar);
        } else if (mbd) {
            mbd.appendChild(container);
        }
        scr();
    })['catch'](function() {});
}


// === FEATURE 6: RESUME DE CONVERSATION ===
G('SUMMARY-BTN').onclick = function() {
    G('TOOLS-DROP').classList.add('hidden');
    if (!curConv || !convs[curConv] || !convs[curConv].messages.length) {
        alert('Aucune conversation a resumer.');
        return;
    }
    var c = convs[curConv];
    var allText = '';
    for (var i = 0; i < c.messages.length; i++) {
        var m = c.messages[i];
        if (m.r === 'u') allText += 'Utilisateur: ' + m.t + '\n';
        else if (m.d) allText += 'ETHER: ' + (m.d.answer || '').replace(/<[^>]+>/g, '').substring(0, 300) + '\n';
    }
    showThink();
    window.etherDesktop.groqChat({
        model: GROQ_MODELS.fast,
        messages: [
            { role: 'system', content: 'Resume cette conversation en ' + ((G('SLG') && G('SLG').options[G('SLG').selectedIndex]) ? G('SLG').options[G('SLG').selectedIndex].text : 'Francais') + '. Fais un resume structure avec les points principaux abordes, les conclusions et les informations importantes. Utilise des bullet points. Resume UNIQUEMENT.' },
            { role: 'user', content: allText.substring(0, 4000) }
        ],
        temperature: 0.3,
        max_tokens: 500
    }).then(function(res) {
        hideThink();
        if (!res.ok) { alert('Erreur: ' + (res.error || 'inconnue')); return; }
        var summaryResp = {
            reasoning: null,
            answer: '<p><strong>Resume de la discussion :</strong></p><div style="background:var(--b3);border:1px solid var(--bd);border-radius:var(--radius);padding:16px;margin:10px 0;font-size:.88rem;line-height:1.7">' + res.text.replace(/\n/g, '<br>') + '</div>',
            confidence: 'verified',
            sources: ['Resume automatique'],
            _noSuggestions: true
        };
        addAIMsg(summaryResp);
        if (curConv && !isEphemeral) {
            convs[curConv].messages.push({ r: 'a', d: summaryResp, ts: Date.now() });
            sSet('convs', convs);
        }
        scr();
    })['catch'](function() {
        hideThink();
        alert('Erreur lors du resume.');
    });
};

// === FEATURE 7: EXPORT PDF PROPRE ===
function exportPDF() {
    if (!curConv) { alert('Aucune conversation.'); return; }
    var c = convs[curConv];
    var msgCount = c.messages.length;
    var mode = ETHER_ENGINE.currentMode || 'base';
    var startTs = c.messages.length > 0 ? c.messages[0].ts : Date.now();
    var endTs = c.messages.length > 0 ? c.messages[c.messages.length - 1].ts : Date.now();
    var duration = Math.round((endTs - startTs) / 60000);
    var durationStr = duration < 1 ? 'moins d\'1 minute' : duration + ' minute' + (duration > 1 ? 's' : '');
    var dateStr = new Date(c.ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    var messagesHtml = '';
    for (var i = 0; i < c.messages.length; i++) {
        var m = c.messages[i];
        if (m.r === 'u') {
            messagesHtml += '<div style="text-align:right;margin:16px 0"><div style="display:inline-block;background:#c94a3f;color:#fff;padding:10px 16px;border-radius:18px 18px 4px 18px;max-width:70%;text-align:left;font-size:14px">' + esc(m.t) + '</div></div>';
        } else if (m.d) {
            var answer = (m.d.answer || '').replace(/<img[^>]*>/g, '[Image]');
            var conf = m.d.confidence || 'unverified';
            var confLabels = { verified: 'Verifie', 'to-verify': 'A verifier', unverified: 'Non verifie' };
            var confColors = { verified: '#22c55e', 'to-verify': '#f59e0b', unverified: '#ef4444' };
            messagesHtml += '<div style="margin:16px 0;padding:14px 16px;background:#f8f8f8;border-radius:12px;border-left:4px solid #c94a3f"><div style="font-size:14px;line-height:1.7;color:#222">' + answer + '</div><div style="margin-top:8px;font-size:11px;color:' + (confColors[conf] || '#999') + '">' + (confLabels[conf] || '') + '</div></div>';
        }
    }

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ETHER - ' + esc(c.title) + '</title><style>'
        + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:700px;margin:0 auto;padding:40px 30px;color:#222;line-height:1.6}'
        + '.header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #c94a3f}'
        + '.logo{font-size:28px;font-weight:800;letter-spacing:6px;color:#c94a3f;margin-bottom:4px}'
        + '.title{font-size:18px;font-weight:600;color:#333;margin-bottom:12px}'
        + '.meta{font-size:12px;color:#888;display:flex;justify-content:center;gap:20px;flex-wrap:wrap}'
        + '.meta span{display:inline-flex;align-items:center;gap:4px}'
        + 'pre{white-space:pre-wrap;background:#f0f0f0;padding:12px;border-radius:8px;font-size:13px}'
        + 'code{font-family:monospace;font-size:13px}'
        + 'table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:13px}th{background:#f0f0f0;font-weight:600}'
        + 'ul,ol{padding-left:24px;margin:8px 0}li{margin:4px 0}'
        + 'strong{color:#1a1a1a}em{color:#555}'
        + 'h1,h2,h3,h4{color:#c94a3f;margin:16px 0 8px}'
        + 'blockquote{border-left:3px solid #c94a3f;padding-left:12px;color:#555;margin:12px 0}'
        + '.footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#aaa}'
        + '@media print{body{padding:20px}@page{margin:1.5cm}}'
        + '</style></head><body>'
        + '<div class="header"><div class="logo">ETHER</div>'
        + '<div class="title">' + esc(c.title) + '</div>'
        + '<div class="meta">'
        + '<span>' + dateStr + '</span>'
        + '<span>' + msgCount + ' messages</span>'
        + '<span>Mode: ' + mode + '</span>'
        + '<span>Duree: ' + durationStr + '</span>'
        + '</div></div>'
        + messagesHtml
        + '<div class="footer">Exporte depuis ETHER AI</div>'
        + '</body></html>';

    var w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(function() { w.print(); }, 600);
}

// Add keyboard hint element if not present
(function() {
    if (!document.querySelector('.kb-hint')) {
        var hint = document.createElement('div');
        hint.className = 'kb-hint';
        document.body.appendChild(hint);
    }
})();

if (window.etherDesktop && window.etherDesktop.isDesktop) {
    G('ATTACH-BTN').onclick = function() {
        window.etherDesktop.openFile().then(function(files) {
            if (!files) return;
            for (var i = 0; i < files.length; i++) {
                (function(f) {
                    var size = f.size < 1024 ? f.size + ' o' : f.size < 1048576 ? Math.round(f.size / 1024) + ' Ko' : (f.size / 1048576).toFixed(1) + ' Mo';
                    var ext = (f.ext || '').replace('.', '').toLowerCase();
                    var entry = { file: null, name: f.name, ext: ext, size: size, isImage: !!f.isImage, dataUrl: null, content: f.content || null, desktopFile: f };
                    if (f.isImage && f.base64) {
                        entry.dataUrl = 'data:' + (f.mime || 'image/jpeg') + ';base64,' + f.base64;
                    }
                    stagedFiles.push(entry);
                    renderStagedFiles();
                    sndEl.disabled = false;
                })(files[i]);
            }
        });
    };
}
