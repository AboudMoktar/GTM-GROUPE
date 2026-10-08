// ============================================================
// GROUPE — SOCIÉTÉS, ACCÈS ET ÉCRAN DIRECTION
// ============================================================
// Chargé par index.html via <script src="./groupe-module.js">. Réutilise les
// utilitaires déjà définis dans index.html (getJSON, esc, currentUser,
// activeModule, renderShell, logout, getTodayISO) et, en LECTURE SEULE, les
// fonctions des autres modules pour l'écran direction.
//
// Trois sociétés partagent la même application : TEK-TREND, GADH TUNISIA, MGT.
// Chaque compte (users_v2/{uid}) porte, en plus de son rôle habituel
// (admin / chef_chaine / viewer) :
//  - societes : { tek:true, gadh:true, mgt:true } — sociétés accessibles ;
//  - groupe   : true pour la direction du groupe — toutes les sociétés,
//               écran direction et gestion des comptes.
//
// Côté Firebase, chaque société a son propre dossier (tek/, gadh/, mgt/), et
// les données d'échange TEK-TREND ↔ GADH (commandes de sous-traitance,
// références produit) sont dans liaison/. Les clés de données ne changent pas :
// getJSON/setJSON restent identiques dans tous les modules, seul l'emplacement
// dans la base dépend de la société. Les règles d'accès correspondantes sont
// dans database.rules.json.

const SOCIETES = {
  tek:  {nom:'TEK-TREND',    sous:'Confection textile · PERCKO', couleur:'#0B2C4D', modules:['rendement','rh','commandes','factures']},
  gadh: {nom:'GADH TUNISIA', sous:'Sous-traitance assemblage',   couleur:'#8E2A5B', modules:['gadh','factures']},
  mgt:  {nom:'MGT',          sous:'Vente et SAV machines',        couleur:'#2E6B3A', modules:['mgt']}
};
const SOCIETE_KEYS = ['tek', 'gadh', 'mgt'];
let activeSociete = null; // 'tek' | 'gadh' | 'mgt' | null (null = pas encore choisie)
let directionOuverte = false; // l'écran direction est affiché (pour le rafraîchir à chaque synchro)

// --- Droits ---
function isGroupe(u){ u = u || currentUser; return !!(u && u.groupe); }
function userSocietes(u){
  u = u || currentUser;
  if(!u) return [];
  if(u.groupe) return SOCIETE_KEYS.slice();
  const s = u.societes || {};
  return SOCIETE_KEYS.filter(k => s[k]);
}
// Mode Firebase : seule la direction du groupe gère les comptes (les règles
// Firebase l'imposent aussi). Mode local : le Responsable, comme avant.
function canManageAccounts(){
  if(!currentUser) return false;
  return firebaseConfigured() ? isGroupe() : currentUser.role === 'admin';
}
// Modules d'une société que le compte connecté peut ouvrir.
function modulesDeSociete(soc){
  const def = SOCIETES[soc];
  if(!def) return [];
  return def.modules.filter(m => {
    if(m === 'rendement') return true;
    if(m === 'rh') return canAccessRH();
    if(m === 'gadh') return canAccessGADH();
    if(m === 'commandes') return (typeof canAccessCommandes === 'function' && canAccessCommandes());
    if(m === 'mgt') return true;
    if(m === 'factures') return canAccessFactures();
    return false;
  });
}
function societeDuModule(mod){
  return SOCIETE_KEYS.find(k => SOCIETES[k].modules.indexOf(mod) >= 0) || null;
}

// --- Emplacement Firebase des données ---
// null = à la racine (comptes et sessions, partagés par tout le groupe).
function firebaseDossierDe(key){
  if(key === 'users_v2' || key === 'sessions') return null;
  if(key.indexOf('gadh_') === 0) return 'gadh';
  if(key.indexOf('mgt_') === 0) return 'mgt';
  if(key.indexOf('cmd_') === 0 || key.indexOf('suivi_') === 0 || key === 'prod_references') return 'liaison';
  return 'tek';
}
function firebaseCheminDe(key){
  const d = firebaseDossierDe(key);
  return d ? d + '/' + key : key;
}
// Dossiers de données que le compte connecté peut lire.
function firebaseDossiersLisibles(){
  const soc = userSocietes();
  const out = soc.slice();
  if(soc.indexOf('tek') >= 0 || soc.indexOf('gadh') >= 0) out.push('liaison');
  return out;
}

