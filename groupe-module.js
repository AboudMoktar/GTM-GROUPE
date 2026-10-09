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
  tek:  {nom:'TEK-TREND',    sous:'Confection textile · PERCKO', couleur:'#0B2C4D', logo:'./logo-tek.png', marque:['#0A5C6A', '#0F1F3A'], teinte:'#EEF6F7', modules:['rendement','rh','commandes','factures']},
  gadh: {nom:'GADH TUNISIA', sous:'Sous-traitance assemblage',   couleur:'#8E2A5B', logo:'./logo-gadh.png', marque:['#8B1F4B', '#CFA824', '#058A9E'], teinte:'#FAF3F6', modules:['gadh','machines','factures']},
  mgt:  {nom:'MGT',          sous:'Vente et SAV machines',        couleur:'#2E6B3A', logo:'./logo-mgt.png', marque:['#FF6A13', '#FF6A13'], teinte:'#FFF4EC', modules:['mgt']}
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
    if(m === 'machines') return true;
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
  if(isPortail()){
    const p = currentUser.portail;
    if(p.type === 'mgt') return ['portail/mgt/' + p.clientId];
    const l = portailClientsListe(p);
    return l.length ? l.map(c => 'portail/percko/' + c) : ['portail/percko/tous'];
  }
  const soc = userSocietes();
  const out = soc.slice();
  if(soc.indexOf('tek') >= 0 || soc.indexOf('gadh') >= 0) out.push('liaison');
  return out;
}

