// ============================================================
// PORTAIL CLIENT EXTERNE — PERCKO (suivi des commandes) et clients MGT (SAV)
// ============================================================
// Un compte « portail » est un compte ordinaire créé par la direction du groupe
// (Sessions → Ajouter un compte → « Compte client externe »). Il porte :
//   portail: { type:'percko', clients:{NEOLYS:true, …} }  — suivi des commandes (lecture seule)
//   portail: { type:'mgt', clientId:'<id du client MGT>' } — machines, tickets, contrats + demandes SAV
// À la connexion, enterSociete() détecte ce compte et affiche uniquement cet écran :
// aucun accès aux sociétés, aux modules ni aux comptes.
//
// ISOLATION DES DONNÉES (mode Firebase) : le compte portail ne lit JAMAIS les
// données de l'entreprise. Le personnel publie, à chaque modification, une COPIE
// ASSAINIE par client dans « portail/… » (voir portailPublier) ; le compte portail
// ne lit que sa copie et n'écrit que ses demandes (mgt/mgt_demandes/<id>).
// Les règles database.rules.json l'imposent côté serveur.
//  - portail/mgt/<clientId>/portail_proj_mgt    : machines, tickets, contrats, demandes du client ;
//  - portail/percko/<tous|NEOLYS|ALLOGA>/portail_proj_<…> : commandes, étapes plafonnées à la quantité
//    commandée (la marge de coupe, la GADH, les rebuts et les prix n'y figurent pas).
// En mode local (sans Firebase), la même copie est calculée à l'ouverture de l'écran.
//
// Un client MGT n'écrit jamais dans les tickets : il dépose une DEMANDE, que MGT
// transforme en ticket SAV d'un clic depuis l'écran Tickets.

const PORTAIL_ETAPES = [['cp', 'Coupée'], ['conf', 'Confection'], ['ctl', 'Contrôle'], ['pret', 'Prête'], ['exp', 'Expédiée']];
const PORTAIL_DESTINATAIRES = ['NEOLYS', 'ALLOGA'];
let portailOuvert = false;
let portailOnglet = 'machines';

function isPortail(u){ u = u || currentUser; return !!(u && u.portail && u.portail.type); }
// « clients » est stocké comme une table {NEOLYS:true} (Firebase ne garde pas bien les tableaux) ; on accepte aussi une liste.
function portailClientsListe(p){
  const c = p && p.clients;
  if(!c) return [];
  return (Array.isArray(c) ? c : Object.keys(c).filter(k => c[k])).filter(Boolean);
}
function portailLabel(u){
  const p = u.portail;
  if(p.type === 'mgt'){ const c = (getJSON('mgt_clients', {}) || {})[p.clientId]; return 'Portail MGT · ' + (c ? c.nom : 'client'); }
  const l = portailClientsListe(p);
  return 'Portail PERCKO' + (l.length ? ' · ' + l.join(', ') : '');
}
function portailEnFirebase(){ return typeof firebaseReady !== 'undefined' && firebaseReady && !!fbRootRef; }

