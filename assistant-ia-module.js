// ============================================================
// ASSISTANT IA (chatbot) — Google Gemini, sans serveur
// ------------------------------------------------------------
// Bouton 🤖 dans la barre du haut : on pose une question en français sur les
// commandes (Suivi PERCKO : étapes, restes, exports, expéditions), l'assistant
// répond à partir des données que le compte connecté peut déjà lire.
//
// Offre Firebase gratuite (Spark) : pas de fonction serveur. L'application appelle
// directement l'API Gemini depuis le navigateur. La clé API :
//  - est saisie dans l'assistant (⚙), gardée UNIQUEMENT sur cet appareil
//    (localStorage, jamais dans le code, jamais dans Firebase) ;
//  - se crée gratuitement sur https://aistudio.google.com/apikey.
// Attention : en offre gratuite, Google peut utiliser les échanges pour améliorer
// ses modèles (avertissement affiché dans les réglages).
// Données envoyées : un résumé du suivi (lignes de commande, quantités par étape,
// exports, expéditions), recalculé à chaque question.
// ============================================================

const IA_CLE = 'gtm_ia_cle_gemini';      // localStorage seulement (pas setJSON : ne doit pas aller dans Firebase)
const IA_MODELE = 'gtm_ia_modele';
const IA_MODELES = [
  ['gemini-3.8-flash', 'Gemini 3.8 Flash (recommandé)'],
  ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite (plus rapide, plus de questions gratuites)'],
  ['gemini-3.6-flash', 'Gemini 3.6 Flash']
];
const IA_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const IA_ETAPES = [['cp', 'coupé'], ['gadh', 'envoyé GADH'], ['asm', 'assemblage GADH'], ['ret', 'retour TEK-TREND'], ['conf', 'confection'], ['ctl', 'contrôlé'], ['emb', 'emballé (prêt à expédier)'], ['exp', 'expédié']];

let iaHisto = [];          // [{role:'user'|'model', text}]
let iaEnCours = false;
let iaStatut = null;       // affiche « j'essaie encore… » pendant les nouveaux essais

/* Réglages gardés sur l'appareil : en mémoire, dans IndexedDB (base à part, jamais pleine à cause des données
   de l'application) et, si possible, dans localStorage. localStorage seul ne suffisait pas : la copie locale des
   données de l'application peut le remplir, et l'enregistrement de la clé échouait alors sans message. */
const IA_MEM = {};
function iaIdb(){
  return new Promise((ok, ko) => { try { const r = indexedDB.open('gtm-assistant-ia', 1); r.onupgradeneeded = () => r.result.createObjectStore('reglages'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); } catch(e){ ko(e); } });
}
function iaIdbEcrire(k, v){
  return iaIdb().then(db => new Promise((ok, ko) => { const tx = db.transaction('reglages', 'readwrite'), st = tx.objectStore('reglages'); if(v) st.put(v, k); else st.delete(k); tx.oncomplete = () => { db.close(); ok(true); }; tx.onerror = () => { db.close(); ko(tx.error); }; }));
}
function iaIdbLire(k){
  return iaIdb().then(db => new Promise(ok => { const rq = db.transaction('reglages').objectStore('reglages').get(k); rq.onsuccess = () => { db.close(); ok(rq.result || ''); }; rq.onerror = () => { db.close(); ok(''); }; })).catch(() => '');
}
function iaLire(k, def){ if(IA_MEM[k] !== undefined) return IA_MEM[k] || def; try { return localStorage.getItem(k) || def; } catch(e){ return def; } }
/* renvoie une promesse : true si la valeur est bien gardée sur l'appareil (IndexedDB ou localStorage) */
function iaEcrire(k, v){
  IA_MEM[k] = v || '';
  let ls = false; try { if(v) localStorage.setItem(k, v); else localStorage.removeItem(k); ls = true; } catch(e){}
  return iaIdbEcrire(k, v).then(() => true, () => ls);
}
const iaPret = Promise.all([IA_CLE, IA_MODELE].map(k => iaIdbLire(k).then(v => { if(v && IA_MEM[k] === undefined) IA_MEM[k] = v; })));
function iaCle(){ return iaLire(IA_CLE, ''); }
function iaModele(){ const m = iaLire(IA_MODELE, IA_MODELES[0][0]); return m; }

