// ============================================================
// FACTURATION PERCKO (TEK-TREND) — facture d'export générée depuis l'étape « Emballage » du module Commandes
// ============================================================
// Une commande PERCKO a une destination (NEOLYS ou ALLOGA). La facture reprend les pièces emballées (par article et
// groupe de tailles), au prix du catalogue pour cette destination, plus des lignes libres (déclarations, frais, transport…).
// Facture en euros, TVA 0, imprimée sur le modèle TEK-TREND (adresse de livraison, colis, poids, composition, valeur matière).
// Le catalogue ci-dessous vient des factures FA26/025 et FA26/026 : à remplacer par la liste de prix officielle (écran « Catalogue & prix »).

const PERC_T = {S3:['XS', 'S', 'M'], L3:['L', 'XL', 'XXL'], X3:['XXXL'], G4:['L', 'XL', 'XXL', 'XXXL'], TOUT:['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']};
function percArt(code, lib, ref, tailles, etiq, nl, aa){ return {code, lib, ref, tailles, etiq, prix:{NEOLYS:nl, ALLOGA:aa == null ? nl : aa}}; }
const PERC_CATALOGUE_SEED = [
  percArt('ART0082', 'PHARMA HOMME COL V NOIR', 'PHARMA-HOMME__Noir', PERC_T.S3, 'XS S M', 11.70, 11.50),
  percArt('ART0083', 'PHARMA HOMME COL V NOIR', 'PHARMA-HOMME__Noir', PERC_T.L3, 'L XL XXL', 12.55),
  percArt('ART0084', 'PHARMA HOMME COL V NOIR', 'PHARMA-HOMME__Noir', PERC_T.X3, '3XL', 13.27),
  percArt('ART0088', 'PHARMA HOMME COL V GRIS', 'PHARMA-HOMME__Gris', PERC_T.S3, 'XS S M', 11.70),
  percArt('ART0089', 'PHARMA HOMME COL V GRIS', 'PHARMA-HOMME__Gris', PERC_T.L3, 'L XL XXL', 12.55),
  percArt('ART0090', 'PHARMA HOMME COL V GRIS', 'PHARMA-HOMME__Gris', PERC_T.X3, '3XL', 13.27),
  percArt('ART0097', 'PHARMA HOMME COL V SABLE', 'PHARMA-HOMME__Sable', PERC_T.S3, 'XS S M', 11.70),
  percArt('ART0098', 'PHARMA HOMME COL V SABLE', 'PHARMA-HOMME__Sable', PERC_T.L3, 'L XL XXL', 12.55),
  percArt('ART0099', 'PHARMA HOMME COL V SABLE', 'PHARMA-HOMME__Sable', PERC_T.X3, '3XL', 13.27),
  percArt('ART0085', 'PHARMA FEMME COL V NOIR', 'PHARMA-FEMME CV__Noir', PERC_T.S3, 'XS S M', 11.90, 11.70),
  percArt('ART0086', 'PHARMA FEMME COL V NOIR', 'PHARMA-FEMME CV__Noir', PERC_T.L3, 'L XL XXL', 12.75, 11.70),
  percArt('ART0087', 'PHARMA FEMME COL V NOIR', 'PHARMA-FEMME CV__Noir', PERC_T.X3, '3XL', 13.47),
  percArt('ART0091', 'PHARMA FEMME COL V ROSE', 'PHARMA-FEMME CV__Rose', PERC_T.S3, 'XS S M', 11.90),
  percArt('ART0092', 'PHARMA FEMME COL V ROSE', 'PHARMA-FEMME CV__Rose', PERC_T.L3, 'L XL XXL', 12.75),
  percArt('ART0093', 'PHARMA FEMME COL V ROSE', 'PHARMA-FEMME CV__Rose', PERC_T.X3, '3XL', 13.47),
  percArt('ART0094', 'PHARMA FEMME COL R ROSE', 'PHARMA-FEMME CR__Rose', PERC_T.S3, 'XS S M', 11.90),
  percArt('ART0095', 'PHARMA FEMME COL R ROSE', 'PHARMA-FEMME CR__Rose', PERC_T.L3, 'L XL XXL', 12.75),
  percArt('ART0096', 'PHARMA FEMME COL R ROSE', 'PHARMA-FEMME CR__Rose', PERC_T.X3, '3XL', 13.47),
  percArt('ART0045', 'SPORT-H-RE-MI', 'SPORT__Homme', PERC_T.S3, 'TAILLE XS-S-M', 11.99),
  percArt('ART0046', 'SPORT-H-RE-MI', 'SPORT__Homme', PERC_T.L3, 'TAILLE L-XL-2XL', 12.84),
  percArt('ART0047', 'SPORT-F-RE-MI', 'SPORT__Femme', PERC_T.S3, 'TAILLE XS-S-M', 11.99),
  percArt('ART0048', 'SPORT-F-RE-MI', 'SPORT__Femme', PERC_T.L3, 'TAILLE L-XL-2XL', 12.84),
  percArt('ART0025', 'GILLET HOMME NOIR', 'GILET-NOIR__Homme', PERC_T.S3, 'TAILLE XS S M', 14.42),
  percArt('ART0026', 'GILLET HOMME NOIR', 'GILET-NOIR__Homme', PERC_T.G4, 'L XL 2XL 3XL', 15.71),
  percArt('ART0027', 'GILLET-F-NOIR', 'GILET-NOIR__Femme', PERC_T.S3, 'TAILLE XS-S-M', 14.42),
  percArt('ART0028', 'GILLET -F-NOIR', 'GILET-NOIR__Femme', PERC_T.G4, 'TAILLE L-XL-2XL-3XL', 15.71),
  percArt('GILET PERCKO', 'PRO HOMME', 'LYNE-PRO__Homme', PERC_T.TOUT, '', 13.85),
  percArt('GILET -PERCKO', 'PRO FEMME', 'LYNE-PRO__Femme', PERC_T.TOUT, '', 13.85),
  percArt('ART0029', 'SV-CV-HOMME NOIR', '', [], 'TAILLE 2.3.4.5.6', 12.52),
  percArt('ART0030', 'SV-CV-HOMME NOIR', '', [], 'TAILLE XL-2XL', 13.37),
  percArt('ART0032', 'SV-CV-HOMME SABLE', '', [], 'TAILLE XL-2XL', 13.37)
];
const PERC_FRAIS_SEED = [
  {code:'ART0002', lib:'DECLARATION EXPORT DU ', pu:60}, {code:'ART0002', lib:'DECLARATION IMPORT DU ', pu:60},
  {code:'ART0002', lib:'FRAIS EXPORT DU ', pu:0}, {code:'ART0002', lib:'FRAIS VOYAGES', pu:290}, {code:'ART0002', lib:'FRAIS DE TRANSPORT', pu:0}
];
const PERC_DEST_SEED = {
  NEOLYS:{code:'001', livraison:"Percko chez Neolys\nParc d'activités de paris sud jaune\nGaronor 607/610\nBoulevard d'Italie\n77127 Lieusaint France", transport:'DDP'},
  ALLOGA:{code:'002', livraison:"PERCKO\nADRESS DE LIVRAISON : ALLOGA A ARRA\n970 ALLée de belgique\nZAC ARTOIPOLE 62128\n62128 WANCOURT FRANCE", transport:''}
};
const PERC_COMPO = [
  ['PHARMA', "COMPOSITION DE MATIERE\nSOUS VETEMENT PHARMA :\n80% POLYAMIDE + 20% ELASTAN"],
  ['SPORT', 'COMPOSITION SPORT REMI :\n85% POLYAMIDE + 15% ELASTANE'],
  ['GILET-NOIR', 'COMPOSITION GILET NOIR :\n80% POLYAMIDE + 20% ELASTANE'],
  ['LYNE-PRO', 'GILLET PRO :78% POLYAMIDE+\n22% ELASTANE']
];
const PERC_SOCIETE = {raison:'S.A.R.L. TEK-TREND sarl', adresse:'RUE SAKIET SIDI YOUSSEF\n5012 SAHLINE', mf:'1671553V/A/M/000', tel:'00216 73 525567', email:'tek.trendtunisie@gmail.com'};

