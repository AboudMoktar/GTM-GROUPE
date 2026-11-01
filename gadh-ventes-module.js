// ============================================================
// GADH TUNISIA — VENTES (devis, commandes clients, livraisons, factures)
// ============================================================
// Circuit complet : devis → commande client → bon de livraison (sortie de
// stock des matières et accessoires) → facture → encaissements.
//  - Les articles sont ceux du module Achats et stock (avec leur prix de vente) ;
//    on peut aussi vendre une ligne libre (produit ou prestation sans stock).
//  - Les clients sont ceux de la Facturation GADH (gadh_fact_clients).
//  - La facture est créée dans le module Facturation (même numérotation FA,
//    mêmes encaissements, avoirs, relances) : aucune seconde série de factures.
// Données (dossier gadh/) : gadh_vente_devis, gadh_vente_commandes,
// gadh_vente_livraisons, gadh_vente_compteurs ; stock : gadh_achat_mouvements.
// Droits : roles-config.js (ressource gadh.ventes, et gadh.facturation pour les factures).

const VEN = {devis:'gadh_vente_devis', cmd:'gadh_vente_commandes', bl:'gadh_vente_livraisons', cpt:'gadh_vente_compteurs'};
const VEN_TYPES = {devis:{titre:'Devis', prefixe:'DV', onglet:'ven-devis'}, cmd:{titre:'Commande client', prefixe:'CC', onglet:'ven-commandes'}, bl:{titre:'Bon de livraison', prefixe:'BL', onglet:'ven-livraisons'}};
const VEN_DEVIS_STATUTS = {brouillon:{label:'Brouillon', cls:''}, envoye:{label:'Envoyé', cls:'warn'}, accepte:{label:'Accepté', cls:'good'}, refuse:{label:'Refusé', cls:''}};
let venOuvert = {devis:null, cmd:null, bl:null}, venEdition = null, venClientOuvert = null;

function venGet(k){ return getJSON(VEN[k], {}) || {}; }
function venSet(k, v){ setJSON(VEN[k], v); }
function venClients(){ return getJSON('gadh_fact_clients', {}) || {}; }
function venNomClient(id){ const c = venClients()[id]; return c ? c.nom : '—'; }
function venPeutModifier(){
  if(!currentUser) return false;
  const R = window.GTM_ROLES, p = currentUser.profil;
  if(R && p && R.ROLES[p]) return R.autorise(p, 'gadh', VEN.bl, 'm');
  return currentUser.role === 'admin';
}
function venPeutFacturer(){
  const R = window.GTM_ROLES, p = currentUser && currentUser.profil;
  if(R && p && R.ROLES[p]) return R.autorise(p, 'gadh', 'gadh_factures', 'm');
  return !!currentUser && currentUser.role === 'admin';
}
function venTotaux(d){
  let ht = 0;
  achListe(d.lignes).forEach(l => { ht += achNombre(l.qte) * achNombre(l.pu) * (1 - achNombre(l.remise) / 100); });
  const tva = ht * achNombre(d.tva) / 100;
  return {ht, tva, ttc: ht + tva};
}
function venNumero(type){
  const an = getTodayISO().slice(0, 4), c = venGet('cpt'), p = VEN_TYPES[type].prefixe, t = c[p] || {};
  t[an] = (t[an] || 0) + 1; c[p] = t; venSet('cpt', c);
  return p + '-' + an + '-' + String(t[an]).padStart(3, '0');
}
function venLivraison(cmd){
  const l = achListe(cmd.lignes); if(!l.length) return 'aucune';
  const liv = l.reduce((s, x) => s + achNombre(x.livre), 0), tot = l.reduce((s, x) => s + achNombre(x.qte), 0);
  return liv <= 0 ? 'aucune' : (liv + 1e-9 >= tot ? 'totale' : 'partielle');
}
function venStatutCmd(c){
  if(c.statut === 'annulee') return {label:'Annulée', cls:''};
  const l = venLivraison(c);
  return l === 'totale' ? {label:'Livrée', cls:'good'} : l === 'partielle' ? {label:'Livrée en partie', cls:'warn'} : {label:'À livrer', cls:'warn'};
}
// Facture liée à un bon de livraison (module Facturation).
function venFacture(bl){
  if(!bl || !bl.factureId || typeof factListe !== 'function') return null;
  const toutes = factListe('gadh'), f = toutes[bl.factureId];
  if(!f) return null;
  const st = factStatut(f, toutes), t = factTotaux(f, toutes);
  return {f, st, t, def: FACT_STATUTS[st] || {label:st, cls:''}};
}
function venStatutBl(bl){
  if(bl.statut === 'annule') return {label:'Annulé', cls:''};
  const fa = venFacture(bl);
  if(!fa) return {label:'À facturer', cls:'warn'};
  return fa.st === 'brouillon' ? {label:'Facture en brouillon', cls:'warn'} : fa.def;
}
// Factures de vente (créées depuis une livraison) : montants à encaisser.
function venFacturesVente(){
  if(typeof factListe !== 'function') return [];
  const toutes = factListe('gadh');
  return Object.entries(toutes).filter(([, f]) => f && f.statut === 'emise' && f.type !== 'avoir' && f.origine && f.origine.type === 'vente').map(([id, f]) => [id, f, factTotaux(f, toutes), factStatut(f, toutes)]);
}

// --- Navigation ---
function venNavItems(){
  return [
    {tab:'ven-accueil', label:'Accueil', icon:ICONS.dashboard, show:true},
    {tab:'ven-devis', label:'Devis', icon:ICONS.target, show:true},
    {tab:'ven-commandes', label:'Commandes', court:'Cmd', icon:ICONS.invoice, show:true},
    {tab:'ven-livraisons', label:'Livraisons', court:'Livr.', icon:ICONS.plane, show:true},
    {tab:'ven-clients', label:'Clients', icon:ICONS.team, show:true}
  ];
}
function renderVentes(tab, main){
  const titres = {'ven-accueil':'Ventes', 'ven-devis':'Devis', 'ven-commandes':'Commandes clients', 'ven-livraisons':'Bons de livraison', 'ven-clients':'Clients'};
  const c = gadhSectionContainer(main, titres[tab] || 'Ventes');
  const type = {'ven-devis':'devis', 'ven-commandes':'cmd', 'ven-livraisons':'bl'}[tab];
  if(type){
    if(venEdition && venEdition.type === type) return renderVenForm(c);
    if(venOuvert[type]) return renderVenDoc(c, type);
    return renderVenListe(c, type);
  }
  if(tab === 'ven-clients') return renderVenClients(c);
  renderVenAccueil(c);
}

