// ============================================================
// MGT — COMMUNICATION, NOTES RAPIDES, CORBEILLE, JOURS FÉRIÉS, PROJETS (machines / chaudronnerie)
// ============================================================
// Reprend du CRM d'origine :
//  - Communication : Visites, Rendez-vous, Tâches & Rappels (tout vient du planning et des visites des fiches clients) ;
//  - Notes rapides : une note liée à un client (type, date, texte dicté ou écrit, photo) = une action du planning (champ noteRapide) ;
//  - Corbeille des clients : un client supprimé est gardé dans mgt_corbeille (restauration possible) ;
//  - Jours fériés dans le calendrier ;
//  - Projets : étape du cycle de vie, machines installées du client, offres de chaudronnerie (> 20 000 HTVA).
// Chargé après mgt-calendrier-module.js, mgt-lettrage-module.js et mgt-fichiers-module.js.

const COM = {vis:{per:'90', q:''}, tch:{pr:'', user:'', ech:''}, notes:{q:''}};
const COM_TYPES_NOTE = [['note', 'Note'], ['rappel urgent', 'Rappel urgent'], ['tache administrative', 'Tâche administrative'], ['SAV', 'SAV']];
const comTri = (a, c) => (crmISO(a.date) || '9999').localeCompare(crmISO(c.date) || '9999');
const comPlanifiees = () => crmToutesActions().filter(crmActionAPlanifier);
const comEstVisite = (a) => crmNorm(a.type || '').includes('visite');
const comEstRdv = (a) => /visite|appel|rdv|rendez|reunion|demo|presentation|essai/.test(crmNorm(a.type || ''));
const comIdx = (a) => (typeof calIndexPlanning === 'function' ? calIndexPlanning(a) : -1);
function comBarre(){ return ''; }

// ---------- lignes d'action ----------
function comLigneAction(a){
  const d = crmActionJours(a), idx = comIdx(a), ed = crmEd() && idx >= 0, cls = d !== null && d < 0 ? 'bad' : d === 0 ? 'warn' : '';
  const urgent = crmNorm(a.priority).includes('haute') || crmNorm(a.priority).startsWith('a ');
  return `<div style="padding:9px 0;border-bottom:1px solid var(--border-soft);">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
      <div style="flex:1;min-width:0;cursor:pointer;" onclick="crmOuvrir('${a.clientId}')"><b style="font-size:13.5px;">${esc(crmNomClient(a.clientId))}</b>
        <div style="font-size:11.5px;color:var(--ink-soft);">${esc(a.type || 'action')}${a.objective ? ' · ' + esc(a.objective) : ''}${a.commercial ? ' · ' + esc(a.commercial) : ''}${a.noteRapide ? ' · 📝' : ''}${a.photoId ? ' · 📎' : ''}</div></div>
      <div style="text-align:right;">${crmBadge(crmDateFr(a.date) + (a.heure ? ' ' + a.heure : ''), cls)}${urgent ? `<div style="margin-top:3px;">${crmBadge(a.priority, 'bad')}</div>` : ''}</div></div>
    ${ed ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">${crmPetitBtn('✓ Terminé', `crmTerminerAction('${a.clientId}',${idx})`)}${crmPetitBtn('Reporter +7 j', `comReporter('${a.clientId}',${idx})`)}${crmPetitBtn('Modifier', `crmForm('planning','${a.clientId}',${idx})`)}${a.photoId ? crmPetitBtn('Photo', `fichierVoir('${a.photoId}','${esc(a.photoName || 'Photo')}')`) : ''}</div>`
      : (a.photoId ? `<div style="margin-top:6px;">${crmPetitBtn('Photo', `fichierVoir('${a.photoId}','${esc(a.photoName || 'Photo')}')`)}</div>` : '')}</div>`;
}
window.comReporter = (cid, idx) => {
  crmModifier(cid, r => { const l = crmTableau(r.planning).slice(), a = l[idx]; if(!a) return; a.date = crmISO(crmPlusJours(a.date || getTodayISO(), 7)); a.status = 'En attente'; r.planning = l; });
  showToast('Reporté de 7 jours'); nav(activeTab);
};
const comTuile = (v, lb, cls) => `<div class="kpi-mini"><div style="font-family:var(--mono);font-size:18px;font-weight:800;" class="${cls || ''}">${v}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">${lb}</div></div>`;

