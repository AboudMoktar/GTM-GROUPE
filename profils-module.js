// ============================================================
// PROFILS — qui voit quoi, et administration hors des modules
// ============================================================
// Chargé en dernier. Chaque compte reçoit un « profil » (champ profil de
// users_v2/{uid}). Le profil fixe le rôle technique (role), les sociétés et les
// modules / onglets visibles. Les anciens comptes sans profil gardent leur
// comportement d'avant (aucun blocage).
//
//  direction        Direction            voit tout, ne modifie rien
//  sysadmin         Administrateur système voit tout sans modifier ; crée les comptes ; maintenance
//  responsable      Responsable Magasin  accès total TEK-TREND + GADH
//  secretaire_tek   Secrétaire TEK-TREND RH + facturation
//  secretaire_gadh  Secrétaire GADH      RH + facturation
//  resp_gadh        Responsable GADH     rendement + commandes à l'assemblage
//  agent_chaine     Agent chaîne         saisie des rendements par heure
//  secretaire_mgt   Secrétaire MGT       facturation et devis
//  technico_mgt     Technico-commercial MGT  tout dans MGT
//
// acces[société][module] = '*' (tout) ou liste d'onglets. Société absente de
// acces = tous les modules de la société.
// Limite : les règles Firebase protègent par société (dossier tek/ gadh/ mgt/),
// pas par module ; la séparation RH / production / facturation est faite par
// l'application.

const PROFILS = {
  direction:       {label:'Direction', role:'viewer', groupe:true, societes:{tek:true, gadh:true, mgt:true}, aide:'Voit tout, ne modifie rien'},
  sysadmin:        {label:'Administrateur système', role:'viewer', groupe:true, societes:{tek:true, gadh:true, mgt:true}, admin:true, aide:'Voit tout sans modifier · crée les comptes · maintenance'},
  responsable:     {label:'Responsable Magasin', role:'admin', groupe:false, societes:{tek:true, gadh:true}, aide:'Accès total TEK-TREND et GADH'},
  secretaire_tek:  {label:'Secrétaire TEK-TREND', role:'admin', groupe:false, societes:{tek:true}, acces:{tek:{rh:'*', factures:'*'}}, aide:'RH et facturation TEK-TREND'},
  secretaire_gadh: {label:'Secrétaire GADH', role:'admin', groupe:false, societes:{gadh:true}, acces:{gadh:{gadh:['gadh-rh'], factures:'*'}}, aide:'RH et facturation GADH'},
  resp_gadh:       {label:'Responsable GADH', role:'admin', groupe:false, societes:{gadh:true}, acces:{gadh:{gadh:['gadh-dashboard', 'gadh-production', 'gadh-prodchain', 'commandes-home', 'gadh-historique', 'gadh-stats']}}, aide:'Rendement et commandes à l\'assemblage'},
  agent_chaine:    {label:'Agent chaîne TEK-TREND', role:'chef_chaine', groupe:false, societes:{tek:true}, acces:{tek:{rendement:['dashboard', 'saisie']}}, aide:'Saisie des rendements par heure'}  ,
  secretaire_mgt:  {label:'Secrétaire MGT', role:'admin', groupe:false, societes:{mgt:true}, acces:{mgt:{mgt:['mgt-devis', 'mgt-devis-edit', 'fact-liste', 'fact-clients', 'fact-edit', 'fact-params']}}, aide:'Facturation et devis MGT'},
  technico_mgt:    {label:'Technico-commercial MGT', role:'admin', groupe:false, societes:{mgt:true}, aide:'Tout dans MGT (clients, offres, planning, devis, SAV, factures)'}
};
const PROFILS_ORDRE = ['direction', 'sysadmin', 'responsable', 'secretaire_tek', 'secretaire_gadh', 'resp_gadh', 'agent_chaine', 'secretaire_mgt', 'technico_mgt'];

function profilDe(u){ u = u || currentUser; return (u && u.profil && PROFILS[u.profil]) || null; }
function profilLabel(u){
  u = u || currentUser;
  if(typeof isPortail === 'function' && isPortail(u)) return 'Client externe';
  const p = profilDe(u);
  return p ? p.label : roleLabel(u.role);
}
// Administration (comptes, sessions, maintenance) : Administrateur système ;
// anciens comptes de la direction du groupe tant qu'ils n'ont pas de profil ;
// mode local : le Responsable, comme avant.
window.canManageAccounts = function(){
  if(!currentUser) return false;
  if(!firebaseConfigured()) return currentUser.role === 'admin';
  if(currentUser.profil) return currentUser.profil === 'sysadmin';
  return isGroupe();
};

