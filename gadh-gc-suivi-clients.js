// ============================================================
// CRM GADH — SUIVI CLIENT : offre → commande ferme (livraisons proposées par le client)
// → planning des livraisons → chaque livraison avec sa facture → suivi des paiements.
// Chargé après gadh-gc-listes-prix.js.
// Données : commandes clients (gadh_gc_cmd_clients) dont chaque ligne est une livraison
// proposée (dateLivraison, dateDeclaration, declaration, refClient, note) ; factures
// (gadh_factures : numero, paiement, echeance, cmdId, po) ; offres (grilles de prix).
// ============================================================

// ---------- Outils : semaines ----------
function gcsfDate(d){ const p = String(d || '').split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
function gcsfISO(dt){ return dt.toISOString().slice(0, 10); }
function gcsfLundi(d){ const dt = gcsfDate(d), j = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - j); return gcsfISO(dt); }
function gcsfSemaine(d){
  if(!d) return null;
  const dt = gcsfDate(d), j = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - j + 3);
  const an = dt.getUTCFullYear(), p = new Date(Date.UTC(an, 0, 4)), num = 1 + Math.round(((dt - p) / 864e5 - 3 + ((p.getUTCDay() + 6) % 7)) / 7);
  return {num, an};
}
function gcsfLibSemaine(d, court){
  if(!d) return '—';
  const s = gcsfSemaine(d), l = gcsfLundi(d), sa = GC.ajouterJours(l, 5);
  return 'S' + String(s.num).padStart(2, '0') + (court ? '' : ' · ' + gcDt(l).slice(0, 5) + ' → ' + gcDt(sa).slice(0, 5) + (s.an !== +getTodayISO().slice(0, 4) ? '/' + String(s.an).slice(2) : ''));
}
function gcsfJours(c){ const m = /(\d+)/.exec(String((c || {}).conditions || '')); return m ? Number(m[1]) : 30; }

// ---------- Factures (une par livraison) ----------
// GTM (20/11/2026) : la Facturation est partagée avec TEK-TREND ; les statuts et la création de facture du CRM GADH ne
// s'appliquent qu'aux factures GADH (champ « paiement », ou société active GADH). Le reste passe à la Facturation d'origine.
Object.assign(FACT_STATUTS, {non_payee:{label:'Non payée', cls:'bad'}, en_cours:{label:'Paiement en cours', cls:'warn'}});
const gcsfFactStatutGtm = factStatut;
factStatut = function(f, toutes){ if(!(f && (f.paiement || (typeof activeSociete !== 'undefined' && activeSociete === 'gadh' && f.statut !== 'emise')))) return gcsfFactStatutGtm(f, toutes);
  return f && f.paiement ? f.paiement : (f && f.statut === 'brouillon' && !f.numero ? 'brouillon' : 'non_payee'); };
function gcsfFactures(){ return Object.values(factListe() || {}).filter(f => f && !f.annulee); }
function gcsfNumeroFacture(date){
  const yy = String(date || getTodayISO()).slice(2, 4), pre = 'FA0' + yy + '-';
  let max = 0; gcsfFactures().forEach(f => { const m = new RegExp('^' + pre + '(\\d+)$').exec(f.numero || ''); if(m) max = Math.max(max, +m[1]); });
  const R = gcReglages(); if(R.dernierNumeroFacture && String(R.dernierNumeroFacture).indexOf(pre) === 0) max = Math.max(max, +String(R.dernierNumeroFacture).slice(pre.length) || 0);
  return pre + String(max + 1).padStart(3, '0');
}
// Facture créée depuis la Facturation (module d'origine) : numéro attribué, non payée. GTM : GADH seulement.
const gcsfFactCreerGtm = factCreer;
factCreer = function(soc, d){
  if(soc && soc !== 'gadh') return gcsfFactCreerGtm(soc, d);
  const toutes = Object.assign({}, factListe()), id = d.id || mgtId('fa'), date = d.date || getTodayISO(), c = gcClients()[d.clientId] || {};
  toutes[id] = Object.assign({id, numero:d.numero || gcsfNumeroFacture(date), date, paiement:'non_payee', echeance:GC.ajouterJours(date, gcsfJours(c)), cree:{ts:Date.now(), par:gcPar()}}, d);
  setJSON('gadh_factures', toutes); gcCacheD = null; return id;
};
function gcsfSauverFacture(f){ const t = Object.assign({}, factListe()); t[f.id] = f; setJSON('gadh_factures', t); gcCacheD = null; }
function gcsfFactureDuBL(bl){ return bl && bl.factureId ? (factListe() || {})[bl.factureId] || null : null; }
function gcsfEcartFacture(f){
  // montant facturé ≠ montant des livraisons au prix de la commande
  const D = gcD(), ids = GC.liste((f.origine || {}).ids), bls = D.livraisons.filter(b => ids.indexOf(b.id) >= 0 && !b.annulee);
  if(!bls.length) return 0;
  return GC.r2(factTotaux(f).ht - bls.reduce((s, b) => s + GC.coutLivraison(b).ca, 0));
}

// ---------- Planning : une ligne par livraison proposée ----------
const GCSF_STATUTS = {
  livree:{label:'Livrée et facturée', cls:'good', ordre:5}, livree_sans:{label:'Livrée (sans facture)', cls:'warn', ordre:4},
  retard:{label:'En retard', cls:'bad', ordre:0}, declaree:{label:'Déclaration reçue · à livrer', cls:'warn', ordre:1},
  attente:{label:'Déclaration attendue', cls:'warn', ordre:2}, partielle:{label:'Livrée en partie', cls:'warn', ordre:1}, prevue:{label:'Prévue', cls:'', ordre:3}
};
function gcsfLignesPlanning(D){
  D = D || gcD();
  const liv = GC.livres(D), auj = getTodayISO(), out = [];
  D.cmdC.forEach(c => {
    if(c.archive || c.statut === 'brouillon' || c.statut === 'annulee') return;
    GC.liste(c.lignes).forEach((l, i) => {
      if(!(GC.num(l.qte) > 0)) return;
      const k = GC.cleLigne(c.id, l.lid), livre = Math.min(GC.num(l.qte), liv[k] || 0), reste = GC.rq(GC.num(l.qte) - livre);
      const bls = D.livraisons.filter(b => b.cmdId === c.id && !b.annulee && GC.liste(b.lignes).some(x => x.lid === l.lid && GC.qteNetteLigne(x) > 0));
      const facts = bls.map(gcsfFactureDuBL).filter(Boolean);
      const dl = l.dateLivraison || c.dateSouhaitee || '', dd = l.dateDeclaration || '';
      let st;
      if(reste <= 0.0005) st = bls.length && bls.every(b => b.factureId) ? 'livree' : 'livree_sans';
      else if(c.statut === 'cloturee') return;
      else if(dl && GC.ajouterJours(gcsfLundi(dl), 6) < auj) st = 'retard';
      else if(livre > 0) st = 'partielle';
      else if(l.declaration) st = 'declaree';
      else if(dd && dd <= auj) st = 'attente';
      else st = 'prevue';
      out.push({id:k, cmd:c, l, n:i + 1, livre, reste, bls, facts, dateLivraison:dl, dateDeclaration:dd, statut:st, client:gcNomClient(c.clientId), po:c.reference || c.numero || ''});
    });
  });
  return out;
}
function gcsfBadge(x){ return gcBadge(GCSF_STATUTS[x.statut]); }
function gcsfQ(n, u){ return gcQ(n) + (u ? ' ' + esc(u) : ''); }

