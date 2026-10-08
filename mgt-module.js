// ============================================================
// MGT — MODULE COMMERCIAL (phase 2)
// ============================================================
// Vente de machines Macpi et Morgan Tecnica. Société totalement séparée de
// TEK-TREND et GADH : toutes les clés commencent par « mgt_ » et sont donc
// rangées dans le dossier Firebase mgt/ (voir firebaseDossierDe).
//
// Données (une clé par collection, objets indexés par id) :
//  - mgt_clients   : {nom, type:'client'|'prospect', ville, adresse, tel, email, mf, notes, contacts:[{nom, fonction, tel, email}]}
//  - mgt_agenda    : {date, heure, type, clientId, titre, notes, fait}
//  - mgt_machines  : {clientId, marque, modele, serie, dateInstallation, finGarantie, statut, notes}
//  - mgt_devis     : {numero, version, date, validite, clientId, projetId, objet, lignes:[{designation, qte, pu, remise}], tva, statut, conditions}
//  - mgt_projets   : {clientId, titre, etape, montant, dateCible, notes}
//  - mgt_parametres: coordonnées MGT imprimées sur les devis, TVA par défaut
//  - mgt_compteurs : {devis: {2026: 3}} — numérotation DV-2026-003 par année
// Droits : Responsable et Chef de chaîne modifient, Direction consulte.

const MGT_TYPES_RDV = {
  visite:  {label:'Visite client', cls:'excellent'},
  rdv:     {label:'Rendez-vous',   cls:'good'},
  demo:    {label:'Démonstration', cls:'good'},
  appel:   {label:'Appel',         cls:''},
  relance: {label:'Relance',       cls:'warn'}
};
const MGT_ETAPES = {
  prospection: {label:'Prospection',  cls:''},
  offre:       {label:'Offre envoyée', cls:'excellent'},
  negociation: {label:'Négociation',  cls:'warn'},
  gagne:       {label:'Gagné',        cls:'good'},
  installation:{label:'Installation', cls:'good'},
  termine:     {label:'Terminé',      cls:'good'},
  perdu:       {label:'Perdu',        cls:'bad'}
};
const MGT_STATUTS_DEVIS = {
  brouillon: {label:'Brouillon', cls:''},
  envoye:    {label:'Envoyé',    cls:'excellent'},
  accepte:   {label:'Accepté',   cls:'good'},
  refuse:    {label:'Refusé',    cls:'bad'}
};
const MGT_MARQUES = ['Macpi', 'Morgan Tecnica', 'Autre'];
const MGT_STATUTS_MACHINE = {service:'En service', arret:'À l\'arrêt', retiree:'Retirée'};

// --- Données ---
function mgtGet(nom){ return getJSON('mgt_' + nom, {}) || {}; }
function mgtSet(nom, v){ setJSON('mgt_' + nom, v); }
function mgtId(p){ return p + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function mgtParams(){
  return Object.assign({raison:'MGT', adresse:'', mf:'', tel:'', email:'', rib:'', tva:19, validite:30,
    conditions:'Paiement : 30 % à la commande, solde à la livraison.\nDélai de livraison : à confirmer.'}, getJSON('mgt_parametres', {}) || {});
}
function canEditMgt(){ return !!currentUser && currentUser.role !== 'viewer'; }
function mgtClientNom(id){ const c = mgtGet('clients')[id]; return c ? c.nom : '—'; }
function fmtDT(n){ return (Number(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:3, maximumFractionDigits:3}) + ' DT'; }
function mgtDate(d){ return d ? d.split('-').reverse().join('/') : '—'; }
function mgtAddDays(d, n){ const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return toISODateLocal(x); }
function mgtBadge(def){ return def ? `<span class="hour-rend ${def.cls}" style="font-size:11px;">${def.label}</span>` : ''; }

function devisTotaux(d){
  let ht = 0;
  (d.lignes || []).forEach(l => { ht += (Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise) || 0) / 100); });
  const tva = ht * (Number(d.tva) || 0) / 100;
  return {ht, tva, ttc: ht + tva};
}
function mgtProchainNumero(annee){
  const c = getJSON('mgt_compteurs', {}) || {};
  const dv = c.devis || {};
  dv[annee] = (dv[annee] || 0) + 1;
  c.devis = dv; setJSON('mgt_compteurs', c);
  return 'DV-' + annee + '-' + String(dv[annee]).padStart(3, '0');
}
function garantieActive(m){ return !!(m.finGarantie && m.finGarantie >= getTodayISO()); }

// --- Indicateurs (tableau de bord MGT et écran direction) ---
function mgtIndicateurs(){
  const today = getTodayISO();
  const clients = Object.values(mgtGet('clients'));
  const agenda = Object.values(mgtGet('agenda'));
  const devis = Object.values(mgtGet('devis'));
  const projets = Object.values(mgtGet('projets'));
  const machines = Object.values(mgtGet('machines'));
  const enAttente = devis.filter(d => d.statut === 'envoye');
  return {
    clients: clients.filter(c => c.type !== 'prospect').length,
    prospects: clients.filter(c => c.type === 'prospect').length,
    rdvJour: agenda.filter(a => a.date === today).length,
    relancesRetard: agenda.filter(a => !a.fait && a.date < today).length,
    devisAttente: enAttente.length,
    montantAttente: enAttente.reduce((s, d) => s + devisTotaux(d).ht, 0),
    projetsEnCours: projets.filter(p => ['prospection', 'offre', 'negociation', 'gagne', 'installation'].includes(p.etape)).length,
    machines: machines.filter(m => m.statut !== 'retiree').length,
    sousGarantie: machines.filter(m => m.statut !== 'retiree' && garantieActive(m)).length
  };
}

// --- Navigation ---
function mgtNavItems(){
  return [
    {tab:'mgt-dashboard', label:'Tableau', icon:ICONS.dashboard, show:true},
    {tab:'mgt-clients', label:'Clients', icon:ICONS.team, show:true},
    {tab:'mgt-agenda', label:'Agenda', icon:ICONS.calendarCheck, show:true},
    {tab:'mgt-devis', label:'Devis', icon:ICONS.export, show:true},
    {tab:'mgt-projets', label:'Projets', icon:ICONS.target, show:true},
    {tab:'mgt-parc', label:'Parc', icon:ICONS.factory, show:true},
    {tab:'mgt-parametres', label:'Params', icon:ICONS.params, show:currentUser.role === 'admin'}
  ].filter(i => i.show);
}
function mgtSection(container, titre, actions){
  container.innerHTML = `<div class="flex-header"><h2>${titre}</h2>${actions ? `<div class="actions">${actions}</div>` : ''}</div><div id="mgt-body"></div>`;
  return document.getElementById('mgt-body');
}
function renderMgt(tab, main){
  ({'mgt-dashboard':renderMgtDashboard, 'mgt-clients':renderMgtClients, 'mgt-fiche':renderMgtFiche, 'mgt-agenda':renderMgtAgenda,
    'mgt-devis':renderMgtDevis, 'mgt-devis-edit':renderMgtDevisEdit, 'mgt-projets':renderMgtProjets, 'mgt-parc':renderMgtParc,
    'mgt-parametres':renderMgtParametres})[tab](main);
}