// ------------------------------------------------------------
// Formulaire de compte (appelé par societesFieldHTML / readSocietesField)
// ------------------------------------------------------------
function portailFieldHTML(u){
  const p = (u && u.portail) || {}, type = p.type || '';
  const ligne = (id, ok, label) => `<label style="display:flex;gap:8px;align-items:center;font-weight:600;font-size:13px;margin:6px 0;"><input type="checkbox" id="${id}" ${ok ? 'checked' : ''} style="width:auto;"> ${label}</label>`;
  const clients = Object.entries(getJSON('mgt_clients', {}) || {}).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || ''));
  return `<div class="field"><label>Compte client externe (portail)</label>
    <select id="uf-portail" class="mgt-in" onchange="portailMajForm()">
      <option value="" ${type === '' ? 'selected' : ''}>Non — compte du personnel</option>
      <option value="percko" ${type === 'percko' ? 'selected' : ''}>Client PERCKO — suivi des commandes</option>
      <option value="mgt" ${type === 'mgt' ? 'selected' : ''}>Client MGT — machines et tickets SAV</option>
    </select>
    <div id="uf-portail-percko" style="display:${type === 'percko' ? 'block' : 'none'};margin-top:6px;">
      <div style="font-size:11.5px;color:var(--ink-soft);">Destinataires visibles (aucun coché = tous) :</div>
      ${PORTAIL_DESTINATAIRES.map(c => ligne('uf-pc-' + c, portailClientsListe(p).indexOf(c) >= 0, c)).join('')}
    </div>
    <div id="uf-portail-mgt" style="display:${type === 'mgt' ? 'block' : 'none'};margin-top:6px;">
      <select id="uf-pm-client" class="mgt-in">
        <option value="">— Choisir le client MGT —</option>
        ${clients.map(([id, c]) => `<option value="${esc(id)}" ${p.clientId === id ? 'selected' : ''}>${esc(c.nom || id)}</option>`).join('')}
      </select>
      ${clients.length ? '' : '<div style="font-size:11.5px;color:var(--warn);margin-top:4px;">Aucun client MGT : créez-le d\'abord dans MGT → Clients.</div>'}
    </div>
    <div style="font-size:11.5px;color:var(--ink-faint);margin-top:6px;">Un compte portail n'a accès à aucune société : les cases ci-dessus sont alors ignorées.</div>
  </div>`;
}
window.portailMajForm = () => {
  const t = document.getElementById('uf-portail').value;
  document.getElementById('uf-portail-percko').style.display = t === 'percko' ? 'block' : 'none';
  document.getElementById('uf-portail-mgt').style.display = t === 'mgt' ? 'block' : 'none';
};
// Retourne {portail} (ou {portail:null}), ou null avec un message si le formulaire est incomplet.
function portailLireForm(){
  const sel = document.getElementById('uf-portail');
  const t = sel ? sel.value : '';
  if(!t) return {portail:null};
  if(t === 'percko'){ const clients = {}; PORTAIL_DESTINATAIRES.forEach(c => { if(document.getElementById('uf-pc-' + c).checked) clients[c] = true; }); return {portail:{type:'percko', clients}}; }
  const clientId = document.getElementById('uf-pm-client').value;
  if(!clientId){ showToast('Choisissez le client MGT de ce compte'); return null; }
  return {portail:{type:'mgt', clientId}};
}

// ------------------------------------------------------------
// Copies assainies (projections) — construites par le personnel, lues par le portail
// ------------------------------------------------------------
// Une étape ne dépasse jamais la quantité commandée (la marge de coupe reste interne).
function portailPlafond(v, qte){ return Math.max(0, Math.min(qte, Number(v) || 0)); }

