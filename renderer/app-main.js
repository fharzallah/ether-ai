// === ETHER — Sidebar (history, projects, trash) ===


// NEW CHAT
G('NCB').onclick=function(){newChat();};
// Clic sur le logo = nouveau chat
G('logo-wv').parentNode.parentNode.style.cursor='pointer';
G('logo-wv').parentNode.parentNode.onclick=function(){newChat();};
function newChat(pid){
    curConv=null;curProj=pid||null;isEphemeral=false;ETHER_ENGINE.resetHistory();
    G('EPH-BAR').classList.add('hidden');G('SAVE-BAR').classList.add('hidden');
    G('ECB').style.background='var(--b2)';G('ECB').style.color='var(--t3)';G('ECB').style.borderColor='var(--bd)';
    var mg=G('MG');mg.innerHTML='';
    var w=document.createElement('div');w.className='welc';w.id='WS';
    var gr=user?getGreeting()+', '+user.name:'ETHER';
    w.innerHTML='<div style="width:160px;height:160px;margin:0 auto 24px"><canvas id="welc-wv2" width="160" height="160" style="width:160px;height:160px"></canvas></div><h1>'+esc(gr)+'</h1><p class="welc-s" data-i18n="welc_help">'+t('welc_help')+'</p><div class="welc-c"><button class="chip" data-i18n="chip_relativity" data-p="Explique-moi la relativite">'+t('chip_relativity')+'</button><button class="chip" data-i18n="chip_remote" data-p="Pour et contre le teletravail">'+t('chip_remote')+'</button><button class="chip" data-i18n="chip_app" data-p="Aide-moi avec une idee d\'app">'+t('chip_app')+'</button><button class="chip" data-i18n="chip_sleep" data-p="Conseils pour mieux dormir">'+t('chip_sleep')+'</button></div>';
    mg.appendChild(w);
    var ch=w.querySelectorAll('.chip');for(var i=0;i<ch.length;i++)ch[i].onclick=(function(c){return function(){sendMsg(c.getAttribute('data-p'));};})(ch[i]);
    var wc=document.getElementById('welc-wv2');if(wc)addLogo(wc);
    updHist();G('SB').classList.remove('open');G('SOV').classList.remove('vis');
}

// HISTORY
function updHist(){
    var ids=Object.keys(convs).sort(function(a,b){return convs[b].ts>convs[a].ts?1:-1;});
    if(curProj)ids=ids.filter(function(id){return convs[id].projectId===curProj;});
    var hl=G('HL');
    var showAllBtn=G('SHOW-ALL');
    if(!ids.length){hl.innerHTML='<div class="il-e">'+t('sb_no_chats')+'</div>';showAllBtn.classList.add('hidden');return;}

    var now=new Date();
    var todayStr=now.toISOString().slice(0,10);
    var yest=new Date(now.getTime()-86400000).toISOString().slice(0,10);
    var weekAgo=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
    var monthAgo=new Date(now.getTime()-30*86400000).toISOString().slice(0,10);

    // Grouper
    var groups={today:[],yesterday:[],week:[],month:[],older:[]};
    for(var i=0;i<ids.length;i++){
        var cDate=(convs[ids[i]].ts||'').slice(0,10);
        if(cDate===todayStr)groups.today.push(ids[i]);
        else if(cDate===yest)groups.yesterday.push(ids[i]);
        else if(cDate>=weekAgo)groups.week.push(ids[i]);
        else if(cDate>=monthAgo)groups.month.push(ids[i]);
        else groups.older.push(ids[i]);
    }

    var groupMeta={
        today:{label:t('hist_today'),color:'var(--ac)'},
        yesterday:{label:t('hist_yesterday'),color:'var(--t3)'},
        week:{label:t('hist_week'),color:'var(--t3)'},
        month:{label:t('hist_month'),color:'var(--t3)'},
        older:{label:t('hist_older'),color:'var(--t3)'}
    };

    var pIds=Object.keys(projs);
    var h='';
    var groupOrder=showingAll?['today','yesterday','week','month','older']:['today','yesterday','week','month'];

    for(var gi=0;gi<groupOrder.length;gi++){
        var gKey=groupOrder[gi];
        var gIds=groups[gKey];
        if(!gIds.length)continue;
        var gm=groupMeta[gKey];
        h+='<div class="hist-group">';
        h+='<div class="hist-group-header"><span class="hist-group-dot" style="background:'+gm.color+'"></span><span>'+gm.label+'</span><span class="hist-group-count">'+gIds.length+'</span></div>';
        for(var j=0;j<gIds.length;j++){
            var id=gIds[j];
            var pLabel='';
            if(convs[id].projectId&&projs[convs[id].projectId])pLabel='<span class="hist-proj-tag">'+esc(projs[convs[id].projectId].name)+'</span>';
            var ts=convs[id].ts||'';
            var timeStr=ts.length>16?ts.slice(11,16):'';

            h+='<div class="hi'+(id===curConv?' on':'')+'" data-id="'+id+'">';
            h+='<div class="hi-content"><span class="hi-title">'+esc(convs[id].title)+'</span>';
            if(pLabel||timeStr)h+='<div class="hi-meta">'+(timeStr?'<span class="hi-time">'+timeStr+'</span>':'')+pLabel+'</div>';
            h+='</div>';
            h+='<div class="dots-menu"><button class="dots-btn" data-id="'+id+'" onclick="event.stopPropagation();togDots(this)">&#8943;</button>';
            h+='<div class="dots-drop" id="dd_'+id+'">';
            h+='<button onclick="event.stopPropagation();renConv(\''+id+'\')">'+t('btn_rename')+'</button>';
            if(pIds.length>0){h+='<div style="border-top:1px solid var(--bd);margin-top:4px;padding-top:4px"><div style="font-size:.7rem;color:var(--t3);padding:2px 10px">'+t('sb_projects')+':</div>';for(var p=0;p<pIds.length;p++){h+='<button onclick="event.stopPropagation();addToProj(\''+id+'\',\''+pIds[p]+'\')">'+esc(projs[pIds[p]].name)+'</button>';}h+='</div>';}
            h+='<button onclick="event.stopPropagation();trashConv(\''+id+'\')" style="color:#ef4444">'+t('btn_delete')+'</button>';
            h+='</div></div></div>';
        }
        h+='</div>';
    }
    hl.innerHTML=h;

    // Bouton "Voir toutes"
    if(!showingAll&&groups.older.length>0){
        showAllBtn.classList.remove('hidden');
        showAllBtn.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;margin-right:6px"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" fill="currentColor" transform="rotate(180 12 12)"/></svg>'+t('hist_show_all')+' <span style="opacity:.5;margin-left:4px">('+groups.older.length+')</span>';
    } else {
        showAllBtn.classList.add('hidden');
    }

    var items=hl.querySelectorAll('.hi');
    for(var i=0;i<items.length;i++){items[i].onclick=(function(el){return function(e){if(e.target.closest('.dots-menu'))return;loadConv(el.getAttribute('data-id'));};})(items[i]);}
}
function togDots(btn){var drops=document.querySelectorAll('.dots-drop');var drop=document.getElementById('dd_'+btn.getAttribute('data-id'));var was=drop&&drop.classList.contains('vis');for(var i=0;i<drops.length;i++)drops[i].classList.remove('vis');if(drop&&!was){var rect=btn.getBoundingClientRect();drop.style.top=(rect.bottom+4)+'px';drop.style.left=rect.left+'px';drop.classList.add('vis');}}
document.addEventListener('click',function(e){if(!e.target.closest('.dots-menu')){var d=document.querySelectorAll('.dots-drop');for(var i=0;i<d.length;i++)d[i].classList.remove('vis');}});
function renConv(id){if(!convs[id])return;var name=prompt('Nouveau nom:',convs[id].title);if(name&&name.trim()){convs[id].title=name.trim();sSet('convs',convs);updHist();}}
function addToProj(cid,pid){if(!convs[cid])return;convs[cid].projectId=pid;sSet('convs',convs);updHist();var d=document.querySelectorAll('.dots-drop');for(var i=0;i<d.length;i++)d[i].classList.remove('vis');}
function trashConv(id){if(!convs[id])return;trash[id]={title:convs[id].title,data:convs[id],deletedAt:Date.now()};sSet('trash',trash);delete convs[id];sSet('convs',convs);if(curConv===id)newChat();else updHist();updTrash();}
function loadConv(id){if(!convs[id])return;curConv=id;isEphemeral=false;ETHER_ENGINE.resetHistory();G('EPH-BAR').classList.add('hidden');G('SAVE-BAR').classList.add('hidden');G('MG').innerHTML='';
    // Logo en haut de la conversation
    var hdr=document.createElement('div');
    hdr.style.cssText='text-align:center;padding:20px 0 10px';
    hdr.innerHTML='<div style="width:50px;height:50px;margin:0 auto 8px"><canvas id="conv-logo" width="50" height="50"></canvas></div><div style="font-size:.82rem;color:var(--t3);font-weight:500">'+esc(convs[id].title)+'</div>';
    G('MG').appendChild(hdr);
    var cl=document.getElementById('conv-logo');if(cl)addLogo(cl);
    var msgs=convs[id].messages;for(var i=0;i<msgs.length;i++){if(msgs[i].r==='u')addUserMsg(msgs[i].t);else addAIMsg(msgs[i].d);}updHist();scr();G('SB').classList.remove('open');G('SOV').classList.remove('vis');syncTabOnLoad(id);}

// TRASH
function cleanTrash(){var now=Date.now();for(var id in trash){if(now-trash[id].deletedAt>30*24*60*60*1000){delete trash[id];}}sSet('trash',trash);}
cleanTrash();
function updTrash(){cleanTrash();var ids=Object.keys(trash).sort(function(a,b){return trash[b].deletedAt-trash[a].deletedAt;});var tl=G('TL');var etb=G('ETB');if(!ids.length){tl.innerHTML='<div class="il-e" data-i18n="sb_trash_empty">'+t('sb_trash_empty')+'</div>';etb.style.display='none';return;}etb.style.display='block';var h='';for(var i=0;i<ids.length;i++){var id=ids[i];var ti=trash[id];var dl=30-Math.floor((Date.now()-ti.deletedAt)/(24*60*60*1000));h+='<div class="trash-item"><div class="tr-info"><div class="tr-title">'+esc(ti.title)+'</div><div class="tr-date">'+dl+' d</div></div><div class="trash-actions"><button class="tr-restore" onclick="restoreConv(\''+id+'\')">'+t('btn_save')+'</button><button class="tr-del" onclick="permDelConv(\''+id+'\')">'+t('btn_delete')+'</button></div></div>';}tl.innerHTML=h;}
function restoreConv(id){if(!trash[id])return;convs[id]=trash[id].data;sSet('convs',convs);delete trash[id];sSet('trash',trash);updHist();updTrash();}
function permDelConv(id){delete trash[id];sSet('trash',trash);updTrash();}
G('ETB').onclick=function(){if(!confirm('Vider la corbeille?'))return;trash={};sSet('trash',trash);updTrash();};

// PROJECTS
G('NPB').onclick=function(){G('PNI').value='';G('PDI').value='';G('PM').classList.remove('hidden');};
G('PMX').onclick=function(){G('PM').classList.add('hidden');};
G('PM').querySelector('.modal-bk').onclick=function(){G('PM').classList.add('hidden');};
G('PSB').onclick=function(){var nm=G('PNI').value;if(!nm||!nm.trim())return;projs['p'+Date.now()]={name:nm.trim(),desc:G('PDI').value.trim(),ts:new Date().toISOString()};sSet('projs',projs);G('PM').classList.add('hidden');updProjs();};
function updProjs(){
    var ids=Object.keys(projs).sort(function(a,b){return projs[b].ts>projs[a].ts?1:-1;});var pl=G('PL');
    if(!ids.length){pl.innerHTML='<div class="il-e" data-i18n="sb_no_projects">'+t('sb_no_projects')+'</div>';return;}
    var h='';for(var i=0;i<ids.length;i++){h+='<div class="pi'+(ids[i]===curProj?' on':'')+'" data-id="'+ids[i]+'"><span>'+esc(projs[ids[i]].name)+'</span><button class="idel" data-id="'+ids[i]+'">&times;</button></div>';}
    pl.innerHTML=h;
    var items=pl.querySelectorAll('.pi');for(var i=0;i<items.length;i++){items[i].onclick=(function(el){return function(e){if(e.target.classList.contains('idel'))return;curProj=el.getAttribute('data-id');updProjs();updHist();newChat(curProj);};})(items[i]);}
    var dels=pl.querySelectorAll('.idel');for(var i=0;i<dels.length;i++){dels[i].onclick=(function(b){return function(e){e.stopPropagation();var bid=b.getAttribute('data-id');delete projs[bid];sSet('projs',projs);if(curProj===bid){curProj=null;newChat();}updProjs();};})(dels[i]);}
    var sel=G('CFP');sel.innerHTML='<option value="all">Tous</option>';for(var i=0;i<ids.length;i++)sel.innerHTML+='<option value="'+ids[i]+'">'+esc(projs[ids[i]].name)+'</option>';
}

// SETTINGS
G('STB').onclick=function(){G('SM').classList.remove('hidden');loadSett();};
G('SMX').onclick=function(){saveSett();G('SM').classList.add('hidden');};
G('SM').querySelector('.modal-bk').onclick=function(){saveSett();G('SM').classList.add('hidden');};
function loadSett(){var s=sGet('sett',{});G('SP').value=s.profession||'';G('SIN').value=s.instructions||'';var tos=document.querySelectorAll('.to');for(var i=0;i<tos.length;i++)tos[i].classList.toggle('on',tos[i].getAttribute('data-th')===theme);renMem();}
function saveSett(){sSet('sett',{profession:G('SP').value.trim(),instructions:G('SIN').value.trim()});}
var tos=document.querySelectorAll('.to');for(var i=0;i<tos.length;i++){tos[i].onclick=(function(btn){return function(){var all=document.querySelectorAll('.to');for(var j=0;j<all.length;j++)all[j].classList.remove('on');btn.classList.add('on');theme=btn.getAttribute('data-th');sSet('theme',theme);applyTheme(theme);updateWaveColors();};})(tos[i]);}
function renMem(){var mem=sGet('mem',[]);var ml=G('MML');if(!mem.length){ml.innerHTML='<div class="il-e">Aucun souvenir</div>';return;}var h='';for(var i=0;i<mem.length;i++)h+='<div class="mi"><span>'+esc(mem[i])+'</span><button onclick="delMem('+i+')">&times;</button></div>';ml.innerHTML=h;}
G('MMA').onclick=function(){var v=G('MMI').value;if(!v||!v.trim())return;var mem=sGet('mem',[]);mem.push(v.trim());sSet('mem',mem);G('MMI').value='';renMem();};
function delMem(idx){var mem=sGet('mem',[]);mem.splice(idx,1);sSet('mem',mem);renMem();}
G('DHB').onclick=function(){if(!confirm('Supprimer tout l\'historique?'))return;convs={};sSet('convs',convs);newChat();G('SM').classList.add('hidden');};
G('DAB').onclick=function(){if(!confirm('Supprimer le compte?'))return;localStorage.clear();location.reload();};

// LANGUAGE
var curLang=sGet('lang','fr'); G('SLG').value=curLang;
G('SLG').onchange=function(){curLang=G('SLG').value;sSet('lang',curLang);applyLanguage();};
applyLanguage();

// CONTENT
// CONTENT - images et documents generes
var generatedDocs = sGet('docs', []);

// Afficher les documents RAG indexes
function updRagDocs() {
    var container = G('RAG-DOCS');
    if (!container || typeof RAG === 'undefined') return;
    var docs = RAG.listDocuments();
    if (!docs.length) { container.innerHTML = ''; return; }
    var h = '<div style="font-size:.7rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.3px;padding:0 4px 6px;display:flex;align-items:center;gap:6px">'
        + '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" fill="currentColor"/></svg>'
        + 'Base de connaissances (' + docs.length + ')</div>';
    for (var i = 0; i < docs.length; i++) {
        var d = docs[i];
        var sizeKb = Math.round(d.size / 1024);
        h += '<div class="cont-item rag-doc-item" data-doc-id="' + escAttr(d.id) + '">'
            + '<div class="cont-icon" style="background:rgba(14,165,233,.15);color:#0ea5e9;font-size:.55rem">RAG</div>'
            + '<div class="cont-info"><div class="cont-title">' + esc(d.name) + '</div>'
            + '<div class="cont-date">' + sizeKb + ' Ko — ' + d.chunks + ' fragments</div></div>'
            + '<button class="rag-del" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:1rem;padding:0 4px;opacity:.5" title="Retirer">&times;</button>'
            + '</div>';
    }
    container.innerHTML = h;
    // Event listeners pour supprimer
    var delBtns = container.querySelectorAll('.rag-del');
    for (var j = 0; j < delBtns.length; j++) {
        delBtns[j].addEventListener('click', function(e) {
            e.stopPropagation();
            var docId = this.closest('.rag-doc-item').getAttribute('data-doc-id');
            RAG.removeDocument(docId);
            updRagDocs();
        });
    }
}