/* ---------- bouton dans la barre du haut ---------- */
/* classe propre (pas « theme-btn » : ce bouton-là est masqué dans l'affichage habituel et son icône est remplacée) */
(function(){
  const st = document.createElement('style'); st.id = 'ia-btn-css';
  st.textContent = 'html body .topbar .user-chip .ia-btn{display:inline-flex !important;align-items:center;justify-content:center;width:40px;height:40px;min-width:40px;padding:0;border:0;border-radius:10px;background:rgba(127,140,160,.18) !important;font-size:21px;line-height:1;cursor:pointer;flex-shrink:0}';
  (document.head || document.documentElement).appendChild(st);
})();
function assistantBouton(){
  return `<button class="ia-btn" onclick="assistantOuvrir()" aria-label="Assistant IA" title="Assistant IA">🤖</button>`;
}

/* ---------- résumé des données (ce que l'assistant « voit ») ---------- */
function iaDocsSuivi(){
  try { return (typeof suiviLireDocs === 'function') ? suiviLireDocs() : {}; } catch(e){ return {}; }
}
function iaDate(d){ return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : (d || ''); }
function iaContexte(){
  const docs = iaDocsSuivi(), lignes = [], mvts = [], cfg = docs.cfg || {}, lotsInfo = cfg.lots || {};
  let exports = [];
  Object.keys(docs).forEach(id => {
    const d = docs[id] || {};
    if(id.indexOf('lines-') === 0) (d.lines || []).forEach(a => lignes.push({id:a[0], lot:d.lot, client:a[2], model:a[3], lib:a[4], size:a[5], qty:+a[6] || 0}));
    else if(id.indexOf('moves-') === 0) (d.moves || []).forEach(a => mvts.push({date:a[1], lineId:a[2], stage:a[3], qty:+a[4] || 0, nc:+a[6] || 0, ct:a[8] || ''}));
    else if(id === 'exports') exports = d.liste || [];
  });
  if(!lignes.length) return {texte:'(Aucune donnée de suivi de commandes disponible pour ce compte.)', vide:true};
  const t = {}, nc = {}, parId = {};
  lignes.forEach(l => { parId[l.id] = l; t[l.id] = {}; nc[l.id] = {}; });
  const idsExport = {}; exports.forEach(e => { idsExport[e.id] = 1; (e.cartons || []).forEach(c => { idsExport[c.id] = 1; }); });
  const expHors = {};   // expéditions saisies hors export : lot -> date -> pièces
  mvts.forEach(m => {
    if(!t[m.lineId]) return;
    t[m.lineId][m.stage] = (t[m.lineId][m.stage] || 0) + m.qty; nc[m.lineId][m.stage] = (nc[m.lineId][m.stage] || 0) + m.nc;
    if(m.stage === 'exp' && !(m.ct && idsExport[m.ct])){ const lot = parId[m.lineId].lot, o = expHors[lot] = expHors[lot] || {}; o[m.date] = (o[m.date] || 0) + m.qty; }
  });
  const K = IA_ETAPES.map(e => e[0]), out = [];
  const lots = Array.from(new Set(lignes.map(l => l.lot))).sort();
  lots.forEach(lot => {
    const info = lotsInfo[lot] || {}, L = lignes.filter(l => l.lot === lot);
    out.push(`## Commande (lot) ${lot}`);
    const meta = [];
    if(info.received) meta.push('reçue le ' + iaDate(info.received));
    if(info.ready) meta.push('validée le ' + iaDate(info.ready));
    if(info.livraison) meta.push('livraison prévue le ' + iaDate(info.livraison));
    const tot = {q:0}; K.forEach(k => tot[k] = 0); let ncTot = 0;
    L.forEach(l => { tot.q += l.qty; K.forEach(k => { tot[k] += t[l.id][k] || 0; ncTot += nc[l.id][k] || 0; }); });
    meta.push(`${tot.q} pièces commandées`);
    out.push(meta.join(' · '));
    out.push(`Cumuls de la commande : ` + IA_ETAPES.map(e => `${e[1]} ${tot[e[0]]}`).join(', ') + ` · non conformes (NC) ${ncTot} · reste à livrer ${Math.max(0, tot.q - tot.exp)}`);
    const eh = expHors[lot]; if(eh) out.push('Expéditions saisies hors export (Flux/Pilotage) : ' + Object.keys(eh).sort().map(d => `${iaDate(d)} : ${eh[d]} pièces`).join(' ; '));
    out.push('Lignes (une par client, modèle, libellé, taille). Colonnes : client;modèle;libellé;taille;commandé;' + IA_ETAPES.map(e => 'cumul ' + e[1]).join(';') + ';NC;' +
      'actuellement : coupées non envoyées;chez la GADH (envoyées, pas revenues);retournées pas en confection;en confection;contrôlées pas emballées;emballées prêtes à expédier;reste à livrer');
    L.forEach(l => {
      const x = t[l.id], g = k => x[k] || 0, n = Object.keys(nc[l.id]).reduce((s, k) => s + nc[l.id][k], 0);
      const actu = [g('cp') - g('gadh'), g('gadh') - g('ret'), g('ret') - g('conf'), g('conf') - g('ctl'), g('ctl') - g('emb'), g('emb') - g('exp'), Math.max(0, l.qty - g('exp'))].map(v => Math.max(0, v));
      out.push([l.client, l.model, l.lib, l.size, l.qty].concat(K.map(g)).concat([n]).concat(actu).join(';'));
    });
    out.push('');
  });
  if(exports.length){
    out.push('## Exports (expéditions préparées en cartons, onglet Exports)');
    exports.slice().sort((a, b) => (a.d || '').localeCompare(b.d || '') || a.n - b.n).forEach(e => {
      const C = e.cartons || [], det = {}; let q = 0;
      C.forEach(c => (c.it || []).forEach(x => { const l = parId[x[0]], lot = l ? l.lot : x[2], lib = l ? l.lib : x[3], sz = l ? l.size : x[4], k = `${lot} · ${lib} · ${sz}`; det[k] = (det[k] || 0) + (+x[1] || 0); q += +x[1] || 0; }));
      out.push(`Export N°${e.n} · ${e.nat || e.cl} · date ${iaDate(e.d)} · ${e.st === 'fini' ? 'VALIDÉ (expédié le ' + iaDate(e.dv || e.d) + ')' : 'EN COURS de préparation (pièces emballées, prêtes à expédier)'} · ${C.length} carton(s) · ${q} pièces`);
      Object.keys(det).sort().forEach(k => out.push(`  - ${k} : ${det[k]}`));
    });
  }
  return {texte:out.join('\n'), vide:false};
}