// --- Modules et onglets visibles ---
const profilsModulesOrigine = window.modulesDeSociete;
window.modulesDeSociete = function(soc){
  const l = profilsModulesOrigine(soc), p = profilDe();
  if(!p || !p.acces || !p.acces[soc]) return l;
  return l.filter(m => p.acces[soc][m]);
};
function profilOngletAutorise(tab){
  if(tab === 'sessions') return activeModule === 'admin';
  const p = profilDe();
  if(!p || !p.acces || !activeSociete || !p.acces[activeSociete]) return true;
  const l = p.acces[activeSociete][activeModule];
  return !l || l === '*' || l.indexOf(tab) >= 0;
}
const profilsNavItemsOrigine = window.navItems;
window.navItems = function(){
  if(activeModule === 'admin') return profilsAdminItems();
  return profilsNavItemsOrigine().map(i => (i.tab === 'mgt-offres' && !profilOngletAutorise('mgt-offres') && profilOngletAutorise('mgt-devis')) ? Object.assign({}, i, {tab:'mgt-devis', label:'Devis'}) : i)
    .filter(i => i.tab !== 'sessions' && profilOngletAutorise(i.tab));
};
const profilsNavOrigine = window.nav;
window.nav = function(tab){
  if(activeModule === 'admin' && tab !== 'sessions' && tab !== 'admin-audit' && tab !== 'admin-maint') tab = 'sessions';
  if(activeModule === 'admin' && (tab === 'admin-audit' || tab === 'admin-maint')){
    activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    if(tab === 'admin-audit'){ if(typeof auditOuvrir === 'function') auditOuvrir(); return; }
    renderMaintenance(document.getElementById('main')); return;
  }
  if(!profilOngletAutorise(tab)){
    const premier = navItems()[0];
    if(premier && premier.tab !== tab) tab = premier.tab;
  }
  const r = profilsNavOrigine(tab);
  // Barre d'onglets Offres / Projets / Devis / CA : ne garde que les onglets permis.
  document.querySelectorAll('.mgt-onglets button').forEach(b => {
    const m = /nav\('([^']+)'\)/.exec(b.getAttribute('onclick') || '');
    if(m && !profilOngletAutorise(m[1])) b.remove();
  });
  return r;
};

// --- Administration : espace à part, hors des modules ---
function profilsAdminItems(){
  return [
    {tab:'sessions', label:'Comptes', icon:ICONS.sessions, show:true},
    {tab:'admin-maint', label:'Maintenance', icon:ICONS.params, show:true},
    {tab:'admin-audit', label:'Audit', icon:ICONS.historique, show:true}
  ];
}
window.ouvrirAdmin = () => {
  if(!canManageAccounts()){ showToast('Accès réservé à l\'administrateur système'); return; }
  directionOuverte = false; activeSociete = null; activeModule = 'admin'; renderShell();
};
const profilsBrandingOrigine = window.appBrandingHTML;
window.appBrandingHTML = function(){
  if(activeModule === 'admin') return `<div class="logo-wrap" style="align-items:flex-start;"><div class="logo-text" style="color:#1C2430;">ADMIN</div><div class="logo-sub">COMPTES · MAINTENANCE</div></div>`;
  return profilsBrandingOrigine();
};
const profilsPeutChangerOrigine = window.peutChangerDeModule;
window.peutChangerDeModule = function(){ return activeModule === 'admin' ? true : profilsPeutChangerOrigine(); };
const profilsSwitchModuleOrigine = window.switchModule;
window.switchModule = function(){
  if(activeModule === 'admin'){ activeModule = null; switchSociete(); return; }
  return profilsSwitchModuleOrigine();
};
// Bouton « Administration » sur l'écran de choix de société.
const profilsSocieteSelectOrigine = window.renderSocieteSelect;
window.renderSocieteSelect = function(){
  profilsSocieteSelectOrigine();
  if(!canManageAccounts()) return;
  const zone = document.querySelector('.login-card div[style*="flex-direction:column"]');
  if(zone) zone.insertAdjacentHTML('beforeend', `<button class="btn btn-primary" style="padding:16px;font-size:15px;justify-content:flex-start;gap:12px;text-align:left;background:#3A4556;" onclick="ouvrirAdmin()">
    <span style="width:24px;height:24px;flex-shrink:0;">${ICONS.params}</span>
    <span><span style="display:block;">Administration</span><span style="display:block;font-size:11px;font-weight:500;opacity:.8;">Comptes, sessions, maintenance</span></span></button>`);
};

