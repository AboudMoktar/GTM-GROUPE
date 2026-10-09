// ============================================================
// MGT — LOGIQUE CRM (clients, offres, planning, projets, CA)
// ============================================================
// Reprend la logique du CRM « MGT SARL - Base Clients Tunisie 2026 » dans la
// plateforme groupe. Chargé après mgt-module.js, mgt-sav-module.js et
// portail-module.js : il remplace les écrans Tableau, Clients, Fiche, Agenda et
// Projets, ajoute Offres et CA, et conserve le SAV, le parc, les devis, le
// portail client, le journal d'audit et les droits.
//
// Données : tout est dans la fiche client (mgt_clients[id]), comme dans le CRM,
// pour que l'import / l'export d'une sauvegarde reste simple :
//   nom, type ('client'|'prospect'), ville, region, activite, typeClient, groupe,
//   importance ('A - …'), priorite, effectif, statutCommercial, zone, tel, email,
//   contactPrincipal, notes, frequenceVisite ('auto'|'0'|nombre de jours),
//   contacts:[{nom, fonction, tel, email, cle}], visites:[{date, note}],
//   offres:[{offerId, marque, devise, machine, commercial, type, acceptance,
//            sentDate, echeance, amount, probability, progress, status, validation,
//            invoiceRef, validationDate, reminder, result, note, validationNote,
//            avancement (0-200, suivi projet)}],
//   planning:[{id, date, relanceDate, type, priority, status, objective, commercial, motif, offerId}],
//   factures:[{id, number, date, amount, paid, type, status, note}],
//   prochaineAction:{type, date, priority, responsible, status, comment},
//   projets:[{id, nom, montantHT, avancement, origine:'manuel'}], majLe.
// Les machines installées restent dans le parc (mgt_machines).
// Les écritures se font fiche par fiche (mgt/mgt_clients/<id>) pour que deux
// personnes qui modifient des clients différents ne s'écrasent pas.

const CRM_TYPES_OFFRE = ['Machine', 'Piece', 'Service'];
const CRM_ACCEPTATION = ['Bas', 'Moyenne', 'Eleve'];
const CRM_STATUTS_OFFRE = ['En attente', 'Relance', 'Negociation', 'Confirme', 'Actif', 'Non actif'];
const CRM_MARQUES = ['', 'MORGAN', 'MACPI', 'LOTUS', 'AUTRE'];
const CRM_DEVISES = ['EUR', 'USD', 'TND', 'AUTRE'];
const CRM_VALIDATIONS = ['EN ATTENTE', 'PREVALIDE', 'VALIDE', 'REFUSE'];
const CRM_TYPES_ACTION = ['visite', 'appel', 'offre', 'SAV', 'recouvrement', 'tache administrative', 'rappel', 'redaction offre', 'envoi email', 'rapport client', 'calcul prix', 'suivi fournisseur', 'suivi transit', 'recapitulatif client', 'preparation documents', 'autre'];
const CRM_PRIORITES = ['Haute', 'Moyenne', 'Faible', 'A - urgent', 'B - important', 'C - normal', 'D - faible'];
const CRM_STATUTS_ACTION = ['En attente', 'En cours', 'Termine', 'Reporte', 'Archive'];
const CRM_TYPES_CLIENT = ['Non classe', 'Client Morgan', 'Client Macpi', 'Client Morgan et Macpi'];
const CRM_TYPES_FACTURE = ['MACHINE', 'PIECE', 'INTERVENTION', 'COMMISSION', 'FORMATION', 'AUTRE'];
const CRM_SEUIL_PROJET = 20000;

