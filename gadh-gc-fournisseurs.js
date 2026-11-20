// ============================================================
// CRM GADH — SUIVI FOURNISSEUR : commande fournisseur liée à la commande client,
// expéditions prévues (dates confirmées par le fournisseur), réception = entrée en stock,
// accords de prix d'achat réservés à un client, stock prévisionnel (arrivages − livraisons).
// Chargé après gadh-gc-suivi-clients.js.
// Données : commandes fournisseurs (gadh_gc_cmd_fournisseurs) dont chaque ligne est une
// expédition (dateLivraison = date d'expédition au plus tard, confirmee) ; accords de prix
// (nouvelle clé gadh_gc_accords) ; fournisseurs : transport (jours), incoterm, codes.
// ============================================================
const GCFR_CLE_ACCORDS = 'gadh_gc_accords';
function gcfrAccords(){ return GC.liste(getJSON(GCFR_CLE_ACCORDS, null)); }
function gcfrFour(id){ return gcD().fournisseurs.find(f => f.id === id) || {}; }
function gcfrTransport(fid){ const f = gcfrFour(fid); return f.transport !== undefined && f.transport !== '' ? GC.num(f.transport) : 0; }

// ---------- Prix d'achat : accord réservé au client, sinon tarif du fournisseur ----------
function gcfrAccordValable(fid, aid, clientId, date){
  const d = date || getTodayISO();
  return gcfrAccords().filter(a => !a.archive && a.fournisseurId === fid && a.articleId === aid && (!a.clientId || a.clientId === clientId) && (!a.debut || a.debut <= d) && (!a.fin || a.fin >= d))
    .sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0] || null;
}
function gcfrPrixAccord(ac, q){
  const P = GC.liste(ac.paliers).slice().sort((a, b) => a.min - b.min);
  const dans = P.filter(p => q >= p.min && (!p.max || q <= p.max));
  if(dans.length) return {prix:dans[dans.length - 1].prix, palier:dans[dans.length - 1], hors:false};
  const dessous = P.filter(p => q >= p.min);
  if(dessous.length) return {prix:dessous[dessous.length - 1].prix, palier:dessous[dessous.length - 1], hors:true};
  return null;
}
function gcfrPrixAchat(fid, aid, q, clientId, date){
  const ac = gcfrAccordValable(fid, aid, clientId, date);
  if(ac){ const r = gcfrPrixAccord(ac, q); if(r) return Object.assign({source:'accord', accord:ac}, r); }
  const t = GC.tarifAchat(gcD(), aid, fid, q, date || getTodayISO());
  return {prix:t.prix, source:t.source === 'tarif' ? 'tarif' : 'catalogue'};
}
function gcfrLibPalier(p){ return p ? (p.max ? gcQ(p.min) + ' – ' + gcQ(p.max) : '≥ ' + gcQ(p.min)) + (p.variante ? ' · ' + p.variante : '') : ''; }

// ---------- Arrivages : une ligne par expédition fournisseur ----------
const GCFR_STATUTS = {
  recue:{label:'Reçue en stock', cls:'good', ordre:6}, retard:{label:'En retard / à vérifier', cls:'bad', ordre:0}, a_receptionner:{label:'Arrivée prévue · à réceptionner', cls:'warn', ordre:1},
  partielle:{label:'Reçue en partie', cls:'warn', ordre:2}, confirmee:{label:'Confirmée par le fournisseur', cls:'', ordre:3}, commandee:{label:'Commandée · confirmation attendue', cls:'warn', ordre:4}, brouillon:{label:'Brouillon', cls:'', ordre:5}
};
function gcfrLignesArrivages(D){
  D = D || gcD();
  const rec = GC.recus(D), auj = getTodayISO(), out = [], C = GC.parId(D.cmdC);
  D.cmdF.forEach(cf => {
    if(cf.archive || cf.statut === 'annulee') return;
    GC.liste(cf.lignes).forEach((l, i) => {
      if(!(GC.num(l.qte) > 0)) return;
      const k = GC.cleLigne(cf.id, l.lid), recu = Math.min(GC.num(l.qte), rec[k] || 0), reste = GC.rq(GC.num(l.qte) - recu);
      if(reste > 0 && cf.statut === 'cloturee') return;
      const exp = l.dateLivraison || cf.datePrevue || '', arr = exp ? GC.ajouterJours(exp, gcfrTransport(cf.fournisseurId)) : '';
      const brs = D.receptions.filter(r => r.cfId === cf.id && !r.annulee && GC.liste(r.lignes).some(x => x.lid === l.lid));
      let st;
      if(reste <= 0.0005) st = 'recue';
      else if(cf.statut === 'brouillon') st = 'brouillon';
      else if(arr && GC.ajouterJours(arr, 7) < auj) st = 'retard';
      else if(arr && arr <= auj) st = 'a_receptionner';
      else if(recu > 0) st = 'partielle';
      else if(l.confirmee || cf.confirmation) st = 'confirmee';
      else st = 'commandee';
      const cc = C[cf.cmdClientId];
      out.push({id:k, cf, l, n:i + 1, recu, reste, exp, arr, brs, statut:st, four:gcNomFour(cf.fournisseurId), cmdClient:cc || null});
    });
  });
  return out;
}
function gcfrBadge(x){ return gcBadge(GCFR_STATUTS[x.statut]); }
window.renderGcArrivages = function(main){
  const D = gcD(), ed = gcPeut(), L = gcfrLignesArrivages(D), an = getTodayISO().slice(0, 4);
  const b = gcSection(main, 'Arrivages fournisseurs', (ed ? `<button class="btn btn-primary" data-gc="nouvelle-cf-client" onclick="gcfrFormCommande()">+ Commande fournisseur</button>` : '') + gcBoutonsExport('arrivages'));
  const ouv = L.filter(x => x.reste > 0), aRec = ouv.filter(x => x.statut === 'a_receptionner' || x.statut === 'retard');
  const recuAn = D.receptions.filter(r => !r.annulee && (r.date || '').slice(0, 4) === an).reduce((s, r) => s + GC.liste(r.lignes).reduce((t, l) => t + GC.num(l.qte), 0), 0);
  const u = ((ouv[0] || L[0] || {l:{}}).l.unite) || '';
  const fours = Array.from(new Set(L.map(x => x.cf.fournisseurId)));
  b.innerHTML = `<div class="gc-chiffres gcsf-kpi"><div class="gc-chiffre ${aRec.length ? 'bad' : ''}"><span>À réceptionner (date d'arrivée passée)</span><b>${aRec.length}</b></div>
      <div class="gc-chiffre"><span>En commande (reste à recevoir)</span><b>${gcsfQ(ouv.reduce((s, x) => s + x.reste, 0), u)}</b></div>
      <div class="gc-chiffre ${ouv.some(x => x.statut === 'commandee') ? 'warn' : ''}"><span>Confirmations attendues</span><b>${ouv.filter(x => x.statut === 'commandee').length}</b></div>
      <div class="gc-chiffre good"><span>Reçu en ${an}</span><b>${gcsfQ(recuAn, u)}</b></div></div>
    <div class="gc-sous" style="margin-bottom:8px;">Une ligne = une expédition prévue sur une commande fournisseur. L'arrivée estimée = date d'expédition + délai de transport du fournisseur. « Réceptionner » fait entrer la marchandise en stock (lot daté, sorti en premier : FIFO).</div>`
  + gcTable({id:'arrivages', lignes:() => gcfrLignesArrivages(), tri:3, sens:1, parPage:50, placeholder:'Commande, fournisseur, client…',
    texte:x => [x.cf.numero, x.four, x.cf.confirmation && x.cf.confirmation.reference, x.cmdClient && x.cmdClient.reference, x.l.ref, x.l.refFournisseur].concat(x.brs.map(r => r.numero)).join(' '),
    filtres:[
      {id:'etat', label:'État', defaut:'ouvertes', options:[['ouvertes', 'À recevoir'], ['recues', 'Reçues'], ['', 'Toutes les expéditions']], test:(x, v) => v === 'ouvertes' ? x.reste > 0 : x.reste <= 0},
      {id:'four', label:'Fournisseur', options:[['', 'Fournisseur : tous']].concat(fours.map(id => [id, 'Fournisseur : ' + gcNomFour(id)])), test:(x, v) => x.cf.fournisseurId === v}
    ],
    colonnes:(fours.length > 1 ? [{titre:'Fournisseur', val:x => x.four, html:x => `<b>${esc(x.four)}</b>`}] : []).concat([
      {titre:'Commande', val:x => x.cf.numero, html:x => `<a href="#" onclick="event.stopPropagation(); gcOuvrir('gc-achat', '${x.cf.id}'); return false;"><b>${esc(x.cf.numero || 'brouillon')}</b></a><div class="gc-sous">${x.cf.confirmation ? 'conf. ' + esc(x.cf.confirmation.reference || '') : 'expédition ' + x.n}</div>`},
      {titre:'Pour le client', val:x => x.cmdClient ? x.cmdClient.reference : '', html:x => x.cmdClient ? `${esc(gcNomClient(x.cmdClient.clientId))}<div class="gc-sous">PO ${esc(x.cmdClient.reference || x.cmdClient.numero)}</div>` : '<span class="gc-sous">stock</span>'},
      {titre:'Quantité', num:true, tri:x => GC.num(x.l.qte), html:x => `<b>${gcsfQ(x.l.qte, x.l.unite)}</b><div class="gc-sous">${esc(x.l.ref || '')}${x.recu > 0 && x.reste > 0 ? ' · reste ' + gcQ(x.reste) : ''}</div>`},
      {titre:'Expédition → arrivée', val:x => x.exp, html:x => `<b>${gcDt(x.exp)}</b> <span class="gc-sous">${esc((gcfrFour(x.cf.fournisseurId).incoterm || '').split(' ')[0])}</span><div class="gc-sous">arrivée ${gcsfLibSemaine(x.arr)}</div>`},
      {titre:'État', tri:x => GCFR_STATUTS[x.statut].ordre, html:x => gcfrBadge(x) + (x.l.note ? `<div class="gc-sous gcsf-note">${esc(x.l.note)}</div>` : '')},
      {titre:'Réception', tri:false, html:x => x.brs.map(r => `<a href="#" onclick="event.stopPropagation(); gcOuvrir('gc-reception', '${r.id}'); return false;">${esc(r.numero)}</a> <span class="gc-sous">${gcDt(r.date)}</span>`).join('<br>') || '—'},
      {titre:'', tri:false, html:x => !ed || x.reste <= 0 ? '' : `<div class="gcsf-act">${x.statut === 'commandee' ? `<button class="btn btn-ghost" onclick="event.stopPropagation(); gcfrFormConfirmation('${x.cf.id}')">Confirmation</button>` : ''}${x.statut !== 'brouillon' ? `<button class="btn btn-primary" data-gc="receptionner-exp" onclick="event.stopPropagation(); gcfrFormRecevoir('${x.cf.id}', '${x.l.lid}')">Réceptionner</button>` : ''}<button class="btn btn-ghost" title="Modifier la date ou la quantité" onclick="event.stopPropagation(); gcfrFormLigne('${x.cf.id}', '${x.l.lid}')">✎</button></div>`}
    ]),
    ligneAttr:x => x.statut === 'retard' ? 'class="gcsf-retard gct-clic"' : '',
    clic:x => `gcOuvrir('gc-achat', '${x.cf.id}')`, vide:'Aucun arrivage', videSous:'Créez une commande fournisseur avec ses expéditions prévues.'});
};

