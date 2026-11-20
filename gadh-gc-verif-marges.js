// ============================================================
// CRM GADH — VÉRIFICATION DES MARGES : bouton « Vérifier la marge » sur les livraisons,
// factures, commandes clients et fournisseurs, offres, clients, rentabilité et tableau de bord.
// Montre le calcul complet (quantité × prix, coût réel des lots ou coût estimé et sa source),
// le compare aux factures, signale les points douteux, permet de corriger les coûts estimés
// et d'exporter le détail dans Excel. Chargé après gadh-gc-fournisseurs.js.
// ============================================================

// ---------- Coût d'achat estimé (livraison sans stock suivi) ----------
// 1. prix de la dernière commande fournisseur pour ce client et cet article ;
// 2. accord de prix valable pour ce client (palier selon la quantité de la commande client) ;
// 3. prix d'achat du catalogue.
function gcmvCoutEstime(articleId, clientId, date, qteCmd){
  const D = gcD(), d = date || getTodayISO(), a = D.articles.find(x => x.id === articleId) || {};
  const cf = D.cmdF.filter(c => c.statut !== 'annulee' && c.clientId && c.clientId === clientId && (c.date || '') <= d && GC.liste(c.lignes).some(l => l.articleId === articleId)).sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0];
  if(cf){ const l = cf.lignes.find(y => y.articleId === articleId); return {prix:GC.num(l.pu), source:'Commande fournisseur ' + cf.numero + ' (' + gcDt(cf.date) + ')'}; }
  const fid = a.fournisseurId;
  if(fid && typeof gcfrAccordValable === 'function'){ const ac = gcfrAccordValable(fid, articleId, clientId, d); if(ac){ const r = gcfrPrixAccord(ac, GC.num(qteCmd)); if(r) return {prix:r.prix, source:'Accord ' + ac.numero + ' · palier ' + gcfrLibPalier(r.palier) + (r.hors ? ' (hors palier)' : '')}; } }
  return {prix:GC.num(a.prixAchat), source:'Prix d\'achat du catalogue'};
}
const gcmvLivrerOrigine = GC.livrer;
GC.livrer = function(D, cmdId, saisies, opts){
  const r = gcmvLivrerOrigine(D, cmdId, saisies, opts), c = GC.liste(D.cmdC).find(x => x.id === cmdId) || {};
  r.livraison.lignes.forEach(l => {
    if(!l.coutTheorique) return;
    const q = GC.liste(c.lignes).filter(x => x.articleId === l.articleId).reduce((s, x) => s + GC.num(x.qte), 0), e = gcmvCoutEstime(l.articleId, c.clientId, r.livraison.date, q);
    l.coutUnitTheorique = e.prix; l.coutSource = e.source;
  });
  return r;
};