function updCont() {
    updRagDocs();
    var items = [];
    // Images generees (depuis les conversations)
    var cids = Object.keys(convs);
    for (var i = 0; i < cids.length; i++) {
        var c = convs[cids[i]];
        for (var j = 0; j < c.messages.length; j++) {
            var m = c.messages[j];
            if (m.r === 'a' && m.d && m.d.answer && m.d.answer.indexOf('<img ') !== -1) {
                items.push({ type: 'image', title: c.title, ts: m.ts, cid: cids[i] });
            }
        }
    }
    // Documents generes
    for (var i = 0; i < generatedDocs.length; i++) {
        items.push({ type: 'doc', title: generatedDocs[i].title, ts: generatedDocs[i].ts, idx: i, format: generatedDocs[i].format });
    }
    items.sort(function(a, b) { return b.ts - a.ts; });

    var cl = G('CL');
    if (!items.length) { cl.innerHTML = '<div class="il-e" data-i18n="sb_no_content">' + t('sb_no_content') + '</div>'; return; }
    var h = '';
    for (var i = 0; i < Math.min(items.length, 30); i++) {
        var it = items[i];
        var date = new Date(it.ts).toLocaleDateString('fr-FR');
        if (it.type === 'image') {
            h += '<div class="cont-item" data-type="image" data-cid="' + escAttr(it.cid) + '"><div class="cont-icon img-icon">IMG</div><div class="cont-info"><div class="cont-title">' + esc(it.title) + '</div><div class="cont-date">' + date + '</div></div></div>';
        } else {
            h += '<div class="cont-item" data-type="doc" data-idx="' + it.idx + '"><div class="cont-icon doc-icon">' + esc((it.format || 'DOC').toUpperCase()) + '</div><div class="cont-info"><div class="cont-title">' + esc(it.title) + '</div><div class="cont-date">' + date + '</div></div></div>';
        }
    }
    cl.innerHTML = h;
    // Attacher les event listeners (pas de onclick inline)
    var contItems = cl.querySelectorAll('.cont-item');
    for (var ci = 0; ci < contItems.length; ci++) {
        contItems[ci].addEventListener('click', function() {
            var type = this.getAttribute('data-type');
            if (type === 'image') {
                previewContentImage(this.getAttribute('data-cid'));
            } else {
                var idx = parseInt(this.getAttribute('data-idx'), 10);
                previewContentDoc(idx);
            }
        });
    }
}

// Preview d'une image depuis la section Contenu
function previewContentImage(cid) {
    if (!convs[cid]) return;
    var msgs = convs[cid].messages;
    var imgUrl = null;
    var cachedData = getCachedImage(cid);
    // Chercher l'URL de l'image dans les messages
    for (var i = msgs.length - 1; i >= 0; i--) {
        var m = msgs[i];
        if (m.r === 'a' && m.d && m.d.answer) {
            var urlMatch = m.d.answer.match(/data-url="([^"]+)"/);
            if (urlMatch) { imgUrl = urlMatch[1]; break; }
            var srcMatch = m.d.answer.match(/src="(https:\/\/image\.pollinations\.ai[^"]+)"/);
            if (srcMatch) { imgUrl = srcMatch[1]; break; }
        }
    }
    var prompt = convs[cid].title || '';
    // Source a utiliser: cache (instantane) ou URL (lent)
    var imgSrc = cachedData || imgUrl;

    var overlay = document.createElement('div');
    overlay.className = 'cont-preview-overlay';
    var card = document.createElement('div');
    card.className = 'cont-preview-card';
    card.innerHTML = '<h3><svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:-4px;margin-right:8px;color:var(--ac)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/></svg>' + esc(prompt) + '</h3>'
        + '<div id="cont-preview-img-area" style="text-align:center;min-height:100px">'
        + (imgSrc ? '' : '<div style="color:var(--t3);font-size:.85rem;padding:30px 0">Image introuvable</div>')
        + '</div>'
        + '<div class="preview-actions">'
        + '<button class="btn-s" id="cont-dl-btn" style="display:none"><svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;margin-right:4px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>Telecharger</button>'
        + '<button class="btn-s" id="cont-conv-btn">Voir la conversation</button>'
        + '<button class="btn-s" id="cont-close-btn">Fermer</button>'
        + '</div>';
    overlay.appendChild(card);
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    card.querySelector('#cont-close-btn').onclick = function() { overlay.remove(); };
    card.querySelector('#cont-conv-btn').onclick = function() { overlay.remove(); loadConv(cid); };

    if (imgSrc) {
        var img = new Image();
        img.onload = function() {
            var area = document.getElementById('cont-preview-img-area');
            if (area) {
                area.innerHTML = '';
                img.style.cssText = 'max-width:100%;max-height:50vh;border-radius:12px;cursor:pointer';
                img.onclick = function() { overlay.remove(); openImagePreview(img.src); };
                area.appendChild(img);
            }
            var dlBtn = document.getElementById('cont-dl-btn');
            if (dlBtn) {
                dlBtn.style.display = '';
                dlBtn.onclick = function() { downloadImage(img.src); };
            }
        };
        img.onerror = function() {
            // Le cache a rate ou l'URL a expire — tenter l'autre source
            if (cachedData && imgUrl && img.src !== imgUrl) {
                img.src = imgUrl; // fallback vers l'URL originale
                return;
            }
            var area = document.getElementById('cont-preview-img-area');
            if (area) {
                area.innerHTML = '<div style="padding:30px;color:var(--t3);text-align:center">'
                    + '<svg viewBox="0 0 24 24" width="48" height="48" style="opacity:.3;margin-bottom:10px"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/></svg>'
                    + '<p>Image expiree</p>'
                    + '<p style="font-size:.78rem;margin-top:6px">L\'image n\'est plus disponible.</p>'
                    + '</div>';
            }
        };
        img.src = imgSrc;
    }
}

// Preview d'un document depuis la section Contenu
function previewContentDoc(idx) {
    if (!generatedDocs[idx]) return;
    var doc = generatedDocs[idx];
    var colors = { word: '#2563eb', excel: '#22c55e', text: '#6b7280', html: '#f59e0b', markdown: '#8b5cf6' };

    var overlay = document.createElement('div');
    overlay.className = 'cont-preview-overlay';
    var card = document.createElement('div');
    card.className = 'cont-preview-card';
    card.innerHTML = '<h3><div style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;background:' + (colors[doc.format] || 'var(--ac)') + ';color:#fff;font-size:.65rem;font-weight:700;vertical-align:-7px;margin-right:10px">' + esc((doc.format || 'DOC').toUpperCase().substring(0, 3)) + '</div>' + esc(doc.title) + '</h3>'
        + '<div style="font-size:.78rem;color:var(--t3);margin-bottom:12px">Format : ' + esc((doc.format || 'txt').toUpperCase()) + ' — Genere le ' + new Date(doc.ts).toLocaleDateString('fr-FR') + '</div>'
        + '<pre>' + esc((doc.content || '').substring(0, 2000)) + (doc.content && doc.content.length > 2000 ? '\n\n... (contenu tronque)' : '') + '</pre>'
        + '<div class="preview-actions">'
        + '<button class="btn-s" id="cont-doc-dl" style="background:var(--ac);color:#fff;border-color:var(--ac)"><svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;margin-right:4px"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>Telecharger</button>'
        + '<button class="btn-s" id="cont-doc-close">Fermer</button>'
        + '</div>';
    overlay.appendChild(card);
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    card.querySelector('#cont-doc-dl').onclick = function() { dlDocContent(doc); };
    card.querySelector('#cont-doc-close').onclick = function() { overlay.remove(); };
}

// DOCUMENT GENERATION
// TOOLS MENU
G('TOOLS-BTN').onclick = function(e) {
    e.stopPropagation();
    var drop = G('TOOLS-DROP');
    if (!drop.classList.contains('hidden')) { drop.classList.add('hidden'); return; }
    var rect = G('TOOLS-BTN').getBoundingClientRect();
    drop.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    drop.style.left = rect.left + 'px';
    drop.classList.remove('hidden');
};
document.addEventListener('click', function(e) {
    if (!e.target.closest('#TOOLS-DROP') && !e.target.closest('#TOOLS-BTN')) {
        G('TOOLS-DROP').classList.add('hidden');
    }
});
G('DOC-BTN').onclick = function() { G('TOOLS-DROP').classList.add('hidden'); G('DOC-P').classList.toggle('hidden');  G('REF-P').classList.add('hidden'); };

// Selection du type de document
var pendingDocFormat = null;

function selectDocType(format) {
    pendingDocFormat = format;
    G('DOC-P').classList.add('hidden');
    var labels = { word: 'Word', excel: 'Excel', text: 'Texte', html: 'Page web', markdown: 'Markdown' };
    var label = labels[format] || format;
    // Pre-remplir la barre de chat avec un indicateur
    uiEl.value = '';
    uiEl.placeholder = 'Decrivez le document ' + label + ' a generer...';
    uiEl.focus();
    sndEl.disabled = true;
    // Afficher un badge au-dessus de l'input
    var badge = G('DOC-BADGE');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'DOC-BADGE';
        badge.style.cssText = 'max-width:680px;margin:0 auto 6px;display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--b2);border:1px solid var(--bd);border-radius:20px;font-size:.8rem;color:var(--t2)';
        G('uinp').parentNode.parentNode.insertBefore(badge, G('uinp').parentNode);
    }
    var colors = { word: '#2563eb', excel: '#22c55e', text: '#6b7280', html: '#f59e0b', markdown: '#8b5cf6' };
    badge.innerHTML = '<div style="width:24px;height:24px;border-radius:6px;background:' + (colors[format] || 'var(--ac)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700">' + format.toUpperCase().substring(0, 3) + '</div><span>Document ' + label + '</span><button onclick="cancelDoc()" style="margin-left:auto;background:none;border:none;color:var(--t3);cursor:pointer;font-size:1rem;line-height:1">&times;</button>';
    badge.classList.remove('hidden');
}

function cancelDoc() {
    pendingDocFormat = null;
    uiEl.placeholder = 'Envoie un message...';
    var badge = G('DOC-BADGE');
    if (badge) badge.classList.add('hidden');
}

function genDoc(format, desc) {
    showThink();
    var formatInstructions = '';
    if (format === 'excel' || format === 'csv') {
        formatInstructions = 'Retourne UNIQUEMENT des donnees CSV (separees par des virgules) avec les en-tetes en premiere ligne. Pas de texte explicatif.';
    } else if (format === 'html') {
        formatInstructions = 'Retourne UNIQUEMENT du HTML complet avec style CSS integre. Pas de texte explicatif.';
    } else if (format === 'word') {
        formatInstructions = 'REGLES ABSOLUES: Ne dis JAMAIS bonjour, ne mentionne JAMAIS ce que tu vas faire, ne signe JAMAIS. Commence IMMEDIATEMENT par le titre du document en # Titre. Structure avec ## sections, **gras**, listes a puces. Document professionnel direct. AUCUN meta-commentaire.';
    } else {
        formatInstructions = 'Retourne UNIQUEMENT le contenu du document, bien structure et detaille. Pas de meta-commentaire, pas de refus, genere directement le contenu demande.';
    }

    // Recherche web automatique pour enrichir le document avec des infos a jour
    var searchP = (typeof webSearch === 'function') ? webSearch(desc)['catch'](function() { return { results: [], extract: '' }; }) : Promise.resolve({ results: [], extract: '' });

    searchP.then(function(webData) {
        var webContext = '';
        if (webData && webData.extract) webContext += '\n\nINFORMATIONS A JOUR (sources web):\n' + webData.extract;
        if (webData && webData.results) {
            for (var w = 0; w < webData.results.length; w++) {
                if (webData.results[w].snippet && webData.results[w].snippet.length > 20) {
                    webContext += '\n[' + webData.results[w].source + '] ' + webData.results[w].snippet;
                }
            }
        }

        var prompt = 'Genere le contenu d\'un document ' + format + ' en francais. Description: ' + desc + '. ' + formatInstructions;
        if (webContext) {
            prompt += '\n\nUtilise ces informations a jour pour rediger le document:' + webContext;
            prompt += '\nIMPORTANT: Base-toi sur ces sources reelles et actuelles. Ne refuse pas de generer le document. Redige directement le contenu.';
        }

        return ETHER_ENGINE.generateResponse(prompt);
    }).then(function(aiResp) {
        hideThink();
        var content = (aiResp.answer || '').trim();
        var contentPlain = content.replace(/<[^>]+>/g, '').trim();
        content = content.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');
        contentPlain = contentPlain.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');

        var finalContent = (format === 'word' || format === 'html' || format === 'markdown') ? content : contentPlain;
        var doc = { title: desc.substring(0, 50), format: format, content: finalContent, ts: Date.now() };
        generatedDocs.push(doc);
        sSet('docs', generatedDocs);
        updCont();
        dlDocContent(doc);

        var ws = G('WS'); if (ws && ws.parentNode) ws.parentNode.removeChild(ws);
        if (!curConv && !isEphemeral) {
// === ETHER — Settings (preferences, memory, providers) ===

            curConv = 'c' + Date.now();
            convs[curConv] = { title: 'Doc: ' + desc.substring(0, 30), messages: [], ts: new Date().toISOString() };
            sSet('convs', convs); updHist();
        }
        var docIdx = generatedDocs.length - 1;
        var colors = { word: '#2563eb', excel: '#22c55e', text: '#6b7280', html: '#f59e0b', markdown: '#8b5cf6' };
        var docResp = {
            reasoning: { analyste: 'Document genere via IA.', critique: 'Contenu genere par Groq.', synthese: 'Document pret au telechargement.' },
            answer: '<p><strong>Document genere et telecharge :</strong></p><div style="background:var(--b3);border:1px solid var(--bd);border-radius:var(--radius);padding:16px;margin:10px 0"><div style="display:flex;align-items:center;gap:12px"><div style="width:42px;height:42px;border-radius:10px;background:' + (colors[format] || 'var(--ac)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700">' + format.toUpperCase().substring(0, 3) + '</div><div><strong>' + esc(desc) + '</strong><br><span style="font-size:.78rem;color:var(--t3)">' + format.toUpperCase() + ' - Genere par ETHER AI</span></div></div><button onclick="dlDoc(' + docIdx + ')" style="margin-top:12px;padding:8px 16px;border:1px solid var(--ac);border-radius:var(--radius);background:transparent;color:var(--ac);cursor:pointer;font-size:.82rem;transition:all .15s">Retelecharger</button></div><details style="margin-top:8px"><summary style="cursor:pointer;font-size:.82rem;color:var(--t3)">Voir le contenu</summary><pre style="background:var(--b3);padding:12px;border-radius:var(--radius);font-size:.78rem;overflow-x:auto;margin-top:8px;white-space:pre-wrap">' + esc(finalContent.substring(0, 1000)) + '</pre></details>',
            confidence: 'verified',
            sources: ['Groq AI'],
            _noSuggestions: true
        };
        addAIMsg(docResp);
        if (curConv && !isEphemeral) { convs[curConv].messages.push({ r: 'a', d: docResp, ts: Date.now() }); sSet('convs', convs); }
        scr();
    })['catch'](function() { hideThink(); alert('Erreur de generation.'); });
}

function dlDoc(idx) {
    if (!generatedDocs[idx]) return;
    dlDocContent(generatedDocs[idx]);
}

function dlDocContent(doc) {
    var ext = { word: 'doc', excel: 'csv', text: 'txt', html: 'html', markdown: 'md' };
    var mime = { word: 'application/msword', excel: 'text/csv', text: 'text/plain', html: 'text/html', markdown: 'text/markdown' };
    var content = doc.content;

    if (doc.format === 'word') {
        var wordHtml = doc.content;
        // Convertir les balises HTML en styles Word-compatibles
        wordHtml = wordHtml
            .replace(/<h1[^>]*>/gi, '<h1 style="font-size:24pt;font-weight:bold;color:#1a1a2e;margin-bottom:12pt">')
            .replace(/<h2[^>]*>/gi, '<h2 style="font-size:18pt;font-weight:bold;color:#16213e;margin-bottom:8pt">')
            .replace(/<h3[^>]*>/gi, '<h3 style="font-size:14pt;font-weight:bold;margin-bottom:6pt">')
            .replace(/<strong[^>]*>/gi, '<strong style="font-weight:bold">')
            .replace(/<em[^>]*>/gi, '<em style="font-style:italic">')
            .replace(/<ul[^>]*>/gi, '<ul style="margin-left:20pt">')
            .replace(/<li[^>]*>/gi, '<li style="margin-bottom:4pt">');

        content = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" '
            + 'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
            + '<head><meta charset="UTF-8">'
            + '<style>'
            + 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;margin:2.5cm}'
            + 'h1{font-size:24pt;color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6pt;margin-top:0}'
            + 'h2{font-size:18pt;color:#16213e;margin-top:18pt}'
            + 'h3{font-size:14pt;margin-top:12pt}'
            + 'p{margin-bottom:8pt}'
            + 'ul,ol{margin-left:20pt;margin-bottom:8pt}'
            + 'li{margin-bottom:3pt}'
            + 'table{border-collapse:collapse;width:100%;margin-bottom:12pt}'
            + 'td,th{border:1px solid #ccc;padding:6pt 8pt}'
            + 'th{background:#f0f0f0;font-weight:bold}'
            + 'code{font-family:Courier New;background:#f5f5f5;padding:1pt 3pt}'
            + '.ether-header{text-align:center;padding:20pt 0 30pt;border-bottom:3px solid #1a1a2e;margin-bottom:24pt}'
            + '.ether-footer{text-align:center;color:#999;font-size:9pt;margin-top:30pt;border-top:1px solid #ddd;padding-top:8pt}'
            + '</style></head><body>'
            + '<div class="ether-header">'
            + '<div style="font-size:28pt;font-weight:800;color:#1a1a2e;letter-spacing:4px">ETHER</div>'
            + '<div style="font-size:10pt;color:#666;margin-top:4pt">' + new Date().toLocaleDateString('fr-FR', {year:'numeric',month:'long',day:'numeric'}) + '</div>'
            + '<div style="font-size:14pt;color:#333;margin-top:12pt;font-weight:600">' + esc(doc.title) + '</div>'
            + '</div>'
            + wordHtml
            + '<div class="ether-footer">Généré par ETHER AI • ' + new Date().toLocaleDateString('fr-FR') + '</div>'
            + '</body></html>';
        ext[doc.format] = 'doc';
    }
    else if (doc.format === 'markdown') {
        // Convertir HTML en Markdown propre
        content = doc.content
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        ext[doc.format] = 'md';
        mime[doc.format] = 'text/markdown';
    }

    downloadFile('ether-' + doc.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) + '.' + (ext[doc.format] || 'txt'), content, mime[doc.format] || 'text/plain');
}