function iaConsignes(ctx){
  const u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : {};
  const auj = new Date(), j = String(auj.getDate()).padStart(2, '0') + '/' + String(auj.getMonth() + 1).padStart(2, '0') + '/' + auj.getFullYear();
  return `Tu es l'assistant de l'application GTM Groupe (sociétés TEK-TREND, GADH TUNISIA et MGT).
Tu réponds en français simple, clair et court, à ${u.nom || 'l\'utilisateur'} (${u.profil || u.role || ''}). Nous sommes le ${j}.
Tu réponds UNIQUEMENT à partir des données ci-dessous. Si l'information n'y est pas, dis-le simplement ; n'invente jamais un chiffre.
Vérifie tes additions. Donne les chiffres exacts, avec le nom du libellé et la taille. Utilise des listes ou un petit tableau quand c'est plus clair.
Tu ne peux rien modifier dans l'application : tu expliques seulement où le faire (onglets : Tableau, Commandes, Fiches, Suivi, Flux, Exports, Documents, Stock, Archive, Réglages).

Fonctionnement du suivi des commandes (PERCKO, client final ; clients NEOLYS, ALLOGA, FLÉCHÉS, VESTIAIRES) :
- Étapes dans l'ordre : coupe → envoi à la GADH → assemblage à la GADH → retour chez TEK-TREND → confection → contrôle → emballée, prête à expédier → expédiée.
- Les colonnes « cumul » comptent tout ce qui est passé à l'étape ; les colonnes « actuellement » donnent où se trouvent les pièces en ce moment (une pièce n'est comptée qu'à sa dernière étape).
- « Reste à livrer » = commandé − expédié.
- Un export = une expédition en cartons ; tant qu'il n'est pas validé, ses pièces sont emballées, prêtes à expédier.

DONNÉES :
${ctx}`;
}

