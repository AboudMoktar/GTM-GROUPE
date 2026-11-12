// ============================================================
// GADH TUNISIA — TABLEAU DE BORD DE LA SOCIÉTÉ (fichier séparé)
// ============================================================
// Même principe que tek-dashboard-module.js, pour GADH TUNISIA : Rendement
// production, État des employés, Commandes (vue GADH), puis Gestion des commandes,
// Facturation (selon les droits de lecture du rôle). Lecture seule,
// aucune donnée modifiée ici ; chaque calcul est protégé par ddSecuriser()
// (déjà utilisée par la Vue direction) pour qu'une donnée manquante
// n'empêche jamais l'affichage du reste du tableau de bord.

const GD_MODULE_ID = 'gadh-tableau';

// --- Calculs (lecture seule) ---
function gdRendement(){
  const today = getTodayISO();
  return gadhDayTotals(today); // {totalReel, totalObj, rendement, hasEntry, slots, parRef, heures}
}
function gdEmployes(){
  const today = getTodayISO();
  const emps = activeGadhEmployees();
  let present = 0, absent = 0, retard = 0, sortie = 0, autorisation = 0, conge = 0, maladie = 0, nonRenseigne = 0;
  const absents = [], retards = [];
  emps.forEach(([id, e]) => {
    const r = resolveGadhDayStatus(id, today);
    if(r.source === 'periode'){
      if(r.type === 'conge') conge++; else if(r.type === 'maladie') maladie++;
      const t = GADH_ABSENCE_TYPES[r.type];
      absents.push({nom: e.nom || '', label: t ? t.label : r.type});
    } else if(r.source === 'pointage'){
      if(r.statut === 'present'){ present++; }
      else if(r.statut === 'absent'){ absent++; absents.push({nom: e.nom || '', label: 'Absent'}); }
      else if(r.statut === 'retard'){ present++; retard++; retards.push({nom: e.nom || ''}); }
      else if(r.statut === 'sortie'){ present++; sortie++; }
      else if(r.statut === 'autorisation'){ present++; autorisation++; }
    } else {
      nonRenseigne++;
    }
  });
  const total = emps.length;
  return {total, present, absent, retard, sortie, autorisation, conge, maladie, nonRenseigne, absents, retards,
    // Personne n'est encore pointé : pas de pourcentage (et pas de « Faible » en rouge) avant le pointage du jour.
    presence: total > 0 && nonRenseigne < total ? present / total * 100 : null};
}
function gdCommandes(){
  const lots = (typeof cmdCommandesEnCoursPourGadh === 'function') ? cmdCommandesEnCoursPourGadh() : [];
  const qteTot = lots.reduce((s, l) => s + (l.total || 0), 0);
  const retourTot = lots.reduce((s, l) => s + (l.retourFait || 0), 0);
  return {
    nb: lots.length,
    qteTot, retourTot,
    avancement: qteTot > 0 ? retourTot / qteTot * 100 : null,
    lots: lots.slice().sort((a, b) => b.pct - a.pct),
    enAttente: (typeof suiviLotsChezGadh === 'function') ? suiviLotsChezGadh() : 0
  };
}
// Droit de lecture sur une donnée GADH (roles-config.js) : les sections Ventes, Achats et Facturation
// ne s'affichent qu'aux rôles qui peuvent les lire (admin, responsable, direction, secrétaire GADH…).
function gdPeutLire(cle){
  const R = window.GTM_ROLES, p = currentUser && currentUser.profil;
  if(R && p && R.ROLES[p]) return R.autorise(p, 'gadh', cle, 'l');
  return !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'viewer');
}
// Gestion des commandes GADH (remplace « Achats et stock » et « Ventes ») : indicateurs de gadh-gc-*.js.
function gdCommandesGestion(){
  if(typeof GC === 'undefined' || typeof gcIndicateurs !== 'function' || !gdPeutLire('gadh_gc_cmd_clients')) return null;
  const a = getTodayISO(), I = gcIndicateurs({du:a.slice(0, 8) + '01', au:a, clientId:'', fournisseurId:'', articleId:'', statut:''});
  const aFact = I.D.livraisons.filter(b => !b.annulee && !gcFactureDe(b));
  return {I, aFactNb:aFact.length, aFactMontant:aFact.reduce((t, b) => t + GC.coutLivraison(b).ca, 0), reste:I.D.cmdF.reduce((t, f) => t + gcTotauxCF(f).reste, 0)};
}
function gdFacturation(){
  if(typeof factIndicateurs !== 'function' || !gdPeutLire('gadh_factures')) return null;
  return factIndicateurs('gadh'); // {aEncaisser, impayees, retard, montantRetard, caMois}
}
function gdDonnees(){
  const D = {};
  D.gc = ddSecuriser(gdCommandesGestion, null);
  D.fact = ddSecuriser(gdFacturation, null);
  D.rend = ddSecuriser(gdRendement, {totalReel:0, totalObj:0, rendement:null, hasEntry:false});
  D.emp = ddSecuriser(gdEmployes, {total:0, present:0, absent:0, retard:0, sortie:0, autorisation:0, conge:0, maladie:0, nonRenseigne:0, absents:[], retards:[], presence:null});
  D.cmd = ddSecuriser(gdCommandes, {nb:0, qteTot:0, retourTot:0, avancement:null, lots:[], enAttente:0});
  return D;
}