// SEARCH - cherche dans les titres ET le contenu des messages
G('SRC').oninput=function(){
    var q=G('SRC').value.toLowerCase().trim();
    var hl=G('HL');
    if(!q){
        // Pas de recherche, afficher normalement
        var items=hl.querySelectorAll('.hi');
        for(var i=0;i<items.length;i++) items[i].style.display='';
        // Supprimer les resultats de recherche custom
        var sr=hl.querySelectorAll('.search-result');
        for(var i=0;i<sr.length;i++) sr[i].remove();
        // Reaffficher les groupes de date
        var dg=hl.querySelectorAll('.hist-group');
        for(var i=0;i<dg.length;i++) dg[i].style.display='';
        return;
    }
    // Masquer tout l'affichage normal
    var items=hl.querySelectorAll('.hi');
    for(var i=0;i<items.length;i++) items[i].style.display='none';
    var dg=hl.querySelectorAll('.hist-group');
    for(var i=0;i<dg.length;i++) dg[i].style.display='none';
    // Supprimer les anciens resultats
    var oldSr=hl.querySelectorAll('.search-result');
    for(var i=0;i<oldSr.length;i++) oldSr[i].remove();
    // Rechercher dans toutes les conversations
    var ids=Object.keys(convs);
    var results=[];
    for(var i=0;i<ids.length;i++){
        var id=ids[i];
        var c=convs[id];
        var titleMatch=c.title.toLowerCase().indexOf(q)!==-1;
        var snippet='';
        var msgs=c.messages;
        for(var j=0;j<msgs.length;j++){
            var txt=msgs[j].t||'';
            if(msgs[j].d&&msgs[j].d.answer) txt+=' '+(msgs[j].d.answer||'').replace(/<[^>]+>/g,'');
            var idx=txt.toLowerCase().indexOf(q);
            if(idx!==-1){
                var start=Math.max(0,idx-30);
                var end=Math.min(txt.length,idx+q.length+50);
                snippet=(start>0?'...':'')+txt.substring(start,end)+(end<txt.length?'...':'');
                break;
            }
        }
        if(titleMatch||snippet){
            results.push({id:id,title:c.title,snippet:snippet,ts:c.ts});
        }
    }
    results.sort(function(a,b){return b.ts>a.ts?1:-1;});
    for(var i=0;i<Math.min(results.length,20);i++){
        var r=results[i];
        var el=document.createElement('div');
        el.className='search-result';
        el.setAttribute('data-id',r.id);
        el.innerHTML='<div class="sr-title">'+esc(r.title)+'</div>'+(r.snippet?'<div class="sr-snippet">'+esc(r.snippet)+'</div>':'');
        el.onclick=(function(rid){return function(){loadConv(rid);G('SRC').value='';G('SRC').oninput();};})(r.id);
        hl.appendChild(el);
    }
    if(!results.length){
        var noRes=document.createElement('div');
        noRes.className='search-result';
        noRes.innerHTML='<div class="sr-snippet">Aucun resultat</div>';
        hl.appendChild(noRes);
    }
};

// === VOICE MODE (Push-to-Talk via MediaRecorder + Groq Whisper) ===
var isRec = false;
var voiceMode = false;
var voiceAutoSpeak = true;
var mediaRecorder = null;
var audioChunks = [];
var audioStream = null;

function startListeningUI() {
    isRec = true;
    G('MIC').classList.add('mic-active');
    G('MIC-BAR').classList.add('vis');
    G('MIC-STATUS').textContent = 'Ecoute en cours...';
}

function stopListeningUI() {
    isRec = false;
    G('MIC').classList.remove('mic-active');
    G('MIC-BAR').classList.remove('vis');
}

function stopVoiceMode() {
    voiceMode = false;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    if (audioStream) {
        audioStream.getTracks().forEach(function(t) { t.stop(); });
        audioStream = null;
    }
    stopListeningUI();
    uiEl.value = '';
    sndEl.disabled = true;
}

function startRecording() {
    audioChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        audioStream = stream;
        // Utiliser webm/opus si dispo, sinon webm
        var mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });

        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = function() {
            // Arreter le micro
            stream.getTracks().forEach(function(t) { t.stop(); });
            audioStream = null;

            if (audioChunks.length === 0) { stopListeningUI(); return; }

            // Convertir en blob puis envoyer a Whisper
            var blob = new Blob(audioChunks, { type: mimeType });
            G('MIC-STATUS').textContent = 'Transcription...';

            // Lire le blob en ArrayBuffer pour l'envoyer via IPC
            var reader = new FileReader();
            reader.onload = function() {
                var buffer = reader.result;
                if (!window.etherDesktop || !window.etherDesktop.transcribeAudio) {
                    stopListeningUI();
                    return;
                }
                window.etherDesktop.transcribeAudio(buffer).then(function(res) {
                    stopListeningUI();
                    if (res.ok && res.text && res.text.trim()) {
                        var text = res.text.trim();
                        uiEl.value = text;
                        sndEl.disabled = false;
                        // Auto-send en voice mode
                        if (voiceMode) {
                            sendMsg(text);
                        }
                    } else {
                        G('MIC-STATUS').textContent = 'Aucune parole detectee';
                        setTimeout(stopListeningUI, 1500);
                    }
                })['catch'](function() {
                    stopListeningUI();
                });
            };
            reader.readAsArrayBuffer(blob);
        };

        mediaRecorder.start();
        startListeningUI();

    })['catch'](function(err) {
        console.log('[VOICE] Microphone error:', err.message);
        stopListeningUI();
        alert('Impossible d\'acceder au microphone. Verifie les permissions dans Preferences Systeme > Confidentialite > Microphone.');
    });
}

G('MIC').onclick = function() {
    if (isRec) {
        // Deja en ecoute — arreter l'enregistrement (declenche onstop -> transcription)
        voiceMode = true;
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        return;
    }

    // Demarrer l'enregistrement
    voiceMode = true;
    startRecording();
};

// Auto-speak : lire la reponse a voix haute UNIQUEMENT apres un message vocal
var _origFinalizeStream = ETHER_ENGINE._finalizeStreamElement;
ETHER_ENGINE._finalizeStreamElement = function(streamEl, result) {
    _origFinalizeStream.call(ETHER_ENGINE, streamEl, result);
    if (voiceMode && voiceAutoSpeak && result && result.answer) {
        var textToSpeak = (result.answer || '').replace(/<[^>]+>/g, '').trim();
        if (textToSpeak.length > 0 && textToSpeak.length < 2000) {
            speakText(textToSpeak);
        }
        // Desactiver le voice mode apres la lecture — le prochain message texte ne sera pas lu
        voiceMode = false;
    }
};

// PIECE JOINTE — staging (fichier en attente d'envoi avec le prompt)
var stagedFiles = [];

G('ATTACH-BTN').onclick = function() { G('FILE-UP').click(); };
G('FILE-UP').onchange = function() {
    var files = G('FILE-UP').files;
    if (!files || !files.length) return;
    for (var f = 0; f < files.length; f++) {
        stageFile(files[f]);
    }
    G('FILE-UP').value = '';
};

function stageFile(file) {
    // Limite fichiers joints (5/jour gratuit)
    if (!isPro) {
        var fileD = getDaily('files');
        if (fileD.count >= 5) {
            alert('Limite atteinte : 5 fichiers/jour. Passe au Plan Pro pour un acces illimite.');
            return;
        }
        useDaily('files');
    }
    var isImage = file.type.indexOf('image') === 0;
    var ext = file.name.split('.').pop().toLowerCase();
    var size = file.size < 1024 ? file.size + ' o' : file.size < 1048576 ? Math.round(file.size / 1024) + ' Ko' : (file.size / 1048576).toFixed(1) + ' Mo';
    var icons = { pdf: '#ef4444', doc: '#2563eb', docx: '#2563eb', txt: '#6b7280', csv: '#22c55e', xls: '#22c55e', xlsx: '#22c55e', png: '#8b5cf6', jpg: '#8b5cf6', jpeg: '#8b5cf6', gif: '#f59e0b', webp: '#8b5cf6' };
    var iconColor = icons[ext] || '#8b5cf6';

    var entry = { file: file, name: file.name, ext: ext, size: size, isImage: isImage, dataUrl: null, content: null };
    stagedFiles.push(entry);
    var idx = stagedFiles.length - 1;

    // Lire le contenu pour preview et envoi
    if (isImage) {
        var r = new FileReader();
        r.onload = function(e) { entry.dataUrl = e.target.result; renderStagedFiles(); };
        r.readAsDataURL(file);
    } else if (ext === 'txt' || ext === 'csv' || ext === 'md' || ext === 'json' || ext === 'js' || ext === 'html' || ext === 'css' || ext === 'py') {
        var r2 = new FileReader();
        r2.onload = function(e) { entry.content = e.target.result.substring(0, 3000); renderStagedFiles(); };
        r2.readAsText(file);
    } else {
        renderStagedFiles();
    }

    sndEl.disabled = false;
}

function renderStagedFiles() {
    var container = G('STAGED-FILES');
    if (!stagedFiles.length) { container.style.display = 'none'; container.innerHTML = ''; return; }
    container.style.display = 'flex';
    container.innerHTML = '';
    for (var i = 0; i < stagedFiles.length; i++) {
        var sf = stagedFiles[i];
        var icons = { pdf: '#ef4444', doc: '#2563eb', docx: '#2563eb', txt: '#6b7280', csv: '#22c55e', xls: '#22c55e', xlsx: '#22c55e' };
        var iconColor = icons[sf.ext] || '#8b5cf6';
        var el = document.createElement('div');
        el.className = 'staged-file';
        if (sf.isImage && sf.dataUrl) {
            el.innerHTML = '<img class="sf-thumb" src="' + sf.dataUrl + '"><span class="sf-name">' + esc(sf.name) + '</span><span style="font-size:.68rem;color:var(--t3)">' + sf.size + '</span><button class="sf-remove" data-idx="' + i + '">&times;</button>';
        } else {
            el.innerHTML = '<div class="sf-icon" style="background:' + iconColor + '">' + sf.ext.toUpperCase() + '</div><span class="sf-name">' + esc(sf.name) + '</span><span style="font-size:.68rem;color:var(--t3)">' + sf.size + '</span><button class="sf-remove" data-idx="' + i + '">&times;</button>';
        }
        container.appendChild(el);
    }
    // Boutons supprimer
    var rmBtns = container.querySelectorAll('.sf-remove');
    for (var j = 0; j < rmBtns.length; j++) {
        rmBtns[j].onclick = (function(idx) {
            return function(e) {
                e.stopPropagation();
                stagedFiles.splice(idx, 1);
                renderStagedFiles();
                if (!stagedFiles.length && !uiEl.value.trim()) sndEl.disabled = true;
            };
        })(parseInt(rmBtns[j].getAttribute('data-idx')));
    }
}

function clearStagedFiles() {
    stagedFiles = [];
    renderStagedFiles();
}

function processStagedFiles(userPrompt) {
    var filesToProcess = stagedFiles.slice();
    clearStagedFiles();

    for (var f = 0; f < filesToProcess.length; f++) {
        var sf = filesToProcess[f];
        // Afficher le fichier dans le chat
        if (sf.isImage && sf.dataUrl) {
            var d = document.createElement('div'); d.className = 'msg u';
            d.innerHTML = '<div class="mb"><img src="' + sf.dataUrl + '" style="max-width:220px;border-radius:12px;display:block;margin-bottom:6px"><span style="font-size:.78rem;color:rgba(255,255,255,.7)">' + esc(sf.name) + ' - ' + sf.size + '</span></div>';
            G('MG').appendChild(d);
            if (curConv && !isEphemeral) convs[curConv].messages.push({ r: 'u', t: '[Image: ' + sf.name + ']', ts: Date.now() });
        } else {
            var icons2 = { pdf: '#ef4444', doc: '#2563eb', docx: '#2563eb', txt: '#6b7280', csv: '#22c55e', xls: '#22c55e', xlsx: '#22c55e' };
            var iconColor2 = icons2[sf.ext] || '#8b5cf6';
            var d2 = document.createElement('div'); d2.className = 'msg u';
            d2.innerHTML = '<div class="mb"><div style="display:flex;align-items:center;gap:10px;padding:4px 0"><div style="width:36px;height:36px;border-radius:8px;background:' + iconColor2 + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0">' + sf.ext.toUpperCase() + '</div><div><div style="font-size:.85rem">' + esc(sf.name) + '</div><div style="font-size:.72rem;color:rgba(255,255,255,.6)">' + sf.size + '</div></div></div></div>';
            G('MG').appendChild(d2);
            if (curConv && !isEphemeral) convs[curConv].messages.push({ r: 'u', t: '[Fichier: ' + sf.name + ']', ts: Date.now() });
        }
    }

    // Construire le prompt enrichi avec le contenu des fichiers
    var fileContext = '';
    for (var g = 0; g < filesToProcess.length; g++) {
        var sf2 = filesToProcess[g];
        // Desktop files avec content extrait par Electron (PDF, DOCX, etc.)
        var content = sf2.content;
        if (!content && sf2.desktopFile && sf2.desktopFile.content) {
            content = sf2.desktopFile.content;
        }
        if (content) {
            fileContext += '\n\n--- Fichier: ' + sf2.name + ' ---\n' + content.substring(0, 4000);
            // Indexer automatiquement dans le RAG
            if (typeof ragIndexUploadedFile === 'function') {
                ragIndexUploadedFile({ name: sf2.name, content: content });
            }
        } else if (sf2.isImage && sf2.base64 && window.etherDesktop && window.etherDesktop.geminiVision) {
            // Analyser l'image via Gemini Vision
            (function(imgFile, prompt) {
                window.etherDesktop.geminiVision({
                    base64: imgFile.base64,
                    mime: imgFile.mime || 'image/jpeg',
                    prompt: prompt || 'Decris cette image en detail. Que vois-tu ?',
                    systemPrompt: 'Tu es ETHER AI. Analyse cette image et decris-la de maniere detaillee et utile.'
                }).then(function(visionRes) {
                    if (visionRes.ok && visionRes.text) {
                        var visionResp = {
                            reasoning: null,
                            answer: renderMarkdown(visionRes.text),
                            confidence: 'to-verify',
                            sources: ['Gemini Vision'],
                            _showBadge: false,
                            _noSuggestions: false
                        };
                        addAIMsg(visionResp);
                        if (curConv && !isEphemeral) {
                            convs[curConv].messages.push({ r: 'a', d: visionResp, ts: Date.now() });
                            sSet('convs', convs);
                        }
                        scr();
                    }
                })['catch'](function() {});
            })(sf2, userPrompt);
            fileContext += '\n\n[Image analysee par Gemini Vision: ' + sf2.name + ']';
        } else {
            fileContext += '\n\n[Fichier joint: ' + sf2.name + ' (' + sf2.ext.toUpperCase() + ', ' + sf2.size + ')]';
        }
    }

    var fullPrompt = userPrompt || '';
    if (fileContext) {
        if (fullPrompt) {
            fullPrompt = fullPrompt + '\n\nFichiers joints:' + fileContext;
        } else {
            fullPrompt = 'Analyse les fichiers suivants:' + fileContext;
        }
    }

    return fullPrompt;
}