// dest : 'tous' ou un destinataire (NEOLYS, ALLOGA). Retourne {lots:[…]} sans aucune donnée interne.
function portailProjectionPercko(dest){
  const docs = suiviLireDocs(), lots = (docs.cfg && docs.cfg.lots) || {}, lignes = {}, par = {};
  Object.keys(docs).forEach(id => {
    if(id.indexOf('lines-') !== 0) return;
    (docs[id].lines || []).forEach(a => {
      if(dest !== 'tous' && a[2] !== dest) return;
      lignes[a[0]] = {lot:docs[id].lot, client:a[2], lib:String(a[4] || ''), qty:Number(a[6]) || 0};
    });
  });
  Object.values(lignes).forEach(l => {
    const L = par[l.lot] || (par[l.lot] = {lot:l.lot, qte:0, e:{}, dernier:'', lib:{}, clients:{}, cloture:!!(lots[l.lot] && lots[l.lot].closed)});
    L.qte += l.qty; L.clients[l.client] = 1;
    const r = L.lib[l.lib] || (L.lib[l.lib] = {qty:0, e:{}});
    r.qty += l.qty;
  });
  Object.keys(docs).forEach(id => {
    if(id.indexOf('moves-') !== 0) return;
    (docs[id].moves || []).forEach(m => {
      const l = lignes[m[2]]; if(!l) return;
      const L = par[l.lot], st = m[3], q = Number(m[4]) || 0;
      if(PORTAIL_ETAPES.some(e => e[0] === st)){
        L.e[st] = (L.e[st] || 0) + q;
        const r = L.lib[l.lib]; r.e[st] = (r.e[st] || 0) + q;
      }
      if(m[1] > L.dernier) L.dernier = m[1];
    });
  });
  return {lots:Object.values(par).map(L => {
    const etapes = {};
    PORTAIL_ETAPES.forEach(([k]) => { etapes[k] = portailPlafond(L.e[k], L.qte); });
    const statut = etapes.exp >= L.qte && L.qte > 0 ? 'expediee' : (L.cloture ? 'cloturee' : 'encours');
    return {lot:L.lot, qte:L.qte, etapes, dernier:L.dernier, statut, clients:Object.keys(L.clients),
      lib:Object.entries(L.lib).sort((a, b) => a[0].localeCompare(b[0])).map(([lib, r]) => ({lib, qty:r.qty, pret:portailPlafond(r.e.pret, r.qty), exp:portailPlafond(r.e.exp, r.qty)}))};
  })};
}

function portailProjectionMgt(clientId){
  const c = mgtGet('clients')[clientId];
  const machines = Object.entries(mgtGet('machines')).filter(([, m]) => m.clientId === clientId && m.statut !== 'retiree')
    .map(([id, m]) => ({id, marque:m.marque || '', modele:m.modele || '', serie:m.serie || '', dateInstallation:m.dateInstallation || '', finGarantie:m.finGarantie || '', statut:m.statut || 'service'}));
  const tickets = Object.values(mgtGet('tickets')).filter(t => t.clientId === clientId)
    .map(t => ({numero:t.numero || '', objet:t.objet || '', type:t.type || '', date:t.date || '', statut:t.statut || '', machine:t.machineId ? savMachineLabel(t.machineId) : '', technicien:t.technicien || '',
      travaux:(t.interventions || []).filter(i => i.travaux).map(i => ({date:i.date || '', travaux:String(i.travaux)}))}));
  const contrats = Object.values(mgtGet('contrats')).filter(x => x.clientId === clientId)
    .map(x => { const e = savEtatContrat(x); return {debut:x.debut || '', fin:x.fin || '', visitesAn:x.visitesAn ? String(x.visitesAn) : '', etat:e.label, cls:e.cls || ''}; });
  const demandes = Object.entries(mgtGet('demandes')).filter(([, d]) => d.clientId === clientId && d.statut !== 'traitee')
    .map(([id, d]) => ({id, objet:d.objet || '', date:d.date || '', statut:d.statut || 'attente', motif:d.motif || ''}));
  return {nom:c ? c.nom : '', machines, tickets, contrats, demandes};
}

// --- Lecture côté portail : copie publiée (Firebase) ou copie calculée sur place (mode local) ---
function portailDonneesMgt(){
  if(portailEnFirebase()) return getJSON('portail_proj_mgt', null) || {nom:'', machines:[], tickets:[], contrats:[], demandes:[]};
  return portailProjectionMgt(portailClientId());
}
function portailDonneesPercko(){
  const l = portailClientsListe(currentUser.portail), dests = l.length ? l : ['tous'];
  let lots = [];
  dests.forEach(d => {
    const p = portailEnFirebase() ? getJSON('portail_proj_' + d, null) : portailProjectionPercko(d);
    if(p && p.lots) lots = lots.concat(Array.isArray(p.lots) ? p.lots : Object.values(p.lots));
  });
  return lots.sort((a, b) => (a.statut === 'encours' ? 0 : 1) - (b.statut === 'encours' ? 0 : 1) || (b.dernier || '').localeCompare(a.dernier || ''));
}
const portailListe = (v) => Array.isArray(v) ? v : (v ? Object.values(v) : []);