/* ---------- appel Gemini ---------- */
async function iaDemander(question){
  const cle = iaCle(); if(!cle) throw new Error('Ajoutez d\'abord votre clé Gemini (⚙ Réglages de l\'assistant).');
  const ctx = iaContexte();
  const contents = iaHisto.slice(-12).map(m => ({role:m.role, parts:[{text:m.text}]})).concat([{role:'user', parts:[{text:question}]}]);
  const corps = {systemInstruction:{parts:[{text:iaConsignes(ctx.texte)}]}, contents, generationConfig:{temperature:0.2, maxOutputTokens:2048}};
  /* Gemini peut être saturé (503 « forte demande »), limité (429) ou en panne passagère (500) : on réessaie,
     puis on passe automatiquement aux autres modèles (le choix de ⚙ d'abord). */
  const modeles = [iaModele()].concat(IA_MODELES.map(m => m[0])).filter((m, i, a) => a.indexOf(m) === i);
  let data = null, derniere = '', quota = false;
  essais: for(let i = 0; i < modeles.length; i++){
    for(let essai = 0; essai < 2; essai++){
      if(iaStatut) iaStatut(i || essai ? 'Gemini est très demandé, j\'essaie encore' + (i ? ' (autre modèle)' : '') + '…' : '');
      let rep;
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null, minuteur = ctrl ? setTimeout(() => ctrl.abort(), 60000) : null;
      try {
        rep = await fetch(IA_URL + encodeURIComponent(modeles[i]) + ':generateContent', {method:'POST', headers:{'Content-Type':'application/json', 'x-goog-api-key':cle}, body:JSON.stringify(corps), signal:ctrl ? ctrl.signal : undefined});
      } catch(e){
        clearTimeout(minuteur);
        if(e && e.name === 'AbortError'){ derniere = 'Gemini met trop de temps à répondre.'; continue essais; }
        throw new Error('Pas de connexion à Gemini (vérifiez internet).');
      }
      clearTimeout(minuteur);
      data = null; try { data = await rep.json(); } catch(e){}
      if(rep.ok) break essais;
      const msg = (data && data.error && data.error.message) || ('erreur ' + rep.status);
      if(rep.status === 400 && /API key/i.test(msg)) throw new Error('Clé Gemini refusée : vérifiez-la dans ⚙ Réglages de l\'assistant.');
      if(rep.status === 403) throw new Error('Clé Gemini non autorisée : vérifiez-la dans ⚙ (' + msg + ').');
      if(rep.status === 404){ derniere = 'Modèle « ' + modeles[i] + ' » introuvable.'; continue essais; }
      if(rep.status === 429){ quota = true; derniere = msg; continue essais; }
      if(rep.status === 503 || rep.status === 500 || rep.status === 502 || rep.status === 504){ derniere = msg; if(essai === 0){ await new Promise(r => setTimeout(r, 2000)); continue; } continue essais; }
      throw new Error('Gemini : ' + msg);
    }
  }
  if(iaStatut) iaStatut('');
  if(!data || !data.candidates){
    if(quota) throw new Error('Limite gratuite de Gemini atteinte pour le moment : réessayez dans une minute.');
    throw new Error('Gemini est surchargé en ce moment (tous les modèles ont été essayés). Réessayez dans quelques minutes.' + (/introuvable|trop de temps/.test(derniere) ? ' (' + derniere + ')' : ''));
  }
  const c = data && data.candidates && data.candidates[0];
  const texte = c && c.content && (c.content.parts || []).map(p => p.text || '').join('').trim();
  if(!texte) throw new Error(c && c.finishReason === 'SAFETY' ? 'Gemini n\'a pas voulu répondre à cette question.' : 'Réponse vide de Gemini, réessayez.');
  return texte;
}