// ---------- Calcul détaillé ----------
function gcmvSourceCout(l){
  if(l.coutTheorique && l.coutCorrige) return {estime:false, saisi:true, lib:'Saisi par ' + (l.coutCorrige.par || '') + ' le ' + gcDt(l.coutCorrige.date) + ' : ' + (l.coutCorrige.source || '')};
  if(l.coutTheorique) return {estime:true, lib:'Estimé : ' + (l.coutSource || 'prix d\'achat du catalogue au moment de la livraison')};
  const al = GC.allocationsNettes(l);
  return {estime:false, lib:al.length ? 'Réel (FIFO) : ' + al.map(a => (a.code || 'lot') + ' ' + gcQ(a.qte) + ' × ' + gcE(GC.num(a.coutUnit) + GC.num(a.fraisUnit))).join(' + ') : 'Réel : aucun lot'};
}
function gcmvAnalyse(bls, articleId){
  const F = factListe() || {}, lignes = [];
  bls.forEach(b => {
    const c = GC.coutLivraison(b), f = b.factureId ? F[b.factureId] : null;
    c.lignes.forEach((r, i) => {
      if(articleId && r.articleId !== articleId) return;
      const l = b.lignes.find(x => x.lid === r.lid) || b.lignes[i] || {}, s = gcmvSourceCout(l), q = r.qte;
      // recalcul indépendant
      const caInd = q * GC.num(l.pu) * (1 - GC.num(l.remise) / 100) * (1 - GC.num(b.remise) / 100);
      // ligne de facture correspondante : position dans la facture (livraisons de la facture dans l'ordre, lignes dans l'ordre)
      let fl = null;
      if(f){ const ids = GC.liste((f.origine || {}).ids), D0 = gcD(); let off = 0;
        for(const id of ids){ if(id === b.id) break; const bb = D0.livraisons.find(x => x.id === id); off += bb ? bb.lignes.filter(y => GC.qteNetteLigne(y) > 0).length : 0; }
        fl = GC.liste(f.lignes)[off + b.lignes.filter(y => GC.qteNetteLigne(y) > 0).indexOf(l)] || null; }
      const facture = fl ? GC.montantLigne(fl) : null;
      lignes.push({b, l, r, f, q, pu:GC.num(l.pu), ca:r.ca, caInd, cu:q > 0 ? (r.achat + r.fraisLots) / q : 0, achat:r.achat, fraisLots:r.fraisLots, fraisLiv:r.fraisLivraison, cout:r.cout, marge:r.marge,
        tm:r.ca > 0 ? r.marge / r.ca * 100 : null, estime:s.estime, saisi:!!s.saisi, source:s.lib, facture, puFacture:fl ? GC.num(fl.pu) : null});
    });
  });
  const T = lignes.reduce((t, x) => { ['q', 'ca', 'caInd', 'achat', 'fraisLots', 'fraisLiv', 'cout', 'marge'].forEach(k => { t[k] += x[k]; }); if(x.facture !== null) { t.fact += x.facture; t.caFacture += x.ca; } return t; }, {q:0, ca:0, caInd:0, achat:0, fraisLots:0, fraisLiv:0, cout:0, marge:0, fact:0, caFacture:0});
  return {lignes, T};
}
function gcmvControles(A){
  const C = [], L = A.lignes, T = A.T;
  const ecartCA = Math.abs(T.ca - T.caInd);
  C.push(ecartCA < 0.01 ? {ok:true, t:'Chiffre d\'affaires recalculé ligne par ligne (quantité × prix × (1 − remise)) : identique, ' + gcE(GC.r2(T.caInd)) + '.'} : {ok:false, t:'Écart de ' + gcE(ecartCA) + ' entre le chiffre d\'affaires enregistré et le recalcul.'});
  const sansFact = Array.from(new Set(L.filter(x => !x.f).map(x => x.b.numero)));
  if(sansFact.length) C.push({ok:false, t:sansFact.length + ' livraison(s) sans facture dans la CRM : ' + sansFact.join(', ') + '.'});
  const ecarts = L.filter(x => x.facture !== null && Math.abs(x.facture - x.ca) >= 0.01);
  if(ecarts.length) C.push({ok:false, t:'Montant facturé différent du prix de la commande sur ' + ecarts.length + ' ligne(s) : ' + ecarts.map(x => x.b.numero + ' (facture ' + x.f.numero + ' : ' + gcE(x.facture) + ' au lieu de ' + gcE(GC.r2(x.ca)) + ', prix ' + gcE(x.puFacture) + ' au lieu de ' + gcE(x.pu) + ')').join(' · ') + '. La marge est calculée au prix de vente de la livraison, pas au prix facturé.', ecart:true});
  else if(L.some(x => x.f)) C.push({ok:true, t:'Montants facturés = quantités livrées × prix de vente (' + gcE(GC.r2(T.fact)) + ').'});
  const est = L.filter(x => x.estime), reel = L.filter(x => !x.estime && !x.saisi), saisi = L.filter(x => x.saisi);
  if(reel.length) C.push({ok:true, t:reel.length + ' ligne(s) au coût réel des lots reçus (FIFO) : ' + gcQ(reel.reduce((s, x) => s + x.q, 0)) + '.'});
  if(saisi.length) C.push({ok:true, t:saisi.length + ' ligne(s) avec un coût d\'achat saisi manuellement (prix réellement payé) : ' + gcQ(saisi.reduce((s, x) => s + x.q, 0)) + '.'});
  if(est.length){
    const parCout = {}; est.forEach(x => { const k = gcE(x.cu) + ' — ' + x.source.replace(/^Estimé : /, ''); parCout[k] = (parCout[k] || 0) + x.q; });
    C.push({ok:false, estime:true, t:est.length + ' ligne(s) avec un coût d\'achat ESTIMÉ (pas de stock suivi au moment de la livraison) : ' + Object.entries(parCout).map(([k, q]) => gcQ(q) + ' à ' + k).join(' · ') + '. Si le prix réellement payé au fournisseur était différent, la marge est fausse : utilisez « Corriger les coûts estimés ».'});
  }
  if(L.some(x => x.marge < 0)) C.push({ok:false, t:'Marge négative sur ' + L.filter(x => x.marge < 0).length + ' ligne(s).'});
  return C;
}
function gcmvLib(x){ return esc(x.b.numero) + '<div class="gc-sous">' + gcDt(x.b.date) + '</div>'; }
// Fenêtre « Vérifier la marge »
window.gcmvVerifier = (titre, blIds, opts) => {
  opts = opts || {};
  const D = gcD(), bls = D.livraisons.filter(b => blIds.indexOf(b.id) >= 0 && !b.annulee).sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.numero).localeCompare(String(b.numero)));
  const A = gcmvAnalyse(bls, opts.articleId), T = A.T, C = gcmvControles(A), tm = T.ca > 0 ? T.marge / T.ca * 100 : null, tg = T.cout > 0 ? T.marge / T.cout * 100 : null;
  window.gcmvDernier = {titre, blIds, opts};
  const estIds = Array.from(new Set(A.lignes.filter(x => x.estime).map(x => x.b.id))), ecIds = Array.from(new Set(A.lignes.filter(x => x.facture !== null && Math.abs(x.facture - x.ca) >= 0.01).map(x => x.b.id)));
  const prev = opts.prevision ? gcmvPrevisionHTML(opts.prevision) : '';
  mgtModal('Vérification de la marge · ' + esc(titre), `${!A.lignes.length ? '<p>Aucune livraison à vérifier.</p>' + prev : `
    <div class="gc-chiffres"><div class="gc-chiffre"><span>Quantité livrée</span><b>${gcQ(T.q)}</b></div><div class="gc-chiffre"><span>Chiffre d'affaires HT</span><b>${gcE(GC.r2(T.ca))}</b></div>${T.fact ? `<div class="gc-chiffre"><span>Facturé HT</span><b>${gcE(GC.r2(T.fact))}</b></div>` : ''}
      <div class="gc-chiffre"><span>Coût d'achat${T.fraisLots + T.fraisLiv ? ' + frais' : ''}</span><b>${gcE(GC.r2(T.cout))}</b></div><div class="gc-chiffre ${T.marge < 0 ? 'bad' : 'good'}"><span>Marge brute</span><b>${gcE(GC.r2(T.marge))}</b></div>
      <div class="gc-chiffre"><span>Taux de marque</span><b>${gcPct(tm)}</b></div><div class="gc-chiffre"><span>Taux de marge</span><b>${gcPct(tg)}</b></div></div>
    <div class="gcmv-formule"><b>Calcul</b> · Chiffre d'affaires = Σ quantité × prix de vente = <b>${gcE(GC.r2(T.ca))}</b> · Coût = Σ quantité × coût d'achat unitaire${T.fraisLots + T.fraisLiv ? ' + frais (' + gcE(GC.r2(T.fraisLots + T.fraisLiv)) + ')' : ''} = <b>${gcE(GC.r2(T.cout))}</b> ·
      Marge brute = ${gcE(GC.r2(T.ca))} − ${gcE(GC.r2(T.cout))} = <b>${gcE(GC.r2(T.marge))}</b> · Taux de marque = marge ÷ chiffre d'affaires = <b>${gcPct(tm)}</b> · Taux de marge = marge ÷ coût = <b>${gcPct(tg)}</b></div>
    <h4 style="margin:10px 0 4px;">Contrôles</h4><div class="gcmv-ctl">${C.map(c => `<div class="${c.ok ? 'ok' : 'ko'}">${c.ok ? '✓' : '⚠'} ${esc(c.t)}</div>`).join('')}</div>
    ${A.lignes.some(x => x.estime) ? gcmvSimulation(A) : ''}
    ${prev}
    <h4 style="margin:12px 0 4px;">Détail ligne par ligne</h4>
    <div style="overflow-x:auto;"><table class="gc-lignes gcmv-t"><thead><tr><th>Livraison</th><th>Facture</th><th class="n">Quantité</th><th class="n">Prix vente</th><th class="n">CA HT</th><th class="n">Facturé HT</th><th class="n">Coût unit.</th><th>Origine du coût</th><th class="n">Coût</th><th class="n">Marge</th><th class="n">Taux de marque</th></tr></thead><tbody>
      ${A.lignes.map(x => `<tr class="${x.estime ? 'gcmv-est' : ''}"><td data-l="Livraison"><a href="#" onclick="mgtFermer(); gcOuvrir('gc-livraison', '${x.b.id}'); return false;">${gcmvLib(x)}</a></td><td data-l="Facture">${x.f ? esc(x.f.numero) : '<span style="color:var(--bad);">—</span>'}</td>
        <td class="n" data-l="Quantité">${gcQ(x.q)}</td><td class="n" data-l="Prix vente">${gcE(x.pu)}</td><td class="n" data-l="CA HT">${gcE(GC.r2(x.ca))}</td><td class="n" data-l="Facturé HT" style="${x.facture !== null && Math.abs(x.facture - x.ca) >= 0.01 ? 'color:var(--bad);font-weight:700;' : ''}">${x.facture === null ? '—' : gcE(x.facture)}</td>
        <td class="n" data-l="Coût unit."><b>${gcE(x.cu)}</b></td><td data-l="Origine du coût" class="gcmv-src">${esc(x.source)}</td><td class="n" data-l="Coût">${gcE(GC.r2(x.cout))}</td><td class="n" data-l="Marge"><b>${gcE(GC.r2(x.marge))}</b></td><td class="n" data-l="Taux de marque">${gcPct(x.tm)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Total</td><td></td><td class="n">${gcQ(T.q)}</td><td></td><td class="n">${gcE(GC.r2(T.ca))}</td><td class="n">${T.fact ? gcE(GC.r2(T.fact)) : ''}</td><td></td><td></td><td class="n">${gcE(GC.r2(T.cout))}</td><td class="n">${gcE(GC.r2(T.marge))}</td><td class="n">${gcPct(tm)}</td></tr></tfoot></table></div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">${A.lignes.length ? `<button class="btn btn-ghost" data-gc="exporter-verif" onclick="gcmvExporter()">Exporter le détail (Excel)</button>` : ''}
      ${gcPeut() && estIds.length ? `<button class="btn btn-primary" data-gc="corriger-couts" onclick="gcmvFormCout(${gcAttr(JSON.stringify(estIds))})">Corriger les coûts estimés</button>` : ''}
      ${gcPeut() && ecIds.length ? `<button class="btn btn-ghost" data-gc="aligner-facture" onclick="gcmvAlignerFacture(${gcAttr(JSON.stringify(ecIds))})">Prendre le prix facturé comme prix de vente</button>` : ''}
      <span class="gc-sous" style="align-self:center;">Taux de marque = marge ÷ prix de vente · Taux de marge = marge ÷ coût d'achat.</span></div>`);
  const m = document.querySelector('#mgt-modal-zone .modal-sheet'); if(m) m.classList.add('gcmv-large');
};
// Impact d'un autre coût d'achat sur les lignes estimées
function gcmvSimulation(A){
  const est = A.lignes.filter(x => x.estime), q = est.reduce((s, x) => s + x.q, 0), ca = est.reduce((s, x) => s + x.ca, 0), cout = est.reduce((s, x) => s + x.achat, 0);
  const art = est[0].l.articleId, cl = est[0].b.clientId, choix = gcmvChoixCouts(art, cl).filter(c => Math.abs(c.prix - cout / q) > 1e-9).slice(0, 5);
  if(!choix.length) return '';
  return `<div class="gcmv-sim"><b>Et si le coût réel était différent ?</b> Sur les ${gcQ(q)} au coût estimé (aujourd'hui ${gcE(cout / q)} en moyenne, marge ${gcE(GC.r2(ca - cout))}) :
    <table class="gc-lignes"><tbody>${choix.map(c => { const m = ca - c.prix * q, dm = m - (ca - cout); return `<tr><td data-l="Coût">${gcE(c.prix)} · <span class="gc-sous">${esc(c.lib)}</span></td><td class="n" data-l="Marge">marge ${gcE(GC.r2(m))}</td><td class="n" data-l="Écart"><b style="color:${dm >= 0 ? 'var(--good)' : 'var(--bad)'};">${dm >= 0 ? '+' : ''}${gcE(GC.r2(dm))}</b></td></tr>`; }).join('')}</tbody></table></div>`;
}
// Coûts d'achat possibles pour un article et un client (commandes fournisseurs, accord, catalogue)
function gcmvChoixCouts(articleId, clientId){
  const D = gcD(), a = D.articles.find(x => x.id === articleId) || {}, out = [], vus = {};
  const add = (prix, lib) => { const k = String(GC.num(prix)); if(GC.num(prix) > 0 && !vus[k]){ vus[k] = 1; out.push({prix:GC.num(prix), lib}); } };
  D.cmdF.filter(c => c.statut !== 'annulee' && GC.liste(c.lignes).some(l => l.articleId === articleId)).sort((x, y) => (y.date || '').localeCompare(x.date || '')).forEach(c => { const l = c.lignes.find(y => y.articleId === articleId); add(l.pu, 'Commande fournisseur ' + c.numero + ' du ' + gcDt(c.date)); });
  (typeof gcfrAccords === 'function' ? gcfrAccords() : []).filter(ac => ac.articleId === articleId && (!ac.clientId || ac.clientId === clientId)).forEach(ac => GC.liste(ac.paliers).forEach(p => add(p.prix, 'Accord ' + ac.numero + ' · ' + gcfrLibPalier(p))));
  add(a.prixAchat, 'Prix d\'achat du catalogue' + (a.listePrix ? ' (' + a.listePrix.nom + ')' : ''));
  return out;
}
// ---------- Corriger les coûts estimés ----------
window.gcmvFormCout = (blIds) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), bls = D.livraisons.filter(b => blIds.indexOf(b.id) >= 0), L = [];
  bls.forEach(b => b.lignes.forEach(l => { if(l.coutTheorique) L.push({b, l}); }));
  if(!L.length){ showToast('Aucun coût estimé'); return; }
  const art = L[0].l.articleId, cl = L[0].b.clientId, choix = gcmvChoixCouts(art, cl), q = L.reduce((s, x) => s + GC.qteNetteLigne(x.l), 0);
  mgtModal('Corriger le coût d\'achat estimé', `<p style="margin-top:0;">${L.length} ligne(s) · ${gcQ(q)} · livraisons ${esc(Array.from(new Set(L.map(x => x.b.numero))).join(', '))}</p>
    <div class="gc-sous" style="margin-bottom:8px;">Choisissez le prix réellement payé au fournisseur pour cette marchandise. Le calcul de la marge de ces livraisons est mis à jour ; l'ancien coût est gardé dans l'historique.</div>
    ${choix.map((c, i) => `<label class="gcmv-choix"><input type="radio" name="gmc" value="${c.prix}" ${i === 0 ? 'checked' : ''} data-lib="${gcAttr(c.lib)}"> <b>${gcE(c.prix)}</b> · ${esc(c.lib)}</label>`).join('')}
    <label class="gcmv-choix"><input type="radio" name="gmc" value="autre" data-lib="Saisi manuellement"> Autre prix : <input type="number" id="gmc-autre" min="0" step="any" style="width:120px;" onfocus="document.querySelector('input[name=gmc][value=autre]').checked = true"></label>
    ${mgtChamp('Justificatif (n° de facture fournisseur, remarque)', 'gmc-note', '')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-cout" onclick="gcmvValiderCout(${gcAttr(JSON.stringify(blIds))})">Appliquer à ces ${L.length} ligne(s)</button>`);
};
window.gcmvValiderCout = (blIds) => gcOperation(() => {
  const r = document.querySelector('input[name=gmc]:checked'); if(!r){ showToast('Choisissez un prix'); return; }
  const prix = r.value === 'autre' ? GC.num(gcVal('gmc-autre')) : GC.num(r.value), lib = r.dataset.lib + (gcVal('gmc-note') ? ' · ' + gcVal('gmc-note') : '');
  if(!(prix > 0)){ showToast('Prix invalide'); return; }
  const D = gcD(), ctx = gcCtx(), maj = []; let n = 0;
  D.livraisons.filter(b => blIds.indexOf(b.id) >= 0).forEach(b => {
    const avant = GC.coutLivraison(b);
    const lignes = b.lignes.map(l => { if(!l.coutTheorique) return l; n++; return Object.assign({}, l, {coutUnitTheorique:prix, coutSource:lib, coutCorrige:{date:ctx.date, par:ctx.par, ancien:GC.num(l.coutUnitTheorique), nouveau:prix, source:lib}}); });
    const nb = Object.assign({}, b, {lignes}), apres = GC.coutLivraison(nb);
    nb.histoCouts = GC.liste(b.histoCouts).concat([{date:ctx.date, ts:ctx.ts, par:ctx.par, avant:{cout:avant.cout, marge:avant.marge}, apres:{cout:apres.cout, marge:apres.marge}, motif:'Coût d\'achat corrigé : ' + gcE(prix) + ' (' + lib + ')'}]);
    maj.push(nb);
  });
  gcEnregistrer('livraisons', maj);
  gcJournal('Correction du coût', 'Livraison', {id:maj[0].id, numero:maj.map(b => b.numero).join(', ')}, n + ' ligne(s) à ' + gcE(prix) + ' · ' + lib);
  showToast('Coût corrigé sur ' + n + ' ligne(s)');
  const d = window.gcmvDernier; nav(activeTab); if(d) gcmvVerifier(d.titre, d.blIds, d.opts);
});
// Prendre le prix facturé comme prix de vente de la livraison
window.gcmvAlignerFacture = (blIds) => {
  const D = gcD(), F = factListe(), bls = D.livraisons.filter(b => blIds.indexOf(b.id) >= 0);
  gcConfirmer('Prix de vente = prix facturé', 'Le prix de vente des livraisons ' + esc(bls.map(b => b.numero).join(', ')) + ' sera remplacé par le prix de leur facture. La marge sera calculée sur le montant réellement facturé. La commande client garde son prix.', (motif) => gcOperation(() => {
    const ctx = gcCtx(), maj = bls.map(b => { const f = F[b.factureId]; const A1 = gcmvAnalyse([b]); const lignes = b.lignes.map((l, i) => { const x = A1.lignes.find(y => y.l.lid === l.lid); const fl = x && x.puFacture !== null ? {pu:x.puFacture} : null; return fl && Math.abs(GC.num(fl.pu) - GC.num(l.pu)) > 1e-9 ? Object.assign({}, l, {pu:GC.num(fl.pu), puCommande:GC.num(l.pu)}) : l; });
      return Object.assign({}, b, {lignes, histoPrix:GC.liste(b.histoPrix).concat([{date:ctx.date, par:ctx.par, motif:'Prix facturé ' + (f ? f.numero : '') + (motif ? ' · ' + motif : '')}])}); });
    gcEnregistrer('livraisons', maj); gcJournal('Prix de vente aligné sur la facture', 'Livraison', {id:maj[0].id, numero:maj.map(b => b.numero).join(', ')}, motif || '');
    showToast('Prix de vente aligné sur la facture'); const d = window.gcmvDernier; nav(activeTab); if(d) gcmvVerifier(d.titre, d.blIds, d.opts);
  }), {motif:true, bouton:'Aligner sur la facture'});
};
// Export Excel du détail
window.gcmvExporter = () => {
  const d = window.gcmvDernier; if(!d) return;
  const D = gcD(), bls = D.livraisons.filter(b => d.blIds.indexOf(b.id) >= 0 && !b.annulee).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const A = gcmvAnalyse(bls, d.opts.articleId), T = A.T;
  gcExcel({titre:'Vérification de la marge', sous:d.titre + ' · édité le ' + gcDt(getTodayISO()) + ' · CA = quantité × prix · coût = quantité × coût unitaire (+ frais) · taux de marque = marge / CA',
    colonnes:[['Livraison', 't'], ['Date', 'd'], ['Facture', 't'], ['Commande', 't'], ['Article', 't'], ['Quantité', 'q'], ['Prix de vente', 'n3'], ['CA HT', 'e'], ['Facturé HT', 'e'], ['Coût unitaire', 'n3'], ['Origine du coût', 't'], ['Coût', 'e'], ['Marge', 'e'], ['Taux de marque', 'p']],
    lignes:A.lignes.map(x => [x.b.numero, x.b.date, x.f ? x.f.numero : '', x.b.cmdNumero || '', x.l.ref || x.l.designation, x.q, x.pu, GC.r2(x.ca), x.facture === null ? '' : x.facture, GC.r4 ? GC.r4(x.cu) : x.cu, x.source, GC.r2(x.cout), GC.r2(x.marge), x.tm === null ? '' : GC.r2(x.tm)]),
    total:['Total', '', '', '', '', T.q, '', GC.r2(T.ca), T.fact ? GC.r2(T.fact) : '', '', '', GC.r2(T.cout), GC.r2(T.marge), T.ca > 0 ? GC.r2(T.marge / T.ca * 100) : '']});
};

