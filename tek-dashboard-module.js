// ============================================================
// TEK-TREND — TABLEAU DE BORD DE LA SOCIÉTÉ (fichier séparé)
// ============================================================
// Chargé par index.html, après tous les autres modules. Vue d'ensemble,
// pour la société TEK-TREND uniquement (par opposition à la « Vue direction »
// qui couvre tout le groupe) : Rendement production, Suivi chaîne, État des
// employés, Commandes.
//
// Principe : lecture SEULE, aucune donnée modifiée ici. Toutes les fonctions
// de calcul réutilisées (computeTotals, getDay, getObjForDay, fcTotaux,
// activeEmployees, resolveDayStatus, suiviResume...) sont déjà en service
// ailleurs dans l'application (Rendement, Suivi chaîne, RH, Vue direction) ;
// ce fichier ne fait qu'assembler leurs résultats, chacun protégé par
// ddSecuriser() pour qu'une donnée manquante ou un module non configuré
// n'empêche jamais l'affichage du reste du tableau de bord.

const TD_MODULE_ID = 'tek-dashboard';

// --- Calculs (lecture seule) ---
function tdRendementProd(){
  const today = getTodayISO(), day = getDay(today), tot = computeTotals(day), obj = getObjForDay(day);
  const att = getElapsedObjective(day, today);
  return {
    pieces: tot.totalGeneral,
    obj,
    rend: obj > 0 ? tot.totalGeneral / obj * 100 : null,
    rythme: att > 0 ? tot.totalGeneral / att * 100 : null,
    arrets: tot.arrets
  };
}
function tdChaine(){
  const today = getTodayISO();
  const jour = fcJour(today);
  const T = fcTotaux(today, jour);
  return T; // {q, o, rend, p (pertes min), pres, n, groupes, par, dernier, goulot}
}
function tdEmployes(){
  const today = getTodayISO();
  const emps = activeEmployees();
  let present = 0, absent = 0, conge = 0, maladie = 0, autorisee = 0, injustifiee = 0, autre = 0, nonRenseigne = 0;
  const absents = [], retards = [];
  emps.forEach(([id, e]) => {
    const r = resolveDayStatus(id, today);
    if(r.source === 'periode'){
      if(r.type === 'conge') conge++;
      else if(r.type === 'maladie') maladie++;
      else if(r.type === 'autorisee') autorisee++;
      else if(r.type === 'injustifiee') injustifiee++;
      else autre++;
      const t = ABSENCE_TYPES[r.type];
      absents.push({nom: e.nom || '', label: t ? t.label : r.type});
    } else if(r.source === 'pointage'){
      if(r.status === 'present'){
        present++;
        const rh = (typeof computeRetardHours === 'function') ? computeRetardHours(r) : 0;
        if(rh > 0) retards.push({nom: e.nom || '', h: rh});
      } else if(r.status === 'absent'){
        absent++;
        absents.push({nom: e.nom || '', label: 'Absent (non pointé)'});
      }
    } else {
      nonRenseigne++;
    }
  });
  const total = emps.length;
  return {total, present, absent, conge, maladie, autorisee, injustifiee, autre, nonRenseigne, absents, retards,
    presence: total > 0 ? present / total * 100 : null};
}
function tdCommandes(){
  const resume = (typeof suiviResume === 'function') ? suiviResume() : [];
  const enCours = resume.filter(l => l.enCours);
  const qteTot = enCours.reduce((s, l) => s + (l.qte || 0), 0);
  const expTot = enCours.reduce((s, l) => s + ((l.etapes && l.etapes.exp) || 0), 0);
  const lots = enCours.map(l => ({lot: l.lot, qte: l.qte, pct: l.qte > 0 ? Math.round(((l.etapes && l.etapes.exp) || 0) / l.qte * 100) : 0}))
    .sort((a, b) => b.pct - a.pct);
  return {
    nb: enCours.length,
    qteTot, expTot,
    avancement: qteTot > 0 ? expTot / qteTot * 100 : null,
    lots,
    gadh: (typeof suiviLotsChezGadh === 'function') ? suiviLotsChezGadh() : 0
  };
}
function tdDonnees(){
  const D = {};
  D.prod = ddSecuriser(tdRendementProd, {pieces:0, obj:0, rend:null, rythme:null, arrets:0});
  D.chaine = ddSecuriser(tdChaine, {q:0, o:0, rend:null, p:0, pres:0, n:0, groupes:[], par:[]});
  D.emp = ddSecuriser(tdEmployes, {total:0, present:0, absent:0, conge:0, maladie:0, autorisee:0, injustifiee:0, autre:0, nonRenseigne:0, absents:[], retards:[], presence:null});
  D.cmd = ddSecuriser(tdCommandes, {nb:0, qteTot:0, expTot:0, avancement:null, lots:[], gadh:0});
  return D;
}