window.renderGcPlanning = function(main){
  const D = gcD(), ed = gcPeut(), L = gcsfLignesPlanning(D), auj = getTodayISO(), an = auj.slice(0, 4);
  const b = gcSection(main, 'Planning des livraisons', (ed ? `<button class="btn btn-primary" data-gc="nouvelle-commande-ferme" onclick="gcsfFormCommande()">+ Commande ferme</button>` : '') + gcBoutonsExport('planning'));
  const ouvertes = L.filter(x => x.reste > 0), dans = (j) => ouvertes.filter(x => x.dateLivraison && x.dateLivraison <= GC.ajouterJours(auj, j));
  const retard = ouvertes.filter(x => x.statut === 'retard'), u = (D.articles.find(a => a.id === (ouvertes[0] || {l:{}}).l.articleId) || {}).unite || '';
  const livreAn = L.reduce((s, x) => s + x.bls.filter(bl => (bl.date || '').slice(0, 4) === an).reduce((t, bl) => t + GC.liste(bl.lignes).filter(y => y.lid === x.l.lid).reduce((v, y) => v + GC.qteNetteLigne(y), 0), 0), 0);
  const clients = Array.from(new Set(L.map(x => x.cmd.clientId))), pos = Array.from(new Set(L.map(x => x.po))).sort().reverse();
  b.innerHTML = `<div class="gc-chiffres gcsf-kpi">
      <div class="gc-chiffre ${retard.length ? 'bad' : ''}"><span>En retard</span><b>${retard.length}</b></div>
      <div class="gc-chiffre ${dans(14).length ? 'warn' : ''}"><span>À livrer sous 2 semaines</span><b>${dans(14).length}</b></div>
      <div class="gc-chiffre"><span>Reste à livrer (commandes en cours)</span><b>${gcsfQ(ouvertes.reduce((s, x) => s + x.reste, 0), u)}</b></div>
      <div class="gc-chiffre good"><span>Livré en ${an}</span><b>${gcsfQ(livreAn, u)}</b></div></div>
    <div class="gc-sous" style="margin-bottom:8px;">Une ligne = une livraison proposée par le client sur sa commande ferme. Quand le client envoie sa déclaration, cliquez « Déclaration reçue » ; le jour de la livraison, « Livrer et facturer » crée le bon de livraison et sa facture.</div>`
  + gcTable({id:'planning', lignes:() => gcsfLignesPlanning(), tri:4, sens:1, parPage:50, placeholder:'Rechercher un PO, un client, une facture…',
    texte:x => [x.po, x.cmd.numero, x.client, x.l.designation, x.l.refClient, x.l.note].concat(x.bls.map(b => b.numero), x.facts.map(f => f.numero)).join(' '),
    filtres:[
      {id:'etat', label:'État', defaut:'ouvertes', options:[['ouvertes', 'À livrer'], ['retard', 'En retard'], ['livrees', 'Livrées'], ['', 'Toutes les livraisons']], test:(x, v) => v === 'ouvertes' ? x.reste > 0 : v === 'retard' ? x.statut === 'retard' : x.reste <= 0},
      {id:'client', label:'Client', options:[['', 'Client : tous']].concat(clients.map(id => [id, 'Client : ' + gcNomClient(id)])), test:(x, v) => x.cmd.clientId === v},
      {id:'po', label:'Commande', options:[['', 'Commande : toutes']].concat(pos.map(p => [p, 'PO ' + p])), test:(x, v) => x.po === v},
      {id:'an', label:'Année', options:[['', 'Année : toutes']].concat(Array.from(new Set(L.map(x => (x.dateLivraison || '').slice(0, 4)).filter(Boolean))).sort().reverse().map(a => [a, 'Année ' + a])), test:(x, v) => (x.dateLivraison || '').slice(0, 4) === v}
    ],
    colonnes:(clients.length > 1 ? [{titre:'Client', val:x => x.client, html:x => `<b>${esc(x.client)}</b>`}] : []).concat([
      {titre:'Commande (PO)', val:x => x.po, html:x => `<a href="#" onclick="event.stopPropagation(); gcOuvrir('gc-commande', '${x.cmd.id}'); return false;"><b>PO ${esc(x.po)}</b></a><div class="gc-sous">ligne ${x.n}</div>`},
      {titre:'Article', val:x => x.l.designation, html:x => `${esc(x.l.ref || '')}<div class="gc-sous">${esc(x.l.refClient ? 'réf. client ' + x.l.refClient : x.l.designation || '')}</div>`},
      {titre:'Quantité', num:true, tri:x => GC.num(x.l.qte), html:x => `<b>${gcsfQ(x.l.qte, x.l.unite)}</b>${x.livre > 0 && x.reste > 0 ? `<div class="gc-sous">reste ${gcQ(x.reste)}</div>` : ''}`},
      {titre:'Livraison prévue', val:x => x.dateLivraison, html:x => `<b>${gcsfLibSemaine(x.dateLivraison)}</b>${x.dateDeclaration ? `<div class="gc-sous">déclaration ${gcsfLibSemaine(x.dateDeclaration)}</div>` : ''}`},
      {titre:'État', tri:x => GCSF_STATUTS[x.statut].ordre, html:x => gcsfBadge(x) + (x.l.note ? `<div class="gc-sous gcsf-note">${esc(x.l.note)}</div>` : '')},
      {titre:'BL · Facture', tri:x => (x.facts[0] || {}).numero || '', html:x => x.bls.length ? x.bls.map(bl => { const f = gcsfFactureDuBL(bl); return `<div><a href="#" onclick="event.stopPropagation(); gcOuvrir('gc-livraison', '${bl.id}'); return false;">${esc(bl.numero)}</a> · ${f ? `<a href="#" onclick="event.stopPropagation(); gcsfVoirFacture('${f.id}'); return false;"><b>${esc(f.numero)}</b></a> ${gcBadge(FACT_STATUTS[factStatut(f)])}` : '<span style="color:var(--bad);">sans facture</span>'}</div>`; }).join('') : '—'},
      {titre:'', tri:false, html:x => !ed || x.reste <= 0 ? '' : `<div class="gcsf-act">${x.statut !== 'declaree' ? `<button class="btn btn-ghost" data-gc="declaration" onclick="event.stopPropagation(); gcsfDeclaration('${x.cmd.id}', '${x.l.lid}')">Déclaration reçue</button>` : ''}<button class="btn btn-primary" data-gc="livrer-facturer" onclick="event.stopPropagation(); gcsfFormLivrer('${x.cmd.id}', '${x.l.lid}')">Livrer et facturer</button><button class="btn btn-ghost" title="Modifier la date ou la quantité" onclick="event.stopPropagation(); gcsfFormLigne('${x.cmd.id}', '${x.l.lid}')">✎</button></div>`}
    ]),
    ligneAttr:x => x.statut === 'retard' ? 'class="gcsf-retard gct-clic"' : '',
    clic:x => `gcOuvrir('gc-commande', '${x.cmd.id}')`, vide:'Aucune livraison à afficher', videSous:'Créez une commande ferme avec les livraisons proposées par le client.'});
};

// Ouvre le planning ou les factures avec des filtres déjà choisis
window.gcsfAller = (id, f) => { const d = {planning:[4, 1, {etat:'ouvertes'}], factures:[1, -1, {}]}[id]; gcTabs[id] = {q:'', tri:d[0], sens:d[1], page:0, f:Object.assign({}, d[2], f || {})}; nav('gc-' + id); };

// ---------- Déclaration du client ----------
function gcsfMajLigne(cmdId, lid, maj, journal){
  const c = gcD().cmdC.find(x => x.id === cmdId); if(!c) return null;
  const n = Object.assign({}, c, {lignes:c.lignes.map(l => l.lid === lid ? Object.assign({}, l, maj) : l)});
  n.echeances = gcsfEcheances(n);
  gcEnregistrer('cmdC', n); if(journal) gcJournal(journal[0], 'Commande client', n, journal[1]);
  return n;
}
function gcsfEcheances(c){ return GC.liste(c.lignes).filter(l => l.dateLivraison).map((l, i) => ({id:'e-' + l.lid, date:l.dateLivraison, qtes:{[l.lid]:GC.num(l.qte)}})); }
window.gcsfDeclaration = (cmdId, lid) => {
  const c = gcD().cmdC.find(x => x.id === cmdId), l = c && c.lignes.find(y => y.lid === lid); if(!l) return;
  mgtModal('Déclaration du client · PO ' + esc(c.reference || c.numero), `<p style="margin-top:0;">${gcsfQ(l.qte, l.unite)} · ${esc(l.designation || '')}<br><span class="gc-sous">Livraison prévue ${gcsfLibSemaine(l.dateLivraison)}</span></p>
    <div class="gc-form">${mgtChamp('Date de la déclaration', 'gsd-date', getTodayISO(), 'date')}${mgtChamp('Livraison confirmée pour le', 'gsd-liv', l.dateLivraison || '', 'date')}</div>${mgtChamp('Référence ou remarque', 'gsd-ref', '')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-declaration" onclick="gcsfValiderDeclaration('${cmdId}', '${lid}')">Enregistrer la déclaration</button>`);
};
window.gcsfValiderDeclaration = (cmdId, lid) => gcOperation(() => {
  const liv = gcVal('gsd-liv'), d = gcVal('gsd-date') || getTodayISO();
  const maj = {declaration:{date:d, reference:gcVal('gsd-ref'), par:gcPar(), ts:Date.now()}}; if(liv) maj.dateLivraison = liv;
  gcsfMajLigne(cmdId, lid, maj, ['Déclaration client', 'ligne ' + lid + ' · livraison ' + gcDt(liv)]);
  mgtFermer(); showToast('Déclaration enregistrée'); nav(activeTab);
});
// Modifier une livraison proposée (date, quantité, remarque)
window.gcsfFormLigne = (cmdId, lid) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), c = D.cmdC.find(x => x.id === cmdId), l = c && c.lignes.find(y => y.lid === lid); if(!l) return;
  const livre = GC.livres(D)[GC.cleLigne(cmdId, lid)] || 0;
  mgtModal('Livraison proposée · PO ' + esc(c.reference || c.numero), `<div class="gc-form">${mgtChamp('Quantité' + (livre ? ' (déjà livré ' + gcQ(livre) + ')' : ''), 'gsl-qte', l.qte, 'number', 'min="' + livre + '" step="any"')}${mgtChamp('Livraison souhaitée', 'gsl-liv', l.dateLivraison || '', 'date')}${mgtChamp('Déclaration attendue', 'gsl-dec', l.dateDeclaration || '', 'date')}</div>
    ${mgtChamp('Remarque', 'gsl-note', l.note || '')}<button class="btn btn-primary" style="width:100%;" onclick="gcsfSauverLigne('${cmdId}', '${lid}')">Enregistrer</button>`);
};
window.gcsfSauverLigne = (cmdId, lid) => gcOperation(() => {
  const D = gcD(), livre = GC.livres(D)[GC.cleLigne(cmdId, lid)] || 0, q = GC.num(gcVal('gsl-qte'));
  if(!(q > 0)){ showToast('Quantité invalide'); return; }
  if(q + 1e-9 < livre){ showToast('Quantité inférieure au déjà livré (' + gcQ(livre) + ')'); return; }
  gcsfMajLigne(cmdId, lid, {qte:q, dateLivraison:gcVal('gsl-liv'), dateDeclaration:gcVal('gsl-dec'), note:gcVal('gsl-note')}, ['Modification du planning', 'ligne ' + lid + ' : ' + gcQ(q) + ' le ' + gcDt(gcVal('gsl-liv'))]);
  mgtFermer(); showToast('Planning mis à jour'); nav(activeTab);
});