// ---------- Réception d'une expédition (entrée en stock) ----------
// Livraisons client faites avant que le stock soit suivi (sans sortie de stock) : on peut les
// rattacher au lot reçu, pour que le stock et le coût réel soient justes.
function gcfrLivraisonsSansStock(D, articleId){
  return D.livraisons.filter(b => !b.annulee && GC.liste(b.lignes).some(l => l.articleId === articleId && l.coutTheorique && GC.qteNetteLigne(l) > 0))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}
window.gcfrFormRecevoir = (cfId, lidChoisi) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), cf = D.cmdF.find(x => x.id === cfId); if(!cf) return;
  const rec = GC.recus(D), auj = getTodayISO();
  const L = GC.liste(cf.lignes).map(l => ({l, reste:GC.rq(GC.num(l.qte) - (rec[GC.cleLigne(cfId, l.lid)] || 0))})).filter(x => x.reste > 0);
  const choisie = (L.find(x => x.l.lid === lidChoisi) || L[0] || {l:{}}).l;
  const arts = Array.from(new Set(L.map(x => x.l.articleId).filter(Boolean)));
  const sans = arts.reduce((s, a) => s.concat(gcfrLivraisonsSansStock(D, a).filter(b => (b.date || '') >= (cf.date || '')).map(b => ({b, a}))), []);
  const premiere = GC.liste(cf.lignes).map(l => l.dateLivraison || cf.datePrevue).filter(Boolean).sort()[0] || cf.date;
  mgtModal('Réception · ' + esc(cf.numero || ''), `<p style="margin-top:0;"><b>${esc(gcNomFour(cf.fournisseurId))}</b> · cochez l'expédition reçue.</p>
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th></th><th>Expédition</th><th>Article</th><th>Quantité reçue</th><th>Prix d'achat</th><th>N° de lot</th></tr></thead><tbody>
    ${L.map(x => `<tr><td data-l="Reçue"><input type="checkbox" class="gfr-c" data-lid="${x.l.lid}" ${x.l.lid === choisie.lid ? 'checked' : ''} style="width:20px;height:20px;min-width:0;"></td><td data-l="Expédition">${gcDt(x.l.dateLivraison || cf.datePrevue)}</td><td data-l="Article">${esc(x.l.ref || x.l.designation || '')}</td>
      <td data-l="Quantité"><input type="number" class="gfr-q" data-lid="${x.l.lid}" min="0" max="${x.reste}" step="any" value="${x.reste}"></td><td data-l="Prix"><input type="number" class="gfr-pu" data-lid="${x.l.lid}" min="0" step="any" value="${gcAttr(x.l.pu)}"></td><td data-l="Lot"><input class="gfr-lot" data-lid="${x.l.lid}" placeholder="facultatif"></td></tr>`).join('')}</tbody></table></div>
    <div class="gc-form" style="margin-top:8px;">${mgtChamp('Date d\'arrivée chez GADH', 'gfr-date', auj, 'date')}${mgtChamp('Bon de livraison / facture du fournisseur', 'gfr-ref', '')}</div>
    <div class="field"><label>Frais d'approche (transport, transit, douane) : ajoutés au coût du lot</label>${gcFormFrais('gfrf', [], true)}</div>
    ${sans.length ? `<div class="card" style="padding:10px 12px;margin:8px 0;" data-gc="rattacher"><b>Livraisons client déjà faites avec cette marchandise ?</b>
      <div class="gc-sous" style="margin:4px 0 6px;">Ces livraisons ont été faites sans sortie de stock dans la CRM. Cochées, elles sont sorties de ce lot : le stock restant et le coût réel des livraisons deviennent justes.</div>
      ${sans.map(({b}) => { const q = GC.liste(b.lignes).filter(l => l.coutTheorique).reduce((s, l) => s + GC.qteNetteLigne(l), 0); return `<label style="display:flex;gap:8px;align-items:center;padding:3px 0;"><input type="checkbox" class="gfr-bl" data-bl="${b.id}" ${(b.date || '') >= premiere ? 'checked' : ''} style="width:18px;height:18px;min-width:0;"> ${esc(b.numero)} du ${gcDt(b.date)} · ${esc(gcNomClient(b.clientId))} · ${gcQ(q)}</label>`; }).join('')}</div>` : ''}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-reception-exp" onclick="gcfrValiderRecevoir('${cfId}')">Enregistrer l'arrivée en stock</button>`);
};
window.gcfrValiderRecevoir = (cfId) => gcOperation(() => {
  const val = (cls, lid) => (document.querySelector('.' + cls + '[data-lid="' + lid + '"]') || {}).value;
  const saisies = Array.from(document.querySelectorAll('.gfr-c')).filter(e => e.checked).map(e => ({lid:e.dataset.lid, qte:GC.num(val('gfr-q', e.dataset.lid)), pu:val('gfr-pu', e.dataset.lid), lot:(val('gfr-lot', e.dataset.lid) || '').trim()})).filter(s => s.qte > 0);
  if(!saisies.length){ showToast('Cochez l\'expédition reçue et sa quantité'); return; }
  const date = gcVal('gfr-date') || getTodayISO(); if(date > getTodayISO()){ showToast('La date d\'arrivée ne peut pas être dans le futur'); return; }
  const frais = gcLireFrais('gfrf'); if(frais.some(f => f.montant < 0)){ showToast('Montant de frais négatif'); return; }
  const blIds = Array.from(document.querySelectorAll('.gfr-bl')).filter(e => e.checked).map(e => e.dataset.bl);
  const D = gcD(), cf = D.cmdF.find(x => x.id === cfId);
  const r = GC.receptionner(D, cfId, saisies, gcCtx({date, reference:gcVal('gfr-ref'), frais}));
  gcEnregistrer('receptions', r.reception); if(r.mouvements.length) gcEnregistrer('mouvements', r.mouvements);
  // date prévue de la commande = prochaine expédition encore attendue
  const recApres = GC.recus(gcD()), prochaine = GC.liste(cf.lignes).filter(l => GC.num(l.qte) - (recApres[GC.cleLigne(cfId, l.lid)] || 0) > 0.0005).map(l => l.dateLivraison).filter(Boolean).sort()[0];
  gcEnregistrer('cmdF', Object.assign({}, cf, {datePrevue:prochaine || cf.datePrevue, historique:gcHistoCF(cf, 'Réception ' + r.reception.numero + (r.statut === 'recue' ? ' (complète)' : ' (partielle)'))}));
  const rat = blIds.length ? gcfrRattacher(blIds, Array.from(new Set(r.reception.lignes.map(l => l.articleId)))) : {n:0, q:0, erreurs:[]};
  gcJournal('Réception', 'Commande fournisseur', cf, r.reception.numero + ' · ' + r.reception.lignes.map(l => gcQ(l.qte) + ' ' + (l.unite || '')).join(' + ') + (rat.n ? ' · ' + rat.n + ' livraison(s) rattachée(s) au stock' : ''));
  mgtFermer();
  const st = r.reception.lignes.map(l => { const s = GC.stockArticle(gcD(), l.articleId); return gcQ(s.physique) + ' ' + esc(l.unite || '') + ' en stock (' + esc(l.designation || '') + ')'; }).join('<br>');
  mgtModal('Arrivée enregistrée', `<p style="margin-top:0;">Bon de réception <b>${esc(r.reception.numero)}</b> créé.${rat.n ? ' ' + rat.n + ' livraison(s) client sortie(s) de ce stock (' + gcQ(rat.q) + ').' : ''}</p><p><b>${st}</b></p>${rat.erreurs.length ? '<div class="gc-alerte">' + rat.erreurs.map(esc).join('<br>') + '</div>' : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="mgtFermer(); nav('gc-previsionnel')">Voir le stock prévisionnel</button><button class="btn btn-ghost" onclick="gcDocument('reception', '${r.reception.id}', 'print')">Imprimer le bon de réception</button></div>`);
  nav(activeTab);
});
function gcfrRattacher(blIds, articleIds){
  const D = gcD(), conso = {}, maj = [], mvts = [], erreurs = [], ctx = gcCtx(); let n = 0, q = 0;
  D.livraisons.filter(b => blIds.indexOf(b.id) >= 0).sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(b => {
    let change = false;
    const lignes = b.lignes.map(l => {
      if(!l.coutTheorique || articleIds.indexOf(l.articleId) < 0) return l;
      const besoin = GC.qteNetteLigne(l);
      const lotsA = GC.lots(D, l.articleId).map(x => Object.assign({}, x, {reste:GC.rq(x.reste - (conso[x.id] || 0))}));
      let al;
      try { al = GC.allouerFIFO(lotsA, besoin); } catch(e){ erreurs.push(b.numero + ' : stock reçu insuffisant pour la rattacher (' + gcQ(besoin) + ')'); return l; }
      al.forEach(a => { conso[a.lotId] = GC.rq((conso[a.lotId] || 0) + a.qte); mvts.push({id:GC.nouvelId('mv'), type:'sortie', date:b.date, ts:GC.num(b.ts) || Date.now(), par:ctx.par, articleId:l.articleId, lotId:a.lotId, qte:a.qte, livraisonId:b.id, cmdId:b.cmdId, lid:l.lid, motif:'Livraison ' + b.numero + ' (rattachée au stock le ' + gcDt(ctx.date) + ')'}); });
      change = true; q += besoin;
      const nl = Object.assign({}, l, {allocations:al, rattachement:{date:ctx.date, par:ctx.par, coutTheorique:l.coutUnitTheorique}}); delete nl.coutTheorique; delete nl.coutUnitTheorique; return nl;
    });
    if(change){ n++; maj.push(Object.assign({}, b, {lignes})); }
  });
  if(maj.length) gcEnregistrer('livraisons', maj);
  if(mvts.length) gcEnregistrer('mouvements', mvts);
  return {n, q, erreurs};
}

