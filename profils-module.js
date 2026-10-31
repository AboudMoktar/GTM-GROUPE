// ============================================================
// PROFILS — qui voit quoi, et administration hors des modules
// ============================================================
// Chargé en dernier. Chaque compte reçoit un « profil » (champ profil de
// users_v2/{uid}). Les rôles, leurs modules et leurs droits sur les données
// viennent de roles-config.js : c'est la source unique, d'où sont aussi tirées
// les règles Firebase (outils/generer-regles.js). Ne pas définir de rôle ici.
//
// acces[société][module] = '*' (tout) ou liste d'onglets. Société absente de
// acces = tous les modules de la société.
// Les anciens comptes sans profil gardent leur comportement d'avant tant que
// les règles V2 ne sont pas publiées (après publication, ils n'ont plus accès).

const PROFILS = (function(){
  const R = window.GTM_ROLES, out = {};
  R.ORDRE.forEach(k => {
    const d = R.ROLES[k], acces = {};
    Object.keys(d.interface || {}).forEach(soc => { if(d.interface[soc] !== '*') acces[soc] = d.interface[soc]; });
    out[k] = {label:d.label, role:d.role, groupe:!!d.groupe, societes:Object.assign({}, d.societes), admin:!!d.admin, aide:d.aide,
      acces:Object.keys(acces).length ? acces : undefined};
  });
  return out;
})();
const PROFILS_ORDRE = window.GTM_ROLES.ORDRE.slice();

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
window.profilsMonCompte = (faible) => {
  mgtModal('Mon compte', `${faible ? `<div style="background:var(--bad-bg,#FEF2F2);color:var(--bad,#B91C1C);border-radius:8px;padding:10px 12px;font-size:13px;margin-bottom:12px;"><b>Votre mot de passe est trop faible.</b> Choisissez-en un nouveau : ${MDP_REGLE}.</div>` : ''}<p style="font-size:12.5px;color:var(--ink-soft);margin-top:0;">${esc(currentUser.nom)} (${esc(currentUser.username)}) · ${esc(profilLabel())}</p>
    ${firebaseConfigured() ? profilsChampMdp('Mot de passe actuel', 'mypw-current') : ''}
    ${profilsChampMdp('Nouveau mot de passe (' + MDP_REGLE + ')', 'mypw-new')}
    <button class="btn btn-primary" style="width:100%;" onclick="profilsChangerMdp()">Changer mon mot de passe</button>`);
};
window.profilsChangerMdp = async () => {
  const nouveau = document.getElementById('mypw-new').value;
  { const e = mdpErreur(nouveau, currentUser.username); if(e){ showToast(e); return; } }
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
    try { window.sessionStorage.removeItem(CACHE_PREFIX+'mdp_faible'); } catch(e) {}
    mgtFermer(); showToast('Mot de passe modifié');
  } catch(err) {
    console.error(err);
    showToast(err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Mot de passe actuel incorrect' : 'Erreur lors du changement de mot de passe');
  }
};