// --- Publication par le personnel ---
let portailPubTimer = null;
const portailPubEmpreintes = {};
function portailPeutPublier(){ return portailEnFirebase() && !!currentUser && !isPortail() && currentUser.role !== 'viewer'; }
function portailPlanifier(){
  if(!portailPeutPublier()) return;
  if(portailPubTimer) clearTimeout(portailPubTimer);
  portailPubTimer = setTimeout(() => { portailPubTimer = null; try { portailPublier(); } catch(e) { console.error('Publication portail', e); } }, 4000);
}
function portailPublier(){
  if(!portailPeutPublier()) return;
  const soc = userSocietes(), travaux = [];
  if(soc.indexOf('mgt') >= 0){
    Object.entries(mgtGet('clients')).filter(([, c]) => c.type !== 'prospect').forEach(([id]) => travaux.push(['mgt/' + id, 'portail_proj_mgt', () => portailProjectionMgt(id)]));
  }
  if(soc.indexOf('tek') >= 0 || soc.indexOf('gadh') >= 0){
    ['tous'].concat(PORTAIL_DESTINATAIRES).forEach(d => travaux.push(['percko/' + d, 'portail_proj_' + d, () => portailProjectionPercko(d)]));
  }
  travaux.forEach(([chemin, cle, calcul]) => {
    const val = calcul(), h = JSON.stringify(val);
    if(portailPubEmpreintes[chemin] === h) return;
    portailPubEmpreintes[chemin] = h;
    fbRootRef.child('portail/' + chemin + '/' + cle).set(Object.assign({}, val, {maj:Date.now()})).catch(() => { delete portailPubEmpreintes[chemin]; });
  });
}
const portailSetJSONOrigine = window.setJSON;
window.setJSON = function(key, value){
  portailSetJSONOrigine(key, value);
  if(/^(mgt_|suivi_d_)/.test(key)) portailPlanifier();
};
const portailUpdateNavBadgesOrigine = window.updateNavBadges;
window.updateNavBadges = function(){ portailUpdateNavBadgesOrigine(); portailPlanifier(); };

// ------------------------------------------------------------
// Écrans PERCKO et MGT
// ------------------------------------------------------------
function portailHTMLPercko(){
  const lots = portailDonneesPercko();
  if(!lots.length) return `<div class="card">${buildEmptyState('Aucune commande à afficher', 'Vos commandes apparaîtront ici dès leur lancement en production.')}</div>`;
  const enCours = lots.filter(l => l.statut === 'encours');
  const cmd = lots.reduce((s, l) => s + l.qte, 0), exp = lots.reduce((s, l) => s + ((l.etapes || {}).exp || 0), 0);
  const chip = {encours:['En cours', 'warn'], expediee:['Expédiée', 'good'], cloturee:['Clôturée', '']};
  return `
    <div class="kpi-mini-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:20px;font-weight:800;">${enCours.length}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">Commandes en cours</div></div>
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:20px;font-weight:800;">${cmd.toLocaleString('fr-FR')}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">Pièces commandées</div></div>
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:20px;font-weight:800;">${exp.toLocaleString('fr-FR')}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">Pièces expédiées</div></div>
    </div>
    ${lots.map(L => {
      const et = L.etapes || {}, e = et.exp || 0, pct = L.qte ? Math.round(e / L.qte * 100) : 0, c = chip[L.statut] || chip.encours;
      return `<div class="card" style="padding:12px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
          <b style="font-size:15px;">Commande ${esc(L.lot)}</b>
          <span class="hour-rend ${c[1]}" style="font-size:11.5px;">${c[0]}</span>
        </div>
        <div style="font-size:12px;color:var(--ink-soft);margin:2px 0 8px;">${portailListe(L.clients).map(esc).join(' · ')}${L.dernier ? ' · mise à jour le ' + esc(L.dernier.split('-').reverse().join('/')) : ''}</div>
        <div style="height:10px;border-radius:20px;background:var(--surface-3);overflow:hidden;"><div style="height:100%;width:${pct}%;background:${L.statut === 'encours' ? 'var(--accent-2)' : 'var(--good)'};border-radius:20px;"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;"><span>${e.toLocaleString('fr-FR')} / ${L.qte.toLocaleString('fr-FR')} expédiées</span><b>${pct} %</b></div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:10px;">
          ${PORTAIL_ETAPES.map(([k, n]) => `<div style="text-align:center;border:1px solid var(--border);border-radius:9px;padding:6px 2px;">
            <div style="font-family:var(--mono);font-weight:800;font-size:14px;">${(et[k] || 0).toLocaleString('fr-FR')}</div>
            <div style="font-size:9.5px;color:var(--ink-soft);font-weight:700;">${n}</div></div>`).join('')}
        </div>
        <details style="margin-top:10px;">
          <summary style="cursor:pointer;font-size:12.5px;font-weight:700;color:var(--accent-2);">Détail par modèle</summary>
          <div style="overflow-x:auto;margin-top:6px;"><table>
            <thead><tr><th>Modèle</th><th>Commandé</th><th>Prêt</th><th>Expédié</th><th>Reste</th></tr></thead>
            <tbody>${portailListe(L.lib).map(r => `<tr>
              <td style="white-space:normal;">${esc(r.lib)}</td><td>${r.qty}</td><td>${r.pret || 0}</td><td>${r.exp || 0}</td><td><b>${Math.max(0, r.qty - (r.exp || 0))}</b></td></tr>`).join('')}</tbody>
          </table></div>
        </details>
      </div>`;
    }).join('')}`;
}