// --- Affichage ---
function gdBarreLot(l){
  const pct = Math.max(0, Math.min(100, l.pct || 0));
  return `<div class="dd-lot${pct >= 100 ? ' fini' : ''}"><div style="width:${Math.max(pct, 3)}%"></div><span>${esc(String(l.numero))}</span><b>${pct} %</b></div>`;
}
function gdAbsenceList(D){
  if(!D.emp.absents.length) return '<div class="dd-vide">Personne d\'absent aujourd\'hui</div>';
  return D.emp.absents.map(a => `<div class="dd-li"><i style="background:var(--warn);"></i><div><b>${esc(a.nom)}</b><span>${esc(a.label)}</span></div></div>`).join('');
}
function gdRetardList(D){
  if(!D.emp.retards.length) return '<div class="dd-vide">Aucun retard aujourd\'hui</div>';
  return D.emp.retards.map(r => `<div class="dd-li"><i style="background:var(--crit);"></i><div><b>${esc(r.nom)}</b><span>En retard</span></div></div>`).join('');
}
function gdCommandesList(D){
  if(!D.cmd.lots.length) return '<div class="dd-vide">Aucune commande en cours</div>';
  return D.cmd.lots.map(gdBarreLot).join('');
}
function gdEur(n){ return (Number(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'; }
// Raccourci vers le module (si le rôle y a accès).
function gdLien(mod){ return typeof modulesDeSociete === 'function' && modulesDeSociete('gadh').indexOf(mod) >= 0 ? `activeSociete='gadh'; chooseModule('${mod}')` : ''; }
function gdSectionsGestion(D){
  let h = '';
  const titre = (t, mod) => `<div class="dd-ct" style="margin:18px 2px 8px;"><h3>${t}</h3>${gdLien(mod) ? `<span style="cursor:pointer;" onclick="${gdLien(mod)}">Ouvrir ›</span>` : ''}</div>`;
  if(D.gc){
    const G = D.gc, I = G.I, T = I.RT.total;
    h += titre('Gestion des commandes', 'gadh-commandes') + `<div class="dd-boites">
      ${ddBoite(I.cmdOuv.length, 'Commandes clients en cours', I.cmdOuv.length ? 'warn' : 'nul', "kpiAller('gadh', 'gadh-commandes', 'gc-commandes')")}
      ${ddBoite(I.retards.length, 'Livraisons en retard', I.retards.length ? 'bad' : 'nul', "kpiAller('gadh', 'gadh-commandes', 'gc-commandes')")}
      ${ddBoite(G.aFactNb, 'Livraisons à facturer · ' + gdEur(G.aFactMontant), G.aFactNb ? 'warn' : 'nul', "kpiAller('gadh', 'gadh-commandes', 'gc-livraisons')")}
      ${ddBoite(I.besoins.length, 'Besoins d\'approvisionnement' + (I.urgents.length ? ' · ' + I.urgents.length + ' urgent(s)' : ''), I.urgents.length ? 'bad' : I.besoins.length ? 'warn' : 'nul', "kpiAller('gadh', 'gadh-commandes', 'gc-besoins')")}
      ${ddBoite(I.cfOuv.length, 'Commandes fournisseurs en cours' + (I.cfRetard.length ? ' · ' + I.cfRetard.length + ' en retard' : ''), I.cfRetard.length ? 'bad' : 'nul', "kpiAller('gadh', 'gadh-commandes', 'gc-achats')")}
      ${ddBoite(gdEur(G.reste), 'Reste à payer aux fournisseurs', G.reste > 0 ? 'warn' : 'nul', "kpiAller('gadh', 'gadh-commandes', 'gc-achats')")}
      ${ddBoite(I.sous.length, 'Articles en rupture ou sous le seuil', I.sous.length ? 'bad' : 'nul', "kpiAller('gadh', 'gadh-commandes', 'gc-stock')")}
      ${ddBoite(gdEur(I.valeur), 'Valeur du stock (coût réel)', 'ok', "kpiAller('gadh', 'gadh-commandes', 'gc-stock')")}
      ${ddBoite(gdEur(T.ca), 'CA livré du mois (HT)', 'ok', "kpiAller('gadh', 'gadh-commandes', 'gc-rentabilite')")}
      ${ddBoite(gdEur(T.marge), 'Marge brute du mois · ' + (T.tauxMarque === null ? '—' : T.tauxMarque.toLocaleString('fr-FR') + ' %'), T.marge < 0 ? 'bad' : 'ok', "kpiAller('gadh', 'gadh-commandes', 'gc-rentabilite')")}
    </div>`;
    if(I.sous.length) h += `<div class="dd-card dd-plat"><div class="dd-ct"><h3>Articles à réapprovisionner</h3><span>${I.sous.length}</span></div><div class="dd-scroll">${I.sous.map(a => { const s = I.S[a.id] || {}; return `<div class="dd-li"><i style="background:var(--crit);"></i><div><b>${esc(gcLibArticle(a))}</b><span>Disponible ${gcQ(s.disponible)} ${esc(a.unite || '')} · seuil ${gcQ(a.seuil)}</span></div></div>`; }).join('')}</div></div>`;
  }
  if(D.fact){
    const F = D.fact, l = gdLien('factures');
    h += titre('Facturation (toutes factures GADH)', 'factures') + `<div class="dd-boites">
      ${ddBoite(gdEur(F.caMois), 'Facturé ce mois (HT)', 'ok', "factFiltre='tous'; kpiAller('gadh', 'factures', 'fact-liste')")}
      ${ddBoite(gdEur(F.aEncaisser), F.impayees + ' facture(s) à encaisser', F.impayees ? 'warn' : 'nul', "factFiltre='apayer'; kpiAller('gadh', 'factures', 'fact-liste')")}
      ${ddBoite(gdEur(F.montantRetard), F.retard + ' facture(s) en retard', F.retard ? 'bad' : 'nul', "factFiltre='retard'; kpiAller('gadh', 'factures', 'fact-liste')")}
    </div>`;
  }
  return h;
}
function gdRender(main){
  let D;
  try { D = gdDonnees(); } catch(e) { console.error('Tableau de bord GADH', e); main.innerHTML = '<div class="card"><div class="dd-vide">Tableau de bord indisponible pour le moment.</div></div>'; return; }
  const jour = new Date(getTodayISO() + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  main.innerHTML = `
    <div class="pg-tete"><div><h2 class="pg-titre">Tableau de bord GADH TUNISIA</h2><div class="pg-sous">${esc(jour)}</div></div></div>
    <div class="td-wrap">
      <div class="dd-jauges4">
        ${ddJaugeP('Présence du personnel', D.emp.presence, "kpiAller('gadh', 'gadh-rh', 'gadh-rh-pointage')")}
        ${ddJaugeP('Avancement retours', D.cmd.avancement, "kpiAller('gadh', 'gadh', 'commandes-home')")}
      </div>
      <div class="dd-boites">
        ${ddBoite(D.rend.totalReel, 'Pièces retournées', 'ok', "kpiAller('gadh', 'gadh', 'gadh-production')")}
        ${ddBoite(D.emp.present + '/' + D.emp.total, 'Présents', 'ok', "kpiAller('gadh', 'gadh-rh', 'gadh-rh-pointage')")}
        ${ddBoite(D.emp.absent + D.emp.conge + D.emp.maladie, 'Absents (toutes causes)', 'bad', "kpiAller('gadh', 'gadh-rh', 'gadh-rh-pointage')")}
        ${ddBoite(D.emp.retard, 'Retards', D.emp.retard ? 'bad' : 'nul', "kpiAller('gadh', 'gadh-rh', 'gadh-rh-pointage')")}
        ${ddBoite(D.cmd.nb, 'Lots en cours', 'nul', "kpiAller('gadh', 'gadh', 'commandes-home')")}
        ${ddBoite(D.cmd.enAttente, 'En attente de retour', D.cmd.enAttente ? 'bad' : 'nul', "kpiAller('gadh', 'gadh', 'commandes-home')")}
      </div>
      <div class="dd-g dd-g2">
        <div class="dd-card dd-plat"><div class="dd-ct"><h3>Commandes (vue GADH)</h3><span>${D.cmd.nb}</span></div><div class="dd-scroll">${gdCommandesList(D)}</div></div>
        <div class="dd-g" style="margin:0;">
          <div class="dd-card dd-plat"><div class="dd-ct"><h3>Absences du jour</h3><span>${D.emp.absents.length}</span></div><div class="dd-scroll">${gdAbsenceList(D)}</div></div>
          <div class="dd-card dd-plat"><div class="dd-ct"><h3>Retards du jour</h3><span>${D.emp.retards.length}</span></div><div class="dd-scroll">${gdRetardList(D)}</div></div>
        </div>
      </div>
      ${gdSectionsGestion(D)}
    </div>`;
}

// --- Intégration module (même principe que tek-dashboard-module.js) ---
const gdMods = window.modulesDeSociete;
window.modulesDeSociete = function(soc){
  const l = gdMods(soc);
  // Visible uniquement pour GADH, et seulement si le module GADH (déjà
  // réservé à Responsable / Direction via canAccessGADH) est accessible.
  if(soc === 'gadh' && l.indexOf('gadh') >= 0 && l.indexOf(GD_MODULE_ID) < 0) return [GD_MODULE_ID].concat(l);
  return l;
};
const gdChoose = window.chooseModule;
window.chooseModule = function(mod){
  if(mod === GD_MODULE_ID){ activeModule = GD_MODULE_ID; renderShell(); return; }
  return gdChoose.apply(this, arguments);
};
const gdNavItemsOrigine = window.navItems;
window.navItems = function(){
  if(activeModule === GD_MODULE_ID) return [{tab:'gadh-tableau-vue', label:'Tableau de bord', icon:ICONS.stats, show:true}];
  return gdNavItemsOrigine();
};
const gdNavOrigine = window.nav;
window.nav = function(tab){
  const r = gdNavOrigine.apply(this, arguments);
  if(tab === 'gadh-tableau-vue'){ try { const m = document.getElementById('main'); if(m) gdRender(m); } catch(e) { console.error('Tableau de bord GADH', e); } }
  return r;
};
