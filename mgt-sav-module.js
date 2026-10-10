// ============================================================
// MGT — SERVICE APRÈS-VENTE (phase 3)
// ============================================================
// Tickets SAV et interventions, stock de pièces détachées, contrats de
// maintenance. Toutes les clés commencent par « mgt_ » (dossier Firebase mgt/).
//
//  - mgt_tickets    : {numero, date, type, clientId, machineId, objet, description, priorite, statut, technicien, arret,
//                      interventions:[{date, technicien, heures, deplacement, travaux, pieces:[{pieceId, qte}]}], factureId}
//  - mgt_pieces     : {ref, designation, marque, qte, seuil, prix, emplacement}
//  - mgt_mouvements : {date, pieceId, qte (+ entrée / − sortie), motif, ticketId, note}
//  - mgt_contrats   : {clientId, machineIds:[] (vide = tout le parc du client), debut, fin, visitesAn, montant, notes, factureId}
// Une intervention qui utilise des pièces les sort du stock ; la modifier ou la
// supprimer remet le stock à jour. Un ticket « machine à l'arrêt » passe la
// machine à l'arrêt dans le parc jusqu'à sa résolution.

const SAV_TYPES = {panne:'Panne', maintenance:'Maintenance préventive', installation:'Installation / mise en route'};
const SAV_STATUTS = {
  ouvert:   {label:'Ouvert',   cls:'bad'},
  planifie: {label:'Planifié', cls:'warn'},
  encours:  {label:'En cours', cls:'excellent'},
  resolu:   {label:'Résolu',   cls:'good'},
  clos:     {label:'Clos',     cls:''}
};
const SAV_ACTIFS = ['ouvert', 'planifie', 'encours'];
const SAV_MOTIFS = {entree:'Entrée (achat)', sortie:'Sortie', inventaire:'Inventaire', intervention:'Intervention SAV'};
const SAV_COUVERTURE = {garantie:{label:'Sous garantie', cls:'good'}, contrat:{label:'Sous contrat', cls:'excellent'}, payant:{label:'Payant', cls:'warn'}};

function savMachineLabel(id){ const m = mgtGet('machines')[id]; return m ? (m.marque + ' ' + (m.modele || '') + (m.serie ? ' · N° ' + m.serie : '')).trim() : '—'; }
function savContratCouvre(c, machineId){
  if(c.machineIds && c.machineIds.length) return c.machineIds.indexOf(machineId) >= 0;
  const m = mgtGet('machines')[machineId];
  return !!(m && m.clientId === c.clientId);
}
function savContratActif(machineId, date){
  return Object.entries(mgtGet('contrats')).find(([, c]) => c.debut <= date && c.fin >= date && savContratCouvre(c, machineId)) || null;
}
function savCouverture(t){
  const m = mgtGet('machines')[t.machineId];
  if(m && m.finGarantie && m.finGarantie >= t.date) return 'garantie';
  if(t.machineId && savContratActif(t.machineId, t.date)) return 'contrat';
  return 'payant';
}
// Coût d'un ticket : main d'œuvre, déplacements et pièces (tarifs des réglages de facturation MGT).
function savCout(t){
  const P = factParams('mgt'), pieces = mgtGet('pieces');
  let heures = 0, depl = 0, mPieces = 0;
  const parPiece = {};
  (t.interventions || []).forEach(iv => {
    heures += Number(iv.heures) || 0;
    if(iv.deplacement) depl++;
    (iv.pieces || []).forEach(x => { parPiece[x.pieceId] = (parPiece[x.pieceId] || 0) + (Number(x.qte) || 0); });
  });
  Object.entries(parPiece).forEach(([pid, q]) => { mPieces += q * (Number((pieces[pid] || {}).prix) || 0); });
  const mo = heures * (Number(P.tauxHoraire) || 0), dp = depl * (Number(P.deplacement) || 0);
  return {heures, depl, parPiece, mo, dp, mPieces, total: mo + dp + mPieces};
}

function savIndicateurs(){
  const today = getTodayISO(), dans30 = mgtAddDays(today, 30);
  const tickets = Object.values(mgtGet('tickets'));
  const actifs = tickets.filter(t => SAV_ACTIFS.indexOf(t.statut) >= 0);
  return {
    ticketsActifs: actifs.length,
    urgents: actifs.filter(t => t.priorite === 'urgente').length,
    machinesArret: Object.values(mgtGet('machines')).filter(m => m.statut === 'arret').length,
    piecesSousSeuil: Object.values(mgtGet('pieces')).filter(p => (Number(p.qte) || 0) <= (Number(p.seuil) || 0)).length,
    contratsARenouveler: Object.values(mgtGet('contrats')).filter(c => c.fin >= today && c.fin <= dans30).length
  };
}