// ---------- Livrer et facturer ----------
// Stock : si l'article n'a jamais eu de stock dans la CRM, la livraison se fait sans sortie de stock
// (coût = prix d'achat du catalogue). Si le stock est suivi, la règle FIFO du module s'applique.
function gcsfSansStock(D, articleId){ return !GC.lots(D, articleId).length && !D.mouvements.some(m => m.articleId === articleId); }
window.gcsfFormLivrer = (cmdId, lidChoisi) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), c = D.cmdC.find(x => x.id === cmdId); if(!c) return;
  const liv = GC.livres(D), auj = getTodayISO();
  const L = GC.liste(c.lignes).map(l => ({l, reste:GC.rq(GC.num(l.qte) - (liv[GC.cleLigne(cmdId, l.lid)] || 0))})).filter(x => x.reste > 0);
  const sans = Array.from(new Set(L.map(x => x.l.articleId).filter(id => id && gcsfSansStock(D, id))));
  mgtModal('Livrer et facturer · PO ' + esc(c.reference || c.numero), `<p style="margin-top:0;"><b>${esc(gcNomClient(c.clientId))}</b> · cochez la ou les livraisons de ce jour.</p>
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th></th><th>Livraison prévue</th><th>Article</th><th class="n">Prix</th><th>Quantité livrée</th></tr></thead><tbody>
    ${L.map(x => `<tr><td data-l="Livrer"><input type="checkbox" class="gsv-c" data-lid="${x.l.lid}" ${x.l.lid === lidChoisi ? 'checked' : ''} style="width:20px;height:20px;min-width:0;"></td><td data-l="Prévue">${gcsfLibSemaine(x.l.dateLivraison)}</td><td data-l="Article">${esc(x.l.ref || x.l.designation || '')}</td><td class="n" data-l="Prix">${gcE(x.l.pu)}</td>
      <td data-l="Quantité"><input type="number" class="gsv-q" data-lid="${x.l.lid}" min="0" max="${x.reste}" step="any" value="${x.reste}"></td></tr>`).join('')}</tbody></table></div>
    <div class="gc-form" style="margin-top:8px;">${mgtChamp('Date de livraison', 'gsv-date', auj, 'date')}${mgtChamp('N° de la facture', 'gsv-fa', gcsfNumeroFacture(auj))}${mgtChamp('Déclaration / bon du client', 'gsv-ref', '')}</div>
    ${sans.length ? `<div class="gc-sous" style="margin:-4px 0 8px;">Stock non suivi dans la CRM pour cet article : livraison sans sortie de stock, coût = prix d'achat du catalogue.</div>` : ''}
    <div class="gc-sous" style="margin-bottom:8px;">Le bon de livraison et la facture sont créés ensemble. Facture payable à ${gcsfJours(gcClients()[c.clientId])} jours.</div>
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-livrer-facturer" onclick="gcsfValiderLivrer('${cmdId}')">Créer le bon de livraison et la facture</button>`);
};
window.gcsfValiderLivrer = (cmdId) => gcOperation(() => {
  const D = gcD(), c = D.cmdC.find(x => x.id === cmdId), date = gcVal('gsv-date') || getTodayISO(), numFa = gcVal('gsv-fa').trim();
  const saisies = Array.from(document.querySelectorAll('.gsv-c')).filter(e => e.checked).map(e => ({lid:e.dataset.lid, qte:GC.num((document.querySelector('.gsv-q[data-lid="' + e.dataset.lid + '"]') || {}).value)})).filter(s => s.qte > 0);
  if(!saisies.length){ showToast('Cochez au moins une livraison avec une quantité'); return; }
  if(date > getTodayISO()){ showToast('La date de livraison ne peut pas être dans le futur'); return; }
  if(!numFa){ showToast('Indiquez le numéro de facture'); return; }
  if(gcsfFactures().some(f => f.numero === numFa)){ showToast('Le numéro de facture ' + numFa + ' existe déjà'); return; }
  const sans = new Set(c.lignes.filter(l => saisies.some(s => s.lid === l.lid)).map(l => l.articleId).filter(id => id && gcsfSansStock(D, id)));
  const D2 = Object.assign({}, D, {articles:D.articles.map(a => sans.has(a.id) ? Object.assign({}, a, {suiviStock:false}) : a)});
  const r = GC.livrer(D2, cmdId, saisies, gcCtx({date, reference:gcVal('gsv-ref')}));
  const fid = mgtId('fa'), cl = gcClients()[c.clientId] || {};
  const lignes = r.livraison.lignes.map(l => ({designation:(l.ref ? l.ref + ' · ' : '') + (l.designation || ''), refClient:(c.lignes.find(y => y.lid === l.lid) || {}).refClient || '', qte:l.qte, unite:l.unite, pu:l.pu, remise:l.remise}));
  const f = {id:fid, numero:numFa, date, clientId:c.clientId, cmdId, po:c.reference || '', objet:'Livraison ' + r.livraison.numero + (c.reference ? ' · PO ' + c.reference : ''), tva:GC.num(c.tva), lignes,
    origine:{type:'livraison', module:'gc', ids:[r.livraison.id], label:r.livraison.numero}, paiement:'non_payee', echeance:GC.ajouterJours(date, gcsfJours(cl)), cree:{ts:Date.now(), par:gcPar()}};
  r.livraison.factureId = fid;
  gcEnregistrer('livraisons', r.livraison); if(r.mouvements.length) gcEnregistrer('mouvements', r.mouvements);
  gcsfSauverFacture(f);
  gcJournal('Livraison et facture', 'Commande client', c, r.livraison.numero + ' + facture ' + numFa + ' · ' + r.livraison.lignes.map(l => gcQ(l.qte) + ' ' + (l.unite || '')).join(' + ') + ' · ' + gcE(factTotaux(f).ttc));
  mgtFermer();
  mgtModal('Livraison enregistrée', `<p style="margin-top:0;">Bon de livraison <b>${esc(r.livraison.numero)}</b> et facture <b>${esc(numFa)}</b> (${gcE(factTotaux(f).ttc)}) créés.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="gcDocument('facture', '${fid}', 'print')">Imprimer la facture</button><button class="btn btn-ghost" onclick="gcDocument('facture', '${fid}', 'pdf')">Facture PDF</button>
    <button class="btn btn-ghost" onclick="gcDocument('livraison', '${r.livraison.id}', 'print')">Imprimer le BL</button><button class="btn btn-ghost" onclick="gcDocument('livraison', '${r.livraison.id}', 'pdf')">BL PDF</button></div>`);
  nav(activeTab);
});

