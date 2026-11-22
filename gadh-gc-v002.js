// ============================================================
// CRM GADH — V 0.0.2 : navigation simplifiée (6 espaces, aucun doublon), écrans réunis,
// tableau de bord « bandeau » avec 6 actions. Chargé en dernier.
//   Accueil · Clients (Commandes et livraisons, Factures, Offres, Fiches clients)
//   Fournisseurs (Commandes et arrivages, Prix d'achat, Fiches fournisseurs)
//   Stock (Stock prévisionnel, Stock actuel, Historique) · Catalogue · Analyse (Rentabilité, Journal)
//   Paramètres (en bas du menu)
// Les anciens écrans restent joignables depuis leur espace (liens), sans entrée de menu en double.
// ============================================================
const GCV_VERSION = '0.0.2';
const GCV_IC = {
  home:'<path d="M3 11 12 3l9 8v10H3z"/><path d="M9 21v-7h6v7"/>', users:'<circle cx="9" cy="8" r="4"/><path d="M1 21v-1a7 7 0 0 1 14 0v1M17 11a4 4 0 0 0 0-8M23 21v-1a6 6 0 0 0-4-5.6"/>',
  factory:'<path d="M2 20h20M4 20V10l5 3V10l5 3V6l6 3v11"/>', box:'<path d="M21 16V8l-9-5-9 5v8l9 5z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>', chart:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>', truck:'<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  euro:'<path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10"/>', in:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M1 2h4l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 6H6"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  alert:'<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>', doc:'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>', cal:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
};
GCV_IC.sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
GCV_IC.moon = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
function gcvSombre(){ return document.documentElement.getAttribute('data-theme') === 'dark'; }
function gcvIc(k){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + GCV_IC[k] + '</svg>'; }

// ---------- Espaces et onglets ----------
Object.keys(GC_GROUPES).forEach(k => delete GC_GROUPES[k]);
Object.assign(GC_GROUPES, {
  clients:{nav:'gc-commandes', onglets:[['gc-commandes', 'Commandes et livraisons'], ['gc-factures', 'Factures'], ['gc-offres', 'Offres'], ['gc-clients', 'Fiches clients']]},
  fournisseurs:{nav:'gc-achats', onglets:[['gc-achats', 'Commandes et arrivages'], ['gc-prix-achat', 'Prix d\'achat'], ['gc-fournisseurs', 'Fiches fournisseurs']]},
  stock:{nav:'gc-previsionnel', onglets:[['gc-previsionnel', 'Stock prévisionnel'], ['gc-stock', 'Stock actuel'], ['gc-mouvements', 'Historique']]},
  catalogue:{nav:'gc-catalogue', onglets:[['gc-catalogue', 'Articles et prix']]},
  analyse:{nav:'gc-rentabilite', onglets:[['gc-rentabilite', 'Rentabilité'], ['gc-journal', 'Journal']]},
  parametres:{nav:'gc-reglages', onglets:[['gc-reglages', 'Paramètres']]}
});
// écrans rattachés à un onglet (pas d'entrée de menu à eux)
Object.assign(GC_FICHES, {'gc-planning':'gc-commandes', 'gc-livraisons':'gc-commandes', 'gc-livraison':'gc-commandes', 'gc-commande':'gc-commandes', 'gc-edition':null,
  'gc-prix-reels':'gc-factures', 'gc-demandes':'gc-offres', 'gc-demande':'gc-offres', 'gc-import':'gc-offres', 'gc-offre':'gc-offres', 'gc-client':'gc-clients',
  'gc-arrivages':'gc-achats', 'gc-receptions':'gc-achats', 'gc-reception':'gc-achats', 'gc-achat':'gc-achats', 'gc-accords':'gc-prix-achat', 'gc-tarifs':'gc-prix-achat', 'gc-fournisseur':'gc-fournisseurs',
  'gc-besoins':'gc-previsionnel', 'gc-lots':'gc-stock', 'gc-article':'gc-catalogue', 'gc-import-catalogue':'gc-catalogue'});
gcNavParent = function(tab){ if(!tab || tab === 'gc-accueil') return 'gc-accueil'; const g = gcGroupeDe(tab); return g ? g.nav : tab; };

// pastilles : ce qu'il y a à faire dans chaque espace
function gcvCompteurs(){
  const D = gcD(), auj = getTodayISO(), P = gcsfLignesPlanning(D).filter(x => x.reste > 0), F = gcsfFactures().filter(f => factStatut(f) !== 'payee');
  const aLivrer = P.filter(x => x.statut === 'retard' || x.statut === 'declaree' || (x.dateLivraison && x.dateLivraison <= GC.ajouterJours(auj, 14)));
  const A = gcfrLignesArrivages(D).filter(x => x.reste > 0), aRec = A.filter(x => x.statut === 'a_receptionner' || x.statut === 'retard'), aConf = A.filter(x => x.statut === 'commandee');
  const rupt = gcfrArticlesSuivis(D).map(id => gcfrPrevisionnel(D, id)).filter(p => p.rupture);
  return {aLivrer, F, echues:F.filter(gcsfEchue), aRec, aConf, rupt, P, A};
}
gcNavItems = function(){
  let C = null; try { C = gcvCompteurs(); } catch(e) {}
  const n = (v) => v ? v : '';
  return [
    {tab:'gc-accueil', label:'Accueil', court:'Accueil', icon:gcvIc('home'), show:true},
    {tab:'gc-commandes', label:'Clients', court:'Clients', icon:gcvIc('users'), show:true, badge:C ? n(C.aLivrer.length + C.echues.length) : ''},
    {tab:'gc-achats', label:'Fournisseurs', court:'Fournisseurs', icon:gcvIc('factory'), show:true, badge:C ? n(C.aRec.length + C.aConf.length) : ''},
    {tab:'gc-previsionnel', label:'Stock', court:'Stock', icon:gcvIc('box'), show:true, badge:C ? n(C.rupt.length) : ''},
    {tab:'gc-catalogue', label:'Catalogue', court:'Catalogue', icon:gcvIc('tag'), show:true, bas:false},
    {tab:'gc-rentabilite', label:'Analyse', court:'Analyse', icon:gcvIc('chart'), show:true, bas:false},
    {tab:'gc-plus', label:'Plus', court:'Plus', icon:gcvIc('more'), show:true, cote:false, onclick:'gcMenuPlus()'}
  ];
};
window.gcMenuPlus = () => {
  mgtModal('CRM GADH', `<div class="gc-plus">${[['gc-catalogue', 'tag', 'Catalogue', 'Articles et listes de prix'], ['gc-rentabilite', 'chart', 'Analyse', 'Rentabilité, vérification des marges, journal'], ['gc-reglages', 'more', 'Paramètres', 'Société, sauvegarde, réglages']]
    .map(([t, k, l, s]) => `<button class="session-row gcv-plus" onclick="mgtFermer(); nav('${t}')"><span class="gcv-pt">${gcvIc(k)}</span><span style="flex:1;"><b>${l}</b><br><span class="gc-sous">${s}</span></span><b>›</b></button>`).join('')}
    <button class="session-row gcv-plus" data-gc="basculer-theme" onclick="basculerTheme(); gcMenuPlus()"><span class="gcv-pt">${gcvIc(gcvSombre() ? 'sun' : 'moon')}</span><span style="flex:1;"><b>${gcvSombre() ? 'Passer en mode clair' : 'Passer en mode sombre'}</b><br><span class="gc-sous">Mode actuel : ${gcvSombre() ? 'sombre' : 'clair'}</span></span></button></div>`);
};

