// ============================================================
// JOURNAL D'AUDIT — qui a créé, modifié ou supprimé quoi, dans quelle société
// ============================================================
// Chargé par index.html après les autres modules. Il n'oblige aucun module à
// changer : il enveloppe setJSON (point de passage de toutes les écritures) et
// compare la valeur avant / après pour la collection modifiée.
//
// Stockage :
//  - local : une clé « audit_j_AAAA-MM-JJ » par jour = { idEntrée : entrée },
//            et « audit_jours » = liste des jours ayant des entrées ;
//  - Firebase : audit/j/AAAA-MM-JJ/idEntrée (une écriture par entrée, donc
//    aucun écrasement entre appareils). Ces écritures sont silencieuses : si
//    les règles Firebase refusent le chemin « audit », l'application continue
//    sans message d'erreur. Seule la direction du groupe lit le journal (à
//    imposer aussi dans database.rules.json).
//
// Entrée : { t (horodatage), u (nom), un (identifiant), soc, cle, lib,
//            n:{a,m,s}, ids:{id:'a'|'m'|'s'}, noms:{id:nom}, txt?, k? }
// Plusieurs écritures du même compte sur la même collection à moins de 2 minutes
// sont regroupées dans une seule entrée.

const AUDIT_IGNORER = /^(users_v2|sessions|suivi_index|messages|audit_.*|.*compteurs)$/;
const AUDIT_CONSERVATION_JOURS = 120;
const AUDIT_MAX_PAR_JOUR = 400;
const AUDIT_FUSION_MS = 120000;
const AUDIT_LIBELLES = {
  mgt_clients:'Clients MGT', mgt_agenda:'Agenda MGT', mgt_machines:'Parc machines clients', mgt_devis:'Devis',
  mgt_projets:'Projets MGT', mgt_tickets:'Tickets SAV', mgt_pieces:'Pièces détachées', mgt_mouvements:'Mouvements de stock',
  mgt_contrats:'Contrats de maintenance', mgt_parametres:'Paramètres MGT', mgt_demandes:'Demandes SAV des clients',
  factures:'Factures', gadh_factures:'Factures', mgt_factures:'Factures',
  fact_clients:'Clients facturés', gadh_fact_clients:'Clients facturés', mgt_fact_clients:'Clients facturés',
  fact_params:'Paramètres de facturation', gadh_fact_params:'Paramètres de facturation', mgt_fact_params:'Paramètres de facturation',
  tek_machines:'Machines', gadh_machines:'Machines', tek_arrets:'Arrêts machines', gadh_arrets:'Arrêts machines',
  tek_machines_params:'Horaires machines', gadh_machines_params:'Horaires machines',
  ops_history:'Postes des opératrices',
  users_v2:'Comptes'
};
const AUDIT_SOC_NOMS = {tek:'TEK-TREND', gadh:'GADH TUNISIA', mgt:'MGT', liaison:'TEK-TREND ↔ GADH', groupe:'Groupe'};
const AUDIT_SOC_COULEURS = {tek:'#0B2C4D', gadh:'#8E2A5B', mgt:'#2E6B3A', liaison:'#5B4A1E', groupe:'#5B6472'};

const auditSetJSONOrigine = window.setJSON;
const auditEnterAppOrigine = window.enterApp;