// Champ mot de passe avec bouton « afficher ».
function profilsChampMdp(label, id){
  return `<div class="field"><label>${label}</label><div style="display:flex;gap:6px;"><input id="${id}" type="password" autocomplete="new-password" style="flex:1;min-width:0;">
    <button type="button" class="btn btn-ghost" style="padding:0 14px;font-size:12.5px;" onclick="profilsAfficherMdp('${id}', this)">Afficher</button></div></div>`;
}
window.profilsAfficherMdp = (id, btn) => {
  const e = document.getElementById(id); if(!e) return;
  const vu = e.type === 'text'; e.type = vu ? 'password' : 'text'; btn.textContent = vu ? 'Afficher' : 'Masquer';
};

// --- Mon mot de passe (tous les comptes) ---
window.profilsMonCompte = () => {
  mgtModal('Mon compte', `<p style="font-size:12.5px;color:var(--ink-soft);margin-top:0;">${esc(currentUser.nom)} (${esc(currentUser.username)}) · ${esc(profilLabel())}</p>
    ${firebaseConfigured() ? profilsChampMdp('Mot de passe actuel', 'mypw-current') : ''}
    ${profilsChampMdp('Nouveau mot de passe (6 caractères minimum)', 'mypw-new')}
    <button class="btn btn-primary" style="width:100%;" onclick="profilsChangerMdp()">Changer mon mot de passe</button>`);
};
window.profilsChangerMdp = async () => {
  const nouveau = document.getElementById('mypw-new').value;
  if(!nouveau || nouveau.length < 6){ showToast('Nouveau mot de passe : 6 caractères minimum'); return; }
  if(!firebaseConfigured()){
    const l = getLocalUsers().slice(), i = l.findIndex(x => x.username === currentUser.username);
    if(i < 0){ showToast('Compte introuvable'); return; }
    l[i] = Object.assign({}, l[i], {password:nouveau}); saveLocalUsers(l); mgtFermer(); showToast('Mot de passe modifié'); return;
  }
  const actuel = document.getElementById('mypw-current').value;
  if(!actuel){ showToast('Entrez le mot de passe actuel'); return; }
  try {
    const cred = firebase.auth.EmailAuthProvider.credential(emailForUsername(currentUser.username), actuel);
    await fbAuth.currentUser.reauthenticateWithCredential(cred);
    await fbAuth.currentUser.updatePassword(nouveau);
    mgtFermer(); showToast('Mot de passe modifié');
  } catch(err) {
    console.error(err);
    showToast(err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Mot de passe actuel incorrect' : 'Erreur lors du changement de mot de passe');
  }
};

// --- Comptes et sessions (administration) ---
const profilsSessionsOrigine = window.renderSessions;
window.renderSessions = function(container){
  if(!firebaseConfigured()) return profilsSessionsOrigine(container);
  const profils = getUserProfiles();
  const sessions = Object.entries(sessionsCache).sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
  const gere = canManageAccounts();
  const libelleAcces = (u) => (typeof isPortail === 'function' && isPortail(u)) ? portailLabel(u) : accesLabel(u);
  container.innerHTML = `
    <div class="flex-header"><h2>Comptes et sessions</h2></div>
    <div class="card"><h3 style="margin-top:0;">Sessions actives</h3>
      ${sessions.length ? sessions.map(([sid, s]) => {
        const active = (Date.now() - (s.lastSeen || 0)) < 5 * 60000;
        return `<div class="session-row"><div><div style="font-weight:700;">${esc(s.nom || s.username)} ${sid === mySessionId ? '<span style="font-size:11px;color:var(--ink-soft);">(cet appareil)</span>' : ''}</div>
          <div style="font-size:11.5px;color:var(--ink-soft);">${esc(s.device || 'Appareil')} · ${active ? '🟢 active' : '⚪ inactive'} · vue ${timeAgo(s.lastSeen)}</div></div>
          ${gere && sid !== mySessionId ? `<button class="btn btn-warning" style="padding:6px 10px;font-size:12px;" onclick="forceEndSession('${sid}')">Déconnecter</button>` : ''}</div>`;
      }).join('') : '<p style="font-size:13px;color:var(--ink-soft);">Aucune session enregistrée.</p>'}
    </div>
    ${gere ? `<div class="card">
      <div class="flex-header" style="margin-bottom:10px;"><h3 style="margin:0;">Comptes utilisateurs</h3><button class="btn btn-primary" style="padding:6px 12px;font-size:12px;" onclick="profilsFormCompte()">+ Ajouter</button></div>
      ${Object.entries(profils).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '')).map(([uid, u]) => `<div class="session-row">
        <div><div style="font-weight:700;">${esc(u.nom)} <span class="badge ${u.profil ? 'green' : 'orange'}" style="font-size:10px;">${esc(u.profil && PROFILS[u.profil] ? PROFILS[u.profil].label : (typeof isPortail === 'function' && isPortail(u)) ? 'Client externe' : 'Ancien compte : à classer')}</span></div>
        <div style="font-size:11.5px;color:var(--ink-soft);">Identifiant : ${esc(u.username)} · ${esc(libelleAcces(u))}</div></div>
        <div style="display:flex;gap:6px;"><button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="profilsFormCompte('${uid}')">Modifier</button>
        ${uid !== currentUser.uid ? `<button class="btn btn-warning" style="padding:6px 10px;font-size:12px;" onclick="profilsConfirmerSuppression('${uid}')">Suppr.</button>` : ''}</div></div>`).join('')}
      <p style="font-size:11px;color:var(--ink-faint);margin-top:12px;">« Suppr. » retire la personne de l'application. Pour changer le mot de passe d'un autre compte ou nettoyer l'identifiant : Console Firebase → Authentication → Users.</p>
    </div>` : `<div class="card"><p style="margin:0;font-size:13px;color:var(--ink-soft);">La gestion des comptes est réservée à l'administrateur système.</p></div>`}`;
};
function profilsChampsAccesHTML(u){
  const courant = u.profil || (typeof isPortail === 'function' && isPortail(u) ? 'portail' : '');
  return `<div class="field"><label>Profil</label><select id="uf-profil" class="mgt-in" onchange="profilsMajForm()">
      ${courant ? '' : '<option value="">— Choisir —</option>'}
      ${PROFILS_ORDRE.map(k => `<option value="${k}" ${k === courant ? 'selected' : ''}>${PROFILS[k].label}</option>`).join('')}
      <option value="portail" ${courant === 'portail' ? 'selected' : ''}>Client externe (portail)</option></select>
    <div id="uf-profil-aide" style="font-size:11.5px;color:var(--ink-soft);margin-top:4px;"></div></div>
    <div id="uf-portail-zone" style="display:none;">${typeof portailFieldHTML === 'function' ? portailFieldHTML(u) : ''}</div>`;
}
window.profilsMajForm = () => {
  const v = mgtVal('uf-profil'), z = document.getElementById('uf-portail-zone'), a = document.getElementById('uf-profil-aide');
  if(z) z.style.display = v === 'portail' ? 'block' : 'none';
  if(a) a.textContent = v === 'portail' ? 'Accès limité au suivi de ses propres commandes ou machines.' : (PROFILS[v] ? PROFILS[v].aide : '');
};
window.profilsFormCompte = (uid) => {
  const u = uid ? getUserProfiles()[uid] : {};
  const moi = uid && uid === currentUser.uid;
  mgtModal(uid ? 'Modifier le compte' : 'Nouveau compte', `
    ${mgtChamp('Nom affiché', 'uf-nom', u.nom)}
    ${uid ? `<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:10px;">Identifiant : <b>${esc(u.username)}</b></div>` : `${mgtChamp('Identifiant (sans espace, ex : secretaire)', 'uf-username', '')}${profilsChampMdp('Mot de passe (6 caractères minimum)', 'uf-password')}`}
    ${moi ? `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;">Vous ne pouvez pas changer votre propre profil.</div>` : profilsChampsAccesHTML(u)}
    <button class="btn btn-primary" style="width:100%;" onclick="profilsSauverCompte('${uid || ''}')">${uid ? 'Enregistrer' : 'Créer le compte'}</button>`);
  profilsMajForm();
};
function profilsChampsDepuisForm(){
  const v = mgtVal('uf-profil');
  if(!v){ showToast('Choisissez un profil'); return null; }
  if(v === 'portail'){
    const p = typeof portailLireForm === 'function' ? portailLireForm() : null;
    if(!p || !p.portail){ if(p) showToast('Choisissez le type de compte client'); return null; }
    return {profil:null, role:'viewer', societes:{}, groupe:false, portail:p.portail};
  }
  const d = PROFILS[v];
  return {profil:v, role:d.role, societes:Object.assign({}, d.societes), groupe:d.groupe, portail:null};
}
window.profilsSauverCompte = async (uid) => {
  const nom = mgtVal('uf-nom'); if(!nom){ showToast('Nom requis'); return; }
  const moi = uid && uid === currentUser.uid;
  const champs = moi ? {} : profilsChampsDepuisForm();
  if(champs === null) return;
  try {
    if(uid){
      await fbRootRef.child('users_v2/' + uid).update(Object.assign({nom}, champs));
      if(moi) currentUser.nom = nom;
    } else {
      const username = mgtVal('uf-username').toLowerCase(), mdp = document.getElementById('uf-password').value;
      if(!username){ showToast('Identifiant requis'); return; }
      if(!mdp || mdp.length < 6){ showToast('Mot de passe : 6 caractères minimum'); return; }
      let sec; try { sec = firebase.app('Secondary'); } catch(e) { sec = firebase.initializeApp(firebaseConfig, 'Secondary'); }
      const cred = await sec.auth().createUserWithEmailAndPassword(emailForUsername(username), mdp);
      await sec.auth().signOut();
      await fbRootRef.child('users_v2/' + cred.user.uid).set(Object.assign({nom, username}, champs));
    }
    mgtFermer(); showToast(uid ? 'Compte mis à jour' : 'Compte créé'); nav('sessions');
  } catch(err) {
    console.error(err);
    showToast(err.code === 'auth/email-already-in-use' ? 'Cet identifiant est déjà utilisé' : err.code === 'auth/weak-password' ? 'Mot de passe trop faible' : 'Erreur : vérifiez vos droits d\'accès');
  }
};
window.profilsConfirmerSuppression = (uid) => {
  const u = getUserProfiles()[uid]; if(!u) return;
  mgtModal('Confirmation', `<p style="font-size:14px;margin-top:0;">Retirer <b>${esc(u.nom)}</b> de l'application ? Cette personne ne pourra plus se connecter.</p>
    <button class="btn btn-primary" style="width:100%;background:var(--bad);" onclick="profilsSupprimer('${uid}')">Oui, retirer</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer()">Annuler</button>`);
};
window.profilsSupprimer = async (uid) => {
  try { await fbRootRef.child('users_v2/' + uid).remove(); mgtFermer(); showToast('Compte retiré'); nav('sessions'); }
  catch(err) { console.error(err); showToast('Erreur : vérifiez vos droits d\'accès'); }
};

// --- Maintenance et dépannage ---
function renderMaintenance(main){
  const sessions = Object.entries(sessionsCache), actives = sessions.filter(([, s]) => (Date.now() - (s.lastSeen || 0)) < 5 * 60000).length;
  const nbComptes = Object.keys(getUserProfiles()).length, sansProfil = Object.values(getUserProfiles()).filter(u => !u.profil && !(typeof isPortail === 'function' && isPortail(u))).length;
  const ligne = (a, b) => `<div class="session-row"><span style="font-size:13px;">${a}</span><b style="font-size:13px;">${b}</b></div>`;
  main.innerHTML = `<div class="flex-header"><h2>Maintenance</h2></div>
    <div class="card"><h3 style="margin-top:0;font-size:14px;">État</h3>
      ${ligne('Synchronisation Firebase', firebaseConfigured() ? (firebaseReady ? '🟢 connectée' : '🟠 en cours / hors ligne') : 'mode local')}
      ${ligne('Comptes', nbComptes + (sansProfil ? ' · ' + sansProfil + ' à classer' : ''))}
      ${ligne('Sessions actives (5 min)', actives + ' / ' + sessions.length)}
      ${ligne('Connexion internet', navigator.onLine ? 'oui' : 'non')}
    </div>
    <div class="card"><h3 style="margin-top:0;font-size:14px;">Dépannage</h3>
      <button class="btn btn-ghost" style="width:100%;margin-bottom:8px;" onclick="profilsViderCache()">Vider le cache de cet appareil et recharger</button>
      <button class="btn btn-ghost" style="width:100%;margin-bottom:8px;" onclick="profilsDeconnecterTous()">Déconnecter toutes les autres sessions</button>
      <button class="btn btn-ghost" style="width:100%;" onclick="profilsSauvegarde()">Sauvegarde complète des données (copier)</button>
      <p style="font-size:11.5px;color:var(--ink-faint);margin:10px 0 0;">Le cache est reconstruit depuis Firebase à la reconnexion. Aucune donnée partagée n'est supprimée.</p>
    </div>`;
}
window.profilsViderCache = async () => {
  try { if('caches' in window){ const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); } } catch(e) {}
  try { if(navigator.serviceWorker){ const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); } } catch(e) {}
  try { Object.keys(window.localStorage).filter(k => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_PREFIX + 'sid').forEach(k => window.localStorage.removeItem(k)); } catch(e) {}
  location.reload();
};
window.profilsDeconnecterTous = () => {
  const autres = Object.keys(sessionsCache).filter(s => s !== mySessionId);
  if(!autres.length){ showToast('Aucune autre session'); return; }
  autres.forEach(s => { try { forceEndSession(s); } catch(e) {} });
  showToast(autres.length + ' session(s) déconnectée(s)');
};
window.profilsSauvegarde = () => {
  const dump = {};
  Object.keys(memoryCache).forEach(k => { dump[k.indexOf(CACHE_PREFIX) === 0 ? k.slice(CACHE_PREFIX.length) : k] = memoryCache[k]; });
  mgtModal('Sauvegarde complète', `<p style="font-size:12.5px;color:var(--ink-soft);margin-top:0;">Copiez ce texte dans un fichier .json pour le conserver.</p>
    <textarea id="crm-export" rows="10" class="mgt-in" readonly style="font-family:var(--mono);font-size:11px;">${esc(JSON.stringify({app:'GTM Groupe', exportedAt:new Date().toISOString(), donnees:dump}))}</textarea>
    <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="crmCopierExport()">Copier tout</button>`);
};