// --- Fenêtre modale ---
function mgtModal(titre, html){
  let z = document.getElementById('mgt-modal-zone');
  if(!z){ z = document.createElement('div'); z.id = 'mgt-modal-zone'; document.body.appendChild(z); }
  z.innerHTML = html === null ? '' : `<div class="modal-backdrop" onclick="if(event.target===this) mgtFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><h3 style="margin:0;">${titre}</h3><button class="icon-btn" onclick="mgtFermer()">✕</button></div>${html}</div></div>`;
}
window.mgtFermer = () => mgtModal('', null);
function mgtChamp(label, id, val, type, extra){
  return `<div class="field"><label>${label}</label><input id="${id}" type="${type || 'text'}" value="${esc(val == null ? '' : val)}" ${extra || ''}></div>`;
}
function mgtSelect(label, id, options, val){
  return `<div class="field"><label>${label}</label><select id="${id}" class="mgt-in">${options.map(([k, l]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
}
function mgtZone(label, id, val){
  return `<div class="field"><label>${label}</label><textarea id="${id}" rows="3" class="mgt-in">${esc(val || '')}</textarea></div>`;
}
function mgtVal(id){ const e = document.getElementById(id); return e ? e.value.trim() : ''; }
function mgtOptionsClients(vide){
  const l = Object.entries(mgtGet('clients')).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '')).map(([id, c]) => [id, c.nom + (c.type === 'prospect' ? ' (prospect)' : '')]);
  return (vide ? [['', vide]] : []).concat(l);
}

// ============================================================
// TABLEAU DE BORD
// ============================================================
function renderMgtDashboard(main){
  const b = mgtSection(main, ICONS.dashboard + ' Tableau de bord MGT');
  const k = mgtIndicateurs(), today = getTodayISO();
  const agenda = Object.entries(mgtGet('agenda'));
  const duJour = agenda.filter(([, a]) => a.date === today).sort((x, y) => (x[1].heure || '').localeCompare(y[1].heure || ''));
  const retard = agenda.filter(([, a]) => !a.fait && a.date < today).sort((x, y) => x[1].date.localeCompare(y[1].date));
  const tuile = (v, l, cls, tab) => `<div class="kpi-mini" style="cursor:pointer;" onclick="nav('${tab}')"><div style="font-family:var(--mono);font-size:20px;font-weight:800;" class="${cls || ''}">${v}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">${l}</div></div>`;
  b.innerHTML = `
    <div class="kpi-mini-grid">
      ${tuile(k.clients, 'Clients', '', 'mgt-clients')}
      ${tuile(k.prospects, 'Prospects', '', 'mgt-clients')}
      ${tuile(k.rdvJour, 'RDV aujourd\'hui', '', 'mgt-agenda')}
      ${tuile(k.relancesRetard, 'En retard', k.relancesRetard ? 'hour-rend bad' : '', 'mgt-agenda')}
    </div>
    <div class="kpi-mini-grid">
      ${tuile(k.devisAttente, 'Devis en attente', '', 'mgt-devis')}
      ${tuile(fmtDT(k.montantAttente).replace(' DT', ''), 'DT HT en attente', '', 'mgt-devis')}
      ${tuile(k.projetsEnCours, 'Projets en cours', '', 'mgt-projets')}
      ${tuile(k.sousGarantie + '/' + k.machines, 'Machines sous garantie', '', 'mgt-parc')}
    </div>
    <div class="card">
      <h3 style="margin:0 0 8px;font-size:14px;">Agenda du jour</h3>
      ${duJour.length ? duJour.map(([id, a]) => mgtLigneAgenda(id, a)).join('') : buildEmptyState('Rien de prévu aujourd\'hui')}
    </div>
    ${retard.length ? `<div class="card"><h3 style="margin:0 0 8px;font-size:14px;color:var(--bad);">À faire en retard (${retard.length})</h3>${retard.slice(0, 15).map(([id, a]) => mgtLigneAgenda(id, a, true)).join('')}</div>` : ''}`;
}