// ------------------------------------------------------------
// Outils
// ------------------------------------------------------------
function crmNorm(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function crmDate(v){
  const s = String(v == null ? '' : v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if(m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}
function crmISO(v){ const d = v instanceof Date ? v : crmDate(v); return d ? toISODateLocal(d) : ''; }
function crmAujourdhui(){ const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function crmJoursAvant(v){ const d = crmDate(v); return d ? Math.round((d - crmAujourdhui()) / 86400000) : null; }
function crmJoursDepuis(v){ const d = crmDate(v); return d ? Math.round((crmAujourdhui() - d) / 86400000) : null; }
function crmPlusJours(v, n){ const d = new Date(crmDate(v) || crmAujourdhui()); d.setDate(d.getDate() + n); return d; }
function crmDateFr(v){ const d = crmDate(v); return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() : (v || '—'); }
function crmNombre(v){ const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; }
function crmMontant(n, devise){ return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' ' + (devise || '€'); }
function crmTableau(v){ return Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []); }
function crmNouvelId(p){ return p + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36); }
function crmCommercial(){ return currentUser ? currentUser.nom : ''; }

// ------------------------------------------------------------
// Accès aux données d'un client
// ------------------------------------------------------------
function crmContacts(c){ return crmTableau(c.contacts).filter(x => x && (x.nom || x.fonction || x.tel || x.email)); }
function crmVisites(c){ return crmTableau(c.visites).filter(x => x && (x.date || x.note)); }
function crmOffres(c){ return crmTableau(c.offres).filter(x => x && (x.type || x.machine || x.amount || x.status)); }
function crmPlanning(c){ return crmTableau(c.planning).filter(x => x && (x.date || x.relanceDate || x.objective)); }
function crmFactures(c){ return crmTableau(c.factures).filter(x => x && (x.number || x.amount || x.date)); }
function crmContactCle(c){ const l = crmContacts(c); return l.find(x => x.cle) || l[0] || null; }
function crmDerniereVisite(c){
  const l = crmVisites(c).filter(v => crmDate(v.date)).sort((a, b) => crmDate(b.date) - crmDate(a.date));
  return l[0] || {date:'', note:''};
}
function crmJoursSansVisite(c){ const v = crmDerniereVisite(c); return v.date ? crmJoursDepuis(v.date) : null; }
function crmLettre(c){ return String(c.importance || '').trim().charAt(0).toUpperCase(); }
function crmEstProspect(c){ return c.type === 'prospect'; }

// Offres
function crmOffreActive(o){ const s = crmNorm(o.status || 'En attente'); return !(s.includes('non actif') || s.includes('perdu') || s.includes('annule') || s.includes('archive')); }
function crmOffreResultat(o){ return crmNorm(o.result || o.status || ''); }
function crmOffreGagnee(o){ const r = crmOffreResultat(o); return r.includes('gagne') || r.includes('signe') || r.includes('confirm'); }
function crmOffrePerdue(o){ const r = crmOffreResultat(o); return r.includes('perdu') || r.includes('annule'); }
function crmOffreEnCours(o){ return crmOffreActive(o) && !crmOffreGagnee(o) && !crmOffrePerdue(o); }
function crmOffreMontant(o){ return crmNombre(o.amount); }
function crmOffreProba(o){ return Math.max(0, Math.min(100, crmNombre(o.probability))); }
function crmOffreEnvoi(o){ return o.sentDate || o.date || ''; }
function crmOffreRelance(o){
  if(!crmOffreActive(o)) return '';
  const d = crmJoursAvant(o.reminder);
  if(d === null) return '';
  return d < 0 ? 'depassee' : d === 0 ? 'aujourdhui' : d <= 7 ? 'proche' : '';
}
const CRM_RELANCE_TXT = {depassee:'Relance dépassée', aujourdhui:'Relance aujourd\'hui', proche:'Relance proche'};
function crmOffreValidation(o){
  const v = crmNorm(o.validation || ''), fact = String(o.invoiceRef || '').trim();
  if(v.includes('prevalid')) return {cle:'prevalidee', label:'Prévalidée', cls:'warn'};
  if(v.includes('valid') || v.includes('accept') || v === 'oui') return fact ? {cle:'validee', label:'Validée', cls:'good'} : {cle:'prevalidee', label:'Prévalidée', cls:'warn'};
  if(v.includes('refus') || v.includes('perdu') || v.includes('annul') || v === 'non') return {cle:'refusee', label:'Refusée', cls:'bad'};
  return {cle:'attente', label:'En attente', cls:''};
}
function crmPipeline(c){ return crmOffres(c).filter(crmOffreEnCours).reduce((s, o) => s + crmOffreMontant(o) * crmOffreProba(o) / 100, 0); }
function crmEtapeRelance(o){
  const age = crmJoursDepuis(crmOffreEnvoi(o));
  if(age === null || !crmOffreEnCours(o)) return null;
  if(age >= 20) return {jours:20, label:'Offre dormante', priorite:'Haute'};
  if(age >= 10) return {jours:10, label:'Relance commerciale J+10', priorite:'Moyenne'};
  if(age >= 3) return {jours:3, label:'Relance soft J+3', priorite:'Moyenne'};
  return {jours:3, label:'Relance soft J+3', priorite:'Faible'};
}

// Actions (planning saisi + actions générées automatiquement, comme dans le CRM)
function crmActionDate(a){ return a.date || ''; }
function crmActionAPlanifier(a){ const s = crmNorm(a.status || 'En attente'); return !(s.includes('realise') || s.includes('termine') || s.includes('report') || s.includes('archive')); }
function crmActionFaite(a){ const s = crmNorm(a.status); return s.includes('realise') || s.includes('termine'); }
function crmActionReportee(a){ return crmNorm(a.status).includes('report'); }
function crmActionJours(a){ return crmJoursAvant(crmActionDate(a)); }
function crmFrequenceVisite(c){
  const raw = String(c.frequenceVisite == null || c.frequenceVisite === '' ? 'auto' : c.frequenceVisite);
  if(raw === '0') return 0;
  const m = Number(raw); if(m > 0) return m;
  const l = crmLettre(c); return l === 'A' ? 30 : l === 'B' ? 60 : l === 'C' ? 90 : 0;
}
function crmPrioriteAuto(c){ const l = crmLettre(c); return l === 'A' ? 'Haute' : l === 'B' ? 'Moyenne' : 'Faible'; }
function crmActionsGenerees(id, c){
  const out = [], base = {clientId:id, c, relanceDate:'', status:'En attente', commercial:''};
  const n = c.prochaineAction || {};
  if(n.date || n.type || n.comment || n.responsible)
    out.push(Object.assign({}, base, {date:crmISO(n.date), type:n.type || 'visite', priority:n.priority || 'Moyenne', status:n.status || 'En attente', objective:n.comment || 'Prochaine action obligatoire', commercial:n.responsible || '', source:'obligatoire'}));
  const f = crmFrequenceVisite(c);
  // Jamais visité : on ne génère la visite automatique que pour les clients A (sinon des centaines d'actions « aujourd'hui »).
  if(f && (crmDate(crmDerniereVisite(c).date) || crmLettre(c) === 'A')){
    const lv = crmDerniereVisite(c), ref = crmDate(lv.date);
    out.push(Object.assign({}, base, {date:crmISO(ref ? crmPlusJours(lv.date, f) : crmAujourdhui()), type:'visite', priority:crmPrioriteAuto(c), objective:'Visite périodique automatique tous les ' + f + ' jours', source:'auto-visite'}));
  }
  crmOffres(c).forEach(o => {
    const e = crmEtapeRelance(o), envoi = crmDate(crmOffreEnvoi(o));
    if(e && envoi) out.push(Object.assign({}, base, {date:crmISO(crmPlusJours(envoi, e.jours)), type:'offre', priority:e.priorite, objective:e.label + ' - ' + (o.type || 'offre'), source:'auto-devis', offre:o}));
  });
  return out;
}
// Toutes les actions de tous les clients, avec leur client.
function crmToutesActions(opts){
  opts = opts || {};
  const out = [];
  Object.entries(mgtGet('clients')).forEach(([id, c]) => {
    crmPlanning(c).forEach(a => out.push(Object.assign({}, a, {clientId:id, c, source:'manuel'})));
    if(opts.generees !== false) crmActionsGenerees(id, c).forEach(a => out.push(a));
  });
  return out.filter(a => crmDate(crmActionDate(a)));
}
function crmActionsAPlanifier(){ return crmToutesActions().filter(crmActionAPlanifier); }
function crmProchaineAction(id, c){
  const l = crmPlanning(c).map(a => Object.assign({}, a, {clientId:id, c})).concat(crmActionsGenerees(id, c)).filter(a => crmActionAPlanifier(a) && crmDate(crmActionDate(a)));
  return l.sort((a, b) => crmDate(crmActionDate(a)) - crmDate(crmActionDate(b)))[0] || null;
}
function crmAActionAVenir(id, c){ return crmActionsAPlanifier().some(a => a.clientId === id && crmActionJours(a) >= 0); }
function crmProjetChaud(c){
  const mots = /projet|machine|coupe|opportunite|invest|achat|besoin/i;
  return crmOffres(c).some(o => crmOffreEnCours(o) && (crmNorm(o.acceptance).includes('eleve') || mots.test([o.progress, o.note, o.type].join(' ')))) || crmPlanning(c).some(a => mots.test(a.objective || ''));
}

// Alertes (même règles que le CRM)
function crmAlertes(){
  const al = [], actions = crmToutesActions({generees:false});
  Object.entries(mgtGet('clients')).forEach(([id, c]) => {
    if(crmEstProspect(c)) return;
    const depuis = crmJoursSansVisite(c), lettre = crmLettre(c);
    if(lettre !== 'A' && lettre !== 'B' && depuis === null) { /* client C/D jamais visité : pas d'alerte */ }
    else
    if(depuis === null || depuis > 120) al.push({niveau:'crit', clientId:id, titre:'Client sans visite depuis ' + (depuis === null ? 'longtemps' : depuis + ' jours'), detail:'Planifier une visite terrain.'});
    crmOffres(c).forEach(o => {
      const d = crmJoursAvant(o.reminder);
      if(crmOffreActive(o) && d !== null && d < -30) al.push({niveau:'crit', clientId:id, titre:'Offre sans relance depuis ' + Math.abs(d) + ' jours', detail:o.type || 'Offre active'});
    });
    actions.filter(a => a.clientId === id).forEach(a => {
      const d = crmActionJours(a), t = crmNorm(a.type);
      if(crmActionReportee(a)) al.push({niveau:'warn', clientId:id, titre:'Visite / action reportée', detail:a.objective || a.type || ''});
      if(!crmActionAPlanifier(a)) return;
      if(d === 1 && t.includes('visite')) al.push({niveau:'warn', clientId:id, titre:'Prochaine visite demain', detail:a.objective || ''});
      if(d !== null && d < 0) al.push({niveau:'crit', clientId:id, titre:'Action en retard', detail:(a.type || 'action') + ' - ' + crmDateFr(a.date)});
      if((t.includes('fournisseur') || t.includes('transit')) && d !== null && d <= 0) al.push({niveau:'warn', clientId:id, titre:'Suivi fournisseur en attente', detail:a.objective || ''});
      if((t.includes('administr') || t.includes('document') || t.includes('rapport') || t.includes('calcul')) && d !== null && d <= 0) al.push({niveau:'warn', clientId:id, titre:'Tâche administrative non terminée', detail:a.objective || ''});
      if((t.includes('rappel') || crmNorm(a.priority).includes('haute')) && d !== null && d <= 1 && !(d < 0)) al.push({niveau:'crit', clientId:id, titre:'Rappel urgent', detail:a.objective || ''});
    });
  });
  return al.sort((a, b) => (a.niveau === 'crit' ? 0 : 1) - (b.niveau === 'crit' ? 0 : 1));
}

// ------------------------------------------------------------
// Écriture fiche par fiche (Firebase : mgt/mgt_clients/<id>)
// ------------------------------------------------------------
function crmEnregistrerClient(id, rec){
  const avant = mgtGet('clients'), apres = JSON.parse(JSON.stringify(avant));
  if(rec === null) delete apres[id]; else { rec.majLe = getTodayISO(); apres[id] = rec; }
  const plein = CACHE_PREFIX + 'mgt_clients';
  memoryCache[plein] = apres;
  try { window.localStorage.setItem(plein, JSON.stringify(apres)); } catch(e) {}
  try { if(typeof auditEnregistrer === 'function' && currentUser) auditEnregistrer('mgt_clients', avant, apres); } catch(e) { console.error('Audit', e); }
  if(typeof firebaseReady !== 'undefined' && firebaseReady && fbRootRef){
    fbRootRef.child(firebaseCheminDe('mgt_clients') + '/' + id).set(rec === null ? null : rec)
      .then(() => setSyncBadge('ok'))
      .catch(() => showToast('⚠️ Non synchronisé (vérifiez la connexion)'));
  }
  try { if(typeof portailPlanifier === 'function') portailPlanifier(); } catch(e) {}
  try { if(typeof updateNavBadges === 'function') updateNavBadges(); } catch(e) {}
}
// Modifie une fiche : fn reçoit une copie, la sauvegarde est automatique.
function crmModifier(id, fn){
  const cur = mgtGet('clients')[id]; if(!cur) return null;
  const rec = JSON.parse(JSON.stringify(cur));
  fn(rec);
  crmEnregistrerClient(id, rec);
  return rec;
}

// ------------------------------------------------------------
// Indicateurs (écran direction, alertes, tableau)
// ------------------------------------------------------------
const crmIndicateursOrigine = window.mgtIndicateurs;
window.mgtIndicateurs = function(){
  const k = crmIndicateursOrigine();
  try {
    const clients = Object.values(mgtGet('clients')), auj = getTodayISO();
    const actions = crmActionsAPlanifier();
    const offres = clients.flatMap(c => crmOffres(c));
    k.rdvJour = actions.filter(a => crmISO(a.date) === auj).length;
    k.relancesRetard = actions.filter(a => crmActionJours(a) < 0).length;
    k.offresEnCours = offres.filter(crmOffreEnCours).length;
    k.pipeline = clients.reduce((s, c) => s + crmPipeline(c), 0);
    k.offresRelance = offres.filter(o => crmOffreRelance(o) === 'depassee' || crmOffreRelance(o) === 'aujourdhui').length;
    k.projetsEnCours = crmProjets().filter(p => p.phase !== 'fini').length;
  } catch(e) { console.error('Indicateurs CRM', e); }
  return k;
};
// Alertes de la cloche : ajoute celles du CRM pour MGT.
const crmNotifSocieteOrigine = window.notifSociete;
if(crmNotifSocieteOrigine){
  window.notifSociete = function(soc, push){
    crmNotifSocieteOrigine(soc, push);
    if(soc !== 'mgt') return;
    const k = mgtIndicateurs();
    if(k.offresRelance) push({id:'crm-rel-' + k.offresRelance, niveau:'warn', titre:notifPluriel(k.offresRelance, 'offre') + ' à relancer', detail:'Relance dépassée ou prévue aujourd\'hui', ouvrir:{module:'mgt', tab:'mgt-offres'}});
    const sv = crmAlertes().filter(a => a.titre.indexOf('sans visite') >= 0).length;
    if(sv) push({id:'crm-sv-' + sv, niveau:'info', titre:notifPluriel(sv, 'client') + ' sans visite depuis plus de 120 jours', detail:'Planifier des visites', ouvrir:{module:'mgt', tab:'mgt-dashboard'}});
  };
}

// ------------------------------------------------------------
// Projets (offres de plus de 20 000 HTVA, avancement 0 à 200 %)
// ------------------------------------------------------------
function crmProjets(){
  const out = [];
  Object.entries(mgtGet('clients')).forEach(([id, c]) => {
    const liees = new Set(crmTableau(c.projets).map(p => p && String(p.offerRef || '').trim()).filter(Boolean));
    const indexLies = new Set(crmTableau(c.projets).map(p => (p && p.offreId !== undefined && p.offreId !== null && p.offreId !== '') ? Number(p.offreId) : -1));
    crmOffres(c).forEach((o, i) => {
      if(liees.has(String(o.offerId || '').trim()) && o.offerId) return;
      const ri = crmTableau(c.offres).indexOf(o);
      if(indexLies.has(ri)) return;
      if(crmOffreMontant(o) > CRM_SEUIL_PROJET && !crmOffrePerdue(o) && crmOffreActive(o) !== false)
        out.push({cle:id + '|o|' + ri, clientId:id, c, origine:'auto', nom:(c.nom || 'Client') + ' - ' + (o.machine || o.type || 'Offre'), montant:crmOffreMontant(o), devise:o.devise || 'EUR', marque:o.marque || '', avancement:crmNombre(o.avancement), index:ri});
    });
    crmTableau(c.projets).forEach((p, i) => {
      if(p) out.push({cle:id + '|p|' + i, clientId:id, c, origine:'manuel', nom:p.nom || 'Projet', montant:crmNombre(p.montantHT), devise:'EUR', marque:'', avancement:crmNombre(p.avancement), index:i});
    });
  });
  out.forEach(p => { p.avancement = Math.max(0, Math.min(200, p.avancement)); p.phase = p.avancement >= 200 ? 'fini' : p.avancement >= 100 ? 'apres' : 'avant'; });
  return out;
}

// ------------------------------------------------------------
// Chiffre d'affaires (factures enregistrées dans les fiches clients)
// ------------------------------------------------------------
function crmToutesFactures(){
  const out = [];
  Object.entries(mgtGet('clients')).forEach(([id, c]) => crmFactures(c).forEach((f, i) => out.push(Object.assign({}, f, {clientId:id, nomClient:c.nom || '—', index:i}))));
  return out;
}
function crmSommeParDevise(list, getMontant, getDevise){
  const m = {};
  list.forEach(x => { const d = getDevise(x) || 'EUR'; m[d] = (m[d] || 0) + getMontant(x); });
  const t = Object.entries(m).filter(([, v]) => v);
  return t.length ? t.map(([d, v]) => crmMontant(v, d === 'EUR' ? '€' : d)).join(' · ') : '0';
}

// ------------------------------------------------------------
// Machines du CRM → parc
// ------------------------------------------------------------
function crmMarqueDe(txt){
  const t = crmNorm(txt);
  return t.includes('morgan') ? 'Morgan Tecnica' : t.includes('macpi') ? 'Macpi' : t.includes('lotus') ? 'Lotus' : 'Autre';
}
if(typeof MGT_MARQUES !== 'undefined' && MGT_MARQUES.indexOf('Lotus') < 0) MGT_MARQUES.splice(MGT_MARQUES.length - 1, 0, 'Lotus');

// ------------------------------------------------------------
// Import / export d'une sauvegarde du CRM (JSON « version 3 »)
// ------------------------------------------------------------
// Les PDF et photos joints (data:…base64) ne sont pas copiés dans la base partagée :
// ils la rendraient très lente et dépasseraient vite le quota gratuit.
function crmAllegerPiecesJointes(x){
  const o = Object.assign({}, x);
  ['pdfData', 'photoData'].forEach(k => { if(o[k] && String(o[k]).length > 2000){ o[k] = ''; o[k === 'pdfData' ? 'pdfOmis' : 'photoOmise'] = true; } });
  return o;
}
function crmConvertirClient(src){
  const g = (k) => { const v = src[k]; return v == null ? '' : String(v).trim(); };
  const id = 'crm' + String(g('ID') || crmNouvelId('x')).replace(/[.#$\[\]\/\s]/g, '_');
  const statut = crmNorm(g('Statut commercial'));
  const rec = {
    nom:g('Societe') || 'Sans nom', type:'prospect',
    ville:g('Ville / Delegation'), region:g('Gouvernorat / Zone'), activite:g('Activite'), typeClient:g('Type client'), groupe:g('Groupe client'),
    importance:g('Importance'), priorite:g('Priorite action'), effectif:g('Effectif'), statutCommercial:g('Statut commercial'), zone:g('Zone'),
    tel:g('Telephone(s)'), email:g('Email(s)'), contactPrincipal:g('Responsable / Contact'), notes:g('Notes'), adresse:'',
    frequenceVisite:String(src.VisitFrequency || src.FrequenceVisite || 'auto'),
    contacts:crmTableau(src.Contacts).filter(x => x && (x.name || x.position || x.email || x.mobile)).map(x => ({nom:x.name || '', fonction:x.position || '', tel:x.mobile || '', email:x.email || '', cle:!!x.key})),
    visites:crmTableau(src.Visites).filter(x => x && (x.date || x.note)).map(x => ({date:crmISO(x.date) || x.date || '', note:x.note || ''})),
    offres:crmTableau(src.Offres).filter(x => x && typeof x === 'object').map(x => crmAllegerPiecesJointes(x)),
    planning:crmTableau(src.Planning).filter(x => x && typeof x === 'object').map(x => crmAllegerPiecesJointes(Object.assign({id:crmNouvelId('e')}, x))),
    factures:crmTableau(src.Factures).filter(x => x && typeof x === 'object').map(x => Object.assign({}, x)),
    projets:crmTableau(src.Projets).filter(x => x && typeof x === 'object').map(x => Object.assign({}, x)),
    importeLe:getTodayISO()
  };
  const dv = g('Derniere visite/contact');
  if(dv && !rec.visites.length && crmDate(dv)) rec.visites.push({date:crmISO(dv), note:g('Note derniere visite')});
  const na = src.NextAction;
  if(na && typeof na === 'object' && (na.date || na.type || na.comment || na.responsible))
    rec.prochaineAction = {type:na.type || '', date:crmISO(na.date) || na.date || '', priority:na.priority || 'Moyenne', responsible:na.responsible || '', status:na.status || 'En attente', comment:na.comment || ''};
  if(/^[A-D]/i.test(rec.importance) === false) rec.importance = '';
  // Le CRM n'a pas de case client/prospect : « client » = type client renseigné, client installé, machine ou facture.
  if(/^client/i.test(rec.typeClient) || statut.includes('client installe') || crmTableau(src.Machines).length || rec.factures.length) rec.type = 'client';
  if(!rec.contacts.length && rec.contactPrincipal) rec.contacts.push({nom:rec.contactPrincipal, fonction:'', tel:'', email:'', cle:true});
  const machines = crmTableau(src.Machines).filter(m => m && (m.commercial || m.model || m.serial)).map((m, i) => ({
    cle:'mcrm' + id.slice(3) + '_' + i, v:{clientId:id, marque:crmMarqueDe(m.commercial + ' ' + m.model), modele:m.model || m.commercial || '', serie:m.serial || '', dateInstallation:m.year ? String(m.year).replace(/\D/g, '').slice(0, 4) + '-01-01' : '', finGarantie:'', statut:'service', notes:(m.commercial && m.commercial !== m.model) ? 'Nom commercial : ' + m.commercial : ''}
  }));
  return {id, rec, machines};
}
// Retourne {clients, machines, nouveaux, misAJour}. Ne touche pas aux fiches créées dans GTM.
function crmImporter(data){
  const liste = Array.isArray(data) ? data : crmTableau(data && data.clients);
  if(!liste.length) throw new Error('Aucun client dans ce fichier');
  const avant = mgtGet('clients'), clients = JSON.parse(JSON.stringify(avant)), machines = JSON.parse(JSON.stringify(mgtGet('machines')));
  let nouveaux = 0, misAJour = 0, nbMachines = 0;
  liste.forEach(src => {
    if(!src || typeof src !== 'object' || src._deleted_at) return;
    const {id, rec, machines:ms} = crmConvertirClient(src);
    if(clients[id]){ misAJour++; rec.notes = rec.notes || clients[id].notes; } else nouveaux++;
    clients[id] = rec;
    Object.keys(machines).forEach(k => { if(machines[k].clientId === id && k.indexOf('mcrm') === 0) delete machines[k]; });
    ms.forEach(m => { machines[m.cle] = m.v; nbMachines++; });
  });
  mgtSet('clients', clients); mgtSet('machines', machines);
  return {clients:liste.length, nouveaux, misAJour, machines:nbMachines};
}
function crmExporterJSON(){
  const parc = mgtGet('machines'), clients = Object.entries(mgtGet('clients')).map(([id, c]) => Object.assign({id}, c, {machines:Object.values(parc).filter(m => m.clientId === id)}));
  return JSON.stringify({app:'GTM - MGT clients', version:1, exportedAt:new Date().toISOString(), clients}, null, 1);
}
window.crmChoisirFichier = () => { const e = document.getElementById('crm-fichier'); if(e) e.click(); };
window.crmLireFichier = (input) => {
  const f = input.files && input.files[0]; if(!f) return;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const r = crmImporter(JSON.parse(lecteur.result));
      showToast('Import terminé : ' + r.nouveaux + ' nouveaux clients, ' + r.misAJour + ' mis à jour, ' + r.machines + ' machines');
      nav('mgt-clients');
    } catch(e) { showToast('Import impossible : ' + e.message); }
    input.value = '';
  };
  lecteur.readAsText(f);
};
window.crmAfficherExport = () => {
  mgtModal('Sauvegarde des clients', `<p style="font-size:12.5px;color:var(--ink-soft);margin-top:0;">Le téléchargement direct n'est pas disponible dans toutes les fenêtres. Copiez le contenu ci-dessous dans un fichier .json pour le conserver.</p>
    <textarea id="crm-export" rows="10" class="mgt-in" readonly style="font-family:var(--mono);font-size:11px;">${esc(crmExporterJSON())}</textarea>
    <button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="crmCopierExport()">Copier tout</button>`);
};
window.crmCopierExport = () => {
  const t = document.getElementById('crm-export'); if(!t) return;
  t.select();
  try { navigator.clipboard.writeText(t.value).then(() => showToast('Copié')); } catch(e) { document.execCommand('copy'); showToast('Copié'); }
};

// ------------------------------------------------------------
// Navigation et routage MGT
// ------------------------------------------------------------
window.mgtNavItems = function(){
  return [
    {tab:'mgt-dashboard', label:'Pilotage', icon:ICONS.dashboard, show:true},
    {tab:'mgt-clients', label:'Clients', icon:ICONS.team, show:true},
    {tab:'mgt-agenda', label:'Planning', icon:ICONS.calendarCheck, show:true},
    {tab:'mgt-offres', label:'Ventes', icon:ICONS.target, show:true},
    {tab:'mgt-sav', label:'SAV', icon:ICONS.wrench, show:true},
    {tab:'fact-liste', label:'Factures', icon:ICONS.invoice, show:true},
    {tab:'mgt-parametres', label:'Params', icon:ICONS.params, show:currentUser.role === 'admin'}
  ].filter(i => i.show);
};
MGT_GROUPES.ventes = {racine:'mgt-offres', onglets:[['mgt-offres', 'Offres'], ['mgt-projets', 'Projets'], ['mgt-devis', 'Devis'], ['mgt-ca', 'CA']]};
Object.assign(MGT_PARENT, {'mgt-offres':'mgt-offres', 'mgt-projets':'mgt-offres', 'mgt-devis':'mgt-offres', 'mgt-devis-edit':'mgt-offres', 'mgt-ca':'mgt-offres'});
window.renderMgt = function(tab, main){
  const rendus = {'mgt-dashboard':renderMgtDashboard, 'mgt-clients':renderMgtClients, 'mgt-fiche':renderMgtFiche, 'mgt-agenda':renderMgtAgenda,
    'mgt-offres':renderMgtOffres, 'mgt-ca':renderMgtCA,
    'mgt-devis':renderMgtDevis, 'mgt-devis-edit':renderMgtDevisEdit, 'mgt-projets':renderMgtProjets, 'mgt-parc':renderMgtParc,
    'mgt-sav':renderSavTickets, 'mgt-ticket':renderSavTicket, 'mgt-pieces':renderSavPieces, 'mgt-contrats':renderSavContrats,
    'mgt-parametres':renderMgtParametres};
  (rendus[tab] || renderMgtDashboard)(main);
  const g = Object.values(MGT_GROUPES).find(x => x.onglets.some(o => o[0] === tab));
  if(g) main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets no-print">${g.onglets.map(([t, l]) => `<button class="${t === tab ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
};
// Paramètres : ajoute l'import / l'export des clients.
const crmParametresOrigine = window.renderMgtParametres;
window.renderMgtParametres = function(main){
  crmParametresOrigine(main);
  main.insertAdjacentHTML('beforeend', `<div class="card"><h3 style="margin:0 0 6px;font-size:14px;">Base clients (CRM)</h3>
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Importez une sauvegarde JSON exportée du CRM MGT. Les clients déjà importés sont mis à jour, ceux créés ici ne sont pas touchés.</p>
    <input type="file" id="crm-fichier" accept=".json,application/json" style="display:none;" onchange="crmLireFichier(this)">
    <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="crmChoisirFichier()">Importer une sauvegarde</button><button class="btn btn-ghost" onclick="crmAfficherExport()">Exporter les clients</button></div></div>`);
};