// ---------- Factures et paiements ----------
function gcsfEchue(f){ return factStatut(f) !== 'payee' && f.echeance && f.echeance < getTodayISO(); }
window.renderGcFactures = function(main){
  const D = gcD(), ed = gcPeut(), F = gcsfFactures(), an = getTodayISO().slice(0, 4), C = GC.parId(D.cmdC);
  const b = gcSection(main, 'Factures et paiements', gcBoutonsExport('factures'));
  const deAn = F.filter(f => (f.date || '').slice(0, 4) === an), ttc = (l) => l.reduce((s, f) => s + factTotaux(f).ttc, 0);
  const aEnc = F.filter(f => factStatut(f) !== 'payee'), echues = aEnc.filter(gcsfEchue);
  const clients = Array.from(new Set(F.map(f => f.clientId)));
  b.innerHTML = `<div class="gc-chiffres gcsf-kpi"><div class="gc-chiffre"><span>Facturé en ${an}</span><b>${gcE(ttc(deAn))}</b></div><div class="gc-chiffre good"><span>Encaissé (${an})</span><b>${gcE(ttc(deAn.filter(f => factStatut(f) === 'payee')))}</b></div>
      <div class="gc-chiffre ${aEnc.length ? 'warn' : ''}"><span>Reste à encaisser · ${aEnc.length} facture(s)</span><b>${gcE(ttc(aEnc))}</b></div><div class="gc-chiffre ${echues.length ? 'bad' : ''}"><span>Échéance dépassée</span><b>${echues.length ? gcE(ttc(echues)) : '0'}</b></div></div>`
  + gcTable({id:'factures', lignes:() => gcsfFactures(), tri:1, sens:-1, parPage:50, placeholder:'N° de facture, PO, client…',
    texte:f => [f.numero, f.po, gcNomClient(f.clientId), (f.origine || {}).label, f.objet].join(' '),
    filtres:[
      {id:'paie', label:'Paiement', options:[['', 'Paiement : tous'], ['apayer', 'À encaisser'], ['echues', 'Échéance dépassée'], ['payee', 'Payées']], test:(f, v) => v === 'apayer' ? factStatut(f) !== 'payee' : v === 'echues' ? gcsfEchue(f) : factStatut(f) === 'payee'},
      {id:'client', label:'Client', options:[['', 'Client : tous']].concat(clients.map(id => [id, 'Client : ' + gcNomClient(id)])), test:(f, v) => f.clientId === v},
      {id:'an', label:'Année', defaut:'', options:[['', 'Année : toutes']].concat(Array.from(new Set(F.map(f => (f.date || '').slice(0, 4)))).sort().reverse().map(a => [a, 'Année ' + a])), test:(f, v) => (f.date || '').slice(0, 4) === v}
    ],
    colonnes:[
      {titre:'N° facture', val:f => f.numero, html:f => `<b>${esc(f.numero || 'brouillon')}</b>${gcsfEcartFacture(f) ? '<div class="gc-sous" style="color:var(--bad);">écart avec la commande</div>' : ''}`},
      {titre:'Date', val:f => f.date, html:f => gcDt(f.date)},
      {titre:'Client', val:f => gcNomClient(f.clientId)},
      {titre:'Commande · BL', val:f => f.po || (C[f.cmdId] || {}).reference || '', html:f => { const po = f.po || (C[f.cmdId] || {}).reference; return (po ? 'PO ' + esc(po) : '—') + `<div class="gc-sous">${esc((f.origine || {}).label || '')}</div>`; }},
      {titre:'Quantité', num:true, tri:f => GC.liste(f.lignes).reduce((s, l) => s + GC.num(l.qte), 0), html:f => gcQ(GC.liste(f.lignes).reduce((s, l) => s + GC.num(l.qte), 0)) + ' ' + esc((GC.liste(f.lignes)[0] || {}).unite || '')},
      {titre:'Montant TTC', num:true, tri:f => factTotaux(f).ttc, html:f => `<b>${gcE(factTotaux(f).ttc)}</b>${factTotaux(f).tva ? `<div class="gc-sous">HT ${gcE(factTotaux(f).ht)}</div>` : ''}`},
      {titre:'Échéance', val:f => f.echeance || '', html:f => f.echeance ? `<span style="${gcsfEchue(f) ? 'color:var(--bad);font-weight:700;' : ''}">${gcDt(f.echeance)}</span>` : '—'},
      {titre:'Paiement', tri:f => factStatut(f), html:f => gcBadge(FACT_STATUTS[factStatut(f)]) + (f.datePaiement ? `<div class="gc-sous">le ${gcDt(f.datePaiement)}</div>` : '')},
      {titre:'', tri:false, html:f => !ed || factStatut(f) === 'payee' ? '' : `<button class="btn btn-ghost gcsf-petit" data-gc="marquer-payee" onclick="event.stopPropagation(); gcsfPaiement('${f.id}', 'payee')">Payée</button>`}
    ],
    total:(l, c, i) => i === 0 ? l.length + ' facture(s)' : c.titre === 'Montant TTC' ? '<b>' + gcE(ttc(l)) + '</b>' : c.titre === 'Quantité' ? gcQ(l.reduce((s, f) => s + GC.liste(f.lignes).reduce((t, x) => t + GC.num(x.qte), 0), 0)) : '',
    clic:f => `gcsfVoirFacture('${f.id}')`, vide:'Aucune facture'});
};
window.gcsfPaiement = (fid, statut) => gcOperation(() => {
  const f = factListe()[fid]; if(!f) return;
  const n = Object.assign({}, f, {paiement:statut, datePaiement:statut === 'payee' ? getTodayISO() : '', historiquePaiement:GC.liste(f.historiquePaiement).concat([{date:getTodayISO(), ts:Date.now(), par:gcPar(), statut}])});
  gcsfSauverFacture(n); gcJournal('Paiement', 'Facture', {id:fid, numero:f.numero}, FACT_STATUTS[statut].label);
  mgtFermer(); showToast('Facture ' + f.numero + ' : ' + FACT_STATUTS[statut].label.toLowerCase()); nav(activeTab);
});
window.gcsfVoirFacture = (fid) => {
  const f = factListe()[fid]; if(!f) return;
  const t = factTotaux(f), ec = gcsfEcartFacture(f), D = gcD(), c = D.cmdC.find(x => x.id === f.cmdId), ed = gcPeut(), st = factStatut(f);
  mgtModal('Facture ' + esc(f.numero || ''), `<div class="gc-kv" style="margin-bottom:8px;"><div><span>Client</span><b>${esc(gcNomClient(f.clientId))}</b></div><div><span>Date</span><b>${gcDt(f.date)}</b></div><div><span>Échéance</span><b>${gcDt(f.echeance)}</b></div>
      <div><span>Commande</span><b>${c ? `<a href="#" onclick="mgtFermer(); gcOuvrir('gc-commande', '${c.id}'); return false;">PO ${esc(c.reference || c.numero)}</a>` : esc(f.po || '—')}</b></div><div><span>Livraison</span><b>${esc((f.origine || {}).label || '—')}</b></div><div><span>Paiement</span><b>${gcBadge(FACT_STATUTS[st])}</b></div></div>
    ${ec ? `<div class="gc-alerte bad">Montant facturé différent du montant de la commande : écart de <b>${gcE(ec)}</b> HT (prix facturé ≠ prix de la commande).</div>` : ''}
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Désignation</th><th class="n">Quantité</th><th class="n">Prix HT</th><th class="n">Montant HT</th></tr></thead><tbody>
      ${GC.liste(f.lignes).map(l => `<tr><td data-l="Désignation">${esc(l.designation || '')}${l.refClient ? '<div class="gc-sous">réf. client ' + esc(l.refClient) + '</div>' : ''}</td><td class="n" data-l="Quantité">${gcsfQ(l.qte, l.unite)}</td><td class="n" data-l="Prix">${gcE(l.pu)}</td><td class="n" data-l="Montant">${gcE(GC.montantLigne(l))}</td></tr>`).join('')}</tbody></table></div>
    <div class="gc-chiffres" style="margin-top:8px;"><div class="gc-chiffre"><span>Total HT</span><b>${gcE(t.ht)}</b></div><div class="gc-chiffre"><span>TVA ${gcPct(f.tva)}</span><b>${gcE(t.tva)}</b></div><div class="gc-chiffre"><span>Total TTC</span><b>${gcE(t.ttc)}</b></div></div>
    ${f.note ? `<div class="gc-sous" style="margin:6px 0;">${esc(f.note)}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"><button class="btn btn-primary" onclick="gcDocument('facture', '${fid}', 'print')">Imprimer</button><button class="btn btn-ghost" onclick="gcDocument('facture', '${fid}', 'pdf')">PDF</button>
      ${ed && st !== 'payee' ? `<button class="btn btn-ghost" data-gc="facture-payee" onclick="gcsfPaiement('${fid}', 'payee')">Marquer payée</button>` : ''}${ed && st === 'non_payee' ? `<button class="btn btn-ghost" onclick="gcsfPaiement('${fid}', 'en_cours')">Paiement en cours</button>` : ''}${ed && st === 'payee' ? `<button class="btn btn-ghost" onclick="gcsfPaiement('${fid}', 'non_payee')">Annuler le paiement</button>` : ''}</div>`);
};

// ---------- Document « Facture » (impression et PDF) ----------
const gcsfModeleDocOrigine = gcModeleDoc;
gcModeleDoc = function(type, id){
  if(type === 'facture'){
    const f = factListe()[id]; if(!f) return null;
    const c = gcClients()[f.clientId] || {}, t = factTotaux(f), D = gcD(), cmd = D.cmdC.find(x => x.id === f.cmdId) || {};
    return {titre:'FACTURE', numero:f.numero || 'Brouillon', brouillon:!f.numero,
      infos:[['Date', gcDt(f.date)], ['Échéance', gcDt(f.echeance)]].concat(f.po || cmd.reference ? [['Votre commande (PO)', f.po || cmd.reference]] : []).concat((f.origine || {}).label ? [['Bon de livraison', f.origine.label]] : []).concat(c.numeroFournisseur ? [['N° fournisseur', c.numeroFournisseur]] : []),
      tiers:{titre:'Facturé à', nom:c.nom || '', lignes:[c.adresseFacturation || c.adresse, c.mf ? 'MF ' + c.mf : ''].filter(Boolean)},
      tables:[{colonnes:[{t:'Désignation'}, {t:'Réf. client'}, {t:'Quantité', n:1}, {t:'Unité'}, {t:'P.U. HT', n:1}, {t:'Montant HT', n:1}],
        lignes:GC.liste(f.lignes).map(l => [l.designation || '', l.refClient || '', gcQ(l.qte), l.unite || '', gcE(l.pu), gcE(GC.montantLigne(l))])}],
      totaux:[['Total HT', gcE(t.ht)], ['TVA ' + gcPct(f.tva), gcE(t.tva)], ['Total TTC', gcE(t.ttc), 1]],
      notes:[c.conditions ? 'Conditions de paiement : ' + c.conditions + ' (échéance le ' + gcDt(f.echeance) + ')' : '', c.mentionTva || '', f.note || ''].filter(Boolean), signature:null};
  }
  const m = gcsfModeleDocOrigine(type, id);
  if(m && type === 'livraison'){
    const b = gcD().livraisons.find(x => x.id === id), cmd = b && gcD().cmdC.find(x => x.id === b.cmdId);
    if(b && cmd){ GC.liste(b.lignes).forEach((l, i) => { const cl = cmd.lignes.find(y => y.lid === l.lid); if(cl && cl.refClient && m.tables[0].lignes[i]) m.tables[0].lignes[i][1] += ' (réf. client ' + cl.refClient + ')'; });
      const f = gcsfFactureDuBL(b); if(f) m.infos.push(['Facture', f.numero]); const cl = gcClients()[b.clientId] || {}; if(cl.adresseLivraison) m.tiers.lignes = [cl.adresseLivraison].concat(m.tiers.lignes.filter(x => x !== cl.adresse)); }
  }
  return m;
};

// ---------- Commande ferme : PO du client + livraisons proposées ----------
function gcsfOffreValable(clientId, articleId, date){
  const auj = date || getTodayISO();
  return gcD().offres.filter(o => o.clientId === clientId && !o.archive && ['acceptee', 'envoyee'].indexOf(o.statut) >= 0 && (!o.validite || o.validite >= auj) && GC.liste(o.lignes).some(l => !articleId || l.articleId === articleId))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;
}
// Prix de l'offre pour une quantité (grille de l'offre : quantité totale de la commande)
function gcsfPrixOffre(o, articleId, qte){
  if(!o) return null;
  const l = GC.liste(o.lignes).find(x => x.articleId === articleId); if(!l) return null;
  const g = GC.liste((o.grilles || {})[l.lid]).slice().sort((a, b) => a.min - b.min);
  if(!g.length) return GC.num(l.pu);
  let p = g[0].prix; g.forEach(x => { if(qte >= x.min) p = x.prix; });
  return p;
}
let gcsfCmd = null;
window.gcsfFormCommande = (init) => {
  if(!gcPeut()) return gcRefus();
  init = init || {};
  const D = gcD(), clientId = init.clientId || '', o = init.offreId ? D.offres.find(x => x.id === init.offreId) : (clientId ? gcsfOffreValable(clientId) : null);
  // article par défaut : celui de la dernière commande du client, sinon le premier de l'offre
  const derniere = D.cmdC.filter(c => c.clientId === (clientId || (o && o.clientId)) && GC.liste(c.lignes).length).sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0];
  const art = (derniere && derniere.lignes[0].articleId) || (o ? (GC.liste(o.lignes)[0] || {}).articleId : '');
  const refCl = derniere ? (derniere.lignes.find(l => l.refClient) || {}).refClient || '' : '';
  gcsfCmd = {clientId:clientId || (o && o.clientId) || '', offreId:o ? o.id : '', lignes:[{articleId:art || '', refClient:refCl, qte:'', pu:'', dateLivraison:'', dateDeclaration:''}]};
  gcsfDessinerCommande();
};
function gcsfLireCommande(){
  if(!gcsfCmd) return;
  const v = (id) => { const e = document.getElementById(id); return e ? e.value : undefined; };
  ['po', 'date', 'cond'].forEach(k => { const x = v('gsc-' + k); if(x !== undefined) gcsfCmd[k] = x; });
  const cl = v('gsc-client'); if(cl !== undefined) gcsfCmd.clientId = cl; const of = v('gsc-offre'); if(of !== undefined) gcsfCmd.offreId = of;
  gcsfCmd.lignes.forEach((l, i) => ['articleId', 'refClient', 'qte', 'pu', 'dateLivraison', 'dateDeclaration'].forEach(k => { const x = v('gsc-' + k + '-' + i); if(x !== undefined) l[k] = x; }));
}
function gcsfPrixAuto(){
  // prix : offre valable du client (grille sur la quantité totale de l'article dans la commande), sinon catalogue
  const D = gcD(), o = D.offres.find(x => x.id === gcsfCmd.offreId);
  gcsfCmd.lignes.forEach(l => {
    if(!l.articleId || l.puManuel) return;
    const tot = gcsfCmd.lignes.filter(x => x.articleId === l.articleId).reduce((s, x) => s + GC.num(x.qte), 0);
    const p = gcsfPrixOffre(o, l.articleId, tot), a = D.articles.find(x => x.id === l.articleId);
    l.pu = p !== null ? p : (a ? GC.prixPalier(a, tot).prix : '');
    l.source = p !== null ? 'offre' : 'catalogue';
  });
}
window.gcsfCmdChange = (champ, i) => {
  gcsfLireCommande();
  if(champ === 'pu' && i !== undefined) gcsfCmd.lignes[i].puManuel = true;
  if(champ === 'client'){ const o = gcsfOffreValable(gcsfCmd.clientId); gcsfCmd.offreId = o ? o.id : ''; const c = gcClients()[gcsfCmd.clientId] || {}; gcsfCmd.cond = c.conditions || gcsfCmd.cond; }
  if(champ === 'article' && i !== undefined) gcsfCmd.lignes[i].puManuel = false;
  setTimeout(gcsfDessinerCommande, 0);
};
window.gcsfCmdAjouter = () => {
  gcsfLireCommande();
  const d = gcsfCmd.lignes[gcsfCmd.lignes.length - 1] || {};
  gcsfCmd.lignes.push({articleId:d.articleId || '', refClient:d.refClient || '', qte:d.qte || '', pu:d.pu || '', puManuel:d.puManuel, dateLivraison:d.dateLivraison ? GC.ajouterMois(d.dateLivraison, 1) : '', dateDeclaration:d.dateDeclaration ? GC.ajouterMois(d.dateDeclaration, 1) : ''});
  gcsfDessinerCommande();
};
window.gcsfCmdRetirer = (i) => { gcsfLireCommande(); gcsfCmd.lignes.splice(i, 1); if(!gcsfCmd.lignes.length) gcsfCmd.lignes.push({}); gcsfDessinerCommande(); };
function gcsfDessinerCommande(){
  const D = gcD(), C = gcsfCmd, o = D.offres.find(x => x.id === C.offreId), cl = gcClients()[C.clientId] || {};
  if(C.date === undefined) C.date = getTodayISO(); if(C.cond === undefined) C.cond = cl.conditions || '';
  gcsfPrixAuto();
  const offres = D.offres.filter(x => x.clientId === C.clientId && !x.archive);
  const optsArt = (val) => gcOptsArticles(val, '— Article —', a => !o || true);
  const tot = C.lignes.reduce((s, l) => s + GC.num(l.qte) * GC.num(l.pu), 0);
  mgtModal('Nouvelle commande ferme', `<div class="gc-form">
      <div class="field"><label>Client *</label><select id="gsc-client" onchange="gcsfCmdChange('client')">${gcOptsClients(C.clientId, '— Choisir —')}</select></div>
      ${mgtChamp('N° de commande du client (PO) *', 'gsc-po', C.po || '')}${mgtChamp('Date de la commande', 'gsc-date', C.date, 'date')}
      <div class="field"><label>Offre de référence</label><select id="gsc-offre" onchange="gcsfCmdChange('offre')">${gcOpts(offres.map(x => [x.id, (x.numero || 'offre') + (x.validite ? ' · valable au ' + gcDt(x.validite) : '')]), C.offreId, '— Aucune (prix du catalogue) —')}</select></div>
      ${mgtChamp('Conditions de paiement', 'gsc-cond', C.cond)}</div>
    ${o && o.validite && o.validite < getTodayISO() ? '<div class="gc-alerte">Cette offre n\'est plus valable : vérifiez les prix.</div>' : ''}
    <h4 style="margin:6px 0;">Livraisons proposées par le client (une ligne par livraison)</h4>
    <div style="overflow-x:auto;"><table class="gc-lignes gcsf-cmd"><thead><tr><th>Article</th><th>Réf. client</th><th>Quantité</th><th>Prix unitaire</th><th>Livraison souhaitée</th><th>Déclaration attendue</th><th></th></tr></thead><tbody>
    ${C.lignes.map((l, i) => { const a = D.articles.find(x => x.id === l.articleId), po = gcsfPrixOffre(o, l.articleId, C.lignes.filter(x => x.articleId === l.articleId).reduce((s, x) => s + GC.num(x.qte), 0));
      const ecart = po !== null && l.pu !== '' && Math.abs(GC.num(l.pu) - po) > 1e-9;
      return `<tr><td data-l="Article"><select id="gsc-articleId-${i}" onchange="gcsfCmdChange('article', ${i})">${optsArt(l.articleId)}</select></td>
      <td data-l="Réf. client"><input id="gsc-refClient-${i}" value="${gcAttr(l.refClient || '')}" placeholder="facultatif"></td>
      <td data-l="Quantité"><input id="gsc-qte-${i}" type="number" min="0" step="any" value="${gcAttr(l.qte)}" onchange="gcsfCmdChange('qte', ${i})">${a && a.unite ? '<span class="gc-sous"> ' + esc(a.unite) + '</span>' : ''}</td>
      <td data-l="Prix unitaire"><input id="gsc-pu-${i}" type="number" min="0" step="any" value="${gcAttr(l.pu)}" onchange="gcsfCmdChange('pu', ${i})"><div class="gc-sous" style="${ecart ? 'color:var(--bad);' : ''}">${ecart ? 'offre : ' + gcE(po) + (l.sourcePrix ? ' · lu dans le PDF' : '') : l.puManuel ? (l.sourcePrix ? 'prix lu dans le PDF' : 'prix saisi') : l.source === 'offre' ? 'prix de l\'offre' : l.articleId ? 'prix du catalogue' : ''}</div></td>
      <td data-l="Livraison"><input id="gsc-dateLivraison-${i}" type="date" value="${gcAttr(l.dateLivraison || '')}"></td>
      <td data-l="Déclaration"><input id="gsc-dateDeclaration-${i}" type="date" value="${gcAttr(l.dateDeclaration || '')}"></td>
      <td><button class="btn btn-ghost" title="Retirer" onclick="gcsfCmdRetirer(${i})">✕</button></td></tr>`; }).join('')}</tbody></table></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 12px;"><button class="btn btn-ghost" data-gc="ajouter-livraison" onclick="gcsfCmdAjouter()">+ Ajouter une livraison</button>
      <b>Total HT : ${gcE(GC.r2(tot))} · ${gcQ(C.lignes.reduce((s, l) => s + GC.num(l.qte), 0))}</b></div>
    <button class="btn btn-primary" style="width:100%;" data-gc="enregistrer-commande-ferme" onclick="gcsfEnregistrerCommande()">Enregistrer la commande ferme</button>`);
}
window.gcsfEnregistrerCommande = () => gcOperation(() => {
  gcsfLireCommande();
  const C = gcsfCmd, D = gcD(), po = String(C.po || '').trim();
  if(!C.clientId){ showToast('Choisissez le client'); return; }
  if(!po){ showToast('Indiquez le numéro de commande du client (PO)'); return; }
  if(D.cmdC.some(c => c.clientId === C.clientId && String(c.reference || '') === po && c.statut !== 'annulee')){ showToast('La commande PO ' + po + ' existe déjà pour ce client'); return; }
  const L = C.lignes.filter(l => l.articleId && GC.num(l.qte) > 0);
  if(!L.length){ showToast('Ajoutez au moins une livraison (article et quantité)'); return; }
  if(L.some(l => !l.dateLivraison)){ showToast('Indiquez la date souhaitée de chaque livraison'); return; }
  if(L.some(l => !(GC.num(l.pu) > 0))){ showToast('Chaque livraison doit avoir un prix'); return; }
  const cl = gcClients()[C.clientId] || {}, R = gcReglages();
  const lignes = L.map((l, i) => { const a = D.articles.find(x => x.id === l.articleId) || {};
    return {lid:'l' + (i + 1), articleId:a.id, ref:a.ref || '', designation:a.designation || '', unite:a.unite || '', qte:GC.num(l.qte), pu:GC.num(l.pu), remise:0, refClient:l.refClient || '', dateLivraison:l.dateLivraison, dateDeclaration:l.dateDeclaration || ''}; });
  const c = {id:GC.nouvelId('cc'), numero:'PO-' + po, reference:po, clientId:C.clientId, date:C.date || getTodayISO(), statut:'confirmee', type:'annuelle', offreId:C.offreId || '', conditions:C.cond || cl.conditions || '',
    tva:cl.tva !== undefined && cl.tva !== '' ? GC.num(cl.tva) : GC.num(R.tva), remise:0, lignes, dateSouhaitee:lignes.map(l => l.dateLivraison).sort()[0], commentaires:''};
  c.echeances = gcsfEcheances(c);
  gcEnregistrer('cmdC', c);
  gcJournal('Création', 'Commande ferme', c, lignes.length + ' livraison(s) · ' + gcQ(lignes.reduce((s, l) => s + l.qte, 0)) + ' · ' + gcE(GC.totaux(c).ht) + ' HT');
  gcsfCmd = null; mgtFermer(); showToast('Commande PO ' + po + ' enregistrée : ' + lignes.length + ' livraison(s) au planning');
  gcTabs.planning = null; nav('gc-planning');
});

// ---------- Fiche commande : son planning en tête ----------
const gcsfFicheCmdOrigine = window.renderGcCommande;
window.renderGcCommande = function(main){
  gcsfFicheCmdOrigine(main);
  const D = gcD(), c = D.cmdC.find(x => x.id === gcOuvert['gc-commande']), body = document.getElementById('gc-body'); if(!c || !body) return;
  const L = gcsfLignesPlanning(D).filter(x => x.cmd.id === c.id), ed = gcPeut(), o = c.offreId ? D.offres.find(x => x.id === c.offreId) : null;
  const facts = Array.from(new Set(L.reduce((s, x) => s.concat(x.facts), []))), tot = GC.totaux(c);
  const qT = L.reduce((s, x) => s + GC.num(x.l.qte), 0), qL = L.reduce((s, x) => s + x.livre, 0), u = (L[0] || {l:{}}).l.unite || '';
  const fa = facts.reduce((s, f) => s + factTotaux(f).ttc, 0), paye = facts.filter(f => factStatut(f) === 'payee').reduce((s, f) => s + factTotaux(f).ttc, 0);
  if(!L.length) return;
  document.querySelectorAll('.gc-actions [data-gc="livrer"], .gc-actions [data-gc="reserver-tout"]').forEach(e => e.remove());
  body.insertAdjacentHTML('afterbegin', `<div class="card" data-gc="planning-commande"><h3 class="gc-h3">PO ${esc(c.reference || c.numero)} · ${esc(gcNomClient(c.clientId))}${c.repriseDateInconnue ? ' <span class="gc-tag">date de commande non connue (reprise)</span>' : ''}</h3>
    <div class="gc-chiffres"><div class="gc-chiffre"><span>Commandé</span><b>${gcsfQ(qT, u)}</b></div><div class="gc-chiffre good"><span>Livré</span><b>${gcsfQ(qL, u)}</b></div><div class="gc-chiffre ${qT - qL > 0 ? 'warn' : ''}"><span>Reste à livrer</span><b>${gcsfQ(GC.rq(qT - qL), u)}</b></div>
      <div class="gc-chiffre"><span>Montant HT</span><b>${gcE(tot.ht)}</b></div><div class="gc-chiffre"><span>Facturé</span><b>${gcE(fa)}</b></div><div class="gc-chiffre ${fa - paye > 0.005 ? 'warn' : ''}"><span>Reste à encaisser</span><b>${gcE(GC.r2(fa - paye))}</b></div></div>
    ${o ? `<div class="gc-sous" style="margin-bottom:6px;">Offre de référence : <a href="#" onclick="gcOuvrir('gc-offre', '${o.id}'); return false;">${esc(o.numero || '')}</a>${o.validite ? ' · valable jusqu\'au ' + gcDt(o.validite) : ''}</div>` : ''}
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Ligne</th><th>Livraison prévue</th><th class="n">Quantité</th><th class="n">Prix</th><th>État</th><th>BL · Facture</th><th></th></tr></thead><tbody>
    ${L.map(x => `<tr class="${x.statut === 'retard' ? 'gcsf-retard' : ''}"><td data-l="Ligne">${x.n}${x.l.refClient ? '<div class="gc-sous">' + esc(x.l.refClient) + '</div>' : ''}</td><td data-l="Prévue"><b>${gcsfLibSemaine(x.dateLivraison)}</b>${x.dateDeclaration ? '<div class="gc-sous">déclaration ' + gcsfLibSemaine(x.dateDeclaration) + '</div>' : ''}</td>
      <td class="n" data-l="Quantité">${gcsfQ(x.l.qte, x.l.unite)}</td><td class="n" data-l="Prix">${gcE(x.l.pu)}</td><td data-l="État">${gcsfBadge(x)}${x.l.note ? '<div class="gc-sous gcsf-note">' + esc(x.l.note) + '</div>' : ''}</td>
      <td data-l="BL · Facture">${x.bls.map(bl => { const f = gcsfFactureDuBL(bl); return `<div><a href="#" onclick="gcOuvrir('gc-livraison', '${bl.id}'); return false;">${esc(bl.numero)}</a> · ${f ? `<a href="#" onclick="gcsfVoirFacture('${f.id}'); return false;"><b>${esc(f.numero)}</b></a> ${gcBadge(FACT_STATUTS[factStatut(f)])}` : 'sans facture'}</div>`; }).join('') || '—'}</td>
      <td>${ed && x.reste > 0 ? `<div class="gcsf-act">${x.statut !== 'declaree' ? `<button class="btn btn-ghost" onclick="gcsfDeclaration('${c.id}', '${x.l.lid}')">Déclaration reçue</button>` : ''}<button class="btn btn-primary" onclick="gcsfFormLivrer('${c.id}', '${x.l.lid}')">Livrer et facturer</button><button class="btn btn-ghost" onclick="gcsfFormLigne('${c.id}', '${x.l.lid}')">✎</button></div>` : ''}</td></tr>`).join('')}
    </tbody></table></div></div>`);
};

// ---------- Fiche offre : grille de prix + commande ferme ----------
const gcsfFicheOffreOrigine = window.renderGcOffre;
window.renderGcOffre = function(main){
  gcsfFicheOffreOrigine(main);
  const D = gcD(), o = D.offres.find(x => x.id === gcOuvert['gc-offre']), body = document.getElementById('gc-body'); if(!o || !body) return;
  const auj = getTodayISO(), valable = !o.validite || o.validite >= auj, G = o.grilles || {};
  const cmds = D.cmdC.filter(c => c.offreId === o.id);
  if(o.grilles) document.querySelectorAll('.gc-actions [data-gc="offre-commande"]').forEach(e => e.remove());
  const html = `<div class="card" data-gc="offre-grille"><h3 class="gc-h3">Offre ${esc(o.numero || '')} · ${esc(gcNomClient(o.clientId))} ${valable ? gcBadge({label:'Valable jusqu\'au ' + gcDt(o.validite), cls:'good'}) : gcBadge({label:'Expirée le ' + gcDt(o.validite), cls:'bad'})}</h3>
    ${o.noteValidite ? `<div class="gc-sous" style="margin-bottom:6px;">${esc(o.noteValidite)}</div>` : ''}
    ${GC.liste(o.lignes).map(l => { const g = GC.liste(G[l.lid]); return `<div style="margin-bottom:10px;"><b>${esc((l.ref ? l.ref + ' · ' : '') + (l.designation || ''))}</b>${g.length ? `<div style="overflow-x:auto;"><table class="gc-lignes gcsf-grille"><thead><tr>${g.map(p => `<th class="n">${esc(p.lib || ('≥ ' + gcQ(p.min)))}</th>`).join('')}</tr></thead><tbody><tr>${g.map(p => `<td class="n" data-l="${gcAttr(p.lib || ('≥ ' + gcQ(p.min)))}"><b>${gcE(p.prix)}</b></td>`).join('')}</tr></tbody></table></div>` : `<div class="gc-sous">Prix : ${gcE(l.pu)}</div>`}</div>`; }).join('')}
    ${GC.liste(o.conditionsListe).length ? `<div class="gc-sous">${o.conditionsListe.map(esc).join(' · ')}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;">${gcPeut() ? `<button class="btn btn-primary" data-gc="offre-commande-ferme" onclick="gcsfFormCommande({clientId:'${o.clientId}', offreId:'${o.id}'})">+ Commande ferme sur cette offre</button>` : ''}
      ${cmds.length ? `<span class="gc-sous">Commandes : ${cmds.map(c => `<a href="#" onclick="gcOuvrir('gc-commande', '${c.id}'); return false;">PO ${esc(c.reference || c.numero)}</a>`).join(', ')}</span>` : ''}</div></div>`;
  body.insertAdjacentHTML('afterbegin', html);
};

// ---------- Fiche client : coordonnées complètes et suivi ----------
const GCSF_CHAMPS_CLIENT = [['groupe', 'Groupe'], ['adresseFacturation', 'Adresse de facturation', 'zone'], ['adresseLivraison', 'Adresse de livraison', 'zone'], ['acheteur', 'Acheteur'], ['numeroFournisseur', 'Notre n° fournisseur chez le client'], ['devise', 'Devise'], ['tva', 'TVA appliquée (%)', 'number'], ['mentionTva', 'Mention TVA sur facture']];
const gcsfFormClientOrigine = window.gcFormClient;
window.gcFormClient = (id) => {
  gcsfFormClientOrigine(id);
  const c = id ? (gcClients()[id] || {}) : {}, z = document.querySelector('#mgt-modal-zone .gc-form');
  if(z) z.insertAdjacentHTML('afterend', `<div class="gc-form">${GCSF_CHAMPS_CLIENT.map(([k, l, t]) => t === 'zone' ? mgtZone(l, 'gk-x-' + k, c[k]) : mgtChamp(l, 'gk-x-' + k, c[k], t || 'text')).join('')}</div>`);
};
const gcsfSauverClientOrigine = window.gcSauverClient;
window.gcSauverClient = (id) => {
  const extra = {}; GCSF_CHAMPS_CLIENT.forEach(([k]) => { const e = document.getElementById('gk-x-' + k); if(e) extra[k] = e.value.trim(); });
  const nom = gcVal('gk-nom');
  gcsfSauverClientOrigine(id);
  const l = Object.assign({}, gcClients()), k = id || Object.keys(l).find(x => l[x] && GC.norm(l[x].nom) === GC.norm(nom));
  if(k && l[k] && Object.keys(extra).length){ l[k] = Object.assign({}, l[k], extra); setJSON('gadh_fact_clients', l); gcCacheD = null; if(activeTab === 'gc-client') nav('gc-client'); }
};
const gcsfFicheClientOrigine = renderGcClient;
renderGcClient = function(main){
  gcsfFicheClientOrigine(main);
  const id = gcOuvert['gc-client'], c = gcClients()[id], body = document.getElementById('gc-body'); if(!c || !body) return;
  const D = gcD(), P = gcsfLignesPlanning(D).filter(x => x.cmd.clientId === id), F = gcsfFactures().filter(f => f.clientId === id), o = gcsfOffreValable(id);
  const prochaines = P.filter(x => x.reste > 0).sort((a, b) => (a.dateLivraison || '').localeCompare(b.dateLivraison || '')).slice(0, 4), aEnc = F.filter(f => factStatut(f) !== 'payee');
  const v = (k, l) => c[k] ? `<div><span>${l}</span><b style="white-space:pre-line;">${esc(c[k])}</b></div>` : '';
  body.insertAdjacentHTML('afterbegin', `<div class="card" data-gc="client-coordonnees"><h3 class="gc-h3">Coordonnées</h3><div class="gc-kv">
      ${v('groupe', 'Groupe')}${v('adresse', 'Adresse (siège)')}${v('adresseFacturation', 'Facturation')}${v('adresseLivraison', 'Livraison')}${v('acheteur', 'Acheteur')}${v('contact', 'Contact')}${v('email', 'E-mail')}${v('tel', 'Téléphone')}
      ${v('mf', 'Matricule fiscal')}${v('conditions', 'Paiement')}${v('devise', 'Devise')}${v('numeroFournisseur', 'Notre n° fournisseur')}${c.tva !== undefined && c.tva !== '' ? `<div><span>TVA appliquée</span><b>${gcPct(c.tva)}</b></div>` : ''}</div></div>
    <div class="card"><h3 class="gc-h3">Suivi</h3><div class="gc-chiffres">
      <div class="gc-chiffre ${o ? 'good' : ''}"><span>Offre valable</span><b style="font-size:14px;">${o ? `<a href="#" onclick="gcOuvrir('gc-offre', '${o.id}'); return false;">${esc(o.numero)}</a><br>jusqu'au ${gcDt(o.validite)}` : 'aucune'}</b></div>
      <div class="gc-chiffre ${P.some(x => x.statut === 'retard') ? 'bad' : ''}"><span>Livraisons à venir</span><b>${P.filter(x => x.reste > 0).length}</b></div>
      <div class="gc-chiffre"><span>Reste à livrer</span><b>${gcQ(P.reduce((s, x) => s + x.reste, 0))}</b></div>
      <div class="gc-chiffre ${aEnc.length ? 'warn' : ''}"><span>À encaisser · ${aEnc.length} facture(s)</span><b>${gcE(aEnc.reduce((s, f) => s + factTotaux(f).ttc, 0))}</b></div></div>
      ${prochaines.length ? `<div style="margin-top:6px;">${prochaines.map(x => `<div class="session-row"><span><b>${gcsfLibSemaine(x.dateLivraison)}</b> · PO ${esc(x.po)} · ${gcsfQ(x.reste, x.l.unite)}</span>${gcsfBadge(x)}</div>`).join('')}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${gcPeut() ? `<button class="btn btn-primary" onclick="gcsfFormCommande({clientId:'${id}'})">+ Commande ferme</button>` : ''}<button class="btn btn-ghost" onclick="gcsfAller('planning', {client:'${id}'})">Planning du client</button><button class="btn btn-ghost" onclick="gcsfAller('factures', {client:'${id}'})">Factures du client</button></div></div>`);
};

// ---------- Tableau de bord : à faire ----------
const gcsfAccueilOrigine = renderGcAccueil;
renderGcAccueil = function(main){
  gcsfAccueilOrigine(main);
  const body = document.getElementById('gc-body'); if(!body) return;
  const auj = getTodayISO(), P = gcsfLignesPlanning().filter(x => x.reste > 0), F = gcsfFactures().filter(f => factStatut(f) !== 'payee');
  const urg = P.filter(x => x.statut === 'retard' || (x.dateLivraison && x.dateLivraison <= GC.ajouterJours(auj, 14))).sort((a, b) => (a.dateLivraison || '').localeCompare(b.dateLivraison || ''));
  const att = P.filter(x => x.statut === 'attente'), echues = F.filter(gcsfEchue);
  const offres = gcD().offres.filter(o => !o.archive && o.statut === 'acceptee' && o.validite && o.validite >= auj && o.validite <= GC.ajouterJours(auj, 60));
  const ed = gcPeut();
  body.insertAdjacentHTML('afterbegin', `${typeof gcRepriseDisponible === 'function' && gcRepriseDisponible() ? gcRepriseBandeau() : ''}<div class="card gcsf-afaire" data-gc="a-faire"><h3 class="gc-h3">À faire</h3>
    ${urg.length ? urg.slice(0, 6).map(x => `<div class="session-row"><span>${gcsfBadge(x)} <b>${gcsfLibSemaine(x.dateLivraison)}</b> · ${esc(x.client)} · PO ${esc(x.po)} · ${gcsfQ(x.reste, x.l.unite)}</span>${ed ? `<button class="btn btn-primary" onclick="gcsfFormLivrer('${x.cmd.id}', '${x.l.lid}')">Livrer et facturer</button>` : ''}</div>`).join('') : '<div class="gc-sous">Aucune livraison en retard ni dans les 2 semaines.</div>'}
    ${att.length ? `<div class="gc-sous" style="margin-top:6px;">${att.length} déclaration(s) client attendue(s) : ${att.slice(0, 4).map(x => 'PO ' + esc(x.po) + ' (' + gcsfLibSemaine(x.dateLivraison, true) + ')').join(', ')}.</div>` : ''}
    <div class="gc-sous" style="margin-top:6px;">${F.length ? `<a href="#" onclick="gcsfAller('factures', {paie:'apayer'}); return false;">${F.length} facture(s) à encaisser · ${gcE(F.reduce((s, f) => s + factTotaux(f).ttc, 0))}</a>${echues.length ? ` · <b style="color:var(--bad);">${echues.length} échéance(s) dépassée(s)</b>` : ''}` : 'Toutes les factures sont payées.'}</div>
    ${offres.length ? `<div class="gc-sous" style="margin-top:4px;">Offre(s) qui expirent bientôt : ${offres.map(o => `<a href="#" onclick="gcOuvrir('gc-offre', '${o.id}'); return false;">${esc(o.numero)}</a> (${esc(gcNomClient(o.clientId))}, ${gcDt(o.validite)})`).join(', ')}.</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-ghost" onclick="nav('gc-planning')">Planning des livraisons</button><button class="btn btn-ghost" onclick="nav('gc-factures')">Factures</button></div></div>`);
};

// ---------- Navigation : Planning et Factures ----------
GC_GROUPES.ventes.onglets = [['gc-planning', 'Planning'], ['gc-commandes', 'Commandes'], ['gc-factures', 'Factures'], ['gc-livraisons', 'Livraisons'], ['gc-offres', 'Offres'], ['gc-demandes', 'Demandes de prix']];
const GCSF_ICONES = {
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h3v3H8z"/></svg>',
  facture:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>'
};
gcNavItems = function(){
  return [
    {tab:'gc-accueil', label:'Tableau de bord', court:'Accueil', icon:ICONS.dashboard, show:true},
    {tab:'gc-planning', label:'Planning des livraisons', court:'Planning', icon:GCSF_ICONES.cal, show:true},
    {tab:'gc-commandes', label:'Commandes et offres', court:'Commandes', icon:ICONS.trend, show:true},
    {tab:'gc-factures', label:'Factures et paiements', court:'Factures', icon:GCSF_ICONES.facture, show:true},
    {tab:'gc-catalogue', label:'Catalogue et clients', court:'Catalogue', icon:ICONS.prodchain, show:true, bas:false},
    {tab:'gc-besoins', label:'Achats et approvisionnement', court:'Achats', icon:ICONS.invoice, show:true, bas:false},
    {tab:'gc-stock', label:'Stock et lots', court:'Stock', icon:ICONS.box, show:true, bas:false},
    {tab:'gc-rentabilite', label:'Rentabilité et journal', court:'Rentabilité', icon:ICONS.stats, show:true, bas:false},
    {tab:'gc-plus', label:'Plus', icon:GC_ICONE_PLUS, show:true, cote:false, onclick:'gcMenuPlus()'}
  ];
};
const gcsfNavParentOrigine = gcNavParent;
gcNavParent = function(tab){ if(tab === 'gc-planning') return 'gc-planning'; if(tab === 'gc-factures') return 'gc-factures'; return gcsfNavParentOrigine(tab); };
window.gcMenuPlus = () => {
  mgtModal('CRM GADH', `<div class="gc-plus">${[['gc-clients', 'Clients', 'Coordonnées, offres, commandes, factures'], ['gc-catalogue', 'Catalogue articles', 'Articles, listes de prix, import'], ['gc-offres', 'Offres', 'Offres de prix et validité'],
    ['gc-besoins', 'Achats et approvisionnement', 'Besoins, commandes fournisseurs, réceptions'], ['gc-stock', 'Stock et lots', 'État du stock'], ['gc-tarifs', 'Tarifs fournisseurs', 'Prix négociés'], ['gc-fournisseurs', 'Fournisseurs', 'Coordonnées, délais'],
    ['gc-rentabilite', 'Rentabilité', 'Coûts et marges'], ['gc-journal', 'Journal', 'Historique des opérations'], ['gc-reglages', 'Réglages', 'Paramètres, sauvegardes, contrôles']]
    .map(([t, l, s]) => `<button class="session-row" style="width:100%;text-align:left;cursor:pointer;background:none;border:0;border-bottom:1px solid var(--border);" onclick="mgtFermer(); nav('${t}')"><span><b>${l}</b><br><span style="font-size:12px;color:var(--ink-soft);">${s}</span></span><b>›</b></button>`).join('')}</div>`);
};
const gcsfRenderGCOrigine = renderGC;
renderGC = function(tab, main){
  const R = {'gc-planning':window.renderGcPlanning, 'gc-factures':window.renderGcFactures};
  if(!R[tab]) return gcsfRenderGCOrigine(tab, main);
  gcStyle();
  try { R[tab](main); } catch(e){ console.error('CRM', tab, e); main.innerHTML = `<div class="card"><b>Affichage impossible</b><div class="gc-sous">${esc(e && e.message || String(e))}</div></div>`; }
  const g = gcGroupeDe(tab);
  if(g) main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets gc-onglets no-print">${g.onglets.map(([t, l]) => `<button class="${t === tab ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
};

// ---------- Exports : planning et factures ----------
const gcsfDefExportsOrigine = gcDefExports;
gcDefExports = function(){
  const d = gcsfDefExportsOrigine();
  d.planning = {titre:'Planning des livraisons', cols:[['Client', x => x.client, 't'], ['Commande (PO)', x => x.po, 't'], ['Ligne', x => x.n, 'q'], ['Article', x => x.l.ref || x.l.designation, 't'], ['Réf. client', x => x.l.refClient || '', 't'],
    ['Quantité', x => GC.num(x.l.qte), 'q'], ['Livré', x => x.livre, 'q'], ['Reste', x => x.reste, 'q'], ['Semaine de déclaration', x => x.dateDeclaration ? gcsfLibSemaine(x.dateDeclaration) : '', 't'], ['Semaine de livraison', x => gcsfLibSemaine(x.dateLivraison), 't'],
    ['Date souhaitée', x => x.dateLivraison, 'd'], ['État', x => GCSF_STATUTS[x.statut].label, 't'], ['BL', x => x.bls.map(b => b.numero).join(', '), 't'], ['Facture', x => x.facts.map(f => f.numero).join(', '), 't'], ['Remarque', x => x.l.note || '', 't']], somme:['Quantité', 'Livré', 'Reste']};
  d.factures = {titre:'Factures', cols:[['N° facture', f => f.numero, 't'], ['Date', f => f.date, 'd'], ['Client', f => gcNomClient(f.clientId), 't'], ['Commande (PO)', f => f.po || '', 't'], ['Livraison', f => (f.origine || {}).label || '', 't'],
    ['Quantité', f => GC.liste(f.lignes).reduce((s, l) => s + GC.num(l.qte), 0), 'q'], ['Montant HT', f => factTotaux(f).ht, 'e'], ['TVA', f => factTotaux(f).tva, 'e'], ['Montant TTC', f => factTotaux(f).ttc, 'e'], ['Échéance', f => f.echeance || '', 'd'],
    ['Paiement', f => FACT_STATUTS[factStatut(f)].label, 't'], ['Payée le', f => f.datePaiement || '', 'd']], somme:['Quantité', 'Montant HT', 'TVA', 'Montant TTC']};
  return d;
};

// ---------- Styles ----------
(function(){
  const s = document.createElement('style');
  s.textContent = `
  .gcsf-kpi .gc-chiffre b{font-size:20px;}
  .gcsf-act{display:flex;gap:6px;justify-content:flex-end;flex-wrap:nowrap;}
  .gcsf-petit{padding:5px 10px !important;min-height:30px !important;font-size:12.5px !important;}
  @media (max-width:760px){ .gcsf-act{flex-wrap:wrap;justify-content:flex-start;} }
  .gcsf-act .btn{padding:5px 9px;min-height:30px;font-size:12px;white-space:nowrap;}
  .gcsf-note{max-width:190px;white-space:normal;margin-top:3px;}
  .gct[data-gct="planning"] .gct-t td,.gct[data-gct="planning"] .gct-t th{padding:7px 7px;}
  tr.gcsf-retard td{background:var(--bad-bg, rgba(229,72,77,.08));}
  .gcsf-afaire .session-row{gap:10px;flex-wrap:wrap;}
  .gcsf-afaire .session-row .btn{padding:6px 12px;min-height:32px;font-size:12.5px;}
  .gcsf-cmd input,.gcsf-cmd select{min-width:110px;}
  .gc-kv b{overflow-wrap:anywhere;}
  .gcsf-grille th,.gcsf-grille td{white-space:nowrap;}
  .gct[data-gct="planning"] .gct-t td,.gct[data-gct="factures"] .gct-t td{vertical-align:middle;}
  `;
  document.head.appendChild(s);
})();