// --- Stock ---
function savMouvement(pieceId, qte, motif, ticketId, note, date){
  if(!qte) return;
  const pieces = mgtGet('pieces'); if(!pieces[pieceId]) return;
  pieces[pieceId].qte = (Number(pieces[pieceId].qte) || 0) + qte;
  mgtSet('pieces', pieces);
  const mv = mgtGet('mouvements');
  mv[mgtId('v')] = {date:date || getTodayISO(), pieceId, qte, motif, ticketId:ticketId || '', note:note || ''};
  mgtSet('mouvements', mv);
}
function savPiecesParId(liste){ const o = {}; (liste || []).forEach(x => { o[x.pieceId] = (o[x.pieceId] || 0) + (Number(x.qte) || 0); }); return o; }
// Sort du stock la différence entre les anciennes et les nouvelles pièces d'une intervention.
function savAjusterStock(avant, apres, ticketId, date){
  const a = savPiecesParId(avant), b = savPiecesParId(apres);
  new Set(Object.keys(a).concat(Object.keys(b))).forEach(pid => {
    const delta = (b[pid] || 0) - (a[pid] || 0);
    if(delta) savMouvement(pid, -delta, 'intervention', ticketId, delta > 0 ? 'Utilisée' : 'Remise en stock', date);
  });
}

