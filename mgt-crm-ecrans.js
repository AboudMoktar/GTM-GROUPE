// ============================================================
// MGT — ÉCRANS CRM (Pilotage, Clients, Fiche, Planning, Offres, Projets, CA)
// ============================================================
// Chargé après mgt-crm-module.js. Les déclarations ci-dessous remplacent les
// anciens écrans de mgt-module.js (même noms de fonctions).

const CRM_COULEUR = {crit:'bad', warn:'warn', info:''};
function crmEd(){ return canEditMgt(); }
function crmVide(t){ return `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">${t}</div>`; }
function crmPetitBtn(label, onclick){ return `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="${onclick}">${label}</button>`; }
function crmCarte(titre, contenu, action){
  return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><h3 style="margin:0;font-size:14px;">${titre}</h3>${action || ''}</div>${contenu}</div>`;
}
function crmBadge(txt, cls){ return `<span class="hour-rend ${cls || ''}" style="font-size:11px;">${esc(txt)}</span>`; }
function crmNomClient(id){ const c = mgtGet('clients')[id]; return c ? (c.nom || '—') : '—'; }
function crmOuvrir(id){ mgtFicheId = id; nav('mgt-fiche'); }
window.crmOuvrir = crmOuvrir;
function crmListeBrute(c, champ){ return crmTableau(c[champ]); }
function crmChoix(liste, val){
  const l = liste.slice(); if(val && l.indexOf(val) < 0) l.push(val);
  return l.map(x => [x, x || '—']);
}
function crmConfirmer(msg, action){
  mgtModal('Confirmation', `<p style="font-size:14px;margin-top:0;">${msg}</p>
    <button class="btn btn-primary" style="width:100%;background:var(--bad);" onclick="${action}">Oui, supprimer</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer()">Annuler</button>`);
}

// ============================================================
// PILOTAGE
// ============================================================
function crmLigneAction(a, opts){
  opts = opts || {};
  const d = crmActionJours(a), cls = d < 0 ? 'bad' : d === 0 ? 'warn' : '';
  const cle = crmNorm(a.priority).includes('haute') || crmNorm(a.priority).startsWith('a ') ? 'bad' : '';
  return `<div class="session-row" style="align-items:flex-start;cursor:pointer;" onclick="crmOuvrir('${a.clientId}')">
    <div style="flex:1;min-width:0;"><div style="font-size:13.5px;"><b>${esc(crmNomClient(a.clientId))}</b></div>
    <div style="font-size:11.5px;color:var(--ink-soft);">${esc(a.type || 'action')} · ${esc(a.objective || '')}${a.commercial ? ' · ' + esc(a.commercial) : ''}</div></div>
    <div style="text-align:right;">${crmBadge(crmDateFr(a.date), cls)}${cle ? '<div style="margin-top:3px;">' + crmBadge(a.priority, cle) + '</div>' : ''}</div>
  </div>`;
}
function renderMgtDashboard(main){
  const b = mgtSection(main, ICONS.dashboard + ' Pilotage MGT');
  const k = mgtIndicateurs(), s = savIndicateurs(), f = factIndicateurs('mgt'), auj = getTodayISO();
  const clients = Object.entries(mgtGet('clients')), actions = crmActionsAPlanifier();
  const duJour = actions.filter(a => crmISO(a.date) === auj), retard = actions.filter(a => crmActionJours(a) < 0).sort((x, y) => crmDate(x.date) - crmDate(y.date));
  const semaine = actions.filter(a => { const d = crmActionJours(a); return d > 0 && d <= 7; }).sort((x, y) => crmDate(x.date) - crmDate(y.date));
  const offres = clients.flatMap(([, c]) => crmOffres(c)), enCours = offres.filter(crmOffreEnCours);
  const attenteValid = offres.filter(o => crmOffreActive(o) && crmOffreValidation(o).cle !== 'validee' && crmOffreValidation(o).cle !== 'refusee' && (crmOffreValidation(o).cle === 'prevalidee'));
  const appels = duJour.filter(a => crmNorm(a.type).includes('appel')).length, visites = duJour.filter(a => crmNorm(a.type).includes('visite')).length;
  const relDevis = duJour.filter(a => a.source === 'auto-devis').length;
  const annee = String(new Date().getFullYear()), mois = auj.slice(0, 7);
  const fact = crmToutesFactures();
  const caAn = fact.filter(x => String(x.date || '').slice(0, 4) === annee), caMois = fact.filter(x => crmISO(x.date).slice(0, 7) === mois);
  const reste = fact.reduce((s2, x) => s2 + Math.max(0, crmNombre(x.amount) - crmNombre(x.paid)), 0);
  const alertes = crmAlertes();
  const tuile = (v, l, cls, tab) => `<div class="kpi-mini" style="cursor:pointer;" onclick="nav('${tab}')"><div style="font-family:var(--mono);font-size:20px;font-weight:800;" class="${cls || ''}">${v}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">${l}</div></div>`;
  const pondere = clients.reduce((t, [, c]) => t + crmPipeline(c), 0);
  b.innerHTML = `
    <div class="kpi-mini-grid">
      ${tuile(duJour.length, 'Actions aujourd\'hui', '', 'mgt-agenda')}
      ${tuile(visites + ' / ' + appels, 'Visites / appels', '', 'mgt-agenda')}
      ${tuile(relDevis, 'Relances devis', relDevis ? 'hour-rend warn' : '', 'mgt-agenda')}
      ${tuile(retard.length, 'En retard', retard.length ? 'hour-rend bad' : '', 'mgt-agenda')}
    </div>
    <div class="kpi-mini-grid">
      ${tuile(enCours.length, 'Offres en cours', '', 'mgt-offres')}
      ${tuile(crmSommeParDevise(enCours, crmOffreMontant, o => o.devise), 'Montant en cours', '', 'mgt-offres')}
      ${tuile(Math.round(pondere).toLocaleString('fr-FR'), 'Pipeline pondéré', '', 'mgt-offres')}
      ${tuile(k.offresRelance || 0, 'Offres à relancer', k.offresRelance ? 'hour-rend warn' : '', 'mgt-offres')}
    </div>
    <div class="kpi-mini-grid">
      ${tuile(attenteValid.length, 'Prévalidées', attenteValid.length ? 'hour-rend warn' : '', 'mgt-offres')}
      ${tuile(crmProjets().filter(p => p.phase !== 'fini').length, 'Projets en cours', '', 'mgt-projets')}
      ${tuile(crmSommeParDevise(caMois, x => crmNombre(x.amount), () => 'EUR'), 'CA du mois', '', 'mgt-ca')}
      ${tuile(crmSommeParDevise(caAn, x => crmNombre(x.amount), () => 'EUR'), 'CA ' + annee, '', 'mgt-ca')}
    </div>
    <div class="kpi-mini-grid">
      ${tuile(s.ticketsActifs, 'Tickets SAV', s.urgents ? 'hour-rend bad' : '', 'mgt-sav')}
      ${tuile(s.machinesArret, 'Machines à l\'arrêt', s.machinesArret ? 'hour-rend bad' : '', 'mgt-sav')}
      ${tuile(crmMontant(reste, '€'), 'À encaisser (CRM)', reste ? 'hour-rend warn' : '', 'mgt-ca')}
      ${tuile(f.retard, 'Factures en retard', f.retard ? 'hour-rend bad' : '', 'fact-liste')}
    </div>
    ${crmCarte('Alertes (' + alertes.length + ')', alertes.length ? alertes.slice(0, 12).map(a => `<div class="session-row" style="cursor:pointer;align-items:flex-start;" onclick="crmOuvrir('${a.clientId}')"><div style="flex:1;min-width:0;"><b style="font-size:13px;">${esc(crmNomClient(a.clientId))}</b><div style="font-size:11.5px;color:var(--ink-soft);">${esc(a.titre)}${a.detail ? ' · ' + esc(a.detail) : ''}</div></div>${crmBadge(a.niveau === 'crit' ? 'Critique' : 'À suivre', CRM_COULEUR[a.niveau])}</div>`).join('') + (alertes.length > 12 ? crmVide('+ ' + (alertes.length - 12) + ' autres alertes') : '') : crmVide('Aucune alerte'))}
    ${crmCarte('À faire aujourd\'hui (' + duJour.length + ')', duJour.length ? duJour.slice(0, 15).map(a => crmLigneAction(a)).join('') : crmVide('Rien de prévu aujourd\'hui'))}
    ${retard.length ? crmCarte('En retard (' + retard.length + ')', retard.slice(0, 10).map(a => crmLigneAction(a)).join('')) : ''}
    ${crmCarte('Les 7 prochains jours (' + semaine.length + ')', semaine.length ? semaine.slice(0, 12).map(a => crmLigneAction(a)).join('') : crmVide('Rien de prévu'))}`;
}

