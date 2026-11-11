// ============================================================
// GADH — GESTION DES COMMANDES : ACHATS ET APPROVISIONNEMENT
// ============================================================
// Calcul des besoins nets (commandes clients et échéances, réservé, stock disponible,
// réceptions attendues, seuils), génération des commandes fournisseurs, suivi
// (validation, envoi, confirmation, retard, annulation tracée, clôture), réceptions
// partielles ou complètes (lots, frais répartis), paiements fournisseurs.

function gcTotauxCF(cf){
  let ht = 0; GC.liste(cf.lignes).forEach(l => { ht += GC.num(l.qte) * GC.num(l.pu); });
  const tva = ht * GC.num(cf.tva) / 100, frais = GC.num(cf.fraisPrevus), timbre = GC.num(cf.timbre), ttc = ht + tva + frais + timbre;
  const paye = GC.liste(cf.paiements).reduce((s, p) => s + GC.num(p.montant), 0);
  const due = cf.statut !== 'brouillon' && cf.statut !== 'annulee';
  return {ht:GC.r2(ht), tva:GC.r2(tva), frais:GC.r2(frais), timbre:GC.r2(timbre), ttc:GC.r2(ttc), paye:GC.r2(paye), reste:due ? Math.max(0, GC.r2(ttc - paye)) : 0};
}