// ------------------------------------------------------------
// Données MGT (client)
// ------------------------------------------------------------
function portailClientId(){ return currentUser.portail.clientId; }
function portailCleEnvoyees(){ return CACHE_PREFIX + 'portail_env_' + currentUser.username; }
function portailEnvoyees(){ try { return JSON.parse(window.localStorage.getItem(portailCleEnvoyees()) || '[]'); } catch(e) { return []; } }

function portailHTMLMgt(D){
  const onglets = [['machines', 'Mes machines'], ['tickets', 'Mes demandes'], ['contrats', 'Contrats']];
  let corps = '';
  if(portailOnglet === 'machines'){
    const l = portailListe(D.machines);
    corps = l.length ? l.map(m => {
      const g = !!m.finGarantie && m.finGarantie >= getTodayISO();
      return `<div class="card" style="padding:11px 12px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
          <b>${esc((m.marque || '') + ' ' + (m.modele || ''))}</b>
          <span class="hour-rend ${m.statut === 'arret' ? 'bad' : 'good'}" style="font-size:11.5px;">${esc(MGT_STATUTS_MACHINE[m.statut] || 'En service')}</span>
        </div>
        <div style="font-size:12.5px;color:var(--ink-soft);margin-top:3px;">${m.serie ? 'N° ' + esc(m.serie) + ' · ' : ''}${m.dateInstallation ? 'installée le ' + esc(mgtDate(m.dateInstallation)) + ' · ' : ''}${m.finGarantie ? (g ? '<span style="color:var(--good);font-weight:700;">sous garantie jusqu\'au ' : '<span style="color:var(--warn);font-weight:700;">garantie échue le ') + esc(mgtDate(m.finGarantie)) + '</span>' : 'garantie non renseignée'}</div>
        <button class="btn btn-ghost" style="margin-top:8px;padding:7px 11px;font-size:12.5px;" onclick="portailFormDemande('${esc(m.id)}')">Signaler un problème</button>
      </div>`;
    }).join('') : `<div class="card">${buildEmptyState('Aucune machine enregistrée', 'Contactez MGT si une de vos machines manque.')}</div>`;
  }
  else if(portailOnglet === 'tickets'){
    const vues = portailListe(D.demandes).map(d => d.id);
    const demandes = portailListe(D.demandes).concat(portailEnvoyees().filter(d => vues.indexOf(d.id) < 0))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tickets = portailListe(D.tickets).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    corps = `<button class="btn btn-primary" style="width:100%;margin-bottom:12px;" onclick="portailFormDemande('')">+ Nouvelle demande SAV</button>
      ${demandes.map(d => `<div class="card" style="padding:10px 12px;border-left:4px solid ${d.statut === 'rejetee' ? 'var(--ink-faint)' : 'var(--warn)'};">
        <div style="display:flex;justify-content:space-between;gap:8px;"><b>${esc(d.objet)}</b><span class="hour-rend ${d.statut === 'rejetee' ? '' : 'warn'}" style="font-size:11.5px;">${d.statut === 'rejetee' ? 'Non retenue' : 'En attente de prise en charge'}</span></div>
        <div style="font-size:12px;color:var(--ink-soft);">Envoyée le ${esc(mgtDate(d.date))}${d.motif ? ' · ' + esc(d.motif) : ''}</div></div>`).join('')}
      ${tickets.length ? tickets.map(t => {
        const st = SAV_STATUTS[t.statut] || {label:t.statut, cls:''};
        const inter = portailListe(t.travaux);
        return `<div class="card" style="padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;"><b>${esc(t.numero)} · ${esc(t.objet)}</b>${mgtBadge(st)}</div>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${esc(SAV_TYPES[t.type] || '')} · ouvert le ${esc(mgtDate(t.date))}${t.machine ? ' · ' + esc(t.machine) : ''}${t.technicien ? ' · technicien : ' + esc(t.technicien) : ''}</div>
          ${inter.length ? `<div style="margin-top:6px;font-size:12.5px;">${inter.map(i => `<div style="white-space:normal;"><b>${esc(mgtDate(i.date))}</b> — ${esc(i.travaux)}</div>`).join('')}</div>` : ''}
        </div>`;
      }).join('') : (demandes.length ? '' : `<div class="card">${buildEmptyState('Aucune demande pour le moment')}</div>`)}`;
  }
  else {
    const l = portailListe(D.contrats).sort((a, b) => (b.fin || '').localeCompare(a.fin || ''));
    corps = l.length ? l.map(c => `<div class="card" style="padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;"><b>Contrat de maintenance</b>${mgtBadge({label:c.etat, cls:c.cls})}</div>
        <div style="font-size:12.5px;color:var(--ink-soft);margin-top:3px;">Du ${esc(mgtDate(c.debut))} au ${esc(mgtDate(c.fin))}${c.visitesAn ? ' · ' + esc(String(c.visitesAn)) + ' visite(s) par an' : ''}</div></div>`).join('')
      : `<div class="card">${buildEmptyState('Aucun contrat de maintenance')}</div>`;
  }
  return `<div class="mgt-onglets">${onglets.map(([k, l]) => `<button class="${k === portailOnglet ? 'actif' : ''}" onclick="portailChoisir('${k}')">${l}</button>`).join('')}</div>${corps}`;
}
window.portailChoisir = (k) => { portailOnglet = k; renderPortail(); };