// CONNECTORS
G('CON-BTN').onclick=function(e){
    e.stopPropagation();
    var sub=G('CON-SUB');
    if(!sub.classList.contains('hidden')){sub.classList.add('hidden');return;}
    // Positionner en fixed a cote du menu principal
    var toolsDrop=G('TOOLS-DROP');
    var rect=toolsDrop.getBoundingClientRect();
    sub.classList.remove('hidden');
    var subH=sub.offsetHeight;
    // A droite du menu principal
    var left=rect.right+4;
    if(left+180>window.innerWidth) left=rect.left-180;
    // En bas, aligne avec le bas du menu
    var bottom=window.innerHeight-rect.bottom;
    if(bottom<0) bottom=10;
    sub.style.left=left+'px';
    sub.style.bottom=bottom+'px';
    sub.style.top='auto';
};
// Fermer le sous-menu quand on clique sur un item
G('CON-SUB').onclick=function(){
    G('CON-SUB').classList.add('hidden');
    G('TOOLS-DROP').classList.add('hidden');
};
function convToText(){if(!curConv||!convs[curConv])return'';var c=convs[curConv];var txt='ETHER AI - '+c.title+'\n========\n\n';for(var i=0;i<c.messages.length;i++){var m=c.messages[i];if(m.r==='u')txt+='MOI: '+m.t+'\n\n';else if(m.d)txt+='ETHER: '+(m.d.answer||'').replace(/<[^>]+>/g,'').trim()+'\n\n';}return txt;}
// exportPDF moved below with rich formatting
function exportMD(){if(!curConv){alert('Aucune conversation.');return;}var c=convs[curConv];var md='# ETHER - '+c.title+'\n\n';for(var i=0;i<c.messages.length;i++){var m=c.messages[i];if(m.r==='u')md+='**Moi:** '+m.t+'\n\n';else if(m.d)md+='**ETHER:** '+(m.d.answer||'').replace(/<[^>]+>/g,'')+'\n\n---\n\n';}downloadFile('ether.md',md,'text/markdown');}
function exportJSON(){downloadFile('ether-backup.json',JSON.stringify({convs:convs,projs:projs,user:user}),'application/json');}
G('IMP-F').onchange=function(){var f=G('IMP-F').files[0];if(!f)return;var r=new FileReader();r.onload=function(e){try{var d=JSON.parse(e.target.result);if(d.convs){var ct=0;for(var id in d.convs){if(!convs[id]){convs[id]=d.convs[id];ct++;}}sSet('convs',convs);updHist();alert(ct+' conversation(s) importee(s).');}else alert('Fichier invalide.');}catch(ex){alert('Erreur.');}};r.readAsText(f);G('IMP-F').value='';};
function shareTwitter(){if(!curConv)return;var c=convs[curConv];var t='';for(var i=c.messages.length-1;i>=0;i--){if(c.messages[i].r==='a'&&c.messages[i].d){t=(c.messages[i].d.answer||'').replace(/<[^>]+>/g,'').substring(0,200);break;}}window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent('ETHER AI: '+t),'_blank');}
function shareWhatsApp(){if(!curConv)return;window.open('https://wa.me/?text='+encodeURIComponent(convToText().substring(0,2000)),'_blank');}
function sendGmail(){if(!curConv)return;var c=convs[curConv];window.open('https://mail.google.com/mail/?view=cm&fs=1&su='+encodeURIComponent('ETHER - '+c.title)+'&body='+encodeURIComponent(convToText()),'_blank');}
function sendHotmail(){if(!curConv)return;var c=convs[curConv];window.open('https://outlook.live.com/mail/0/deeplink/compose?subject='+encodeURIComponent('ETHER - '+c.title)+'&body='+encodeURIComponent(convToText()),'_blank');}
function sendEmail(){if(!curConv)return;var c=convs[curConv];window.location.href='mailto:?subject='+encodeURIComponent('ETHER - '+c.title)+'&body='+encodeURIComponent(convToText());}
function shareLinkConv(){if(!curConv)return;var d={title:convs[curConv].title,messages:convs[curConv].messages};var url=location.href.split('?')[0]+'?share='+btoa(unescape(encodeURIComponent(JSON.stringify(d))));if(navigator.clipboard){navigator.clipboard.writeText(url);alert('Lien copie!');}else prompt('Copie:',url);}
function downloadFile(name,content,type){var b=new Blob([content],{type:type});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);},100);}

// Load shared conversation from URL
(function(){try{var p=new URLSearchParams(location.search);var s=p.get('share');if(s){var d=JSON.parse(decodeURIComponent(escape(atob(s))));if(d.messages){var id='sh_'+Date.now();convs[id]={title:'[Partage] '+(d.title||'Conv'),messages:d.messages,ts:new Date().toISOString()};sSet('convs',convs);if(user){loadConv(id);updHist();}}}}catch(e){}})();

// PRO
// QUOTA / ADS
G('QUOTA-AD-BTN').onclick = function() { showAdModal(); };
G('AD-X').onclick = function() { G('AD-MODAL').classList.add('hidden'); };
G('AD-MODAL').querySelector('.modal-bk').onclick = function() { G('AD-MODAL').classList.add('hidden'); };
G('AD-CLAIM').onclick = function() { claimAdReward(); };
updQuotaUI();

G('PRO-BTN').onclick=function(){if(isPro)return;G('PRO-M').classList.remove('hidden');};
G('PRO-X').onclick=function(){G('PRO-M').classList.add('hidden');};
G('PRO-M').querySelector('.modal-bk').onclick=function(){G('PRO-M').classList.add('hidden');};
G('BUY-PRO').onclick=function(){if(confirm('Demo: Activer le mode Pro?')){isPro=true;sSet('pro',true);updPlanUI();G('PRO-M').classList.add('hidden');}};
function updPlanUI(){
    var b=G('plan-badge');var d=G('plan-desc');var pb=G('PRO-BTN');var fb=G('FREE-BTN');
    if(isPro){
        b.textContent='Pro';b.style.background='linear-gradient(135deg,#f59e0b,#ef4444)';b.style.color='#fff';b.style.border='none';
        d.textContent='Images illimitees, reponses longues';
        pb.textContent='Vous etes Pro!';pb.style.opacity='0.5';pb.style.cursor='default';
        fb.style.display='block';
        var n=G('UNM');if(n&&n.innerHTML.indexOf('pro-badge')===-1)n.innerHTML=esc(user?user.name:'')+'<span class="pro-badge">PRO</span>';
    } else {
        b.textContent='Gratuit';b.style.background='var(--b3)';b.style.color='var(--t2)';b.style.border='1px solid var(--bd)';
        d.textContent='5 images/jour, reponses standard';
        pb.textContent='Passer a ETHER Pro';pb.style.opacity='1';pb.style.cursor='pointer';
        fb.style.display='none';
        var n=G('UNM');if(n&&user)n.textContent=user.name;
    }
    updImgCount();
    updQuotaUI();
    if(typeof updDeepThinkBtn==='function') updDeepThinkBtn();
    if(typeof updLearnBtn==='function') updLearnBtn();
}
G('FREE-BTN').onclick=function(){
    if(confirm('Revenir au forfait Gratuit? Vous perdrez les avantages Pro (images illimitees, etc.).')){
        isPro=false;sSet('pro',false);updPlanUI();
    }
};
updPlanUI();

// API TEST
// (bouton Tester API supprime — le test se fait via checkApiStatus)

// === FOURNISSEURS IA v2 ===
// Toggle ouverture des cartes provider
var provCards = document.querySelectorAll('.prov-card');
for (var pci = 0; pci < provCards.length; pci++) {
    provCards[pci].onclick = function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('a')) return;
        this.classList.toggle('open');
    };
}

// Voir/masquer les cles
function toggleKeyVis(btn) {
    var input = btn.parentNode.querySelector('.prov-key-input');
    if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Masquer'; }
    else { input.type = 'password'; btn.textContent = 'Voir'; }
}

// Toggle API key visibility
function toggleApiKeyVis() {
    var input = G('API-KEY-DISPLAY');
    var btn = G('API-KEY-VIS');
    if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Masquer'; }
    else { input.type = 'password'; btn.textContent = 'Voir'; }
}

// Charger les cles sauvegardees
function loadProviderKeys() {
    var keys = sGet('provider_keys', {});
    if (keys.groq) G('KEY-GROQ').value = keys.groq;
    if (keys.gemini) G('KEY-GEMINI').value = keys.gemini;
    if (keys.cerebras) G('KEY-CEREBRAS').value = keys.cerebras;
    if (keys.openai) G('KEY-OPENAI').value = keys.openai;
    if (keys.anthropic) G('KEY-ANTHROPIC').value = keys.anthropic;
    // Custom
    var cust = sGet('custom_provider', {});
    if (cust.name) G('CUST-NAME').value = cust.name;
    if (cust.url) G('CUST-URL').value = cust.url;
    if (cust.key) G('KEY-CUSTOM').value = cust.key;
    if (cust.model) G('CUST-MODEL').value = cust.model;
    updProviderStatuses();
}

// Sauvegarder les cles
G('SAVE-KEYS').onclick = function() {
    var keys = {
        groq: G('KEY-GROQ').value.trim(),
        gemini: G('KEY-GEMINI').value.trim(),
        cerebras: G('KEY-CEREBRAS').value.trim(),
        openai: G('KEY-OPENAI').value.trim(),
        anthropic: G('KEY-ANTHROPIC').value.trim()
    };
    sSet('provider_keys', keys);
    sSet('custom_provider', {
        name: G('CUST-NAME').value.trim(),
        url: G('CUST-URL').value.trim(),
        key: G('KEY-CUSTOM').value.trim(),
        model: G('CUST-MODEL').value.trim()
    });
    // Mettre a jour les cles dans main.js
    if (window.etherDesktop && window.etherDesktop.setGroqKey && keys.groq) {
        window.etherDesktop.setGroqKey(keys.groq);
    }
    updProviderStatuses();
    var btn = G('SAVE-KEYS');
    btn.textContent = 'Sauvegarde !';
    btn.style.background = '#22c55e';
    setTimeout(function() { btn.textContent = 'Sauvegarder les cles'; btn.style.background = ''; }, 1500);
};

function updProviderStatuses() {
    // Providers principaux avec cles integrees
    var mainProviders = ['gemini', 'cerebras', 'groq'];
    for (var i = 0; i < mainProviders.length; i++) {
        var p = mainProviders[i];
        var statusEl = G('PROV-' + p.toUpperCase() + '-STATUS');
        if (!statusEl) continue;
        if (providerStatus[p]) {
            statusEl.innerHTML = '<span class="prov-dot prov-dot-green"></span>Actif';
        } else {
            statusEl.innerHTML = '<span class="prov-dot prov-dot-orange"></span>Rate limit';
        }
    }
    // Providers optionnels
    var keys = sGet('provider_keys', {});
    var optProviders = ['openai', 'anthropic'];
    for (var j = 0; j < optProviders.length; j++) {
        var op = optProviders[j];
        var opEl = G('PROV-' + op.toUpperCase() + '-STATUS');
        if (!opEl) continue;
        if (keys[op]) {
            opEl.innerHTML = '<span class="prov-dot prov-dot-orange"></span>Configure';
        } else {
            opEl.innerHTML = '<span class="prov-dot prov-dot-gray"></span>Non configure';
        }
    }
    // Custom
    var cust = sGet('custom_provider', {});
    var custStatus = G('PROV-CUSTOM-STATUS');
    if (custStatus) {
        if (cust.url && cust.model) {
            custStatus.innerHTML = '<span class="prov-dot prov-dot-orange"></span>' + esc(cust.name || 'Configure');
        } else {
            custStatus.innerHTML = '<span class="prov-dot prov-dot-gray"></span>Non configure';
        }
    }
}

function testProvider(provider) {
    var statusEl = G('PROV-' + provider.toUpperCase() + '-STATUS');
    if (!statusEl) return;
    statusEl.innerHTML = '<span class="prov-dot prov-dot-orange"></span>Test...';

    if (provider === 'groq') {
        testApiKey().then(function(r) {
            if (r.apiWorks) {
                statusEl.innerHTML = '<span class="prov-dot prov-dot-green"></span>' + r.count + ' modeles actifs';
            } else {
                statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur';
            }
        });
    } else if (provider === 'custom') {
        // Test fournisseur personnalise
        var custUrl = G('CUST-URL').value.trim();
        var custKey = G('KEY-CUSTOM').value.trim();
        var custModel = G('CUST-MODEL').value.trim();
        if (!custUrl || !custModel) { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>URL et modele requis'; return; }
        var testUrl = custUrl.replace(/\/+$/, '') + '/chat/completions';
        var xhr2 = new XMLHttpRequest();
        xhr2.open('POST', testUrl, true);
        xhr2.setRequestHeader('Content-Type', 'application/json');
        if (custKey) xhr2.setRequestHeader('Authorization', 'Bearer ' + custKey);
        xhr2.timeout = 10000;
        xhr2.onload = function() {
            if (xhr2.status === 200) {
                statusEl.innerHTML = '<span class="prov-dot prov-dot-green"></span>Actif — ' + esc(custModel);
            } else {
                statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur ' + xhr2.status;
            }
        };
        xhr2.onerror = function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur reseau'; };
        xhr2.ontimeout = function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Timeout'; };
        xhr2.send(JSON.stringify({ model: custModel, messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }));
    } else {
        var keyInput = G('KEY-' + provider.toUpperCase());
        var key = keyInput ? keyInput.value.trim() : '';
        if (!key) { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Cle manquante'; return; }

        var testConfigs = {
            openai: { url: 'https://api.openai.com/v1/models', auth: 'Bearer ' + key },
            anthropic: { url: 'https://api.anthropic.com/v1/messages', auth: key, custom: true },
            google: { url: 'https://generativelanguage.googleapis.com/v1beta/models?key=' + key, auth: '' }
        };
        var cfg = testConfigs[provider];
        if (!cfg) return;

        var xhr = new XMLHttpRequest();
        xhr.open('GET', cfg.url, true);
        if (cfg.auth && !cfg.custom) xhr.setRequestHeader('Authorization', cfg.auth);
        if (cfg.custom) {
            xhr.setRequestHeader('x-api-key', key);
            xhr.setRequestHeader('anthropic-version', '2023-06-01');
        }
        xhr.timeout = 8000;
        xhr.onload = function() {
            if (xhr.status === 200 || xhr.status === 401) {
                if (xhr.status === 200) {
                    statusEl.innerHTML = '<span class="prov-dot prov-dot-green"></span>Actif';
                } else {
                    statusEl.innerHTML = '<span class="prov-dot prov-dot-orange"></span>Cle reconnue';
                }
            } else {
                statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur ' + xhr.status;
            }
        };
        xhr.onerror = function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur reseau'; };
        xhr.ontimeout = function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Timeout'; };
        xhr.send();
    }
}

loadProviderKeys();

// === API KEY ===
function generateApiKey() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var key = 'ether_';
    for (var i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
}

function updApiUI() {
    var key = sGet('apikey', null);
    if (key) {
        G('API-KEY-DISPLAY').value = key;
        G('API-KEY-DISPLAY').type = 'password';
        G('DEL-API').style.display = 'flex';
        G('GEN-API').innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg> Regenerer';
    } else {
        G('API-KEY-DISPLAY').value = 'Aucune cle generee';
        G('API-KEY-DISPLAY').type = 'text';
        G('DEL-API').style.display = 'none';
        G('GEN-API').innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Generer';
    }
}

G('GEN-API').onclick = function() {
    var key = generateApiKey();
    sSet('apikey', key);
    if (window.etherDesktop && window.etherDesktop.setApiKey) window.etherDesktop.setApiKey(key);
    updApiUI();
};

G('DEL-API').onclick = function() {
    if (!confirm('Revoquer cette cle API ? Les services connectes ne fonctionneront plus.')) return;
    sSet('apikey', null);
    if (window.etherDesktop && window.etherDesktop.setApiKey) window.etherDesktop.setApiKey(null);
    updApiUI();
};

// Synchroniser la cle au demarrage
(function() {
    var existingKey = sGet('apikey', null);
    if (existingKey && window.etherDesktop && window.etherDesktop.setApiKey) {
        window.etherDesktop.setApiKey(existingKey);
    }
})();

G('COPY-API').onclick = function() {
    var key = sGet('apikey', null);
    if (!key) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(key);
        G('COPY-API').textContent = 'Copie !';
        setTimeout(function() { G('COPY-API').textContent = 'Copier'; }, 1500);
    }
};

updApiUI();

// === RESEAU LOCAL ===
G('NET-TOGGLE').onchange = function() {
    var enabled = G('NET-TOGGLE').checked;
    sSet('network_mode', enabled);
    if (window.etherDesktop && window.etherDesktop.setNetworkMode) {
        window.etherDesktop.setNetworkMode(enabled);
    }
    if (enabled) {
        if (window.etherDesktop && window.etherDesktop.getLocalIp) {
            window.etherDesktop.getLocalIp().then(function(ip) {
                G('NET-URL').textContent = 'http://' + ip + ':3456';
                G('NET-URL').classList.add('vis');
            });
        } else {
            G('NET-URL').textContent = 'http://192.168.1.X:3456';
            G('NET-URL').classList.add('vis');
        }
    } else {
        G('NET-URL').classList.remove('vis');
    }
};

// Restaurer l'etat du toggle reseau
(function() {
    var netMode = sGet('network_mode', false);
    if (netMode) {
        G('NET-TOGGLE').checked = true;
        G('NET-TOGGLE').onchange();
    }
})();

// === ETHER — Features (accounts, ephemeral, teacher, tabs, shortcuts, etc.) ===

// === DECONNEXION ===
G('LOGOUT').onclick = function() {
    if (!confirm('Se deconnecter ?')) return;
    // Sauvegarder le compte actuel dans la liste des comptes
    var accounts = sGet('accounts', []);
    var found = false;
    for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].name === user.name) { found = true; break; }
    }
    if (!found) { accounts.push(user); sSet('accounts', accounts); }
    sSet('user', null);
    G('SM').classList.add('hidden');
    location.reload();
};

