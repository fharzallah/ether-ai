// === ETHER — Sidebar (history, projects, trash) ===


// NEW CHAT
G('NCB').onclick=function(){newChat();};
// Clic sur le logo = nouveau chat
G('logo-wv').parentNode.parentNode.style.cursor='pointer';
G('logo-wv').parentNode.parentNode.onclick=function(){newChat();};
function newChat(pid){
    curConv=null;curProj=pid||null;isEphemeral=false;ETHER_ENGINE.resetHistory();
    G('EPH-BAR').classList.add('hidden');G('SAVE-BAR').classList.add('hidden');G('TASK-BAR').classList.add('hidden');
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
function loadConv(id){if(!convs[id])return;curConv=id;isEphemeral=false;ETHER_ENGINE.resetHistory();G('EPH-BAR').classList.add('hidden');G('SAVE-BAR').classList.add('hidden');G('TASK-BAR').classList.add('hidden');G('MG').innerHTML='';
    // Logo en haut de la conversation
    var hdr=document.createElement('div');
    hdr.style.cssText='text-align:center;padding:20px 0 10px';
    hdr.innerHTML='<div style="width:50px;height:50px;margin:0 auto 8px"><canvas id="conv-logo" width="50" height="50"></canvas></div><div style="font-size:.82rem;color:var(--t3);font-weight:500">'+esc(convs[id].title)+'</div>';
    G('MG').appendChild(hdr);
    var cl=document.getElementById('conv-logo');if(cl)addLogo(cl);
    var msgs=convs[id].messages;for(var i=0;i<msgs.length;i++){if(msgs[i].r==='u')addUserMsg(msgs[i].t);else addAIMsg(msgs[i].d);}updHist();scr();G('SB').classList.remove('open');G('SOV').classList.remove('vis');syncTabOnLoad(id);}

// TRASH
function cleanTrash(){var now=Date.now();for(var id in trash){if(now-trash[id].deletedAt>30*24*60*60*1000){delete trash[id];}}sSet('trash',trash);}
// NB: pas d'appel ici — 'trash' n'est assigne qu'en fin de fichier. La purge des
// entrees de plus de 30 jours se fait via updTrash(), a l'ouverture de la corbeille.
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
    // CFP (filtre par projet) n'existe pas dans index.html : sans ce garde, showApp()
    // plantait au rechargement et tout le reste du fichier (envoi, Entree...) n'etait jamais branche.
    var sel=G('CFP');if(!sel)return;sel.innerHTML='<option value="all">Tous</option>';for(var i=0;i<ids.length;i++)sel.innerHTML+='<option value="'+ids[i]+'">'+esc(projs[ids[i]].name)+'</option>';
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
            reasoning: { analyste: 'Document genere via IA.', critique: 'Contenu genere par ' + (aiResp._provider || 'ETHER') + '.', synthese: 'Document pret au telechargement.' },
            answer: '<p><strong>Document genere et telecharge :</strong></p><div style="background:var(--b3);border:1px solid var(--bd);border-radius:var(--radius);padding:16px;margin:10px 0"><div style="display:flex;align-items:center;gap:12px"><div style="width:42px;height:42px;border-radius:10px;background:' + (colors[format] || 'var(--ac)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700">' + format.toUpperCase().substring(0, 3) + '</div><div><strong>' + esc(desc) + '</strong><br><span style="font-size:.78rem;color:var(--t3)">' + format.toUpperCase() + ' - Genere par ETHER AI</span></div></div><button onclick="dlDoc(' + docIdx + ')" style="margin-top:12px;padding:8px 16px;border:1px solid var(--ac);border-radius:var(--radius);background:transparent;color:var(--ac);cursor:pointer;font-size:.82rem;transition:all .15s">Retelecharger</button></div><details style="margin-top:8px"><summary style="cursor:pointer;font-size:.82rem;color:var(--t3)">Voir le contenu</summary><pre style="background:var(--b3);padding:12px;border-radius:var(--radius);font-size:.78rem;overflow-x:auto;margin-top:8px;white-space:pre-wrap">' + esc(finalContent.substring(0, 1000)) + '</pre></details>',
            confidence: 'verified',
            sources: [aiResp._provider || 'ETHER'],
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
    var base = 'ether-' + doc.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    // Vrais fichiers Office (voir docgen.js) plutot qu'un HTML renomme en .doc ou un CSV.
    if (typeof DOCGEN !== 'undefined' && (doc.format === 'word' || doc.format === 'excel')) {
        try {
            if (doc.format === 'word') {
                downloadFile(base + '.docx', DOCGEN.docx(doc.title, doc.content), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            } else {
                downloadFile(base + '.xlsx', DOCGEN.xlsx(doc.title, doc.content), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            }
            return;
        } catch (e) { console.warn('[DOC] Generation Office echouee, repli sur l ancien format :', e); }
    }
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

// Previent une fois que les taches internes (memoire, suggestions, resume) sont
// desactivees parce que le fournisseur choisi ne les traite pas. On ne les redirige
// pas vers un autre fournisseur : ce serait envoyer la conversation ailleurs que la
// ou l'utilisateur l'a demande.
function showTaskNotice(provider) {
    var bar = G('TASK-BAR'), txt = G('TASK-BAR-TXT');
    if (!bar || !txt) return;
    var label = provider;
    if (provider === 'custom' && typeof customProviders !== 'undefined') {
        var sel = (typeof selectedModelOverride !== 'undefined' && selectedModelOverride) ? selectedModelOverride.customId : null;
        for (var i = 0; i < customProviders.length; i++) {
            if (customProviders[i].id === sel) { label = customProviders[i].name; break; }
        }
    }
    txt.textContent = 'Memoire, suggestions et resume sont desactives : ' + label
        + ' n\'a pas traite ces taches. Rien n\'a ete envoye a un autre fournisseur.';
    bar.classList.remove('hidden');
}

// === FOURNISSEURS PERSONNALISES ===
// Le renderer ne detient jamais les cles : il ne manipule que des identifiants et
// des metadonnees renvoyees par le process principal.
var customProviders = [];

function loadCustomProviders() {
    if (!window.etherDesktop || !window.etherDesktop.customProvidersList) return;
    window.etherDesktop.secureStorageAvailable().then(function(available) {
        var warn = G('CUST-WARN');
        if (warn) {
            if (available) { warn.classList.add('hidden'); }
            else {
                warn.textContent = "Le chiffrement systeme n'est pas disponible sur cette machine. "
                    + "Les cles API ne peuvent pas etre enregistrees tant qu'il ne l'est pas.";
                warn.classList.remove('hidden');
            }
        }
    })['catch'](function() {});
    return window.etherDesktop.customProvidersList().then(function(list) {
        customProviders = list || [];
        renderCustomProviders();
        renderModelOptions();
    })['catch'](function(e) { console.warn('[CUSTOM-PROV] Chargement echoue:', e); });
}

function renderCustomProviders() {
    var box = G('CUST-LIST');
    if (!box) return;
    if (!customProviders.length) {
        box.innerHTML = '<div style="font-size:.74rem;color:var(--t3);font-style:italic">Aucun fournisseur personnalise.</div>';
        return;
    }
    var h = '';
    for (var i = 0; i < customProviders.length; i++) {
        var p = customProviders[i];
        h += '<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--bd);border-radius:10px;padding:8px 10px;background:var(--b3)">'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:.8rem;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>'
          + '<div style="font-size:.68rem;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.model) + ' — ' + esc(p.baseUrl) + '</div>'
          + '<div style="font-size:.66rem;color:var(--t3)">' + (p.hasKey ? 'Cle enregistree (chiffree)' : 'Sans cle') + '</div>'
          + '<div class="cust-test-status" data-id="' + escAttr(p.id) + '" style="font-size:.68rem;margin-top:2px"></div>'
          + '</div>'
          + '<button type="button" class="btn-s" onclick="testCustomProvider(\'' + escAttr(p.id) + '\')">Tester</button>'
          + '<button type="button" class="btn-s" onclick="editCustomProvider(\'' + escAttr(p.id) + '\')">Modifier</button>'
          + '<button type="button" class="btn-s" onclick="deleteCustomProvider(\'' + escAttr(p.id) + '\')">Supprimer</button>'
          + '</div>';
    }
    box.innerHTML = h;
}

function customStatusEl(id) {
    var all = document.querySelectorAll('.cust-test-status');
    for (var i = 0; i < all.length; i++) if (all[i].getAttribute('data-id') === id) return all[i];
    return null;
}

function testCustomProvider(id) {
    var el = customStatusEl(id);
    if (el) { el.style.color = 'var(--t3)'; el.textContent = 'Test en cours...'; }
    window.etherDesktop.customProvidersTest(id).then(function(r) {
        if (!el) return;
        if (r && r.ok) { el.style.color = 'var(--color-success)'; el.textContent = 'Connexion reussie'; }
        else { el.style.color = 'var(--color-danger)'; el.textContent = 'Echec : ' + esc((r && r.error) || 'inconnu'); }
    })['catch'](function() {
        if (el) { el.style.color = 'var(--color-danger)'; el.textContent = 'Echec du test'; }
    });
}

function openCustomForm(p) {
    G('CUST-ID').value = p ? p.id : '';
    G('CUST-NAME').value = p ? p.name : '';
    G('CUST-URL').value = p ? p.baseUrl : '';
    G('CUST-MODEL').value = p ? p.model : '';
    G('KEY-CUSTOM').value = '';
    G('KEY-CUSTOM').type = 'password';
    var hint = G('CUST-KEY-HINT');
    if (hint) {
        if (p && p.hasKey) {
            hint.textContent = 'Une cle est deja enregistree. Laisse vide pour la conserver.';
            hint.classList.remove('hidden');
        } else { hint.classList.add('hidden'); }
    }
    G('CUST-FORM-ERR').classList.add('hidden');
    G('CUST-FORM').classList.remove('hidden');
    G('CUST-NAME').focus();
}

function editCustomProvider(id) {
    for (var i = 0; i < customProviders.length; i++) {
        if (customProviders[i].id === id) return openCustomForm(customProviders[i]);
    }
}

function deleteCustomProvider(id) {
    if (!confirm('Supprimer ce fournisseur et sa cle ?')) return;
    window.etherDesktop.customProvidersDelete(id).then(function(r) {
        if (r && r.ok) {
            customProviders = r.providers || [];
            // Si le fournisseur supprime etait selectionne, revenir en Auto.
            if (selectedModelOverride && selectedModelOverride.customId === id) {
                selectedModelOverride = null;
                G('MODEL-SEL-LABEL').textContent = 'Auto';
            }
            renderCustomProviders();
            renderModelOptions();
            updProviderStatuses();
        }
    });
}

G('CUST-ADD').onclick = function() { openCustomForm(null); };
G('CUST-CANCEL').onclick = function() { G('CUST-FORM').classList.add('hidden'); };
G('CUST-SAVE').onclick = function() {
    var err = G('CUST-FORM-ERR');
    var payload = {
        id: G('CUST-ID').value || undefined,
        name: G('CUST-NAME').value.trim(),
        baseUrl: G('CUST-URL').value.trim(),
        model: G('CUST-MODEL').value.trim()
    };
    // Champ vide en modification = conserver la cle existante, d'ou l'omission.
    var typed = G('KEY-CUSTOM').value;
    var editing = !!payload.id;
    if (!editing || typed !== '') payload.apiKey = typed;

    window.etherDesktop.customProvidersSave(payload).then(function(r) {
        if (!r || !r.ok) {
            err.textContent = (r && r.error) || 'Enregistrement impossible';
            err.classList.remove('hidden');
            return;
        }
        G('KEY-CUSTOM').value = '';
        customProviders = r.providers || [];
        G('CUST-FORM').classList.add('hidden');
        renderCustomProviders();
        renderModelOptions();
        updProviderStatuses();
    });
};

// Charger les cles sauvegardees
var BUILTIN_PROVIDERS = ['groq', 'gemini', 'mistral', 'cerebras', 'openai', 'anthropic'];
var providerKeyStatus = {}; // { groq: true, ... } — presence seulement, jamais la valeur

function loadProviderKeys() {
    // Les champs restent vides : la valeur d'une cle enregistree n'est jamais
    // renvoyee au renderer. Le placeholder indique seulement qu'elle existe.
    migrateLegacyProviderKeys().then(function() {
        return window.etherDesktop.providerKeysStatus();
    }).then(function(status) {
        providerKeyStatus = status || {};
        for (var i = 0; i < BUILTIN_PROVIDERS.length; i++) {
            var p = BUILTIN_PROVIDERS[i];
            var el = G('KEY-' + p.toUpperCase());
            if (!el) continue;
            el.value = '';
            el.placeholder = providerKeyStatus[p] ? 'Ta cle perso est enregistree dans ce navigateur — laisser vide pour la conserver' : 'Facultatif : ta cle perso (sinon cle du serveur)';
        }
        loadCustomProviders();
        updProviderStatuses();
    })['catch'](function(e) { console.warn('[KEYS] Chargement echoue:', e); });
}

// Migration unique des cles laissees en clair dans localStorage par les versions
// precedentes : on les pousse dans le coffre chiffre puis on efface l'entree locale.
function migrateLegacyProviderKeys() {
    var legacy = sGet('provider_keys', null);
    if (!legacy || typeof legacy !== 'object') return Promise.resolve();
    var chain = Promise.resolve();
    var migrated = [];
    BUILTIN_PROVIDERS.forEach(function(p) {
        var v = legacy[p];
        if (!v || typeof v !== 'string') return;
        chain = chain.then(function() {
            return window.etherDesktop.providerKeysSet(p, v).then(function(r) {
                if (r && r.ok) migrated.push(p);
            });
        });
    });
    return chain.then(function() {
        try { localStorage.removeItem('ether_provider_keys'); } catch(e) {}
        if (migrated.length) console.log('[MIGRATION] Cles chiffrees puis retirees du stockage local :', migrated.join(', '));
    })['catch'](function(e) { console.warn('[MIGRATION] Echec:', e); });
}

// Sauvegarder les cles
G('SAVE-KEYS').onclick = function() {
    var keys = {
        groq: G('KEY-GROQ').value.trim(),
        gemini: G('KEY-GEMINI').value.trim(),
        mistral: G('KEY-MISTRAL').value.trim(),
        cerebras: G('KEY-CEREBRAS').value.trim(),
        openai: G('KEY-OPENAI').value.trim(),
        anthropic: G('KEY-ANTHROPIC').value.trim()
    };
    // Chaque cle part chiffree dans le coffre. Un champ laisse vide conserve la cle
    // existante : rien n'est jamais ecrit en clair cote renderer.
    var btn = G('SAVE-KEYS');
    var chain = Promise.resolve();
    var failed = [];
    BUILTIN_PROVIDERS.forEach(function(p) {
        var typed = keys[p];
        if (!typed) return;
        chain = chain.then(function() {
            return window.etherDesktop.providerKeysSet(p, typed).then(function(r) {
                if (!r || !r.ok) failed.push(p + ' : ' + ((r && r.error) || 'erreur'));
            });
        });
    });
    chain.then(function() {
        for (var i = 0; i < BUILTIN_PROVIDERS.length; i++) {
            var el = G('KEY-' + BUILTIN_PROVIDERS[i].toUpperCase());
            if (el) el.value = '';
        }
        return window.etherDesktop.providerKeysStatus();
    }).then(function(status) {
        providerKeyStatus = status || {};
        for (var i = 0; i < BUILTIN_PROVIDERS.length; i++) {
            var p = BUILTIN_PROVIDERS[i];
            var el = G('KEY-' + p.toUpperCase());
            if (el) el.placeholder = providerKeyStatus[p] ? 'Ta cle perso est enregistree dans ce navigateur — laisser vide pour la conserver' : 'Facultatif : ta cle perso (sinon cle du serveur)';
        }
        updProviderStatuses();
        if (failed.length) {
            btn.textContent = 'Echec : ' + failed[0];
            btn.style.background = '#ef4444';
        } else {
            btn.textContent = 'Sauvegarde !';
            btn.style.background = '#22c55e';
        }
        setTimeout(function() { btn.textContent = 'Sauvegarder les cles'; btn.style.background = ''; }, 2500);
    });
};

function updProviderStatuses() {
    // Providers principaux avec cles integrees
    var mainProviders = ['gemini', 'mistral', 'cerebras', 'groq'];
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
    // Providers optionnels — presence lue dans le coffre, jamais la valeur
    var keys = providerKeyStatus;
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
    // Workers AI et OpenRouter : cles cote serveur
    var waStatusEl = G('PROV-WORKERSAI-STATUS');
    if (waStatusEl) {
        waStatusEl.innerHTML = providerStatus.workersai
            ? '<span class="prov-dot prov-dot-green"></span>Actif'
            : '<span class="prov-dot prov-dot-red"></span>Indisponible';
        // Consommation du quota gratuit du jour (partage par tous les utilisateurs du serveur).
        if (window.etherDesktop && window.etherDesktop.aiUsage) {
            window.etherDesktop.aiUsage().then(function(u) {
                if (!u || !u.ok) return;
                var pct = Math.min(100, Math.round(u.neurons / u.limit * 100));
                var color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
                var hint = G('PROV-WORKERSAI-USAGE');
                if (!hint) {
                    hint = document.createElement('div');
                    hint.id = 'PROV-WORKERSAI-USAGE';
                    hint.style.cssText = 'font-size:.72rem;color:var(--t3);margin-top:6px';
                    waStatusEl.parentNode.insertBefore(hint, waStatusEl.nextSibling);
                }
                hint.innerHTML = 'Aujourd\'hui : <strong style="color:' + color + '">' + Math.round(u.neurons).toLocaleString('fr-FR')
                    + '</strong> / ' + u.limit.toLocaleString('fr-FR') + ' neurones (' + pct + ' %) — '
                    + u.chat + ' reponses, ' + u.images + ' images. Coupure a 95 %, remise a zero a minuit UTC.'
                    + '<div style="height:4px;background:var(--b3);border-radius:4px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + color + '"></div></div>';
            })['catch'](function() {});
        }
    }
    var orStatusEl = G('PROV-OPENROUTER-STATUS');
    if (orStatusEl) {
        orStatusEl.innerHTML = providerStatus.openrouter
            ? '<span class="prov-dot prov-dot-green"></span>Actif'
            : '<span class="prov-dot prov-dot-red"></span>Indisponible';
    }
    // Fournisseurs personnalises : compte issu du coffre, pas du localStorage.
    var custStatus = G('PROV-CUSTOM-STATUS');
    if (custStatus) {
        var n = customProviders.length;
        custStatus.innerHTML = n
            ? '<span class="prov-dot prov-dot-orange"></span>' + n + ' configure' + (n > 1 ? 's' : '')
            : '<span class="prov-dot prov-dot-gray"></span>Non configure';
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
    } else if (provider === 'mistral') {
        if (window.etherDesktop && window.etherDesktop.mistralChat) {
            window.etherDesktop.mistralChat({ model: 'mistral-small-latest', messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }).then(function(r) {
                if (r.ok) statusEl.innerHTML = '<span class="prov-dot prov-dot-green"></span>Actif';
                else statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur';
            })['catch'](function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur'; });
        } else {
            var keyM = G('KEY-MISTRAL').value.trim();
            if (!keyM) { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Cle manquante'; return; }
            var xhrM = new XMLHttpRequest();
            xhrM.open('POST', 'https://api.mistral.ai/v1/chat/completions', true);
            xhrM.setRequestHeader('Content-Type', 'application/json');
            xhrM.setRequestHeader('Authorization', 'Bearer ' + keyM);
            xhrM.timeout = 8000;
            xhrM.onload = function() {
                if (xhrM.status === 200) statusEl.innerHTML = '<span class="prov-dot prov-dot-green"></span>Actif';
                else statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur ' + xhrM.status;
            };
            xhrM.onerror = function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur'; };
            xhrM.send(JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }));
        }
    } else if (provider === 'openrouter' || provider === 'workersai') {
        window.etherDesktop.providerKeysTest(provider).then(function(r) {
            providerStatus[provider] = !!r.ok;
            statusEl.innerHTML = r.ok ? '<span class="prov-dot prov-dot-green"></span>Actif' : '<span class="prov-dot prov-dot-red"></span>Indisponible';
        })['catch'](function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Indisponible'; providerStatus[provider] = false; });
    } else if (provider === 'custom') {
        // Les fournisseurs personnalises se testent un par un depuis leur ligne dans la liste.
        var n = customProviders.length;
        statusEl.innerHTML = n
            ? '<span class="prov-dot prov-dot-green"></span>' + n + ' configure' + (n > 1 ? 's' : '')
            : '<span class="prov-dot prov-dot-gray"></span>Non configure';
    } else {
        // Test delegue au process principal : la cle reste dans le coffre chiffre,
        // le renderer ne la voit jamais et ne sort pas en reseau lui-meme.
        if (!window.etherDesktop || !window.etherDesktop.providerKeysTest) {
            statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Indisponible';
            return;
        }
        statusEl.innerHTML = '<span class="prov-dot prov-dot-gray"></span>Test...';
        window.etherDesktop.providerKeysTest(provider).then(function(r) {
            if (r && r.ok) statusEl.innerHTML = '<span class="prov-dot prov-dot-green"></span>Actif';
            else statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>' + esc((r && r.error) || 'Erreur');
        })['catch'](function() { statusEl.innerHTML = '<span class="prov-dot prov-dot-red"></span>Erreur'; });
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
// Rien du compte ne reste dans ce navigateur : les donnees vivent sur le
// serveur et reviennent a la prochaine connexion.
function logout() {
    G('SM').classList.add('hidden');
    // Invite : rien a envoyer ni a effacer, les conversations restent ici.
    if (isGuestMode()) { window.etherDesktop.guestExit(); location.reload(); return; }
    window.etherDesktop.authLogout().then(function() { location.reload(); });
}
G('LOGOUT').onclick = function() { if (confirm(isGuestMode() ? 'Quitter le mode invite ? Tes conversations restent sur cet appareil.' : 'Se deconnecter ?')) logout(); };
G('ADD-ACC').onclick = function() { if (confirm('Se deconnecter pour utiliser un autre compte ?')) logout(); };

// === MES DONNEES ===
G('ACC-EXPORT').onclick = function() {
    var b = G('ACC-EXPORT');
    b.disabled = true; b.textContent = 'Preparation...';
    window.etherDesktop.accountExport().then(function(r) {
        b.disabled = false; b.textContent = 'Telecharger toutes mes donnees';
        if (!r || !r.ok) { alert((r && r.error) || 'Export impossible.'); return; }
        // Les images sont des liens : on les rend absolus pour qu'ils restent utilisables hors d'ETHER.
        r.images = (r.images || []).map(function(u) { return location.origin + u; });
        delete r.ok;
        downloadFile('ether-mes-donnees-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(r, null, 2), 'application/json');
    });
};
G('ACC-DEL-OPEN').onclick = function() {
    G('ACC-DEL-BOX').classList.remove('hidden');
    G('ACC-DEL-ERR').classList.add('hidden');
    G('ACC-DEL-PW').value = '';
    G('ACC-DEL-PW').focus();
};
G('ACC-DEL-CANCEL').onclick = function() { G('ACC-DEL-BOX').classList.add('hidden'); };
G('ACC-DEL-OK').onclick = function() {
    var pw = G('ACC-DEL-PW').value, err = G('ACC-DEL-ERR'), b = G('ACC-DEL-OK');
    if (!pw) { err.textContent = 'Entre ton mot de passe.'; err.classList.remove('hidden'); return; }
    b.disabled = true;
    window.etherDesktop.accountDelete(pw).then(function(r) {
        b.disabled = false;
        if (!r || !r.ok) { err.textContent = (r && r.error) || 'Suppression impossible.'; err.classList.remove('hidden'); return; }
        alert('Ton compte et toutes tes donnees ont ete supprimes.');
        location.reload();
    });
};


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
    'mistral-large-latest': 'Mistral Large',
    'mistral-small-latest': 'Mistral Small',
    'qwen-3-235b-a22b-instruct-2507': 'Qwen 235B (Cerebras)',
    'openrouter/free': 'OpenRouter (gratuit)',
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'Llama 3.3 70B (Workers AI)'
};

G('MODEL-SEL-BTN').onclick = function(e) {
    e.stopPropagation();
    var drop = G('MODEL-DROP');
    drop.classList.toggle('hidden');
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
    // Nouveau fournisseur : on redonne sa chance aux taches internes et on retire
    // l'avertissement de la selection precedente.
    if (typeof _taskNoticeShown !== 'undefined') _taskNoticeShown = {};
    var tb = G('TASK-BAR'); if (tb) tb.classList.add('hidden');
    // Retirer .on de tous
    var opts = document.querySelectorAll('.model-opt');
    for (var i = 0; i < opts.length; i++) opts[i].classList.remove('on');
    btn.classList.add('on');

    if (provider === 'auto') {
        selectedModelOverride = null;
        G('MODEL-SEL-LABEL').textContent = 'Auto';
    } else if (provider === 'custom') {
        // L'identifiant permet au process principal de retrouver l'URL et la cle chiffree.
        var cid = btn.getAttribute('data-custom-id');
        selectedModelOverride = { provider: 'custom', model: model, customId: cid };
        G('MODEL-SEL-LABEL').textContent = btn.getAttribute('data-label') || model;
    } else {
        selectedModelOverride = { provider: provider, model: model };
        G('MODEL-SEL-LABEL').textContent = btn.getAttribute('data-label') || modelNames[model] || model;
    }
    G('MODEL-DROP').classList.add('hidden');
}

// Fournisseurs integres selectionnables a la main. Le modele est celui que le
// routage automatique utiliserait pour ce fournisseur.
function builtinPickerEntries() {
    return [
        { provider: 'groq',     label: 'Groq',     model: GROQ_MODELS.main,     note: 'Rapide, usage general' },
        { provider: 'gemini',   label: 'Gemini',   model: GEMINI_MODELS.main,   note: 'Long contexte, creatif' },
        { provider: 'mistral',  label: 'Mistral',  model: MISTRAL_MODELS.main,  note: 'Raisonnement' },
        { provider: 'cerebras', label: 'Cerebras', model: CEREBRAS_MODELS.main, note: 'Tres gros modele' },
        { provider: 'workersai', label: 'Workers AI', model: WORKERSAI_MODELS.main, note: 'Llama 3.3 70B, sans cle' },
        { provider: 'openrouter', label: 'OpenRouter', model: OPENROUTER_MODELS.main, note: 'Gratuit, dernier recours' }
    ];
}

// Fournisseurs payants dont la cle vient de l'utilisateur. Ils n'entrent jamais
// dans le routage automatique : depenser son credit sans qu'il l'ait demande
// serait une mauvaise surprise. Ils n'apparaissent que si une cle est enregistree.
var OPTIONAL_MODELS = {
    openai:    { main: 'gpt-4o',        label: 'OpenAI',    note: 'GPT-4o, cle requise' },
    anthropic: { main: 'claude-sonnet-5', label: 'Anthropic', note: 'Claude Sonnet 5, cle requise' }
};

function optionalPickerEntries() {
    var out = [];
    for (var k in OPTIONAL_MODELS) {
        if (!providerKeyStatus[k]) continue;
        out.push({ provider: k, label: OPTIONAL_MODELS[k].label,
                   model: OPTIONAL_MODELS[k].main, note: OPTIONAL_MODELS[k].note });
    }
    return out;
}

function pickerDot(color) {
    return '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0"></span>';
}

function pickerButton(cfg) {
    var b = document.createElement('button');
    b.className = 'model-opt ' + cfg.cls;
    b.setAttribute('data-provider', cfg.provider);
    b.setAttribute('data-model', cfg.model);
    b.setAttribute('data-label', cfg.label);
    if (cfg.customId) b.setAttribute('data-custom-id', cfg.customId);
    b.onclick = function() { selectModel(this); };
    b.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' + pickerDot(cfg.color)
        + '<span style="font-weight:600;font-size:.84rem">' + esc(cfg.label) + '</span></div>'
        + '<span style="font-size:.7rem;color:var(--t3)">' + esc(cfg.note) + '</span>';
    return b;
}

function pickerSection(cls, title) {
    var el = document.createElement('div');
    el.className = cls;
    el.setAttribute('style', 'padding:8px 10px 4px;font-size:.68rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;border-top:1px solid var(--bd);margin-top:6px');
    el.textContent = title;
    return el;
}

// Reconstruit le menu: Auto, les fournisseurs integres, puis les personnalises.
// Le bouton Auto est statique dans index.html, tout le reste est regenere.
function renderModelOptions() {
    var drop = G('MODEL-DROP');
    if (!drop) return;
    var stale = drop.querySelectorAll('.model-opt-custom, .model-opt-builtin, .model-opt-optional, .model-sep-custom, .model-sep-builtin, .model-sep-optional');
    for (var i = 0; i < stale.length; i++) stale[i].remove();

    // --- Fournisseurs integres ---
    drop.appendChild(pickerSection('model-sep-builtin', 'Fournisseurs integres'));
    var builtins = builtinPickerEntries();
    for (var k = 0; k < builtins.length; k++) {
        var e = builtins[k];
        // Vert quand le fournisseur repond, gris sinon. On laisse le choix possible :
        // en cas d'echec la selection manuelle affiche une erreur claire.
        var up = (typeof providerStatus !== 'undefined') ? providerStatus[e.provider] !== false : true;
        drop.appendChild(pickerButton({
            cls: 'model-opt-builtin', provider: e.provider, model: e.model, label: e.label,
            note: e.note, color: up ? 'var(--color-success)' : 'var(--t3)'
        }));
    }

    // --- Fournisseurs optionnels (cle utilisateur, hors routage automatique) ---
    var optionals = optionalPickerEntries();
    if (optionals.length) {
        drop.appendChild(pickerSection('model-sep-optional', 'Fournisseurs optionnels'));
        for (var o = 0; o < optionals.length; o++) {
            drop.appendChild(pickerButton({
                cls: 'model-opt-optional', provider: optionals[o].provider,
                model: optionals[o].model, label: optionals[o].label,
                note: optionals[o].note, color: 'var(--color-info)'
            }));
        }
    }

    // --- Fournisseurs personnalises ---
    if (!customProviders.length) return;
    drop.appendChild(pickerSection('model-sep-custom', 'Fournisseurs personnalises'));
    for (var j = 0; j < customProviders.length; j++) {
        var p = customProviders[j];
        drop.appendChild(pickerButton({
            cls: 'model-opt-custom', provider: 'custom', model: p.model, label: p.name,
            note: p.model, color: 'var(--color-purple)', customId: p.id
        }));
    }
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
    window.etherDesktop.testAllProviders().then(function(res) {
        // Le serveur renvoie { providers: [...] } ; sans compte, la liste est vide.
        var results = (res && res.providers) || [];
        var ok = [];
        var fail = [];
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            providerStatus[r.provider] = r.ok;
            if (typeof providerHealth !== 'undefined') providerHealth[r.provider] = r.ok;
            if (r.ok) ok.push(r.provider.charAt(0).toUpperCase() + r.provider.slice(1));
            else fail.push(r.provider);
        }
        // Les pastilles du menu de selection refletent ce nouvel etat.
        if (typeof renderModelOptions === 'function') renderModelOptions();
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



// Affiche une seule fois par jour que la limite du serveur est atteinte.
// Appele par platform-web.js quand le worker repond "Quota journalier atteint".
var _quotaNoticeDay = '';
function showQuotaExhausted() {
    var today = new Date().toISOString().slice(0, 10);
    if (_quotaNoticeDay === today) return;
    _quotaNoticeDay = today;
    if (typeof hideThink === 'function') hideThink();
    var d = document.createElement('div');
    d.className = 'msg a';
    d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt"><p><strong>Limite du jour atteinte.</strong></p>'
        + '<p>Ce serveur accorde 100 messages par jour et par personne. Reviens demain, '
        + 'ou ajoute ta propre cle API dans Parametres &gt; Fournisseurs IA : tes messages ne seront alors plus limites.</p></div></div>';
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
    return getDailyRemaining('msg', 100) > 0;
}
function canSearchWeb() {
    // La recherche passe par /api/search, reservee aux comptes.
    if (typeof isGuestMode === 'function' && isGuestMode()) return false;
    if (isPro) return true;
    return getDailyRemaining('web', 30) > 0;
}
// Plus de barre de quota cote client : la limite reelle est celle du serveur.
function updQuotaUI() {}
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

// Sans jeton de session, pas d'app : l'ecran de connexion s'affiche.
var _hasSession = !!(window.etherDesktop && window.etherDesktop.authToken && window.etherDesktop.authToken());
// Mode invite : pas de jeton, tout reste dans ce navigateur.
function isGuestMode() { return !!(window.etherDesktop && window.etherDesktop.isGuest && window.etherDesktop.isGuest()); }
var GUEST_USER = { name: 'Invite', firstName: 'Invite', lastName: '', guest: true };
if(user && _hasSession) showApp();
else if (isGuestMode()) { user = GUEST_USER; showApp(); }
else setLoginMode(user ? 'login' : 'signup', null, user && user.email);

// LOGIN
// Trois ecrans sur la meme carte : connexion, creation de compte, et
// reinitialisation du mot de passe avec le code de secours.
// Pas de valeur initiale ici : setLoginMode() a deja pu etre appele plus haut
// au demarrage, et une affectation l'ecraserait (le formulaire affichait
// "Creer un compte" mais tentait une connexion).
var loginMode;
function setLoginMode(mode, info, email) {
    loginMode = mode;
    G('LS').setAttribute('data-mode', mode);
    G('LT-IN').classList.toggle('on', mode === 'login');
    G('LT-UP').classList.toggle('on', mode === 'signup');
    G('LB').textContent = mode === 'signup' ? 'Creer mon compte' : mode === 'recover' ? 'Changer le mot de passe' : 'Se connecter';
    G('LP').placeholder = mode === 'login' ? 'Mot de passe' : (mode === 'recover' ? 'Nouveau mot de passe' : 'Mot de passe') + ' (8 caracteres min.)';
    G('LP').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    if (email) G('LE').value = email;
    var inf = G('login-info');
    if (info) { inf.textContent = info; inf.classList.remove('hidden'); } else { inf.classList.add('hidden'); }
    G('login-err').style.display = 'none';
}

// Appele par platform-web.js quand le serveur refuse la session.
window.etherShowLogin = function(info) {
    info = info || {};
    G('APP').classList.add('hidden');
    G('RC-CARD').classList.add('hidden');
    if (G('TUTO')) G('TUTO').classList.add('hidden');
    G('LS').classList.remove('hidden');
    G('LS').querySelector('.login-card').classList.remove('hidden');
    setLoginMode(info.legacy ? 'signup' : 'login', info.message || null, info.email || (user && user.email));
    if (info.legacy && user && user.firstName) { G('LN').value = user.firstName; G('LNAME').value = user.lastName || ''; }
};

G('LT-IN').onclick = function() { setLoginMode('login'); };
G('L-GUEST').onclick = function() {
    window.etherDesktop.guestEnter();
    user = GUEST_USER;
    G('LS').classList.add('hidden');
    showApp();
};
G('LT-UP').onclick = function() { setLoginMode('signup'); };
G('L-FORGOT').onclick = function(e) { e.preventDefault(); setLoginMode('recover', 'Entre ton email, le code de secours recu a l inscription, et un nouveau mot de passe.'); };
G('L-BACK').onclick = function(e) { e.preventDefault(); setLoginMode('login'); };

G('LF').onsubmit = function() { G('LB').onclick(); return false; };
G('LB').onclick = function() {
    var D = window.etherDesktop;
    var email = G('LE').value.trim();
    var pw = G('LP').value;
    var errEl = G('login-err');
    function fail(msg) { errEl.textContent = msg; errEl.style.display = 'block'; G('LB').disabled = false; }
    errEl.style.display = 'none';
    if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) return fail('Adresse email invalide.');
    if (!pw) return fail('Mot de passe requis.');
    if (loginMode !== 'login' && pw.length < 8) return fail('Le mot de passe doit faire au moins 8 caracteres.');

    var prenom = G('LN').value.trim(), nom = G('LNAME').value.trim();
    var call;
    if (loginMode === 'signup') {
        if (!prenom) return fail('Le prenom est requis.');
        call = D.authSignup({ name: nom ? prenom + ' ' + nom : prenom, email: email, password: pw });
    } else if (loginMode === 'recover') {
        var code = G('LRC').value.trim();
        if (!code) return fail('Le code de secours est requis.');
        call = D.authRecover({ email: email, recoveryCode: code, newPassword: pw });
    } else {
        call = D.authLogin({ email: email, password: pw });
    }
    G('LB').disabled = true;
    call.then(function(r) {
        if (!r || !r.ok) {
            if (r && r.exists) setLoginMode('login', null, email);
            return fail((r && r.error) || 'Connexion impossible, reessaie.');
        }
        var full = r.user.name || prenom || 'Utilisateur';
        var sp = full.indexOf(' ');
        user = { name: full, firstName: loginMode === 'signup' ? prenom : (sp > 0 ? full.slice(0, sp) : full),
                 lastName: loginMode === 'signup' ? nom : (sp > 0 ? full.slice(sp + 1) : ''), email: r.user.email };
        sSet('user', user);
        G('LP').value = '';
        if (r.recoveryCode) showRecoveryCode(r.recoveryCode);
        else D.authFinish();
    })['catch'](function() { fail('Reseau indisponible, reessaie.'); });
};

// Le code de secours n'est affiche qu'une fois, juste apres l'inscription ou
// une reinitialisation : on ne continue qu'une fois qu'il est note.
function showRecoveryCode(code) {
    G('LS').querySelector('.login-card').classList.add('hidden');
    G('RC-CODE').textContent = code;
    G('RC-CARD').classList.remove('hidden');
    G('RC-COPY').onclick = function() {
        var b = G('RC-COPY');
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function() {
            b.textContent = 'Copie !';
        }, function() { b.textContent = 'Selectionne le code et copie-le'; });
    };
    G('RC-OK').onclick = function() { G('RC-OK').disabled = true; window.etherDesktop.authFinish(); };
}


function showApp(){
    G('LS').classList.add('hidden'); G('APP').classList.remove('hidden');
    G('UNM').textContent=user.name; if (user.email) G('ACC-EMAIL').textContent='Connecte en tant que '+user.email; G('UAV').textContent=user.name.charAt(0).toUpperCase();
    var wg=G('welc-greet'); if(wg) wg.textContent=getGreeting()+', '+user.name;
    initAppWaves(); updHist(); updProjs(); updImgCount(); updQuotaUI(); renderModelOptions(); loadAllModeResources();
    G('uinp').focus();
    if (isGuestMode()) { applyGuestMode(); return; }
    showTutorial();
    startApiMonitor();
    offerGuestImport();
}

// === MODE INVITE ===
// Le serveur n'accepte sans compte que le chat de base avec la cle de
// l'invite : on masque ce qui exige un compte et on ne route que vers les
// fournisseurs pour lesquels une cle est enregistree.
function applyGuestMode() {
    G('GUEST-BAR').classList.remove('hidden');
    ['DEEP-BTN', 'CUSTOM-TOGGLE'].forEach(function(id) { var el = G(id); if (el) el.classList.add('hidden'); });
    var lo = G('LOGOUT'); if (lo) lo.textContent = 'Quitter le mode invite';
    var em = G('ACC-EMAIL'); if (em) em.textContent = 'Mode invite : aucun compte, rien n est enregistre sur le serveur';
    applyGuestRouting();
}
function applyGuestRouting() {
    if (!isGuestMode()) return;
    var D = window.etherDesktop;
    var allowed = D.guestProviders();
    for (var p in providerHealth) {
        if (!providerHealth.hasOwnProperty(p)) continue;
        var ok = allowed.indexOf(p) !== -1 && D.guestHasKey(p);
        providerHealth[p] = ok;
        if (typeof providerStatus !== 'undefined') providerStatus[p] = ok;
    }
    if (typeof renderModelOptions === 'function') renderModelOptions();
}
function openGuestSignup() {
    G('APP').classList.add('hidden');
    G('LS').classList.remove('hidden');
    G('LS').querySelector('.login-card').classList.remove('hidden');
    setLoginMode('signup', 'Cree ton compte : tu pourras importer les conversations de ce mode invite.');
}
G('GUEST-SIGNUP').onclick = openGuestSignup;
window.addEventListener('ether-keys-changed', applyGuestRouting);
// Cle refusee par le fournisseur : on le dit une fois, au lieu d'une bulle vide.
var _guestErrShown = 0;
window.addEventListener('ether-guest-provider-error', function(e) {
    if (Date.now() - _guestErrShown < 15000) return;
    _guestErrShown = Date.now();
    var p = (e.detail && e.detail.provider) || 'Le fournisseur';
    var d = document.createElement('div');
    d.className = 'msg a';
    d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt"><p><strong>' + esc(p.charAt(0).toUpperCase() + p.slice(1))
        + ' a refuse la requete.</strong></p><p>Ta cle est peut-etre invalide, expiree ou sans credit. Verifie-la dans Parametres &gt; Fournisseurs IA, ou cree un compte gratuit pour utiliser ETHER sans cle.</p>'
        + '<div class="guest-card"><button type="button" class="btn-p" data-g="key">Verifier ma cle</button><button type="button" class="btn-s" data-g="signup">Creer un compte gratuit</button></div></div></div>';
    G('MG').appendChild(d);
    d.querySelector('[data-g="key"]').onclick = openProviderSettings;
    d.querySelector('[data-g="signup"]').onclick = openGuestSignup;
    var av = d.querySelector('.mav'); if (av) addMsgWave(av);
    if (typeof scr === 'function') scr();
});
function openProviderSettings() {
    G('SM').classList.remove('hidden');
    loadSett();
    var h = document.querySelector('#SM [data-i18n="set_providers"]');
    if (h && h.scrollIntoView) h.scrollIntoView({ block: 'start' });
}
// Sans cle, l'invite ne peut rien envoyer : message clair, pas de demo.
function showGuestNeedKey() {
    var d = document.createElement('div');
    d.className = 'msg a';
    d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt">'
        + '<p><strong>Ajoute ta cle API pour essayer, ou cree un compte gratuit pour utiliser ETHER sans cle.</strong></p>'
        + '<p>Sans compte, ETHER fonctionne avec ta propre cle Groq, Gemini, Mistral, OpenAI ou Anthropic. Elle reste dans ce navigateur.</p>'
        + '<div class="guest-card"><button type="button" class="btn-p" data-g="key">Ajouter ma cle</button>'
        + '<button type="button" class="btn-s" data-g="signup">Creer un compte gratuit</button></div></div></div>';
    G('MG').appendChild(d);
    d.querySelector('[data-g="key"]').onclick = openProviderSettings;
    d.querySelector('[data-g="signup"]').onclick = openGuestSignup;
    var av = d.querySelector('.mav'); if (av) addMsgWave(av);
    if (typeof scr === 'function') scr();
}
function showGuestAccountOnly(what) {
    var d = document.createElement('div');
    d.className = 'msg a';
    d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt"><p><strong>' + esc(what) + ' est reserve aux comptes.</strong></p>'
        + '<p>Cree un compte gratuit pour y acceder.</p><div class="guest-card"><button type="button" class="btn-p">Creer un compte gratuit</button></div></div></div>';
    G('MG').appendChild(d);
    d.querySelector('button').onclick = openGuestSignup;
    var av = d.querySelector('.mav'); if (av) addMsgWave(av);
    if (typeof scr === 'function') scr();
}

// Apres la creation d'un compte (ou une connexion) depuis le mode invite :
// proposer d'importer les conversations restees sur cet appareil.
function offerGuestImport() {
    var D = window.etherDesktop;
    if (!D || !D.guestImportPeek) return;
    var guestConvs = D.guestImportPeek();
    var ids = guestConvs ? Object.keys(guestConvs) : [];
    if (!ids.length) { if (D.guestImportTake) D.guestImportTake(); return; }
    var d = document.createElement('div');
    d.className = 'msg a';
    d.innerHTML = '<div class="mav"></div><div class="mbd"><div class="mt"><p><strong>Importer tes conversations du mode invite ?</strong></p>'
        + '<p>' + ids.length + ' conversation' + (ids.length > 1 ? 's' : '') + ' de ce navigateur peu' + (ids.length > 1 ? 'vent' : 't')
        + ' rejoindre ton compte et se synchroniser sur tes appareils.</p>'
        + '<div class="guest-card"><button type="button" class="btn-p" data-g="yes">Importer</button>'
        + '<button type="button" class="btn-s" data-g="no">Non merci</button></div></div></div>';
    G('MG').appendChild(d);
    d.querySelector('[data-g="yes"]').onclick = function() {
        var taken = D.guestImportTake() || {};
        var n = 0;
        for (var id in taken) {
            if (!taken.hasOwnProperty(id) || convs[id]) continue;
            convs[id] = taken[id]; n++;
        }
        sSet('convs', convs); updHist();
        d.querySelector('.mt').innerHTML = '<p>' + n + ' conversation' + (n > 1 ? 's importees' : ' importee') + ' dans ton compte.</p>';
    };
    d.querySelector('[data-g="no"]').onclick = function() {
        D.guestImportTake();
        d.querySelector('.mt').innerHTML = '<p>Conversations du mode invite ignorees.</p>';
    };
    var av = d.querySelector('.mav'); if (av) addMsgWave(av);
}

// SIDEBAR
G('TSB').onclick=function(){G('SB').classList.add('collapsed');G('OSB').classList.remove('hidden');};
G('OSB').onclick=function(){G('SB').classList.remove('collapsed');G('OSB').classList.add('hidden');if(window.innerWidth<=768){G('SB').classList.add('open');G('SOV').classList.add('vis');}};
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
// Texte des ressources attachees aux modes, charge une fois et garde en memoire :
// getSystemPrompt est synchrone et ne peut pas attendre une lecture disque.
var modeResources = {};

// Documents joints au mode en cours d'edition. Un mode pas encore enregistre n'a
// pas d'identifiant, donc rien a joindre : on le signale plutot que d'echouer.
function renderModeResources(modeId) {
    var box = G('CM-RES-LIST'), btn = G('CM-RES-ADD'), err = G('CM-RES-ERR');
    if (!box) return;
    err.classList.add('hidden');
    if (!modeId) {
        box.innerHTML = '<div style="font-size:.74rem;color:var(--t3);font-style:italic">Enregistre le mode une premiere fois pour pouvoir y joindre des documents.</div>';
        btn.disabled = true;
        return;
    }
    btn.disabled = false;
    window.etherDesktop.modeResourceList(modeId, false).then(function(list) {
        if (!list || !list.length) {
            box.innerHTML = '<div style="font-size:.74rem;color:var(--t3);font-style:italic">Aucun document joint.</div>';
            return;
        }
        var h = '';
        for (var i = 0; i < list.length; i++) {
            var r = list[i];
            h += '<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--bd);border-radius:8px;padding:6px 10px;background:var(--b3)">'
              + '<div style="flex:1;min-width:0"><div style="font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.name) + '</div>'
              + '<div style="font-size:.66rem;color:var(--t3)">' + r.chars + ' caracteres' + (r.truncated ? ', tronque' : '') + '</div></div>'
              + '<button type="button" class="btn-s" onclick="removeModeResource(\'' + escAttr(modeId) + '\',\'' + escAttr(r.id) + '\')">Retirer</button></div>';
        }
        box.innerHTML = h;
    })['catch'](function() { box.innerHTML = ''; });
}

function removeModeResource(modeId, resId) {
    window.etherDesktop.modeResourceDelete(modeId, resId).then(function() {
        renderModeResources(modeId);
        loadModeResources(modeId);
    });
}

if (G('CM-RES-ADD')) {
    G('CM-RES-ADD').onclick = function() {
        if (!editingModeId) return;
        var err = G('CM-RES-ERR');
        window.etherDesktop.openFile().then(function(sel) {
            var files = sel && sel.files ? sel.files : (Array.isArray(sel) ? sel : []);
            if (!files.length) return;
            return window.etherDesktop.modeResourceAdd(editingModeId, files[0].path || files[0]);
        }).then(function(r) {
            if (!r) return;
            if (!r.ok) {
                err.textContent = r.error || 'Document illisible';
                err.classList.remove('hidden');
                return;
            }
            renderModeResources(editingModeId);
            loadModeResources(editingModeId);
        })['catch'](function(e) {
            err.textContent = 'Echec : ' + (e && e.message ? e.message : 'inconnu');
            err.classList.remove('hidden');
        });
    };
}


function loadModeResources(modeId) {
    if (!window.etherDesktop || !window.etherDesktop.modeResourceList) return Promise.resolve([]);
    return window.etherDesktop.modeResourceList(modeId, true).then(function(list) {
        modeResources[modeId] = list || [];
        return modeResources[modeId];
    })['catch'](function() { modeResources[modeId] = []; return []; });
}

function loadAllModeResources() {
    var ids = (customModes || []).map(function(m) { return m.id; });
    return Promise.all(ids.map(loadModeResources));
}

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
    G('CM-WHEN').value = '';
    renderModeResources(null);
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
    G('CM-WHEN').value = m.description || '';
    renderModeResources(id);
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
    var description = G('CM-WHEN').value.trim();

    if (editingModeId) {
        // Modifier
        for (var i = 0; i < customModes.length; i++) {
            if (customModes[i].id === editingModeId) {
                customModes[i].name = name;
                customModes[i].emoji = emoji;
                customModes[i].specialty = specialty;
                customModes[i].style = style;
                customModes[i].instructions = instructions;
                customModes[i].description = description;
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
            instructions: instructions,
            description: description
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
    if (typeof SKILL_CREATOR !== 'undefined') {
        SKILL_CREATOR.open();
    } else {
        var drop = G('CUSTOM-DROP');
        if (drop.classList.contains('hidden')) {
            drop.classList.remove('hidden');
            renderCustomModes(); // refresh
        } else {
            drop.classList.add('hidden');
        }
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
    callAI({
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

        callAI({
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