/* ---------- mise en forme simple des réponses (gras, listes, tableaux) ---------- */
function iaMiseEnForme(txt){
  const e = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  const L = String(txt).replace(/\r/g, '').split('\n'), out = [];
  let liste = false, i = 0;
  const fermer = () => { if(liste){ out.push('</ul>'); liste = false; } };
  while(i < L.length){
    const l = L[i];
    if(/^\s*\|.*\|\s*$/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])){
      fermer();
      const cells = s => s.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
      let h = '<div style="overflow-x:auto"><table class="ia-tab"><thead><tr>' + cells(l).map(c => `<th>${e(c)}</th>`).join('') + '</tr></thead><tbody>';
      i += 2;
      while(i < L.length && /^\s*\|.*\|\s*$/.test(L[i])){ h += '<tr>' + cells(L[i]).map(c => `<td>${e(c)}</td>`).join('') + '</tr>'; i++; }
      out.push(h + '</tbody></table></div>'); continue;
    }
    const m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(l);
    if(m){ if(!liste){ out.push('<ul>'); liste = true; } out.push(`<li>${e(m[1])}</li>`); }
    else if(/^\s*#{1,4}\s+/.test(l)){ fermer(); out.push(`<div class="ia-h">${e(l.replace(/^\s*#+\s+/, ''))}</div>`); }
    else if(!l.trim()){ fermer(); out.push('<div style="height:6px"></div>'); }
    else { fermer(); out.push(`<div>${e(l)}</div>`); }
    i++;
  }
  fermer();
  return out.join('');
}

/* ---------- fenêtre de l'assistant ---------- */
const IA_CSS = `
#ia-fond{position:fixed;inset:0;z-index:9000;background:rgba(10,15,25,.45);display:flex;justify-content:flex-end}
#ia-box{width:min(480px,100%);height:100%;height:100dvh;background:var(--card,#fff);color:var(--ink,#111);display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.25)}
#ia-box .ia-tete{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#1F3864;color:#fff}
#ia-box .ia-tete b{flex:1;font-size:17px}#ia-box .ia-tete button{background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:10px;min-width:40px;height:40px;font-size:18px;cursor:pointer}
#ia-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.ia-m{max-width:92%;padding:10px 12px;border-radius:14px;font-size:15px;line-height:1.4;overflow-wrap:anywhere}
.ia-m.u{align-self:flex-end;background:#1F3864;color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap}
.ia-m.b{align-self:flex-start;background:var(--sub,#eef1f6);border-bottom-left-radius:4px}
.ia-m.err{align-self:stretch;background:#fde2e1;color:#8a1c14}
.ia-m ul{margin:4px 0 4px 18px;padding:0}.ia-h{font-weight:800;margin-top:4px}
.ia-tab{border-collapse:collapse;font-size:13px;margin:4px 0}.ia-tab th,.ia-tab td{border:1px solid #c9d1dc;padding:3px 6px;text-align:left}.ia-tab th{background:#dde5f0}
#ia-sugg{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}#ia-sugg button{border:1px solid #c9d1dc;background:var(--card,#fff);color:inherit;border-radius:99px;padding:6px 12px;font-size:13.5px;cursor:pointer}
#ia-saisie{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #d9dee6}
#ia-saisie textarea{flex:1;resize:none;min-height:44px;max-height:120px;border:1px solid #c9d1dc;border-radius:12px;padding:10px;font:inherit;font-size:15px;background:var(--card,#fff);color:inherit}
#ia-saisie button{min-width:52px;border:0;border-radius:12px;background:#1F3864;color:#fff;font-size:20px;cursor:pointer}
#ia-saisie button:disabled{opacity:.5}
#ia-regl{padding:14px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px;font-size:14.5px}
#ia-regl input,#ia-regl select{width:100%;height:44px;border:1px solid #c9d1dc;border-radius:10px;padding:0 10px;font:inherit;background:var(--card,#fff);color:inherit}
#ia-regl .av{background:#fff3cd;color:#4a3b00;border:1px solid #e7cf6a;border-radius:10px;padding:10px}
#ia-regl .btns{display:flex;gap:8px;flex-wrap:wrap}#ia-regl .btns button{height:44px;padding:0 16px;border-radius:10px;border:1px solid #c9d1dc;background:var(--card,#fff);color:inherit;font-weight:700;cursor:pointer}
#ia-regl .btns button.p{background:#1F3864;color:#fff;border-color:#1F3864}
.ia-point{display:inline-block;animation:iaP 1s infinite}@keyframes iaP{50%{opacity:.3}}`;