function auditSocieteDeCle(key){
  let d = null;
  try { d = firebaseDossierDe(key); } catch(e) {}
  return d || 'groupe';
}
function auditLibelleCle(key){
  if(AUDIT_LIBELLES[key]) return AUDIT_LIBELLES[key];
  const s = key.replace(/^(gadh_|mgt_|tek_)/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}
function auditNomElement(id, v){
  if(id === '·') return '';
  if(v && typeof v === 'object'){
    const n = v.nom || v.numero || v.titre || v.objet || v.designation || v.ref || v.libelle || v.label;
    if(n) return String(n).slice(0, 40);
  }
  return String(id).length > 14 ? '' : String(id);
}
function auditDiff(avant, apres){
  const estObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if(estObj(avant) || estObj(apres)){
    const a = estObj(avant) ? avant : {}, b = estObj(apres) ? apres : {};
    const d = {ajoutes:[], modifies:[], supprimes:[]};
    Object.keys(b).forEach(k => {
      if(!(k in a)) d.ajoutes.push(k);
      else if(JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.modifies.push(k);
    });
    Object.keys(a).forEach(k => { if(!(k in b)) d.supprimes.push(k); });
    return (d.ajoutes.length || d.modifies.length || d.supprimes.length) ? d : null;
  }
  if(JSON.stringify(avant) === JSON.stringify(apres)) return null;
  return {ajoutes:[], modifies:['·'], supprimes:[]};
}

// --- Stockage ---
function auditJour(d){ return getJSON('audit_j_' + d, {}) || {}; }
function auditEcrireLocal(cle, valeur){
  const plein = CACHE_PREFIX + cle;
  memoryCache[plein] = valeur;
  try { window.localStorage.setItem(plein, JSON.stringify(valeur)); } catch(e) {}
}
function auditEcrireDistant(jour, id, entree){
  try {
    if(typeof isPortail === 'function' && isPortail()) return;
    if(typeof firebaseReady !== 'undefined' && firebaseReady && fbRootRef){
      fbRootRef.child('audit/j/' + jour + '/' + id).set(entree).catch(function(){});
    }
  } catch(e) {}
}
function auditEnregistrerJour(jour, id, entree){
  const doc = auditJour(jour);
  if(entree === null) delete doc[id]; else doc[id] = entree;
  const ids = Object.keys(doc);
  if(ids.length > AUDIT_MAX_PAR_JOUR){
    ids.sort((x, y) => (doc[x].t || 0) - (doc[y].t || 0)).slice(0, ids.length - AUDIT_MAX_PAR_JOUR).forEach(k => delete doc[k]);
  }
  auditEcrireLocal('audit_j_' + jour, doc);
  const jours = getJSON('audit_jours', []) || [];
  if(entree !== null && jours.indexOf(jour) < 0){
    jours.push(jour); jours.sort();
    while(jours.length > AUDIT_CONSERVATION_JOURS){ const vieux = jours.shift(); auditEcrireLocal('audit_j_' + vieux, null); }
    auditEcrireLocal('audit_jours', jours);
  }
  auditEcrireDistant(jour, id, entree);
}

function auditNouvelId(){ return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

function auditPoser(e, id, type, nom){
  const ids = e.ids || (e.ids = {}), n = e.n || (e.n = {a:0, m:0, s:0}), nm = e.noms || (e.noms = {});
  const prev = ids[id];
  if(prev === undefined){
    n[type]++;
    if(Object.keys(ids).length < 40) ids[id] = type;
  } else if(prev !== type){
    if(prev === 'a' && type === 's'){ n.a--; delete ids[id]; delete nm[id]; return; } // créé puis supprimé : aucune trace
    let nouveau = type;
    if(prev === 'a' && type === 'm') nouveau = 'a';
    else if(prev === 's' && type === 'a') nouveau = 'm';
    if(nouveau !== prev){ n[prev]--; n[nouveau]++; ids[id] = nouveau; }
  }
  if(nom && Object.keys(nm).length < 5) nm[id] = nom;
}

function auditEnregistrer(cle, avant, apres){
  const maintenant = Date.now(), jour = getTodayISO();
  const soc = auditSocieteDeCle(cle);
  const doc = auditJour(jour);
  const recent = Object.entries(doc).find(([, e]) => e.un === currentUser.username && e.cle === cle && maintenant - (e.t || 0) < AUDIT_FUSION_MS);

  // Documents du suivi des commandes : un document = un lot, on résume en une phrase.
  if(cle.indexOf('suivi_d_') === 0){
    const id = cle.slice(8);
    let txt;
    if(apres === null || apres === undefined) txt = 'Document du suivi supprimé';
    else if(id.indexOf('moves-') === 0){
      const lot = id.slice(6).replace(/-\d+$/, '');
      const n = ((apres && apres.moves) || []).length - ((avant && avant.moves) || []).length;
      txt = n > 0 ? '+' + n + ' mouvement' + (n > 1 ? 's' : '') + ' · lot ' + lot : (n < 0 ? Math.abs(n) + ' mouvement' + (Math.abs(n) > 1 ? 's' : '') + ' retiré' + (Math.abs(n) > 1 ? 's' : '') + ' · lot ' + lot : 'Mouvements corrigés · lot ' + lot);
    }
    else if(id.indexOf('lines-') === 0) txt = 'Lignes de commande modifiées · lot ' + ((apres && apres.lot) || id.slice(6));
    else txt = 'Paramètres du suivi modifiés';
    if(recent && recent[1].txt){
      const [rid, e] = recent;
      e.k = (e.k || 1) + 1; e.t = maintenant; e.txt = txt;
      auditEnregistrerJour(jour, rid, e);
    } else {
      auditEnregistrerJour(jour, auditNouvelId(), {t:maintenant, u:currentUser.nom, un:currentUser.username, soc, cle, lib:'Suivi des commandes', txt});
    }
    return;
  }

  const diff = auditDiff(avant, apres);
  if(!diff) return;
  const nomDe = (id, source) => auditNomElement(id, source && typeof source === 'object' ? source[id] : null);
  if(recent && !recent[1].txt){
    const [rid, e] = recent;
    diff.ajoutes.forEach(id => auditPoser(e, id, 'a', nomDe(id, apres)));
    diff.modifies.forEach(id => auditPoser(e, id, 'm', nomDe(id, apres)));
    diff.supprimes.forEach(id => auditPoser(e, id, 's', nomDe(id, avant)));
    e.t = maintenant;
    if(!(e.n.a + e.n.m + e.n.s)) auditEnregistrerJour(jour, rid, null);
    else auditEnregistrerJour(jour, rid, e);
    return;
  }
  const e = {t:maintenant, u:currentUser.nom, un:currentUser.username, soc, cle, lib:auditLibelleCle(cle), n:{a:0, m:0, s:0}, ids:{}, noms:{}};
  diff.ajoutes.forEach(id => auditPoser(e, id, 'a', nomDe(id, apres)));
  diff.modifies.forEach(id => auditPoser(e, id, 'm', nomDe(id, apres)));
  diff.supprimes.forEach(id => auditPoser(e, id, 's', nomDe(id, avant)));
  auditEnregistrerJour(jour, auditNouvelId(), e);
}

// Connexion : une ligne par compte et par tranche de 30 minutes.
function auditConnexion(){
  if(!currentUser || (typeof isPortail === 'function' && isPortail())) return;
  const cle = CACHE_PREFIX + 'audit_dernier_acces_' + currentUser.username;
  let dernier = 0;
  try { dernier = parseInt(window.localStorage.getItem(cle)) || 0; } catch(e) {}
  const maintenant = Date.now();
  if(maintenant - dernier < 30 * 60000) return;
  try { window.localStorage.setItem(cle, String(maintenant)); } catch(e) {}
  auditEnregistrerJour(getTodayISO(), auditNouvelId(), {t:maintenant, u:currentUser.nom, un:currentUser.username, soc:'groupe', cle:'connexion', lib:'Connexion', txt:'Connexion à l\'application'});
}

// --- Branchement ---
window.setJSON = function(key, value){
  let avant;
  const suivre = !!currentUser && !AUDIT_IGNORER.test(key);
  if(suivre){ try { avant = getJSON(key, null); } catch(e) { avant = undefined; } }
  auditSetJSONOrigine(key, value);
  if(suivre){ try { auditEnregistrer(key, avant, value); } catch(e) { console.error('Journal d\'audit', e); } }
};
window.enterApp = function(){
  try { auditConnexion(); } catch(e) {}
  return auditEnterAppOrigine();
};

// ============================================================
// ÉCRAN DU JOURNAL (direction du groupe)
// ============================================================
function peutVoirAudit(){
  if(!currentUser) return false;
  return isGroupe() || (!firebaseConfigured() && currentUser.role === 'admin');
}
let auditFiltre = {soc:'', user:'', jours:7, q:''};
let auditDonnees = {entrees:[], etat:'vide', erreur:''};
let auditLimite = 120;
let auditOuvert = false;

function auditDateMoins(n){ const d = new Date(); d.setDate(d.getDate() - n); return toISODateLocal(d); }

function auditChargerEntrees(jours){
  const depuis = auditDateMoins(jours);
  const parId = {};
  (getJSON('audit_jours', []) || []).filter(d => d >= depuis).forEach(d => {
    Object.entries(auditJour(d)).forEach(([id, e]) => { parId[d + '/' + id] = e; });
  });
  const finir = (erreur) => ({entrees:Object.values(parId).sort((a, b) => (b.t || 0) - (a.t || 0)), erreur:erreur || ''});
  let distant = null;
  try {
    if(typeof firebaseReady !== 'undefined' && firebaseReady && fbRootRef) distant = fbRootRef.child('audit/j').orderByKey().startAt(depuis).once('value');
  } catch(e) { distant = null; }
  if(!distant) return Promise.resolve(finir(''));
  return distant.then(snap => {
    const j = snap.val() || {};
    Object.keys(j).forEach(d => Object.keys(j[d] || {}).forEach(id => {
      const cle = d + '/' + id, e = j[d][id];
      if(!parId[cle] || (e.t || 0) >= (parId[cle].t || 0)) parId[cle] = e;
    }));
    return finir('');
  }).catch(() => finir('Lecture du journal partagé impossible : seules les entrées de cet appareil sont affichées.'));
}

window.auditOuvrir = () => {
  if(!peutVoirAudit()){ showToast('Accès réservé à la direction du groupe'); return; }
  directionOuverte = false; auditOuvert = true; auditLimite = 120;
  auditDonnees = {entrees:[], etat:'chargement', erreur:''};
  renderAudit();
  auditActualiser();
};
function auditActualiser(){
  auditDonnees.etat = 'chargement';
  auditChargerEntrees(auditFiltre.jours).then(r => {
    auditDonnees = {entrees:r.entrees, etat:'pret', erreur:r.erreur};
    if(auditOuvert) renderAudit();
  });
}
window.auditFermer = () => { auditOuvert = false; openDirection(); };
window.auditChanger = (champ, valeur) => {
  if(champ === 'jours'){ auditFiltre.jours = Number(valeur); auditLimite = 120; renderAudit(); auditActualiser(); return; }
  auditFiltre[champ] = valeur; auditLimite = 120; renderAuditListe();
};
window.auditPlus = () => { auditLimite += 120; renderAuditListe(); };

function auditTexteEntree(e){
  if(e.txt) return esc(e.txt) + (e.k > 1 ? ' <span style="color:var(--ink-faint);">× ' + e.k + '</span>' : '');
  const n = e.n || {a:0, m:0, s:0}, p = [];
  if(n.a) p.push(n.a > 1 ? n.a + ' créés' : 'Créé');
  if(n.m) p.push(n.m > 1 ? n.m + ' modifiés' : 'Modifié');
  if(n.s) p.push(n.s > 1 ? n.s + ' supprimés' : 'Supprimé');
  const noms = Object.values(e.noms || {}).filter(Boolean);
  return '<b>' + esc(e.lib || e.cle) + '</b> · ' + p.join(', ') + (noms.length ? ' <span style="color:var(--ink-soft);">(' + noms.map(esc).join(', ') + (Object.keys(e.ids || {}).length > noms.length ? '…' : '') + ')</span>' : '');
}
function auditFiltrer(){
  const q = auditFiltre.q.trim().toLowerCase();
  return auditDonnees.entrees.filter(e => {
    if(auditFiltre.soc && e.soc !== auditFiltre.soc) return false;
    if(auditFiltre.user && e.un !== auditFiltre.user) return false;
    if(q){
      const hay = ((e.u || '') + ' ' + (e.lib || '') + ' ' + (e.txt || '') + ' ' + Object.values(e.noms || {}).join(' ')).toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    return true;
  });
}
function renderAuditListe(){
  const z = document.getElementById('audit-liste'); if(!z) return;
  if(auditDonnees.etat === 'chargement'){ z.innerHTML = '<div class="card" style="text-align:center;color:var(--ink-soft);">Chargement du journal…</div>'; return; }
  const liste = auditFiltrer();
  if(!liste.length){ z.innerHTML = '<div class="card" style="text-align:center;color:var(--ink-soft);">Aucune entrée pour ces filtres.</div>'; return; }
  const vues = liste.slice(0, auditLimite);
  let jourCourant = '', html = '';
  vues.forEach(e => {
    const d = new Date(e.t), jour = toISODateLocal(d);
    if(jour !== jourCourant){
      jourCourant = jour;
      html += '<div style="font-size:12px;font-weight:800;color:var(--ink-soft);text-transform:capitalize;margin:14px 2px 6px;">' + esc(d.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'})) + '</div>';
    }
    const c = AUDIT_SOC_COULEURS[e.soc] || '#5B6472';
    html += '<div class="card" style="padding:9px 11px;margin-bottom:6px;border-left:4px solid ' + c + ';">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11.5px;color:var(--ink-soft);">'
      + '<span><b style="color:var(--ink);">' + esc(e.u || '—') + '</b> · ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) + '</span>'
      + '<span style="font-weight:800;color:' + c + ';">' + esc(AUDIT_SOC_NOMS[e.soc] || e.soc || '') + '</span></div>'
      + '<div style="font-size:13px;margin-top:3px;">' + auditTexteEntree(e) + '</div></div>';
  });
  if(liste.length > vues.length) html += '<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="auditPlus()">Afficher plus (' + (liste.length - vues.length) + ' restantes)</button>';
  z.innerHTML = '<div style="font-size:11.5px;color:var(--ink-faint);margin:0 2px 4px;">' + liste.length + ' entrée' + (liste.length > 1 ? 's' : '') + '</div>' + html;
}
function renderAudit(){
  const users = {};
  auditDonnees.entrees.forEach(e => { if(e.un) users[e.un] = e.u || e.un; });
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>';
  document.getElementById('app').innerHTML = `
    <div style="width:100%;flex:1 1 100%;max-width:960px;margin:0 auto;padding:20px 14px 40px;">
      <div class="flex-header">
        <div><h2 style="margin:0;">Journal d'audit</h2><div style="font-size:12.5px;color:var(--ink-soft);">Qui a modifié quoi, dans quelle société</div></div>
        <div class="actions"><button class="btn btn-ghost" onclick="auditFermer()">← Vue direction</button></div>
      </div>
      ${auditDonnees.erreur ? '<div class="card" style="background:var(--warn-bg);color:var(--warn);font-size:12.5px;font-weight:600;">' + esc(auditDonnees.erreur) + '</div>' : ''}
      <div class="card" style="padding:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <select class="mgt-in" onchange="auditChanger('soc', this.value)">${opt('', 'Toutes les sociétés', auditFiltre.soc)}${['tek', 'gadh', 'mgt', 'liaison', 'groupe'].map(k => opt(k, AUDIT_SOC_NOMS[k], auditFiltre.soc)).join('')}</select>
          <select class="mgt-in" onchange="auditChanger('user', this.value)">${opt('', 'Tous les comptes', auditFiltre.user)}${Object.keys(users).sort().map(k => opt(k, users[k], auditFiltre.user)).join('')}</select>
          <select class="mgt-in" onchange="auditChanger('jours', this.value)">${[[1, 'Aujourd\'hui'], [7, '7 derniers jours'], [30, '30 derniers jours'], [90, '90 derniers jours']].map(([v, l]) => opt(v, l, auditFiltre.jours)).join('')}</select>
          <input class="mgt-in" type="search" placeholder="Rechercher…" value="${esc(auditFiltre.q)}" oninput="auditChanger('q', this.value)">
        </div>
      </div>
      <div id="audit-liste"></div>
    </div>`;
  renderAuditListe();
}

(function(){
  const s = document.createElement('style');
  s.textContent = '#audit-liste .card{box-shadow:none;}';
  document.head.appendChild(s);
})();
