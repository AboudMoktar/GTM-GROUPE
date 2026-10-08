// ============================================================
// NOTIFICATIONS — alertes calculées à partir des données, par société
// ============================================================
// Aucune donnée supplémentaire n'est stockée dans la base : chaque alerte est
// recalculée à chaque rafraîchissement (donc toujours à jour, sur tous les
// appareils). Chaque compte retient seulement, sur son appareil, les alertes
// qu'il a déjà vues (clé locale « notif_vus_<identifiant> »). L'identifiant
// d'une alerte contient son chiffre (3 factures en retard → 4) : une alerte
// qui s'aggrave ressort donc comme nouvelle.
//
// Alertes par société :
//  - TEK-TREND / GADH : machines à l'arrêt depuis plus d'une heure (critique
//    après 4 h), commandes sans mouvement depuis 7 jours, factures en retard ;
//  - MGT : demandes SAV des clients en attente, tickets urgents, tickets sans
//    technicien, machines clientes à l'arrêt, relances en retard, devis échus
//    sans réponse, pièces sous le seuil, contrats à renouveler, factures en retard.
// Un clic sur une alerte ouvre l'écran concerné.

const NOTIF_NIVEAUX = {crit:{ordre:0, couleur:'var(--bad)', label:'Urgent'}, warn:{ordre:1, couleur:'var(--warn)', label:'À traiter'}, info:{ordre:2, couleur:'var(--accent-2)', label:'Info'}};
const NOTIF_ICONE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
let notifListeCourante = [];
let notifTimer = null;

function notifPluriel(n, s, p){ return n + ' ' + (n > 1 ? (p || s + 's') : s); }

// Commandes (lots) du suivi PERCKO en cours dont le dernier mouvement date de 7 jours ou plus.
function notifLotsStagnants(){
  const docs = suiviLireDocs(), lotDeLigne = {}, dernier = {};
  Object.keys(docs).forEach(id => {
    if(id.indexOf('lines-') === 0) (docs[id].lines || []).forEach(a => { lotDeLigne[a[0]] = docs[id].lot; });
  });
  Object.keys(docs).forEach(id => {
    if(id.indexOf('moves-') !== 0) return;
    (docs[id].moves || []).forEach(m => { const lot = lotDeLigne[m[2]]; if(lot && m[1] > (dernier[lot] || '')) dernier[lot] = m[1]; });
  });
  const auj = new Date(getTodayISO()).getTime(), res = [];
  suiviResume().filter(l => l.enCours).forEach(l => {
    const d = dernier[l.lot]; if(!d) return;
    const jours = Math.floor((auj - new Date(d).getTime()) / 86400000);
    if(jours >= 7) res.push({lot:l.lot, jours, chezGadh:(l.etapes.gadh || 0) > (l.etapes.ret || 0)});
  });
  return res;
}

