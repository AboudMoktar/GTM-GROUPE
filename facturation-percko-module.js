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
  if(soc === 'tek') main.querySelectorAll('div').forEach(d => { if(!d.children.length && /dinar/i.test(d.textContent) && d.style.fontSize === '11.5px') d.remove(); });
  if(!f || !f.percko) return;
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
window.fmtDT = function(n){ return (window.__devEUR || (typeof activeSociete !== 'undefined' && activeSociete === 'tek' && activeModule === 'factures')) ? percN(n, 2) + ' €' : percFmtDT(n); };
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

// --- Toute facture TEK-TREND est une facture PERCKO au modèle papier (euros, TVA 0) ---
const percCreerOrigine = window.factCreer;
window.factCreer = function(soc, data){
  data = data || {};
  if(soc === 'tek' && data.type !== 'avoir' && !data.percko){
    data = Object.assign({devise:'EUR', tva:0, timbre:0, echeance:getTodayISO(), notes:'', percko:{destination:'', codeClient:'', livraison:'', transport:'', colis:'', poidsBrut:'', poidsNet:'', valeurMatiere:'', composition:''}}, data);
  }
  return percCreerOrigine(soc, data);
};
const percNouvelleOrigine = window.factNouvelle;
window.factNouvelle = function(){
  if(factSoc() !== 'tek') return percNouvelleOrigine();
  const R = percReglages();
  mgtModal('Nouvelle facture', `<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Destination de la livraison (reprend l'adresse et le n° client) :</p>`
    + Object.keys(R.dest).map(k => `<button class="btn btn-ghost" style="width:100%;margin-bottom:8px;" onclick="percNouvelleDest('${k}')">${esc(k)}</button>`).join('')
    + `<button class="btn btn-ghost" style="width:100%;" onclick="percNouvelleDest('')">Autre (adresse à saisir)</button>`);
};
window.percNouvelleDest = (k) => {
  const R = percReglages(), D = k ? R.dest[k] : null, cl = Object.keys(factClients('tek'));
  mgtFermer();
  factOuvrir(factCreer('tek', {clientId:cl[0] || '', lignes:[{ref:'', designation:'', qte:1, pu:0, remise:0}],
    percko:{destination:k, codeClient:D ? D.code : '', livraison:D ? D.livraison : '', transport:D ? D.transport || '' : '', colis:'', poidsBrut:'', poidsNet:'', valeurMatiere:'', composition:''}}));
};
// Les anciens brouillons TEK-TREND (sans détails d'expédition) reçoivent aussi la carte « Expédition ».
const percEditOrigine2 = window.renderFactEdit;
window.renderFactEdit = function(main){
  const f = factSoc() === 'tek' ? factToutes('tek')[factId] : null;
  if(f && !f.percko && f.type !== 'avoir' && f.statut === 'brouillon'){
    const l = factToutes('tek'); l[factId].percko = {destination:'', codeClient:'', livraison:'', transport:'', colis:'', poidsBrut:'', poidsNet:'', valeurMatiere:'', composition:''}; factEnregistrer('tek', l);
  }
  return percEditOrigine2(main);
};