let iaCompte = null;
async function assistantOuvrir(){
  if(document.getElementById('ia-fond')) return;
  try { await iaPret; } catch(e){}
  if(document.getElementById('ia-fond')) return;
  /* conversation propre à chaque compte : changement de compte = nouvelle conversation */
  const u = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.username || currentUser.nom) : '';
  if(u !== iaCompte){ iaHisto = []; iaCompte = u; }
  if(!document.getElementById('ia-css')){ const st = document.createElement('style'); st.id = 'ia-css'; st.textContent = IA_CSS; document.head.appendChild(st); }
  const f = document.createElement('div'); f.id = 'ia-fond';
  f.innerHTML = `<div id="ia-box" role="dialog" aria-label="Assistant IA"><div class="ia-tete"><span style="font-size:22px">🤖</span><b>Assistant GTM</b>
    <button onclick="assistantReglages()" title="Réglages de l'assistant" aria-label="Réglages">⚙</button><button onclick="assistantFermer()" aria-label="Fermer">✕</button></div><div id="ia-corps" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div>`;
  f.addEventListener('click', ev => { if(ev.target === f) assistantFermer(); });
  document.body.appendChild(f);
  if(iaCle()) iaVueChat(); else assistantReglages();
}
function assistantFermer(){ const f = document.getElementById('ia-fond'); if(f) f.remove(); }

function iaVueChat(){
  const corps = document.getElementById('ia-corps'); if(!corps) return;
  corps.innerHTML = `<div id="ia-msgs"></div><div id="ia-sugg"></div>
    <div id="ia-saisie"><textarea id="ia-q" rows="1" placeholder="Posez votre question…" enterkeyhint="send"></textarea><button id="ia-envoi" aria-label="Envoyer">➤</button></div>`;
  const msgs = document.getElementById('ia-msgs');
  if(!iaHisto.length) msgs.innerHTML = `<div class="ia-m b">Bonjour ! Je réponds à vos questions sur les commandes : où en sont les pièces, ce qui reste à produire, ce qui est prêt à expédier, les exports…</div>`;
  iaHisto.forEach(m => iaAjouter(m.role === 'user' ? 'u' : 'b', m.text));
  const sugg = document.getElementById('ia-sugg');
  if(!iaHisto.length) ['Où en est la commande ?', 'Qu\'est-ce qui reste à produire ?', 'Qu\'est-ce qui est prêt à expédier ?', 'Résumé de l\'export en cours'].forEach(s => {
    const b = document.createElement('button'); b.textContent = s; b.onclick = () => iaEnvoyer(s); sugg.appendChild(b); });
  const q = document.getElementById('ia-q');
  q.addEventListener('input', () => { q.style.height = 'auto'; q.style.height = Math.min(120, q.scrollHeight) + 'px'; });
  q.addEventListener('keydown', ev => { if(ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); iaEnvoyer(q.value); } });
  document.getElementById('ia-envoi').onclick = () => iaEnvoyer(q.value);
  if(iaEnCours){ document.getElementById('ia-envoi').disabled = true; }
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => { try { q.focus(); } catch(e){} }, 50);
}
function iaAjouter(cls, texte){
  const msgs = document.getElementById('ia-msgs'); if(!msgs) return null;
  const d = document.createElement('div'); d.className = 'ia-m ' + cls;
  if(cls === 'b') d.innerHTML = iaMiseEnForme(texte); else d.textContent = texte;
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
}
async function iaEnvoyer(question){
  question = String(question || '').trim(); if(!question || iaEnCours) return;
  const q = document.getElementById('ia-q'), btn = document.getElementById('ia-envoi'), sugg = document.getElementById('ia-sugg');
  if(q){ q.value = ''; q.style.height = 'auto'; } if(sugg) sugg.innerHTML = '';
  iaAjouter('u', question);
  const att = iaAjouter('b', ''); if(att) att.innerHTML = '<span class="ia-point">●●●</span>';
  iaStatut = t => { if(att && att.isConnected) att.innerHTML = '<span class="ia-point">●●●</span>' + (t ? ' <span style="font-size:13px;opacity:.75">' + esc(t) + '</span>' : ''); };
  iaEnCours = true; if(btn) btn.disabled = true;
  try {
    const rep = await iaDemander(question);
    iaHisto.push({role:'user', text:question}, {role:'model', text:rep});
    if(att) att.innerHTML = iaMiseEnForme(rep);
  } catch(e){
    if(att){ att.className = 'ia-m err'; att.textContent = '⚠ ' + (e && e.message || e); }
  } finally {
    iaEnCours = false; iaStatut = null; const b2 = document.getElementById('ia-envoi'); if(b2) b2.disabled = false; if(btn) btn.disabled = false;
    const msgs = document.getElementById('ia-msgs'); if(msgs) msgs.scrollTop = msgs.scrollHeight;
  }
}