// === MULTI-COMPTES ===
G('ADD-ACC').onclick = function() {
    // Sauvegarder le compte actuel
    var accounts = sGet('accounts', []);
    var found = false;
    for (var i = 0; i < accounts.length; i++) {
        if (accounts[i].name === user.name) { found = true; break; }
    }
    if (!found) { accounts.push(user); sSet('accounts', accounts); }
    // Deconnecter et montrer le login
    sSet('user', null);
    G('SM').classList.add('hidden');
    location.reload();
};

G('SWITCH-ACC').onclick = function() {
    var accounts = sGet('accounts', []);
    if (accounts.length < 2) { alert('Un seul compte enregistre.'); return; }
    var list = '';
    for (var i = 0; i < accounts.length; i++) {
        list += (i + 1) + '. ' + accounts[i].name + (accounts[i].name === user.name ? ' (actuel)' : '') + '\n';
    }
    var choice = prompt('Changer de compte :\n\n' + list + '\nTape le numero :');
    if (!choice) return;
    var idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= accounts.length) return;
    user = accounts[idx];
    sSet('user', user);
    location.reload();
};

// Afficher le bouton switch si plusieurs comptes
function updAccountUI() {
    var accounts = sGet('accounts', []);
    G('SWITCH-ACC').style.display = accounts.length > 1 ? 'block' : 'none';
}
updAccountUI();


// === CHAT EPHEMERE ===
var isEphemeral = false;

function updEphStyle() {
    if (isEphemeral) {
        G('ECB').style.background = 'rgba(245,158,11,.15)';
        G('ECB').style.color = '#f59e0b';
        G('ECB').style.borderColor = 'rgba(245,158,11,.4)';
        // Colorer les messages en orange
        var allMsgs = G('MG').querySelectorAll('.msg.u .mb');
        for (var i = 0; i < allMsgs.length; i++) allMsgs[i].style.background = '#b45309';
    } else {
        G('ECB').style.background = 'var(--b3)';
        G('ECB').style.color = 'var(--t3)';
        G('ECB').style.borderColor = 'var(--bd)';
        // Remettre les couleurs normales
        var allMsgs = G('MG').querySelectorAll('.msg.u .mb');
        for (var i = 0; i < allMsgs.length; i++) allMsgs[i].style.background = '';
    }
}

G('ECB').onclick = function() {
    if (isEphemeral) {
        // Desactiver le mode ephemere — sauvegarder la discussion en cours
        isEphemeral = false;
        G('EPH-BAR').classList.add('hidden');
        G('SAVE-BAR').classList.remove('hidden');
        setTimeout(function(){ G('SAVE-BAR').classList.add('hidden'); }, 3000);
        updEphStyle();
        // Sauvegarder les messages visibles si pas encore de conversation
        if (G('MG').querySelectorAll('.msg').length > 0 && !curConv) {
            var msgs = [];
            var msgEls = G('MG').querySelectorAll('.msg');
            for (var i = 0; i < msgEls.length; i++) {
                var el = msgEls[i];
                if (el.classList.contains('u')) {
                    var mb = el.querySelector('.mb');
                    if (mb) msgs.push({ r: 'u', t: mb.textContent, ts: Date.now() });
                } else if (el.classList.contains('a') && el._etherData) {
                    msgs.push({ r: 'a', d: el._etherData, ts: Date.now() });
                }
            }
            if (msgs.length > 0) {
                var firstUserMsg = '';
                for (var j = 0; j < msgs.length; j++) { if (msgs[j].r === 'u') { firstUserMsg = msgs[j].t; break; } }
                var id = 'c' + Date.now();
                convs[id] = { title: (firstUserMsg || 'Discussion').substring(0, 45), messages: msgs, projectId: curProj, ts: new Date().toISOString() };
                curConv = id;
                sSet('convs', convs);
                updHist();
            }
        }
        return;
    }
    // Activer le mode ephemere sur la discussion active (sans effacer)
    isEphemeral = true;
    // Supprimer de l'historique si c'etait une discussion sauvegardee
    if (curConv && convs[curConv]) {
        delete convs[curConv];
        sSet('convs', convs);
        curConv = null;
        updHist();
    }
    G('SAVE-BAR').classList.add('hidden');
    G('EPH-BAR').classList.remove('hidden');
    setTimeout(function(){ G('EPH-BAR').classList.add('hidden'); }, 3000);
    updEphStyle();
};

function endEphemeral() {
    // Sauvegarder le chat ephemere dans l'historique
    if (curConv && convs[curConv]) {
        // Deja sauvegarde
    } else if (G('MG').querySelectorAll('.msg').length > 0) {
        var id = 'c' + Date.now();
        var msgs = [];
        var msgEls = G('MG').querySelectorAll('.msg');
        for (var i = 0; i < msgEls.length; i++) {
            var el = msgEls[i];
            if (el.classList.contains('u')) {
                var mb = el.querySelector('.mb');
                if (mb) msgs.push({ r: 'u', t: mb.textContent, ts: Date.now() });
            }
        }
        if (msgs.length > 0) {
            convs[id] = { title: msgs[0].t.substring(0, 45), messages: msgs, ts: new Date().toISOString() };
            curConv = id;
            sSet('convs', convs);
            updHist();
        }
    }
    isEphemeral = false;
    G('EPH-BAR').classList.add('hidden');
    G('SAVE-BAR').classList.remove('hidden');
}

function makeEphemeral() {
    // Rendre le chat actuel ephemere (supprimer de l'historique)
    if (curConv && convs[curConv]) {
        delete convs[curConv];
        sSet('convs', convs);
        curConv = null;
        updHist();
    }
    isEphemeral = true;
    G('SAVE-BAR').classList.add('hidden');
    G('EPH-BAR').classList.remove('hidden');
}

// Override sendMsg pour le mode ephemere : ne pas sauvegarder
var origSendMsg = sendMsg;
// On modifie sendMsg pour gerer l'ephemere
// (deja gere car si isEphemeral et pas de curConv, on ne cree pas de conv)


// === REFERENCE D'AUTRES CHATS ===
G('REF-BTN').onclick = function() {
    G('TOOLS-DROP').classList.add('hidden'); G('DOC-P').classList.add('hidden'); 
    var panel = G('REF-P');
    if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
    // Lister les conversations
    var ids = Object.keys(convs).sort(function(a, b) { return convs[b].ts > convs[a].ts ? 1 : -1; });
    var list = G('REF-LIST');
    if (!ids.length) { list.innerHTML = '<div class="il-e">Aucune discussion</div>'; panel.classList.remove('hidden'); return; }
    var h = '';
    for (var i = 0; i < Math.min(ids.length, 15); i++) {
        var id = ids[i];
        if (id === curConv) continue; // Ne pas lister le chat actuel
        var lastMsg = '';
        var msgs = convs[id].messages;
        for (var j = msgs.length - 1; j >= 0; j--) {
            if (msgs[j].r === 'a' && msgs[j].d) {
                lastMsg = (msgs[j].d.answer || '').replace(/<[^>]+>/g, '').substring(0, 60);
                break;
            }
        }
        h += '<div class="ref-item" data-id="' + id + '"><svg viewBox="0 0 24 24" width="16" height="16" style="flex-shrink:0;color:var(--t3)"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/></svg><span><strong>' + esc(convs[id].title) + '</strong><br><span style="font-size:.72rem;color:var(--t3)">' + esc(lastMsg) + '</span></span></div>';
    }
    list.innerHTML = h;
    var items = list.querySelectorAll('.ref-item');
    for (var i = 0; i < items.length; i++) {
        items[i].onclick = (function(el) {
            return function() {
                var refId = el.getAttribute('data-id');
                insertReference(refId);
                G('REF-P').classList.add('hidden');
            };
        })(items[i]);
    }
    panel.classList.remove('hidden');
};

function insertReference(refId) {
    if (!convs[refId]) return;
    // Construire un resume du chat reference
    var c = convs[refId];
    var summary = '';
    for (var i = 0; i < c.messages.length; i++) {
        var m = c.messages[i];
        if (m.r === 'u') summary += 'User: ' + m.t + '\n';
        else if (m.d) summary += 'ETHER: ' + (m.d.answer || '').replace(/<[^>]+>/g, '').substring(0, 200) + '\n';
    }
    // Ajouter le contexte dans le textarea
    var prefix = '[Contexte de "' + c.title + '"]: ';
    uiEl.value = prefix + uiEl.value;
    uiEl.focus();
    sndEl.disabled = false;

    // Stocker le contexte pour l'envoyer avec le prochain message
    ETHER_ENGINE.conversationHistory.push({
        role: 'user',
        content: 'Voici le contexte d\'une discussion precedente intitulee "' + c.title + '":\n' + summary
    });
    ETHER_ENGINE.conversationHistory.push({
        role: 'assistant',
        content: 'Compris, j\'ai pris en compte le contexte de la discussion "' + c.title + '". Je peux maintenant repondre en tenant compte de ces informations.'
    });
}


// === SUIVI D'APPRENTISSAGE (Pro) ===
var learnData = sGet('learn', { sessions: [], xp: 0, days: {} });

// Afficher/masquer le bouton suivi selon le plan
function updLearnBtn() {
    G('LEARN-BTN').style.display = isPro ? 'inline-block' : 'none';
}

// Tracker une session teacher (appele apres chaque reponse en mode teacher)
function trackTeacherSession(question) {
    if (!isPro) return;
    var today = new Date().toISOString().slice(0, 10);
    learnData.days[today] = (learnData.days[today] || 0) + 1;
    learnData.xp += 10;
    // Extraire le sujet (premiers mots)
    var topic = question.substring(0, 40);
    learnData.sessions.push({ topic: topic, date: today, ts: Date.now() });
    // Garder les 50 dernieres sessions
    if (learnData.sessions.length > 50) learnData.sessions = learnData.sessions.slice(-50);
    sSet('learn', learnData);
}

// Ouvrir le dashboard
G('LEARN-BTN').onclick = function() {
    if (!isPro) { alert('Fonctionnalite Pro'); return; }
    updLearnDashboard();
    G('LEARN').classList.remove('hidden');
};
G('LEARN-X').onclick = function() { G('LEARN').classList.add('hidden'); };
G('LEARN').querySelector('.modal-bk').onclick = function() { G('LEARN').classList.add('hidden'); };

function updLearnDashboard() {
    var sessions = learnData.sessions;
    var xp = learnData.xp;
    var days = Object.keys(learnData.days);

    // Stats
    G('learn-total').textContent = sessions.length;
    var totalQ = 0;
    for (var d in learnData.days) totalQ += learnData.days[d];
    G('learn-questions').textContent = totalQ;
    G('learn-streak').textContent = days.length;

    // Niveau
    var levels = [
        { name: 'Debutant', min: 0 },
        { name: 'Apprenti', min: 50 },
        { name: 'Intermediaire', min: 150 },
        { name: 'Avance', min: 350 },
        { name: 'Expert', min: 700 },
        { name: 'Maitre', min: 1200 }
    ];
    var curLevel = levels[0];
    var nextLevel = levels[1];
    for (var i = 0; i < levels.length; i++) {
        if (xp >= levels[i].min) {
            curLevel = levels[i];
            nextLevel = levels[i + 1] || { name: 'Max', min: curLevel.min + 500 };
        }
    }
    G('learn-level').textContent = curLevel.name;
    G('learn-xp').textContent = xp + ' XP';
    var progress = (xp - curLevel.min) / (nextLevel.min - curLevel.min) * 100;
    if (progress > 100) progress = 100;
    G('learn-bar').style.width = progress + '%';
    G('learn-next').textContent = (xp - curLevel.min) + ' / ' + (nextLevel.min - curLevel.min) + ' XP pour ' + nextLevel.name;

    // Sujets (extraire les mots uniques)
    var topicMap = {};
    for (var i = 0; i < sessions.length; i++) {
        var words = sessions[i].topic.toLowerCase().split(/\s+/);
        for (var j = 0; j < words.length; j++) {
            var w = words[j];
            if (w.length > 3) topicMap[w] = (topicMap[w] || 0) + 1;
        }
    }
    var topicsSorted = Object.keys(topicMap).sort(function(a, b) { return topicMap[b] - topicMap[a]; });
    var topicsHtml = '';
    for (var i = 0; i < Math.min(topicsSorted.length, 12); i++) {
        var t = topicsSorted[i];
        topicsHtml += '<span style="padding:4px 10px;border-radius:20px;font-size:.76rem;background:var(--b3);border:1px solid var(--bd);color:var(--t2)">' + t + ' <span style="color:var(--ac)">' + topicMap[t] + '</span></span>';
    }
    G('learn-topics').innerHTML = topicsHtml || '<span class="il-e">Aucun sujet</span>';

    // Historique recent
    var histHtml = '';
    var recent = sessions.slice(-8).reverse();
    for (var i = 0; i < recent.length; i++) {
        var s = recent[i];
        var d = new Date(s.ts);
        var dateStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        histHtml += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd);font-size:.82rem"><svg viewBox="0 0 24 24" width="16" height="16" style="flex-shrink:0;color:var(--ac)"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" fill="currentColor"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t2)">' + s.topic + '</span><span style="font-size:.7rem;color:var(--t3);flex-shrink:0">' + dateStr + '</span></div>';
    }
    G('learn-history').innerHTML = histHtml || '<span class="il-e">Aucune session</span>';
}

updLearnBtn();


// === DRAG & DROP ===
var dropZone = G('DROP-ZONE');
var dragCounter = 0;

document.addEventListener('dragenter', function(e) {
    e.preventDefault();
    dragCounter++;
    dropZone.classList.add('vis');
});

document.addEventListener('dragleave', function(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) { dropZone.classList.remove('vis'); dragCounter = 0; }
});

document.addEventListener('dragover', function(e) {
    e.preventDefault();
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    dragCounter = 0;
    dropZone.classList.remove('vis');
    var files = e.dataTransfer.files;
    if (files && files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            handleFile(files[i]);
        }
    }
});

// Aussi le drop directement sur la zone de messages
G('MG').addEventListener('dragover', function(e) { e.preventDefault(); });
G('MG').addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropZone.classList.remove('vis');
    var files = e.dataTransfer.files;
    if (files && files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            handleFile(files[i]);
        }
    }
});


// === NOTIFICATIONS BUREAU ===
// === AUTO-UPDATE UI ===
if (window.etherDesktop) {
    if (window.etherDesktop.onUpdateAvailable) {
        window.etherDesktop.onUpdateAvailable(function(version) {
            showKbHint('Mise a jour v' + version + ' en cours de telechargement...');
        });
    }
    if (window.etherDesktop.onUpdateDownloaded) {
        window.etherDesktop.onUpdateDownloaded(function(version) {
            // Afficher un bandeau persistant
            var bar = document.createElement('div');
            bar.id = 'UPDATE-BAR';
            bar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 16px;background:linear-gradient(135deg,rgba(34,197,94,.1),rgba(34,197,94,.05));color:#22c55e;font-size:.82rem;font-weight:500;flex-shrink:0;border-bottom:1px solid rgba(34,197,94,.2)';
            bar.innerHTML = '<span>ETHER v' + version + ' est pret a installer</span><button onclick="if(window.etherDesktop)window.etherDesktop.installUpdate()" style="padding:4px 14px;border:1px solid #22c55e;border-radius:8px;background:rgba(34,197,94,.1);color:#22c55e;cursor:pointer;font-size:.78rem;font-weight:600">Redemarrer</button><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#22c55e;cursor:pointer;opacity:.5;font-size:1.1rem">&times;</button>';
            var statusBar = G('API-STATUS-BAR');
            if (statusBar) statusBar.parentNode.insertBefore(bar, statusBar);
        });
    }
}

// === NOTIFICATIONS DESKTOP ===
var windowHasFocus = true;

