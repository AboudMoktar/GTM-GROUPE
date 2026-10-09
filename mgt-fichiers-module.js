// ============================================================
// MGT — FICHIERS JOINTS (PDF d'offres, documents, photos)
// ============================================================
// Les fichiers sont rangés à part, dans fichiers/<id> (racine de la base, hors
// du dossier mgt/) : l'application ne les télécharge jamais avec les données
// courantes, seulement à l'ouverture d'un fichier. La fiche client ne garde que
// l'identifiant et le nom : offre {pdfId, pdfName}, documents [{id, nom, fid, date}].
// Limites : 6 Mo par fichier (les photos sont réduites avant l'envoi). Les règles
// Firebase (voir database.rules.json) réservent l'accès au personnel MGT.
// Sans connexion Firebase (mode local), les fichiers restent sur l'appareil.

const FICHIERS_MAX = 6 * 1024 * 1024;
let fichierCible = null;
const fichiersMemoire = {};

function fichierEnLigne(){ return typeof firebaseReady !== 'undefined' && firebaseReady && typeof fbRootRef !== 'undefined' && fbRootRef; }
function fichierSauver(fid, dataUrl){
  if(fichierEnLigne()) return fbRootRef.child('fichiers/' + fid).set(dataUrl);
  fichiersMemoire[fid] = dataUrl;
  try { window.localStorage.setItem(CACHE_PREFIX + 'fichier_' + fid, dataUrl); } catch(e) {}
  return Promise.resolve();
}
function fichierCharger(fid){
  if(fichierEnLigne()) return fbRootRef.child('fichiers/' + fid).once('value').then(s => s.val());
  let v = fichiersMemoire[fid]; try { v = v || window.localStorage.getItem(CACHE_PREFIX + 'fichier_' + fid); } catch(e) {}
  return Promise.resolve(v || null);
}
function fichierEffacer(fid){
  if(!fid) return Promise.resolve();
  delete fichiersMemoire[fid];
  try { window.localStorage.removeItem(CACHE_PREFIX + 'fichier_' + fid); } catch(e) {}
  if(fichierEnLigne()) return fbRootRef.child('fichiers/' + fid).remove().catch(() => {});
  return Promise.resolve();
}
function fichierLire(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Lecture impossible'));
    r.onload = () => {
      if(!/^image\//.test(file.type)) { resolve(r.result); return; }
      const img = new Image();
      img.onerror = () => resolve(r.result);
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
function fichierEntree(){
  let e = document.getElementById('fichier-input');
  if(!e){
    e = document.createElement('input'); e.type = 'file'; e.id = 'fichier-input'; e.accept = 'application/pdf,image/*'; e.style.display = 'none';
    e.onchange = () => { const f = e.files && e.files[0]; e.value = ''; if(f) fichierEnvoyer(f); };
    document.body.appendChild(e);
  }
  return e;
}
window.fichierChoisir = (cid, type, idx) => {
  if(!canEditMgt()){ showToast('Modification non autorisée'); return; }
  fichierCible = {cid, type, idx};
  fichierEntree().click();
};
async function fichierEnvoyer(file){
  const cible = fichierCible; if(!cible) return;
  if(file.size > FICHIERS_MAX && !/^image\//.test(file.type)){ showToast('Fichier trop lourd (6 Mo maximum)'); return; }
  showToast('Envoi en cours…');
  try {
    const data = await fichierLire(file);
    if(data.length > FICHIERS_MAX * 1.4){ showToast('Fichier trop lourd (6 Mo maximum)'); return; }
    const fid = crmNouvelId('f'), nom = file.name || 'fichier';
    await fichierSauver(fid, data);
    let ancien = '';
    crmModifier(cible.cid, r => {
      if(cible.type === 'offre'){
        const l = crmTableau(r.offres).slice(), o = l[cible.idx]; if(!o) return;
        ancien = o.pdfId || ''; l[cible.idx] = Object.assign({}, o, {pdfId:fid, pdfName:nom, pdfOmis:false}); r.offres = l;
      } else {
        const l = crmTableau(r.documents).slice(); l.push({id:fid, nom, fid, date:getTodayISO()}); r.documents = l;
      }
    });
    if(ancien) fichierEffacer(ancien);
    showToast('Fichier enregistré');
    if(cible.type === 'offre') crmForm('offres', cible.cid, cible.idx); else nav('mgt-fiche');
  } catch(err) {
    console.error(err); showToast('Envoi impossible : vérifiez la connexion et vos droits');
  }
}
window.fichierVoir = (fid, nom) => {
  mgtModal(esc(nom || 'Fichier'), '<p style="font-size:13px;color:var(--ink-soft);">Chargement…</p>');
  fichierCharger(fid).then(data => {
    if(!data){ mgtModal(esc(nom || 'Fichier'), '<p style="font-size:13px;">Fichier introuvable (supprimé, ou accès non autorisé).</p>'); return; }
    return fetch(data).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob), image = /^image\//.test(blob.type);
      mgtModal(esc(nom || 'Fichier'), `${image ? `<img src="${url}" style="max-width:100%;border-radius:10px;margin-bottom:10px;">` : ''}
        <a class="btn btn-primary" style="display:block;text-align:center;text-decoration:none;margin-bottom:8px;" href="${url}" target="_blank" rel="noopener">Ouvrir</a>
        <a class="btn btn-ghost" style="display:block;text-align:center;text-decoration:none;" href="${url}" download="${esc(nom || 'fichier')}">Télécharger</a>`);
    });
  }).catch(() => mgtModal('Fichier', '<p style="font-size:13px;">Lecture impossible : vérifiez la connexion.</p>'));
};
window.fichierDemanderRetrait = (cid, type, idx) => {
  crmConfirmer('Retirer ce fichier ?', `fichierRetirer('${cid}', '${type}', ${idx})`);
};
window.fichierRetirer = (cid, type, idx) => {
  let fid = '';
  crmModifier(cid, r => {
    if(type === 'offre'){
      const l = crmTableau(r.offres).slice(), o = l[idx]; if(!o) return;
      fid = o.pdfId || ''; l[idx] = Object.assign({}, o, {pdfId:'', pdfName:'', pdfOmis:false}); r.offres = l;
    } else {
      const l = crmTableau(r.documents).slice(); fid = (l[idx] || {}).fid || ''; l.splice(idx, 1); r.documents = l;
    }
  });
  fichierEffacer(fid);
  mgtFermer(); showToast('Fichier retiré');
  if(type === 'offre') crmForm('offres', cid, idx); else nav('mgt-fiche');
};

// --- Offre : section « fichier joint » dans le formulaire ---
const fichiersFormOrigine = window.crmForm;
window.crmForm = function(champ, cid, idx){
  fichiersFormOrigine(champ, cid, idx);
  if(champ !== 'offres' || !cid || idx == null || idx === 'null') return;
  const o = crmTableau((mgtGet('clients')[cid] || {}).offres)[idx] || {};
  const feuille = document.querySelector('#mgt-modal-zone .modal-sheet'); if(!feuille) return;
  feuille.insertAdjacentHTML('beforeend', `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
    <div style="font-size:12px;font-weight:700;color:var(--ink-soft);margin-bottom:6px;">FICHIER JOINT (PDF ou photo)</div>
    ${o.pdfId ? `<div style="font-size:13px;margin-bottom:8px;">📎 ${esc(o.pdfName || 'Fichier')}</div>
      <div style="display:flex;gap:8px;"><button class="btn btn-ghost" style="flex:1;" onclick="fichierVoir('${o.pdfId}', '${esc(o.pdfName || 'Fichier')}')">Voir</button>
      <button class="btn btn-ghost" style="flex:1;" onclick="fichierChoisir('${cid}','offre',${idx})">Remplacer</button>
      <button class="btn btn-ghost" style="flex:1;color:var(--bad);" onclick="fichierDemanderRetrait('${cid}','offre',${idx})">Retirer</button></div>`
    : `${o.pdfOmis ? `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">PDF d'origine non importé : ${esc(o.pdfName || '')}</div>` : ''}
      <button class="btn btn-ghost" style="width:100%;" onclick="fichierChoisir('${cid}','offre',${idx})">Joindre un fichier</button>`}
  </div>`);
};

// --- Fiche client : carte « Documents » ---
const fichiersFicheOrigine = window.renderMgtFiche;
window.renderMgtFiche = function(main){
  fichiersFicheOrigine(main);
  const id = mgtFicheId, c = mgtGet('clients')[id], zone = document.getElementById('mgt-body'); if(!c || !zone) return;
  const docs = crmTableau(c.documents), ed = canEditMgt();
  const carte = crmCarte('Documents (' + docs.length + ')', docs.length ? docs.map((d, i) => d ? `<div class="session-row">
      <div style="flex:1;min-width:0;cursor:pointer;" onclick="fichierVoir('${d.fid}', '${esc(d.nom || 'Document')}')"><b style="font-size:13px;">📎 ${esc(d.nom || 'Document')}</b><div style="font-size:11.5px;color:var(--ink-soft);">${crmDateFr(d.date)}</div></div>
      ${ed ? crmPetitBtn('Retirer', `fichierDemanderRetrait('${id}','doc',${i})`) : ''}</div>` : '').join('') : crmVide('Aucun document'),
    ed ? crmPetitBtn('+ Document', `fichierChoisir('${id}','doc')`) : '');
  const hist = Array.from(zone.querySelectorAll('.card')).pop();
  if(hist) hist.insertAdjacentHTML('beforebegin', carte); else zone.insertAdjacentHTML('beforeend', carte);
};

// --- Paramètres : récupérer les PDF d'une sauvegarde complète du CRM ---
const fichiersParametresOrigine = window.renderMgtParametres;
window.renderMgtParametres = function(main){
  fichiersParametresOrigine(main);
  main.insertAdjacentHTML('beforeend', `<div class="card"><h3 style="margin:0 0 6px;font-size:14px;">PDF des offres</h3>
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Choisissez la sauvegarde complète du CRM (celle qui contient les PDF). Chaque PDF est rangé à part et rattaché à son offre. Vous pouvez recommencer sans risque : les offres déjà rattachées sont ignorées. Gardez l'écran allumé pendant l'envoi.</p>
    <input type="file" id="pj-fichier" accept=".json,application/json" style="display:none;" onchange="fichiersImporterPieces(this)">
    <button class="btn btn-primary" style="width:100%;" onclick="document.getElementById('pj-fichier').click()">Importer les PDF d'une sauvegarde</button>
    <div id="pj-etat" style="font-size:12.5px;margin-top:8px;color:var(--ink-soft);"></div></div>`);
};
window.fichiersImporterPieces = (input) => {
  const f = input.files && input.files[0]; if(!f) return;
  const etat = (t) => { const e = document.getElementById('pj-etat'); if(e) e.textContent = t; };
  etat('Lecture du fichier…');
  const lecteur = new FileReader();
  lecteur.onerror = () => etat('Lecture impossible.');
  lecteur.onload = async () => {
    let data;
    try { data = JSON.parse(lecteur.result); } catch(e) { etat('Fichier illisible (JSON invalide).'); return; }
    const liste = Array.isArray(data) ? data : crmTableau(data && data.clients);
    const taches = [];
    liste.forEach(src => {
      if(!src || typeof src !== 'object') return;
      const cid = 'crm' + String(src.ID == null ? '' : src.ID).replace(/[.#$\[\]\/\s]/g, '_');
      crmTableau(src.Offres).filter(x => x && typeof x === 'object').forEach((o, i) => {
        if(typeof o.pdfData === 'string' && o.pdfData.indexOf('data:') === 0) taches.push({cid, i, data:o.pdfData, nom:o.pdfName || 'offre.pdf'});
      });
    });
    data = null;
    if(!taches.length){ etat('Aucun PDF trouvé dans ce fichier.'); input.value = ''; return; }
    let ok = 0, deja = 0, absents = 0, erreurs = 0;
    for(let n = 0; n < taches.length; n++){
      const t = taches[n], client = mgtGet('clients')[t.cid];
      etat('Envoi ' + (n + 1) + ' / ' + taches.length + '…');
      const offre = client && crmTableau(client.offres)[t.i];
      if(!offre){ absents++; continue; }
      if(offre.pdfId){ deja++; continue; }
      try {
        const fid = 'imp_' + t.cid + '_' + t.i;
        await fichierSauver(fid, t.data);
        crmModifier(t.cid, r => { const l = crmTableau(r.offres).slice(); l[t.i] = Object.assign({}, l[t.i], {pdfId:fid, pdfName:t.nom, pdfOmis:false}); r.offres = l; });
        ok++;
      } catch(e) { console.error(e); erreurs++; }
      t.data = null;
    }
    input.value = '';
    etat(ok + ' PDF rattachés' + (deja ? ', ' + deja + ' déjà présents' : '') + (absents ? ', ' + absents + ' offres introuvables (importez d\'abord les clients)' : '') + (erreurs ? ', ' + erreurs + ' erreurs' : '') + '.');
    showToast('PDF importés : ' + ok);
  };
  lecteur.readAsText(f);
};

// Icône 📎 dans les listes d'offres.
const fichiersOffreLigneOrigine = window.crmLigneOffre;
window.crmLigneOffre = function(cid, o, i, ed){
  const html = fichiersOffreLigneOrigine(cid, o, i, ed);
  return o.pdfId ? html.replace('<b style="font-size:13px;">', '<b style="font-size:13px;">📎 ') : html;
};
