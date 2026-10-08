// ============================================================
// FACTURATION — commune aux trois sociétés (phase 3)
// ============================================================
// Chaque société a ses propres factures, rangées dans son dossier Firebase :
//  - TEK-TREND : factures, fact_clients, fact_params, fact_compteurs        (tek/)
//  - GADH      : gadh_factures, gadh_fact_clients, …                         (gadh/)
//  - MGT       : mgt_factures, mgt_fact_params, mgt_fact_compteurs           (mgt/, clients = mgt_clients)
//
// Facture : {type:'facture'|'avoir', numero, statut:'brouillon'|'emise', date, echeance, clientId,
//            client:{nom, adresse, mf} (copie figée à l'émission), objet, lignes:[{designation, qte, pu, remise}],
//            tva, timbre (montant du timbre fiscal, 0 si aucun), paiements:[{date, montant, mode, ref}],
//            relances:[date], origine:{type, id, du, au, etape}, factureLiee (avoir → facture), notes}
// Le numéro (FA-2026-001, AV-2026-001) n'est attribué qu'à l'émission, pour une
// numérotation continue sans trou. Une facture émise ne se supprime pas : on la
// corrige par un avoir.
//
// Factures préparées automatiquement :
//  - MGT : devis accepté, ticket SAV (main d'œuvre, déplacements, pièces), contrat de maintenance ;
//  - GADH → TEK-TREND : pièces retournées (étape « Retour TEK-TREND » du suivi) × prix par référence ;
//  - TEK-TREND → PERCKO : pièces expédiées (étape « Expédition » du suivi) × prix par référence.

const FACT_MODES = {virement:'Virement', cheque:'Chèque', especes:'Espèces', traite:'Traite', effet:'Effet'};
const FACT_STATUTS = {
  brouillon:{label:'Brouillon', cls:''},
  impayee:  {label:'À payer',   cls:'excellent'},
  partielle:{label:'Payée en partie', cls:'warn'},
  retard:   {label:'En retard', cls:'bad'},
  payee:    {label:'Payée',     cls:'good'},
  avoir:    {label:'Avoir',     cls:''}
};
const FACT_GENERATEUR = {
  tek:  {etape:'exp', client:'PERCKO', titre:'Facturer les expéditions PERCKO', aide:'Pièces expédiées (étape « Expédition » du suivi des commandes) sur la période.', objet:'Expéditions'},
  gadh: {etape:'ret', client:'TEK-TREND', titre:'Facturer l\'assemblage à TEK-TREND', aide:'Pièces retournées à TEK-TREND (étape « Retour TEK-TREND » du suivi des commandes) sur la période.', objet:'Assemblage de pièces'}
};

function factCle(soc, nom){ return (soc === 'tek' ? '' : soc + '_') + nom; }
function factSoc(){ return activeSociete || 'tek'; }
function factToutes(soc){ return getJSON(factCle(soc, 'factures'), {}) || {}; }
function factEnregistrer(soc, l){ setJSON(factCle(soc, 'factures'), l); }
function canAccessFactures(){ return !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'viewer'); }
function canEditFact(soc){ return soc === 'mgt' ? canEditMgt() : !!currentUser && currentUser.role === 'admin'; }

function factParams(soc){
  const def = {raison:SOCIETES[soc].nom, adresse:'', mf:'', tel:'', email:'', rib:'', tva:19, timbre:1, delai:30, mention:'', tauxHoraire:0, deplacement:0, prix:{}};
  const P = Object.assign(def, getJSON(factCle(soc, 'fact_params'), {}) || {});
  if(soc === 'mgt'){ const M = mgtParams(); ['raison', 'adresse', 'mf', 'tel', 'email', 'rib', 'tva'].forEach(k => { P[k] = M[k]; }); }
  return P;
}
// Clients facturés : ceux du CRM pour MGT ; une petite liste propre pour TEK-TREND et GADH.
function factClients(soc){
  if(soc === 'mgt'){
    const o = {};
    Object.entries(mgtGet('clients')).forEach(([id, c]) => { o[id] = {nom:c.nom, adresse:[c.adresse, c.ville].filter(Boolean).join(', '), mf:c.mf || '', email:c.email || ''}; });
    return o;
  }
  const l = getJSON(factCle(soc, 'fact_clients'), {}) || {};
  if(!Object.keys(l).length && FACT_GENERATEUR[soc]){
    l.defaut = {nom:FACT_GENERATEUR[soc].client, adresse:'', mf:'', email:''};
    if(canEditFact(soc)) setJSON(factCle(soc, 'fact_clients'), l);
  }
  return l;
}
function factNumero(soc, type, annee){
  const cle = factCle(soc, 'fact_compteurs'), c = getJSON(cle, {}) || {}, p = type === 'avoir' ? 'AV' : 'FA';
  const t = c[p] || {}; t[annee] = (t[annee] || 0) + 1; c[p] = t; setJSON(cle, c);
  return p + '-' + annee + '-' + String(t[annee]).padStart(3, '0');
}

