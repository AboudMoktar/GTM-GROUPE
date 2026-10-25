// ============================================================
// TRANSFERT — données de l'application « Gestion Rendement » vers GTM Groupe
// ============================================================
// L'application Gestion Rendement (tek-trend-atelier) enregistre dans sa propre base Firebase
// (projet tek-trend-35778, dossier tt6/). GTM Groupe enregistre dans la sienne (dossier tek/).
// Cet outil, dans Rendement → Params (Responsable), lit les données de rendement de l'ancienne
// base avec les identifiants de l'application Gestion Rendement, les compare jour par jour avec
// GTM, laisse choisir pour chaque différence, télécharge une sauvegarde de GTM, puis enregistre.
// Lecture seule côté Gestion Rendement : rien n'y est modifié. Peut être relancé à tout moment.
(function(){
  'use strict';
  const TR_CONFIG = {
    apiKey: "AIzaSyDLXI-PD5RqBQEHvCnBA51x8G59OO2WSgw",
    authDomain: "tek-trend-35778.firebaseapp.com",
    databaseURL: "https://tek-trend-35778-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tek-trend-35778",
    storageBucket: "tek-trend-35778.firebasestorage.app",
    messagingSenderId: "362387383484",
    appId: "1:362387383484:web:89e5417b99b12a5d635cb9"
  };
  const TR_DOSSIER = 'tt6';
  const TR_REGLAGES = [['schedule', 'Horaires de travail'], ['obj_horaire_op', 'Cadence (pièces / heure / opératrice)'], ['ops_history', 'Noms des opératrices (historique)'], ['ops', 'Noms des opératrices']];
  let TR = null; // {app, jours:{cle:valeur}, reglages:{}, messages:{}, lignes:[...]}

  const e = s => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
  function canon(v){
    if(Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if(v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function totalJour(d){
    let t = 0; if(!d || !d.hours) return 0;
    Object.keys(d.hours).forEach(h => { const r = d.hours[h] || {}; ['op1', 'op2', 'op3', 'op4'].forEach(k => { const n = parseInt(r[k], 10); if(!isNaN(n)) t += n; }); });
    return t;
  }
  function resume(d){
    if(!d) return '<span style="color:var(--ink-faint)">absent</span>';
    const st = d.status === 'validated' || d.status === 'valide' || d.status === 'locked' ? 'Validé' : (d.status === 'draft' ? 'Brouillon' : (d.status || ''));
    const modif = d.lastEditBy ? ' · ' + e(d.lastEditBy) + (d.lastEditAt ? ' ' + new Date(d.lastEditAt).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '') : '';
    return '<b>' + totalJour(d) + ' pcs</b> · ' + e(st) + modif;
  }
  function dateFrCle(cle){ const d = cle.replace('prod_', '').split('-'); return d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : cle; }

  function fenetre(html){
    let z = document.getElementById('tr-zone');
    if(!z){ z = document.createElement('div'); z.id = 'tr-zone'; document.body.appendChild(z); }
    z.innerHTML = html === null ? '' : `<div class="modal-backdrop"><div class="modal-sheet" style="max-width:640px;width:100%;max-height:88vh;overflow:auto;">${html}</div></div>`;
  }
  async function deconnecter(){
    if(TR && TR.app){ try { await TR.app.auth().signOut(); } catch(x){} try { await TR.app.delete(); } catch(x){} }
  }
  window.trFermer = async function(){ fenetre(null); await deconnecter(); TR = null; };

  window.trOuvrir = function(){
    fenetre(`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><h3 style="margin:0;">Récupérer les données de Gestion Rendement</h3><button class="icon-btn" onclick="trFermer()">✕</button></div>
      <p style="font-size:13px;color:var(--ink-soft);margin:0 0 12px;line-height:1.5;">Connectez-vous avec vos identifiants de <b>l'application Gestion Rendement</b>. Ses données sont seulement lues : rien n'y est modifié. Vous verrez la liste des différences avant tout enregistrement dans GTM.</p>
      <div class="field"><label>Utilisateur (Gestion Rendement)</label><input type="text" id="tr-user" autocomplete="off"></div>
      <div class="field"><label>Mot de passe</label><input type="password" id="tr-pass" autocomplete="off"></div>
      <div id="tr-msg" style="font-size:13px;margin:8px 0;color:var(--bad);"></div>
      <button class="btn btn-primary" style="width:100%;" id="tr-go" onclick="trLire()">Lire les données</button>`);
    setTimeout(() => { const u = document.getElementById('tr-user'); if(u) u.focus(); }, 50);
  };

  window.trLire = async function(){
    const u = (document.getElementById('tr-user') || {}).value || '', p = (document.getElementById('tr-pass') || {}).value || '';
    const msg = document.getElementById('tr-msg'), btn = document.getElementById('tr-go');
    if(!u.trim() || !p){ msg.textContent = 'Saisissez l\'utilisateur et le mot de passe.'; return; }
    if(typeof firebase === 'undefined' || !firebase.initializeApp){ msg.textContent = 'Connexion internet nécessaire.'; return; }
    btn.disabled = true; btn.textContent = 'Lecture en cours…'; msg.style.color = 'var(--ink-soft)'; msg.textContent = '';
    try {
      await deconnecter();
      const app = firebase.initializeApp(TR_CONFIG, 'gestion-rendement-' + Date.now());
      TR = {app};
      try { await app.auth().setPersistence(firebase.auth.Auth.Persistence.NONE); } catch(x){}
      await app.auth().signInWithEmailAndPassword(u.toLowerCase().trim() + '@' + AUTH_EMAIL_DOMAIN, p);
      const racine = app.database().ref(TR_DOSSIER);
      const snapJours = await racine.orderByKey().startAt('prod_').endAt('prod_').once('value');
      TR.jours = snapJours.val() || {};
      TR.reglages = {};
      for(const [k] of TR_REGLAGES){ const s = await racine.child(k).once('value'); if(s.exists()) TR.reglages[k] = s.val(); }
      const sm = await racine.child('messages').once('value'); TR.messages = sm.val() || {};
      trAnalyser();
    } catch(err){
      const c = String(err && err.code || '');
      msg.style.color = 'var(--bad)';
      msg.textContent = /wrong-password|invalid-credential|user-not-found|invalid-login/.test(c) ? 'Utilisateur ou mot de passe incorrect (identifiants de Gestion Rendement).'
        : /permission/.test(c + String(err && err.message)) ? 'Ce compte n\'a pas le droit de lire les données de Gestion Rendement.'
        : /network/.test(c) ? 'Pas de connexion internet.' : ('Lecture impossible : ' + (err && err.message || err));
      btn.disabled = false; btn.textContent = 'Lire les données';
      await deconnecter(); TR = null;
    }
  };

  function trAnalyser(){
    const lignes = [];
    Object.keys(TR.jours).filter(k => /^prod_\d{4}-\d{2}-\d{2}$/.test(k)).sort().forEach(cle => {
      const gr = TR.jours[cle], gtm = getJSON(cle, null);
      if(!gtm) lignes.push({cle, type: 'jour', etat: 'nouveau', gr, gtm, choix: 'gr'});
      else if(canon(gtm) === canon(gr)) lignes.push({cle, type: 'jour', etat: 'identique', gr, gtm, choix: 'gtm'});
      else {
        // présélection : la saisie la plus récente, à défaut la plus complète
        const tg = Number(gr.lastEditAt || 0), tm = Number(gtm.lastEditAt || 0);
        const choix = tg !== tm ? (tg > tm ? 'gr' : 'gtm') : (totalJour(gr) >= totalJour(gtm) ? 'gr' : 'gtm');
        lignes.push({cle, type: 'jour', etat: 'different', gr, gtm, choix});
      }
    });
    TR_REGLAGES.forEach(([cle, nom]) => {
      if(!(cle in TR.reglages)) return;
      const gr = TR.reglages[cle], gtm = getJSON(cle, null);
      if(gtm === null) lignes.push({cle, nom, type: 'reglage', etat: 'nouveau', gr, gtm, choix: 'gr'});
      else if(canon(gtm) !== canon(gr)) lignes.push({cle, nom, type: 'reglage', etat: 'different', gr, gtm, choix: 'gr'});
    });
    const msgsGtm = getJSON('messages', {}) || {};
    TR.nouveauxMessages = Object.keys(TR.messages).filter(id => !(id in msgsGtm));
    TR.lignes = lignes;
    trAfficher();
  }

  function trAfficher(){
    const L = TR.lignes, jours = L.filter(l => l.type === 'jour');
    const nNouv = jours.filter(l => l.etat === 'nouveau').length, nIdent = jours.filter(l => l.etat === 'identique').length, diff = L.filter(l => l.etat === 'different'), regNouv = L.filter(l => l.type === 'reglage' && l.etat === 'nouveau');
    const ligneDiff = (l, i) => `
      <div style="border:1px solid var(--border);border-radius:12px;padding:10px;margin-bottom:8px;">
        <div style="font-weight:800;margin-bottom:6px;">${l.type === 'jour' ? dateFrCle(l.cle) : e(l.nom)}</div>
        ${l.type === 'jour' ? `<div style="font-size:12.5px;line-height:1.6;">GTM : ${resume(l.gtm)}<br>Gestion Rendement : ${resume(l.gr)}</div>` : '<div style="font-size:12.5px;color:var(--ink-soft);">Réglage différent dans les deux applications.</div>'}
        <div style="display:flex;gap:14px;margin-top:6px;font-size:13px;">
          <label><input type="radio" name="tr-c-${i}" ${l.choix === 'gtm' ? 'checked' : ''} onchange="trChoix(${i},'gtm')"> Garder GTM</label>
          <label><input type="radio" name="tr-c-${i}" ${l.choix === 'gr' ? 'checked' : ''} onchange="trChoix(${i},'gr')"> Prendre Gestion Rendement</label>
        </div>
      </div>`;
    fenetre(`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><h3 style="margin:0;">Données de Gestion Rendement</h3><button class="icon-btn" onclick="trFermer()">✕</button></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;text-align:center;">
        <div class="card" style="padding:10px;margin:0;"><div style="font-size:22px;font-weight:800;color:var(--good);">${nNouv}</div><div style="font-size:11.5px;">journées absentes de GTM (seront ajoutées)</div></div>
        <div class="card" style="padding:10px;margin:0;"><div style="font-size:22px;font-weight:800;">${nIdent}</div><div style="font-size:11.5px;">journées identiques (rien à faire)</div></div>
        <div class="card" style="padding:10px;margin:0;"><div style="font-size:22px;font-weight:800;color:var(--warn);">${diff.length}</div><div style="font-size:11.5px;">différences à choisir</div></div>
      </div>
      ${regNouv.length ? `<p style="font-size:12.5px;margin:0 0 6px;">Réglages absents de GTM, seront repris : ${regNouv.map(l => e(l.nom)).join(', ')}.</p>` : ''}
      ${TR.nouveauxMessages.length ? `<p style="font-size:12.5px;margin:0 0 6px;">${TR.nouveauxMessages.length} message(s) seront ajoutés (les messages de GTM sont conservés).</p>` : ''}
      ${diff.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;"><button class="btn btn-ghost" onclick="trTout('gtm')">Tout garder GTM</button><button class="btn btn-ghost" onclick="trTout('gr')">Tout prendre de Gestion Rendement</button></div>
        <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">Présélection : la saisie modifiée le plus récemment.</div>
        ${L.map((l, i) => l.etat === 'different' ? ligneDiff(l, i) : '').join('')}` : ''}
      <p style="font-size:12px;color:var(--ink-soft);line-height:1.5;margin:12px 0;">Avant d'enregistrer, une <b>sauvegarde des données de rendement de GTM</b> est téléchargée sur cet appareil.</p>
      <div id="tr-msg" style="font-size:13px;margin:6px 0;"></div>
      <button class="btn btn-primary" style="width:100%;" id="tr-go" onclick="trTransferer()" ${nNouv + diff.length + regNouv.length + TR.nouveauxMessages.length ? '' : 'disabled'}>${nNouv + diff.length + regNouv.length + TR.nouveauxMessages.length ? 'Transférer dans GTM' : 'GTM est déjà à jour'}</button>`);
  }
  window.trChoix = (i, c) => { if(TR && TR.lignes[i]) TR.lignes[i].choix = c; };
  window.trTout = c => { if(!TR) return; TR.lignes.forEach(l => { if(l.etat === 'different') l.choix = c; }); trAfficher(); };

  function telecharger(nom, texte){
    const b = new Blob([texte], {type: 'application/json'}), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = nom; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  window.trTransferer = async function(){
    if(!TR) return;
    const aEcrire = TR.lignes.filter(l => (l.etat === 'nouveau' || l.etat === 'different') && l.choix === 'gr');
    const msgs = TR.nouveauxMessages;
    if(!aEcrire.length && !msgs.length){ showToast('Rien à transférer avec ces choix'); return; }
    if(!confirm(aEcrire.length + ' élément(s) et ' + msgs.length + ' message(s) vont être enregistrés dans GTM.\n\nUne sauvegarde de GTM est d\'abord téléchargée. Continuer ?')) return;
    const btn = document.getElementById('tr-go'), msg = document.getElementById('tr-msg');
    btn.disabled = true;
    // 1) sauvegarde de ce qui va changer dans GTM (valeurs actuelles, absentes = null)
    const sauvegarde = {app: 'GTM Groupe', contenu: 'Rendement TEK-TREND avant transfert depuis Gestion Rendement', le: new Date().toISOString(), donnees: {}};
    aEcrire.forEach(l => { sauvegarde.donnees[l.cle] = getJSON(l.cle, null); });
    if(msgs.length) sauvegarde.donnees.messages = getJSON('messages', null);
    telecharger('sauvegarde-rendement-GTM-' + getTodayISO() + '.json', JSON.stringify(sauvegarde, null, 1));
    // 2) enregistrement confirmé, un élément après l'autre
    let ok = 0; const echecs = [];
    const ecrire = async (cle, valeur) => {
      const r = typeof gtmEcrireEtConfirmer === 'function' ? await gtmEcrireEtConfirmer(cle, valeur, 30000) : {ok: setJSON(cle, valeur)};
      if(r && r.ok) ok++; else echecs.push((cle.indexOf('prod_') === 0 ? dateFrCle(cle) : cle) + (r && r.raison ? ' (' + r.raison + ')' : ''));
    };
    for(let i = 0; i < aEcrire.length; i++){
      msg.style.color = 'var(--ink-soft)'; msg.textContent = 'Enregistrement ' + (i + 1) + ' / ' + aEcrire.length + '…';
      await ecrire(aEcrire[i].cle, aEcrire[i].gr);
    }
    if(msgs.length){
      const tous = getJSON('messages', {}) || {};
      msgs.forEach(id => { tous[id] = TR.messages[id]; });
      await ecrire('messages', tous);
    }
    await deconnecter();
    const total = aEcrire.length + (msgs.length ? 1 : 0);
    fenetre(`
      <h3 style="margin:0 0 10px;">${echecs.length ? 'Transfert partiel' : 'Transfert terminé'}</h3>
      <p style="font-size:14px;line-height:1.6;margin:0 0 10px;">${ok} / ${total} enregistrement(s) faits dans GTM${msgs.length ? ' (dont ' + msgs.length + ' message(s))' : ''}.</p>
      ${echecs.length ? `<p style="font-size:13px;color:var(--bad);line-height:1.5;">Non enregistrés (relancez le transfert quand la connexion sera bonne) :<br>${echecs.map(e).join('<br>')}</p>` : ''}
      <p style="font-size:12px;color:var(--ink-soft);">La sauvegarde de GTM d'avant le transfert a été téléchargée sur cet appareil.</p>
      <button class="btn btn-primary" style="width:100%;" onclick="trFermer(); nav(activeTab);">Fermer</button>`);
    TR = null;
  };

  // Carte dans Rendement → Params (onglet réservé au Responsable)
  const trParamsOrigine = window.renderParams;
  if(typeof trParamsOrigine === 'function'){
    window.renderParams = function(container){
      const r = trParamsOrigine.apply(this, arguments);
      try {
        if(container && (typeof firebaseConfigured !== 'function' || firebaseConfigured())){
          const c = document.createElement('div'); c.className = 'card';
          c.innerHTML = '<h3 style="margin-top:0;">Données de l\'application Gestion Rendement</h3><p style="font-size:13px;color:var(--ink-soft);line-height:1.5;margin:0 0 10px;">L\'application Gestion Rendement enregistre dans une autre base que GTM. Récupérez ses journées de production, ses réglages et ses messages : vous voyez les différences et choisissez avant tout enregistrement. À relancer quand vous voulez.</p><button class="btn btn-primary" onclick="trOuvrir()">Récupérer les données de Gestion Rendement</button>';
          container.appendChild(c);
        }
      } catch(x){}
      return r;
    };
  }
})();