// ---------- accueil Communication ----------
function renderMgtCommunication(main){
  const ed = crmEd(), pl = comPlanifiees(), taches = pl.filter(a => !comEstVisite(a)), rdv = pl.filter(comEstRdv), notes = pl.concat(crmToutesActions().filter(a => a.noteRapide && !crmActionAPlanifier(a))).filter(a => a.noteRapide);
  const nbVis = Object.values(crmClients()).reduce((s, c) => s + crmVisites(c).length, 0);
  const carte = (tab, ico, titre, sous, n) => `<button class="acc-tuile" onclick="nav('${tab}')"><span class="acc-ico" style="font-size:26px;">${ico}</span><span class="acc-lib">${titre}</span><span style="font-size:11px;color:var(--ink-soft);">${sous}${n !== null ? ' · ' + n : ''}</span></button>`;
  const b = mgtSection(main, ICONS.messages + ' Communication', ed ? `<button class="btn btn-primary" onclick="comNoteForm()">📝 Note rapide</button>` : '');
  b.innerHTML = `<div class="card" style="padding:12px 14px;"><div style="font-size:13px;color:var(--ink-soft);">Visites, rendez-vous, tâches et rappels : tout vient du planning et des fiches clients.</div></div>
    <div class="acc-grille" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
      ${carte('mgt-visites', '🚗', 'Visites', 'Suivi des visites clients', nbVis)}
      ${carte('mgt-rdv', '📅', 'Rendez-vous', 'Planning des rendez-vous', rdv.length)}
      ${carte('mgt-taches', '✅', 'Tâches & Rappels', 'Actions et rappels à suivre', taches.length)}
      ${carte('mgt-notes', '📝', 'Notes rapides', 'Notes, photos, dictée', notes.length)}</div>`;
}