// --- Menu du compte (nom + flèche, en haut à droite) ---
window.menuUtilisateur = (e) => {
  if(e) e.stopPropagation();
  const ex = document.getElementById('user-menu');
  if(ex){ ex.remove(); return; }
  const m = document.createElement('div');
  m.id = 'user-menu';
  const role = typeof profilLabel === 'function' ? profilLabel(currentUser) : roleLabel(currentUser.role);
  const item = (icone, texte, action, cls) => `<button class="${cls || ''}" onclick="menuUtilisateurFermer(); ${action}">${icone}<span>${texte}</span></button>`;
  m.innerHTML = `<div class="um-tete"><div class="um-nom">${esc(currentUser.nom)}</div><div class="um-role">${esc(role)}</div></div>
    ${item('<span style="font-size:16px;">🔑</span>', 'Changer mon mot de passe', 'profilsMonCompte()')}
    ${typeof peutChangerDeModule === 'function' && peutChangerDeModule() ? item(ICONS.switchModule, 'Changer de module', 'switchModule()') : ''}
    ${typeof peutChangerDeSociete === 'function' && peutChangerDeSociete() ? item(ICONS.switchModule, 'Changer de société', 'switchSociete()') : ''}
    ${item(ICONS.logout, 'Déconnexion', 'logout()', 'um-bad')}`;
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener('click', menuUtilisateurFermer, {once:true}), 0);
};
window.menuUtilisateurFermer = () => { const m = document.getElementById('user-menu'); if(m) m.remove(); };