function requestNotifPermission() {
    if (window.Notification && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}
requestNotifPermission();

// Tracker le focus via Electron IPC
if (window.etherDesktop && window.etherDesktop.onFocusState) {
    window.etherDesktop.onFocusState(function(focused) {
        windowHasFocus = focused;
    });
}
// Fallback via document visibility
document.addEventListener('visibilitychange', function() {
    if (document.hidden) windowHasFocus = false;
    else windowHasFocus = true;
});

function sendNotif(title, body) {
    if (!windowHasFocus && window.Notification && Notification.permission === 'granted') {
        var n = new Notification(title, {
            body: body,
            silent: false,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23c94a3f"/><text x="50" y="65" text-anchor="middle" fill="white" font-size="45" font-weight="bold">E</text></svg>'
        });
        // Quand l'utilisateur clique sur la notification, focus la fenetre
        n.onclick = function() { window.focus(); n.close(); };
        // Auto-close apres 5s
        setTimeout(function() { n.close(); }, 5000);
    }
}


// === MODEL SELECTOR ===
var selectedModelOverride = null; // null = auto, sinon { provider, model }
var modelNames = {
    'auto': 'Auto',
    'llama-3.3-70b-versatile': 'Llama 3.3 70B',
    'qwen/qwen3-32b': 'Qwen3 32B',
    'llama-3.1-8b-instant': 'Llama 8B',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-flash-lite': 'Gemini Flash Lite',
    'qwen-3-235b-a22b-instruct-2507': 'Qwen 235B (Cerebras)'
};

G('MODEL-SEL-BTN').onclick = function(e) {
    e.stopPropagation();
    var drop = G('MODEL-DROP');
    drop.classList.toggle('hidden');
    // Charger les modeles utilisateur
    populateUserModels();
};

// Fermer le dropdown quand on clique ailleurs
document.addEventListener('click', function(e) {
    var drop = G('MODEL-DROP');
    if (drop && !drop.classList.contains('hidden') && !drop.contains(e.target) && e.target.id !== 'MODEL-SEL-BTN') {
        drop.classList.add('hidden');
    }
});

function selectModel(btn) {
    var provider = btn.getAttribute('data-provider');
    var model = btn.getAttribute('data-model');
    // Retirer .on de tous
    var opts = document.querySelectorAll('.model-opt');
    for (var i = 0; i < opts.length; i++) opts[i].classList.remove('on');
    btn.classList.add('on');

    if (provider === 'auto') {
        selectedModelOverride = null;
        G('MODEL-SEL-LABEL').textContent = 'Auto';
    } else {
        selectedModelOverride = { provider: provider, model: model };
        G('MODEL-SEL-LABEL').textContent = modelNames[model] || model;
    }
    G('MODEL-DROP').classList.add('hidden');
}

function populateUserModels() {
    var container = G('MODEL-DROP-USER');
    var keys = sGet('provider_keys', {});
    var hasUserModels = false;
    // Reset
    container.innerHTML = '<div style="padding:6px 10px 4px;font-size:.64rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-top:4px">Vos modeles</div>';

    // OpenAI
    if (keys.openai) {
        hasUserModels = true;
        var oaModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'];
        for (var i = 0; i < oaModels.length; i++) {
            var m = oaModels[i];
            var isOn = selectedModelOverride && selectedModelOverride.provider === 'openai' && selectedModelOverride.model === m;
            container.innerHTML += '<button class="model-opt' + (isOn ? ' on' : '') + '" data-provider="openai" data-model="' + m + '" onclick="selectModel(this)"><div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:#000;flex-shrink:0"></span><span style="font-weight:600;font-size:.84rem">' + m + '</span></div><span style="font-size:.7rem;color:var(--t3)">OpenAI</span></button>';
        }
    }
    // Anthropic
    if (keys.anthropic) {
        hasUserModels = true;
        var anModels = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
        var anNames = ['Claude Sonnet 4.6', 'Claude Haiku 4.5'];
        for (var j = 0; j < anModels.length; j++) {
            var am = anModels[j];
            var isOnA = selectedModelOverride && selectedModelOverride.provider === 'anthropic' && selectedModelOverride.model === am;
            container.innerHTML += '<button class="model-opt' + (isOnA ? ' on' : '') + '" data-provider="anthropic" data-model="' + am + '" onclick="selectModel(this)"><div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:#d4a373;flex-shrink:0"></span><span style="font-weight:600;font-size:.84rem">' + anNames[j] + '</span></div><span style="font-size:.7rem;color:var(--t3)">Anthropic</span></button>';
        }
    }
    // Custom
    var cust = sGet('custom_provider', {});
    if (cust.url && cust.model) {
        hasUserModels = true;
        var isOnC = selectedModelOverride && selectedModelOverride.provider === 'custom' && selectedModelOverride.model === cust.model;
        container.innerHTML += '<button class="model-opt' + (isOnC ? ' on' : '') + '" data-provider="custom" data-model="' + esc(cust.model) + '" onclick="selectModel(this)"><div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:var(--t3);flex-shrink:0"></span><span style="font-weight:600;font-size:.84rem">' + esc(cust.name || cust.model) + '</span></div><span style="font-size:.7rem;color:var(--t3)">Personnalise</span></button>';
    }
    container.style.display = hasUserModels ? 'block' : 'none';
}


// === MULTI-TAB CONVERSATIONS ===
var openTabs = []; // [ { id: convId|null, scrollPos: 0 } ]
var activeTabIdx = 0;
var MAX_TABS = 5;

function initTabs() {
    openTabs = [{ id: curConv, scrollPos: 0 }];
    activeTabIdx = 0;
    renderTabs();
}

function renderTabs() {
    var container = G('CONV-TABS');
    if (!container) return;
    // Ne montrer les onglets que s'il y en a > 1
    if (openTabs.length <= 1) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    var html = '';
    for (var i = 0; i < openTabs.length; i++) {
        var tab = openTabs[i];
        var title = 'Nouveau chat';
        if (tab.id && convs[tab.id]) {
            title = convs[tab.id].title || 'Chat';
        }
        var isActive = i === activeTabIdx;
        html += '<button class="conv-tab' + (isActive ? ' active' : '') + '" onclick="switchTab(' + i + ')" ondblclick="event.stopPropagation();renameTab(' + i + ')" title="Double-clic pour renommer — ' + escAttr(title) + '">'
            + '<span class="tab-title" id="tab-title-' + i + '">' + esc(title) + '</span>'
            + '<span class="tab-close" onclick="event.stopPropagation();closeTab(' + i + ')">&times;</span>'
            + '</button>';
    }
    if (openTabs.length < MAX_TABS) {
        html += '<button class="conv-tab-add" onclick="addTab()" title="Nouvel onglet">+</button>';
    }
    container.innerHTML = html;
}

function renameTab(idx) {
    if (idx < 0 || idx >= openTabs.length) return;
    var tab = openTabs[idx];
    var titleEl = document.getElementById('tab-title-' + idx);
    if (!titleEl) return;
    var currentTitle = tab.title || convs[tab.id] ? convs[tab.id].title : 'Chat';
    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.style.cssText = 'width:100px;padding:2px 6px;border:1px solid var(--ac);border-radius:6px;background:var(--b1);color:var(--t1);font-size:.75rem;outline:none';
    titleEl.innerHTML = '';
    titleEl.appendChild(input);
    input.focus();
    input.select();
    function save() {
        var newTitle = input.value.trim() || currentTitle;
        if (convs[tab.id]) { convs[tab.id].title = newTitle; sSet('convs', convs); }
        tab.title = newTitle;
        renderTabs();
        updHist();
    }
    input.onblur = save;
    input.onkeydown = function(e) { if (e.key === 'Enter') save(); if (e.key === 'Escape') { input.value = currentTitle; save(); } };
}

function addTab() {
    if (openTabs.length >= MAX_TABS) return;
    // Sauvegarder le scroll de l'onglet actuel
    saveTabState();
    // Ajouter un nouvel onglet vide
    openTabs.push({ id: null, scrollPos: 0 });
    activeTabIdx = openTabs.length - 1;
    // Creer un nouveau chat
    newChat();
    openTabs[activeTabIdx].id = curConv;
    renderTabs();
}

function switchTab(idx) {
    if (idx === activeTabIdx || idx < 0 || idx >= openTabs.length) return;
    // Sauvegarder l'etat de l'onglet actuel
    saveTabState();
    // Switcher
    activeTabIdx = idx;
    var tab = openTabs[idx];
    // Charger la conversation de cet onglet
    if (tab.id && convs[tab.id]) {
        loadConv(tab.id);
    } else {
        newChat();
        openTabs[idx].id = curConv;
    }
    // Restaurer le scroll
    setTimeout(function() {
        G('MG').scrollTop = tab.scrollPos || 0;
    }, 50);
    renderTabs();
}

function closeTab(idx) {
    if (openTabs.length <= 1) return; // Garder au moins 1 onglet
    openTabs.splice(idx, 1);
    if (activeTabIdx >= openTabs.length) activeTabIdx = openTabs.length - 1;
    if (activeTabIdx === idx || activeTabIdx > idx) {
        activeTabIdx = Math.max(0, activeTabIdx - (idx < activeTabIdx ? 1 : 0));
    }
    // Charger l'onglet actif
    var tab = openTabs[activeTabIdx];
    if (tab.id && convs[tab.id]) {
        loadConv(tab.id);
    } else {
        newChat();
    }
    renderTabs();
}

function saveTabState() {
    if (activeTabIdx >= 0 && activeTabIdx < openTabs.length) {
        openTabs[activeTabIdx].id = curConv;
        openTabs[activeTabIdx].scrollPos = G('MG').scrollTop;
    }
}

// Mettre a jour l'onglet actif quand on change de conversation via la sidebar
var origLoadConv = window.loadConv;
// On patche loadConv pour syncer avec les tabs
function syncTabOnLoad(id) {
    if (openTabs.length > 0 && activeTabIdx >= 0) {
        openTabs[activeTabIdx].id = id;
        renderTabs();
    }
}

// Ouvrir une conversation dans un nouvel onglet (depuis la sidebar avec Cmd+click)
function openInNewTab(convId) {
    if (openTabs.length >= MAX_TABS) {
        // Remplacer l'onglet actuel
        loadConv(convId);
        return;
    }
    saveTabState();
    openTabs.push({ id: convId, scrollPos: 0 });
    activeTabIdx = openTabs.length - 1;
    loadConv(convId);
    renderTabs();
}

initTabs();


// === TUTORIAL ===
function showTutorial() {
    if (sGet('tuto_done', false)) return;
    G('TUTO').classList.remove('hidden');
}
G('tuto-ok').onclick = function() {
    G('TUTO').classList.add('hidden');
    sSet('tuto_done', true);
};


// === RACCOURCIS CLAVIER ===
document.onkeydown = function(e) {
    // Ctrl+N ou Cmd+N : nouveau chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newChat();
    }
    // Ctrl+K ou Cmd+K : focus recherche
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        var src = G('SRC');
        if (src) { src.focus(); src.select(); }
        // Ouvrir la section discussions si fermee
        var secH = document.querySelector('[data-s="chats"]');
        if (secH && !secH.classList.contains('on')) secH.click();
    }
    // Cmd+Shift+C : copier la derniere reponse IA
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        var aiMsgs = G('MG').querySelectorAll('.msg.a');
        if (aiMsgs.length > 0) {
            var lastAI = aiMsgs[aiMsgs.length - 1];
            var mt = lastAI.querySelector('.mt');
            if (mt && navigator.clipboard) {
                navigator.clipboard.writeText(mt.textContent);
                showKbHint('Derniere reponse copiee');
            }
        }
    }
    // Cmd+R : regenerer la derniere reponse
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'r') {
        e.preventDefault();
        var aiMsgs2 = G('MG').querySelectorAll('.msg.a');
        if (aiMsgs2.length > 0) {
            var lastAI2 = aiMsgs2[aiMsgs2.length - 1];
            var regenBtn = lastAI2.querySelector('.regen-btn');
            if (regenBtn) regenBtn.click();
        }
    }
    // Cmd+T : nouvel onglet
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        addTab();
        showKbHint('Nouvel onglet');
    }
    // Cmd+W : fermer l'onglet courant
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        if (openTabs.length > 1) {
            e.preventDefault();
            closeTab(activeTabIdx);
        }
    }
    // Cmd+, : parametres
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        G('SM').classList.remove('hidden');
        loadSett();
        showKbHint('Parametres');
    }
    // Cmd+Shift+S : toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        var sb = G('SB');
        if (sb.classList.contains('collapsed')) {
            sb.classList.remove('collapsed');
            G('OSB').classList.add('hidden');
        } else {
            sb.classList.add('collapsed');
            G('OSB').classList.remove('hidden');
        }
    }
    // Cmd+E : exporter la conversation en Markdown
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (curConv) { exportMD(); showKbHint('Export Markdown'); }
    }
    // Cmd+/ : afficher l'aide raccourcis
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleShortcutsHelp();
    }
    // Cmd+Shift+N : nouveau chat ephemere
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        makeEphemeral();
        showKbHint('Chat ephemere');
    }
    // Cmd+1-5 : switcher de mode
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        var modeIdx = parseInt(e.key) - 1;
        var modeNames = ['base','teacher','debate','creative','writer','image'];
        if (modeNames[modeIdx]) {
            var mp = document.querySelector('.mp[data-m="'+modeNames[modeIdx]+'"]');
            if (mp) mp.click();
            showKbHint('Mode: ' + modeNames[modeIdx]);
        }
    }
    // Escape : fermer les modals/menus OU stopper la generation
    if (e.key === 'Escape') {
        if (isStreaming) {
            stopGeneration();
            return;
        }
        G('SM').classList.add('hidden');
        G('PM').classList.add('hidden');
        G('TUTO').classList.add('hidden');
        G('TOOLS-DROP').classList.add('hidden');
        var csub = G('CON-SUB'); if (csub) csub.classList.add('hidden');
        // Fermer aussi l'overlay d'aide raccourcis
        var scHelp = G('SHORTCUTS-HELP');
        if (scHelp) scHelp.classList.add('hidden');
    }
};

// Overlay d'aide raccourcis
function toggleShortcutsHelp() {
    var el = G('SHORTCUTS-HELP');
    if (!el) {
        // Creer l'overlay
        el = document.createElement('div');
        el.id = 'SHORTCUTS-HELP';
        el.className = 'modal';
        el.innerHTML = '<div class="modal-bk" onclick="G(\'SHORTCUTS-HELP\').classList.add(\'hidden\')"></div>'
            + '<div class="modal-c" style="max-width:480px"><div class="modal-h"><h2>Raccourcis clavier</h2><button class="modal-x" onclick="G(\'SHORTCUTS-HELP\').classList.add(\'hidden\')">&times;</button></div>'
            + '<div class="modal-b" style="padding:16px 24px">'
            + '<table style="width:100%;font-size:.85rem;border-collapse:collapse">'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Nouveau chat</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+N</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Chat ephemere</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+Shift+N</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Rechercher</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+K</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Parametres</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+,</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Toggle sidebar</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+Shift+S</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Copier derniere reponse</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+Shift+C</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Regenerer</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+R</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Exporter Markdown</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+E</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Modes (1-6)</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+1..6</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Nouvel onglet</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+T</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Fermer onglet</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+W</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Stopper / Fermer</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Escape</kbd></td></tr>'
            + '<tr><td style="padding:8px 0;color:var(--t2)">Cette aide</td><td style="text-align:right"><kbd style="background:var(--b3);padding:3px 8px;border-radius:5px;font-size:.78rem;border:1px solid var(--bd)">Cmd+/</kbd></td></tr>'
            + '</table></div></div>';
        document.body.appendChild(el);
    } else {
        el.classList.toggle('hidden');
    }
}

// === API STATUS BAR ===
var apiStatusState = 'unknown'; // 'connected', 'disconnected', 'error', 'unknown'
var apiStatusInterval = null;

function checkApiStatus() {
    if (!window.etherDesktop) { setApiStatus('disconnected', 'Mode navigateur'); return; }
    if (!window.etherDesktop.testAllProviders) {
        // Ancien mode: juste Groq
        window.etherDesktop.groqTest().then(function(r) {
            if (r && r.count > 0) setApiStatus('connected', 'Groq OK');
            else setApiStatus('error', 'Aucun modele');
        })['catch'](function() { setApiStatus('disconnected', 'Injoignable'); });
        return;
    }
    window.etherDesktop.testAllProviders().then(function(results) {
        var ok = [];
        var fail = [];
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            providerStatus[r.provider] = r.ok;
            if (r.ok) ok.push(r.provider.charAt(0).toUpperCase() + r.provider.slice(1));
            else fail.push(r.provider);
        }
        if (ok.length > 0) {
            setApiStatus('connected', ok.join(' + '));
        } else {
            setApiStatus('disconnected', 'Aucun provider disponible');
        }
    })['catch'](function() {
        setApiStatus('disconnected', 'Test echoue');
    });
}

function setApiStatus(state, text) {
    apiStatusState = state;
    // Pas de bandeau visible — le statut est gere en interne et dans les parametres
}

function startApiMonitor() {
    checkApiStatus();
    apiStatusInterval = setInterval(checkApiStatus, 60000);
}

function showKbHint(text) {
    var hint = document.querySelector('.kb-hint');
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add('vis');
    setTimeout(function() { hint.classList.remove('vis'); }, 1500);
}

// === ETHER — Init (ads, quotas, custom modes, event wiring, startup) ===

// === PUB / AD MODAL ===
// === SYSTEME PUBLICITAIRE ===
// Pubs locales par defaut (modifiables via URL distante)
var ADS_LOCAL = [
    { id: 'ether-pro', emoji: '⚡', title: 'ETHER Pro', desc: 'Messages illimites, images illimitees, modes personnalises. Passe au niveau superieur.', cta: 'Decouvrir Pro', action: 'pro', bg: '' },
    { id: 'placeholder-1', emoji: '🚀', title: 'Votre pub ici', desc: 'Contactez-nous pour afficher votre publicite aupres de nos utilisateurs.', cta: 'Nous contacter', url: 'mailto:contact@ether-ai.app', bg: '' },
    { id: 'placeholder-2', emoji: '💡', title: 'Vous etes entrepreneur ?', desc: 'ETHER peut vous aider a developper vos idees. Essayez le mode Creatif.', cta: 'Essayer', action: 'creative', bg: '' }
];

// URL distante pour charger des pubs personnalisees (JSON)
var ADS_REMOTE_URL = sGet('ads_url', '');
var currentAds = ADS_LOCAL;
var currentAdIndex = 0;