// --- Données (rangées dans les réglages de facturation de TEK-TREND : aucune nouvelle règle Firebase) ---
function percReglages(){
  const P = factParams('tek');
  return {
    catalogue: Array.isArray(P.catalogue) ? P.catalogue : JSON.parse(JSON.stringify(PERC_CATALOGUE_SEED)),
    frais: Array.isArray(P.fraisTypes) ? P.fraisTypes : PERC_FRAIS_SEED.slice(),
    dest: Object.assign({}, JSON.parse(JSON.stringify(PERC_DEST_SEED)), P.destinations || {})
  };
}
function percEnregistrer(part){
  const cle = factCle('tek', 'fact_params'), s = getJSON(cle, {}) || {};
  Object.assign(s, part); setJSON(cle, s);
}
function percN(x, d){ return (Number(x) || 0).toLocaleString('fr-FR', {minimumFractionDigits:d, maximumFractionDigits:d}); }

// --- Quantités emballées d'une commande, par article ---
function percEmballe(cmdId){
  const cmd = getCmdCommandes()[cmdId]; if(!cmd) return null;
  const R = percReglages(), cum = cmdCumuls(cmdId), res = {}, couvert = {};
  R.catalogue.forEach(a => {
    if(!a.ref || !cum[a.ref]) return;
    let q = 0;
    (a.tailles || []).forEach(t => { const c = cum[a.ref][t]; if(c){ q += c.emballage || 0; couvert[a.ref + '|' + t] = true; } });
    if(q > 0) res[a.code + '|' + a.ref] = {art:a, qte:q};
  });
  const orphelins = [];
  Object.keys(cum).forEach(rk => Object.keys(cum[rk]).forEach(t => { const q = cum[rk][t].emballage || 0; if(q > 0 && !couvert[rk + '|' + t]) orphelins.push({ref:rk, taille:t, qte:q}); }));
  return {cmd, lignes:Object.values(res), orphelins};
}
function percDejaFacture(cmdId){
  const o = {};
  Object.values(factToutes('tek')).forEach(f => {
    if(f.type === 'avoir' || !f.origine || f.origine.type !== 'percko' || f.origine.cmdId !== cmdId) return;
    (f.lignes || []).forEach(l => { if(l.emb) o[l.code + '|' + l.refKey] = (o[l.code + '|' + l.refKey] || 0) + (Number(l.qte) || 0); });
  });
  return o;
}
function percReste(cmdId){
  const e = percEmballe(cmdId); if(!e) return null;
  const fait = percDejaFacture(cmdId);
  e.lignes.forEach(l => { l.deja = fait[l.art.code + '|' + l.art.ref] || 0; l.reste = Math.max(0, l.qte - l.deja); });
  e.total = e.lignes.reduce((s, l) => s + l.reste, 0);
  return e;
}