// --- Demande SAV du client ---
window.portailFormDemande = (machineId) => {
  if(!isPortail() || currentUser.portail.type !== 'mgt') return;
  const machines = portailListe(portailDonneesMgt().machines).map(m => [m.id, ((m.marque || '') + ' ' + (m.modele || '') + (m.serie ? ' · N° ' + m.serie : '')).trim()]);
  mgtModal('Nouvelle demande SAV', `
    ${mgtSelect('Machine concernée', 'pd-machine', [['', 'Autre / non listée']].concat(machines), machineId || '')}
    ${mgtSelect('Type de demande', 'pd-type', Object.entries(SAV_TYPES), 'panne')}
    ${mgtChamp('Objet *', 'pd-objet', '', 'text', 'placeholder="Ex : la presse ne chauffe plus"')}
    ${mgtZone('Description', 'pd-desc', '')}
    <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:8px;"><input type="checkbox" id="pd-arret" style="width:18px;height:18px;"> La machine est à l'arrêt</label>
    <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:14px;"><input type="checkbox" id="pd-urgent" style="width:18px;height:18px;"> Demande urgente</label>
    <button class="btn btn-primary" style="width:100%;" onclick="portailEnvoyerDemande()">Envoyer la demande</button>`);
};
window.portailEnvoyerDemande = () => {
  const objet = mgtVal('pd-objet');
  if(!objet){ showToast('Indiquez l\'objet de votre demande'); return; }
  const now = new Date(), id = mgtId('d');
  const d = {clientId:portailClientId(), machineId:mgtVal('pd-machine'), type:mgtVal('pd-type'), objet, description:mgtVal('pd-desc'),
    arret:document.getElementById('pd-arret').checked, urgente:document.getElementById('pd-urgent').checked,
    date:getTodayISO(), heure:String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), par:currentUser.nom, statut:'attente'};
  const avant = getJSON('mgt_demandes', {}) || {}, liste = JSON.parse(JSON.stringify(avant));
  liste[id] = d;
  // Écriture locale, puis Firebase enfant par enfant : le client ne réécrit jamais les demandes des autres.
  memoryCache[CACHE_PREFIX + 'mgt_demandes'] = liste;
  try { window.localStorage.setItem(CACHE_PREFIX + 'mgt_demandes', JSON.stringify(liste)); } catch(e) {}
  try { auditEnregistrer('mgt_demandes', avant, liste); } catch(e) {}
  if(firebaseReady && fbRootRef){
    fbRootRef.child(firebaseCheminDe('mgt_demandes') + '/' + id).set(d)
      .then(() => setSyncBadge('ok'))
      .catch(() => showToast('⚠️ Demande non transmise : vérifiez votre connexion et réessayez'));
  }
  try { const env = portailEnvoyees(); env.push({id, objet, date:d.date, statut:'attente'}); window.localStorage.setItem(portailCleEnvoyees(), JSON.stringify(env.slice(-30))); } catch(e) {}
  mgtFermer(); showToast('Demande envoyée à MGT');
  portailOnglet = 'tickets'; renderPortail();
};