// ============================================================
// TICKETS
// ============================================================
let savFiltre = 'actifs', savTicketId = null;
function savLigneTicket(id, t, avecClient){
  return `<div class="session-row" style="cursor:pointer;" onclick="savOuvrir('${id}')">
    <div style="min-width:0;"><b style="font-size:13.5px;">${t.priorite === 'urgente' ? '<span style="color:var(--bad);">● </span>' : ''}${esc(t.numero)}</b> <span style="font-size:12px;color:var(--ink-soft);">${mgtDate(t.date)}</span>
      <div style="font-size:12.5px;">${esc(t.objet || SAV_TYPES[t.type] || '')}</div>
      <div style="font-size:11.5px;color:var(--ink-soft);">${avecClient ? esc(mgtClientNom(t.clientId)) + ' · ' : ''}${esc(savMachineLabel(t.machineId))}${t.technicien ? ' · ' + esc(t.technicien) : ''}</div></div>
    <div style="text-align:right;">${mgtBadge(SAV_STATUTS[t.statut])}${t.arret && SAV_ACTIFS.indexOf(t.statut) >= 0 ? `<div>${mgtBadge({label:'Machine arrêtée', cls:'bad'})}</div>` : ''}</div>
  </div>`;
}
function renderSavTickets(main){
  const b = mgtSection(main, ICONS.wrench + ' Tickets SAV', canEditMgt() ? `<button class="btn btn-primary" onclick="savFormTicket()">+ Ticket</button>` : '');
  const l = Object.entries(mgtGet('tickets')).filter(([, t]) => savFiltre === 'tous' || (savFiltre === 'actifs') === (SAV_ACTIFS.indexOf(t.statut) >= 0))
    .sort((a, c) => (c[1].priorite === 'urgente') - (a[1].priorite === 'urgente') || (c[1].date + c[1].numero).localeCompare(a[1].date + a[1].numero));
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;gap:6px;flex-wrap:wrap;">
      ${[['actifs', 'À traiter'], ['resolus', 'Résolus'], ['tous', 'Tous']].map(([k, lb]) => `<button class="btn ${savFiltre === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 12px;font-size:12px;" onclick="savFiltre='${k}'; nav('mgt-sav')">${lb}</button>`).join('')}
    </div>
    <div class="card" style="padding:4px 12px;">${l.length ? l.map(([id, t]) => savLigneTicket(id, t, true)).join('') : buildEmptyState(savFiltre === 'actifs' ? 'Aucun ticket à traiter' : 'Aucun ticket')}</div>`;
}
window.savOuvrir = (id) => { savTicketId = id; nav('mgt-ticket'); };

function savOptionsMachines(clientId){
  return Object.entries(mgtGet('machines')).filter(([, m]) => m.clientId === clientId && m.statut !== 'retiree').map(([id]) => [id, savMachineLabel(id)]);
}
// Formulaire d'ouverture (ou de modification) d'un ticket.
window.savFormTicket = (id, clientId, machineId, type) => {
  const t = id ? mgtGet('tickets')[id] : {date:getTodayISO(), type:type || 'panne', clientId:clientId || '', machineId:machineId || '', priorite:'normale', statut:'ouvert'};
  if(!Object.keys(mgtGet('clients')).length){ showToast('Ajoutez d\'abord un client'); return; }
  mgtModal(id ? 'Modifier le ticket ' + esc(t.numero) : 'Nouveau ticket SAV', `
    ${mgtSelect('Client *', 'st-client', mgtOptionsClients('— Choisir —'), t.clientId).replace('<select', `<select onchange="savMajMachines(this.value)"`)}
    <div id="st-machines">${mgtSelect('Machine', 'st-machine', [['', '— Aucune —']].concat(savOptionsMachines(t.clientId)), t.machineId)}</div>
    ${mgtSelect('Type', 'st-type', Object.entries(SAV_TYPES), t.type)}
    ${mgtChamp('Objet *', 'st-objet', t.objet, 'text', 'placeholder="Ex : la presse ne chauffe plus"')}
    ${mgtZone('Description', 'st-desc', t.description)}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Date', 'st-date', t.date, 'date')}</div><div style="flex:1;">${mgtSelect('Priorité', 'st-prio', [['normale', 'Normale'], ['urgente', 'Urgente']], t.priorite)}</div></div>
    ${mgtChamp('Technicien', 'st-tech', t.technicien)}
    <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:14px;"><input type="checkbox" id="st-arret" ${t.arret ? 'checked' : ''} style="width:18px;height:18px;"> Machine à l'arrêt</label>
    <button class="btn btn-primary" style="width:100%;" onclick="savSauverTicket('${id || ''}')">Enregistrer</button>`);
};
window.savMajMachines = (clientId) => {
  document.getElementById('st-machines').innerHTML = mgtSelect('Machine', 'st-machine', [['', '— Aucune —']].concat(savOptionsMachines(clientId)), '');
};
function savMajEtatMachine(t){
  if(!t.machineId) return;
  const ms = mgtGet('machines'), m = ms[t.machineId]; if(!m || m.statut === 'retiree') return;
  const arret = Object.values(mgtGet('tickets')).some(x => x.machineId === t.machineId && x.arret && SAV_ACTIFS.indexOf(x.statut) >= 0);
  const st = arret ? 'arret' : 'service';
  if(m.statut !== st){ m.statut = st; mgtSet('machines', ms); }
}
window.savSauverTicket = (id) => {
  const clientId = mgtVal('st-client'), objet = mgtVal('st-objet');
  if(!clientId || !objet){ showToast('Client et objet obligatoires'); return; }
  const list = mgtGet('tickets'), date = mgtVal('st-date') || getTodayISO();
  const nid = id || mgtId('t');
  const ancien = list[nid] || {numero:mgtNumero('sav', 'SAV', date.slice(0, 4)), statut:'ouvert', interventions:[]};
  list[nid] = {...ancien, date, clientId, machineId:mgtVal('st-machine'), type:mgtVal('st-type'), objet, description:mgtVal('st-desc'),
    priorite:mgtVal('st-prio'), technicien:mgtVal('st-tech'), arret:document.getElementById('st-arret').checked};
  mgtSet('tickets', list);
  savMajEtatMachine(list[nid]);
  if(ancien.machineId && ancien.machineId !== list[nid].machineId) savMajEtatMachine(ancien);
  mgtFermer(); showToast('Ticket enregistré');
  savOuvrir(nid);
};

function renderSavTicket(main){
  const t = mgtGet('tickets')[savTicketId];
  if(!t){ nav('mgt-sav'); return; }
  const id = savTicketId, ed = canEditMgt(), cv = savCouverture(t), cout = savCout(t), pieces = mgtGet('pieces');
  const b = mgtSection(main, `<span style="cursor:pointer;" onclick="nav('mgt-sav')">‹</span> ${esc(t.numero)}`, ed ? `<button class="btn btn-ghost" onclick="savFormTicket('${id}')">Modifier</button>` : '');
  b.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${mgtBadge(SAV_STATUTS[t.statut])}${t.priorite === 'urgente' ? mgtBadge({label:'Urgent', cls:'bad'}) : ''}${mgtBadge(SAV_COUVERTURE[cv])}${t.arret && SAV_ACTIFS.indexOf(t.statut) >= 0 ? mgtBadge({label:'Machine à l\'arrêt', cls:'bad'}) : ''}</div>
      <div style="font-size:15px;font-weight:800;">${esc(t.objet)}</div>
      <div style="font-size:13px;line-height:1.7;margin-top:4px;">
        <div>${SAV_TYPES[t.type] || ''} · ouvert le ${mgtDate(t.date)}</div>
        <div><a href="#" onclick="mgtOuvrirFiche('${t.clientId}'); return false;">${esc(mgtClientNom(t.clientId))}</a> · ${esc(savMachineLabel(t.machineId))}</div>
        ${t.technicien ? `<div>Technicien : ${esc(t.technicien)}</div>` : ''}
        ${t.description ? `<div style="color:var(--ink-soft);white-space:pre-line;">${esc(t.description)}</div>` : ''}
      </div>
      ${ed ? mgtSelect('Statut', 'stk-statut', Object.entries(SAV_STATUTS).map(([k, v]) => [k, v.label]), t.statut).replace('<select', `<select onchange="savChangerStatut('${id}', this.value)"`) : ''}
    </div>
    <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Interventions</h3>${ed ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="savFormIntervention('${id}')">+ Intervention</button>` : ''}</div>
      ${(t.interventions || []).length ? t.interventions.map((iv, i) => `<div class="session-row" style="align-items:flex-start;${ed ? 'cursor:pointer;' : ''}" ${ed ? `onclick="savFormIntervention('${id}', ${i})"` : ''}>
        <div style="min-width:0;"><b style="font-size:13px;">${mgtDate(iv.date)}</b> <span style="font-size:12px;color:var(--ink-soft);">${esc(iv.technicien || '')} · ${iv.heures || 0} h${iv.deplacement ? ' · déplacement' : ''}</span>
          ${iv.travaux ? `<div style="font-size:12.5px;white-space:pre-line;">${esc(iv.travaux)}</div>` : ''}
          ${(iv.pieces || []).length ? `<div style="font-size:11.5px;color:var(--ink-soft);">Pièces : ${iv.pieces.map(x => x.qte + ' × ' + esc((pieces[x.pieceId] || {}).designation || '?')).join(', ')}</div>` : ''}</div>
      </div>`).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucune intervention</div>`}
    </div>
    <div class="card">
      <h3 style="margin:0 0 8px;font-size:14px;">Coût</h3>
      <div style="font-size:13px;line-height:1.8;">
        <div style="display:flex;justify-content:space-between;"><span>Main d'œuvre (${cout.heures} h)</span><b>${fmtDT(cout.mo)}</b></div>
        <div style="display:flex;justify-content:space-between;"><span>Déplacements (${cout.depl})</span><b>${fmtDT(cout.dp)}</b></div>
        <div style="display:flex;justify-content:space-between;"><span>Pièces</span><b>${fmtDT(cout.mPieces)}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:15px;border-top:1px solid var(--border);margin-top:4px;padding-top:4px;"><span>Total HT</span><b>${fmtDT(cout.total)}</b></div>
      </div>
      ${cv !== 'payant' ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:6px;">${cv === 'garantie' ? 'Machine sous garantie' : 'Machine couverte par un contrat de maintenance'} : normalement non facturé.</div>` : ''}
      ${t.factureId ? `<button class="btn btn-ghost" style="width:100%;margin-top:10px;" onclick="factOuvrir('${t.factureId}')">Voir la facture</button>`
        : (ed && cout.total > 0 ? `<button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="factDepuisTicket('${id}')">Facturer ce ticket</button>` : '')}
    </div>
    ${ed ? `<button class="btn btn-ghost" style="width:100%;color:var(--bad);" onclick="savSupprimerTicket('${id}')">Supprimer le ticket</button>` : ''}`;
}
window.savChangerStatut = (id, st) => {
  const list = mgtGet('tickets'); if(!list[id]) return;
  list[id].statut = st;
  if((st === 'resolu' || st === 'clos') && !list[id].dateResolution) list[id].dateResolution = getTodayISO();
  mgtSet('tickets', list); savMajEtatMachine(list[id]); nav('mgt-ticket');
};
window.savSupprimerTicket = (id) => {
  const list = mgtGet('tickets'), t = list[id]; if(!t) return;
  if(!confirm('Supprimer ce ticket ? Les pièces utilisées seront remises en stock.')) return;
  (t.interventions || []).forEach(iv => savAjusterStock(iv.pieces, [], id));
  delete list[id]; mgtSet('tickets', list);
  savMajEtatMachine(t); nav('mgt-sav');
};

// --- Interventions ---
function savLignePieceHTML(pieceId, qte){
  const opts = Object.entries(mgtGet('pieces')).sort((a, c) => (a[1].designation || '').localeCompare(c[1].designation || ''))
    .map(([pid, p]) => `<option value="${pid}" ${pid === pieceId ? 'selected' : ''}>${esc((p.ref ? p.ref + ' · ' : '') + p.designation)} (stock ${p.qte || 0})</option>`).join('');
  return `<div class="sav-piece" style="display:flex;gap:6px;margin-bottom:6px;">
    <select class="mgt-in" style="flex:1;"><option value="">— Pièce —</option>${opts}</select>
    <input class="mgt-in" type="number" min="1" step="1" value="${qte || 1}" style="width:70px;">
    <button class="icon-btn" onclick="this.parentNode.remove()">✕</button></div>`;
}
window.savFormIntervention = (ticketId, i) => {
  const t = mgtGet('tickets')[ticketId]; if(!t) return;
  const iv = i != null ? t.interventions[i] : {date:getTodayISO(), technicien:t.technicien || '', heures:1, deplacement:true, pieces:[]};
  const aPieces = Object.keys(mgtGet('pieces')).length > 0;
  mgtModal(i != null ? 'Modifier l\'intervention' : 'Nouvelle intervention', `
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Date', 'si-date', iv.date, 'date')}</div><div style="flex:1;">${mgtChamp('Heures', 'si-heures', iv.heures, 'number', 'min="0" step="0.5"')}</div></div>
    ${mgtChamp('Technicien', 'si-tech', iv.technicien)}
    <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:12px;"><input type="checkbox" id="si-depl" ${iv.deplacement ? 'checked' : ''} style="width:18px;height:18px;"> Déplacement chez le client</label>
    ${mgtZone('Travaux réalisés', 'si-travaux', iv.travaux)}
    <div class="field"><label>Pièces utilisées</label>
      <div id="si-pieces">${(iv.pieces || []).map(x => savLignePieceHTML(x.pieceId, x.qte)).join('')}</div>
      ${aPieces ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="document.getElementById('si-pieces').insertAdjacentHTML('beforeend', savLignePieceHTML('', 1))">+ Pièce</button>`
        : `<div style="font-size:12px;color:var(--ink-faint);">Aucune pièce en stock (onglet Pièces).</div>`}
    </div>
    ${t.statut !== 'resolu' && t.statut !== 'clos' ? `<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:14px;"><input type="checkbox" id="si-resolu" style="width:18px;height:18px;"> Problème résolu</label>` : ''}
    <button class="btn btn-primary" style="width:100%;" onclick="savSauverIntervention('${ticketId}', ${i != null ? i : 'null'})">Enregistrer</button>
    ${i != null ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="savSupprimerIntervention('${ticketId}', ${i})">Supprimer</button>` : ''}`);
};
window.savLignePieceHTML = savLignePieceHTML;
window.savSauverIntervention = (ticketId, i) => {
  const list = mgtGet('tickets'), t = list[ticketId]; if(!t) return;
  const pieces = [];
  document.querySelectorAll('#si-pieces .sav-piece').forEach(r => {
    const pid = r.querySelector('select').value, q = parseInt(r.querySelector('input').value) || 0;
    if(pid && q > 0) pieces.push({pieceId:pid, qte:q});
  });
  // Contrôle du stock disponible (on peut forcer : la pièce a pu être prise sans être saisie en entrée).
  const stock = mgtGet('pieces'), avant = savPiecesParId(i != null ? t.interventions[i].pieces : []), apres = savPiecesParId(pieces);
  const manque = Object.keys(apres).filter(pid => apres[pid] - (avant[pid] || 0) > (Number((stock[pid] || {}).qte) || 0));
  if(manque.length && !confirm('Stock insuffisant pour : ' + manque.map(pid => stock[pid].designation).join(', ') + '. Enregistrer quand même ?')) return;
  const iv = {date:mgtVal('si-date') || getTodayISO(), technicien:mgtVal('si-tech'), heures:parseFloat(mgtVal('si-heures')) || 0,
    deplacement:document.getElementById('si-depl').checked, travaux:mgtVal('si-travaux'), pieces};
  savAjusterStock(i != null ? t.interventions[i].pieces : [], pieces, ticketId, iv.date);
  t.interventions = t.interventions || [];
  if(i != null) t.interventions[i] = iv; else t.interventions.push(iv);
  t.interventions.sort((a, c) => a.date.localeCompare(c.date));
  const r = document.getElementById('si-resolu');
  if(r && r.checked){ t.statut = 'resolu'; t.dateResolution = iv.date; }
  else if(t.statut === 'ouvert' || t.statut === 'planifie') t.statut = 'encours';
  if(!t.technicien) t.technicien = iv.technicien;
  mgtSet('tickets', list); savMajEtatMachine(t);
  mgtFermer(); showToast('Intervention enregistrée'); nav('mgt-ticket');
};
window.savSupprimerIntervention = (ticketId, i) => {
  if(!confirm('Supprimer cette intervention ? Les pièces seront remises en stock.')) return;
  const list = mgtGet('tickets'), t = list[ticketId];
  savAjusterStock(t.interventions[i].pieces, [], ticketId);
  t.interventions.splice(i, 1); mgtSet('tickets', list);
  mgtFermer(); nav('mgt-ticket');
};