// --- Création de la facture ---
window.percChoisirCommande = () => {
  if(typeof getCmdCommandes !== 'function'){ showToast('Module Commandes indisponible'); return; }
  const l = Object.entries(getCmdCommandes()).map(([id, c]) => ({id, c, r:percReste(id)})).filter(x => x.r && x.r.total > 0)
    .sort((a, b) => (b.c.createdAt || 0) - (a.c.createdAt || 0));
  mgtModal('Facture PERCKO depuis l\'emballage', l.length
    ? `<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Pièces emballées et pas encore facturées, par commande.</p>` + l.map(x => `<div class="session-row" style="cursor:pointer;" onclick="percCreer('${x.id}')"><div style="min-width:0;flex:1;"><b style="font-size:13.5px;">${esc(x.c.numero || x.c.lot || x.id)}</b><div style="font-size:11.5px;color:var(--ink-soft);">${esc(x.c.destination || '')}${x.c.dateReception ? ' · reçue le ' + mgtDate(x.c.dateReception) : ''}</div></div><div style="text-align:right;"><b>${x.r.total}</b> <span style="font-size:11.5px;color:var(--ink-soft);">pièces à facturer</span></div></div>`).join('')
    : '<div style="padding:14px;color:var(--ink-soft);font-size:13px;">Aucune pièce emballée à facturer. Les quantités viennent de l\'étape « Emballage » du module Commandes.</div>');
};
window.percCreer = (cmdId) => {
  const e = percReste(cmdId); if(!e) return;
  const R = percReglages(), dest = e.cmd.destination || 'NEOLYS', D = R.dest[dest] || {code:'', livraison:'', transport:''}, today = getTodayISO();
  const clients = factClients('tek'), cid = Object.keys(clients).find(k => (clients[k].nom || '').toUpperCase() === 'PERCKO') || Object.keys(clients)[0] || '';
  const lignes = e.lignes.filter(l => l.reste > 0).map(l => ({ref:l.art.code, code:l.art.code, refKey:l.art.ref, emb:true, designation:l.art.lib + (l.art.etiq ? '\n' + l.art.etiq : ''), qte:l.reste, pu:Number((l.art.prix || {})[dest]) || 0, remise:0}));
  const familles = new Set(e.lignes.filter(l => l.reste > 0).map(l => l.art.ref.split('__')[0]));
  const compo = PERC_COMPO.filter(([k]) => Array.from(familles).some(f => f.indexOf(k) === 0)).map(x => x[1]).join('\n');
  const id = factCreer('tek', {clientId:cid, objet:'Expédition ' + (e.cmd.numero || ''), devise:'EUR', tva:0, timbre:0, echeance:today, notes:'', lignes,
    origine:{type:'percko', cmdId, label:e.cmd.numero || ''},
    percko:{destination:dest, codeClient:D.code, livraison:D.livraison, transport:D.transport || '', colis:'', poidsBrut:'', poidsNet:'', valeurMatiere:'', composition:compo}});
  mgtFermer();
  const sansPrix = lignes.filter(l => !l.pu).length;
  showToast('Brouillon préparé' + (sansPrix ? ' : ' + sansPrix + ' prix à compléter' : '') + '. Ajoutez les frais puis émettez.');
  factOuvrir(id);
  if(e.orphelins.length) setTimeout(() => showToast(e.orphelins.reduce((s, o) => s + o.qte, 0) + ' pièces emballées n\'ont pas d\'article au catalogue'), 2500);
};

