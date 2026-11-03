// ============================================================
// RH TEK-TREND — EMPLOYÉS : liste, fiche d'édition, import
// ============================================================
// Chargé après rh-module.js. Remplace l'écran « Employés » (renderRHPersonnel) et le formulaire
// d'édition depuis la fiche salarié. Mêmes données (getEmployees / saveEmployees), un champ en plus :
// le téléphone (tel). Plus de contrôles :
//  - nom obligatoire, matricule obligatoire et unique, téléphone vérifié (8 chiffres, ou +indicatif) ;
//  - avertissement si un autre employé porte déjà le même nom ;
//  - à l'enregistrement, on relit la liste et on ne modifie QUE la fiche concernée (rien d'autre n'est écrasé) ;
//  - pas de suppression définitive : Désactiver / Réactiver (voir rh-module.js) ;
//  - import d'une liste « matricule nom [téléphone] » : ajoute les nouveaux, complète le téléphone des existants.
// Aucune donnée d'employé n'est écrite dans ce fichier.

function remTel(v){ return String(v || '').replace(/[^\d+]/g, ''); }
function remTelValide(v){ const t = remTel(v); return !t || /^\d{8}$/.test(t) || /^\+\d{8,15}$/.test(t) || /^00\d{8,15}$/.test(t); }
// 98123456 -> « 98 123 456 » ; +21698123456 -> « +216 98 123 456 »
function remTelAff(v){
  const t = remTel(v); if(!t) return '';
  const m = /^(?:\+|00)216(\d{8})$/.exec(t), n = m ? m[1] : (/^\d{8}$/.test(t) ? t : null);
  if(n) return (m ? '+216 ' : '') + n.slice(0, 2) + ' ' + n.slice(2, 5) + ' ' + n.slice(5);
  return t;
}
function remInitiales(nom){ const m = String(nom || '').trim().split(/\s+/).filter(Boolean); return ((m[0] || '?')[0] + (m.length > 1 ? m[m.length - 1][0] : '')).toUpperCase(); }
function remNorm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function remPostes(){ const s = new Set(); Object.values(getEmployees()).forEach(e => { if(e.poste) s.add(e.poste.trim()); }); return Array.from(s).sort((a, b) => a.localeCompare(b)); }