// ---------- Rendu : une seule barre d'onglets, onglet actif juste ----------
const gcvRenderGC = renderGC;
renderGC = function(tab, main){
  if(tab === 'gc-planning'){ gcvVersPlanning(); tab = 'gc-commandes'; }
  if(tab === 'gc-arrivages') tab = 'gc-achats';
  const R = {'gc-prix-achat':gcvRenderPrixAchat};
  if(R[tab]){ gcStyle(); try { R[tab](main); } catch(e){ console.error('CRM', tab, e); main.innerHTML = `<div class="card"><b>Affichage impossible</b><div class="gc-sous">${esc(e && e.message || String(e))}</div></div>`; } }
  else gcvRenderGC(tab, main);
  main.querySelectorAll('.gc-onglets').forEach(e => e.remove());
  const g = gcGroupeDe(tab);
  if(g && g.onglets.length > 1){
    const cible = GC_FICHES[tab] !== undefined && GC_FICHES[tab] ? GC_FICHES[tab] : tab;
    main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets gc-onglets gcv-onglets no-print">${g.onglets.map(([t, l]) => `<button class="${t === cible ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
  }
  if(typeof dessinerMenu === 'function') dessinerMenu();
  const bp = document.querySelector('[data-gc="menu-parametres"]'); if(bp) bp.classList.toggle('actif', tab === 'gc-reglages');
};
// anciens raccourcis « planning » : filtres repris dans l'écran réuni
function gcvVersPlanning(){ const st = gcTabs.planning; if(st && st.f){ if(st.f.client !== undefined) gcvCmd.client = st.f.client || ''; if(st.f.etat !== undefined) gcvCmd.etat = st.f.etat === '' ? 'toutes' : st.f.etat === 'livrees' ? 'livrees' : 'ouvertes'; } }

// ---------- Clients › Commandes et livraisons (planning + commandes + livraisons réunis) ----------
let gcvCmd = {etat:'ouvertes', client:'', q:'', ouverts:{}};
function gcvStatutCmd(c, liv){ return GC.statutCmdC(c, liv); }
window.renderGcCommandes = function(main){
  const D = gcD(), ed = gcPeut(), liv = GC.livres(D), P = gcsfLignesPlanning(D), F = factListe() || {}, S = gcvCmd, auj = getTodayISO();
  // export « planning » : la liste des livraisons prévues
  gcTabsCfg.planning = gcTabsCfg.planning || {id:'planning', lignes:() => gcsfLignesPlanning(), filtres:[], colonnes:[]};
  gcTabs.planning = gcTabs.planning || {q:'', tri:null, sens:1, page:0, f:{}};
  const b = gcSection(main, 'Commandes et livraisons', (ed ? `<button class="btn btn-primary" data-gc="nouvelle-commande-ferme" onclick="gcsfFormCommande()">+ Commande client</button>` : '') + `<button class="btn btn-ghost" onclick="gcExporter('planning', 'xlsx')">Excel</button><button class="btn btn-ghost" onclick="gcExporter('planning', 'print')">Imprimer</button>`);
  const clients = Array.from(new Set(D.cmdC.map(c => c.clientId).filter(Boolean)));
  const q = GC.norm(S.q || '');
  const cmds = D.cmdC.filter(c => !c.archive && c.statut !== 'annulee' && (!S.client || c.clientId === S.client)).map(c => {
    const L = P.filter(x => x.cmd.id === c.id), st = gcvStatutCmd(c, liv), reste = L.reduce((s, x) => s + x.reste, 0), ouverte = st.cle !== 'livree' && st.cle !== 'cloturee';
    const bls = D.livraisons.filter(x => x.cmdId === c.id && !x.annulee), facts = bls.map(x => F[x.factureId]).filter(Boolean);
    const texte = [c.reference, c.numero, gcNomClient(c.clientId)].concat(GC.liste(c.lignes).map(l => l.ref + ' ' + (l.designation || '')), bls.map(x => x.numero), facts.map(f => f.numero)).join(' ');
    const prochaine = L.filter(x => x.reste > 0).map(x => x.dateLivraison).filter(Boolean).sort()[0] || '';
    return {c, L, st, reste, ouverte, bls, facts, texte, prochaine, retard:L.some(x => x.statut === 'retard')};
  }).filter(x => (S.etat === 'toutes' || (S.etat === 'ouvertes' ? x.ouverte : !x.ouverte)) && (!q || GC.norm(x.texte).indexOf(q) >= 0))
    .sort((a, b2) => (b2.ouverte - a.ouverte) || (a.ouverte ? (a.prochaine || '9999').localeCompare(b2.prochaine || '9999') : (b2.c.date || '').localeCompare(a.c.date || '')));
  const u = (x) => ((GC.liste(x.c.lignes)[0] || {}).unite || '');
  b.innerHTML = `<div class="gc-sous" style="margin-bottom:8px;">Une commande = ses livraisons prévues, chacune avec son bon de livraison et sa facture. « Déclaration reçue » quand le client confirme ; « Livrer et facturer » le jour de la livraison.</div>
    <div class="gct-barre no-print"><input type="search" class="gct-q" placeholder="PO, client, article, n° de BL ou de facture…" value="${gcAttr(S.q)}" oninput="gcvCmd.q = this.value; clearTimeout(window.gcvT); window.gcvT = setTimeout(() => { nav('gc-commandes'); const e = document.querySelector('.gct-q'); if(e){ e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 250)">
      <select class="gct-f" onchange="gcvCmd.etat = this.value; nav('gc-commandes')">${gcOpts([['ouvertes', 'À livrer'], ['livrees', 'Livrées'], ['toutes', 'Toutes les commandes']], S.etat)}</select>
      <select class="gct-f" onchange="gcvCmd.client = this.value; nav('gc-commandes')">${gcOpts([['', 'Tous les clients']].concat(clients.map(id => [id, gcNomClient(id)])), S.client)}</select></div>
    ${cmds.length ? cmds.map(x => gcvCartePO(x, ed, u(x))).join('') : buildEmptyState(S.etat === 'ouvertes' ? 'Aucune commande à livrer' : 'Aucune commande', 'Créez une commande client avec ses livraisons prévues.')}
    <div class="gc-sous gcv-liens no-print">Voir aussi : <a href="#" onclick="nav('gc-livraisons'); return false;">tous les bons de livraison</a> · <a href="#" onclick="gcNouveauDoc('commande'); return false;">saisie libre d'une commande</a></div>`;
};
function gcvCartePO(x, ed, u){
  const c = x.c, qT = x.L.reduce((s, y) => s + GC.num(y.l.qte), 0), qL = x.L.reduce((s, y) => s + y.livre, 0), fa = x.facts.reduce((s, f) => s + factTotaux(f).ttc, 0), pct = qT ? Math.round(qL / qT * 100) : 0;
  const ouvert = gcvCmd.ouverts[c.id] !== undefined ? gcvCmd.ouverts[c.id] : x.ouverte;
  const art = Array.from(new Set(GC.liste(c.lignes).map(l => l.ref || l.designation))).join(', '), pu = Array.from(new Set(GC.liste(c.lignes).map(l => gcE(l.pu)))).join(' / ');
  const titre = c.reference ? 'PO ' + c.reference : c.numero || 'Commande';
  const tete = `<div class="gcv-po-h" onclick="gcvCmd.ouverts['${c.id}'] = ${!ouvert}; nav('gc-commandes')"><div><b class="gcv-po-n">${esc(titre)}</b> · ${esc(gcNomClient(c.clientId))} ${gcBadge(x.retard ? {label:'En retard', cls:'bad'} : x.st)}
      <div class="gc-sous">${esc(art)}${pu ? ' · ' + pu + (u ? '/' + esc(u) : '') : ''}${c.date ? ' · commande du ' + gcDt(c.date) : ''}${x.prochaine && x.ouverte ? ' · prochaine livraison ' + gcsfLibSemaine(x.prochaine, true) + ' (' + gcDt(x.prochaine) + ')' : ''}</div></div>
    <div class="gcv-po-s">${x.L.length ? `<div>Commandé<b>${gcsfQ(qT, u)}</b></div><div>Livré<b>${gcsfQ(qL, u)}</b></div>` : `<div>Montant HT<b>${gcE(GC.totaux(c).ht)}</b></div>`}<div>Facturé<b>${gcE(fa)}</b></div>${x.L.length ? `<div class="gcv-prog"><span><i style="width:${pct}%"></i></span>${pct} % livré</div>` : ''}<b class="gcv-chev">${ouvert ? '▾' : '›'}</b></div></div>`;
  if(!ouvert) return `<div class="gcv-po ferme" data-gc="po">${tete}</div>`;
  const lignes = x.L.slice().sort((a, b) => (a.reste > 0 ? 0 : 1) - (b.reste > 0 ? 0 : 1) || (a.dateLivraison || '').localeCompare(b.dateLivraison || ''));
  return `<div class="gcv-po" data-gc="po">${tete}
    ${lignes.length ? `<div style="overflow-x:auto;"><table class="gc-lignes gcv-t"><thead><tr><th>Ligne</th><th>Livraison prévue</th><th class="n">Quantité</th><th>État</th><th>BL · Facture</th><th></th></tr></thead><tbody>
    ${lignes.map(y => `<tr class="${y.statut === 'retard' ? 'gcsf-retard' : ''}"><td data-l="Ligne">${y.n}${y.l.refClient ? '<div class="gc-sous">' + esc(y.l.refClient) + '</div>' : ''}</td>
      <td data-l="Livraison prévue"><b>${gcsfLibSemaine(y.dateLivraison)}</b>${y.dateDeclaration ? '<div class="gc-sous">déclaration ' + gcsfLibSemaine(y.dateDeclaration, true) + '</div>' : ''}</td>
      <td class="n" data-l="Quantité"><b>${gcsfQ(y.l.qte, y.l.unite)}</b>${y.livre > 0 && y.reste > 0 ? '<div class="gc-sous">reste ' + gcQ(y.reste) + '</div>' : ''}</td>
      <td data-l="État">${gcsfBadge(y)}${y.l.note ? '<div class="gc-sous gcsf-note">' + esc(y.l.note) + '</div>' : ''}</td>
      <td data-l="BL · Facture">${y.bls.map(bl => { const f = gcsfFactureDuBL(bl); return `<div><a href="#" onclick="gcOuvrir('gc-livraison', '${bl.id}'); return false;">${esc(bl.numero)}</a> · ${f ? `<a href="#" onclick="gcsfVoirFacture('${f.id}'); return false;"><b>${esc(f.numero)}</b></a> ${gcBadge(FACT_STATUTS[factStatut(f)])}` : '<span style="color:var(--bad);">sans facture</span>'}</div>`; }).join('') || '—'}</td>
      <td>${ed && y.reste > 0 ? `<div class="gcsf-act">${y.statut !== 'declaree' ? `<button class="btn btn-ghost" data-gc="declaration" onclick="gcsfDeclaration('${c.id}', '${y.l.lid}')">Déclaration reçue</button>` : ''}<button class="btn btn-primary" data-gc="livrer-facturer" onclick="gcsfFormLivrer('${c.id}', '${y.l.lid}')">Livrer et facturer</button><button class="btn btn-ghost" title="Modifier la date ou la quantité" onclick="gcsfFormLigne('${c.id}', '${y.l.lid}')">✎</button></div>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="gc-sous" style="padding:10px 18px;">${c.statut === 'brouillon' ? 'Brouillon : ouvrez la commande pour la confirmer.' : 'Commande sans livraisons planifiées.'}</div>`}
    <div class="gcv-po-pied"><a href="#" onclick="gcOuvrir('gc-commande', '${c.id}'); return false;">Ouvrir la commande ›</a></div></div>`;
}

// ---------- Fournisseurs › Commandes et arrivages ----------
let gcvCF = {etat:'ouvertes', four:'', ouverts:{}};
window.renderGcAchats = function(main){
  const D = gcD(), ed = gcPeut(), A = gcfrLignesArrivages(D), rec = GC.recus(D), S = gcvCF;
  const b = gcSection(main, 'Commandes et arrivages', (ed ? `<button class="btn btn-primary" data-gc="nouvelle-cf-client" onclick="gcfrFormCommande()">+ Commande fournisseur</button>` : '') + `<button class="btn btn-ghost" onclick="gcExporter('arrivages', 'xlsx')">Excel</button>`);
  gcTabsCfg.arrivages = gcTabsCfg.arrivages || {id:'arrivages', lignes:() => gcfrLignesArrivages(), filtres:[], colonnes:[]}; gcTabs.arrivages = gcTabs.arrivages || {q:'', tri:null, sens:1, page:0, f:{}};
  const fours = Array.from(new Set(D.cmdF.map(c => c.fournisseurId).filter(Boolean)));
  const cfs = D.cmdF.filter(c => !c.archive && c.statut !== 'annulee' && (!S.four || c.fournisseurId === S.four)).map(cf => {
    const L = A.filter(x => x.cf.id === cf.id), st = GC.statutCmdF(cf, rec), ouverte = !!GC.CMDF_OUVERTE[st.cle] || st.cle === 'brouillon';
    return {cf, L, st, ouverte, prochaine:L.filter(x => x.reste > 0).map(x => x.exp).filter(Boolean).sort()[0] || '', alerte:L.some(x => x.statut === 'retard' || x.statut === 'a_receptionner')};
  }).filter(x => S.etat === 'toutes' || (S.etat === 'ouvertes' ? x.ouverte : !x.ouverte))
    .sort((a, b2) => (b2.ouverte - a.ouverte) || (a.prochaine || '9999').localeCompare(b2.prochaine || '9999') || (b2.cf.date || '').localeCompare(a.cf.date || ''));
  b.innerHTML = `<div class="gc-sous" style="margin-bottom:8px;">Une commande fournisseur = ses expéditions prévues. « Réceptionner » fait entrer la marchandise en stock (lot daté, sorti en premier).</div>
    <div class="gct-barre no-print"><select class="gct-f" onchange="gcvCF.etat = this.value; nav('gc-achats')">${gcOpts([['ouvertes', 'En cours'], ['recues', 'Reçues ou clôturées'], ['toutes', 'Toutes les commandes']], S.etat === 'recues' ? 'recues' : S.etat)}</select>
      <select class="gct-f" onchange="gcvCF.four = this.value; nav('gc-achats')">${gcOpts([['', 'Tous les fournisseurs']].concat(fours.map(id => [id, gcNomFour(id)])), S.four)}</select></div>
    ${cfs.length ? cfs.map(x => gcvCarteCF(x, ed)).join('') : buildEmptyState('Aucune commande fournisseur', 'Créez une commande fournisseur, par exemple depuis une commande client.')}
    <div class="gc-sous gcv-liens no-print">Voir aussi : <a href="#" onclick="nav('gc-receptions'); return false;">tous les bons de réception</a> · <a href="#" onclick="nav('gc-besoins'); return false;">calcul des besoins (à commander)</a></div>`;
};
function gcvCarteCF(x, ed){
  const cf = x.cf, D = gcD(), t = gcTotauxCF(cf), u = (x.L[0] || {l:{}}).l.unite || '', qT = x.L.reduce((s, y) => s + GC.num(y.l.qte), 0), qR = x.L.reduce((s, y) => s + y.recu, 0), pct = qT ? Math.round(qR / qT * 100) : 0;
  const cc = D.cmdC.find(c => c.id === cf.cmdClientId), ouvert = gcvCF.ouverts[cf.id] !== undefined ? gcvCF.ouverts[cf.id] : x.ouverte;
  const tete = `<div class="gcv-po-h" onclick="gcvCF.ouverts['${cf.id}'] = ${!ouvert}; nav('gc-achats')"><div><b class="gcv-po-n">${esc(cf.numero || 'Brouillon')}</b> · ${esc(gcNomFour(cf.fournisseurId))} ${gcBadge(x.alerte ? {label:'Arrivée à réceptionner', cls:'bad'} : cf.confirmation && x.ouverte && pct < 100 ? {label:'Confirmée ' + (cf.confirmation.reference || ''), cls:'good'} : x.st)}
      <div class="gc-sous">${cc ? 'pour ' + esc(gcNomClient(cc.clientId)) + ' · PO ' + esc(cc.reference || cc.numero) + ' · ' : ''}${esc(Array.from(new Set(GC.liste(cf.lignes).map(l => l.ref || l.designation))).join(', '))} · ${gcDt(cf.date)}${x.prochaine && x.ouverte ? ' · prochaine expédition ' + gcDt(x.prochaine) : ''}</div></div>
    <div class="gcv-po-s"><div>Commandé<b>${gcsfQ(qT, u)}</b></div><div>Reçu<b>${gcsfQ(qR, u)}</b></div><div>Reste à payer<b>${gcE(t.reste)}</b></div><div class="gcv-prog"><span><i style="width:${pct}%"></i></span>${pct} % reçu</div><b class="gcv-chev">${ouvert ? '▾' : '›'}</b></div></div>`;
  if(!ouvert) return `<div class="gcv-po ferme" data-gc="cf">${tete}</div>`;
  return `<div class="gcv-po" data-gc="cf">${tete}<div style="overflow-x:auto;"><table class="gc-lignes gcv-t"><thead><tr><th>Expédition</th><th class="n">Quantité</th><th class="n">Prix</th><th>Arrivée estimée</th><th>État</th><th>Réception</th><th></th></tr></thead><tbody>
    ${x.L.map(y => `<tr class="${y.statut === 'retard' ? 'gcsf-retard' : ''}"><td data-l="Expédition"><b>${gcDt(y.exp)}</b><div class="gc-sous">${y.l.confirmee || cf.confirmation ? 'date confirmée' : 'au plus tard'}</div></td><td class="n" data-l="Quantité"><b>${gcsfQ(y.l.qte, y.l.unite)}</b>${y.recu > 0 && y.reste > 0 ? '<div class="gc-sous">reste ' + gcQ(y.reste) + '</div>' : ''}</td><td class="n" data-l="Prix">${gcE(y.l.pu)}</td>
      <td data-l="Arrivée">${gcsfLibSemaine(y.arr)}</td><td data-l="État">${gcfrBadge(y)}</td><td data-l="Réception">${y.brs.map(r => `<a href="#" onclick="gcOuvrir('gc-reception', '${r.id}'); return false;">${esc(r.numero)}</a> ${gcDt(r.date)}`).join('<br>') || '—'}</td>
      <td>${ed && y.reste > 0 ? `<div class="gcsf-act">${y.statut === 'commandee' ? `<button class="btn btn-ghost" onclick="gcfrFormConfirmation('${cf.id}')">Confirmation</button>` : ''}${y.statut !== 'brouillon' ? `<button class="btn btn-primary" data-gc="receptionner-exp" onclick="gcfrFormRecevoir('${cf.id}', '${y.l.lid}')">Réceptionner</button>` : ''}<button class="btn btn-ghost" title="Modifier la date ou la quantité" onclick="gcfrFormLigne('${cf.id}', '${y.l.lid}')">✎</button></div>` : ''}</td></tr>`).join('')}
    </tbody></table></div><div class="gcv-po-pied"><a href="#" onclick="gcOuvrir('gc-achat', '${cf.id}'); return false;">Ouvrir la commande fournisseur ›</a></div></div>`;
}

// ---------- Fournisseurs › Prix d'achat (accords + tarifs) ----------
function gcvRenderPrixAchat(main){
  renderGcTarifs(main);
  const h = main.querySelector('.gc-tete h2'); if(h) h.textContent = 'Prix d\'achat';
  const body = document.getElementById('gc-body'), A = gcfrAccords();
  if(body) body.insertAdjacentHTML('afterbegin', A.length ? `<h3 class="gc-h3" style="margin:0 0 8px;">Accords de prix (offres spéciales)</h3>${A.slice().sort((x, y) => (y.date || '').localeCompare(x.date || '')).map(gcfrCarteAccord).join('')}<h3 class="gc-h3" style="margin:16px 0 8px;">Tarifs des fournisseurs</h3>` : '');
}

// ---------- Stock › Stock prévisionnel : + ce qu'il faut commander ----------
const gcvPrev = window.renderGcPrevisionnel;
window.renderGcPrevisionnel = function(main){
  gcvPrev(main);
  const D = gcD(), B = GC.besoins(D, getTodayISO(), {delaiDefaut:D.reglages.delaiDefaut}).articles.filter(x => x.aCommander > 0), body = document.getElementById('gc-body');
  if(body) body.insertAdjacentHTML('beforeend', `<div class="card" data-gc="a-commander"><h3 class="gc-h3">À commander aux fournisseurs</h3>${B.length ? B.map(x => `<div class="session-row"><span><b>${esc(x.ref || '')}</b> ${esc(x.designation || '')}<br><span class="gc-sous">${gcQ(x.aCommander)} ${esc(x.unite || '')} · ${esc(gcNomFour(x.fournisseurId))}${x.dateCommande ? ' · commander avant le ' + gcDt(x.dateCommande) : ''}</span></span>${gcBadge(GC_URGENCES[x.urgence])}</div>`).join('') + `<button class="btn btn-ghost" style="margin-top:8px;" onclick="nav('gc-besoins')">Détail du calcul et commandes</button>` : '<div class="gc-sous">Rien à commander : les commandes clients sont couvertes par le stock et les arrivages prévus.</div>'}</div>`);
};
// Stock actuel : lien vers les lots
const gcvStock = renderGcStock;
renderGcStock = function(main){ gcvStock(main); const body = document.getElementById('gc-body'); if(body) body.insertAdjacentHTML('beforeend', `<div class="gc-sous gcv-liens">Voir aussi : <a href="#" onclick="nav('gc-lots'); return false;">les lots en stock (FIFO)</a></div>`); };
// Offres : lien vers les demandes de prix
const gcvOffres = window.renderGcOffres;
window.renderGcOffres = function(main){ gcvOffres(main); const body = document.getElementById('gc-body'); if(body) body.insertAdjacentHTML('beforeend', `<div class="gc-sous gcv-liens">Voir aussi : <a href="#" onclick="nav('gc-demandes'); return false;">demandes de prix (import d'une liste de besoins)</a></div>`); };
// Paramètres : société et sauvegarde réunis avec les réglages
const gcvReglages = renderGcReglages;
renderGcReglages = function(main){
  gcvReglages(main);
  const h = main.querySelector('.gc-tete h2'); if(h) h.textContent = 'Paramètres';
  const body = document.getElementById('gc-body'), P = factParams();
  if(body) body.insertAdjacentHTML('afterbegin', `<div class="card" data-gc="parametres-societe"><h3 class="gc-h3">Société, utilisateur et sauvegarde</h3><div class="gc-kv"><div><span>Société</span><b>${esc(P.raison || '—')}</b></div><div><span>Matricule fiscal</span><b>${esc(P.mf || '—')}</b></div><div><span>Utilisateur</span><b>${esc(currentUser.nom || '')}</b></div><div><span>Version</span><b>CRM GADH V ${GCV_VERSION}</b></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-primary" onclick="appParametres()">Modifier la société et l'utilisateur</button><button class="btn btn-ghost" onclick="appSauvegarder()">Télécharger une sauvegarde</button>
    <label class="btn btn-ghost" style="cursor:pointer;">Restaurer un fichier<input type="file" accept=".json,application/json" style="display:none;" onchange="appRestaurer(this)"></label><button class="btn btn-ghost" onclick="basculerTheme()">Thème clair / sombre</button></div></div>`);
};

// ---------- Accueil : bandeau, 6 actions, évolution, à faire, meilleurs clients ----------
let gcvAn = getTodayISO().slice(0, 4);
renderGcAccueil = function(main){
  const D = gcD(), an = gcvAn, du = an + '-01-01', au = an + '-12-31', auj = getTodayISO(), ed = gcPeut();
  const RT = GC.rentabilite(D, {du, au}), T = RT.total, C = gcvCompteurs();
  const F = gcsfFactures().filter(f => (f.date || '').slice(0, 4) === an), ttc = (l) => l.reduce((s, f) => s + factTotaux(f).ttc, 0);
  const fact = ttc(F), enc = ttc(F.filter(f => factStatut(f) === 'payee')), aEnc = ttc(F.filter(f => factStatut(f) !== 'payee'));
  const bls = D.livraisons.filter(b => !b.annulee && (b.date || '').slice(0, 4) === an);
  const estime = bls.some(b => b.lignes.some(l => l.coutTheorique && !l.coutCorrige));
  const ans = Array.from(new Set(D.livraisons.map(b => (b.date || '').slice(0, 4)).concat([auj.slice(0, 4)]).filter(Boolean))).sort();
  const enCours = an === auj.slice(0, 4);
  main.innerHTML = `<div id="gc-body" class="gcv-accueil-page">${typeof gcRepriseDisponible === 'function' && gcRepriseDisponible() ? gcRepriseBandeau() : ''}
    <div class="gcv-hero" data-gc="bandeau"><div class="gcv-hero-row"><div><div class="gcv-hero-lib">Chiffre d'affaires ${an}${enCours ? ' · au ' + gcDt(auj).slice(0, 5) : ''}</div><div class="gcv-hero-big">${gcE(T.ca).replace(',00', '')}</div>
        <div class="gcv-hero-sub">${gcQ(T.qte)} ${esc(((bls[0] || {lignes:[{}]}).lignes[0] || {}).unite || '')} livrés · ${T.nb} livraison${T.nb > 1 ? 's' : ''} · ${RT.parClient.length} client${RT.parClient.length > 1 ? 's' : ''}</div>
        <div class="gcv-hero-mini"><div>Marge brute${estime ? ' <span class="gcv-est">coût estimé</span>' : ''}<b>${gcE(T.marge).replace(',00', '')}</b></div><div>Facturé<b>${gcE(fact).replace(',00', '')}</b></div><div>Encaissé<b>${gcE(enc).replace(',00', '')}</b></div><div>À encaisser<b>${gcE(aEnc).replace(',00', '')}</b></div></div></div>
      <div class="gcv-hero-droite"><div class="gcv-ans">${ans.map(a => `<button class="${a === an ? 'on' : ''}" onclick="gcvAn = '${a}'; nav('gc-accueil')">${a}</button>`).join('')}</div><div class="gcv-ring">${gcvAnneau(T.tauxMarge)}</div></div></div></div>
    <div class="gcv-actions no-print" data-gc="actions">${gcvActions(C, ed).map(a => `<button class="gcv-act" data-gc="action-${a.id}" onclick="${a.clic}">${a.n ? `<i>${a.n}</i>` : ''}<span style="background:${a.bg};color:${a.c};">${gcvIc(a.ic)}</span>${a.lib}<small>${a.sous}</small></button>`).join('')}</div>
    <div class="gcv-grille"><div class="card"><div class="gcv-titre"><h3 class="gc-h3" style="margin:0;">Évolution mensuelle ${an}</h3><div class="gcv-leg"><span><i style="background:#A3285D"></i>Chiffre d'affaires</span><span><i style="background:#138C94"></i>Marge</span></div></div>${gcvBarres(RT.parMois, an)}
        <div class="gcv-pied-graph">${gcvMeilleurMois(RT.parMois)}<a href="#" data-gc="verifier-marge" onclick="gcmvVerifier('Année ${an}', ${gcAttr(JSON.stringify(bls.map(b => b.id)))}); return false;">🔍 Vérifier le calcul des marges</a></div></div>
      <div class="gcv-col"><div class="card" data-gc="a-faire"><h3 class="gc-h3">À faire</h3>${gcvAFaire(C)}</div>
        <div class="card"><h3 class="gc-h3">Meilleurs clients ${an}</h3>${RT.parClient.length ? RT.parClient.slice(0, 5).map(x => `<div class="gcv-ligne" onclick="gcOuvrir('gc-client', '${x.cle}')"><span><b>${esc(gcNomClient(x.cle))}</b><br><span class="gc-sous">marge ${gcE(x.marge)} · ${gcPct(T.ca ? x.ca / T.ca * 100 : null)} du CA</span></span><b>${gcE(x.ca)}</b></div>`).join('') : '<div class="gc-sous">Aucune livraison cette année.</div>'}</div></div></div></div>`;
};
function gcvActions(C, ed){
  const L = C.aLivrer, R = C.aRec;
  return [
    {id:'livrer', ic:'truck', lib:'Livrer et facturer', sous:L.length ? L.length + ' à livrer' : 'planning clients', n:L.length, c:'#A3285D', bg:'#FBEEF3', clic:L.length === 1 && ed ? `gcsfFormLivrer('${L[0].cmd.id}', '${L[0].l.lid}')` : `gcvCmd.etat = 'ouvertes'; nav('gc-commandes')`},
    {id:'encaisser', ic:'euro', lib:'Encaisser', sous:C.F.length ? C.F.length + ' facture' + (C.F.length > 1 ? 's' : '') : 'tout est payé', n:C.F.length, c:'#1F8F5F', bg:'#E7F5EE', clic:`gcvEncaisser()`},
    {id:'receptionner', ic:'in', lib:'Réceptionner', sous:R.length ? R.length + ' arrivage' + (R.length > 1 ? 's' : '') : 'aucun en attente', n:R.length, c:'#B8901A', bg:'#FBF5E3', clic:R.length === 1 && ed ? `gcfrFormRecevoir('${R[0].cf.id}', '${R[0].l.lid}')` : `gcvCF.etat = 'ouvertes'; nav('gc-achats')`},
    {id:'commande', ic:'plus', lib:'Commande client', sous:'nouveau PO', c:'#2F6FDE', bg:'#EAF1FD', clic:ed ? `gcsfFormCommande()` : `gcRefus()`},
    {id:'commander', ic:'cart', lib:'Commander', sous:'au fournisseur', c:'#D9822B', bg:'#FDF1E3', clic:ed ? `gcfrFormCommande()` : `gcRefus()`},
    {id:'marges', ic:'search', lib:'Vérifier marges', sous:'contrôle du calcul', c:'#138C94', bg:'#E5F4F5', clic:`gcmvVerifier('Année ${gcvAn}', gcD().livraisons.filter(b => !b.annulee && (b.date || '').slice(0, 4) === '${gcvAn}').map(b => b.id))`}
  ];
}
function gcvAFaire(C){
  const out = [], auj = getTodayISO();
  C.rupt.forEach(p => out.push(['bad', 'alert', `Manque ${gcQ(-p.mini)} ${esc(p.a.unite || '')} le ${gcDt(p.rupture.date)} · ${esc(p.a.ref || '')}`, `nav('gc-previsionnel')`]));
  C.aLivrer.filter(x => x.statut === 'retard').forEach(x => out.push(['bad', 'truck', `Livraison en retard · PO ${esc(x.po)} · ${gcQ(x.reste)}`, `gcOuvrir('gc-commande', '${x.cmd.id}')`]));
  C.aLivrer.filter(x => x.statut !== 'retard').slice(0, 3).forEach(x => out.push(['warn', 'cal', `À livrer ${gcsfLibSemaine(x.dateLivraison, true)} · PO ${esc(x.po)} · ${gcQ(x.reste)}`, `gcOuvrir('gc-commande', '${x.cmd.id}')`]));
  C.aRec.forEach(x => out.push(['warn', 'in', `${esc(x.cf.numero)} : expédition du ${gcDt(x.exp)} à réceptionner`, `gcOuvrir('gc-achat', '${x.cf.id}')`]));
  C.aConf.forEach(x => out.push(['warn', 'doc', `${esc(x.cf.numero)} : confirmation du fournisseur attendue`, `gcOuvrir('gc-achat', '${x.cf.id}')`]));
  if(C.F.length) out.push([C.echues.length ? 'bad' : 'warn', 'euro', `${C.F.length} facture${C.F.length > 1 ? 's' : ''} à encaisser · ${gcE(C.F.reduce((s, f) => s + factTotaux(f).ttc, 0))}${C.echues.length ? ' · ' + C.echues.length + ' échue' + (C.echues.length > 1 ? 's' : '') : ''}`, `gcvEncaisser()`]);
  gcD().offres.filter(o => !o.archive && o.statut === 'acceptee' && o.validite && o.validite >= auj && o.validite <= GC.ajouterJours(auj, 60)).forEach(o => out.push(['warn', 'doc', `Offre ${esc(o.numero)} valable jusqu'au ${gcDt(o.validite)}`, `gcOuvrir('gc-offre', '${o.id}')`]));
  return out.length ? out.slice(0, 8).map(([c, k, t, clic]) => `<div class="gcv-ligne gcv-${c}" onclick="${clic}"><span class="gcv-af">${gcvIc(k)}<span>${t}</span></span><b class="gcv-chev">›</b></div>`).join('') : '<div class="gc-sous">Rien d\'urgent : tout est à jour.</div>';
}
window.gcvEncaisser = () => {
  const F = gcsfFactures().filter(f => factStatut(f) !== 'payee').sort((a, b) => (a.echeance || '').localeCompare(b.echeance || '')), ed = gcPeut();
  mgtModal('Factures à encaisser', F.length ? F.map(f => `<div class="session-row"><span><b>${esc(f.numero)}</b> · ${esc(gcNomClient(f.clientId))}${f.po ? ' · PO ' + esc(f.po) : ''}<br><span class="gc-sous">${gcDt(f.date)} · échéance <span style="${gcsfEchue(f) ? 'color:var(--bad);font-weight:700;' : ''}">${gcDt(f.echeance)}</span> · ${FACT_STATUTS[factStatut(f)].label}</span></span>
    <span style="display:flex;gap:6px;align-items:center;"><b>${gcE(factTotaux(f).ttc)}</b>${ed ? `<button class="btn btn-primary gcsf-petit" data-gc="encaisser-facture" onclick="gcsfPaiement('${f.id}', 'payee'); setTimeout(gcvEncaisser, 50)">Payée</button>` : ''}</span></div>`).join('') + `<button class="btn btn-ghost" style="margin-top:10px;" onclick="mgtFermer(); gcsfAller('factures', {paie:'apayer'})">Ouvrir les factures</button>` : '<p>Toutes les factures sont payées.</p>');
};
function gcvAnneau(p){
  const v = p === null || p === undefined ? 0 : p, r = 42, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 100 100" width="118" height="118"><circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="11"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c * Math.max(0, Math.min(100, v)) / 100} ${c}" transform="rotate(-90 50 50)"/><text x="50" y="49" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">${p === null || p === undefined ? '—' : gcPct(p).replace(' %', '') + ' %'}</text><text x="50" y="62" text-anchor="middle" font-size="7.5" fill="#fff" opacity=".85">taux de</text><text x="50" y="71" text-anchor="middle" font-size="7.5" fill="#fff" opacity=".85">marge</text></svg>`;
}
const GCV_MOIS = ['Janv', 'Févr', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct.', 'Nov.', 'Déc.'];
function gcvBarres(parMois, an){
  const M = {}; parMois.forEach(x => { M[x.cle] = x; });
  const ca = GCV_MOIS.map((_, i) => (M[an + '-' + String(i + 1).padStart(2, '0')] || {}).ca || 0), mg = GCV_MOIS.map((_, i) => Math.max(0, (M[an + '-' + String(i + 1).padStart(2, '0')] || {}).marge || 0));
  const max = Math.max(1, ...ca), pas = Math.pow(10, Math.floor(Math.log10(max))), haut = Math.ceil(max / pas) * pas;
  const W = 660, H = 220, y = v => H - 26 - v / haut * (H - 44), lw = (W - 46) / 12, bw = lw * .32;
  let g = [0, haut / 2, haut].map(v => `<line x1="44" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/><text x="0" y="${y(v) + 4}" font-size="10.5" fill="var(--ink-soft)">${v >= 1000 ? (v / 1000).toLocaleString('fr-FR') + 'k' : v}</text>`).join('');
  ca.forEach((v, i) => { const x = 48 + i * lw; g += `<g><title>${GCV_MOIS[i]} ${an} : CA ${gcE(v)} · marge ${gcE(mg[i])}</title><rect x="${x + 3}" y="${y(v)}" width="${bw}" height="${Math.max(0, H - 26 - y(v))}" rx="4" fill="#A3285D"/><rect x="${x + 5 + bw}" y="${y(mg[i])}" width="${bw}" height="${Math.max(0, H - 26 - y(mg[i]))}" rx="4" fill="#138C94"/></g><text x="${x + bw + 4}" y="${H - 8}" font-size="10.5" fill="var(--ink-soft)" text-anchor="middle">${GCV_MOIS[i]}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;" role="img" aria-label="Chiffre d'affaires et marge par mois">${g}</svg>`;
}
const GCV_MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function gcvMeilleurMois(parMois){ const m = parMois.slice().sort((a, b) => b.ca - a.ca)[0]; return m ? `<span class="gc-sous">Meilleur mois : ${GCV_MOIS_LONG[+m.cle.slice(5) - 1]} (${gcE(m.ca)})</span>` : '<span></span>'; }

// ---------- Styles ----------
(function(){
  const s = document.createElement('style');
  s.textContent = `
  /* menu : icône dans un carré, pastilles */
  #app-nav button .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.08);flex-shrink:0;}
  #app-nav button.actif .ic{background:rgba(255,255,255,.2);}
  #app-nav button .ic svg{width:18px;height:18px;}
  #app-nav button{position:relative;font-size:14.5px !important;}
  #app-nav .pastille{margin-left:auto;background:#fff;color:#A3285D;font-size:11px;font-weight:800;border-radius:99px;padding:1px 7px;min-width:20px;text-align:center;}
  #app-nav button.actif .pastille{background:rgba(255,255,255,.25);color:#fff;}
  @media (min-width:901px){ #app-nav button[data-cote="0"]{display:none;} }
  @media (max-width:900px){ #app-nav button .court{font-size:10px;letter-spacing:-.2px;} #app-nav button{padding:6px 0 !important;} #app-nav button .ic{background:none;width:auto;height:auto;} #app-nav .pastille{position:absolute;top:2px;right:calc(50% - 22px);margin:0;background:#D64545;color:#fff;font-size:10px;padding:0 5px;min-width:16px;} }
  .gcv-plus{width:100%;text-align:left;cursor:pointer;background:none;border:0;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center;}
  .gcv-pt{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--surface-2);} .gcv-pt svg{width:20px;height:20px;}
  .gcv-onglets{margin-bottom:14px;}
  .app-bas button.actif{background:#A3285D;color:#fff;}
  /* lisibilité clair / sombre : fonds fixés en blanc dans les styles d'origine */
  .modal-sheet{background:var(--surface) !important;color:var(--ink);}
  .field input:focus,.mgt-in:focus,.input-cell input,.input-cell input:focus{background:var(--surface) !important;color:var(--ink) !important;}
  .mgt-onglets button.actif{background:var(--ink) !important;color:var(--bg) !important;box-shadow:none !important;}
  .gcv-chev{color:var(--accent) !important;}
  #app-nav .pastille{background:#fff !important;color:#8E1F4F !important;}
  @media (max-width:900px){ #app-nav .pastille{background:#C62828 !important;color:#fff !important;} }
  .gcv-act i{background:#C62828 !important;}
  .gcv-theme{display:flex;align-items:center;gap:10px;}
  .gcv-liens{margin:10px 2px 0;}
  /* accueil */
  .gcv-accueil-page{max-width:1240px;}
  .gcv-hero{border-radius:22px;padding:24px 26px 66px;color:#fff;background:radial-gradient(120% 140% at 100% 0%,#D6467F 0%,#A3285D 38%,#5B1236 100%);position:relative;overflow:hidden;}
  .gcv-hero:after{content:"";position:absolute;right:-60px;top:-80px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none;}
  .gcv-hero-row{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start;position:relative;z-index:1;}
  .gcv-hero-lib{opacity:.88;font-size:13px;font-weight:600;} .gcv-hero-big{font-size:44px;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:6px 0;} .gcv-hero-sub{opacity:.9;font-size:13px;}
  .gcv-hero-mini{display:flex;gap:28px;margin-top:14px;flex-wrap:wrap;} .gcv-hero-mini div{font-size:12px;opacity:.88;} .gcv-hero-mini b{display:block;font-size:19px;opacity:1;}
  .gcv-est{background:rgba(255,255,255,.2);border-radius:99px;padding:0 6px;font-size:10.5px;margin-left:4px;}
  .gcv-hero-droite{display:flex;flex-direction:column;align-items:flex-end;gap:12px;}
  .gcv-ans{display:inline-flex;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:3px;} .gcv-ans button{border:0;background:none;color:#fff;font:inherit;font-size:13px;font-weight:700;padding:6px 14px;border-radius:999px;cursor:pointer;} .gcv-ans button.on{background:#fff;color:#A3285D;}
  .gcv-actions{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:-44px 18px 18px;position:relative;z-index:2;}
  .gcv-act{background:var(--surface);color:var(--ink);border:0;border-radius:18px;padding:14px 8px 12px;text-align:center;box-shadow:0 8px 24px rgba(91,18,54,.14);font:inherit;font-size:13px;font-weight:700;position:relative;cursor:pointer;transition:transform .12s ease, box-shadow .12s ease;}
  .gcv-act:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(91,18,54,.2);} .gcv-act:active{transform:scale(.98);}
  .gcv-act span{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;margin:0 auto 7px;} .gcv-act span svg{width:22px;height:22px;}
  .gcv-act small{display:block;font-weight:500;color:var(--ink-soft);font-size:11.5px;margin-top:1px;}
  .gcv-act i{position:absolute;top:8px;right:10px;background:#D64545;color:#fff;font-style:normal;font-size:11px;font-weight:800;border-radius:99px;min-width:20px;padding:1px 6px;}
  .gcv-grille{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;align-items:start;} .gcv-col{display:flex;flex-direction:column;gap:14px;} .gcv-grille .card{margin-bottom:0;}
  .gcv-titre{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;}
  .gcv-leg{display:flex;gap:14px;font-size:12px;color:var(--ink-soft);} .gcv-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px;}
  .gcv-pied-graph{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;}
  .gcv-ligne{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border);font-size:13px;cursor:pointer;} .gcv-ligne:first-of-type{border-top:0;}
  .gcv-ligne:hover{background:var(--surface-2);} .gcv-af{display:flex;gap:9px;align-items:center;} .gcv-af svg{width:18px;height:18px;flex-shrink:0;}
  .gcv-bad .gcv-af svg{color:var(--bad);} .gcv-warn .gcv-af svg{color:var(--warn);} .gcv-chev{color:#A3285D;}
  /* cartes PO / commandes fournisseurs */
  .gcv-po{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:12px;overflow:hidden;}
  .gcv-po-h{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;flex-wrap:wrap;cursor:pointer;} .gcv-po-h:hover{background:var(--surface-2);}
  .gcv-po.ferme .gcv-po-h{padding:11px 18px;} .gcv-po-n{font-size:16px;}
  .gcv-po-s{display:flex;gap:18px;align-items:center;font-size:12px;color:var(--ink-soft);flex-wrap:wrap;} .gcv-po-s b{display:block;color:var(--ink);font-size:14px;}
  .gcv-prog span{display:block;width:120px;height:8px;border-radius:9px;background:var(--border);overflow:hidden;margin-bottom:3px;} .gcv-prog i{display:block;height:100%;background:var(--good);}
  .gcv-po .gcv-t{border-top:1px solid var(--border);} .gcv-po .gcv-t th,.gcv-po .gcv-t td{padding-left:18px;}
  .gcv-po-pied{padding:8px 18px 12px;font-size:12.5px;text-align:right;}
  @media (max-width:900px){
    .gcv-hero{padding:18px 18px 58px;border-radius:18px;} .gcv-hero-big{font-size:34px;} .gcv-hero-mini{gap:16px;} .gcv-ring{display:none;} .gcv-hero-droite{align-items:flex-start;}
    .gcv-actions{grid-template-columns:repeat(3,1fr);margin:-42px 6px 14px;gap:8px;} .gcv-act{font-size:12px;padding:12px 4px 10px;} .gcv-act small{display:none;}
    .gcv-grille{grid-template-columns:1fr;} .gcv-prog{display:none;} .gcv-po-s{gap:12px;}
  }
  `;
  document.head.appendChild(s);
})();
