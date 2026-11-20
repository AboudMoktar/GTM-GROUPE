// ============================================================
// CRM GADH — MODIFICATION MANUELLE DES BONS DE LIVRAISON ET DES FACTURES
// « ✎ Modifier » : un bon de livraison et sa facture ensemble (prix de vente, prix facturé,
// coût d'achat, numéros, dates, paiement). « Saisie des prix réels » : un tableau de toutes les
// lignes livrées, modifiables d'un coup (reprise des prix réellement appliqués).
// Chaque modification est tracée (motif obligatoire, avant → après) dans le document et le journal.
// Chargé après gadh-gc-verif-marges.js.
// ============================================================

// Ligne de facture correspondant à une ligne de livraison (factures de plusieurs livraisons comprises)
function gcedLigneFacture(b, l){
  const f = b && b.factureId ? (factListe() || {})[b.factureId] : null; if(!f) return {f:null, idx:-1};
  const D = gcD(), ids = GC.liste((f.origine || {}).ids); let off = 0;
  for(const id of ids){ if(id === b.id) break; const bb = D.livraisons.find(x => x.id === id); off += bb ? bb.lignes.filter(y => GC.qteNetteLigne(y) > 0).length : 0; }
  const k = b.lignes.filter(y => GC.qteNetteLigne(y) > 0).indexOf(l);
  return {f, idx:k < 0 ? -1 : off + k};
}
function gcedP(v){ return v === '' || v === null || v === undefined ? null : GC.num(v); }
function gcedFmt(v){ return v === null || v === undefined ? '' : String(Math.round(GC.num(v) * 100000) / 100000); }