// ============================================================
// CLIENTS
// ============================================================
let crmFiltre = {q:'', type:'tous', imp:'', region:'', typeClient:'', groupe:'', segment:'', tri:'nom', page:0};
const CRM_PAGE = 25;
const CRM_SEGMENTS = [['', 'Tous'], ['sansvisite', 'Sans visite 90 j'], ['offre', 'Offre active'], ['relance', 'À relancer'], ['asansaction', 'A sans action'], ['chaud', 'Projet chaud']];
function crmClientsFiltres(){
  const f = crmFiltre, q = crmNorm(f.q);
  let l = Object.entries(mgtGet('clients')).filter(([, c]) => {
    if(f.type === 'client' && crmEstProspect(c)) return false;
    if(f.type === 'prospect' && !crmEstProspect(c)) return false;
    if(f.imp && crmLettre(c) !== f.imp) return false;
    if(f.region && (c.region || '') !== f.region) return false;
    if(f.typeClient && (c.typeClient || '') !== f.typeClient) return false;
    if(f.groupe && (c.groupe || '') !== f.groupe) return false;
    if(q && !crmNorm([c.nom, c.ville, c.region, c.activite, c.tel, c.email, c.contactPrincipal].concat(crmContacts(c).map(x => x.nom)).join(' ')).includes(q)) return false;
    return true;
  });
  const seg = f.segment;
  if(seg) l = l.filter(([id, c]) => {
    if(seg === 'sansvisite') { const j = crmJoursSansVisite(c); return j === null || j > 90; }
    if(seg === 'offre') return crmOffres(c).some(crmOffreEnCours);
    if(seg === 'relance') return crmOffres(c).some(o => ['depassee', 'aujourdhui'].includes(crmOffreRelance(o)));
    if(seg === 'asansaction') return crmLettre(c) === 'A' && !crmAActionAVenir(id, c);
    if(seg === 'chaud') return crmProjetChaud(c);
    return true;
  });
  const tri = f.tri;
  l.sort((a, b) => {
    if(tri === 'visite') return (crmJoursSansVisite(b[1]) == null ? 9999 : crmJoursSansVisite(b[1])) - (crmJoursSansVisite(a[1]) == null ? 9999 : crmJoursSansVisite(a[1]));
    if(tri === 'importance') return (crmLettre(a[1]) || 'Z').localeCompare(crmLettre(b[1]) || 'Z') || (a[1].nom || '').localeCompare(b[1].nom || '');
    if(tri === 'pipeline') return crmPipeline(b[1]) - crmPipeline(a[1]);
    return (a[1].nom || '').localeCompare(b[1].nom || '');
  });
  return l;
}
function crmValeursDistinctes(champ){
  return Array.from(new Set(Object.values(mgtGet('clients')).map(c => c[champ]).filter(Boolean))).sort();
}
window.crmRafraichirListe = () => {
  const zone = document.getElementById('crm-liste'); if(!zone) return;
  const l = crmClientsFiltres(), f = crmFiltre, pages = Math.max(1, Math.ceil(l.length / CRM_PAGE));
  if(f.page >= pages) f.page = pages - 1;
  const vue = l.slice(f.page * CRM_PAGE, (f.page + 1) * CRM_PAGE), machines = Object.values(mgtGet('machines'));
  zone.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);margin:0 2px 6px;">${l.length} résultat${l.length > 1 ? 's' : ''}</div>
    <div class="card" style="padding:4px 12px;">${vue.length ? vue.map(([id, c]) => {
      const j = crmJoursSansVisite(c), p = crmProchaineAction(id, c), nbm = machines.filter(m => m.clientId === id && m.statut !== 'retiree').length;
      const rel = crmOffres(c).some(o => ['depassee', 'aujourdhui'].includes(crmOffreRelance(o)));
      return `<div class="session-row" style="cursor:pointer;" onclick="crmOuvrir('${id}')">
        <div style="min-width:0;flex:1;"><b style="font-size:14px;">${esc(c.nom)}</b>
        <div style="font-size:11.5px;color:var(--ink-soft);">${esc([c.ville, c.region].filter(Boolean).join(' · ') || '—')}${nbm ? ' · ' + nbm + ' machine(s)' : ''}</div>
        <div style="font-size:11px;color:var(--ink-faint);">${j === null ? 'Jamais visité' : 'Visite il y a ' + j + ' j'}${p ? ' · Prochaine : ' + esc(p.type || '') + ' ' + crmDateFr(p.date) : ''}</div></div>
        <div style="text-align:right;display:flex;flex-direction:column;gap:3px;align-items:flex-end;">${crmEstProspect(c) ? crmBadge('Prospect', 'warn') : crmBadge('Client', 'good')}${crmLettre(c) ? crmBadge(crmLettre(c), crmLettre(c) === 'A' ? 'excellent' : '') : ''}${rel ? crmBadge('Relance', 'bad') : ''}</div>
      </div>`;
    }).join('') : buildEmptyState('Aucun client', 'Modifiez les filtres ou importez votre base CRM dans Params.')}</div>
    ${pages > 1 ? `<div style="display:flex;align-items:center;gap:8px;justify-content:center;margin:8px 0;"><button class="btn btn-ghost" ${f.page ? '' : 'disabled'} onclick="crmFiltre.page--; crmRafraichirListe()">‹</button><span style="font-size:12.5px;">Page ${f.page + 1} / ${pages}</span><button class="btn btn-ghost" ${f.page < pages - 1 ? '' : 'disabled'} onclick="crmFiltre.page++; crmRafraichirListe()">›</button></div>` : ''}`;
};
window.crmFiltrer = (cle, val) => { crmFiltre[cle] = val; crmFiltre.page = 0; crmRafraichirListe(); };
function renderMgtClients(main){
  const b = mgtSection(main, ICONS.team + ' Clients', crmEd() ? `<button class="btn btn-primary" onclick="crmFormClient()">+ Client</button>` : '');
  const f = crmFiltre;
  const sel = (cle, label, vals) => `<select class="mgt-in" style="padding:7px 8px;font-size:13px;" onchange="crmFiltrer('${cle}', this.value)"><option value="">${label}</option>${vals.map(v => `<option ${v === f[cle] ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;">
      <input class="mgt-in" placeholder="Rechercher (nom, ville, contact, activité)…" value="${esc(f.q)}" oninput="crmFiltrer('q', this.value)">
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        ${[['tous', 'Tous'], ['client', 'Clients'], ['prospect', 'Prospects']].map(([k, l]) => `<button class="btn ${f.type === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 12px;font-size:12px;" onclick="crmFiltre.type='${k}'; nav('mgt-clients')">${l}</button>`).join('')}
        ${CRM_SEGMENTS.map(([k, l]) => `<button class="btn ${f.segment === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 10px;font-size:12px;" onclick="crmFiltre.segment='${k}'; nav('mgt-clients')">${l}</button>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px;">
        ${sel('imp', 'Importance', ['A', 'B', 'C'])}${sel('region', 'Région', crmValeursDistinctes('region'))}
        ${sel('typeClient', 'Type client', crmValeursDistinctes('typeClient'))}${sel('groupe', 'Groupe', crmValeursDistinctes('groupe'))}
        <select class="mgt-in" style="padding:7px 8px;font-size:13px;" onchange="crmFiltrer('tri', this.value)">${[['nom', 'Tri : nom'], ['visite', 'Tri : sans visite'], ['importance', 'Tri : importance'], ['pipeline', 'Tri : pipeline']].map(([k, l]) => `<option value="${k}" ${f.tri === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
    </div>
    <div id="crm-liste"></div>`;
  crmRafraichirListe();
}

// ---------- formulaire client ----------
window.crmFormClient = (id) => {
  const c = id ? mgtGet('clients')[id] : {type:'prospect'};
  mgtModal(id ? 'Modifier le client' : 'Nouveau client', `
    ${mgtChamp('Raison sociale *', 'cc-nom', c.nom)}
    ${mgtSelect('Type', 'cc-type', [['prospect', 'Prospect'], ['client', 'Client']], c.type || 'prospect')}
    ${mgtSelect('Importance', 'cc-importance', crmChoix(['', 'A - Prioritaire', 'B - Important', 'C - Standard'], c.importance), c.importance || '')}
    ${mgtSelect('Fréquence de visite', 'cc-freq', crmChoix(['auto', '30', '60', '90', '0'], String(c.frequenceVisite || 'auto')).map(([k]) => [k, k === 'auto' ? 'Automatique (selon importance)' : k === '0' ? 'Aucune' : 'Tous les ' + k + ' jours']), String(c.frequenceVisite || 'auto'))}
    ${mgtChamp('Ville / délégation', 'cc-ville', c.ville)}${mgtChamp('Gouvernorat / région', 'cc-region', c.region)}
    ${mgtChamp('Adresse', 'cc-adresse', c.adresse)}${mgtChamp('Activité', 'cc-activite', c.activite)}
    ${mgtSelect('Type de client', 'cc-typeClient', crmChoix(CRM_TYPES_CLIENT, c.typeClient), c.typeClient || CRM_TYPES_CLIENT[0])}
    ${mgtChamp('Groupe client', 'cc-groupe', c.groupe)}${mgtChamp('Effectif', 'cc-effectif', c.effectif)}
    ${mgtChamp('Statut commercial', 'cc-statut', c.statutCommercial)}
    ${mgtChamp('Téléphone(s)', 'cc-tel', c.tel, 'tel')}${mgtChamp('E-mail(s)', 'cc-email', c.email)}
    ${mgtChamp('Matricule fiscal', 'cc-mf', c.mf)}
    ${mgtZone('Notes', 'cc-notes', c.notes)}
    <button class="btn btn-primary" style="width:100%;" onclick="crmSauverClient('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="crmConfirmer('Supprimer ce client avec ses visites, offres, planning et factures ?', 'crmSupprimerClient(\\'${id}\\')')">Supprimer le client</button>` : ''}`);
};
window.crmSauverClient = (id) => {
  const nom = mgtVal('cc-nom'); if(!nom){ showToast('La raison sociale est obligatoire'); return; }
  const champs = {nom, type:mgtVal('cc-type'), importance:mgtVal('cc-importance'), frequenceVisite:mgtVal('cc-freq'), ville:mgtVal('cc-ville'), region:mgtVal('cc-region'), adresse:mgtVal('cc-adresse'),
    activite:mgtVal('cc-activite'), typeClient:mgtVal('cc-typeClient'), groupe:mgtVal('cc-groupe'), effectif:mgtVal('cc-effectif'), statutCommercial:mgtVal('cc-statut'),
    tel:mgtVal('cc-tel'), email:mgtVal('cc-email'), mf:mgtVal('cc-mf'), notes:mgtVal('cc-notes')};
  if(id) crmModifier(id, r => Object.assign(r, champs));
  else { id = mgtId('c'); crmEnregistrerClient(id, Object.assign({contacts:[], visites:[], offres:[], planning:[], factures:[], cree:getTodayISO()}, champs)); }
  mgtFermer(); showToast('Client enregistré'); crmOuvrir(id);
};
window.crmSupprimerClient = (id) => {
  const lie = Object.values(mgtGet('devis')).some(d => d.clientId === id) || Object.values(mgtGet('machines')).some(m => m.clientId === id);
  if(lie){ mgtFermer(); showToast('Ce client a des devis ou des machines : supprimez-les d\'abord'); return; }
  crmEnregistrerClient(id, null); mgtFermer(); showToast('Client supprimé'); nav('mgt-clients');
};

// ---------- formulaires génériques (contacts, visites, offres, planning, factures, projets) ----------
const CRM_FORMS = {
  contacts:{titre:'contact', champs:[['nom', 'Nom *'], ['fonction', 'Fonction'], ['tel', 'Téléphone', 'tel'], ['email', 'E-mail'], ['cle', 'Contact clé', 'select', [['', 'Non'], ['1', 'Oui']]]], obligatoire:'nom', defaut:() => ({})},
  visites:{titre:'visite / contact', champs:[['date', 'Date', 'date'], ['note', 'Compte rendu', 'area']], obligatoire:'date', defaut:() => ({date:getTodayISO()})},
  offres:{titre:'offre', champs:[
    ['type', 'Type', 'select', CRM_TYPES_OFFRE], ['marque', 'Marque', 'select', CRM_MARQUES], ['machine', 'Machine / objet'], ['devise', 'Devise', 'select', CRM_DEVISES],
    ['amount', 'Montant HTVA', 'number'], ['probability', 'Probabilité (%)', 'number'], ['acceptance', 'Acceptation', 'select', CRM_ACCEPTATION],
    ['status', 'Statut', 'select', CRM_STATUTS_OFFRE], ['sentDate', 'Date d\'envoi', 'date'], ['echeance', 'Échéance', 'date'], ['reminder', 'Prochaine relance', 'date'],
    ['commercial', 'Commercial'], ['validation', 'Validation', 'select', CRM_VALIDATIONS], ['invoiceRef', 'N° facture (pour valider)'],
    ['avancement', 'Avancement projet (0-200 %)', 'number'], ['progress', 'État d\'avancement'], ['result', 'Résultat'], ['note', 'Note', 'area']],
    obligatoire:'amount', defaut:() => ({type:'Machine', devise:'EUR', status:'En attente', sentDate:getTodayISO(), commercial:crmCommercial(), probability:'50', validation:'EN ATTENTE'})},
  planning:{titre:'action', champs:[
    ['date', 'Date *', 'date'], ['type', 'Type', 'select', CRM_TYPES_ACTION], ['priority', 'Priorité', 'select', CRM_PRIORITES], ['status', 'Statut', 'select', CRM_STATUTS_ACTION],
    ['objective', 'Objectif', 'area'], ['commercial', 'Commercial'], ['relanceDate', 'Date de relance', 'date'], ['motif', 'Motif (si reporté)']],
    obligatoire:'date', defaut:() => ({date:getTodayISO(), type:'visite', priority:'Moyenne', status:'En attente', commercial:crmCommercial()})},
  factures:{titre:'facture', champs:[
    ['number', 'N° facture *'], ['date', 'Date', 'date'], ['amount', 'Montant (€)', 'number'], ['paid', 'Montant encaissé', 'number'],
    ['type', 'Type', 'select', CRM_TYPES_FACTURE], ['status', 'Statut'], ['note', 'Note']], obligatoire:'number', defaut:() => ({date:getTodayISO(), type:'MACHINE', paid:'0'})},
  projets:{titre:'projet', champs:[['nom', 'Nom du projet *'], ['montantHT', 'Montant HT (€)', 'number'], ['avancement', 'Avancement (0-200 %)', 'number']], obligatoire:'nom', defaut:() => ({avancement:'0'})}
};
window.crmForm = (champ, cid, idx) => {
  const def = CRM_FORMS[champ];
  const cur = (cid && idx != null && idx !== 'null') ? (crmListeBrute(mgtGet('clients')[cid] || {}, champ)[idx] || {}) : def.defaut();
  const edition = cid && idx != null && idx !== 'null';
  const champs = def.champs.map(([k, label, type, opts]) => {
    const id = 'cf-' + k, v = cur[k];
    if(type === 'select'){ const o = Array.isArray(opts[0]) ? opts : crmChoix(opts, v == null ? '' : String(v)); return mgtSelect(label, id, o, v == null ? o[0][0] : String(v)); }
    if(type === 'area') return mgtZone(label, id, v);
    if(type === 'date') return mgtChamp(label, id, crmISO(v) || v || '', 'date');
    if(type === 'number') return mgtChamp(label, id, v == null ? '' : v, 'text', 'inputmode="decimal"');
    return mgtChamp(label, id, v, type || 'text');
  }).join('');
  const choixClient = cid ? '' : mgtSelect('Client *', 'cf-_client', mgtOptionsClients('— Choisir —'), '');
  mgtModal((edition ? 'Modifier : ' : 'Nouveau : ') + def.titre, `${choixClient}${champs}
    <button class="btn btn-primary" style="width:100%;" onclick="crmSauverForm('${champ}', '${cid || ''}', ${edition ? idx : 'null'})">Enregistrer</button>
    ${edition ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="crmConfirmer('Supprimer cet élément ?', 'crmSupprimerElement(\\'${champ}\\', \\'${cid}\\', ${idx})')">Supprimer</button>` : ''}`);
};
window.crmSauverForm = (champ, cid, idx) => {
  const def = CRM_FORMS[champ];
  if(!cid) cid = mgtVal('cf-_client');
  if(!cid){ showToast('Choisissez un client'); return; }
  const val = {};
  def.champs.forEach(([k]) => { val[k] = mgtVal('cf-' + k); });
  if(!val[def.obligatoire]){ showToast('Champ obligatoire manquant'); return; }
  if(champ === 'contacts') val.cle = !!val.cle;
  if(champ === 'offres' && crmNorm(val.validation).includes('valide') && !crmNorm(val.validation).includes('prevalide') && !val.invoiceRef) showToast('Sans numéro de facture, l\'offre reste « Prévalidée »');
  if(champ === 'planning' && crmNorm(val.status).includes('report') && !val.motif){ showToast('Indiquez le motif du report'); return; }
  crmModifier(cid, r => {
    const liste = crmTableau(r[champ]).slice();
    if(idx === null || idx === 'null') { val.id = crmNouvelId('e'); liste.push(val); }
    else liste[idx] = Object.assign({}, liste[idx], val);
    r[champ] = liste;
    if(champ === 'planning' && crmNorm(val.status).includes('termine') && crmNorm(val.type).includes('visite')) {
      const v = crmTableau(r.visites).slice(); v.push({date:crmISO(val.date), note:val.objective || 'Action réalisée'}); r.visites = v;
    }
  });
  mgtFermer(); showToast('Enregistré');
  nav(activeTab === 'mgt-fiche' || activeTab === 'mgt-agenda' || activeTab === 'mgt-offres' || activeTab === 'mgt-ca' ? activeTab : 'mgt-fiche');
};
window.crmSupprimerElement = (champ, cid, idx) => {
  crmModifier(cid, r => { const l = crmTableau(r[champ]).slice(); l.splice(idx, 1); r[champ] = l; });
  mgtFermer(); showToast('Supprimé');
  nav(activeTab === 'mgt-fiche' || activeTab === 'mgt-agenda' || activeTab === 'mgt-offres' || activeTab === 'mgt-ca' || activeTab === 'mgt-projets' ? activeTab : 'mgt-fiche');
};
window.crmFormProchaine = (cid) => {
  const n = (mgtGet('clients')[cid] || {}).prochaineAction || {};
  mgtModal('Prochaine action obligatoire', `
    ${mgtSelect('Type', 'cn-type', crmChoix(CRM_TYPES_ACTION, n.type || 'visite'), n.type || 'visite')}
    ${mgtChamp('Date', 'cn-date', crmISO(n.date) || n.date || '', 'date')}
    ${mgtSelect('Priorité', 'cn-priority', crmChoix(CRM_PRIORITES, n.priority || 'Moyenne'), n.priority || 'Moyenne')}
    ${mgtChamp('Responsable', 'cn-resp', n.responsible || crmCommercial())}
    ${mgtZone('Commentaire', 'cn-comment', n.comment)}
    <button class="btn btn-primary" style="width:100%;" onclick="crmSauverProchaine('${cid}')">Enregistrer</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="crmEffacerProchaine('${cid}')">Effacer cette action</button>`);
};
window.crmSauverProchaine = (cid) => {
  crmModifier(cid, r => { r.prochaineAction = {type:mgtVal('cn-type'), date:mgtVal('cn-date'), priority:mgtVal('cn-priority'), responsible:mgtVal('cn-resp'), status:'En attente', comment:mgtVal('cn-comment')}; });
  mgtFermer(); nav('mgt-fiche');
};
window.crmEffacerProchaine = (cid) => { crmModifier(cid, r => { delete r.prochaineAction; }); mgtFermer(); nav('mgt-fiche'); };
window.crmNoteRapide = (cid) => {
  const t = document.getElementById('crm-note'); if(!t || !t.value.trim()){ showToast('Écrivez une note'); return; }
  crmModifier(cid, r => { const v = crmTableau(r.visites).slice(); v.push({date:getTodayISO(), note:t.value.trim()}); r.visites = v; });
  showToast('Note ajoutée'); nav('mgt-fiche');
};
window.crmTerminerAction = (cid, idx) => {
  crmModifier(cid, r => {
    const l = crmTableau(r.planning).slice(), a = l[idx]; if(!a) return;
    a.status = 'Termine';
    if(crmNorm(a.type).includes('visite')){ const v = crmTableau(r.visites).slice(); v.push({date:getTodayISO(), note:a.objective || 'Visite réalisée'}); r.visites = v; }
    r.planning = l;
  });
  showToast('Action terminée'); nav(activeTab);
};

// ---------- fiche ----------
function crmLigneOffre(cid, o, i, ed){
  const rel = crmOffreRelance(o), val = crmOffreValidation(o);
  return `<div class="session-row" style="align-items:flex-start;${ed ? 'cursor:pointer;' : ''}" ${ed ? `onclick="crmForm('offres','${cid}',${i})"` : ''}>
    <div style="flex:1;min-width:0;"><b style="font-size:13px;">${esc(o.machine || o.type || 'Offre')}</b> ${o.marque ? '<span style="font-size:11px;color:var(--ink-soft);">' + esc(o.marque) + '</span>' : ''}
    <div style="font-size:11.5px;color:var(--ink-soft);">${crmMontant(crmOffreMontant(o), o.devise === 'EUR' || !o.devise ? '€' : o.devise)} · ${crmOffreProba(o)} % · ${esc(o.status || 'En attente')}${o.sentDate ? ' · envoyée ' + crmDateFr(o.sentDate) : ''}</div>
    ${rel ? `<div style="margin-top:2px;">${crmBadge(CRM_RELANCE_TXT[rel] + ' ' + crmDateFr(o.reminder), rel === 'proche' ? 'warn' : 'bad')}</div>` : ''}</div>
    <div>${crmBadge(val.label, val.cls)}</div></div>`;
}
function renderMgtFiche(main){
  const id = mgtFicheId, c = mgtGet('clients')[id];
  if(!c){ nav('mgt-clients'); return; }
  const ed = crmEd();
  const b = mgtSection(main, `<span style="cursor:pointer;" onclick="nav('mgt-clients')">‹</span> ${esc(c.nom)}`, ed ? `<button class="btn btn-ghost" onclick="crmFormClient('${id}')">Modifier</button>` : '');
  const machines = Object.entries(mgtGet('machines')).filter(([, m]) => m.clientId === id);
  const devis = Object.entries(mgtGet('devis')).filter(([, d]) => d.clientId === id).sort((a, d) => (d[1].date || '').localeCompare(a[1].date || ''));
  const v = crmDerniereVisite(c), jours = crmJoursSansVisite(c), freq = crmFrequenceVisite(c), prochaine = crmProchaineAction(id, c);
  const nProjets = crmProjets().filter(p => p.clientId === id);
  const ajout = (champ, label) => ed ? crmPetitBtn('+ ' + label, `crmForm('${champ}','${id}')`) : '';
  const ligne = (champ, arr, rendu) => arr.length ? arr.map((x, i) => x ? rendu(x, i) : '').join('') : crmVide('Aucun élément');
  const clic = (champ, i) => ed ? `style="cursor:pointer;" onclick="crmForm('${champ}','${id}',${i})"` : '';
  const contacts = crmTableau(c.contacts), visites = crmTableau(c.visites), offres = crmTableau(c.offres), planning = crmTableau(c.planning), factures = crmTableau(c.factures);
  const tl = [];
  visites.forEach(x => x && tl.push({d:crmISO(x.date), t:'Visite / contact', n:x.note}));
  offres.forEach(o => o && tl.push({d:crmISO(crmOffreEnvoi(o)), t:'Offre ' + (o.machine || o.type || ''), n:crmMontant(crmOffreMontant(o), '') + ' ' + (o.devise || '')}));
  factures.forEach(f => f && tl.push({d:crmISO(f.date), t:'Facture ' + (f.number || ''), n:crmMontant(crmNombre(f.amount), '€')}));
  planning.forEach(a => a && crmActionFaite(a) && tl.push({d:crmISO(a.date), t:'Action terminée : ' + (a.type || ''), n:a.objective}));
  tl.sort((a, d) => (d.d || '').localeCompare(a.d || ''));
  b.innerHTML = `
    <div class="card">
      ${crmEstProspect(c) ? crmBadge('Prospect', 'warn') : crmBadge('Client', 'good')} ${crmLettre(c) ? crmBadge('Importance ' + crmLettre(c), crmLettre(c) === 'A' ? 'excellent' : '') : ''} ${c.typeClient && c.typeClient !== 'Non classe' ? crmBadge(c.typeClient) : ''} ${c.groupe ? crmBadge(c.groupe) : ''}
      <div style="font-size:13px;line-height:1.7;margin-top:6px;">
        ${c.adresse || c.ville || c.region ? `<div>${esc([c.adresse, c.ville, c.region].filter(Boolean).join(', '))}</div>` : ''}
        ${c.activite ? `<div>Activité : ${esc(c.activite)}${c.effectif ? ' · ' + esc(c.effectif) + ' pers.' : ''}</div>` : ''}
        ${c.tel ? `<div>Tél. <a href="tel:${esc(String(c.tel).split(/[\/;,]/)[0].trim())}">${esc(c.tel)}</a></div>` : ''}
        ${c.email ? `<div><a href="mailto:${esc(String(c.email).split(/[;,\s]/)[0])}">${esc(c.email)}</a></div>` : ''}
        ${c.mf ? `<div>MF ${esc(c.mf)}</div>` : ''}
        ${c.notes ? `<div style="color:var(--ink-soft);white-space:pre-line;">${esc(c.notes)}</div>` : ''}
        <div style="font-size:12px;color:var(--ink-soft);">Dernière visite : ${v.date ? crmDateFr(v.date) + ' (' + jours + ' j)' : 'aucune'} · Fréquence : ${freq ? 'tous les ' + freq + ' j' : 'aucune'}</div>
        <div style="font-size:12px;color:var(--ink-soft);">Prochaine action : ${prochaine ? esc(prochaine.type || '') + ' le ' + crmDateFr(prochaine.date) : 'aucune'}</div>
      </div>
      ${ed ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">${crmPetitBtn('Prochaine action', `crmFormProchaine('${id}')`)}${crmPetitBtn('+ Action planning', `crmForm('planning','${id}')`)}</div>` : ''}
    </div>
    ${ed ? `<div class="card"><h3 style="margin:0 0 6px;font-size:14px;">Note rapide</h3><textarea id="crm-note" rows="2" class="mgt-in" placeholder="Compte rendu d'appel ou de visite…"></textarea><button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="crmNoteRapide('${id}')">Ajouter à l'historique</button></div>` : ''}
    ${crmCarte('Contacts', ligne('contacts', contacts, (x, i) => `<div class="session-row" ${clic('contacts', i)}><div><b style="font-size:13px;">${esc(x.nom || '')}${x.cle ? ' ★' : ''}</b><div style="font-size:11.5px;color:var(--ink-soft);">${esc(x.fonction || '')}${x.tel ? ' · ' + esc(x.tel) : ''}${x.email ? ' · ' + esc(x.email) : ''}</div></div></div>`), ajout('contacts', 'Contact'))}
    ${crmCarte('Offres (' + offres.length + ')', ligne('offres', offres, (o, i) => crmLigneOffre(id, o, i, ed)), ajout('offres', 'Offre'))}
    ${crmCarte('Planning', ligne('planning', planning, (a, i) => `<div class="session-row" style="align-items:flex-start;" ><div style="flex:1;min-width:0;${ed ? 'cursor:pointer;' : ''}" ${ed ? `onclick="crmForm('planning','${id}',${i})"` : ''}><b style="font-size:13px;">${crmDateFr(a.date)} · ${esc(a.type || '')}</b><div style="font-size:11.5px;color:var(--ink-soft);">${esc(a.objective || '')}${a.commercial ? ' · ' + esc(a.commercial) : ''}${a.motif ? ' · motif : ' + esc(a.motif) : ''}</div></div>${crmBadge(a.status || 'En attente', crmActionFaite(a) ? 'good' : crmActionJours(a) < 0 && crmActionAPlanifier(a) ? 'bad' : '')}${ed && crmActionAPlanifier(a) ? crmPetitBtn('✓', `crmTerminerAction('${id}',${i})`) : ''}</div>`), ajout('planning', 'Action'))}
    ${crmCarte('Visites et contacts (' + visites.length + ')', ligne('visites', visites.map((x, i) => ({x, i})).sort((a, d) => (crmISO(d.x && d.x.date) || '').localeCompare(crmISO(a.x && a.x.date) || '')).map(o => o.x ? Object.assign({}, o.x, {_i:o.i}) : null), (x) => `<div class="session-row" style="align-items:flex-start;" ${clic('visites', x._i)}><div><b style="font-size:13px;">${crmDateFr(x.date)}</b><div style="font-size:11.5px;color:var(--ink-soft);white-space:pre-line;">${esc(x.note || '')}</div></div></div>`), ajout('visites', 'Visite'))}
    ${crmCarte('Projets', nProjets.length ? nProjets.map(p => `<div class="session-row"><div style="flex:1;"><b style="font-size:13px;">${esc(p.nom)}</b><div style="font-size:11.5px;color:var(--ink-soft);">${crmMontant(p.montant, p.devise === 'EUR' ? '€' : p.devise)} · avancement ${p.avancement} %</div></div>${crmBadge(p.phase === 'fini' ? 'Fini' : p.phase === 'apres' ? 'Après-vente' : 'Avant livraison', p.phase === 'fini' ? 'good' : '')}</div>`).join('') : crmVide('Aucun projet (offre > ' + CRM_SEUIL_PROJET.toLocaleString('fr-FR') + ' HTVA ou projet manuel)'), ajout('projets', 'Projet'))}
    ${crmCarte('Factures CRM (' + factures.length + ')', ligne('factures', factures, (f, i) => `<div class="session-row" ${clic('factures', i)}><div style="flex:1;"><b style="font-size:13px;">${esc(f.number || '—')}</b><div style="font-size:11.5px;color:var(--ink-soft);">${crmDateFr(f.date)} · ${esc(f.type || '')}</div></div><div style="text-align:right;font-size:12.5px;"><b>${crmMontant(crmNombre(f.amount), '€')}</b>${crmNombre(f.amount) - crmNombre(f.paid) > 0.5 ? '<div>' + crmBadge('Reste ' + crmMontant(crmNombre(f.amount) - crmNombre(f.paid), '€'), 'warn') + '</div>' : ''}</div></div>`), ajout('factures', 'Facture'))}
    ${crmCarte('Devis', devis.length ? devis.map(([did, d]) => mgtLigneDevis(did, d, false)).join('') : crmVide('Aucun devis'), ed ? crmPetitBtn('+ Devis', `mgtNouveauDevis('${id}')`) : '')}
    ${crmCarte('Parc machines', machines.length ? machines.map(([mid, m]) => mgtLigneMachine(mid, m, false)).join('') : crmVide('Aucune machine installée'), ed ? crmPetitBtn('+ Machine', `mgtFormMachine(null,'${id}')`) : '')}
    ${savCarteClient(id)}
    ${factCarteClient('mgt', id)}
    ${crmCarte('Historique', tl.length ? tl.slice(0, 15).map(t => `<div class="session-row" style="align-items:flex-start;"><div style="font-size:12px;min-width:76px;color:var(--ink-soft);">${crmDateFr(t.d)}</div><div><b style="font-size:12.5px;">${esc(t.t)}</b><div style="font-size:11.5px;color:var(--ink-soft);white-space:pre-line;">${esc(t.n || '')}</div></div></div>`).join('') : crmVide('Aucun historique'))}`;
}

// ============================================================
// PLANNING
// ============================================================
let crmPl = {filtre:'7j', vue:'liste', mois:'', jour:''};
const CRM_FILTRES_PL = [['auj', 'Aujourd\'hui'], ['retard', 'En retard'], ['7j', '7 jours'], ['avenir', 'À venir'], ['faites', 'Terminées'], ['reportees', 'Reportées']];
function crmLigneAgenda(a){
  const d = crmActionJours(a), manuel = a.source === 'manuel', ed = crmEd();
  const idx = manuel ? crmTableau(mgtGet('clients')[a.clientId].planning).findIndex(x => x && x.id && x.id === a.id) : -1;
  const i2 = manuel && idx < 0 ? crmTableau(mgtGet('clients')[a.clientId].planning).findIndex(x => x && x.date === a.date && x.objective === a.objective) : idx;
  const cls = crmActionFaite(a) ? 'good' : d < 0 && crmActionAPlanifier(a) ? 'bad' : d === 0 ? 'warn' : '';
  return `<div class="session-row" style="align-items:flex-start;">
    <div style="flex:1;min-width:0;cursor:pointer;" onclick="${manuel && ed && i2 >= 0 ? `crmForm('planning','${a.clientId}',${i2})` : `crmOuvrir('${a.clientId}')`}">
      <div style="font-size:13.5px;"><b>${esc(crmNomClient(a.clientId))}</b> ${manuel ? '' : crmBadge('auto')}</div>
      <div style="font-size:11.5px;color:var(--ink-soft);">${esc(a.type || '')} · ${esc(a.objective || '')}${a.commercial ? ' · ' + esc(a.commercial) : ''}${a.motif ? ' · motif : ' + esc(a.motif) : ''}</div></div>
    <div style="text-align:right;display:flex;flex-direction:column;gap:3px;align-items:flex-end;">${crmBadge(crmDateFr(a.date), cls)}${a.priority && /haute|^a /i.test(crmNorm(a.priority) + ' ') ? crmBadge(a.priority, 'bad') : ''}
    ${ed && manuel && i2 >= 0 && crmActionAPlanifier(a) ? crmPetitBtn('✓ Fait', `crmTerminerAction('${a.clientId}',${i2})`) : ''}
    ${ed && !manuel && crmNorm(a.type).includes('visite') ? crmPetitBtn('Visite faite', `crmForm('visites','${a.clientId}')`) : ''}</div></div>`;
}
function renderMgtAgenda(main){
  const b = mgtSection(main, ICONS.calendarCheck + ' Planning', crmEd() ? `<button class="btn btn-primary" onclick="crmForm('planning','')">+ Action</button>` : '');
  const f = crmPl, tout = crmToutesActions();
  let l;
  if(f.jour) l = tout.filter(a => crmISO(a.date) === f.jour);
  else l = tout.filter(a => {
    const d = crmActionJours(a), ap = crmActionAPlanifier(a);
    if(f.filtre === 'auj') return ap && d === 0;
    if(f.filtre === 'retard') return ap && d < 0;
    if(f.filtre === '7j') return ap && d >= 0 && d <= 7;
    if(f.filtre === 'avenir') return ap && d >= 0;
    if(f.filtre === 'faites') return crmActionFaite(a);
    if(f.filtre === 'reportees') return crmActionReportee(a);
    return true;
  });
  l.sort((x, y) => (crmDate(x.date) - crmDate(y.date)) || String(x.priority).localeCompare(String(y.priority)));
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;gap:6px;flex-wrap:wrap;">
      ${CRM_FILTRES_PL.map(([k, lb]) => `<button class="btn ${!f.jour && f.filtre === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 10px;font-size:12px;" onclick="crmPl.filtre='${k}'; crmPl.jour=''; nav('mgt-agenda')">${lb}</button>`).join('')}
      <button class="btn ${f.vue === 'mois' ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 10px;font-size:12px;" onclick="crmPl.vue='${f.vue === 'mois' ? 'liste' : 'mois'}'; nav('mgt-agenda')">Calendrier</button>
    </div>
    ${f.vue === 'mois' ? crmCalendrier(tout) : ''}
    ${f.jour ? `<div style="font-size:13px;font-weight:700;margin:4px 2px;">${crmDateFr(f.jour)} <a href="#" onclick="crmPl.jour=''; nav('mgt-agenda'); return false;" style="font-weight:400;font-size:12px;">tout afficher</a></div>` : ''}
    <div style="font-size:12px;color:var(--ink-soft);margin:0 2px 6px;">${l.length} action${l.length > 1 ? 's' : ''}</div>
    <div class="card" style="padding:4px 12px;">${l.length ? l.slice(0, 80).map(crmLigneAgenda).join('') : buildEmptyState('Aucune action')}</div>${l.length > 80 ? crmVide('80 premières actions affichées') : ''}`;
}
function crmCalendrier(actions){
  const f = crmPl; if(!f.mois) f.mois = getTodayISO().slice(0, 7);
  const [an, mo] = f.mois.split('-').map(Number), prem = new Date(an, mo - 1, 1), nbj = new Date(an, mo, 0).getDate(), dec = (prem.getDay() + 6) % 7;
  const nb = {}; actions.filter(a => crmActionAPlanifier(a)).forEach(a => { const k = crmISO(a.date); nb[k] = (nb[k] || 0) + 1; });
  const cases = []; for(let i = 0; i < dec; i++) cases.push('<div></div>');
  for(let j = 1; j <= nbj; j++){
    const iso = f.mois + '-' + String(j).padStart(2, '0'), n = nb[iso] || 0;
    cases.push(`<div onclick="crmPl.jour='${iso}'; nav('mgt-agenda')" style="cursor:pointer;text-align:center;padding:6px 0;border-radius:8px;font-size:12.5px;${iso === getTodayISO() ? 'border:1.5px solid var(--accent-2);' : 'border:1px solid transparent;'}${f.jour === iso ? 'background:var(--surface-2);' : ''}">${j}${n ? `<div style="font-size:10px;font-weight:800;color:${n > 3 ? 'var(--bad)' : 'var(--accent-2)'};">${n}</div>` : '<div style="font-size:10px;">&nbsp;</div>'}</div>`);
  }
  const m = (d) => { const x = new Date(an, mo - 1 + d, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  return `<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><button class="btn btn-ghost" onclick="crmPl.mois='${m(-1)}'; nav('mgt-agenda')">‹</button><div style="flex:1;text-align:center;font-weight:700;">${prem.toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}</div><button class="btn btn-ghost" onclick="crmPl.mois='${m(1)}'; nav('mgt-agenda')">›</button></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:10.5px;color:var(--ink-soft);text-align:center;margin-bottom:2px;">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => '<div>' + x + '</div>').join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">${cases.join('')}</div></div>`;
}

// ============================================================
// OFFRES (pipeline)
// ============================================================
let crmFO = {q:'', marque:'', validation:'', etat:'cours', tri:'relance'};
function crmToutesOffres(){
  const out = [];
  Object.entries(mgtGet('clients')).forEach(([id, c]) => crmTableau(c.offres).forEach((o, i) => { if(o && typeof o === 'object') out.push({o, i, clientId:id, c}); }));
  return out;
}
window.crmFiltrerOffres = (cle, val) => { crmFO[cle] = val; renderOffresListe(); };
function renderOffresListe(){
  const zone = document.getElementById('crm-offres-liste'); if(!zone) return;
  const f = crmFO, q = crmNorm(f.q), ordre = {depassee:0, aujourdhui:1, proche:2, '':3};
  let l = crmToutesOffres().filter(({o, c}) => {
    if(f.etat === 'cours' && !crmOffreEnCours(o)) return false;
    if(f.etat === 'gagnees' && !crmOffreGagnee(o)) return false;
    if(f.etat === 'perdues' && !(crmOffrePerdue(o) || !crmOffreActive(o))) return false;
    if(f.marque && (o.marque || '') !== f.marque) return false;
    if(f.validation && crmOffreValidation(o).cle !== f.validation) return false;
    if(q && !crmNorm([c.nom, o.machine, o.type, o.marque, o.commercial].join(' ')).includes(q)) return false;
    return true;
  });
  l.sort((a, b) => f.tri === 'montant' ? crmOffreMontant(b.o) - crmOffreMontant(a.o) : f.tri === 'date' ? (crmISO(crmOffreEnvoi(b.o)) || '').localeCompare(crmISO(crmOffreEnvoi(a.o)) || '') : (ordre[crmOffreRelance(a.o)] - ordre[crmOffreRelance(b.o)]) || (crmISO(a.o.reminder) || '9').localeCompare(crmISO(b.o.reminder) || '9'));
  const dev = (x) => x.o.devise || 'EUR';
  zone.innerHTML = `<div class="kpi-mini-grid" style="grid-template-columns:repeat(2,1fr);">
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:15px;font-weight:800;">${crmSommeParDevise(l, x => crmOffreMontant(x.o), dev)}</div><div style="font-size:10.5px;color:var(--ink-soft);">${l.length} offre(s) · total</div></div>
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:15px;font-weight:800;">${crmSommeParDevise(l.filter(x => crmOffreEnCours(x.o)), x => crmOffreMontant(x.o) * crmOffreProba(x.o) / 100, dev)}</div><div style="font-size:10.5px;color:var(--ink-soft);">pondéré (en cours)</div></div></div>
    <div class="card" style="padding:4px 12px;">${l.length ? l.slice(0, 100).map(x => {
      const rel = crmOffreRelance(x.o), val = crmOffreValidation(x.o);
      return `<div class="session-row" style="align-items:flex-start;cursor:pointer;" onclick="${crmEd() ? `crmForm('offres','${x.clientId}',${x.i})` : `crmOuvrir('${x.clientId}')`}">
        <div style="flex:1;min-width:0;"><b style="font-size:13.5px;">${esc(x.c.nom)}</b>
        <div style="font-size:11.5px;color:var(--ink-soft);">${esc(x.o.machine || x.o.type || 'Offre')}${x.o.marque ? ' · ' + esc(x.o.marque) : ''} · ${crmMontant(crmOffreMontant(x.o), dev(x) === 'EUR' ? '€' : dev(x))} · ${crmOffreProba(x.o)} %</div>
        <div style="font-size:11px;color:var(--ink-faint);">${esc(x.o.status || 'En attente')}${x.o.commercial ? ' · ' + esc(x.o.commercial) : ''}${crmOffreEnvoi(x.o) ? ' · envoyée ' + crmDateFr(crmOffreEnvoi(x.o)) : ''}</div></div>
        <div style="text-align:right;display:flex;flex-direction:column;gap:3px;align-items:flex-end;">${crmBadge(val.label, val.cls)}${rel ? crmBadge(CRM_RELANCE_TXT[rel], rel === 'proche' ? 'warn' : 'bad') : ''}</div></div>`;
    }).join('') : buildEmptyState('Aucune offre')}</div>${l.length > 100 ? crmVide('100 premières offres affichées') : ''}`;
}
function renderMgtOffres(main){
  const b = mgtSection(main, ICONS.target + ' Offres', crmEd() ? `<button class="btn btn-primary" onclick="crmForm('offres','')">+ Offre</button>` : '');
  const f = crmFO, opt = (k, l) => `<option value="${k}" ${f.etat === k ? 'selected' : ''}>${l}</option>`;
  b.innerHTML = `<div class="card" style="padding:10px 12px;">
      <input class="mgt-in" placeholder="Rechercher (client, machine, commercial)…" value="${esc(f.q)}" oninput="crmFiltrerOffres('q', this.value)">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px;">
        <select class="mgt-in" style="padding:7px 8px;font-size:13px;" onchange="crmFiltrerOffres('etat', this.value)">${opt('cours', 'En cours')}${opt('tout', 'Toutes')}${opt('gagnees', 'Gagnées')}${opt('perdues', 'Perdues / inactives')}</select>
        <select class="mgt-in" style="padding:7px 8px;font-size:13px;" onchange="crmFiltrerOffres('tri', this.value)">${[['relance', 'Tri : relance'], ['montant', 'Tri : montant'], ['date', 'Tri : date d\'envoi']].map(([k, l]) => `<option value="${k}" ${f.tri === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="mgt-in" style="padding:7px 8px;font-size:13px;" onchange="crmFiltrerOffres('marque', this.value)"><option value="">Toutes marques</option>${CRM_MARQUES.filter(Boolean).map(m => `<option ${f.marque === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <select class="mgt-in" style="padding:7px 8px;font-size:13px;" onchange="crmFiltrerOffres('validation', this.value)"><option value="">Toute validation</option>${[['attente', 'En attente'], ['prevalidee', 'Prévalidée'], ['validee', 'Validée'], ['refusee', 'Refusée']].map(([k, l]) => `<option value="${k}" ${f.validation === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div></div><div id="crm-offres-liste"></div>`;
  renderOffresListe();
}

// ============================================================
// PROJETS (offres > 20 000 HTVA + projets manuels, avancement 0 à 200 %)
// ============================================================
window.crmAvancement = (cle, val) => {
  const [cid, genre, idx] = cle.split('|'), n = Math.max(0, Math.min(200, Math.round(Number(val) || 0)));
  crmModifier(cid, r => { const l = crmTableau(genre === 'o' ? r.offres : r.projets).slice(); if(l[idx]) l[idx] = Object.assign({}, l[idx], {avancement:n}); if(genre === 'o') r.offres = l; else r.projets = l; });
  nav('mgt-projets');
};
function renderMgtProjets(main){
  const b = mgtSection(main, ICONS.target + ' Projets', crmEd() ? `<button class="btn btn-primary" onclick="crmForm('projets','')">+ Projet</button>` : '');
  const l = crmProjets().sort((a, c) => a.avancement - c.avancement), phases = [['avant', 'Avant livraison (0-99 %)'], ['apres', 'Après-vente (100-199 %)'], ['fini', 'Terminés (200 %)']];
  const legacy = Object.entries(mgtGet('projets'));
  b.innerHTML = `<div class="kpi-mini-grid" style="grid-template-columns:repeat(3,1fr);">${phases.map(([k, lb]) => `<div class="kpi-mini"><div style="font-family:var(--mono);font-size:20px;font-weight:800;">${l.filter(p => p.phase === k).length}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">${lb.split(' (')[0]}</div></div>`).join('')}</div>
    <div style="font-size:12px;color:var(--ink-soft);margin:0 2px 8px;">Une offre de plus de ${CRM_SEUIL_PROJET.toLocaleString('fr-FR')} HTVA devient automatiquement un projet. Avancement : 0-99 % avant livraison, 100-199 % après-vente, 200 % projet terminé.</div>
    ${phases.map(([k, lb]) => { const g = l.filter(p => p.phase === k); return g.length ? crmCarte(lb + ' — ' + g.length, g.map(p => `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;gap:8px;"><b style="font-size:13px;cursor:pointer;" onclick="crmOuvrir('${p.clientId}')">${esc(p.nom)}</b><span style="font-size:12.5px;font-weight:700;">${crmMontant(p.montant, p.devise === 'EUR' ? '€' : p.devise)}</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;"><input type="range" min="0" max="200" step="5" value="${p.avancement}" ${crmEd() ? '' : 'disabled'} style="flex:1;" oninput="this.nextElementSibling.textContent=this.value+' %'" onchange="crmAvancement('${p.cle}', this.value)"><span style="min-width:48px;text-align:right;font-size:12.5px;font-weight:700;">${p.avancement} %</span></div>
      ${p.origine === 'manuel' && crmEd() ? `<div style="margin-top:4px;">${crmPetitBtn('Modifier', `crmForm('projets','${p.clientId}',${p.index})`)}</div>` : ''}</div>`).join('')) : ''; }).join('')}
    ${l.length ? '' : buildEmptyState('Aucun projet', 'Les offres de plus de 20 000 HTVA apparaissent ici.')}
    ${legacy.length ? crmCarte('Anciens projets GTM (' + legacy.length + ')', legacy.map(([pid, p]) => mgtLigneProjet(pid, p, true)).join('')) : ''}`;
}

// ============================================================
// CHIFFRE D'AFFAIRES
// ============================================================
let crmAnneeCA = String(new Date().getFullYear());
function renderMgtCA(main){
  const b = mgtSection(main, ICONS.invoice + ' Chiffre d\'affaires', crmEd() ? `<button class="btn btn-primary" onclick="crmForm('factures','')">+ Facture</button>` : '');
  const toutes = crmToutesFactures(), annees = Array.from(new Set(toutes.map(f => String(crmISO(f.date) || f.date || '').slice(0, 4)).filter(Boolean).concat([crmAnneeCA]))).sort().reverse();
  const l = toutes.filter(f => String(crmISO(f.date) || f.date || '').slice(0, 4) === crmAnneeCA);
  const tot = l.reduce((s, f) => s + crmNombre(f.amount), 0), enc = l.reduce((s, f) => s + Math.min(crmNombre(f.paid), crmNombre(f.amount) || crmNombre(f.paid)), 0);
  const parType = {}; l.forEach(f => { const t = (f.type || 'AUTRE').toUpperCase(); parType[t] = (parType[t] || 0) + crmNombre(f.amount); });
  const parMois = Array(12).fill(0); l.forEach(f => { const m = Number(String(crmISO(f.date)).slice(5, 7)); if(m) parMois[m - 1] += crmNombre(f.amount); });
  const max = Math.max(1, ...parMois), parClient = {}; l.forEach(f => { parClient[f.clientId] = (parClient[f.clientId] || 0) + crmNombre(f.amount); });
  const rang = Object.entries(parClient).sort((a, c) => c[1] - a[1]).slice(0, 15);
  const noms = ['Janv', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  const tuile = (v, lb, cls) => `<div class="kpi-mini"><div style="font-family:var(--mono);font-size:16px;font-weight:800;" class="${cls || ''}">${v}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">${lb}</div></div>`;
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;"><select class="mgt-in" onchange="crmAnneeCA=this.value; nav('mgt-ca')">${annees.map(a => `<option ${a === crmAnneeCA ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
    <div class="kpi-mini-grid" style="grid-template-columns:repeat(3,1fr);">${tuile(crmMontant(tot, '€'), 'CA ' + crmAnneeCA + ' (' + l.length + ' fact.)')}${tuile(crmMontant(enc, '€'), 'Encaissé')}${tuile(crmMontant(Math.max(0, tot - enc), '€'), 'Reste à encaisser', tot - enc > 1 ? 'hour-rend warn' : '')}</div>
    ${crmCarte('Par mois', `<div style="display:flex;align-items:flex-end;gap:3px;height:110px;margin-top:8px;">${parMois.map((v, i) => `<div style="flex:1;text-align:center;font-size:9px;"><div title="${crmMontant(v, '€')}" style="height:${Math.round(v / max * 80)}px;background:var(--accent-2);border-radius:3px 3px 0 0;"></div>${noms[i]}</div>`).join('')}</div>`)}
    ${crmCarte('Par type', Object.keys(parType).length ? Object.entries(parType).sort((a, c) => c[1] - a[1]).map(([t, v]) => `<div class="session-row"><b style="font-size:13px;">${esc(t)}</b><span style="font-size:13px;">${crmMontant(v, '€')}</span></div>`).join('') : crmVide('Aucune facture'))}
    ${crmCarte('Classement clients', rang.length ? rang.map(([id, v], i) => `<div class="session-row" style="cursor:pointer;" onclick="crmOuvrir('${id}')"><span style="font-size:13px;"><b>${i + 1}.</b> ${esc(crmNomClient(id))}</span><b style="font-size:13px;">${crmMontant(v, '€')}</b></div>`).join('') : crmVide('Aucune facture'))}
    ${crmCarte('Factures', l.length ? l.sort((a, c) => (crmISO(c.date) || '').localeCompare(crmISO(a.date) || '')).slice(0, 60).map(f => `<div class="session-row" style="cursor:pointer;" onclick="${crmEd() ? `crmForm('factures','${f.clientId}',${f.index})` : `crmOuvrir('${f.clientId}')`}"><div style="flex:1;min-width:0;"><b style="font-size:13px;">${esc(f.number || '—')}</b> <span style="font-size:11.5px;color:var(--ink-soft);">${esc(f.nomClient)}</span><div style="font-size:11.5px;color:var(--ink-soft);">${crmDateFr(f.date)} · ${esc(f.type || '')}</div></div><div style="text-align:right;"><b style="font-size:12.5px;">${crmMontant(crmNombre(f.amount), '€')}</b>${crmNombre(f.amount) - crmNombre(f.paid) > 0.5 ? '<div>' + crmBadge('Reste ' + crmMontant(crmNombre(f.amount) - crmNombre(f.paid), '€'), 'warn') + '</div>' : ''}</div></div>`).join('') : buildEmptyState('Aucune facture pour ' + crmAnneeCA))}`;
}