// --- Navigation : société → module ---
// Appelée après la connexion (voir enterApp dans index.html).
function enterSociete(){
  const soc = userSocietes();
  if(soc.length === 0){ renderAucuneSociete(); return; }
  if(activeSociete && soc.indexOf(activeSociete) < 0) activeSociete = null;
  if(!activeSociete && soc.length === 1 && !isGroupe()) activeSociete = soc[0];
  if(!activeSociete){ renderSocieteSelect(); return; }
  const mods = modulesDeSociete(activeSociete);
  if(activeModule && mods.indexOf(activeModule) >= 0){ renderShell(); return; }
  if(mods.length === 1){ activeModule = mods[0]; renderShell(); return; }
  renderModuleSelect();
}
window.chooseSociete = (soc) => { directionOuverte = false; activeSociete = soc; activeModule = null; enterSociete(); };
window.switchSociete = () => { directionOuverte = false; activeSociete = null; activeModule = null; enterSociete(); };
function peutChangerDeSociete(){ return isGroupe() || userSocietes().length > 1; }

function societeLogoHTML(soc){
  if(soc === 'gadh') return `<div class="logo-wrap" style="margin-bottom:20px;">${ICONS.gadh}</div>`;
  if(soc === 'mgt') return `<div class="logo-wrap" style="margin-bottom:20px;"><div class="logo-text"><span class="tek" style="color:${SOCIETES.mgt.couleur};">MGT</span></div><div class="logo-sub">MACHINES · SAV</div></div>`;
  return `<div class="logo-wrap" style="margin-bottom:20px;"><div class="logo-text"><span class="tek">TEK</span> <span class="trend">TREND</span></div><div class="logo-sub">TECHNICAL WEAR</div></div>`;
}

function renderSocieteSelect(){
  const soc = userSocietes();
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card" style="max-width:440px;">
        <div class="logo-wrap" style="margin-bottom:20px;">
          <div class="logo-text"><span class="tek">GROUPE</span></div>
          <div class="logo-sub">TEK-TREND · GADH TUNISIA · MGT</div>
        </div>
        <h2 style="text-align:center;margin:0 0 4px;font-size:18px;">Quelle société voulez-vous ouvrir ?</h2>
        <p style="text-align:center;color:var(--ink-soft);font-size:12.5px;margin:0 0 20px;">Connecté en tant que ${esc(currentUser.nom)}</p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${isGroupe() ? `<button class="btn btn-primary" style="padding:16px;font-size:15px;justify-content:flex-start;gap:12px;text-align:left;background:#1C2430;" onclick="openDirection()">
            <span style="width:24px;height:24px;flex-shrink:0;">${ICONS.crown}</span>
            <span><span style="display:block;">Vue direction</span><span style="display:block;font-size:11px;font-weight:500;opacity:.8;">Les trois tableaux de bord sur un seul écran</span></span>
          </button>` : ''}
          ${soc.map(k => `<button class="btn btn-primary" style="padding:16px;font-size:15px;justify-content:flex-start;gap:12px;text-align:left;background:${SOCIETES[k].couleur};" onclick="chooseSociete('${k}')">
            <span style="width:24px;height:24px;flex-shrink:0;">${ICONS.factory}</span>
            <span><span style="display:block;">${SOCIETES[k].nom}</span><span style="display:block;font-size:11px;font-weight:500;opacity:.8;">${SOCIETES[k].sous}</span></span>
          </button>`).join('')}
        </div>
        <button class="btn btn-ghost" style="width:100%;margin-top:18px;" onclick="logout()">Déconnexion</button>
      </div>
    </div>
  `;
}

function renderAucuneSociete(){
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card" style="max-width:440px;text-align:center;">
        <h2 style="margin:0 0 8px;font-size:18px;">Aucune société attribuée</h2>
        <p style="color:var(--ink-soft);font-size:13px;margin:0 0 20px;">Votre compte n'a accès à aucune société. Demandez à la direction du groupe de vous en attribuer une.</p>
        <button class="btn btn-ghost" style="width:100%;" onclick="logout()">Déconnexion</button>
      </div>
    </div>
  `;
}