function notifSociete(soc, push){
  // Factures en retard (les trois sociétés)
  if(typeof canAccessFactures === 'function' && canAccessFactures()){
    const f = factIndicateurs(soc);
    if(f.retard > 0) push({id:'fact-' + soc + '-' + f.retard, niveau:'crit', titre:notifPluriel(f.retard, 'facture') + ' en retard de paiement', detail:fmtDT(f.montantRetard) + ' à relancer', ouvrir:{module:'factures', tab:'fact-liste'}});
  }
  if(soc === 'tek' || soc === 'gadh'){
    // Machines à l'arrêt
    arrOuverts(soc).forEach(o => {
      if(o.minutes < 60) return;
      const grave = o.minutes >= 240, nom = o.machine ? o.machine.nom : 'Une machine';
      push({id:'arr-' + o.id + (grave ? '-c' : '-w'), niveau:grave ? 'crit' : 'warn', titre:nom + ' à l\'arrêt depuis ' + arrDuree(o.minutes),
        detail:(ARR_CAUSES[o.a.cause] || ARR_CAUSES.autre).label, ouvrir:{module:'machines', tab:'arr-dashboard'}});
    });
    // Commandes sans mouvement
    let stagnants = [];
    try { stagnants = notifLotsStagnants(); } catch(e) {}
    if(soc === 'gadh') stagnants = stagnants.filter(l => l.chezGadh);
    if(stagnants.length){
      const mod = soc === 'gadh' ? 'gadh' : 'commandes';
      push({id:'stag-' + soc + '-' + stagnants.map(l => l.lot).join(','), niveau:'warn',
        titre:stagnants.length > 1 ? notifPluriel(stagnants.length, 'commande') + ' sans mouvement depuis 7 jours ou plus' : 'Commande ' + stagnants[0].lot + ' sans mouvement depuis ' + stagnants[0].jours + ' jours',
        detail:stagnants.slice(0, 4).map(l => l.lot).join(', ') + (stagnants.length > 4 ? '…' : ''), ouvrir:{module:mod, tab:'commandes-home'}});
    }
  }
  if(soc === 'mgt'){
    const today = getTodayISO();
    const dem = Object.values(mgtGet('demandes')).filter(d => d.statut === 'attente').length;
    if(dem) push({id:'mgt-dem-' + dem, niveau:'crit', titre:notifPluriel(dem, 'demande') + ' SAV client en attente', detail:'Créez le ticket correspondant', ouvrir:{module:'mgt', tab:'mgt-sav'}});
    const s = savIndicateurs();
    if(s.urgents) push({id:'mgt-urg-' + s.urgents, niveau:'crit', titre:notifPluriel(s.urgents, 'ticket') + ' SAV urgent' + (s.urgents > 1 ? 's' : ''), detail:'Priorité urgente, non résolu', ouvrir:{module:'mgt', tab:'mgt-sav'}});
    const sansTech = Object.values(mgtGet('tickets')).filter(t => t.statut === 'ouvert' && !t.technicien && t.date && t.date <= mgtAddDays(today, -2)).length;
    if(sansTech) push({id:'mgt-sanstech-' + sansTech, niveau:'warn', titre:notifPluriel(sansTech, 'ticket') + ' sans technicien depuis plus de 2 jours', detail:'À affecter', ouvrir:{module:'mgt', tab:'mgt-sav'}});
    if(s.machinesArret) push({id:'mgt-arret-' + s.machinesArret, niveau:'warn', titre:notifPluriel(s.machinesArret, 'machine') + ' cliente' + (s.machinesArret > 1 ? 's' : '') + ' à l\'arrêt', detail:'Ticket « machine à l\'arrêt » en cours', ouvrir:{module:'mgt', tab:'mgt-parc'}});
    const k = mgtIndicateurs();
    if(k.relancesRetard) push({id:'mgt-rel-' + k.relancesRetard, niveau:'warn', titre:notifPluriel(k.relancesRetard, 'rendez-vous ou relance') + ' en retard', detail:'Agenda commercial', ouvrir:{module:'mgt', tab:'mgt-agenda'}});
    const echus = Object.values(mgtGet('devis')).filter(d => d.statut === 'envoye' && d.validite && d.validite < today).length;
    if(echus) push({id:'mgt-devis-' + echus, niveau:'warn', titre:notifPluriel(echus, 'devis') + ' échu' + (echus > 1 ? 's' : '') + ' sans réponse', detail:'Relancer le client ou prolonger', ouvrir:{module:'mgt', tab:'mgt-devis'}});
    if(s.piecesSousSeuil) push({id:'mgt-pieces-' + s.piecesSousSeuil, niveau:'warn', titre:notifPluriel(s.piecesSousSeuil, 'pièce') + ' sous le seuil de stock', detail:'À commander', ouvrir:{module:'mgt', tab:'mgt-pieces'}});
    if(s.contratsARenouveler) push({id:'mgt-contrats-' + s.contratsARenouveler, niveau:'info', titre:notifPluriel(s.contratsARenouveler, 'contrat') + ' de maintenance à renouveler', detail:'Échéance dans moins de 30 jours', ouvrir:{module:'mgt', tab:'mgt-contrats'}});
  }
}

function notifCalculer(){
  if(!currentUser) return [];
  const res = [];
  userSocietes().forEach(soc => {
    try { notifSociete(soc, (a) => res.push(Object.assign({soc}, a))); }
    catch(e) { console.error('Alertes', soc, e); }
  });
  return res.sort((a, b) => NOTIF_NIVEAUX[a.niveau].ordre - NOTIF_NIVEAUX[b.niveau].ordre);
}

// --- Alertes déjà vues (par compte, sur cet appareil) ---
function notifCleVus(){ return CACHE_PREFIX + 'notif_vus_' + (currentUser ? currentUser.username : ''); }
function notifVus(){
  try { return new Set(JSON.parse(window.localStorage.getItem(notifCleVus()) || '[]')); } catch(e) { return new Set(); }
}
function notifEnregistrerVus(ids){
  try { window.localStorage.setItem(notifCleVus(), JSON.stringify(Array.from(ids))); } catch(e) {}
}