// --- Montants et état ---
function factMontantLigne(l){ return (Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise) || 0) / 100); }
function factTotaux(f, toutes){
  const ht = (f.lignes || []).reduce((s, l) => s + factMontantLigne(l), 0);
  const tva = ht * (Number(f.tva) || 0) / 100, timbre = Number(f.timbre) || 0, ttc = ht + tva + timbre;
  const paye = (f.paiements || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
  let avoirs = 0;
  if(f.type !== 'avoir' && toutes) Object.values(toutes).forEach(a => { if(a.type === 'avoir' && a.statut === 'emise' && a.factureLiee === f._id) avoirs += factTotaux(a).ttc; });
  return {ht, tva, timbre, ttc, paye, avoirs, reste: f.type === 'avoir' ? 0 : Math.max(0, ttc - paye - avoirs)};
}
function factStatut(f, toutes){
  if(f.statut !== 'emise') return 'brouillon';
  if(f.type === 'avoir') return 'avoir';
  const t = factTotaux(f, toutes);
  if(t.reste < 0.0005) return 'payee';
  if(f.echeance && f.echeance < getTodayISO()) return 'retard';
  return t.paye > 0 ? 'partielle' : 'impayee';
}
// Ajoute _id à chaque facture (utile pour rattacher les avoirs).
function factListe(soc){ const l = factToutes(soc); Object.keys(l).forEach(id => { l[id]._id = id; }); return l; }
function factIndicateurs(soc){
  const l = factListe(soc), mois = getTodayISO().slice(0, 7);
  let aEncaisser = 0, impayees = 0, retard = 0, montantRetard = 0, caMois = 0;
  Object.values(l).forEach(f => {
    if(f.statut !== 'emise') return;
    if(f.date && f.date.slice(0, 7) === mois) caMois += factTotaux(f).ht * (f.type === 'avoir' ? -1 : 1);
    if(f.type === 'avoir') return;
    const t = factTotaux(f, l), st = factStatut(f, l);
    if(t.reste > 0.0005){ aEncaisser += t.reste; impayees++; }
    if(st === 'retard'){ retard++; montantRetard += t.reste; }
  });
  return {aEncaisser, impayees, retard, montantRetard, caMois};
}

// Montant en lettres : « mille deux cent trente-quatre dinars et cinq cents millimes ».
function factEnLettres(montant){
  const u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const d = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  const diz = (n) => {
    if(n < 20) return u[n];
    const t = Math.floor(n / 10), x = n % 10;
    if(t === 7 || t === 9) return d[t] + (t === 7 && x === 1 ? ' et ' : '-') + u[10 + x];
    if(x === 0) return d[t] + (t === 8 ? 's' : '');
    if(x === 1 && t < 8) return d[t] + ' et un';
    return d[t] + '-' + u[x];
  };
  const cent = (n) => {
    const c = Math.floor(n / 100), r = n % 100;
    let s = c ? (c > 1 ? u[c] + ' ' : '') + 'cent' + (c > 1 && !r ? 's' : '') : '';
    if(r) s += (s ? ' ' : '') + diz(r);
    return s;
  };
  const entier = (n) => {
    if(!n) return 'zéro';
    const mi = Math.floor(n / 1e6), k = Math.floor(n % 1e6 / 1000), r = n % 1000, p = [];
    if(mi) p.push(cent(mi) + ' million' + (mi > 1 ? 's' : ''));
    if(k) p.push(k === 1 ? 'mille' : cent(k).replace(/(cent|vingt)s$/, '$1') + ' mille');
    if(r) p.push(cent(r));
    return p.join(' ');
  };
  const tot = Math.round((Number(montant) || 0) * 1000), din = Math.floor(tot / 1000), mil = tot % 1000;
  let s = entier(din) + ' dinar' + (din > 1 ? 's' : '');
  if(mil) s += ' et ' + entier(mil) + ' millime' + (mil > 1 ? 's' : '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================
// NAVIGATION
// ============================================================
function factNavItems(){
  return [
    {tab:'fact-liste', label:'Factures', icon:ICONS.invoice, show:true},
    {tab:'fact-clients', label:'Clients', icon:ICONS.team, show:true},
    {tab:'fact-params', label:'Réglages', icon:ICONS.params, show:currentUser.role === 'admin'}
  ].filter(i => i.show);
}
// Bouton de navigation à allumer pour un écran secondaire.
function navParent(tab){
  if(typeof MGT_PARENT !== 'undefined' && MGT_PARENT[tab]) return MGT_PARENT[tab];
  if(tab === 'fact-edit' || (tab === 'fact-params' && activeModule === 'mgt')) return 'fact-liste';
  return null;
}
function renderFact(tab, main){
  ({'fact-liste':renderFactListe, 'fact-edit':renderFactEdit, 'fact-clients':renderFactClients, 'fact-params':renderFactParams})[tab](main);
}

// ============================================================
// LISTE DES FACTURES
// ============================================================
let factFiltre = 'tous', factId = null;
function factLigne(id, f, toutes, avecClient){
  const t = factTotaux(f, toutes), st = factStatut(f, toutes);
  return `<div class="session-row" style="cursor:pointer;" onclick="factOuvrir('${id}')">
    <div style="min-width:0;"><b style="font-size:13.5px;">${f.numero ? esc(f.numero) : (f.type === 'avoir' ? 'Avoir' : 'Facture') + ' (brouillon)'}</b> <span style="font-size:12px;color:var(--ink-soft);">${mgtDate(f.date)}</span>
      <div style="font-size:11.5px;color:var(--ink-soft);">${avecClient ? esc(factNomClient(factSoc(), f)) + ' · ' : ''}${esc(f.objet || '')}</div></div>
    <div style="text-align:right;"><div style="font-weight:700;font-size:13px;">${f.type === 'avoir' ? '− ' : ''}${fmtDT(t.ttc)}</div>
      ${mgtBadge(FACT_STATUTS[st])}${st === 'partielle' || st === 'retard' ? `<div style="font-size:11px;color:var(--ink-soft);">reste ${fmtDT(t.reste)}</div>` : ''}</div>
  </div>`;
}
function factNomClient(soc, f){
  if(f.statut === 'emise' && f.client) return f.client.nom;
  const c = factClients(soc)[f.clientId];
  return c ? c.nom : (f.client ? f.client.nom : '—');
}
function renderFactListe(main){
  const soc = factSoc(), ed = canEditFact(soc), l = factListe(soc), k = factIndicateurs(soc);
  const actions = (ed ? `<button class="btn btn-primary" onclick="factNouvelle()">+ Facture</button>` : '')
    + (ed && FACT_GENERATEUR[soc] ? `<button class="btn btn-ghost" onclick="factGenerer()">Depuis le suivi</button>` : '')
    + (soc === 'mgt' && currentUser.role === 'admin' ? `<button class="btn btn-ghost" onclick="nav('fact-params')">Réglages</button>` : '');
  const b = mgtSection(main, ICONS.invoice + ' Factures ' + SOCIETES[soc].nom, actions);
  const filtres = [['tous', 'Toutes'], ['apayer', 'À encaisser'], ['retard', 'En retard'], ['payee', 'Payées'], ['brouillon', 'Brouillons'], ['avoir', 'Avoirs']];
  const ok = (st) => factFiltre === 'tous' || factFiltre === st || (factFiltre === 'apayer' && ['impayee', 'partielle', 'retard'].indexOf(st) >= 0);
  const rows = Object.entries(l).filter(([, f]) => ok(factStatut(f, l)))
    .sort((a, c) => (c[1].statut === 'brouillon') - (a[1].statut === 'brouillon') || ((c[1].date || '') + (c[1].numero || '')).localeCompare((a[1].date || '') + (a[1].numero || '')));
  b.innerHTML = `
    <div class="kpi-mini-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:17px;font-weight:800;">${fmtDT(k.aEncaisser).replace(' DT', '')}</div><div style="font-size:10.5px;color:var(--ink-soft);">DT à encaisser</div></div>
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:17px;font-weight:800;" class="${k.retard ? 'hour-rend bad' : ''}">${k.retard}</div><div style="font-size:10.5px;color:var(--ink-soft);">en retard</div></div>
      <div class="kpi-mini"><div style="font-family:var(--mono);font-size:17px;font-weight:800;">${fmtDT(k.caMois).replace(' DT', '')}</div><div style="font-size:10.5px;color:var(--ink-soft);">DT HT facturés ce mois</div></div>
    </div>
    <div class="card" style="padding:10px 12px;display:flex;gap:6px;flex-wrap:wrap;">
      ${filtres.map(([f, lb]) => `<button class="btn ${factFiltre === f ? 'btn-primary' : 'btn-ghost'}" style="padding:6px 12px;font-size:12px;" onclick="factFiltre='${f}'; nav('fact-liste')">${lb}</button>`).join('')}
    </div>
    <div class="card" style="padding:4px 12px;">${rows.length ? rows.map(([id, f]) => factLigne(id, f, l, true)).join('') : buildEmptyState('Aucune facture')}</div>`;
}
window.factOuvrir = (id) => { factId = id; nav('fact-edit'); };

// Crée un brouillon et l'ouvre. data : champs de la facture (lignes, client, objet, origine…).
function factCreer(soc, data){
  const P = factParams(soc), today = getTodayISO(), l = factToutes(soc), id = mgtId('f');
  l[id] = Object.assign({type:'facture', numero:'', statut:'brouillon', date:today, echeance:mgtAddDays(today, Number(P.delai) || 0), clientId:'', objet:'',
    lignes:[{designation:'', qte:1, pu:0, remise:0}], tva:Number(P.tva) || 0, timbre:Number(P.timbre) || 0, paiements:[], relances:[], notes:P.mention || ''}, data);
  factEnregistrer(soc, l);
  return id;
}
window.factNouvelle = () => {
  const soc = factSoc(), cl = Object.keys(factClients(soc));
  if(!cl.length){ showToast('Ajoutez d\'abord un client'); return; }
  factOuvrir(factCreer(soc, {clientId:cl.length === 1 ? cl[0] : ''}));
};

// ============================================================
// FACTURE : ÉDITION, ÉMISSION, PAIEMENTS
// ============================================================
function renderFactEdit(main){
  const soc = factSoc(), toutes = factListe(soc), f = toutes[factId];
  if(!f){ nav('fact-liste'); return; }
  const id = factId, edDroit = canEditFact(soc), ed = edDroit && f.statut === 'brouillon', dis = ed ? '' : 'disabled';
  const t = factTotaux(f, toutes), st = factStatut(f, toutes), avoir = f.type === 'avoir';
  const titre = (avoir ? 'Avoir ' : 'Facture ') + (f.numero ? esc(f.numero) : '(brouillon)');
  const liee = f.factureLiee && toutes[f.factureLiee];
  const avoirs = Object.entries(toutes).filter(([, a]) => a.type === 'avoir' && a.factureLiee === id);
  const b = mgtSection(main, `<span style="cursor:pointer;" onclick="nav('fact-liste')">‹</span> ${titre}`, `<button class="btn btn-ghost" onclick="factImprimer('${id}')">Imprimer / PDF</button>`);
  b.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">${mgtBadge(FACT_STATUTS[st])}${f.origine ? mgtBadge({label:factOrigineLabel(f.origine), cls:''}) : ''}</div>
      ${liee ? `<div style="font-size:12.5px;margin-bottom:8px;">Avoir sur la facture <a href="#" onclick="factOuvrir('${f.factureLiee}'); return false;">${esc(liee.numero)}</a></div>` : ''}
      ${f.statut === 'emise' ? `<div style="font-size:13.5px;line-height:1.7;"><b>${esc(f.client.nom)}</b>${f.client.adresse ? '<br>' + esc(f.client.adresse) : ''}${f.client.mf ? '<br>MF ' + esc(f.client.mf) : ''}</div>`
        : mgtSelect('Client', 'fe-client', [['', '— Choisir —']].concat(Object.entries(factClients(soc)).map(([cid, c]) => [cid, c.nom])), f.clientId).replace('<select', `<select ${dis} onchange="factMaj('clientId', this.value)"`)}
      ${mgtChamp('Objet', 'fe-objet', f.objet, 'text', `${dis} onchange="factMaj('objet', this.value)"`)}
      <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Date', 'fe-date', f.date, 'date', `${dis} onchange="factMaj('date', this.value)"`)}</div>
        ${avoir ? '' : `<div style="flex:1;">${mgtChamp('Échéance', 'fe-echeance', f.echeance, 'date', `${edDroit ? '' : 'disabled'} onchange="factMaj('echeance', this.value)"`)}</div>`}</div>
    </div>
    <div class="card" style="padding:10px;">
      <h3 style="margin:0 0 8px;font-size:14px;">Lignes</h3>
      ${(f.lignes || []).map((l, i) => `<div class="mgt-ligne">
        <div style="display:flex;gap:6px;align-items:flex-start;">
          <textarea rows="2" class="mgt-in" placeholder="Désignation" ${dis} onchange="factMajLigne(${i}, 'designation', this.value)">${esc(l.designation)}</textarea>
          ${ed ? `<button class="icon-btn" title="Retirer la ligne" onclick="factRetirerLigne(${i})">✕</button>` : ''}
        </div>
        <div class="mgt-ligne-nums">
          <label>Qté<input class="mgt-in" type="number" min="0" step="any" value="${l.qte}" ${dis} onchange="factMajLigne(${i}, 'qte', this.value)"></label>
          <label>P.U. HT<input class="mgt-in" type="number" min="0" step="0.001" value="${l.pu}" ${dis} onchange="factMajLigne(${i}, 'pu', this.value)"></label>
          <label>Remise %<input class="mgt-in" type="number" min="0" max="100" step="0.5" value="${l.remise || 0}" ${dis} onchange="factMajLigne(${i}, 'remise', this.value)"></label>
          <div class="mgt-ligne-tot">${fmtDT(factMontantLigne(l))}</div>
        </div>
      </div>`).join('')}
      ${ed ? `<button class="btn btn-ghost" style="margin-top:8px;padding:6px 12px;font-size:12px;" onclick="factAjouterLigne()">+ Ligne</button>` : ''}
      <div style="margin-top:12px;font-size:14px;line-height:1.9;text-align:right;">
        <div>Total HT : <b>${fmtDT(t.ht)}</b></div>
        <div>TVA <input class="mgt-in" type="number" min="0" max="100" step="1" value="${f.tva}" ${dis} style="width:64px;display:inline-block;padding:4px 6px;" onchange="factMaj('tva', parseFloat(this.value)||0)"> % : <b>${fmtDT(t.tva)}</b></div>
        <div>Timbre fiscal <input class="mgt-in" type="number" min="0" step="0.001" value="${f.timbre}" ${dis} style="width:80px;display:inline-block;padding:4px 6px;" onchange="factMaj('timbre', parseFloat(this.value)||0)"> : <b>${fmtDT(t.timbre)}</b></div>
        <div style="font-size:16px;">Total TTC : <b>${fmtDT(t.ttc)}</b></div>
        <div style="font-size:11.5px;color:var(--ink-soft);">${factEnLettres(t.ttc)}</div>
      </div>
    </div>
    <div class="card">${mgtZone('Mentions (imprimées en bas de la facture)', 'fe-notes', f.notes).replace('<textarea', `<textarea ${dis} onchange="factMaj('notes', this.value)"`)}</div>
    ${f.statut === 'emise' && !avoir ? `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Paiements</h3>${edDroit && t.reste > 0.0005 ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="factFormPaiement('${id}')">+ Paiement</button>` : ''}</div>
      ${(f.paiements || []).length ? f.paiements.map((p, i) => `<div class="session-row"><div style="font-size:13px;"><b>${mgtDate(p.date)}</b> ${FACT_MODES[p.mode] || p.mode}${p.ref ? ' · ' + esc(p.ref) : ''}</div>
        <div style="display:flex;gap:6px;align-items:center;"><b style="font-family:var(--mono);">${fmtDT(p.montant)}</b>${edDroit ? `<button class="icon-btn" title="Retirer" onclick="factRetirerPaiement('${id}', ${i})">✕</button>` : ''}</div></div>`).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucun paiement</div>`}
      ${avoirs.length ? `<div style="font-size:12.5px;margin-top:6px;">Avoirs : ${avoirs.map(([aid, a]) => `<a href="#" onclick="factOuvrir('${aid}'); return false;">${a.numero ? esc(a.numero) : 'brouillon'}</a>`).join(', ')} (${fmtDT(t.avoirs)})</div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:8px;"><span>Reste à payer</span><b>${fmtDT(t.reste)}</b></div>
      ${(f.relances || []).length ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:4px;">Relancée le ${f.relances.map(mgtDate).join(', ')}</div>` : ''}
    </div>` : ''}
    ${edDroit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${f.statut === 'brouillon' ? `<button class="btn btn-primary" style="flex:1 1 100%;" onclick="factEmettre('${id}')">Émettre ${avoir ? 'l\'avoir' : 'la facture'}</button>
        <button class="btn btn-ghost" style="flex:1;color:var(--bad);" onclick="factSupprimer('${id}')">Supprimer le brouillon</button>` : ''}
      ${f.statut === 'emise' && !avoir ? `<button class="btn btn-ghost" style="flex:1;" onclick="factCreerAvoir('${id}')">Créer un avoir</button>` : ''}
      ${st === 'retard' ? `<button class="btn btn-ghost" style="flex:1;" onclick="factRelancer('${id}')">Lettre de relance</button>` : ''}
    </div>` : ''}`;
}
function factOrigineLabel(o){
  if(o.type === 'devis') return 'Devis ' + (o.label || '');
  if(o.type === 'ticket') return 'SAV ' + (o.label || '');
  if(o.type === 'contrat') return 'Contrat de maintenance';
  if(o.type === 'suivi') return 'Suivi du ' + mgtDate(o.du) + ' au ' + mgtDate(o.au);
  return '';
}
function factModifier(fn, redessiner){
  const soc = factSoc(), l = factToutes(soc), f = l[factId]; if(!f) return;
  fn(f); factEnregistrer(soc, l);
  if(redessiner !== false) nav('fact-edit');
}
window.factMaj = (champ, v) => factModifier(f => { f[champ] = v; }, champ !== 'objet' && champ !== 'notes');
window.factMajLigne = (i, champ, v) => factModifier(f => { f.lignes[i][champ] = champ === 'designation' ? v : (parseFloat(v) || 0); }, champ !== 'designation');
window.factAjouterLigne = () => factModifier(f => { f.lignes.push({designation:'', qte:1, pu:0, remise:0}); });
window.factRetirerLigne = (i) => factModifier(f => { f.lignes.splice(i, 1); });
window.factEmettre = (id) => {
  const soc = factSoc(), l = factToutes(soc), f = l[id]; if(!f) return;
  const c = factClients(soc)[f.clientId];
  if(!c){ showToast('Choisissez le client'); return; }
  if(!(f.lignes || []).some(x => x.designation && factMontantLigne(x) > 0)){ showToast('Ajoutez au moins une ligne chiffrée'); return; }
  if(!confirm('Émettre ' + (f.type === 'avoir' ? 'cet avoir' : 'cette facture') + ' ? Elle recevra son numéro définitif et ne sera plus modifiable.')) return;
  f.client = {nom:c.nom, adresse:c.adresse || '', mf:c.mf || ''};
  f.numero = factNumero(soc, f.type, (f.date || getTodayISO()).slice(0, 4));
  f.statut = 'emise';
  factEnregistrer(soc, l); showToast((f.type === 'avoir' ? 'Avoir ' : 'Facture ') + f.numero + ' émis' + (f.type === 'avoir' ? '' : 'e'));
  nav('fact-edit');
};
// Supprimer un brouillon libère le devis, ticket ou contrat d'origine.
window.factSupprimer = (id) => {
  const soc = factSoc(), l = factToutes(soc), f = l[id];
  if(!f || f.statut !== 'brouillon' || !confirm('Supprimer ce brouillon ?')) return;
  const o = f.origine, col = o && {devis:'devis', ticket:'tickets', contrat:'contrats'}[o.type];
  if(col){ const x = mgtGet(col); if(x[o.id] && x[o.id].factureId === id){ delete x[o.id].factureId; mgtSet(col, x); } }
  delete l[id]; factEnregistrer(soc, l); nav('fact-liste');
};
window.factCreerAvoir = (id) => {
  const soc = factSoc(), f = factToutes(soc)[id]; if(!f) return;
  const nid = factCreer(soc, {type:'avoir', clientId:f.clientId, factureLiee:id, objet:'Avoir sur facture ' + f.numero, lignes:JSON.parse(JSON.stringify(f.lignes || [])), tva:f.tva, timbre:0, notes:''});
  showToast('Avoir créé : ajustez les lignes puis émettez-le'); factOuvrir(nid);
};
window.factFormPaiement = (id) => {
  const soc = factSoc(), l = factListe(soc), t = factTotaux(l[id], l);
  mgtModal('Enregistrer un paiement', `
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Date', 'fp-date', getTodayISO(), 'date')}</div><div style="flex:1;">${mgtChamp('Montant (DT)', 'fp-montant', t.reste.toFixed(3), 'number', 'min="0" step="0.001"')}</div></div>
    ${mgtSelect('Mode', 'fp-mode', Object.entries(FACT_MODES), 'virement')}
    ${mgtChamp('Référence', 'fp-ref', '', 'text', 'placeholder="N° de chèque, de virement…"')}
    <button class="btn btn-primary" style="width:100%;" onclick="factSauverPaiement('${id}')">Enregistrer</button>`);
};
window.factSauverPaiement = (id) => {
  const montant = parseFloat(mgtVal('fp-montant'));
  if(!(montant > 0)){ showToast('Montant invalide'); return; }
  factId = id;
  factModifier(f => { f.paiements = f.paiements || []; f.paiements.push({date:mgtVal('fp-date') || getTodayISO(), montant, mode:mgtVal('fp-mode'), ref:mgtVal('fp-ref')}); f.paiements.sort((a, c) => a.date.localeCompare(c.date)); });
  mgtFermer(); showToast('Paiement enregistré');
};
window.factRetirerPaiement = (id, i) => { if(!confirm('Retirer ce paiement ?')) return; factId = id; factModifier(f => { f.paiements.splice(i, 1); }); };
window.factRelancer = (id) => {
  factId = id;
  factModifier(f => { f.relances = f.relances || []; if(f.relances.indexOf(getTodayISO()) < 0) f.relances.push(getTodayISO()); });
  factImprimer(id, true);
};

// Carte « Factures » de la fiche client MGT.
function factCarteClient(soc, clientId){
  if(!canAccessFactures() && soc !== 'mgt') return '';
  const l = factListe(soc), rows = Object.entries(l).filter(([, f]) => f.clientId === clientId).sort((a, c) => (c[1].date || '').localeCompare(a[1].date || ''));
  const reste = rows.reduce((s, [, f]) => s + (f.statut === 'emise' ? factTotaux(f, l).reste : 0), 0);
  return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;font-size:14px;">Factures</h3>${reste > 0.0005 ? `<span style="font-size:12.5px;">Reste dû : <b>${fmtDT(reste)}</b></span>` : ''}</div>
    ${rows.length ? rows.slice(0, 10).map(([fid, f]) => factLigne(fid, f, l, false)).join('') : `<div style="font-size:12px;color:var(--ink-faint);padding:8px 0;">Aucune facture</div>`}</div>`;
}

// ============================================================
// IMPRESSION (facture, avoir, lettre de relance)
// ============================================================
window.factImprimer = (id, relance) => {
  const soc = factSoc(), l = factListe(soc), f = l[id]; if(!f) return;
  const P = factParams(soc), t = factTotaux(f, l), avoir = f.type === 'avoir';
  const c = f.statut === 'emise' ? f.client : (factClients(soc)[f.clientId] || {nom:''});
  const n = (x) => (Number(x) || 0).toLocaleString('fr-FR', {minimumFractionDigits:3, maximumFractionDigits:3});
  const entete = `<div class="top"><div><h1>${esc(P.raison)}</h1><div>${esc(P.adresse).replace(/\n/g, '<br>')}</div><div>${P.tel ? 'Tél. ' + esc(P.tel) : ''}${P.email ? ' · ' + esc(P.email) : ''}</div>${P.mf ? `<div>MF ${esc(P.mf)}</div>` : ''}</div>`;
  const clientBox = `<div class="box" style="margin-left:auto;width:45%;"><b>${esc(c.nom || '')}</b>${c.adresse ? '<br>' + esc(c.adresse) : ''}${c.mf ? '<br>MF ' + esc(c.mf) : ''}</div>`;
  const style = `body{font:12px Arial,sans-serif;color:#111;margin:28px;} h1{font-size:20px;margin:0 0 4px;} .top{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px;}
    .box{border:1px solid #999;padding:10px;border-radius:4px;min-width:220px;} table{width:100%;border-collapse:collapse;margin-top:14px;} th,td{border:1px solid #999;padding:6px;vertical-align:top;}
    th{background:#eee;text-align:left;} td.n{text-align:right;white-space:nowrap;} .tot{width:300px;margin-left:auto;margin-top:12px;} .tot td{border:none;padding:3px 6px;} .tot tr:last-child td{font-weight:bold;font-size:14px;border-top:1px solid #111;}
    .lettres{margin-top:16px;} .cond{margin-top:18px;white-space:pre-line;} .pied{margin-top:30px;font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:6px;}
    .filigrane{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:90px;color:rgba(200,0,0,.12);transform:rotate(-25deg);pointer-events:none;} @media print{body{margin:12mm;}}`;
  let corps;
  if(relance){
    corps = `${entete}<div class="box">Le ${mgtDate(getTodayISO())}</div></div>${clientBox}
      <p style="margin-top:30px;"><b>Objet : relance pour la facture ${esc(f.numero)}</b></p>
      <p>Madame, Monsieur,</p>
      <p>Sauf erreur de notre part, la facture <b>${esc(f.numero)}</b> du ${mgtDate(f.date)}, d'un montant de <b>${n(t.ttc)} DT TTC</b>, arrivée à échéance le ${mgtDate(f.echeance)}, reste impayée${t.paye + t.avoirs > 0 ? ` pour un montant de <b>${n(t.reste)} DT</b>` : ''}.</p>
      <p>Nous vous remercions de bien vouloir procéder à son règlement dans les meilleurs délais${P.rib ? ` par virement sur notre compte RIB ${esc(P.rib)}` : ''}. Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce courrier.</p>
      <p>Veuillez agréer, Madame, Monsieur, nos salutations distinguées.</p>
      <p style="margin-top:40px;">${esc(P.raison)}</p>`;
  } else {
    corps = `${f.statut !== 'emise' ? '<div class="filigrane">BROUILLON</div>' : ''}${entete}
      <div class="box"><b>${avoir ? 'AVOIR' : 'FACTURE'} ${f.numero ? 'N° ' + esc(f.numero) : '(brouillon)'}</b><br>Date : ${mgtDate(f.date)}${!avoir && f.echeance ? '<br>Échéance : ' + mgtDate(f.echeance) : ''}${avoir && l[f.factureLiee] ? '<br>Sur facture ' + esc(l[f.factureLiee].numero) : ''}</div></div>
      ${clientBox}
      ${f.objet ? `<p style="margin-top:18px;"><b>Objet :</b> ${esc(f.objet)}</p>` : ''}
      <table><thead><tr><th>Désignation</th><th style="width:60px;">Qté</th><th style="width:100px;">P.U. HT</th><th style="width:55px;">Rem.</th><th style="width:110px;">Total HT</th></tr></thead><tbody>
        ${(f.lignes || []).map(x => `<tr><td>${esc(x.designation).replace(/\n/g, '<br>')}</td><td class="n">${x.qte}</td><td class="n">${n(x.pu)}</td><td class="n">${x.remise ? x.remise + ' %' : ''}</td><td class="n">${n(factMontantLigne(x))}</td></tr>`).join('')}
      </tbody></table>
      <table class="tot"><tr><td>Total HT</td><td class="n">${n(t.ht)} DT</td></tr><tr><td>TVA ${f.tva} %</td><td class="n">${n(t.tva)} DT</td></tr>
        ${t.timbre ? `<tr><td>Timbre fiscal</td><td class="n">${n(t.timbre)} DT</td></tr>` : ''}<tr><td>Total TTC</td><td class="n">${n(t.ttc)} DT</td></tr></table>
      <div class="lettres">${avoir ? 'Arrêté le présent avoir' : 'Arrêtée la présente facture'} à la somme de : <b>${factEnLettres(t.ttc)}</b>.</div>
      ${f.notes ? `<div class="cond">${esc(f.notes)}</div>` : ''}`;
  }
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(f.numero || 'Brouillon')}</title><style>${style}</style></head><body>
    ${corps}<div class="pied">${esc(P.raison)}${P.mf ? ' · MF ' + esc(P.mf) : ''}${P.rib ? ' · RIB ' + esc(P.rib) : ''}</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour imprimer'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

// ============================================================
// FACTURES PRÉPARÉES AUTOMATIQUEMENT
// ============================================================
// MGT : devis accepté.
window.factDepuisDevis = (devisId) => {
  const dl = mgtGet('devis'), d = dl[devisId]; if(!d) return;
  if(d.factureId){ factOuvrir(d.factureId); return; }
  const id = factCreer('mgt', {clientId:d.clientId, objet:(d.objet || 'Devis ' + d.numero), tva:d.tva,
    lignes:JSON.parse(JSON.stringify(d.lignes || [])), origine:{type:'devis', id:devisId, label:d.numero}});
  d.factureId = id; mgtSet('devis', dl);
  showToast('Facture préparée à partir du devis'); factOuvrir(id);
};
// MGT : ticket SAV (main d'œuvre, déplacements, pièces).
window.factDepuisTicket = (ticketId) => {
  const tl = mgtGet('tickets'), t = tl[ticketId]; if(!t) return;
  if(t.factureId){ factOuvrir(t.factureId); return; }
  const cv = savCouverture(t);
  if(cv !== 'payant' && !confirm((cv === 'garantie' ? 'La machine est sous garantie' : 'La machine est couverte par un contrat') + '. Facturer quand même ?')) return;
  const P = factParams('mgt'), c = savCout(t), pieces = mgtGet('pieces'), lignes = [];
  if(c.heures) lignes.push({designation:'Main d\'œuvre technicien — ' + savMachineLabel(t.machineId), qte:c.heures, pu:Number(P.tauxHoraire) || 0, remise:0});
  if(c.depl) lignes.push({designation:'Déplacement', qte:c.depl, pu:Number(P.deplacement) || 0, remise:0});
  Object.entries(c.parPiece).forEach(([pid, q]) => { const p = pieces[pid] || {}; if(q) lignes.push({designation:[p.ref, p.designation].filter(Boolean).join(' · ') || 'Pièce', qte:q, pu:Number(p.prix) || 0, remise:0}); });
  const data = {clientId:t.clientId, objet:'Intervention SAV ' + t.numero + (t.objet ? ' : ' + t.objet : ''), origine:{type:'ticket', id:ticketId, label:t.numero}};
  if(lignes.length) data.lignes = lignes;
  const id = factCreer('mgt', data);
  t.factureId = id; mgtSet('tickets', tl);
  showToast('Facture préparée à partir du ticket'); factOuvrir(id);
};
// MGT : contrat de maintenance.
window.factDepuisContrat = (contratId) => {
  const cl = mgtGet('contrats'), c = cl[contratId]; if(!c) return;
  if(c.factureId){ factOuvrir(c.factureId); return; }
  const n = (c.machineIds || []).length;
  const id = factCreer('mgt', {clientId:c.clientId, objet:'Contrat de maintenance du ' + mgtDate(c.debut) + ' au ' + mgtDate(c.fin),
    lignes:[{designation:'Contrat de maintenance ' + (n ? n + ' machine' + (n > 1 ? 's' : '') : 'du parc') + ', ' + (c.visitesAn || 0) + ' visite(s) préventive(s) par an\nDu ' + mgtDate(c.debut) + ' au ' + mgtDate(c.fin), qte:1, pu:Number(c.montant) || 0, remise:0}],
    origine:{type:'contrat', id:contratId}});
  c.factureId = id; mgtSet('contrats', cl);
  showToast('Facture préparée à partir du contrat'); factOuvrir(id);
};

// TEK-TREND → PERCKO et GADH → TEK-TREND : quantités du suivi des commandes × prix par référence.
function factPeriodeParDefaut(){
  const today = getTodayISO(), x = new Date(today + 'T00:00:00');
  if(x.getDate() <= 10){ // début de mois : on facture le mois précédent
    const debut = new Date(x.getFullYear(), x.getMonth() - 1, 1), fin = new Date(x.getFullYear(), x.getMonth(), 0);
    return {du:toISODateLocal(debut), au:toISODateLocal(fin)};
  }
  return {du:today.slice(0, 8) + '01', au:today};
}
function factPeriodesRapides(){
  const x = new Date(getTodayISO() + 'T00:00:00'), d = (y, m, j) => toISODateLocal(new Date(y, m, j));
  return [['Mois dernier', d(x.getFullYear(), x.getMonth() - 1, 1), d(x.getFullYear(), x.getMonth(), 0)], ['Ce mois-ci', d(x.getFullYear(), x.getMonth(), 1), getTodayISO()]];
}
window.factGenerer = () => {
  const soc = factSoc(), G = FACT_GENERATEUR[soc]; if(!G) return;
  const p = factPeriodeParDefaut(), cl = factClients(soc);
  const defaut = Object.keys(cl).find(k => (cl[k].nom || '').toUpperCase() === G.client) || Object.keys(cl)[0] || '';
  mgtModal(G.titre, `
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px;">${G.aide}</p>
    <div style="display:flex;gap:6px;margin-bottom:10px;">${factPeriodesRapides().map(([lb, du, au]) => `<button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" onclick="document.getElementById('fg-du').value='${du}'; document.getElementById('fg-au').value='${au}'; factGenCalculer()">${lb}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Du', 'fg-du', p.du, 'date', 'onchange="factGenCalculer()"')}</div><div style="flex:1;">${mgtChamp('Au', 'fg-au', p.au, 'date', 'onchange="factGenCalculer()"')}</div></div>
    ${mgtSelect('Client', 'fg-client', Object.entries(cl).map(([k, c]) => [k, c.nom]), defaut)}
    <div id="fg-table"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="factGenCreer()">Préparer la facture</button>`);
  factGenCalculer();
};
window.factGenCalculer = () => {
  const soc = factSoc(), G = FACT_GENERATEUR[soc], P = factParams(soc);
  const du = mgtVal('fg-du'), au = mgtVal('fg-au'), z = document.getElementById('fg-table');
  if(!du || !au || au < du){ z.innerHTML = '<div style="font-size:12.5px;color:var(--bad);">Période invalide</div>'; return; }
  const refs = suiviMouvementsParRef(G.etape, du, au), cles = Object.keys(refs).sort((a, c) => refs[a].lib.localeCompare(refs[c].lib));
  const deja = Object.values(factToutes(soc)).filter(f => f.type !== 'avoir' && f.origine && f.origine.type === 'suivi' && f.origine.du <= au && f.origine.au >= du);
  z.innerHTML = (deja.length ? `<div style="font-size:12.5px;color:var(--bad);margin-bottom:8px;">Attention : ${deja.map(f => f.numero || 'un brouillon').join(', ')} couvre déjà une partie de cette période.</div>` : '')
    + (cles.length ? `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:6px;">Prix unitaire HT par référence (mémorisé pour la prochaine fois) :</div>`
      + cles.map(k => `<div class="session-row fg-ref" data-cle="${esc(k)}" style="gap:8px;"><div style="min-width:0;flex:1;"><b style="font-size:13px;">${esc(refs[k].lib)}</b><div style="font-size:11.5px;color:var(--ink-soft);">${refs[k].qte} pièces</div></div>
        <input class="mgt-in" type="number" min="0" step="0.001" value="${(P.prix || {})[k] || ''}" placeholder="P.U." style="width:100px;"></div>`).join('')
      + `<div style="text-align:right;font-size:13px;margin-top:6px;">Total : <b>${cles.reduce((s, k) => s + refs[k].qte, 0)} pièces</b></div>`
      : buildEmptyState('Aucune pièce sur cette période'));
};
window.factGenCreer = () => {
  const soc = factSoc(), G = FACT_GENERATEUR[soc];
  const du = mgtVal('fg-du'), au = mgtVal('fg-au'), clientId = mgtVal('fg-client');
  if(!clientId){ showToast('Ajoutez d\'abord le client (onglet Clients)'); return; }
  const refs = suiviMouvementsParRef(G.etape, du, au), prix = {}, lignes = [];
  document.querySelectorAll('#fg-table .fg-ref').forEach(r => {
    const k = r.dataset.cle, pu = parseFloat(r.querySelector('input').value) || 0, x = refs[k]; if(!x) return;
    if(pu) prix[k] = pu;
    lignes.push({designation:x.lib + (x.model && x.lib.indexOf(x.model) < 0 ? ' (' + x.model + ')' : ''), qte:x.qte, pu, remise:0});
  });
  if(!lignes.length){ showToast('Aucune pièce à facturer sur cette période'); return; }
  if(lignes.some(l => !l.pu) && !confirm('Certaines références n\'ont pas de prix. Préparer la facture quand même ?')) return;
  // Mémorise les prix saisis.
  const cle = factCle(soc, 'fact_params'), stocke = getJSON(cle, {}) || {};
  stocke.prix = Object.assign(stocke.prix || {}, prix); setJSON(cle, stocke);
  const id = factCreer(soc, {clientId, objet:G.objet + ' du ' + mgtDate(du) + ' au ' + mgtDate(au), lignes, origine:{type:'suivi', etape:G.etape, du, au}});
  mgtFermer(); showToast('Facture préparée : vérifiez puis émettez-la'); factOuvrir(id);
};

// ============================================================
// CLIENTS (TEK-TREND et GADH) ET RÉGLAGES
// ============================================================
function renderFactClients(main){
  const soc = factSoc(), ed = canEditFact(soc), l = factClients(soc), toutes = factListe(soc);
  const b = mgtSection(main, ICONS.team + ' Clients facturés', ed ? `<button class="btn btn-primary" onclick="factFormClient()">+ Client</button>` : '');
  b.innerHTML = `<div class="card" style="padding:4px 12px;">${Object.keys(l).length ? Object.entries(l).sort((a, c) => a[1].nom.localeCompare(c[1].nom)).map(([id, c]) => {
    const reste = Object.values(toutes).reduce((s, f) => s + (f.clientId === id && f.statut === 'emise' ? factTotaux(f, toutes).reste : 0), 0);
    return `<div class="session-row" ${ed ? `style="cursor:pointer;" onclick="factFormClient('${id}')"` : ''}><div style="min-width:0;"><b style="font-size:13.5px;">${esc(c.nom)}</b>
      <div style="font-size:11.5px;color:var(--ink-soft);">${esc([c.adresse, c.mf ? 'MF ' + c.mf : ''].filter(Boolean).join(' · '))}</div></div>
      ${reste > 0.0005 ? `<div style="font-size:12.5px;">dû <b>${fmtDT(reste)}</b></div>` : ''}</div>`;
  }).join('') : buildEmptyState('Aucun client')}</div>`;
}
window.factFormClient = (id) => {
  const soc = factSoc(), c = id ? factClients(soc)[id] : {};
  mgtModal(id ? 'Modifier le client' : 'Nouveau client', `
    ${mgtChamp('Nom *', 'fc-nom', c.nom)}
    ${mgtZone('Adresse', 'fc-adresse', c.adresse)}
    ${mgtChamp('Matricule fiscal', 'fc-mf', c.mf)}
    ${mgtChamp('E-mail', 'fc-email', c.email, 'email')}
    <button class="btn btn-primary" style="width:100%;" onclick="factSauverClient('${id || ''}')">Enregistrer</button>
    ${id ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:var(--bad);" onclick="factSupprimerClient('${id}')">Supprimer</button>` : ''}`);
};
window.factSauverClient = (id) => {
  const soc = factSoc(), nom = mgtVal('fc-nom'); if(!nom){ showToast('Nom obligatoire'); return; }
  const cle = factCle(soc, 'fact_clients'), l = getJSON(cle, {}) || {}, nid = id || mgtId('k');
  l[nid] = {nom, adresse:mgtVal('fc-adresse'), mf:mgtVal('fc-mf'), email:mgtVal('fc-email')};
  setJSON(cle, l); mgtFermer(); showToast('Client enregistré'); nav('fact-clients');
};
window.factSupprimerClient = (id) => {
  const soc = factSoc();
  if(Object.values(factToutes(soc)).some(f => f.clientId === id)){ showToast('Ce client a des factures : il ne peut pas être supprimé'); return; }
  if(!confirm('Supprimer ce client ?')) return;
  const cle = factCle(soc, 'fact_clients'), l = getJSON(cle, {}) || {}; delete l[id]; setJSON(cle, l); mgtFermer(); nav('fact-clients');
};
function renderFactParams(main){
  const soc = factSoc(), P = factParams(soc), mgt = soc === 'mgt';
  const b = mgtSection(main, (mgt ? `<span style="cursor:pointer;" onclick="nav('fact-liste')">‹</span> ` : ICONS.params + ' ') + 'Réglages de facturation');
  const refs = !mgt && typeof suiviReferences === 'function' ? suiviReferences() : {};
  b.innerHTML = `<div class="card">
    ${mgt ? `<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px;">Les coordonnées de MGT et la TVA par défaut se règlent dans Params.</p>` : `
      <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px;">Coordonnées imprimées en tête des factures ${esc(SOCIETES[soc].nom)}.</p>
      ${mgtChamp('Raison sociale', 'fx-raison', P.raison)}
      ${mgtZone('Adresse', 'fx-adresse', P.adresse)}
      ${mgtChamp('Matricule fiscal', 'fx-mf', P.mf)}
      ${mgtChamp('Téléphone', 'fx-tel', P.tel)}${mgtChamp('E-mail', 'fx-email', P.email)}
      ${mgtChamp('RIB', 'fx-rib', P.rib)}
      ${mgtChamp('TVA par défaut (%)', 'fx-tva', P.tva, 'number')}`}
    <div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Timbre fiscal (DT)', 'fx-timbre', P.timbre, 'number', 'step="0.001" min="0"')}</div><div style="flex:1;">${mgtChamp('Délai de paiement (jours)', 'fx-delai', P.delai, 'number', 'min="0"')}</div></div>
    ${mgt ? `<div style="display:flex;gap:8px;"><div style="flex:1;">${mgtChamp('Taux horaire technicien (DT HT)', 'fx-taux', P.tauxHoraire, 'number', 'step="0.001" min="0"')}</div><div style="flex:1;">${mgtChamp('Forfait déplacement (DT HT)', 'fx-depl', P.deplacement, 'number', 'step="0.001" min="0"')}</div></div>` : ''}
    ${mgtZone('Mentions par défaut (bas de facture)', 'fx-mention', P.mention)}
    <button class="btn btn-primary" style="width:100%;" onclick="factSauverParams()">Enregistrer</button>
  </div>
  ${!mgt && Object.keys(refs).length ? `<div class="card"><h3 style="margin:0 0 4px;font-size:14px;">Prix par référence (HT)</h3>
    <p style="font-size:12px;color:var(--ink-soft);margin:0 0 8px;">Utilisés pour préparer les factures depuis le suivi des commandes.</p>
    ${Object.keys(refs).sort((a, c) => refs[a].lib.localeCompare(refs[c].lib)).map(k => `<div class="session-row fx-prix" data-cle="${esc(k)}"><div style="font-size:13px;min-width:0;flex:1;">${esc(refs[k].lib)}</div>
      <input class="mgt-in" type="number" min="0" step="0.001" value="${(P.prix || {})[k] || ''}" style="width:100px;"></div>`).join('')}</div>` : ''}`;
}
window.factSauverParams = () => {
  const soc = factSoc(), cle = factCle(soc, 'fact_params'), s = getJSON(cle, {}) || {};
  if(soc !== 'mgt') Object.assign(s, {raison:mgtVal('fx-raison') || SOCIETES[soc].nom, adresse:mgtVal('fx-adresse'), mf:mgtVal('fx-mf'), tel:mgtVal('fx-tel'), email:mgtVal('fx-email'), rib:mgtVal('fx-rib'), tva:parseFloat(mgtVal('fx-tva')) || 0});
  Object.assign(s, {timbre:parseFloat(mgtVal('fx-timbre')) || 0, delai:parseInt(mgtVal('fx-delai')) || 0, mention:mgtVal('fx-mention')});
  if(soc === 'mgt') Object.assign(s, {tauxHoraire:parseFloat(mgtVal('fx-taux')) || 0, deplacement:parseFloat(mgtVal('fx-depl')) || 0});
  const prix = Object.assign({}, s.prix || {});
  document.querySelectorAll('.fx-prix').forEach(r => { const v = parseFloat(r.querySelector('input').value); if(v > 0) prix[r.dataset.cle] = v; else delete prix[r.dataset.cle]; });
  s.prix = prix;
  setJSON(cle, s); showToast('Réglages enregistrés');
};