// Carte « SAV » de la fiche client.
function savCarteClient(clientId){
  const l = Object.entries(mgtGet('tickets')).filter(([, t]) => t.clientId === clientId).sort((a, c) => (c[1].date || '').localeCompare(a[1].date || ''));
  const contrats = Object.entries(mgtGet('contrats')).filter(([, c]) => c.clientId === clientId);
  return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">SAV</h3>${canEditMgt() ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="savFormTicket(null, '${clientId}')">+ Ticket</button>` : ''}</div>
    ${contrats.map(([cid, c]) => savLigneContrat(cid, c, false)).join('')}
    ${l.length ? l.slice(0, 10).map(([tid, t]) => savLigneTicket(tid, t, false)).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucun ticket</div>`}
  </div>`;
}

// ============================================================
// PIÈCES DÉTACHÉES
// ============================================================
let savFiltrePieces = {q:'', alerte:false};
function renderSavPieces(main){
  const ed = canEditMgt();
  const b = mgtSection(main, ICONS.box + ' Pièces détachées', ed ? `<button class="btn btn-primary" onclick="savFormPiece()">+ Pièce</button>` : '');
  const f = savFiltrePieces;
  const toutes = Object.entries(mgtGet('pieces'));
  const l = toutes.filter(([, p]) => !f.alerte || (Number(p.qte) || 0) <= (Number(p.seuil) || 0))
    .sort((a, c) => (a[1].designation || '').localeCompare(c[1].designation || ''));
  const valeur = toutes.reduce((s, [, p]) => s + Math.max(0, Number(p.qte) || 0) * (Number(p.prix) || 0), 0);
  b.innerHTML = `
    <div class="card" style="padding:10px 12px;">
      <input class="mgt-in" placeholder="Rechercher (référence, désignation, marque)…" value="${esc(f.q)}" oninput="savFiltrePieces.q=this.value; mgtFiltrerLignes('sav-piece-row', this.value)">
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center;">
        ${[[false, 'Toutes'], [true, 'À commander']].map(([k, lb]) => `<button class="btn ${f.alerte === k ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 12px;font-size:12px;" onclick="savFiltrePieces.alerte=${k}; nav('mgt-pieces')">${lb}</button>`).join('')}
        <span style="margin-left:auto;font-size:12px;color:var(--ink-soft);">Valeur du stock : <b>${fmtDT(valeur)}</b></span>
      </div>
    </div>
    <div class="card" style="padding:4px 12px;">${l.length ? l.map(([id, p]) => {
      const bas = (Number(p.qte) || 0) <= (Number(p.seuil) || 0);
      return `<div class="session-row sav-piece-row" data-search="${esc([p.ref, p.designation, p.marque].join(' ').toLowerCase())}" style="cursor:pointer;" onclick="savFichePiece('${id}')">
        <div style="min-width:0;"><b style="font-size:13.5px;">${esc(p.designation)}</b>
          <div style="font-size:11.5px;color:var(--ink-soft);">${esc([p.ref, p.marque, p.emplacement].filter(Boolean).join(' · '))}${p.prix ? ' · ' + fmtDT(p.prix) : ''}</div></div>
        <div style="text-align:right;"><div style="font-family:var(--mono);font-weight:800;font-size:16px;" class="${bas ? 'hour-rend bad' : ''}">${p.qte || 0}</div>
          <div style="font-size:10.5px;color:var(--ink-soft);">seuil ${p.seuil || 0}</div></div>
      </div>`;
    }).join('') : buildEmptyState(f.alerte ? 'Aucune pièce sous le seuil' : 'Aucune pièce', f.alerte ? '' : 'Ajoutez les pièces détachées Macpi et Morgan Tecnica que vous gardez en stock.')}</div>`;
  if(f.q) mgtFiltrerLignes('sav-piece-row', f.q);
}
window.savFormPiece = (id) => {
  const p = id ? mgtGet('pieces')[id] : {marque:'Macpi', qte:0, seuil:1};
  mgtModal(id ? 'Modifier la pièce' : 'Nouvelle pièce', `
    ${mgtChamp('Désignation *', 'sp-des', p.designation, 'text', 'placeholder="Ex : résistance plateau 335"')}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Référence', 'sp-ref', p.ref)}</div><div style="flex:1;">${mgtSelect('Marque', 'sp-marque', MGT_MARQUES.map(x => [x, x]), p.marque)}</div></div>
    <div style="display:flex;gap:8px;">
      ${id ? '' : `<div style="flex:1;">${mgtChamp('Stock initial', 'sp-qte', p.qte, 'number', 'step="1"')}</div>`}
      <div style="flex:1;">${mgtChamp('Seuil d\'alerte', 'sp-seuil', p.seuil, 'number', 'min="0" step="1"')}</div>
      <div style="flex:1;">${mgtChamp('Prix de vente HT', 'sp-prix', p.prix, 'number', 'min="0" step="0.001"')}</div>
    </div>
    ${mgtChamp('Emplacement', 'sp-empl', p.emplacement, 'text', 'placeholder="Ex : armoire B, étagère 2"')}
    <button class="btn btn-primary" style="width:100%;" onclick="savSauverPiece('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="savSupprimerPiece('${id}')">Supprimer</button>` : ''}`);
};
window.savSauverPiece = (id) => {
  const designation = mgtVal('sp-des'); if(!designation){ showToast('Désignation obligatoire'); return; }
  const list = mgtGet('pieces'), nid = id || mgtId('pc');
  list[nid] = {...(list[nid] || {qte:0}), designation, ref:mgtVal('sp-ref'), marque:mgtVal('sp-marque'), seuil:parseInt(mgtVal('sp-seuil')) || 0,
    prix:parseFloat(mgtVal('sp-prix')) || 0, emplacement:mgtVal('sp-empl')};
  mgtSet('pieces', list);
  if(!id){ const q = parseInt(mgtVal('sp-qte')) || 0; if(q) savMouvement(nid, q, 'inventaire', '', 'Stock initial'); }
  mgtFermer(); showToast('Pièce enregistrée'); nav('mgt-pieces');
};
window.savSupprimerPiece = (id) => {
  const utilisee = Object.values(mgtGet('tickets')).some(t => (t.interventions || []).some(iv => (iv.pieces || []).some(x => x.pieceId === id)));
  if(utilisee){ showToast('Pièce utilisée dans un ticket : mettez son stock à 0 plutôt que de la supprimer'); return; }
  if(!confirm('Supprimer cette pièce ?')) return;
  const l = mgtGet('pieces'); delete l[id]; mgtSet('pieces', l); mgtFermer(); nav('mgt-pieces');
};
// Fiche pièce : stock, mouvement rapide et historique.
window.savFichePiece = (id) => {
  const p = mgtGet('pieces')[id]; if(!p) return;
  const tickets = mgtGet('tickets');
  const mv = Object.values(mgtGet('mouvements')).filter(m => m.pieceId === id).sort((a, c) => c.date.localeCompare(a.date)).slice(0, 20);
  mgtModal(esc(p.designation), `
    <div style="font-size:13px;color:var(--ink-soft);margin-bottom:10px;">${esc([p.ref, p.marque, p.emplacement].filter(Boolean).join(' · '))}</div>
    <div style="font-size:28px;font-family:var(--mono);font-weight:800;text-align:center;margin-bottom:12px;">${p.qte || 0} <span style="font-size:13px;color:var(--ink-soft);">en stock</span></div>
    ${canEditMgt() ? `<div class="card" style="padding:10px;margin-bottom:12px;">
      <div style="display:flex;gap:8px;">
        <div style="flex:1;">${mgtSelect('Mouvement', 'sm-motif', [['entree', 'Entrée (achat)'], ['sortie', 'Sortie'], ['inventaire', 'Inventaire (stock compté)']], 'entree')}</div>
        <div style="width:90px;">${mgtChamp('Quantité', 'sm-qte', '', 'number', 'min="0" step="1"')}</div>
      </div>
      ${mgtChamp('Note', 'sm-note', '', 'text', 'placeholder="Ex : commande Macpi n° 1234"')}
      <button class="btn btn-primary" style="width:100%;" onclick="savSauverMouvement('${id}')">Enregistrer le mouvement</button>
    </div>` : ''}
    <h3 style="margin:0 0 6px;font-size:13.5px;">Derniers mouvements</h3>
    ${mv.length ? mv.map(m => `<div class="session-row"><div style="font-size:12.5px;"><b>${mgtDate(m.date)}</b> ${SAV_MOTIFS[m.motif] || m.motif}${m.ticketId && tickets[m.ticketId] ? ' · ' + esc(tickets[m.ticketId].numero) : ''}${m.note ? `<div style="font-size:11.5px;color:var(--ink-soft);">${esc(m.note)}</div>` : ''}</div>
      <b style="font-family:var(--mono);" class="hour-rend ${m.qte > 0 ? 'good' : 'bad'}">${m.qte > 0 ? '+' : ''}${m.qte}</b></div>`).join('') : `<div style="font-size:12px;color:var(--ink-faint);">Aucun mouvement</div>`}
    ${canEditMgt() ? `<button class="btn btn-ghost" style="width:100%;margin-top:12px;" onclick="savFormPiece('${id}')">Modifier la pièce</button>` : ''}`);
};
window.savSauverMouvement = (id) => {
  const motif = mgtVal('sm-motif'), q = parseInt(mgtVal('sm-qte'));
  if(isNaN(q) || q < 0 || (q === 0 && motif !== 'inventaire')){ showToast('Quantité invalide'); return; }
  const actuel = Number(mgtGet('pieces')[id].qte) || 0;
  const delta = motif === 'entree' ? q : motif === 'sortie' ? -q : q - actuel;
  if(!delta){ showToast('Stock déjà à jour'); return; }
  savMouvement(id, delta, motif, '', mgtVal('sm-note'));
  showToast('Stock mis à jour'); savFichePiece(id); if(activeTab === 'mgt-pieces') nav('mgt-pieces');
};

// ============================================================
// CONTRATS DE MAINTENANCE
// ============================================================
function savEtatContrat(c){
  const today = getTodayISO();
  if(c.fin < today) return {label:'Expiré', cls:'bad'};
  if(c.debut > today) return {label:'À venir', cls:''};
  if(c.fin <= mgtAddDays(today, 30)) return {label:'À renouveler', cls:'warn'};
  return {label:'Actif', cls:'good'};
}
// Visites préventives : prévues sur la durée du contrat, faites = tickets « maintenance » résolus sur les machines couvertes.
function savVisites(c){
  const mois = Math.max(1, Math.round((new Date(c.fin) - new Date(c.debut)) / (30.44 * 864e5)));
  const prevues = Math.round((Number(c.visitesAn) || 0) * mois / 12);
  const faites = Object.values(mgtGet('tickets')).filter(t => t.type === 'maintenance' && t.date >= c.debut && t.date <= c.fin && t.machineId && savContratCouvre(c, t.machineId)
    && (t.statut === 'resolu' || t.statut === 'clos')).length;
  return {prevues, faites};
}
function savLigneContrat(id, c, avecClient){
  const v = savVisites(c), n = (c.machineIds || []).length;
  return `<div class="session-row" style="cursor:pointer;" onclick="savFormContrat('${id}')">
    <div style="min-width:0;"><b style="font-size:13.5px;">${avecClient ? esc(mgtClientNom(c.clientId)) : 'Contrat de maintenance'}</b>
      <div style="font-size:11.5px;color:var(--ink-soft);">${mgtDate(c.debut)} → ${mgtDate(c.fin)} · ${n ? n + ' machine' + (n > 1 ? 's' : '') : 'tout le parc'} · visites ${v.faites}/${v.prevues}${c.montant ? ' · ' + fmtDT(c.montant) + ' HT' : ''}</div></div>
    ${mgtBadge(savEtatContrat(c))}
  </div>`;
}
function renderSavContrats(main){
  const b = mgtSection(main, ICONS.calendarCheck + ' Contrats de maintenance', canEditMgt() ? `<button class="btn btn-primary" onclick="savFormContrat()">+ Contrat</button>` : '');
  const l = Object.entries(mgtGet('contrats')).sort((a, c) => a[1].fin.localeCompare(c[1].fin));
  b.innerHTML = `<div class="card" style="padding:4px 12px;">${l.length ? l.map(([id, c]) => savLigneContrat(id, c, true)).join('')
    : buildEmptyState('Aucun contrat', 'Un contrat couvre l\'entretien des machines d\'un client sur une période, avec un nombre de visites par an.')}</div>`;
}
function savCasesMachines(clientId, coches){
  const l = savOptionsMachines(clientId);
  return l.length ? l.map(([mid, lb]) => `<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0;"><input type="checkbox" class="sc-machine" value="${mid}" ${coches.indexOf(mid) >= 0 ? 'checked' : ''} style="width:17px;height:17px;"> ${esc(lb)}</label>`).join('')
    : `<div style="font-size:12px;color:var(--ink-faint);">Aucune machine dans le parc de ce client.</div>`;
}
window.savFormContrat = (id, clientId) => {
  const today = getTodayISO();
  const c = id ? mgtGet('contrats')[id] : {clientId:clientId || '', debut:today, fin:mgtAddDays(mgtAddDays(today, 365), -1), visitesAn:2, machineIds:[]};
  if(!Object.keys(mgtGet('clients')).length){ showToast('Ajoutez d\'abord un client'); return; }
  const ed = canEditMgt(), dis = ed ? '' : 'disabled';
  const v = id ? savVisites(c) : null;
  mgtModal(id ? 'Contrat de maintenance' : 'Nouveau contrat', `
    ${mgtSelect('Client *', 'sc-client', mgtOptionsClients('— Choisir —'), c.clientId).replace('<select', `<select ${dis} onchange="document.getElementById('sc-machines').innerHTML = savCasesMachines(this.value, [])"`)}
    <div class="field"><label>Machines couvertes (aucune cochée = tout le parc du client)</label><div id="sc-machines">${savCasesMachines(c.clientId, c.machineIds || [])}</div></div>
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Début', 'sc-debut', c.debut, 'date', dis)}</div><div style="flex:1;">${mgtChamp('Fin', 'sc-fin', c.fin, 'date', dis)}</div></div>
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Visites par an', 'sc-visites', c.visitesAn, 'number', 'min="0" step="1" ' + dis)}</div><div style="flex:1;">${mgtChamp('Montant HT (€)', 'sc-montant', c.montant, 'number', 'min="0" step="0.001" ' + dis)}</div></div>
    ${mgtZone('Notes', 'sc-notes', c.notes)}
    ${v ? `<div style="font-size:12.5px;margin-bottom:12px;">Visites préventives faites : <b>${v.faites} / ${v.prevues}</b></div>` : ''}
    ${ed ? `<button class="btn btn-primary" style="width:100%;" onclick="savSauverContrat('${id || ''}')">Enregistrer</button>` : ''}
    ${id && ed ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer(); savFormTicket(null, '${c.clientId}', '', 'maintenance')">Planifier une visite</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="savRenouveler('${id}')">Renouveler (nouveau contrat d'un an)</button>` : ''}
    ${id && c.factureId ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer(); factOuvrir('${c.factureId}')">Voir la facture</button>`
      : (id && ed && c.montant ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="mgtFermer(); factDepuisContrat('${id}')">Facturer le contrat</button>` : '')}
    ${id && ed ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="savSupprimerContrat('${id}')">Supprimer</button>` : ''}`);
};
window.savCasesMachines = savCasesMachines;
window.savSauverContrat = (id) => {
  const clientId = mgtVal('sc-client'), debut = mgtVal('sc-debut'), fin = mgtVal('sc-fin');
  if(!clientId || !debut || !fin || fin < debut){ showToast('Client et dates valides obligatoires'); return; }
  const list = mgtGet('contrats'), nid = id || mgtId('c');
  list[nid] = {...(list[nid] || {}), clientId, debut, fin, visitesAn:parseInt(mgtVal('sc-visites')) || 0, montant:parseFloat(mgtVal('sc-montant')) || 0, notes:mgtVal('sc-notes'),
    machineIds:Array.from(document.querySelectorAll('.sc-machine:checked')).map(x => x.value)};
  mgtSet('contrats', list); mgtFermer(); showToast('Contrat enregistré'); nav(activeTab);
};
window.savRenouveler = (id) => {
  const list = mgtGet('contrats'), c = list[id]; if(!c) return;
  const debut = mgtAddDays(c.fin, 1), nid = mgtId('c');
  list[nid] = {clientId:c.clientId, machineIds:(c.machineIds || []).slice(), debut, fin:mgtAddDays(mgtAddDays(debut, 365), -1), visitesAn:c.visitesAn, montant:c.montant, notes:c.notes || ''};
  mgtSet('contrats', list); showToast('Contrat renouvelé du ' + mgtDate(debut)); savFormContrat(nid);
  if(activeTab === 'mgt-contrats') nav('mgt-contrats');
};
window.savSupprimerContrat = (id) => { if(!confirm('Supprimer ce contrat ?')) return; const l = mgtGet('contrats'); delete l[id]; mgtSet('contrats', l); mgtFermer(); nav(activeTab); };