// ---------- Confirmation du fournisseur (dates d'expédition validées) ----------
window.gcfrFormConfirmation = (cfId) => {
  if(!gcPeut()) return gcRefus();
  const cf = gcD().cmdF.find(x => x.id === cfId); if(!cf) return; const c = cf.confirmation || {};
  mgtModal('Confirmation du fournisseur · ' + esc(cf.numero || ''), `<div class="gc-form">${mgtChamp('N° de confirmation', 'gfc-ref', c.reference || '')}${mgtChamp('Date', 'gfc-date', c.date || getTodayISO(), 'date')}${mgtChamp('Suivie par', 'gfc-par', c.suiviPar || '')}</div>
    <h4 style="margin:6px 0;">Dates d'expédition confirmées</h4>
    ${GC.liste(cf.lignes).map(l => `<div class="gc-form">${mgtChamp(gcQ(l.qte) + ' ' + esc(l.unite || '') + ' · demandé le ' + gcDt(l.dateLivraison || cf.datePrevue), 'gfc-d-' + l.lid, l.dateLivraison || cf.datePrevue || '', 'date')}</div>`).join('')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-confirmation-fr" onclick="gcfrValiderConfirmation('${cfId}')">Enregistrer la confirmation</button>`);
};
window.gcfrValiderConfirmation = (cfId) => gcOperation(() => {
  const cf = gcD().cmdF.find(x => x.id === cfId), ch = [];
  const lignes = cf.lignes.map(l => { const d = gcVal('gfc-d-' + l.lid) || l.dateLivraison; if(d !== l.dateLivraison) ch.push(gcQ(l.qte) + ' : ' + gcDt(l.dateLivraison) + ' → ' + gcDt(d)); return Object.assign({}, l, {dateLivraison:d, confirmee:true}); });
  const n = Object.assign({}, cf, {statut:'confirmee', lignes, datePrevue:lignes.map(l => l.dateLivraison).filter(Boolean).sort()[0] || cf.datePrevue,
    confirmation:{date:gcVal('gfc-date') || getTodayISO(), reference:gcVal('gfc-ref'), suiviPar:gcVal('gfc-par'), par:gcPar()}, historique:gcHistoCF(cf, 'Confirmation fournisseur ' + gcVal('gfc-ref'), ch.join(' · ') || 'dates acceptées')});
  gcEnregistrer('cmdF', n); gcJournal('Confirmation fournisseur', 'Commande fournisseur', n, gcVal('gfc-ref') + (ch.length ? ' · ' + ch.join(' · ') : ''));
  mgtFermer(); showToast('Confirmation enregistrée'); nav(activeTab);
});
window.gcfrFormLigne = (cfId, lid) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), cf = D.cmdF.find(x => x.id === cfId), l = cf && cf.lignes.find(y => y.lid === lid); if(!l) return;
  const recu = GC.recus(D)[GC.cleLigne(cfId, lid)] || 0;
  mgtModal('Expédition · ' + esc(cf.numero || ''), `<div class="gc-form">${mgtChamp('Quantité' + (recu ? ' (déjà reçu ' + gcQ(recu) + ')' : ''), 'gfl-qte', l.qte, 'number', 'min="' + recu + '" step="any"')}${mgtChamp('Expédition au plus tard le', 'gfl-date', l.dateLivraison || cf.datePrevue || '', 'date')}</div>
    ${mgtChamp('Remarque', 'gfl-note', l.note || '')}<button class="btn btn-primary" style="width:100%;" onclick="gcfrSauverLigne('${cfId}', '${lid}')">Enregistrer</button>`);
};
window.gcfrSauverLigne = (cfId, lid) => gcOperation(() => {
  const D = gcD(), cf = D.cmdF.find(x => x.id === cfId), recu = GC.recus(D)[GC.cleLigne(cfId, lid)] || 0, q = GC.num(gcVal('gfl-qte'));
  if(!(q > 0) || q + 1e-9 < recu){ showToast('Quantité invalide (déjà reçu ' + gcQ(recu) + ')'); return; }
  const lignes = cf.lignes.map(l => l.lid === lid ? Object.assign({}, l, {qte:q, dateLivraison:gcVal('gfl-date'), note:gcVal('gfl-note')}) : l);
  gcEnregistrer('cmdF', Object.assign({}, cf, {lignes, datePrevue:lignes.map(l => l.dateLivraison).filter(Boolean).sort()[0] || cf.datePrevue, historique:gcHistoCF(cf, 'Modification de l\'expédition ' + lid, gcQ(q) + ' le ' + gcDt(gcVal('gfl-date')))}));
  mgtFermer(); showToast('Expédition mise à jour'); nav(activeTab);
});

