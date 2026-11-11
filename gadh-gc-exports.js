// ============================================================
// GADH — GESTION DES COMMANDES : DOCUMENTS, EXPORTS, RENTABILITÉ
// ============================================================
// Documents : offre, commande client, bon de commande fournisseur, bon de réception,
// bon de livraison → impression (fenêtre) ou PDF (jsPDF, déjà présent dans GTM,
// chargé à la demande et disponible hors ligne).
// États et listes : Excel (ExcelJS, chargé à la demande ; CSV si hors ligne), PDF, impression.
// Coordonnées de la société : paramètres de la Facturation GADH (aucune donnée en dur).

function gcSociete(){
  const P = typeof factParams === 'function' ? factParams('gadh') : {};
  return {raison:P.raison || (SOCIETES.gadh || {}).nom || '', adresse:P.adresse || '', tel:P.tel || '', email:P.email || '', mf:P.mf || '', rib:P.rib || ''};
}
// jsPDF (polices standard) : caractères hors Windows-1252 remplacés.
function gcPdfTxt(s){ return String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/[−–—]/g, '-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[‹›]/g, ''); }
function gcNomFichier(s){ return String(s || 'export').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
let gcPdfPret = null;
function gcChargerPdf(){
  if(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) return Promise.resolve();
  const script = (src) => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Moteur PDF indisponible')); document.head.appendChild(s); });
  if(!gcPdfPret) gcPdfPret = script('./mgt-pdf-jspdf.js').then(() => script('./mgt-pdf-autotable.js')).catch(e => { gcPdfPret = null; throw e; });
  return gcPdfPret;
}

// ============================================================
// DOCUMENTS
// ============================================================
function gcModeleDoc(type, id){
  const D = gcD(), n2 = (x) => gcE(x), q = (x) => gcQ(x);
  if(type === 'offre' || type === 'commande'){
    const d = D[type === 'offre' ? 'offres' : 'cmdC'].find(x => x.id === id); if(!d) return null;
    const c = gcClients()[d.clientId] || {}, t = GC.totaux(d);
    const m = {titre:type === 'offre' ? 'OFFRE COMMERCIALE' : 'BON DE COMMANDE CLIENT', numero:(d.numero || 'Brouillon') + (type === 'offre' && d.version > 1 ? ' (version ' + d.version + ')' : ''), brouillon:d.statut === 'brouillon',
      infos:[['Date', gcDt(d.date)]].concat(type === 'offre' ? [['Valable jusqu\'au', gcDt(d.validite)]] : [['Livraison souhaitée', gcDt(d.dateSouhaitee)], ['Type', d.type === 'annuelle' ? 'Annuelle' : 'Ponctuelle']]).concat(d.referenceClient || d.reference ? [['Votre référence', d.referenceClient || d.reference]] : []),
      tiers:{titre:'Client', nom:c.nom || '', lignes:[c.adresse, c.mf ? 'MF ' + c.mf : '', c.contact, c.tel, c.email].filter(Boolean)},
      tables:[{colonnes:[{t:'Réf.'}, {t:'Désignation'}, {t:'Qté', n:1}, {t:'Unité'}, {t:'P.U. HT', n:1}, {t:'Remise', n:1}, {t:'Montant HT', n:1}],
        lignes:GC.liste(d.lignes).map(l => [l.ref || '', l.designation || '', q(l.qte), l.unite || '', n2(l.pu), l.remise ? gcPct(l.remise) : '', n2(GC.montantLigne(l))])}],
      totaux:[['Total HT brut', n2(t.brut)]].concat(t.remises ? [['Remises', '- ' + n2(t.remises)]] : []).concat([['Total HT', n2(t.ht)], ['TVA ' + gcPct(d.tva), n2(t.tva)], ['Total TTC', n2(t.ttc), 1]]),
      notes:[d.conditions ? (type === 'offre' ? 'Conditions commerciales : ' : 'Conditions de paiement : ') + d.conditions : '', d.commentaires || ''].filter(Boolean), signature:type === 'offre' ? ['Bon pour accord (date, cachet, signature)'] : null};
    if(type === 'commande' && d.type === 'annuelle' && GC.liste(d.echeances).length){
      const se = GC.suiviEcheances(d, GC.livres(D), getTodayISO());
      m.tables.push({titre:'Calendrier prévisionnel de livraison', colonnes:[{t:'Échéance'}, {t:'Prévu', n:1}, {t:'Livré', n:1}, {t:'Reste', n:1}], lignes:se.map(e => [gcDt(e.date), q(e.prevu), q(e.livre), q(e.reste)])});
    }
    return m;
  }
  if(type === 'achat'){
    const d = D.cmdF.find(x => x.id === id); if(!d) return null;
    const f = D.fournisseurs.find(x => x.id === d.fournisseurId) || {}, t = gcTotauxCF(d);
    return {titre:'BON DE COMMANDE FOURNISSEUR', numero:d.numero || 'Brouillon', brouillon:d.statut === 'brouillon',
      infos:[['Date', gcDt(d.date)], ['Livraison souhaitée', gcDt(d.datePrevue)]].concat(d.reference ? [['Votre référence', d.reference]] : []),
      tiers:{titre:'Fournisseur', nom:f.nom || '', lignes:[f.adresse, f.mf ? 'MF ' + f.mf : '', f.contact, f.tel, f.email].filter(Boolean)},
      tables:[{colonnes:[{t:'Réf.'}, {t:'Réf. fournisseur'}, {t:'Désignation'}, {t:'Qté', n:1}, {t:'Unité'}, {t:'P.U. HT', n:1}, {t:'Montant HT', n:1}],
        lignes:GC.liste(d.lignes).map(l => [l.ref || '', l.refFournisseur || '', l.designation || '', q(l.qte), l.unite || '', n2(l.pu), n2(GC.num(l.qte) * GC.num(l.pu))])}],
      totaux:[['Total HT', n2(t.ht)], ['TVA ' + gcPct(d.tva), n2(t.tva)]].concat(t.frais ? [['Frais', n2(t.frais)]] : []).concat(t.timbre ? [['Timbre', n2(t.timbre)]] : []).concat([['Total TTC', n2(t.ttc), 1]]),
      notes:[f.conditions ? 'Conditions de paiement : ' + f.conditions : '', d.note || ''].filter(Boolean), signature:['Pour ' + gcSociete().raison]};
  }
  if(type === 'reception'){
    const r = D.receptions.find(x => x.id === id); if(!r) return null;
    const f = D.fournisseurs.find(x => x.id === r.fournisseurId) || {}, cf = D.cmdF.find(x => x.id === r.cfId) || {}, F = GC.fraisReception(r);
    const val = GC.liste(r.lignes).reduce((s, l) => s + GC.num(l.qte) * GC.num(l.pu), 0);
    return {titre:'BON DE RÉCEPTION', numero:r.numero, annule:!!r.annulee,
      infos:[['Date de réception', gcDt(r.date)], ['Commande', cf.numero || ''], ['BL fournisseur', r.reference || '—'], ['Réceptionné par', r.par || '']],
      tiers:{titre:'Fournisseur', nom:f.nom || '', lignes:[f.adresse, f.tel].filter(Boolean)},
      tables:[{colonnes:[{t:'Désignation'}, {t:'Qté reçue', n:1}, {t:'Unité'}, {t:'Lot'}, {t:'Prix HT', n:1}, {t:'Frais / u', n:1}, {t:'Coût réel / u', n:1}],
        lignes:GC.liste(r.lignes).map((l, i) => [l.designation || '', q(l.qte), l.unite || '', l.lot || r.numero, n2(l.pu), n2(F.parLigne[i]), n2(GC.num(l.pu) + F.parLigne[i])])}].concat(GC.liste(r.frais).length ? [{titre:'Frais de la réception', colonnes:[{t:'Libellé'}, {t:'Répartition'}, {t:'Statut'}, {t:'Montant', n:1}],
        lignes:r.frais.map(x => [x.libelle, x.methode === 'valeur' ? 'Au prorata de la valeur' : 'Au prorata des quantités', x.statut === 'estime' ? 'Estimé' : 'Réel', n2(x.montant)])}] : []),
      totaux:[['Valeur HT reçue', n2(val)], ['Frais', n2(F.total)], ['Coût réel total', n2(val + F.total), 1]], notes:[r.note || ''].filter(Boolean), signature:['Réceptionné par', 'Contrôlé par']};
  }
  if(type === 'livraison'){
    const b = D.livraisons.find(x => x.id === id); if(!b) return null;
    const c = gcClients()[b.clientId] || {}, cmd = D.cmdC.find(x => x.id === b.cmdId) || {}, L = {};
    GC.lots(D).forEach(l => { L[l.id] = l; });
    // Quantités livrées avant ce bon (livraisons antérieures non annulées).
    const avant = {};
    D.livraisons.filter(x => x.cmdId === b.cmdId && !x.annulee && x.id !== b.id && ((x.date || '') < (b.date || '') || ((x.date || '') === (b.date || '') && GC.num(x.ts) < GC.num(b.ts)))).forEach(x => GC.liste(x.lignes).forEach(l => { avant[l.lid] = (avant[l.lid] || 0) + GC.qteNetteLigne(l); }));
    return {titre:'BON DE LIVRAISON', numero:b.numero, annule:!!b.annulee,
      infos:[['Date de livraison', gcDt(b.date)], ['Commande', cmd.numero || b.cmdNumero || ''], ['Votre référence', cmd.reference || '—']].concat(b.reference ? [['Document associé', b.reference]] : []),
      tiers:{titre:'Client', nom:c.nom || '', lignes:[c.adresse, c.mf ? 'MF ' + c.mf : '', c.contact, c.tel].filter(Boolean)},
      tables:[{colonnes:[{t:'Réf.'}, {t:'Désignation'}, {t:'Commandé', n:1}, {t:'Déjà livré', n:1}, {t:'Livré ce jour', n:1}, {t:'Reste à livrer', n:1}, {t:'Unité'}, {t:'Lots'}],
        lignes:GC.liste(b.lignes).map(l => { const cl = GC.liste(cmd.lignes).find(x => x.lid === l.lid) || {}, av = avant[l.lid] || 0, net = GC.qteNetteLigne(l);
          return [l.ref || '', l.designation || '', q(cl.qte || l.qte), q(av), q(net), q(Math.max(0, GC.num(cl.qte) - av - net)), l.unite || '', GC.liste(l.allocations).map(a => (a.code || (L[a.lotId] || {}).code || '') + ' (' + q(a.qte) + ')').join(', ')]; })}],
      totaux:[], notes:[b.note || ''].filter(Boolean), signature:['Livré par', 'Reçu par le client (date, nom, signature)']};
  }
  return null;
}
function gcDocHTML(m){
  const S = gcSociete();
  const style = `body{font:12px Arial,sans-serif;color:#111;margin:26px;} h1{font-size:19px;margin:0 0 4px;} .top{display:flex;justify-content:space-between;gap:20px;margin-bottom:18px;}
    .box{border:1px solid #999;padding:9px 10px;border-radius:4px;min-width:220px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border:1px solid #999;padding:5px 6px;vertical-align:top;}
    th{background:#eee;text-align:left;} td.n,th.n{text-align:right;white-space:nowrap;} .tot{width:300px;margin-left:auto;} .tot td{border:none;padding:3px 6px;} .tot tr.g td{font-weight:bold;font-size:13.5px;border-top:1px solid #111;}
    .notes{margin-top:14px;white-space:pre-line;} .sig{display:flex;gap:20px;margin-top:30px;} .sig div{flex:1;border:1px solid #999;height:70px;padding:6px;font-size:11px;color:#444;}
    .pied{margin-top:26px;font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:6px;} h3{font-size:13px;margin:16px 0 0;}
    .fil{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:84px;color:rgba(200,0,0,.12);transform:rotate(-25deg);pointer-events:none;} @media print{body{margin:12mm;}}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(m.titre + ' ' + m.numero)}</title><style>${style}</style></head><body>
    ${m.brouillon ? '<div class="fil">BROUILLON</div>' : m.annule ? '<div class="fil">ANNULÉ</div>' : ''}
    <div class="top"><div>${typeof logoDocHTML === 'function' ? logoDocHTML('gadh') : ''}<h1>${esc(S.raison)}</h1><div>${esc(S.adresse).replace(/\n/g, '<br>')}</div><div>${S.tel ? 'Tél. ' + esc(S.tel) : ''}${S.email ? ' · ' + esc(S.email) : ''}</div>${S.mf ? `<div>MF ${esc(S.mf)}</div>` : ''}</div>
      <div class="box"><b>${esc(m.titre)}</b><br>N° ${esc(m.numero)}${m.infos.map(([k, v]) => `<br>${esc(k)} : ${esc(v)}`).join('')}</div></div>
    <div class="box" style="margin-left:auto;width:45%;"><span style="font-size:10.5px;color:#555;">${esc(m.tiers.titre)}</span><br><b>${esc(m.tiers.nom)}</b>${m.tiers.lignes.map(l => '<br>' + esc(l)).join('')}</div>
    ${m.tables.map(t => `${t.titre ? `<h3>${esc(t.titre)}</h3>` : ''}<table><thead><tr>${t.colonnes.map(c => `<th class="${c.n ? 'n' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${t.lignes.map(r => `<tr>${r.map((v, i) => `<td class="${t.colonnes[i].n ? 'n' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}
    ${m.totaux.length ? `<table class="tot">${m.totaux.map(([k, v, g]) => `<tr class="${g ? 'g' : ''}"><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>`).join('')}</table>` : ''}
    ${m.notes.length ? `<div class="notes">${m.notes.map(esc).join('\n\n')}</div>` : ''}
    ${m.signature ? `<div class="sig">${m.signature.map(s => `<div>${esc(s)}</div>`).join('')}</div>` : ''}
    <div class="pied">${esc(S.raison)}${S.mf ? ' · MF ' + esc(S.mf) : ''}${S.rib ? ' · RIB ' + esc(S.rib) : ''} · édité le ${esc(gcHeure(Date.now()))}</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
}
function gcImprimerHTML(html){
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour imprimer'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
function gcEntetePdf(doc, titre, sous){
  const S = gcSociete(), W = doc.internal.pageSize.getWidth();
  let y = 14;
  const logo = typeof logoDocSrc === 'function' ? logoDocSrc('gadh') : '';
  if(logo && logo.indexOf('data:image') === 0){ try { doc.addImage(logo, logo.indexOf('png') > 0 ? 'PNG' : 'JPEG', 14, 8, 30, 14); y = 27; } catch(e) {} }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(gcPdfTxt(S.raison), 14, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const coord = [S.adresse.replace(/\n/g, ', '), [S.tel ? 'Tél. ' + S.tel : '', S.email].filter(Boolean).join(' · '), S.mf ? 'MF ' + S.mf : ''].filter(Boolean);
  coord.forEach((l, i) => doc.text(gcPdfTxt(l), 14, y + 5 + i * 4));
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(gcPdfTxt(titre), W - 14, 15, {align:'right'});
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  (sous || []).forEach((l, i) => doc.text(gcPdfTxt(l), W - 14, 21 + i * 4.5, {align:'right'}));
  return Math.max(y + 7 + coord.length * 4, 22 + (sous || []).length * 4.5) + 2;
}
function gcPiedPdf(doc){
  const n = doc.getNumberOfPages(), S = gcSociete(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for(let i = 1; i <= n; i++){ doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(gcPdfTxt(S.raison + ' · édité le ' + gcHeure(Date.now())), 14, H - 7); doc.text('Page ' + i + ' / ' + n, W - 14, H - 7, {align:'right'}); doc.setTextColor(0); }
}
function gcDocPdf(m){
  const doc = new window.jspdf.jsPDF({unit:'mm', format:'a4'}), W = doc.internal.pageSize.getWidth();
  let y = gcEntetePdf(doc, m.titre, ['N° ' + m.numero].concat(m.infos.map(([k, v]) => k + ' : ' + v)));
  doc.setDrawColor(150); doc.roundedRect(W / 2, y, W / 2 - 14, 8 + m.tiers.lignes.length * 4.2, 1.5, 1.5);
  doc.setFontSize(7.5); doc.setTextColor(90); doc.text(gcPdfTxt(m.tiers.titre), W / 2 + 3, y + 4); doc.setTextColor(0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(gcPdfTxt(m.tiers.nom), W / 2 + 3, y + 8.5); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  m.tiers.lignes.forEach((l, i) => doc.text(gcPdfTxt(l).slice(0, 70), W / 2 + 3, y + 12.5 + i * 4.2));
  y += 14 + m.tiers.lignes.length * 4.2;
  if(m.brouillon || m.annule){ doc.setTextColor(200, 0, 0); doc.setFontSize(10); doc.text(m.brouillon ? 'BROUILLON' : 'ANNULÉ', 14, y - 4); doc.setTextColor(0); }
  m.tables.forEach(t => {
    if(t.titre){ doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(gcPdfTxt(t.titre), 14, y + 4); doc.setFont('helvetica', 'normal'); y += 6; }
    const styles = {}; t.colonnes.forEach((c, i) => { if(c.n) styles[i] = {halign:'right'}; });
    doc.autoTable({startY:y, head:[t.colonnes.map(c => gcPdfTxt(c.t))], body:t.lignes.map(r => r.map(gcPdfTxt)), theme:'grid', styles:{fontSize:8.5, cellPadding:1.6}, headStyles:{fillColor:[230, 230, 230], textColor:20}, columnStyles:styles, margin:{left:14, right:14}});
    y = doc.lastAutoTable.finalY + 4;
  });
  if(m.totaux.length){
    doc.autoTable({startY:y, body:m.totaux.map(([k, v]) => [gcPdfTxt(k), gcPdfTxt(v)]), theme:'plain', styles:{fontSize:9, cellPadding:1.2}, columnStyles:{1:{halign:'right'}}, margin:{left:W - 14 - 80, right:14}, tableWidth:80,
      didParseCell:(h) => { if(m.totaux[h.row.index] && m.totaux[h.row.index][2]) h.cell.styles.fontStyle = 'bold'; }});
    y = doc.lastAutoTable.finalY + 4;
  }
  doc.setFontSize(8.5);
  m.notes.forEach(n => { const l = doc.splitTextToSize(gcPdfTxt(n), W - 28); if(y + l.length * 4 > 280){ doc.addPage(); y = 16; } doc.text(l, 14, y + 3); y += l.length * 4 + 2; });
  if(m.signature){ if(y + 30 > 285){ doc.addPage(); y = 16; } const w = (W - 28 - (m.signature.length - 1) * 6) / m.signature.length; m.signature.forEach((s, i) => { doc.rect(14 + i * (w + 6), y + 4, w, 24); doc.setFontSize(7.5); doc.text(gcPdfTxt(s), 16 + i * (w + 6), y + 8); }); }
  gcPiedPdf(doc);
  doc.save(gcNomFichier(m.titre.toLowerCase() + '-' + m.numero) + '.pdf');
}
window.gcDocument = async (type, id, format) => {
  const m = gcModeleDoc(type, id); if(!m){ showToast('Document introuvable'); return; }
  if(format === 'print'){ gcImprimerHTML(gcDocHTML(m)); return; }
  try { await gcChargerPdf(); gcDocPdf(m); showToast('PDF enregistré'); }
  catch(e){ console.error('PDF', e); showToast('PDF impossible : ' + (e.message || e)); }
};

// ============================================================
// ÉTATS ET LISTES : EXCEL, PDF, IMPRESSION
// ============================================================
// Type de colonne : t = texte, e = euros, q = quantité, p = pourcentage, d = date (AAAA-MM-JJ)
function gcDefExports(){
  const D = gcD(), S = GC.stocks(D), A = GC.parId(D.articles), liv = GC.livres(D), rec = GC.recus(D), auj = getTodayISO(), R = GC.parId(D.receptions);
  return {
    catalogue:{titre:'Catalogue des articles', cols:[['Référence', a => a.ref, 't'], ['Désignation', a => a.designation, 't'], ['Catégorie', a => a.categorie, 't'], ['Unité', a => a.unite, 't'], ['Description', a => a.description, 't'],
      ['Fournisseur principal', a => a.fournisseurId ? gcNomFour(a.fournisseurId) : '', 't'], ['Prix d\'achat', a => GC.num(a.prixAchat), 'e'], ['Prix de vente', a => GC.num(a.prixVente), 'e'],
      ['Paliers', a => GC.liste(a.paliers).map(p => '>= ' + p.min + ' : ' + p.prix).join(' ; '), 't'], ['Seuil', a => GC.num(a.seuil), 'q'], ['Disponible', a => GC.suiviStock(a) ? (S[a.id] || {}).disponible || 0 : '', 'q'],
      ['Statut', a => a.archive ? 'Archivé' : a.actif === false ? 'Inactif' : 'Actif', 't']]},
    tarifs:{titre:'Tarifs fournisseurs', cols:[['Article', t => gcLibArticle(A[t.articleId]), 't'], ['Fournisseur', t => gcNomFour(t.fournisseurId), 't'], ['Réf. fournisseur', t => t.refFournisseur, 't'], ['À partir de', t => GC.num(t.qteMin), 'q'],
      ['Prix', t => GC.num(t.prix), 'e'], ['Valable du', t => t.debut || '', 'd'], ['Valable au', t => t.fin || '', 'd'], ['Délai (j)', t => GC.num(t.delai), 'q']]},
    fournisseurs:{titre:'Fournisseurs', cols:[['Nom', f => f.nom, 't'], ['Contact', f => f.contact, 't'], ['Téléphone', f => f.tel, 't'], ['E-mail', f => f.email, 't'], ['Adresse', f => f.adresse, 't'], ['MF', f => f.mf, 't'],
      ['Conditions de paiement', f => f.conditions, 't'], ['Délai (j)', f => GC.num(f.delai), 'q'], ['Reste à payer', f => gcStatsFournisseur(D, f.id).reste, 'e']]},
    clients:{titre:'Clients', cols:[['Nom', c => c.nom, 't'], ['MF', c => c.mf, 't'], ['Contact', c => c.contact, 't'], ['Téléphone', c => c.tel, 't'], ['E-mail', c => c.email, 't'], ['Adresse', c => c.adresse, 't'], ['Conditions', c => c.conditions, 't']]},
    stock:{titre:'État du stock', cols:[['Référence', a => a.ref, 't'], ['Désignation', a => a.designation, 't'], ['Unité', a => a.unite, 't'], ['Physique', a => (S[a.id] || {}).physique || 0, 'q'], ['Réservé', a => (S[a.id] || {}).reserve || 0, 'q'],
      ['Disponible', a => (S[a.id] || {}).disponible || 0, 'q'], ['En attente', a => (S[a.id] || {}).attente || 0, 'q'], ['À approvisionner', a => (S[a.id] || {}).aApprovisionner || 0, 'q'], ['Seuil', a => GC.num(a.seuil), 'q'],
      ['Valeur (coût réel)', a => (S[a.id] || {}).valeur || 0, 'e'], ['État', a => gcEtatStock(a, S[a.id] || {}).label, 't']], somme:['Valeur (coût réel)']},
    lots:{titre:'Lots en stock (FIFO)', cols:[['Lot', l => l.code || l.id, 't'], ['Article', l => gcLibArticle(A[l.articleId]), 't'], ['Date d\'entrée', l => l.date, 'd'], ['Origine', l => GC.TYPES_MV[l.type].label + (R[l.receptionId] ? ' ' + R[l.receptionId].numero : ''), 't'],
      ['Qté initiale', l => l.qteInit, 'q'], ['Reste', l => l.reste, 'q'], ['Prix d\'achat', l => l.coutUnit, 'e'], ['Frais / unité', l => l.fraisUnit, 'e'], ['Coût réel', l => l.coutComplet, 'e'], ['Valeur restante', l => l.reste * l.coutComplet, 'e']], somme:['Valeur restante']},
    mouvements:{titre:'Mouvements de stock', cols:[['Date', m => m.date, 'd'], ['Type', m => GC.TYPES_MV[m.type] ? GC.TYPES_MV[m.type].label : m.type, 't'], ['Article', m => gcLibArticle(A[m.articleId]), 't'],
      ['Quantité', m => GC.num(m.qte) * ((GC.TYPES_MV[m.type] || {}).sens || 0) || GC.num(m.qte), 'q'], ['Lot', m => m.lotId || m.lot || '', 't'], ['Motif', m => m.motif, 't'], ['Par', m => m.par, 't']]},
    journal:{titre:'Journal des opérations', cols:[['Date et heure', j => gcHeure(j.ts), 't'], ['Utilisateur', j => j.par, 't'], ['Action', j => j.action, 't'], ['Objet', j => j.objet, 't'], ['N° / nom', j => j.numero, 't'], ['Détails', j => j.details, 't']]},
    demandes:{titre:'Demandes de prix', cols:[['N°', x => x.numero, 't'], ['Date', x => x.date, 'd'], ['Client', x => gcNomClient(x.clientId), 't'], ['Fichier', x => (x.fichier || {}).nom || '', 't'], ['Lignes', x => GC.liste(x.lignes).length, 'q'], ['Offre', x => x.offreNumero || '', 't']]},
    offres:{titre:'Offres commerciales', cols:[['N°', o => o.numero + (o.version > 1 ? ' v' + o.version : ''), 't'], ['Date', o => o.date, 'd'], ['Client', o => gcNomClient(o.clientId), 't'], ['Validité', o => o.validite, 'd'],
      ['Total HT', o => GC.totaux(o).ht, 'e'], ['Total TTC', o => GC.totaux(o).ttc, 'e'], ['Statut', o => GC.statutOffre(o, auj).label, 't']], somme:['Total HT', 'Total TTC']},
    commandes:{titre:'Commandes clients', cols:[['N°', c => c.numero, 't'], ['Date', c => c.date, 'd'], ['Client', c => gcNomClient(c.clientId), 't'], ['Type', c => c.type === 'annuelle' ? 'Annuelle' : 'Ponctuelle', 't'], ['Livraison souhaitée', c => c.dateSouhaitee, 'd'],
      ['Total HT', c => GC.totaux(c).ht, 'e'], ['Reste à livrer (qté)', c => GC.liste(c.lignes).reduce((s, l) => s + Math.max(0, GC.num(l.qte) - (liv[GC.cleLigne(c.id, l.lid)] || 0)), 0), 'q'],
      ['Statut', c => GC.statutCmdC(c, liv).label, 't'], ['Retard', c => GC.retardCmdC(c, liv, auj) ? 'Oui' : '', 't']], somme:['Total HT']},
    livraisons:{titre:'Livraisons', cols:[['N°', b => b.numero, 't'], ['Date', b => b.date, 'd'], ['Client', b => gcNomClient(b.clientId), 't'], ['Commande', b => b.cmdNumero, 't'], ['CA HT', b => GC.coutLivraison(b).ca, 'e'],
      ['Coût réel', b => GC.coutLivraison(b).cout, 'e'], ['Marge', b => GC.coutLivraison(b).marge, 'e'], ['Taux de marque', b => GC.coutLivraison(b).tauxMarque, 'p'], ['Facture', b => b.annulee ? 'Annulée' : gcFactureDe(b) ? gcFactureDe(b).def.label : 'À facturer', 't']], somme:['CA HT', 'Coût réel', 'Marge']},
    achats:{titre:'Commandes fournisseurs', cols:[['N°', f => f.numero, 't'], ['Date', f => f.date, 'd'], ['Fournisseur', f => gcNomFour(f.fournisseurId), 't'], ['Livraison prévue', f => f.datePrevue, 'd'], ['Total TTC', f => gcTotauxCF(f).ttc, 'e'],
      ['Reste à payer', f => gcTotauxCF(f).reste, 'e'], ['Statut', f => GC.statutCmdF(f, rec).label, 't'], ['Retard', f => GC.enRetardCmdF(f, rec, auj) ? 'Oui' : '', 't']], somme:['Total TTC', 'Reste à payer']},
    receptions:{titre:'Réceptions', cols:[['N°', r => r.numero, 't'], ['Date', r => r.date, 'd'], ['Fournisseur', r => gcNomFour(r.fournisseurId), 't'], ['BL fournisseur', r => r.reference, 't'],
      ['Valeur HT', r => GC.liste(r.lignes).reduce((s, l) => s + GC.num(l.qte) * GC.num(l.pu), 0), 'e'], ['Frais', r => GC.fraisReception(r).total, 'e'], ['État', r => r.annulee ? 'Annulée' : 'Valide', 't']], somme:['Valeur HT', 'Frais']}
  };
}
function gcModeleListe(cle){
  const D = gcD(), auj = getTodayISO();
  if(cle === 'besoins'){
    const B = GC.besoins(D, auj, {delaiDefaut:D.reglages.delaiDefaut});
    return {titre:'Besoins d\'approvisionnement', sous:'Calcul du ' + gcDt(auj), colonnes:[['Article', 't'], ['Besoin', 'q'], ['Réservé', 'q'], ['Stock', 'q'], ['Attendu', 'q'], ['Manquant', 'q'], ['Seuil', 'q'], ['À commander', 'q'], ['Fournisseur', 't'], ['Date de besoin', 'd'], ['Commander avant', 'd'], ['État', 't']],
      lignes:B.articles.map(x => [(x.ref ? x.ref + ' · ' : '') + x.designation, x.besoin, x.couvertReserve, x.couvertStock, x.couvertAttente, x.manquant, x.reappro, x.aCommander, gcNomFour(x.fournisseurId), x.dateBesoin, x.dateCommande, GC_URGENCES[x.urgence].label])};
  }
  if(cle === 'rentabilite'){
    const F = gcFiltresRenta, RT = GC.rentabilite(D, F), V = GC_VUES_RENTA[F.vue];
    const lignes = RT[V.cle].map(x => [V.lib(x), x.nb, x.qte, x.ca, x.achat, x.fraisLots, x.fraisLivraison, x.cout, x.marge, x.tauxMarque, x.tauxMarge, x.coutUnitaire, x.provisoire ? 'Provisoire' : '']);
    const t = RT.total;
    return {titre:'Rentabilité ' + V.titre.toLowerCase(), sous:gcSousFiltresRenta(F), colonnes:[[V.titre.replace(/^par /i, ''), 't'], ['Livraisons', 'q'], ['Qté livrée', 'q'], ['CA HT', 'e'], ['Achat réel', 'e'], ['Frais réceptions', 'e'], ['Frais livraisons', 'e'], ['Coût réel', 'e'], ['Marge brute', 'e'], ['Taux de marque', 'p'], ['Taux de marge', 'p'], ['Coût unitaire', 'e'], ['Statut', 't']],
      lignes, total:['Total', t.nb, t.qte, t.ca, t.achat, t.fraisLots, t.fraisLivraison, t.cout, t.marge, t.tauxMarque, t.tauxMarge, '', t.provisoire ? 'Provisoire' : '']};
  }
  const def = gcDefExports()[cle]; if(!def) return null;
  let src = gcLignesVisibles(cle);
  if(!src.length && !gcTabsCfg[cle]) src = cle === 'clients' ? Object.entries(gcClients()).map(([id, c]) => Object.assign({id}, c)) : cle === 'journal' ? gcListe('journal') : (D[{catalogue:'articles', stock:'articles', lots:'', commandes:'cmdC', achats:'cmdF'}[cle] || cle] || []);
  const st = gcTabs[cle], cfg = gcTabsCfg[cle];
  const filtres = cfg && st ? (cfg.filtres || []).filter(f => st.f[f.id]).map(f => f.label + ' : ' + ((f.options.find(o => String(o[0]) === String(st.f[f.id])) || [])[1] || st.f[f.id])).concat(st.q ? ['Recherche : « ' + st.q + ' »'] : []) : [];
  const m = {titre:def.titre, sous:'Édité le ' + gcDt(auj) + (filtres.length ? ' · ' + filtres.join(' · ') : ''), colonnes:def.cols.map(c => [c[0], c[2]]), lignes:src.map(x => def.cols.map(c => { const v = c[1](x); return v === undefined || v === null ? '' : v; }))};
  if(def.somme) m.total = def.cols.map((c, i) => i === 0 ? 'Total' : def.somme.indexOf(c[0]) >= 0 ? m.lignes.reduce((s, r) => s + GC.num(r[i]), 0) : '');
  return m;
}
function gcFmtCellule(v, t){
  if(v === '' || v === null || v === undefined) return '';
  if(t === 'e') return gcE(v); if(t === 'q') return gcQ(v); if(t === 'p') return gcPct(v); if(t === 'd') return gcDt(v);
  return String(v);
}
async function gcExcel(m){
  try { await chargerBib('exceljs'); }
  catch(e){
    // Hors ligne : CSV (s'ouvre dans Excel).
    const lignes = [m.colonnes.map(c => c[0])].concat(m.lignes).concat(m.total ? [m.total] : []);
    gcTelecharger(gcNomFichier(m.titre) + '.csv', '﻿' + lignes.map(r => r.map(v => { const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
    showToast('Excel indisponible hors ligne : export CSV'); return;
  }
  const wb = new ExcelJS.Workbook(); wb.creator = 'GTM GROUPE'; wb.created = new Date();
  const ws = wb.addWorksheet(m.titre.slice(0, 31).replace(/[\\/?*\[\]:]/g, ' '), {views:[{state:'frozen', ySplit:4}]});
  const S = gcSociete(), n = m.colonnes.length;
  ws.mergeCells(1, 1, 1, n); ws.getCell(1, 1).value = S.raison + ' · ' + m.titre; ws.getCell(1, 1).font = {bold:true, size:14, color:{argb:'FF9C335B'}};
  ws.mergeCells(2, 1, 2, n); ws.getCell(2, 1).value = m.sous || ''; ws.getCell(2, 1).font = {italic:true, size:9, color:{argb:'FF555555'}};
  const h = ws.getRow(4); m.colonnes.forEach((c, i) => { const x = h.getCell(i + 1); x.value = c[0]; x.font = {bold:true, color:{argb:'FFFFFFFF'}}; x.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF138C94'}}; x.alignment = {vertical:'middle', wrapText:true, horizontal:c[1] === 't' || c[1] === 'd' ? 'left' : 'right'}; });
  h.height = 22;
  const FMT = {e:'#,##0.00 "€"', q:'#,##0.###', p:'0.0" %"', d:'dd/mm/yyyy'};
  const ecrire = (r, vals, gras) => { vals.forEach((v, i) => { const t = m.colonnes[i][1], x = r.getCell(i + 1);
    if(t === 'd' && v){ const p = String(v).split('-'); x.value = p.length === 3 ? new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])) : v; } else x.value = (t !== 't' && t !== 'd' && v !== '' && v !== null && !isNaN(Number(v))) ? Number(v) : (v === null || v === undefined ? '' : v);
    if(FMT[t]) x.numFmt = FMT[t]; if(gras) x.font = {bold:true}; x.border = {bottom:{style:'hair', color:{argb:'FFDDDDDD'}}}; }); };
  m.lignes.forEach((l, i) => { const r = ws.getRow(5 + i); ecrire(r, l); if(i % 2) r.eachCell(c => { c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF6F8FA'}}; }); });
  if(m.total){ const r = ws.getRow(5 + m.lignes.length); ecrire(r, m.total, true); r.eachCell(c => { c.border = {top:{style:'thin'}}; }); }
  ws.autoFilter = {from:{row:4, column:1}, to:{row:4 + Math.max(1, m.lignes.length), column:n}};
  m.colonnes.forEach((c, i) => { const larg = Math.max(String(c[0]).length, ...m.lignes.slice(0, 200).map(l => gcFmtCellule(l[i], c[1]).length)); ws.getColumn(i + 1).width = Math.min(48, Math.max(9, larg + 2)); });
  ws.pageSetup = {orientation:n > 7 ? 'landscape' : 'portrait', fitToPage:true, fitToWidth:1, fitToHeight:0};
  const buf = await wb.xlsx.writeBuffer();
  gcTelecharger(gcNomFichier(m.titre) + '-' + getTodayISO() + '.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  showToast('Fichier Excel enregistré');
}
function gcListePdf(m){
  const doc = new window.jspdf.jsPDF({unit:'mm', format:'a4', orientation:m.colonnes.length > 6 ? 'landscape' : 'portrait'});
  const y = gcEntetePdf(doc, m.titre, [m.sous || '']);
  const styles = {}; m.colonnes.forEach((c, i) => { if(c[1] !== 't' && c[1] !== 'd') styles[i] = {halign:'right'}; });
  doc.autoTable({startY:y, head:[m.colonnes.map(c => gcPdfTxt(c[0]))], body:m.lignes.map(l => l.map((v, i) => gcPdfTxt(gcFmtCellule(v, m.colonnes[i][1])))),
    foot:m.total ? [m.total.map((v, i) => gcPdfTxt(gcFmtCellule(v, m.colonnes[i][1])))] : undefined, theme:'striped', styles:{fontSize:7.5, cellPadding:1.4}, headStyles:{fillColor:[19, 140, 148]}, footStyles:{fillColor:[235, 235, 235], textColor:20, fontStyle:'bold'},
    columnStyles:styles, margin:{left:12, right:12, bottom:14}});
  gcPiedPdf(doc);
  doc.save(gcNomFichier(m.titre) + '-' + getTodayISO() + '.pdf');
}
function gcListeHTML(m){
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(m.titre)}</title><style>body{font:11px Arial,sans-serif;margin:20px;color:#111;} h1{font-size:16px;margin:0;} .s{color:#555;margin:2px 0 10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #bbb;padding:4px 5px;} th{background:#eee;text-align:left;} td.n,th.n{text-align:right;white-space:nowrap;} tfoot td{font-weight:bold;background:#f3f3f3;} @media print{body{margin:10mm;}}</style></head><body>
    <h1>${esc(gcSociete().raison)} · ${esc(m.titre)}</h1><div class="s">${esc(m.sous || '')}</div>
    <table><thead><tr>${m.colonnes.map(c => `<th class="${c[1] !== 't' && c[1] !== 'd' ? 'n' : ''}">${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${m.lignes.map(l => `<tr>${l.map((v, i) => `<td class="${m.colonnes[i][1] !== 't' && m.colonnes[i][1] !== 'd' ? 'n' : ''}">${esc(gcFmtCellule(v, m.colonnes[i][1]))}</td>`).join('')}</tr>`).join('')}</tbody>
    ${m.total ? `<tfoot><tr>${m.total.map((v, i) => `<td class="${m.colonnes[i][1] !== 't' && m.colonnes[i][1] !== 'd' ? 'n' : ''}">${esc(gcFmtCellule(v, m.colonnes[i][1]))}</td>`).join('')}</tr></tfoot>` : ''}</table>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
}
window.gcExporter = async (cle, format) => {
  const m = gcModeleListe(cle); if(!m){ showToast('Export indisponible'); return; }
  if(!m.lignes.length){ showToast('Rien à exporter avec ces filtres'); return; }
  try {
    if(format === 'xlsx') await gcExcel(m);
    else if(format === 'pdf'){ await gcChargerPdf(); gcListePdf(m); showToast('PDF enregistré'); }
    else gcImprimerHTML(gcListeHTML(m));
  } catch(e){ console.error('Export', e); showToast('Export impossible : ' + (e.message || e)); }
};

// ============================================================
// RENTABILITÉ
// ============================================================
const GC_VUES_RENTA = {
  livraison:{titre:'Par livraison', cle:'parLivraison', lib:x => x.libelle + ' · ' + gcDt(x.date) + ' · ' + gcNomClient(x.clientId), clic:x => `gcOuvrir('gc-livraison', '${x.cle}')`},
  commande:{titre:'Par commande', cle:'parCommande', lib:x => (x.libelle || '—') + ' · ' + gcNomClient(x.clientId), clic:x => `gcOuvrir('gc-commande', '${x.cle}')`},
  client:{titre:'Par client', cle:'parClient', lib:x => gcNomClient(x.cle), clic:x => `gcOuvrir('gc-client', '${x.cle}')`},
  article:{titre:'Par article', cle:'parArticle', lib:x => x.libelle, clic:x => x.cle.indexOf('libre:') === 0 ? '' : `gcOuvrir('gc-article', '${x.cle}')`},
  mois:{titre:'Par mois', cle:'parMois', lib:x => x.cle.split('-').reverse().join('/'), clic:() => ''}
};
let gcFiltresRenta = {vue:'article', du:'', au:'', clientId:'', articleId:'', cmdId:''};
function gcSousFiltresRenta(F){
  return [F.du || F.au ? 'Période : ' + (F.du ? 'du ' + gcDt(F.du) : '') + (F.au ? ' au ' + gcDt(F.au) : '') : 'Toutes périodes', F.clientId ? 'Client : ' + gcNomClient(F.clientId) : '', F.articleId ? 'Article : ' + gcLibArticle(gcArticle(F.articleId)) : '',
    F.cmdId ? 'Commande : ' + ((gcD().cmdC.find(c => c.id === F.cmdId) || {}).numero || '') : ''].filter(Boolean).join(' · ') + ' · coûts réels figés à la livraison, quantités réellement livrées';
}
window.renderGcRentabilite = function(main){
  const D = gcD(), F = gcFiltresRenta, RT = GC.rentabilite(D, F), V = GC_VUES_RENTA[F.vue] || GC_VUES_RENTA.article, T = RT.total;
  const b = gcSection(main, 'Rentabilité', gcBoutonsExport('rentabilite'));
  const lignes = RT[V.cle];
  const top = lignes.slice().sort((a, x) => Math.abs(x.ca) - Math.abs(a.ca)).slice(0, 8).map(x => ({lib:V.lib(x), ca:x.ca, cout:x.cout, marge:x.marge}));
  b.innerHTML = `<div class="card"><div class="gc-filtres">
      <label>Vue<select id="grt-vue">${gcOpts(Object.entries(GC_VUES_RENTA).map(([k, v]) => [k, v.titre]), F.vue)}</select></label>
      <label>Du<input type="date" id="grt-du" value="${F.du}"></label><label>Au<input type="date" id="grt-au" value="${F.au}"></label>
      <label>Client<select id="grt-client">${gcOptsClients(F.clientId, 'Tous')}</select></label><label>Article<select id="grt-art">${gcOptsArticles(F.articleId, 'Tous')}</select></label>
      <label>Commande<select id="grt-cmd">${gcOpts(D.cmdC.filter(c => c.numero).map(c => [c.id, c.numero + ' · ' + gcNomClient(c.clientId)]), F.cmdId, 'Toutes')}</select></label>
      <button class="btn btn-primary" data-gc="filtrer-renta" onclick="gcFiltresRenta = {vue:gcVal('grt-vue'), du:gcVal('grt-du'), au:gcVal('grt-au'), clientId:gcVal('grt-client'), articleId:gcVal('grt-art'), cmdId:gcVal('grt-cmd')}; nav('gc-rentabilite')">Appliquer</button></div></div>
    <div class="gc-chiffres"><div class="gc-chiffre"><span>Chiffre d'affaires livré HT</span><b>${gcE(T.ca)}</b></div><div class="gc-chiffre"><span>Prix d'achat réel</span><b>${gcE(T.achat)}</b></div><div class="gc-chiffre"><span>Frais (réceptions + livraisons)</span><b>${gcE(T.fraisLots + T.fraisLivraison)}</b></div>
      <div class="gc-chiffre"><span>Coût réel total</span><b>${gcE(T.cout)}</b></div><div class="gc-chiffre ${T.marge < 0 ? 'bad' : 'good'}"><span>Marge brute</span><b>${gcE(T.marge)}</b></div><div class="gc-chiffre"><span>Taux de marque (marge / CA)</span><b>${gcPct(T.tauxMarque)}</b></div><div class="gc-chiffre"><span>Taux de marge (marge / coût)</span><b>${gcPct(T.tauxMarge)}</b></div></div>
    <div class="gc-sous" style="margin-bottom:8px;">Coût réel = prix d'achat des lots réellement sortis (FIFO) + frais de réception répartis + frais de la livraison. Il est figé au jour de la livraison : un changement de prix ou de frais ne modifie pas les résultats passés. Les retours clients sont déduits.${T.provisoire ? ' <b>Certains résultats sont provisoires</b> (frais estimés ou articles sans stock valorisés au prix du catalogue).' : ''}</div>
    ${top.length ? `<div class="card"><h3 class="gc-h3">${esc(V.titre)} : CA, coût réel et marge</h3>${gcBarres(top, [{cle:'ca', lib:'CA', couleur:'#138C94'}, {cle:'cout', lib:'Coût réel', couleur:'#C5BA3C'}, {cle:'marge', lib:'Marge', couleur:'#C2346E'}])}</div>` : ''}
    ${lignes.length ? `<div class="gct-scroll"><table class="gct-t"><thead><tr><th>${esc(V.titre.replace(/^Par /, ''))}</th><th class="n">Livr.</th><th class="n">Qté</th><th class="n">CA HT</th><th class="n">Achat réel</th><th class="n">Frais</th><th class="n">Coût réel</th><th class="n">Marge</th><th class="n">Taux de marque</th><th class="n">Taux de marge</th>${F.vue === 'article' ? '<th class="n">Coût unitaire réel</th>' : ''}</tr></thead><tbody>
      ${lignes.map(x => `<tr ${V.clic(x) ? `class="gct-clic" onclick="${V.clic(x)}"` : ''}><td data-l="${gcAttr(V.titre)}">${esc(V.lib(x))}${x.provisoire ? '<span class="gc-tag">provisoire</span>' : ''}</td><td class="n" data-l="Livraisons">${x.nb}</td><td class="n" data-l="Qté">${gcQ(x.qte)}</td><td class="n" data-l="CA HT">${gcE(x.ca)}</td><td class="n" data-l="Achat réel">${gcE(x.achat)}</td><td class="n" data-l="Frais">${gcE(x.fraisLots + x.fraisLivraison)}</td><td class="n" data-l="Coût réel">${gcE(x.cout)}</td>
        <td class="n" data-l="Marge"><b style="color:${x.marge < 0 ? 'var(--bad)' : 'inherit'};">${gcE(x.marge)}</b></td><td class="n" data-l="Taux de marque">${gcPct(x.tauxMarque)}</td><td class="n" data-l="Taux de marge">${gcPct(x.tauxMarge)}</td>${F.vue === 'article' ? `<td class="n" data-l="Coût unitaire">${x.coutUnitaire === null ? '—' : gcE(x.coutUnitaire)}</td>` : ''}</tr>`).join('')}
      </tbody><tfoot><tr><td data-l="">Total</td><td class="n" data-l="Livraisons">${T.nb}</td><td class="n" data-l="Qté">${gcQ(T.qte)}</td><td class="n" data-l="CA HT">${gcE(T.ca)}</td><td class="n" data-l="Achat réel">${gcE(T.achat)}</td><td class="n" data-l="Frais">${gcE(T.fraisLots + T.fraisLivraison)}</td><td class="n" data-l="Coût réel">${gcE(T.cout)}</td><td class="n" data-l="Marge">${gcE(T.marge)}</td><td class="n" data-l="Taux de marque">${gcPct(T.tauxMarque)}</td><td class="n" data-l="Taux de marge">${gcPct(T.tauxMarge)}</td>${F.vue === 'article' ? '<td></td>' : ''}</tr></tfoot></table></div>` : buildEmptyState('Aucune livraison', 'La rentabilité est calculée sur les livraisons réelles.')}`;
};
