// ============================================================
// GADH — GESTION DES COMMANDES : VENTES
// ============================================================
// Demandes de prix (import Excel / CSV d'une liste de besoins), offres commerciales
// (versions, comparaison, statuts), commandes clients (ponctuelles ou annuelles avec
// échéances), réservations, livraisons partielles, retours et liaison avec la
// Facturation GADH (factCreer : même numérotation, mêmes encaissements).
// Saisie des documents (offre, commande client, commande fournisseur) : écran « gc-edition ».

// ============================================================
// SAISIE D'UN DOCUMENT (offre, commande client, commande fournisseur)
// ============================================================
const GC_DOCS = {
  offre:   {titre:'Offre commerciale', liste:'gc-offres', fiche:'gc-offre', cle:'offres', prefixe:'OF'},
  commande:{titre:'Commande client', liste:'gc-commandes', fiche:'gc-commande', cle:'cmdC', prefixe:'CC'},
  achat:   {titre:'Commande fournisseur', liste:'gc-achats', fiche:'gc-achat', cle:'cmdF', prefixe:'CF'}
};
function gcLigneVide(){ return {lid:'', articleId:'', ref:'', designation:'', unite:'', qte:1, pu:0, remise:0}; }
window.gcNouveauDoc = (type, init) => {
  if(!gcPeut()) return gcRefus();
  const R = gcReglages(), auj = getTodayISO();
  const base = {offre:{date:auj, validite:GC.ajouterJours(auj, Number(R.validiteOffre) || 30), statut:'brouillon', version:1, versions:[], conditions:R.conditionsOffre || '', tva:R.tva, remise:0, clientId:''},
    commande:{date:auj, dateSouhaitee:'', type:'ponctuelle', statut:'brouillon', conditions:R.conditionsPaiement || '', tva:R.tva, remise:0, clientId:'', echeances:[], reference:'', commentaires:''},
    achat:{date:auj, datePrevue:GC.ajouterJours(auj, Number(R.delaiDefaut) || 7), statut:'brouillon', fournisseurId:'', tva:R.tva, fraisPrevus:0, paiements:[], reference:'', note:''}}[type];
  gcEdit = {type, nouveau:true, retour:GC_DOCS[type].liste, doc:Object.assign({id:GC.nouvelId({offre:'of', commande:'cc', achat:'cf'}[type]), lignes:[gcLigneVide()]}, base, init || {})};
  if(type === 'achat' && gcEdit.doc.fournisseurId){ const f = gcD().fournisseurs.find(x => x.id === gcEdit.doc.fournisseurId); if(f && f.delai) gcEdit.doc.datePrevue = GC.ajouterJours(auj, f.delai); }
  nav('gc-edition');
};
window.gcNouvelleCF = (fid) => gcNouveauDoc('achat', {fournisseurId:fid || ''});
window.gcModifierDoc = (type, id) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), d = D[GC_DOCS[type].cle].find(x => x.id === id); if(!d) return;
  if(type === 'offre' && d.statut !== 'brouillon'){ showToast('Seule une offre en brouillon se modifie : créez une nouvelle version'); return; }
  if(type === 'commande' && d.statut !== 'brouillon' && D.livraisons.some(b => b.cmdId === id && !b.annulee)){ showToast('Cette commande a déjà des livraisons : elle ne peut plus être modifiée'); return; }
  if(type === 'commande' && (d.statut === 'annulee' || d.statut === 'cloturee')){ showToast('Commande ' + (d.statut === 'annulee' ? 'annulée' : 'clôturée')); return; }
  if(type === 'achat'){
    if(d.statut === 'annulee' || d.statut === 'cloturee'){ showToast('Commande fournisseur close'); return; }
    if(D.receptions.some(r => r.cfId === id && !r.annulee)){ showToast('Cette commande a déjà des réceptions : elle ne peut plus être modifiée'); return; }
  }
  gcEdit = {type, nouveau:false, retour:GC_DOCS[type].fiche, doc:JSON.parse(JSON.stringify(d))};
  gcEdit.doc.lignes = GC.liste(gcEdit.doc.lignes).length ? gcEdit.doc.lignes : [gcLigneVide()];
  gcOuvert[GC_DOCS[type].fiche] = id;
  nav('gc-edition');
};
// Lecture du formulaire → gcEdit.doc
function gcLireEdition(){
  if(!gcEdit) return;
  const d = gcEdit.doc, t = gcEdit.type, v = (id) => { const e = document.getElementById(id); return e ? e.value : undefined; };
  ['date', 'validite', 'dateSouhaitee', 'datePrevue', 'conditions', 'reference', 'commentaires', 'note', 'referenceClient'].forEach(k => { const x = v('ge-' + k); if(x !== undefined) d[k] = x.trim ? x.trim() : x; });
  if(v('ge-client') !== undefined) d.clientId = v('ge-client');
  if(v('ge-four') !== undefined) d.fournisseurId = v('ge-four');
  if(v('ge-type') !== undefined) d.type = v('ge-type');
  ['tva', 'remise', 'fraisPrevus', 'timbre'].forEach(k => { const x = v('ge-' + k); if(x !== undefined) d[k] = GC.num(x); });
  d.lignes = d.lignes.map((l, i) => {
    const g = (c) => v('gel-' + c + '-' + i);
    const n = Object.assign({}, l);
    if(g('art') !== undefined) n.articleId = g('art');
    ['designation', 'unite'].forEach(c => { if(g(c) !== undefined) n[c] = g(c).trim(); });
    ['qte', 'pu', 'remise'].forEach(c => { if(g(c) !== undefined) n[c] = GC.num(g(c)); });
    const m = document.getElementById('gel-man-' + i); if(m) n.puManuel = m.checked;
    return n;
  });
  if(t === 'commande' && d.type === 'annuelle'){
    d.echeances = GC.liste(d.echeances).map((e, j) => {
      const n = Object.assign({}, e, {qtes:Object.assign({}, e.qtes)}); const x = v('gee-date-' + j); if(x !== undefined) n.date = x;
      d.lignes.forEach((l, i) => { const q = v('gee-q-' + j + '-' + i); if(q !== undefined) n.qtes[l.lid || ('i' + i)] = GC.num(q); });
      return n;
    });
  }
}
// Prix : paliers (offre, commande) sur la quantité totale engagée ; tarif fournisseur (commande fournisseur).
function gcRecalculerPrix(){
  const d = gcEdit.doc, D = gcD();
  if(gcEdit.type === 'achat'){
    const q = GC.qtesEngagees(d.lignes);
    d.lignes = d.lignes.map(l => (!l.articleId || l.puManuel) ? l : Object.assign({}, l, {pu:GC.tarifAchat(D, l.articleId, d.fournisseurId, q[l.articleId], d.date).prix}));
  } else d.lignes = GC.appliquerPaliers(d.lignes, D.articles);
}
window.gcEditChange = (recalc) => { gcLireEdition(); if(recalc !== false) gcRecalculerPrix(); nav('gc-edition'); };
window.gcEditArticle = (i) => {
  gcLireEdition();
  const l = gcEdit.doc.lignes[i], a = gcArticle(l.articleId);
  if(a){ l.ref = a.ref || ''; l.designation = a.designation || ''; l.unite = a.unite || ''; l.puManuel = false; if(gcEdit.type !== 'achat') l.pu = GC.num(a.prixVente); }
  gcRecalculerPrix(); nav('gc-edition');
};
window.gcEditAjouterLigne = () => { gcLireEdition(); gcEdit.doc.lignes.push(gcLigneVide()); nav('gc-edition'); };
window.gcEditRetirerLigne = (i) => { gcLireEdition(); gcEdit.doc.lignes.splice(i, 1); if(!gcEdit.doc.lignes.length) gcEdit.doc.lignes.push(gcLigneVide()); gcRecalculerPrix(); nav('gc-edition'); };
window.gcEditEcheances = () => {
  gcLireEdition();
  const d = gcEdit.doc, debut = gcVal('gee-debut') || d.date, n = GC.num(gcVal('gee-nb')) || 12, pas = GC.num(gcVal('gee-pas')) || 1;
  d.lignes.forEach((l, i) => { if(!l.lid) l.lid = 'l' + (i + 1); });
  d.echeances = GC.genererEcheances(d.lignes, debut, n, pas);
  nav('gc-edition');
};
window.gcEditAjouterEcheance = () => { gcLireEdition(); const d = gcEdit.doc; d.lignes.forEach((l, i) => { if(!l.lid) l.lid = 'l' + (i + 1); }); d.echeances = GC.liste(d.echeances).concat([{id:'e' + Date.now().toString(36), date:'', qtes:{}}]); nav('gc-edition'); };
window.gcEditRetirerEcheance = (j) => { gcLireEdition(); gcEdit.doc.echeances.splice(j, 1); nav('gc-edition'); };
window.renderGcEdition = function(main){
  if(!gcEdit){ nav('gc-accueil'); return; }
  const t = gcEdit.type, d = gcEdit.doc, T = GC_DOCS[t], D = gcD(), tot = t === 'achat' ? gcTotauxCF(d) : GC.totaux(d);
  const titre = (gcEdit.nouveau ? 'Nouvelle ' : 'Modifier : ') + T.titre.toLowerCase() + (d.numero ? ' ' + esc(d.numero) : '');
  const b = gcSection(main, gcRetour(gcEdit.nouveau ? T.liste : T.fiche, titre), '');
  const qe = GC.qtesEngagees(d.lignes);
  const tiers = t === 'achat'
    ? `<div class="field"><label>Fournisseur *</label><div style="display:flex;gap:6px;"><select id="ge-four" onchange="gcEditChange()">${gcOptsFour(d.fournisseurId, '— Choisir —')}</select><button class="btn btn-ghost" style="padding:6px 12px;" title="Nouveau fournisseur" onclick="gcLireEdition(); window.gcApresFournisseur = (f) => { gcEdit.doc.fournisseurId = f.id; nav('gc-edition'); }; gcFormFournisseur()">+</button></div></div>`
    : `<div class="field"><label>Client *</label><div style="display:flex;gap:6px;"><select id="ge-client" onchange="gcEditChange(false)">${gcOptsClients(d.clientId, '— Choisir —')}</select>${gcPeutClients() ? `<button class="btn btn-ghost" style="padding:6px 12px;" title="Nouveau client" onclick="gcLireEdition(); window.gcApresClient = (id) => { gcEdit.doc.clientId = id; nav('gc-edition'); }; gcFormClient()">+</button>` : ''}</div></div>`;
  const champs = t === 'offre'
    ? `${mgtChamp('Date', 'ge-date', d.date, 'date')}${mgtChamp('Valable jusqu\'au', 'ge-validite', d.validite, 'date')}${mgtChamp('Référence client', 'ge-referenceClient', d.referenceClient)}`
    : t === 'commande'
    ? `${mgtChamp('Date de commande', 'ge-date', d.date, 'date')}${mgtChamp('Livraison souhaitée', 'ge-dateSouhaitee', d.dateSouhaitee, 'date')}
       <div class="field"><label>Type</label><select id="ge-type" onchange="gcEditChange(false)">${gcOpts([['ponctuelle', 'Ponctuelle'], ['annuelle', 'Annuelle / récurrente (échéances)']], d.type)}</select></div>
       ${mgtChamp('Référence / document client (n° de commande…)', 'ge-reference', d.reference)}`
    : `${mgtChamp('Date de commande', 'ge-date', d.date, 'date')}${mgtChamp('Livraison prévue', 'ge-datePrevue', d.datePrevue, 'date')}${mgtChamp('Référence (devis fournisseur…)', 'ge-reference', d.reference)}`;
  const optsArt = (val) => gcOptsArticles(val, '— Ligne libre —', a => t !== 'achat' || GC.suiviStock(a) || true);
  const lignes = d.lignes.map((l, i) => {
    const a = gcArticle(l.articleId), pal = a && t !== 'achat' ? GC.prixPalier(a, qe[l.articleId]) : null;
    return `<tr>
      <td data-l="Article" style="min-width:180px;"><select id="gel-art-${i}" onchange="gcEditArticle(${i})">${optsArt(l.articleId)}</select>
        <input id="gel-designation-${i}" placeholder="Désignation" value="${gcAttr(l.designation)}" style="margin-top:4px;" onchange="gcEditChange(false)"></td>
      <td data-l="Unité"><input id="gel-unite-${i}" value="${gcAttr(l.unite)}" style="max-width:90px;" onchange="gcEditChange(false)"></td>
      <td data-l="Quantité"><input id="gel-qte-${i}" type="number" step="any" min="0" value="${gcAttr(l.qte)}" onchange="gcEditChange()"></td>
      <td data-l="Prix unitaire HT"><input id="gel-pu-${i}" type="number" step="any" min="0" value="${gcAttr(l.pu)}" onchange="document.getElementById('gel-man-${i}').checked = true; gcEditChange()">
        <label style="display:flex;gap:4px;align-items:center;font-size:11px;color:var(--ink-soft);margin-top:3px;"><input type="checkbox" id="gel-man-${i}" ${l.puManuel ? 'checked' : ''} onchange="gcEditChange()" style="width:auto;min-width:0;"> prix manuel</label>
        ${pal && pal.palier !== null && !l.puManuel ? `<span class="gc-tag">palier ≥ ${gcQ(pal.min)}</span>` : ''}${t === 'achat' && a && !l.puManuel ? `<span class="gc-tag">${GC.tarifAchat(D, a.id, d.fournisseurId, qe[a.id], d.date).source === 'tarif' ? 'tarif négocié' : 'prix article'}</span>` : ''}</td>
      ${t === 'achat' ? '' : `<td data-l="Remise %"><input id="gel-remise-${i}" type="number" step="any" min="0" max="100" value="${gcAttr(l.remise)}" style="max-width:80px;" onchange="gcEditChange(false)"></td>`}
      <td class="n" data-l="Montant HT">${gcE(GC.montantLigne(l))}</td>
      <td><button class="btn btn-ghost" style="padding:5px 9px;" onclick="gcEditRetirerLigne(${i})" title="Retirer">✕</button></td></tr>`;
  }).join('');
  const ech = t === 'commande' && d.type === 'annuelle' ? `<div class="card"><h3 class="gc-h3">Calendrier prévisionnel (échéances de livraison)</h3>
    <div class="gc-filtres"><label>Première échéance<input type="date" id="gee-debut" value="${gcAttr(d.dateSouhaitee || d.date)}"></label><label>Nombre d'échéances<input type="number" id="gee-nb" min="1" value="${GC.liste(d.echeances).length || 12}"></label><label>Tous les (mois)<input type="number" id="gee-pas" min="1" value="1"></label>
      <button class="btn btn-ghost" onclick="gcEditEcheances()">Répartir les quantités</button><button class="btn btn-ghost" onclick="gcEditAjouterEcheance()">+ Échéance</button></div>
    ${GC.liste(d.echeances).length ? `<div style="overflow-x:auto;"><table class="gc-lignes" style="min-width:${260 + d.lignes.length * 110}px;"><thead><tr><th>Date</th>${d.lignes.map(l => `<th class="n">${esc(l.designation || '—')}</th>`).join('')}<th></th></tr></thead><tbody>
      ${d.echeances.map((e, j) => `<tr><td data-l="Date"><input type="date" id="gee-date-${j}" value="${gcAttr(e.date)}" onchange="gcEditChange(false)"></td>${d.lignes.map((l, i) => `<td data-l="${gcAttr(l.designation)}"><input type="number" step="any" min="0" id="gee-q-${j}-${i}" value="${gcAttr((e.qtes || {})[l.lid || ('i' + i)] || 0)}" onchange="gcEditChange(false)"></td>`).join('')}<td><button class="btn btn-ghost" style="padding:5px 9px;" onclick="gcEditRetirerEcheance(${j})">✕</button></td></tr>`).join('')}
      <tr><td><b>Total prévu</b></td>${d.lignes.map((l, i) => { const s = d.echeances.reduce((x, e) => x + GC.num((e.qtes || {})[l.lid || ('i' + i)]), 0); return `<td class="n"><b style="color:${s > GC.num(l.qte) + 1e-9 ? 'var(--bad)' : 'inherit'};">${gcQ(s)} / ${gcQ(l.qte)}</b></td>`; }).join('')}<td></td></tr></tbody></table></div>` : '<div class="gc-sous">Définissez la première date, le nombre d\'échéances et la périodicité, puis « Répartir les quantités ». Chaque quantité reste modifiable.</div>'}</div>` : '';
  b.innerHTML = `<div class="card"><div class="gc-form">${tiers}${champs}</div></div>
    <div class="card"><h3 class="gc-h3">Articles</h3><div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th>Unité</th><th>Quantité</th><th>Prix unitaire HT</th>${t === 'achat' ? '' : '<th>Remise %</th>'}<th class="n">Montant HT</th><th></th></tr></thead><tbody>${lignes}</tbody></table></div>
      <button class="btn btn-ghost" style="margin-top:8px;" data-gc="ajouter-ligne" onclick="gcEditAjouterLigne()">+ Ligne</button>
      ${t !== 'achat' ? '<div class="gc-sous" style="margin-top:6px;">Le prix suit les paliers de l\'article, calculés sur la quantité totale engagée dans ce document (cochez « prix manuel » pour le fixer).</div>' : '<div class="gc-sous" style="margin-top:6px;">Le prix suit le tarif négocié valable du fournisseur (quantité, date), sinon le prix d\'achat de l\'article.</div>'}</div>
    ${ech}
    <div class="card"><div class="gc-form">
      ${t !== 'achat' ? mgtChamp('Remise globale (%)', 'ge-remise', d.remise, 'number', 'step="any" min="0" max="100" onchange="gcEditChange(false)"') : mgtChamp('Frais prévus (transport…) €', 'ge-fraisPrevus', d.fraisPrevus, 'number', 'step="any" min="0" onchange="gcEditChange(false)"')}
      ${mgtChamp('TVA (%)', 'ge-tva', d.tva, 'number', 'step="any" min="0" onchange="gcEditChange(false)"')}</div>
      ${t === 'offre' ? `<div class="field"><label>Conditions commerciales</label><textarea id="ge-conditions" rows="3">${esc(d.conditions || '')}</textarea></div>` : t === 'commande'
        ? `${mgtChamp('Conditions de paiement', 'ge-conditions', d.conditions)}<div class="field"><label>Commentaires</label><textarea id="ge-commentaires" rows="2">${esc(d.commentaires || '')}</textarea></div>`
        : `<div class="field"><label>Note</label><textarea id="ge-note" rows="2">${esc(d.note || '')}</textarea></div>`}
      <div class="gc-chiffres" style="margin-top:6px;">${t === 'achat' ? `<div class="gc-chiffre"><span>Total HT</span><b>${gcE(tot.ht)}</b></div><div class="gc-chiffre"><span>TVA</span><b>${gcE(tot.tva)}</b></div><div class="gc-chiffre"><span>Frais</span><b>${gcE(tot.frais)}</b></div><div class="gc-chiffre good"><span>Total TTC</span><b>${gcE(tot.ttc)}</b></div>`
        : `<div class="gc-chiffre"><span>Brut HT</span><b>${gcE(tot.brut)}</b></div><div class="gc-chiffre"><span>Remises</span><b>${gcE(tot.remises)}</b></div><div class="gc-chiffre"><span>Total HT</span><b>${gcE(tot.ht)}</b></div><div class="gc-chiffre"><span>TVA</span><b>${gcE(tot.tva)}</b></div><div class="gc-chiffre good"><span>Total TTC</span><b>${gcE(tot.ttc)}</b></div>`}</div></div>
    <div style="display:flex;gap:8px;"><button class="btn btn-ghost" style="flex:1;" onclick="const r = gcEdit.nouveau ? '${T.liste}' : '${T.fiche}'; gcEdit = null; nav(r)">Abandonner</button>
      <button class="btn btn-primary" style="flex:2;" data-gc="enregistrer-doc" onclick="gcSauverDoc()">Enregistrer</button></div>`;
};
window.gcSauverDoc = () => gcOperation(() => {
  gcLireEdition();
  const t = gcEdit.type, T = GC_DOCS[t], D = gcD(), d = gcEdit.doc;
  d.lignes = d.lignes.filter(l => l.articleId || l.designation || GC.num(l.qte) > 0);
  if(t === 'achat' && !d.fournisseurId){ showToast('Choisissez le fournisseur'); return; }
  if(t !== 'achat' && !d.clientId){ showToast('Choisissez le client'); return; }
  if(!d.date){ showToast('La date est obligatoire'); return; }
  if(!d.lignes.length){ showToast('Ajoutez au moins une ligne'); return; }
  for(const l of d.lignes){
    if(!l.designation){ showToast('Chaque ligne doit avoir une désignation'); return; }
    if(!(GC.num(l.qte) > 0)){ showToast('« ' + l.designation + ' » : quantité invalide'); return; }
    if(GC.num(l.pu) < 0){ showToast('« ' + l.designation + ' » : prix négatif'); return; }
    if(GC.num(l.remise) < 0 || GC.num(l.remise) > 100){ showToast('« ' + l.designation + ' » : remise entre 0 et 100 %'); return; }
  }
  if(GC.num(d.remise) < 0 || GC.num(d.remise) > 100){ showToast('Remise globale entre 0 et 100 %'); return; }
  if(t === 'offre' && d.validite && d.validite < d.date){ showToast('La validité est antérieure à la date de l\'offre'); return; }
  if(t === 'commande' && d.dateSouhaitee && d.dateSouhaitee < d.date){ showToast('La date de livraison souhaitée est antérieure à la commande'); return; }
  if(t === 'achat' && d.datePrevue && d.datePrevue < d.date){ showToast('La livraison prévue est antérieure à la commande'); return; }
  // Identifiants de lignes stables (réservations, livraisons, réceptions s'y rattachent).
  const pris = new Set(d.lignes.map(l => l.lid).filter(Boolean)); let n = 1;
  d.lignes.forEach((l, i) => {
    if(!l.lid){ while(pris.has('l' + n)) n++; l.lid = 'l' + n; pris.add(l.lid); }
    if(t === 'commande' && d.type === 'annuelle') GC.liste(d.echeances).forEach(e => { if(e.qtes && e.qtes['i' + i] !== undefined){ e.qtes[l.lid] = e.qtes['i' + i]; delete e.qtes['i' + i]; } });
  });
  if(t === 'commande'){
    if(d.type !== 'annuelle') d.echeances = [];
    const ev = GC.echeancesValides(d); if(ev){ showToast(ev); return; }
    if(!gcEdit.nouveau){
      const res = GC.reservations(D);
      for(const l of GC.liste((D.cmdC.find(x => x.id === d.id) || {}).lignes)){
        const r = res[GC.cleLigne(d.id, l.lid)] || 0, nl = d.lignes.find(x => x.lid === l.lid);
        if(r > 0 && (!nl || nl.articleId !== l.articleId || GC.num(nl.qte) + 1e-9 < r)){ showToast('« ' + l.designation + ' » a ' + gcQ(r) + ' réservé(s) : libérez la réservation avant de réduire ou retirer la ligne'); return; }
      }
    }
  }
  if(gcEdit.nouveau) d.numero = GC.numeroSuivant(D[T.cle], T.prefixe, d.date);
  if(t === 'achat') d.lignes.forEach(l => { const a = gcArticle(l.articleId); if(a && !l.ref) l.ref = a.ref || ''; });
  gcEnregistrer(T.cle, d);
  gcJournal(gcEdit.nouveau ? 'Création' : 'Modification', T.titre, d, gcE(t === 'achat' ? gcTotauxCF(d).ht : GC.totaux(d).ht) + ' HT · ' + d.lignes.length + ' ligne(s)');
  const id = d.id; gcEdit = null; showToast(T.titre + ' enregistrée'); gcOuvrir(T.fiche, id);
});