// --- Accueil ---
function renderVenAccueil(c){
  const ed = venPeutModifier(), mois = getTodayISO().slice(0, 7);
  const fv = venFacturesVente();
  const caMois = fv.filter(([, f]) => (f.date || '').slice(0, 7) === mois).reduce((s, x) => s + x[2].ht, 0);
  const aEncaisser = fv.filter(x => x[2].reste > 0.0005).sort((a, b) => (a[1].echeance || '').localeCompare(b[1].echeance || ''));
  const reste = aEncaisser.reduce((s, x) => s + x[2].reste, 0);
  const aLivrer = Object.entries(venGet('cmd')).filter(([, x]) => x && x.statut !== 'annulee' && venLivraison(x) !== 'totale');
  const aFacturer = Object.entries(venGet('bl')).filter(([, b]) => b && b.statut !== 'annule' && !venFacture(b));
  const devisAttente = Object.entries(venGet('devis')).filter(([, d]) => d && d.statut === 'envoye');
  const ligne = (onclick, titre, sous, droite, rouge) => `<div class="session-row" style="cursor:pointer;" onclick="${onclick}"><div style="min-width:0;"><b style="font-size:13px;">${titre}</b><div style="font-size:12px;color:${rouge ? 'var(--bad)' : 'var(--ink-soft)'};">${sous}</div></div><b style="font-size:13px;white-space:nowrap;">${droite}</b></div>`;
  c.innerHTML = `
    ${ed ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"><button class="btn btn-primary" onclick="venNouveau('devis')">+ Devis</button><button class="btn btn-primary" onclick="venNouveau('cmd')">+ Commande client</button><button class="btn btn-ghost" onclick="venNouveau('bl')">+ Livraison directe</button></div>` : ''}
    <div class="kpi-mini-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">
      <div class="kpi-mini tint-blue"><div class="kpi-mini-val" style="font-size:18px;">${achDT(caMois)}</div><div class="kpi-mini-lbl">Ventes facturées du mois (HT)</div></div>
      <div class="kpi-mini ${reste > 0.0005 ? 'tint-red' : ''}"><div class="kpi-mini-val" style="font-size:18px;">${achDT(reste)}</div><div class="kpi-mini-lbl">Reste à encaisser</div></div>
      <div class="kpi-mini"><div class="kpi-mini-val">${aLivrer.length}</div><div class="kpi-mini-lbl">Commandes à livrer</div></div>
      <div class="kpi-mini ${aFacturer.length ? 'tint-gold' : ''}"><div class="kpi-mini-val">${aFacturer.length}</div><div class="kpi-mini-lbl">Livraisons à facturer</div></div>
    </div>
    <div class="pg-grille2">
      <div class="card"><h3 style="margin-top:0;">À encaisser</h3>${aEncaisser.length ? aEncaisser.slice(0, 8).map(([id, f, t, st]) => ligne(venPeutFacturer() ? `venOuvrirFacture('${id}')` : '', esc(f.numero) + ' · ' + esc((f.client && f.client.nom) || venNomClient(f.clientId)), f.echeance ? 'Échéance ' + achDate(f.echeance) + (st === 'retard' ? ' · en retard' : '') : '', achDT(t.reste), st === 'retard')).join('') : buildEmptyState('Rien à encaisser')}</div>
      <div class="card"><h3 style="margin-top:0;">À facturer</h3>${aFacturer.length ? aFacturer.map(([id, b]) => ligne(`venOuvrir('bl', '${id}')`, esc(b.numero) + ' · ' + esc(venNomClient(b.clientId)), 'Livré le ' + achDate(b.date), achDT(venTotaux(b).ttc))).join('') : buildEmptyState('Tout est facturé')}</div>
      <div class="card"><h3 style="margin-top:0;">Commandes à livrer</h3>${aLivrer.length ? aLivrer.map(([id, x]) => ligne(`venOuvrir('cmd', '${id}')`, esc(x.numero) + ' · ' + esc(venNomClient(x.clientId)), venStatutCmd(x).label + (x.livraisonPrevue ? ' · prévue le ' + achDate(x.livraisonPrevue) : ''), achDT(venTotaux(x).ttc), x.livraisonPrevue && x.livraisonPrevue < getTodayISO())).join('') : buildEmptyState('Aucune commande en attente')}</div>
      <div class="card"><h3 style="margin-top:0;">Devis en attente de réponse</h3>${devisAttente.length ? devisAttente.map(([id, d]) => ligne(`venOuvrir('devis', '${id}')`, esc(d.numero) + ' · ' + esc(venNomClient(d.clientId)), d.validite ? 'Valable jusqu\'au ' + achDate(d.validite) : 'Envoyé le ' + achDate(d.date), achDT(venTotaux(d).ttc), d.validite && d.validite < getTodayISO())).join('') : buildEmptyState('Aucun devis en attente')}</div>
    </div>`;
}

// --- Listes ---
function renderVenListe(c, type){
  const ed = venPeutModifier(), T = VEN_TYPES[type];
  const l = Object.entries(venGet(type)).filter(([, d]) => d).sort((a, b) => (b[1].date || '').localeCompare(a[1].date || '') || (b[1].numero || '').localeCompare(a[1].numero || ''));
  const statut = (d) => type === 'devis' ? (VEN_DEVIS_STATUTS[d.statut] || VEN_DEVIS_STATUTS.brouillon) : type === 'cmd' ? venStatutCmd(d) : venStatutBl(d);
  c.innerHTML = `${ed ? `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary" onclick="venNouveau('${type}')">+ ${type === 'bl' ? 'Livraison directe' : 'Nouveau ' + T.titre.toLowerCase()}</button></div>` : ''}
    <div class="card" style="padding:4px 14px;">${l.length ? l.map(([id, d]) => `<div class="session-row" style="cursor:pointer;flex-wrap:wrap;gap:6px;" onclick="venOuvrir('${type}', '${id}')">
      <div style="min-width:0;flex:1 1 240px;"><b style="font-size:13.5px;">${esc(d.numero || 'Brouillon')}</b> <span style="font-size:12.5px;color:var(--ink-soft);">${achDate(d.date)} · ${esc(venNomClient(d.clientId))}</span>
        <div style="font-size:12px;color:var(--ink-soft);">${achListe(d.lignes).length} ligne(s)</div></div>
      <div style="text-align:right;"><b style="font-size:13.5px;">${achDT(venTotaux(d).ttc)}</b><div>${achBadge(statut(d))}</div></div></div>`).join('') : buildEmptyState('Aucun ' + T.titre.toLowerCase())}</div>`;
}
window.venOuvrir = (type, id) => { venOuvert[type] = id; venEdition = null; nav(VEN_TYPES[type].onglet); };
window.venFermer = (type) => { venOuvert[type] = null; venEdition = null; nav(VEN_TYPES[type].onglet); };

// --- Détail d'un document ---
function renderVenDoc(c, type){
  const d = venGet(type)[venOuvert[type]], id = venOuvert[type];
  if(!d){ venOuvert[type] = null; return renderVenListe(c, type); }
  const ed = venPeutModifier(), T = VEN_TYPES[type], t = venTotaux(d), cl = venClients()[d.clientId] || {};
  const lignes = achListe(d.lignes), btn = (lib, action, prim, rouge) => `<button class="btn ${prim ? 'btn-primary' : 'btn-ghost'}" style="padding:7px 12px;font-size:13px;${rouge ? 'color:var(--bad);' : ''}" onclick="${action}">${lib}</button>`;
  let statut, actions = '', infos = '', extra = '';
  if(type === 'devis'){
    statut = VEN_DEVIS_STATUTS[d.statut] || VEN_DEVIS_STATUTS.brouillon;
    infos = d.validite ? 'Valable jusqu\'au ' + achDate(d.validite) : '';
    if(ed && d.statut !== 'accepte') actions += btn('Modifier', `venModifier('devis', '${id}')`);
    if(ed && d.statut === 'brouillon') actions += btn('Marquer envoyé', `venStatutDevis('${id}', 'envoye')`, true);
    if(ed && (d.statut === 'envoye' || d.statut === 'brouillon')) actions += btn('Accepté → commande', `venDevisEnCommande('${id}')`, true) + btn('Refusé', `venStatutDevis('${id}', 'refuse')`);
    if(d.commandeId) extra = `<div class="card"><div class="session-row" style="cursor:pointer;" onclick="venOuvrir('cmd', '${d.commandeId}')"><span>Commande créée depuis ce devis</span><b>${esc((venGet('cmd')[d.commandeId] || {}).numero || '')} ›</b></div></div>`;
  } else if(type === 'cmd'){
    statut = venStatutCmd(d);
    infos = d.livraisonPrevue ? 'Livraison prévue le ' + achDate(d.livraisonPrevue) : '';
    if(ed && d.statut !== 'annulee' && venLivraison(d) === 'aucune') actions += btn('Modifier', `venModifier('cmd', '${id}')`);
    if(ed && d.statut !== 'annulee' && venLivraison(d) !== 'totale') actions += btn('Livrer', `venFormLivrer('${id}')`, true);
    const bls = Object.entries(venGet('bl')).filter(([, b]) => b && b.commandeId === id);
    extra = `<div class="card"><h3 style="margin-top:0;">Livraisons</h3>${bls.length ? bls.map(([bid, b]) => `<div class="session-row" style="cursor:pointer;" onclick="venOuvrir('bl', '${bid}')"><span><b style="font-size:13px;">${esc(b.numero)}</b> <span style="font-size:12px;color:var(--ink-soft);">${achDate(b.date)}</span></span>${achBadge(venStatutBl(b))}</div>`).join('') : buildEmptyState('Pas encore livrée')}</div>`
      + (d.devisId ? `<div class="card"><div class="session-row" style="cursor:pointer;" onclick="venOuvrir('devis', '${d.devisId}')"><span>Devis d'origine</span><b>${esc((venGet('devis')[d.devisId] || {}).numero || '')} ›</b></div></div>` : '');
    if(ed && d.statut !== 'annulee' && venLivraison(d) === 'aucune') extra += `<div style="display:flex;justify-content:flex-end;">${btn('Annuler la commande', `venAnnulerCmd('${id}')`, false, true)}</div>`;
  } else {
    statut = venStatutBl(d);
    const fa = venFacture(d);
    if(ed && d.statut !== 'annule' && !fa && venPeutFacturer()) actions += btn('Facturer', `venFacturer('${id}')`, true);
    if(fa && venPeutFacturer()) actions += btn('Ouvrir la facture', `venOuvrirFacture('${d.factureId}')`, true);
    extra = `${fa ? `<div class="card"><h3 style="margin-top:0;">Facture</h3><div class="session-row"><span><b style="font-size:13px;">${esc(fa.f.numero || 'Brouillon')}</b> ${achBadge(fa.def)}</span><span style="font-size:13px;">${achDT(fa.t.ttc)}${fa.t.reste > 0.0005 && fa.st !== 'brouillon' ? ' · reste ' + achDT(fa.t.reste) : ''}</span></div></div>` : ''}
      ${d.commandeId ? `<div class="card"><div class="session-row" style="cursor:pointer;" onclick="venOuvrir('cmd', '${d.commandeId}')"><span>Commande client</span><b>${esc((venGet('cmd')[d.commandeId] || {}).numero || '')} ›</b></div></div>` : ''}
      ${ed && d.statut !== 'annule' && !fa ? `<div style="display:flex;justify-content:flex-end;">${btn('Annuler la livraison (remet en stock)', `venAnnulerBl('${id}')`, false, true)}</div>` : ''}`;
  }
  c.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      ${btn('← ' + (type === 'bl' ? 'Livraisons' : type === 'cmd' ? 'Commandes' : 'Devis'), `venFermer('${type}')`)}<span style="flex:1;"></span>${btn('Imprimer', `venImprimer('${type}', '${id}')`)}${actions}
    </div>
    <div class="card">
      <div class="flex-header" style="margin-bottom:6px;"><h3 style="margin:0;">${esc(T.titre)} ${esc(d.numero || '(brouillon)')}</h3>${achBadge(statut)}</div>
      <div style="font-size:13px;color:var(--ink-soft);line-height:1.6;">Client : <b style="color:var(--ink);">${esc(cl.nom || '—')}</b>${cl.tel ? ' · ' + esc(cl.tel) : ''}<br>Date : ${achDate(d.date)}${infos ? ' · ' + infos : ''}${d.refClient ? '<br>Référence client : ' + esc(d.refClient) : ''}${d.note ? '<br>' + esc(d.note) : ''}</div>
      <div style="overflow-x:auto;margin-top:12px;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px;">
        <thead><tr style="text-align:left;"><th style="padding:6px;">Désignation</th><th style="padding:6px;text-align:right;">Qté</th>${type === 'cmd' ? '<th style="padding:6px;text-align:right;">Livré</th>' : ''}<th style="padding:6px;text-align:right;">P.U. HT</th><th style="padding:6px;text-align:right;">Remise</th><th style="padding:6px;text-align:right;">Total HT</th></tr></thead>
        <tbody>${lignes.map(l => `<tr style="border-top:1px solid var(--border);"><td style="padding:6px;">${esc(l.designation)}</td><td style="padding:6px;text-align:right;">${achQte(l.qte)} ${esc(l.unite || '')}</td>${type === 'cmd' ? `<td style="padding:6px;text-align:right;color:${achNombre(l.livre) + 1e-9 >= achNombre(l.qte) ? 'var(--good)' : 'var(--ink-soft)'};">${achQte(l.livre || 0)}</td>` : ''}
          <td style="padding:6px;text-align:right;">${achDT(l.pu)}</td><td style="padding:6px;text-align:right;">${achNombre(l.remise) ? achNombre(l.remise) + ' %' : ''}</td><td style="padding:6px;text-align:right;">${achDT(achNombre(l.qte) * achNombre(l.pu) * (1 - achNombre(l.remise) / 100))}</td></tr>`).join('')}</tbody></table></div>
      <div style="margin:12px 0 0 auto;max-width:340px;font-size:13.5px;">
        <div style="display:flex;justify-content:space-between;padding:3px 0;"><span>Total HT</span><span>${achDT(t.ht)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0;"><span>TVA ${achNombre(d.tva)} %</span><span>${achDT(t.tva)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0 3px;font-weight:700;border-top:1px solid var(--border);margin-top:4px;"><span>Total TTC</span><span>${achDT(t.ttc)}</span></div>
        ${type === 'bl' ? '' : '<div style="font-size:12px;color:var(--ink-soft);text-align:right;">Timbre fiscal ajouté sur la facture</div>'}
      </div>
    </div>${extra}`;
}

// --- Édition (devis, commande, livraison directe) ---
window.venNouveau = (type) => {
  if(!venPeutModifier()) return;
  const P = typeof factParams === 'function' ? factParams('gadh') : {tva:19};
  venEdition = {type, d:{date:getTodayISO(), clientId:'', lignes:[{articleId:'', designation:'', qte:1, pu:0, remise:0, unite:''}], tva:achNombre(P.tva === undefined ? 19 : P.tva), note:'', validite:type === 'devis' ? mgtAddDays(getTodayISO(), 30) : '', livraisonPrevue:'', refClient:''}};
  venOuvert[type] = null; nav(VEN_TYPES[type].onglet);
};
window.venModifier = (type, id) => { const d = venGet(type)[id]; if(!d) return; venEdition = {type, id, d:JSON.parse(JSON.stringify(d))}; venEdition.d.lignes = achListe(venEdition.d.lignes); nav(VEN_TYPES[type].onglet); };
function venOptionsArticles(val){
  const arts = Object.entries(achGet('art')).filter(([, a]) => a && a.actif !== false).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '')), st = achStock();
  return `<option value="">— Ligne libre (produit, prestation) —</option>` + Object.keys(ACH_CATEGORIES).map(cat => {
    const l = arts.filter(([, a]) => a.categorie === cat);
    return l.length ? `<optgroup label="${ACH_CATEGORIES[cat]}">${l.map(([id, a]) => `<option value="${id}" ${id === val ? 'selected' : ''}>${esc(a.nom)}${achSuiviStock(a) ? ' — stock ' + achQte(st[id] || 0) : ''}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function renderVenForm(c){
  const e = venEdition, d = e.d, T = VEN_TYPES[e.type];
  const cls = Object.entries(venClients()).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || ''));
  const champ = 'style="width:100%;padding:8px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:13.5px;"';
  c.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">${e.id ? 'Modifier ' + esc(d.numero || 'le brouillon') : (e.type === 'bl' ? 'Livraison directe (sans commande)' : 'Nouveau ' + T.titre.toLowerCase())}</h3>
      <div class="pg-grille2">
        <div class="field"><label>Client *</label><div style="display:flex;gap:6px;"><select id="vf-client" ${champ}><option value="">— Choisir —</option>${cls.map(([id, x]) => `<option value="${id}" ${id === d.clientId ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select>
          <button class="btn btn-ghost" style="padding:0 12px;" title="Nouveau client" onclick="venFormClient(null, true)">+</button></div></div>
        <div class="field"><label>Date</label><input id="vf-date" type="date" value="${esc(d.date || '')}" ${champ}></div>
        ${e.type === 'devis' ? `<div class="field"><label>Valable jusqu'au</label><input id="vf-validite" type="date" value="${esc(d.validite || '')}" ${champ}></div>` : ''}
        ${e.type === 'cmd' ? `<div class="field"><label>Livraison prévue le</label><input id="vf-prevue" type="date" value="${esc(d.livraisonPrevue || '')}" ${champ}></div>` : ''}
        <div class="field"><label>Référence client (bon de commande…)</label><input id="vf-ref" value="${esc(d.refClient || '')}" ${champ}></div>
      </div>
    </div>
    <div class="card">
      <div class="flex-header" style="margin-bottom:8px;"><h3 style="margin:0;">Lignes</h3><button class="btn btn-primary" style="padding:6px 10px;font-size:12.5px;" onclick="venAjouterLigne()">+ Ligne</button></div>
      <div id="vf-lignes">${d.lignes.map((l, i) => `<div class="vf-ligne" data-i="${i}" style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(140px,2fr) 80px 110px 70px 32px;gap:6px;align-items:end;padding:8px 0;border-bottom:1px solid var(--border);">
          <div><label style="font-size:12px;color:var(--ink-soft);">Article</label><select class="vf-art" ${champ} onchange="venChoixArticle(${i}, this.value)">${venOptionsArticles(l.articleId)}</select></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">Désignation</label><input class="vf-des" value="${esc(l.designation || '')}" ${champ}></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">Qté</label><input class="vf-qte" inputmode="decimal" value="${esc(String(l.qte))}" ${champ} oninput="venRecalc()"></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">P.U. HT (€)</label><input class="vf-pu" inputmode="decimal" value="${esc(String(l.pu))}" ${champ} oninput="venRecalc()"></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">Remise %</label><input class="vf-rem" inputmode="decimal" value="${esc(String(l.remise || 0))}" ${champ} oninput="venRecalc()"></div>
          <button class="icon-btn" title="Retirer" onclick="venRetirerLigne(${i})" style="height:38px;">✕</button>
        </div>`).join('')}</div>
      <div class="pg-grille2" style="margin-top:12px;">
        <div class="field"><label>TVA</label><select id="vf-tva" ${champ} onchange="venRecalc()">${ACH_TVA.map(x => `<option value="${x}" ${achNombre(d.tva) === x ? 'selected' : ''}>${x} %</option>`).join('')}</select></div>
        <div class="field"><label>Note</label><input id="vf-note" value="${esc(d.note || '')}" ${champ}></div>
      </div>
      <div id="vf-totaux" style="text-align:right;font-size:14px;line-height:1.7;"></div>
      ${e.type === 'bl' ? '<p style="font-size:12px;color:var(--ink-soft);margin:8px 0 0;">À l\'enregistrement, les matières et accessoires livrés sortent du stock.</p>' : ''}
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
      <button class="btn btn-ghost" onclick="venAnnulerEdition()">Annuler</button>
      <button class="btn btn-primary" onclick="venEnregistrer()">${e.type === 'bl' ? 'Enregistrer la livraison' : 'Enregistrer'}</button>
    </div>
    <style>@media (max-width:760px){.vf-ligne{grid-template-columns:1fr 1fr !important;}.vf-ligne > div:nth-child(1), .vf-ligne > div:nth-child(2){grid-column:1 / -1;}}</style>`;
  venRecalc();
}
function venLireForm(){
  const d = venEdition.d;
  d.clientId = mgtVal('vf-client'); d.date = mgtVal('vf-date') || getTodayISO(); d.refClient = mgtVal('vf-ref'); d.note = mgtVal('vf-note'); d.tva = achNombre(mgtVal('vf-tva'));
  if(document.getElementById('vf-validite')) d.validite = mgtVal('vf-validite');
  if(document.getElementById('vf-prevue')) d.livraisonPrevue = mgtVal('vf-prevue');
  d.lignes = Array.from(document.querySelectorAll('.vf-ligne')).map((el, i) => {
    const anc = d.lignes[i] || {}, articleId = el.querySelector('.vf-art').value, a = achGet('art')[articleId];
    return {articleId, designation: el.querySelector('.vf-des').value.trim() || (a ? a.nom : ''), qte: achNombre(el.querySelector('.vf-qte').value), pu: achNombre(el.querySelector('.vf-pu').value),
      remise: achNombre(el.querySelector('.vf-rem').value), unite: a ? (a.unite || '') : (anc.unite || ''), livre: achNombre(anc.livre)};
  });
  return d;
}
window.venRecalc = () => { const t = venTotaux(venLireForm()), z = document.getElementById('vf-totaux'); if(z) z.innerHTML = `Total HT <b>${achDT(t.ht)}</b> · TVA <b>${achDT(t.tva)}</b><br>Total TTC <b style="font-size:16px;">${achDT(t.ttc)}</b>`; };
window.venAjouterLigne = () => { venLireForm(); venEdition.d.lignes.push({articleId:'', designation:'', qte:1, pu:0, remise:0, unite:''}); nav(VEN_TYPES[venEdition.type].onglet); };
window.venRetirerLigne = (i) => { venLireForm(); venEdition.d.lignes.splice(i, 1); if(!venEdition.d.lignes.length) venEdition.d.lignes.push({articleId:'', designation:'', qte:1, pu:0, remise:0, unite:''}); nav(VEN_TYPES[venEdition.type].onglet); };
window.venChoixArticle = (i, id) => {
  venLireForm(); const a = achGet('art')[id], l = venEdition.d.lignes[i];
  if(a){ l.articleId = id; l.designation = a.nom; l.unite = a.unite || ''; if(achNombre(a.prixVente) > 0) l.pu = achNombre(a.prixVente); }
  nav(VEN_TYPES[venEdition.type].onglet);
};
window.venAnnulerEdition = () => { const e = venEdition; venEdition = null; if(e && e.id) venOuvert[e.type] = e.id; nav(VEN_TYPES[e ? e.type : 'devis'].onglet); };
// Sortie de stock des lignes livrées (matières et accessoires uniquement). Renvoie false si l'utilisateur renonce.
function venSortieStock(lignes, blId, numero, date){
  const arts = achGet('art'), st = achStock(), manque = [];
  lignes.forEach(l => { const a = arts[l.articleId]; if(achSuiviStock(a) && achNombre(l.qte) > (st[l.articleId] || 0) + 1e-9) manque.push(a.nom + ' (stock ' + achQte(st[l.articleId] || 0) + ')'); });
  if(manque.length && !confirm('Stock insuffisant pour : ' + manque.join(', ') + '.\nEnregistrer la livraison quand même ?')) return false;
  const mv = achGet('mv');
  lignes.forEach(l => { const a = arts[l.articleId]; if(achSuiviStock(a) && achNombre(l.qte) > 0) mv[mgtId('mv')] = {date, articleId:l.articleId, type:'sortie', qte:achNombre(l.qte), blId, motif:'Livraison ' + numero, par:currentUser.nom || currentUser.username, t:Date.now()}; });
  achSet('mv', mv);
  return true;
}
window.venEnregistrer = () => {
  if(!venPeutModifier()) return;
  const e = venEdition, d = venLireForm();
  if(!d.clientId){ showToast('Choisissez le client'); return; }
  d.lignes = d.lignes.filter(l => l.designation && l.qte > 0);
  if(!d.lignes.length){ showToast('Ajoutez au moins une ligne avec une désignation et une quantité'); return; }
  const docs = venGet(e.type), id = e.id || mgtId(e.type);
  if(e.type === 'bl' && !e.id){
    d.numero = venNumero('bl'); d.statut = 'livre';
    if(!venSortieStock(d.lignes, id, d.numero, d.date)){ return; }
  }
  if(e.type === 'cmd' && !d.numero){ d.numero = venNumero('cmd'); d.statut = 'encours'; }
  if(e.type === 'devis' && !d.numero){ d.numero = venNumero('devis'); d.statut = d.statut || 'brouillon'; }
  d.maj = Date.now(); d.par = currentUser.nom || currentUser.username;
  docs[id] = d; venSet(e.type, docs);
  venEdition = null; venOuvert[e.type] = id; showToast(VEN_TYPES[e.type].titre + ' ' + d.numero + ' enregistré'); nav(VEN_TYPES[e.type].onglet);
};

// --- Actions ---
window.venStatutDevis = (id, statut) => { const l = venGet('devis'); if(!l[id] || !venPeutModifier()) return; l[id].statut = statut; venSet('devis', l); nav('ven-devis'); };
window.venDevisEnCommande = (id) => {
  if(!venPeutModifier()) return;
  const dv = venGet('devis'), d = dv[id]; if(!d) return;
  const cmds = venGet('cmd'), cid = mgtId('cmd');
  cmds[cid] = {numero:venNumero('cmd'), statut:'encours', date:getTodayISO(), clientId:d.clientId, refClient:d.refClient || '', devisId:id, tva:d.tva, note:d.note || '',
    lignes:achListe(d.lignes).map(l => Object.assign({}, l, {livre:0})), maj:Date.now(), par:currentUser.nom || currentUser.username};
  venSet('cmd', cmds);
  d.statut = 'accepte'; d.commandeId = cid; venSet('devis', dv);
  showToast('Commande ' + cmds[cid].numero + ' créée'); venOuvrir('cmd', cid);
};
window.venAnnulerCmd = (id) => { if(!confirm('Annuler cette commande ?')) return; const l = venGet('cmd'); if(!l[id]) return; l[id].statut = 'annulee'; venSet('cmd', l); nav('ven-commandes'); };
window.venFormLivrer = (id) => {
  const d = venGet('cmd')[id]; if(!d) return; const st = achStock(), arts = achGet('art');
  mgtModal('Livrer ' + esc(d.numero), `${mgtChamp('Date de livraison', 'vl-date', getTodayISO(), 'date')}
    ${achListe(d.lignes).map((l, i) => { const reste = Math.max(0, achNombre(l.qte) - achNombre(l.livre)), a = arts[l.articleId];
      return `<div class="field"><label>${esc(l.designation)} — reste ${achQte(reste)} ${esc(l.unite || '')}${achSuiviStock(a) ? ' · stock ' + achQte(st[l.articleId] || 0) : ''}</label><input id="vl-q${i}" inputmode="decimal" value="${reste ? String(Math.round(reste * 1000) / 1000) : 0}"></div>`; }).join('')}
    <button class="btn btn-primary" style="width:100%;" onclick="venValiderLivraison('${id}')">Créer le bon de livraison</button>`);
};
window.venValiderLivraison = (id) => {
  if(!venPeutModifier()) return;
  const cmds = venGet('cmd'), d = cmds[id]; if(!d) return;
  d.lignes = achListe(d.lignes);
  const date = mgtVal('vl-date') || getTodayISO();
  const lignes = d.lignes.map((l, i) => ({articleId:l.articleId, designation:l.designation, unite:l.unite || '', pu:achNombre(l.pu), remise:achNombre(l.remise), qte:achNombre(mgtVal('vl-q' + i)), _i:i})).filter(l => l.qte > 0);
  if(!lignes.length){ showToast('Aucune quantité saisie'); return; }
  const bls = venGet('bl'), bid = mgtId('bl'), numero = venNumero('bl');
  if(!venSortieStock(lignes, bid, numero, date)) return;
  lignes.forEach(l => { d.lignes[l._i].livre = achNombre(d.lignes[l._i].livre) + l.qte; delete l._i; });
  bls[bid] = {numero, statut:'livre', date, clientId:d.clientId, commandeId:id, refClient:d.refClient || '', tva:d.tva, lignes, maj:Date.now(), par:currentUser.nom || currentUser.username};
  venSet('bl', bls); venSet('cmd', cmds);
  mgtFermer(); showToast('Bon de livraison ' + numero + ' créé'); venOuvrir('bl', bid);
};
window.venAnnulerBl = (id) => {
  if(!venPeutModifier()) return;
  const bls = venGet('bl'), b = bls[id]; if(!b || venFacture(b)) return;
  if(!confirm('Annuler la livraison ' + b.numero + ' ? Les quantités reviennent en stock et sur la commande.')) return;
  const arts = achGet('art'), mv = achGet('mv');
  achListe(b.lignes).forEach(l => { if(achSuiviStock(arts[l.articleId]) && achNombre(l.qte) > 0) mv[mgtId('mv')] = {date:getTodayISO(), articleId:l.articleId, type:'entree', qte:achNombre(l.qte), blId:id, motif:'Annulation ' + b.numero, par:currentUser.nom || currentUser.username, t:Date.now()}; });
  achSet('mv', mv);
  if(b.commandeId){ const cmds = venGet('cmd'), c = cmds[b.commandeId]; if(c){ c.lignes = achListe(c.lignes); achListe(b.lignes).forEach(l => { const x = c.lignes.find(y => y.designation === l.designation && (y.articleId || '') === (l.articleId || '')); if(x) x.livre = Math.max(0, achNombre(x.livre) - achNombre(l.qte)); }); venSet('cmd', cmds); } }
  b.statut = 'annule'; b.annuleLe = Date.now(); venSet('bl', bls); showToast('Livraison annulée'); nav('ven-livraisons');
};
// Facture : brouillon créé dans le module Facturation, à vérifier puis émettre (numéro FA attribué à l'émission).
window.venFacturer = (id) => {
  if(!venPeutModifier() || !venPeutFacturer() || typeof factCreer !== 'function') return;
  const bls = venGet('bl'), b = bls[id]; if(!b || venFacture(b)) return;
  const fid = factCreer('gadh', {clientId:b.clientId, objet:'Livraison ' + b.numero + (b.refClient ? ' · réf. client ' + b.refClient : ''), tva:achNombre(b.tva),
    lignes:achListe(b.lignes).map(l => ({designation:l.designation + (l.unite ? ' (' + l.unite + ')' : ''), qte:achNombre(l.qte), pu:achNombre(l.pu), remise:achNombre(l.remise)})),
    origine:{type:'vente', id, numero:b.numero}});
  b.factureId = fid; venSet('bl', bls);
  showToast('Facture préparée : vérifiez-la puis émettez-la');
  venOuvrirFacture(fid);
};
window.venOuvrirFacture = (fid) => {
  if(!fid || !venPeutFacturer()) return;
  activeModule = 'factures'; renderShell();
  setTimeout(() => { if(typeof factOuvrir === 'function') factOuvrir(fid); }, 0);
};

// --- Impression (devis, commande, bon de livraison) ---
window.venImprimer = (type, id) => {
  const d = venGet(type)[id]; if(!d) return;
  const cl = venClients()[d.clientId] || {}, t = venTotaux(d), avecPrix = type !== 'bl';
  let P = {raison:SOCIETES.gadh.nom, adresse:'', mf:'', tel:''};
  try { if(typeof factParams === 'function') P = Object.assign(P, factParams('gadh')); } catch(e) {}
  const n = (x) => (Number(x) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const titre = {devis:'DEVIS', cmd:'CONFIRMATION DE COMMANDE', bl:'BON DE LIVRAISON'}[type];
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(d.numero || titre)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:13px;} h1{font-size:20px;margin:0 0 4px;} .ent{display:flex;justify-content:space-between;gap:20px;margin-bottom:22px;}
    .boite{border:1px solid #999;border-radius:6px;padding:10px 12px;min-width:240px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left;} th{background:#eee;} .n{text-align:right;white-space:nowrap;}
    .tot{width:auto;margin-left:auto;margin-top:14px;} .tot td{border:none;padding:3px 10px;} .sig{margin-top:50px;display:flex;justify-content:space-between;} @media print{body{margin:12mm;}}</style></head><body>
    <div class="ent"><div><h1>${esc(P.raison || SOCIETES.gadh.nom)}</h1><div>${esc(P.adresse || '')}</div><div>${P.mf ? 'MF ' + esc(P.mf) : ''}${P.tel ? ' · ' + esc(P.tel) : ''}</div></div>
      <div class="boite"><b>${titre} ${esc(d.numero || '')}</b><br>Date : ${achDate(d.date)}${d.validite && type === 'devis' ? '<br>Valable jusqu\'au ' + achDate(d.validite) : ''}${d.refClient ? '<br>Réf. client : ' + esc(d.refClient) : ''}</div></div>
    <div class="boite" style="max-width:360px;"><b>Client</b><br>${esc(cl.nom || '')}<br>${esc(cl.adresse || '')}${cl.mf ? '<br>MF ' + esc(cl.mf) : ''}</div>
    <table><thead><tr><th>Désignation</th><th class="n">Qté</th>${avecPrix ? '<th class="n">P.U. HT</th><th class="n">Remise</th><th class="n">Total HT</th>' : ''}</tr></thead><tbody>
      ${achListe(d.lignes).map(l => `<tr><td>${esc(l.designation)}</td><td class="n">${achQte(l.qte)} ${esc(l.unite || '')}</td>${avecPrix ? `<td class="n">${n(l.pu)}</td><td class="n">${achNombre(l.remise) ? achNombre(l.remise) + ' %' : ''}</td><td class="n">${n(achNombre(l.qte) * achNombre(l.pu) * (1 - achNombre(l.remise) / 100))}</td>` : ''}</tr>`).join('')}</tbody></table>
    ${avecPrix ? `<table class="tot"><tr><td>Total HT</td><td class="n">${n(t.ht)} €</td></tr><tr><td>TVA ${achNombre(d.tva)} %</td><td class="n">${n(t.tva)} €</td></tr><tr><td><b>Total TTC</b></td><td class="n"><b>${n(t.ttc)} €</b></td></tr></table>` : ''}
    ${d.note ? `<p style="margin-top:16px;">${esc(d.note)}</p>` : ''}<div class="sig"><div>${type === 'bl' ? 'Reçu par le client (nom, date, signature)' : 'Bon pour accord du client'}</div><div>Pour ${esc(P.raison || SOCIETES.gadh.nom)}</div></div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour imprimer'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

// --- Clients ---
function renderVenClients(c){
  const ed = venPeutModifier(), fv = venFacturesVente(), cls = venClients();
  if(venClientOuvert && cls[venClientOuvert]){
    const id = venClientOuvert, cl = cls[id];
    const docs = (k) => Object.entries(venGet(k)).filter(([, d]) => d && d.clientId === id).sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''));
    const f = fv.filter(x => x[1].clientId === id), ca = f.reduce((s, x) => s + x[2].ht, 0), reste = f.reduce((s, x) => s + x[2].reste, 0);
    const liste = (k, lib) => { const l = docs(k); return `<div class="card"><h3 style="margin-top:0;">${lib}</h3>${l.length ? l.slice(0, 15).map(([did, d]) => `<div class="session-row" style="cursor:pointer;" onclick="venClientOuvert=null; venOuvrir('${k}', '${did}')"><span><b style="font-size:13px;">${esc(d.numero || 'Brouillon')}</b> <span style="font-size:12px;color:var(--ink-soft);">${achDate(d.date)}</span></span><b style="font-size:13px;">${achDT(venTotaux(d).ttc)}</b></div>`).join('') : buildEmptyState('Aucun')}</div>`; };
    c.innerHTML = `<div class="card" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost" style="padding:7px 12px;font-size:13px;" onclick="venClientOuvert=null; nav('ven-clients')">← Clients</button><span style="flex:1;"></span>${ed ? `<button class="btn btn-ghost" style="padding:7px 12px;font-size:13px;" onclick="venFormClient('${id}')">Modifier</button>` : ''}</div>
      <div class="card"><h3 style="margin-top:0;">${esc(cl.nom)}</h3><div style="font-size:13px;color:var(--ink-soft);line-height:1.7;">${[cl.tel && 'Tél. : ' + esc(cl.tel), cl.email && esc(cl.email), cl.adresse && esc(cl.adresse), cl.mf && 'MF : ' + esc(cl.mf)].filter(Boolean).join('<br>') || '—'}</div></div>
      <div class="kpi-mini-grid" style="grid-template-columns:repeat(2,1fr);"><div class="kpi-mini tint-blue"><div class="kpi-mini-val" style="font-size:18px;">${achDT(ca)}</div><div class="kpi-mini-lbl">Ventes facturées (HT)</div></div><div class="kpi-mini ${reste > 0.0005 ? 'tint-red' : ''}"><div class="kpi-mini-val" style="font-size:18px;">${achDT(reste)}</div><div class="kpi-mini-lbl">Reste à encaisser</div></div></div>
      <div class="pg-grille2">${liste('devis', 'Devis')}${liste('cmd', 'Commandes')}${liste('bl', 'Livraisons')}</div>`;
    return;
  }
  venClientOuvert = null;
  const l = Object.entries(cls).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || ''));
  c.innerHTML = `${ed ? `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary" onclick="venFormClient()">+ Nouveau client</button></div>` : ''}
    <div class="card" style="padding:4px 14px;">${l.length ? l.map(([id, x]) => { const r = fv.filter(f => f[1].clientId === id).reduce((s, f) => s + f[2].reste, 0); return `<div class="session-row" style="cursor:pointer;" onclick="venClientOuvert='${id}'; nav('ven-clients')">
      <div><b style="font-size:13px;">${esc(x.nom)}</b><div style="font-size:12px;color:var(--ink-soft);">${esc([x.tel, x.adresse].filter(Boolean).join(' · '))}</div></div>${r > 0.0005 ? `<span style="font-size:12.5px;color:var(--bad);white-space:nowrap;">à encaisser ${achDT(r)}</span>` : ''}</div>`; }).join('') : buildEmptyState('Aucun client', ed ? 'Créez le premier avec « + Nouveau client ».' : '')}</div>
    <p style="font-size:12px;color:var(--ink-faint);">Mêmes clients que dans la Facturation GADH.</p>`;
}
window.venFormClient = (id, depuisForm) => {
  if(!venPeutModifier()) return;
  if(depuisForm && venEdition) venLireForm();
  const x = id ? (venClients()[id] || {}) : {};
  mgtModal(id ? 'Modifier le client' : 'Nouveau client', `${mgtChamp('Nom / raison sociale *', 'vc-nom', x.nom || '')}${mgtChamp('Téléphone', 'vc-tel', x.tel || '', 'tel')}${mgtChamp('E-mail', 'vc-email', x.email || '', 'email')}
    ${mgtChamp('Adresse', 'vc-adresse', x.adresse || '')}${mgtChamp('Matricule fiscal', 'vc-mf', x.mf || '')}
    <button class="btn btn-primary" style="width:100%;" onclick="venSauverClient('${id || ''}', ${depuisForm ? 'true' : 'false'})">${id ? 'Enregistrer' : 'Créer le client'}</button>`);
};
window.venSauverClient = (id, depuisForm) => {
  if(!venPeutModifier()) return;
  const nom = mgtVal('vc-nom'); if(!nom){ showToast('Nom requis'); return; }
  const l = venClients(), k = id || mgtId('k');
  l[k] = Object.assign({}, l[k] || {}, {nom, tel:mgtVal('vc-tel'), email:mgtVal('vc-email'), adresse:mgtVal('vc-adresse'), mf:mgtVal('vc-mf')});
  setJSON('gadh_fact_clients', l); mgtFermer(); showToast(id ? 'Client enregistré' : 'Client créé');
  if(depuisForm && venEdition){ if(!id) venEdition.d.clientId = k; nav(VEN_TYPES[venEdition.type].onglet); } else nav('ven-clients');
};