// ============================================================
// CLIENTS ET CONTACTS
// ============================================================
let mgtFiltreClients = {q:'', type:'tous'};
let mgtFicheId = null;
function renderMgtClients(main){
  const b = mgtSection(main, ICONS.team + ' Clients', canEditMgt() ? `<button class="btn btn-primary" onclick="mgtFormClient()">+ Client</button>` : '');
  const f = mgtFiltreClients, all = Object.entries(mgtGet('clients')).sort((a, c) => (a[1].nom || '').localeCompare(c[1].nom || ''));
  const machines = Object.values(mgtGet('machines'));
  let v = all.filter(([, c]) => f.type === 'tous' || (f.type === 'prospect' ? c.type === 'prospect' : c.type !== 'prospect'));
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;">
      <input id="mgt-q" class="mgt-in" placeholder="Rechercher (nom, ville, contact)…" value="${esc(f.q)}" oninput="mgtFiltreClients.q=this.value; mgtFiltrerLignes('mgt-client-row', this.value)">
      <div style="display:flex;gap:6px;margin-top:8px;">
        ${[['tous', 'Tous'], ['client', 'Clients'], ['prospect', 'Prospects']].map(([k, l]) => `<button class="btn ${f.type === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 12px;font-size:12px;" onclick="mgtFiltreClients.type='${k}'; nav('mgt-clients')">${l}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:4px 12px;">
      ${v.length ? v.map(([id, c]) => {
        const nbm = machines.filter(m => m.clientId === id && m.statut !== 'retiree').length;
        const cherche = [c.nom, c.ville, c.tel].concat((c.contacts || []).map(x => x.nom)).join(' ').toLowerCase();
        return `<div class="session-row mgt-client-row" data-search="${esc(cherche)}" style="cursor:pointer;" onclick="mgtFicheId='${id}'; nav('mgt-fiche')">
          <div style="min-width:0;"><b style="font-size:14px;">${esc(c.nom)}</b>
          <div style="font-size:11.5px;color:var(--ink-soft);">${esc(c.ville || '—')}${c.tel ? ' · ' + esc(c.tel) : ''}${nbm ? ' · ' + nbm + ' machine(s)' : ''}</div></div>
          ${c.type === 'prospect' ? mgtBadge({label:'Prospect', cls:'warn'}) : mgtBadge({label:'Client', cls:'good'})}
        </div>`;
      }).join('') : buildEmptyState('Aucun client', canEditMgt() ? 'Ajoutez votre premier client ou prospect.' : '')}
    </div>`;
  if(f.q) mgtFiltrerLignes('mgt-client-row', f.q);
}
window.mgtFiltrerLignes = (cls, q) => {
  const qq = q.trim().toLowerCase();
  document.querySelectorAll('.' + cls).forEach(el => { el.style.display = (!qq || (el.dataset.search || '').includes(qq)) ? '' : 'none'; });
};
window.mgtFormClient = (id) => {
  const c = id ? mgtGet('clients')[id] : {type:'prospect', contacts:[]};
  mgtModal(id ? 'Modifier le client' : 'Nouveau client', `
    ${mgtChamp('Raison sociale *', 'mc-nom', c.nom)}
    ${mgtSelect('Type', 'mc-type', [['prospect', 'Prospect'], ['client', 'Client']], c.type || 'prospect')}
    ${mgtChamp('Ville', 'mc-ville', c.ville)}
    ${mgtChamp('Adresse', 'mc-adresse', c.adresse)}
    ${mgtChamp('Téléphone', 'mc-tel', c.tel, 'tel')}
    ${mgtChamp('E-mail', 'mc-email', c.email, 'email')}
    ${mgtChamp('Matricule fiscal', 'mc-mf', c.mf)}
    ${mgtZone('Notes', 'mc-notes', c.notes)}
    <button class="btn btn-primary" style="width:100%;" onclick="mgtSauverClient('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="mgtSupprimerClient('${id}')">Supprimer le client</button>` : ''}`);
};
window.mgtSauverClient = (id) => {
  const nom = mgtVal('mc-nom');
  if(!nom){ showToast('La raison sociale est obligatoire'); return; }
  const list = mgtGet('clients'), cur = id ? list[id] : {contacts:[], cree:getTodayISO()};
  const nid = id || mgtId('c');
  list[nid] = {...cur, nom, type:mgtVal('mc-type'), ville:mgtVal('mc-ville'), adresse:mgtVal('mc-adresse'), tel:mgtVal('mc-tel'), email:mgtVal('mc-email'), mf:mgtVal('mc-mf'), notes:mgtVal('mc-notes')};
  mgtSet('clients', list); mgtFermer(); showToast('Client enregistré');
  mgtFicheId = nid; nav('mgt-fiche');
};
window.mgtSupprimerClient = (id) => {
  const lie = Object.values(mgtGet('devis')).some(d => d.clientId === id) || Object.values(mgtGet('machines')).some(m => m.clientId === id) || Object.values(mgtGet('projets')).some(p => p.clientId === id);
  if(lie){ showToast('Ce client a des devis, projets ou machines : supprimez-les d\'abord'); return; }
  if(!confirm('Supprimer ce client et ses rendez-vous ?')) return;
  const list = mgtGet('clients'); delete list[id]; mgtSet('clients', list);
  const ag = mgtGet('agenda'); Object.keys(ag).forEach(k => { if(ag[k].clientId === id) delete ag[k]; }); mgtSet('agenda', ag);
  mgtFermer(); showToast('Client supprimé'); nav('mgt-clients');
};
window.mgtFormContact = (cid, idx) => {
  const c = mgtGet('clients')[cid], x = (idx != null && c.contacts[idx]) || {};
  mgtModal(idx != null ? 'Modifier le contact' : 'Nouveau contact', `
    ${mgtChamp('Nom *', 'mk-nom', x.nom)}${mgtChamp('Fonction', 'mk-fonction', x.fonction)}
    ${mgtChamp('Téléphone', 'mk-tel', x.tel, 'tel')}${mgtChamp('E-mail', 'mk-email', x.email, 'email')}
    <button class="btn btn-primary" style="width:100%;" onclick="mgtSauverContact('${cid}', ${idx != null ? idx : 'null'})">Enregistrer</button>
    ${idx != null ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="mgtSupprimerContact('${cid}', ${idx})">Supprimer le contact</button>` : ''}`);
};
window.mgtSauverContact = (cid, idx) => {
  const nom = mgtVal('mk-nom'); if(!nom){ showToast('Le nom est obligatoire'); return; }
  const list = mgtGet('clients'), c = list[cid], x = {nom, fonction:mgtVal('mk-fonction'), tel:mgtVal('mk-tel'), email:mgtVal('mk-email')};
  c.contacts = c.contacts || [];
  if(idx === null) c.contacts.push(x); else c.contacts[idx] = x;
  mgtSet('clients', list); mgtFermer(); nav('mgt-fiche');
};
window.mgtSupprimerContact = (cid, idx) => {
  const list = mgtGet('clients'); list[cid].contacts.splice(idx, 1); mgtSet('clients', list); mgtFermer(); nav('mgt-fiche');
};
function renderMgtFiche(main){
  const c = mgtGet('clients')[mgtFicheId];
  if(!c){ nav('mgt-clients'); return; }
  const ed = canEditMgt(), id = mgtFicheId;
  const b = mgtSection(main, `<span style="cursor:pointer;" onclick="nav('mgt-clients')">‹</span> ${esc(c.nom)}`, ed ? `<button class="btn btn-ghost" onclick="mgtFormClient('${id}')">Modifier</button>` : '');
  const machines = Object.entries(mgtGet('machines')).filter(([, m]) => m.clientId === id);
  const devis = Object.entries(mgtGet('devis')).filter(([, d]) => d.clientId === id).sort((a, d) => (d[1].date || '').localeCompare(a[1].date || ''));
  const projets = Object.entries(mgtGet('projets')).filter(([, p]) => p.clientId === id);
  const agenda = Object.entries(mgtGet('agenda')).filter(([, a]) => a.clientId === id).sort((a, d) => (d[1].date + (d[1].heure || '')).localeCompare(a[1].date + (a[1].heure || '')));
  b.innerHTML = `
    <div class="card">
      ${c.type === 'prospect' ? mgtBadge({label:'Prospect', cls:'warn'}) : mgtBadge({label:'Client', cls:'good'})}
      <div style="font-size:13px;line-height:1.7;margin-top:6px;">
        ${c.adresse || c.ville ? `<div>${esc([c.adresse, c.ville].filter(Boolean).join(', '))}</div>` : ''}
        ${c.tel ? `<div>Tél. <a href="tel:${esc(c.tel)}">${esc(c.tel)}</a></div>` : ''}
        ${c.email ? `<div><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
        ${c.mf ? `<div>MF ${esc(c.mf)}</div>` : ''}
        ${c.notes ? `<div style="color:var(--ink-soft);white-space:pre-line;">${esc(c.notes)}</div>` : ''}
      </div>
    </div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Contacts</h3>${ed ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="mgtFormContact('${id}')">+ Contact</button>` : ''}</div>
      ${(c.contacts || []).length ? c.contacts.map((x, i) => `<div class="session-row" ${ed ? `style="cursor:pointer;" onclick="mgtFormContact('${id}', ${i})"` : ''}><div><b style="font-size:13px;">${esc(x.nom)}</b><div style="font-size:11.5px;color:var(--ink-soft);">${esc(x.fonction || '')}${x.tel ? ' · ' + esc(x.tel) : ''}${x.email ? ' · ' + esc(x.email) : ''}</div></div></div>`).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucun contact</div>`}
    </div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Agenda</h3>${ed ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="mgtFormRdv(null, '${id}')">+ Rendez-vous</button>` : ''}</div>
      ${agenda.length ? agenda.slice(0, 10).map(([aid, a]) => mgtLigneAgenda(aid, a, true)).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucun rendez-vous</div>`}
    </div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Projets</h3>${ed ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="mgtFormProjet(null, '${id}')">+ Projet</button>` : ''}</div>
      ${projets.length ? projets.map(([pid, p]) => mgtLigneProjet(pid, p, false)).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucun projet</div>`}
    </div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Devis</h3>${ed ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="mgtNouveauDevis('${id}')">+ Devis</button>` : ''}</div>
      ${devis.length ? devis.map(([did, d]) => mgtLigneDevis(did, d, false)).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucun devis</div>`}
    </div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Parc machines</h3>${ed ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="mgtFormMachine(null, '${id}')">+ Machine</button>` : ''}</div>
      ${machines.length ? machines.map(([mid, m]) => mgtLigneMachine(mid, m, false)).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucune machine installée</div>`}
    </div>`;
}

// ============================================================
// AGENDA
// ============================================================
let mgtSemaine = null; // lundi de la semaine affichée
function mgtLundi(d){ const x = new Date(d + 'T00:00:00'); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); return toISODateLocal(x); }
function mgtLigneAgenda(id, a, avecDate){
  const t = MGT_TYPES_RDV[a.type] || MGT_TYPES_RDV.rdv, ed = canEditMgt();
  return `<div class="session-row" style="align-items:flex-start;">
    ${ed ? `<input type="checkbox" ${a.fait ? 'checked' : ''} onclick="event.stopPropagation(); mgtBasculerFait('${id}')" title="Fait" style="margin-top:3px;width:18px;height:18px;flex-shrink:0;">` : ''}
    <div style="flex:1;min-width:0;${ed ? 'cursor:pointer;' : ''}${a.fait ? 'opacity:.55;' : ''}" ${ed ? `onclick="mgtFormRdv('${id}')"` : ''}>
      <div style="font-size:13.5px;"><b>${avecDate ? mgtDate(a.date) + ' ' : ''}${a.heure || ''}</b> ${esc(a.titre || t.label)}</div>
      <div style="font-size:11.5px;color:var(--ink-soft);">${esc(mgtClientNom(a.clientId))}${a.notes ? ' · ' + esc(a.notes) : ''}</div>
    </div>
    ${mgtBadge(t)}
  </div>`;
}
function renderMgtAgenda(main){
  if(!mgtSemaine) mgtSemaine = mgtLundi(getTodayISO());
  const b = mgtSection(main, ICONS.calendarCheck + ' Agenda', canEditMgt() ? `<button class="btn btn-primary" onclick="mgtFormRdv()">+ Rendez-vous</button>` : '');
  const fin = mgtAddDays(mgtSemaine, 6), today = getTodayISO();
  const ag = Object.entries(mgtGet('agenda')).filter(([, a]) => a.date >= mgtSemaine && a.date <= fin);
  const jours = [0, 1, 2, 3, 4, 5, 6].map(i => mgtAddDays(mgtSemaine, i));
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;align-items:center;gap:8px;">
      <button class="btn btn-ghost" style="padding:9px 12px;" onclick="mgtSemaine=mgtAddDays(mgtSemaine,-7); nav('mgt-agenda')">‹</button>
      <div style="flex:1;text-align:center;font-weight:700;font-size:13.5px;">Semaine du ${mgtDate(mgtSemaine)} au ${mgtDate(fin)}</div>
      <button class="btn btn-ghost" style="padding:9px 12px;" onclick="mgtSemaine=mgtAddDays(mgtSemaine,7); nav('mgt-agenda')">›</button>
    </div>
    ${mgtSemaine !== mgtLundi(today) ? `<button class="btn btn-ghost" style="width:100%;margin-bottom:10px;" onclick="mgtSemaine=null; nav('mgt-agenda')">Revenir à cette semaine</button>` : ''}
    ${jours.map(j => {
      const l = ag.filter(([, a]) => a.date === j).sort((x, y) => (x[1].heure || '').localeCompare(y[1].heure || ''));
      const nomJour = new Date(j + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
      if(!l.length && j !== today) return '';
      return `<div class="card" style="padding:8px 12px;${j === today ? 'border:2px solid var(--accent-2);' : ''}">
        <div style="font-weight:800;font-size:12.5px;text-transform:capitalize;color:var(--ink-soft);margin:4px 0;">${nomJour}${j === today ? ' · aujourd\'hui' : ''}</div>
        ${l.length ? l.map(([id, a]) => mgtLigneAgenda(id, a)).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:6px 0;">Rien de prévu</div>`}
      </div>`;
    }).join('')}
    ${ag.length === 0 ? buildEmptyState('Aucun rendez-vous cette semaine') : ''}`;
}
window.mgtFormRdv = (id, clientId) => {
  const a = id ? mgtGet('agenda')[id] : {date:getTodayISO(), heure:'09:00', type:'visite', clientId:clientId || ''};
  mgtModal(id ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous', `
    ${mgtSelect('Type', 'ma-type', Object.entries(MGT_TYPES_RDV).map(([k, v]) => [k, v.label]), a.type)}
    ${mgtSelect('Client', 'ma-client', mgtOptionsClients('— Sans client —'), a.clientId || '')}
    ${mgtChamp('Objet', 'ma-titre', a.titre, 'text', 'placeholder="Ex : présentation presse Macpi 335"')}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Date', 'ma-date', a.date, 'date')}</div><div style="flex:1;">${mgtChamp('Heure', 'ma-heure', a.heure, 'time')}</div></div>
    ${mgtZone('Notes / compte rendu', 'ma-notes', a.notes)}
    <button class="btn btn-primary" style="width:100%;" onclick="mgtSauverRdv('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="mgtSupprimerRdv('${id}')">Supprimer</button>` : ''}`);
};
window.mgtSauverRdv = (id) => {
  const date = mgtVal('ma-date'); if(!date){ showToast('La date est obligatoire'); return; }
  const list = mgtGet('agenda'), nid = id || mgtId('a');
  list[nid] = {...(list[nid] || {fait:false}), type:mgtVal('ma-type'), clientId:mgtVal('ma-client'), titre:mgtVal('ma-titre'), date, heure:mgtVal('ma-heure'), notes:mgtVal('ma-notes')};
  mgtSet('agenda', list); mgtFermer(); showToast('Rendez-vous enregistré'); nav(activeTab);
};
window.mgtSupprimerRdv = (id) => { const l = mgtGet('agenda'); delete l[id]; mgtSet('agenda', l); mgtFermer(); nav(activeTab); };
window.mgtBasculerFait = (id) => { const l = mgtGet('agenda'); if(!l[id]) return; l[id].fait = !l[id].fait; mgtSet('agenda', l); nav(activeTab); };

// ============================================================
// PARC MACHINES
// ============================================================
let mgtFiltreParc = {q:'', marque:'toutes'};
function mgtLigneMachine(id, m, avecClient){
  const g = garantieActive(m);
  return `<div class="session-row mgt-parc-row" data-search="${esc([m.marque, m.modele, m.serie, mgtClientNom(m.clientId)].join(' ').toLowerCase())}" ${canEditMgt() ? `style="cursor:pointer;" onclick="mgtFormMachine('${id}')"` : ''}>
    <div style="min-width:0;"><b style="font-size:13.5px;">${esc(m.marque)} ${esc(m.modele || '')}</b>
      <div style="font-size:11.5px;color:var(--ink-soft);">${avecClient ? esc(mgtClientNom(m.clientId)) + ' · ' : ''}N° ${esc(m.serie || '—')} · installée le ${mgtDate(m.dateInstallation)}</div></div>
    <div style="text-align:right;">${m.statut && m.statut !== 'service' ? mgtBadge({label:MGT_STATUTS_MACHINE[m.statut], cls:m.statut === 'arret' ? 'bad' : ''}) : ''}
      <div>${m.finGarantie ? mgtBadge(g ? {label:'Garantie → ' + mgtDate(m.finGarantie), cls:'good'} : {label:'Hors garantie', cls:''}) : ''}</div></div>
  </div>`;
}
function renderMgtParc(main){
  const b = mgtSection(main, ICONS.factory + ' Parc machines', canEditMgt() ? `<button class="btn btn-primary" onclick="mgtFormMachine()">+ Machine</button>` : '');
  const f = mgtFiltreParc;
  const l = Object.entries(mgtGet('machines')).filter(([, m]) => f.marque === 'toutes' || m.marque === f.marque)
    .sort((a, c) => mgtClientNom(a[1].clientId).localeCompare(mgtClientNom(c[1].clientId)));
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;">
      <input class="mgt-in" placeholder="Rechercher (client, modèle, n° de série)…" value="${esc(f.q)}" oninput="mgtFiltreParc.q=this.value; mgtFiltrerLignes('mgt-parc-row', this.value)">
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        ${[['toutes', 'Toutes']].concat(MGT_MARQUES.map(m => [m, m])).map(([k, lb]) => `<button class="btn ${f.marque === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 12px;font-size:12px;" onclick="mgtFiltreParc.marque='${k}'; nav('mgt-parc')">${lb}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:4px 12px;">${l.length ? l.map(([id, m]) => mgtLigneMachine(id, m, true)).join('') : buildEmptyState('Aucune machine')}</div>`;
  if(f.q) mgtFiltrerLignes('mgt-parc-row', f.q);
}
window.mgtFormMachine = (id, clientId) => {
  const m = id ? mgtGet('machines')[id] : {marque:'Macpi', clientId:clientId || '', dateInstallation:getTodayISO(), statut:'service'};
  if(!Object.keys(mgtGet('clients')).length){ showToast('Ajoutez d\'abord un client'); return; }
  mgtModal(id ? 'Modifier la machine' : 'Nouvelle machine installée', `
    ${mgtSelect('Client *', 'mm-client', mgtOptionsClients(), m.clientId)}
    ${mgtSelect('Marque', 'mm-marque', MGT_MARQUES.map(x => [x, x]), m.marque)}
    ${mgtChamp('Modèle', 'mm-modele', m.modele, 'text', 'placeholder="Ex : presse 335, Tecnica CM"')}
    ${mgtChamp('N° de série', 'mm-serie', m.serie)}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Installée le', 'mm-install', m.dateInstallation, 'date')}</div><div style="flex:1;">${mgtChamp('Fin de garantie', 'mm-garantie', m.finGarantie, 'date')}</div></div>
    ${mgtSelect('État', 'mm-statut', Object.entries(MGT_STATUTS_MACHINE), m.statut || 'service')}
    ${mgtZone('Notes', 'mm-notes', m.notes)}
    <button class="btn btn-primary" style="width:100%;" onclick="mgtSauverMachine('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="mgtSupprimerMachine('${id}')">Supprimer</button>` : ''}`);
};
window.mgtSauverMachine = (id) => {
  const clientId = mgtVal('mm-client'); if(!clientId){ showToast('Choisissez le client'); return; }
  const list = mgtGet('machines'), nid = id || mgtId('m');
  list[nid] = {clientId, marque:mgtVal('mm-marque'), modele:mgtVal('mm-modele'), serie:mgtVal('mm-serie'), dateInstallation:mgtVal('mm-install'), finGarantie:mgtVal('mm-garantie'), statut:mgtVal('mm-statut'), notes:mgtVal('mm-notes')};
  mgtSet('machines', list); mgtFermer(); showToast('Machine enregistrée'); nav(activeTab);
};
window.mgtSupprimerMachine = (id) => { if(!confirm('Supprimer cette machine du parc ?')) return; const l = mgtGet('machines'); delete l[id]; mgtSet('machines', l); mgtFermer(); nav(activeTab); };

// ============================================================
// PROJETS
// ============================================================
function mgtLigneProjet(id, p, avecClient){
  return `<div class="session-row" ${canEditMgt() ? `style="cursor:pointer;" onclick="mgtFormProjet('${id}')"` : ''}>
    <div style="min-width:0;"><b style="font-size:13.5px;">${esc(p.titre)}</b>
      <div style="font-size:11.5px;color:var(--ink-soft);">${avecClient ? esc(mgtClientNom(p.clientId)) + ' · ' : ''}${p.montant ? fmtDT(p.montant) + ' HT' : 'Montant à définir'}${p.dateCible ? ' · cible ' + mgtDate(p.dateCible) : ''}</div></div>
    ${mgtBadge(MGT_ETAPES[p.etape])}
  </div>`;
}
function renderMgtProjets(main){
  const b = mgtSection(main, ICONS.target + ' Projets', canEditMgt() ? `<button class="btn btn-primary" onclick="mgtFormProjet()">+ Projet</button>` : '');
  const l = Object.entries(mgtGet('projets'));
  b.innerHTML = l.length ? Object.keys(MGT_ETAPES).map(e => {
    const g = l.filter(([, p]) => p.etape === e); if(!g.length) return '';
    const tot = g.reduce((s, [, p]) => s + (Number(p.montant) || 0), 0);
    return `<div class="card" style="padding:8px 12px;"><div style="display:flex;justify-content:space-between;font-weight:800;font-size:12.5px;color:var(--ink-soft);margin:4px 0;"><span>${MGT_ETAPES[e].label} (${g.length})</span><span>${fmtDT(tot)}</span></div>
      ${g.map(([id, p]) => mgtLigneProjet(id, p, true)).join('')}</div>`;
  }).join('') : buildEmptyState('Aucun projet', 'Un projet suit une vente de la prospection à l\'installation.');
}
window.mgtFormProjet = (id, clientId) => {
  const p = id ? mgtGet('projets')[id] : {etape:'prospection', clientId:clientId || ''};
  if(!Object.keys(mgtGet('clients')).length){ showToast('Ajoutez d\'abord un client'); return; }
  const devis = id ? Object.entries(mgtGet('devis')).filter(([, d]) => d.projetId === id) : [];
  mgtModal(id ? 'Modifier le projet' : 'Nouveau projet', `
    ${mgtChamp('Titre *', 'mp-titre', p.titre, 'text', 'placeholder="Ex : ligne de thermocollage"')}
    ${mgtSelect('Client *', 'mp-client', mgtOptionsClients(), p.clientId)}
    ${mgtSelect('Étape', 'mp-etape', Object.entries(MGT_ETAPES).map(([k, v]) => [k, v.label]), p.etape)}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Montant HT (DT)', 'mp-montant', p.montant, 'number', 'step="0.001" min="0"')}</div><div style="flex:1;">${mgtChamp('Date cible', 'mp-date', p.dateCible, 'date')}</div></div>
    ${mgtZone('Notes', 'mp-notes', p.notes)}
    ${devis.length ? `<div style="font-size:12px;margin-bottom:12px;"><b>Devis liés :</b> ${devis.map(([did, d]) => `<a href="#" onclick="mgtFermer(); mgtOuvrirDevis('${did}'); return false;">${esc(d.numero)}${d.version > 1 ? ' v' + d.version : ''}</a>`).join(', ')}</div>` : ''}
    <button class="btn btn-primary" style="width:100%;" onclick="mgtSauverProjet('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer(); mgtNouveauDevis('${p.clientId}', '${id}')">Créer un devis pour ce projet</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="mgtSupprimerProjet('${id}')">Supprimer</button>` : ''}`);
};
window.mgtSauverProjet = (id) => {
  const titre = mgtVal('mp-titre'), clientId = mgtVal('mp-client');
  if(!titre || !clientId){ showToast('Titre et client obligatoires'); return; }
  const list = mgtGet('projets'), nid = id || mgtId('p');
  list[nid] = {...(list[nid] || {cree:getTodayISO()}), titre, clientId, etape:mgtVal('mp-etape'), montant:parseFloat(mgtVal('mp-montant')) || 0, dateCible:mgtVal('mp-date'), notes:mgtVal('mp-notes')};
  // Un projet gagné transforme le prospect en client.
  if(['gagne', 'installation', 'termine'].includes(list[nid].etape)){ const cl = mgtGet('clients'); if(cl[clientId] && cl[clientId].type === 'prospect'){ cl[clientId].type = 'client'; mgtSet('clients', cl); } }
  mgtSet('projets', list); mgtFermer(); showToast('Projet enregistré'); nav(activeTab);
};
window.mgtSupprimerProjet = (id) => { if(!confirm('Supprimer ce projet ?')) return; const l = mgtGet('projets'); delete l[id]; mgtSet('projets', l); mgtFermer(); nav(activeTab); };

// ============================================================
// OFFRES ET DEVIS
// ============================================================
let mgtDevisId = null, mgtFiltreDevis = 'tous';
function mgtLigneDevis(id, d, avecClient){
  const t = devisTotaux(d);
  return `<div class="session-row" style="cursor:pointer;" onclick="mgtOuvrirDevis('${id}')">
    <div style="min-width:0;"><b style="font-size:13.5px;">${esc(d.numero)}${d.version > 1 ? ' v' + d.version : ''}</b> <span style="font-size:12px;color:var(--ink-soft);">${mgtDate(d.date)}</span>
      <div style="font-size:11.5px;color:var(--ink-soft);">${avecClient ? esc(mgtClientNom(d.clientId)) + ' · ' : ''}${esc(d.objet || '')}</div></div>
    <div style="text-align:right;"><div style="font-weight:700;font-size:13px;">${fmtDT(t.ttc)}</div>${mgtBadge(MGT_STATUTS_DEVIS[d.statut])}</div>
  </div>`;
}
function renderMgtDevis(main){
  const b = mgtSection(main, ICONS.export + ' Offres et devis', canEditMgt() ? `<button class="btn btn-primary" onclick="mgtNouveauDevis()">+ Devis</button>` : '');
  const l = Object.entries(mgtGet('devis')).filter(([, d]) => mgtFiltreDevis === 'tous' || d.statut === mgtFiltreDevis)
    .sort((a, c) => (c[1].date + c[1].numero).localeCompare(a[1].date + a[1].numero));
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;gap:6px;flex-wrap:wrap;">
      ${[['tous', 'Tous']].concat(Object.entries(MGT_STATUTS_DEVIS).map(([k, v]) => [k, v.label])).map(([k, lb]) => `<button class="btn ${mgtFiltreDevis === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 12px;font-size:12px;" onclick="mgtFiltreDevis='${k}'; nav('mgt-devis')">${lb}</button>`).join('')}
    </div>
    <div class="card" style="padding:4px 12px;">${l.length ? l.map(([id, d]) => mgtLigneDevis(id, d, true)).join('') : buildEmptyState('Aucun devis')}</div>`;
}
window.mgtOuvrirDevis = (id) => { mgtDevisId = id; nav('mgt-devis-edit'); };
window.mgtNouveauDevis = (clientId, projetId) => {
  if(!Object.keys(mgtGet('clients')).length){ showToast('Ajoutez d\'abord un client'); return; }
  const P = mgtParams(), today = getTodayISO(), list = mgtGet('devis'), id = mgtId('d');
  list[id] = {numero:mgtProchainNumero(today.slice(0, 4)), version:1, date:today, validite:mgtAddDays(today, Number(P.validite) || 30),
    clientId:clientId || '', projetId:projetId || '', objet:'', lignes:[{designation:'', qte:1, pu:0, remise:0}], tva:Number(P.tva) || 19, statut:'brouillon', conditions:P.conditions};
  mgtSet('devis', list); mgtOuvrirDevis(id);
};
function renderMgtDevisEdit(main){
  const d = mgtGet('devis')[mgtDevisId];
  if(!d){ nav('mgt-devis'); return; }
  const ed = canEditMgt() && d.statut !== 'accepte', t = devisTotaux(d), id = mgtDevisId;
  const projets = Object.entries(mgtGet('projets')).filter(([, p]) => p.clientId === d.clientId).map(([pid, p]) => [pid, p.titre]);
  const dis = ed ? '' : 'disabled';
  const b = mgtSection(main, `<span style="cursor:pointer;" onclick="nav('mgt-devis')">‹</span> Devis ${esc(d.numero)}${d.version > 1 ? ' v' + d.version : ''}`,
    `<button class="btn btn-ghost" onclick="mgtImprimerDevis('${id}')">Imprimer / PDF</button>`);
  b.innerHTML = `
    <div class="card">
      ${!ed && canEditMgt() ? `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;">Devis accepté : il n'est plus modifiable. Créez une nouvelle version si besoin.</div>` : ''}
      ${mgtSelect('Client', 'md-client', mgtOptionsClients('— Choisir —'), d.clientId).replace('<select', `<select ${dis} onchange="mgtMajDevis('clientId', this.value, true)"`)}
      ${mgtSelect('Projet', 'md-projet', [['', '— Aucun —']].concat(projets), d.projetId || '').replace('<select', `<select ${dis} onchange="mgtMajDevis('projetId', this.value)"`)}
      ${mgtChamp('Objet', 'md-objet', d.objet, 'text', `${dis} placeholder="Ex : fourniture et installation d'une presse Macpi" onchange="mgtMajDevis('objet', this.value)"`)}
      <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Date', 'md-date', d.date, 'date', `${dis} onchange="mgtMajDevis('date', this.value)"`)}</div><div style="flex:1;">${mgtChamp('Valable jusqu\'au', 'md-validite', d.validite, 'date', `${dis} onchange="mgtMajDevis('validite', this.value)"`)}</div></div>
      ${mgtSelect('Statut', 'md-statut', Object.entries(MGT_STATUTS_DEVIS).map(([k, v]) => [k, v.label]), d.statut).replace('<select', `<select ${canEditMgt() ? '' : 'disabled'} onchange="mgtMajDevis('statut', this.value, true)"`)}
    </div>
    <div class="card" style="padding:10px;">
      <h3 style="margin:0 0 8px;font-size:14px;">Lignes</h3>
      ${(d.lignes || []).map((l, i) => `<div class="mgt-ligne">
        <div style="display:flex;gap:6px;align-items:flex-start;">
          <textarea rows="2" class="mgt-in" placeholder="Désignation" ${dis} onchange="mgtMajLigne(${i}, 'designation', this.value)">${esc(l.designation)}</textarea>
          ${ed ? `<button class="icon-btn" title="Retirer la ligne" onclick="mgtRetirerLigne(${i})">✕</button>` : ''}
        </div>
        <div class="mgt-ligne-nums">
          <label>Qté<input class="mgt-in" type="number" min="0" step="1" value="${l.qte}" ${dis} onchange="mgtMajLigne(${i}, 'qte', this.value)"></label>
          <label>P.U. HT<input class="mgt-in" type="number" min="0" step="0.001" value="${l.pu}" ${dis} onchange="mgtMajLigne(${i}, 'pu', this.value)"></label>
          <label>Remise %<input class="mgt-in" type="number" min="0" max="100" step="0.5" value="${l.remise || 0}" ${dis} onchange="mgtMajLigne(${i}, 'remise', this.value)"></label>
          <div class="mgt-ligne-tot">${fmtDT((Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise) || 0) / 100))}</div>
        </div>
      </div>`).join('')}
      ${ed ? `<button class="btn btn-ghost" style="margin-top:8px;padding:6px 12px;font-size:12px;" onclick="mgtAjouterLigne()">+ Ligne</button>` : ''}
      <div style="margin-top:12px;font-size:14px;line-height:1.8;text-align:right;">
        <div>Total HT : <b>${fmtDT(t.ht)}</b></div>
        <div>TVA <input class="mgt-in" type="number" min="0" max="100" step="1" value="${d.tva}" ${dis} style="width:64px;display:inline-block;padding:4px 6px;" onchange="mgtMajDevis('tva', parseFloat(this.value)||0, true)"> % : <b>${fmtDT(t.tva)}</b></div>
        <div style="font-size:16px;">Total TTC : <b>${fmtDT(t.ttc)}</b></div>
      </div>
    </div>
    <div class="card">${mgtZone('Conditions (imprimées sur le devis)', 'md-conditions', d.conditions).replace('<textarea', `<textarea ${dis} onchange="mgtMajDevis('conditions', this.value)"`)}</div>
    ${canEditMgt() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-ghost" style="flex:1;" onclick="mgtNouvelleVersion('${id}')">Nouvelle version</button>
      <button class="btn btn-ghost" style="flex:1;color:var(--bad);" onclick="mgtSupprimerDevis('${id}')">Supprimer</button>
    </div>` : ''}`;
}
function mgtSauverDevisCourant(fn, redessiner){
  const list = mgtGet('devis'), d = list[mgtDevisId]; if(!d) return;
  fn(d); mgtSet('devis', list);
  if(redessiner) nav('mgt-devis-edit');
}
window.mgtMajDevis = (champ, v, redessiner) => mgtSauverDevisCourant(d => {
  d[champ] = v;
  if(champ === 'clientId') d.projetId = '';
  // Devis accepté : le projet lié passe à « Gagné » et le prospect devient client.
  if(champ === 'statut' && v === 'accepte'){
    const pr = mgtGet('projets'); if(d.projetId && pr[d.projetId] && ['prospection', 'offre', 'negociation'].includes(pr[d.projetId].etape)){ pr[d.projetId].etape = 'gagne'; mgtSet('projets', pr); }
    const cl = mgtGet('clients'); if(cl[d.clientId] && cl[d.clientId].type === 'prospect'){ cl[d.clientId].type = 'client'; mgtSet('clients', cl); }
  }
  if(champ === 'statut' && v === 'envoye'){
    const pr = mgtGet('projets'); if(d.projetId && pr[d.projetId] && pr[d.projetId].etape === 'prospection'){ pr[d.projetId].etape = 'offre'; mgtSet('projets', pr); }
  }
}, redessiner);
window.mgtMajLigne = (i, champ, v) => mgtSauverDevisCourant(d => { d.lignes[i][champ] = champ === 'designation' ? v : (parseFloat(v) || 0); }, champ !== 'designation');
window.mgtAjouterLigne = () => mgtSauverDevisCourant(d => { d.lignes.push({designation:'', qte:1, pu:0, remise:0}); }, true);
window.mgtRetirerLigne = (i) => mgtSauverDevisCourant(d => { d.lignes.splice(i, 1); }, true);
window.mgtNouvelleVersion = (id) => {
  const list = mgtGet('devis'), d = list[id];
  const v = Math.max(...Object.values(list).filter(x => x.numero === d.numero).map(x => x.version || 1)) + 1;
  const nid = mgtId('d'), today = getTodayISO();
  list[nid] = {...JSON.parse(JSON.stringify(d)), version:v, date:today, validite:mgtAddDays(today, Number(mgtParams().validite) || 30), statut:'brouillon'};
  mgtSet('devis', list); showToast('Version ' + v + ' créée'); mgtOuvrirDevis(nid);
};
window.mgtSupprimerDevis = (id) => { if(!confirm('Supprimer ce devis ?')) return; const l = mgtGet('devis'); delete l[id]; mgtSet('devis', l); nav('mgt-devis'); };
// Impression : une page A4 propre dans une nouvelle fenêtre ; « Enregistrer en PDF » depuis la boîte d'impression.
window.mgtImprimerDevis = (id) => {
  const d = mgtGet('devis')[id], c = mgtGet('clients')[d.clientId] || {}, P = mgtParams(), t = devisTotaux(d);
  const n = (x) => (Number(x) || 0).toLocaleString('fr-FR', {minimumFractionDigits:3, maximumFractionDigits:3});
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(d.numero)}</title><style>
    body{font:12px Arial,sans-serif;color:#111;margin:28px;} h1{font-size:20px;margin:0 0 4px;} .top{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px;}
    .box{border:1px solid #999;padding:10px;border-radius:4px;min-width:220px;} table{width:100%;border-collapse:collapse;margin-top:14px;} th,td{border:1px solid #999;padding:6px;vertical-align:top;}
    th{background:#eee;text-align:left;} td.n{text-align:right;white-space:nowrap;} .tot{width:280px;margin-left:auto;margin-top:12px;} .tot td{border:none;padding:3px 6px;} .tot tr:last-child td{font-weight:bold;font-size:14px;border-top:1px solid #111;}
    .cond{margin-top:22px;white-space:pre-line;} .pied{margin-top:30px;font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:6px;} @media print{body{margin:12mm;}}
  </style></head><body>
    <div class="top"><div><h1>${esc(P.raison)}</h1><div>${esc(P.adresse).replace(/\n/g, '<br>')}</div><div>${P.tel ? 'Tél. ' + esc(P.tel) : ''}${P.email ? ' · ' + esc(P.email) : ''}</div>${P.mf ? `<div>MF ${esc(P.mf)}</div>` : ''}</div>
      <div class="box"><b>DEVIS ${esc(d.numero)}${d.version > 1 ? ' (version ' + d.version + ')' : ''}</b><br>Date : ${mgtDate(d.date)}<br>Valable jusqu'au : ${mgtDate(d.validite)}</div></div>
    <div class="box" style="margin-left:auto;width:45%;"><b>${esc(c.nom || '')}</b><br>${esc([c.adresse, c.ville].filter(Boolean).join(', '))}${c.mf ? '<br>MF ' + esc(c.mf) : ''}</div>
    ${d.objet ? `<p style="margin-top:18px;"><b>Objet :</b> ${esc(d.objet)}</p>` : ''}
    <table><thead><tr><th>Désignation</th><th style="width:50px;">Qté</th><th style="width:100px;">P.U. HT</th><th style="width:55px;">Rem.</th><th style="width:110px;">Total HT</th></tr></thead><tbody>
      ${(d.lignes || []).map(l => `<tr><td>${esc(l.designation).replace(/\n/g, '<br>')}</td><td class="n">${l.qte}</td><td class="n">${n(l.pu)}</td><td class="n">${l.remise ? l.remise + ' %' : ''}</td><td class="n">${n((Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise) || 0) / 100))}</td></tr>`).join('')}
    </tbody></table>
    <table class="tot"><tr><td>Total HT</td><td class="n">${n(t.ht)} DT</td></tr><tr><td>TVA ${d.tva} %</td><td class="n">${n(t.tva)} DT</td></tr><tr><td>Total TTC</td><td class="n">${n(t.ttc)} DT</td></tr></table>
    ${d.conditions ? `<div class="cond"><b>Conditions</b><br>${esc(d.conditions)}</div>` : ''}
    <div class="pied">${esc(P.raison)}${P.rib ? ' · RIB ' + esc(P.rib) : ''}</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour imprimer'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

// ============================================================
// PARAMÈTRES MGT
// ============================================================
function renderMgtParametres(main){
  const P = mgtParams();
  const b = mgtSection(main, ICONS.params + ' Paramètres MGT');
  b.innerHTML = `<div class="card">
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px;">Coordonnées imprimées en tête des devis.</p>
    ${mgtChamp('Raison sociale', 'mx-raison', P.raison)}
    ${mgtZone('Adresse', 'mx-adresse', P.adresse)}
    ${mgtChamp('Matricule fiscal', 'mx-mf', P.mf)}
    ${mgtChamp('Téléphone', 'mx-tel', P.tel)}${mgtChamp('E-mail', 'mx-email', P.email)}
    ${mgtChamp('RIB', 'mx-rib', P.rib)}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('TVA par défaut (%)', 'mx-tva', P.tva, 'number')}</div><div style="flex:1;">${mgtChamp('Validité des devis (jours)', 'mx-validite', P.validite, 'number')}</div></div>
    ${mgtZone('Conditions par défaut', 'mx-conditions', P.conditions)}
    <button class="btn btn-primary" style="width:100%;" onclick="mgtSauverParams()">Enregistrer</button>
  </div>`;
}
window.mgtSauverParams = () => {
  setJSON('mgt_parametres', {raison:mgtVal('mx-raison') || 'MGT', adresse:mgtVal('mx-adresse'), mf:mgtVal('mx-mf'), tel:mgtVal('mx-tel'), email:mgtVal('mx-email'), rib:mgtVal('mx-rib'),
    tva:parseFloat(mgtVal('mx-tva')) || 0, validite:parseInt(mgtVal('mx-validite')) || 30, conditions:mgtVal('mx-conditions')});
  showToast('Paramètres enregistrés');
};

// --- Styles propres au module ---
(function(){
  const s = document.createElement('style');
  s.textContent = `
    .mgt-in{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--ink);font-family:inherit;font-size:14.5px;}
    textarea.mgt-in{resize:vertical;}
    .mgt-in:focus{outline:none;border-color:var(--accent-2);background:#fff;}
    .mgt-ligne{border:1px solid var(--border);border-radius:10px;padding:8px;margin-bottom:8px;}
    .mgt-ligne-nums{display:grid;grid-template-columns:70px 1fr 80px;gap:6px;margin-top:6px;align-items:end;}
    .mgt-ligne-nums label{font-size:10.5px;font-weight:700;color:var(--ink-soft);display:flex;flex-direction:column;gap:3px;}
    .mgt-ligne-nums .mgt-in{padding:7px 8px;font-size:14px;}
    .mgt-ligne-tot{grid-column:1 / -1;text-align:right;font-weight:800;font-size:13.5px;}
    @media (min-width:700px){ .mgt-ligne-nums{grid-template-columns:80px 140px 90px 1fr;} .mgt-ligne-tot{grid-column:auto;padding-bottom:8px;} }
  `;
  document.head.appendChild(s);
})();