// --- Navigation : société → module ---
// Appelée après la connexion (voir enterApp dans index.html).
function enterSociete(){
  if(isPortail()){ renderPortail(); return; }
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


// Logo d'une société (fichier logo-<société>.png à la racine). Si le fichier est absent, on affiche le repli.
function logoRepli(img){ const r = img.getAttribute('data-repli') || ''; img.outerHTML = r; }
// Bande verticale aux couleurs du logo de la société.
function societeBande(k, angle){
  const m = (SOCIETES[k] && SOCIETES[k].marque) || [SOCIETES[k].couleur];
  const seg = 100 / m.length;
  return 'linear-gradient(' + (angle || 180) + 'deg,' + m.map((c, i) => c + ' ' + (i * seg) + '%,' + c + ' ' + ((i + 1) * seg) + '%').join(',') + ')';
}
function societeMot(k){
  if(k === 'tek') return '<span style="font-weight:900;font-size:16px;letter-spacing:-.5px;white-space:nowrap;"><span style="color:var(--accent);">TEK</span> <span style="color:#111;">TREND</span></span>';
  if(k === 'gadh') return '<span style="font-weight:900;font-size:17px;letter-spacing:.5px;color:'+SOCIETES.gadh.couleur+';white-space:nowrap;">GADH</span>';
  return '<span style="font-weight:900;font-size:17px;color:'+SOCIETES[k].couleur+';">'+SOCIETES[k].nom+'</span>';
}
function societeLogo(k, hauteur, repli, largeur){
  const l = SOCIETES[k] && SOCIETES[k].logo; if(!l) return repli;
  return `<img src="${l}" alt="${SOCIETES[k].nom}" data-repli="${esc(repli)}" onerror="logoRepli(this)" style="display:block;height:${hauteur}px;max-width:${largeur || 160}px;object-fit:contain;">`;
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
          ${soc.map(k => `<button class="soc-card" style="--m:${SOCIETES[k].marque[0]};" onclick="chooseSociete('${k}')">
            <span class="soc-bande" style="background:${societeBande(k)};"></span>
            <span class="soc-logo" style="background:${SOCIETES[k].teinte};">${societeLogo(k, 54, societeMot(k), 104)}</span>
            <span class="soc-txt"><span class="soc-nom">${SOCIETES[k].nom}</span><span class="soc-sous">${SOCIETES[k].sous}</span></span>
            <span class="soc-fleche">›</span>
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
      {label:'Machines à l\'arrêt', valeur: val(() => arrIndicateur('tek'))},
      aEncaisser('tek')
    ];
  }
  if(soc === 'gadh'){
    return [
      {label:'Pièces retournées du jour', valeur: val(() => gadhDayTotals(today).totalReel)},
      {label:'Rendement du jour', valeur: val(() => pct(gadhDayTotals(today).rendement))},
      {label:'Présents', valeur: val(() => { const emp = activeGadhEmployees(); const n = emp.filter(([id]) => { const r = resolveGadhDayStatus(id, today); return r.source === 'pointage' && (r.statut === 'present' || r.statut === 'retard'); }).length; return n + ' / ' + emp.length; })},
      {label:'Commandes chez GADH', valeur: val(() => suiviLotsChezGadh())},
      {label:'Machines à l\'arrêt', valeur: val(() => arrIndicateur('gadh'))},
      aEncaisser('gadh')
    ];
  }
  if(soc === 'mgt'){
    const k = () => mgtIndicateurs();
    return [
      {label:'Actions aujourd\'hui', valeur: val(() => k().rdvJour)},
      {label:'Offres en cours', valeur: val(() => { const x = k(); return x.offresEnCours + ' · pipeline ' + Math.round(x.pipeline).toLocaleString('fr-FR'); })},
      {label:'Projets en cours', valeur: val(() => k().projetsEnCours)},
      {label:'Tickets SAV ouverts', valeur: val(() => { const x = savIndicateurs(); return x.ticketsActifs + (x.machinesArret ? ' · ' + x.machinesArret + ' à l\'arrêt' : ''); })},
      aEncaisser('mgt')
    ];
  }
  return [];
}
function arrIndicateur(soc){
  const r = arrResume(soc);
  return r.ouverts ? r.ouverts + ' · ' + arrDuree(r.plusLong) : '0';
}
window.openDirection = () => { activeSociete = null; activeModule = null; renderDirection(); };
function renderDirection(){
  directionOuverte = true;
  const dayLabel = new Date(getTodayISO() + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const carte = (soc) => {
    const ind = directionIndicateurs(soc);
    return `
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="height:6px;background:${societeBande(soc, 90)};"></div>
        <div style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:-16px -16px 14px;padding:12px 16px;background:${SOCIETES[soc].teinte};border-bottom:1px solid var(--border);">
          <h3 style="margin:0;font-size:16px;display:flex;align-items:center;gap:10px;">${societeLogo(soc, 42, '', 120)}<span>${SOCIETES[soc].nom}</span></h3>
          <span style="font-size:11.5px;color:var(--ink-soft);">${SOCIETES[soc].sous}</span>
        </div>
        ${ind.length ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          ${ind.map(i => `<div style="border:1px solid var(--border);border-radius:11px;padding:10px;${i.large ? 'grid-column:1 / -1;' : ''}">
            <div style="font-size:11px;color:var(--ink-soft);font-weight:700;">${i.label}</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:800;margin-top:4px;">${esc(String(i.valeur))}</div>
          </div>`).join('')}
        </div>` : `<p style="font-size:13px;color:var(--ink-soft);margin:0;">Module en préparation (phase 2).</p>`}
        <button class="btn btn-ghost" style="width:100%;margin-top:12px;" onclick="chooseSociete('${soc}')">Ouvrir ${SOCIETES[soc].nom}</button>
        </div>
      </div>`;
  };
  document.getElementById('app').innerHTML = `
    <div style="max-width:1100px;margin:0 auto;padding:20px 16px;">
      <div class="flex-header" style="margin-bottom:16px;">
        <div>
          <h2 style="margin:0;">Vue direction</h2>
          <div style="font-size:12.5px;color:var(--ink-soft);text-transform:capitalize;">${dayLabel}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${typeof notifCloche === 'function' ? notifCloche().replace('class="notif-btn"', 'class="notif-btn notif-btn-clair btn btn-ghost" style="padding:10px 12px;"') : ''}
          ${typeof peutVoirAudit === 'function' && peutVoirAudit() ? '<button class="btn btn-ghost" onclick="auditOuvrir()">Journal d\'audit</button>' : ''}
          <button class="btn btn-ghost" onclick="switchSociete()">Sociétés</button>
          <button class="btn btn-ghost" onclick="logout()">Déconnexion</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
        ${SOCIETE_KEYS.map(carte).join('')}
      </div>
    </div>
  `;
  if(typeof notifMajCloche === 'function') notifMajCloche();
}

// --- Formulaire de compte : sociétés accessibles ---
function accesLabel(u){
  if(typeof isPortail === 'function' && isPortail(u)) return portailLabel(u);
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
  </div>${typeof portailFieldHTML === 'function' ? portailFieldHTML(u) : ''}`;
}
// Retourne {societes, groupe}, ou null (avec un message) si aucune société n'est cochée.
function readSocietesField(){
  const p = typeof portailLireForm === 'function' ? portailLireForm() : {portail:null};
  if(p === null) return null;
  if(p.portail) return {societes:{}, groupe:false, portail:p.portail};
  const groupe = document.getElementById('uf-groupe').checked;
  const societes = {};
  SOCIETE_KEYS.forEach(k => { if(document.getElementById('uf-soc-' + k).checked) societes[k] = true; });
  if(!groupe && Object.keys(societes).length === 0){ showToast('Choisissez au moins une société'); return null; }
  return {societes, groupe, portail:null};
}

// Cartes de choix de société : inspirées des couleurs de chaque logo.
(function(){
  const st = document.createElement('style');
  st.textContent = '.soc-card{display:flex;align-items:stretch;width:100%;padding:0;border:1px solid var(--border);border-radius:16px;background:#fff;overflow:hidden;cursor:pointer;text-align:left;font:inherit;box-shadow:0 2px 8px rgba(15,31,61,.06);transition:transform .12s,box-shadow .12s,border-color .12s;}'
    + '.soc-card:hover{box-shadow:0 6px 18px rgba(15,31,61,.12);border-color:var(--m);}.soc-card:active{transform:scale(.985);}'
    + '.soc-bande{width:7px;flex-shrink:0;}'
    + '.soc-logo{display:flex;align-items:center;justify-content:center;width:118px;flex-shrink:0;padding:12px 10px;}'
    + '.soc-txt{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:3px;padding:14px 8px 14px 14px;}'
    + '.soc-nom{font-size:16px;font-weight:800;color:#111827;letter-spacing:.2px;}.soc-sous{font-size:12px;color:#5B6678;line-height:1.35;}'
    + '.soc-fleche{display:flex;align-items:center;padding:0 16px 0 4px;font-size:26px;color:#9AA4B5;}';
  document.head.appendChild(st);
})();