// ------------------------------------------------------------
// Écran du portail
// ------------------------------------------------------------
function renderPortail(){
  if(!isPortail()) return;
  portailOuvert = true; directionOuverte = false;
  const p = currentUser.portail, mgt = p.type === 'mgt';
  const couleur = mgt ? SOCIETES.mgt.couleur : SOCIETES.tek.couleur;
  const D = mgt ? portailDonneesMgt() : null;
  const titre = mgt ? 'Espace client MGT' : 'Suivi de vos commandes', sous = mgt ? (D.nom || '') : 'PERCKO · TEK-TREND';
  document.getElementById('app').innerHTML = `
    <div style="background:${couleur};color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <div><div style="font-weight:900;font-size:17px;letter-spacing:.02em;">${mgt ? 'MGT' : 'TEK-TREND'}</div><div style="font-size:11px;opacity:.75;">${esc(titre)}</div></div>
      <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;font-weight:700;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(currentUser.nom)}</span>
        <button class="btn" style="padding:7px 11px;font-size:12.5px;background:rgba(255,255,255,.18);color:#fff;" onclick="logout()">Déconnexion</button></div>
    </div>
    <div style="max-width:760px;margin:0 auto;padding:16px 14px 40px;">
      ${sous ? `<h2 style="margin:0 0 12px;font-size:17px;">${esc(sous)}</h2>` : ''}
      ${mgt ? portailHTMLMgt(D) : portailHTMLPercko()}
    </div>`;
}

