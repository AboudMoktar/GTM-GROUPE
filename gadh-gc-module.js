// ============================================================
// GADH — GESTION DES COMMANDES · APPROVISIONNEMENT · LIVRAISONS · RENTABILITÉ
// ============================================================
// Remplace les anciens modules « Achats et stock » et « Ventes » de GADH.
// Fichiers :
//   gadh-gc-calcul.js   calculs (sans interface, testés seuls)
//   gadh-gc-module.js   ce fichier : données, droits, navigation, tableaux, tableau de bord,
//                       catalogue, tarifs, fournisseurs, clients, stock, journal, réglages, migration
//   gadh-gc-ventes.js   demandes de prix (import), offres, commandes clients, livraisons, facturation
//   gadh-gc-achats.js   besoins nets, commandes fournisseurs, réceptions, paiements
//   gadh-gc-exports.js  documents (impression, PDF), exports Excel / CSV, rentabilité
// Données (dossier Firebase gadh/, clés gadh_gc_*, une fiche par enregistrement pour le
// hors ligne : voir HL_PAR_FICHE). Clients : ceux de la Facturation GADH (gadh_fact_clients).
// Droits : roles-config.js (ressource gadh.commandes ; gadh.facturation pour les factures et les clients).
// Rien n'est supprimé : les fiches sont archivées ; chaque opération sensible est inscrite au journal.

const GCK = {articles:'gadh_gc_articles', fournisseurs:'gadh_gc_fournisseurs', tarifs:'gadh_gc_tarifs', demandes:'gadh_gc_demandes', offres:'gadh_gc_offres',
  cmdC:'gadh_gc_cmd_clients', cmdF:'gadh_gc_cmd_fournisseurs', receptions:'gadh_gc_receptions', livraisons:'gadh_gc_livraisons', mouvements:'gadh_gc_mouvements',
  journal:'gadh_gc_journal', sauvegardes:'gadh_gc_sauvegardes', reglages:'gadh_gc_reglages'};
const GC_MODULE = 'gadh-commandes';
const GC_REGLAGES_DEFAUT = {validiteOffre:30, conditionsOffre:'', conditionsPaiement:'Paiement à 30 jours', delaiDefaut:7, horizon:15, methodeFrais:'quantite',
  categories:['Matière', 'Accessoire', 'Produit fini', 'Produit / prestation', 'Machine'], unites:['pièce', 'mètre', 'kg', 'rouleau', 'boîte', 'litre', 'paquet', 'lot', 'service', 'heure']};
let gcOuvert = {};          // fiche ouverte par onglet : {'gc-article': id, …}
let gcEdit = null;          // document en cours de saisie (offre, commande, commande fournisseur)
const gcTabs = {};          // état des tableaux (recherche, tri, page, filtres)
const gcTabsCfg = {};

// ---------- Données ----------
function gcListe(k){ return GC.liste(getJSON(GCK[k], null)); }
function gcReglages(){
  const r = Object.assign({}, GC_REGLAGES_DEFAUT, getJSON(GCK.reglages, {}) || {});
  if(r.tva === undefined || r.tva === null || r.tva === '') r.tva = (typeof factParams === 'function' ? Number(factParams('gadh').tva) || 0 : 0);
  return r;
}
function gcClients(){ return getJSON('gadh_fact_clients', {}) || {}; }
let gcCacheD = null, gcCacheSig = '';
function gcD(){
  const sig = Object.keys(GCK).map(k => typeof gtmVersionDonnee === 'function' ? gtmVersionDonnee(GCK[k]) : Math.random()).join('|') + '|' + (typeof gtmVersionDonnee === 'function' ? gtmVersionDonnee('gadh_fact_clients') : '');
  if(gcCacheD && sig === gcCacheSig) return gcCacheD;
  const D = {};
  ['articles', 'fournisseurs', 'tarifs', 'demandes', 'offres', 'cmdC', 'cmdF', 'receptions', 'livraisons', 'mouvements'].forEach(k => { D[k] = gcListe(k); });
  D.reglages = gcReglages(); D.clients = gcClients();
  gcCacheD = D; gcCacheSig = sig;
  return D;
}
function gcPar(){ return currentUser ? (currentUser.nom || currentUser.username || '') : ''; }
function gcCtx(extra){ return Object.assign({date:getTodayISO(), ts:Date.now(), par:gcPar()}, extra || {}); }
// Enregistre des fiches (ajout ou remplacement par identifiant) ; horodatage et auteur de la dernière modification.
function gcEnregistrer(k, fiches){
  const l = gcListe(k).slice(), idx = {};
  l.forEach((x, i) => { idx[x.id] = i; });
  (Array.isArray(fiches) ? fiches : [fiches]).forEach(f => {
    const n = Object.assign({}, f, {maj:{ts:Date.now(), par:gcPar()}});
    if(idx[n.id] === undefined){ if(!n.cree) n.cree = {date:getTodayISO(), ts:Date.now(), par:gcPar()}; idx[n.id] = l.length; l.push(n); } else l[idx[n.id]] = n;
  });
  setJSON(GCK[k], l);
  gcCacheD = null;
}
function gcJournal(action, objet, fiche, details){
  const e = GC.entreeJournal(action, objet, fiche, details, gcCtx({uid:currentUser && currentUser.uid || ''}));
  const l = gcListe('journal').slice(); l.push(e); setJSON(GCK.journal, l);
}
function gcTrouver(k, id){ return gcListe(k).find(x => x.id === id) || null; }

// ---------- Droits ----------
function gcAutorise(cle, action){
  if(!currentUser) return false;
  const R = window.GTM_ROLES, p = currentUser.profil;
  if(R && p && R.ROLES[p]) return R.autorise(p, 'gadh', cle, action);
  return action === 'l' ? (currentUser.role === 'admin' || currentUser.role === 'viewer') : currentUser.role === 'admin';
}
function gcPeut(){ return gcAutorise(GCK.articles, 'm'); }
function gcPeutFacturer(){ return gcAutorise('gadh_factures', 'm'); }
function gcPeutLireFactures(){ return gcAutorise('gadh_factures', 'l'); }
function gcPeutClients(){ return gcAutorise('gadh_fact_clients', 'm'); }
function gcRefus(){ showToast('Votre profil permet seulement la consultation'); return false; }