// --- Affichage ---
function tdAbsenceList(D){
  if(!D.emp.absents.length) return '<div class="dd-vide">Personne d\'absent aujourd\'hui</div>';
  return D.emp.absents.map(a => `<div class="dd-li"><i style="background:var(--warn);"></i><div><b>${esc(a.nom)}</b><span>${esc(a.label)}</span></div></div>`).join('');
}
function tdRetardList(D){
  if(!D.emp.retards.length) return '<div class="dd-vide">Aucun retard aujourd\'hui</div>';
  return D.emp.retards.map(r => `<div class="dd-li"><i style="background:var(--crit);"></i><div><b>${esc(r.nom)}</b><span>Retard de ${fmtH ? fmtH(r.h) : (Math.round(r.h*60)+' min')}</span></div></div>`).join('');
}
function tdCommandesList(D){
  if(!D.cmd.lots.length) return '<div class="dd-vide">Aucune commande en cours</div>';
  return D.cmd.lots.map(l => ddBarreLot(l, false)).join('');
}
function tdRender(main){
  let D;
  try { D = tdDonnees(); } catch(e) { console.error('Tableau de bord TEK-TREND', e); main.innerHTML = '<div class="card"><div class="dd-vide">Tableau de bord indisponible pour le moment.</div></div>'; return; }
  const jour = new Date(getTodayISO() + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const chaineKpis = (typeof fcKpisHTML === 'function') ? (function(){ try { return fcKpisHTML(D.chaine); } catch(e){ return '<div class="dd-vide">Suivi chaîne non configuré</div>'; } })() : '<div class="dd-vide">Suivi chaîne indisponible</div>';
  main.innerHTML = `
    <div class="flex-header"><h2><span class="td-h2-ico">${ICONS.stats}</span> Tableau de bord TEK-TREND</h2></div>
    <div class="td-wrap">
      <div class="dd-date" style="margin-bottom:14px;text-transform:capitalize;">${esc(jour)}</div>
      <div class="dd-jauges4">
        ${ddJaugeP('Rendement production', D.prod.rend)}
        ${ddJaugeP('Rendement chaîne', D.chaine.rend)}
        ${ddJaugeP('Présence du personnel', D.emp.presence)}
        ${ddJaugeP('Avancement commandes', D.cmd.avancement)}
      </div>
      <div class="dd-boites">
        ${ddBoite(D.prod.pieces, 'Pièces produites', 'ok')}
        ${ddBoite(D.prod.arrets, 'Arrêts signalés', D.prod.arrets ? 'bad' : 'nul')}
        ${ddBoite(D.emp.present + '/' + D.emp.total, 'Présents', 'ok')}
        ${ddBoite(D.emp.absent + D.emp.conge + D.emp.maladie + D.emp.autorisee + D.emp.injustifiee + D.emp.autre, 'Absents (toutes causes)', 'bad')}
        ${ddBoite(D.cmd.nb, 'Commandes en cours', 'nul')}
        ${ddBoite(D.cmd.gadh, 'Lots chez la GADH', D.cmd.gadh ? 'bad' : 'nul')}
      </div>
      <div class="dd-g">
        <div class="dd-card"><div class="dd-ct"><h3>Suivi de chaîne — aujourd'hui</h3></div>${chaineKpis}</div>
      </div>
      <div class="dd-g dd-g3">
        <div class="dd-card dd-plat"><div class="dd-ct"><h3>Absences du jour</h3><span>${D.emp.absents.length}</span></div><div class="dd-scroll">${tdAbsenceList(D)}</div></div>
        <div class="dd-card dd-plat"><div class="dd-ct"><h3>Retards du jour</h3><span>${D.emp.retards.length}</span></div><div class="dd-scroll">${tdRetardList(D)}</div></div>
        <div class="dd-card dd-plat"><div class="dd-ct"><h3>Commandes en cours</h3><span>${D.cmd.nb}</span></div><div class="dd-scroll">${tdCommandesList(D)}</div></div>
      </div>
    </div>`;
}

// --- Intégration module (même principe que Suivi chaîne) ---
const tdMods = window.modulesDeSociete;
window.modulesDeSociete = function(soc){
  const l = tdMods(soc);
  // Visible uniquement pour TEK-TREND, et seulement si la RH (réservée à
  // Responsable / Direction) est elle-même accessible : le Tableau de bord
  // expose des données RH agrégées, il suit donc la même restriction d'accès.
  if(soc === 'tek' && l.indexOf('rh') >= 0 && l.indexOf(TD_MODULE_ID) < 0) return [TD_MODULE_ID].concat(l);
  return l;
};
const tdChoose = window.chooseModule;
window.chooseModule = function(mod){
  if(mod === TD_MODULE_ID){ activeModule = TD_MODULE_ID; renderShell(); return; }
  return tdChoose.apply(this, arguments);
};
const tdNavItemsOrigine = window.navItems;
window.navItems = function(){
  if(activeModule === TD_MODULE_ID) return [{tab:'tek-dash-vue', label:'Tableau de bord', icon:ICONS.stats, show:true}];
  return tdNavItemsOrigine();
};
const tdNavOrigine = window.nav;
window.nav = function(tab){
  const r = tdNavOrigine.apply(this, arguments);
  if(tab === 'tek-dash-vue'){ try { const m = document.getElementById('main'); if(m) tdRender(m); } catch(e) { console.error('Tableau de bord TEK-TREND', e); } }
  return r;
};

const tdCss = document.createElement('style');
tdCss.textContent = `.td-wrap{padding:0 2px;}
.td-h2-ico{display:inline-flex;width:22px;height:22px;vertical-align:-5px;flex-shrink:0;}
.td-h2-ico svg{width:100%;height:100%;}`;
document.head.appendChild(tdCss);