function assistantReglages(){
  const corps = document.getElementById('ia-corps'); if(!corps) return;
  const cle = iaCle(), mod = iaModele();
  corps.innerHTML = `<div id="ia-regl">
    <b style="font-size:16px">Réglages de l'assistant</b>
    <div>L'assistant utilise <b>Google Gemini</b>. Il faut une <b>clé API</b>, gratuite, à créer une fois sur
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (bouton « Create API key »), puis à coller ici.</div>
    ${cle ? '<div style="color:#11643a;font-weight:700">✓ Clé enregistrée sur cet appareil.</div>' : ''}
    <label>Clé API Gemini<input id="ia-cle" type="password" autocomplete="off" placeholder="AIza…" value="${esc(cle)}"></label>
    <label>Modèle<select id="ia-mod">${IA_MODELES.map(m => `<option value="${m[0]}"${m[0] === mod ? ' selected' : ''}>${esc(m[1])}</option>`).join('')}</select></label>
    <div class="av">🔒 La clé reste <b>uniquement sur cet appareil</b> : elle n'est ni dans l'application en ligne, ni dans la base. À saisir sur chaque téléphone ou ordinateur.<br><br>
      ⚠ À chaque question, un <b>résumé des commandes</b> (quantités par étape, exports) est envoyé à Google. En offre gratuite, <b>Google peut utiliser ces échanges pour améliorer ses modèles</b>.</div>
    <div class="btns"><button class="p" id="ia-ok">Enregistrer</button>${cle ? '<button id="ia-suppr">Effacer la clé</button>' : ''}${cle ? '<button id="ia-retour">Retour</button>' : ''}${iaHisto.length ? '<button id="ia-vider">Nouvelle conversation</button>' : ''}</div>
  </div>`;
  document.getElementById('ia-ok').onclick = () => {
    const v = document.getElementById('ia-cle').value.trim();
    if(!v){ showToast('Collez la clé Gemini.'); return; }
    Promise.all([iaEcrire(IA_CLE, v), iaEcrire(IA_MODELE, document.getElementById('ia-mod').value)]).then(r => {
      if(r[0]){ showToast('Clé enregistrée sur cet appareil : plus besoin de la saisir.'); iaVueChat(); }
      else { alert('La clé marche pour cette fois, mais ce navigateur refuse de la garder (mémoire du site pleine ou navigation privée). Il faudra la recoller à la prochaine ouverture.'); iaVueChat(); }
    });
  };
  const s = document.getElementById('ia-suppr'); if(s) s.onclick = () => { if(!confirm('Effacer la clé Gemini de cet appareil ?')) return; iaEcrire(IA_CLE, ''); assistantReglages(); };
  const r = document.getElementById('ia-retour'); if(r) r.onclick = () => { iaEcrire(IA_MODELE, document.getElementById('ia-mod').value); iaVueChat(); };
  const vd = document.getElementById('ia-vider'); if(vd) vd.onclick = () => { iaHisto = []; iaVueChat(); };
}

window.assistantBouton = assistantBouton;
window.assistantOuvrir = assistantOuvrir;
window.assistantFermer = assistantFermer;
window.assistantReglages = assistantReglages;
window.gtmIA = {contexte:iaContexte, consignes:iaConsignes, miseEnForme:iaMiseEnForme, demander:iaDemander};