// ---------- Visites ----------
function comVisites(){
  const out = [], lim = COM.vis.per === 'tout' ? null : Number(COM.vis.per), q = crmNorm(COM.vis.q);
  Object.entries(crmClients()).forEach(([id, c]) => crmTableau(c.visites).forEach((v, i) => {
    if(!v || !crmDate(v.date)) return;
    if(lim !== null && crmJoursDepuis(v.date) > lim) return;
    if(q && !crmNorm((c.nom || '') + ' ' + (v.note || '')).includes(q)) return;
    out.push({id, nom:c.nom || '—', date:v.date, note:v.note || '', i});
  }));
  return out.sort((a, c) => crmDate(c.date) - crmDate(a.date));
}
window.comVisRes = function(){
  const z = document.getElementById('com-res'); if(!z) return; const l = comVisites(), ed = crmEd();
  const clients = l.reduce((s, x) => s.add(x.id), new Set()), sans = Object.values(crmClients()).filter(c => { const j = crmJoursSansVisite(c); return j === null || j > 90; }).length;
  z.innerHTML = `<div class="kpi-mini-grid" style="grid-template-columns:repeat(3,1fr);margin-top:8px;">${comTuile(l.length, 'Visites')}${comTuile(clients.size, 'Clients visités')}${comTuile(sans, 'Sans visite > 90 j', sans ? 'hour-rend warn' : '')}</div>
    ${crmCarte('Visites (' + l.length + ')', l.length ? l.slice(0, 120).map(v => `<div class="session-row" style="align-items:flex-start;cursor:pointer;" onclick="${ed ? `crmForm('visites','${v.id}',${v.i})` : `crmOuvrir('${v.id}')`}"><div style="flex:1;min-width:0;"><b style="font-size:13px;">${esc(v.nom)}</b><div style="font-size:11.5px;color:var(--ink-soft);white-space:pre-line;">${esc(v.note || '—')}</div></div><span style="font-size:12px;">${crmDateFr(v.date)}</span></div>`).join('') : crmVide('Aucune visite pour ce filtre.'))}`;
};
function renderMgtVisites(main){
  const b = mgtSection(main, '🚗 Visites', '');
  b.innerHTML = `<div class="card" style="padding:10px 12px;"><div style="display:flex;gap:8px;flex-wrap:wrap;"><input class="mgt-in" type="search" style="flex:1;min-width:150px;" placeholder="Client ou compte rendu…" value="${esc(COM.vis.q)}" oninput="COM.vis.q=this.value;comVisRes()">
    <select class="mgt-in" onchange="COM.vis.per=this.value;comVisRes()">${[['30', '30 jours'], ['90', '90 jours'], ['365', '1 an'], ['tout', 'Tout']].map(([k, l]) => `<option value="${k}" ${COM.vis.per === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div><div id="com-res"></div>`;
  comVisRes();
}

// ---------- Rendez-vous ----------
function renderMgtRdv(main){
  const b = mgtSection(main, '📅 Rendez-vous', crmEd() ? `<button class="btn btn-primary" onclick="crmForm('planning','')">+ Rendez-vous</button>` : '');
  const l = comPlanifiees().filter(comEstRdv).sort(comTri), j = (a) => crmActionJours(a);
  const groupes = [['En retard', l.filter(a => j(a) !== null && j(a) < 0), 'bad'], ['Aujourd\'hui', l.filter(a => j(a) === 0)], ['Cette semaine', l.filter(a => j(a) > 0 && j(a) <= 7)], ['Plus tard', l.filter(a => j(a) > 7)]];
  b.innerHTML = `<div class="kpi-mini-grid" style="grid-template-columns:repeat(4,1fr);">${groupes.map(([t, g, c]) => comTuile(g.length, t, c && g.length ? 'hour-rend ' + c : '')).join('')}</div>
    ${groupes.map(([t, g]) => g.length ? crmCarte(t + ' (' + g.length + ')', g.slice(0, 60).map(comLigneAction).join('')) : '').join('') || buildEmptyState('Aucun rendez-vous', 'Les visites, appels et rendez-vous planifiés apparaissent ici.')}`;
}

// ---------- Tâches & rappels ----------
window.comTchRes = function(){
  const z = document.getElementById('com-res'); if(!z) return;
  let l = comPlanifiees().filter(a => !comEstVisite(a)).sort(comTri); const f = COM.tch, j = (a) => crmActionJours(a);
  if(f.pr) l = l.filter(a => crmNorm(a.priority).includes(crmNorm(f.pr)));
  if(f.user) l = l.filter(a => (a.commercial || '') === f.user);
  if(f.ech === 'late') l = l.filter(a => j(a) !== null && j(a) < 0); else if(f.ech === 'soon') l = l.filter(a => j(a) !== null && j(a) >= 0 && j(a) <= 7);
  z.innerHTML = crmCarte('Tâches et rappels (' + l.length + ')', l.length ? l.slice(0, 120).map(comLigneAction).join('') : crmVide('Rien à faire pour ce filtre.'));
};
function renderMgtTaches(main){
  const users = Array.from(new Set(comPlanifiees().map(a => a.commercial).filter(Boolean))).sort();
  const b = mgtSection(main, '✅ Tâches & Rappels', crmEd() ? `<button class="btn btn-ghost" onclick="comNoteForm()">📝 Note rapide</button><button class="btn btn-primary" onclick="crmForm('planning','')">+ Tâche</button>` : '');
  b.innerHTML = `<div class="card" style="padding:10px 12px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">
    <select class="mgt-in" onchange="COM.tch.pr=this.value;comTchRes()">${[['', 'Toutes priorités'], ['Haute', 'Haute'], ['Moyenne', 'Moyenne'], ['Faible', 'Faible']].map(([k, l]) => `<option value="${k}" ${COM.tch.pr === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select class="mgt-in" onchange="COM.tch.user=this.value;comTchRes()"><option value="">Tous utilisateurs</option>${users.map(u => `<option ${COM.tch.user === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>
    <select class="mgt-in" onchange="COM.tch.ech=this.value;comTchRes()">${[['', 'Toutes échéances'], ['late', 'En retard'], ['soon', '7 prochains jours']].map(([k, l]) => `<option value="${k}" ${COM.tch.ech === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div><div id="com-res"></div>`;
  comTchRes();
}

// ---------- Notes rapides ----------
function comNotes(){ return crmToutesActions({generees:false}).filter(a => a.noteRapide).sort((a, c) => comTri(c, a)); }
window.comNotesRes = function(){
  const z = document.getElementById('com-res'); if(!z) return; const q = crmNorm(COM.notes.q), ed = crmEd();
  const l = comNotes().filter(a => !q || crmNorm(crmNomClient(a.clientId) + ' ' + (a.objective || '') + ' ' + (a.type || '')).includes(q));
  z.innerHTML = crmCarte('Notes rapides (' + l.length + ')', l.length ? l.slice(0, 100).map(a => { const idx = comIdx(a), fait = crmActionFaite(a);
    return `<div style="padding:9px 0;border-bottom:1px solid var(--border-soft);"><div style="display:flex;justify-content:space-between;gap:8px;"><div style="flex:1;min-width:0;"><b style="font-size:13.5px;cursor:pointer;" onclick="crmOuvrir('${a.clientId}')">${esc(crmNomClient(a.clientId))}</b> <span class="hour-rend ${fait ? 'good' : ''}" style="font-size:10px;">${esc(a.type || 'note')}${fait ? ' · terminée' : ''}</span>
      <div style="font-size:13px;white-space:pre-line;margin-top:3px;">${esc(a.objective || '')}</div></div><span style="font-size:11.5px;">${crmDateFr(a.date)}</span></div>
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">${a.photoId ? crmPetitBtn('📎 Photo', `fichierVoir('${a.photoId}','${esc(a.photoName || 'Photo')}')`) : ''}${ed && idx >= 0 && !fait ? crmPetitBtn('✓ Terminé', `crmTerminerAction('${a.clientId}',${idx})`) : ''}${ed && idx >= 0 ? crmPetitBtn('Modifier', `crmForm('planning','${a.clientId}',${idx})`) : ''}${ed && idx >= 0 ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;color:var(--bad);" onclick="comNoteSuppr('${a.clientId}',${idx})">Supprimer</button>` : ''}</div></div>`; }).join('') : crmVide('Aucune note rapide.'));
};
function renderMgtNotes(main){
  const b = mgtSection(main, '📝 Notes rapides', crmEd() ? `<button class="btn btn-primary" onclick="comNoteForm()">+ Note</button>` : '');
  b.innerHTML = `<div class="card" style="padding:10px 12px;"><input class="mgt-in" type="search" style="width:100%;" placeholder="Rechercher une note…" value="${esc(COM.notes.q)}" oninput="COM.notes.q=this.value;comNotesRes()"></div><div id="com-res"></div>`;
  comNotesRes();
}
window.comNoteSuppr = (cid, idx) => {
  if(!confirm('Supprimer cette note ?')) return;
  let fid = '';
  crmModifier(cid, r => { const l = crmTableau(r.planning).slice(); fid = (l[idx] || {}).photoId || ''; l.splice(idx, 1); r.planning = l; });
  if(fid) fichierEffacer(fid); showToast('Note supprimée'); nav(activeTab);
};
window.comNoteForm = (cid) => {
  const cl = Object.entries(crmClients()).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '', 'fr'));
  mgtModal('Note rapide', `<div class="field"><label>Client *</label><select id="nr-cl" class="mgt-in"><option value="">Choisir un client…</option>${cl.map(([id, c]) => `<option value="${id}" ${id === cid ? 'selected' : ''}>${esc(c.nom || '—')}</option>`).join('')}</select></div>
    ${mgtSelect('Type', 'nr-type', COM_TYPES_NOTE, 'note')}${mgtChamp('Date', 'nr-date', getTodayISO(), 'date')}
    <div class="field"><label>Note *</label><textarea id="nr-txt" rows="4" class="mgt-in" placeholder="Écrivez ou dictez la note…"></textarea></div>
    <div style="display:flex;gap:8px;margin-bottom:10px;"><button type="button" class="btn btn-ghost" style="flex:1;" id="nr-voix" onclick="comDicter()">🎤 Dicter</button>
      <label class="btn btn-ghost" style="flex:1;text-align:center;cursor:pointer;">📷 Photo<input id="nr-photo" type="file" accept="image/*" style="display:none;" onchange="document.getElementById('nr-pnom').textContent=this.files[0]?this.files[0].name:''"></label></div>
    <div id="nr-pnom" style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;"></div>
    <button class="btn btn-primary" style="width:100%;" id="nr-ok" onclick="comNoteSauver()">Enregistrer la note</button>`);
};
let comReco = null;
window.comDicter = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, btn = document.getElementById('nr-voix'), t = document.getElementById('nr-txt');
  if(!SR){ showToast('Dictée non disponible sur ce navigateur'); return; }
  if(comReco){ try { comReco.stop(); } catch(e) {} comReco = null; if(btn) btn.textContent = '🎤 Dicter'; return; }
  comReco = new SR(); comReco.lang = 'fr-FR'; comReco.continuous = true; comReco.interimResults = false;
  comReco.onresult = (ev) => { let s = ''; for(let i = ev.resultIndex; i < ev.results.length; i++) if(ev.results[i].isFinal) s += ev.results[i][0].transcript + ' '; if(s && t) t.value = (t.value ? t.value.replace(/\s*$/, ' ') : '') + s.trim(); };
  comReco.onend = () => { comReco = null; if(btn) btn.textContent = '🎤 Dicter'; };
  comReco.onerror = () => { comReco = null; if(btn) btn.textContent = '🎤 Dicter'; showToast('Dictée interrompue'); };
  try { comReco.start(); if(btn) btn.textContent = '⏹ Arrêter'; } catch(e) { comReco = null; }
};
window.comNoteSauver = async () => {
  const cid = mgtVal('nr-cl'), txt = mgtVal('nr-txt');
  if(!cid){ showToast('Choisissez un client'); return; } if(!txt){ showToast('Écrivez une note'); return; }
  if(comReco){ try { comReco.stop(); } catch(e) {} }
  const ok = document.getElementById('nr-ok'); if(ok){ ok.disabled = true; ok.textContent = 'Enregistrement…'; }
  const f = document.getElementById('nr-photo') && document.getElementById('nr-photo').files[0]; let photoId = '', photoName = '';
  try { if(f){ const data = await fichierLire(f); photoId = mgtId('f'); photoName = f.name || 'photo.jpg'; await fichierSauver(photoId, data); } }
  catch(e){ showToast('Photo non enregistrée'); photoId = ''; photoName = ''; }
  const type = mgtVal('nr-type') || 'note', e = {id:mgtId('n'), date:mgtVal('nr-date') || getTodayISO(), type, priority:type === 'rappel urgent' ? 'Haute' : 'Moyenne', status:'En attente', objective:txt, commercial:crmCommercial(), noteRapide:true};
  if(photoId){ e.photoId = photoId; e.photoName = photoName; }
  crmModifier(cid, r => { const l = crmTableau(r.planning).slice(); l.push(e); r.planning = l; });
  mgtFermer(); showToast('Note enregistrée'); nav(activeTab === 'mgt-notes' || activeTab === 'mgt-taches' || activeTab === 'mgt-communication' ? activeTab : 'mgt-notes');
};

// ---------- Corbeille des clients ----------
const comSupprOrigine = window.crmSupprimerClient;
window.crmSupprimerClient = (id) => {
  const rec = crmClients()[id], copie = rec ? JSON.parse(JSON.stringify(rec)) : null;
  comSupprOrigine(id);
  if(copie && !crmClients()[id]){ const c = Object.assign({}, mgtGet('corbeille')); c[id] = {rec:copie, supprimeLe:getTodayISO(), par:crmCommercial()}; mgtSet('corbeille', c); }
};
function renderMgtCorbeille(main){
  const l = Object.entries(mgtGet('corbeille')).filter(([, x]) => x && x.rec).sort((a, c) => String(c[1].supprimeLe).localeCompare(String(a[1].supprimeLe))), ed = crmEd(), adm = currentUser.role === 'admin';
  const b = mgtSection(main, '🗑 Corbeille des clients', '');
  b.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);margin:0 2px 8px;">Les clients supprimés sont gardés ici : vous pouvez les restaurer avec toutes leurs données (visites, offres, planning, factures).</div>
    ${crmCarte('Clients supprimés (' + l.length + ')', l.length ? l.map(([id, x]) => { const r = x.rec;
      return `<div style="padding:9px 0;border-bottom:1px solid var(--border-soft);"><div style="display:flex;justify-content:space-between;gap:8px;"><div><b style="font-size:13.5px;">${esc(r.nom || '—')}</b><div style="font-size:11.5px;color:var(--ink-soft);">${esc(r.ville || '')} · ${crmTableau(r.offres).length} offre(s) · ${crmTableau(r.factures).length} facture(s) · ${crmTableau(r.visites).length} visite(s)</div></div><span style="font-size:11.5px;">${crmDateFr(x.supprimeLe)}</span></div>
        <div style="display:flex;gap:6px;margin-top:6px;">${ed ? crmPetitBtn('↩ Restaurer', `comRestaurer('${id}')`) : ''}${adm ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;color:var(--bad);" onclick="comPurger('${id}')">Supprimer définitivement</button>` : ''}</div></div>`; }).join('') : crmVide('La corbeille est vide.'))}`;
}
window.comRestaurer = (id) => {
  const c = Object.assign({}, mgtGet('corbeille')), x = c[id]; if(!x) return;
  if(crmClients()[id]){ showToast('Ce client existe déjà'); return; }
  crmEnregistrerClient(id, x.rec); delete c[id]; mgtSet('corbeille', c); showToast('Client restauré'); nav('mgt-corbeille');
};
window.comPurger = (id) => {
  if(!confirm('Supprimer définitivement ce client ? Cette action est irréversible.')) return;
  const c = Object.assign({}, mgtGet('corbeille')); delete c[id]; mgtSet('corbeille', c); showToast('Supprimé définitivement'); nav('mgt-corbeille');
};

// ---------- Jours fériés (calendrier) ----------
function comFeries(an){
  return {[an + '-01-01']:'Nouvel an', [an + '-01-14']:'Révolution et Jeunesse', [an + '-03-20']:'Indépendance', [an + '-04-09']:'Martyrs', [an + '-05-01']:'Fête du travail',
    [an + '-07-25']:'République', [an + '-08-13']:'Fête de la femme', [an + '-10-15']:'Évacuation'};
}
function comMarquerFeries(main){
  const z = main.querySelector('#cal-wrap'); if(!z) return;
  z.querySelectorAll('[data-jour]').forEach(el => {
    const iso = el.getAttribute('data-jour'), nom = comFeries(iso.slice(0, 4))[iso]; if(!nom || el.querySelector('.cal-ferie')) return;
    el.classList.add('cal-jf'); const t = document.createElement('div'); t.className = 'cal-ferie'; t.textContent = nom; t.title = nom;
    const cible = el.classList.contains('cal-col') ? null : el; if(cible) cible.appendChild(t);
  });
}
const comCss = document.createElement('style');
comCss.textContent = `.cal-ferie{font-size:9px;line-height:1.15;font-weight:700;color:#C2410C;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} .cal-case.cal-jf,.cal-gt-jour.cal-jf{background:rgba(255,159,10,.12);} .cal-col.cal-jf{background:rgba(255,159,10,.07);}`;
document.head.appendChild(comCss);
const comAgendaOrigine = window.renderMgtAgenda;
window.renderMgtAgenda = function(main){ comAgendaOrigine(main); try { comMarquerFeries(main); } catch(e) { console.error(e); } };

// ---------- Projets : étape, machines installées, chaudronnerie ----------
const PRJ = {q:'', origine:'', phase:''};
const PRJ_ETAPES = [[0, 'Premier contact'], [10, 'Présentation'], [30, 'Visite'], [50, 'Tests'], [70, 'Négociation'], [90, 'Préparation de l\'offre'], [100, 'Validation offre + facturation + machines'], [130, 'Planning de livraison'], [150, 'Réception'], [170, 'Installation'], [200, 'Formation — projet terminé']];
const prjEtape = (n) => { let l = PRJ_ETAPES[0][1]; PRJ_ETAPES.forEach(([s, t]) => { if(n >= s) l = t; }); return l; };
window.comMachines = (cid) => {
  const l = Object.values(mgtGet('machines')).filter(m => m && m.clientId === cid);
  mgtModal('Machines — ' + esc(crmNomClient(cid)), l.length ? `<div class="fc-scroll"><table class="fc-t"><thead><tr><th style="text-align:left;">Marque</th><th>Modèle</th><th>N° série</th><th>Installation</th></tr></thead><tbody>${l.map(m => `<tr><td style="text-align:left;">${esc(m.marque || '—')}</td><td>${esc(m.modele || '—')}</td><td>${esc(m.serie || '—')}</td><td>${m.dateInstallation ? crmDateFr(m.dateInstallation) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p style="font-size:13px;">Aucune machine installée chez ce client.</p>');
};
window.comChaudronnerie = (cid) => {
  const l = crmOffres(crmClients()[cid] || {}).filter(o => crmOffreMontant(o) > CRM_SEUIL_PROJET && !crmOffrePerdue(o));
  mgtModal('Chaudronnerie — ' + esc(crmNomClient(cid)), l.length ? l.map(o => `<div style="padding:8px 0;border-bottom:1px solid var(--border-soft);font-size:13px;"><div style="display:flex;justify-content:space-between;"><b>${esc(o.type || 'Offre')}${o.machine ? ' · ' + esc(o.machine) : ''}</b><b>${crmMontant(crmOffreMontant(o), o.devise === 'EUR' || !o.devise ? '€' : o.devise)}</b></div>
    <div style="font-size:11.5px;color:var(--ink-soft);">Envoi ${o.sentDate ? crmDateFr(o.sentDate) : '—'} · ${esc(o.status || 'En attente')}${o.note ? ' · ' + esc(o.note) : ''}</div>
    ${o.pdfId ? `<div style="margin-top:4px;">${crmPetitBtn('📎 Voir le PDF', `fichierVoir('${o.pdfId}','${esc(o.pdfName || 'Offre')}')`)}</div>` : ''}</div>`).join('') : `<p style="font-size:13px;">Aucune offre de plus de ${CRM_SEUIL_PROJET.toLocaleString('fr-FR')} HTVA pour ce client.</p>`);
};
window.prjRes = function(){
  const z = document.getElementById('prj-res'); if(!z) return; const q = crmNorm(PRJ.q), ed = crmEd();
  const tous = crmProjets(), l = tous.filter(p => (!PRJ.origine || p.origine === PRJ.origine) && (!PRJ.phase || p.phase === PRJ.phase) && (!q || crmNorm(p.nom + ' ' + (p.c.nom || '')).includes(q))).sort((a, c) => a.avancement - c.avancement);
  const phases = [['avant', 'Avant livraison (0-99 %)'], ['apres', 'Après-vente (100-199 %)'], ['fini', 'Terminés (200 %)']];
  z.innerHTML = `<div class="kpi-mini-grid" style="grid-template-columns:repeat(2,1fr);margin-top:8px;">${comTuile(l.length, 'Projets')}${comTuile(l.filter(p => p.phase === 'avant').length, 'Avant validation')}${comTuile(l.filter(p => p.phase === 'apres').length, 'Après validation')}${comTuile(l.filter(p => p.phase === 'fini').length, 'Terminés')}</div>
    <div class="kpi-mini-grid" style="grid-template-columns:1fr;">${comTuile(crmSommeParDevise(l, p => p.montant, p => (p.devise === 'EUR' ? 'EUR' : p.devise)) || '0', 'Valeur HTVA')}</div>
    ${phases.map(([k, lb]) => { const g = l.filter(p => p.phase === k); return g.length ? crmCarte(lb + ' — ' + g.length, g.map(p => `<div style="padding:9px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;gap:8px;"><b style="font-size:13px;cursor:pointer;" onclick="crmOuvrir('${p.clientId}')">${esc(p.nom)}</b><span style="font-size:12.5px;font-weight:700;white-space:nowrap;">${crmMontant(p.montant, p.devise === 'EUR' ? '€' : p.devise)}</span></div>
      <div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;"><span class="hour-rend">${esc(prjEtape(p.avancement))}</span> ${p.origine === 'auto' ? '· auto (offre)' : '· manuel'}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;"><input type="range" min="0" max="200" step="5" value="${p.avancement}" ${ed ? '' : 'disabled'} style="flex:1;" oninput="this.nextElementSibling.textContent=this.value+' %'" onchange="crmAvancement('${p.cle}', this.value)"><span style="min-width:48px;text-align:right;font-size:12.5px;font-weight:700;">${p.avancement} %</span></div>
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">${crmPetitBtn('Machines', `comMachines('${p.clientId}')`)}${crmPetitBtn('Chaudronnerie', `comChaudronnerie('${p.clientId}')`)}${p.origine === 'manuel' && ed ? crmPetitBtn('Modifier', `crmForm('projets','${p.clientId}',${p.index})`) : ''}</div></div>`).join('')) : ''; }).join('')}
    ${l.length ? '' : buildEmptyState('Aucun projet', 'Les offres de plus de 20 000 HTVA apparaissent ici.')}`;
};
const prjLegacyOrigine = window.renderMgtProjets;
window.renderMgtProjets = function(main){
  const b = mgtSection(main, ICONS.target + ' Projets', crmEd() ? `<button class="btn btn-primary" onclick="crmForm('projets','')">+ Projet</button>` : '');
  const legacy = Object.entries(mgtGet('projets'));
  b.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);margin:0 2px 8px;">Une offre de plus de ${CRM_SEUIL_PROJET.toLocaleString('fr-FR')} HTVA devient automatiquement un projet. Avancement : 0-99 % avant livraison (présentation, visite, tests, négociation, offre), 100-199 % après-vente (livraison, réception, installation, formation), 200 % = terminé.</div>
    <div class="card" style="padding:10px 12px;"><div style="display:flex;gap:8px;flex-wrap:wrap;"><input class="mgt-in" type="search" style="flex:1;min-width:150px;" placeholder="Rechercher client / projet / offre…" value="${esc(PRJ.q)}" oninput="PRJ.q=this.value;prjRes()">
      <select class="mgt-in" onchange="PRJ.origine=this.value;prjRes()">${[['', 'Toutes origines'], ['auto', 'Automatiques (offres)'], ['manuel', 'Manuels']].map(([k, l]) => `<option value="${k}" ${PRJ.origine === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="mgt-in" onchange="PRJ.phase=this.value;prjRes()">${[['', 'Toutes phases'], ['avant', 'Avant validation'], ['apres', 'Après validation'], ['fini', 'Terminés']].map(([k, l]) => `<option value="${k}" ${PRJ.phase === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div id="prj-res"></div>${legacy.length ? crmCarte('Anciens projets GTM (' + legacy.length + ')', legacy.map(([pid, p]) => mgtLigneProjet(pid, p, true)).join('')) : ''}`;
  prjRes();
};

// ---------- Branchement : onglets, navigation, accueil ----------
MGT_GROUPES.comm = {racine:'mgt-communication', onglets:[['mgt-communication', 'Communication'], ['mgt-visites', 'Visites'], ['mgt-rdv', 'RDV'], ['mgt-taches', 'Tâches'], ['mgt-notes', 'Notes']]};
Object.assign(MGT_PARENT, {'mgt-communication':'mgt-dashboard', 'mgt-visites':'mgt-dashboard', 'mgt-rdv':'mgt-dashboard', 'mgt-taches':'mgt-dashboard', 'mgt-notes':'mgt-dashboard', 'mgt-corbeille':'mgt-clients'});
const comRenduOrigine = window.renderMgt;
window.renderMgt = function(tab, main){
  const propres = {'mgt-communication':renderMgtCommunication, 'mgt-visites':renderMgtVisites, 'mgt-rdv':renderMgtRdv, 'mgt-taches':renderMgtTaches, 'mgt-notes':renderMgtNotes, 'mgt-corbeille':renderMgtCorbeille};
  if(!propres[tab]) return comRenduOrigine(tab, main);
  propres[tab](main);
  if(tab !== 'mgt-corbeille') main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets no-print">${MGT_GROUPES.comm.onglets.map(([t, l]) => `<button class="${t === tab ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
};
if(typeof ACCUEIL_TUILES !== 'undefined'){
  const i = ACCUEIL_TUILES.findIndex(t => t[0] === 'mgt-sav'); ACCUEIL_TUILES.splice(i >= 0 ? i + 1 : ACCUEIL_TUILES.length, 0, ['mgt-communication', 'Communication', 'messages']);
}
// Clients : accès à la corbeille ; Pilotage : note rapide
const comClientsOrigine = window.renderMgtClients;
window.renderMgtClients = function(main){
  comClientsOrigine(main);
  const n = Object.keys(mgtGet('corbeille')).length;
  const h = main.querySelector('.flex-header'); if(h) h.insertAdjacentHTML('afterend', `<div style="margin:-4px 0 8px;"><button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="nav('mgt-corbeille')">🗑 Corbeille${n ? ' (' + n + ')' : ''}</button></div>`);
};
const comDashOrigine = window.renderMgtDashboard;
window.renderMgtDashboard = function(main){
  comDashOrigine(main);
  if(crmEd()) main.insertAdjacentHTML('afterbegin', `<div style="display:flex;gap:8px;margin-bottom:8px;"><button class="btn btn-primary" style="flex:1;" onclick="comNoteForm()">📝 Note rapide</button><button class="btn btn-ghost" style="flex:1;" onclick="nav('mgt-taches')">✅ Tâches & rappels</button></div>`);
};