window.renderRHPersonnel = function(container, canEdit){
  if(!window.rhPersonnelFilter) window.rhPersonnelFilter = {q:'', statut:'actif'};
  const f = window.rhPersonnelFilter; if(!f.tri) f.tri = 'nom';
  const tous = Object.entries(getEmployees());
  const nb = {actif: tous.filter(([, e]) => (e.statut || 'actif') === 'actif').length, inactif: tous.filter(([, e]) => e.statut === 'inactif').length, tous: tous.length};
  const sansTel = tous.filter(([, e]) => (e.statut || 'actif') === 'actif' && !remTel(e.tel)).length;
  container.innerHTML = `
    <div class="card rem-tete">
      <div class="rem-ligne">
        <input id="rh-p-search" class="rem-recherche" placeholder="🔍  Nom, matricule, poste ou téléphone…" value="${esc(f.q)}" oninput="rhFilterPersonnelRows(this.value)">
        ${canEdit ? `<button class="btn btn-primary rem-ajout" onclick="rhEmpForm(null)">+ Ajouter</button>` : ''}
      </div>
      <div class="rem-ligne">
        <div class="rem-seg">${[['actif', 'Actifs'], ['inactif', 'Inactifs'], ['tous', 'Tous']].map(([k, l]) => `<button class="${f.statut === k ? 'on' : ''}" onclick="rhPersonnelFilter.statut='${k}'; nav('rh-personnel')">${l} <b>${nb[k]}</b></button>`).join('')}</div>
        <select class="rem-tri" onchange="rhPersonnelFilter.tri=this.value; nav('rh-personnel')" aria-label="Trier">
          ${[['nom', 'Trier : nom'], ['matricule', 'Trier : matricule'], ['poste', 'Trier : poste']].map(([k, l]) => `<option value="${k}" ${f.tri === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      ${canEdit ? `<div class="rem-ligne rem-bas">
        <button class="rem-lien" onclick="rhEmpImport()">${ICONS.idBadge} Importer une liste</button>
        ${sansTel ? `<button class="rem-lien rem-alerte" onclick="rhPersonnelFilter.statut='actif'; rhPersonnelFilter.q=''; rhPersonnelFilter.sansTel=!rhPersonnelFilter.sansTel; nav('rh-personnel')">${f.sansTel ? '✕ ' : ''}📞 ${sansTel} sans téléphone</button>` : ''}
      </div>` : ''}
    </div>
    <div id="rh-p-results"></div>
    <div id="rh-modal-zone"></div>`;

  window.rhRenderPersonnelRows = (canEdit) => {
    const zone = document.getElementById('rh-p-results'); if(!zone) return;
    let rows = Object.entries(getEmployees());
    if(f.statut !== 'tous') rows = rows.filter(([, e]) => (e.statut || 'actif') === f.statut);
    if(f.sansTel) rows = rows.filter(([, e]) => !remTel(e.tel));
    const cle = (e) => f.tri === 'matricule' ? String(e.matricule || '').padStart(12, '0') : f.tri === 'poste' ? (e.poste || '~') + ' ' + (e.nom || '') : (e.nom || '');
    rows.sort((a, b) => cle(a[1]).localeCompare(cle(b[1]), 'fr', {numeric:true}));
    zone.innerHTML = `
      <div class="rem-compte"><span id="rh-p-count">${rows.length}</span> <span id="rh-p-count-label">personne${rows.length > 1 ? 's' : ''}</span></div>
      <div id="rh-p-empty" class="card" style="display:none;">${buildEmptyState('Aucun employé trouvé', 'Modifiez la recherche.')}</div>
      ${rows.length === 0 ? `<div class="card">${buildEmptyState('Aucun employé', canEdit ? 'Ajoutez un employé ou importez une liste.' : '')}</div>` : `<div class="rem-liste">${rows.map(([id, e]) => {
        const tel = remTelAff(e.tel), inactif = e.statut === 'inactif';
        return `<div class="rem-carte rh-row${inactif ? ' inactif' : ''}" data-search="${esc(remNorm([e.nom, e.matricule, e.poste, e.departement, remTel(e.tel)].join(' ')))}" onclick="rhFicheEmpId='${id}'; nav('rh-fiche')">
          <div class="rem-av">${esc(remInitiales(e.nom))}</div>
          <div class="rem-id">
            <div class="rem-nom">${esc(e.nom)}${inactif ? ' <span class="rem-badge">Inactif</span>' : ''}</div>
            <div class="rem-infos">
              <span>${esc(e.poste || 'Poste non renseigné')}</span>
              ${e.matricule ? `<span>Mat. ${esc(e.matricule)}</span>` : ''}
              ${tel ? `<a class="rem-tel" href="tel:${esc(remTel(e.tel))}" onclick="event.stopPropagation()">📞 ${esc(tel)}</a>` : `<span class="rem-sanstel">📞 —</span>`}
            </div>
          </div>
          ${canEdit ? `<button class="rem-edit" onclick="event.stopPropagation(); rhEmpForm('${id}')" aria-label="Modifier ${esc(e.nom)}">✎</button>` : ''}
        </div>`; }).join('')}</div>`}`;
    if(f.q.trim()) rhFilterPersonnelRows(f.q);
  };
  window.rhFilterPersonnelRows = (q) => {
    f.q = q; const qq = remNorm(q).replace(/\s/g, ''); let n = 0;
    document.querySelectorAll('#rh-p-results .rh-row').forEach(el => { const ok = !qq || (el.dataset.search || '').replace(/\s/g, '').includes(qq); el.style.display = ok ? '' : 'none'; if(ok) n++; });
    const c = document.getElementById('rh-p-count'); if(c) c.textContent = n;
    const l = document.getElementById('rh-p-count-label'); if(l) l.textContent = 'personne' + (n > 1 ? 's' : '');
    const v = document.getElementById('rh-p-empty'); if(v) v.style.display = (n === 0 && document.querySelectorAll('#rh-p-results .rh-row').length) ? '' : 'none';
  };
  window.showAddEmployeeForm = () => rhEmpForm(null);
  window.showImportForm = () => rhEmpImport();
  rhRenderPersonnelRows(canEdit);
};

// ---------- Fiche d'édition (ajout ou modification) ----------
window.rhEmpForm = function(id, retour){
  const emps = getEmployees(), e = id ? emps[id] : null;
  if(id && !e){ showToast('Employé introuvable'); return; }
  const x = e || {statut:'actif', dateEmbauche:getTodayISO()};
  const postes = remPostes();
  rhModal(id ? 'Modifier l\'employé' : 'Nouvel employé', `
    <div class="rem-form">
      <div class="field"><label>Nom complet *</label><input id="ef-nom" value="${esc(x.nom || '')}" placeholder="Prénom et nom" autocomplete="off"></div>
      <div class="rem-2">
        <div class="field"><label>Matricule *</label><input id="ef-matricule" value="${esc(x.matricule || '')}" inputmode="numeric" autocomplete="off"></div>
        <div class="field"><label>Téléphone</label><input id="ef-tel" type="tel" value="${esc(remTelAff(x.tel))}" placeholder="98 123 456" inputmode="tel" autocomplete="off"></div>
      </div>
      <div class="field"><label>Poste / Fonction</label><input id="ef-poste" list="rem-postes" value="${esc(x.poste || '')}" placeholder="Ex : Couture, Finition, Emballage…"><datalist id="rem-postes">${postes.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="rem-2">
        <div class="field"><label>Département</label><input id="ef-departement" list="rh-dep-list" value="${esc(x.departement || '')}">${departementsDatalist()}</div>
        <div class="field"><label>Date d'embauche</label><input type="date" id="ef-embauche" value="${x.dateEmbauche || ''}"></div>
      </div>
      <div id="rem-erreur" class="rem-erreur"></div>
      <div class="rem-actions">
        <button class="btn btn-primary" onclick="rhEmpEnregistrer(${id ? `'${id}'` : 'null'}, '${retour || ''}')">Enregistrer</button>
        <button class="btn btn-ghost" onclick="rhCloseModal()">Annuler</button>
        ${id ? (x.statut === 'inactif' ? `<button class="btn btn-ghost rem-droite" onclick="rhCloseModal(); rhReactiverEmploye('${id}')">Réactiver</button>` : `<button class="btn btn-warning rem-droite" onclick="rhCloseModal(); rhDesactiverEmploye('${id}')">Désactiver</button>`) : ''}
      </div>
    </div>`);
  setTimeout(() => { const n = document.getElementById('ef-nom'); if(n && !id) n.focus(); }, 50);
};
window.rhEmpEnregistrer = function(id, retour){
  const v = (k) => (document.getElementById(k) || {value:''}).value.trim();
  const erreur = (m) => { const z = document.getElementById('rem-erreur'); if(z) z.textContent = m; else showToast(m); };
  const nom = v('ef-nom').replace(/\s+/g, ' '), matricule = v('ef-matricule'), telSaisi = v('ef-tel'), poste = v('ef-poste'), departement = v('ef-departement'), dateEmbauche = v('ef-embauche');
  if(!nom) return erreur('Le nom est obligatoire.');
  if(!matricule) return erreur('Le matricule est obligatoire.');
  if(!remTelValide(telSaisi)) return erreur('Téléphone non valide : 8 chiffres (ex. 98 123 456) ou numéro international (+216…).');
  const list = getEmployees();   // relue au moment d'enregistrer : on ne touche qu'à cette fiche
  const autre = Object.entries(list).find(([k, e]) => k !== id && String(e.matricule || '').trim() === matricule);
  if(autre) return erreur('Ce matricule est déjà utilisé par ' + (autre[1].nom || 'un autre employé') + (autre[1].statut === 'inactif' ? ' (inactif)' : '') + '.');
  const homonyme = Object.entries(list).find(([k, e]) => k !== id && remNorm(e.nom) === remNorm(nom));
  if(homonyme && !confirm('Un autre employé s\'appelle déjà « ' + homonyme[1].nom + ' » (matricule ' + (homonyme[1].matricule || '—') + '). Enregistrer quand même ?')) return;
  if(departement){ const deps = getDepartements(); if(!deps.includes(departement)){ deps.push(departement); saveDepartements(deps); } }
  const tel = remTel(telSaisi), champs = {nom, matricule, tel, poste, departement, dateEmbauche};
  if(id){ list[id] = Object.assign({}, list[id], champs); if(!tel) delete list[id].tel; }
  else { const nid = 'e' + Date.now() + Math.floor(Math.random() * 1000); list[nid] = Object.assign({statut:'actif'}, champs); if(!tel) delete list[nid].tel; }
  saveEmployees(list);
  rhCloseModal(); showToast(id ? 'Employé modifié' : 'Employé ajouté');
  nav(retour === 'fiche' ? 'rh-fiche' : 'rh-personnel');
};
// Désactiver / Réactiver (au lieu de supprimer) : définis ici, car l'ancien écran Employés n'est plus construit.
window.rhDesactiverEmploye = (id) => {
  const list = getEmployees(), e = list[id]; if(!e) return;
  if(!confirm('Désactiver ' + (e.nom || 'cette personne') + ' ?\nIl n\'apparaîtra plus dans le pointage. Ses présences et son historique sont conservés, et vous pourrez le réactiver à tout moment (Employés → Inactifs).')) return;
  list[id] = Object.assign({}, e, {statut:'inactif', desactiveLe:getTodayISO()});
  saveEmployees(list); showToast('Employé désactivé (récupérable dans Employés → Inactifs)'); nav('rh-personnel');
};
window.rhReactiverEmploye = (id) => {
  const list = getEmployees(), e = list[id]; if(!e) return;
  const r = Object.assign({}, e, {statut:'actif'}); delete r.desactiveLe;
  list[id] = r; saveEmployees(list); showToast('Employé réactivé'); nav('rh-personnel');
};
// La fiche salarié ouvre la même fenêtre d'édition.
window.rhEditFromFiche = (id) => rhEmpForm(id, 'fiche');

// ---------- Import d'une liste ----------
window.rhEmpImport = function(){
  rhModal('Importer une liste', `
    <p class="rem-aide">Une ligne par personne : <b>matricule</b>, puis <b>nom</b>, et si vous l'avez le <b>téléphone</b> à la fin.<br>Exemple : <code>65999 Ben Salah Amira 98 123 456</code></p>
    <p class="rem-aide">Un matricule qui existe déjà n'est pas recréé : seul son téléphone est ajouté ou mis à jour.</p>
    <textarea id="rh-import-text" rows="9" class="rem-zone" placeholder="65999 Ben Salah Amira 98 123 456"></textarea>
    <div class="rem-actions"><button class="btn btn-primary" onclick="rhEmpImporter()">Importer</button><button class="btn btn-ghost" onclick="rhCloseModal()">Annuler</button></div>`);
};
window.runImport = () => rhEmpImporter();
window.rhEmpImporter = function(){
  const lignes = (document.getElementById('rh-import-text').value || '').split('\n').map(l => l.trim()).filter(Boolean);
  if(!lignes.length){ showToast('Collez au moins une ligne'); return; }
  const list = getEmployees(), parMat = {};
  Object.entries(list).forEach(([id, e]) => { if(e.matricule) parMat[String(e.matricule).trim()] = id; });
  let ajoutes = 0, tels = 0, invalides = 0, inchanges = 0;
  lignes.forEach((ligne, i) => {
    const m = /^(\S+)\s+(.+)$/.exec(ligne); if(!m){ invalides++; return; }
    const matricule = m[1]; let reste = m[2].trim(), tel = '';
    const t = /\s((?:\+|00)?[\d][\d .-]{6,}\d)$/.exec(' ' + reste);
    if(t && remTelValide(t[1])){ tel = remTel(t[1]); reste = reste.slice(0, reste.length - t[1].length).trim(); }
    if(!reste){ invalides++; return; }
    const nom = reste.toLowerCase().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const ex = parMat[matricule];
    if(ex){ if(tel && remTel(list[ex].tel) !== tel){ list[ex] = Object.assign({}, list[ex], {tel}); tels++; } else inchanges++; return; }
    const id = 'e' + Date.now() + Math.floor(Math.random() * 100000) + '_' + i;
    list[id] = Object.assign({matricule, nom, poste:'', dateEmbauche:'', statut:'actif'}, tel ? {tel} : {});
    parMat[matricule] = id; ajoutes++;
  });
  if(ajoutes || tels) saveEmployees(list);
  rhCloseModal();
  showToast([ajoutes ? ajoutes + ' ajouté(s)' : '', tels ? tels + ' téléphone(s) mis à jour' : '', inchanges ? inchanges + ' déjà à jour' : '', invalides ? invalides + ' ligne(s) invalide(s)' : ''].filter(Boolean).join(', ') || 'Rien à importer');
  nav('rh-personnel');
};

// ---------- Fiche salarié : afficher le téléphone sous le nom ----------
(function(){
  const ficheOrigine = window.renderRHFiche;
  if(typeof ficheOrigine !== 'function') return;
  window.renderRHFiche = function(container, canEdit, empId){
    const r = ficheOrigine.apply(this, arguments);
    window.rhEditFromFiche = (id) => rhEmpForm(id, 'fiche');   // l'ancienne fiche redéfinit ce bouton à chaque affichage
    try {
      const e = getEmployees()[empId], tel = e && remTelAff(e.tel);
      const h = container.querySelector('.flex-header h3'), sous = h && h.nextElementSibling;
      if(sous && !sous.querySelector('.rem-tel')) sous.insertAdjacentHTML('beforeend', tel ? ` · <a class="rem-tel" href="tel:${esc(remTel(e.tel))}">📞 ${esc(tel)}</a>` : ' · <span class="rem-sanstel">📞 —</span>');
    } catch(err) { console.error('Fiche employé', err); }
    return r;
  };
})();

(function(){
  const css = document.createElement('style');
  css.textContent = `
.rem-tete{padding:12px !important;display:flex;flex-direction:column;gap:10px;}
.rem-ligne{display:flex;gap:8px;align-items:center;}
.rem-recherche{flex:1;min-width:0;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);font-size:14px;font-family:inherit;}
.rem-ajout{flex-shrink:0;padding:10px 14px !important;font-size:13px !important;}
.rem-seg{flex:1;display:flex;background:var(--surface-2);border:1.5px solid var(--border);border-radius:10px;padding:3px;gap:3px;}
.rem-seg button{flex:1;border:0;background:transparent;border-radius:7px;padding:7px 4px;font-size:12.5px;font-weight:600;color:var(--ink-soft);cursor:pointer;font-family:inherit;}
.rem-seg button b{margin-left:2px;} .rem-seg button.on{background:var(--accent);color:#fff;}
.rem-tri{flex-shrink:0;padding:9px 8px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);font-size:12.5px;font-family:inherit;max-width:42%;}
.rem-bas{justify-content:space-between;flex-wrap:wrap;}
.rem-lien{border:0;background:transparent;color:var(--accent);font-weight:700;font-size:12.5px;padding:4px 2px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;}
.rem-lien svg{width:16px;height:16px;} .rem-alerte{color:var(--warn);}
.rem-compte{font-size:12px;font-weight:700;color:var(--ink-faint);margin:2px 4px 8px;}
.rem-liste{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.rem-carte{display:flex;align-items:center;gap:11px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px 12px;cursor:pointer;}
.rem-carte:active{background:var(--surface-2);} .rem-carte.inactif{opacity:.65;}
.rem-av{flex:0 0 40px;height:40px;border-radius:50%;background:var(--accent-bg);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;}
.rem-id{flex:1;min-width:0;}
.rem-nom{font-weight:700;font-size:15px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rem-badge{font-size:10.5px;font-weight:700;background:var(--bad-bg);color:var(--bad);padding:2px 7px;border-radius:99px;vertical-align:2px;}
.rem-infos{display:flex;flex-wrap:wrap;gap:2px 10px;margin-top:3px;font-size:12.5px;color:var(--ink-soft);}
.rem-infos > *:not(:last-child)::after{content:'';}
.rem-tel{color:var(--accent);font-weight:700;text-decoration:none;white-space:nowrap;} .rem-sanstel{color:var(--ink-faint);}
.rem-edit{flex-shrink:0;width:38px;height:38px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink-soft);font-size:16px;cursor:pointer;}
.rem-form .field{margin-bottom:10px;} .rem-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.rem-erreur{color:var(--bad);font-size:13px;font-weight:700;min-height:18px;margin:2px 0 8px;}
.rem-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;} .rem-droite{margin-left:auto;}
.rem-aide{font-size:12.5px;color:var(--ink-soft);margin:0 0 8px;} .rem-aide code{background:var(--surface-2);padding:1px 5px;border-radius:5px;}
.rem-zone{width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);font-family:var(--mono);font-size:13px;margin-bottom:8px;}
@media (min-width:1024px){ .rem-liste{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));} }
@media (max-width:380px){ .rem-2{grid-template-columns:1fr;} }
`;
  document.head.appendChild(css);
})();