// --- Impression au modèle TEK-TREND (en-tête, cadre du tableau et bas de page identiques aux factures papier) ---
const percImprimerOrigine = window.factImprimer;
window.factImprimer = function(id, relance){
  const soc = factSoc(), f = factListe(soc)[id];
  if(relance || soc !== 'tek' || !f) return percImprimerOrigine(id, relance);
  const P = factParams('tek'), eur = true, d = 2;
  const S = {raison:P.raison && P.raison !== SOCIETES.tek.nom ? P.raison : PERC_SOCIETE.raison, adresse:P.adresse || PERC_SOCIETE.adresse, mf:P.mf || PERC_SOCIETE.mf, tel:P.tel || PERC_SOCIETE.tel, email:P.email || PERC_SOCIETE.email};
  const p = f.percko || {}, t = factTotaux(f), nl = (x) => esc(x || '').replace(/\n/g, '<br>');
  const cli = f.statut === 'emise' && f.client ? f.client : (factClients('tek')[f.clientId] || {nom:''});
  const livraison = p.livraison || [cli.nom, cli.adresse].filter(Boolean).join('\n');
  const rows = (f.lignes || []).map(l => `<tr><td>${esc(l.ref || '')}</td><td>${nl(l.designation)}</td><td class="n">${percN(l.qte, 3)}</td><td class="n">${percN(l.pu, d)}</td><td class="n">${l.remise ? percN(l.remise, 2) : ''}</td><td class="n">${l.remise ? percN(Number(l.qte) * Number(l.pu) * Number(l.remise) / 100, d) : ''}</td><td class="n">${percN(factMontantLigne(l), d)}</td><td class="c">0</td></tr>`);
  const note = [p.valeurMatiere !== '' && p.valeurMatiere != null ? 'VALEUR MATIERE PREMIERE: ' + Number(p.valeurMatiere).toFixed(2) + ' €' : '', p.composition ? '\n' + p.composition : '',
    (p.colis !== '' && p.colis != null) || (p.poidsBrut !== '' && p.poidsBrut != null) || (p.poidsNet !== '' && p.poidsNet != null) ? '\n' + [p.colis ? 'Nombre de colis: ' + p.colis : '', p.poidsBrut ? 'Poids Brut::' + p.poidsBrut + ' KG' : '', p.poidsNet ? 'Poids Net::' + p.poidsNet + ' KG' : ''].filter(Boolean).join('\n') : ''].filter(Boolean).join('\n');
  if(note) rows.push(`<tr><td>ART0002</td><td>${nl(note)}</td><td></td><td></td><td></td><td></td><td></td><td class="c">0</td></tr>`);
  if(p.transport) rows.push(`<tr><td></td><td style="padding-top:12px;">MODE DE TRANSPORT :${esc(p.transport)}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`);
  const ent = `<div class="soc"><b>${esc(S.raison)}</b><b>${esc(S.adresse.split('\n')[0] || '')}</b><b>MF :${esc(S.mf)}</b><b>${esc(S.email)}</b><b>${esc(S.adresse.split('\n').slice(1).join(' '))}</b><span>Tél &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;&nbsp;&nbsp;${esc(S.tel)}</span></div>
    <div class="b3"><div><span>${f.type === 'avoir' ? 'Avoir N°' : 'Facture N°'}</span><b>${esc(f.numero || 'BROUILLON')}</b></div><div><span>Date</span><b>${mgtDate(f.date)}</b></div><div><span>Client</span><b>${esc(p.codeClient || '')}</b></div></div>
    <div class="adr"><i></i><i></i><i></i><i></i><b>${nl(livraison)}</b></div>`;
  const e2 = (x) => percN(x, d), unite = eur ? 'Euros' : 'Dinars';
  const pied = `<div class="p1"><table class="code"><tr><th>Code</th><th>Base HT</th><th>Taux TVA</th><th>Montant TVA</th></tr><tr><td>0</td><td class="n">${e2(t.ht)}</td><td></td><td></td></tr></table>
    <div class="tot"><div><span>Total HT</span><em>${e2(t.ht)}</em></div><div><span><b>Net HT</b></span><em><b>${e2(t.ht)}</b></em></div><div><span>Total TVA</span><em>${t.tva ? e2(t.tva) : ''}</em></div><div><span>Total TTC</span><em>${e2(t.ttc)}</em></div><div class="np"><span><b>NET A PAYER</b></span><em><b>${e2(t.ttc)}</b></em></div></div></div>
    <div class="pay">Facture payable le ${mgtDate(f.echeance || f.date)} pour la somme de ${e2(t.ttc)} ${unite}.</div>
    <div class="legal">Pénalités de retard (taux annuel) : 8,00% - Escompte pour paiement anticipé (taux mensuel) : 1,50%<br><br><b>RESERVE DE PROPRIETE :</b> Nous nous réservons la propriété des marchandises jusqu'au paiement du prix par l'acheteur. Notre droit de revendication porte aussi bien sur les marchandises que sur leur prix si elles ont déjà été revendues (Loi du 12 mai 1980).</div>`;
  const thead = `<thead><tr><th style="width:12.5%;">Référence</th><th style="width:27%;">Désignation</th><th style="width:8%;">Quantité</th><th style="width:12%;">P.U. HT</th><th style="width:8%;">% REM</th><th style="width:12%;">Remise HT</th><th style="width:14.5%;">Montant HT</th><th style="width:6%;">TVA</th></tr></thead>`;
  const css = `@page{size:A4;margin:0} *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff} body{font:11.5px Arial,Helvetica,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .pg{position:relative;width:210mm;height:296.5mm;overflow:hidden;page-break-after:always;} .pg:last-child{page-break-after:auto;}
    .ent{position:absolute;left:8mm;top:7mm;width:194mm;height:80mm;} .soc{position:absolute;left:0;top:0;width:88mm;height:72mm;background:linear-gradient(#efefef,#f9f9f9 80%,#fff);padding:1mm 1.5mm;line-height:6.4mm;} .soc b,.soc span{display:block;font-size:11.5px;} .soc span{font-size:11.5px;}
    .b3{position:absolute;left:92mm;top:0;width:102mm;display:flex;gap:2.4mm;} .b3>div{flex:1;border:1.4px solid #000;border-radius:7px;text-align:center;height:13mm;overflow:hidden;} .b3 span{display:block;background:#efefef;font-weight:bold;border-bottom:1.4px solid #000;padding:1.3mm 0;font-size:12px;} .b3 b{display:block;padding:1.5mm 0;font-size:11.5px;}
    .adr{position:absolute;left:92mm;top:40mm;width:96mm;height:40mm;padding:3.5mm 4mm;line-height:6.4mm;} .adr b{font-size:11.5px;} .adr i{position:absolute;width:5mm;height:5mm;border:1.5px solid #000;} .adr i:nth-child(1){top:0;left:0;border-right:0;border-bottom:0} .adr i:nth-child(2){top:0;right:0;border-left:0;border-bottom:0} .adr i:nth-child(3){bottom:0;left:0;border-right:0;border-top:0} .adr i:nth-child(4){bottom:0;right:0;border-left:0;border-top:0}
    .cadre{position:absolute;left:8mm;top:88mm;width:194mm;border:1.4px solid #000;border-radius:7px;overflow:hidden;} table.l{width:100%;height:100%;border-collapse:collapse;table-layout:fixed;} table.l th{background:#efefef;border-bottom:1.4px solid #000;border-left:1.4px solid #000;padding:1.4mm 1mm;font-size:12px;height:6.5mm;} table.l th:first-child{border-left:0}
    table.l td{border-left:1.4px solid #000;padding:.4mm 1.3mm;vertical-align:top;font-size:12px;line-height:3.7mm;} table.l td:first-child{border-left:0} table.l td.n{text-align:right;white-space:nowrap} table.l td.c{text-align:center} table.l tr.fill td{height:auto}
    .bas{position:absolute;left:8mm;top:205mm;width:194mm;} .p1{display:flex;justify-content:space-between;align-items:flex-start;} table.code{border-collapse:separate;border-spacing:0;border:1.4px solid #000;border-radius:6px;overflow:hidden;width:86mm;} table.code th{background:#efefef;border-left:1.4px solid #000;border-bottom:1.4px solid #000;padding:1.2mm;font-size:12px;} table.code td{border-left:1.4px solid #000;padding:1.2mm;font-size:12px;height:6mm;} table.code th:first-child,table.code td:first-child{border-left:0;text-align:center} table.code td.n{text-align:right}
    .tot{width:88mm;border:1.4px solid #000;border-radius:6px;overflow:hidden;} .tot div{display:flex;border-top:1px solid #000;} .tot div:first-child{border-top:0} .tot span{flex:0 0 48%;background:#efefef;padding:1.5mm;font-size:12px;} .tot em{flex:1;font-style:normal;text-align:right;padding:1.5mm 1mm;font-size:12px;} .tot .np{border-top:1.4px solid #000}
    .pay{margin-top:20mm;font-size:12px;letter-spacing:.2px;} .legal{margin-top:12mm;font-size:8.5px;line-height:1.35;} .brouillon{position:absolute;top:120mm;left:0;right:0;text-align:center;font-size:90px;color:rgba(200,0,0,.12);transform:rotate(-25deg);pointer-events:none;z-index:5}
    #mesure{position:absolute;left:-9999px;top:0;width:194mm;visibility:hidden}`;
  const donnees = JSON.stringify({rows, ent, pied, thead, brouillon:f.statut !== 'emise'}).replace(/</g, '\\u003c');
  const script = `(function(){
    var D=${donnees}, mm=96/25.4, capN=(275-88-6.5)*mm, capF=(203-88-6.5)*mm, i, h=[];
    var m=document.getElementById('mesure'); m.innerHTML='<div class="cadre" style="position:static;"><table class="l">'+D.thead+'<tbody>'+D.rows.join('')+'</tbody></table></div>';
    var trs=m.querySelectorAll('tbody tr'); for(i=0;i<trs.length;i++) h.push(trs[i].getBoundingClientRect().height);
    var pages=[[]], cur=0, k;
    for(i=0;i<D.rows.length;i++){ if(cur+h[i]>capN && pages[pages.length-1].length){ pages.push([]); cur=0; } pages[pages.length-1].push(i); cur+=h[i]; }
    var last=pages[pages.length-1], tot=last.reduce(function(s,j){return s+h[j];},0);
    if(tot>capF){ var j=last.pop(); if(!last.length) pages.pop(); pages.push([j]); }
    var out=''; pages.forEach(function(pg,n){ var fin=n===pages.length-1, bas=fin?203:275;
      out+='<div class="pg">'+(D.brouillon?'<div class="brouillon">BROUILLON</div>':'')+'<div class="ent">'+D.ent+'</div><div class="cadre" style="height:'+(bas-88)+'mm;"><table class="l">'+D.thead+'<tbody>'+pg.map(function(j){return D.rows[j];}).join('')+'<tr class="fill"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table></div>'+(fin?'<div class="bas">'+D.pied+'</div>':'')+'</div>'; });
    document.body.insertAdjacentHTML('beforeend', out); m.remove(); setTimeout(function(){window.print();}, 250);
  })();`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(f.numero || 'Brouillon')}</title><style>${css}</style></head><body><div id="mesure"></div><script>${script}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour imprimer'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

