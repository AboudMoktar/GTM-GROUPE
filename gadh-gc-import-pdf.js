// ============================================================
// CRM GADH — IMPORT D'UNE COMMANDE PDF (client ou fournisseur)
// Lit le texte du PDF (pdf.js intégré, sans Internet), reconnaît : type de document,
// client ou fournisseur, n° et date, conditions, lignes (article, quantité, prix, date),
// contrôle quantité × prix = montant de ligne et total du document, puis ouvre le
// formulaire de commande déjà rempli, à vérifier et corriger avant d'enregistrer.
// Confirmation fournisseur d'une commande déjà saisie : comparaison et enregistrement
// de la confirmation. PDF scanné (image sans texte) : signalé, saisie manuelle.
// Chargé après gadh-gc-v002.js.
// ============================================================

// ---------- Lecture du PDF ----------
async function gcpdfCharger(){
  if(typeof pdfjsLib !== 'undefined' && globalThis.pdfjsWorker) return;
  await chargerIntegree('pdfjsworker', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
  await chargerIntegree('pdfjs', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
}
// Lignes de texte (éléments regroupés par hauteur), avec la position de chaque élément
async function gcpdfLignes(buf){
  await gcpdfCharger();
  const doc = await pdfjsLib.getDocument({data:new Uint8Array(buf), isEvalSupported:false, disableFontFace:true}).promise, out = [];
  for(let p = 1; p <= doc.numPages; p++){
    const tc = await (await doc.getPage(p)).getTextContent(), L = [];
    tc.items.forEach(it => { const s = String(it.str || '').replace(/\s+/g, ' ').trim(); if(!s) return; const x = it.transform[4], y = it.transform[5];
      let l = L.find(z => Math.abs(z.y - y) <= 2.5); if(!l){ l = {y, items:[]}; L.push(l); } l.items.push({x, y, s}); });
    L.sort((a, b) => b.y - a.y).forEach(l => { l.items.sort((a, b) => a.x - b.x); out.push({page:p, y:l.y, items:l.items, t:l.items.map(i => i.s).join(' ')}); });
  }
  return out;
}

// ---------- OCR (document scanné) : Tesseract intégré, sans Internet, rien n'est conservé ----------
let gcpdfTess = null;
// Moteur OCR : intégré au fichier HTML (balises bib-*) ou, en version plusieurs fichiers, dans vendor/ocr-moteur.js (window.GC_BIBS)
function gcpdfTexteBib(id){ const e = document.getElementById('bib-' + id); if(e) return e.textContent; if(window.GC_BIBS && window.GC_BIBS[id]) return window.GC_BIBS[id]; throw new Error('Moteur OCR absent (vendor/ocr-moteur.js)'); }
async function gcpdfOcrMoteur(progres){
  if(gcpdfTess) return gcpdfTess;
  await chargerIntegree('tesseract', 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  if(!document.getElementById('bib-tesscore') && !window.GC_BIBS && window.GC_LOCAL && window.GC_LOCAL.ocr){ if(progres) progres('chargement du moteur', 0.02); await chargerScript(window.GC_LOCAL.ocr); }
  // page ouverte depuis un fichier (origine « null ») : un worker ne peut pas importer d'autre script ;
  // le moteur (TesseractCore) et le worker sont donc réunis dans un seul script.
  const urlWorker = URL.createObjectURL(new Blob([gcpdfTexteBib('tesscore'), '\n;\n', gcpdfTexteBib('tessworker')], {type:'text/javascript'}));
  const b64 = gcpdfTexteBib('tessfra').trim(), bin = atob(b64), data = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  gcpdfTess = await Tesseract.createWorker([{code:'fra', data}], 1, {workerPath:urlWorker, corePath:'tesseract-core-simd-lstm.wasm.js', workerBlobURL:false, cacheMethod:'none', gzip:true,
    logger:m => { if(progres && m && m.status) progres(m.status === 'recognizing text' ? 'reconnaissance du texte' : 'chargement du moteur', m.status === 'recognizing text' ? m.progress : 0.05); }});
  await gcpdfTess.setParameters({preserve_interword_spaces:'1'});
  return gcpdfTess;
}
async function gcpdfOcr(buf, progres){
  await gcpdfCharger();
  const doc = await pdfjsLib.getDocument({data:new Uint8Array(buf), isEvalSupported:false}).promise, out = [];
  let base = 0;
  for(let p = 1; p <= Math.min(doc.numPages, 4); p++){
    const page = await doc.getPage(p), v1 = page.getViewport({scale:1}), ech = Math.min(3.5, 2600 / v1.width), vp = page.getViewport({scale:ech});
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    await page.render({canvasContext:cx, viewport:vp}).promise;
    if(progres) progres('page ' + p + ' / ' + Math.min(doc.numPages, 4), 0.02);
    const w = await gcpdfOcrMoteur((t, pc) => progres && progres('page ' + p + ' : ' + t, pc));
    const r = await w.recognize(cv, {}, {blocks:true, text:true});
    // mots → éléments (mots proches regroupés) → lignes, en points PDF (comme un PDF texte)
    const lignes = [];
    (r.data.blocks || []).forEach(bl => (bl.paragraphs || []).forEach(pa => (pa.lines || []).forEach(li => lignes.push(li))));
    lignes.sort((a, b) => a.bbox.y0 - b.bbox.y0).forEach(li => {
      const mots = (li.words || []).filter(m => String(m.text || '').trim() && m.confidence > 20).sort((a, b) => a.bbox.x0 - b.bbox.x0); if(!mots.length) return;
      const items = []; let cur = null;
      mots.forEach(m => { const larg = (m.bbox.x1 - m.bbox.x0) / Math.max(1, m.text.length);
        if(cur && m.bbox.x0 - cur.x1 < Math.max(larg, cur.larg) * 1.6) { cur.s += ' ' + m.text; cur.x1 = m.bbox.x1; }
        else { cur = {x0:m.bbox.x0, x1:m.bbox.x1, s:m.text, larg}; items.push(cur); } });
      const y = -(base + li.bbox.y0 / ech);
      out.push({page:p, y, items:items.map(it => ({x:it.x0 / ech, y, s:it.s.trim()})), t:items.map(it => it.s.trim()).join(' ')});
    });
    base += v1.height + 50; cv.width = cv.height = 0;
  }
  return out;
}

// ---------- Nombres et dates ----------
const GCPDF_MOIS = {jan:1, janv:1, january:1, janvier:1, feb:2, fev:2, fevr:2, february:2, fevrier:2, mar:3, mars:3, march:3, apr:4, avr:4, april:4, avril:4, may:5, mai:5, jun:6, juin:6, june:6, jul:7, juil:7, july:7, juillet:7,
  aug:8, aou:8, aout:8, august:8, sep:9, sept:9, september:9, septembre:9, oct:10, october:10, octobre:10, nov:11, november:11, novembre:11, dec:12, december:12, decembre:12, gen:1, giu:6, lug:7, ago:8, set:9, ott:10, dic:12};
function gcpdfDates(t){
  const out = [], s = GC.norm(t) === '' ? '' : String(t);
  let m; const re1 = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/g;
  while((m = re1.exec(s))){ const y = m[3].length === 2 ? '20' + m[3] : m[3]; if(+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) out.push({i:m.index, d:y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'), brut:m[0]}); }
  const re2 = /\b(\d{1,2})[\s.-]([A-Za-zéûÉÛ]{3,9})\.?[\s.-](\d{4})\b/g;
  while((m = re2.exec(s))){ const mo = GCPDF_MOIS[GC.norm(m[2]).replace(/ /g, '')]; if(mo) out.push({i:m.index, d:m[3] + '-' + String(mo).padStart(2, '0') + '-' + m[1].padStart(2, '0'), brut:m[0]}); }
  const re3 = /\b(20\d{2})-(\d{2})-(\d{2})\b/g; while((m = re3.exec(s))) out.push({i:m.index, d:m[0], brut:m[0]});
  return out.sort((a, b) => a.i - b.i);
}
// Nombre écrit à la française, à l'anglaise ou à l'italienne : 250.000,00 · 17800.00 · .125 · 0,5000 · 1 200
function gcpdfNombre(tok){
  let s = String(tok).replace(/[€$£\s ]/g, '').replace(/^(EUR|TND|USD)/i, '');
  if(!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const pt = s.lastIndexOf('.'), vg = s.lastIndexOf(',');
  if(pt >= 0 && vg >= 0){ s = pt > vg ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.'); }
  else if(vg >= 0){ s = /^\d{1,3}(,\d{3})+$/.test(s) && !/^0,/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.'); }
  else if(pt >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s) && !/^0\./.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s); return isFinite(n) ? {v:n, dec:/[.,]\d/.test(String(tok))} : null;
}
function gcpdfNombresLigne(l){
  // éléments du texte (hors dates), en tenant compte des montants écrits « € 0,5000 »
  const out = [];
  l.items.forEach(it => { let sansDates = gcpdfDates(it.s).reduce((s, d) => s.replace(d.brut, ' '), it.s);
    for(let k = 0; k < 3; k++) sansDates = sansDates.replace(/(^|[^\d.,])(\d{1,3})[\s  ](\d{3})(?=[.,]\d|[\s  ]\d{3}|\D|$)/g, '$1$2$3');
    sansDates.split(/\s+/).forEach(tok => { if(!tok) return; const n = gcpdfNombre(tok); if(n) out.push(Object.assign({x:it.x, tok}, n)); }); });
  return out;
}

// ---------- Analyse du document ----------
function gcpdfTexte(L){ return L.map(l => l.t).join('\n'); }
function gcpdfSousLibelle(L, re, opts){
  // valeur écrite sous un libellé (même colonne) ou juste à sa droite
  opts = opts || {};
  for(let i = 0; i < L.length; i++){
    const it = L[i].items.find(x => re.test(x.s)); if(!it) continue;
    const reste = it.s.replace(re, '').replace(/^[\s:.#°]+/, '').trim(); if(reste && !opts.dessous) return reste;
    const droite = L[i].items.filter(x => x.x > it.x + 5 && x.x - it.x < 140); if(droite.length && opts.droite) return droite[0].s;
    for(let j = i + 1; j < Math.min(L.length, i + 4); j++){ if(L[j].page !== L[i].page) break; const v = L[j].items.find(x => Math.abs(x.x - it.x) < (opts.tol || 30)); if(v) return v.s; }
  }
  return '';
}
function gcpdfLignesCommande(L){
  // une ligne de commande = une date + au moins 2 nombres (quantité, prix)
  const R = [];
  // les lignes sont sous l'en-tête des colonnes (quantité et prix), s'il existe
  const entete = L.findIndex(l => /(qty|quantit|qt[ée]|qtà)/i.test(l.t) && /(price|prix|prezzo|p\.\s?u)/i.test(l.t));
  L.forEach((l, i) => {
    if(entete >= 0 && i <= entete) return;
    const dates = gcpdfDates(l.t); if(!dates.length) return;
    const N = gcpdfNombresLigne(l).filter(n => n.v > 0); if(N.length < 2) return;
    if(/\b(total|du|date of|votre cde|vostro|page)\b/i.test(l.t) && N.length < 3) return;
    let q = null, p = null, t = null;
    for(const a of N) for(const b of N) for(const c of N){ if(a === b || a === c || b === c) continue; if(a.v >= 1 && b.v < a.v && c.v > b.v && Math.abs(a.v * b.v - c.v) <= Math.max(0.011, c.v * 0.0005)){ if(!q || a.v > q.v){ q = a; p = b; t = c; } } }
    if(!q){ const tri = N.slice().sort((a, b) => b.v - a.v); q = tri[0]; const pc = N.filter(n => n !== q && n.v < q.v); p = pc.filter(n => n.dec).sort((a, b) => a.v - b.v)[0] || pc.filter(n => n.v > 0 && n.x > q.x).sort((a, b) => a.v - b.v)[0] || null; }
    if(!q || !p) return;
    const ref = /(?:^|\s)(\d{2,}-[A-Z0-9]{3,})(?:\s+([A-Z])\b)?/.exec(l.items.filter(x => x.x < q.x).map(x => x.s).join(' '));
    R.push({i, l, date:dates[0].d, dates:dates.map(d => d.d), qte:q.v, pu:p.v, montant:t ? t.v : null, controle:!!t, refClient:ref ? ref[1] + (ref[2] ? ' rév. ' + ref[2] : '') : ''});
  });
  // texte de chaque ligne : du milieu de la ligne précédente au milieu de la suivante (article écrit au-dessus ou en dessous)
  R.forEach((r, k) => { const de = k ? R[k - 1].i + 1 : Math.max(0, r.i - 4), a = k < R.length - 1 ? R[k + 1].i - 1 : Math.min(L.length - 1, r.i + 6); r.bloc = L.slice(de, a + 1).map(l => l.t).join(' '); });
  return R;
}
// Commande dont les livraisons sont écrites en texte : « … ne doit pas dépasser 31 OCTOBRE · Qté : 250.000 »
const GCPDF_MOIS_RE = /(\d{1,2})(?:er)?\s*(janv(?:ier)?|f[ée]v(?:r(?:ier)?)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?|jan(?:uary)?|feb(?:ruary)?|march|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep|october|november|december)\.?(?:\s+(\d{4}))?/gi;
function gcpdfEcheancier(L, A, R){
  // ligne d'article sans date : quantité × prix = montant
  let art = null;
  L.forEach((l, i) => { if(art) return; const N = gcpdfNombresLigne(l).filter(n => n.v > 0);
    for(const a of N) for(const b of N) for(const c of N){ if(a === b || a === c || b === c) continue; if(a.v >= 1 && b.v < a.v && c.v > b.v && Math.abs(a.v * b.v - c.v) <= Math.max(0.011, c.v * 0.0005) && !art) art = {i, l, qte:a.v, pu:b.v, montant:c.v}; } });
  if(!art) return;
  const ref = new Date((A.date || getTodayISO()) + 'T00:00:00Z'), an0 = ref.getUTCFullYear();
  const txt = L.slice(art.i).map(l => l.t).join('\n'), ev = [];
  let m; GCPDF_MOIS_RE.lastIndex = 0;
  while((m = GCPDF_MOIS_RE.exec(txt))){ const mo = GCPDF_MOIS[GC.norm(m[2]).replace(/ /g, '').slice(0, 4)] || GCPDF_MOIS[GC.norm(m[2]).replace(/ /g, '').slice(0, 3)]; if(!mo) continue;
    let an = m[3] ? +m[3] : an0; if(!m[3] && mo < ref.getUTCMonth() + 1 - 1) an = an0 + 1;
    ev.push({i:m.index, type:'date', d:an + '-' + String(mo).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0')}); }
  const reQ = /(?:qt[eéè]|qty|quantit[eéè])\s*[:.]?\s*([\d][\d.,\s  ]*\d|\d)/gi;
  while((m = reQ.exec(txt))){ const n = gcpdfNombre(m[1].replace(/[\s  ]/g, '')); if(n) ev.push({i:m.index, type:'qte', v:n.v}); }
  ev.sort((a, b) => a.i - b.i);
  const paires = []; let d = null;
  ev.forEach(e => { if(e.type === 'date') d = e.d; else if(d){ paires.push({qte:e.v, date:d}); d = null; } });
  const somme = paires.reduce((s, x) => s + x.qte, 0);
  if(paires.length && Math.abs(somme - art.qte) < 0.5){
    paires.forEach((x, k) => R.push({i:art.i, l:art.l, date:x.date, dates:[x.date], qte:x.qte, pu:art.pu, montant:null, controle:false, echeance:true, refClient:''}));
    A.echeancier = {lignes:paires.length, total:art.qte, montant:art.montant, controle:true};
  } else {
    R.push({i:art.i, l:art.l, date:'', dates:[], qte:art.qte, pu:art.pu, montant:art.montant, controle:true, refClient:''});
    if(paires.length) A.alertes.push('Échéancier lu (' + paires.map(x => gcQ(x.qte)).join(' + ') + ') différent de la quantité commandée (' + gcQ(art.qte) + ') : dates à saisir.');
    else A.alertes.push('Aucune date de livraison trouvée : à saisir.');
  }
  const bloc = L.slice(Math.max(0, art.i - 2), Math.min(L.length, art.i + 14)).map(l => l.t).join(' ');
  R.forEach(r => { r.bloc = bloc; });
}

// Article du catalogue le plus proche du texte de la ligne
function gcpdfArticle(bloc, clientId){
  const D = gcD(), b = ' ' + String(bloc).replace(/[μµ]/g, 'u') + ' ', bn = GC.norm(bloc), bc = GC.normRef(bloc);
  let best = null;
  D.articles.filter(a => !a.archive).forEach(a => {
    let s = 0; const at = a.attributs || {}, g = (String(a.gamme || '').match(/\d{2,4}/) || [])[0], ep = at.epaisseur_um, lg = at.largeur_mm;
    if(a.ref && bc.indexOf(GC.normRef(a.ref)) >= 0) s += 100;
    if(clientId){ const cmd = D.cmdC.find(c => c.clientId === clientId && c.lignes.some(l => l.articleId === a.id && l.refClient && bn.indexOf(GC.norm(l.refClient.split(' ')[0])) >= 0)); if(cmd) s += 90; }
    if(a.marque && bn.replace(/ /g, '').indexOf(GC.norm(a.marque).replace(/ /g, '')) >= 0) s += 15;
    if(g && new RegExp('(^|\\D)' + g + '(\\D|$)').test(b)) s += 20;
    if(g && ep && new RegExp(g + '\\s*/\\s*' + ep + '(\\D|$)').test(b)) s += 40; else if(ep && new RegExp('(^|\\D)' + ep + '\\s*(um|my|ym|mic|microns?)\\b', 'i').test(b)) s += 30; else if(ep && new RegExp('(^|\\D)' + ep + '(\\D|$)').test(b)) s += 5;
    if(lg && (new RegExp('(^|\\D)' + lg + '\\s*mm\\b', 'i').test(b) || (ep && new RegExp(ep + '\\s*[-/]\\s*' + lg + '(\\D|$)').test(b)))) s += 30; else if(lg && new RegExp('(^|\\D)' + lg + '(\\D|$)').test(b)) s += 5;
    if(!best || s > best.s) best = {a, s};
  });
  return best && best.s >= 60 ? best : null;
}
// Client ou fournisseur cité dans le document
function gcpdfTiers(texte){
  const tn = ' ' + GC.norm(texte) + ' ', D = gcD(), soc = GC.norm(factParams().raison || 'gadh');
  const trouve = (nom) => { const n = GC.norm(nom).replace(/\b(sarl|sa|sas|spa|s p a|s a r l|ltd|gmbh|srl)\b/g, '').trim(); return n.length >= 3 && tn.indexOf(' ' + n + ' ') >= 0; };
  const cl = Object.entries(gcClients()).filter(([, c]) => c && !c.archive && (trouve(c.nom) || (c.groupe && trouve(c.groupe)))).map(([id, c]) => ({id, nom:c.nom}));
  const code = (c) => c && String(c).length >= 3 && new RegExp('(^|[^a-z0-9])' + GC.norm(c).replace(/ /g, '') + '([^a-z0-9]|$)').test(tn.replace(/ /g, '  '));
  const mf = (m) => { const d = String(m || '').replace(/\D/g, ''); return d.length >= 7 && String(texte).replace(/\D/g, ' ').indexOf(d.slice(0, 7)) >= 0; };
  const fo = D.fournisseurs.filter(f => !f.archive && (trouve(f.nom) || (f.raisonSociale && trouve(f.raisonSociale)) || code(f.codeFournisseur) || mf(f.mf))).map(f => ({id:f.id, nom:f.nom}));
  cl.push(...Object.entries(gcClients()).filter(([id, c]) => c && !c.archive && !cl.some(x => x.id === id) && (code(c.numeroFournisseur) && false || mf(c.mf))).map(([id, c]) => ({id, nom:c.nom})));
  if(!fo.length){ // nom mal lu (scan) : un mot distinctif du nom, s'il ne désigne qu'un seul fournisseur
    const mots = (n) => GC.norm(n).split(' ').filter(w => w.length >= 5 && !/^(societe|international|tunisie|france|italia|group)$/.test(w));
    const c = D.fournisseurs.filter(f => !f.archive && mots(f.nom).some(w => tn.indexOf(' ' + w + ' ') >= 0));
    if(c.length === 1) fo.push({id:c[0].id, nom:c[0].nom, approx:true}); }
  return {cl, fo, nous:/\bgadh\b/.test(tn) || tn.indexOf(soc) >= 0 || mf(factParams().mf)};
}
function gcpdfNomSociete(L){
  // nom d'entreprise probable (forme juridique), hors GADH
  const l = L.find(x => /\b(S\.?A\.?R\.?L|SARL|S\.?P\.?A|SpA|S\.?A\.?S|GmbH|Ltd|Limited|Inc|S\.A\.)\b/.test(x.t) && !/gadh/i.test(x.t));
  if(!l) return '';
  const it = l.items.find(x => /\b(S\.?A\.?R\.?L|SARL|S\.?P\.?A|SpA|S\.?A\.?S|GmbH|Ltd|Limited|Inc|S\.A\.)\b/.test(x.s)) || l.items[0];
  return it.s.replace(/^(Supplier|Fournisseur|Client|Customer)\s*:\s*/i, '').trim();
}
function gcpdfAnalyser(L, nomFichier){
  const T = gcpdfTexte(L), tiers = gcpdfTiers(T), R = gcpdfLignesCommande(L), A = {fichier:nomFichier, lignes:R, alertes:[], tiers};
  // type : confirmation / commande d'un client / notre commande au fournisseur
  const conf = /confirmation de commande|order confirmation|conferma d'ordine|accus[ée] de r[ée]ception/i.test(T);
  const notreCF = /\bfournisseur\s*\n?\s*FR\d+|bon de commande fournisseur/i.test(T) && tiers.nous;
  A.type = conf || notreCF || (tiers.fo.length && !tiers.cl.length) ? 'fournisseur' : 'client';
  A.conf = conf; A.notreCommande = !conf && A.type === 'fournisseur';
  A.tiersId = A.type === 'client' ? (tiers.cl[0] || {}).id || '' : (tiers.fo[0] || {}).id || '';
  if(!A.tiersId) A.nomInconnu = gcpdfNomSociete(L);
  // numéro et date
  A.numero = gcpdfSousLibelle(L, /purchase order no|order no\.?|order number|n[°o] de commande|commande n[°o]|bon de commande n[°o]|po number/i, {dessous:true}).split(' ')[0] || '';
  if(!A.numero){ const m = /\b(CD|BC|PO|CF|CMD)\s?-?\s?(\d{2,4})[-\/](\d{2,6})\b/i.exec(L.slice(0, 8).map(l => l.t).join('\n')); if(m) A.numero = m[0].replace(/\s+/g, ' ').trim(); }
  if(A.type === 'client' && /^CD\s?0?\d{2}[-\/]/i.test(A.numero) && !tiers.cl.length){ A.type = 'fournisseur'; A.notreCommande = true; A.tiersId = (tiers.fo[0] || {}).id || ''; }
  if(A.tiersId && A.type === 'fournisseur' && (tiers.fo.find(x => x.id === A.tiersId) || {}).approx) A.alertes.push('Fournisseur reconnu d\'après une partie de son nom (« ' + gcNomFour(A.tiersId) + ' ») : vérifiez.');
  const nConf = /(?:confirmation[^\n]*\n?[^\n]*?)?\bN[°o]\s*([A-Z]{0,4}\d+[\/\-]?\d+)/.exec(T); A.numeroConf = conf && nConf ? nConf[1] : '';
  const notre = /(?:votre cde|votre commande|your order|vostro ord)[^\n]*?n[°o.]*\s*:?\s*([A-Z]{1,4}[\s\-]?\d{2}[\s\-\/]?\d{1,6})(?:[^\n]*?du\s+([\d\/.\-]+))?/i.exec(T);
  A.notreRef = notre ? notre[1].replace(/\s+/g, '') : '';
  if(!A.notreRef && A.notreCommande && A.numero) A.notreRef = A.numero.replace(/\s+/g, '');
  const mCD = /^([A-Z]{1,4})-?0?(\d{2})[-\/](\d+)$/i.exec(A.notreRef); if(mCD) A.notreRefCRM = mCD[1].toUpperCase() + '0' + mCD[2] + '-' + String(+mCD[3]).padStart(3, '0'); A.notreDate = notre && notre[2] ? (gcpdfDates(notre[2])[0] || {}).d || '' : '';
  const dLib = gcpdfSousLibelle(L, /date of order|order date|date de (la )?commande|^du$|^date$/i, {dessous:true});
  A.date = (gcpdfDates(dLib)[0] || {}).d || (gcpdfDates((/\bdu\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/i.exec(T) || [])[1] || '')[0] || {}).d || (R.length ? '' : '') || (gcpdfDates(L.slice(0, R.length ? R[0].i : L.length).map(l => l.t).join(' '))[0] || {}).d || '';
  if(conf && /\bdu\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.test(T)) A.dateConf = gcpdfDates(/\bdu\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(T)[1])[0].d;
  A.conditions = gcpdfSousLibelle(L, /payment terms|mode de r[èe]glement|conditions de paiement|pagamento/i, {dessous:true});
  A.devise = (/\b(EUR|TND|USD)\b/.exec(T) || [])[1] || '';
  A.acheteur = (() => { for(let i = 0; i < L.length; i++){ const it = L[i].items.find(x => /^(buyer|acheteur|acheteuse)$/i.test(x.s)); if(!it) continue; const v = [];
    for(let j = i + 1; j < Math.min(L.length, i + 4) && v.length < 2; j++){ const w = L[j].items.find(x => Math.abs(x.x - it.x) < 30); if(w && !/@|email|date|currency/i.test(w.s)) v.push(w.s); else if(v.length) break; } return v.join(' '); } return ''; })();
  A.email = (T.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).filter(e => !/gadh/i.test(e))[0] || '';
  A.suiviPar = (/(?:suivie par|followed by|seguito da)\s+([A-Z][\w-]+)/i.exec(T) || [])[1] || '';
  const totLib = gcpdfSousLibelle(L, /^(total order|total ht|total commande|net à payer|net a payer|total)$/i, {dessous:true, tol:45});
  const tot = /(?:total order|total ht|total commande|net à payer)\D{0,25}?([\d.,  ]{3,})/i.exec(T.replace(/\n/g, ' '));
  A.totalDoc = (gcpdfNombre(String(totLib).replace(/\s/g, '')) || {}).v || (tot ? (gcpdfNombre(tot[1].replace(/\s/g, '')) || {}).v : null) || null;
  if(!R.length) gcpdfEcheancier(L, A, R);
  // articles
  R.forEach(r => { const m = gcpdfArticle(r.bloc, A.type === 'client' ? A.tiersId : ''); r.articleId = m ? m.a.id : ''; r.confiance = m ? m.s : 0;
    const rf = /R[ée]f[ée]r[ée]nce\s+\w+\s*:\s*(\S+)|Supplier Item\s*:?\s*([^\n]{3,40}?)(?:\s{2}|Ship|$)/i.exec(r.bloc); r.refFournisseur = rf ? (rf[1] || rf[2] || '').trim() : ''; });
  A.somme = GC.r2(R.reduce((s, r) => s + r.qte * r.pu, 0));
  // contrôles
  if(!R.length) A.alertes.push('Aucune ligne de commande reconnue (quantité, prix et date sur une même ligne).');
  R.forEach((r, k) => { if(!r.articleId) A.alertes.push('Ligne ' + (k + 1) + ' : article non reconnu, à choisir.'); if(r.montant !== null && !r.controle) A.alertes.push('Ligne ' + (k + 1) + ' : montant non vérifié.'); });
  if(A.totalDoc && R.length && Math.abs(A.totalDoc - A.somme) > 0.05) A.alertes.push('Total du document ' + gcE(A.totalDoc) + ' ≠ somme des lignes lues ' + gcE(A.somme) + ' : une ligne a peut-être été mal lue.');
  if(!A.tiersId) A.alertes.push((A.type === 'client' ? 'Client' : 'Fournisseur') + ' non reconnu' + (A.nomInconnu ? ' (« ' + A.nomInconnu + ' » ?)' : '') + ' : choisissez-le ou créez-le.');
  if(!A.numero && A.type === 'client') A.alertes.push('N° de commande du client non trouvé.');
  return A;
}

// ---------- Fenêtre « Importer une commande PDF » ----------
window.gcpdfOuvrir = (type) => {
  if(!gcPeut()) return gcRefus();
  mgtModal('Importer une commande PDF', `<p style="margin-top:0;">Choisissez le PDF d'une <b>commande client</b> (bon de commande, « purchase order ») ou d'une <b>commande ou confirmation fournisseur</b>. La CRM lit le document et prépare la commande : vous vérifiez et corrigez avant d'enregistrer.</p>
    <div class="gcpdf-note" data-gc="pdf-non-conserve">🔒 <b>Le PDF n'est pas enregistré dans la CRM.</b> Il sert seulement à lire les données, puis il est oublié : seule la commande que vous validez est enregistrée. Gardez l'original dans vos dossiers.</div>
    <label class="gcpdf-zone" data-gc="zone-pdf"><input type="file" id="gcpdf-fichier" accept="application/pdf,.pdf" onchange="gcpdfLire(this, '${type || ''}')"><span>${gcvIc('in')}</span><b>Choisir le PDF</b><small>ou le déposer ici</small></label>
    <div id="gcpdf-etat" class="gc-sous" style="margin-top:8px;"></div>
    <div class="gc-sous" style="margin-top:8px;">PDF créé par un logiciel : lecture directe. PDF <b>scanné</b> (photo) : lecture par reconnaissance de caractères (OCR), plus lente et moins sûre, à bien vérifier.</div>`);
  const z = document.querySelector('[data-gc="zone-pdf"]');
  if(z){ ['dragover', 'dragenter'].forEach(e => z.addEventListener(e, ev => { ev.preventDefault(); z.classList.add('survol'); })); z.addEventListener('dragleave', () => z.classList.remove('survol'));
    z.addEventListener('drop', ev => { ev.preventDefault(); z.classList.remove('survol'); const f = ev.dataTransfer.files[0]; if(f) gcpdfTraiter(f, type || ''); }); }
};
window.gcpdfLire = (input, type) => { const f = input.files && input.files[0]; if(f) gcpdfTraiter(f, type); };
let gcpdfDernier = null;
async function gcpdfTraiter(f, type){
  const etat = document.getElementById('gcpdf-etat'); if(etat) etat.textContent = 'Lecture de « ' + f.name + ' »…';
  try {
    const buf = await f.arrayBuffer(); let L = await gcpdfLignes(buf.slice(0));
    if(window.gcpdfUrl) URL.revokeObjectURL(window.gcpdfUrl);
    window.gcpdfUrl = URL.createObjectURL(new Blob([buf], {type:'application/pdf'}));
    let ocr = false;
    if(L.filter(l => /[A-Za-z]{3,}/.test(l.t)).length < 3){
      ocr = true; if(etat) etat.innerHTML = '<b>Document scanné</b> : lecture par reconnaissance de caractères (OCR)… <span id="gcpdf-ocr">préparation</span><div class="gcpdf-barre"><i id="gcpdf-ocr-b"></i></div><div class="gc-sous">Cela peut prendre 10 à 40 secondes par page.</div>';
      L = await gcpdfOcr(buf.slice(0), (txt, pct) => { const e = document.getElementById('gcpdf-ocr'), bb = document.getElementById('gcpdf-ocr-b'); if(e) e.textContent = txt; if(bb) bb.style.width = Math.round(pct * 100) + '%'; });
      if(L.filter(l => /[A-Za-z]{3,}/.test(l.t)).length < 3){ mgtModal('PDF illisible', `<p style="margin-top:0;">Le document a été lu par OCR mais presque aucun texte n'a été reconnu (image trop floue ou trop petite).</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="mgtFermer(); gcsfFormCommande()">Saisir une commande client</button><button class="btn btn-ghost" onclick="mgtFermer(); gcfrFormCommande()">Saisir une commande fournisseur</button></div>`); return; }
    }
    const A = gcpdfAnalyser(L, f.name); A.ocr = ocr; if(type) A.type = type === 'fournisseur' ? 'fournisseur' : 'client';
    if(type && type !== A.type) A.tiersId = A.type === 'client' ? (A.tiers.cl[0] || {}).id || '' : (A.tiers.fo[0] || {}).id || '';
    gcpdfDernier = A;
    gcJournal('Import PDF', A.type === 'client' ? 'Commande client' : 'Commande fournisseur', {id:'', numero:A.numero || A.numeroConf || A.notreRef || 'PDF'}, A.lignes.length + ' ligne(s) lue(s)' + (A.ocr ? ' (OCR)' : '') + ' · PDF non conservé');
    gcpdfOuvrirFormulaire(A);
  } catch(e){ console.error('Import PDF', e); if(etat) etat.innerHTML = '<span style="color:var(--bad);">Lecture impossible : ' + esc(e.message || String(e)) + '</span>'; }
}
function gcpdfBandeau(A, extra, existe){
  const ok = A.lignes.filter(r => r.controle).length, nb = A.lignes.length;
  const lus = [A.numero ? 'commande <b>' + esc(A.numero) + '</b>' : '', A.numeroConf ? 'confirmation <b>' + esc(A.numeroConf) + '</b>' : '', A.notreRef && !A.notreCommande ? 'votre commande <b>' + esc(A.notreRef) + '</b>' : '', A.date ? 'du ' + gcDt(A.date) : '',
    nb + ' ligne' + (nb > 1 ? 's' : ''), A.somme ? 'total ' + gcE(A.somme) : '', A.conditions ? 'paiement ' + esc(A.conditions) : ''].filter(Boolean).join(' · ');
  const tot = A.totalDoc ? (Math.abs(A.totalDoc - A.somme) <= 0.05 ? `<div class="gcpdf-ok">✓ Total du document (${gcE(A.totalDoc)}) = somme des lignes lues</div>` : '') : '';
  const lig = ok ? `<div class="gcpdf-ok">✓ ${ok}/${nb} ligne(s) : quantité × prix = montant imprimé</div>` : A.echeancier ? `<div class="gcpdf-ok">✓ ${gcQ(A.echeancier.total)} × prix = ${gcE(A.echeancier.montant)} imprimé · ${A.echeancier.lignes} livraisons lues dans le texte, total = quantité commandée</div>` : '';
  return `<div class="gcpdf-bandeau" data-gc="bandeau-pdf"><div><b>📄 ${A.ocr ? 'Lu par OCR (document scanné)' : 'Lu dans le PDF'}</b> · ${lus} ${window.gcpdfUrl ? `<a href="${window.gcpdfUrl}" target="_blank" rel="noopener">voir le PDF</a>` : ''} <span class="gc-sous">· PDF non conservé</span></div>
    ${A.ocr ? '<div class="gcpdf-av">Document scanné lu par OCR : vérifiez chaque valeur (chiffres, dates, article) avant d\'enregistrer.</div>' : ''}${tot}${lig}
    ${A.alertes.length ? `<div class="gcpdf-av">À vérifier : ${A.alertes.map(esc).join(' · ')}</div>` : existe ? '' : `<div class="gcpdf-ok">Vérifiez les prix et les dates, puis enregistrez.</div>`}${extra || ''}</div>`;
}
function gcpdfOuvrirFormulaire(A){
  const D = gcD();
  if(A.type === 'client'){
    // commande déjà saisie ?
    const ex = A.tiersId && A.numero && D.cmdC.find(c => c.clientId === A.tiersId && String(c.reference || '') === String(A.numero) && c.statut !== 'annulee');
    if(ex){ mgtModal('Commande déjà enregistrée', gcpdfBandeau(A, '', true) + `<p>La commande <b>PO ${esc(A.numero)}</b> de ${esc(gcNomClient(A.tiersId))} existe déjà dans la CRM.</p>${gcpdfComparer(A, ex.lignes.map(l => ({qte:l.qte, pu:l.pu, date:l.dateLivraison})))}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-primary" onclick="mgtFermer(); gcOuvrir('gc-commande', '${ex.id}')">Ouvrir la commande</button><button class="btn btn-ghost" onclick="mgtFermer()">Fermer</button></div>`); gcpdfLarge(); return; }
    gcsfFormCommande(A.tiersId ? {clientId:A.tiersId} : {});
    const o = A.tiersId ? gcsfOffreValable(A.tiersId) : null;
    Object.assign(gcsfCmd, {clientId:A.tiersId || '', offreId:o ? o.id : '', po:A.numero || '', date:A.date || getTodayISO(), cond:A.conditions || (gcClients()[A.tiersId] || {}).conditions || '', source:{pdf:true},
      lignes:A.lignes.length ? A.lignes.map(r => ({articleId:r.articleId, refClient:r.refClient, qte:r.qte, pu:r.pu, puManuel:true, sourcePrix:'PDF', dateLivraison:r.date, dateDeclaration:''})) : gcsfCmd.lignes});
    gcsfCmd.infoHTML = gcpdfBandeau(A, !A.tiersId ? `<button class="btn btn-ghost gcsf-petit" data-gc="creer-tiers-pdf" onclick="gcpdfCreerTiers()">+ Créer le client${A.nomInconnu ? ' « ' + esc(A.nomInconnu) + ' »' : ''}</button>` : '');
    gcsfDessinerCommande(); gcpdfLarge();
    return;
  }
  // fournisseur : confirmation d'une commande déjà saisie ?
  const cle = (s) => { const m = String(s || '').toUpperCase().match(/[A-Z]+|\d+/g) || []; return m.map(x => /^\d+$/.test(x) ? String(+x) : x).join('-'); };
  const ex = A.notreRef && D.cmdF.find(c => c.statut !== 'annulee' && cle(c.numero) === cle(A.notreRef));
  if(ex && A.conf){ gcpdfConfirmation(A, ex); return; }
  if(ex){ mgtModal('Commande déjà enregistrée', gcpdfBandeau(A, '', true) + `<p>La commande fournisseur <b>${esc(ex.numero)}</b> (${esc(gcNomFour(ex.fournisseurId))}) existe déjà dans la CRM.</p>${gcpdfComparer(A, ex.lignes.map(l => ({qte:l.qte, pu:l.pu, date:l.dateLivraison})))}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-primary" onclick="mgtFermer(); gcOuvrir('gc-achat', '${ex.id}')">Ouvrir la commande</button><button class="btn btn-ghost" onclick="mgtFermer()">Fermer</button></div>`); gcpdfLarge(); return; }
  const a0 = A.lignes.find(r => r.articleId), arts = Array.from(new Set(A.lignes.map(r => r.articleId).filter(Boolean)));
  gcfrFormCommande(A.tiersId ? {fournisseurId:A.tiersId} : {});
  Object.assign(gcfrCmd, {fournisseurId:A.tiersId || gcfrCmd.fournisseurId, articleId:a0 ? a0.articleId : '', numero:A.notreRefCRM || A.notreRef || gcfrCmd.numero, date:A.notreDate || A.date || getTodayISO(), pu:a0 ? a0.pu : '', puManuel:true,
    note:[A.numeroConf ? 'Confirmation fournisseur ' + A.numeroConf + (A.dateConf ? ' du ' + gcDt(A.dateConf) : '') : '', a0 && a0.refFournisseur ? 'Réf. fournisseur : ' + a0.refFournisseur : ''].filter(Boolean).join('\n'),
    lignes:A.lignes.length ? A.lignes.map(r => ({qte:r.qte, date:r.date})) : gcfrCmd.lignes, source:{pdf:true, confirmation:A.numeroConf ? {reference:A.numeroConf, date:A.dateConf || A.date, suiviPar:A.suiviPar} : null}});
  gcfrCmd.info = ''; gcfrCmd.infoHTML = gcpdfBandeau(A, (arts.length > 1 ? '<div class="gcpdf-av">Plusieurs articles dans le document : une commande fournisseur ne porte que sur un article, les autres sont à saisir à part.</div>' : '')
    + (!A.tiersId ? `<button class="btn btn-ghost gcsf-petit" data-gc="creer-tiers-pdf" onclick="gcpdfCreerTiers()">+ Créer le fournisseur${A.nomInconnu ? ' « ' + esc(A.nomInconnu) + ' »' : ''}</button>` : ''));
  gcfrDessinerCommande(); gcpdfLarge();
}
function gcpdfOublier(){ if(window.gcpdfUrl){ try { URL.revokeObjectURL(window.gcpdfUrl); } catch(e) {} window.gcpdfUrl = null; } gcpdfDernier = null; window.gcpdfConf = null; }
const gcpdfFermer = window.mgtFermer;
window.mgtFermer = () => { const ouvert = document.querySelector('#mgt-modal-zone [data-gc="bandeau-pdf"], #mgt-modal-zone [data-gc="zone-pdf"]'); gcpdfFermer(); if(ouvert) gcpdfOublier(); };
function gcpdfLarge(){ const m = document.querySelector('#mgt-modal-zone .modal-sheet'); if(m) m.classList.add('gcmv-large'); }
function gcpdfComparer(A, lignes){
  const n = Math.max(A.lignes.length, lignes.length); let html = '';
  for(let i = 0; i < n; i++){ const r = A.lignes[i] || {}, l = lignes[i] || {}, dq = r.qte !== undefined && l.qte !== undefined && Math.abs(r.qte - l.qte) > 1e-9, dp = r.pu !== undefined && l.pu !== undefined && Math.abs(r.pu - l.pu) > 1e-9, dd = r.date && l.date && r.date !== l.date;
    html += `<tr><td>${i + 1}</td><td class="n">${l.qte !== undefined ? gcQ(l.qte) : '—'}</td><td class="n ${dq ? 'gcpdf-diff' : ''}">${r.qte !== undefined ? gcQ(r.qte) : '—'}</td><td class="n">${l.pu !== undefined ? gcE(l.pu) : '—'}</td><td class="n ${dp ? 'gcpdf-diff' : ''}">${r.pu !== undefined ? gcE(r.pu) : '—'}</td><td>${l.date ? gcDt(l.date) : '—'}</td><td class="${dd ? 'gcpdf-diff' : ''}">${r.date ? gcDt(r.date) : '—'}</td></tr>`; }
  return `<div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Ligne</th><th class="n">Qté CRM</th><th class="n">Qté PDF</th><th class="n">Prix CRM</th><th class="n">Prix PDF</th><th>Date CRM</th><th>Date PDF</th></tr></thead><tbody>${html}</tbody></table></div><div class="gc-sous">Les différences sont surlignées.</div>`;
}
function gcpdfConfirmation(A, cf){
  const rec = GC.recus(gcD());
  window.gcpdfConf = {A, cfId:cf.id};
  mgtModal('Confirmation fournisseur · ' + esc(cf.numero), gcpdfBandeau(A, '', true) + `<p style="margin:8px 0;">Ce document confirme votre commande <b>${esc(cf.numero)}</b> (${esc(gcNomFour(cf.fournisseurId))}). Comparaison avec la commande enregistrée :</p>
    ${gcpdfComparer(A, cf.lignes.map(l => ({qte:l.qte, pu:l.pu, date:l.dateLivraison})))}
    ${cf.confirmation ? `<div class="gc-alerte" style="margin-top:8px;">Confirmation déjà enregistrée : ${esc(cf.confirmation.reference || '')} du ${gcDt(cf.confirmation.date)}.</div>` : ''}
    <label style="display:flex;gap:8px;align-items:center;margin:10px 0 4px;font-size:13px;"><input type="checkbox" id="gcpdf-dates" checked style="width:18px;height:18px;min-width:0;"> Reprendre les dates d'expédition du document</label>
    <label style="display:flex;gap:8px;align-items:center;margin:4px 0 10px;font-size:13px;"><input type="checkbox" id="gcpdf-prix" style="width:18px;height:18px;min-width:0;"> Reprendre les quantités et les prix du document (lignes non encore reçues)</label>
    <button class="btn btn-primary" style="width:100%;" data-gc="enregistrer-confirmation-pdf" onclick="gcpdfEnregistrerConfirmation()">Enregistrer la confirmation ${esc(A.numeroConf || '')}</button>`);
  gcpdfLarge();
}
window.gcpdfEnregistrerConfirmation = () => gcOperation(() => {
  const {A, cfId} = window.gcpdfConf, D = gcD(), cf = D.cmdF.find(x => x.id === cfId), rec = GC.recus(D), dates = document.getElementById('gcpdf-dates').checked, prix = document.getElementById('gcpdf-prix').checked, ch = [];
  const lignes = cf.lignes.map((l, i) => { const r = A.lignes[i]; if(!r) return l; const n = Object.assign({}, l, {confirmee:true}); const recu = rec[GC.cleLigne(cfId, l.lid)] || 0;
    if(dates && r.date && r.date !== l.dateLivraison){ ch.push('expédition ' + (i + 1) + ' : ' + gcDt(l.dateLivraison) + ' → ' + gcDt(r.date)); n.dateLivraison = r.date; }
    if(prix && !recu){ if(Math.abs(r.qte - l.qte) > 1e-9){ ch.push('quantité ' + (i + 1) + ' : ' + gcQ(l.qte) + ' → ' + gcQ(r.qte)); n.qte = r.qte; } if(Math.abs(r.pu - l.pu) > 1e-9){ ch.push('prix ' + (i + 1) + ' : ' + gcE(l.pu) + ' → ' + gcE(r.pu)); n.pu = r.pu; } }
    return n; });
  const n = Object.assign({}, cf, {statut:GC.CMDF_OUVERTE[GC.statutCmdF(cf, rec).cle] || cf.statut === 'brouillon' ? (GC.statutCmdF(cf, rec).cle === 'partielle' ? cf.statut : 'confirmee') : cf.statut, lignes,
    datePrevue:lignes.filter(l => GC.num(l.qte) - (rec[GC.cleLigne(cfId, l.lid)] || 0) > 0).map(l => l.dateLivraison).filter(Boolean).sort()[0] || cf.datePrevue,
    confirmation:{date:A.dateConf || A.date || getTodayISO(), reference:A.numeroConf || '', suiviPar:A.suiviPar || '', par:gcPar(), importePDF:true},
    historique:gcHistoCF(cf, 'Confirmation fournisseur ' + (A.numeroConf || '') + ' (import PDF)', ch.join(' · ') || 'conforme à la commande')});
  gcEnregistrer('cmdF', n); gcJournal('Confirmation fournisseur (PDF)', 'Commande fournisseur', n, (A.numeroConf || '') + (ch.length ? ' · ' + ch.join(' · ') : ' · conforme'));
  mgtFermer(); showToast('Confirmation ' + (A.numeroConf || '') + ' enregistrée sur ' + cf.numero + (ch.length ? ' (' + ch.length + ' modification(s))' : ' (conforme)')); gcOuvrir('gc-achat', cfId);
});
// Créer le client ou le fournisseur lu dans le PDF
window.gcpdfCreerTiers = () => gcOperation(() => {
  const A = gcpdfDernier; if(!A) return;
  const nom = prompt((A.type === 'client' ? 'Nom du client' : 'Nom du fournisseur') + ' à créer :', A.nomInconnu || ''); if(!nom) return;
  if(A.type === 'client'){
    const l = Object.assign({}, gcClients()); if(Object.values(l).some(c => c && GC.norm(c.nom) === GC.norm(nom))){ showToast('Ce client existe déjà : choisissez-le dans la liste'); return; }
    const id = mgtId('k'); l[id] = {nom, email:A.email || '', acheteur:A.acheteur || '', contact:A.acheteur || '', conditions:A.conditions || '', devise:A.devise || ''}; setJSON('gadh_fact_clients', l); gcCacheD = null;
    gcJournal('Création', 'Client', {id, numero:nom}, 'depuis un PDF importé'); gcsfLireCommande(); gcsfCmd.clientId = id; gcsfCmd.infoHTML = gcsfCmd.infoHTML.replace(/<button[^>]*creer-tiers-pdf[\s\S]*?<\/button>/, '<div class="gcpdf-ok">✓ Client « ' + esc(nom) + ' » créé</div>'); gcsfDessinerCommande(); gcpdfLarge();
  } else {
    if(gcD().fournisseurs.some(f => GC.norm(f.nom) === GC.norm(nom))){ showToast('Ce fournisseur existe déjà : choisissez-le dans la liste'); return; }
    const f = {id:GC.nouvelId('fo'), nom, actif:true, email:A.email || '', conditions:A.conditions || '', delai:Number(gcReglages().delaiDefaut) || 7};
    gcEnregistrer('fournisseurs', f); gcJournal('Création', 'Fournisseur', {id:f.id, numero:nom}, 'depuis un PDF importé'); gcfrLire(); gcfrCmd.fournisseurId = f.id; gcfrCmd.infoHTML = gcfrCmd.infoHTML.replace(/<button[^>]*creer-tiers-pdf[\s\S]*?<\/button>/, '<div class="gcpdf-ok">✓ Fournisseur « ' + esc(nom) + ' » créé</div>'); gcfrDessinerCommande(); gcpdfLarge();
  }
});

// ---------- Les formulaires affichent le bandeau du PDF et gardent la source ----------
const gcpdfDessinerCmd = gcsfDessinerCommande;
gcsfDessinerCommande = function(){
  gcpdfDessinerCmd();
  const z = document.querySelector('#mgt-modal-zone .modal-sheet');
  if(z && gcsfCmd && gcsfCmd.infoHTML){ const h = z.querySelector('.gc-form'); if(h) h.insertAdjacentHTML('beforebegin', gcsfCmd.infoHTML); }
  else if(z && gcsfCmd && !gcsfCmd.infoHTML){ const h = z.querySelector('.gc-form'); if(h) h.insertAdjacentHTML('beforebegin', `<div class="gcpdf-lien"><button class="btn btn-ghost gcsf-petit" data-gc="remplir-pdf" onclick="gcpdfOuvrir('client')">📄 Remplir depuis un PDF</button></div>`); }
};
const gcpdfDessinerCF = gcfrDessinerCommande;
gcfrDessinerCommande = function(){
  gcpdfDessinerCF();
  const z = document.querySelector('#mgt-modal-zone .modal-sheet');
  if(z && gcfrCmd && gcfrCmd.infoHTML){ const h = z.querySelector('.gc-form'); if(h) h.insertAdjacentHTML('beforebegin', gcfrCmd.infoHTML); }
  else if(z && gcfrCmd && !gcfrCmd.infoHTML){ const h = z.querySelector('.gc-form'); if(h) h.insertAdjacentHTML('beforebegin', `<div class="gcpdf-lien"><button class="btn btn-ghost gcsf-petit" data-gc="remplir-pdf" onclick="gcpdfOuvrir('fournisseur')">📄 Remplir depuis un PDF</button></div>`); }
};
// à l'enregistrement : source PDF et confirmation lue dans le document
const gcpdfEnrCmd = window.gcsfEnregistrerCommande;
window.gcsfEnregistrerCommande = () => {
  const src = gcsfCmd && gcsfCmd.source, po = gcsfCmd && gcsfCmd.po, cl = gcsfCmd && gcsfCmd.clientId, avant = gcD().cmdC.length;
  gcpdfEnrCmd(); const enr = src && gcD().cmdC.length > avant;
  if(src){ gcCacheD = null; const c = gcD().cmdC.find(x => x.clientId === cl && String(x.reference) === String(po).trim()); if(c && gcD().cmdC.length > avant) gcEnregistrer('cmdC', Object.assign({}, c, {source:{type:'pdf', date:getTodayISO(), par:gcPar()}})); }
};
const gcpdfEnrCF = window.gcfrEnregistrer;
window.gcfrEnregistrer = () => {
  gcfrLire(); const src = gcfrCmd && gcfrCmd.source, num = gcfrCmd && String(gcfrCmd.numero || '').trim(), avant = gcD().cmdF.length;
  gcpdfEnrCF(); const enr = src && gcD().cmdF.length > avant;
  if(src){ gcCacheD = null; const cf = gcD().cmdF.find(x => x.numero === num); if(cf && gcD().cmdF.length > avant){ const n = Object.assign({}, cf, {source:{type:'pdf', date:getTodayISO(), par:gcPar()}});
    if(src.confirmation){ n.confirmation = Object.assign({par:gcPar()}, src.confirmation); n.statut = 'confirmee'; n.lignes = n.lignes.map(l => Object.assign({}, l, {confirmee:true})); n.historique = gcHistoCF(cf, 'Confirmation fournisseur ' + src.confirmation.reference + ' (import PDF)', ''); }
    gcEnregistrer('cmdF', n); if(activeTab === 'gc-achat') nav('gc-achat'); } }
};

// ---------- Boutons « Importer une commande PDF » ----------
const gcpdfCmds = window.renderGcCommandes;
window.renderGcCommandes = function(main){ gcpdfCmds(main); if(gcPeut()) gcmvAjouterAction(`<button class="btn btn-ghost" data-gc="importer-pdf" onclick="gcpdfOuvrir('client')">📄 Importer une commande PDF</button>`); };
const gcpdfAchats = window.renderGcAchats;
window.renderGcAchats = function(main){ gcpdfAchats(main); if(gcPeut()) gcmvAjouterAction(`<button class="btn btn-ghost" data-gc="importer-pdf" onclick="gcpdfOuvrir('fournisseur')">📄 Importer une commande PDF</button>`); };
// Accueil : 7ᵉ action
const gcpdfActions = gcvActions;
gcvActions = function(C, ed){ const a = gcpdfActions(C, ed); a.splice(3, 0, {id:'pdf', ic:'doc', lib:'Importer un PDF', sous:'commande client ou fournisseur', c:'#7A4CC2', bg:'#F1EBFB', clic:ed ? `gcpdfOuvrir()` : `gcRefus()`}); return a; };

// ---------- Styles ----------
(function(){
  const s = document.createElement('style');
  s.textContent = `
  .gcv-actions{grid-template-columns:repeat(7,1fr) !important;}
  @media (max-width:900px){ .gcv-actions{grid-template-columns:repeat(4,1fr) !important;gap:6px !important;} .gcv-act{font-size:11px !important;padding:10px 2px 8px !important;} .gcv-act span{width:40px !important;height:40px !important;} }
  .gcpdf-zone{display:flex;flex-direction:column;align-items:center;gap:6px;border:2px dashed var(--border);border-radius:16px;padding:26px 12px;cursor:pointer;text-align:center;background:var(--surface-2);}
  .gcpdf-zone.survol{border-color:var(--accent);background:var(--accent-bg);} .gcpdf-zone input{display:none;} .gcpdf-zone span svg{width:30px;height:30px;color:var(--accent);} .gcpdf-zone small{color:var(--ink-soft);}
  .gcpdf-bandeau{border:1px solid var(--accent);background:var(--accent-bg);border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13px;line-height:1.55;}
  .gcpdf-ok{color:var(--good);font-weight:600;} .gcpdf-av{color:var(--warn);font-weight:600;}
  .gcpdf-diff{background:var(--warn-bg);color:var(--warn);font-weight:700;}
  .gcpdf-lien{margin:-6px 0 10px;}
  .gcpdf-note{font-size:12.5px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin:8px 0 10px;}
  .gcpdf-barre{height:8px;border-radius:9px;background:var(--border);overflow:hidden;margin:6px 0;} .gcpdf-barre i{display:block;height:100%;width:0;background:var(--accent);transition:width .3s;}
  `;
  document.head.appendChild(s);
})();