// ============================================================
// DEMANDES DE PRIX (IMPORT D'UNE LISTE DE BESOINS)
// ============================================================
let gcImport = null;
window.renderGcDemandes = function(main){
  const ed = gcPeut();
  const b = gcSection(main, 'Demandes de prix', (ed ? `<button class="btn btn-primary" data-gc="importer-liste" onclick="gcFormImport()">Importer une liste</button>` : '') + gcBoutonsExport('demandes'));
  b.innerHTML = `<div class="gc-sous" style="margin-bottom:8px;">Liste d'articles et de quantités reçue d'un client (Excel ou CSV) : colonnes détectées, rapprochement avec le catalogue, contrôle des doublons, des quantités et des unités, puis création de l'offre.</div>` + gcTable({id:'demandes', lignes:() => gcD().demandes, tri:1, sens:-1,
    texte:x => [x.numero, gcNomClient(x.clientId), x.fichier && x.fichier.nom].join(' '),
    filtres:[{id:'etat', label:'État', defaut:'actives', options:[['actives', 'En cours'], ['offre', 'Offre créée'], ['archives', 'Archivées'], ['', 'Toutes']], test:(x, v) => v === 'archives' ? !!x.archive : !x.archive && (v === 'offre' ? !!x.offreId : !x.offreId)}],
    colonnes:[{titre:'N°', val:x => x.numero}, {titre:'Date', val:x => x.date, html:x => gcDt(x.date)}, {titre:'Client', val:x => gcNomClient(x.clientId)}, {titre:'Fichier', val:x => (x.fichier || {}).nom || 'Liste collée'},
      {titre:'Lignes', num:true, tri:x => GC.liste(x.lignes).length, html:x => { const s = gcStatsImport(x.lignes); return `${s.total}${s.inconnu ? ` · <span style="color:var(--bad);">${s.inconnu} inconnue(s)</span>` : ''}`; }},
      {titre:'Offre', val:x => x.offreNumero || '', html:x => x.offreId ? `<b>${esc(x.offreNumero || '')}</b>` : '<span class="gc-sous">à créer</span>'}],
    clic:x => `gcOuvrir('gc-demande', '${x.id}')`, vide:'Aucune demande', videSous:ed ? 'Importez la liste Excel ou CSV d\'un client.' : ''});
};
function gcStatsImport(lignes){ const s = {total:0, ok:0, inconnu:0, doublon:0, erreur:0, unite:0, ignoree:0}; GC.liste(lignes).forEach(l => { s.total++; s[l.ignoree ? 'ignoree' : l.statut] = (s[l.ignoree ? 'ignoree' : l.statut] || 0) + 1; }); return s; }
window.gcFormImport = (clientId) => {
  if(!gcPeut()) return gcRefus();
  mgtModal('Importer une liste de besoins', `
    <div class="field"><label>Client</label><select id="gi-client">${gcOptsClients(clientId || '', '— À préciser plus tard —')}</select></div>
    <div class="field"><label>Fichier Excel (.xlsx, .xls) ou CSV</label><input type="file" id="gi-fichier" accept=".xlsx,.xls,.csv,.txt"></div>
    <div class="gc-sous" style="margin:-4px 0 10px;">Ou collez la liste (copiée depuis Excel, une ligne d'en-têtes) :</div>
    <div class="field"><textarea id="gi-texte" rows="5" placeholder="Référence;Désignation;Quantité;Unité"></textarea></div>
    <button class="btn btn-primary" style="width:100%;" data-gc="analyser-import" onclick="gcLancerImport()">Analyser</button>`);
};
window.gcLancerImport = async () => {
  const input = document.getElementById('gi-fichier'), f = input && input.files && input.files[0], texte = (document.getElementById('gi-texte') || {}).value || '', clientId = gcVal('gi-client');
  try {
    let r, fichier;
    if(f){ r = await gcLireFichier(f); fichier = {nom:f.name, taille:f.size, type:f.type || '', feuille:r.feuille || '', modifie:f.lastModified ? new Date(f.lastModified).toISOString() : ''}; }
    else if(texte.trim()){ r = {lignes:GC.parserCSV(texte)}; fichier = {nom:'', taille:texte.length, type:'texte collé', feuille:''}; }
    else { showToast('Choisissez un fichier ou collez une liste'); return; }
    if(r.lignes.length < 2){ showToast('Aucune ligne de données (la 1re ligne doit contenir les en-têtes)'); return; }
    const entetes = r.lignes[0].map(x => String(x == null ? '' : x)), brut = r.lignes.slice(1).map(l => l.map(x => String(x == null ? '' : x)));
    const colonnes = GC.detecterColonnes(entetes, brut);
    gcImport = {clientId, fichier, entetes, brut, colonnes, lignes:GC.analyserImport(brut, colonnes, gcD().articles).lignes};
    mgtFermer(); nav('gc-import');
  } catch(e){ console.error(e); showToast('Lecture impossible : ' + (e.message || e) + (navigator.onLine === false ? ' (hors ligne : utilisez un fichier CSV ou collez la liste)' : '')); }
};
// Recalcule les statuts après corrections (article, quantité, unité, lignes ignorées).
function gcImportRecalculer(){
  const A = GC.parId(gcD().articles), vus = {};
  gcImport.lignes.forEach(l => {
    const a = A[l.articleId], al = [];
    let st = 'ok';
    if(!(GC.num(l.qte) > 0)){ st = 'erreur'; al.push('Quantité invalide'); }
    if(!a){ if(st === 'ok') st = 'inconnu'; al.push('Référence inconnue du catalogue'); }
    if(a && l.unite && a.unite && GC.norm(l.unite) !== GC.norm(a.unite)){ al.push('Unité « ' + l.unite + ' » différente du catalogue (« ' + a.unite + ' »)'); if(st === 'ok') st = 'unite'; }
    if(!l.ignoree && st !== 'erreur'){ const k = a ? 'a:' + a.id : 'r:' + GC.normRef(l.ref || l.designation); if(vus[k]){ al.push('Doublon de la ligne ' + vus[k]); if(st === 'ok' || st === 'unite') st = 'doublon'; } else vus[k] = l.n; }
    l.statut = st; l.alertes = al; if(a && !l.designation) l.designation = a.designation;
  });
}
const GC_IMPORT_STATUTS = {ok:{label:'OK', cls:'good'}, inconnu:{label:'Inconnue', cls:'bad'}, doublon:{label:'Doublon', cls:'warn'}, erreur:{label:'Erreur', cls:'bad'}, unite:{label:'Unité', cls:'warn'}, ignoree:{label:'Ignorée', cls:''}};
window.renderGcImport = function(main){
  if(!gcImport){ nav('gc-demandes'); return; }
  const I = gcImport, s = gcStatsImport(I.lignes), ed = gcPeut();
  const b = gcSection(main, gcRetour('gc-demandes', I.demandeId ? 'Corriger la demande' : 'Vérifier la liste importée'), '');
  if(!ed){ b.innerHTML = '<div class="card">Consultation seulement.</div>'; return; }
  const CH = {ref:'Référence', designation:'Désignation', qte:'Quantité', unite:'Unité', prix:'Prix cible'};
  b.innerHTML = `<div class="card"><div class="gc-kv"><div><span>Fichier</span><b>${esc(I.fichier && I.fichier.nom || 'Liste collée')}</b></div><div><span>Feuille</span><b>${esc(I.fichier && I.fichier.feuille || '—')}</b></div><div><span>Lignes lues</span><b>${I.brut.length}</b></div></div>
      <div class="gc-form" style="margin-top:8px;"><div class="field"><label>Client</label><select id="gi-client2" onchange="gcImport.clientId = this.value">${gcOptsClients(I.clientId, '— À préciser —')}</select></div>
      ${Object.keys(CH).map(ch => `<div class="field"><label>Colonne « ${CH[ch]} »</label><select onchange="gcImport.colonnes['${ch}'] = this.value === '' ? undefined : Number(this.value); gcImport.lignes = GC.analyserImport(gcImport.brut, gcImport.colonnes, gcD().articles).lignes; nav('gc-import')">${gcOpts(I.entetes.map((e, i) => [i, e || ('Colonne ' + (i + 1))]), I.colonnes[ch], '— Aucune —')}</select></div>`).join('')}</div></div>
    <div class="gc-chiffres"><div class="gc-chiffre good"><span>Reconnues</span><b>${s.ok}</b></div><div class="gc-chiffre ${s.inconnu ? 'bad' : ''}"><span>Inconnues</span><b>${s.inconnu}</b></div><div class="gc-chiffre ${s.doublon ? 'warn' : ''}"><span>Doublons</span><b>${s.doublon}</b></div>
      <div class="gc-chiffre ${s.erreur ? 'bad' : ''}"><span>Quantités en erreur</span><b>${s.erreur}</b></div><div class="gc-chiffre ${s.unite ? 'warn' : ''}"><span>Unités différentes</span><b>${s.unite}</b></div><div class="gc-chiffre"><span>Ignorées</span><b>${s.ignoree}</b></div></div>
    <div class="card"><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${s.doublon ? `<button class="btn btn-ghost" data-gc="regrouper" onclick="gcImport.lignes = GC.fusionnerDoublons(gcImport.lignes); gcImportRecalculer(); nav('gc-import')">Regrouper les doublons (additionner)</button>` : ''}</div>
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Ligne</th><th>Lu dans le fichier</th><th>Article du catalogue</th><th>Quantité</th><th>Unité</th><th>Contrôle</th><th>Ignorer</th></tr></thead><tbody>
    ${I.lignes.map((l, i) => `<tr style="${l.ignoree ? 'opacity:.5;' : ''}"><td data-l="Ligne">${l.n}${l.fusion ? '<br><span class="gc-sous">+ ' + l.fusion.slice(1).join(', ') + '</span>' : ''}</td>
      <td data-l="Fichier">${esc(l.ref || '')}${l.ref && l.designation ? ' · ' : ''}${esc(l.designation || '')}</td>
      <td data-l="Article"><select onchange="gcImport.lignes[${i}].articleId = this.value; gcImportRecalculer(); nav('gc-import')">${gcOptsArticles(l.articleId, '— Aucun —')}</select>${!l.articleId ? `<button class="btn btn-ghost" style="padding:3px 9px;font-size:12px;margin-top:4px;" onclick="gcImportCreerArticle(${i})">Créer l'article</button>` : ''}</td>
      <td data-l="Quantité"><input type="number" step="any" min="0" value="${gcAttr(l.qte)}" onchange="gcImport.lignes[${i}].qte = GC.num(this.value); gcImportRecalculer(); nav('gc-import')"></td>
      <td data-l="Unité">${esc(l.unite || '')}</td>
      <td data-l="Contrôle">${gcBadge(GC_IMPORT_STATUTS[l.ignoree ? 'ignoree' : l.statut])}${l.alertes.length ? '<br><span class="gc-sous">' + esc(l.alertes.join(' ; ')) + '</span>' : ''}</td>
      <td data-l="Ignorer"><input type="checkbox" ${l.ignoree ? 'checked' : ''} onchange="gcImport.lignes[${i}].ignoree = this.checked; gcImportRecalculer(); nav('gc-import')" style="width:auto;min-width:0;"></td></tr>`).join('')}
    </tbody></table></div></div>
    <div style="display:flex;gap:8px;"><button class="btn btn-ghost" style="flex:1;" onclick="gcImport = null; nav('gc-demandes')">Abandonner</button><button class="btn btn-primary" style="flex:2;" data-gc="enregistrer-demande" onclick="gcSauverDemande()">Enregistrer la demande</button></div>`;
};
window.gcImportCreerArticle = (i) => {
  const l = gcImport.lignes[i];
  window.gcApresArticle = (a) => { gcImport.lignes[i].articleId = a.id; gcImportRecalculer(); nav('gc-import'); };
  gcFormArticle('', {ref:l.ref || '', designation:l.designation || l.ref || '', unite:l.unite || 'pièce', prixVente:l.prix || 0});
};
window.gcSauverDemande = () => gcOperation(() => {
  const I = gcImport, D = gcD(); gcImportRecalculer();
  const actives = I.lignes.filter(l => !l.ignoree);
  if(!actives.length){ showToast('Toutes les lignes sont ignorées'); return; }
  const anc = I.demandeId ? D.demandes.find(x => x.id === I.demandeId) : null, ctx = gcCtx();
  const dm = Object.assign({}, anc || {id:GC.nouvelId('dp'), numero:GC.numeroSuivant(D.demandes, 'DP', ctx.date), date:ctx.date}, {
    clientId:I.clientId || '', fichier:I.fichier, entetes:I.entetes, colonnes:I.colonnes, brut:I.brut.slice(0, 3000), lignes:I.lignes, stats:gcStatsImport(I.lignes),
    corrections:anc ? GC.liste(anc.corrections).concat([{date:ctx.date, ts:ctx.ts, par:ctx.par}]) : []});
  gcEnregistrer('demandes', dm);
  const s = dm.stats;
  gcJournal(anc ? 'Correction' : 'Import', 'Demande de prix', dm, (I.fichier && I.fichier.nom || 'liste collée') + ' · ' + s.total + ' ligne(s), ' + (s.inconnu || 0) + ' inconnue(s), ' + (s.doublon || 0) + ' doublon(s)');
  gcImport = null; showToast('Demande enregistrée'); gcOuvrir('gc-demande', dm.id);
});
window.renderGcDemande = function(main){
  const D = gcD(), dm = D.demandes.find(x => x.id === gcOuvert['gc-demande']); if(!dm){ nav('gc-demandes'); return; }
  const ed = gcPeut(), s = gcStatsImport(dm.lignes), A = GC.parId(D.articles);
  const b = gcSection(main, gcRetour('gc-demandes', 'Demande ' + esc(dm.numero)), ed && !dm.archive ? (!dm.offreId ? `<button class="btn btn-primary" data-gc="creer-offre" onclick="gcDemandeVersOffre('${dm.id}')">Créer l'offre</button><button class="btn btn-ghost" onclick="gcCorrigerDemande('${dm.id}')">Corriger</button>` : '') + `<button class="btn btn-ghost" onclick="gcVoirOrigine('${dm.id}')">Fichier d'origine</button><button class="btn btn-ghost" onclick="gcArchiverDemande('${dm.id}')">Archiver</button>` : `<button class="btn btn-ghost" onclick="gcVoirOrigine('${dm.id}')">Fichier d'origine</button>`);
  b.innerHTML = `${dm.offreId ? `<div class="gc-alerte good">Offre créée : <a href="#" onclick="gcOuvrir('gc-offre', '${dm.offreId}'); return false;">${esc(dm.offreNumero || '')}</a></div>` : ''}${dm.archive ? '<div class="gc-alerte">Demande archivée.</div>' : ''}
    <div class="card"><div class="gc-kv"><div><span>Client</span><b>${esc(gcNomClient(dm.clientId))}</b></div><div><span>Date d'import</span><b>${gcDt(dm.date)}</b></div><div><span>Par</span><b>${esc((dm.cree || {}).par || '')}</b></div>
      <div><span>Fichier</span><b>${esc(dm.fichier && dm.fichier.nom || 'Liste collée')}</b></div><div><span>Feuille</span><b>${esc(dm.fichier && dm.fichier.feuille || '—')}</b></div><div><span>Taille</span><b>${dm.fichier && dm.fichier.taille ? Math.round(dm.fichier.taille / 1024 * 10) / 10 + ' Ko' : '—'}</b></div>
      <div><span>Colonnes</span><b>${esc(Object.entries(dm.colonnes || {}).map(([k, i]) => k + ' = « ' + (dm.entetes || [])[i] + ' »').join(', '))}</b></div>${GC.liste(dm.corrections).length ? `<div><span>Corrections</span><b>${GC.liste(dm.corrections).length}</b></div>` : ''}</div></div>
    <div class="gc-chiffres"><div class="gc-chiffre good"><span>Reconnues</span><b>${s.ok || 0}</b></div><div class="gc-chiffre ${s.inconnu ? 'bad' : ''}"><span>Inconnues</span><b>${s.inconnu || 0}</b></div><div class="gc-chiffre"><span>Doublons</span><b>${s.doublon || 0}</b></div><div class="gc-chiffre"><span>Erreurs</span><b>${s.erreur || 0}</b></div><div class="gc-chiffre"><span>Ignorées</span><b>${s.ignoree || 0}</b></div></div>
    <div class="card"><table class="gc-lignes"><thead><tr><th>Ligne</th><th>Lu</th><th>Article</th><th class="n">Quantité</th><th>Contrôle</th></tr></thead><tbody>${GC.liste(dm.lignes).map(l => `<tr style="${l.ignoree ? 'opacity:.5;' : ''}"><td data-l="Ligne">${l.n}</td><td data-l="Lu">${esc([l.ref, l.designation].filter(Boolean).join(' · '))}</td><td data-l="Article">${esc(gcLibArticle(A[l.articleId]) || '—')}</td><td class="n" data-l="Quantité">${gcQ(l.qte)} ${esc(l.unite || '')}</td><td data-l="Contrôle">${gcBadge(GC_IMPORT_STATUTS[l.ignoree ? 'ignoree' : l.statut])}</td></tr>`).join('')}</tbody></table></div>`;
};
window.gcCorrigerDemande = (id) => {
  const dm = gcD().demandes.find(x => x.id === id); if(!dm || dm.offreId) return;
  gcImport = {demandeId:id, clientId:dm.clientId, fichier:dm.fichier, entetes:dm.entetes || [], brut:dm.brut || [], colonnes:dm.colonnes || {}, lignes:JSON.parse(JSON.stringify(dm.lignes || []))};
  gcImportRecalculer(); nav('gc-import');
};
window.gcVoirOrigine = (id) => {
  const dm = gcD().demandes.find(x => x.id === id); if(!dm) return;
  const lignes = [dm.entetes || []].concat(dm.brut || []);
  window.gcTelechargerOrigine = () => gcTelecharger((dm.fichier && dm.fichier.nom ? dm.fichier.nom.replace(/\.[^.]+$/, '') : dm.numero) + '-origine.csv', '﻿' + lignes.map(r => r.map(x => /[;"\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : String(x)).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  mgtModal('Données d\'origine · ' + esc(dm.fichier && dm.fichier.nom || 'liste collée'), `<div style="overflow:auto;max-height:60vh;"><table class="gc-lignes"><thead><tr>${(dm.entetes || []).map(e => `<th>${esc(e)}</th>`).join('')}</tr></thead><tbody>${(dm.brut || []).slice(0, 300).map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <button class="btn btn-ghost" style="width:100%;margin-top:10px;" onclick="gcTelechargerOrigine()">Télécharger (CSV)</button>`);
};
window.gcArchiverDemande = (id) => gcConfirmer('Archiver la demande', 'La demande sera masquée des listes ; elle reste consultable.', () => gcOperation(() => {
  const dm = gcD().demandes.find(x => x.id === id); gcEnregistrer('demandes', Object.assign({}, dm, {archive:{date:getTodayISO(), par:gcPar()}})); gcJournal('Archivage', 'Demande de prix', dm); nav('gc-demandes');
}));
window.gcDemandeVersOffre = (id) => gcOperation(() => {
  const D = gcD(), dm = D.demandes.find(x => x.id === id); if(!dm) return;
  if(!dm.clientId){ showToast('Indiquez le client de la demande (Corriger)'); return; }
  const of = GC.demandeVersOffre(D, dm, gcCtx());
  const ignorees = GC.liste(dm.lignes).filter(l => !l.ignoree && (!l.articleId || l.statut === 'erreur')).length;
  gcEnregistrer('offres', of); gcEnregistrer('demandes', Object.assign({}, dm, {offreId:of.id, offreNumero:of.numero}));
  gcJournal('Création', 'Offre commerciale', of, 'Depuis la demande ' + dm.numero + ' · ' + gcE(GC.totaux(of).ht) + ' HT');
  showToast('Offre ' + of.numero + ' créée' + (ignorees ? ' (' + ignorees + ' ligne(s) non rapprochée(s) écartée(s))' : '')); gcOuvrir('gc-offre', of.id);
});

// ============================================================
// OFFRES COMMERCIALES
// ============================================================
window.renderGcOffres = function(main){
  const ed = gcPeut(), auj = getTodayISO();
  const b = gcSection(main, 'Offres commerciales', (ed ? `<button class="btn btn-primary" data-gc="nouvelle-offre" onclick="gcNouveauDoc('offre')">+ Offre</button>` : '') + gcBoutonsExport('offres'));
  b.innerHTML = gcTable({id:'offres', lignes:() => gcD().offres, tri:1, sens:-1, texte:o => [o.numero, gcNomClient(o.clientId), o.referenceClient].join(' '),
    filtres:[{id:'statut', label:'Statut', defaut:'actives', options:[['actives', 'En cours (brouillon, envoyée)'], ['brouillon', 'Brouillons'], ['envoyee', 'Envoyées'], ['acceptee', 'Acceptées'], ['refusee', 'Refusées'], ['expiree', 'Expirées'], ['archives', 'Archivées'], ['', 'Toutes']],
      test:(o, v) => { if(v === 'archives') return !!o.archive; if(o.archive) return false; const s = GC.statutOffre(o, auj).cle; return v === 'actives' ? (s === 'brouillon' || s === 'envoyee') : s === v; }},
      {id:'client', label:'Client', options:[['', 'Tous les clients']].concat(Object.entries(gcClients()).map(([id, c]) => [id, c.nom])), test:(o, v) => o.clientId === v}],
    colonnes:[{titre:'N°', val:o => o.numero + (o.version > 1 ? ' v' + o.version : '')}, {titre:'Date', val:o => o.date, html:o => gcDt(o.date)}, {titre:'Client', val:o => gcNomClient(o.clientId)},
      {titre:'Validité', val:o => o.validite || '', html:o => gcDt(o.validite)}, {titre:'Total HT', num:true, tri:o => GC.totaux(o).ht, html:o => gcE(GC.totaux(o).ht)},
      {titre:'Statut', tri:o => GC.statutOffre(o, auj).label, html:o => gcBadge(GC.statutOffre(o, auj)) + (o.commandeId ? '<span class="gc-tag">commandée</span>' : '')}],
    clic:o => `gcOuvrir('gc-offre', '${o.id}')`, vide:'Aucune offre'});
};
function gcTableLignesDoc(d, opts){
  opts = opts || {};
  return `<div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Quantité</th><th class="n">Prix unitaire HT</th><th class="n">Remise</th><th class="n">Montant HT</th></tr></thead><tbody>
    ${GC.liste(d.lignes).map(l => `<tr><td data-l="Article">${esc((l.ref ? l.ref + ' · ' : '') + (l.designation || ''))}${l.palier !== undefined && l.palier !== null && !l.puManuel ? '<span class="gc-tag">palier</span>' : ''}</td><td class="n" data-l="Quantité">${gcQ(l.qte)} ${esc(l.unite || '')}</td><td class="n" data-l="Prix">${gcE(l.pu)}</td><td class="n" data-l="Remise">${l.remise ? gcPct(l.remise) : '—'}</td><td class="n" data-l="Montant">${gcE(GC.montantLigne(l))}</td></tr>`).join('')}
    </tbody></table></div>${gcTotauxHTML(GC.totaux(d), d)}`;
}
function gcTotauxHTML(t, d){
  return `<div class="gc-chiffres" style="margin-top:8px;">${t.remises ? `<div class="gc-chiffre"><span>Remises${d && d.remise ? ' (dont ' + gcPct(d.remise) + ' globale)' : ''}</span><b>${gcE(t.remises)}</b></div>` : ''}<div class="gc-chiffre"><span>Total HT</span><b>${gcE(t.ht)}</b></div><div class="gc-chiffre"><span>TVA ${d ? gcPct(d.tva) : ''}</span><b>${gcE(t.tva)}</b></div><div class="gc-chiffre good"><span>Total TTC</span><b>${gcE(t.ttc)}</b></div></div>`;
}
window.renderGcOffre = function(main){
  const D = gcD(), o = D.offres.find(x => x.id === gcOuvert['gc-offre']); if(!o){ nav('gc-offres'); return; }
  const ed = gcPeut() && !o.archive, auj = getTodayISO(), st = GC.statutOffre(o, auj), cmd = o.commandeId ? D.cmdC.find(x => x.id === o.commandeId) : null;
  let act = '';
  if(ed){
    if(st.cle === 'brouillon') act += `<button class="btn btn-primary" onclick="gcModifierDoc('offre', '${o.id}')">Modifier</button><button class="btn btn-ghost" data-gc="offre-envoyee" onclick="gcOffreStatut('${o.id}', 'envoyee')">Marquer envoyée</button>`;
    if(st.cle === 'envoyee' || st.cle === 'brouillon') act += `<button class="btn btn-primary" data-gc="offre-acceptee" onclick="gcOffreStatut('${o.id}', 'acceptee')">Acceptée</button><button class="btn btn-ghost" onclick="gcOffreStatut('${o.id}', 'refusee')">Refusée</button>`;
    if(st.cle === 'acceptee' && !cmd) act += `<button class="btn btn-primary" data-gc="offre-commande" onclick="gcFormOffreCommande('${o.id}')">Transformer en commande</button>`;
    if(st.cle !== 'acceptee') act += `<button class="btn btn-ghost" data-gc="nouvelle-version" onclick="gcOffreVersion('${o.id}')">Nouvelle version</button>`;
  }
  act += `<button class="btn btn-ghost" onclick="gcDocument('offre', '${o.id}', 'print')">Imprimer</button><button class="btn btn-ghost" onclick="gcDocument('offre', '${o.id}', 'pdf')">PDF</button>`;
  if(ed && !cmd) act += `<button class="btn btn-ghost" onclick="gcArchiverDoc('offres', '${o.id}', 'Offre commerciale')">Archiver</button>`;
  const b = gcSection(main, gcRetour('gc-offres', 'Offre ' + esc(o.numero) + (o.version > 1 ? ' · version ' + o.version : '')), act);
  b.innerHTML = `${cmd ? `<div class="gc-alerte good">Transformée en commande <a href="#" onclick="gcOuvrir('gc-commande', '${cmd.id}'); return false;">${esc(cmd.numero)}</a>.</div>` : ''}${st.cle === 'expiree' ? '<div class="gc-alerte bad">Offre expirée le ' + gcDt(o.validite) + ' : créez une nouvelle version pour la prolonger.</div>' : ''}${o.archive ? '<div class="gc-alerte">Offre archivée.</div>' : ''}
    <div class="card"><div class="gc-kv"><div><span>Client</span><b>${esc(gcNomClient(o.clientId))}</b></div><div><span>Date</span><b>${gcDt(o.date)}</b></div><div><span>Valable jusqu'au</span><b>${gcDt(o.validite)}</b></div><div><span>Statut</span><b>${gcBadge(st)}</b></div>
      ${o.referenceClient ? `<div><span>Référence client</span><b>${esc(o.referenceClient)}</b></div>` : ''}${o.demandeId ? `<div><span>Demande d'origine</span><b><a href="#" onclick="gcOuvrir('gc-demande', '${o.demandeId}'); return false;">${esc(o.demandeNumero || '')}</a></b></div>` : ''}
      ${o.envoyee ? `<div><span>Envoyée</span><b>${gcDt(o.envoyee.date)}</b></div>` : ''}${o.decision ? `<div><span>${o.statut === 'acceptee' ? 'Acceptée' : 'Refusée'} le</span><b>${gcDt(o.decision.date)}${o.decision.motif ? ' · ' + esc(o.decision.motif) : ''}</b></div>` : ''}</div></div>
    <div class="card"><h3 class="gc-h3">Articles et tarifs appliqués</h3>${gcTableLignesDoc(o)}${o.conditions ? `<div style="margin-top:8px;font-size:13px;white-space:pre-line;"><b>Conditions :</b> ${esc(o.conditions)}</div>` : ''}</div>
    ${GC.liste(o.versions).length ? `<div class="card"><h3 class="gc-h3">Versions précédentes</h3>${o.versions.slice().reverse().map(v => `<div class="session-row"><span><b>Version ${v.version}</b> · ${gcDt(v.date)} · ${gcBadge(GC.OFFRE_STATUTS[v.statut] || GC.OFFRE_STATUTS.brouillon)}<br><span class="gc-sous">Archivée le ${gcDt((v.archivee || {}).date)} par ${esc((v.archivee || {}).par || '')}</span></span><span style="text-align:right;"><b>${gcE((v.totaux || GC.totaux(v)).ht)} HT</b><br><button class="btn btn-ghost" style="padding:3px 10px;font-size:12px;" data-gc="comparer-version" onclick="gcComparerVersion('${o.id}', ${v.version})">Comparer</button></span></div>`).join('')}</div>` : ''}`;
};
window.gcOffreStatut = (id, statut) => {
  const o = gcD().offres.find(x => x.id === id); if(!o) return;
  const lib = {envoyee:'envoyée', acceptee:'acceptée', refusee:'refusée'}[statut];
  if(statut === 'acceptee' && o.validite && o.validite < getTodayISO()){ showToast('Offre expirée : créez une nouvelle version'); return; }
  gcConfirmer('Offre ' + lib, 'Marquer l\'offre ' + o.numero + ' comme ' + lib + ' ?', (motif) => gcOperation(() => {
    const ctx = gcCtx(), n = Object.assign({}, o, {statut});
    if(statut === 'envoyee') n.envoyee = {date:ctx.date, ts:ctx.ts, par:ctx.par};
    else n.decision = {date:ctx.date, ts:ctx.ts, par:ctx.par, motif:motif || ''};
    gcEnregistrer('offres', n); gcJournal('Offre ' + lib, 'Offre commerciale', n, motif || ''); showToast('Offre ' + lib); nav('gc-offre');
  }), {motif:statut !== 'envoyee'});
};
window.gcOffreVersion = (id) => gcOperation(() => {
  const o = gcD().offres.find(x => x.id === id); if(!o) return;
  const R = gcReglages(), n = GC.nouvelleVersion(o, gcCtx());
  n.validite = GC.ajouterJours(n.date, Number(R.validiteOffre) || 30); n.envoyee = null; n.decision = null;
  gcEnregistrer('offres', n); gcJournal('Nouvelle version', 'Offre commerciale', n, 'Version ' + n.version + ' (la version ' + (n.version - 1) + ' est conservée)');
  showToast('Version ' + n.version + ' créée'); gcModifierDoc('offre', id);
});
window.gcComparerVersion = (id, version) => {
  const o = gcD().offres.find(x => x.id === id), v = o && GC.liste(o.versions).find(x => x.version === version); if(!v) return;
  const C = GC.comparerVersions(v, o), etat = {ajoutee:['Ajoutée', 'good'], retiree:['Retirée', 'bad'], modifiee:['Modifiée', 'warn'], identique:['Identique', '']};
  mgtModal('Version ' + version + ' → version ' + o.version, `<div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Qté</th><th class="n">Prix</th><th class="n">Montant HT</th><th>Changement</th></tr></thead><tbody>
    ${C.lignes.map(l => `<tr><td data-l="Article">${esc(l.designation)}</td><td class="n" data-l="Qté">${l.qteA !== l.qteB ? gcQ(l.qteA) + ' → <b>' + gcQ(l.qteB) + '</b>' : gcQ(l.qteB)}</td><td class="n" data-l="Prix">${l.puA !== l.puB ? gcE(l.puA) + ' → <b>' + gcE(l.puB) + '</b>' : gcE(l.puB)}${l.remiseA !== l.remiseB ? '<br>remise ' + gcPct(l.remiseA) + ' → ' + gcPct(l.remiseB) : ''}</td><td class="n" data-l="Montant">${gcE(l.montantA)} → <b>${gcE(l.montantB)}</b></td><td data-l="Changement">${gcBadge({label:etat[l.etat][0], cls:etat[l.etat][1]})}</td></tr>`).join('')}
    </tbody></table></div><div class="gc-chiffres" style="margin-top:10px;"><div class="gc-chiffre"><span>HT version ${version}</span><b>${gcE(C.totalA.ht)}</b></div><div class="gc-chiffre"><span>HT version ${o.version}</span><b>${gcE(C.totalB.ht)}</b></div><div class="gc-chiffre ${C.ecartHT < 0 ? 'bad' : 'good'}"><span>Écart</span><b>${C.ecartHT > 0 ? '+' : ''}${gcE(C.ecartHT)}</b></div></div>
    ${C.conditions ? '<div class="gc-sous">Les conditions commerciales ont changé.</div>' : ''}${C.validite ? '<div class="gc-sous">La date de validité a changé.</div>' : ''}`);
};
window.gcFormOffreCommande = (id) => {
  if(!gcPeut()) return gcRefus();
  const o = gcD().offres.find(x => x.id === id);
  mgtModal('Transformer en commande', `<p style="margin-top:0;">L'offre ${esc(o.numero)} devient une commande client confirmée, sans ressaisie (articles, quantités, prix, remises, conditions).</p>
    <div class="field"><label>Type de commande</label><select id="goc-type" onchange="document.getElementById('goc-ann').style.display = this.value === 'annuelle' ? '' : 'none'">${gcOpts([['ponctuelle', 'Ponctuelle'], ['annuelle', 'Annuelle / récurrente']], 'ponctuelle')}</select></div>
    ${mgtChamp('Livraison souhaitée', 'goc-date', '', 'date')}
    <div id="goc-ann" style="display:none;"><div class="gc-form">${mgtChamp('Première échéance', 'goc-debut', getTodayISO(), 'date')}${mgtChamp('Nombre d\'échéances', 'goc-nb', 12, 'number', 'min="1"')}${mgtChamp('Tous les (mois)', 'goc-pas', 1, 'number', 'min="1"')}</div><div class="gc-sous" style="margin-bottom:8px;">Les quantités sont réparties sur les échéances ; modifiables ensuite.</div></div>
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-commande-offre" onclick="gcOffreVersCommande('${id}')">Créer la commande</button>`);
};
window.gcOffreVersCommande = (id) => gcOperation(() => {
  const D = gcD(), type = gcVal('goc-type');
  const c = GC.offreVersCommande(D, id, gcCtx({type, dateSouhaitee:gcVal('goc-date'), debut:gcVal('goc-debut'), nombre:GC.num(gcVal('goc-nb')) || 12, pas:GC.num(gcVal('goc-pas')) || 1}));
  if(c.dateSouhaitee && c.dateSouhaitee < c.date){ showToast('La date souhaitée est antérieure à aujourd\'hui'); return; }
  const o = D.offres.find(x => x.id === id);
  gcEnregistrer('cmdC', c); gcEnregistrer('offres', Object.assign({}, o, {commandeId:c.id, commandeNumero:c.numero}));
  gcJournal('Création', 'Commande client', c, 'Depuis l\'offre ' + o.numero + (o.version > 1 ? ' v' + o.version : '') + ' · ' + gcE(GC.totaux(c).ht) + ' HT');
  mgtFermer(); showToast('Commande ' + c.numero + ' créée'); gcOuvrir('gc-commande', c.id);
});
window.gcArchiverDoc = (cle, id, lib) => gcConfirmer('Archiver', 'Le document sera masqué des listes en cours ; il reste consultable et inscrit au journal.', () => gcOperation(() => {
  const x = gcListe(cle).find(y => y.id === id); if(!x) return;
  gcEnregistrer(cle, Object.assign({}, x, {archive:{date:getTodayISO(), par:gcPar()}})); gcJournal('Archivage', lib, x); showToast('Archivé'); nav(activeTab);
}));

// ============================================================
// COMMANDES CLIENTS
// ============================================================
window.renderGcCommandes = function(main){
  const ed = gcPeut(), auj = getTodayISO(), D = gcD(), liv = GC.livres(D);
  const b = gcSection(main, 'Commandes clients', (ed ? `<button class="btn btn-primary" data-gc="nouvelle-commande" onclick="gcNouveauDoc('commande')">+ Commande</button>` : '') + gcBoutonsExport('commandes'));
  const pctLivre = (c) => { const q = GC.liste(c.lignes).reduce((s, l) => s + GC.num(l.qte), 0), l = GC.liste(c.lignes).reduce((s, x) => s + Math.min(GC.num(x.qte), liv[GC.cleLigne(c.id, x.lid)] || 0), 0); return q ? l / q * 100 : 0; };
  b.innerHTML = gcTable({id:'commandes', lignes:() => gcD().cmdC, tri:1, sens:-1, texte:c => [c.numero, gcNomClient(c.clientId), c.reference, c.offreNumero].join(' '),
    filtres:[{id:'statut', label:'Statut', defaut:'encours', options:[['encours', 'En cours'], ['retard', 'En retard'], ['brouillon', 'Brouillons'], ['livree', 'Livrées'], ['cloturee', 'Clôturées'], ['annulee', 'Annulées'], ['archives', 'Archivées'], ['', 'Toutes']],
      test:(c, v) => { if(v === 'archives') return !!c.archive; if(c.archive) return false; const s = GC.statutCmdC(c, liv).cle; return v === 'encours' ? !!GC.CMDC_OUVERTE[s] : v === 'retard' ? GC.retardCmdC(c, liv, auj) : s === v; }},
      {id:'type', label:'Type', options:[['', 'Tous types'], ['ponctuelle', 'Ponctuelles'], ['annuelle', 'Annuelles']], test:(c, v) => (c.type || 'ponctuelle') === v},
      {id:'client', label:'Client', options:[['', 'Tous les clients']].concat(Object.entries(gcClients()).map(([id, c]) => [id, c.nom])), test:(c, v) => c.clientId === v}],
    colonnes:[{titre:'N°', val:c => c.numero || '', html:c => `<b>${esc(c.numero || 'Brouillon')}</b>${c.type === 'annuelle' ? '<span class="gc-tag">annuelle</span>' : ''}`}, {titre:'Date', val:c => c.date, html:c => gcDt(c.date)},
      {titre:'Client', val:c => gcNomClient(c.clientId)}, {titre:'Livraison souhaitée', val:c => c.dateSouhaitee || '', html:c => gcDt(c.dateSouhaitee) + (GC.retardCmdC(c, liv, auj) ? ' <span class="gc-tag" style="color:var(--bad);">retard</span>' : '')},
      {titre:'Total HT', num:true, tri:c => GC.totaux(c).ht, html:c => gcE(GC.totaux(c).ht)}, {titre:'Livré', num:true, tri:pctLivre, html:c => gcPct(pctLivre(c))},
      {titre:'Statut', tri:c => GC.statutCmdC(c, liv).label, html:c => gcBadge(GC.statutCmdC(c, liv))}],
    clic:c => `gcOuvrir('gc-commande', '${c.id}')`, vide:'Aucune commande'});
};
window.renderGcCommande = function(main){
  const D = gcD(), c = D.cmdC.find(x => x.id === gcOuvert['gc-commande']); if(!c){ nav('gc-commandes'); return; }
  const ed = gcPeut() && !c.archive, auj = getTodayISO(), liv = GC.livres(D), res = GC.reservations(D), S = GC.stocks(D), st = GC.statutCmdC(c, liv), ouverte = !!GC.CMDC_OUVERTE[st.cle];
  const bls = D.livraisons.filter(b => b.cmdId === c.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const RT = GC.rentabilite(D, {cmdId:c.id}).total, retard = GC.retardCmdC(c, liv, auj);
  let act = '';
  if(ed){
    if(st.cle === 'brouillon') act += `<button class="btn btn-primary" data-gc="confirmer-commande" onclick="gcCmdConfirmer('${c.id}')">Confirmer</button><button class="btn btn-ghost" onclick="gcModifierDoc('commande', '${c.id}')">Modifier</button>`;
    if(ouverte){
      act += `<button class="btn btn-primary" data-gc="livrer" onclick="gcFormLivraison('${c.id}')">Livrer</button><button class="btn btn-ghost" data-gc="reserver-tout" onclick="gcReserverTout('${c.id}')">Réserver le disponible</button>`;
      if(!bls.some(b => !b.annulee)) act += `<button class="btn btn-ghost" onclick="gcModifierDoc('commande', '${c.id}')">Modifier</button>`;
      act += `<button class="btn btn-ghost" onclick="gcCmdCloturer('${c.id}')">Clôturer</button>`;
    }
    if(st.cle === 'brouillon' || (ouverte && !bls.some(b => !b.annulee))) act += `<button class="btn btn-ghost" style="color:var(--bad);" onclick="gcCmdAnnuler('${c.id}')">Annuler</button>`;
  }
  act += `<button class="btn btn-ghost" onclick="gcDocument('commande', '${c.id}', 'print')">Imprimer</button><button class="btn btn-ghost" onclick="gcDocument('commande', '${c.id}', 'pdf')">PDF</button>`;
  if(ed && (st.cle === 'livree' || st.cle === 'cloturee' || st.cle === 'annulee')) act += `<button class="btn btn-ghost" onclick="gcArchiverDoc('cmdC', '${c.id}', 'Commande client')">Archiver</button>`;
  const b = gcSection(main, gcRetour('gc-commandes', 'Commande ' + esc(c.numero || '(brouillon)')), act);
  const lignes = GC.liste(c.lignes).map(l => {
    const k = GC.cleLigne(c.id, l.lid), a = gcArticle(l.articleId), lv = liv[k] || 0, r = res[k] || 0, reste = Math.max(0, GC.num(l.qte) - lv), s = S[l.articleId] || {};
    return `<tr><td data-l="Article">${esc((l.ref ? l.ref + ' · ' : '') + (l.designation || ''))}${a && !GC.suiviStock(a) ? '<span class="gc-tag">sans stock</span>' : ''}${!a ? '<span class="gc-tag">ligne libre</span>' : ''}</td>
      <td class="n" data-l="Commandé">${gcQ(l.qte)} ${esc(l.unite || '')}</td><td class="n" data-l="Prix HT">${gcE(l.pu)}${l.remise ? '<br><span class="gc-sous">−' + gcPct(l.remise) + '</span>' : ''}</td>
      <td class="n" data-l="Livré">${gcQ(lv)}</td><td class="n" data-l="Reste à livrer"><b>${gcQ(reste)}</b></td>
      <td class="n" data-l="Réservé">${a && GC.suiviStock(a) ? gcQ(r) : '—'}</td><td class="n" data-l="Disponible (stock)">${a && GC.suiviStock(a) ? gcQ(s.disponible) : '—'}</td>
      <td data-l="">${ed && ouverte && a && GC.suiviStock(a) ? `${reste - r > 0 && s.disponible > 0 ? `<button class="btn btn-ghost" style="padding:3px 9px;font-size:12px;" onclick="gcFormReservation('${c.id}', '${l.lid}')">Réserver</button>` : ''}${r > 0 ? ` <button class="btn btn-ghost" style="padding:3px 9px;font-size:12px;" onclick="gcFormLiberation('${c.id}', '${l.lid}')">Libérer</button>` : ''}` : ''}</td></tr>`;
  }).join('');
  const ech = c.type === 'annuelle' && GC.liste(c.echeances).length ? GC.suiviEcheances(c, liv, auj) : null;
  const EST = {livree:{label:'Livrée', cls:'good'}, retard:{label:'En retard', cls:'bad'}, partielle:{label:'En partie', cls:'warn'}, a_venir:{label:'À venir', cls:''}};
  const tot = GC.totaux(c);
  b.innerHTML = `${retard ? '<div class="gc-alerte bad">Commande en retard de livraison.</div>' : ''}${c.annulation ? `<div class="gc-alerte">Annulée le ${gcDt(c.annulation.date)} par ${esc(c.annulation.par || '')} : ${esc(c.annulation.motif || '')}</div>` : ''}${c.cloture ? `<div class="gc-alerte">Clôturée le ${gcDt(c.cloture.date)} par ${esc(c.cloture.par || '')}${c.cloture.motif ? ' : ' + esc(c.cloture.motif) : ''}</div>` : ''}${c.archive ? '<div class="gc-alerte">Commande archivée.</div>' : ''}
    <div class="card"><div class="gc-kv"><div><span>Client</span><b><a href="#" onclick="gcOuvrir('gc-client', '${c.clientId}'); return false;">${esc(gcNomClient(c.clientId))}</a></b></div><div><span>Date</span><b>${gcDt(c.date)}</b></div><div><span>Livraison souhaitée</span><b>${gcDt(c.dateSouhaitee)}</b></div>
      <div><span>Type</span><b>${c.type === 'annuelle' ? 'Annuelle / récurrente' : 'Ponctuelle'}</b></div><div><span>Statut</span><b>${gcBadge(st)}</b></div><div><span>Conditions de paiement</span><b>${esc(c.conditions || '—')}</b></div>
      ${c.reference ? `<div><span>Référence client</span><b>${esc(c.reference)}</b></div>` : ''}${c.offreId ? `<div><span>Offre d'origine</span><b><a href="#" onclick="gcOuvrir('gc-offre', '${c.offreId}'); return false;">${esc(c.offreNumero || '')}</a></b></div>` : ''}</div>
      ${c.commentaires ? `<div style="margin-top:8px;font-size:13px;white-space:pre-line;">${esc(c.commentaires)}</div>` : ''}</div>
    <div class="card"><h3 class="gc-h3">Articles · quantités commandées, livrées, restantes</h3><div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Commandé</th><th class="n">Prix HT</th><th class="n">Livré</th><th class="n">Reste à livrer</th><th class="n">Réservé</th><th class="n">Disponible</th><th></th></tr></thead><tbody>${lignes}</tbody></table></div>${gcTotauxHTML(tot, c)}</div>
    ${ech ? `<div class="card"><h3 class="gc-h3">Échéances : prévu, livré, restant</h3><table class="gc-lignes"><thead><tr><th>Échéance</th><th class="n">Prévu</th><th class="n">Livré</th><th class="n">Reste</th><th>État</th></tr></thead><tbody>${ech.map(e => `<tr><td data-l="Échéance">${gcDt(e.date)}</td><td class="n" data-l="Prévu">${gcQ(e.prevu)}</td><td class="n" data-l="Livré">${gcQ(e.livre)}</td><td class="n" data-l="Reste"><b>${gcQ(e.reste)}</b></td><td data-l="État">${gcBadge(EST[e.cle])}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="card"><h3 class="gc-h3">Livraisons</h3>${bls.length ? bls.map(x => { const f = gcFactureDe(x); return `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-livraison', '${x.id}')"><span><b>${esc(x.numero)}</b> · ${gcDt(x.date)}${x.annulee ? ' <span class="gc-tag">annulée</span>' : ''}<br><span class="gc-sous">${GC.liste(x.lignes).map(l => gcQ(GC.qteNetteLigne(l)) + ' ' + esc(l.designation || '')).join(' · ')}</span></span><span style="text-align:right;">${x.annulee ? '' : f ? gcBadge(f.def) : gcBadge({label:'À facturer', cls:'warn'})}</span></div>`; }).join('') : '<div class="gc-sous">Aucune livraison.</div>'}</div>
    ${bls.some(x => !x.annulee) ? `<div class="card"><h3 class="gc-h3">Rentabilité réelle de la commande (quantités livrées)</h3><div class="gc-chiffres"><div class="gc-chiffre"><span>CA livré</span><b>${gcE(RT.ca)}</b></div><div class="gc-chiffre"><span>Coût réel</span><b>${gcE(RT.cout)}</b></div><div class="gc-chiffre ${RT.marge < 0 ? 'bad' : 'good'}"><span>Marge brute</span><b>${gcE(RT.marge)}</b></div><div class="gc-chiffre"><span>Taux de marque</span><b>${gcPct(RT.tauxMarque)}</b></div><div class="gc-chiffre"><span>Taux de marge</span><b>${gcPct(RT.tauxMarge)}</b></div></div>${RT.provisoire ? '<div class="gc-sous">Provisoire : frais estimés ou articles sans stock valorisés au prix d\'achat du catalogue.</div>' : ''}</div>` : ''}`;
};
window.gcCmdConfirmer = (id) => gcOperation(() => {
  const c = gcD().cmdC.find(x => x.id === id); if(!c) return;
  const ev = GC.echeancesValides(c); if(ev){ showToast(ev); return; }
  const n = Object.assign({}, c, {statut:'confirmee', confirmation:{date:getTodayISO(), ts:Date.now(), par:gcPar()}});
  gcEnregistrer('cmdC', n); gcJournal('Confirmation', 'Commande client', n); showToast('Commande confirmée'); nav('gc-commande');
});
window.gcReserverTout = (id) => gcOperation(() => {
  const m = GC.reserverTout(gcD(), id, gcCtx());
  if(!m.length){ showToast('Rien à réserver (pas de stock disponible ou déjà réservé)'); return; }
  const c = gcD().cmdC.find(x => x.id === id);
  gcEnregistrer('mouvements', m); gcJournal('Réservation', 'Commande client', c, m.map(x => gcQ(x.qte) + ' ' + (gcLibArticle(gcArticle(x.articleId)))).join(' · '));
  showToast(m.length + ' réservation(s) enregistrée(s)'); nav('gc-commande');
});
window.gcFormReservation = (id, lid) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), c = D.cmdC.find(x => x.id === id), l = GC.liste(c.lignes).find(x => x.lid === lid), k = GC.cleLigne(id, lid);
  const reste = GC.num(l.qte) - (GC.livres(D)[k] || 0) - (GC.reservations(D)[k] || 0), dispo = GC.stockArticle(D, l.articleId).disponible;
  mgtModal('Réserver · ' + esc(l.designation), `<p style="margin-top:0;">Reste à livrer non réservé : <b>${gcQ(reste)}</b> · disponible en stock : <b>${gcQ(dispo)}</b></p>
    ${mgtChamp('Quantité à réserver', 'gres-q', GC.rq(Math.max(0, Math.min(reste, dispo))), 'number', 'step="any" min="0"')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-reservation" onclick="gcValiderReservation('${id}', '${lid}')">Réserver</button>`);
};
window.gcValiderReservation = (id, lid) => gcOperation(() => {
  const m = GC.reserver(gcD(), id, lid, gcVal('gres-q'), gcCtx()), c = gcD().cmdC.find(x => x.id === id);
  gcEnregistrer('mouvements', m); gcJournal('Réservation', 'Commande client', c, gcQ(m[0].qte) + ' ' + gcLibArticle(gcArticle(m[0].articleId)));
  mgtFermer(); showToast('Réservé'); nav('gc-commande');
});
window.gcFormLiberation = (id, lid) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), c = D.cmdC.find(x => x.id === id), l = GC.liste(c.lignes).find(x => x.lid === lid), r = GC.reservations(D)[GC.cleLigne(id, lid)] || 0;
  mgtModal('Libérer · ' + esc(l.designation), `<p style="margin-top:0;">Réservé pour cette commande : <b>${gcQ(r)}</b></p>${mgtChamp('Quantité à libérer', 'glib-q', r, 'number', 'step="any" min="0"')}${mgtChamp('Motif', 'glib-m', '')}
    <button class="btn btn-primary" style="width:100%;" onclick="gcValiderLiberation('${id}', '${lid}')">Libérer</button>`);
};
window.gcValiderLiberation = (id, lid) => gcOperation(() => {
  const motif = gcVal('glib-m'), m = GC.liberer(gcD(), id, lid, gcVal('glib-q'), gcCtx({motif:motif ? 'Libération : ' + motif : ''})), c = gcD().cmdC.find(x => x.id === id);
  gcEnregistrer('mouvements', m); gcJournal('Libération de réservation', 'Commande client', c, gcQ(m[0].qte) + ' ' + gcLibArticle(gcArticle(m[0].articleId)) + (motif ? ' · ' + motif : ''));
  mgtFermer(); showToast('Réservation libérée'); nav('gc-commande');
});
window.gcCmdCloturer = (id) => {
  const c = gcD().cmdC.find(x => x.id === id);
  gcConfirmer('Clôturer la commande', 'La commande ' + c.numero + ' est soldée en l\'état : le reste à livrer est abandonné et les réservations sont libérées.', (motif) => gcOperation(() => {
    const D = gcD(), m = GC.cloturerCmdC(D, id, gcCtx()), n = Object.assign({}, c, {statut:'cloturee', cloture:{date:getTodayISO(), ts:Date.now(), par:gcPar(), motif}});
    if(m.length) gcEnregistrer('mouvements', m); gcEnregistrer('cmdC', n); gcJournal('Clôture', 'Commande client', n, motif); showToast('Commande clôturée'); nav('gc-commande');
  }), {motif:true});
};
window.gcCmdAnnuler = (id) => {
  const c = gcD().cmdC.find(x => x.id === id);
  gcConfirmer('Annuler la commande', 'La commande ' + (c.numero || '') + ' sera annulée et ses réservations libérées. Elle reste consultable.', (motif) => gcOperation(() => {
    const D = gcD(), m = GC.annulerCmdC(D, id, gcCtx()), n = Object.assign({}, c, {statut:'annulee', annulation:{date:getTodayISO(), ts:Date.now(), par:gcPar(), motif}});
    if(m.length) gcEnregistrer('mouvements', m); gcEnregistrer('cmdC', n); gcJournal('Annulation', 'Commande client', n, motif); showToast('Commande annulée'); nav('gc-commande');
  }), {motif:true, motifObligatoire:true, danger:true, bouton:'Annuler la commande'});
};

// ============================================================
// LIVRAISONS
// ============================================================
function gcFormFrais(prefixe, frais, avecMethode){
  const lignes = GC.liste(frais).length ? frais : [{}];
  return `<div id="${prefixe}-frais">${lignes.map(f => gcLigneFrais(prefixe, f, avecMethode)).join('')}</div>
    <button class="btn btn-ghost" style="padding:5px 12px;" onclick="document.getElementById('${prefixe}-frais').insertAdjacentHTML('beforeend', gcLigneFrais('${prefixe}', {}, ${avecMethode ? 'true' : 'false'}))">+ Frais</button>`;
}
window.gcLigneFrais = function(prefixe, f, avecMethode){
  const st = 'padding:8px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);font-size:13px;';
  const R = gcReglages();
  return `<div class="${prefixe}-fr" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
    <input class="fr-lib" placeholder="Libellé (transport, manutention…)" value="${gcAttr(f.libelle)}" style="flex:2 1 160px;${st}">
    <input class="fr-mt" type="number" step="any" min="0" placeholder="Montant €" value="${gcAttr(f.montant)}" style="flex:1 1 90px;${st}">
    ${avecMethode ? `<select class="fr-meth" style="flex:1 1 150px;${st}">${gcOpts(Object.entries(GC.METHODES_FRAIS), f.methode || R.methodeFrais)}</select>` : ''}
    <select class="fr-st" style="flex:1 1 100px;${st}">${gcOpts([['reel', 'Réel'], ['estime', 'Estimé']], f.statut || 'reel')}</select>
    <button class="btn btn-ghost" style="padding:4px 10px;" onclick="this.parentNode.remove()">✕</button></div>`;
};
function gcLireFrais(prefixe){
  return Array.from(document.querySelectorAll('.' + prefixe + '-fr')).map(el => ({libelle:el.querySelector('.fr-lib').value.trim(), montant:GC.num(el.querySelector('.fr-mt').value),
    methode:el.querySelector('.fr-meth') ? el.querySelector('.fr-meth').value : undefined, statut:el.querySelector('.fr-st').value})).filter(f => f.montant || f.libelle);
}
window.gcFormLivraison = (id) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), c = D.cmdC.find(x => x.id === id), liv = GC.livres(D), res = GC.reservations(D), S = GC.stocks(D), dispoRestant = {};
  Object.keys(S).forEach(k => { dispoRestant[k] = S[k].disponible; });
  const lignes = GC.liste(c.lignes).map((l, i) => {
    const k = GC.cleLigne(id, l.lid), reste = GC.rq(Math.max(0, GC.num(l.qte) - (liv[k] || 0))), a = gcArticle(l.articleId), r = res[k] || 0;
    let prop = reste;
    if(a && GC.suiviStock(a)){ const libre = Math.max(0, dispoRestant[l.articleId] || 0); prop = GC.rq(Math.min(reste, r + libre)); dispoRestant[l.articleId] = libre - Math.max(0, prop - r); }
    return reste > 0 ? `<tr><td data-l="Article">${esc(l.designation || '')}</td><td class="n" data-l="Commandé">${gcQ(l.qte)}</td><td class="n" data-l="Déjà livré">${gcQ(liv[k] || 0)}</td><td class="n" data-l="Reste">${gcQ(reste)}</td>
      <td class="n" data-l="Stock">${a && GC.suiviStock(a) ? gcQ(r) + ' réservé · ' + gcQ((S[l.articleId] || {}).disponible) + ' dispo.' : 'sans stock'}</td><td data-l="Cette livraison"><input type="number" step="any" min="0" max="${reste}" class="gl-q" data-lid="${l.lid}" value="${prop}"></td></tr>` : '';
  }).join('');
  mgtModal('Livraison · commande ' + esc(c.numero), `<div class="gc-form">${mgtChamp('Date de livraison', 'gl-date', getTodayISO(), 'date')}${mgtChamp('Document associé (réf. transport, bon client…)', 'gl-ref', '')}</div>
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Commandé</th><th class="n">Déjà livré</th><th class="n">Reste</th><th class="n">Stock</th><th>Cette livraison</th></tr></thead><tbody>${lignes}</tbody></table></div>
    <div class="gc-sous" style="margin:6px 0 10px;">Les lots sont choisis automatiquement (les plus anciens d'abord, FIFO). Le réservé de cette commande est utilisé en premier.</div>
    <div class="field"><label>Frais de cette livraison (transport client…)</label>${gcFormFrais('gl', [], false)}</div>
    ${mgtZone('Note', 'gl-note', '')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-livraison" onclick="gcValiderLivraison('${id}')">Valider la livraison</button>`);
};
window.gcValiderLivraison = (id) => gcOperation(() => {
  const saisies = Array.from(document.querySelectorAll('.gl-q')).map(el => ({lid:el.dataset.lid, qte:GC.num(el.value)}));
  const date = gcVal('gl-date') || getTodayISO();
  if(date > getTodayISO()){ showToast('La date de livraison ne peut pas être dans le futur'); return; }
  const D = gcD(), r = GC.livrer(D, id, saisies, gcCtx({date, reference:gcVal('gl-ref'), note:gcVal('gl-note'), frais:gcLireFrais('gl')}));
  const c = D.cmdC.find(x => x.id === id);
  gcEnregistrer('livraisons', r.livraison); gcEnregistrer('mouvements', r.mouvements);
  gcJournal('Livraison', 'Commande client', c, r.livraison.numero + ' · ' + r.livraison.lignes.map(l => gcQ(l.qte) + ' ' + l.designation).join(' · ') + ' · commande ' + GC.CMDC_STATUTS[r.statut].label.toLowerCase());
  mgtFermer(); showToast('Livraison ' + r.livraison.numero + ' enregistrée'); gcOuvrir('gc-livraison', r.livraison.id);
});
// Facture liée (module Facturation GADH).
function gcFactureDe(bl){
  if(!bl || !bl.factureId) return null;
  if(!gcPeutLireFactures() || typeof factListe !== 'function') return {inconnue:true, def:{label:'Facturée', cls:'good'}};
  const toutes = factListe('gadh'), f = toutes[bl.factureId];
  if(!f) return null; // brouillon supprimé dans la Facturation : la livraison est de nouveau à facturer
  const st = factStatut(f, toutes);
  return {f, st, t:factTotaux(f, toutes), def:FACT_STATUTS[st] || {label:st, cls:''}};
}
window.renderGcLivraisons = function(main){
  const ed = gcPeut(), D = gcD();
  const b = gcSection(main, 'Livraisons', (ed && gcPeutFacturer() ? `<button class="btn btn-primary" data-gc="facturer-selection" onclick="gcFacturerSelection()">Facturer la sélection</button>` : '') + gcBoutonsExport('livraisons'));
  window.gcSelectionBL = window.gcSelectionBL || {};
  b.innerHTML = gcTable({id:'livraisons', lignes:() => gcD().livraisons, tri:1, sens:-1, texte:x => [x.numero, x.cmdNumero, gcNomClient(x.clientId), x.reference].join(' '),
    filtres:[{id:'fact', label:'Facturation', defaut:'', options:[['', 'Toutes'], ['afacturer', 'À facturer'], ['facturees', 'Facturées'], ['annulees', 'Annulées']], test:(x, v) => v === 'annulees' ? !!x.annulee : !x.annulee && (v === 'afacturer' ? !gcFactureDe(x) : !!gcFactureDe(x))},
      {id:'client', label:'Client', options:[['', 'Tous les clients']].concat(Object.entries(gcClients()).map(([id, c]) => [id, c.nom])), test:(x, v) => x.clientId === v}],
    colonnes:[{titre:'', tri:false, html:x => !x.annulee && !gcFactureDe(x) && ed ? `<input type="checkbox" onclick="event.stopPropagation(); gcSelectionBL['${x.id}'] = this.checked" ${gcSelectionBL[x.id] ? 'checked' : ''} style="width:18px;height:18px;">` : ''},
      {titre:'N°', val:x => x.numero, html:x => `<b>${esc(x.numero)}</b>${x.annulee ? '<span class="gc-tag">annulée</span>' : ''}`}, {titre:'Date', val:x => x.date, html:x => gcDt(x.date)}, {titre:'Client', val:x => gcNomClient(x.clientId)}, {titre:'Commande', val:x => x.cmdNumero || ''},
      {titre:'Montant HT', num:true, tri:x => GC.coutLivraison(x).ca, html:x => gcE(GC.coutLivraison(x).ca)}, {titre:'Coût réel', num:true, tri:x => GC.coutLivraison(x).cout, html:x => gcE(GC.coutLivraison(x).cout)},
      {titre:'Marge', num:true, tri:x => GC.coutLivraison(x).marge, html:x => { const r = GC.coutLivraison(x); return `<b style="color:${r.marge < 0 ? 'var(--bad)' : 'inherit'};">${gcE(r.marge)}</b>${r.provisoire ? '<span class="gc-tag">provisoire</span>' : ''}`; }},
      {titre:'Facture', tri:x => gcFactureDe(x) ? 1 : 0, html:x => x.annulee ? '' : gcFactureDe(x) ? gcBadge(gcFactureDe(x).def) : gcBadge({label:'À facturer', cls:'warn'})}],
    clic:x => `gcOuvrir('gc-livraison', '${x.id}')`, vide:'Aucune livraison'});
};
window.renderGcLivraison = function(main){
  const D = gcD(), x = D.livraisons.find(y => y.id === gcOuvert['gc-livraison']); if(!x){ nav('gc-livraisons'); return; }
  const ed = gcPeut(), r = GC.coutLivraison(x), f = gcFactureDe(x), c = D.cmdC.find(y => y.id === x.cmdId), L = {};
  GC.lots(D).forEach(l => { L[l.id] = l; });
  const ecart = x.lignes.some(l => GC.liste(l.allocations).some(a => L[a.lotId] && (Math.abs(L[a.lotId].coutUnit - a.coutUnit) > 1e-6 || Math.abs(L[a.lotId].fraisUnit - a.fraisUnit) > 1e-6)));
  let act = '';
  if(ed && !x.annulee){
    if(!f && gcPeutFacturer()) act += `<button class="btn btn-primary" data-gc="facturer" onclick="gcFacturer(['${x.id}'])">Facturer</button>`;
    act += `<button class="btn btn-ghost" onclick="gcFormRetourClient('${x.id}')">Retour client</button><button class="btn btn-ghost" onclick="gcFormFraisLivraison('${x.id}')">Frais</button>`;
    if(ecart) act += `<button class="btn btn-ghost" onclick="gcRevaloriser('${x.id}')">Mettre à jour les coûts</button>`;
    if(!f) act += `<button class="btn btn-ghost" style="color:var(--bad);" onclick="gcAnnulerLivraison('${x.id}')">Annuler</button>`;
  }
  if(f && f.f) act += `<button class="btn btn-ghost" onclick="gcOuvrirFacture('${x.factureId}')">Ouvrir la facture</button>`;
  act += `<button class="btn btn-ghost" onclick="gcDocument('livraison', '${x.id}', 'print')">Imprimer le BL</button><button class="btn btn-ghost" onclick="gcDocument('livraison', '${x.id}', 'pdf')">PDF</button>`;
  const b = gcSection(main, gcRetour('gc-livraisons', 'Bon de livraison ' + esc(x.numero)), act);
  b.innerHTML = `${x.annulee ? `<div class="gc-alerte bad">Livraison annulée le ${gcDt(x.annulee.date)} par ${esc(x.annulee.par || '')}${x.annulee.motif ? ' : ' + esc(x.annulee.motif) : ''}. Le stock a été réintégré.</div>` : ''}
    ${ecart && !x.annulee ? '<div class="gc-alerte">Les coûts de certains lots ont changé depuis cette livraison (frais de réception connus après coup). Le coût de la livraison reste celui du jour de la livraison tant que vous ne le mettez pas à jour.</div>' : ''}
    <div class="card"><div class="gc-kv"><div><span>Client</span><b>${esc(gcNomClient(x.clientId))}</b></div><div><span>Commande</span><b>${c ? `<a href="#" onclick="gcOuvrir('gc-commande', '${c.id}'); return false;">${esc(c.numero)}</a>` : esc(x.cmdNumero || '—')}</b></div><div><span>Date</span><b>${gcDt(x.date)}</b></div>
      <div><span>Par</span><b>${esc(x.par || '')}</b></div>${x.reference ? `<div><span>Document associé</span><b>${esc(x.reference)}</b></div>` : ''}<div><span>Facture</span><b>${x.annulee ? '—' : f ? (f.f ? esc(f.f.numero || 'brouillon') + ' ' : '') + gcBadge(f.def) : gcBadge({label:'À facturer', cls:'warn'})}</b></div></div>${x.note ? `<div style="margin-top:8px;font-size:13px;white-space:pre-line;">${esc(x.note)}</div>` : ''}</div>
    <div class="card"><h3 class="gc-h3">Articles livrés, lots et coûts réels</h3><div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Livré</th><th>Lots (FIFO)</th><th class="n">Prix HT</th><th class="n">CA</th><th class="n">Coût réel</th><th class="n">Marge</th></tr></thead><tbody>
      ${x.lignes.map(l => { const rl = r.lignes.find(y => y.lid === l.lid) || {}; const ret = GC.liste(l.retours).reduce((s, y) => s + GC.num(y.qte), 0); return `<tr><td data-l="Article">${esc((l.ref ? l.ref + ' · ' : '') + (l.designation || ''))}</td><td class="n" data-l="Livré">${gcQ(l.qte)} ${esc(l.unite || '')}${ret ? '<br><span class="gc-sous">− ' + gcQ(ret) + ' retourné(s)</span>' : ''}</td>
        <td data-l="Lots">${l.coutTheorique ? '<span class="gc-sous">sans stock · coût catalogue</span>' : GC.liste(l.allocations).map(a => `${esc(a.code || (L[a.lotId] || {}).code || a.lotId)} : ${gcQ(a.qte)} × ${gcE(GC.num(a.coutUnit) + GC.num(a.fraisUnit))}`).join('<br>')}</td>
        <td class="n" data-l="Prix">${gcE(l.pu)}${l.remise ? '<br>−' + gcPct(l.remise) : ''}</td><td class="n" data-l="CA">${gcE(rl.ca)}</td><td class="n" data-l="Coût">${gcE(rl.cout)}</td><td class="n" data-l="Marge">${gcE(rl.marge)}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="gc-chiffres" style="margin-top:8px;"><div class="gc-chiffre"><span>Chiffre d'affaires HT</span><b>${gcE(r.ca)}</b></div><div class="gc-chiffre"><span>Prix d'achat réel</span><b>${gcE(r.achat)}</b></div><div class="gc-chiffre"><span>Frais des réceptions</span><b>${gcE(r.fraisLots)}</b></div><div class="gc-chiffre"><span>Frais de livraison</span><b>${gcE(r.fraisLivraison)}</b></div>
        <div class="gc-chiffre"><span>Coût réel total</span><b>${gcE(r.cout)}</b></div><div class="gc-chiffre ${r.marge < 0 ? 'bad' : 'good'}"><span>Marge brute</span><b>${gcE(r.marge)}</b></div><div class="gc-chiffre"><span>Taux de marque</span><b>${gcPct(r.tauxMarque)}</b></div><div class="gc-chiffre"><span>Taux de marge</span><b>${gcPct(r.tauxMarge)}</b></div></div>
      ${r.provisoire ? '<div class="gc-sous">Rentabilité provisoire : frais estimés, ou article sans stock valorisé au prix d\'achat du catalogue.</div>' : ''}
      ${GC.liste(x.frais).length ? `<div class="gc-sous" style="margin-top:6px;">Frais : ${x.frais.map(y => esc(y.libelle) + ' ' + gcE(y.montant) + (y.statut === 'estime' ? ' (estimé)' : '')).join(' · ')}</div>` : ''}
      ${GC.liste(x.histoCouts).length ? `<div class="gc-sous" style="margin-top:6px;">Historique des coûts : ${x.histoCouts.map(h => gcDt(h.date) + ' ' + esc(h.par || '') + ' : ' + gcE(h.avant.cout) + ' → ' + gcE(h.apres.cout)).join(' · ')}</div>` : ''}</div>`;
};
window.gcOuvrirFacture = (fid) => {
  if(typeof kpiAller === 'function' && typeof modulesDeSociete === 'function' && modulesDeSociete('gadh').indexOf('factures') >= 0){ kpiAller('gadh', 'factures'); if(typeof factOuvrir === 'function') factOuvrir(fid); }
  else showToast('Facturation non accessible avec votre profil');
};
window.gcFacturerSelection = () => {
  const ids = Object.keys(window.gcSelectionBL || {}).filter(k => gcSelectionBL[k]);
  if(!ids.length){ showToast('Cochez les livraisons à facturer (même client)'); return; }
  gcFacturer(ids);
};
window.gcFacturer = (ids) => gcOperation(() => {
  if(!gcPeutFacturer()) return gcRefus();
  if(typeof factCreer !== 'function'){ showToast('Module Facturation indisponible'); return; }
  const D = gcD(), bls = ids.map(id => D.livraisons.find(x => x.id === id)).filter(Boolean).map(b => gcFactureDe(b) ? b : Object.assign({}, b, {factureId:''}));
  const lignes = GC.lignesFacture(bls), b0 = bls[0];
  const numeros = bls.map(b => b.numero).join(', '), cmds = Array.from(new Set(bls.map(b => b.cmdNumero).filter(Boolean))).join(', ');
  gcConfirmer('Créer la facture', 'Une facture brouillon sera créée dans la Facturation GADH pour ' + esc(gcNomClient(b0.clientId)) + ' (' + bls.length + ' livraison(s), ' + gcE(lignes.reduce((s, l) => s + GC.montantLigne(l), 0)) + ' HT avant remise globale). Vous l\'émettrez depuis la Facturation.', () => gcOperation(() => {
    const fid = factCreer('gadh', {clientId:b0.clientId, objet:'Livraison' + (bls.length > 1 ? 's ' : ' ') + numeros + (cmds ? ' · commande ' + cmds : ''), tva:GC.num(b0.tva), lignes,
      origine:{type:'livraison', module:'gc', ids:bls.map(b => b.id), label:numeros}});
    gcEnregistrer('livraisons', bls.map(b => Object.assign({}, b, {factureId:fid})));
    gcJournal('Facturation', 'Livraison', {id:b0.id, numero:numeros}, 'Facture brouillon créée dans la Facturation GADH');
    window.gcSelectionBL = {};
    showToast('Facture créée (brouillon)');
    if(ids.length === 1) nav('gc-livraison'); else nav('gc-livraisons');
  }), {bouton:'Créer la facture'});
});
window.gcFormRetourClient = (id) => {
  if(!gcPeut()) return gcRefus();
  const x = gcD().livraisons.find(y => y.id === id);
  mgtModal('Retour client · ' + esc(x.numero), `<div class="field"><label>Article</label><select id="grc-lid">${gcOpts(x.lignes.filter(l => GC.qteNetteLigne(l) > 0).map(l => [l.lid, l.designation + ' (' + gcQ(GC.qteNetteLigne(l)) + ' livré)']), '')}</select></div>
    ${mgtChamp('Quantité retournée', 'grc-q', '', 'number', 'step="any" min="0"')}${mgtChamp('Motif *', 'grc-m', '')}
    <div class="gc-sous" style="margin-bottom:8px;">Le stock est réintégré dans les lots d'origine ; le chiffre d'affaires et le coût de la livraison sont recalculés sur la quantité nette. ${gcFactureDe(x) ? '<b>Cette livraison est facturée : faites un avoir dans la Facturation.</b>' : ''}</div>
    <button class="btn btn-primary" style="width:100%;" onclick="gcValiderRetourClient('${id}')">Enregistrer le retour</button>`);
};
window.gcValiderRetourClient = (id) => gcOperation(() => {
  const motif = gcVal('grc-m'); if(!motif){ showToast('Indiquez le motif'); return; }
  const r = GC.retourClient(gcD(), id, gcVal('grc-lid'), gcVal('grc-q'), gcCtx({motif}));
  gcEnregistrer('livraisons', r.livraison); gcEnregistrer('mouvements', r.mouvements);
  gcJournal('Retour client', 'Livraison', r.livraison, r.mouvements.reduce((s, m) => s + m.qte, 0) + ' · ' + motif); mgtFermer(); showToast('Retour enregistré'); nav('gc-livraison');
});
window.gcAnnulerLivraison = (id) => {
  const x = gcD().livraisons.find(y => y.id === id);
  gcConfirmer('Annuler la livraison', 'La livraison ' + x.numero + ' sera annulée : les quantités reviennent en stock dans leurs lots d\'origine et la commande redevient à livrer.', (motif) => gcOperation(() => {
    const r = GC.annulerLivraison(gcD(), id, gcCtx({motif}));
    gcEnregistrer('livraisons', r.livraison); gcEnregistrer('mouvements', r.mouvements); gcJournal('Annulation', 'Livraison', r.livraison, motif); showToast('Livraison annulée'); nav('gc-livraison');
  }), {motif:true, motifObligatoire:true, danger:true, bouton:'Annuler la livraison'});
};
window.gcRevaloriser = (id) => gcConfirmer('Mettre à jour les coûts', 'Les coûts des lots de cette livraison sont remplacés par leur valeur actuelle (frais de réception connus depuis). L\'ancien calcul est conservé dans l\'historique.', () => gcOperation(() => {
  const r = GC.revaloriserLivraison(gcD(), id, gcCtx());
  gcEnregistrer('livraisons', r.livraison); gcJournal('Mise à jour des coûts', 'Livraison', r.livraison, gcE(r.avant.cout) + ' → ' + gcE(r.apres.cout)); showToast('Coûts mis à jour'); nav('gc-livraison');
}));
window.gcFormFraisLivraison = (id) => {
  if(!gcPeut()) return gcRefus();
  const x = gcD().livraisons.find(y => y.id === id);
  mgtModal('Frais de la livraison ' + esc(x.numero), `<div class="field"><label>Frais (transport client…)</label>${gcFormFrais('gfl', x.frais, false)}</div>
    <div class="gc-sous" style="margin-bottom:8px;">Ils s'ajoutent au coût réel de cette livraison (répartis sur ses lignes au prorata du chiffre d'affaires).</div>
    <button class="btn btn-primary" style="width:100%;" onclick="gcSauverFraisLivraison('${id}')">Enregistrer</button>`);
};
window.gcSauverFraisLivraison = (id) => gcOperation(() => {
  const x = gcD().livraisons.find(y => y.id === id), frais = gcLireFrais('gfl').filter(f => f.montant > 0).map(f => ({id:GC.nouvelId('fr'), libelle:f.libelle || 'Frais de livraison', montant:GC.r2(f.montant), statut:f.statut}));
  if(frais.some(f => f.montant < 0)){ showToast('Montant négatif'); return; }
  const avant = GC.liste(x.frais).reduce((s, f) => s + GC.num(f.montant), 0), apres = frais.reduce((s, f) => s + f.montant, 0);
  gcEnregistrer('livraisons', Object.assign({}, x, {frais})); gcJournal('Frais', 'Livraison', x, gcE(avant) + ' → ' + gcE(apres)); mgtFermer(); showToast('Frais enregistrés'); nav('gc-livraison');
});