// --- Écran direction : un tableau de bord par société, côte à côte ---
function directionIndicateurs(soc){
  const today = getTodayISO();
  const val = (fn) => { try { const v = fn(); return (v === null || v === undefined || Number.isNaN(v)) ? '—' : v; } catch(e){ console.error('Indicateur direction', soc, e); return '—'; } };
  const pct = (v) => (typeof v === 'number') ? Math.round(v) + ' %' : '—';
  // Factures émises non réglées (et combien sont en retard).
  const aEncaisser = (s) => ({label:'À encaisser', large:true, valeur: val(() => { const f = factIndicateurs(s); return fmtDT(f.aEncaisser) + (f.retard ? ' · ' + f.retard + ' en retard' : ''); })});
  if(soc === 'tek'){
    return [
      {label:'Production du jour', valeur: val(() => computeTotals(getDay(today)).totalGeneral)},
      {label:'Rendement du jour', valeur: val(() => { const t = computeTotals(getDay(today)).totalGeneral; const o = getObjForDay(getDay(today)); return pct(o > 0 ? t / o * 100 : null); })},
      {label:'Présents', valeur: val(() => { const emp = activeEmployees(); const n = emp.filter(([id]) => { const r = resolveDayStatus(id, today); return r.source === 'pointage' && r.status === 'present'; }).length; return n + ' / ' + emp.length; })},
      {label:'Commandes en cours', valeur: val(() => suiviCommandesEnCours())},
      aEncaisser('tek')
    ];
  }
  if(soc === 'gadh'){
    return [
      {label:'Pièces retournées du jour', valeur: val(() => gadhDayTotals(today).totalReel)},
      {label:'Rendement du jour', valeur: val(() => pct(gadhDayTotals(today).rendement))},
      {label:'Présents', valeur: val(() => { const emp = activeGadhEmployees(); const n = emp.filter(([id]) => { const r = resolveGadhDayStatus(id, today); return r.source === 'pointage' && (r.statut === 'present' || r.statut === 'retard'); }).length; return n + ' / ' + emp.length; })},
      {label:'Commandes chez GADH', valeur: val(() => suiviLotsChezGadh())},
      aEncaisser('gadh')
    ];
  }
  if(soc === 'mgt'){
    const k = () => mgtIndicateurs();
    return [
      {label:'RDV aujourd\'hui', valeur: val(() => k().rdvJour)},
      {label:'Devis en attente', valeur: val(() => { const x = k(); return x.devisAttente + ' · ' + fmtDT(x.montantAttente); })},
      {label:'Projets en cours', valeur: val(() => k().projetsEnCours)},
      {label:'Tickets SAV ouverts', valeur: val(() => { const x = savIndicateurs(); return x.ticketsActifs + (x.machinesArret ? ' · ' + x.machinesArret + ' à l\'arrêt' : ''); })},
      aEncaisser('mgt')
    ];
  }
  return [];
}
window.openDirection = () => { activeSociete = null; activeModule = null; renderDirection(); };
function renderDirection(){
  directionOuverte = true;
  const dayLabel = new Date(getTodayISO() + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const carte = (soc) => {
    const ind = directionIndicateurs(soc);
    return `
      <div class="card" style="border-top:4px solid ${SOCIETES[soc].couleur};padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:12px;">
          <h3 style="margin:0;font-size:16px;">${SOCIETES[soc].nom}</h3>
          <span style="font-size:11.5px;color:var(--ink-soft);">${SOCIETES[soc].sous}</span>
        </div>
        ${ind.length ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          ${ind.map(i => `<div style="border:1px solid var(--border);border-radius:11px;padding:10px;${i.large ? 'grid-column:1 / -1;' : ''}">
            <div style="font-size:11px;color:var(--ink-soft);font-weight:700;">${i.label}</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:800;margin-top:4px;">${esc(String(i.valeur))}</div>
          </div>`).join('')}
        </div>` : `<p style="font-size:13px;color:var(--ink-soft);margin:0;">Module en préparation (phase 2).</p>`}
        <button class="btn btn-ghost" style="width:100%;margin-top:12px;" onclick="chooseSociete('${soc}')">Ouvrir ${SOCIETES[soc].nom}</button>
      </div>`;
  };
  document.getElementById('app').innerHTML = `
    <div style="max-width:1100px;margin:0 auto;padding:20px 16px;">
      <div class="flex-header" style="margin-bottom:16px;">
        <div>
          <h2 style="margin:0;">Vue direction</h2>
          <div style="font-size:12.5px;color:var(--ink-soft);text-transform:capitalize;">${dayLabel}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" onclick="switchSociete()">Sociétés</button>
          <button class="btn btn-ghost" onclick="logout()">Déconnexion</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
        ${SOCIETE_KEYS.map(carte).join('')}
      </div>
    </div>
  `;
}

// --- Formulaire de compte : sociétés accessibles ---
function accesLabel(u){
  if(u.groupe) return 'Direction du groupe';
  const soc = userSocietes(u);
  return soc.length ? soc.map(k => SOCIETES[k].nom).join(', ') : 'Aucune société';
}
function societesFieldHTML(u){
  u = u || {};
  const ligne = (id, checked, label) => `<label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:13px;margin:6px 0;"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="width:auto;"> ${label}</label>`;
  return `<div class="field"><label>Accès</label>
    ${ligne('uf-groupe', u.groupe, 'Direction du groupe (toutes les sociétés + vue direction)')}
    ${SOCIETE_KEYS.map(k => ligne('uf-soc-' + k, (u.societes || {})[k], SOCIETES[k].nom)).join('')}
  </div>`;
}
// Retourne {societes, groupe}, ou null (avec un message) si aucune société n'est cochée.
function readSocietesField(){
  const groupe = document.getElementById('uf-groupe').checked;
  const societes = {};
  SOCIETE_KEYS.forEach(k => { if(document.getElementById('uf-soc-' + k).checked) societes[k] = true; });
  if(!groupe && Object.keys(societes).length === 0){ showToast('Choisissez au moins une société'); return null; }
  return {societes, groupe};
}