function loadAds() {
    // Charger les pubs distantes si une URL est configuree
    if (ADS_REMOTE_URL && window.etherDesktop) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', ADS_REMOTE_URL, true);
        xhr.timeout = 5000;
        xhr.onload = function() {
            try {
                var data = JSON.parse(xhr.responseText);
                if (Array.isArray(data) && data.length > 0) {
                    currentAds = data;
                }
            } catch(e) { /* garder les pubs locales */ }
        };
        xhr.onerror = function() {};
        xhr.send();
    }
}

function displayAd() {
    if (!currentAds.length) return;
    var ad = currentAds[currentAdIndex % currentAds.length];
    var emojiEl = G('AD-EMOJI');
    var titleEl = G('AD-TITLE');
    var descEl = G('AD-DESC');
    var ctaEl = G('AD-CTA');
    var imgEl = G('AD-IMG');

    if (emojiEl) {
        if (ad.image) {
            imgEl.innerHTML = '<img src="' + ad.image + '" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML=\'<span style=font-size:2rem>' + (ad.emoji || '📢') + '</span>\'">';
        } else {
            emojiEl.textContent = ad.emoji || '📢';
        }
    }
    if (titleEl) titleEl.textContent = ad.title || 'Publicite';
    if (descEl) descEl.textContent = ad.desc || '';
    if (ctaEl) ctaEl.textContent = ad.cta || 'En savoir plus';
    // Stocker l'ad active
    G('AD-PLACEHOLDER').setAttribute('data-ad-id', ad.id || '');
    G('AD-PLACEHOLDER').setAttribute('data-ad-url', ad.url || '');
    G('AD-PLACEHOLDER').setAttribute('data-ad-action', ad.action || '');
}

function clickAd() {
    var placeholder = G('AD-PLACEHOLDER');
    var adId = placeholder.getAttribute('data-ad-id');
    var url = placeholder.getAttribute('data-ad-url');
    var action = placeholder.getAttribute('data-ad-action');

    // Tracker le clic
    var clicks = sGet('ad_clicks', []);
    clicks.push({ id: adId, ts: Date.now() });
    if (clicks.length > 100) clicks = clicks.slice(-100);
    sSet('ad_clicks', clicks);

    if (action === 'pro') {
        G('AD-MODAL').classList.add('hidden');
        G('PRO-M').classList.remove('hidden');
    } else if (action === 'share') {
        G('AD-MODAL').classList.add('hidden');
        if (navigator.clipboard) {
            navigator.clipboard.writeText('Decouvre ETHER AI — une IA franche et honnete. https://ether-ai.app');
            alert('Lien copie dans le presse-papier !');
        }
    } else if (action === 'custom') {
        G('AD-MODAL').classList.add('hidden');
        openCreateCustomMode();
    } else if (action === 'creative' || action === 'teacher' || action === 'debate' || action === 'writer') {
        G('AD-MODAL').classList.add('hidden');
        var allMp = document.querySelectorAll('.mp');
        for (var i = 0; i < allMp.length; i++) {
            allMp[i].classList.remove('on');
            if (allMp[i].getAttribute('data-m') === action) allMp[i].classList.add('on');
        }
        ETHER_ENGINE.currentMode = action;
    } else if (url) {
        if (window.etherDesktop) window.etherDesktop.openExternal(url);
    }
}

function nextAd() {
    currentAdIndex++;
    displayAd();
}

// Charger les pubs au demarrage
loadAds();

var adInterval = null;
function showAdModal() {
    nextAd();
    displayAd();
    // Tracker l'impression
    sSet('ad_impressions', (sGet('ad_impressions', 0) || 0) + 1);
    var reward = getNextAdReward();
    if (reward <= 0) return;
    if (adInterval) clearInterval(adInterval);
    G('AD-REWARD').textContent = reward;
    G('AD-TIMER').textContent = '15';
    var claimBtn = G('AD-CLAIM');
    claimBtn.disabled = true;
    claimBtn.style.opacity = '.4';
    claimBtn.textContent = 'Patiente 15s...';
    G('AD-MODAL').classList.remove('hidden');
    var sec = 15;
    adInterval = setInterval(function() {
        sec--;
        G('AD-TIMER').textContent = sec;
        claimBtn.textContent = 'Patiente ' + sec + 's...';
        if (sec <= 0) {
            clearInterval(adInterval);
            adInterval = null;
            claimBtn.disabled = false;
            claimBtn.style.opacity = '1';
            claimBtn.textContent = 'Recuperer +' + reward + ' messages';
        }
    }, 1000);
}

function claimAdReward() {
    var d = getDaily('msg');
    var lvl = d.adLevel || 0;
    if (lvl >= 3) return;
    d.adLevel = lvl + 1;
    sSet('daily_msg', d);
    G('AD-MODAL').classList.add('hidden');
    updQuotaUI();
}

function showQuotaExhausted() {
    var reward = getNextAdReward();
    var d = document.createElement('div');
    d.className = 'msg a';
    if (reward > 0) {
        d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt"><p><strong>Tu as utilise tous tes messages pour aujourd\'hui.</strong></p><p>Regarde une courte pub pour obtenir <strong>+' + reward + ' messages supplementaires</strong>.</p></div><div style="margin-top:10px"><button type="button" class="btn-p" style="font-size:.85rem" onclick="showAdModal()">Regarder la pub (+' + reward + ')</button></div></div>';
    } else {
        d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt"><p><strong>Tu as utilise tous tes messages pour aujourd\'hui.</strong></p><p>Reviens demain pour 30 nouveaux messages gratuits.</p></div></div>';
    }
    G('MG').appendChild(d);
    var av = d.querySelector('.mav');
    if (av) addMsgWave(av);
    scr();
}

function esc(t) { var d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
// Echappement securise pour les attributs HTML (double-quotes, single-quotes, etc.)
function escAttr(t) {
    if (!t) return '';
    return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Restaurer les donnees persistantes avant d'initialiser l'etat
restoreFromPersist();

var user=sGet('user',null), convs=sGet('convs',{}), projs=sGet('projs',{}), trash=sGet('trash',{});
var curConv=null, curProj=null, thinking=false;
isPro = sGet('pro', false); // Restaurer le statut Pro si deja active
var isStreaming=false;

// === QUOTAS JOURNALIERS ===
function getLocalDate() {
    var n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
}
function getDaily(key) {
    var d = sGet('daily_' + key, { date: '', count: 0 });
    var today = getLocalDate();
    if (d.date !== today) return { date: today, count: 0, adLevel: 0 };
    return d;
}
function useDaily(key) {
    var d = getDaily(key);
    d.count++;
    sSet('daily_' + key, d);
    return d;
}
function getDailyRemaining(key, base) {
    var d = getDaily(key);
    var bonus = 0;
    if (key === 'msg') {
        var adLvl = d.adLevel || 0;
        if (adLvl >= 1) bonus += 5;
        if (adLvl >= 2) bonus += 3;
        if (adLvl >= 3) bonus += 1;
    }
    return Math.max(0, base + bonus - d.count);
}
function canSendMessage() {
    if (isPro) return true;
    return getDailyRemaining('msg', 30) > 0;
}
function canSearchWeb() {
    if (isPro) return true;
    return getDailyRemaining('web', 30) > 0;
}
function getAdLevel() {
    var d = getDaily('msg');
    return d.adLevel || 0;
}
function getNextAdReward() {
    var lvl = getAdLevel();
    if (lvl === 0) return 5;
    if (lvl === 1) return 3;
    if (lvl === 2) return 1;
    return 0;
}
function updQuotaUI() {
    var el = G('QUOTA-BAR');
    if (!el) return;
    if (isPro) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    var remain = getDailyRemaining('msg', 30);
    var countEl = G('QUOTA-COUNT');
    if (countEl) {
        countEl.textContent = remain;
        countEl.style.color = remain <= 5 ? '#ef4444' : remain <= 15 ? '#f59e0b' : '#22c55e';
    }
    var adBtn = G('QUOTA-AD-BTN');
    if (adBtn) {
        var reward = getNextAdReward();
        if (remain <= 5 && reward > 0) {
            adBtn.style.display = 'inline-block';
            adBtn.textContent = 'Regarder une pub (+' + reward + ')';
        } else {
            adBtn.style.display = 'none';
        }
    }
}
var theme=sGet('theme','auto');
function applyTheme(t) {
    if (t === 'auto') {
        // Detecter le theme systeme
        if (window.etherDesktop && window.etherDesktop.getSystemTheme) {
            window.etherDesktop.getSystemTheme().then(function(sysTheme) {
                document.documentElement.setAttribute('data-theme', sysTheme);
            });
        } else {
            // Fallback: utiliser prefers-color-scheme
            var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        }
    } else {
        document.documentElement.setAttribute('data-theme', t);
    }
}
applyTheme(theme);

// Ecouter les changements de theme systeme
if (window.etherDesktop && window.etherDesktop.onSystemThemeChanged) {
    window.etherDesktop.onSystemThemeChanged(function(sysTheme) {
        if (sGet('theme','auto') === 'auto') {
            document.documentElement.setAttribute('data-theme', sysTheme);
        }
    });
}

if(user) showApp();

// LOGIN
G('LB').onclick=function(){
    var prenom=G('LN').value.trim();
    var nom=G('LNAME').value.trim();
    var email=G('LE').value.trim();
    var errEl=G('login-err');
    errEl.style.display='none';
    // Validation prenom
    if(!prenom){G('LN').style.borderColor='#ef4444';errEl.textContent='Le prenom est requis.';errEl.style.display='block';return;}
    G('LN').style.borderColor='';
    // Validation email
    if(!email||email.indexOf('@')===-1||email.indexOf('.')===-1){G('LE').style.borderColor='#ef4444';errEl.textContent='Adresse email invalide.';errEl.style.display='block';return;}
    G('LE').style.borderColor='';
    var fullName=nom?prenom+' '+nom:prenom;
    user={name:fullName,firstName:prenom,lastName:nom,email:email};
    sSet('user',user);
    // Envoyer un email de bienvenue
    sendWelcomeEmail(email,prenom);
    showApp();
};
G('LN').onkeydown=function(e){if(e.key==='Enter')G('LNAME').focus();};
G('LNAME').onkeydown=function(e){if(e.key==='Enter')G('LE').focus();};
G('LE').onkeydown=function(e){if(e.key==='Enter')G('LB').onclick();};

function sendWelcomeEmail(email, prenom) {
    if (window.etherDesktop && window.etherDesktop.sendEmail) {
        window.etherDesktop.sendEmail({ email: email, prenom: prenom }).then(function() {
            console.log('Email envoye a ' + email);
        })['catch'](function(err) {
            console.log('Erreur email:', err);
        });
    }
}

function showApp(){
    G('LS').classList.add('hidden'); G('APP').classList.remove('hidden');
    G('UNM').textContent=user.name; G('UAV').textContent=user.name.charAt(0).toUpperCase();
    var wg=G('welc-greet'); if(wg) wg.textContent=getGreeting()+', '+user.name;
    initAppWaves(); updHist(); updProjs(); updImgCount(); updQuotaUI();
    G('uinp').focus();
    showTutorial();
    startApiMonitor();
}

// SIDEBAR
G('TSB').onclick=function(){G('SB').classList.add('collapsed');G('OSB').classList.remove('hidden');};
G('OSB').onclick=function(){G('SB').classList.remove('collapsed');G('OSB').classList.add('hidden');G('SB').classList.add('open');G('SOV').classList.add('vis');};
G('SOV').onclick=function(){G('SB').classList.remove('open');G('SOV').classList.remove('vis');};

// TABS
// SECTIONS DEPLIABLES
var secHeaders=document.querySelectorAll('.sb-sec-h');
for(var i=0;i<secHeaders.length;i++){secHeaders[i].onclick=(function(h){return function(){
    var content=h.nextElementSibling;
    var isOpen=h.classList.contains('on');
    // Toggle : ouvrir/fermer
    if(isOpen){
        h.classList.remove('on');
        content.classList.remove('on');
    } else {
        h.classList.add('on');
        content.classList.add('on');
        // Charger le contenu si necessaire
        if(h.getAttribute('data-s')==='trash')updTrash();
        if(h.getAttribute('data-s')==='content')updCont();
    }
};})(secHeaders[i]);}

// SHOW ALL DISCUSSIONS
var showAllLimit = 8;
var showingAll = false;
G('SHOW-ALL').onclick = function() {
    showingAll = true;
    updHist();
    G('SHOW-ALL').classList.add('hidden');
};

// MODES
var modes=document.querySelectorAll('.mp');
for(var i=0;i<modes.length;i++){modes[i].onclick=(function(btn){return function(){
    for(var j=0;j<modes.length;j++)modes[j].classList.remove('on');
    btn.classList.add('on'); ETHER_ENGINE.currentMode=btn.getAttribute('data-m');
    G('TLB').classList.add('hidden');
    G('IMG-OPTIONS').classList.add('hidden');
    if(btn.getAttribute('data-m')==='teacher')G('TLB').classList.remove('hidden');
    if(btn.getAttribute('data-m')==='image')G('IMG-OPTIONS').classList.remove('hidden');
};})(modes[i]);}
// Afficher le niveau Teacher calibre
function updTeacherBadge() {
    var badge = G('TEACHER-LEVEL-BADGE');
    var resetBtn = G('TEACHER-RESET');
    if (!badge) return;
    if (typeof TEACHER_MEMORY === 'undefined') return;
    var data = TEACHER_MEMORY.load();
    if (data.calibrated && data.globalLevel !== 'unknown') {
        var labels = { debutant: 'Debutant', intermediaire: 'Intermediaire', avance: 'Avance', expert: 'Expert' };
        var colors = { debutant: '#22c55e', intermediaire: '#f59e0b', avance: '#8b5cf6', expert: '#ef4444' };
        badge.textContent = 'Niveau: ' + (labels[data.globalLevel] || data.globalLevel);
        badge.style.color = colors[data.globalLevel] || 'var(--ac)';
        if (resetBtn) resetBtn.style.display = 'inline-block';
    } else {
        badge.textContent = 'Niveau: a calibrer';
        badge.style.color = 'var(--t3)';
        if (resetBtn) resetBtn.style.display = 'none';
    }
}
if (G('TEACHER-RESET')) {
    G('TEACHER-RESET').onclick = function() {
        if (typeof TEACHER_MEMORY !== 'undefined') {
            var data = TEACHER_MEMORY.load();
            data.calibrated = false;
            data.globalLevel = 'unknown';
            TEACHER_MEMORY.save(data);
            updTeacherBadge();
        }
    };
}
// Mettre a jour le badge quand on active le mode Teacher
var origModeHandler = modes[0] ? modes[0].onclick : null;
for(var mi=0;mi<modes.length;mi++){
    (function(btn) {
        var origClick = btn.onclick;
        btn.onclick = function() {
            if (origClick) origClick.call(this);
            if (btn.getAttribute('data-m') === 'teacher') updTeacherBadge();
        };
    })(modes[mi]);
}


// === MODES PERSONNALISES ===
var customModes = sGet('custom_modes', []);
var editingModeId = null;
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

function renderCustomModes() {
    var container = G('CUSTOM-MODES');
    container.innerHTML = '';

    // Mettre a jour le compteur
    var countEl = G('CM-COUNT');
    if (countEl) countEl.textContent = customModes.length > 0 ? '(' + customModes.length + ')' : '';

    if (!customModes.length) {
        container.innerHTML = '<div class="cm-empty">Aucun mode personnalise</div>';
        return;
    }

    for (var i = 0; i < customModes.length; i++) {
        var m = customModes[i];
        var catLabel = '';
        for (var ci = 0; ci < defaultCategories.length; ci++) {
            if (defaultCategories[ci].id === m.emoji) { catLabel = defaultCategories[ci].icon; break; }
        }
        if (!catLabel) catLabel = (m.name || '?').charAt(0).toUpperCase();

        var item = document.createElement('button');
        item.className = 'cm-item' + (ETHER_ENGINE.currentMode === 'custom_' + m.id ? ' active' : '');
        item.setAttribute('data-m', 'custom_' + m.id);
        item.setAttribute('data-id', m.id);
        item.innerHTML = '<div class="cm-badge">' + catLabel + '</div><div class="cm-info"><div class="cm-name">' + esc(m.name) + '</div>' + (m.specialty ? '<div class="cm-spec">' + esc(m.specialty) + '</div>' : '') + '</div><button type="button" class="cm-edit-btn" data-id="' + m.id + '" title="Modifier">&#9998;</button>';
        container.appendChild(item);
    }

    // Listeners pour selectionner un mode custom
    var items = container.querySelectorAll('.cm-item');
    for (var j = 0; j < items.length; j++) {
        items[j].onclick = (function(item) { return function(e) {
            if (e.target.classList.contains('cm-edit-btn') || e.target.closest('.cm-edit-btn')) {
                e.stopPropagation();
                var editId = (e.target.closest('.cm-edit-btn') || e.target).getAttribute('data-id');
                openEditCustomMode(editId);
                return;
            }
            // Desactiver tous les modes
            var allMp = document.querySelectorAll('.mp');
            for (var k = 0; k < allMp.length; k++) allMp[k].classList.remove('on');
            // Activer le toggle "Mes modes"
            G('CUSTOM-TOGGLE').classList.add('on');
            ETHER_ENGINE.currentMode = item.getAttribute('data-m');
            G('TLB').classList.add('hidden');
            // Marquer l'item actif
            var allItems = container.querySelectorAll('.cm-item');
            for (var l = 0; l < allItems.length; l++) allItems[l].classList.remove('active');
            item.classList.add('active');
            // Fermer le dropdown
            G('CUSTOM-DROP').classList.add('hidden');
        }; })(items[j]);
    }
}

function getCustomModeById(id) {
    for (var i = 0; i < customModes.length; i++) {
        if (customModes[i].id === id) return customModes[i];
    }
    return null;
}

function openCreateCustomMode() {
    editingModeId = null;
    G('CM-TITLE').textContent = 'Nouveau mode';
    G('CM-NAME').value = '';
    G('CM-SPEC').value = '';
    G('CM-STYLE').value = '';
    G('CM-INSTR').value = '';
    G('CM-EMOJI').value = 'autre';
    G('CM-SAVE').textContent = 'Creer le mode';
    G('CM-DELETE').style.display = 'none';
    renderCategoryPicker('');
    G('CM-MODAL').classList.remove('hidden');
}

function openEditCustomMode(id) {
    var m = getCustomModeById(id);
    if (!m) return;
    editingModeId = id;
    G('CM-TITLE').textContent = 'Modifier le mode';
    G('CM-NAME').value = m.name;
    G('CM-SPEC').value = m.specialty || '';
    G('CM-STYLE').value = m.style || '';
    G('CM-INSTR').value = m.instructions || '';
    G('CM-EMOJI').value = m.emoji || '';
    G('CM-SAVE').textContent = 'Enregistrer';
    G('CM-DELETE').style.display = 'block';
    renderCategoryPicker(m.emoji);
    G('CM-MODAL').classList.remove('hidden');
}

function renderCategoryPicker(selected) {
    var container = G('CM-CATS');
    container.innerHTML = '';
    for (var i = 0; i < defaultCategories.length; i++) {
        var cat = defaultCategories[i];
        var btn = document.createElement('button');
        btn.className = 'emoji-pick' + (cat.id === selected ? ' sel' : '');
        btn.textContent = cat.label;
        btn.type = 'button';
        btn.style.cssText = 'width:auto;padding:6px 12px;font-size:.76rem;font-weight:600';
        btn.onclick = (function(c) { return function() {
            G('CM-EMOJI').value = c.id;
            var picks = G('CM-CATS').querySelectorAll('.emoji-pick');
            for (var j = 0; j < picks.length; j++) picks[j].classList.remove('sel');
            this.classList.add('sel');
        }; })(cat);
        container.appendChild(btn);
    }
}

function saveCustomMode() {
    var name = G('CM-NAME').value.trim();
    if (!name) { G('CM-NAME').style.borderColor = '#dc2626'; return; }
    // Limite modes custom (3 max gratuit)
    if (!isPro && !editingModeId && customModes.length >= 3) {
        alert('Limite atteinte : 3 modes personnalises max. Passe au Plan Pro pour en creer plus.');
        return;
    }
    var emoji = G('CM-EMOJI').value.trim() || 'autre';
    var specialty = G('CM-SPEC').value.trim();
    var style = G('CM-STYLE').value.trim();
    var instructions = G('CM-INSTR').value.trim();

    if (editingModeId) {
        // Modifier
        for (var i = 0; i < customModes.length; i++) {
            if (customModes[i].id === editingModeId) {
                customModes[i].name = name;
                customModes[i].emoji = emoji;
                customModes[i].specialty = specialty;
                customModes[i].style = style;
                customModes[i].instructions = instructions;
                break;
            }
        }
    } else {
        // Creer
        customModes.push({
            id: 'cm_' + Date.now(),
            name: name,
            emoji: emoji,
            specialty: specialty,
            style: style,
            instructions: instructions
        });
    }
    sSet('custom_modes', customModes);
    renderCustomModes();
    G('CM-MODAL').classList.add('hidden');
}

function deleteCustomMode() {
    if (!editingModeId) return;
    if (!confirm('Supprimer le mode "' + (getCustomModeById(editingModeId) || {}).name + '" ?')) return;
    customModes = customModes.filter(function(m) { return m.id !== editingModeId; });
    sSet('custom_modes', customModes);
    // Revenir au mode base si le mode supprime etait actif
    if (ETHER_ENGINE.currentMode === 'custom_' + editingModeId) {

        ETHER_ENGINE.currentMode = 'base';
        var allM = document.querySelectorAll('.mp');
        for (var i = 0; i < allM.length; i++) allM[i].classList.remove('on');
        if (allM[0]) allM[0].classList.add('on');
    }
    renderCustomModes();
    G('CM-MODAL').classList.add('hidden');
}

// Event listeners — Dropdown toggle
G('CUSTOM-TOGGLE').onclick = function(e) {
    e.stopPropagation();
    var drop = G('CUSTOM-DROP');
    if (drop.classList.contains('hidden')) {
        drop.classList.remove('hidden');
        renderCustomModes(); // refresh
    } else {
        drop.classList.add('hidden');
    }
};
// Fermer le dropdown quand on clique ailleurs
document.addEventListener('click', function(e) {
    var drop = G('CUSTOM-DROP');
    if (!drop.classList.contains('hidden') && !drop.contains(e.target) && e.target !== G('CUSTOM-TOGGLE') && !G('CUSTOM-TOGGLE').contains(e.target)) {
        drop.classList.add('hidden');
    }
});
// Empecher la propagation des clics dans le dropdown
G('CUSTOM-DROP').onclick = function(e) { e.stopPropagation(); };

G('ADD-MODE-BTN').onclick = function() { openCreateCustomMode(); };
G('CM-X').onclick = function() { G('CM-MODAL').classList.add('hidden'); };
G('CM-MODAL').querySelector('.modal-bk').onclick = function() { G('CM-MODAL').classList.add('hidden'); };
G('CM-SAVE').onclick = function() { saveCustomMode(); };
G('CM-DELETE').onclick = function() { deleteCustomMode(); };

// Quand on clique un mode standard, desactiver le toggle custom
var standardModes = document.querySelectorAll('#MS > .mp:not(#CUSTOM-TOGGLE)');
for (var smi = 0; smi < standardModes.length; smi++) {
    (function(btn) {
        var origClick = btn.onclick;
        btn.onclick = function(e) {
            G('CUSTOM-TOGGLE').classList.remove('on');
            G('CUSTOM-DROP').classList.add('hidden');
            if (origClick) origClick.call(btn, e);
        };
    })(standardModes[smi]);
}

// Charger les modes custom au demarrage
renderCustomModes();

// TEXTAREA + SEND
var uiEl=G('uinp'), sndEl=G('SND');
uiEl.oninput=function(){uiEl.style.height='auto';uiEl.style.height=Math.min(uiEl.scrollHeight,140)+'px';sndEl.disabled=!uiEl.value.trim()&&!(stagedFiles&&stagedFiles.length);};
sndEl.onclick=function(){sendMsg(uiEl.value);};
uiEl.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg(uiEl.value);}};
var chips=document.querySelectorAll('.chip');
for(var i=0;i<chips.length;i++){chips[i].onclick=(function(c){return function(){sendMsg(c.getAttribute('data-p'));};})(chips[i]);}