// ---------- Nouvelle commande fournisseur (liée à une commande client) ----------
function gcfrNumeroCF(date){
  const yy = String(date || getTodayISO()).slice(2, 4), re = new RegExp('^CD0?' + yy + '-0*(\\d+)$'); let max = 0;
  gcD().cmdF.forEach(c => { const m = re.exec(String(c.numero || '').replace(/\s+/g, '')); if(m) max = Math.max(max, +m[1]); });
  return 'CD0' + yy + '-' + String(max + 1).padStart(3, '0');
}
let gcfrCmd = null;
window.gcfrFormCommande = (init) => {
  if(!gcPeut()) return gcRefus();
  init = init || {};
  const D = gcD(), cc = init.cmdClientId ? D.cmdC.find(c => c.id === init.cmdClientId) : null;
  let art = init.articleId || '', fid = init.fournisseurId || '', lignes = [{qte:'', date:''}];
  if(cc){
    const liv = GC.livres(D), rest = GC.liste(cc.lignes).map(l => ({l, r:GC.rq(GC.num(l.qte) - (liv[GC.cleLigne(cc.id, l.lid)] || 0))})).filter(x => x.r > 0);
    art = art || (rest[0] || {l:{}}).l.articleId || '';
    const a = D.articles.find(x => x.id === art) || {}; fid = fid || a.fournisseurId || '';
    const tr = gcfrTransport(fid) + 7, besoin = rest.filter(x => x.l.articleId === art).reduce((s, x) => s + x.r, 0), d0 = rest.map(x => x.l.dateLivraison).filter(Boolean).sort()[0];
    const dejaCmd = gcfrLignesArrivages(D).filter(x => x.cf.cmdClientId === cc.id && x.l.articleId === art).reduce((s, x) => s + x.reste, 0);
    const tot = GC.rq(Math.max(0, besoin - dejaCmd));
    lignes = [{qte:tot || '', date:d0 ? GC.ajouterJours(d0, -tr) : ''}];
    init.info = dejaCmd ? 'Reste à livrer au client : ' + gcQ(besoin) + ' · déjà en commande chez le fournisseur : ' + gcQ(dejaCmd) + (tot ? ' · à commander : ' + gcQ(tot) : ' · rien à commander en plus') : '';
  }
  gcfrCmd = {fournisseurId:fid, articleId:art, cmdClientId:cc ? cc.id : '', numero:gcfrNumeroCF(), date:getTodayISO(), note:'', lignes, info:init.info || ''};
  gcfrDessinerCommande();
};
function gcfrLire(){
  const v = (id) => { const e = document.getElementById(id); return e ? e.value : undefined; };
  [['four', 'fournisseurId'], ['art', 'articleId'], ['cc', 'cmdClientId'], ['num', 'numero'], ['date', 'date'], ['note', 'note'], ['pu', 'pu']].forEach(([k, c]) => { const x = v('gfo-' + k); if(x !== undefined) gcfrCmd[c] = x; });
  gcfrCmd.lignes.forEach((l, i) => { const q = v('gfo-q-' + i), d = v('gfo-d-' + i); if(q !== undefined) l.qte = q; if(d !== undefined) l.date = d; });
}
window.gcfrCmdChange = (champ) => {
  gcfrLire();
  if(champ === 'pu') gcfrCmd.puManuel = true;
  if(champ === 'art' || champ === 'four' || champ === 'cc') gcfrCmd.puManuel = false;
  if(champ === 'art'){ const a = gcD().articles.find(x => x.id === gcfrCmd.articleId); if(a && a.fournisseurId && !gcfrCmd.fournisseurId) gcfrCmd.fournisseurId = a.fournisseurId; }
  setTimeout(gcfrDessinerCommande, 0);
};
window.gcfrCmdAjouter = () => { gcfrLire(); const d = gcfrCmd.lignes[gcfrCmd.lignes.length - 1] || {}; gcfrCmd.lignes.push({qte:'', date:d.date ? GC.ajouterMois(d.date, 1) : ''}); gcfrDessinerCommande(); };
window.gcfrCmdRetirer = (i) => { gcfrLire(); gcfrCmd.lignes.splice(i, 1); if(!gcfrCmd.lignes.length) gcfrCmd.lignes.push({}); gcfrDessinerCommande(); };
function gcfrDessinerCommande(){
  const D = gcD(), C = gcfrCmd, cc = D.cmdC.find(c => c.id === C.cmdClientId), tot = C.lignes.reduce((s, l) => s + GC.num(l.qte), 0);
  const p = C.fournisseurId && C.articleId ? gcfrPrixAchat(C.fournisseurId, C.articleId, tot, cc ? cc.clientId : '', C.date) : null;
  if(p && !C.puManuel) C.pu = p.prix;
  const a = D.articles.find(x => x.id === C.articleId) || {}, u = a.unite || '';
  const ouvertes = D.cmdC.filter(c => !c.archive && ['confirmee', 'partielle'].indexOf(GC.statutCmdC(c, GC.livres(D)).cle) >= 0);
  const srcLib = !p ? '' : p.source === 'accord' ? `Accord ${esc(p.accord.numero)}${p.accord.clientId ? ' réservé ' + esc(gcNomClient(p.accord.clientId)) : ''} · palier ${gcfrLibPalier(p.palier)}${p.hors ? ' · <b style="color:var(--bad);">quantité hors palier : prix à confirmer</b>' : ''}` : p.source === 'tarif' ? 'Tarif du fournisseur' : 'Prix d\'achat du catalogue';
  const ecart = p && C.puManuel && Math.abs(GC.num(C.pu) - p.prix) > 1e-9;
  mgtModal('Nouvelle commande fournisseur', `<div class="gc-form">
      <div class="field"><label>Pour la commande client</label><select id="gfo-cc" onchange="gcfrCmdChange('cc')">${gcOpts(ouvertes.map(c => [c.id, gcNomClient(c.clientId) + ' · PO ' + (c.reference || c.numero)]), C.cmdClientId, '— Stock (sans client) —')}</select></div>
      <div class="field"><label>Fournisseur *</label><select id="gfo-four" onchange="gcfrCmdChange('four')">${gcOptsFour(C.fournisseurId, '— Choisir —')}</select></div>
      ${mgtChamp('N° de commande', 'gfo-num', C.numero)}${mgtChamp('Date', 'gfo-date', C.date, 'date')}
      <div class="field"><label>Article *</label><select id="gfo-art" onchange="gcfrCmdChange('art')">${gcOptsArticles(C.articleId, '— Choisir —')}</select></div>
      <div class="field"><label>Prix d'achat unitaire</label><input id="gfo-pu" type="number" min="0" step="any" value="${gcAttr(C.pu || '')}" onchange="gcfrCmdChange('pu')"><div class="gc-sous" style="${ecart ? 'color:var(--bad);' : ''}">${ecart ? 'Prix prévu : ' + gcE(p.prix) + ' · ' : ''}${srcLib}</div></div></div>
    ${C.info ? `<div class="gc-alerte" style="margin-bottom:6px;">${esc(C.info)}</div>` : ''}${cc ? `<div class="gc-sous" style="margin-bottom:6px;">Livraisons client à couvrir (PO ${esc(cc.reference || cc.numero)}) : ${gcsfLignesPlanning(D).filter(x => x.cmd.id === cc.id && x.reste > 0).map(x => gcQ(x.reste) + ' ' + gcsfLibSemaine(x.dateLivraison, true)).join(' · ') || 'aucune'}</div>` : ''}
    <h4 style="margin:6px 0;">Expéditions demandées au fournisseur</h4>
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Quantité</th><th>Expédition au plus tard le</th><th></th></tr></thead><tbody>
    ${C.lignes.map((l, i) => `<tr><td data-l="Quantité"><input id="gfo-q-${i}" type="number" min="0" step="any" value="${gcAttr(l.qte)}" onchange="gcfrCmdChange('q')">${u ? '<span class="gc-sous"> ' + esc(u) + '</span>' : ''}</td><td data-l="Expédition"><input id="gfo-d-${i}" type="date" value="${gcAttr(l.date || '')}"></td><td><button class="btn btn-ghost" onclick="gcfrCmdRetirer(${i})">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;"><button class="btn btn-ghost" onclick="gcfrCmdAjouter()">+ Ajouter une expédition</button><b>${gcQ(tot)} ${esc(u)} · ${gcE(GC.r2(tot * GC.num(C.pu)))} HT</b></div>
    ${mgtZone('Remarque (imprimée sur la commande)', 'gfo-note', C.note)}
    <button class="btn btn-primary" style="width:100%;" data-gc="enregistrer-cf-client" onclick="gcfrEnregistrer()">Enregistrer la commande fournisseur</button>`);
}
window.gcfrEnregistrer = () => gcOperation(() => {
  gcfrLire();
  const C = gcfrCmd, D = gcD(), a = D.articles.find(x => x.id === C.articleId), cc = D.cmdC.find(c => c.id === C.cmdClientId), f = gcfrFour(C.fournisseurId);
  if(!f.id){ showToast('Choisissez le fournisseur'); return; } if(!a){ showToast('Choisissez l\'article'); return; }
  const L = C.lignes.filter(l => GC.num(l.qte) > 0); if(!L.length){ showToast('Indiquez au moins une expédition'); return; }
  if(L.some(l => !l.date)){ showToast('Indiquez la date d\'expédition de chaque ligne'); return; }
  if(!(GC.num(C.pu) > 0)){ showToast('Indiquez le prix d\'achat'); return; }
  const num = String(C.numero || '').trim() || gcfrNumeroCF(C.date); if(D.cmdF.some(x => x.numero === num)){ showToast('Le numéro ' + num + ' existe déjà'); return; }
  const tot = L.reduce((s, l) => s + GC.num(l.qte), 0), p = gcfrPrixAchat(f.id, a.id, tot, cc ? cc.clientId : '', C.date);
  const lignes = L.sort((x, y) => x.date.localeCompare(y.date)).map((l, i) => ({lid:'l' + (i + 1), articleId:a.id, ref:a.ref || '', designation:a.designation || '', unite:a.unite || '', qte:GC.num(l.qte), pu:GC.num(C.pu), refFournisseur:'', dateLivraison:l.date}));
  const cf = {id:GC.nouvelId('cf'), numero:num, fournisseurId:f.id, date:C.date || getTodayISO(), datePrevue:lignes[0].dateLivraison, statut:'envoyee', tva:0, fraisPrevus:0, paiements:[], reference:'', note:C.note || '',
    lignes, cmdClientId:cc ? cc.id : '', clientId:cc ? cc.clientId : '', accordId:p.source === 'accord' ? p.accord.id : '', incoterm:f.incoterm || '', conditions:f.conditions || '',
    envoi:{date:C.date || getTodayISO(), par:gcPar()}, historique:[{ts:Date.now(), date:getTodayISO(), par:gcPar(), action:'Création et envoi au fournisseur', motif:''}]};
  gcEnregistrer('cmdF', cf);
  gcJournal('Création', 'Commande fournisseur', cf, lignes.length + ' expédition(s) · ' + gcQ(tot) + ' ' + (a.unite || '') + ' · ' + gcE(GC.r2(tot * GC.num(C.pu))) + ' HT' + (cc ? ' · pour PO ' + (cc.reference || cc.numero) : ''));
  gcfrCmd = null; mgtFermer(); showToast('Commande ' + num + ' enregistrée : ' + lignes.length + ' expédition(s) aux arrivages'); gcOuvrir('gc-achat', cf.id);
});

// ---------- Fiche commande fournisseur : expéditions en tête ----------
const gcfrFicheCFOrigine = window.renderGcAchat;
window.renderGcAchat = function(main){
  gcfrFicheCFOrigine(main);
  const D = gcD(), cf = D.cmdF.find(x => x.id === gcOuvert['gc-achat']), body = document.getElementById('gc-body'); if(!cf || !body) return;
  const L = gcfrLignesArrivages(D).filter(x => x.cf.id === cf.id), ed = gcPeut() && !cf.archive, f = gcfrFour(cf.fournisseurId), t = gcTotauxCF(cf);
  const cc = D.cmdC.find(c => c.id === cf.cmdClientId), ac = cf.accordId ? gcfrAccords().find(a => a.id === cf.accordId) : null;
  if(L.length) document.querySelectorAll('.gc-actions [data-gc="receptionner"], .gc-actions [data-gc="confirmer-cf"]').forEach(e => e.remove());
  const qT = L.reduce((s, x) => s + GC.num(x.l.qte), 0), qR = L.reduce((s, x) => s + x.recu, 0), u = (L[0] || {l:{}}).l.unite || '';
  const pv = cc ? (GC.liste(cc.lignes)[0] || {}).pu : null, pa = (GC.liste(cf.lignes)[0] || {}).pu;
  body.insertAdjacentHTML('afterbegin', `<div class="card" data-gc="expeditions-cf"><h3 class="gc-h3">${esc(cf.numero || '')} · ${esc(gcNomFour(cf.fournisseurId))}${cf.confirmation ? ' ' + gcBadge({label:'Confirmée ' + (cf.confirmation.reference || '') + ' du ' + gcDt(cf.confirmation.date), cls:'good'}) : ' ' + gcBadge({label:'Confirmation attendue', cls:'warn'})}</h3>
    <div class="gc-chiffres"><div class="gc-chiffre"><span>Commandé</span><b>${gcsfQ(qT, u)}</b></div><div class="gc-chiffre good"><span>Reçu en stock</span><b>${gcsfQ(qR, u)}</b></div><div class="gc-chiffre ${qT - qR > 0 ? 'warn' : ''}"><span>Reste à recevoir</span><b>${gcsfQ(GC.rq(qT - qR), u)}</b></div>
      <div class="gc-chiffre"><span>Montant HT</span><b>${gcE(t.ht)}</b></div><div class="gc-chiffre ${t.reste > 0 ? 'warn' : ''}"><span>Reste à payer</span><b>${gcE(t.reste)}</b></div>
      ${pv && pa ? `<div class="gc-chiffre good"><span>Marge prévue (vente ${gcE(pv)} − achat ${gcE(pa)})</span><b>${gcE(GC.r2((pv - pa) * qT))}</b></div>` : ''}</div>
    <div class="gc-sous" style="margin-bottom:6px;">${cc ? `Pour <a href="#" onclick="gcOuvrir('gc-commande', '${cc.id}'); return false;">${esc(gcNomClient(cc.clientId))} · PO ${esc(cc.reference || cc.numero)}</a> · ` : ''}${ac ? `Prix : accord <b>${esc(ac.numero)}</b>${ac.clientId ? ' réservé ' + esc(gcNomClient(ac.clientId)) : ''} (valable au ${gcDt(ac.fin)}) · ` : ''}${esc(cf.incoterm || f.incoterm || '')}${cf.conditions || f.conditions ? ' · paiement ' + esc(cf.conditions || f.conditions) : ''}${cf.confirmation && cf.confirmation.suiviPar ? ' · suivie par ' + esc(cf.confirmation.suiviPar) : ''}</div>
    ${cf.note ? `<div class="gc-sous" style="margin-bottom:6px;white-space:pre-line;">${esc(cf.note)}</div>` : ''}
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Expédition</th><th class="n">Quantité</th><th class="n">Prix</th><th>Arrivée estimée</th><th>État</th><th>Réception</th><th></th></tr></thead><tbody>
    ${L.map(x => `<tr class="${x.statut === 'retard' ? 'gcsf-retard' : ''}"><td data-l="Expédition"><b>${gcDt(x.exp)}</b><div class="gc-sous">${x.l.confirmee || cf.confirmation ? 'date confirmée' : 'au plus tard'}</div></td><td class="n" data-l="Quantité">${gcsfQ(x.l.qte, x.l.unite)}</td><td class="n" data-l="Prix">${gcE(x.l.pu)}</td>
      <td data-l="Arrivée">${gcsfLibSemaine(x.arr)}</td><td data-l="État">${gcfrBadge(x)}</td><td data-l="Réception">${x.brs.map(r => `<a href="#" onclick="gcOuvrir('gc-reception', '${r.id}'); return false;">${esc(r.numero)}</a> ${gcDt(r.date)}`).join('<br>') || '—'}</td>
      <td>${ed && x.reste > 0 ? `<div class="gcsf-act"><button class="btn btn-primary" onclick="gcfrFormRecevoir('${cf.id}', '${x.l.lid}')">Réceptionner</button><button class="btn btn-ghost" onclick="gcfrFormLigne('${cf.id}', '${x.l.lid}')">✎</button></div>` : ''}</td></tr>`).join('')}
    </tbody></table></div>${ed && !cf.confirmation ? `<button class="btn btn-ghost" style="margin-top:8px;" onclick="gcfrFormConfirmation('${cf.id}')">Enregistrer la confirmation du fournisseur</button>` : ''}</div>`);
};
// Bon de commande imprimé : date d'expédition de chaque ligne
const gcfrModeleDocOrigine = gcModeleDoc;
gcModeleDoc = function(type, id){
  const m = gcfrModeleDocOrigine(type, id);
  if(m && type === 'achat'){
    const cf = gcD().cmdF.find(x => x.id === id), f = gcfrFour(cf && cf.fournisseurId);
    if(cf){ GC.liste(cf.lignes).forEach((l, i) => { if(l.dateLivraison && m.tables[0].lignes[i]) m.tables[0].lignes[i][2] += ' — expédition ' + (cf.incoterm || f.incoterm || '') + ' au plus tard le ' + gcDt(l.dateLivraison); });
      if(f.codeFournisseur) m.infos.push(['Code fournisseur', f.codeFournisseur]); if(f.codeClient) m.infos.push(['Notre code client', f.codeClient]);
      const ac = cf.accordId && gcfrAccords().find(a => a.id === cf.accordId); if(ac) m.notes.unshift('Prix selon votre offre ' + ac.numero + (ac.revision ? ' rév. ' + ac.revision : '') + '.'); }
  }
  return m;
};

// ---------- Stock prévisionnel : stock + arrivages − livraisons prévues ----------
function gcfrPrevisionnel(D, articleId){
  D = D || gcD();
  const a = D.articles.find(x => x.id === articleId) || {}, s = GC.stockArticle(D, articleId), auj = getTodayISO(), ev = [];
  const arr = gcfrLignesArrivages(D).filter(x => x.l.articleId === articleId && x.reste > 0);
  const liv = gcsfLignesPlanning(D).filter(x => x.l.articleId === articleId && x.reste > 0);
  // livraisons faites sans sortie de stock à compter de la 1re expédition fournisseur de l'article (avant : ancien stock hors CRM)
  const depuis = gcfrLignesArrivages(D).filter(x => x.l.articleId === articleId).map(x => x.exp).filter(Boolean).sort()[0];
  const sans = depuis ? D.livraisons.filter(b => !b.annulee && (b.date || '') >= depuis && GC.liste(b.lignes).some(l => l.articleId === articleId && l.coutTheorique)) : [];
  arr.forEach(x => ev.push({date:x.arr || auj, sens:1, qte:x.reste, lib:'Arrivage ' + (x.cf.numero || '') + ' (' + gcNomFour(x.cf.fournisseurId) + ')' + (x.arr && x.arr < auj ? ' · date passée : à réceptionner' : ''), lien:`gcOuvrir('gc-achat', '${x.cf.id}')`, passe:x.arr && x.arr < auj}));
  sans.forEach(b => ev.push({date:b.date, sens:-1, qte:GC.liste(b.lignes).filter(l => l.articleId === articleId && l.coutTheorique).reduce((t, l) => t + GC.qteNetteLigne(l), 0), lib:'Déjà livré ' + b.numero + ' (' + gcNomClient(b.clientId) + ') · pas encore sorti du stock', lien:`gcOuvrir('gc-livraison', '${b.id}')`, passe:true}));
  liv.forEach(x => ev.push({date:x.dateLivraison || auj, sens:-1, qte:x.reste, lib:'Livraison ' + x.client + ' · PO ' + x.po + ' ligne ' + x.n + (x.statut === 'retard' ? ' · en retard' : ''), lien:`gcOuvrir('gc-commande', '${x.cmd.id}')`, passe:x.dateLivraison && x.dateLivraison < auj}));
  ev.sort((x, y) => (x.date || '').localeCompare(y.date || '') || y.sens - x.sens);
  let solde = s.physique, rupture = null, mini = s.physique;
  ev.forEach(e => { solde = GC.rq(solde + e.sens * e.qte); e.solde = solde; if(solde < -0.0005 && !rupture) rupture = e; mini = Math.min(mini, solde); });
  return {a, stock:s, ev, rupture, mini, fin:solde, entrees:ev.filter(e => e.sens > 0).reduce((t, e) => t + e.qte, 0), sorties:ev.filter(e => e.sens < 0).reduce((t, e) => t + e.qte, 0)};
}
function gcfrArticlesSuivis(D){
  D = D || gcD();
  const ids = new Set();
  gcfrLignesArrivages(D).filter(x => x.reste > 0).forEach(x => ids.add(x.l.articleId));
  gcsfLignesPlanning(D).filter(x => x.reste > 0).forEach(x => ids.add(x.l.articleId));
  return Array.from(ids).filter(Boolean);
}
window.renderGcPrevisionnel = function(main){
  const D = gcD(), ids = gcfrArticlesSuivis(D);
  const b = gcSection(main, 'Stock prévisionnel', '');
  if(!ids.length){ b.innerHTML = buildEmptyState('Rien à prévoir', 'Aucune livraison client ni arrivage fournisseur en attente.'); return; }
  b.innerHTML = `<div class="gc-sous" style="margin-bottom:8px;">Pour chaque article : stock actuel, puis arrivages fournisseurs (à leur date d'arrivée estimée) et livraisons clients prévues, dans l'ordre des dates. Une ligne rouge = la quantité prévue ne sera pas en stock à cette date.</div>`
  + ids.map(id => { const P = gcfrPrevisionnel(D, id), u = esc(P.a.unite || '');
    return `<div class="card" data-gc="previsionnel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;"><h3 class="gc-h3"><a href="#" onclick="gcOuvrir('gc-article', '${id}'); return false;">${esc(gcLibArticle(P.a))}</a></h3>
        ${P.rupture ? gcBadge({label:'Manque prévu le ' + gcDt(P.rupture.date) + ' : ' + gcQ(-P.mini) + ' ' + (P.a.unite || ''), cls:'bad'}) : gcBadge({label:'Couvert', cls:'good'})}</div>
      <div class="gc-chiffres"><div class="gc-chiffre"><span>Stock actuel</span><b>${gcsfQ(P.stock.physique, P.a.unite)}</b></div><div class="gc-chiffre good"><span>À recevoir</span><b>${gcsfQ(P.entrees, P.a.unite)}</b></div><div class="gc-chiffre warn"><span>À livrer</span><b>${gcsfQ(P.sorties, P.a.unite)}</b></div><div class="gc-chiffre ${P.fin < 0 ? 'bad' : ''}"><span>Stock à la fin</span><b>${gcsfQ(P.fin, P.a.unite)}</b></div></div>
      <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Date</th><th>Mouvement prévu</th><th class="n">Entrée</th><th class="n">Sortie</th><th class="n">Stock prévu</th></tr></thead><tbody>
        <tr><td data-l="Date">${gcDt(getTodayISO())}</td><td data-l="Mouvement">Stock actuel</td><td></td><td></td><td class="n" data-l="Stock"><b>${gcQ(P.stock.physique)}</b></td></tr>
        ${P.ev.map(e => `<tr class="${e.solde < 0 ? 'gcsf-retard' : ''}"><td data-l="Date">${gcsfLibSemaine(e.date, true)} · ${gcDt(e.date)}</td><td data-l="Mouvement"><a href="#" onclick="${e.lien}; return false;">${esc(e.lib)}</a></td>
          <td class="n" data-l="Entrée">${e.sens > 0 ? '+' + gcQ(e.qte) : ''}</td><td class="n" data-l="Sortie">${e.sens < 0 ? '−' + gcQ(e.qte) : ''}</td><td class="n" data-l="Stock prévu"><b style="${e.solde < 0 ? 'color:var(--bad);' : ''}">${gcQ(e.solde)} ${u}</b></td></tr>`).join('')}
      </tbody></table></div></div>`; }).join('');
};

// ---------- Accords de prix d'achat ----------
window.renderGcAccords = function(main){
  const D = gcD(), A = gcfrAccords(), auj = getTodayISO();
  const b = gcSection(main, 'Accords de prix d\'achat', '');
  b.innerHTML = A.length ? A.slice().sort((x, y) => (y.date || '').localeCompare(x.date || '')).map(gcfrCarteAccord).join('') : buildEmptyState('Aucun accord', 'Les offres spéciales des fournisseurs (prix réservés à un client, par quantité) apparaissent ici.');
};
function gcfrCarteAccord(ac){
  const auj = getTodayISO(), ok = (!ac.debut || ac.debut <= auj) && (!ac.fin || ac.fin >= auj), a = gcArticle(ac.articleId);
  return `<div class="card" data-gc="accord"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><h3 class="gc-h3">${esc(gcNomFour(ac.fournisseurId))} · offre ${esc(ac.numero)}${ac.revision ? ' rév. ' + esc(ac.revision) : ''}</h3>${ok ? gcBadge({label:'Valable jusqu\'au ' + gcDt(ac.fin), cls:'good'}) : gcBadge({label:'Expiré le ' + gcDt(ac.fin), cls:'bad'})}</div>
    <div class="gc-sous" style="margin-bottom:6px;"><b>${esc(a ? gcLibArticle(a) : '')}</b>${ac.clientId ? ` · <b style="color:var(--accent);">réservé à ${esc(gcNomClient(ac.clientId))}${ac.clientLib ? ' (' + esc(ac.clientLib) + ')' : ''}</b>` : ''} · du ${gcDt(ac.debut)} au ${gcDt(ac.fin)}</div>
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Quantité commandée</th><th>Variante</th><th class="n">Prix d'achat</th></tr></thead><tbody>${GC.liste(ac.paliers).map(p => `<tr><td data-l="Quantité">${p.max ? (p.min === p.max ? gcQ(p.min) + ' exactement' : 'de ' + gcQ(p.min) + ' à ' + gcQ(p.max)) : 'à partir de ' + gcQ(p.min)}</td><td data-l="Variante">${esc(p.variante || '')}</td><td class="n" data-l="Prix"><b>${gcE(p.prix)}</b></td></tr>`).join('')}</tbody></table></div>
    ${GC.liste(ac.conditions).length ? `<div class="gc-sous" style="margin-top:6px;">${ac.conditions.map(esc).join(' · ')}</div>` : ''}${ac.commentaire ? `<div class="gc-sous" style="margin-top:4px;font-style:italic;">${esc(ac.commentaire)}</div>` : ''}</div>`;
}

// ---------- Fiche fournisseur : coordonnées, accords, commandes ----------
const GCFR_CHAMPS_FOUR = [['raisonSociale', 'Raison sociale'], ['groupe', 'Groupe'], ['contactCommercial', 'Contact commercial'], ['incoterm', 'Incoterm / lieu d\'enlèvement'], ['transport', 'Transport jusqu\'à GADH (jours)', 'number'], ['codeFournisseur', 'Code fournisseur chez GADH'], ['codeClient', 'Notre code client chez le fournisseur']];
const gcfrFormFourOrigine = window.gcFormFournisseur;
window.gcFormFournisseur = (id) => {
  gcfrFormFourOrigine(id);
  const f = id ? gcfrFour(id) : {}, z = document.querySelector('#mgt-modal-zone .gc-form');
  if(z) z.insertAdjacentHTML('afterend', `<div class="gc-form">${GCFR_CHAMPS_FOUR.map(([k, l, t]) => mgtChamp(l, 'gf-x-' + k, f[k], t || 'text')).join('')}</div>`);
};
const gcfrSauverFourOrigine = window.gcSauverFournisseur;
window.gcSauverFournisseur = (id) => {
  const extra = {}; GCFR_CHAMPS_FOUR.forEach(([k, , t]) => { const e = document.getElementById('gf-x-' + k); if(e) extra[k] = t === 'number' ? (e.value === '' ? '' : GC.num(e.value)) : e.value.trim(); });
  const nom = gcVal('gf-nom'); gcfrSauverFourOrigine(id);
  const f = gcD().fournisseurs.find(x => id ? x.id === id : GC.norm(x.nom) === GC.norm(nom));
  if(f && Object.keys(extra).length){ gcEnregistrer('fournisseurs', Object.assign({}, f, extra)); if(activeTab === 'gc-fournisseur') nav('gc-fournisseur'); }
};
const gcfrFicheFourOrigine = renderGcFournisseur;
renderGcFournisseur = function(main){
  gcfrFicheFourOrigine(main);
  const id = gcOuvert['gc-fournisseur'], f = gcfrFour(id), body = document.getElementById('gc-body'); if(!f.id || !body) return;
  const D = gcD(), L = gcfrLignesArrivages(D).filter(x => x.cf.fournisseurId === id && x.reste > 0), ac = gcfrAccords().filter(a => a.fournisseurId === id);
  const v = (k, l) => f[k] !== undefined && f[k] !== '' ? `<div><span>${l}</span><b style="white-space:pre-line;">${esc(f[k])}</b></div>` : '';
  body.insertAdjacentHTML('afterbegin', `<div class="card" data-gc="fournisseur-coordonnees"><h3 class="gc-h3">Coordonnées</h3><div class="gc-kv">
      ${v('raisonSociale', 'Raison sociale')}${v('groupe', 'Groupe')}${v('adresse', 'Adresse')}${v('tel', 'Téléphone')}${v('email', 'E-mail')}${v('contact', 'Suivi des commandes')}${v('contactCommercial', 'Commercial')}
      ${v('mf', 'N° TVA')}${v('conditions', 'Paiement')}${v('rib', 'Banque / IBAN')}${v('incoterm', 'Incoterm')}${f.delai ? `<div><span>Délai de fabrication</span><b>${gcQ(f.delai)} jours</b></div>` : ''}${f.transport !== undefined && f.transport !== '' ? `<div><span>Transport jusqu'à GADH</span><b>${gcQ(f.transport)} jours</b></div>` : ''}
      ${v('codeFournisseur', 'Code fournisseur (GADH)')}${v('codeClient', 'Notre code client')}</div></div>
    <div class="card"><h3 class="gc-h3">Arrivages attendus</h3>${L.length ? L.map(x => `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-achat', '${x.cf.id}')"><span><b>${gcDt(x.exp)}</b> · ${esc(x.cf.numero)} · ${gcsfQ(x.reste, x.l.unite)}${x.cmdClient ? ' · pour PO ' + esc(x.cmdClient.reference) : ''}</span>${gcfrBadge(x)}</div>`).join('') : '<div class="gc-sous">Aucun.</div>'}
      ${gcPeut() ? `<button class="btn btn-primary" style="margin-top:8px;" onclick="gcfrFormCommande({fournisseurId:'${id}'})">+ Commande fournisseur</button>` : ''}</div>
    ${ac.map(gcfrCarteAccord).join('')}`);
};
// Fiche article : prix d'achat spéciaux
const gcfrFicheArticleOrigine = renderGcArticle;
renderGcArticle = function(main){
  gcfrFicheArticleOrigine(main);
  const id = gcOuvert['gc-article'], body = document.getElementById('gc-body'), ac = gcfrAccords().filter(a => a.articleId === id);
  if(body && ac.length){ const g = body.querySelector('[data-gc="grille-prix"]'); const html = `<div>${ac.map(gcfrCarteAccord).join('')}</div>`; if(g) g.insertAdjacentHTML('afterend', html); else body.insertAdjacentHTML('afterbegin', html); }
};
// Fiche commande client : bouton « Commander au fournisseur »
const gcfrFicheCmdOrigine = window.renderGcCommande;
window.renderGcCommande = function(main){
  gcfrFicheCmdOrigine(main);
  const D = gcD(), c = D.cmdC.find(x => x.id === gcOuvert['gc-commande']), z = document.querySelector('[data-gc="planning-commande"]'); if(!c || !z) return;
  const cfs = D.cmdF.filter(f => f.cmdClientId === c.id && f.statut !== 'annulee');
  z.insertAdjacentHTML('beforeend', `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;">${gcPeut() ? `<button class="btn btn-ghost" data-gc="commander-fournisseur" onclick="gcfrFormCommande({cmdClientId:'${c.id}'})">Commander au fournisseur</button>` : ''}
    ${cfs.length ? `<span class="gc-sous">Approvisionnement : ${cfs.map(f => { const l = gcfrLignesArrivages(D).filter(x => x.cf.id === f.id); return `<a href="#" onclick="gcOuvrir('gc-achat', '${f.id}'); return false;">${esc(f.numero)}</a> (${gcNomFour(f.fournisseurId)} · reçu ${gcQ(l.reduce((s, x) => s + x.recu, 0))} / ${gcQ(l.reduce((s, x) => s + GC.num(x.l.qte), 0))})`; }).join(', ')}</span>` : '<span class="gc-sous">Aucune commande fournisseur liée.</span>'}</div>`);
};

// ---------- « Livrer et facturer » : message clair si le stock suivi ne suffit pas ----------
const gcfrValiderLivrerOrigine = window.gcsfValiderLivrer;
window.gcsfValiderLivrer = (cmdId) => {
  const D = gcD(), c = D.cmdC.find(x => x.id === cmdId);
  const saisies = Array.from(document.querySelectorAll('.gsv-c')).filter(e => e.checked).map(e => ({lid:e.dataset.lid, qte:GC.num((document.querySelector('.gsv-q[data-lid="' + e.dataset.lid + '"]') || {}).value)}));
  const besoin = {}; saisies.forEach(s => { const l = c && c.lignes.find(y => y.lid === s.lid); if(l && l.articleId) besoin[l.articleId] = (besoin[l.articleId] || 0) + s.qte; });
  for(const aid of Object.keys(besoin)){
    if(gcsfSansStock(D, aid)) continue;
    const s = GC.stockArticle(D, aid), r = GC.reservations(D), resa = GC.liste(c.lignes).filter(l => l.articleId === aid).reduce((t, l) => t + (r[GC.cleLigne(cmdId, l.lid)] || 0), 0);
    if(besoin[aid] > s.disponible + resa + 1e-9){ showToast('Stock insuffisant : ' + gcQ(s.disponible + resa) + ' en stock pour ' + gcQ(besoin[aid]) + '. Enregistrez d\'abord l\'arrivage fournisseur (Planning → Arrivages) ou livrez une quantité partielle.'); return; }
  }
  return gcfrValiderLivrerOrigine(cmdId);
};

// ---------- Tableau de bord : arrivages et manques ----------
const gcfrAccueilOrigine = renderGcAccueil;
renderGcAccueil = function(main){
  gcfrAccueilOrigine(main);
  const z = document.querySelector('[data-gc="a-faire"]'); if(!z) return;
  const D = gcD(), A = gcfrLignesArrivages(D).filter(x => x.reste > 0 && (x.statut === 'a_receptionner' || x.statut === 'retard' || x.statut === 'commandee'));
  const R = gcfrArticlesSuivis(D).map(id => gcfrPrevisionnel(D, id)).filter(p => p.rupture);
  const h = (A.length ? A.slice(0, 4).map(x => `<div class="session-row"><span>${gcfrBadge(x)} <b>${esc(x.cf.numero)}</b> · ${esc(x.four)} · ${gcsfQ(x.reste, x.l.unite)} · expédition ${gcDt(x.exp)}</span>${gcPeut() && x.statut !== 'commandee' ? `<button class="btn btn-primary" onclick="gcfrFormRecevoir('${x.cf.id}', '${x.l.lid}')">Réceptionner</button>` : `<button class="btn btn-ghost" onclick="gcfrFormConfirmation('${x.cf.id}')">Confirmation</button>`}</div>`).join('') : '')
    + (R.length ? R.map(p => `<div class="gc-alerte bad" style="margin-top:6px;"><b>Manque de stock prévu</b> · ${esc(p.a.ref || p.a.designation)} : il manquera ${gcQ(-p.mini)} ${esc(p.a.unite || '')} le ${gcDt(p.rupture.date)} (${esc(p.rupture.lib)}). <a href="#" onclick="nav('gc-previsionnel'); return false;">Voir le stock prévisionnel</a></div>`).join('') : '');
  if(h) z.querySelector('h3').insertAdjacentHTML('afterend', h);
};

// ---------- Navigation : Planning (clients, arrivages, prévisionnel) et Achats ----------
GC_GROUPES.planning = {nav:'gc-planning', onglets:[['gc-planning', 'Livraisons clients'], ['gc-arrivages', 'Arrivages fournisseurs'], ['gc-previsionnel', 'Stock prévisionnel']]};
GC_GROUPES.ventes.onglets = GC_GROUPES.ventes.onglets.filter(o => o[0] !== 'gc-planning');
GC_GROUPES.achats = {nav:'gc-achats', onglets:[['gc-achats', 'Commandes fournisseurs'], ['gc-accords', 'Accords de prix'], ['gc-receptions', 'Réceptions'], ['gc-besoins', 'Besoins']]};
const gcfrNavItemsOrigine = gcNavItems;
gcNavItems = function(){ return gcfrNavItemsOrigine().map(i => i.tab === 'gc-besoins' ? Object.assign({}, i, {tab:'gc-achats', label:'Fournisseurs et achats', court:'Achats'}) : i); };
const gcfrNavParentOrigine = gcNavParent;
gcNavParent = function(tab){ if(tab === 'gc-arrivages' || tab === 'gc-previsionnel') return 'gc-planning'; const g = gcGroupeDe(tab); if(g && g.nav === 'gc-achats') return 'gc-achats'; return gcfrNavParentOrigine(tab); };
const gcfrRenderGCOrigine = renderGC;
renderGC = function(tab, main){
  const R = {'gc-arrivages':window.renderGcArrivages, 'gc-previsionnel':window.renderGcPrevisionnel, 'gc-accords':window.renderGcAccords};
  if(!R[tab]) return gcfrRenderGCOrigine(tab, main);
  gcStyle();
  try { R[tab](main); } catch(e){ console.error('CRM', tab, e); main.innerHTML = `<div class="card"><b>Affichage impossible</b><div class="gc-sous">${esc(e && e.message || String(e))}</div></div>`; }
  const g = gcGroupeDe(tab);
  if(g) main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets gc-onglets no-print">${g.onglets.map(([t, l]) => `<button class="${t === tab ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
};
// Exports : arrivages
const gcfrDefExportsOrigine = gcDefExports;
gcDefExports = function(){
  const d = gcfrDefExportsOrigine();
  d.arrivages = {titre:'Arrivages fournisseurs', cols:[['Fournisseur', x => x.four, 't'], ['Commande', x => x.cf.numero, 't'], ['Confirmation', x => (x.cf.confirmation || {}).reference || '', 't'], ['Pour le client', x => x.cmdClient ? gcNomClient(x.cmdClient.clientId) + ' · PO ' + x.cmdClient.reference : '', 't'],
    ['Article', x => x.l.ref || x.l.designation, 't'], ['Quantité', x => GC.num(x.l.qte), 'q'], ['Reçu', x => x.recu, 'q'], ['Reste', x => x.reste, 'q'], ['Prix', x => GC.num(x.l.pu), 'n3'], ['Expédition', x => x.exp, 'd'], ['Arrivée estimée', x => x.arr, 'd'],
    ['État', x => GCFR_STATUTS[x.statut].label, 't'], ['Réception', x => x.brs.map(r => r.numero + ' ' + gcDt(r.date)).join(', '), 't']], somme:['Quantité', 'Reçu', 'Reste']};
  return d;
};