// --- Complément de l'écran facture : détails d'expédition, articles et frais ---
const percEditOrigine = window.renderFactEdit;
window.renderFactEdit = function(main){
  const soc = factSoc(), f = factToutes(soc)[factId];
  window.__devEUR = !!(f && f.devise === 'EUR');
  try { percEditOrigine(main); } finally { window.__devEUR = false; }
  if(!f || !f.percko) return;
  main.querySelectorAll('div').forEach(d => { if(!d.children.length && /dinar/i.test(d.textContent) && d.style.fontSize === '11.5px') d.remove(); });
  window.__devEUR = true;
  const ed = canEditFact(soc) && f.statut === 'brouillon', dis = ed ? '' : 'disabled', p = f.percko, R = percReglages();
  const champ = (label, k, type, extra) => `<div style="flex:1;min-width:120px;">${mgtChamp(label, 'pk-' + k, p[k], type || 'text', `${dis} ${extra || ''} onchange="percMaj('${k}', this.value)"`)}</div>`;
  const carte = `<div class="card">
    <h3 style="margin:0 0 8px;font-size:14px;">Expédition ${esc(p.destination || '')}</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">${champ('N° client', 'codeClient')}${champ('Transport', 'transport', 'text', 'placeholder="ex. DDP"')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">${champ('Nombre de colis', 'colis', 'number', 'min="0"')}${champ('Poids brut (kg)', 'poidsBrut', 'number', 'min="0"')}${champ('Poids net (kg)', 'poidsNet', 'number', 'min="0"')}</div>
    ${champ('Valeur matière première (€)', 'valeurMatiere', 'number', 'min="0" step="0.01"')}
    ${mgtZone('Adresse de livraison (imprimée)', 'pk-livraison', p.livraison).replace('<textarea', `<textarea ${dis} onchange="percMaj('livraison', this.value)"`)}
    ${mgtZone('Composition de matière', 'pk-composition', p.composition).replace('<textarea', `<textarea ${dis} onchange="percMaj('composition', this.value)"`)}
    ${ed ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
      <select id="pk-add-art" class="mgt-in" style="flex:2;min-width:180px;"><option value="">+ Article du catalogue…</option>${R.catalogue.map((a, i) => `<option value="${i}">${esc(a.code + ' · ' + a.lib + ' ' + (a.etiq || ''))}</option>`).join('')}</select>
      <select id="pk-add-frais" class="mgt-in" style="flex:2;min-width:180px;"><option value="">+ Frais / déclaration…</option>${R.frais.map((x, i) => `<option value="${i}">${esc(x.lib.trim())}${x.pu ? ' (' + x.pu + ' €)' : ''}</option>`).join('')}</select>
    </div>` : ''}</div>`;
  const cartes = main.querySelectorAll('.card');
  const ligneCarte = Array.from(cartes).find(c => c.querySelector('.mgt-ligne')) || cartes[cartes.length - 1];
  if(ligneCarte) ligneCarte.insertAdjacentHTML('afterend', carte);
  window.__devEUR = false;
  const a = document.getElementById('pk-add-art'), x = document.getElementById('pk-add-frais');
  if(a) a.onchange = () => { if(a.value !== '') percAjouterArticle(+a.value); };
  if(x) x.onchange = () => { if(x.value !== '') percAjouterFrais(+x.value); };
};
window.percMaj = (k, v) => factModifier(f => { f.percko = f.percko || {}; f.percko[k] = v; }, false);
window.percAjouterArticle = (i) => { const a = percReglages().catalogue[i], f = factToutes('tek')[factId]; if(!a || !f) return;
  const dest = (f.percko && f.percko.destination) || 'NEOLYS';
  factModifier(f => { f.lignes.push({ref:a.code, code:a.code, refKey:a.ref, designation:a.lib + (a.etiq ? '\n' + a.etiq : ''), qte:1, pu:Number((a.prix || {})[dest]) || 0, remise:0}); }); };
window.percAjouterFrais = (i) => { const x = percReglages().frais[i]; if(!x) return;
  factModifier(f => { f.lignes.push({ref:x.code, designation:x.lib, qte:1, pu:x.pu || 0, remise:0}); }); };

// Devise, numéro et libellés propres aux factures PERCKO.
const percFmtDT = window.fmtDT;
window.fmtDT = function(n){ return window.__devEUR ? percN(n, 2) + ' €' : percFmtDT(n); };
const percLigneOrigine = window.factLigne;
window.factLigne = function(id, f, toutes, avecClient){
  window.__devEUR = f.devise === 'EUR';
  try { return percLigneOrigine(id, f, toutes, avecClient); } finally { window.__devEUR = false; }
};
const percOrigineLabel = window.factOrigineLabel;
window.factOrigineLabel = function(o){ return o && o.type === 'percko' ? 'Emballage ' + (o.label || '') : percOrigineLabel(o); };
const percNumero = window.factNumero;
window.factNumero = function(soc, type, annee){
  if(soc !== 'tek' || type === 'avoir') return percNumero(soc, type, annee);
  // Suite de la numérotation papier : FA26/027 après FA26/026.
  const cle = factCle('tek', 'fact_compteurs'), c = getJSON(cle, {}) || {}, t = c.FA || {}, base = annee === '2026' ? 26 : 0;
  t[annee] = Math.max(t[annee] || 0, base) + 1; c.FA = t; setJSON(cle, c);
  return 'FA' + String(annee).slice(2) + '/' + String(t[annee]).padStart(3, '0');
};
const percNavParent = window.navParent;
window.navParent = function(tab){ return tab === 'fact-catalogue' ? 'fact-liste' : percNavParent(tab); };

// --- Liste : accès rapide ---
const percListeOrigine = window.renderFactListe;
window.renderFactListe = function(main){
  percListeOrigine(main);
  const soc = factSoc(); if(soc !== 'tek' || !canEditFact(soc)) return;
  const b = document.getElementById('mgt-body'); if(!b) return;
  b.insertAdjacentHTML('afterbegin', `<div class="card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <div style="flex:1;min-width:200px;"><b style="font-size:14px;">Facture PERCKO</b><div style="font-size:12px;color:var(--ink-soft);">Préparée à partir des pièces emballées.</div></div>
    <button class="btn btn-primary" onclick="percChoisirCommande()">Depuis l'emballage</button>
    <button class="btn btn-ghost" onclick="nav('fact-catalogue')">Catalogue & prix</button></div>`);
};
const percRouteur = window.renderFact;
window.renderFact = function(tab, main){ return tab === 'fact-catalogue' ? renderFactCatalogue(main) : percRouteur(tab, main); };

// --- Catalogue & prix ---
function renderFactCatalogue(main){
  const R = percReglages(), ed = canEditFact('tek');
  const b = mgtSection(main, `<span style="cursor:pointer;" onclick="nav('fact-liste')">‹</span> Catalogue & prix PERCKO`, ed ? `<button class="btn btn-primary" onclick="percSauverCatalogue()">Enregistrer</button>` : '');
  const inp = (cls, v, st) => `<input class="mgt-in ${cls}" type="number" min="0" step="0.01" value="${v || ''}" ${ed ? '' : 'disabled'} style="${st || 'width:84px;'}">`;
  b.innerHTML = `<div class="card"><p style="font-size:12.5px;color:var(--ink-soft);margin:0;">Prix unitaires HT en euros, par destination. Valeurs de départ reprises des factures FA26/025 et FA26/026 : à remplacer par la liste officielle.</p></div>
    <div class="card" style="padding:6px 10px;"><div style="display:grid;grid-template-columns:minmax(0,1fr) 84px 84px;gap:6px;font-size:11px;color:var(--ink-soft);padding:4px 0;"><div>Article</div><div>NEOLYS</div><div>ALLOGA</div></div>
      ${R.catalogue.map((a, i) => `<div class="pk-art" data-i="${i}" style="display:grid;grid-template-columns:minmax(0,1fr) 84px 84px;gap:6px;align-items:center;padding:5px 0;border-top:1px solid var(--border-soft);">
        <div style="min-width:0;"><b style="font-size:12.5px;">${esc(a.code)}</b><div style="font-size:11.5px;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;">${esc(a.lib)} ${esc(a.etiq || '')}</div></div>
        ${inp('pk-nl', a.prix.NEOLYS, 'width:100%;')}${inp('pk-aa', a.prix.ALLOGA, 'width:100%;')}</div>`).join('')}</div>
    <div class="card"><h3 style="margin:0 0 8px;font-size:14px;">Destinations</h3>
      ${Object.entries(R.dest).map(([k, d]) => `<div class="pk-dest" data-k="${k}" style="margin-bottom:12px;"><b style="font-size:13px;">${esc(k)}</b>
        <div style="display:flex;gap:8px;"><div style="flex:1;"><label style="font-size:11px;color:var(--ink-soft);">N° client</label><input class="mgt-in pk-dc" value="${esc(d.code)}" ${ed ? '' : 'disabled'}></div>
        <div style="flex:1;"><label style="font-size:11px;color:var(--ink-soft);">Transport</label><input class="mgt-in pk-dt" value="${esc(d.transport || '')}" ${ed ? '' : 'disabled'}></div></div>
        <label style="font-size:11px;color:var(--ink-soft);">Adresse de livraison</label><textarea class="mgt-in pk-dl" rows="4" ${ed ? '' : 'disabled'}>${esc(d.livraison)}</textarea></div>`).join('')}</div>
    <div class="card"><h3 style="margin:0 0 4px;font-size:14px;">Frais et déclarations proposés</h3><p style="font-size:12px;color:var(--ink-soft);margin:0 0 8px;">Montant à 0 = à saisir à chaque facture.</p>
      ${R.frais.map((x, i) => `<div class="pk-frais session-row" data-i="${i}" style="gap:6px;"><input class="mgt-in pk-fl" value="${esc(x.lib)}" ${ed ? '' : 'disabled'} style="flex:1;min-width:0;"><input class="mgt-in pk-fp" type="number" min="0" step="0.01" value="${x.pu || ''}" ${ed ? '' : 'disabled'} style="width:84px;"></div>`).join('')}
      ${ed ? '<button class="btn btn-ghost" style="margin-top:8px;padding:6px 12px;font-size:12px;" onclick="percAjouterFraisType()">+ Frais</button>' : ''}</div>`;
}
window.percAjouterFraisType = () => { percSauverCatalogue(true); const R = percReglages(); R.frais.push({code:'ART0002', lib:'NOUVEAU FRAIS', pu:0}); percEnregistrer({fraisTypes:R.frais}); nav('fact-catalogue'); };
window.percSauverCatalogue = (silencieux) => {
  const R = percReglages();
  document.querySelectorAll('.pk-art').forEach(r => { const a = R.catalogue[+r.dataset.i]; if(!a) return; a.prix = {NEOLYS:parseFloat(r.querySelector('.pk-nl').value) || 0, ALLOGA:parseFloat(r.querySelector('.pk-aa').value) || 0}; });
  const dest = {};
  document.querySelectorAll('.pk-dest').forEach(r => { dest[r.dataset.k] = {code:r.querySelector('.pk-dc').value.trim(), transport:r.querySelector('.pk-dt').value.trim(), livraison:r.querySelector('.pk-dl').value}; });
  const frais = []; document.querySelectorAll('.pk-frais').forEach(r => { const lib = r.querySelector('.pk-fl').value; if(lib.trim()) frais.push({code:'ART0002', lib, pu:parseFloat(r.querySelector('.pk-fp').value) || 0}); });
  percEnregistrer({catalogue:R.catalogue, destinations:dest, fraisTypes:frais});
  if(!silencieux) showToast('Catalogue enregistré');
};

// --- Impression au modèle TEK-TREND ---
const percImprimerOrigine = window.factImprimer;
window.factImprimer = function(id, relance){
  const f = factListe(factSoc())[id];
  if(relance || !f || !f.percko) return percImprimerOrigine(id, relance);
  const P = factParams('tek'), S = {raison:P.raison && P.raison !== SOCIETES.tek.nom ? P.raison : PERC_SOCIETE.raison, adresse:P.adresse || PERC_SOCIETE.adresse, mf:P.mf || PERC_SOCIETE.mf, tel:P.tel || PERC_SOCIETE.tel, email:P.email || PERC_SOCIETE.email};
  const p = f.percko, t = factTotaux(f), nl = (s) => esc(s || '').replace(/\n/g, '<br>');
  const lignes = (f.lignes || []).map(l => `<tr><td>${esc(l.ref || '')}</td><td>${nl(l.designation)}</td><td class="n">${l.qte !== '' ? percN(l.qte, 3) : ''}</td><td class="n">${percN(l.pu, 2)}</td><td class="n">${l.remise ? percN(l.remise, 2) : ''}</td><td class="n">${l.remise ? percN(Number(l.qte) * Number(l.pu) * Number(l.remise) / 100, 2) : ''}</td><td class="n">${percN(factMontantLigne(l), 2)}</td><td class="c">0</td></tr>`).join('');
  const notes = [p.valeurMatiere !== '' && p.valeurMatiere != null ? 'VALEUR MATIERE PREMIERE: ' + Number(p.valeurMatiere).toFixed(2) + ' €' : '', p.composition ? '\n' + p.composition : '',
    (p.colis !== '' || p.poidsBrut !== '' || p.poidsNet !== '') ? '\n' + [p.colis !== '' ? 'Nombre de colis: ' + p.colis : '', p.poidsBrut !== '' ? 'Poids Brut::' + p.poidsBrut + ' KG' : '', p.poidsNet !== '' ? 'Poids Net::' + p.poidsNet + ' KG' : ''].filter(Boolean).join('\n') : ''].filter(Boolean).join('\n');
  const tete = `<div class="entete"><div class="soc"><b>${esc(S.raison)}</b><br><b>${nl(S.adresse).replace(/<br>/, '<br>')}</b><br><b>MF :${esc(S.mf)}</b><br><br><b>${esc(S.email)}</b><br><span class="tel">Tél : ${esc(S.tel)}</span></div>
    <div class="boites"><div class="b3"><div><span>Facture N°</span><b>${esc(f.numero || 'BROUILLON')}</b></div><div><span>Date</span><b>${mgtDate(f.date)}</b></div><div><span>Client</span><b>${esc(p.codeClient || '')}</b></div></div>
    <div class="adr"><b>${nl(p.livraison)}</b></div></div></div>`;
  const css = `@page{size:A4;margin:10mm} body{font:11px Arial,Helvetica,sans-serif;color:#000;margin:0;} table.page{width:100%;border-collapse:collapse;} table.page>thead>tr>td,table.page>tbody>tr>td{padding:0;border:none;}
    .entete{display:flex;justify-content:space-between;gap:16px;margin-bottom:14px;} .soc{width:44%;font-size:11px;line-height:1.5;} .soc .tel{font-weight:normal;} .boites{width:52%;}
    .b3{display:flex;gap:6px;} .b3>div{flex:1;border:1px solid #333;border-radius:6px;text-align:center;} .b3 span{display:block;background:#eee;font-weight:bold;border-bottom:1px solid #333;border-radius:5px 5px 0 0;padding:2px;} .b3 b{display:block;padding:3px;font-weight:normal;}
    .adr{margin:26px 0 0 14px;padding:12px 14px;line-height:1.7;border:1px solid transparent;position:relative;} .adr::before,.adr::after{content:'';position:absolute;width:14px;height:14px;border:1.5px solid #000;} .adr::before{top:0;left:0;border-right:none;border-bottom:none;} .adr::after{bottom:0;right:0;border-left:none;border-top:none;}
    table.l{width:100%;border-collapse:collapse;border:1px solid #000;} table.l th{background:#eee;border:1px solid #000;padding:4px;font-size:10.5px;} table.l td{border-left:1px solid #000;border-right:1px solid #000;padding:2px 4px;vertical-align:top;font-size:11px;} table.l td.n{text-align:right;white-space:nowrap;} table.l td.c{text-align:center;}
    table.l tr{page-break-inside:avoid;} table.l tbody tr:last-child td{border-bottom:1px solid #000;}
    .pied{display:flex;justify-content:space-between;gap:20px;margin-top:14px;page-break-inside:avoid;} .pied table{border-collapse:collapse;} .pied th{background:#eee;border:1px solid #000;padding:3px 8px;} .pied td{border:1px solid #000;padding:3px 8px;text-align:right;}
    .tot{min-width:300px;} .tot div{display:flex;justify-content:space-between;border:1px solid #000;border-top:none;padding:3px 8px;} .tot div:first-child{border-top:1px solid #000;} .tot b{font-weight:bold;}
    .payable{margin:14px 0 10px;} .legal{font-size:9px;line-height:1.4;margin-top:10px;} .brouillon{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:90px;color:rgba(200,0,0,.12);transform:rotate(-25deg);}`;
  const e2 = (x) => percN(x, 2);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(f.numero || 'Brouillon')}</title><style>${css}</style></head><body>
    ${f.statut !== 'emise' ? '<div class="brouillon">BROUILLON</div>' : ''}
    <table class="page"><thead><tr><td>${tete}</td></tr></thead><tbody><tr><td>
      <table class="l"><thead><tr><th style="width:12%;">Référence</th><th>Désignation</th><th style="width:9%;">Quantité</th><th style="width:8%;">P.U. HT</th><th style="width:6%;">% REM</th><th style="width:9%;">Remise HT</th><th style="width:11%;">Montant HT</th><th style="width:5%;">TVA</th></tr></thead>
      <tbody>${lignes}${notes ? `<tr><td>ART0002</td><td>${nl(notes)}</td><td></td><td></td><td></td><td></td><td></td><td class="c">0</td></tr>` : ''}<tr><td style="height:40px;"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
      ${p.transport ? `<div style="margin-top:8px;"><b>MODE DE TRANSPORT :${esc(p.transport)}</b></div>` : ''}
      <div class="pied"><table><tr><th>Code</th><th>Base HT</th><th>Taux TVA</th><th>Montant TVA</th></tr><tr><td>0</td><td>${e2(t.ht)}</td><td></td><td></td></tr></table>
        <div class="tot"><div><span>Total HT</span><b>${e2(t.ht)}</b></div><div><span>Net HT</span><b>${e2(t.ht)}</b></div><div><span>Total TVA</span><b></b></div><div><span>Total TTC</span><b>${e2(t.ttc)}</b></div><div><span>NET A PAYER</span><b>${e2(t.ttc)}</b></div></div></div>
      <div class="payable">Facture payable le ${mgtDate(f.echeance || f.date)} pour la somme de ${e2(t.ttc)} Euros.</div>
      <div class="legal">Pénalités de retard (taux annuel) : 8,00% - Escompte pour paiement anticipé (taux mensuel) : 1,50%<br>RESERVE DE PROPRIETE : Nous nous réservons la propriété des marchandises jusqu'au paiement du prix par l'acheteur. Notre droit de revendication porte aussi bien sur les marchandises que sur leur prix si elles ont déjà été revendues (Loi du 12 mai 1980).</div>
    </td></tr></tbody></table><script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour imprimer'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};