// --- Cloche ---
function notifCloche(){
  if(!currentUser || (typeof isPortail === 'function' && isPortail())) return '';
  return `<button class="notif-btn" onclick="notifOuvrir()" title="Alertes" aria-label="Alertes">${NOTIF_ICONE}<span class="notif-count" style="display:none;"></span></button>`;
}
function notifMajCloche(){
  const badges = document.querySelectorAll('.notif-count');
  if(!badges.length) return;
  let liste = [];
  try { liste = notifCalculer(); } catch(e) { console.error('Alertes', e); }
  const vus = notifVus(), nouvelles = liste.filter(a => !vus.has(a.id));
  const grave = nouvelles.some(a => a.niveau === 'crit');
  badges.forEach(b => {
    b.style.display = nouvelles.length ? 'flex' : 'none';
    b.textContent = nouvelles.length > 9 ? '9+' : String(nouvelles.length);
    b.style.background = grave ? 'var(--bad)' : 'var(--warn)';
  });
}
function notifPlanifier(){
  if(notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { notifTimer = null; notifMajCloche(); }, 60);
}
const notifUpdateNavBadgesOrigine = window.updateNavBadges;
window.updateNavBadges = function(){
  notifUpdateNavBadgesOrigine();
  notifPlanifier();
};

// --- Panneau ---
function notifModal(html){
  let z = document.getElementById('notif-modal-zone');
  if(!z){ z = document.createElement('div'); z.id = 'notif-modal-zone'; document.body.appendChild(z); }
  z.innerHTML = html === null ? '' : `<div class="modal-backdrop" onclick="if(event.target===this) notifFermer()"><div class="modal-sheet">${html}</div></div>`;
}
window.notifFermer = () => notifModal(null);
window.notifOuvrir = () => { notifListeCourante = notifCalculer(); notifRendre(); };
function notifRendre(){
  const vus = notifVus(), liste = notifListeCourante;
  let corps;
  if(!liste.length) corps = '<div style="text-align:center;padding:26px 6px;color:var(--good);font-weight:700;">Aucune alerte : tout est à jour.</div>';
  else {
    const parSoc = {};
    liste.forEach((a, i) => { (parSoc[a.soc] = parSoc[a.soc] || []).push([a, i]); });
    corps = SOCIETE_KEYS.filter(k => parSoc[k]).map(k => `
      <div style="font-size:11.5px;font-weight:800;color:${SOCIETES[k].couleur};text-transform:uppercase;letter-spacing:.04em;margin:12px 0 6px;">${esc(SOCIETES[k].nom)}</div>
      ${parSoc[k].map(([a, i]) => `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--border);border-radius:11px;margin-bottom:6px;cursor:pointer;${vus.has(a.id) ? 'opacity:.62;' : 'background:var(--surface-2);'}" onclick="notifAller(${i})">
          <span style="width:9px;height:9px;border-radius:50%;background:${NOTIF_NIVEAUX[a.niveau].couleur};flex-shrink:0;margin-top:5px;"></span>
          <div style="min-width:0;flex:1;">
            <div style="font-weight:700;font-size:13.5px;white-space:normal;">${esc(a.titre)}</div>
            <div style="font-size:12px;color:var(--ink-soft);white-space:normal;">${esc(a.detail || '')}</div>
          </div>
          ${vus.has(a.id) ? '' : '<span style="font-size:9.5px;font-weight:800;color:var(--accent-2);flex-shrink:0;">NOUVEAU</span>'}
        </div>`).join('')}`).join('');
  }
  notifModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><h3 style="margin:0;">Alertes</h3><button class="icon-btn" onclick="notifFermer()">✕</button></div>
    ${corps}
    ${liste.length ? '<button class="btn btn-ghost" style="width:100%;margin-top:10px;" onclick="notifToutLu()">Tout marquer comme lu</button>' : ''}`);
}
window.notifToutLu = () => {
  notifEnregistrerVus(new Set(notifListeCourante.map(a => a.id)));
  notifRendre(); notifMajCloche();
};
window.notifAller = (i) => {
  const a = notifListeCourante[i]; if(!a) return;
  const vus = notifVus(); vus.add(a.id); notifEnregistrerVus(vus);
  notifFermer();
  if(!a.ouvrir) return;
  if(modulesDeSociete(a.soc).indexOf(a.ouvrir.module) < 0){ showToast('Ce module n\'est pas accessible avec votre compte'); notifMajCloche(); return; }
  directionOuverte = false; auditOuvert = false;
  activeSociete = a.soc; activeModule = a.ouvrir.module;
  renderShell();
  if(activeTab !== a.ouvrir.tab) nav(a.ouvrir.tab);
};

(function(){
  const s = document.createElement('style');
  s.textContent = `
    .notif-btn{position:relative;}
    .notif-count{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:8px;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #0a2f52;box-sizing:content-box;line-height:1;}
    .notif-btn-clair .notif-count{border-color:#fff;}
  `;
  document.head.appendChild(s);
})();