// ============================================================
// BESOINS NETS
// ============================================================
let gcBesoinsSel = null;
const GC_URGENCES = {urgent:{label:'Urgent', cls:'bad'}, a_commander:{label:'À commander', cls:'warn'}, risque:{label:'Réception en retard', cls:'warn'}, couvert:{label:'Couvert', cls:'good'}};
window.renderGcBesoins = function(main){
  const D = gcD(), auj = getTodayISO(), ed = gcPeut(), B = GC.besoins(D, auj, {delaiDefaut:D.reglages.delaiDefaut}), A = GC.parId(D.articles);
  if(!gcBesoinsSel) gcBesoinsSel = {};
  const b = gcSection(main, 'Besoins et approvisionnement', (ed ? `<button class="btn btn-primary" data-gc="generer-cf" onclick="gcGenererCF()">Générer les commandes fournisseurs</button>` : '') + gcBoutonsExport('besoins'));
  const nb = (u) => B.articles.filter(x => x.urgence === u).length;
  const ligneDetail = (aid) => B.lignes.filter(l => l.articleId === aid).map(l => `<div class="gc-sous" style="padding:2px 0;">${gcDt(l.date)} · <a href="#" onclick="gcOuvrir('gc-commande', '${l.cmdId}'); return false;">${esc(l.numero || '')}</a> ${esc(gcNomClient(l.clientId))} : ${gcQ(l.qte)} → réservé ${gcQ(l.couvertReserve)}, stock ${gcQ(l.couvertStock)}, attendu ${gcQ(l.couvertAttente)}${l.receptions.length ? ' (' + esc(l.receptions.join(', ')) + ')' : ''}${l.manquant > 0 ? ', <b style="color:var(--bad);">manque ' + gcQ(l.manquant) + '</b>' : ''}</div>`).join('');
  b.innerHTML = `<div class="gc-chiffres"><div class="gc-chiffre ${nb('urgent') ? 'bad' : ''}"><span>Urgents (à commander aujourd'hui)</span><b>${nb('urgent')}</b></div><div class="gc-chiffre ${nb('a_commander') ? 'warn' : ''}"><span>À commander</span><b>${nb('a_commander')}</b></div>
      <div class="gc-chiffre ${nb('risque') ? 'warn' : ''}"><span>Risque de rupture (réception tardive)</span><b>${nb('risque')}</b></div><div class="gc-chiffre good"><span>Couverts</span><b>${nb('couvert')}</b></div></div>
    <div class="gc-sous" style="margin-bottom:8px;">Calcul par article et par date de besoin : d'abord le réservé de chaque commande, puis le stock disponible (jamais le réservé d'une autre commande), puis les réceptions attendues. « Commander avant » = date de besoin − délai du fournisseur. Le seuil minimum est ajouté au besoin.</div>
    ${B.articles.length ? `<div class="card" style="padding:4px 8px;"><div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th></th><th>Article</th><th class="n">Besoin</th><th class="n">Couvert (réservé · stock · attendu)</th><th class="n">Manquant</th><th class="n">Seuil</th><th>Quantité à commander</th><th>Fournisseur</th><th>Dates</th><th>État</th></tr></thead><tbody>
    ${B.articles.map(x => {
      const cmp = GC.comparerFournisseurs(D, x.articleId, x.aCommander || 1, auj), sel = gcBesoinsSel[x.articleId] || {coche:x.aCommander > 0, qte:x.aCommander, four:x.fournisseurId || (cmp[0] || {}).fournisseurId || ''};
      gcBesoinsSel[x.articleId] = sel;
      return `<tr><td data-l="Choisir">${x.aCommander > 0 && ed ? `<input type="checkbox" ${sel.coche ? 'checked' : ''} onchange="gcBesoinsSel['${x.articleId}'].coche = this.checked" style="width:18px;height:18px;min-width:0;">` : ''}</td>
        <td data-l="Article"><div><a href="#" onclick="gcOuvrir('gc-article', '${x.articleId}'); return false;"><b>${esc(gcLibArticle(A[x.articleId]))}</b></a><br><span class="gc-sous">physique ${gcQ(x.physique)} · réservé ${gcQ(x.reserve)} · disponible ${gcQ(x.disponible)} · attendu ${gcQ(x.attente)}</span><details><summary class="gc-sous" style="cursor:pointer;">Détail par commande</summary>${ligneDetail(x.articleId) || '<div class="gc-sous">Seuil minimum seulement.</div>'}</details></div></td>
        <td class="n" data-l="Besoin">${gcQ(x.besoin)} ${esc(x.unite)}</td><td class="n" data-l="Couvert">${gcQ(x.couvertReserve)} · ${gcQ(x.couvertStock)} · ${gcQ(x.couvertAttente)}</td>
        <td class="n" data-l="Manquant">${x.manquant > 0 ? `<b style="color:var(--bad);">${gcQ(x.manquant)}</b>` : '0'}</td><td class="n" data-l="Seuil">${x.reappro > 0 ? '+' + gcQ(x.reappro) : '—'}</td>
        <td data-l="À commander">${x.aCommander > 0 && ed ? `<input type="number" step="any" min="0" value="${gcAttr(sel.qte)}" onchange="gcBesoinsSel['${x.articleId}'].qte = GC.num(this.value)" style="max-width:110px;">` : gcQ(x.aCommander)}</td>
        <td data-l="Fournisseur">${x.aCommander > 0 && ed ? `<select onchange="gcBesoinsSel['${x.articleId}'].four = this.value">${gcOpts(D.fournisseurs.filter(f => !f.archive).map(f => { const c = cmp.find(y => y.fournisseurId === f.id); return [f.id, f.nom + (c ? ' · ' + gcE(c.prix) + (c.meilleur ? ' (meilleur)' : '') : '')]; }), sel.four, '— Choisir —')}</select>` : esc(gcNomFour(x.fournisseurId))}</td>
        <td data-l="Dates"><div>${x.dateBesoin ? 'Besoin le ' + gcDt(x.dateBesoin) : ''}${x.dateCommande ? '<br>Commander avant le <b>' + gcDt(x.dateCommande) + '</b>' : ''}</div></td><td data-l="État">${gcBadge(GC_URGENCES[x.urgence])}</td></tr>`;
    }).join('')}</tbody></table></div></div>` : buildEmptyState('Aucun besoin', 'Toutes les commandes en cours sont couvertes et aucun article n\'est sous son seuil.')}`;
};
window.gcGenererCF = () => gcOperation(() => {
  const sel = Object.entries(gcBesoinsSel || {}).filter(([, s]) => s.coche && s.qte > 0).map(([articleId, s]) => ({articleId, qte:s.qte, fournisseurId:s.four}));
  if(!sel.length){ showToast('Cochez au moins un article avec une quantité'); return; }
  const cfs = GC.commandesDepuisBesoins(gcD(), sel, getTodayISO());
  gcEnregistrer('cmdF', cfs);
  cfs.forEach(cf => gcJournal('Création', 'Commande fournisseur', cf, 'Depuis le calcul des besoins · ' + cf.lignes.length + ' ligne(s) · ' + gcE(gcTotauxCF(cf).ht) + ' HT'));
  gcBesoinsSel = null;
  showToast(cfs.length + ' commande(s) fournisseur(s) créée(s) en brouillon');
  if(cfs.length === 1) gcOuvrir('gc-achat', cfs[0].id); else { gcTabs.achats = gcTabs.achats || {q:'', tri:1, sens:-1, page:0, f:{}}; gcTabs.achats.f.statut = 'brouillon'; nav('gc-achats'); }
});