// ---------- Mise en forme ----------
function gcQ(n){ return (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('fr-FR'); }
function gcE(n){ return (Number(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'; }
function gcPct(n){ return n === null || n === undefined || !isFinite(n) ? '—' : (Math.round(n * 10) / 10).toLocaleString('fr-FR') + ' %'; }
function gcDt(d){ return d ? d.split('-').reverse().join('/') : '—'; }
function gcHeure(ts){ if(!ts) return ''; const d = new Date(ts); return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}); }
function gcBadge(s){ return s ? `<span class="hour-rend ${s.cls || ''}" style="font-size:11px;white-space:nowrap;">${esc(s.label)}</span>` : ''; }
function gcNomClient(id){ const c = gcClients()[id]; return c ? c.nom : (id ? '(client inconnu)' : '—'); }
function gcNomFour(id){ const f = gcD().fournisseurs.find(x => x.id === id); return f ? f.nom : (id ? '(fournisseur inconnu)' : '—'); }
function gcArticle(id){ return gcD().articles.find(x => x.id === id) || null; }
function gcLibArticle(a){ return a ? (a.ref ? a.ref + ' · ' : '') + (a.designation || '') : ''; }
function gcNum(v){ return GC.num(v); }
function gcVal(id){ return typeof mgtVal === 'function' ? mgtVal(id) : ((document.getElementById(id) || {}).value || '').trim(); }
function gcChk(id){ const e = document.getElementById(id); return !!(e && e.checked); }
function gcOpts(liste, val, vide){ return (vide !== undefined ? `<option value="">${esc(vide)}</option>` : '') + liste.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join(''); }
function gcOptsClients(val, vide){ return gcOpts(Object.entries(gcClients()).filter(([, c]) => c && !c.archive).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '')).map(([id, c]) => [id, c.nom]), val, vide); }
function gcOptsFour(val, vide){ return gcOpts(gcD().fournisseurs.filter(f => !f.archive).sort((a, b) => (a.nom || '').localeCompare(b.nom || '')).map(f => [f.id, f.nom]), val, vide); }
function gcOptsArticles(val, vide, filtre){ return gcOpts(gcD().articles.filter(a => !a.archive && a.actif !== false && (!filtre || filtre(a))).sort((a, b) => gcLibArticle(a).localeCompare(gcLibArticle(b))).map(a => [a.id, gcLibArticle(a)]), val, vide); }
function gcAttr(s){ return esc(String(s == null ? '' : s)); }
function gcJs(s){ return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// Confirmation des opérations sensibles (fenêtre de l'application, avec motif si demandé).
function gcConfirmer(titre, message, action, opts){
  opts = opts || {};
  window.gcConfirmerAction = () => {
    const motif = opts.motif ? gcVal('gc-conf-motif') : '';
    if(opts.motif && opts.motifObligatoire && !motif){ showToast('Indiquez le motif'); return; }
    mgtFermer(); action(motif);
  };
  mgtModal(titre, `<p style="margin-top:0;line-height:1.5;">${message}</p>
    ${opts.motif ? `<div class="field"><label>Motif${opts.motifObligatoire ? ' *' : ''}</label><input id="gc-conf-motif" type="text"></div>` : ''}
    <div style="display:flex;gap:8px;"><button class="btn btn-ghost" style="flex:1;" onclick="mgtFermer()">Retour</button>
    <button class="btn btn-primary" style="flex:1;${opts.danger ? 'background:var(--bad);border-color:var(--bad);' : ''}" data-gc="confirmer" onclick="gcConfirmerAction()">${esc(opts.bouton || 'Confirmer')}</button></div>`);
}
// Exécute une opération métier : erreur métier → message clair ; sinon enregistrement + journal.
function gcOperation(fn){
  if(!gcPeut()) return gcRefus();
  try { return fn(); }
  catch(e){ if(e && e.gc){ showToast(e.message); return false; } console.error('Gestion des commandes', e); showToast('Opération impossible : ' + (e && e.message || e)); return false; }
}

// ---------- Tableaux : recherche, filtres, tri, pagination ----------
function gcTable(cfg){
  const st = gcTabs[cfg.id] || (gcTabs[cfg.id] = {q:'', tri:cfg.tri || null, sens:cfg.sens || 1, page:0, f:{}});
  (cfg.filtres || []).forEach(f => { if(st.f[f.id] === undefined) st.f[f.id] = f.defaut !== undefined ? f.defaut : ''; });
  gcTabsCfg[cfg.id] = cfg;
  const barre = `<div class="gct-barre no-print">
    <input type="search" class="gct-q" placeholder="${gcAttr(cfg.placeholder || 'Rechercher…')}" value="${gcAttr(st.q)}" oninput="gcTabQ('${cfg.id}', this.value)">
    ${(cfg.filtres || []).map(f => `<select class="gct-f" onchange="gcTabF('${cfg.id}', '${f.id}', this.value)" aria-label="${gcAttr(f.label)}">${f.options.map(([k, l]) => `<option value="${gcAttr(k)}" ${String(k) === String(st.f[f.id]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`).join('')}
  </div>`;
  return `<div class="gct" data-gct="${cfg.id}">${cfg.recherche === false ? '' : barre}<div id="gct-${cfg.id}">${gcTableCorps(cfg.id)}</div></div>`;
}
function gcTableLignes(id){
  const cfg = gcTabsCfg[id], st = gcTabs[id];
  let l = (typeof cfg.lignes === 'function' ? cfg.lignes() : cfg.lignes).slice();
  (cfg.filtres || []).forEach(f => { const v = st.f[f.id]; if(v !== '' && v !== undefined && f.test) l = l.filter(x => f.test(x, v)); });
  if(st.q){ const q = GC.norm(st.q); l = l.filter(x => GC.norm(cfg.texte ? cfg.texte(x) : JSON.stringify(x)).indexOf(q) >= 0); }
  if(st.tri !== null && st.tri !== undefined){
    const c = cfg.colonnes[st.tri];
    if(c){ const v = c.tri || c.val || (() => ''); l.sort((a, b) => { const x = v(a), y = v(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'fr', {numeric:true})) * st.sens; }); }
  }
  return l;
}
function gcTableCorps(id){
  const cfg = gcTabsCfg[id], st = gcTabs[id], l = gcTableLignes(id), n = cfg.parPage || 25, pages = Math.max(1, Math.ceil(l.length / n));
  if(st.page >= pages) st.page = pages - 1;
  const vue = l.slice(st.page * n, st.page * n + n);
  if(!l.length) return buildEmptyState(cfg.vide || 'Aucun élément', cfg.videSous || '');
  const th = cfg.colonnes.map((c, i) => `<th class="${c.num ? 'n' : ''}" ${c.tri === false ? '' : `onclick="gcTabTri('${id}', ${i})" style="cursor:pointer;"`}>${esc(c.titre)}${st.tri === i ? (st.sens > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('');
  const tr = vue.map(x => `<tr ${cfg.clic ? `onclick="${cfg.clic(x)}" class="gct-clic"` : ''} ${cfg.ligneAttr ? cfg.ligneAttr(x) : ''}>${cfg.colonnes.map(c => `<td class="${c.num ? 'n' : ''}" data-l="${gcAttr(c.titre)}">${c.html ? c.html(x) : esc(c.val ? c.val(x) : '')}</td>`).join('')}</tr>`).join('');
  const tot = cfg.total ? `<tfoot><tr>${cfg.colonnes.map((c, i) => `<td class="${c.num ? 'n' : ''}" data-l="${gcAttr(c.titre)}">${cfg.total(l, c, i) || ''}</td>`).join('')}</tr></tfoot>` : '';
  const pag = pages > 1 ? `<div class="gct-pag no-print"><button class="btn btn-ghost" ${st.page ? '' : 'disabled'} onclick="gcTabPage('${id}', -1)">‹</button><span>${st.page * n + 1}–${Math.min(l.length, st.page * n + n)} sur ${l.length}</span><button class="btn btn-ghost" ${st.page < pages - 1 ? '' : 'disabled'} onclick="gcTabPage('${id}', 1)">›</button></div>`
    : `<div class="gct-pag gct-nb">${l.length} élément${l.length > 1 ? 's' : ''}</div>`;
  return `<div class="gct-scroll"><table class="gct-t"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${tot}</table></div>${pag}`;
}
function gcTableRafraichir(id){ const e = document.getElementById('gct-' + id); if(e && gcTabsCfg[id]) e.innerHTML = gcTableCorps(id); }
let gcTabMinuteur = null;
window.gcTabQ = (id, v) => { gcTabs[id].q = v; gcTabs[id].page = 0; clearTimeout(gcTabMinuteur); gcTabMinuteur = setTimeout(() => gcTableRafraichir(id), 150); };
window.gcTabF = (id, f, v) => { gcTabs[id].f[f] = v; gcTabs[id].page = 0; gcTableRafraichir(id); };
window.gcTabTri = (id, i) => { const s = gcTabs[id]; if(s.tri === i) s.sens = -s.sens; else { s.tri = i; s.sens = 1; } gcTableRafraichir(id); };
window.gcTabPage = (id, d) => { gcTabs[id].page += d; gcTableRafraichir(id); };
// Lignes affichées (après filtres et recherche) : pour les exports « ce que je vois ».
function gcLignesVisibles(id){ return gcTabsCfg[id] ? gcTableLignes(id) : []; }

// ---------- Navigation ----------
const GC_GROUPES = {
  ventes:   {nav:'gc-commandes', onglets:[['gc-commandes', 'Commandes clients'], ['gc-offres', 'Offres'], ['gc-demandes', 'Demandes de prix'], ['gc-livraisons', 'Livraisons']]},
  achats:   {nav:'gc-besoins', onglets:[['gc-besoins', 'Besoins'], ['gc-achats', 'Commandes fournisseurs'], ['gc-receptions', 'Réceptions']]},
  stock:    {nav:'gc-stock', onglets:[['gc-stock', 'État du stock'], ['gc-lots', 'Lots'], ['gc-mouvements', 'Mouvements']]},
  catalogue:{nav:'gc-catalogue', onglets:[['gc-catalogue', 'Articles'], ['gc-tarifs', 'Tarifs fournisseurs'], ['gc-fournisseurs', 'Fournisseurs'], ['gc-clients', 'Clients']]},
  pilotage: {nav:'gc-rentabilite', onglets:[['gc-rentabilite', 'Rentabilité'], ['gc-journal', 'Journal'], ['gc-reglages', 'Réglages et migration']]}
};
const GC_FICHES = {'gc-article':'gc-catalogue', 'gc-fournisseur':'gc-fournisseurs', 'gc-client':'gc-clients', 'gc-offre':'gc-offres', 'gc-demande':'gc-demandes', 'gc-import':'gc-demandes',
  'gc-commande':'gc-commandes', 'gc-livraison':'gc-livraisons', 'gc-achat':'gc-achats', 'gc-reception':'gc-receptions', 'gc-edition':null, 'gc-import-catalogue':'gc-catalogue'};
function gcGroupeDe(tab){ const t = GC_FICHES[tab] !== undefined ? (GC_FICHES[tab] || (gcEdit && gcEdit.retour) || 'gc-accueil') : tab; return Object.values(GC_GROUPES).find(g => g.onglets.some(o => o[0] === t)) || null; }
function gcNavParent(tab){ if(tab.indexOf('gc-') !== 0) return null; const g = gcGroupeDe(tab); return g ? g.nav : null; }
const GC_ICONE_PLUS = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>';
function gcNavItems(){
  return [
    {tab:'gc-accueil', label:'Tableau de bord', court:'Accueil', icon:ICONS.dashboard, show:true},
    {tab:'gc-commandes', label:'Ventes et livraisons', court:'Ventes', icon:ICONS.trend, show:true},
    {tab:'gc-besoins', label:'Achats et approvisionnement', court:'Achats', icon:ICONS.invoice, show:true},
    {tab:'gc-stock', label:'Stock et lots', court:'Stock', icon:ICONS.box, show:true},
    {tab:'gc-catalogue', label:'Catalogue et tiers', court:'Catalogue', icon:ICONS.prodchain, show:true, bas:false},
    {tab:'gc-rentabilite', label:'Rentabilité et journal', court:'Rentabilité', icon:ICONS.stats, show:true, bas:false},
    {tab:'gc-plus', label:'Plus', icon:GC_ICONE_PLUS, show:true, cote:false, onclick:'gcMenuPlus()'}
  ];
}
window.gcMenuPlus = () => {
  mgtModal('Gestion des commandes', `<div class="gc-plus">${[['gc-catalogue', 'Catalogue articles', 'Articles, prix, paliers, import'], ['gc-tarifs', 'Tarifs fournisseurs', 'Prix négociés et comparaison'], ['gc-fournisseurs', 'Fournisseurs', 'Coordonnées, délais, historique'],
    ['gc-clients', 'Clients', 'Clients de la facturation GADH'], ['gc-rentabilite', 'Rentabilité', 'Coûts réels et marges'], ['gc-journal', 'Journal', 'Historique des opérations'], ['gc-reglages', 'Réglages et migration', 'Paramètres, sauvegardes, contrôles']]
    .map(([t, l, s]) => `<button class="session-row" style="width:100%;text-align:left;cursor:pointer;background:none;border:0;border-bottom:1px solid var(--border);" onclick="mgtFermer(); nav('${t}')"><span><b>${l}</b><br><span style="font-size:12px;color:var(--ink-soft);">${s}</span></span><b>›</b></button>`).join('')}</div>`);
};
window.gcOuvrir = (tab, id) => { gcOuvert[tab] = id; nav(tab); window.scrollTo(0, 0); };
function gcSection(main, titre, actions){
  main.innerHTML = `<div class="flex-header gc-tete"><h2>${titre}</h2>${actions ? `<div class="actions gc-actions">${actions}</div>` : ''}</div><div id="gc-body"></div>`;
  return document.getElementById('gc-body');
}
function gcRetour(tab, lib){ return `<span class="gc-retour" onclick="nav('${tab}')" title="Retour">‹</span> ${lib}`; }
function renderGC(tab, main){
  gcStyle();
  if(typeof GC === 'undefined'){ main.innerHTML = '<div class="card">Module indisponible (fichier de calcul manquant).</div>'; return; }
  const R = {
    'gc-accueil':renderGcAccueil, 'gc-catalogue':renderGcCatalogue, 'gc-article':renderGcArticle, 'gc-import-catalogue':renderGcImportCatalogue,
    'gc-tarifs':renderGcTarifs, 'gc-fournisseurs':renderGcFournisseurs, 'gc-fournisseur':renderGcFournisseur, 'gc-clients':renderGcClients, 'gc-client':renderGcClient,
    'gc-stock':renderGcStock, 'gc-lots':renderGcLots, 'gc-mouvements':renderGcMouvements, 'gc-journal':renderGcJournal, 'gc-reglages':renderGcReglages,
    'gc-demandes':window.renderGcDemandes, 'gc-demande':window.renderGcDemande, 'gc-import':window.renderGcImport, 'gc-offres':window.renderGcOffres, 'gc-offre':window.renderGcOffre,
    'gc-commandes':window.renderGcCommandes, 'gc-commande':window.renderGcCommande, 'gc-livraisons':window.renderGcLivraisons, 'gc-livraison':window.renderGcLivraison,
    'gc-edition':window.renderGcEdition, 'gc-besoins':window.renderGcBesoins, 'gc-achats':window.renderGcAchats, 'gc-achat':window.renderGcAchat,
    'gc-receptions':window.renderGcReceptions, 'gc-reception':window.renderGcReception, 'gc-rentabilite':window.renderGcRentabilite
  };
  const f = R[tab] || renderGcAccueil;
  try { f(main); }
  catch(e){ console.error('Gestion des commandes', tab, e); main.innerHTML = `<div class="card"><b>Affichage impossible</b><div style="font-size:12.5px;color:var(--ink-soft);margin-top:6px;">${esc(e && e.message || String(e))}</div></div>`; }
  const g = gcGroupeDe(tab);
  if(g) main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets gc-onglets no-print">${g.onglets.map(([t, l]) => `<button class="${t === tab || GC_FICHES[tab] === t ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
}

// ---------- Styles du module ----------
function gcStyle(){
  if(document.getElementById('gc-style')) return;
  const s = document.createElement('style'); s.id = 'gc-style';
  s.textContent = `
  .gc-tete h2{display:flex;align-items:center;gap:8px;}
  .gc-retour{cursor:pointer;font-size:26px;line-height:1;padding:0 6px 0 0;color:var(--ink-soft);}
  .gc-actions{display:flex;gap:6px;flex-wrap:wrap;}
  .gc-actions .btn{padding:8px 12px;font-size:13px;}
  .gc-onglets{overflow-x:auto;white-space:nowrap;}
  .gct-barre{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px;}
  .gct-q{flex:1 1 200px;min-width:0;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink);font-size:14px;}
  .gct-f{flex:0 1 auto;max-width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink);font-size:13px;}
  .gct-scroll{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface);}
  .gct-t{width:100%;border-collapse:collapse;font-size:13px;}
  .gct-t th{background:var(--surface-2);text-align:left;padding:8px 9px;font-weight:600;font-size:12px;color:var(--ink-soft);border-bottom:1px solid var(--border);white-space:nowrap;user-select:none;}
  .gct-t td{padding:8px 9px;border-bottom:1px solid var(--border-soft, var(--border));vertical-align:top;}
  .gct-t .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}
  .gct-t tfoot td{font-weight:700;background:var(--surface-2);}
  .gct-clic{cursor:pointer;} .gct-clic:hover td{background:var(--surface-2);}
  .gct-pag{display:flex;align-items:center;justify-content:center;gap:10px;margin:8px 0 4px;font-size:12.5px;color:var(--ink-soft);}
  .gct-pag .btn{padding:6px 14px;}
  .gc-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 14px;font-size:13px;}
  .gc-kv div span{display:block;font-size:11.5px;color:var(--ink-soft);}
  .gc-kv div b{font-weight:600;}
  .gc-chiffres{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:8px;}
  .gc-chiffre{border:1px solid var(--border);border-radius:11px;padding:9px 10px;background:var(--surface);}
  .gc-chiffre span{display:block;font-size:11.5px;color:var(--ink-soft);}
  .gc-chiffre b{font-size:16px;}
  .gc-chiffre.bad b{color:var(--bad);} .gc-chiffre.warn b{color:var(--warn);} .gc-chiffre.good b{color:var(--good);}
  .gc-simple .gc-av{display:none !important;}
  .gc-mode{display:inline-flex;border:1.5px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:10px;}
  .gc-mode button{border:0;background:var(--surface);color:var(--ink-soft);padding:9px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;}
  .gc-mode button.on{background:var(--accent, #0f766e);color:#fff;}
  .gc-simple .gc-lignes input{font-size:15px;padding:10px;}
  .gc-lignes{width:100%;border-collapse:collapse;font-size:13px;}
  .gc-lignes th{text-align:left;font-size:11.5px;color:var(--ink-soft);padding:6px;border-bottom:1px solid var(--border);}
  .gc-lignes td{padding:6px;border-bottom:1px solid var(--border-soft, var(--border));vertical-align:middle;}
  .gc-lignes input,.gc-lignes select{width:100%;min-width:60px;padding:7px 8px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);font-size:13px;}
  .gc-lignes .n{text-align:right;white-space:nowrap;}
  .gc-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:0 12px;}
  .gc-form .field select,.gc-form .field textarea,.modal-sheet .field select,.modal-sheet .field textarea{width:100%;padding:11px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--ink);font-size:14px;}
  .gc-barres{display:flex;flex-direction:column;gap:7px;}
  .gc-barre{display:grid;grid-template-columns:minmax(80px,30%) 1fr auto;gap:8px;align-items:center;font-size:12.5px;}
  .gc-barre .t{height:12px;border-radius:6px;background:var(--surface-3);overflow:hidden;display:flex;}
  .gc-barre .t i{display:block;height:100%;}
  .gc-legende{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--ink-soft);margin:4px 0 8px;}
  .gc-legende i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px;}
  .gc-alerte{border-left:4px solid var(--warn);background:var(--warn-bg);padding:9px 11px;border-radius:8px;font-size:13px;margin-bottom:8px;}
  .gc-alerte.bad{border-color:var(--bad);background:var(--bad-bg);}
  .gc-alerte.good{border-color:var(--good);background:var(--good-bg);}
  .gc-sous{font-size:12px;color:var(--ink-soft);}
  .gc-tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:9px;background:var(--surface-3);color:var(--ink-soft);margin-left:4px;}
  .gc-filtres{display:flex;gap:6px;flex-wrap:wrap;align-items:end;margin-bottom:10px;}
  .gc-filtres label{display:flex;flex-direction:column;font-size:11.5px;color:var(--ink-soft);gap:3px;flex:1 1 130px;}
  .gc-filtres input,.gc-filtres select{padding:8px 9px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface);color:var(--ink);font-size:13px;}
  .gc-h3{margin:4px 0 8px;font-size:15px;}
  @media (max-width:700px){
    .gct-scroll{border:0;background:none;}
    .gct-t thead{display:none;}
    .gct-t, .gct-t tbody, .gct-t tfoot, .gct-t tr, .gct-t td{display:block;width:100%;}
    .gct-t tr{background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;padding:6px 10px;}
    .gct-t td{display:flex;justify-content:space-between;gap:10px;border:0;padding:4px 0;text-align:right;}
    .gct-t td::before{content:attr(data-l);color:var(--ink-soft);font-size:11.5px;text-align:left;flex:0 0 auto;max-width:45%;}
    .gct-t td:empty{display:none;}
    .gct-t .n{white-space:normal;}
    .gc-lignes thead{display:none;}
    .gc-lignes, .gc-lignes tbody, .gc-lignes tr, .gc-lignes td{display:block;width:100%;}
    .gc-lignes tr{border:1px solid var(--border);border-radius:10px;margin-bottom:8px;padding:6px;}
    .gc-lignes td{border:0;padding:3px 0;display:flex;align-items:center;gap:8px;}
    .gc-lignes td[data-l]::before{content:attr(data-l);font-size:11.5px;color:var(--ink-soft);flex:0 0 38%;}
    .gc-lignes td.n{justify-content:space-between;}
    .gc-lignes td > div{flex:1;min-width:0;text-align:right;}
    .gc-actions{width:100%;}
    .gc-actions .btn{flex:1 1 auto;}
  }
  @media print{ .gct-barre,.gct-pag,.gc-onglets,.gc-actions{display:none !important;} }`;
  document.head.appendChild(s);
}

// ---------- Boutons d'export (Excel / PDF / impression) ----------
function gcBoutonsExport(cle){
  return `<button class="btn btn-ghost" data-gc-ex="xlsx" onclick="gcExporter('${cle}', 'xlsx')">Excel</button><button class="btn btn-ghost" data-gc-ex="pdf" onclick="gcExporter('${cle}', 'pdf')">PDF</button><button class="btn btn-ghost" onclick="gcExporter('${cle}', 'print')">Imprimer</button>`;
}

// ============================================================
// TABLEAU DE BORD
// ============================================================
let gcFiltresAccueil = null;
function gcFiltresDefaut(){ const a = getTodayISO(); return {du:a.slice(0, 8) + '01', au:a, clientId:'', fournisseurId:'', articleId:'', statut:''}; }
function gcIndicateurs(F){
  const D = gcD(), auj = getTodayISO(), liv = GC.livres(D), rec = GC.recus(D), S = GC.stocks(D), R = D.reglages;
  const horizon = GC.ajouterJours(auj, Number(R.horizon) || 15);
  const cmdArticle = (c) => !F.articleId || GC.liste(c.lignes).some(l => l.articleId === F.articleId);
  const cmds = D.cmdC.filter(c => !c.archive && (!F.clientId || c.clientId === F.clientId) && cmdArticle(c));
  const cmdOuv = cmds.filter(c => GC.CMDC_OUVERTE[GC.statutCmdC(c, liv).cle]);
  const resteCmd = (c) => GC.liste(c.lignes).reduce((s, l) => s + Math.max(0, GC.num(l.qte) - (liv[GC.cleLigne(c.id, l.lid)] || 0)) * GC.num(l.pu) * (1 - GC.num(l.remise) / 100), 0) * (1 - GC.num(c.remise) / 100);
  const prevues = [], retards = [];
  cmdOuv.forEach(c => {
    if(c.type === 'annuelle' && GC.liste(c.echeances).length){
      GC.suiviEcheances(c, liv, auj).forEach(e => { if(e.cle === 'retard') retards.push({c, date:e.date, qte:e.reste, ech:true}); else if(e.reste > 0 && e.date <= horizon) prevues.push({c, date:e.date, qte:e.reste, ech:true}); });
    } else if(c.dateSouhaitee){
      const q = GC.liste(c.lignes).reduce((s, l) => s + Math.max(0, GC.num(l.qte) - (liv[GC.cleLigne(c.id, l.lid)] || 0)), 0);
      if(c.dateSouhaitee < auj) retards.push({c, date:c.dateSouhaitee, qte:q}); else if(c.dateSouhaitee <= horizon) prevues.push({c, date:c.dateSouhaitee, qte:q});
    }
  });
  const cfs = D.cmdF.filter(f => !f.archive && (!F.fournisseurId || f.fournisseurId === F.fournisseurId) && (!F.articleId || GC.liste(f.lignes).some(l => l.articleId === F.articleId)));
  const cfOuv = cfs.filter(f => GC.CMDF_OUVERTE[GC.statutCmdF(f, rec).cle]), cfRetard = cfOuv.filter(f => GC.enRetardCmdF(f, rec, auj));
  const B = GC.besoins(D, auj, {delaiDefaut:R.delaiDefaut}).articles.filter(b => (!F.articleId || b.articleId === F.articleId) && (!F.fournisseurId || b.fournisseurId === F.fournisseurId));
  const arts = D.articles.filter(a => !a.archive && a.actif !== false && GC.suiviStock(a) && (!F.articleId || a.id === F.articleId) && (!F.fournisseurId || a.fournisseurId === F.fournisseurId));
  const sous = arts.filter(a => (S[a.id] || {}).sousSeuil || (S[a.id] || {}).rupture);
  const rupture = arts.filter(a => (S[a.id] || {}).rupture);
  let valeur = 0, valeurDispo = 0, nbDispo = 0;
  arts.forEach(a => { const s = S[a.id] || {}; valeur += s.valeur || 0; if(s.disponible > 0){ nbDispo++; valeurDispo += s.physique > 0 ? (s.valeur || 0) * s.disponible / s.physique : 0; } });
  const RT = GC.rentabilite(D, {du:F.du, au:F.au, clientId:F.clientId, articleId:F.articleId});
  const statutOk = (c) => !F.statut || GC.statutCmdC(c, liv).cle === F.statut || (F.statut === 'retard' && GC.retardCmdC(c, liv, auj));
  return {D, cmdOuv:cmdOuv.filter(statutOk), resteCmd, prevues:prevues.sort((a, b) => a.date.localeCompare(b.date)), retards:retards.sort((a, b) => a.date.localeCompare(b.date)),
    cfOuv, cfRetard, besoins:B.filter(b => b.urgence !== 'couvert'), urgents:B.filter(b => b.urgence === 'urgent'), sous, rupture, valeur, valeurDispo, nbDispo, RT, S, arts};
}
function gcBarres(lignes, series, max){
  const m = max || Math.max(1, ...lignes.map(l => Math.max(...series.map(s => Math.abs(l[s.cle] || 0)))));
  return `<div class="gc-legende">${series.map(s => `<span><i style="background:${s.couleur};"></i>${s.lib}</span>`).join('')}</div><div class="gc-barres">${lignes.map(l => series.map((s, i) =>
    `<div class="gc-barre"><span>${i === 0 ? esc(l.lib) : ''}</span><div class="t"><i style="width:${Math.max(0, (l[s.cle] || 0) / m * 100)}%;background:${s.couleur};"></i></div><b style="font-size:12px;">${s.fmt ? s.fmt(l[s.cle]) : gcE(l[s.cle])}</b></div>`).join('')).join('')}</div>`;
}
function renderGcAccueil(main){
  const F = gcFiltresAccueil || (gcFiltresAccueil = gcFiltresDefaut());
  const I = gcIndicateurs(F), D = I.D, T = I.RT.total;
  const b = gcSection(main, 'Gestion des commandes', '');
  const lien = (tab) => `nav('${tab}')`;
  const mois = I.RT.parMois.slice(-6).map(x => ({lib:x.cle.split('-').reverse().join('/'), ca:x.ca, cout:x.cout, marge:x.marge}));
  const topA = I.RT.parArticle.slice().sort((a, b) => b.marge - a.marge).slice(0, 6).map(x => ({lib:x.libelle, marge:x.marge}));
  const topC = I.RT.parClient.slice(0, 6).map(x => ({lib:gcNomClient(x.cle), ca:x.ca}));
  b.innerHTML = `
    <div class="card"><div class="gc-filtres">
      <label>Du<input type="date" id="gcf-du" value="${F.du}"></label><label>Au<input type="date" id="gcf-au" value="${F.au}"></label>
      <label>Client<select id="gcf-client">${gcOptsClients(F.clientId, 'Tous')}</select></label>
      <label>Fournisseur<select id="gcf-four">${gcOptsFour(F.fournisseurId, 'Tous')}</select></label>
      <label>Article<select id="gcf-art">${gcOptsArticles(F.articleId, 'Tous')}</select></label>
      <label>Statut des commandes<select id="gcf-statut">${gcOpts([['confirmee', 'À livrer'], ['partielle', 'Livrées en partie'], ['retard', 'En retard']], F.statut, 'Toutes en cours')}</select></label>
      <button class="btn btn-primary" onclick="gcAccueilFiltrer()">Appliquer</button><button class="btn btn-ghost" onclick="gcFiltresAccueil=null; nav('gc-accueil')">Réinitialiser</button>
    </div></div>
    <div class="dd-boites">
      ${ddBoite(I.cmdOuv.length, 'Commandes clients en cours · ' + gcE(I.cmdOuv.reduce((s, c) => s + I.resteCmd(c), 0)) + ' à livrer', I.cmdOuv.length ? 'warn' : 'nul', lien('gc-commandes'))}
      ${ddBoite(I.cfOuv.length, 'Commandes fournisseurs en cours' + (I.cfRetard.length ? ' · ' + I.cfRetard.length + ' en retard' : ''), I.cfRetard.length ? 'bad' : 'nul', lien('gc-achats'))}
      ${ddBoite(I.prevues.length, 'Livraisons prévues (' + (D.reglages.horizon || 15) + ' jours)', 'nul', lien('gc-commandes'))}
      ${ddBoite(I.retards.length, 'Livraisons en retard', I.retards.length ? 'bad' : 'nul', lien('gc-commandes'))}
      ${ddBoite(I.besoins.length, 'Besoins d\'approvisionnement' + (I.urgents.length ? ' · ' + I.urgents.length + ' urgent(s)' : ''), I.urgents.length ? 'bad' : I.besoins.length ? 'warn' : 'nul', lien('gc-besoins'))}
      ${ddBoite(I.sous.length, 'Articles en rupture ou sous le seuil' + (I.rupture.length ? ' · ' + I.rupture.length + ' en rupture' : ''), I.sous.length ? 'bad' : 'nul', lien('gc-stock'))}
      ${ddBoite(I.nbDispo, 'Articles disponibles · ' + gcE(I.valeurDispo), 'ok', lien('gc-stock'))}
      ${ddBoite(gcE(I.valeur), 'Valeur du stock (coût réel)', 'ok', lien('gc-lots'))}
      ${ddBoite(gcE(T.ca), 'Chiffre d\'affaires livré (période)', 'ok', lien('gc-rentabilite'))}
      ${ddBoite(gcE(T.cout), 'Coûts réels (période)', 'nul', lien('gc-rentabilite'))}
      ${ddBoite(gcE(T.marge), 'Marge brute · taux de marque ' + gcPct(T.tauxMarque), T.marge < 0 ? 'bad' : 'ok', lien('gc-rentabilite'))}
      ${ddBoite(gcPct(T.tauxMarge), 'Taux de marge (marge / coût)' + (T.provisoire ? ' · provisoire' : ''), 'nul', lien('gc-rentabilite'))}
    </div>
    <div class="dd-g dd-g2">
      <div class="dd-card dd-plat"><div class="dd-ct"><h3>Chiffre d'affaires, coûts et marge par mois</h3></div>${mois.length ? gcBarres(mois, [{cle:'ca', lib:'CA', couleur:'#138C94'}, {cle:'cout', lib:'Coût réel', couleur:'#C5BA3C'}, {cle:'marge', lib:'Marge', couleur:'#C2346E'}]) : '<div class="dd-vide">Aucune livraison sur la période</div>'}</div>
      <div class="dd-card dd-plat"><div class="dd-ct"><h3>Articles les plus rentables</h3></div>${topA.length ? gcBarres(topA, [{cle:'marge', lib:'Marge brute', couleur:'#1F8F5F'}]) : '<div class="dd-vide">—</div>'}</div>
    </div>
    <div class="dd-g dd-g2">
      <div class="dd-card dd-plat"><div class="dd-ct"><h3>Livraisons en retard</h3><span>${I.retards.length}</span></div><div class="dd-scroll">${I.retards.length ? I.retards.slice(0, 12).map(x => `<div class="dd-li" style="cursor:pointer;" onclick="gcOuvrir('gc-commande', '${x.c.id}')"><i style="background:var(--crit, var(--bad));"></i><div><b>${esc(x.c.numero)} · ${esc(gcNomClient(x.c.clientId))}</b><span>${x.ech ? 'Échéance' : 'Prévue'} le ${gcDt(x.date)} · reste ${gcQ(x.qte)}</span></div></div>`).join('') : '<div class="dd-vide">Aucun retard</div>'}</div></div>
      <div class="dd-card dd-plat"><div class="dd-ct"><h3>Livraisons prévues</h3><span>${I.prevues.length}</span></div><div class="dd-scroll">${I.prevues.length ? I.prevues.slice(0, 12).map(x => `<div class="dd-li" style="cursor:pointer;" onclick="gcOuvrir('gc-commande', '${x.c.id}')"><i style="background:var(--warn);"></i><div><b>${esc(x.c.numero)} · ${esc(gcNomClient(x.c.clientId))}</b><span>${gcDt(x.date)} · ${gcQ(x.qte)} à livrer</span></div></div>`).join('') : '<div class="dd-vide">Rien de prévu</div>'}</div></div>
    </div>
    <div class="dd-g dd-g2">
      <div class="dd-card dd-plat"><div class="dd-ct"><h3>Besoins d'approvisionnement</h3><span>${I.besoins.length}</span></div><div class="dd-scroll">${I.besoins.length ? I.besoins.slice(0, 12).map(x => `<div class="dd-li" style="cursor:pointer;" onclick="nav('gc-besoins')"><i style="background:${x.urgence === 'urgent' ? 'var(--bad)' : 'var(--warn)'};"></i><div><b>${esc(x.ref ? x.ref + ' · ' : '')}${esc(x.designation)}</b><span>${x.aCommander > 0 ? gcQ(x.aCommander) + ' ' + esc(x.unite) + ' à commander' + (x.dateCommande ? ' avant le ' + gcDt(x.dateCommande) : '') : 'Réception attendue après la date de besoin'}</span></div></div>`).join('') : '<div class="dd-vide">Tous les besoins sont couverts</div>'}</div></div>
      <div class="dd-card dd-plat"><div class="dd-ct"><h3>Meilleurs clients (CA de la période)</h3></div>${topC.length ? gcBarres(topC, [{cle:'ca', lib:'Chiffre d\'affaires', couleur:'#138C94'}]) : '<div class="dd-vide">—</div>'}</div>
    </div>
    ${I.sous.length ? `<div class="dd-card dd-plat"><div class="dd-ct"><h3>Articles en rupture ou sous le seuil</h3><span>${I.sous.length}</span></div><div class="dd-scroll">${I.sous.map(a => { const s = I.S[a.id] || {}; return `<div class="dd-li" style="cursor:pointer;" onclick="gcOuvrir('gc-article', '${a.id}')"><i style="background:var(--bad);"></i><div><b>${esc(gcLibArticle(a))}</b><span>Disponible ${gcQ(s.disponible)} ${esc(a.unite || '')} · seuil ${gcQ(a.seuil)}${s.attente ? ' · ' + gcQ(s.attente) + ' attendu(s)' : ''}</span></div></div>`; }).join('')}</div></div>` : ''}`;
}
window.gcAccueilFiltrer = () => {
  gcFiltresAccueil = {du:gcVal('gcf-du'), au:gcVal('gcf-au'), clientId:gcVal('gcf-client'), fournisseurId:gcVal('gcf-four'), articleId:gcVal('gcf-art'), statut:gcVal('gcf-statut')};
  if(gcFiltresAccueil.du && gcFiltresAccueil.au && gcFiltresAccueil.du > gcFiltresAccueil.au){ showToast('La date de début est après la date de fin'); return; }
  nav('gc-accueil');
};

// ============================================================
// CATALOGUE
// ============================================================
function gcEtatStock(a, s){
  if(!GC.suiviStock(a)) return {label:'Sans stock', cls:''};
  if(s.rupture) return {label:'Rupture', cls:'bad'};
  if(s.sousSeuil) return {label:'Sous le seuil', cls:'warn'};
  return {label:'OK', cls:'good'};
}
function renderGcCatalogue(main){
  const D = gcD(), S = GC.stocks(D), ed = gcPeut();
  const b = gcSection(main, 'Catalogue articles', (ed ? `<button class="btn btn-primary" data-gc="nouvel-article" onclick="gcFormArticle()">+ Article</button><button class="btn btn-ghost" onclick="nav('gc-import-catalogue')">Importer</button>` : '') + gcBoutonsExport('catalogue'));
  const cats = Array.from(new Set(D.articles.map(a => a.categorie).filter(Boolean))).sort();
  b.innerHTML = gcTable({id:'catalogue', lignes:() => gcD().articles, tri:1, placeholder:'Référence ou désignation…',
    texte:a => [a.ref, a.designation, a.categorie, a.description, gcNomFour(a.fournisseurId)].join(' '),
    filtres:[
      {id:'statut', label:'Statut', defaut:'actifs', options:[['actifs', 'Actifs'], ['inactifs', 'Inactifs'], ['archives', 'Archivés'], ['', 'Tous']], test:(a, v) => v === 'actifs' ? !a.archive && a.actif !== false : v === 'inactifs' ? !a.archive && a.actif === false : !!a.archive},
      {id:'cat', label:'Catégorie', options:[['', 'Toutes catégories']].concat(cats.map(c => [c, c])), test:(a, v) => a.categorie === v},
      {id:'stock', label:'Stock', options:[['', 'Tout le stock'], ['seuil', 'Sous le seuil ou rupture'], ['dispo', 'Disponible']], test:(a, v) => { const s = S[a.id] || {}; return v === 'seuil' ? (s.sousSeuil || s.rupture) : (s.disponible > 0); }}
    ],
    colonnes:[
      {titre:'Réf.', val:a => a.ref || ''},
      {titre:'Désignation', val:a => a.designation || '', html:a => `<b>${esc(a.designation || '')}</b>${a.archive ? '<span class="gc-tag">archivé</span>' : a.actif === false ? '<span class="gc-tag">inactif</span>' : ''}${GC.liste(a.paliers).length ? `<span class="gc-tag">${GC.liste(a.paliers).length} palier(s)</span>` : ''}`},
      {titre:'Catégorie', val:a => a.categorie || ''},
      {titre:'Unité', val:a => a.unite || ''},
      {titre:'Fournisseur', val:a => a.fournisseurId ? gcNomFour(a.fournisseurId) : ''},
      {titre:'Prix d\'achat', num:true, tri:a => GC.num(a.prixAchat), html:a => gcE(a.prixAchat)},
      {titre:'Prix de vente', num:true, tri:a => GC.num(a.prixVente), html:a => gcE(a.prixVente)},
      {titre:'Seuil', num:true, tri:a => GC.num(a.seuil), html:a => GC.suiviStock(a) ? gcQ(a.seuil) : '—'},
      {titre:'Disponible', num:true, tri:a => (S[a.id] || {}).disponible || 0, html:a => GC.suiviStock(a) ? gcQ((S[a.id] || {}).disponible) : '—'},
      {titre:'État', tri:a => gcEtatStock(a, S[a.id] || {}).label, html:a => gcBadge(gcEtatStock(a, S[a.id] || {}))}
    ],
    clic:a => `gcOuvrir('gc-article', '${a.id}')`, vide:'Aucun article', videSous:ed ? 'Créez un article ou importez votre catalogue (Excel ou CSV).' : ''});
}
function gcPalierLigne(p, i){
  return `<div class="gc-palier" style="display:flex;gap:6px;margin-bottom:6px;"><input class="gcp-min" type="number" step="any" min="0" placeholder="À partir de (qté)" value="${p ? gcAttr(p.min) : ''}" style="flex:1;padding:9px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--ink);">
    <input class="gcp-prix" type="number" step="any" min="0" placeholder="Prix unitaire" value="${p ? gcAttr(p.prix) : ''}" style="flex:1;padding:9px;border:1.5px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--ink);">
    <button class="btn btn-ghost" style="padding:6px 10px;" onclick="this.parentNode.remove()" title="Retirer">✕</button></div>`;
}
window.gcFormArticle = (id, prefill) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), R = D.reglages, a = Object.assign({unite:'pièce', suiviStock:true, actif:true}, id ? D.articles.find(x => x.id === id) : {}, prefill || {});
  const cats = Array.from(new Set(R.categories.concat(D.articles.map(x => x.categorie).filter(Boolean))));
  const unites = Array.from(new Set(R.unites.concat(D.articles.map(x => x.unite).filter(Boolean))));
  mgtModal(id ? 'Modifier l\'article' : 'Nouvel article', `
    <div class="gc-form">
      ${mgtChamp('Référence *', 'ga-ref', a.ref)}
      ${mgtChamp('Désignation *', 'ga-des', a.designation)}
      <div class="field"><label>Catégorie</label><input id="ga-cat" list="ga-cats" value="${gcAttr(a.categorie)}"><datalist id="ga-cats">${cats.map(c => `<option value="${gcAttr(c)}">`).join('')}</datalist></div>
      <div class="field"><label>Unité *</label><input id="ga-unite" list="ga-unites" value="${gcAttr(a.unite)}"><datalist id="ga-unites">${unites.map(c => `<option value="${gcAttr(c)}">`).join('')}</datalist></div>
      <div class="field"><label>Fournisseur principal</label><select id="ga-four">${gcOptsFour(a.fournisseurId, '— Aucun —')}</select></div>
      ${mgtChamp('Prix d\'achat (€ HT)', 'ga-pa', a.prixAchat, 'number', 'step="any" min="0"')}
      ${mgtChamp('Prix de vente de base (€ HT)', 'ga-pv', a.prixVente, 'number', 'step="any" min="0"')}
      ${mgtChamp('Seuil minimum de stock', 'ga-seuil', a.seuil, 'number', 'step="any" min="0"')}
    </div>
    ${mgtZone('Description', 'ga-desc', a.description)}
    <div class="field"><label>Tarifs de vente par paliers (quantité totale engagée dans l'offre ou la commande)</label><div id="ga-paliers">${GC.liste(a.paliers).map(gcPalierLigne).join('')}</div>
      <button class="btn btn-ghost" style="padding:6px 12px;" onclick="document.getElementById('ga-paliers').insertAdjacentHTML('beforeend', gcPalierLigne(null))">+ Palier</button>
      <div class="gc-sous" style="margin-top:4px;">Exemple : à partir de 100 → 9 €, à partir de 500 → 8 €. En dessous du premier palier : prix de vente de base.</div></div>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;"><input type="checkbox" id="ga-stock" ${a.suiviStock !== false ? 'checked' : ''}> Suivi en stock (lots, réservations)</label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0 12px;"><input type="checkbox" id="ga-actif" ${a.actif !== false ? 'checked' : ''}> Article actif</label>
    <button class="btn btn-primary" style="width:100%;" data-gc="enregistrer-article" onclick="gcSauverArticle('${id || ''}')">Enregistrer</button>`);
};
window.gcSauverArticle = (id) => gcOperation(() => {
  const D = gcD(), anc = id ? D.articles.find(x => x.id === id) : null;
  const a = Object.assign({}, anc || {id:GC.nouvelId('ar'), histoPrix:[]}, {
    ref:gcVal('ga-ref'), designation:gcVal('ga-des'), categorie:gcVal('ga-cat'), unite:gcVal('ga-unite'), fournisseurId:gcVal('ga-four'), description:gcVal('ga-desc'),
    prixAchat:gcNum(gcVal('ga-pa')), prixVente:gcNum(gcVal('ga-pv')), seuil:gcNum(gcVal('ga-seuil')), suiviStock:gcChk('ga-stock'), actif:gcChk('ga-actif'),
    paliers:Array.from(document.querySelectorAll('#ga-paliers .gc-palier')).map(el => ({min:gcNum(el.querySelector('.gcp-min').value), prix:gcNum(el.querySelector('.gcp-prix').value)})).filter(p => p.min || p.prix).sort((x, y) => x.min - y.min)
  });
  if(!a.ref){ showToast('La référence est obligatoire'); return; }
  if(!a.designation){ showToast('La désignation est obligatoire'); return; }
  if(!a.unite){ showToast('L\'unité est obligatoire'); return; }
  if(a.prixAchat < 0 || a.prixVente < 0 || a.seuil < 0){ showToast('Les prix et le seuil ne peuvent pas être négatifs'); return; }
  const pv = GC.paliersValides(a.paliers); if(pv){ showToast(pv); return; }
  const dbl = GC.doublonArticle(D.articles, a, a.id);
  if(dbl){ showToast('Doublon : « ' + gcLibArticle(dbl) + ' » a déjà cette référence ou cette désignation'); return; }
  if(anc && anc.suiviStock !== false && !a.suiviStock && GC.stockArticle(D, a.id).physique > 0){ showToast('Cet article a du stock : il doit rester suivi en stock'); return; }
  const h = GC.liste(a.histoPrix).slice(), ctx = gcCtx();
  if(!anc || GC.num(anc.prixAchat) !== a.prixAchat) h.push({date:ctx.date, ts:ctx.ts, par:ctx.par, champ:'achat', ancien:anc ? GC.num(anc.prixAchat) : null, nouveau:a.prixAchat});
  if(!anc || GC.num(anc.prixVente) !== a.prixVente) h.push({date:ctx.date, ts:ctx.ts, par:ctx.par, champ:'vente', ancien:anc ? GC.num(anc.prixVente) : null, nouveau:a.prixVente});
  if(anc && JSON.stringify(GC.liste(anc.paliers)) !== JSON.stringify(a.paliers)) h.push({date:ctx.date, ts:ctx.ts, par:ctx.par, champ:'paliers', ancien:GC.liste(anc.paliers), nouveau:a.paliers});
  a.histoPrix = h;
  gcEnregistrer('articles', a);
  gcJournal(anc ? 'Modification' : 'Création', 'Article', a, anc ? gcDiff(anc, a, {prixAchat:'prix d\'achat', prixVente:'prix de vente', seuil:'seuil', designation:'désignation', ref:'référence', actif:'actif', fournisseurId:'fournisseur'}) : '');
  mgtFermer(); showToast(anc ? 'Article enregistré' : 'Article créé');
  if(window.gcApresArticle){ const f = window.gcApresArticle; window.gcApresArticle = null; f(a); return; }
  gcOuvrir('gc-article', a.id);
});
function gcDiff(a, b, champs){
  return Object.keys(champs).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => champs[k] + ' : ' + (a[k] === undefined || a[k] === '' ? '—' : (k === 'fournisseurId' ? gcNomFour(a[k]) : a[k])) + ' → ' + (b[k] === undefined || b[k] === '' ? '—' : (k === 'fournisseurId' ? gcNomFour(b[k]) : b[k]))).join(' ; ');
}
window.gcArchiverArticle = (id) => {
  const D = gcD(), a = D.articles.find(x => x.id === id); if(!a) return;
  const s = GC.stockArticle(D, id);
  if(!a.archive && (s.physique > 0 || s.demande > 0 || s.attente > 0)){ showToast('Archivage impossible : stock, commande client ou réception en cours sur cet article'); return; }
  gcConfirmer(a.archive ? 'Réactiver l\'article' : 'Archiver l\'article', a.archive ? 'L\'article redevient utilisable.' : 'L\'article n\'apparaîtra plus dans les listes de saisie. Son historique est conservé.', () => gcOperation(() => {
    const n = Object.assign({}, a, {archive:a.archive ? null : {date:getTodayISO(), par:gcPar()}});
    gcEnregistrer('articles', n); gcJournal(a.archive ? 'Réactivation' : 'Archivage', 'Article', n); showToast(a.archive ? 'Article réactivé' : 'Article archivé'); nav('gc-article');
  }));
};
function renderGcArticle(main){
  const D = gcD(), a = D.articles.find(x => x.id === gcOuvert['gc-article']);
  if(!a){ nav('gc-catalogue'); return; }
  const ed = gcPeut(), s = GC.stockArticle(D, a.id), auj = getTodayISO();
  const lots = GC.lots(D, a.id), tarifs = D.tarifs.filter(t => t.articleId === a.id && !t.archive), cmp = GC.comparerFournisseurs(D, a.id, 1, auj);
  const mv = D.mouvements.filter(m => m.articleId === a.id).sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.ts || 0) - (x.ts || 0)).slice(0, 15);
  const b = gcSection(main, gcRetour('gc-catalogue', esc(gcLibArticle(a))), ed ? `<button class="btn btn-primary" onclick="gcFormArticle('${a.id}')">Modifier</button><button class="btn btn-ghost" onclick="gcFormTarif('', '${a.id}')">+ Tarif fournisseur</button>${GC.suiviStock(a) ? `<button class="btn btn-ghost" onclick="gcFormAjustement('${a.id}')">Ajuster / inventaire</button>` : ''}<button class="btn btn-ghost" onclick="gcArchiverArticle('${a.id}')">${a.archive ? 'Réactiver' : 'Archiver'}</button>` : '');
  b.innerHTML = `
    ${a.archive ? `<div class="gc-alerte">Article archivé le ${gcDt(a.archive.date)} par ${esc(a.archive.par || '')}.</div>` : ''}
    <div class="card"><div class="gc-kv">
      <div><span>Référence</span><b>${esc(a.ref || '—')}</b></div><div><span>Catégorie</span><b>${esc(a.categorie || '—')}</b></div><div><span>Unité</span><b>${esc(a.unite || '—')}</b></div>
      <div><span>Fournisseur principal</span><b>${esc(a.fournisseurId ? gcNomFour(a.fournisseurId) : '—')}</b></div><div><span>Prix d'achat</span><b>${gcE(a.prixAchat)}</b></div><div><span>Prix de vente de base</span><b>${gcE(a.prixVente)}</b></div>
      <div><span>Seuil minimum</span><b>${GC.suiviStock(a) ? gcQ(a.seuil) : '—'}</b></div><div><span>Statut</span><b>${a.archive ? 'Archivé' : a.actif === false ? 'Inactif' : 'Actif'}</b></div><div><span>Suivi en stock</span><b>${GC.suiviStock(a) ? 'Oui' : 'Non'}</b></div>
    </div>${a.description ? `<div style="margin-top:8px;font-size:13px;white-space:pre-line;">${esc(a.description)}</div>` : ''}</div>
    ${GC.suiviStock(a) ? `<div class="gc-chiffres">
      <div class="gc-chiffre"><span>Stock physique</span><b>${gcQ(s.physique)}</b></div><div class="gc-chiffre ${s.reserve > 0 ? 'warn' : ''}"><span>Réservé</span><b>${gcQ(s.reserve)}</b></div>
      <div class="gc-chiffre ${s.rupture ? 'bad' : s.sousSeuil ? 'warn' : 'good'}"><span>Disponible</span><b>${gcQ(s.disponible)}</b></div><div class="gc-chiffre"><span>En attente de réception</span><b>${gcQ(s.attente)}</b></div>
      <div class="gc-chiffre ${s.aApprovisionner > 0 ? 'bad' : ''}"><span>À approvisionner</span><b>${gcQ(s.aApprovisionner)}</b></div><div class="gc-chiffre"><span>Valeur (coût réel)</span><b>${gcE(s.valeur)}</b></div></div>` : ''}
    <div class="card"><h3 class="gc-h3">Tarifs de vente</h3>
      <table class="gc-lignes"><thead><tr><th>Quantité engagée</th><th class="n">Prix unitaire HT</th></tr></thead><tbody>
      <tr><td data-l="Quantité">${GC.liste(a.paliers).length ? 'Moins de ' + gcQ(GC.liste(a.paliers)[0].min) : 'Toute quantité'}</td><td class="n" data-l="Prix">${gcE(a.prixVente)}</td></tr>
      ${GC.liste(a.paliers).map((p, i, l) => `<tr><td data-l="Quantité">À partir de ${gcQ(p.min)}${l[i + 1] ? ' (moins de ' + gcQ(l[i + 1].min) + ')' : ''}</td><td class="n" data-l="Prix">${gcE(p.prix)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h3 class="gc-h3">Fournisseurs et tarifs d'achat</h3>
      ${cmp.length ? `<table class="gc-lignes"><thead><tr><th>Fournisseur</th><th class="n">Meilleur prix (1 ${esc(a.unite || '')})</th><th class="n">Délai</th><th>Origine</th></tr></thead><tbody>${cmp.map(c => `<tr><td data-l="Fournisseur"><a href="#" onclick="gcOuvrir('gc-fournisseur', '${c.fournisseurId}'); return false;">${esc(c.nom)}</a>${c.meilleur ? '<span class="gc-tag">le moins cher</span>' : ''}${c.principal ? '<span class="gc-tag">principal</span>' : ''}</td><td class="n" data-l="Prix">${gcE(c.prix)}</td><td class="n" data-l="Délai">${c.delai ? c.delai + ' j' : '—'}</td><td data-l="Origine">${c.source === 'tarif' ? 'Tarif négocié' : 'Prix de l\'article'}</td></tr>`).join('')}</tbody></table>` : '<div class="gc-sous">Aucun tarif fournisseur.</div>'}
      ${tarifs.length ? `<div class="gc-sous" style="margin:10px 0 4px;">Tarifs négociés (par quantité et période)</div><table class="gc-lignes"><thead><tr><th>Fournisseur</th><th>Réf. fournisseur</th><th class="n">À partir de</th><th class="n">Prix</th><th>Validité</th><th></th></tr></thead><tbody>${tarifs.map(t => `<tr><td data-l="Fournisseur">${esc(gcNomFour(t.fournisseurId))}</td><td data-l="Réf.">${esc(t.refFournisseur || '')}</td><td class="n" data-l="Qté min.">${gcQ(t.qteMin)}</td><td class="n" data-l="Prix">${gcE(t.prix)}</td><td data-l="Validité">${gcValidite(t, auj)}</td><td>${ed ? `<button class="btn btn-ghost" style="padding:4px 10px;" onclick="gcFormTarif('${t.id}')">Modifier</button>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}</div>
    ${GC.suiviStock(a) ? `<div class="card"><h3 class="gc-h3">Lots en stock (FIFO)</h3>${lots.filter(l => l.reste > 0).length ? `<table class="gc-lignes"><thead><tr><th>Lot</th><th>Entrée</th><th class="n">Reste</th><th class="n">Coût unitaire réel</th></tr></thead><tbody>${lots.filter(l => l.reste > 0).map(l => `<tr><td data-l="Lot">${esc(l.code || l.id)}</td><td data-l="Entrée">${gcDt(l.date)} · ${esc(GC.TYPES_MV[l.type].label)}</td><td class="n" data-l="Reste">${gcQ(l.reste)} / ${gcQ(l.qteInit)}</td><td class="n" data-l="Coût">${gcE(l.coutComplet)}${l.fraisEstime ? ' <span class="gc-tag">frais estimés</span>' : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="gc-sous">Aucun lot en stock.</div>'}</div>
    <div class="card"><h3 class="gc-h3">Derniers mouvements</h3>${mv.length ? mv.map(m => `<div class="session-row"><span>${gcDt(m.date)} · ${esc(GC.TYPES_MV[m.type] ? GC.TYPES_MV[m.type].label : m.type)}<br><span class="gc-sous">${esc(m.motif || '')}${m.par ? ' · ' + esc(m.par) : ''}</span></span><b>${GC.TYPES_MV[m.type] && GC.TYPES_MV[m.type].sens < 0 ? '−' : GC.TYPES_MV[m.type] && GC.TYPES_MV[m.type].sens > 0 ? '+' : ''}${gcQ(m.qte)}</b></div>`).join('') : '<div class="gc-sous">Aucun mouvement.</div>'}</div>` : ''}
    <div class="card"><h3 class="gc-h3">Historique des prix</h3>${GC.liste(a.histoPrix).length ? GC.liste(a.histoPrix).slice().reverse().map(h => `<div class="session-row"><span>${gcDt(h.date)} · ${h.champ === 'achat' ? 'Prix d\'achat' : h.champ === 'vente' ? 'Prix de vente' : 'Paliers'}<br><span class="gc-sous">${esc(h.par || '')}</span></span><b>${h.champ === 'paliers' ? esc(GC.liste(h.nouveau).map(p => '≥' + p.min + ' : ' + p.prix).join(' · ') || 'aucun') : (h.ancien === null ? '' : gcE(h.ancien) + ' → ') + gcE(h.nouveau)}</b></div>`).join('') : '<div class="gc-sous">Aucune modification de prix.</div>'}</div>`;
}
function gcValidite(t, auj){
  const etat = (t.fin && t.fin < auj) ? '<span class="gc-tag" style="color:var(--bad);">expiré</span>' : (t.debut && t.debut > auj) ? '<span class="gc-tag">à venir</span>' : '<span class="gc-tag" style="color:var(--good);">valable</span>';
  return (t.debut ? 'du ' + gcDt(t.debut) + ' ' : '') + (t.fin ? 'au ' + gcDt(t.fin) : (t.debut ? '' : 'sans limite')) + ' ' + etat;
}

// --- Import du catalogue (Excel / CSV) ---
let gcImportCat = null;
const GC_CHAMPS_CAT = {ref:['ref', 'reference', 'code', 'code article', 'sku'], designation:['designation', 'libelle', 'description', 'produit', 'article', 'nom'], categorie:['categorie', 'famille', 'type'], unite:['unite', 'u', 'um'],
  prixAchat:['prix achat', 'prix d achat', 'pa', 'cout', 'prix fournisseur'], prixVente:['prix vente', 'prix de vente', 'pv', 'tarif', 'prix'], seuil:['seuil', 'stock mini', 'stock minimum', 'mini'], fournisseur:['fournisseur', 'fournisseur principal']};
const GC_LIB_CAT = {ref:'Référence', designation:'Désignation', categorie:'Catégorie', unite:'Unité', prixAchat:'Prix d\'achat', prixVente:'Prix de vente', seuil:'Seuil', fournisseur:'Fournisseur'};
// Feuilles « Fournisseurs » et « Clients » du classeur complet (modèle téléchargeable).
const GC_CHAMPS_FOUR = {nom:['nom', 'fournisseur', 'raison sociale', 'societe'], contact:['contact', 'interlocuteur'], tel:['telephone', 'tel', 'gsm', 'mobile'], email:['e mail', 'email', 'mail', 'courriel'], mf:['matricule fiscal', 'mf', 'matricule'], rib:['rib', 'iban'],
  conditions:['conditions de paiement', 'conditions', 'paiement'], delai:['delai habituel jours', 'delai', 'delai jours'], categories:['categories fournies', 'categories', 'categorie'], adresse:['adresse'], notes:['notes', 'note', 'remarque', 'remarques']};
const GC_CHAMPS_CLI = {nom:['nom', 'client', 'raison sociale', 'societe'], mf:['matricule fiscal', 'mf', 'matricule'], contact:['contact', 'interlocuteur'], tel:['telephone', 'tel', 'gsm', 'mobile'], email:['e mail', 'email', 'mail', 'courriel'], conditions:['conditions de paiement', 'conditions', 'paiement'], adresse:['adresse']};
const GC_MODELE = {
  Articles:['Référence', 'Désignation', 'Catégorie', 'Unité', 'Prix d\'achat', 'Prix de vente', 'Seuil', 'Fournisseur'],
  Fournisseurs:['Nom', 'Contact', 'Téléphone', 'E-mail', 'Matricule fiscal', 'RIB', 'Conditions de paiement', 'Délai habituel (jours)', 'Catégories fournies', 'Adresse', 'Notes'],
  Clients:['Nom', 'Matricule fiscal', 'Contact', 'Téléphone', 'E-mail', 'Conditions de paiement', 'Adresse']
};
// Modèle Excel vide à remplir : une feuille par type de fiche + un mode d'emploi.
window.gcModeleImport = async () => {
  try {
    await chargerBib('xlsx');
    const wb = XLSX.utils.book_new();
    Object.keys(GC_MODELE).forEach(n => { const ws = XLSX.utils.aoa_to_sheet([GC_MODELE[n]]); ws['!cols'] = GC_MODELE[n].map(h => ({wch:Math.max(16, h.length + 4)})); XLSX.utils.book_append_sheet(wb, ws, n); });
    const aide = XLSX.utils.aoa_to_sheet([['Mode d\'emploi'], [''],
      ['1. Remplissez les feuilles Articles, Fournisseurs et Clients : une ligne par fiche, sans toucher à la première ligne (les titres).'],
      ['2. Une feuille peut rester vide si vous n\'en avez pas besoin.'],
      ['3. Articles : la Référence et la Désignation sont obligatoires. Le Fournisseur doit porter le même nom que dans la feuille Fournisseurs.'],
      ['4. Fournisseurs et Clients : le Nom est obligatoire.'],
      ['5. Prix et quantités : des chiffres seulement (exemple : 12,5).'],
      ['6. Dans l\'application : GADH > Gestion des commandes > Catalogue et tiers > Importer, puis choisissez ce fichier.'],
      ['7. Un aperçu s\'affiche : rien n\'est enregistré avant d\'appuyer sur « Importer ».'],
      ['8. Une fiche qui existe déjà (même référence ou même nom) est mise à jour, pas créée en double.']]);
    aide['!cols'] = [{wch:120}];
    XLSX.utils.book_append_sheet(wb, aide, 'Mode d\'emploi');
    gcTelecharger('modele-import-gadh.xlsx', XLSX.write(wb, {type:'array', bookType:'xlsx'}), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    showToast('Modèle Excel enregistré');
  } catch(e){ console.error(e); showToast('Modèle indisponible : ' + (e.message || e) + (navigator.onLine === false ? ' (connexion internet nécessaire)' : '')); }
};
// Contrôle des lignes d'une feuille de tiers : type = 'four' ou 'cli'.
function gcAnalyseTiers(type){
  const I = gcImportCat && gcImportCat[type]; if(!I) return [];
  const champs = Object.keys(type === 'four' ? GC_CHAMPS_FOUR : GC_CHAMPS_CLI), out = [], vus = {};
  const existants = type === 'four' ? gcD().fournisseurs.map(f => [f.id, f]) : Object.entries(gcClients());
  I.lignes.forEach((r, i) => {
    const v = {}; champs.forEach(ch => { if(I.colonnes[ch] !== undefined){ const t = String(r[I.colonnes[ch]] == null ? '' : r[I.colonnes[ch]]).trim(); if(t !== '') v[ch] = t; } });
    if(!Object.keys(v).length) return;
    const x = {n:i + 2, v, alertes:[]}, k = GC.norm(v.nom || '');
    if(!v.nom) x.alertes.push('Nom manquant');
    if(v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) x.alertes.push('E-mail invalide');
    if(v.delai !== undefined && (isNaN(GC.num(v.delai)) || GC.num(v.delai) < 0 || /[a-z]/i.test(v.delai.replace(/jours?|j/gi, '')))) x.alertes.push('Délai invalide');
    if(k){ if(vus[k]) x.alertes.push('Doublon de la ligne ' + vus[k]); else vus[k] = x.n; }
    const ex = k ? existants.find(([id, f]) => f && GC.norm(f.nom) === k) : null;
    x.id = ex ? ex[0] : ''; x.action = ex ? 'maj' : 'creation'; x.ok = !x.alertes.length;
    out.push(x);
  });
  return out;
}
// Lecture d'un fichier Excel ou CSV → tableau de lignes (la 1re ligne = en-têtes).
async function gcLireFichier(file){
  const nom = (file.name || '').toLowerCase();
  if(/\.(csv|txt)$/.test(nom)){
    const buf = await file.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if(t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf);
    return {lignes:GC.parserCSV(t), feuille:''};
  }
  await chargerBib('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), {type:'array'}), feuilles = {};
  wb.SheetNames.forEach(n => { feuilles[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:false, defval:''}).filter(r => r.some(x => String(x).trim() !== '')); });
  const feuille = wb.SheetNames[0];
  return {lignes:feuilles[feuille], feuille, feuilles};
}
function gcDetecter(entetes, syn){
  const E = entetes.map(GC.norm), m = {};
  Object.keys(syn).forEach(ch => { const i = E.findIndex((e, j) => syn[ch].indexOf(e) >= 0 && Object.values(m).indexOf(j) < 0); if(i >= 0) m[ch] = i; });
  Object.keys(syn).forEach(ch => { if(m[ch] !== undefined) return; const i = E.findIndex((e, j) => e && Object.values(m).indexOf(j) < 0 && syn[ch].some(s => s.length > 2 && e.indexOf(s) >= 0)); if(i >= 0) m[ch] = i; });
  return m;
}
window.gcImportCatFichier = async (input) => {
  const f = input.files && input.files[0]; if(!f) return;
  try {
    const r = await gcLireFichier(f), F = r.feuilles || {};
    // classeur complet (modèle) : feuilles « Articles », « Fournisseurs », « Clients » ; sinon la 1re feuille = articles
    const feuilleDe = (mot) => Object.keys(F).find(n => GC.norm(n).indexOf(mot) === 0);
    const nF = feuilleDe('fournisseur'), nC = feuilleDe('client'), nA = feuilleDe('article');
    const art = nA ? F[nA] : ((nF || nC) && Object.keys(F).length ? (Object.keys(F).filter(n => n !== nF && n !== nC && GC.norm(n).indexOf('mode') !== 0).map(n => F[n])[0] || []) : r.lignes);
    const tiers = (L, syn) => L && L.length > 1 ? {entetes:L[0].map(String), lignes:L.slice(1), colonnes:gcDetecter(L[0].map(String), syn)} : null;
    const four = tiers(nF && F[nF], GC_CHAMPS_FOUR), cli = tiers(nC && F[nC], GC_CHAMPS_CLI);
    if(art.length < 2 && !four && !cli){ showToast('Fichier vide ou sans ligne de données'); return; }
    const ent = art.length ? art[0].map(String) : [];
    gcImportCat = {fichier:f.name, entetes:ent, lignes:art.slice(1), colonnes:gcDetecter(ent, GC_CHAMPS_CAT), four, cli};
    nav('gc-import-catalogue');
  } catch(e){ console.error(e); showToast('Lecture impossible : ' + (e.message || e) + (navigator.onLine === false ? ' (hors ligne : utilisez un fichier CSV)' : '')); }
};
function gcAnalyseCat(){
  const I = gcImportCat, D = gcD(), out = [], vus = {};
  I.lignes.forEach((r, i) => {
    const v = (ch) => I.colonnes[ch] === undefined ? '' : String(r[I.colonnes[ch]] == null ? '' : r[I.colonnes[ch]]).trim();
    const x = {n:i + 2, ref:v('ref'), designation:v('designation'), categorie:v('categorie'), unite:v('unite'), prixAchat:v('prixAchat'), prixVente:v('prixVente'), seuil:v('seuil'), fournisseur:v('fournisseur'), alertes:[]};
    if(!x.ref && !x.designation) return;
    const existant = x.ref ? D.articles.find(a => a.ref && GC.normRef(a.ref) === GC.normRef(x.ref)) : D.articles.find(a => GC.norm(a.designation) === GC.norm(x.designation));
    x.action = existant ? 'maj' : 'creation'; x.articleId = existant ? existant.id : '';
    if(!x.ref) x.alertes.push('Référence manquante');
    if(!x.designation && !existant) x.alertes.push('Désignation manquante');
    ['prixAchat', 'prixVente', 'seuil'].forEach(k => { if(x[k] !== '' && (isNaN(GC.num(x[k])) || GC.num(x[k]) < 0 || /[a-z]/i.test(x[k].replace(/€|eur|tnd|dt/gi, '')))) x.alertes.push(GC_LIB_CAT[k] + ' invalide'); });
    const k = GC.normRef(x.ref || x.designation);
    if(vus[k]) x.alertes.push('Doublon de la ligne ' + vus[k]); else vus[k] = x.n;
    if(x.fournisseur){ const f = D.fournisseurs.find(y => GC.norm(y.nom) === GC.norm(x.fournisseur)); x.fournisseurId = f ? f.id : ''; if(!f) x.alertes.push('Fournisseur « ' + x.fournisseur + ' » inconnu (sera créé)'); }
    x.ok = !x.alertes.some(a => !/sera créé/.test(a));
    out.push(x);
  });
  return out;
}
function renderGcImportCatalogue(main){
  const ed = gcPeut();
  const b = gcSection(main, gcRetour('gc-catalogue', 'Importer articles, fournisseurs et clients'), '');
  if(!ed){ b.innerHTML = '<div class="card">Consultation seulement.</div>'; return; }
  if(!gcImportCat){
    b.innerHTML = `<div class="card"><p style="margin-top:0;">Fichier Excel (.xlsx, .xls) ou CSV, avec une ligne d'en-têtes. Colonnes reconnues : ${Object.values(GC_LIB_CAT).join(', ')}.</p>
      <p class="gc-sous">Les articles existants (même référence) sont mis à jour ; les autres sont créés. Rien n'est enregistré avant votre validation.</p>
      <input type="file" id="gc-cat-fichier" accept=".xlsx,.xls,.csv,.txt" onchange="gcImportCatFichier(this)"></div>
      <div class="card"><h3 class="gc-h3">Tout créer avec un seul fichier Excel</h3>
      <p style="margin:0 0 8px;">Le modèle contient trois feuilles : <b>Articles</b>, <b>Fournisseurs</b> et <b>Clients</b>. Remplissez-les (une ligne par fiche), puis choisissez le fichier ci-dessus : tout est créé en une fois.</p>
      <button class="btn btn-primary" data-gc="modele-import" onclick="gcModeleImport()">Télécharger le modèle Excel</button></div>`;
    return;
  }
  const I = gcImportCat, L = gcAnalyseCat(), TF = gcAnalyseTiers('four'), TC = gcAnalyseTiers('cli'), okN = L.filter(x => x.ok).length + TF.filter(x => x.ok).length + (gcPeutClients() ? TC.filter(x => x.ok).length : 0);
  const blocTiers = (T, titre, permis) => !T.length ? '' : `<div class="card" data-gc-tiers="${titre}"><b>${titre}</b> · ${T.length} ligne(s) · <span style="color:var(--good);">${T.filter(x => x.ok && x.action === 'creation').length} création(s)</span> · ${T.filter(x => x.ok && x.action === 'maj').length} mise(s) à jour · <span style="color:var(--bad);">${T.filter(x => !x.ok).length} en erreur (ignorées)</span>${permis ? '' : '<div style="color:var(--bad);margin-top:6px;">Votre profil ne permet pas de modifier les clients : cette feuille sera ignorée.</div>'}
    <div class="gct-scroll" style="margin-top:8px;"><table class="gct-t"><thead><tr><th>Ligne</th><th>Action</th><th>Nom</th><th>Téléphone</th><th>E-mail</th><th>Contrôle</th></tr></thead><tbody>
    ${T.map(x => `<tr><td data-l="Ligne">${x.n}</td><td data-l="Action">${x.ok ? (x.action === 'maj' ? 'Mise à jour' : 'Création') : '<b style="color:var(--bad);">Ignorée</b>'}</td><td data-l="Nom">${esc(x.v.nom || '')}</td><td data-l="Téléphone">${esc(x.v.tel || '')}</td><td data-l="E-mail">${esc(x.v.email || '')}</td><td data-l="Contrôle">${x.alertes.length ? esc(x.alertes.join(' · ')) : 'OK'}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  b.innerHTML = blocTiers(TF, 'Fournisseurs', true) + blocTiers(TC, 'Clients', gcPeutClients()) + (!L.length && !I.entetes.length ? '' : `<div class="card"><b>${esc(I.fichier)}</b> · ${L.length} ligne(s) · <span style="color:var(--good);">${L.filter(x => x.ok && x.action === 'creation').length} création(s)</span> · ${L.filter(x => x.ok && x.action === 'maj').length} mise(s) à jour · <span style="color:var(--bad);">${L.length - okN} en erreur (ignorées)</span>
    <div class="gc-form" style="margin-top:10px;">${Object.keys(GC_CHAMPS_CAT).map(ch => `<div class="field"><label>${GC_LIB_CAT[ch]}</label><select onchange="gcImportCat.colonnes['${ch}'] = this.value === '' ? undefined : Number(this.value); nav('gc-import-catalogue')">${gcOpts(I.entetes.map((e, i) => [i, e || ('Colonne ' + (i + 1))]), I.colonnes[ch], '— Non importée —')}</select></div>`).join('')}</div></div>
    <div class="gct-scroll"><table class="gct-t"><thead><tr><th>Ligne</th><th>Action</th><th>Réf.</th><th>Désignation</th><th>Unité</th><th class="n">Prix achat</th><th class="n">Prix vente</th><th>Contrôle</th></tr></thead><tbody>
    ${L.map(x => `<tr><td data-l="Ligne">${x.n}</td><td data-l="Action">${x.ok ? (x.action === 'maj' ? 'Mise à jour' : 'Création') : '<b style="color:var(--bad);">Ignorée</b>'}</td><td data-l="Réf.">${esc(x.ref)}</td><td data-l="Désignation">${esc(x.designation)}</td><td data-l="Unité">${esc(x.unite)}</td><td class="n" data-l="Prix achat">${esc(x.prixAchat)}</td><td class="n" data-l="Prix vente">${esc(x.prixVente)}</td><td data-l="Contrôle" style="color:${x.alertes.length ? 'var(--bad)' : 'var(--good)'};">${esc(x.alertes.join(' ; ') || 'OK')}</td></tr>`).join('')}
    </tbody></table></div>`) + `
    <div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-ghost" style="flex:1;" onclick="gcImportCat=null; nav('gc-import-catalogue')">Autre fichier</button><button class="btn btn-primary" style="flex:2;" ${okN ? '' : 'disabled'} data-gc="valider-import-catalogue" onclick="gcValiderImportCat()">Importer ${okN} fiche(s)</button></div>`;
}
window.gcValiderImportCat = () => gcOperation(() => {
  // 1. tiers du classeur complet, avant les articles (qui s'y rattachent par le nom du fournisseur)
  const TF = gcAnalyseTiers('four').filter(x => x.ok), TC = gcPeutClients() ? gcAnalyseTiers('cli').filter(x => x.ok) : [];
  if(TF.length){
    const D0 = gcD(), R0 = D0.reglages;
    gcEnregistrer('fournisseurs', TF.map(x => { const anc = x.id ? D0.fournisseurs.find(f => f.id === x.id) : null, v = Object.assign({}, x.v);
      if(v.delai !== undefined) v.delai = GC.num(v.delai);
      return Object.assign({}, anc || {id:GC.nouvelId('fo'), actif:true, delai:Number(R0.delaiDefaut) || 7, conditions:''}, v); }));
    gcCacheD = null;
  }
  if(TC.length){
    const l = Object.assign({}, gcClients());
    TC.forEach(x => { const nid = x.id || (typeof mgtId === 'function' ? mgtId('k') : GC.nouvelId('k')); l[nid] = Object.assign({}, l[nid] || {}, x.v); });
    setJSON('gadh_fact_clients', l); gcCacheD = null;
  }
  const resumeTiers = (TF.length ? ', ' + TF.length + ' fournisseur(s) (' + TF.filter(x => x.action === 'creation').length + ' création(s))' : '') + (TC.length ? ', ' + TC.length + ' client(s) (' + TC.filter(x => x.action === 'creation').length + ' création(s))' : '');
  const L = gcAnalyseCat().filter(x => x.ok), D = gcD(), R = D.reglages, ctx = gcCtx(), nouveauxF = [], articles = [];
  const fourDe = (x) => {
    if(!x.fournisseur) return undefined;
    if(x.fournisseurId) return x.fournisseurId;
    let f = nouveauxF.find(y => GC.norm(y.nom) === GC.norm(x.fournisseur));
    if(!f){ f = {id:GC.nouvelId('fo'), nom:x.fournisseur, actif:true, delai:Number(R.delaiDefaut) || 7, conditions:''}; nouveauxF.push(f); }
    return f.id;
  };
  L.forEach(x => {
    const anc = x.articleId ? D.articles.find(a => a.id === x.articleId) : null, n = Object.assign({}, anc || {id:GC.nouvelId('ar'), suiviStock:true, actif:true, paliers:[], histoPrix:[], unite:'pièce'});
    if(x.ref) n.ref = x.ref; if(x.designation) n.designation = x.designation; if(x.categorie) n.categorie = x.categorie; if(x.unite) n.unite = x.unite;
    const fid = fourDe(x); if(fid !== undefined) n.fournisseurId = fid;
    if(x.seuil !== '') n.seuil = GC.num(x.seuil);
    n.histoPrix = GC.liste(n.histoPrix).slice();
    if(x.prixAchat !== '' && GC.num(x.prixAchat) !== GC.num(n.prixAchat)){ n.histoPrix.push({date:ctx.date, ts:ctx.ts, par:ctx.par, champ:'achat', ancien:anc ? GC.num(anc.prixAchat) : null, nouveau:GC.num(x.prixAchat), source:'import'}); n.prixAchat = GC.num(x.prixAchat); }
    if(x.prixVente !== '' && GC.num(x.prixVente) !== GC.num(n.prixVente)){ n.histoPrix.push({date:ctx.date, ts:ctx.ts, par:ctx.par, champ:'vente', ancien:anc ? GC.num(anc.prixVente) : null, nouveau:GC.num(x.prixVente), source:'import'}); n.prixVente = GC.num(x.prixVente); }
    articles.push(n);
  });
  if(nouveauxF.length) gcEnregistrer('fournisseurs', nouveauxF);
  if(articles.length) gcEnregistrer('articles', articles);
  gcJournal('Import', 'Catalogue', {id:'', numero:gcImportCat.fichier}, articles.length + ' article(s) (' + L.filter(x => x.action === 'creation').length + ' création(s))' + (nouveauxF.length ? ', ' + nouveauxF.length + ' fournisseur(s) créé(s)' : '') + resumeTiers);
  gcImportCat = null; showToast(articles.length + ' article(s)' + (TF.length ? ', ' + TF.length + ' fournisseur(s)' : '') + (TC.length ? ', ' + TC.length + ' client(s)' : '') + ' importé(s)'); nav('gc-catalogue');
});

// ============================================================
// TARIFS FOURNISSEURS ET COMPARAISON
// ============================================================
let gcComparaison = {articleId:'', qte:1};
function renderGcTarifs(main){
  const D = gcD(), ed = gcPeut(), auj = getTodayISO();
  const b = gcSection(main, 'Tarifs fournisseurs', (ed ? `<button class="btn btn-primary" data-gc="nouveau-tarif" onclick="gcFormTarif()">+ Tarif</button>` : '') + gcBoutonsExport('tarifs'));
  const cmp = gcComparaison.articleId ? GC.comparerFournisseurs(D, gcComparaison.articleId, gcComparaison.qte, auj) : [];
  const art = gcComparaison.articleId ? gcArticle(gcComparaison.articleId) : null;
  b.innerHTML = `<div class="card"><h3 class="gc-h3">Comparer les fournisseurs</h3><div class="gc-filtres">
      <label style="flex:3 1 220px;">Article<select id="gcc-art">${gcOptsArticles(gcComparaison.articleId, '— Choisir —')}</select></label>
      <label>Quantité<input id="gcc-qte" type="number" step="any" min="0" value="${gcComparaison.qte}"></label>
      <button class="btn btn-primary" onclick="gcComparaison={articleId:gcVal('gcc-art'), qte:gcNum(gcVal('gcc-qte')) || 1}; nav('gc-tarifs')">Comparer</button></div>
    ${art ? (cmp.length ? `<table class="gc-lignes"><thead><tr><th>Fournisseur</th><th class="n">Prix unitaire</th><th class="n">Total pour ${gcQ(gcComparaison.qte)}</th><th class="n">Délai</th><th>Origine</th></tr></thead><tbody>${cmp.map(c => `<tr><td data-l="Fournisseur"><b>${esc(c.nom)}</b>${c.meilleur ? '<span class="gc-tag" style="color:var(--good);">meilleur prix</span>' : ''}${c.principal ? '<span class="gc-tag">principal</span>' : ''}</td><td class="n" data-l="Prix">${gcE(c.prix)}</td><td class="n" data-l="Total">${gcE(c.total)}</td><td class="n" data-l="Délai">${c.delai ? c.delai + ' j' : '—'}</td><td data-l="Origine">${c.source === 'tarif' ? 'Tarif négocié' + (c.refFournisseur ? ' (' + esc(c.refFournisseur) + ')' : '') : 'Prix de l\'article'}</td></tr>`).join('')}</tbody></table>` : '<div class="gc-sous">Aucun tarif valable pour cette quantité aujourd\'hui.</div>') : ''}</div>
  ${gcTable({id:'tarifs', lignes:() => gcD().tarifs, tri:0, texte:t => [gcLibArticle(gcArticle(t.articleId)), gcNomFour(t.fournisseurId), t.refFournisseur].join(' '),
    filtres:[{id:'etat', label:'État', defaut:'valables', options:[['valables', 'Valables aujourd\'hui'], ['expires', 'Expirés'], ['archives', 'Archivés'], ['', 'Tous']],
      test:(t, v) => v === 'archives' ? !!t.archive : !t.archive && (v === 'expires' ? (t.fin && t.fin < auj) : !(t.fin && t.fin < auj) && !(t.debut && t.debut > auj))},
      {id:'four', label:'Fournisseur', options:[['', 'Tous les fournisseurs']].concat(D.fournisseurs.map(f => [f.id, f.nom])), test:(t, v) => t.fournisseurId === v}],
    colonnes:[{titre:'Article', val:t => gcLibArticle(gcArticle(t.articleId))}, {titre:'Fournisseur', val:t => gcNomFour(t.fournisseurId)}, {titre:'Réf. fournisseur', val:t => t.refFournisseur || ''},
      {titre:'À partir de', num:true, tri:t => GC.num(t.qteMin), html:t => gcQ(t.qteMin)}, {titre:'Prix', num:true, tri:t => GC.num(t.prix), html:t => gcE(t.prix)},
      {titre:'Validité', tri:t => t.fin || '9999', html:t => gcValidite(t, auj)}, {titre:'Délai', num:true, tri:t => GC.num(t.delai), html:t => t.delai ? t.delai + ' j' : '—'}],
    clic:t => ed ? `gcFormTarif('${t.id}')` : `gcOuvrir('gc-article', '${t.articleId}')`, vide:'Aucun tarif'})}`;
}
window.gcFormTarif = (id, articleId, fournisseurId) => {
  if(!gcPeut()) return gcRefus();
  const t = Object.assign({articleId:articleId || '', fournisseurId:fournisseurId || '', qteMin:0}, id ? gcD().tarifs.find(x => x.id === id) : {});
  mgtModal(id ? 'Modifier le tarif' : 'Nouveau tarif fournisseur', `
    <div class="field"><label>Article *</label><select id="gt-art">${gcOptsArticles(t.articleId, '— Choisir —')}</select></div>
    <div class="field"><label>Fournisseur *</label><select id="gt-four">${gcOptsFour(t.fournisseurId, '— Choisir —')}</select></div>
    <div class="gc-form">${mgtChamp('Référence chez le fournisseur', 'gt-ref', t.refFournisseur)}${mgtChamp('Prix d\'achat HT *', 'gt-prix', t.prix, 'number', 'step="any" min="0"')}
    ${mgtChamp('À partir de la quantité', 'gt-min', t.qteMin, 'number', 'step="any" min="0"')}${mgtChamp('Délai de livraison (jours)', 'gt-delai', t.delai, 'number', 'min="0"')}
    ${mgtChamp('Valable du', 'gt-debut', t.debut, 'date')}${mgtChamp('Valable jusqu\'au', 'gt-fin', t.fin, 'date')}</div>
    <button class="btn btn-primary" style="width:100%;" data-gc="enregistrer-tarif" onclick="gcSauverTarif('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="gcArchiverTarif('${id}')">${t.archive ? 'Réactiver' : 'Archiver'} ce tarif</button>` : ''}`);
};
window.gcSauverTarif = (id) => gcOperation(() => {
  const anc = id ? gcD().tarifs.find(x => x.id === id) : null;
  const t = Object.assign({}, anc || {id:GC.nouvelId('ta')}, {articleId:gcVal('gt-art'), fournisseurId:gcVal('gt-four'), refFournisseur:gcVal('gt-ref'), prix:gcNum(gcVal('gt-prix')), qteMin:gcNum(gcVal('gt-min')), delai:gcNum(gcVal('gt-delai')), debut:gcVal('gt-debut'), fin:gcVal('gt-fin')});
  if(!t.articleId || !t.fournisseurId){ showToast('Choisissez l\'article et le fournisseur'); return; }
  if(!(t.prix > 0)){ showToast('Le prix doit être supérieur à 0'); return; }
  if(t.qteMin < 0 || t.delai < 0){ showToast('Quantité et délai ne peuvent pas être négatifs'); return; }
  if(t.debut && t.fin && t.debut > t.fin){ showToast('La date de fin est avant la date de début'); return; }
  const chevauche = gcD().tarifs.find(x => x.id !== t.id && !x.archive && x.articleId === t.articleId && x.fournisseurId === t.fournisseurId && GC.num(x.qteMin) === t.qteMin && (!x.fin || !t.debut || x.fin >= t.debut) && (!t.fin || !x.debut || t.fin >= x.debut));
  if(chevauche){ showToast('Un tarif existe déjà pour ce fournisseur, cette quantité et cette période : modifiez-le ou archivez-le'); return; }
  gcEnregistrer('tarifs', t);
  gcJournal(anc ? 'Modification' : 'Création', 'Tarif fournisseur', {id:t.id, numero:gcLibArticle(gcArticle(t.articleId)) + ' / ' + gcNomFour(t.fournisseurId)}, gcE(t.prix) + ' à partir de ' + t.qteMin + (anc && GC.num(anc.prix) !== t.prix ? ' (était ' + gcE(anc.prix) + ')' : ''));
  mgtFermer(); showToast('Tarif enregistré'); nav(activeTab);
});
window.gcArchiverTarif = (id) => gcOperation(() => {
  const t = gcD().tarifs.find(x => x.id === id); if(!t) return;
  const n = Object.assign({}, t, {archive:t.archive ? null : {date:getTodayISO(), par:gcPar()}});
  gcEnregistrer('tarifs', n); gcJournal(t.archive ? 'Réactivation' : 'Archivage', 'Tarif fournisseur', {id, numero:gcLibArticle(gcArticle(t.articleId)) + ' / ' + gcNomFour(t.fournisseurId)}); mgtFermer(); nav(activeTab);
});

// ============================================================
// FOURNISSEURS
// ============================================================
function gcStatsFournisseur(D, fid){
  const rec = GC.recus(D), cfs = D.cmdF.filter(f => f.fournisseurId === fid && f.statut !== 'annulee' && f.statut !== 'brouillon');
  let achete = 0, reste = 0;
  cfs.forEach(f => { const t = gcTotauxCF(f); achete += t.ttc; reste += t.reste; });
  return {nb:cfs.length, achete, reste, ouvertes:cfs.filter(f => GC.CMDF_OUVERTE[GC.statutCmdF(f, rec).cle]).length};
}
function renderGcFournisseurs(main){
  const D = gcD(), ed = gcPeut();
  const b = gcSection(main, 'Fournisseurs', (ed ? `<button class="btn btn-primary" data-gc="nouveau-fournisseur" onclick="gcFormFournisseur()">+ Fournisseur</button><button class="btn btn-ghost" onclick="nav('gc-import-catalogue')">Importer</button>` : '') + gcBoutonsExport('fournisseurs'));
  const st = {}; D.fournisseurs.forEach(f => { st[f.id] = gcStatsFournisseur(D, f.id); });
  b.innerHTML = gcTable({id:'fournisseurs', lignes:() => gcD().fournisseurs, tri:0, texte:f => [f.nom, f.contact, f.tel, f.email, f.categories].join(' '),
    filtres:[{id:'statut', label:'Statut', defaut:'actifs', options:[['actifs', 'Actifs'], ['archives', 'Archivés'], ['', 'Tous']], test:(f, v) => v === 'actifs' ? !f.archive : !!f.archive}],
    colonnes:[{titre:'Fournisseur', val:f => f.nom || '', html:f => `<b>${esc(f.nom || '')}</b>${f.actif === false ? '<span class="gc-tag">inactif</span>' : ''}`}, {titre:'Contact', val:f => [f.contact, f.tel].filter(Boolean).join(' · ')},
      {titre:'Conditions de paiement', val:f => f.conditions || ''}, {titre:'Délai habituel', num:true, tri:f => GC.num(f.delai), html:f => f.delai ? f.delai + ' j' : '—'},
      {titre:'Commandes', num:true, tri:f => (st[f.id] || {}).nb || 0, html:f => ((st[f.id] || {}).nb || 0) + ((st[f.id] || {}).ouvertes ? ' (' + st[f.id].ouvertes + ' en cours)' : '')},
      {titre:'Acheté (TTC)', num:true, tri:f => (st[f.id] || {}).achete || 0, html:f => gcE((st[f.id] || {}).achete)}, {titre:'Reste à payer', num:true, tri:f => (st[f.id] || {}).reste || 0, html:f => gcE((st[f.id] || {}).reste)}],
    clic:f => `gcOuvrir('gc-fournisseur', '${f.id}')`, vide:'Aucun fournisseur'});
}
window.gcFormFournisseur = (id) => {
  if(!gcPeut()) return gcRefus();
  const f = Object.assign({actif:true, delai:gcReglages().delaiDefaut}, id ? gcD().fournisseurs.find(x => x.id === id) : {});
  mgtModal(id ? 'Modifier le fournisseur' : 'Nouveau fournisseur', `<div class="gc-form">
    ${mgtChamp('Nom *', 'gf-nom', f.nom)}${mgtChamp('Contact', 'gf-contact', f.contact)}${mgtChamp('Téléphone', 'gf-tel', f.tel, 'tel')}${mgtChamp('E-mail', 'gf-email', f.email, 'email')}
    ${mgtChamp('Matricule fiscal', 'gf-mf', f.mf)}${mgtChamp('RIB', 'gf-rib', f.rib)}${mgtChamp('Conditions de paiement', 'gf-cond', f.conditions)}${mgtChamp('Délai habituel (jours)', 'gf-delai', f.delai, 'number', 'min="0"')}
    ${mgtChamp('Catégories fournies', 'gf-cat', f.categories)}</div>
    ${mgtZone('Adresse', 'gf-adr', f.adresse)}${mgtZone('Notes', 'gf-notes', f.notes)}
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0 12px;"><input type="checkbox" id="gf-actif" ${f.actif !== false ? 'checked' : ''}> Fournisseur actif</label>
    <button class="btn btn-primary" style="width:100%;" data-gc="enregistrer-fournisseur" onclick="gcSauverFournisseur('${id || ''}')">Enregistrer</button>`);
};
window.gcSauverFournisseur = (id) => gcOperation(() => {
  const D = gcD(), anc = id ? D.fournisseurs.find(x => x.id === id) : null;
  const f = Object.assign({}, anc || {id:GC.nouvelId('fo')}, {nom:gcVal('gf-nom'), contact:gcVal('gf-contact'), tel:gcVal('gf-tel'), email:gcVal('gf-email'), mf:gcVal('gf-mf'), rib:gcVal('gf-rib'),
    conditions:gcVal('gf-cond'), delai:gcNum(gcVal('gf-delai')), categories:gcVal('gf-cat'), adresse:gcVal('gf-adr'), notes:gcVal('gf-notes'), actif:gcChk('gf-actif')});
  if(!f.nom){ showToast('Le nom est obligatoire'); return; }
  if(f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)){ showToast('Adresse e-mail invalide'); return; }
  if(f.delai < 0){ showToast('Le délai ne peut pas être négatif'); return; }
  const dbl = GC.doublonFournisseur(D.fournisseurs, f, f.id); if(dbl){ showToast('Un fournisseur porte déjà ce nom'); return; }
  gcEnregistrer('fournisseurs', f); gcJournal(anc ? 'Modification' : 'Création', 'Fournisseur', f);
  mgtFermer(); showToast('Fournisseur enregistré');
  if(window.gcApresFournisseur){ const g = window.gcApresFournisseur; window.gcApresFournisseur = null; g(f); return; }
  gcOuvrir('gc-fournisseur', f.id);
});
window.gcArchiverFournisseur = (id) => {
  const D = gcD(), f = D.fournisseurs.find(x => x.id === id); if(!f) return;
  if(!f.archive && gcStatsFournisseur(D, id).ouvertes){ showToast('Ce fournisseur a des commandes en cours'); return; }
  gcConfirmer(f.archive ? 'Réactiver le fournisseur' : 'Archiver le fournisseur', f.archive ? 'Le fournisseur redevient sélectionnable.' : 'Il ne sera plus proposé dans les saisies ; son historique est conservé.', () => gcOperation(() => {
    const n = Object.assign({}, f, {archive:f.archive ? null : {date:getTodayISO(), par:gcPar()}}); gcEnregistrer('fournisseurs', n); gcJournal(f.archive ? 'Réactivation' : 'Archivage', 'Fournisseur', n); nav('gc-fournisseur');
  }));
};
function renderGcFournisseur(main){
  const D = gcD(), f = D.fournisseurs.find(x => x.id === gcOuvert['gc-fournisseur']); if(!f){ nav('gc-fournisseurs'); return; }
  const ed = gcPeut(), st = gcStatsFournisseur(D, f.id), rec = GC.recus(D), auj = getTodayISO();
  const tarifs = D.tarifs.filter(t => t.fournisseurId === f.id && !t.archive), arts = D.articles.filter(a => a.fournisseurId === f.id && !a.archive);
  const cfs = D.cmdF.filter(c => c.fournisseurId === f.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recs = D.receptions.filter(r => r.fournisseurId === f.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const b = gcSection(main, gcRetour('gc-fournisseurs', esc(f.nom)), ed ? `<button class="btn btn-primary" onclick="gcFormFournisseur('${f.id}')">Modifier</button><button class="btn btn-ghost" onclick="gcFormTarif('', '', '${f.id}')">+ Tarif</button><button class="btn btn-ghost" onclick="gcNouvelleCF('${f.id}')">+ Commande</button><button class="btn btn-ghost" onclick="gcArchiverFournisseur('${f.id}')">${f.archive ? 'Réactiver' : 'Archiver'}</button>` : '');
  b.innerHTML = `${f.archive ? '<div class="gc-alerte">Fournisseur archivé.</div>' : ''}
    <div class="card"><div class="gc-kv"><div><span>Contact</span><b>${esc(f.contact || '—')}</b></div><div><span>Téléphone</span><b>${esc(f.tel || '—')}</b></div><div><span>E-mail</span><b>${esc(f.email || '—')}</b></div>
      <div><span>Matricule fiscal</span><b>${esc(f.mf || '—')}</b></div><div><span>Conditions de paiement</span><b>${esc(f.conditions || '—')}</b></div><div><span>Délai habituel</span><b>${f.delai ? f.delai + ' jours' : '—'}</b></div>
      <div><span>RIB</span><b>${esc(f.rib || '—')}</b></div><div><span>Catégories</span><b>${esc(f.categories || '—')}</b></div></div>
      ${f.adresse ? `<div class="gc-sous" style="margin-top:8px;white-space:pre-line;">${esc(f.adresse)}</div>` : ''}${f.notes ? `<div style="margin-top:6px;font-size:13px;white-space:pre-line;">${esc(f.notes)}</div>` : ''}</div>
    <div class="gc-chiffres"><div class="gc-chiffre"><span>Commandes</span><b>${st.nb}</b></div><div class="gc-chiffre warn"><span>En cours</span><b>${st.ouvertes}</b></div><div class="gc-chiffre"><span>Acheté (TTC)</span><b>${gcE(st.achete)}</b></div><div class="gc-chiffre ${st.reste > 0 ? 'bad' : ''}"><span>Reste à payer</span><b>${gcE(st.reste)}</b></div></div>
    <div class="card"><h3 class="gc-h3">Références fournies et tarifs négociés</h3>${tarifs.length || arts.length ? `<table class="gc-lignes"><thead><tr><th>Article</th><th>Réf. fournisseur</th><th class="n">À partir de</th><th class="n">Prix</th><th>Validité</th></tr></thead><tbody>
      ${tarifs.map(t => `<tr onclick="${ed ? `gcFormTarif('${t.id}')` : ''}" style="cursor:pointer;"><td data-l="Article">${esc(gcLibArticle(gcArticle(t.articleId)))}</td><td data-l="Réf.">${esc(t.refFournisseur || '')}</td><td class="n" data-l="Qté min.">${gcQ(t.qteMin)}</td><td class="n" data-l="Prix">${gcE(t.prix)}</td><td data-l="Validité">${gcValidite(t, auj)}</td></tr>`).join('')}
      ${arts.filter(a => !tarifs.some(t => t.articleId === a.id)).map(a => `<tr><td data-l="Article">${esc(gcLibArticle(a))}</td><td data-l="Réf.">—</td><td class="n" data-l="Qté min.">—</td><td class="n" data-l="Prix">${gcE(a.prixAchat)}</td><td data-l="Validité">Prix de l'article (fournisseur principal)</td></tr>`).join('')}</tbody></table>` : '<div class="gc-sous">Aucune référence.</div>'}</div>
    <div class="card"><h3 class="gc-h3">Commandes</h3>${cfs.length ? cfs.map(c => { const s = GC.statutCmdF(c, rec); return `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-achat', '${c.id}')"><span><b>${esc(c.numero || 'Brouillon')}</b> · ${gcDt(c.date)}<br><span class="gc-sous">Prévue le ${gcDt(c.datePrevue)}${GC.enRetardCmdF(c, rec, auj) ? ' · <b style="color:var(--bad);">en retard</b>' : ''}</span></span><span style="text-align:right;">${gcBadge(s)}<br><b>${gcE(gcTotauxCF(c).ttc)}</b></span></div>`; }).join('') : '<div class="gc-sous">Aucune commande.</div>'}</div>
    <div class="card"><h3 class="gc-h3">Réceptions</h3>${recs.length ? recs.map(r => `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-reception', '${r.id}')"><span><b>${esc(r.numero)}</b> · ${gcDt(r.date)}${r.annulee ? ' <span class="gc-tag">annulée</span>' : ''}<br><span class="gc-sous">${GC.liste(r.lignes).length} ligne(s)${r.reference ? ' · BL ' + esc(r.reference) : ''}</span></span><b>${gcE(GC.liste(r.lignes).reduce((s, l) => s + GC.num(l.qte) * GC.num(l.pu), 0))}</b></div>`).join('') : '<div class="gc-sous">Aucune réception.</div>'}</div>`;
}

// ============================================================
// CLIENTS (ceux de la Facturation GADH : aucun second fichier clients)
// ============================================================
function renderGcClients(main){
  const D = gcD(), liv = GC.livres(D), RT = GC.rentabilite(D, {}), parC = {};
  RT.parClient.forEach(x => { parC[x.cle] = x; });
  const lignes = Object.entries(gcClients()).filter(([, c]) => c).map(([id, c]) => Object.assign({id}, c));
  const b = gcSection(main, 'Clients', (gcPeutClients() ? `<button class="btn btn-primary" data-gc="nouveau-client" onclick="gcFormClient()">+ Client</button>${gcPeut() ? `<button class="btn btn-ghost" onclick="nav('gc-import-catalogue')">Importer</button>` : ''}` : '') + gcBoutonsExport('clients'));
  b.innerHTML = `<div class="gc-sous" style="margin:0 0 8px;">Clients communs avec la Facturation GADH (une seule liste, pas de doublon).</div>` + gcTable({id:'clients', lignes, tri:0, texte:c => [c.nom, c.mf, c.email, c.tel, c.contact].join(' '),
    colonnes:[{titre:'Client', val:c => c.nom || ''}, {titre:'Matricule fiscal', val:c => c.mf || ''}, {titre:'Contact', val:c => [c.contact, c.tel, c.email].filter(Boolean).join(' · ')},
      {titre:'Commandes en cours', num:true, tri:c => D.cmdC.filter(x => x.clientId === c.id && GC.CMDC_OUVERTE[GC.statutCmdC(x, liv).cle]).length, html:c => String(D.cmdC.filter(x => x.clientId === c.id && GC.CMDC_OUVERTE[GC.statutCmdC(x, liv).cle]).length)},
      {titre:'CA livré', num:true, tri:c => (parC[c.id] || {}).ca || 0, html:c => gcE((parC[c.id] || {}).ca)}, {titre:'Marge', num:true, tri:c => (parC[c.id] || {}).marge || 0, html:c => gcE((parC[c.id] || {}).marge)},
      {titre:'Taux de marque', num:true, tri:c => (parC[c.id] || {}).tauxMarque || 0, html:c => gcPct((parC[c.id] || {}).tauxMarque)}],
    clic:c => `gcOuvrir('gc-client', '${c.id}')`, vide:'Aucun client'});
}
window.gcFormClient = (id) => {
  if(!gcPeutClients()) return gcRefus();
  const c = id ? (gcClients()[id] || {}) : {};
  mgtModal(id ? 'Modifier le client' : 'Nouveau client', `<div class="gc-form">${mgtChamp('Nom *', 'gk-nom', c.nom)}${mgtChamp('Matricule fiscal', 'gk-mf', c.mf)}${mgtChamp('Contact', 'gk-contact', c.contact)}${mgtChamp('Téléphone', 'gk-tel', c.tel, 'tel')}${mgtChamp('E-mail', 'gk-email', c.email, 'email')}${mgtChamp('Conditions de paiement', 'gk-cond', c.conditions)}</div>
    ${mgtZone('Adresse', 'gk-adr', c.adresse)}<button class="btn btn-primary" style="width:100%;" data-gc="enregistrer-client" onclick="gcSauverClient('${id || ''}')">Enregistrer</button>`);
};
window.gcSauverClient = (id) => {
  if(!gcPeutClients()) return gcRefus();
  const nom = gcVal('gk-nom'); if(!nom){ showToast('Le nom est obligatoire'); return; }
  const email = gcVal('gk-email'); if(email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ showToast('Adresse e-mail invalide'); return; }
  const l = Object.assign({}, gcClients()), nid = id || (typeof mgtId === 'function' ? mgtId('k') : GC.nouvelId('k'));
  const dbl = Object.entries(l).find(([k, c]) => k !== nid && c && GC.norm(c.nom) === GC.norm(nom)); if(dbl){ showToast('Un client porte déjà ce nom'); return; }
  l[nid] = Object.assign({}, l[nid] || {}, {nom, mf:gcVal('gk-mf'), contact:gcVal('gk-contact'), tel:gcVal('gk-tel'), email, conditions:gcVal('gk-cond'), adresse:gcVal('gk-adr')});
  setJSON('gadh_fact_clients', l); gcCacheD = null;
  if(gcPeut()) gcJournal(id ? 'Modification' : 'Création', 'Client', {id:nid, numero:nom});
  mgtFermer(); showToast('Client enregistré');
  if(window.gcApresClient){ const g = window.gcApresClient; window.gcApresClient = null; g(nid); return; }
  gcOuvrir('gc-client', nid);
};
function renderGcClient(main){
  const id = gcOuvert['gc-client'], c = gcClients()[id]; if(!c){ nav('gc-clients'); return; }
  const D = gcD(), liv = GC.livres(D), auj = getTodayISO(), RT = GC.rentabilite(D, {clientId:id}).total;
  const cmds = D.cmdC.filter(x => x.clientId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const offres = D.offres.filter(x => x.clientId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const bls = D.livraisons.filter(x => x.clientId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const b = gcSection(main, gcRetour('gc-clients', esc(c.nom)), (gcPeutClients() ? `<button class="btn btn-primary" onclick="gcFormClient('${id}')">Modifier</button>` : '') + (gcPeut() ? `<button class="btn btn-ghost" onclick="gcNouveauDoc('offre', {clientId:'${id}'})">+ Offre</button><button class="btn btn-ghost" onclick="gcNouveauDoc('commande', {clientId:'${id}'})">+ Commande</button>` : ''));
  b.innerHTML = `<div class="card"><div class="gc-kv"><div><span>Matricule fiscal</span><b>${esc(c.mf || '—')}</b></div><div><span>Contact</span><b>${esc(c.contact || '—')}</b></div><div><span>Téléphone</span><b>${esc(c.tel || '—')}</b></div><div><span>E-mail</span><b>${esc(c.email || '—')}</b></div><div><span>Conditions</span><b>${esc(c.conditions || '—')}</b></div></div>${c.adresse ? `<div class="gc-sous" style="margin-top:8px;white-space:pre-line;">${esc(c.adresse)}</div>` : ''}</div>
    <div class="gc-chiffres"><div class="gc-chiffre"><span>CA livré</span><b>${gcE(RT.ca)}</b></div><div class="gc-chiffre"><span>Coût réel</span><b>${gcE(RT.cout)}</b></div><div class="gc-chiffre ${RT.marge < 0 ? 'bad' : 'good'}"><span>Marge brute</span><b>${gcE(RT.marge)}</b></div><div class="gc-chiffre"><span>Taux de marque</span><b>${gcPct(RT.tauxMarque)}</b></div></div>
    <div class="card"><h3 class="gc-h3">Commandes</h3>${cmds.length ? cmds.map(x => `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-commande', '${x.id}')"><span><b>${esc(x.numero || 'Brouillon')}</b> · ${gcDt(x.date)}${x.type === 'annuelle' ? ' <span class="gc-tag">annuelle</span>' : ''}${GC.retardCmdC(x, liv, auj) ? ' <span class="gc-tag" style="color:var(--bad);">en retard</span>' : ''}</span><span style="text-align:right;">${gcBadge(GC.statutCmdC(x, liv))}<br><b>${gcE(GC.totaux(x).ht)} HT</b></span></div>`).join('') : '<div class="gc-sous">Aucune commande.</div>'}</div>
    <div class="card"><h3 class="gc-h3">Offres</h3>${offres.length ? offres.map(x => `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-offre', '${x.id}')"><span><b>${esc(x.numero)}${x.version > 1 ? ' v' + x.version : ''}</b> · ${gcDt(x.date)}</span><span style="text-align:right;">${gcBadge(GC.statutOffre(x, auj))}<br><b>${gcE(GC.totaux(x).ht)} HT</b></span></div>`).join('') : '<div class="gc-sous">Aucune offre.</div>'}</div>
    <div class="card"><h3 class="gc-h3">Livraisons</h3>${bls.length ? bls.map(x => { const r = GC.coutLivraison(x); return `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-livraison', '${x.id}')"><span><b>${esc(x.numero)}</b> · ${gcDt(x.date)}${x.annulee ? ' <span class="gc-tag">annulée</span>' : ''}</span><span style="text-align:right;">${gcE(r.ca)}<br><span class="gc-sous">marge ${gcE(r.marge)}</span></span></div>`; }).join('') : '<div class="gc-sous">Aucune livraison.</div>'}</div>`;
}

// ============================================================
// STOCK
// ============================================================
function renderGcStock(main){
  const D = gcD(), S = GC.stocks(D), ed = gcPeut();
  const b = gcSection(main, 'État du stock', gcBoutonsExport('stock'));
  const arts = D.articles.filter(a => GC.suiviStock(a));
  const tot = arts.reduce((t, a) => { const s = S[a.id] || {}; t.valeur += s.valeur || 0; if(s.rupture) t.rupture++; else if(s.sousSeuil) t.seuil++; if(s.aApprovisionner > 0) t.appro++; return t; }, {valeur:0, rupture:0, seuil:0, appro:0});
  b.innerHTML = `<div class="gc-chiffres"><div class="gc-chiffre"><span>Articles suivis</span><b>${arts.filter(a => !a.archive).length}</b></div><div class="gc-chiffre"><span>Valeur du stock (coût réel)</span><b>${gcE(tot.valeur)}</b></div>
      <div class="gc-chiffre ${tot.rupture ? 'bad' : ''}"><span>En rupture</span><b>${tot.rupture}</b></div><div class="gc-chiffre ${tot.seuil ? 'warn' : ''}"><span>Sous le seuil</span><b>${tot.seuil}</b></div><div class="gc-chiffre ${tot.appro ? 'warn' : ''}"><span>À approvisionner</span><b>${tot.appro}</b></div></div>
    <div class="gc-sous" style="margin-bottom:8px;">Disponible = physique − réservé (une quantité réservée pour une commande n'est jamais disponible pour une autre). À approvisionner = demande non réservée + seuil − disponible − en attente.</div>
    ${gcTable({id:'stock', lignes:() => gcD().articles.filter(a => GC.suiviStock(a)), tri:0, texte:a => [a.ref, a.designation, a.categorie].join(' '),
      filtres:[{id:'etat', label:'État', defaut:'actifs', options:[['actifs', 'Articles actifs'], ['rupture', 'En rupture'], ['seuil', 'Sous le seuil'], ['appro', 'À approvisionner'], ['reserve', 'Avec réservations'], ['', 'Tous (y compris archivés)']],
        test:(a, v) => { const s = S[a.id] || {}; return v === 'actifs' ? !a.archive : v === 'rupture' ? s.rupture : v === 'seuil' ? s.sousSeuil : v === 'appro' ? s.aApprovisionner > 0 : s.reserve > 0; }}],
      colonnes:[{titre:'Article', val:a => gcLibArticle(a)}, {titre:'Unité', val:a => a.unite || ''},
        {titre:'Physique', num:true, tri:a => (S[a.id] || {}).physique || 0, html:a => gcQ((S[a.id] || {}).physique)}, {titre:'Réservé', num:true, tri:a => (S[a.id] || {}).reserve || 0, html:a => gcQ((S[a.id] || {}).reserve)},
        {titre:'Disponible', num:true, tri:a => (S[a.id] || {}).disponible || 0, html:a => `<b>${gcQ((S[a.id] || {}).disponible)}</b>`}, {titre:'En attente', num:true, tri:a => (S[a.id] || {}).attente || 0, html:a => gcQ((S[a.id] || {}).attente)},
        {titre:'À approvisionner', num:true, tri:a => (S[a.id] || {}).aApprovisionner || 0, html:a => (S[a.id] || {}).aApprovisionner > 0 ? `<b style="color:var(--bad);">${gcQ(S[a.id].aApprovisionner)}</b>` : '0'},
        {titre:'Seuil', num:true, tri:a => GC.num(a.seuil), html:a => gcQ(a.seuil)}, {titre:'Valeur', num:true, tri:a => (S[a.id] || {}).valeur || 0, html:a => gcE((S[a.id] || {}).valeur)},
        {titre:'État', tri:a => gcEtatStock(a, S[a.id] || {}).label, html:a => gcBadge(gcEtatStock(a, S[a.id] || {})) + (ed && !a.archive ? ` <button class="btn btn-ghost" style="padding:3px 9px;font-size:12px;" onclick="event.stopPropagation(); gcFormAjustement('${a.id}')">Ajuster</button>` : '')}],
      total:(l, c, i) => i === 0 ? 'Total' : c.titre === 'Valeur' ? gcE(l.reduce((s, a) => s + ((S[a.id] || {}).valeur || 0), 0)) : '',
      clic:a => `gcOuvrir('gc-article', '${a.id}')`, vide:'Aucun article suivi en stock'})}`;
}
window.gcFormAjustement = (articleId) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), a = D.articles.find(x => x.id === articleId), s = GC.stockArticle(D, articleId);
  mgtModal('Stock : ' + esc(gcLibArticle(a)), `<div class="gc-chiffres"><div class="gc-chiffre"><span>Physique</span><b>${gcQ(s.physique)}</b></div><div class="gc-chiffre"><span>Réservé</span><b>${gcQ(s.reserve)}</b></div><div class="gc-chiffre"><span>Disponible</span><b>${gcQ(s.disponible)}</b></div></div>
    <div class="field"><label>Opération</label><select id="gj-type" onchange="document.getElementById('gj-inv').style.display=this.value==='inventaire'?'':'none'; document.getElementById('gj-adj').style.display=this.value==='inventaire'?'none':'';">
      <option value="inventaire">Inventaire (quantité comptée)</option><option value="plus">Ajustement : entrée (+)</option><option value="moins">Ajustement : sortie (−)</option></select></div>
    <div id="gj-inv">${mgtChamp('Quantité comptée', 'gj-compte', s.physique, 'number', 'step="any" min="0"')}</div>
    <div id="gj-adj" style="display:none;">${mgtChamp('Quantité', 'gj-qte', '', 'number', 'step="any" min="0"')}${mgtChamp('Coût unitaire (entrée ; vide = dernier coût)', 'gj-cout', '', 'number', 'step="any" min="0"')}</div>
    ${mgtChamp('Motif *', 'gj-motif', '')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-ajustement" onclick="gcValiderAjustement('${articleId}')">Enregistrer</button>`);
};
window.gcValiderAjustement = (articleId) => gcOperation(() => {
  const D = gcD(), t = gcVal('gj-type'), motif = gcVal('gj-motif'), ctx = gcCtx(), a = D.articles.find(x => x.id === articleId);
  if(!motif){ showToast('Indiquez le motif'); return; }
  let mvts, info = '';
  if(t === 'inventaire'){
    const v = gcVal('gj-compte'); if(v === '' || GC.num(v) < 0){ showToast('Quantité comptée invalide'); return; }
    const r = GC.inventaire(D, articleId, GC.num(v), Object.assign(ctx, {motif:'Inventaire : ' + motif}));
    mvts = r.mouvements; info = 'Écart ' + (r.ecart > 0 ? '+' : '') + gcQ(r.ecart); if(r.alerte) setTimeout(() => showToast(r.alerte), 2500);
  } else {
    const q = GC.num(gcVal('gj-qte')); if(!(q > 0)){ showToast('Quantité invalide'); return; }
    mvts = GC.ajuster(D, articleId, t === 'plus' ? q : -q, Object.assign(ctx, {motif, coutUnit:gcVal('gj-cout')})); info = (t === 'plus' ? '+' : '−') + gcQ(q);
  }
  if(!mvts.length){ mgtFermer(); showToast('Aucun écart : rien à enregistrer'); return; }
  gcEnregistrer('mouvements', mvts); gcJournal(t === 'inventaire' ? 'Inventaire' : 'Ajustement de stock', 'Article', a, info + ' · ' + motif);
  mgtFermer(); showToast('Stock mis à jour'); nav(activeTab);
});
function renderGcLots(main){
  const D = gcD(), ed = gcPeut(), A = GC.parId(D.articles), R = GC.parId(D.receptions);
  const b = gcSection(main, 'Lots (FIFO)', gcBoutonsExport('lots'));
  b.innerHTML = `<div class="gc-sous" style="margin-bottom:8px;">Chaque entrée en stock crée un lot. Les sorties prennent toujours les lots les plus anciens (FIFO). Coût réel = prix d'achat + frais de la réception répartis.</div>` + gcTable({id:'lots', lignes:() => GC.lots(gcD()), tri:2, sens:-1,
    texte:l => [l.code, gcLibArticle(A[l.articleId]), (R[l.receptionId] || {}).numero, gcNomFour(l.fournisseurId)].join(' '),
    filtres:[{id:'reste', label:'Reste', defaut:'oui', options:[['oui', 'Lots en stock'], ['', 'Tous les lots']], test:l => l.reste > 0}],
    colonnes:[{titre:'Lot', val:l => l.code || l.id}, {titre:'Article', val:l => gcLibArticle(A[l.articleId])}, {titre:'Entrée', val:l => l.date, html:l => gcDt(l.date) + '<br><span class="gc-sous">' + esc(GC.TYPES_MV[l.type].label) + (l.receptionId && R[l.receptionId] ? ' ' + esc(R[l.receptionId].numero) : '') + '</span>'},
      {titre:'Qté initiale', num:true, tri:l => l.qteInit, html:l => gcQ(l.qteInit)}, {titre:'Reste', num:true, tri:l => l.reste, html:l => `<b>${gcQ(l.reste)}</b>`},
      {titre:'Prix d\'achat', num:true, tri:l => l.coutUnit, html:l => gcE(l.coutUnit)}, {titre:'Frais / unité', num:true, tri:l => l.fraisUnit, html:l => gcE(l.fraisUnit) + (l.fraisEstime ? '<br><span class="gc-tag">estimés</span>' : '')},
      {titre:'Coût réel', num:true, tri:l => l.coutComplet, html:l => gcE(l.coutComplet)}, {titre:'Valeur restante', num:true, tri:l => l.reste * l.coutComplet, html:l => gcE(l.reste * l.coutComplet)},
      {titre:'', tri:false, html:l => ed && l.reste > 0 ? `<button class="btn btn-ghost" style="padding:3px 9px;font-size:12px;" onclick="event.stopPropagation(); gcFormRetourFournisseur('${l.id}')">Retour fournisseur</button>` : ''}],
    total:(l, c, i) => i === 0 ? 'Total' : c.titre === 'Valeur restante' ? gcE(l.reduce((s, x) => s + x.reste * x.coutComplet, 0)) : '',
    clic:l => `gcOuvrir('gc-article', '${l.articleId}')`, vide:'Aucun lot'});
}
window.gcFormRetourFournisseur = (lotId) => {
  if(!gcPeut()) return gcRefus();
  const l = GC.lots(gcD()).find(x => x.id === lotId); if(!l) return;
  mgtModal('Retour fournisseur', `<p style="margin-top:0;">Lot ${esc(l.code || l.id)} · ${esc(gcLibArticle(gcArticle(l.articleId)))} · reste ${gcQ(l.reste)}</p>
    ${mgtChamp('Quantité retournée *', 'gr-qte', '', 'number', 'step="any" min="0"')}${mgtChamp('Motif *', 'gr-motif', '')}
    <button class="btn btn-primary" style="width:100%;" onclick="gcValiderRetourFournisseur('${lotId}')">Enregistrer le retour</button>`);
};
window.gcValiderRetourFournisseur = (lotId) => gcOperation(() => {
  const motif = gcVal('gr-motif'); if(!motif){ showToast('Indiquez le motif'); return; }
  const D = gcD(), m = GC.retourFournisseur(D, lotId, gcVal('gr-qte'), gcCtx({motif}));
  gcEnregistrer('mouvements', m); gcJournal('Retour fournisseur', 'Lot', {id:lotId, numero:m[0].lotId}, gcQ(m[0].qte) + ' · ' + motif);
  mgtFermer(); showToast('Retour enregistré'); nav(activeTab);
});
function gcSourceMv(m, D){
  if(m.livraisonId){ const b = D.livraisons.find(x => x.id === m.livraisonId); return b ? `<a href="#" onclick="event.stopPropagation(); gcOuvrir('gc-livraison', '${b.id}'); return false;">${esc(b.numero)}</a>` : ''; }
  if(m.receptionId){ const r = D.receptions.find(x => x.id === m.receptionId); return r ? `<a href="#" onclick="event.stopPropagation(); gcOuvrir('gc-reception', '${r.id}'); return false;">${esc(r.numero)}</a>` : ''; }
  if(m.cmdId){ const c = D.cmdC.find(x => x.id === m.cmdId); return c ? `<a href="#" onclick="event.stopPropagation(); gcOuvrir('gc-commande', '${c.id}'); return false;">${esc(c.numero)}</a>` : ''; }
  return '';
}
function renderGcMouvements(main){
  const D = gcD(), A = GC.parId(D.articles);
  const b = gcSection(main, 'Mouvements de stock', gcBoutonsExport('mouvements'));
  b.innerHTML = gcTable({id:'mouvements', lignes:() => gcD().mouvements, tri:0, sens:-1, parPage:40, texte:m => [gcLibArticle(A[m.articleId]), m.motif, m.par, GC.TYPES_MV[m.type] && GC.TYPES_MV[m.type].label].join(' '),
    filtres:[{id:'type', label:'Type', options:[['', 'Tous les types']].concat(Object.entries(GC.TYPES_MV).map(([k, t]) => [k, t.label])), test:(m, v) => m.type === v},
      {id:'art', label:'Article', options:[['', 'Tous les articles']].concat(D.articles.filter(a => GC.suiviStock(a)).map(a => [a.id, gcLibArticle(a)])), test:(m, v) => m.articleId === v}],
    colonnes:[{titre:'Date', val:m => m.date, tri:m => (m.date || '') + String(m.ts || 0).padStart(15, '0'), html:m => gcDt(m.date) + '<br><span class="gc-sous">' + esc(gcHeure(m.ts).split(' ')[1] || '') + '</span>'},
      {titre:'Type', val:m => GC.TYPES_MV[m.type] ? GC.TYPES_MV[m.type].label : m.type}, {titre:'Article', val:m => gcLibArticle(A[m.articleId])},
      {titre:'Quantité', num:true, tri:m => GC.num(m.qte) * ((GC.TYPES_MV[m.type] || {}).sens || 0), html:m => { const s = (GC.TYPES_MV[m.type] || {}).sens; return `<b style="color:${s > 0 ? 'var(--good)' : s < 0 ? 'var(--bad)' : 'var(--ink-soft)'};">${s > 0 ? '+' : s < 0 ? '−' : ''}${gcQ(m.qte)}</b>`; }},
      {titre:'Source', tri:m => m.motif || '', html:m => gcSourceMv(m, D) + (m.motif ? '<br><span class="gc-sous">' + esc(m.motif) + '</span>' : '')}, {titre:'Par', val:m => m.par || ''}],
    vide:'Aucun mouvement'});
}

// ============================================================
// JOURNAL
// ============================================================
function renderGcJournal(main){
  const D = gcListe('journal');
  const b = gcSection(main, 'Journal des opérations', gcBoutonsExport('journal'));
  const objets = Array.from(new Set(D.map(j => j.objet).filter(Boolean))).sort(), users = Array.from(new Set(D.map(j => j.par).filter(Boolean))).sort();
  b.innerHTML = `<div class="gc-sous" style="margin-bottom:8px;">Toutes les opérations sensibles : qui, quand, quoi. Le journal ne peut pas être modifié depuis l'application.</div>` + gcTable({id:'journal', lignes:() => gcListe('journal'), tri:0, sens:-1, parPage:50,
    texte:j => [j.action, j.objet, j.numero, j.details, j.par].join(' '),
    filtres:[{id:'objet', label:'Objet', options:[['', 'Tous les objets']].concat(objets.map(o => [o, o])), test:(j, v) => j.objet === v}, {id:'par', label:'Utilisateur', options:[['', 'Tous les utilisateurs']].concat(users.map(u => [u, u])), test:(j, v) => j.par === v}],
    colonnes:[{titre:'Date et heure', tri:j => j.ts || 0, html:j => esc(gcHeure(j.ts))}, {titre:'Utilisateur', val:j => j.par || ''}, {titre:'Action', val:j => j.action || ''}, {titre:'Objet', val:j => j.objet || ''}, {titre:'N° / nom', val:j => j.numero || ''}, {titre:'Détails', val:j => j.details || ''}],
    vide:'Journal vide'});
}

// ============================================================
// RÉGLAGES, CONTRÔLES, SAUVEGARDES ET MIGRATION
// ============================================================
const GC_ANCIENNES = {four:'gadh_achat_fournisseurs', art:'gadh_achat_articles', bons:'gadh_achat_bons', mv:'gadh_achat_mouvements', cpt:'gadh_achat_compteurs', reg:'gadh_achat_reglages',
  devis:'gadh_vente_devis', cmd:'gadh_vente_commandes', bl:'gadh_vente_livraisons', vcpt:'gadh_vente_compteurs'};
function gcAnciennes(){ const o = {}; Object.keys(GC_ANCIENNES).forEach(k => { o[k] = getJSON(GC_ANCIENNES[k], {}) || {}; }); return o; }
function gcNbObjets(o){ return o && typeof o === 'object' ? Object.keys(o).filter(k => o[k]).length : 0; }
function renderGcReglages(main){
  const R = gcReglages(), ed = gcPeut(), anc = gcAnciennes(), sauv = gcListe('sauvegardes').sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const nbAnc = ['four', 'art', 'bons', 'mv', 'devis', 'cmd', 'bl'].reduce((s, k) => s + gcNbObjets(anc[k]), 0);
  const b = gcSection(main, 'Réglages et migration', '');
  const dis = ed ? '' : 'disabled';
  b.innerHTML = `
    <div class="card"><h3 class="gc-h3">Réglages</h3><div class="gc-form">
      ${mgtChamp('TVA par défaut (%)', 'gr-tva', R.tva, 'number', 'step="any" min="0" ' + dis)}${mgtChamp('Validité des offres (jours)', 'gr-val', R.validiteOffre, 'number', 'min="1" ' + dis)}
      ${mgtChamp('Délai fournisseur par défaut (jours)', 'gr-delai', R.delaiDefaut, 'number', 'min="0" ' + dis)}${mgtChamp('Horizon « livraisons prévues » (jours)', 'gr-hor', R.horizon, 'number', 'min="1" ' + dis)}
      <div class="field"><label>Répartition des frais de réception par défaut</label><select id="gr-frais" ${dis}>${gcOpts(Object.entries(GC.METHODES_FRAIS), R.methodeFrais)}</select></div>
      ${mgtChamp('Conditions de paiement par défaut', 'gr-paie', R.conditionsPaiement, 'text', dis)}</div>
      <div class="field"><label>Conditions commerciales par défaut des offres</label><textarea id="gr-cond" rows="3" ${dis}>${esc(R.conditionsOffre || '')}</textarea></div>
      <div class="gc-form">${mgtChamp('Catégories (séparées par des virgules)', 'gr-cats', R.categories.join(', '), 'text', dis)}${mgtChamp('Unités (séparées par des virgules)', 'gr-unites', R.unites.join(', '), 'text', dis)}</div>
      ${ed ? `<button class="btn btn-primary" data-gc="enregistrer-reglages" onclick="gcSauverReglages()">Enregistrer les réglages</button>` : ''}
      <div class="gc-sous" style="margin-top:8px;">Coordonnées de la société sur les documents : celles des paramètres de la Facturation GADH.</div></div>
    <div class="card"><h3 class="gc-h3">Contrôle de cohérence</h3><div class="gc-sous">Vérifie les liens entre articles, fournisseurs, clients, commandes, réceptions, livraisons, lots et mouvements, et les numéros en double.</div>
      <button class="btn btn-ghost" style="margin-top:8px;" data-gc="controle" onclick="gcControle()">Lancer le contrôle</button><div id="gc-controle"></div></div>
    <div class="card"><h3 class="gc-h3">Sauvegarde</h3><div class="gc-sous">Télécharge toutes les données de la gestion des commandes (et des anciens modules) dans un fichier JSON.</div>
      <button class="btn btn-ghost" style="margin-top:8px;" onclick="gcTelechargerSauvegarde()">Télécharger une sauvegarde</button></div>
    <div class="card"><h3 class="gc-h3">Migration des anciens modules « Achats et stock » et « Ventes »</h3>
      <div class="gc-sous">Anciennes données trouvées : ${gcNbObjets(anc.four)} fournisseur(s), ${gcNbObjets(anc.art)} article(s), ${gcNbObjets(anc.bons)} bon(s) d'achat, ${gcNbObjets(anc.mv)} mouvement(s), ${gcNbObjets(anc.devis)} devis, ${gcNbObjets(anc.cmd)} commande(s), ${gcNbObjets(anc.bl)} livraison(s).</div>
      <div class="gc-sous" style="margin-top:6px;">La migration : 1) enregistre une sauvegarde complète ; 2) reprend les fiches sans doublon (rapprochement par nom et référence) ; 3) reprend le stock en « stock initial » au dernier prix d'achat ; 4) vérifie les liens. Les anciennes données ne sont jamais modifiées ni supprimées. Une migration peut être annulée tant que ses fiches n'ont pas servi à de nouvelles opérations.</div>
      ${ed ? `<button class="btn btn-primary" style="margin-top:8px;" ${nbAnc ? '' : 'disabled'} data-gc="migrer" onclick="gcMigrer()">Sauvegarder puis migrer</button>` : ''}
      ${sauv.length ? `<div style="margin-top:12px;">${sauv.map(s => `<div class="session-row"><span><b>${s.type === 'migration' ? 'Migration' : 'Sauvegarde'}</b> du ${esc(gcHeure(s.ts))} · ${esc(s.par || '')}${s.annulee ? ' <span class="gc-tag">annulée le ' + gcDt(s.annulee.date) + '</span>' : ''}<br><span class="gc-sous">${esc((s.rapport || []).join(' · '))}</span></span>
        <span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;"><button class="btn btn-ghost" style="padding:4px 10px;" onclick="gcTelechargerSauvegarde('${s.id}')">Fichier</button>${ed && s.type === 'migration' && !s.annulee ? `<button class="btn btn-ghost" style="padding:4px 10px;color:var(--bad);" onclick="gcAnnulerMigration('${s.id}')">Annuler</button>` : ''}</span></div>`).join('')}</div>` : ''}</div>`;
}
window.gcSauverReglages = () => gcOperation(() => {
  const liste = (v) => v.split(',').map(x => x.trim()).filter(Boolean);
  const r = Object.assign({}, getJSON(GCK.reglages, {}) || {}, {tva:gcNum(gcVal('gr-tva')), validiteOffre:Math.max(1, gcNum(gcVal('gr-val'))), delaiDefaut:Math.max(0, gcNum(gcVal('gr-delai'))), horizon:Math.max(1, gcNum(gcVal('gr-hor'))),
    methodeFrais:gcVal('gr-frais'), conditionsPaiement:gcVal('gr-paie'), conditionsOffre:document.getElementById('gr-cond').value, categories:liste(gcVal('gr-cats')), unites:liste(gcVal('gr-unites'))});
  if(r.tva < 0 || r.tva > 100){ showToast('TVA invalide'); return; }
  setJSON(GCK.reglages, r); gcCacheD = null; gcJournal('Modification', 'Réglages', {id:'reglages', numero:'Réglages'}); showToast('Réglages enregistrés'); nav('gc-reglages');
});
window.gcControle = () => {
  const pb = GC.verifierReferences(gcD()), z = document.getElementById('gc-controle');
  if(z) z.innerHTML = pb.length ? `<div class="gc-alerte bad" style="margin-top:8px;"><b>${pb.length} anomalie(s)</b><br>${pb.slice(0, 50).map(esc).join('<br>')}</div>` : '<div class="gc-alerte good" style="margin-top:8px;">Aucune anomalie : toutes les références sont cohérentes.</div>';
};
function gcInstantane(){
  const o = {date:new Date().toISOString(), application:'GTM GROUPE · GADH · Gestion des commandes', nouvelles:{}, anciennes:{}};
  Object.keys(GCK).forEach(k => { if(k !== 'sauvegardes') o.nouvelles[GCK[k]] = getJSON(GCK[k], null); });
  Object.keys(GC_ANCIENNES).forEach(k => { o.anciennes[GC_ANCIENNES[k]] = getJSON(GC_ANCIENNES[k], null); });
  return o;
}
function gcTelecharger(nom, texte, type){
  // Même méthode que l'enregistrement des PDF (lien hors de la page, clic simulé au tour suivant).
  const blob = new Blob([texte], {type:type || 'application/octet-stream'}), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nom; a.rel = 'noopener';
  setTimeout(() => { a.dispatchEvent(new MouseEvent('click')); setTimeout(() => URL.revokeObjectURL(a.href), 40000); }, 0);
}
window.gcTelechargerSauvegarde = (id) => {
  const s = id ? gcListe('sauvegardes').find(x => x.id === id) : null;
  const contenu = s ? s.contenu : gcInstantane();
  gcTelecharger('gadh-gestion-commandes-' + (s ? 'migration-' + (s.date || '') : 'sauvegarde-' + getTodayISO()) + '.json', JSON.stringify(contenu, null, 1));
};
window.gcMigrer = () => {
  if(!gcPeut()) return gcRefus();
  gcConfirmer('Migrer les anciennes données', 'Une sauvegarde complète sera enregistrée (et téléchargée), puis les fiches des anciens modules seront reprises sans doublon. Les anciennes données restent intactes.', () => gcOperation(() => {
    const ctx = gcCtx(), contenu = gcInstantane(), D = gcD();
    const M = GC.migrerAnciens(D, gcAnciennes(), ctx);
    const total = Object.values(M.ajouts).reduce((s, l) => s + l.length, 0);
    const sv = {id:GC.nouvelId('sv'), type:'migration', migrationId:M.migrationId, date:ctx.date, ts:ctx.ts, par:ctx.par, rapport:M.rapport.slice(0, 40), contenu};
    gcEnregistrer('sauvegardes', sv);
    try { gcTelecharger('gadh-sauvegarde-avant-migration-' + ctx.date + '.json', JSON.stringify(contenu, null, 1)); } catch(e) {}
    if(!total){ gcJournal('Migration', 'Anciens modules', {id:sv.id, numero:'Migration'}, 'Rien de nouveau à reprendre'); showToast('Rien de nouveau à reprendre (déjà migré)'); nav('gc-reglages'); return; }
    Object.keys(M.ajouts).forEach(k => { if(M.ajouts[k].length) gcEnregistrer(k, M.ajouts[k]); });
    const pb = GC.verifierReferences(gcD());
    gcJournal('Migration', 'Anciens modules', {id:sv.id, numero:'Migration'}, M.rapport[0] + (pb.length ? ' · ' + pb.length + ' anomalie(s) à vérifier' : ' · références vérifiées'));
    showToast('Migration terminée : ' + M.rapport[0]); nav('gc-reglages'); setTimeout(gcControle, 300);
  }));
};
// Retour arrière : retire les fiches créées par une migration, si aucune n'a servi depuis.
window.gcAnnulerMigration = (svId) => {
  const s = gcListe('sauvegardes').find(x => x.id === svId); if(!s || s.annulee) return;
  const D = gcD(), mid = s.migrationId, ids = new Set(), cles = ['fournisseurs', 'articles', 'offres', 'cmdC', 'cmdF', 'receptions', 'livraisons', 'mouvements'];
  cles.forEach(k => D[k].forEach(x => { if(x.migre && x.migre.migrationId === mid) ids.add(x.id); }));
  const utilise = [];
  const refs = (x) => [x.articleId, x.fournisseurId, x.cmdId, x.cfId, x.lotId, x.offreId].concat(GC.liste(x.lignes).map(l => l.articleId));
  cles.concat(['tarifs', 'demandes']).forEach(k => D[k].forEach(x => { if(ids.has(x.id)) return; if(refs(x).some(r => r && ids.has(r))) utilise.push((x.numero || x.designation || x.id)); }));
  if(utilise.length){ showToast('Annulation impossible : ' + utilise.length + ' nouvelle(s) fiche(s) utilisent des données migrées (' + utilise.slice(0, 3).join(', ') + '…)'); return; }
  gcConfirmer('Annuler la migration', ids.size + ' fiche(s) créées par cette migration seront retirées. Les anciennes données n\'ont jamais été modifiées. Cette opération est inscrite au journal.', () => gcOperation(() => {
    cles.forEach(k => { const l = gcListe(k), n = l.filter(x => !ids.has(x.id)); if(n.length !== l.length){ setJSON(GCK[k], n); } });
    gcCacheD = null;
    gcEnregistrer('sauvegardes', Object.assign({}, s, {annulee:{date:getTodayISO(), ts:Date.now(), par:gcPar()}}));
    gcJournal('Annulation de migration', 'Anciens modules', {id:s.id, numero:'Migration du ' + gcDt(s.date)}, ids.size + ' fiche(s) retirée(s)');
    showToast('Migration annulée'); nav('gc-reglages');
  }), {danger:true, bouton:'Annuler la migration'});
};