// ---------- Marge prévue (reste à livrer d'une commande client, commande fournisseur, offre) ----------
function gcmvPrevisionCmd(c){
  const D = gcD(), liv = GC.livres(D), out = [];
  GC.liste(c.lignes).forEach(l => {
    const reste = GC.rq(GC.num(l.qte) - (liv[GC.cleLigne(c.id, l.lid)] || 0)); if(reste <= 0) return;
    const tot = GC.liste(c.lignes).filter(x => x.articleId === l.articleId).reduce((s, x) => s + GC.num(x.qte), 0), e = gcmvCoutEstime(l.articleId, c.clientId, getTodayISO(), tot);
    out.push({lib:'Ligne ' + (c.lignes.indexOf(l) + 1) + ' · ' + gcDt(l.dateLivraison || c.dateSouhaitee), q:reste, pv:GC.num(l.pu) * (1 - GC.num(l.remise) / 100), pa:e.prix, source:e.source});
  });
  return {titre:'Reste à livrer (marge prévue)', lignes:out};
}
function gcmvPrevisionHTML(P){
  if(!P.lignes.length) return '';
  const T = P.lignes.reduce((t, x) => { t.q += x.q; t.ca += x.q * x.pv; t.c += x.q * x.pa; return t; }, {q:0, ca:0, c:0});
  return `<h4 style="margin:12px 0 4px;">${esc(P.titre)}</h4><div style="overflow-x:auto;"><table class="gc-lignes gcmv-t"><thead><tr><th>Ligne</th><th class="n">Quantité</th><th class="n">Prix de vente</th><th class="n">Coût d'achat prévu</th><th>Origine du coût</th><th class="n">Marge unitaire</th><th class="n">Marge prévue</th><th class="n">Taux de marque</th></tr></thead><tbody>
    ${P.lignes.map(x => `<tr><td data-l="Ligne">${esc(x.lib)}</td><td class="n" data-l="Quantité">${gcQ(x.q)}</td><td class="n" data-l="Prix de vente">${gcE(x.pv)}</td><td class="n" data-l="Coût prévu"><b>${gcE(x.pa)}</b></td><td data-l="Origine" class="gcmv-src">${esc(x.source)}</td><td class="n" data-l="Marge unitaire">${gcE(GC.r4 ? GC.r4(x.pv - x.pa) : x.pv - x.pa)}</td><td class="n" data-l="Marge prévue"><b>${gcE(GC.r2(x.q * (x.pv - x.pa)))}</b></td><td class="n" data-l="Taux de marque">${gcPct(x.pv > 0 ? (x.pv - x.pa) / x.pv * 100 : null)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Total prévu</td><td class="n">${gcQ(T.q)}</td><td class="n">${gcE(GC.r2(T.ca))}</td><td class="n">${gcE(GC.r2(T.c))}</td><td></td><td></td><td class="n">${gcE(GC.r2(T.ca - T.c))}</td><td class="n">${gcPct(T.ca > 0 ? (T.ca - T.c) / T.ca * 100 : null)}</td></tr></tfoot></table></div>`;
}
window.gcmvVerifierCF = (cfId) => {
  const D = gcD(), cf = D.cmdF.find(x => x.id === cfId); if(!cf) return;
  const cc = D.cmdC.find(c => c.id === cf.cmdClientId);
  const lignes = GC.liste(cf.lignes).map((l, i) => { const lc = cc ? (cc.lignes.find(x => x.articleId === l.articleId) || {}) : null;
    const a = D.articles.find(x => x.id === l.articleId) || {}; const pv = lc && lc.pu ? GC.num(lc.pu) : GC.prixPalier(a, GC.num(l.qte)).prix;
    return {lib:'Expédition ' + (i + 1) + ' · ' + gcDt(l.dateLivraison || cf.datePrevue), q:GC.num(l.qte), pv, pa:GC.num(l.pu), source:'Prix de la commande ' + cf.numero + (cf.accordId ? ' (accord)' : '') + ' · vente : ' + (lc ? 'PO ' + (cc.reference || cc.numero) : 'catalogue')}; });
  mgtModal('Marge prévue · ' + esc(cf.numero), `<div class="gcmv-formule">Marge prévue = quantité × (prix de vente au client − prix d'achat au fournisseur). Frais de transport et de douane non compris tant qu'ils ne sont pas saisis à la réception.</div>${gcmvPrevisionHTML({titre:'Détail', lignes})}`);
  const m = document.querySelector('#mgt-modal-zone .modal-sheet'); if(m) m.classList.add('gcmv-large');
};
window.gcmvVerifierOffre = (oid) => {
  const D = gcD(), o = D.offres.find(x => x.id === oid); if(!o) return;
  const rows = [];
  GC.liste(o.lignes).forEach(l => { const g = GC.liste((o.grilles || {})[l.lid]); (g.length ? g : [{min:GC.num(l.qte), prix:GC.num(l.pu), lib:gcQ(l.qte)}]).forEach(p => { const e = gcmvCoutEstime(l.articleId, o.clientId, getTodayISO(), p.min);
    rows.push({lib:(l.ref || l.designation) + ' · ' + (p.lib || gcQ(p.min)), q:p.min, pv:GC.num(p.prix), pa:e.prix, source:e.source}); }); });
  mgtModal('Marge de l\'offre · ' + esc(o.numero || ''), `<div class="gcmv-formule">Pour chaque palier de l'offre : marge unitaire = prix de l'offre − coût d'achat prévu pour cette quantité (commande fournisseur la plus récente pour ce client, sinon accord fournisseur, sinon prix d'achat du catalogue). La colonne « Marge prévue » est calculée sur la quantité minimale du palier.</div>${gcmvPrevisionHTML({titre:'Paliers de l\'offre', lignes:rows})}`);
  const m = document.querySelector('#mgt-modal-zone .modal-sheet'); if(m) m.classList.add('gcmv-large');
};

// ---------- Boutons « Vérifier la marge » dans tous les écrans ----------
function gcmvBouton(onclick, lib){ return `<button class="btn btn-ghost gcmv-btn" data-gc="verifier-marge" onclick="${onclick}">🔍 ${lib || 'Vérifier la marge'}</button>`; }
function gcmvAjouterAction(html){ const z = document.querySelector('#main .gc-actions'); if(z) z.insertAdjacentHTML('afterbegin', html); else { const h = document.querySelector('#main .gc-tete'); if(h) h.insertAdjacentHTML('beforeend', `<div class="actions gc-actions">${html}</div>`); } }
function gcmvIds(l){ return gcAttr(JSON.stringify(l.map(b => b.id))); }
// Bon de livraison
const gcmvFicheBL = window.renderGcLivraison;
window.renderGcLivraison = function(main){ gcmvFicheBL(main); const b = gcD().livraisons.find(x => x.id === gcOuvert['gc-livraison']); if(b && !b.annulee) gcmvAjouterAction(gcmvBouton(`gcmvVerifier('Livraison ${gcJs(b.numero)}', ['${b.id}'])`)); };
// Liste des livraisons (lignes affichées)
const gcmvListeBL = window.renderGcLivraisons;
window.renderGcLivraisons = function(main){ gcmvListeBL(main); gcmvAjouterAction(gcmvBouton(`gcmvVerifier('Livraisons affichées', gcLignesVisibles('livraisons').filter(b => !b.annulee).map(b => b.id))`, 'Vérifier les marges')); };
// Commande client
const gcmvFicheCmd = window.renderGcCommande;
window.renderGcCommande = function(main){
  gcmvFicheCmd(main); const D = gcD(), c = D.cmdC.find(x => x.id === gcOuvert['gc-commande']); if(!c) return;
  const bls = D.livraisons.filter(b => b.cmdId === c.id && !b.annulee);
  gcmvAjouterAction(gcmvBouton(`gcmvVerifier('Commande ${gcJs(c.reference ? 'PO ' + c.reference : c.numero)}', ${gcmvIds(bls)}, {prevision:gcmvPrevisionCmd(gcD().cmdC.find(x => x.id === '${c.id}'))})`));
};
// Commande fournisseur
const gcmvFicheCF = window.renderGcAchat;
window.renderGcAchat = function(main){ gcmvFicheCF(main); const cf = gcD().cmdF.find(x => x.id === gcOuvert['gc-achat']); if(cf) gcmvAjouterAction(gcmvBouton(`gcmvVerifierCF('${cf.id}')`, 'Vérifier la marge prévue')); };
// Offre
const gcmvFicheOffre = window.renderGcOffre;
window.renderGcOffre = function(main){ gcmvFicheOffre(main); const o = gcD().offres.find(x => x.id === gcOuvert['gc-offre']); if(o) gcmvAjouterAction(gcmvBouton(`gcmvVerifierOffre('${o.id}')`, 'Vérifier la marge de l\'offre')); };
// Client
const gcmvFicheClient = renderGcClient;
renderGcClient = function(main){ gcmvFicheClient(main); const id = gcOuvert['gc-client'], bls = gcD().livraisons.filter(b => b.clientId === id && !b.annulee); gcmvAjouterAction(gcmvBouton(`gcmvVerifier('Client ${gcJs(gcNomClient(id))}', ${gcmvIds(bls)})`, 'Vérifier les marges')); };
// Factures : fenêtre d'une facture et liste
const gcmvVoirFacture = window.gcsfVoirFacture;
window.gcsfVoirFacture = (fid) => {
  gcmvVoirFacture(fid); const f = factListe()[fid]; if(!f) return;
  const ids = GC.liste((f.origine || {}).ids), z = document.querySelector('#mgt-modal-zone .modal-sheet > div:last-child');
  if(z && ids.length) z.insertAdjacentHTML('beforeend', gcmvBouton(`gcmvVerifier('Facture ${gcJs(f.numero)}', ${gcAttr(JSON.stringify(ids))})`));
};
const gcmvListeFact = window.renderGcFactures;
window.renderGcFactures = function(main){ gcmvListeFact(main); gcmvAjouterAction(gcmvBouton(`gcmvVerifier('Factures affichées', gcLignesVisibles('factures').reduce((s, f) => s.concat(GC.liste((f.origine || {}).ids)), []))`, 'Vérifier les marges')); };
// Rentabilité (filtres en cours)
const gcmvRenta = window.renderGcRentabilite;
window.renderGcRentabilite = function(main){
  gcmvRenta(main);
  gcmvAjouterAction(gcmvBouton(`gcmvVerifierRenta()`, 'Vérifier le calcul'));
};
window.gcmvVerifierRenta = () => {
  const F = gcFiltresRenta, ids = gcD().livraisons.filter(b => !b.annulee && (!F.du || b.date >= F.du) && (!F.au || b.date <= F.au) && (!F.clientId || b.clientId === F.clientId) && (!F.cmdId || b.cmdId === F.cmdId)).map(b => b.id);
  gcmvVerifier('Rentabilité · ' + gcSousFiltresRenta(F).split(' · coûts')[0], ids, {articleId:F.articleId || ''});
};
// Tableau de bord : période affichée en clair + vérification
const gcmvAccueil = renderGcAccueil;
renderGcAccueil = function(main){
  gcmvAccueil(main);
  const F = gcFiltresAccueil || gcFiltresDefaut(), per = (F.du ? 'du ' + gcDt(F.du) : 'depuis le début') + (F.au ? ' au ' + gcDt(F.au) : '');
  document.querySelectorAll('#gc-body .dd-bx-l').forEach(e => { if(/\(période\)/.test(e.textContent)) e.textContent = e.textContent.replace('(période)', '(' + per + ')'); });
  const bx = Array.from(document.querySelectorAll('#gc-body .dd-bx')).find(e => /Marge brute/.test(e.textContent));
  if(bx){ const ids = gcD().livraisons.filter(b => !b.annulee && (!F.du || b.date >= F.du) && (!F.au || b.date <= F.au) && (!F.clientId || b.clientId === F.clientId)).map(b => b.id);
    bx.closest('.dd-boites').insertAdjacentHTML('afterend', `<div class="gcmv-accueil">${gcmvBouton(`gcmvVerifier('Tableau de bord · ${gcJs(per)}', ${gcAttr(JSON.stringify(ids))}, {articleId:'${gcJs(F.articleId || '')}'})`, 'Vérifier le calcul des marges (' + per + ')')}</div>`); }
};

// ---------- Styles ----------
(function(){
  const s = document.createElement('style');
  s.textContent = `
  .modal-sheet.gcmv-large{max-width:1180px;width:calc(100% - 24px);}
  .gcmv-formule{font-size:12.5px;line-height:1.6;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin:8px 0;}
  .gcmv-ctl div{font-size:13px;padding:4px 0 4px 8px;border-left:3px solid var(--border);margin:3px 0;}
  .gcmv-ctl .ok{border-color:var(--good);} .gcmv-ctl .ko{border-color:var(--warn);background:var(--warn-bg, rgba(230,154,12,.08));}
  .gcmv-t td,.gcmv-t th{white-space:nowrap;font-size:12.5px;} .gcmv-t .gcmv-src{white-space:normal;min-width:200px;font-size:11.5px;color:var(--ink-soft);}
  .gcmv-t tfoot td{font-weight:700;border-top:2px solid var(--border);}
  tr.gcmv-est td{background:var(--warn-bg, rgba(230,154,12,.07));}
  .gcmv-sim{font-size:12.5px;border:1px dashed var(--warn);border-radius:10px;padding:8px 12px;margin:8px 0;} .gcmv-sim table{margin-top:4px;}
  .gcmv-choix{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;}
  .gcmv-choix input[type=radio]{width:18px;height:18px;min-width:0;}
  .gcmv-accueil{margin:-6px 0 14px;} .gcmv-btn{white-space:nowrap;}
  `;
  document.head.appendChild(s);
})();