// --- Comptes et sessions (administration) ---
// Les actions sur les comptes Firebase Authentication (création, désactivation,
// nouveau mot de passe, suppression) passent par des fonctions serveur
// (dossier functions/, SDK Admin) : aucune clé privée dans le navigateur.
// Tant que ces fonctions ne sont pas déployées (offre Blaze), la création et la
// suppression gardent l'ancien mécanisme, et la désactivation coupe l'accès aux
// données via le champ « desactive » (bloqué par les règles V2).
let profilsFnPromesse = null;
function profilsFonctions(){
  if(!profilsFnPromesse) profilsFnPromesse = new Promise((ok, ko) => {
    if(firebase.functions) return ok(firebase.app().functions('europe-west1'));
    const sc = document.createElement('script'); sc.src = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js';
    sc.onload = () => ok(firebase.app().functions('europe-west1'));
    sc.onerror = () => { profilsFnPromesse = null; ko(new Error('indisponible')); };
    document.head.appendChild(sc);
  });
  return profilsFnPromesse;
}
// Appelle une fonction serveur ; renvoie {ok, data} ou {absente:true} si elles ne sont pas déployées.
async function profilsAppel(nom, donnees){
  try {
    const fn = await profilsFonctions();
    const r = await fn.httpsCallable(nom)(donnees);
    return {ok:true, data:r.data};
  } catch(err) {
    const code = String((err && err.code) || '');
    if(/not-found|unavailable/.test(code) || (err && err.message === 'indisponible')) return {absente:true};
    throw err;
  }
}
function profilsMessageErreur(err){
  const c = String((err && err.code) || ''), m = (err && err.message) || '';
  if(/already-exists|email-already-in-use/.test(c + m)) return 'Cet identifiant est déjà utilisé';
  if(/permission-denied|PERMISSION_DENIED/.test(c + m)) return 'Action refusée : droits insuffisants';
  if(/invalid-argument/.test(c)) return m || 'Donnée invalide';
  return 'Erreur : ' + (m || 'action impossible');
}
function profilsDroitsTexte(profil){
  const R = window.GTM_ROLES, ACT = {l:'lire', c:'créer', m:'modifier', s:'supprimer'};
  if(!profil || !R.ROLES[profil]) return '<p style="font-size:12.5px;color:var(--ink-soft);">Ancien compte sans profil : aucun droit après la mise en place des nouvelles règles.</p>';
  const lignes = Object.keys(R.RESSOURCES).map(id => [id, R.actions(profil, id)]).filter(x => x[1]);
  if(!lignes.length) return '<p style="font-size:12.5px;color:var(--ink-soft);">Aucun droit sur les données.</p>';
  return `<table style="width:100%;font-size:12.5px;border-collapse:collapse;">${lignes.map(([id, a]) => {
    const r = R.RESSOURCES[id];
    return `<tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 4px;"><b>${esc(R.SOCIETES[r.societe] || 'TEK-TREND ↔ GADH')}</b> · ${esc(r.module)}<div style="color:var(--ink-soft);">${esc(r.libelle)}</div></td>
      <td style="padding:6px 4px;text-align:right;white-space:nowrap;">${a.split('').map(x => ACT[x]).join(', ')}</td></tr>`;
  }).join('')}</table>`;
}
window.profilsVoirDroits = (uid) => {
  const u = getUserProfiles()[uid] || {};
  const p = PROFILS[u.profil];
  mgtModal('Droits de ' + (u.nom || u.username || ''), `<p style="font-size:13px;margin-top:0;">${esc(p ? p.label : 'Ancien compte')}${p ? ' — ' + esc(p.aide) : ''}</p>${profilsDroitsTexte(u.profil)}`);
};
const profilsSessionsOrigine = window.renderSessions;
window.renderSessions = function(container){
  if(!firebaseConfigured()) return profilsSessionsOrigine(container);
  const profils = getUserProfiles();
  const sessions = Object.entries(sessionsCache).sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
  const gere = canManageAccounts();
  const ancienAdmin = gere && !currentUser.profil;
  container.innerHTML = `
    <div class="flex-header"><h2>Comptes et sessions</h2></div>
    ${ancienAdmin ? `<div class="card" style="border:1.5px solid var(--warn);">
      <h3 style="margin-top:0;">Activer votre profil Administrateur / Développeur</h3>
      <p style="font-size:13px;color:var(--ink-soft);margin:0 0 10px;">Votre compte n'a pas encore de profil. À faire une fois, avant la publication des nouvelles règles : sinon vous perdriez l'accès.</p>
      <button class="btn btn-primary" onclick="profilsActiverAdmin()">Activer mon profil Administrateur</button></div>` : ''}
    ${gere ? `<div class="card">
      <div class="flex-header" style="margin-bottom:10px;"><h3 style="margin:0;">Comptes utilisateurs</h3><button class="btn btn-primary" style="padding:6px 12px;font-size:12px;" onclick="profilsFormCompte()">+ Ajouter</button></div>
      ${Object.entries(profils).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '')).map(([uid, u]) => {
        const moi = uid === currentUser.uid, off = u.desactive === true;
        return `<div class="session-row" style="flex-wrap:wrap;gap:8px;">
        <div style="min-width:0;flex:1 1 260px;"><div style="font-weight:700;">${esc(u.nom)} <span class="badge ${u.profil ? 'green' : 'orange'}" style="font-size:11px;">${esc(u.profil && PROFILS[u.profil] ? PROFILS[u.profil].label : 'Ancien compte : à classer')}</span>${off ? ' <span class="badge red" style="font-size:11px;">Désactivé</span>' : ''}${moi ? ' <span style="font-size:11px;color:var(--ink-soft);">(vous)</span>' : ''}</div>
        <div style="font-size:12px;color:var(--ink-soft);">Identifiant : ${esc(u.username)} · ${esc(accesLabel(u))}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="profilsVoirDroits('${uid}')">Droits</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="profilsFormCompte('${uid}')">Modifier</button>
          ${moi ? '' : `<button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="profilsNouveauMdp('${uid}')">Mot de passe</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px;" onclick="profilsActiver('${uid}', ${off ? 'true' : 'false'})">${off ? 'Réactiver' : 'Désactiver'}</button>
          <button class="btn btn-warning" style="padding:6px 10px;font-size:12px;" onclick="profilsConfirmerSuppression('${uid}')">Suppr.</button>`}
        </div></div>`;
      }).join('')}
    </div>` : `<div class="card"><p style="margin:0;font-size:13px;color:var(--ink-soft);">La gestion des comptes est réservée à l'administrateur.</p></div>`}
    <div class="card"><h3 style="margin-top:0;">Sessions actives</h3>
      ${sessions.length ? sessions.map(([sid, s]) => {
        const active = (Date.now() - (s.lastSeen || 0)) < 5 * 60000;
        return `<div class="session-row"><div><div style="font-weight:700;">${esc(s.nom || s.username)} ${sid === mySessionId ? '<span style="font-size:11px;color:var(--ink-soft);">(cet appareil)</span>' : ''}</div>
          <div style="font-size:12px;color:var(--ink-soft);">${esc(s.device || 'Appareil')} · ${active ? 'active' : 'inactive'} · vue ${timeAgo(s.lastSeen)}</div></div>
          ${gere && sid !== mySessionId ? `<button class="btn btn-warning" style="padding:6px 10px;font-size:12px;" onclick="forceEndSession('${sid}')">Déconnecter</button>` : ''}</div>`;
      }).join('') : '<p style="font-size:13px;color:var(--ink-soft);">Aucune session enregistrée.</p>'}
    </div>`;
};
function profilsChampsAccesHTML(u){
  const courant = u.profil || '';
  return `<div class="field"><label>Rôle</label><select id="uf-profil" class="mgt-in" onchange="profilsMajForm()">
      ${courant ? '' : '<option value="">— Choisir —</option>'}
      ${PROFILS_ORDRE.map(k => `<option value="${k}" ${k === courant ? 'selected' : ''}>${PROFILS[k].label}</option>`).join('')}</select>
    <div id="uf-profil-aide" style="font-size:12px;color:var(--ink-soft);margin-top:4px;"></div></div>
    <div id="uf-profil-droits" style="max-height:240px;overflow:auto;margin-bottom:12px;"></div>`;
}
window.profilsMajForm = () => {
  const v = mgtVal('uf-profil'), a = document.getElementById('uf-profil-aide'), d = document.getElementById('uf-profil-droits');
  if(a) a.textContent = PROFILS[v] ? PROFILS[v].aide + ' · Sociétés : ' + (Object.keys(PROFILS[v].societes).map(s => window.GTM_ROLES.SOCIETES[s]).join(', ') || 'aucune') : '';
  if(d) d.innerHTML = v ? profilsDroitsTexte(v) : '';
};
window.profilsFormCompte = (uid) => {
  const u = uid ? getUserProfiles()[uid] : {};
  const moi = uid && uid === currentUser.uid;
  mgtModal(uid ? 'Modifier le compte' : 'Nouveau compte', `
    ${mgtChamp('Nom affiché', 'uf-nom', u.nom)}
    ${uid ? `<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:10px;">Identifiant : <b>${esc(u.username)}</b></div>` : `${mgtChamp('Identifiant (minuscules, sans espace, ex : secretaire)', 'uf-username', '')}${profilsChampMdp('Mot de passe (' + MDP_REGLE + ')', 'uf-password')}`}
    ${moi ? `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;">Vous ne pouvez pas changer votre propre rôle.</div>` : profilsChampsAccesHTML(u)}
    <button class="btn btn-primary" style="width:100%;" onclick="profilsSauverCompte('${uid || ''}')">${uid ? 'Enregistrer' : 'Créer le compte'}</button>`);
  if(!moi) profilsMajForm();
};
function profilsChampsDepuisForm(){
  const v = mgtVal('uf-profil');
  if(!v || !PROFILS[v]){ showToast('Choisissez un rôle'); return null; }
  const d = PROFILS[v];
  return {profil:v, role:d.role, societes:Object.assign({}, d.societes), groupe:d.groupe};
}
window.profilsSauverCompte = async (uid) => {
  const nom = mgtVal('uf-nom'); if(!nom){ showToast('Nom requis'); return; }
  const moi = uid && uid === currentUser.uid;
  const champs = moi ? {} : profilsChampsDepuisForm();
  if(champs === null) return;
  try {
    if(uid){
      // Le profil est réécrit en entier : sociétés et rôle technique toujours conformes au rôle choisi.
      const u = getUserProfiles()[uid] || {};
      const rec = {nom, username:u.username, role:u.role, profil:u.profil, groupe:!!u.groupe, societes:u.societes || {}};
      if(u.desactive) rec.desactive = true;
      Object.assign(rec, champs, {maj:Date.now()});
      await fbRootRef.child('users_v2/' + uid).set(rec);
      if(moi) currentUser.nom = nom;
    } else {
      const username = mgtVal('uf-username').toLowerCase().trim(), mdp = document.getElementById('uf-password').value;
      if(!/^[a-z0-9._-]{2,40}$/.test(username)){ showToast('Identifiant : lettres minuscules, chiffres, . _ - (2 à 40)'); return; }
      { const e = mdpErreur(mdp, username); if(e){ showToast(e); return; } }
      const r = await profilsAppel('comptesCreer', {username, motDePasse:mdp, nom, profil:champs.profil});
      if(r.absente){
        // Fonctions serveur non déployées : création par l'ancien mécanisme (instance secondaire, sans privilège).
        let sec; try { sec = firebase.app('Secondary'); } catch(e) { sec = firebase.initializeApp(firebaseConfig, 'Secondary'); }
        const cred = await sec.auth().createUserWithEmailAndPassword(emailForUsername(username), mdp);
        await sec.auth().signOut();
        await fbRootRef.child('users_v2/' + cred.user.uid).set(Object.assign({nom, username, maj:Date.now()}, champs));
      }
    }
    mgtFermer(); showToast(uid ? 'Compte mis à jour' : 'Compte créé'); nav('sessions');
  } catch(err) {
    console.error(err);
    showToast(profilsMessageErreur(err));
  }
};
// Migration : l'ancien compte « direction du groupe » prend le profil Administrateur / Développeur.
window.profilsActiverAdmin = async () => {
  const d = PROFILS.sysadmin;
  try {
    await fbRootRef.child('users_v2/' + currentUser.uid).set({nom:currentUser.nom, username:currentUser.username, role:d.role, profil:'sysadmin', groupe:true, societes:Object.assign({}, d.societes), maj:Date.now()});
    currentUser.profil = 'sysadmin'; currentUser.role = d.role; currentUser.groupe = true; currentUser.societes = Object.assign({}, d.societes);
    if(typeof hlMemoriserProfil === 'function') hlMemoriserProfil(currentUser.uid, {nom:currentUser.nom, username:currentUser.username, role:d.role, profil:'sysadmin', groupe:true, societes:d.societes});
    try { window.sessionStorage.setItem(CACHE_PREFIX + 'user', JSON.stringify(currentUser)); } catch(e) {}
    showToast('Profil Administrateur activé'); nav('sessions');
  } catch(err) { console.error(err); showToast(profilsMessageErreur(err)); }
};
window.profilsActiver = async (uid, reactiver) => {
  const u = getUserProfiles()[uid]; if(!u) return;
  if(!reactiver && !confirm('Désactiver le compte de ' + u.nom + ' ? Il ne pourra plus se connecter ni lire les données.')) return;
  try {
    const r = await profilsAppel('comptesActiver', {uid, actif:!!reactiver});
    if(r.absente){
      const rec = Object.assign({}, u); delete rec.desactive; if(!reactiver) rec.desactive = true; rec.maj = Date.now();
      await fbRootRef.child('users_v2/' + uid).set(rec);
      if(!reactiver) Object.entries(sessionsCache).forEach(([sid, s]) => { if(s.username === u.username) fbRootRef.child('sessions/' + sid).remove().catch(() => {}); });
    }
    showToast(reactiver ? 'Compte réactivé' : 'Compte désactivé'); nav('sessions');
  } catch(err) { console.error(err); showToast(profilsMessageErreur(err)); }
};
window.profilsNouveauMdp = (uid) => {
  const u = getUserProfiles()[uid]; if(!u) return;
  mgtModal('Nouveau mot de passe', `<p style="font-size:13px;margin-top:0;">Compte <b>${esc(u.nom)}</b> (${esc(u.username)}). Communiquez-lui le nouveau mot de passe ; il pourra le changer depuis « Mon compte ».</p>
    ${profilsChampMdp('Nouveau mot de passe (' + MDP_REGLE + ')', 'np-mdp')}
    <button class="btn btn-primary" style="width:100%;" onclick="profilsNouveauMdpOk('${uid}')">Enregistrer</button>`);
};
window.profilsNouveauMdpOk = async (uid) => {
  const u = getUserProfiles()[uid] || {}, mdp = document.getElementById('np-mdp').value;
  { const e = mdpErreur(mdp, u.username); if(e){ showToast(e); return; } }
  try {
    const r = await profilsAppel('comptesMotDePasse', {uid, motDePasse:mdp});
    if(r.absente){ showToast('Disponible après le déploiement des fonctions serveur (offre Blaze). En attendant : console Firebase → Authentication.'); return; }
    mgtFermer(); showToast('Mot de passe modifié');
  } catch(err) { console.error(err); showToast(profilsMessageErreur(err)); }
};
window.profilsConfirmerSuppression = (uid) => {
  const u = getUserProfiles()[uid]; if(!u) return;
  mgtModal('Confirmation', `<p style="font-size:14px;margin-top:0;">Supprimer le compte de <b>${esc(u.nom)}</b> ? Cette personne ne pourra plus se connecter. Ses saisies, l'historique et le journal d'audit sont conservés.</p>
    <button class="btn btn-primary" style="width:100%;background:var(--bad);" onclick="profilsSupprimer('${uid}')">Oui, supprimer</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer()">Annuler</button>`);
};
window.profilsSupprimer = async (uid) => {
  try {
    const r = await profilsAppel('comptesSupprimer', {uid});
    if(r.absente) await fbRootRef.child('users_v2/' + uid).remove();
    mgtFermer(); showToast(r.absente ? 'Compte retiré de l\'application (identifiant à supprimer aussi dans la console Firebase)' : 'Compte supprimé'); nav('sessions');
  } catch(err) { console.error(err); showToast(profilsMessageErreur(err)); }
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