// TEK-TREND facture en euros : on remplace les libellés « DT » des écrans de facturation.
const percListe2 = window.renderFactListe;
window.renderFactListe = function(main){
  percListe2(main);
  if(factSoc() === 'tek') document.querySelectorAll('#mgt-body .kpi-mini div').forEach(d => { if(!d.children.length) d.textContent = d.textContent.replace(/^DT /, '€ ').replace(' DT', ' €'); });
};
const percPaiement = window.factFormPaiement;
window.factFormPaiement = function(id){ percPaiement(id); if(factSoc() === 'tek'){ const l = document.querySelector('#fp-montant'); if(l && l.previousElementSibling) l.previousElementSibling.textContent = 'Montant (€)'; } };

// TEK-TREND : ni TVA, ni timbre, ni remise.
const percMontantLigne = window.factMontantLigne;
window.factMontantLigne = function(l){ return (typeof activeSociete !== 'undefined' && activeSociete === 'tek') ? (Number(l.qte) || 0) * (Number(l.pu) || 0) : percMontantLigne(l); };
const percTotaux = window.factTotaux;
window.factTotaux = function(f, toutes){
  if((typeof activeSociete !== 'undefined' && activeSociete === 'tek') || f.percko || f.devise === 'EUR'){
    const g = Object.assign({}, f, {tva:0, timbre:0, lignes:(f.lignes || []).map(l => Object.assign({}, l, {remise:0}))});
    return percTotaux(g, toutes);
  }
  return percTotaux(f, toutes);
};