// SEND MESSAGE

// === MEMOIRE AUTOMATIQUE (style Claude) ===
// Analyse chaque echange pour construire un profil utilisateur silencieusement
var _memMsgCount = 0;

function autoDetectMemory(userMessage, aiAnswer) {
    if (!window.etherDesktop) return;
    if (!userMessage || userMessage.length < 10) return;

    var msgLower = (userMessage || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Skip les messages purement generiques
    if (/^(salut|bonjour|bonsoir|hello|hi|hey|merci|ok|oui|non|super|cool|bien|d'accord|top)$/i.test(userMessage.trim())) return;

    _memMsgCount++;

    // Detecter si le message contient potentiellement des infos personnelles
    var personalPatterns = [
        /je suis|i am|i'm/i,
        /je travaille|je bosse|mon job|mon metier|ma profession|mon poste/i,
        /j'habite|je vis|je reside|ma ville|mon pays/i,
        /j'ai \d+|j'ai un|j'ai une|j'ai des/i,
        /j'etudie|mes etudes|mon ecole|ma fac|mon universite/i,
        /j'aime|j'adore|je deteste|je prefere|ma passion|mon hobby/i,
        /mon projet|mon objectif|mon but|je veux|je souhaite|je prevois/i,
        /ma famille|mon fils|ma fille|mon mari|ma femme|mon frere|ma soeur/i,
        /mon entreprise|ma boite|ma startup|mon equipe/i,
        /je parle|ma langue|bilingue/i,
        /mon experience|ans d'experience|je connais bien/i
    ];

    var hasPersonalInfo = false;
    for (var p = 0; p < personalPatterns.length; p++) {
        if (personalPatterns[p].test(msgLower)) { hasPersonalInfo = true; break; }
    }

    // Extraire si infos perso detectees OU tous les 5 messages (pour capter les infos implicites)
    if (!hasPersonalInfo && _memMsgCount % 5 !== 0) return;

    var cleanAnswer = (aiAnswer || '').replace(/<[^>]+>/g, '').substring(0, 400);
    var existingMem = sGet('mem', []);
    var existingContext = existingMem.length > 0 ? '\nFaits deja connus: ' + existingMem.join('; ') : '';

    // Utiliser Groq Llama 8B (ultra rapide) pour l'extraction
    window.etherDesktop.groqChat({
        model: GROQ_MODELS.fast,
        messages: [
            { role: 'system', content: 'Tu construis le PROFIL de l\'utilisateur a partir de ses messages. Reponds UNIQUEMENT en JSON.\n\nREGLES STRICTES:\n- Extrais UNIQUEMENT ce que l\'utilisateur dit SUR LUI-MEME (pas les questions qu\'il pose, pas les sujets de discussion)\n- Exemples valides: "Developpeur Python", "Travaille chez Altopi", "Habite a Paris", "Aime le football", "A 25 ans", "Etudie l\'informatique"\n- Exemples INVALIDES: "S\'interesse a l\'IA" (trop vague), "A pose une question sur la gravite" (c\'est un sujet, pas un profil), "Cherche des conseils" (pas un trait personnel)\n- Chaque fait = une info de profil courte (3-10 mots)\n- Maximum 2 faits\n- Si aucune info de profil: {"facts":[]}\n\nFormat: {"facts":["fait 1","fait 2"]}' },
            { role: 'user', content: 'Message de l\'utilisateur: "' + userMessage.substring(0, 500) + '"\nReponse de l\'IA: "' + cleanAnswer + '"' + existingContext }
        ],
        temperature: 0.1,
        max_tokens: 150
    }).then(function(res) {
        if (!res.ok || !res.text) return;
        try {
            var cleaned = res.text.trim();
            if (cleaned.indexOf('```') !== -1) cleaned = cleaned.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
            // Extraire le JSON meme s'il y a du texte autour
            var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return;
            var parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.facts || !parsed.facts.length) return;

            var currentMem = sGet('mem', []);
            var added = false;

            for (var i = 0; i < parsed.facts.length; i++) {
                var fact = (parsed.facts[i] || '').trim();
                if (!fact || fact.length < 3 || fact.length > 200) continue;
                // Ignorer les faits generiques ou inutiles
                if (/aucun|pas de fait|rien|none|no fact/i.test(fact)) continue;

                // Deduplication intelligente
                var isDuplicate = false;
                var factWords = fact.toLowerCase().split(/\s+/);
                for (var j = 0; j < currentMem.length; j++) {
                    var memWords = currentMem[j].toLowerCase().split(/\s+/);
                    // Compter les mots en commun
                    var commonWords = 0;
                    for (var w = 0; w < factWords.length; w++) {
                        if (factWords[w].length > 3 && memWords.indexOf(factWords[w]) !== -1) commonWords++;
                    }
                    // Si plus de 50% des mots significatifs sont en commun, c'est un doublon
                    if (commonWords >= Math.max(2, factWords.length * 0.5)) {
                        // Mais si le nouveau fait est plus long/detaille, remplacer l'ancien
                        if (fact.length > currentMem[j].length + 10) {
                            currentMem[j] = fact;
                            added = true;
                        }
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    currentMem.push(fact);
                    added = true;
                }
            }

            if (added) {
                // Limiter a 30 souvenirs max (supprimer les plus anciens)
                if (currentMem.length > 30) currentMem = currentMem.slice(currentMem.length - 30);
                sSet('mem', currentMem);
                // Mettre a jour l'UI des parametres si ouverte
                if (typeof renMem === 'function') renMem();
            }
        } catch(e) { /* JSON parse error — ignore silencieusement */ }
    })['catch'](function() { /* API error — ignore silencieusement */ });
}

// === TEACHER TRACKING AMELIORE ===
var _teacherMsgBuffer = [];
var _teacherBatchSize = 5;

function trackTeacherSessionV2(question, answer) {
    if (!window.etherDesktop) return;
    var learnData = sGet('learn', { sessions: [], xp: 0, level: 0, streak: 0, lastDay: '' });
    var today = new Date().toISOString().slice(0, 10);

    // Streak
    if (learnData.lastDay) {
        var lastDate = new Date(learnData.lastDay);
        var todayDate = new Date(today);
        var diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            learnData.streak = (learnData.streak || 0) + 1;
        } else if (diffDays > 1) {
            learnData.streak = 1;
        }
    } else {
        learnData.streak = 1;
    }
    learnData.lastDay = today;

    // Ajouter au buffer pour extraction par batch
    _teacherMsgBuffer.push({ question: question, answer: (answer || '').replace(/<[^>]+>/g, '').substring(0, 200) });

    // XP de base
    var xpGain = 10;
    // Bonus streak
    if (learnData.streak > 1) xpGain += Math.min(learnData.streak, 10);

    // Quand le buffer atteint la taille batch, extraire les topics via LLM
    if (_teacherMsgBuffer.length >= _teacherBatchSize) {
        var batchText = _teacherMsgBuffer.map(function(m, i) { return (i + 1) + '. Q: ' + m.question + '\n   R: ' + m.answer; }).join('\n');
        _teacherMsgBuffer = [];

        window.etherDesktop.groqChat({
            model: 'llama3.1-8b',
            messages: [
                { role: 'system', content: 'Analyze these Q&A exchanges from a learning session. Return JSON: {"topics": [{"name": "short topic", "difficulty": "beginner|intermediate|advanced", "depth": 1-5}]}. Maximum 3 topics. Respond ONLY with JSON.' },
                { role: 'user', content: batchText }
            ],
            temperature: 0.1,
            max_tokens: 150
        }).then(function(res) {
            if (!res.ok || !res.text) return;
            try {
                var cleaned = res.text.trim().replace(/```json?\s*/g, '').replace(/```/g, '').trim();
                var parsed = JSON.parse(cleaned);
                if (parsed.topics) {
                    for (var i = 0; i < parsed.topics.length; i++) {
                        var topic = parsed.topics[i];
                        // Chercher le topic existant ou creer
                        var found = false;
                        for (var j = 0; j < learnData.sessions.length; j++) {
                            if (learnData.sessions[j].topic === topic.name) {
                                learnData.sessions[j].count = (learnData.sessions[j].count || 0) + 1;
                                learnData.sessions[j].lastSeen = today;
                                learnData.sessions[j].difficulty = topic.difficulty || 'beginner';
                                learnData.sessions[j].depth = Math.max(learnData.sessions[j].depth || 0, topic.depth || 1);
                                found = true;
                                // Bonus XP pour approfondissement
                                xpGain += 15;
                                break;
                            }
                        }
                        if (!found) {
                            learnData.sessions.push({
                                topic: topic.name,
                                count: 1,
                                lastSeen: today,
                                difficulty: topic.difficulty || 'beginner',
                                depth: topic.depth || 1,
                                ts: Date.now()
                            });
                            xpGain += 10;
                        }
                    }
                    // Bonus session complete (5+ messages sur un topic)
                    xpGain += 25;
                }
            } catch(e) { /* skip */ }

            learnData.xp = (learnData.xp || 0) + xpGain;
            // Calculer le niveau (100 XP par niveau, progressif)
            var totalXp = learnData.xp;
            var lvl = 0;
            var xpNeeded = 100;
            while (totalXp >= xpNeeded) { totalXp -= xpNeeded; lvl++; xpNeeded = 100 + lvl * 50; }
            learnData.level = lvl;
            sSet('learn', learnData);
            showXpToast(xpGain);
        })['catch'](function() {
            // Fallback: just add base XP
            learnData.xp = (learnData.xp || 0) + xpGain;
            sSet('learn', learnData);
        });
    } else {
        // Pas encore assez de messages pour un batch — juste le XP de base
        learnData.xp = (learnData.xp || 0) + xpGain;
        sSet('learn', learnData);
        showXpToast(xpGain);
    }
}

function showXpToast(xp) {
    var existing = document.getElementById('XP-TOAST');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'XP-TOAST';
    toast.style.cssText = 'position:fixed;top:60px;right:20px;background:linear-gradient(135deg,rgba(var(--ac-rgb,201,74,63),.15),rgba(var(--ac-rgb,201,74,63),.05));border:1px solid var(--ac);border-radius:12px;padding:8px 16px;font-size:.85rem;font-weight:700;color:var(--ac);z-index:600;animation:fi .3s ease;pointer-events:none';
    toast.textContent = '+' + xp + ' XP';
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity .5s'; }, 1500);
    setTimeout(function() { var t = document.getElementById('XP-TOAST'); if (t) t.remove(); }, 2000);
}