// ---------- Modifier un bon de livraison et sa facture ----------
window.gcedFormBL = (blId) => {
  if(!gcPeut()) return gcRefus();
  const D = gcD(), b = D.livraisons.find(x => x.id === blId); if(!b) return;
  const f = b.factureId ? factListe()[b.factureId] : null, c = D.cmdC.find(x => x.id === b.cmdId);
  const lignes = b.lignes.filter(l => GC.qteNetteLigne(l) > 0);
  mgtModal('Modifier ' + esc(b.numero) + (f ? ' et la facture ' + esc(f.numero) : ''), `
    ${f && factStatut(f) === 'payee' ? '<div class="gc-alerte">Cette facture est marquée payée : modifiez-la seulement pour corriger la saisie dans la CRM (le document envoyé au client ne change pas).</div>' : ''}
    <div class="gc-form">${mgtChamp('N° du bon de livraison', 'ged-bl-num', b.numero)}${mgtChamp('Date de livraison', 'ged-bl-date', b.date, 'date')}
      ${f ? mgtChamp('N° de facture', 'ged-fa-num', f.numero) + mgtChamp('Date de facture', 'ged-fa-date', f.date, 'date') + mgtChamp('Échéance', 'ged-fa-ech', f.echeance || '', 'date')
        + `<div class="field"><label>Paiement</label><select id="ged-fa-paie">${gcOpts([['non_payee', 'Non payée'], ['en_cours', 'Paiement en cours'], ['payee', 'Payée']], factStatut(f))}</select></div>` + mgtChamp('Payée le', 'ged-fa-dpaie', f.datePaiement || '', 'date') + mgtChamp('TVA (%)', 'ged-fa-tva', f.tva, 'number', 'min="0" step="any"') : ''}</div>
    <h4 style="margin:6px 0;">Prix réellement appliqués</h4>
    <div style="overflow-x:auto;"><table class="gc-lignes ged-t"><thead><tr><th>Article</th><th class="n">Quantité</th><th>Prix de vente HT</th><th>Remise %</th>${f ? '<th>Prix facturé HT</th>' : ''}<th>Coût d'achat unitaire</th><th class="n">Montant</th><th class="n">Marge</th></tr></thead><tbody>
    ${lignes.map((l, i) => { const lf = gcedLigneFacture(b, l), fl = lf.f ? GC.liste(lf.f.lignes)[lf.idx] : null, est = !!l.coutTheorique;
      const cu = est ? GC.num(l.coutUnitTheorique) : (GC.coutLivraison(Object.assign({}, b, {lignes:[l], frais:[]})).cout / (GC.qteNetteLigne(l) || 1));
      return `<tr data-i="${i}"><td data-l="Article">${esc(l.ref || l.designation || '')}</td><td class="n" data-l="Quantité">${gcQ(GC.qteNetteLigne(l))} ${esc(l.unite || '')}</td>
        <td data-l="Prix de vente"><input type="number" step="any" min="0" class="ged-pu" value="${gcedFmt(l.pu)}" oninput="gcedCalcBL()"></td><td data-l="Remise"><input type="number" step="any" min="0" max="100" class="ged-rem" value="${gcedFmt(l.remise || 0)}" oninput="gcedCalcBL()"></td>
        ${f ? `<td data-l="Prix facturé"><input type="number" step="any" min="0" class="ged-pf" value="${gcedFmt(fl ? fl.pu : l.pu)}" oninput="gcedCalcBL()"></td>` : ''}
        <td data-l="Coût d'achat">${est ? `<input type="number" step="any" min="0" class="ged-cu" value="${gcedFmt(cu)}" oninput="gcedCalcBL()">` : `<span class="gc-sous">${gcE(cu)} · lots reçus (FIFO)</span><input type="hidden" class="ged-cu" value="${gcedFmt(cu)}">`}</td>
        <td class="n ged-mt" data-l="Montant"></td><td class="n ged-mg" data-l="Marge"></td></tr>`; }).join('')}</tbody></table></div>
    ${f ? `<label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:13px;"><input type="checkbox" id="ged-lier" checked style="width:18px;height:18px;min-width:0;" onchange="gcedCalcBL()"> Prix facturé = prix de vente (modifier les deux ensemble)</label>` : ''}
    ${c ? `<label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:13px;"><input type="checkbox" id="ged-cmd" style="width:18px;height:18px;min-width:0;"> Mettre aussi ce prix sur la commande ${esc(c.reference ? 'PO ' + c.reference : c.numero)} (pour les livraisons suivantes)</label>` : ''}
    <div id="ged-tot" class="gcmv-formule"></div>
    ${mgtChamp('Motif de la modification *', 'ged-motif', '', 'text', 'placeholder="ex. prix réellement facturé selon facture papier"')}
    <button class="btn btn-primary" style="width:100%;" data-gc="valider-modif-bl" onclick="gcedValiderBL('${blId}')">Enregistrer les modifications</button>`);
  window.gcedBL = blId; gcedCalcBL();
  const m = document.querySelector('#mgt-modal-zone .modal-sheet'); if(m) m.classList.add('gcmv-large');
};
window.gcedCalcBL = () => {
  const b = gcD().livraisons.find(x => x.id === window.gcedBL); if(!b) return;
  const lignes = b.lignes.filter(l => GC.qteNetteLigne(l) > 0), lier = document.getElementById('ged-lier');
  let ca = 0, cout = 0, fa = 0;
  document.querySelectorAll('.ged-t tbody tr').forEach(tr => {
    const i = +tr.dataset.i, l = lignes[i], q = GC.qteNetteLigne(l), pu = GC.num(tr.querySelector('.ged-pu').value), rem = GC.num(tr.querySelector('.ged-rem').value), cu = GC.num(tr.querySelector('.ged-cu').value);
    const pf = tr.querySelector('.ged-pf'); if(pf && lier && lier.checked) pf.value = tr.querySelector('.ged-pu').value; if(pf) pf.disabled = !!(lier && lier.checked);
    const mt = q * pu * (1 - rem / 100), mg = mt - q * cu; ca += mt; cout += q * cu; fa += pf ? q * GC.num(pf.value) * (1 - rem / 100) : 0;
    tr.querySelector('.ged-mt').textContent = gcE(GC.r2(mt)); tr.querySelector('.ged-mg').innerHTML = `<b style="color:${mg < 0 ? 'var(--bad)' : 'inherit'};">${gcE(GC.r2(mg))}</b>`;
  });
  const avant = GC.coutLivraison(b), fr = avant.fraisLivraison;
  document.getElementById('ged-tot').innerHTML = `<b>Après modification</b> · chiffre d'affaires ${gcE(GC.r2(ca))}${document.querySelector('.ged-pf') ? ' · facturé HT ' + gcE(GC.r2(fa)) : ''} · coût ${gcE(GC.r2(cout + fr))}${fr ? ' (dont frais ' + gcE(fr) + ')' : ''} · <b>marge ${gcE(GC.r2(ca - cout - fr))}</b> (avant : ${gcE(avant.marge)}) · taux de marge ${gcPct((cout + fr) > 0 ? (ca - cout - fr) / (cout + fr) * 100 : null)}`;
};
window.gcedValiderBL = (blId) => gcOperation(() => {
  const motif = gcVal('ged-motif'); if(!motif){ showToast('Indiquez le motif de la modification'); return; }
  const D = gcD(), b = D.livraisons.find(x => x.id === blId), F = Object.assign({}, factListe()), f = b.factureId ? F[b.factureId] : null, ctx = gcCtx();
  const numBL = gcVal('ged-bl-num'), dateBL = gcVal('ged-bl-date');
  if(!numBL || !dateBL){ showToast('N° et date du bon de livraison obligatoires'); return; }
  if(D.livraisons.some(x => x.id !== blId && x.numero === numBL)){ showToast('Le n° ' + numBL + ' est déjà utilisé'); return; }
  const lignesV = b.lignes.filter(l => GC.qteNetteLigne(l) > 0), saisie = {};
  document.querySelectorAll('.ged-t tbody tr').forEach(tr => { const l = lignesV[+tr.dataset.i]; const pf = tr.querySelector('.ged-pf');
    saisie[l.lid] = {pu:gcedP(tr.querySelector('.ged-pu').value), rem:gcedP(tr.querySelector('.ged-rem').value) || 0, cu:gcedP(tr.querySelector('.ged-cu').value), pf:pf ? gcedP(pf.value) : null}; });
  if(Object.values(saisie).some(s => s.pu === null || s.pu < 0 || (s.pf !== null && s.pf < 0) || (s.cu !== null && s.cu < 0) || s.rem < 0 || s.rem > 100)){ showToast('Prix ou remise invalide'); return; }
  const chg = [];
  const lignes = b.lignes.map(l => { const s = saisie[l.lid]; if(!s) return l; const n = Object.assign({}, l);
    if(Math.abs(s.pu - GC.num(l.pu)) > 1e-9){ chg.push((l.ref || 'ligne') + ' prix ' + gcE(l.pu) + ' → ' + gcE(s.pu)); n.pu = s.pu; }
    if(Math.abs(s.rem - GC.num(l.remise)) > 1e-9){ chg.push('remise ' + gcPct(l.remise || 0) + ' → ' + gcPct(s.rem)); n.remise = s.rem; }
    if(l.coutTheorique && s.cu !== null && Math.abs(s.cu - GC.num(l.coutUnitTheorique)) > 1e-9){ chg.push('coût ' + gcE(l.coutUnitTheorique) + ' → ' + gcE(s.cu)); n.coutCorrige = {date:ctx.date, par:ctx.par, ancien:GC.num(l.coutUnitTheorique), nouveau:s.cu, source:'Saisie manuelle · ' + motif}; n.coutUnitTheorique = s.cu; n.coutSource = 'Saisie manuelle · ' + motif; }
    return n; });
  if(numBL !== b.numero) chg.push('n° ' + b.numero + ' → ' + numBL); if(dateBL !== b.date) chg.push('date ' + gcDt(b.date) + ' → ' + gcDt(dateBL));
  const avant = GC.coutLivraison(b), nb = Object.assign({}, b, {numero:numBL, date:dateBL, lignes});
  const apres = GC.coutLivraison(nb);
  nb.histoModifs = GC.liste(b.histoModifs).concat(chg.length ? [{date:ctx.date, ts:ctx.ts, par:ctx.par, motif, details:chg.join(' · '), avant:{ca:avant.ca, marge:avant.marge}, apres:{ca:apres.ca, marge:apres.marge}}] : []);
  // facture
  let chgF = [];
  if(f){
    const numF = gcVal('ged-fa-num'); if(!numF){ showToast('N° de facture obligatoire'); return; }
    if(Object.values(F).some(x => x && x.id !== f.id && x.numero === numF)){ showToast('Le n° de facture ' + numF + ' est déjà utilisé'); return; }
    const nf = Object.assign({}, f, {lignes:GC.liste(f.lignes).map(x => Object.assign({}, x))});
    lignesV.forEach(l => { const s = saisie[l.lid], lf = gcedLigneFacture(b, l), fl = nf.lignes[lf.idx]; if(!fl) return;
      const pf = s.pf !== null ? s.pf : s.pu; if(Math.abs(pf - GC.num(fl.pu)) > 1e-9){ chgF.push('prix facturé ' + gcE(fl.pu) + ' → ' + gcE(pf)); fl.pu = pf; }
      if(Math.abs(s.rem - GC.num(fl.remise)) > 1e-9){ fl.remise = s.rem; } });
    const champs = {numero:numF, date:gcVal('ged-fa-date') || f.date, echeance:gcVal('ged-fa-ech'), paiement:gcVal('ged-fa-paie'), datePaiement:gcVal('ged-fa-dpaie'), tva:GC.num(gcVal('ged-fa-tva'))};
    if(champs.paiement === 'payee' && !champs.datePaiement) champs.datePaiement = f.datePaiement || '';
    Object.keys(champs).forEach(k => { if(String(champs[k] == null ? '' : champs[k]) !== String(f[k] == null ? '' : f[k])) chgF.push(k + ' ' + (f[k] || '—') + ' → ' + (champs[k] || '—')); });
    Object.assign(nf, champs);
    if(numBL !== b.numero && nf.origine){ nf.origine = Object.assign({}, nf.origine, {label:String(nf.origine.label || '').split(b.numero).join(numBL)}); nf.objet = String(nf.objet || '').split(b.numero).join(numBL); }
    nf.histoModifs = GC.liste(f.histoModifs).concat(chgF.length ? [{date:ctx.date, ts:ctx.ts, par:ctx.par, motif, details:chgF.join(' · '), avant:factTotaux(f), apres:factTotaux(nf)}] : []);
    if(chgF.length) gcsfSauverFacture(nf);
  }
  if(!chg.length && !chgF.length){ showToast('Aucune modification'); return; }
  gcEnregistrer('livraisons', nb);
  // prix de la commande (optionnel)
  const cmdBox = document.getElementById('ged-cmd');
  if(cmdBox && cmdBox.checked){ const c = gcD().cmdC.find(x => x.id === b.cmdId); if(c){ const nc = Object.assign({}, c, {lignes:c.lignes.map(l => saisie[l.lid] ? Object.assign({}, l, {pu:saisie[l.lid].pu}) : l)}); gcEnregistrer('cmdC', nc); chg.push('prix reporté sur la commande'); } }
  gcJournal('Modification manuelle', 'Livraison' + (f ? ' et facture' : ''), {id:b.id, numero:numBL + (f ? ' / ' + (gcVal('ged-fa-num') || f.numero) : '')}, motif + ' · ' + chg.concat(chgF).join(' · '));
  mgtFermer(); showToast('Modifications enregistrées (marge ' + gcE(avant.marge) + ' → ' + gcE(apres.marge) + ')'); nav(activeTab);
});

// ---------- Saisie des prix réels : toutes les lignes livrées dans un tableau ----------
let gcedSaisie = {client:'', cmd:'', an:'', blIds:null};
window.gcedOuvrirSaisie = (opts) => { gcedSaisie = Object.assign({client:'', cmd:'', an:'', blIds:null}, opts || {}); nav('gc-prix-reels'); };
function gcedLignesSaisie(){
  const D = gcD(), S = gcedSaisie, out = [];
  D.livraisons.filter(b => !b.annulee && (!S.blIds || S.blIds.indexOf(b.id) >= 0) && (!S.client || b.clientId === S.client) && (!S.cmd || b.cmdId === S.cmd) && (!S.an || (b.date || '').slice(0, 4) === S.an))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.numero).localeCompare(String(b.numero)))
    .forEach(b => { const c = GC.coutLivraison(b); b.lignes.filter(l => GC.qteNetteLigne(l) > 0).forEach(l => { const lf = gcedLigneFacture(b, l), fl = lf.f ? GC.liste(lf.f.lignes)[lf.idx] : null, r = c.lignes.find(x => x.lid === l.lid) || {};
      out.push({b, l, f:lf.f, fl, q:GC.qteNetteLigne(l), cuReel:!l.coutTheorique, cu:l.coutTheorique ? GC.num(l.coutUnitTheorique) : (r.qte ? (r.achat + r.fraisLots) / r.qte : 0), marge:r.marge || 0, fraisL:r.fraisLivraison || 0}); }); });
  return out;
}
window.renderGcPrixReels = function(main){
  const D = gcD(), S = gcedSaisie, L = gcedLignesSaisie(), ed = gcPeut();
  window.gcedLignes = L;
  const b = gcSection(main, gcRetour('gc-factures', 'Saisie des prix réels'), '');
  const clients = Array.from(new Set(D.livraisons.map(x => x.clientId))), cmds = D.cmdC.filter(c => !S.client || c.clientId === S.client), ans = Array.from(new Set(D.livraisons.map(x => (x.date || '').slice(0, 4)))).sort().reverse();
  b.innerHTML = `<div class="gc-sous" style="margin-bottom:8px;">Saisissez les prix réellement appliqués sur les anciens bons de livraison et factures : prix de vente, prix facturé, coût d'achat payé au fournisseur. Les cases modifiées passent en couleur ; la marge est recalculée en direct. Rien n'est enregistré avant « Enregistrer ».</div>
    <div class="gc-filtres no-print"><label>Client<select onchange="gcedSaisie.client = this.value; gcedSaisie.cmd = ''; gcedSaisie.blIds = null; nav('gc-prix-reels')">${gcOpts(clients.map(id => [id, gcNomClient(id)]), S.client, 'Tous')}</select></label>
      <label>Commande<select onchange="gcedSaisie.cmd = this.value; gcedSaisie.blIds = null; nav('gc-prix-reels')">${gcOpts(cmds.map(c => [c.id, (c.reference ? 'PO ' + c.reference : c.numero) + ' · ' + gcNomClient(c.clientId)]), S.cmd, 'Toutes')}</select></label>
      <label>Année<select onchange="gcedSaisie.an = this.value; gcedSaisie.blIds = null; nav('gc-prix-reels')">${gcOpts(ans.map(a => [a, a]), S.an, 'Toutes')}</select></label>
      ${S.blIds ? `<span class="gc-sous">${S.blIds.length} livraison(s) choisie(s) · <a href="#" onclick="gcedSaisie.blIds = null; nav('gc-prix-reels'); return false;">tout afficher</a></span>` : ''}</div>
    ${!L.length ? buildEmptyState('Aucune livraison', 'Changez les filtres.') : `
    ${ed ? `<div class="card ged-tout no-print"><b>Appliquer à toutes les lignes affichées :</b>
      <label>Prix de vente <input type="number" step="any" min="0" id="ged-all-pu"></label><button class="btn btn-ghost" data-gc="appliquer-pu" onclick="gcedToutes('pu')">Appliquer</button>
      <label>Prix facturé <input type="number" step="any" min="0" id="ged-all-pf"></label><button class="btn btn-ghost" data-gc="appliquer-pf" onclick="gcedToutes('pf')">Appliquer</button>
      <label>Coût d'achat <input type="number" step="any" min="0" id="ged-all-cu"></label><button class="btn btn-ghost" data-gc="appliquer-cu" onclick="gcedToutes('cu')">Appliquer</button>
      <div class="gc-sous" style="margin-top:4px;">Le coût d'achat n'est modifiable que sur les livraisons sans stock suivi (coût estimé) ; les lignes sorties de lots reçus gardent leur coût réel.</div></div>` : ''}
    <div class="gct-scroll"><table class="gct-t ged-grille"><thead><tr><th>Livraison</th><th>Facture</th><th>Commande</th><th class="n">Quantité</th><th>Prix de vente</th><th>Prix facturé</th><th>Coût d'achat</th><th class="n">Facturé HT</th><th class="n">Marge</th></tr></thead><tbody>
      ${L.map((x, i) => `<tr data-i="${i}"><td data-l="Livraison"><a href="#" onclick="gcOuvrir('gc-livraison', '${x.b.id}'); return false;"><b>${esc(x.b.numero)}</b></a><div class="gc-sous">${gcDt(x.b.date)} · ${esc(x.l.ref || '')}</div></td>
        <td data-l="Facture">${x.f ? esc(x.f.numero) + '<div class="gc-sous">' + gcDt(x.f.date) + '</div>' : '<span class="gc-sous">sans facture</span>'}</td><td data-l="Commande">${esc(x.b.cmdNumero || '')}</td><td class="n" data-l="Quantité">${gcQ(x.q)}</td>
        <td data-l="Prix de vente"><input type="number" step="any" min="0" class="gs-pu" data-v="${gcedFmt(x.l.pu)}" value="${gcedFmt(x.l.pu)}" ${ed ? '' : 'disabled'} oninput="gcedCalcLigne(${i})"></td>
        <td data-l="Prix facturé">${x.fl ? `<input type="number" step="any" min="0" class="gs-pf" data-v="${gcedFmt(x.fl.pu)}" value="${gcedFmt(x.fl.pu)}" ${ed ? '' : 'disabled'} oninput="gcedCalcLigne(${i})">` : '—'}</td>
        <td data-l="Coût d'achat">${x.cuReel ? `<span class="gc-sous" title="Coût réel des lots reçus">${gcE(x.cu)} (lots)</span>` : `<input type="number" step="any" min="0" class="gs-cu" data-v="${gcedFmt(x.cu)}" value="${gcedFmt(x.cu)}" ${ed ? '' : 'disabled'} oninput="gcedCalcLigne(${i})">`}</td>
        <td class="n gs-fa" data-l="Facturé HT"></td><td class="n gs-mg" data-l="Marge"></td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="3">Total · <span id="ged-nb">0</span> ligne(s) modifiée(s)</td><td class="n">${gcQ(L.reduce((s, x) => s + x.q, 0))}</td><td colspan="3"></td><td class="n" id="ged-tfa"></td><td class="n" id="ged-tmg"></td></tr></tfoot></table></div>
    <div id="ged-bilan" class="gcmv-formule"></div>
    ${ed ? `<div class="gc-form">${mgtChamp('Motif des modifications *', 'ged-s-motif', '', 'text', 'placeholder="ex. reprise des prix réels selon factures papier 2026"')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" data-gc="enregistrer-prix-reels" onclick="gcedEnregistrerSaisie()">Enregistrer les modifications</button><button class="btn btn-ghost" onclick="nav('gc-prix-reels')">Annuler les saisies</button>
      <button class="btn btn-ghost" onclick="gcmvVerifier('Prix réels', gcedLignes.map(x => x.b.id).filter((v, i, a) => a.indexOf(v) === i))">🔍 Vérifier la marge</button></div>` : ''}`}`;
  L.forEach((x, i) => gcedCalcLigne(i, true)); gcedBilan();
};
window.gcedCalcLigne = (i, init) => {
  const x = window.gcedLignes[i], tr = document.querySelector('.ged-grille tr[data-i="' + i + '"]'); if(!x || !tr) return;
  const pu = GC.num(tr.querySelector('.gs-pu').value), pf = tr.querySelector('.gs-pf'), cuI = tr.querySelector('.gs-cu');
  const cu = cuI ? GC.num(cuI.value) : x.cu, rem = (1 - GC.num(x.l.remise) / 100) * (1 - GC.num(x.b.remise) / 100);
  const fa = pf ? x.q * GC.num(pf.value) * (1 - GC.num(x.fl.remise) / 100) : null, mg = x.q * pu * rem - x.q * cu - x.fraisL;
  tr.querySelector('.gs-fa').textContent = fa === null ? '—' : gcE(GC.r2(fa));
  tr.querySelector('.gs-mg').innerHTML = `<b style="color:${mg < 0 ? 'var(--bad)' : 'inherit'};">${gcE(GC.r2(mg))}</b>`;
  tr.querySelectorAll('input').forEach(e => e.classList.toggle('ged-chg', Math.abs(GC.num(e.value) - GC.num(e.dataset.v)) > 1e-9 || (e.value === '' && e.dataset.v !== '')));
  x.calc = {pu, pf:pf ? GC.num(pf.value) : null, cu, fa, mg};
  if(!init) gcedBilan();
};
function gcedBilan(){
  const L = window.gcedLignes || [], z = document.getElementById('ged-bilan'); if(!z) return;
  const fa = L.reduce((s, x) => s + (x.calc && x.calc.fa !== null ? x.calc.fa : 0), 0), mg = L.reduce((s, x) => s + (x.calc ? x.calc.mg : 0), 0), mg0 = L.reduce((s, x) => s + x.marge, 0);
  const fa0 = L.reduce((s, x) => s + (x.fl ? x.q * GC.num(x.fl.pu) * (1 - GC.num(x.fl.remise) / 100) : 0), 0), n = document.querySelectorAll('.ged-grille tbody tr').length ? Array.from(document.querySelectorAll('.ged-grille tbody tr')).filter(tr => tr.querySelector('.ged-chg')).length : 0;
  document.getElementById('ged-tfa').textContent = gcE(GC.r2(fa)); document.getElementById('ged-tmg').textContent = gcE(GC.r2(mg)); document.getElementById('ged-nb').textContent = n;
  z.innerHTML = `<b>Bilan</b> · facturé HT ${gcE(GC.r2(fa0))} → <b>${gcE(GC.r2(fa))}</b> (${fa - fa0 >= 0 ? '+' : ''}${gcE(GC.r2(fa - fa0))}) · marge ${gcE(GC.r2(mg0))} → <b>${gcE(GC.r2(mg))}</b> (${mg - mg0 >= 0 ? '+' : ''}${gcE(GC.r2(mg - mg0))}) · ${n} ligne(s) modifiée(s)`;
}
window.gcedToutes = (k) => {
  const v = gcVal('ged-all-' + k); if(v === '' || !(GC.num(v) >= 0)){ showToast('Indiquez un prix'); return; }
  document.querySelectorAll('.ged-grille .gs-' + k).forEach(e => { e.value = v; });
  (window.gcedLignes || []).forEach((x, i) => gcedCalcLigne(i, true)); gcedBilan();
};
window.gcedEnregistrerSaisie = () => gcOperation(() => {
  const motif = gcVal('ged-s-motif'); if(!motif){ showToast('Indiquez le motif des modifications'); return; }
  const L = window.gcedLignes || [], ctx = gcCtx(), D = gcD(), F = Object.assign({}, factListe()), parBL = {}, parF = {};
  let n = 0;
  for(const x of L){
    const c = x.calc; if(!c) continue;
    if([c.pu, c.cu].concat(c.pf === null ? [] : [c.pf]).some(v => !(v >= 0))){ showToast('Prix invalide sur ' + x.b.numero); return; }
    const chPu = Math.abs(c.pu - GC.num(x.l.pu)) > 1e-9, chCu = !x.cuReel && Math.abs(c.cu - GC.num(x.l.coutUnitTheorique)) > 1e-9, chPf = x.fl && c.pf !== null && Math.abs(c.pf - GC.num(x.fl.pu)) > 1e-9;
    if(!chPu && !chCu && !chPf) continue;
    n++;
    const bl = parBL[x.b.id] || (parBL[x.b.id] = {b:D.livraisons.find(y => y.id === x.b.id), maj:{}, det:[]});
    if(chPu || chCu) bl.maj[x.l.lid] = {pu:chPu ? c.pu : null, cu:chCu ? c.cu : null};
    if(chPu) bl.det.push((x.l.ref || 'ligne') + ' prix ' + gcE(x.l.pu) + ' → ' + gcE(c.pu)); if(chCu) bl.det.push('coût ' + gcE(x.l.coutUnitTheorique) + ' → ' + gcE(c.cu));
    if(chPf){ const fa = parF[x.f.id] || (parF[x.f.id] = {f:F[x.f.id], idx:{}, det:[]}); const lf = gcedLigneFacture(x.b, x.l); fa.idx[lf.idx] = c.pf; fa.det.push('prix facturé ' + gcE(x.fl.pu) + ' → ' + gcE(c.pf)); }
  }
  if(!n){ showToast('Aucune modification'); return; }
  const majBL = Object.values(parBL).map(({b, maj, det}) => {
    const avant = GC.coutLivraison(b);
    const nb = Object.assign({}, b, {lignes:b.lignes.map(l => { const m = maj[l.lid]; if(!m) return l; const z = Object.assign({}, l);
      if(m.pu !== null) z.pu = m.pu;
      if(m.cu !== null){ z.coutCorrige = {date:ctx.date, par:ctx.par, ancien:GC.num(l.coutUnitTheorique), nouveau:m.cu, source:'Saisie manuelle · ' + motif}; z.coutUnitTheorique = m.cu; z.coutSource = 'Saisie manuelle · ' + motif; }
      return z; })});
    const apres = GC.coutLivraison(nb);
    nb.histoModifs = GC.liste(b.histoModifs).concat([{date:ctx.date, ts:ctx.ts, par:ctx.par, motif, details:det.join(' · '), avant:{ca:avant.ca, marge:avant.marge}, apres:{ca:apres.ca, marge:apres.marge}}]);
    return nb; });
  if(majBL.length) gcEnregistrer('livraisons', majBL);
  Object.values(parF).forEach(({f, idx, det}) => { const nf = Object.assign({}, f, {lignes:GC.liste(f.lignes).map((l, i) => idx[i] !== undefined ? Object.assign({}, l, {pu:idx[i]}) : l)});
    nf.histoModifs = GC.liste(f.histoModifs).concat([{date:ctx.date, ts:ctx.ts, par:ctx.par, motif, details:det.join(' · '), avant:factTotaux(f), apres:factTotaux(nf)}]); gcsfSauverFacture(nf); });
  gcJournal('Saisie des prix réels', 'Livraisons et factures', {id:'', numero:majBL.map(b => b.numero).concat(Object.values(parF).map(x => x.f.numero)).join(', ')}, motif + ' · ' + n + ' ligne(s)');
  showToast(n + ' ligne(s) enregistrée(s) : ' + majBL.length + ' bon(s) de livraison, ' + Object.keys(parF).length + ' facture(s)'); nav('gc-prix-reels');
});

// ---------- Historique des modifications (fiche livraison, fenêtre facture) ----------
function gcedHistoHTML(h){
  return GC.liste(h).length ? `<div class="card" data-gc="historique-modifs"><h3 class="gc-h3">Modifications manuelles</h3>${h.slice().reverse().map(x => `<div class="session-row"><span>${gcDt(x.date)} · ${esc(x.par || '')} · <b>${esc(x.motif || '')}</b><br><span class="gc-sous">${esc(x.details || '')}</span></span>${x.avant && x.apres && x.avant.marge !== undefined ? `<span class="gc-sous" style="white-space:nowrap;">marge ${gcE(x.avant.marge)} → ${gcE(x.apres.marge)}</span>` : ''}</div>`).join('')}</div>` : '';
}

// ---------- Boutons ----------
function gcedBouton(onclick, lib){ return `<button class="btn btn-ghost" data-gc="modifier-doc" onclick="${onclick}">✎ ${lib || 'Modifier'}</button>`; }
const gcedFicheBL = window.renderGcLivraison;
window.renderGcLivraison = function(main){
  gcedFicheBL(main); const b = gcD().livraisons.find(x => x.id === gcOuvert['gc-livraison']); if(!b || b.annulee || !gcPeut()) return;
  const f = b.factureId ? factListe()[b.factureId] : null;
  gcmvAjouterAction(gcedBouton(`gcedFormBL('${b.id}')`, f ? 'Modifier le BL et la facture' : 'Modifier le BL'));
  const body = document.getElementById('gc-body'); if(body) body.insertAdjacentHTML('beforeend', gcedHistoHTML(b.histoModifs) + (f ? gcedHistoHTML(f.histoModifs).replace('Modifications manuelles', 'Modifications manuelles de la facture ' + esc(f.numero)) : ''));
};
const gcedVoirFacture = window.gcsfVoirFacture;
window.gcsfVoirFacture = (fid) => {
  gcedVoirFacture(fid); const f = factListe()[fid]; if(!f) return;
  const ids = GC.liste((f.origine || {}).ids), z = document.querySelector('#mgt-modal-zone .modal-sheet > div:last-child');
  if(z && gcPeut()) z.insertAdjacentHTML('beforeend', ids.length === 1 ? gcedBouton(`gcedFormBL('${ids[0]}')`, 'Modifier la facture et le BL') : gcedBouton(`mgtFermer(); gcedOuvrirSaisie({blIds:${gcAttr(JSON.stringify(ids))}})`, 'Modifier les prix'));
  const sh = document.querySelector('#mgt-modal-zone .modal-sheet'); if(sh && GC.liste(f.histoModifs).length) sh.insertAdjacentHTML('beforeend', gcedHistoHTML(f.histoModifs));
};
const gcedListeFact = window.renderGcFactures;
window.renderGcFactures = function(main){
  gcedListeFact(main); if(!gcPeut()) return;
  gcmvAjouterAction(gcedBouton(`gcedOuvrirSaisie({blIds:gcLignesVisibles('factures').reduce((s, f) => s.concat(GC.liste((f.origine || {}).ids)), [])})`, 'Saisir les prix réels'));
  // bouton par ligne de facture
  document.querySelectorAll('.gct[data-gct="factures"] tbody tr').forEach((tr, i) => { const f = gcLignesVisibles('factures')[(gcTabs.factures.page || 0) * 50 + i], ids = f ? GC.liste((f.origine || {}).ids) : [];
    const td = tr.lastElementChild; if(td && ids.length) td.insertAdjacentHTML('beforeend', `<button class="btn btn-ghost gcsf-petit" title="Modifier" onclick="event.stopPropagation(); ${ids.length === 1 ? `gcedFormBL('${ids[0]}')` : `gcedOuvrirSaisie({blIds:${gcAttr(JSON.stringify(ids))}})`}">✎</button>`); });
};
const gcedListeBL = window.renderGcLivraisons;
window.renderGcLivraisons = function(main){ gcedListeBL(main); if(gcPeut()) gcmvAjouterAction(gcedBouton(`gcedOuvrirSaisie({blIds:gcLignesVisibles('livraisons').filter(b => !b.annulee).map(b => b.id)})`, 'Saisir les prix réels')); };
const gcedFicheCmd = window.renderGcCommande;
window.renderGcCommande = function(main){ gcedFicheCmd(main); const c = gcD().cmdC.find(x => x.id === gcOuvert['gc-commande']); if(c && gcPeut() && gcD().livraisons.some(b => b.cmdId === c.id && !b.annulee)) gcmvAjouterAction(gcedBouton(`gcedOuvrirSaisie({cmd:'${c.id}', client:'${c.clientId}'})`, 'Prix réels des livraisons')); };
const gcedFicheClient = renderGcClient;
renderGcClient = function(main){ gcedFicheClient(main); if(gcPeut()) gcmvAjouterAction(gcedBouton(`gcedOuvrirSaisie({client:'${gcOuvert['gc-client']}'})`, 'Prix réels des livraisons')); };
// dans la fenêtre « Vérifier la marge »
const gcedVerifier = window.gcmvVerifier;
window.gcmvVerifier = (titre, blIds, opts) => {
  gcedVerifier(titre, blIds, opts);
  const z = document.querySelector('#mgt-modal-zone [data-gc="exporter-verif"]');
  if(z && gcPeut() && blIds.length) z.insertAdjacentHTML('afterend', `<button class="btn btn-primary" data-gc="saisir-prix-reels" onclick="mgtFermer(); gcedOuvrirSaisie({blIds:${gcAttr(JSON.stringify(blIds))}})">✎ Saisir les prix réels</button>`);
};
// navigation
GC_FICHES['gc-prix-reels'] = 'gc-factures';
const gcedRenderGC = renderGC;
renderGC = function(tab, main){
  if(tab !== 'gc-prix-reels') return gcedRenderGC(tab, main);
  gcStyle();
  try { window.renderGcPrixReels(main); } catch(e){ console.error('CRM', tab, e); main.innerHTML = `<div class="card"><b>Affichage impossible</b><div class="gc-sous">${esc(e && e.message || String(e))}</div></div>`; }
  const g = gcGroupeDe(tab); if(g) main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets gc-onglets no-print">${g.onglets.map(([t, l]) => `<button class="${t === 'gc-factures' ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
};
const gcedNavParent = gcNavParent;
gcNavParent = function(tab){ return tab === 'gc-prix-reels' ? 'gc-factures' : gcedNavParent(tab); };

// ---------- Styles ----------
(function(){
  const s = document.createElement('style');
  s.textContent = `
  .ged-t input,.ged-grille input{width:110px;min-width:0;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);font-size:13px;text-align:right;}
  .ged-grille input.ged-chg,.ged-t input.ged-chg{border-color:var(--accent);background:var(--accent-bg, #fbeef3);font-weight:700;}
  .ged-grille td{vertical-align:middle;}
  .ged-tout{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;padding:10px 12px;} .ged-tout label{display:flex;gap:6px;align-items:center;}
  .ged-tout input{width:100px;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);}
  .ged-tout .btn{padding:5px 10px;min-height:30px;font-size:12.5px;}
  `;
  document.head.appendChild(s);
})();