// ============================================================
// COMMANDES FOURNISSEURS
// ============================================================
window.renderGcAchats = function(main){
  const ed = gcPeut(), D = gcD(), rec = GC.recus(D), auj = getTodayISO();
  const b = gcSection(main, 'Commandes fournisseurs', (ed ? `<button class="btn btn-primary" data-gc="nouvelle-cf" onclick="gcNouveauDoc('achat')">+ Commande</button>` : '') + gcBoutonsExport('achats'));
  const pct = (f) => { const q = GC.liste(f.lignes).reduce((s, l) => s + GC.num(l.qte), 0), r = GC.liste(f.lignes).reduce((s, l) => s + Math.min(GC.num(l.qte), rec[GC.cleLigne(f.id, l.lid)] || 0), 0); return q ? r / q * 100 : 0; };
  b.innerHTML = gcTable({id:'achats', lignes:() => gcD().cmdF, tri:1, sens:-1, texte:f => [f.numero, f.ancienNumero, gcNomFour(f.fournisseurId), f.reference].join(' '),
    filtres:[{id:'statut', label:'Statut', defaut:'encours', options:[['encours', 'En cours'], ['retard', 'En retard'], ['brouillon', 'Brouillons'], ['recue', 'Reçues'], ['apayer', 'Reste à payer'], ['cloturee', 'Clôturées'], ['annulee', 'Annulées'], ['archives', 'Archivées'], ['', 'Toutes']],
      test:(f, v) => { if(v === 'archives') return !!f.archive; if(f.archive) return false; const s = GC.statutCmdF(f, rec).cle; return v === 'encours' ? !!GC.CMDF_OUVERTE[s] : v === 'retard' ? GC.enRetardCmdF(f, rec, auj) : v === 'apayer' ? gcTotauxCF(f).reste > 0.005 : s === v; }},
      {id:'four', label:'Fournisseur', options:[['', 'Tous les fournisseurs']].concat(D.fournisseurs.map(f => [f.id, f.nom])), test:(f, v) => f.fournisseurId === v}],
    colonnes:[{titre:'N°', val:f => f.numero || '', html:f => `<b>${esc(f.numero || 'Brouillon')}</b>${f.ancienNumero ? '<br><span class="gc-sous">ex ' + esc(f.ancienNumero) + '</span>' : ''}`}, {titre:'Date', val:f => f.date, html:f => gcDt(f.date)}, {titre:'Fournisseur', val:f => gcNomFour(f.fournisseurId)},
      {titre:'Livraison prévue', val:f => f.datePrevue || '', html:f => gcDt(f.datePrevue) + (GC.enRetardCmdF(f, rec, auj) ? ' <span class="gc-tag" style="color:var(--bad);">retard</span>' : '')},
      {titre:'Total TTC', num:true, tri:f => gcTotauxCF(f).ttc, html:f => gcE(gcTotauxCF(f).ttc)}, {titre:'Reçu', num:true, tri:pct, html:f => gcPct(pct(f))},
      {titre:'Reste à payer', num:true, tri:f => gcTotauxCF(f).reste, html:f => gcE(gcTotauxCF(f).reste)}, {titre:'Statut', tri:f => GC.statutCmdF(f, rec).label, html:f => gcBadge(GC.statutCmdF(f, rec))}],
    clic:f => `gcOuvrir('gc-achat', '${f.id}')`, vide:'Aucune commande fournisseur'});
};
window.renderGcAchat = function(main){
  const D = gcD(), cf = D.cmdF.find(x => x.id === gcOuvert['gc-achat']); if(!cf){ nav('gc-achats'); return; }
  const ed = gcPeut() && !cf.archive, rec = GC.recus(D), st = GC.statutCmdF(cf, rec), auj = getTodayISO(), t = gcTotauxCF(cf), ouverte = !!GC.CMDF_OUVERTE[st.cle];
  const recs = D.receptions.filter(r => r.cfId === cf.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const aRecu = recs.some(r => !r.annulee);
  let act = '';
  if(ed){
    if(st.cle === 'brouillon') act += `<button class="btn btn-primary" data-gc="valider-cf" onclick="gcCFStatut('${cf.id}', 'validee')">Valider</button><button class="btn btn-ghost" onclick="gcModifierDoc('achat', '${cf.id}')">Modifier</button>`;
    if(st.cle === 'validee') act += `<button class="btn btn-primary" data-gc="envoyer-cf" onclick="gcCFStatut('${cf.id}', 'envoyee')">Marquer envoyée</button>`;
    if(st.cle === 'envoyee' || st.cle === 'validee') act += `<button class="btn btn-ghost" data-gc="confirmer-cf" onclick="gcFormConfirmationCF('${cf.id}')">Confirmation fournisseur</button>`;
    if(ouverte) act += `<button class="btn btn-primary" data-gc="receptionner" onclick="gcFormReception('${cf.id}')">Réceptionner</button>`;
    if(ouverte && !aRecu) act += `<button class="btn btn-ghost" onclick="gcModifierDoc('achat', '${cf.id}')">Modifier</button>`;
    if(st.cle !== 'brouillon' && st.cle !== 'annulee') act += `<button class="btn btn-ghost" data-gc="paiement-cf" onclick="gcFormPaiementCF('${cf.id}')">Paiement</button>`;
    if(ouverte && aRecu) act += `<button class="btn btn-ghost" onclick="gcCFCloturer('${cf.id}')">Clôturer (reliquat)</button>`;
    if((st.cle === 'brouillon' || ouverte) && !aRecu) act += `<button class="btn btn-ghost" style="color:var(--bad);" onclick="gcCFAnnuler('${cf.id}')">Annuler</button>`;
  }
  act += `<button class="btn btn-ghost" onclick="gcDocument('achat', '${cf.id}', 'print')">Imprimer</button><button class="btn btn-ghost" onclick="gcDocument('achat', '${cf.id}', 'pdf')">PDF</button>`;
  if(ed && (st.cle === 'recue' || st.cle === 'cloturee' || st.cle === 'annulee') && t.reste <= 0.005) act += `<button class="btn btn-ghost" onclick="gcArchiverDoc('cmdF', '${cf.id}', 'Commande fournisseur')">Archiver</button>`;
  const b = gcSection(main, gcRetour('gc-achats', 'Commande fournisseur ' + esc(cf.numero || '(brouillon)')), act);
  const H = GC.liste(cf.historique);
  b.innerHTML = `${GC.enRetardCmdF(cf, rec, auj) ? '<div class="gc-alerte bad">Livraison prévue le ' + gcDt(cf.datePrevue) + ' : en retard.</div>' : ''}${cf.annulation ? `<div class="gc-alerte">Annulée le ${gcDt(cf.annulation.date)} par ${esc(cf.annulation.par || '')} : ${esc(cf.annulation.motif || '')}</div>` : ''}${cf.cloture ? `<div class="gc-alerte">Clôturée le ${gcDt(cf.cloture.date)} par ${esc(cf.cloture.par || '')}${cf.cloture.motif ? ' : ' + esc(cf.cloture.motif) : ''} (reliquat abandonné).</div>` : ''}
    <div class="card"><div class="gc-kv"><div><span>Fournisseur</span><b><a href="#" onclick="gcOuvrir('gc-fournisseur', '${cf.fournisseurId}'); return false;">${esc(gcNomFour(cf.fournisseurId))}</a></b></div><div><span>Date</span><b>${gcDt(cf.date)}</b></div><div><span>Livraison prévue</span><b>${gcDt(cf.datePrevue)}</b></div><div><span>Statut</span><b>${gcBadge(st)}</b></div>
      ${cf.reference ? `<div><span>Référence</span><b>${esc(cf.reference)}</b></div>` : ''}${cf.confirmation ? `<div><span>Confirmée</span><b>${gcDt(cf.confirmation.date)}${cf.confirmation.reference ? ' · ' + esc(cf.confirmation.reference) : ''}</b></div>` : ''}${cf.ancienNumero ? `<div><span>Ancien numéro</span><b>${esc(cf.ancienNumero)}</b></div>` : ''}</div>${cf.note ? `<div style="margin-top:8px;font-size:13px;white-space:pre-line;">${esc(cf.note)}</div>` : ''}</div>
    <div class="card"><h3 class="gc-h3">Articles · commandé, reçu, restant</h3><div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Commandé</th><th class="n">Prix HT</th><th class="n">Reçu</th><th class="n">Reste à recevoir</th><th class="n">Montant HT</th></tr></thead><tbody>
      ${GC.liste(cf.lignes).map(l => { const r = rec[GC.cleLigne(cf.id, l.lid)] || 0; return `<tr><td data-l="Article">${esc((l.ref ? l.ref + ' · ' : '') + (l.designation || ''))}${l.refFournisseur ? '<br><span class="gc-sous">réf. fournisseur ' + esc(l.refFournisseur) + '</span>' : ''}</td><td class="n" data-l="Commandé">${gcQ(l.qte)} ${esc(l.unite || '')}</td><td class="n" data-l="Prix">${gcE(l.pu)}</td><td class="n" data-l="Reçu">${gcQ(r)}</td><td class="n" data-l="Reste"><b>${gcQ(Math.max(0, GC.num(l.qte) - r))}</b></td><td class="n" data-l="Montant">${gcE(GC.num(l.qte) * GC.num(l.pu))}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="gc-chiffres" style="margin-top:8px;"><div class="gc-chiffre"><span>Total HT</span><b>${gcE(t.ht)}</b></div><div class="gc-chiffre"><span>TVA ${gcPct(cf.tva)}</span><b>${gcE(t.tva)}</b></div>${t.frais ? `<div class="gc-chiffre"><span>Frais prévus</span><b>${gcE(t.frais)}</b></div>` : ''}${t.timbre ? `<div class="gc-chiffre"><span>Timbre</span><b>${gcE(t.timbre)}</b></div>` : ''}<div class="gc-chiffre"><span>Total TTC</span><b>${gcE(t.ttc)}</b></div><div class="gc-chiffre"><span>Payé</span><b>${gcE(t.paye)}</b></div><div class="gc-chiffre ${t.reste > 0 ? 'bad' : 'good'}"><span>Reste à payer</span><b>${gcE(t.reste)}</b></div></div></div>
    <div class="card"><h3 class="gc-h3">Réceptions</h3>${recs.length ? recs.map(r => `<div class="session-row" style="cursor:pointer;" onclick="gcOuvrir('gc-reception', '${r.id}')"><span><b>${esc(r.numero)}</b> · ${gcDt(r.date)}${r.annulee ? ' <span class="gc-tag">annulée</span>' : ''}${r.historique ? ' <span class="gc-tag">reprise</span>' : ''}<br><span class="gc-sous">${GC.liste(r.lignes).map(l => gcQ(l.qte) + ' ' + esc(l.designation || '')).join(' · ')}${GC.liste(r.frais).length ? ' · frais ' + gcE(GC.fraisReception(r).total) : ''}</span></span><b>›</b></div>`).join('') : '<div class="gc-sous">Aucune réception.</div>'}</div>
    ${GC.liste(cf.paiements).length ? `<div class="card"><h3 class="gc-h3">Paiements</h3>${cf.paiements.map(p => `<div class="session-row"><span>${gcDt(p.date)} · ${esc(p.mode || '')}${p.reference ? ' · ' + esc(p.reference) : ''}<br><span class="gc-sous">${esc(p.par || '')}</span></span><b>${gcE(p.montant)}</b></div>`).join('')}</div>` : ''}
    ${H.length ? `<div class="card"><h3 class="gc-h3">Suivi</h3>${H.map(h => `<div class="session-row"><span>${esc(gcHeure(h.ts))} · ${esc(h.action)}</span><span class="gc-sous">${esc(h.par || '')}${h.motif ? ' · ' + esc(h.motif) : ''}</span></div>`).join('')}</div>` : ''}`;
};
function gcHistoCF(cf, action, motif){ return GC.liste(cf.historique).concat([{ts:Date.now(), date:getTodayISO(), par:gcPar(), action, motif:motif || ''}]); }
window.gcCFStatut = (id, statut) => gcOperation(() => {
  const cf = gcD().cmdF.find(x => x.id === id); if(!cf) return;
  if(statut === 'validee'){
    if(!cf.fournisseurId){ showToast('Choisissez le fournisseur'); return; }
    if(!GC.liste(cf.lignes).some(l => GC.num(l.qte) > 0)){ showToast('Aucune ligne'); return; }
    if(GC.liste(cf.lignes).some(l => GC.num(l.pu) <= 0)){ showToast('Toutes les lignes doivent avoir un prix d\'achat'); return; }
  }
  const lib = {validee:'Validation', envoyee:'Envoi au fournisseur'}[statut];
  const n = Object.assign({}, cf, {statut, historique:gcHistoCF(cf, lib)});
  if(statut === 'envoyee') n.envoi = {date:getTodayISO(), par:gcPar()};
  gcEnregistrer('cmdF', n); gcJournal(lib, 'Commande fournisseur', n); showToast(lib + ' enregistrée'); nav('gc-achat');
});
window.gcFormConfirmationCF = (id) => {
  if(!gcPeut()) return gcRefus();
  const cf = gcD().cmdF.find(x => x.id === id);
  mgtModal('Confirmation du fournisseur', `${mgtChamp('Date de confirmation', 'gcc-date', getTodayISO(), 'date')}${mgtChamp('Référence (n° de confirmation)', 'gcc-ref', '')}${mgtChamp('Livraison prévue (confirmée)', 'gcc-prevue', cf.datePrevue, 'date')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-confirmation" onclick="gcValiderConfirmationCF('${id}')">Enregistrer</button>`);
};
window.gcValiderConfirmationCF = (id) => gcOperation(() => {
  const cf = gcD().cmdF.find(x => x.id === id), prevue = gcVal('gcc-prevue');
  if(prevue && prevue < cf.date){ showToast('Date prévue antérieure à la commande'); return; }
  const n = Object.assign({}, cf, {statut:'confirmee', datePrevue:prevue || cf.datePrevue, confirmation:{date:gcVal('gcc-date') || getTodayISO(), reference:gcVal('gcc-ref'), par:gcPar()},
    historique:gcHistoCF(cf, 'Confirmation fournisseur', prevue !== cf.datePrevue ? 'livraison prévue ' + gcDt(cf.datePrevue) + ' → ' + gcDt(prevue) : '')});
  gcEnregistrer('cmdF', n); gcJournal('Confirmation fournisseur', 'Commande fournisseur', n, gcVal('gcc-ref')); mgtFermer(); showToast('Confirmation enregistrée'); nav('gc-achat');
});
window.gcCFAnnuler = (id) => {
  const cf = gcD().cmdF.find(x => x.id === id);
  gcConfirmer('Annuler la commande fournisseur', 'La commande ' + (cf.numero || '') + ' sera annulée ; elle reste consultable avec le motif, la date et l\'auteur.', (motif) => gcOperation(() => {
    const n = Object.assign({}, cf, {statut:'annulee', annulation:{date:getTodayISO(), ts:Date.now(), par:gcPar(), motif}, historique:gcHistoCF(cf, 'Annulation', motif)});
    gcEnregistrer('cmdF', n); gcJournal('Annulation', 'Commande fournisseur', n, motif); showToast('Commande annulée'); nav('gc-achat');
  }), {motif:true, motifObligatoire:true, danger:true, bouton:'Annuler la commande'});
};
window.gcCFCloturer = (id) => {
  const cf = gcD().cmdF.find(x => x.id === id);
  gcConfirmer('Clôturer la commande fournisseur', 'Le reste à recevoir est abandonné (il ne compte plus dans le stock attendu).', (motif) => gcOperation(() => {
    const n = Object.assign({}, cf, {statut:'cloturee', cloture:{date:getTodayISO(), ts:Date.now(), par:gcPar(), motif}, historique:gcHistoCF(cf, 'Clôture', motif)});
    gcEnregistrer('cmdF', n); gcJournal('Clôture', 'Commande fournisseur', n, motif); showToast('Commande clôturée'); nav('gc-achat');
  }), {motif:true});
};
window.gcFormPaiementCF = (id) => {
  if(!gcPeut()) return gcRefus();
  const cf = gcD().cmdF.find(x => x.id === id), t = gcTotauxCF(cf);
  mgtModal('Paiement fournisseur', `<p style="margin-top:0;">Reste à payer : <b>${gcE(t.reste)}</b></p><div class="gc-form">${mgtChamp('Date', 'gpa-date', getTodayISO(), 'date')}${mgtChamp('Montant *', 'gpa-mt', t.reste, 'number', 'step="any" min="0"')}
    <div class="field"><label>Mode</label><select id="gpa-mode">${gcOpts([['virement', 'Virement'], ['cheque', 'Chèque'], ['traite', 'Traite'], ['especes', 'Espèces']], 'virement')}</select></div>${mgtChamp('Référence', 'gpa-ref', '')}</div>
    <button class="btn btn-primary" style="width:100%;" onclick="gcValiderPaiementCF('${id}')">Enregistrer le paiement</button>`);
};
window.gcValiderPaiementCF = (id) => gcOperation(() => {
  const cf = gcD().cmdF.find(x => x.id === id), mt = GC.num(gcVal('gpa-mt')), t = gcTotauxCF(cf);
  if(!(mt > 0)){ showToast('Montant invalide'); return; }
  if(mt > t.reste + 0.005){ showToast('Le montant dépasse le reste à payer (' + gcE(t.reste) + ')'); return; }
  const n = Object.assign({}, cf, {paiements:GC.liste(cf.paiements).concat([{date:gcVal('gpa-date') || getTodayISO(), montant:GC.r2(mt), mode:gcVal('gpa-mode'), reference:gcVal('gpa-ref'), par:gcPar(), ts:Date.now()}])});
  gcEnregistrer('cmdF', n); gcJournal('Paiement', 'Commande fournisseur', n, gcE(mt) + ' · ' + gcVal('gpa-mode')); mgtFermer(); showToast('Paiement enregistré'); nav('gc-achat');
});

// ============================================================
// RÉCEPTIONS
// ============================================================
window.gcFormReception = (id) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), cf = D.cmdF.find(x => x.id === id), rec = GC.recus(D);
  const lignes = GC.liste(cf.lignes).map(l => { const reste = GC.rq(Math.max(0, GC.num(l.qte) - (rec[GC.cleLigne(id, l.lid)] || 0))); return reste > 0 ? `<tr><td data-l="Article">${esc(l.designation || '')}</td><td class="n" data-l="Commandé">${gcQ(l.qte)}</td><td class="n" data-l="Reste">${gcQ(reste)}</td>
    <td data-l="Reçu"><input type="number" step="any" min="0" max="${reste}" class="grc-q" data-lid="${l.lid}" value="${reste}"></td><td data-l="Prix réel HT"><input type="number" step="any" min="0" class="grc-pu" data-lid="${l.lid}" value="${gcAttr(l.pu)}"></td><td data-l="N° de lot"><input class="grc-lot" data-lid="${l.lid}" placeholder="facultatif"></td></tr>` : ''; }).join('');
  mgtModal('Réception · ' + esc(cf.numero), `<div class="gc-form">${mgtChamp('Date de réception', 'grc-date', getTodayISO(), 'date')}${mgtChamp('Bon de livraison du fournisseur', 'grc-ref', '')}</div>
    <div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Commandé</th><th class="n">Reste</th><th>Reçu</th><th>Prix réel HT</th><th>N° de lot</th></tr></thead><tbody>${lignes}</tbody></table></div>
    <div class="gc-sous" style="margin:6px 0 10px;">Une réception partielle met à jour les quantités reçues sans clôturer la commande. Chaque ligne reçue crée un lot daté (FIFO).</div>
    <div class="field"><label>Frais de cette réception (transport, logistique, douane, annexes) : répartis sur les lignes</label>${gcFormFrais('grf', [], true)}</div>
    ${mgtZone('Note', 'grc-note', '')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-reception" onclick="gcValiderReception('${id}')">Valider la réception</button>`);
};
window.gcValiderReception = (id) => gcOperation(() => {
  const q = (cls) => { const o = {}; document.querySelectorAll('.' + cls).forEach(el => { o[el.dataset.lid] = el.value; }); return o; };
  const Q = q('grc-q'), P = q('grc-pu'), L = q('grc-lot'), date = gcVal('grc-date') || getTodayISO();
  if(date > getTodayISO()){ showToast('La date de réception ne peut pas être dans le futur'); return; }
  const saisies = Object.keys(Q).map(lid => ({lid, qte:GC.num(Q[lid]), pu:P[lid], lot:(L[lid] || '').trim()}));
  if(saisies.some(s => P[s.lid] !== '' && GC.num(P[s.lid]) < 0)){ showToast('Prix négatif'); return; }
  const frais = gcLireFrais('grf'); if(frais.some(f => f.montant < 0)){ showToast('Montant de frais négatif'); return; }
  const D = gcD(), cf = D.cmdF.find(x => x.id === id);
  const r = GC.receptionner(D, id, saisies, gcCtx({date, reference:gcVal('grc-ref'), note:gcVal('grc-note'), frais}));
  gcEnregistrer('receptions', r.reception); if(r.mouvements.length) gcEnregistrer('mouvements', r.mouvements);
  gcEnregistrer('cmdF', Object.assign({}, cf, {historique:gcHistoCF(cf, 'Réception ' + r.reception.numero + (r.statut === 'recue' ? ' (complète)' : ' (partielle)'))}));
  gcJournal('Réception', 'Commande fournisseur', cf, r.reception.numero + ' · ' + r.reception.lignes.map(l => gcQ(l.qte) + ' ' + l.designation).join(' · ') + (r.reception.frais.length ? ' · frais ' + gcE(GC.fraisReception(r.reception).total) : ''));
  mgtFermer(); showToast('Réception ' + r.reception.numero + ' enregistrée (' + (r.statut === 'recue' ? 'commande reçue' : 'reçue en partie') + ')'); gcOuvrir('gc-reception', r.reception.id);
});
window.renderGcReceptions = function(main){
  const D = gcD();
  const b = gcSection(main, 'Réceptions', gcBoutonsExport('receptions'));
  const cfs = GC.parId(D.cmdF);
  b.innerHTML = gcTable({id:'receptions', lignes:() => gcD().receptions, tri:1, sens:-1, texte:r => [r.numero, gcNomFour(r.fournisseurId), (cfs[r.cfId] || {}).numero, r.reference].join(' '),
    filtres:[{id:'etat', label:'État', defaut:'valides', options:[['valides', 'Valides'], ['annulees', 'Annulées'], ['', 'Toutes']], test:(r, v) => v === 'annulees' ? !!r.annulee : !r.annulee}],
    colonnes:[{titre:'N°', val:r => r.numero}, {titre:'Date', val:r => r.date, html:r => gcDt(r.date)}, {titre:'Fournisseur', val:r => gcNomFour(r.fournisseurId)}, {titre:'Commande', val:r => (cfs[r.cfId] || {}).numero || ''},
      {titre:'BL fournisseur', val:r => r.reference || ''}, {titre:'Valeur HT', num:true, tri:r => GC.liste(r.lignes).reduce((s, l) => s + GC.num(l.qte) * GC.num(l.pu), 0), html:r => gcE(GC.liste(r.lignes).reduce((s, l) => s + GC.num(l.qte) * GC.num(l.pu), 0))},
      {titre:'Frais', num:true, tri:r => GC.fraisReception(r).total, html:r => gcE(GC.fraisReception(r).total) + (GC.fraisReception(r).estime ? '<span class="gc-tag">estimés</span>' : '')}, {titre:'État', tri:r => r.annulee ? 1 : 0, html:r => r.annulee ? gcBadge({label:'Annulée', cls:''}) : r.historique ? gcBadge({label:'Reprise', cls:''}) : gcBadge({label:'En stock', cls:'good'})}],
    clic:r => `gcOuvrir('gc-reception', '${r.id}')`, vide:'Aucune réception'});
};
window.renderGcReception = function(main){
  const D = gcD(), r = D.receptions.find(x => x.id === gcOuvert['gc-reception']); if(!r){ nav('gc-receptions'); return; }
  const ed = gcPeut(), cf = D.cmdF.find(x => x.id === r.cfId), F = GC.fraisReception(r), lots = GC.lots(D).filter(l => l.receptionId === r.id);
  let act = '';
  if(ed && !r.annulee && !r.historique) act += `<button class="btn btn-ghost" onclick="gcFormFraisReception('${r.id}')">Frais</button><button class="btn btn-ghost" style="color:var(--bad);" onclick="gcAnnulerReception('${r.id}')">Annuler la réception</button>`;
  act += `<button class="btn btn-ghost" onclick="gcDocument('reception', '${r.id}', 'print')">Imprimer le bon</button><button class="btn btn-ghost" onclick="gcDocument('reception', '${r.id}', 'pdf')">PDF</button>`;
  const b = gcSection(main, gcRetour('gc-receptions', 'Bon de réception ' + esc(r.numero)), act);
  b.innerHTML = `${r.annulee ? `<div class="gc-alerte bad">Réception annulée le ${gcDt(r.annulee.date)} par ${esc(r.annulee.par || '')} : ${esc(r.annulee.motif || '')}. Le stock a été retiré.</div>` : ''}${r.historique ? '<div class="gc-alerte">Réception reprise de l\'ancien module (sans mouvement : le stock repris est le stock initial).</div>' : ''}
    <div class="card"><div class="gc-kv"><div><span>Fournisseur</span><b>${esc(gcNomFour(r.fournisseurId))}</b></div><div><span>Commande</span><b>${cf ? `<a href="#" onclick="gcOuvrir('gc-achat', '${cf.id}'); return false;">${esc(cf.numero)}</a>` : '—'}</b></div><div><span>Date</span><b>${gcDt(r.date)}</b></div><div><span>Par</span><b>${esc(r.par || '')}</b></div>${r.reference ? `<div><span>BL fournisseur</span><b>${esc(r.reference)}</b></div>` : ''}</div>${r.note ? `<div style="margin-top:8px;font-size:13px;white-space:pre-line;">${esc(r.note)}</div>` : ''}</div>
    <div class="card"><h3 class="gc-h3">Articles reçus et coûts réels</h3><div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Article</th><th class="n">Reçu</th><th>Lot</th><th class="n">Prix d'achat</th><th class="n">Frais / unité</th><th class="n">Coût réel unitaire</th><th class="n">Reste en stock</th></tr></thead><tbody>
      ${GC.liste(r.lignes).map((l, i) => { const lot = lots.find(x => x.rl === i || (x.articleId === l.articleId && x.qteInit === l.qte)); return `<tr><td data-l="Article">${esc(l.designation || '')}</td><td class="n" data-l="Reçu">${gcQ(l.qte)} ${esc(l.unite || '')}</td><td data-l="Lot">${esc(l.lot || (lot && lot.code) || '—')}</td><td class="n" data-l="Prix">${gcE(l.pu)}</td><td class="n" data-l="Frais / unité">${gcE(F.parLigne[i])}</td><td class="n" data-l="Coût réel"><b>${gcE(GC.num(l.pu) + F.parLigne[i])}</b></td><td class="n" data-l="Reste">${lot ? gcQ(lot.reste) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
      ${GC.liste(r.frais).length ? `<div class="gc-sous" style="margin-top:8px;">Frais : ${r.frais.map(f => esc(f.libelle) + ' ' + gcE(f.montant) + ' (' + (f.methode === 'valeur' ? 'au prorata de la valeur' : 'au prorata des quantités') + (f.statut === 'estime' ? ', estimé' : '') + ')').join(' · ')}</div>` : ''}
      ${GC.liste(r.histoFrais).length ? `<div class="gc-sous" style="margin-top:6px;">Historique des frais : ${r.histoFrais.map(h => gcDt(h.date) + ' ' + esc(h.par || '') + ' : ' + gcE(h.avant) + ' → ' + gcE(h.apres)).join(' · ')}</div>` : ''}</div>`;
};
window.gcFormFraisReception = (id) => {
  if(!gcPeut()) return gcRefus();
  const r = gcD().receptions.find(x => x.id === id);
  mgtModal('Frais de la réception ' + esc(r.numero), `<div class="field"><label>Frais (transport, logistique, douane, annexes)</label>${gcFormFrais('gfr', r.frais, true)}</div>
    <div class="gc-sous" style="margin-bottom:8px;">Les nouveaux frais valorisent le stock restant et les prochaines livraisons. Les livraisons déjà faites gardent leur coût du jour (mise à jour possible depuis chaque livraison).</div>
    <button class="btn btn-primary" style="width:100%;" onclick="gcSauverFraisReception('${id}')">Enregistrer</button>`);
};
window.gcSauverFraisReception = (id) => gcOperation(() => {
  const r = gcD().receptions.find(x => x.id === id), frais = gcLireFrais('gfr').filter(f => f.montant > 0).map(f => ({id:GC.nouvelId('fr'), libelle:f.libelle || 'Frais', montant:GC.r2(f.montant), methode:f.methode === 'valeur' ? 'valeur' : 'quantite', statut:f.statut === 'estime' ? 'estime' : 'reel'}));
  const avant = GC.fraisReception(r).total, apres = frais.reduce((s, f) => s + f.montant, 0);
  const n = Object.assign({}, r, {frais, histoFrais:GC.liste(r.histoFrais).concat([{date:getTodayISO(), ts:Date.now(), par:gcPar(), avant, apres}])});
  gcEnregistrer('receptions', n); gcJournal('Frais', 'Réception', n, gcE(avant) + ' → ' + gcE(apres)); mgtFermer(); showToast('Frais enregistrés'); nav('gc-reception');
});
window.gcAnnulerReception = (id) => {
  const r = gcD().receptions.find(x => x.id === id);
  gcConfirmer('Annuler la réception', 'Les quantités de ' + r.numero + ' seront retirées du stock (possible seulement si rien n\'est encore sorti de ces lots). La commande fournisseur redevient à recevoir.', (motif) => gcOperation(() => {
    const D = gcD(), x = GC.annulerReception(D, id, gcCtx({motif})), cf = D.cmdF.find(y => y.id === r.cfId);
    gcEnregistrer('receptions', x.reception); if(x.mouvements.length) gcEnregistrer('mouvements', x.mouvements);
    if(cf) gcEnregistrer('cmdF', Object.assign({}, cf, {historique:gcHistoCF(cf, 'Annulation de la réception ' + r.numero, motif)}));
    gcJournal('Annulation', 'Réception', x.reception, motif); showToast('Réception annulée'); nav('gc-reception');
  }), {motif:true, motifObligatoire:true, danger:true, bouton:'Annuler la réception'});
};