// ------------------------------------------------------------
// Côté MGT : demandes des clients sur l'écran Tickets
// ------------------------------------------------------------
function portailBandeauDemandes(main){
  const attente = Object.entries(mgtGet('demandes')).filter(([, d]) => d.statut === 'attente')
    .sort((a, b) => (a[1].date + (a[1].heure || '')).localeCompare(b[1].date + (b[1].heure || '')));
  if(!attente.length) return;
  main.insertAdjacentHTML('afterbegin', `<div class="card" style="border-left:4px solid var(--bad);">
    <h3 style="margin:0 0 8px;font-size:14px;color:var(--bad);">Demandes des clients (${attente.length})</h3>
    ${attente.map(([id, d]) => `<div style="padding:8px 0;border-top:1px solid var(--border-soft);">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;"><b>${esc(mgtClientNom(d.clientId))}</b>
        <span style="font-size:11.5px;color:var(--ink-soft);">${esc(mgtDate(d.date))} ${esc(d.heure || '')}</span></div>
      <div style="font-size:13px;white-space:normal;margin-top:2px;">${d.urgente ? '<span class="hour-rend bad" style="font-size:11.5px;">URGENT</span> ' : ''}${d.arret ? '<span class="hour-rend bad" style="font-size:11.5px;">MACHINE À L\'ARRÊT</span> ' : ''}${esc(d.objet)}</div>
      <div style="font-size:12px;color:var(--ink-soft);white-space:normal;">${esc(SAV_TYPES[d.type] || '')}${d.machineId ? ' · ' + esc(savMachineLabel(d.machineId)) : ''}${d.description ? ' · ' + esc(d.description) : ''}</div>
      ${canEditMgt() ? `<div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-primary" style="padding:7px 11px;font-size:12.5px;" onclick="portailCreerTicket('${id}')">Créer le ticket</button>
        <button class="btn btn-ghost" style="padding:7px 11px;font-size:12.5px;" onclick="portailRejeter('${id}')">Rejeter</button></div>` : ''}
    </div>`).join('')}
  </div>`);
}
const portailRenderSavTicketsOrigine = window.renderSavTickets;
window.renderSavTickets = function(main){
  portailRenderSavTicketsOrigine(main);
  try { portailBandeauDemandes(main); } catch(e) { console.error('Demandes clients', e); }
};
window.portailCreerTicket = (id) => {
  const liste = mgtGet('demandes'), d = liste[id];
  if(!d || d.statut !== 'attente') return;
  const tickets = mgtGet('tickets'), nid = mgtId('t'), date = getTodayISO();
  tickets[nid] = {numero:mgtNumero('sav', 'SAV', date.slice(0, 4)), statut:'ouvert', interventions:[], date, clientId:d.clientId, machineId:d.machineId || '',
    type:d.type || 'panne', objet:d.objet, description:(d.description || '') + (d.description ? '\n' : '') + '[Demande du portail client — ' + (d.par || 'client') + ']',
    priorite:d.urgente ? 'urgente' : 'normale', technicien:'', arret:!!d.arret, source:'portail', demandeId:id};
  mgtSet('tickets', tickets);
  savMajEtatMachine(tickets[nid]);
  liste[id] = {...d, statut:'traitee', ticketId:nid, numero:tickets[nid].numero};
  mgtSet('demandes', liste);
  showToast('Ticket ' + tickets[nid].numero + ' créé');
  savOuvrir(nid);
};
window.portailRejeter = (id) => {
  mgtModal('Rejeter la demande', `<p style="margin:0 0 10px;font-size:13px;">Le client verra la demande comme « non retenue », avec ce motif.</p>
    ${mgtZone('Motif', 'pr-motif', '')}
    <button class="btn btn-primary" style="width:100%;" onclick="portailRejeterOk('${id}')">Rejeter la demande</button>`);
};
window.portailRejeterOk = (id) => {
  const liste = mgtGet('demandes'), d = liste[id]; if(!d) return;
  liste[id] = {...d, statut:'rejetee', motif:mgtVal('pr-motif')};
  mgtSet('demandes', liste);
  mgtFermer(); nav('mgt-sav');
};
