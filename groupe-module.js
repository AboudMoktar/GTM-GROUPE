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
// dans database.rules.v2.json.

const SOCIETES = {
  tek:  {nom:'TEK-TREND',    sous:'Confection textile · PERCKO', couleur:'#0B2C4D', logo:'./logo-tek.png', marque:['#006070', '#006070'], teinte:'#EEF6F7', modules:['rendement','rh','commandes','stock','factures']},
  gadh: {nom:'GADH TUNISIA', sous:'Sous-traitance assemblage',   couleur:'#9C335B', logo:'./logo-gadh.png', marque:['#C2346E', '#C5BA3C', '#138C94'], teinte:'#F8E4EC', modules:['gadh','gadh-rh','gadh-commandes','machines','factures']},
  mgt:  {nom:'MGT',          sous:'Vente et SAV machines',        couleur:'#2E6B3A', logo:'./logo-mgt.png', marque:['#CB4E1D', '#CB4E1D'], teinte:'#FBEEE8', modules:['mgt']}
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
    if(m === 'gadh-rh') return canAccessGADH();
    if(m === 'gadh-commandes') return true; // droits : roles-config.js (gadh.commandes) ; remplace « Achats et stock » et « Ventes »
    if(m === 'commandes') return (typeof canAccessCommandes === 'function' && canAccessCommandes());
    if(m === 'stock') return (typeof canAccessCommandes === 'function' && canAccessCommandes()); // Gestion de stock TEK-TREND (27/11/2026) : mêmes comptes que le suivi ; écriture : roles-config.js (tek.stock)
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
// Portail client supprimé (aucun compte externe) : conservé comme fonction vide
// pour les modules qui la consultent encore.
function isPortail(){ return false; }
// Sources de données que le compte connecté peut lire.
//  - 'tek'                : tout le dossier ;
//  - 'tek|cle|employees'  : une seule clé ;
//  - 'tek|pref|prod_2'    : toutes les clés commençant par ce préfixe.
// Les rôles viennent de roles-config.js (même source que les règles Firebase).
// Un ancien compte sans profil garde le fonctionnement d'avant (dossiers entiers).
// Grosses clés chargées SEULEMENT quand on en a besoin (audit D1 : quota de téléchargement Firebase) :
// la liste du CRM MGT (catalogue d'articles, ~3,5 Mo) n'est téléchargée qu'à l'ouverture du CRM.
// Un dossier lu en entier est alors écouté en deux morceaux (« avant » et « après » cette clé),
// et la clé elle-même est une source « à la demande » (voir firebaseChargerALaDemande, index.html).
const FB_CLE_A_LA_DEMANDE = {mgt: 'mgt_crm_listing'};
function firebaseDossiersLisibles(){
  const R = window.GTM_ROLES, p = currentUser && currentUser.profil;
  if(R && p && R.ROLES[p]){
    const out = [];
    ['tek', 'gadh', 'liaison', 'mgt'].forEach(d => {
      const s = R.sourcesLecture(p, d), lourde = FB_CLE_A_LA_DEMANDE[d];
      if(s === 'tout'){ if(lourde){ out.push(d + '|avant|' + lourde); out.push(d + '|apres|' + lourde); } else out.push(d); }
      else if(s){ s.cles.forEach(c => { if(c !== lourde) out.push(d + '|cle|' + c); }); s.prefixes.forEach(x => out.push(d + '|pref|' + x)); }
    });
    return out;
  }
  const soc = userSocietes();
  const out = soc.slice();
  if(soc.indexOf('tek') >= 0 || soc.indexOf('gadh') >= 0) out.push('liaison');
  return out;
}
// Une source couvre-t-elle cette clé ?
function firebaseSourceCouvre(source, cle){
  const [, type, val] = String(source).split('|');
  if(!type) return true;
  if(type === 'avant') return String(cle) < val;
  if(type === 'apres') return String(cle) > val;
  return type === 'cle' ? cle === val : String(cle).indexOf(val) === 0;
}
// Sources « à la demande » que ce compte a le droit de lire (ex. « mgt|cle|mgt_crm_listing »).
function firebaseSourcesALaDemande(){
  const R = window.GTM_ROLES, p = currentUser && currentUser.profil;
  if(!(R && p && R.ROLES[p])) return [];
  const out = [];
  Object.keys(FB_CLE_A_LA_DEMANDE).forEach(d => {
    const s = R.sourcesLecture(p, d), c = FB_CLE_A_LA_DEMANDE[d];
    if(s === 'tout' || (s && (s.cles.indexOf(c) >= 0 || s.prefixes.some(x => c.indexOf(x) === 0)))) out.push(d + '|cle|' + c);
  });
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
  const S = SOCIETES[soc]; if(!S) return '';
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:12px;">${societeLogo(soc, 64, societeMot(soc), 260)}<div style="width:64px;height:4px;border-radius:2px;background:${societeBande(soc, 90)};"></div></div>`;
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
// ============================================================
// Écrans d'accueil (choix de la société, choix du module) — maquette « GTM GROUPE » validée par la direction.
// Styles dans accueil.css. Présentation seule : les droits (userSocietes, isGroupe, canManageAccounts,
// peutChangerDeSociete, modulesDeSociete) et les actions (chooseSociete, chooseModule, openDirection,
// ouvrirAdmin, switchSociete, logout, menuUtilisateur, notifOuvrir) sont ceux de l'application, inchangés.
// Les trois logos sont les fichiers officiels (logo-tek.png, logo-gadh.png, logo-mgt.png), affichés entiers.
// ============================================================
const GTMH_SOC = {
  tek:  {c1:'#14B8A6', c2:'#0E7C9C', clair:'#E3F6F5', activite:'Confection textile – PERCKO'},
  gadh: {c1:'#E91E63', c2:'#C2185B', clair:'#FCE4EE', activite:'Sous-traitance – Assemblage'},
  mgt:  {c1:'#F59E0B', c2:'#EA7A0B', clair:'#FEF1DC', activite:'Vente et SAV machines'}
};
// Couleur et icône de chaque module (cartes de l'écran des modules).
const GTMH_MOD = {
  'tek-dashboard':  ['#3B8DF0', '#1565D8', 'barres'],
  'gadh-tableau':   ['#3B8DF0', '#1565D8', 'barres'],
  'rendement':      ['#34C26E', '#15964A', 'chrono'],
  'gadh':           ['#34C26E', '#15964A', 'chrono'],
  'chaine':         ['#A274F5', '#7542DD', 'duo'],
  'rh':             ['#FBB03B', '#F07C0C', 'groupe'],
  'gadh-rh':        ['#FBB03B', '#F07C0C', 'groupe'],
  'commandes':      ['#2CC4C9', '#0E8FA6', 'boite'],
  'gadh-commandes': ['#2CC4C9', '#0E8FA6', 'boite'],
  'stock':          ['#3B6FD8', '#16348C', 'boite'],
  'machines':       ['#64748B', '#334155', 'cle'],
  'factures':       ['#F2477E', '#D11A5B', 'facture']
};
const GTMH_ICO = {
  barres: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.5" y="12" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="16.5" y="4" width="4" height="16" rx="1"/><rect x="2" y="20.5" width="20" height="1.6" rx=".8"/></svg>',
  chrono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="7.5"/><path d="M12 14V10.2"/><path d="M9.5 2.5h5"/><path d="M12 2.5v4"/><path d="M18.6 7.4l1.6-1.6"/></svg>',
  duo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.6"/><path d="M2.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><circle cx="17" cy="9" r="2.7"/><path d="M16.5 14.1c3 .2 5.3 2.7 5.3 5.9"/></svg>',
  groupe: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7.2" r="3.3"/><circle cx="5.2" cy="9" r="2.5"/><circle cx="18.8" cy="9" r="2.5"/><path d="M6.4 20c0-3.6 2.5-6.4 5.6-6.4s5.6 2.8 5.6 6.4z"/><path d="M1 19.5c0-2.8 1.8-5 4.2-5 .9 0 1.7.3 2.4.8-1 1.3-1.6 2.9-1.7 4.2z"/><path d="M23 19.5c0-2.8-1.8-5-4.2-5-.9 0-1.7.3-2.4.8 1 1.3 1.6 2.9 1.7 4.2z"/></svg>',
  boite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5l8.5 4.6v9.8L12 21.5l-8.5-4.6V7.1z" fill="rgba(255,255,255,.18)"/><path d="M3.5 7.1L12 11.7l8.5-4.6"/><path d="M12 11.7v9.8"/><path d="M7.8 4.8l8.5 4.6"/></svg>',
  cle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/></svg>',
  facture: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" fill="rgba(255,255,255,.18)"/><path d="M14 2.5V8h5.5"/><path d="M12 10.3v8"/><path d="M14.3 11.8c-.5-.7-1.3-1-2.3-1-1.3 0-2.3.7-2.3 1.6 0 2.2 4.7 1.1 4.7 3.4 0 .9-1 1.6-2.4 1.6-1.1 0-1.9-.4-2.4-1.1"/></svg>',
  couture: '<svg viewBox="0 0 32 28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V8.5A2.5 2.5 0 0 1 7.5 6h15A4.5 4.5 0 0 1 27 10.5V14h-5.5"/><path d="M21.5 14v5"/><path d="M19.5 19h4"/><path d="M2 21.5h28v3.5H2z"/><path d="M10 10.5h7"/><circle cx="24" cy="10" r="1.2" fill="currentColor"/></svg>',
  personnes: '<svg viewBox="0 0 32 26" fill="currentColor"><circle cx="16" cy="6.5" r="4.5"/><circle cx="6.5" cy="9" r="3.4"/><circle cx="25.5" cy="9" r="3.4"/><path d="M8.5 24c0-5 3.4-8.8 7.5-8.8s7.5 3.8 7.5 8.8z"/><path d="M.5 23.5c0-3.8 2.5-6.8 5.8-6.8 1.2 0 2.3.4 3.2 1.1-1.3 1.7-2.1 3.8-2.2 5.7z"/><path d="M31.5 23.5c0-3.8-2.5-6.8-5.8-6.8-1.2 0-2.3.4-3.2 1.1 1.3 1.7 2.1 3.8 2.2 5.7z"/></svg>',
  engrenages: '<svg viewBox="0 0 36 30" fill="currentColor"><path fill-rule="evenodd" d="M12.6 1.5h3.8l.6 3.1 2.2.9 2.6-1.8 2.7 2.7-1.8 2.6.9 2.2 3.1.6v3.8l-3.1.6-.9 2.2 1.8 2.6-2.7 2.7-2.6-1.8-2.2.9-.6 3.1h-3.8l-.6-3.1-2.2-.9-2.6 1.8-2.7-2.7 1.8-2.6-.9-2.2-3.1-.6v-3.8l3.1-.6.9-2.2-1.8-2.6 2.7-2.7 2.6 1.8 2.2-.9zM14.5 9.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8z"/><path fill-rule="evenodd" d="M27.4 16.5h2.4l.4 1.9 1.3.6 1.6-1.1 1.7 1.7-1.1 1.6.6 1.3 1.9.4v2.4l-1.9.4-.6 1.3 1.1 1.6-1.7 1.7-1.6-1.1-1.3.6-.4 1.9h-2.4l-.4-1.9-1.3-.6-1.6 1.1-1.7-1.7 1.1-1.6-.6-1.3-1.9-.4v-2.4l1.9-.4.6-1.3-1.1-1.6 1.7-1.7 1.6 1.1 1.3-.6zM28.6 21.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z"/></svg>',
  maison: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.2L12 3.5l9 7.7"/><path d="M5.5 9.5V20.5h4.8v-6h3.4v6h4.8V9.5"/></svg>',
  usine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 21V10l5 3V10l5 3V5h4l1 3v13z"/><path d="M7 17h2M11 17h2M15 17h2"/></svg>',
  machine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M7 8h6M7 11h4"/><circle cx="17" cy="10" r="2"/><path d="M5 16v4M19 16v4M3 20h18"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 20V13M9 20V9M14 20v-5M19 20V5"/><path d="M2 21h20"/></svg>',
  reglages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  echange: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8.5A8 8 0 0 0 6 5.3L4 7.2"/><path d="M4 3v4.2h4.2"/><path d="M4 15.5a8 8 0 0 0 14 3.2l2-1.9"/><path d="M20 21v-4.2h-4.2"/></svg>',
  marche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 2.5v9"/><path d="M18.4 6.4a9 9 0 1 1-12.8 0"/></svg>',
  fleche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="18" y2="12"/><polyline points="12.5 6.5 18 12 12.5 17.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>',
  bas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  personne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>'
};
function gtmhPeutAdmin(){ return typeof ouvrirAdmin === 'function' && canManageAccounts(); }
function gtmhLogo(k){ return societeLogo(k, 120, societeMot(k), 400); }
// Nom du groupe (texte) avec son arc ; « clair » = sur fond bleu nuit.
function gtmhNomGroupe(clair, id){
  return `<div class="gtmh-wm${clair ? ' clair' : ''}">
    <svg class="gtmh-wm-arc" viewBox="0 0 220 40" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">${clair
      ? '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".25" stop-color="#9CC8FF"/><stop offset="1" stop-color="#FFFFFF"/>'
      : '<stop offset="0" stop-color="#0D3E6D"/><stop offset=".65" stop-color="#1677E8"/><stop offset=".86" stop-color="#1677E8"/><stop offset="1" stop-color="#F59E0B"/>'}</linearGradient></defs>
      <path d="${clair ? 'M6 38 Q60 2 214 10' : 'M30 36 Q110 -4 196 24'}" fill="none" stroke="url(#${id})" stroke-width="${clair ? 5 : 7}" stroke-linecap="round"/></svg>
    <b>GTM</b><b class="gtmh-wm-groupe">GROUPE</b>
  </div>`;
}
function gtmhCloche(){ return typeof notifCloche === 'function' ? notifCloche() : ''; }
function gtmhApresRendu(){ if(typeof notifMajCloche === 'function') setTimeout(notifMajCloche, 0); }
function gtmhInitiale(){ return esc(String(currentUser.nom || currentUser.username || '?').trim().charAt(0).toUpperCase() || '?'); }
// Vague colorée en bas des cartes société (deux nappes, couleurs de la société).
function gtmhVague(k){
  const c = GTMH_SOC[k] || GTMH_SOC.tek;
  return `<svg class="gtmh-vague-svg" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gtmhV-${k}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${c.c2}"/><stop offset=".55" stop-color="${c.c1}"/><stop offset="1" stop-color="${c.c1}" stop-opacity=".55"/></linearGradient></defs>
    <path d="M0 34 C 110 4, 210 70, 400 18 L400 100 L0 100 Z" fill="${c.c1}" opacity=".22"/>
    <path d="M0 52 C 120 22, 230 88, 400 40 L400 100 L0 100 Z" fill="url(#gtmhV-${k})"/></svg>`;
}

function renderSocieteSelect(){
  const soc = userSocietes();
  const icoCarte = {tek:GTMH_ICO.couture, gadh:GTMH_ICO.personnes, mgt:GTMH_ICO.engrenages};
  document.getElementById('app').innerHTML = `
    <div class="gtmh gtmh-soc">
      <aside class="gtmh-hero">
        <div class="gtmh-hero-txt">
          ${gtmhNomGroupe(true, 'gtmhArcHero')}
          <p class="gtmh-slogan">Ensemble<br>pour plus de performance</p>
        </div>
      </aside>
      <div class="gtmh-scene">
        <header class="gtmh-haut">
          <div class="gtmh-entete">
            ${gtmhNomGroupe(false, 'gtmhArcTete')}
            <div class="gtmh-entete-soc">TEK-TREND <i>|</i> GADH TUNISIA <i>|</i> MGT</div>
          </div>
          <div class="gtmh-actions">
            ${isGroupe() ? `<button class="gtmh-pill fonce" onclick="openDirection()">${GTMH_ICO.barres}<span>Vue direction</span></button>` : ''}
            ${gtmhPeutAdmin() ? `<button class="gtmh-pill" onclick="ouvrirAdmin()">${GTMH_ICO.reglages}<span>Administration</span></button>` : ''}
            ${gtmhCloche()}
            <button class="gtmh-avatar" onclick="menuUtilisateur(event)" title="${esc(currentUser.nom)}" aria-label="Menu du compte">${gtmhInitiale()}</button>
          </div>
        </header>
        <main class="gtmh-centre">
          <h1>Quelle société voulez-vous ouvrir ?</h1>
          <p class="gtmh-qui">${GTMH_ICO.personne}<span>Connecté en tant que <b>${esc(currentUser.nom)}</b></span></p>
          <div class="gtmh-societes" data-n="${soc.length}">
            ${soc.map(k => { const c = GTMH_SOC[k] || GTMH_SOC.tek; return `<button class="gtmh-scarte" data-soc="${k}" style="--c1:${c.c1};--c2:${c.c2};--clair:${c.clair};" onclick="chooseSociete('${k}')">
              <span class="gtmh-logo">${gtmhLogo(k)}</span>
              <span class="gtmh-nom">${SOCIETES[k].nom}</span>
              <span class="gtmh-sous">${c.activite}</span>
              <span class="gtmh-vague">${gtmhVague(k)}<span class="gtmh-vague-ico">${icoCarte[k] || ''}</span><span class="gtmh-aller">${GTMH_ICO.fleche}</span></span>
            </button>`; }).join('')}
          </div>
          <div class="gtmh-pied"><button class="gtmh-pill fonce gtmh-deco" onclick="logout()">${GTMH_ICO.marche}<span>Déconnexion</span></button></div>
        </main>
      </div>
    </div>
  `;
  gtmhApresRendu();
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
  const aEncaisser = (s) => ({label:'À encaisser', large:true, valeur: val(() => { const f = factIndicateurs(s); return (s === 'tek' ? (Number(f.aEncaisser) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €' : fmtDT(f.aEncaisser)) + (f.retard ? ' · ' + f.retard + ' en retard' : ''); })});
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
    <div style="width:100%;flex:1 1 100%;max-width:1280px;margin:0 auto;padding:24px 20px;">
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
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start;">
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
    + '.mod-ico{display:flex;align-items:center;justify-content:center;width:84px;flex-shrink:0;}.mod-ico svg{width:30px;height:30px;}'
    + '.lb-chip img{max-width:100% !important;height:auto !important;max-height:46px;}'
    + '.login-large{max-width:520px !important;}'
    + '.login-split{padding:0 !important;max-width:430px !important;overflow:hidden;}.login-brand{background:linear-gradient(150deg,#0F1F3D 0%,#173A63 100%);color:#fff;padding:26px 24px;text-align:center;}.lb-titre{font-size:28px;font-weight:900;letter-spacing:1px;}.lb-titre span{color:#8FB8E8;}.lb-sous{font-size:13px;opacity:.8;margin:4px 0 18px;}.lb-logos{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}.lb-chip{display:flex;align-items:center;justify-content:center;width:98px;height:64px;background:#fff;border-radius:12px;padding:6px 8px;box-sizing:border-box;}.lb-pied{display:none;font-size:11px;letter-spacing:2px;opacity:.6;margin-top:22px;}.login-cote{padding:26px 28px 30px;}.lc-titre{margin:0 0 4px;font-size:22px;}.lc-sous{margin:0 0 18px;color:var(--ink-soft);font-size:13.5px;}'
    + '@media (min-width:900px){.login-wrap{width:100%;flex:1 1 100%;}.login-split{display:grid;grid-template-columns:1.05fr 1fr;max-width:900px !important;min-height:520px;border-radius:22px !important;box-shadow:0 20px 50px rgba(15,31,61,.18) !important;}.login-brand{display:flex;flex-direction:column;justify-content:center;padding:44px 36px;}.lb-titre{font-size:40px;}.lb-logos{flex-direction:column;align-items:center;gap:12px;}.lb-chip{width:210px;height:84px;}.lb-pied{display:block;}.login-cote{display:flex;flex-direction:column;justify-content:center;padding:44px 48px;}.lc-titre{font-size:28px;}}'
    + '@media (min-width:1024px){.login-wrap{width:100%;flex:1 1 100%;}}'
    + '.soc-fleche{display:flex;align-items:center;padding:0 16px 0 4px;font-size:26px;color:#9AA4B5;}';
  document.head.appendChild(st);
})();


// --- Réinitialisation (phase de test) ---
// Efface l'historique d'une société ; les paramètres (employés, modèles, cadences,
// horaires…) sont gardés sauf si l'on répond « oui » à la 2e question.
const REINIT_PARAMS = ['schedule','employees','ops','ops_history','obj_horaire_op','fc_modeles','fc_params','rh_departements','prod_references','gadh_employees','gadh_cadences','gadh_plannings'];
const REINIT_GARDER = ['users_v2','sessions','prod_v4_migre'];
// Réinitialisation réservée à l'administrateur / développeur (compte mokhtar) : invisible pour tous les autres.
function estAdminSysteme(){ return !!currentUser && currentUser.profil === 'sysadmin'; }
window.reinitialiserSociete = async function(soc){
  if(!estAdminSysteme()){ showToast('Réservé à l\'administrateur'); return; }
  const nom = soc === 'gadh' ? 'GADH' : 'TEK-TREND';
  if(!confirm('Effacer tout l\'historique de ' + nom + ' ?\nCette action est définitive.')) return;
  const tout = confirm('Supprimer AUSSI les paramètres de ' + nom + ' (employés, modèles, cadences, horaires) ?\n\nOK = tout supprimer\nAnnuler = garder les paramètres');
  const mot = prompt('Pour confirmer, tapez EFFACER');
  if(!mot || mot.trim().toUpperCase() !== 'EFFACER'){ showToast('Annulé'); return; }
  const dossiers = soc === 'gadh' ? ['gadh'] : ['tek'];
  const keys = new Set();
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i) || '';
      if(k.indexOf(CACHE_PREFIX) === 0) keys.add(k.slice(CACHE_PREFIX.length));
    }
  }catch(e){}
  Object.keys(memoryCache).forEach(k => { if(k.indexOf(CACHE_PREFIX) === 0) keys.add(k.slice(CACHE_PREFIX.length)); });
  // Seul le dossier de la société est concerné. Les données communes TEK-TREND ↔ GADH (dossier liaison :
  // commandes et suivi PERCKO, références) ne sont JAMAIS effacées par une réinitialisation.
  const sauvegarde = {};
  if(firebaseReady && fbRootRef){
    for(const d of dossiers){
      try{ const snap = await fbRootRef.child(d).once('value'); const v = snap.val() || {}; Object.keys(v).forEach(k => { keys.add(k); sauvegarde[k] = v[k]; }); }catch(e){}
    }
  }
  const aEffacer = Array.from(keys).filter(k => REINIT_GARDER.indexOf(k) < 0 && firebaseDossierDe(k) === dossiers[0] && (tout || REINIT_PARAMS.indexOf(k) < 0));
  // Copie de sauvegarde téléchargée avant tout effacement.
  try{
    const copie = {}; aEffacer.forEach(k => { if(sauvegarde[k] !== undefined) copie[k] = sauvegarde[k]; });
    const url = URL.createObjectURL(new Blob([JSON.stringify({societe:soc, dossier:dossiers[0], date:new Date().toISOString(), par:currentUser.username, donnees:copie})], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'sauvegarde-' + soc + '-avant-reinitialisation-' + getTodayISO() + '.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }catch(e){ if(!confirm('La copie de sauvegarde n\'a pas pu être téléchargée. Continuer quand même ?')) return; }
  let n = 0; const taches = [];
  aEffacer.forEach(k => {
    delete memoryCache[CACHE_PREFIX + k];
    try{ localStorage.removeItem(CACHE_PREFIX + k); }catch(e){}
    if(firebaseReady && fbRootRef) taches.push(fbRootRef.child(firebaseCheminDe(k)).remove().catch(function(){}));
    n++;
  });
  try{ await Promise.all(taches); }catch(e){}
  showToast('✓ ' + nom + ' réinitialisé (' + n + ' éléments effacés)');
  setTimeout(function(){ nav(activeTab); }, 300);
};

// --- Logo de la société sur les documents imprimés (devis, commandes, livraisons, factures, bons d'achat, rapports) ---
// Les logos sont préchargés en image intégrée : ils s'impriment même hors ligne et dans la fenêtre d'impression.
const LOGOS_DOC = {};
(function logoDocPrecharger(){
  Object.keys(SOCIETES).forEach(k => {
    const l = SOCIETES[k].logo; if(!l || typeof fetch !== 'function') return;
    fetch(l).then(r => r.ok ? r.blob() : null).then(b => { if(!b) return; const fr = new FileReader(); fr.onload = () => { LOGOS_DOC[k] = fr.result; }; fr.readAsDataURL(b); }).catch(() => {});
  });
})();
function logoDocSrc(soc){ const s = SOCIETES[soc]; if(!s || !s.logo) return ''; return LOGOS_DOC[soc] || new URL(s.logo, location.href).href; }
function logoDocHTML(soc, hauteurMm, style){
  const src = logoDocSrc(soc); if(!src) return '';
  return `<img src="${src}" alt="${esc(SOCIETES[soc].nom)}" onerror="this.remove()" style="display:block;height:${hauteurMm || 18}mm;max-width:60mm;object-fit:contain;object-position:left center;margin:0 0 2.5mm;${style || ''}">`;
}

// --- Indicateurs cliquables ---
// kpiAller : ouvre un module (et un onglet) depuis un indicateur, si le rôle y a accès.
window.kpiAller = function(soc, mod, tab){
  try {
    if(soc && mod && typeof modulesDeSociete === 'function' && modulesDeSociete(soc).indexOf(mod) < 0){ showToast('Ce détail n\'est pas accessible avec votre profil'); return; }
    directionOuverte = false;
    if(soc && activeSociete !== soc){ activeSociete = soc; activeModule = null; }
    if(mod && activeModule !== mod) chooseModule(mod);
    if(tab) nav(tab);
    window.scrollTo(0, 0);
  } catch(e) { console.error('Indicateur', e); }
};
// kpiSuivant : fait défiler jusqu'au détail affiché sous le groupe d'indicateurs (liste, tableau, carte).
window.kpiSuivant = function(el){
  const groupe = el.closest('.kpi-mini-grid, .kpi-grid, .dd-boites, .dd-jauges4') || el;
  let n = groupe, cible = null;
  for(let niveau = 0; n && niveau < 4 && !cible; niveau++){
    let x = n.nextElementSibling;
    while(x && (x.offsetHeight === 0 || x.matches('.kpi-mini-grid, .kpi-grid, .dd-boites, .dd-jauges4, style, script'))) x = x.nextElementSibling;
    if(x) cible = x; else n = n.parentElement;
  }
  if(!cible){ showToast('Le détail est affiché sur cet écran'); return; }
  cible.style.scrollMarginTop = '76px';
  cible.scrollIntoView({behavior:'smooth', block:'start'});
  cible.classList.remove('kpi-flash'); void cible.offsetWidth; cible.classList.add('kpi-flash');
  setTimeout(() => cible.classList.remove('kpi-flash'), 1300);
};
// Par défaut, un indicateur sans action propre mène au détail affiché en dessous.
document.addEventListener('click', function(ev){
  const el = ev.target.closest && ev.target.closest('.kpi-mini, .kpi, .dd-bx, .dd-kpi, .dd-jp');
  if(!el || ev.target.closest('[onclick], button, a, input, select, textarea, label')) return;
  kpiSuivant(el);
});
