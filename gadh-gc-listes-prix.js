// ============================================================
// CRM GADH — LISTES DE PRIX : import libre d'un tableau d'articles et de prix,
// catalogue lisible avec filtres, grille de prix par article.
// Chargé après gadh-gc-exports.js. Remplace l'écran d'import du catalogue
// (le modèle à trois feuilles reste disponible) et l'écran du catalogue.
// Données : articles, fournisseurs et tarifs aux clés existantes ;
// nouvelle clé gadh_gc_listes_prix (listes importées : conditions, notes, validité).
// ============================================================

// ---------- Montants : jusqu'à 3 décimales (prix au mètre linéaire, ex. 0,031 €) ----------
gcE = function(n){ return (Number(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:3}) + ' €'; };
const GCLP_CLE = 'gadh_gc_listes_prix';
function gclpListes(){ return GC.liste(getJSON(GCLP_CLE, null)); }
function gclpCompact(s){ return GC.norm(s).replace(/ /g, ''); }

// ---------- Reconnaissance des colonnes (aucun modèle imposé) ----------
// Chaque colonne du fichier est reconnue par son nom ; les colonnes non reconnues
// sont gardées comme caractéristiques de l'article (épaisseur, largeur, couleur…).
const GCLP_CHAMPS = {
  ref:{lib:'Code article', test:h => /^(codearticle|code|codeproduit|codeitem|itemcode|reference|referencearticle|ref|refarticle|refproduit|sku|article(code|ref))$/.test(h)},
  designation:{lib:'Désignation', test:h => /^(designation|designationarticle|libelle|libellearticle|nom|nomarticle|article|produit|name|itemname|descriptionarticle)$/.test(h)},
  fournisseur:{lib:'Fournisseur', test:h => /^(fournisseur|supplier|vendor|fabricant)/.test(h)},
  marque:{lib:'Marque', test:h => /^(marque|brand)$/.test(h)},
  gamme:{lib:'Gamme', test:h => /^(gamme|famille|serie|range|collection|ligneproduit)$/.test(h)},
  categorie:{lib:'Catégorie', test:h => /^(categorie|category)$/.test(h)},
  description:{lib:'Description', test:h => /^description/.test(h)},
  unite:{lib:'Unité', test:h => /^(unite|unit|uom|udm)$/.test(h)},
  moq:{lib:'Quantité minimale (MOQ)', test:h => /^(moq|qtemin(imale)?|quantiteminimale|minimumdecommande|minimumcommande)/.test(h)},
  prixAchat:{lib:'Prix d\'achat', test:h => /(achat|purchase|netprice|prixnet|cout)/.test(h) && !/(devise|date)/.test(h)},
  prixVente:{lib:'Prix de vente', test:h => /^(prixvente|prixdevente|pv|prixpublic|sellingprice|price|prix|tarif)/.test(h) && !/\d$/.test(h.replace(/(eur|ht|ttc|ml|tnd)$/, ''))},
  devise:{lib:'Devise', test:h => /^(devise|currency|monnaie)$/.test(h)},
  incoterm:{lib:'Incoterm', test:h => /^incoterm/.test(h)},
  debut:{lib:'Valable du', test:h => /^(validitedebut|debutvalidite|datedebut|debut|validfrom|du)$/.test(h)},
  fin:{lib:'Valable au', test:h => /^(validitefin|finvalidite|datefin|fin|validto|au)$/.test(h)},
  annee:{lib:'Année', test:h => /^(annee|anneeliste|year)$/.test(h)},
  version:{lib:'Version', test:h => /^(version|versionliste|revision|rev)$/.test(h)},
  actif:{lib:'Actif', test:h => /^(actif|active|enabled)$/.test(h)}
};
// Prix de vente par palier : prix_vente_p1, pv2, prix 3, tarif_palier_4…
function gclpPalierCol(h){ const m = /^(prixvente|prixdevente|pv|prix|price|tarif)(p|palier|niveau|tier)?(\d{1,2})(eur|ht|ml)?$/.exec(h); return m ? Number(m[3]) : 0; }
const GCLP_LIB_ATTR = {epaisseur:'Épaisseur', largeur:'Largeur', longueur:'Longueur', longueurrouleau:'Longueur du rouleau', mandrin:'Mandrin', typerouleau:'Type de rouleau', type:'Type',
  couleur:'Couleur', poids:'Poids', grammage:'Grammage', composition:'Composition', matiere:'Matière', finition:'Finition', diametre:'Diamètre', hauteur:'Hauteur', taille:'Taille'};
const GCLP_UNITES = {um:'µm', mm:'mm', cm:'cm', m:'m', ml:'ML', kg:'kg', g:'g', gm2:'g/m²'};
function gclpLibAttr(entete){
  const brut = String(entete || '').trim(), parts = brut.toLowerCase().split(/[_\s]+/).filter(Boolean);
  let unite = '';
  if(parts.length > 1 && GCLP_UNITES[gclpCompact(parts[parts.length - 1])]) unite = GCLP_UNITES[gclpCompact(parts.pop())];
  const cle = gclpCompact(parts.join(' '));
  const lib = GCLP_LIB_ATTR[cle] || (parts.join(' ').charAt(0).toUpperCase() + parts.join(' ').slice(1));
  return lib + (unite ? ' (' + unite + ')' : '');
}
function gclpDetecter(entetes){
  const col = {}, paliers = {}, attributs = [];
  entetes.forEach((e, i) => {
    const h = gclpCompact(e); if(!h) return;
    const p = gclpPalierCol(h);
    if(p){ paliers[p] = i; return; }
    const ch = Object.keys(GCLP_CHAMPS).find(k => col[k] === undefined && GCLP_CHAMPS[k].test(h));
    if(ch) col[ch] = i; else attributs.push(i);
  });
  return {col, paliers, attributs};
}
function gclpDate(v){
  if(v === '' || v == null) return '';
  if(typeof v === 'number' && typeof XLSX !== 'undefined' && v > 20000 && v < 80000){ const d = XLSX.SSF.parse_date_code(v); return d ? d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0') : ''; }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if(m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s); if(m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return '';
}
function gclpNombre(v){ if(v === '' || v == null) return null; if(typeof v === 'number') return isFinite(v) ? v : null; const s = String(v).replace(/[\s  €]/g, '').replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; }
function gclpValAttr(v){ const n = gclpNombre(v); return n !== null && !isNaN(n) ? n : String(v).trim(); }

// ---------- Lecture du fichier : feuilles articles, paliers, conditions, notes ----------
let gclpImport = null;
function gclpLigneEntetes(rows){
  // ligne d'en-têtes : parmi les 10 premières, celle qui reconnaît le plus de champs
  let best = {i:-1, score:0};
  rows.slice(0, 10).forEach((r, i) => {
    const d = gclpDetecter(r.map(x => String(x == null ? '' : x)));
    const score = Object.keys(d.col).length + Object.keys(d.paliers).length + (d.col.ref !== undefined ? 3 : 0) + (d.col.designation !== undefined ? 2 : 0);
    if(score > best.score) best = {i, score, d};
  });
  return best;
}
function gclpAnalyserClasseur(feuilles, nomFichier){
  const I = {fichier:nomFichier, feuilles:[], articles:null, paliers:null, conditions:[], notes:[]};
  feuilles.forEach(({nom, rows}) => {
    rows = rows.filter(r => r.some(c => String(c == null ? '' : c).trim() !== ''));
    const info = {nom, lignes:rows.length, role:'ignorée'};
    I.feuilles.push(info);
    if(!rows.length) return;
    const hp = gclpLigneEntetes(rows);
    const ent = hp.i >= 0 ? rows[hp.i].map(x => String(x == null ? '' : x).trim()) : [];
    const h = ent.map(gclpCompact);
    // feuille de paliers (format long) : code + quantité minimale + prix
    const iRef = h.findIndex(x => GCLP_CHAMPS.ref.test(x)), iMin = h.findIndex(x => /^(qtemin|quantitemin|min|de|from|qtede)/.test(x)), iPrix = h.findIndex(x => /^(prix|price|tarif)/.test(x));
    if(iRef >= 0 && iMin >= 0 && iPrix >= 0 && !(hp.d && Object.keys(hp.d.paliers).length) && h.findIndex(x => /^(designation|libelle)/.test(x)) < 0){
      const iMax = h.findIndex(x => /^(qtemax|quantitemax|max|a|to|qtea)/.test(x)), iType = h.findIndex(x => /^(typeprix|type|nature)$/.test(x)), iPal = h.findIndex(x => /^(palier|niveau|tier|rang)$/.test(x));
      const L = rows.slice(hp.i + 1).map(r => ({ref:String(r[iRef] == null ? '' : r[iRef]).trim(), type:iType >= 0 && /(achat|purchase|net|cout)/i.test(String(r[iType])) ? 'achat' : 'vente',
        palier:iPal >= 0 ? GC.num(r[iPal]) : null, min:gclpNombre(r[iMin]), max:iMax >= 0 ? gclpNombre(r[iMax]) : null, prix:gclpNombre(r[iPrix])})).filter(x => x.ref);
      if(!I.paliers || L.length > I.paliers.lignes.length){ I.paliers = {feuille:nom, lignes:L}; info.role = 'paliers de prix'; }
      return;
    }
    // feuille d'articles : code ou désignation reconnus
    if(hp.d && (hp.d.col.ref !== undefined || hp.d.col.designation !== undefined) && hp.score >= 4){
      const data = rows.slice(hp.i + 1);
      if(!I.articles || data.length > I.articles.lignes.length){ if(I.articles){ const old = I.feuilles.find(f => f.nom === I.articles.feuille); if(old) old.role = 'ignorée'; } I.articles = {feuille:nom, entetes:ent, lignes:data, debut:hp.i + 2, det:hp.d}; info.role = 'articles'; }
      return;
    }
    // feuille de conditions (paramètre / valeur)
    if(rows.length >= 2 && rows.every(r => r.filter(c => String(c == null ? '' : c).trim() !== '').length <= 2) && rows.filter(r => String(r[1] == null ? '' : r[1]).trim() !== '').length >= rows.length / 2){
      I.conditions = rows.filter((r, i) => !(i === 0 && /param|cle|valeur/i.test(String(r[0]) + String(r[1])))).map(r => [String(r[0]).trim(), String(r[1] == null ? '' : r[1]).trim()]);
      info.role = 'conditions'; return;
    }
    // feuille de texte (mode d'emploi, remarques)
    if(rows.every(r => r.filter(c => String(c == null ? '' : c).trim() !== '').length <= 1)){ I.notes = rows.map(r => String(r.find(c => String(c).trim() !== '') || '').trim()).filter(Boolean); info.role = 'notes'; }
  });
  if(I.articles){ I.colonnes = Object.assign({}, I.articles.det.col); I.colPaliers = Object.assign({}, I.articles.det.paliers); }
  // validité, liste, fournisseur : depuis les colonnes ou les conditions
  const cond = (re) => { const c = I.conditions.find(([k]) => re.test(GC.norm(k))); return c ? c[1] : ''; };
  const v = cond(/validite|valable|validity/), dates = (v.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{4}-\d{2}-\d{2}/g) || []).map(gclpDate);
  const premier = (ch) => { if(!I.articles || I.colonnes[ch] === undefined) return ''; const r = I.articles.lignes.find(l => String(l[I.colonnes[ch]] == null ? '' : l[I.colonnes[ch]]).trim() !== ''); return r ? r[I.colonnes[ch]] : ''; };
  I.debut = gclpDate(premier('debut')) || dates[0] || '';
  I.fin = gclpDate(premier('fin')) || dates[1] || '';
  const annee = String(premier('annee') || (I.debut || '').slice(0, 4) || ((String(nomFichier).match(/20\d\d/) || [])[0]) || '');
  if(!I.debut && annee){ I.debut = annee + '-01-01'; I.fin = annee + '-12-31'; }
  I.nom = cond(/^liste|price list|catalogue/) || String(nomFichier).replace(/\.[a-z]+$/i, '').replace(/[_]+/g, ' ');
  I.version = String(premier('version') || '');
  I.fournisseur = cond(/^fournisseur|supplier/) || String(premier('fournisseur') || '');
  I.devise = String(premier('devise') || cond(/devise|currency/).split(/\s/)[0] || '');
  I.incoterm = String(premier('incoterm') || cond(/incoterm/) || '');
  return I;
}
window.gclpChoisirFichier = async (input) => {
  const f = input.files && input.files[0]; if(!f) return;
  try {
    let feuilles;
    if(/\.(csv|txt)$/i.test(f.name)){
      const buf = await f.arrayBuffer(); let t = new TextDecoder('utf-8').decode(buf); if(t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf);
      feuilles = [{nom:f.name, rows:GC.parserCSV(t)}];
    } else {
      await chargerBib('xlsx');
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), {type:'array'});
      feuilles = wb.SheetNames.map(n => ({nom:n, rows:XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:'', raw:true, blankrows:false})}));
    }
    gclpImport = gclpAnalyserClasseur(feuilles, f.name);
    if(!gclpImport.articles){ showToast('Aucune liste d\'articles trouvée : il faut au moins une colonne « code » ou « désignation »'); gclpImport = null; input.value = ''; return; }
    nav('gc-import-catalogue');
  } catch(e){ console.error('Import', e); showToast('Lecture impossible : ' + (e.message || e)); input.value = ''; }
};

// ---------- Construction des articles à partir du fichier ----------
function gclpAnalyse(){
  const I = gclpImport, D = gcD(), C = I.colonnes, A = I.articles, out = [], vus = {};
  const val = (r, ch) => C[ch] === undefined ? '' : (r[C[ch]] == null ? '' : r[C[ch]]);
  const parRef = {};
  (I.paliers ? I.paliers.lignes : []).forEach(p => { const k = GC.normRef(p.ref); (parRef[k] = parRef[k] || []).push(p); });
  A.lignes.forEach((r, i) => {
    const x = {n:A.debut + i, erreurs:[], alertes:[]};
    x.ref = String(val(r, 'ref')).trim(); x.designation = String(val(r, 'designation')).trim();
    if(!x.ref && !x.designation) return; // ligne vide
    ['fournisseur', 'marque', 'gamme', 'categorie', 'description', 'unite', 'devise', 'incoterm', 'version'].forEach(k => { x[k] = String(val(r, k)).trim(); });
    if(!x.fournisseur) x.fournisseur = I.fournisseur || '';
    if(!x.designation) x.designation = [x.gamme, x.ref].filter(Boolean).join(' ') || x.ref;
    x.debut = gclpDate(val(r, 'debut')) || I.debut; x.fin = gclpDate(val(r, 'fin')) || I.fin;
    const act = String(val(r, 'actif')).trim().toLowerCase(); x.actif = !/^(non|no|0|false|faux|inactif)$/.test(act);
    x.moq = gclpNombre(val(r, 'moq')); if(isNaN(x.moq)){ x.alertes.push('MOQ illisible'); x.moq = null; }
    x.attributs = {};
    I.articles.det.attributs.forEach(ci => { const v = r[ci]; if(v !== '' && v != null) x.attributs[I.articles.entetes[ci]] = gclpValAttr(v); });
    // prix de vente : feuille des paliers (bornes exactes) sinon colonnes p1, p2…
    const pl = parRef[GC.normRef(x.ref)] || [];
    let vente = pl.filter(p => p.type === 'vente' && p.prix !== null && !isNaN(p.prix)).map(p => ({palier:p.palier, min:p.min, max:p.max, prix:p.prix}));
    if(!vente.length){
      vente = Object.keys(I.colPaliers).map(Number).sort((a, b) => a - b).map(k => ({palier:k, min:null, max:null, prix:gclpNombre(r[I.colPaliers[k]])})).filter(p => p.prix !== null);
      if(!vente.length && C.prixVente !== undefined){ const pv = gclpNombre(val(r, 'prixVente')); if(pv !== null) vente = [{palier:1, min:null, max:null, prix:pv}]; }
      if(vente.length && x.moq) vente[0].min = x.moq;
      if(vente.length > 1) x.alertes.push('Bornes des paliers 2 à ' + vente.length + ' inconnues : seul le 1er prix est appliqué automatiquement');
    }
    if(vente.some(p => isNaN(p.prix) || p.prix < 0)){ x.erreurs.push('Prix de vente illisible'); vente = vente.filter(p => !isNaN(p.prix) && p.prix >= 0); }
    vente.sort((a, b) => (a.min || 0) - (b.min || 0) || (a.palier || 0) - (b.palier || 0));
    x.grille = vente;
    x.prixVente = vente.length ? vente[0].prix : null;
    x.paliers = vente.slice(1).filter(p => p.min > 0 && p.prix > 0).map(p => ({min:p.min, prix:p.prix}));
    if(!x.moq && vente.length && vente[0].min) x.moq = vente[0].min;
    // prix d'achat
    const achatP = pl.find(p => p.type === 'achat' && p.prix !== null);
    x.prixAchat = C.prixAchat !== undefined ? gclpNombre(val(r, 'prixAchat')) : (achatP ? achatP.prix : null);
    if(x.prixAchat === null && achatP) x.prixAchat = achatP.prix;
    if(isNaN(x.prixAchat)){ x.erreurs.push('Prix d\'achat illisible'); x.prixAchat = null; }
    x.qteAchat = achatP && achatP.min ? achatP.min : (x.moq || 0);
    if(achatP && x.prixAchat !== null && C.prixAchat !== undefined && Math.abs(achatP.prix - x.prixAchat) > 1e-9) x.alertes.push('Prix d\'achat différent dans la feuille des paliers (' + achatP.prix + ')');
    if(x.prixAchat !== null && x.prixVente !== null && x.prixVente < x.prixAchat) x.alertes.push('Prix de vente inférieur au prix d\'achat');
    if(x.paliers.some((p, k) => k && p.prix > x.paliers[k - 1].prix) || (x.paliers[0] && x.paliers[0].prix > x.prixVente)) x.alertes.push('Un palier plus élevé coûte plus cher');
    // doublons et correspondance avec le catalogue
    const k = GC.normRef(x.ref || x.designation);
    if(vus[k]){ x.erreurs.push('Code déjà présent ligne ' + vus[k]); } else vus[k] = x.n;
    const anc = x.ref ? D.articles.find(a => GC.normRef(a.ref) === GC.normRef(x.ref)) : D.articles.find(a => GC.norm(a.designation) === GC.norm(x.designation));
    x.articleId = anc ? anc.id : ''; x.action = anc ? 'maj' : 'creation';
    if(anc) x.change = GC.num(anc.prixVente) !== GC.num(x.prixVente) || GC.num(anc.prixAchat) !== GC.num(x.prixAchat) || JSON.stringify(GC.liste(anc.paliers)) !== JSON.stringify(x.paliers);
    x.ok = !x.erreurs.length;
    out.push(x);
  });
  return out;
}

// ---------- Écran d'import ----------
let gclpModeAncien = false;
const gclpAncienImport = renderGcImportCatalogue;
renderGcImportCatalogue = function(main){
  if(gclpModeAncien) return gclpAncienImport(main);
  const ed = gcPeut();
  const b = gcSection(main, gcRetour('gc-catalogue', 'Importer une liste d\'articles et de prix'), '');
  if(!ed){ b.innerHTML = '<div class="card">Consultation seulement.</div>'; return; }
  if(!gclpImport){
    b.innerHTML = `<div class="card"><h3 class="gc-h3">Choisissez votre fichier tel qu'il est</h3>
      <p style="margin-top:0;">Excel (.xlsx, .xls) ou CSV. <b>Aucun modèle à respecter</b> : les colonnes sont reconnues par leur nom (code article, désignation, fournisseur, marque, gamme, unité, MOQ, prix d'achat, prix de vente ou prix par palier p1, p2…, validité). Les autres colonnes (épaisseur, largeur, couleur…) sont gardées comme caractéristiques et deviennent des filtres du catalogue.</p>
      <p class="gc-sous">Si le classeur contient une feuille de paliers (une ligne par article et par palier, avec quantité minimale et prix), les bornes exactes sont reprises. Une feuille « paramètre / valeur » est gardée comme conditions de la liste. Rien n'est enregistré avant votre validation.</p>
      <input type="file" id="gc-cat-fichier" data-gc="fichier-liste-prix" accept=".xlsx,.xls,.csv,.txt" onchange="gclpChoisirFichier(this)"></div>
      <div class="card"><div class="gc-sous">Pour importer aussi des fournisseurs et des clients avec le modèle Excel à trois feuilles :
      <a href="#" data-gc="import-ancien-modele" onclick="gclpModeAncien = true; nav('gc-import-catalogue'); return false;">ouvrir l'import par modèle</a>.</div></div>`;
    return;
  }
  const I = gclpImport, L = gclpAnalyse(), ok = L.filter(x => x.ok), cre = ok.filter(x => x.action === 'creation').length, maj = ok.filter(x => x.action === 'maj').length;
  const fours = Array.from(new Set(ok.map(x => x.fournisseur).filter(Boolean))), D = gcD();
  const nouveauxF = fours.filter(n => !D.fournisseurs.some(f => GC.norm(f.nom) === GC.norm(n)));
  const nbAlertes = L.filter(x => x.alertes.length).length;
  const optsCol = (ch) => gcOpts(I.articles.entetes.map((e, i) => [i, e]), I.colonnes[ch], '— aucune —');
  const roles = I.feuilles.map(f => `<span class="gc-tag" style="margin:2px 4px 2px 0;">${esc(f.nom)} · ${f.lignes} ligne(s) · <b>${esc(f.role)}</b></span>`).join('');
  b.innerHTML = `<div class="card" data-gc="resume-import"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><div><b>${esc(I.fichier)}</b><div style="margin-top:4px;">${roles}</div></div>
      <button class="btn btn-ghost" onclick="gclpImport = null; nav('gc-import-catalogue')">Autre fichier</button></div>
      <div class="gc-chiffres" style="margin-top:10px;"><div class="gc-chiffre"><span>Articles lus</span><b>${L.length}</b></div><div class="gc-chiffre good"><span>Nouveaux</span><b>${cre}</b></div><div class="gc-chiffre"><span>Mis à jour</span><b>${maj}</b></div>
        <div class="gc-chiffre ${L.length - ok.length ? 'bad' : ''}"><span>Refusés</span><b>${L.length - ok.length}</b></div><div class="gc-chiffre ${nbAlertes ? 'warn' : ''}"><span>À vérifier</span><b>${nbAlertes}</b></div>
        <div class="gc-chiffre"><span>Prix par palier</span><b>${ok.reduce((s, x) => s + x.grille.length, 0)}</b></div></div>
      ${nouveauxF.length ? `<div class="gc-sous">Fournisseur(s) créé(s) : ${nouveauxF.map(esc).join(', ')}</div>` : ''}</div>
    <div class="card"><h3 class="gc-h3">Liste de prix</h3><div class="gc-form">
      ${mgtChamp('Nom de la liste', 'gclp-nom', I.nom)}${mgtChamp('Version', 'gclp-version', I.version)}
      ${mgtChamp('Prix valables du', 'gclp-debut', I.debut, 'date')}${mgtChamp('au', 'gclp-fin', I.fin, 'date')}</div>
      <div class="gc-sous">Les prix d'achat deviennent des tarifs fournisseurs valables sur cette période ; les prix de vente et leurs paliers remplacent ceux du catalogue (les anciens prix restent dans l'historique de chaque article).${I.devise ? ' Devise du fichier : <b>' + esc(I.devise) + '</b>.' : ''}</div>
      ${I.conditions.length ? `<details style="margin-top:8px;"><summary class="gc-sous" style="cursor:pointer;">Conditions lues (${I.conditions.length})</summary>${I.conditions.map(([k, v]) => `<div class="gc-sous" style="padding:2px 0;"><b>${esc(k)}</b> : ${esc(v)}</div>`).join('')}</details>` : ''}
      ${I.notes.length ? `<details style="margin-top:4px;"><summary class="gc-sous" style="cursor:pointer;">Remarques du fichier (${I.notes.length})</summary>${I.notes.map(n => `<div class="gc-sous" style="padding:2px 0;">${esc(n)}</div>`).join('')}</details>` : ''}</div>
    <details class="card"><summary style="cursor:pointer;"><b>Colonnes reconnues</b> <span class="gc-sous">(${Object.keys(I.colonnes).length} champs, ${Object.keys(I.colPaliers).length} prix par palier, ${I.articles.det.attributs.length} caractéristiques) · modifier si besoin</span></summary>
      <div class="gc-form" style="margin-top:10px;">${['ref', 'designation', 'fournisseur', 'marque', 'gamme', 'unite', 'moq', 'prixAchat', 'prixVente'].map(ch => `<div class="field"><label>${GCLP_CHAMPS[ch].lib}</label><select onchange="gclpImport.colonnes['${ch}'] = this.value === '' ? undefined : Number(this.value); nav('gc-import-catalogue')">${optsCol(ch)}</select></div>`).join('')}</div>
      <div class="gc-sous">Caractéristiques gardées : ${I.articles.det.attributs.map(i => esc(gclpLibAttr(I.articles.entetes[i]))).join(', ') || 'aucune'}.</div></details>
    <div class="gct-scroll"><table class="gct-t" data-gc="apercu-import"><thead><tr><th>Ligne</th><th>Action</th><th>Code</th><th>Désignation</th><th class="n">MOQ</th><th class="n">Prix d'achat</th><th class="n">Prix de vente</th><th class="n">Paliers</th><th>Contrôle</th></tr></thead><tbody>
      ${L.map(x => `<tr><td data-l="Ligne">${x.n}</td><td data-l="Action">${!x.ok ? '<b style="color:var(--bad);">Refusé</b>' : x.action === 'maj' ? (x.change ? 'Mise à jour' : 'Inchangé') : '<span style="color:var(--good);">Nouveau</span>'}</td>
        <td data-l="Code">${esc(x.ref)}</td><td data-l="Désignation">${esc(x.designation)}</td><td class="n" data-l="MOQ">${x.moq ? gcQ(x.moq) + ' ' + esc(x.unite) : '—'}</td>
        <td class="n" data-l="Prix d'achat">${x.prixAchat === null ? '—' : gcE(x.prixAchat)}</td><td class="n" data-l="Prix de vente">${x.prixVente === null ? '—' : gcE(x.prixVente)}</td><td class="n" data-l="Paliers">${x.grille.length}</td>
        <td data-l="Contrôle">${x.erreurs.map(e => `<div style="color:var(--bad);">${esc(e)}</div>`).join('')}${x.alertes.map(e => `<div style="color:var(--warn);">${esc(e)}</div>`).join('')}${!x.erreurs.length && !x.alertes.length ? '<span style="color:var(--good);">OK</span>' : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-ghost" style="flex:1;" onclick="gclpImport = null; nav('gc-import-catalogue')">Annuler</button>
      <button class="btn btn-primary" style="flex:2;" ${ok.length ? '' : 'disabled'} data-gc="valider-import-catalogue" onclick="gclpValider()">Importer ${ok.length} article(s)</button></div>`;
};
// retour à l'import libre en quittant l'écran du modèle
const gclpNavOrigine = nav;
nav = function(tab){ if(tab !== 'gc-import-catalogue') gclpModeAncien = false; return gclpNavOrigine(tab); };

window.gclpValider = () => gcOperation(() => {
  const I = gclpImport, L = gclpAnalyse().filter(x => x.ok), D = gcD(), ctx = gcCtx(), R = gcReglages();
  const nom = gcVal('gclp-nom') || I.nom, version = gcVal('gclp-version'), debut = gcVal('gclp-debut'), fin = gcVal('gclp-fin');
  if(debut && fin && fin < debut){ showToast('La date de fin est avant la date de début'); return; }
  const fours = D.fournisseurs.slice(), nouveauxF = [];
  const fourDe = (n) => { if(!n) return ''; let f = fours.find(y => GC.norm(y.nom) === GC.norm(n)); if(!f){ f = {id:GC.nouvelId('fo'), nom:n, actif:true, delai:Number(R.delaiDefaut) || 7, conditions:''}; fours.push(f); nouveauxF.push(f); } return f.id; };
  const listeId = (gclpListes().find(l => GC.norm(l.nom) === GC.norm(nom) && String(l.version || '') === String(version || '')) || {}).id || GC.nouvelId('lp');
  const articles = [], tarifs = [];
  L.forEach(x => {
    const anc = x.articleId ? D.articles.find(a => a.id === x.articleId) : null;
    const n = Object.assign({}, anc || {id:GC.nouvelId('ar'), suiviStock:true, actif:true, paliers:[], histoPrix:[], seuil:0});
    n.ref = x.ref || n.ref || ''; n.designation = x.designation;
    if(x.unite) n.unite = x.unite; if(x.marque) n.marque = x.marque; if(x.gamme) n.gamme = x.gamme;
    n.categorie = x.categorie || n.categorie || x.gamme || x.marque || '';
    if(x.description) n.description = x.description;
    const fid = fourDe(x.fournisseur); if(fid) n.fournisseurId = fid;
    if(x.moq) n.moq = x.moq;
    n.attributs = Object.assign({}, n.attributs || {}, x.attributs);
    n.devise = x.devise || I.devise || n.devise || ''; if(x.incoterm) n.incoterm = x.incoterm;
    n.actif = x.actif;
    n.histoPrix = GC.liste(n.histoPrix).slice();
    if(x.prixAchat !== null && GC.num(x.prixAchat) !== GC.num(n.prixAchat)){ n.histoPrix.push({date:ctx.date, ts:ctx.ts, par:ctx.par, champ:'achat', ancien:anc ? GC.num(anc.prixAchat) : null, nouveau:x.prixAchat, source:'import ' + nom}); n.prixAchat = x.prixAchat; }
    if(x.prixVente !== null && GC.num(x.prixVente) !== GC.num(n.prixVente)){ n.histoPrix.push({date:ctx.date, ts:ctx.ts, par:ctx.par, champ:'vente', ancien:anc ? GC.num(anc.prixVente) : null, nouveau:x.prixVente, source:'import ' + nom}); n.prixVente = x.prixVente; }
    if(x.grille.length){ n.paliers = x.paliers; n.grille = x.grille; }
    n.listePrix = {id:listeId, nom, version, debut, fin};
    articles.push(n);
    // tarif d'achat du fournisseur sur la période (mis à jour s'il existe déjà)
    if(fid && x.prixAchat !== null){
      const t0 = D.tarifs.find(t => t.articleId === n.id && t.fournisseurId === fid && (t.debut || '') === (debut || '') && (t.fin || '') === (fin || '') && !t.archive);
      tarifs.push(Object.assign({}, t0 || {id:GC.nouvelId('ta')}, {articleId:n.id, fournisseurId:fid, prix:x.prixAchat, qteMin:x.qteAchat || 0, debut, fin, refFournisseur:x.ref, devise:n.devise, liste:nom + (version ? ' ' + version : '')}));
    }
  });
  if(nouveauxF.length) gcEnregistrer('fournisseurs', nouveauxF);
  gcEnregistrer('articles', articles);
  if(tarifs.length) gcEnregistrer('tarifs', tarifs);
  const liste = {id:listeId, nom, version, debut, fin, fournisseur:I.fournisseur || (L[0] || {}).fournisseur || '', devise:I.devise, incoterm:I.incoterm, conditions:I.conditions, notes:I.notes,
    fichier:I.fichier, nbArticles:articles.length, nbPrix:L.reduce((s, x) => s + x.grille.length, 0), date:ctx.date, ts:ctx.ts, par:ctx.par};
  setJSON(GCLP_CLE, gclpListes().filter(l => l.id !== listeId).concat([liste]));
  gcJournal('Import', 'Liste de prix', {id:listeId, numero:nom + (version ? ' ' + version : '')}, articles.length + ' article(s) (' + L.filter(x => x.action === 'creation').length + ' nouveau(x)), ' + tarifs.length + ' tarif(s) d\'achat' + (nouveauxF.length ? ', ' + nouveauxF.length + ' fournisseur(s) créé(s)' : '') + ' · fichier ' + I.fichier);
  gclpImport = null; gcTabs.catalogue = null;
  showToast(articles.length + ' article(s) importé(s) · ' + tarifs.length + ' tarif(s) d\'achat');
  nav('gc-catalogue');
});

// ---------- Catalogue : lisible, avec filtres ----------
function gclpAttributsCatalogue(articles){
  // caractéristiques présentes, avec leurs valeurs distinctes
  const m = {};
  articles.forEach(a => Object.keys(a.attributs || {}).forEach(k => { const v = a.attributs[k]; if(v === '' || v == null) return; (m[k] = m[k] || new Set()).add(v); }));
  return Object.keys(m).map(k => ({cle:k, lib:gclpLibAttr(k), valeurs:Array.from(m[k]).sort((x, y) => typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', {numeric:true}))}));
}
function gclpFiltreValeurs(lib, tous, valeurs, test, id){
  return {id, label:lib, options:[['', lib + ' : tous']].concat(valeurs.map(v => [String(v), lib + ' : ' + v])), test};
}
function gclpUniteCommune(articles){ const u = Array.from(new Set(articles.map(a => a.unite).filter(Boolean))); return u.length === 1 ? u[0] : ''; }
function gclpMarge(a){ const pa = GC.num(a.prixAchat), pv = GC.num(a.prixVente); return pa > 0 && pv > 0 ? (pv - pa) / pv * 100 : null; }
renderGcCatalogue = function(main){
  const D = gcD(), ed = gcPeut(), actifs = D.articles.filter(a => !a.archive);
  const b = gcSection(main, 'Catalogue articles', (ed ? `<button class="btn btn-primary" data-gc="importer-liste-prix" onclick="nav('gc-import-catalogue')">Importer une liste de prix</button><button class="btn btn-ghost" data-gc="nouvel-article" onclick="gcFormArticle()">+ Article</button>` : '') + gcBoutonsExport('catalogue'));
  const attrs = gclpAttributsCatalogue(actifs), varies = attrs.filter(x => x.valeurs.length > 1 && x.valeurs.length <= 40);
  const uniq = (k) => Array.from(new Set(actifs.map(a => a[k]).filter(Boolean))).sort((x, y) => String(x).localeCompare(String(y), 'fr', {numeric:true}));
  const marques = uniq('marque'), gammes = uniq('gamme'), fids = uniq('fournisseurId'), cats = uniq('categorie');
  const filtres = [];
  if(marques.length > 1) filtres.push(gclpFiltreValeurs('Marque', '', marques, (a, v) => a.marque === v, 'marque'));
  if(gammes.length > 1) filtres.push(gclpFiltreValeurs('Gamme', '', gammes, (a, v) => a.gamme === v, 'gamme'));
  if(!gammes.length && cats.length > 1) filtres.push(gclpFiltreValeurs('Catégorie', '', cats, (a, v) => a.categorie === v, 'cat'));
  varies.forEach((x, i) => filtres.push(gclpFiltreValeurs(x.lib, '', x.valeurs, (a, v) => String((a.attributs || {})[x.cle]) === v, 'at' + i)));
  if(fids.length > 1) filtres.push({id:'four', label:'Fournisseur', options:[['', 'Fournisseur : tous']].concat(fids.map(id => [id, 'Fournisseur : ' + gcNomFour(id)])), test:(a, v) => a.fournisseurId === v});
  filtres.push({id:'statut', label:'Statut', defaut:'actifs', options:[['actifs', 'Actifs'], ['inactifs', 'Inactifs'], ['archives', 'Archivés'], ['', 'Tous les statuts']], test:(a, v) => v === 'actifs' ? !a.archive && a.actif !== false : v === 'inactifs' ? !a.archive && a.actif === false : !!a.archive});
  // colonnes : l'essentiel ; les caractéristiques qui varient deviennent des colonnes (3 au plus)
  const u = gclpUniteCommune(actifs), su = u ? ' (€/' + u + ')' : '';
  const colsAttr = varies.filter(x => !/description/i.test(x.cle)).slice(0, 3).map(x => ({titre:x.lib, num:typeof x.valeurs[0] === 'number', tri:a => { const v = (a.attributs || {})[x.cle]; return v === undefined ? (typeof x.valeurs[0] === 'number' ? -1 : '') : v; }, html:a => { const v = (a.attributs || {})[x.cle]; return v === undefined ? '—' : esc(typeof v === 'number' ? gcQ(v) : v); }}));
  const listes = gclpListes().slice().sort((x, y) => (y.ts || 0) - (x.ts || 0));
  const st = gcTabs.catalogue, nbFiltres = st ? Object.keys(st.f).filter(k => st.f[k] !== '' && !(k === 'statut' && st.f[k] === 'actifs')).length + (st.q ? 1 : 0) : 0;
  b.innerHTML = (listes.length ? `<div class="card gclp-listes">${listes.slice(0, 3).map(l => `<div class="gclp-liste"><div><b>${esc(l.nom)}</b>${l.version && l.nom.indexOf(l.version) < 0 ? ' <span class="gc-tag">' + esc(l.version) + '</span>' : ''}<div class="gc-sous">${esc(l.fournisseur || '')}${l.debut ? ' · valable du ' + gcDt(l.debut) + ' au ' + gcDt(l.fin) : ''}${l.devise ? ' · ' + esc(l.devise) : ''}${l.incoterm ? ' · ' + esc(l.incoterm) : ''} · ${l.nbArticles} article(s)</div></div>
      <button class="btn btn-ghost" data-gc="conditions-liste" onclick="gclpConditions('${l.id}')">Conditions</button></div>`).join('')}</div>` : '')
    + (nbFiltres ? `<div class="gc-sous no-print" style="margin:0 0 6px;"><a href="#" data-gc="effacer-filtres" onclick="gcTabs.catalogue = null; nav('gc-catalogue'); return false;">Effacer les filtres et la recherche</a></div>` : '')
    + gcTable({id:'catalogue', lignes:() => gcD().articles, tri:0, parPage:50, placeholder:'Rechercher un code, une désignation, une gamme…',
    texte:a => [a.ref, a.designation, a.marque, a.gamme, a.categorie, a.description, gcNomFour(a.fournisseurId)].concat(Object.values(a.attributs || {})).join(' '),
    filtres,
    colonnes:[
      {titre:'Code', val:a => a.ref || '', html:a => `<b class="gclp-code">${esc(a.ref || '—')}</b>`},
      {titre:'Article', val:a => a.designation || '', html:a => `<div class="gclp-art"><b>${esc(a.designation || '')}</b>${a.archive ? '<span class="gc-tag">archivé</span>' : a.actif === false ? '<span class="gc-tag">inactif</span>' : ''}<div class="gc-sous">${esc([a.marque, a.gamme && GC.norm(a.designation).indexOf(GC.norm(a.gamme)) < 0 ? a.gamme : '', !a.marque && !a.gamme ? a.categorie : ''].filter(Boolean).join(' · '))}</div></div>`}
    ].concat(colsAttr).concat([
      {titre:'MOQ', num:true, tri:a => GC.num(a.moq), html:a => a.moq ? gcQ(a.moq) + (a.unite ? ' ' + esc(a.unite) : '') : '—'},
      {titre:'Prix d\'achat' + su, num:true, tri:a => GC.num(a.prixAchat), html:a => a.prixAchat ? gcE(a.prixAchat) : '—'},
      {titre:'Prix de vente' + su, num:true, tri:a => GC.num(a.prixVente), html:a => a.prixVente ? `<b>${gcE(a.prixVente)}</b>${GC.liste(a.paliers).length ? `<div class="gc-sous">dégressif jusqu'à ${gcE(GC.liste(a.paliers)[GC.liste(a.paliers).length - 1].prix)}</div>` : ''}` : '—'},
      {titre:'Taux de marque', num:true, tri:a => gclpMarge(a) === null ? -999 : gclpMarge(a), html:a => { const m = gclpMarge(a); return m === null ? '—' : `<span style="color:${m < 0 ? 'var(--bad)' : 'inherit'};">${gcPct(m)}</span>`; }}
    ]),
    clic:a => `gcOuvrir('gc-article', '${a.id}')`, vide:'Aucun article', videSous:ed ? 'Importez votre liste de prix (Excel ou CSV), telle quelle.' : ''});
};
window.gclpConditions = (id) => {
  const l = gclpListes().find(x => x.id === id); if(!l) return;
  mgtModal(esc(l.nom), `<div class="gc-kv" style="margin-bottom:10px;"><div><span>Fournisseur</span><b>${esc(l.fournisseur || '—')}</b></div><div><span>Version</span><b>${esc(l.version || '—')}</b></div><div><span>Validité</span><b>${l.debut ? gcDt(l.debut) + ' → ' + gcDt(l.fin) : '—'}</b></div>
    <div><span>Articles</span><b>${l.nbArticles}</b></div><div><span>Prix par palier</span><b>${l.nbPrix || 0}</b></div><div><span>Importée le</span><b>${gcDt(l.date)} · ${esc(l.par || '')}</b></div></div>
    ${GC.liste(l.conditions).length ? `<h4 style="margin:6px 0;">Conditions</h4>${l.conditions.map(([k, v]) => `<div class="session-row"><span>${esc(k)}</span><b style="text-align:right;">${esc(v)}</b></div>`).join('')}` : ''}
    ${GC.liste(l.notes).length ? `<h4 style="margin:12px 0 6px;">Remarques</h4>${l.notes.map(n => `<div class="gc-sous" style="padding:3px 0;">${esc(n)}</div>`).join('')}` : ''}
    <div class="gc-sous" style="margin-top:10px;">Fichier d'origine : ${esc(l.fichier || '')}</div>`);
};

// ---------- Fiche article : caractéristiques, grille de prix, calculateur ----------
function gclpGrille(a){
  // grille affichée : celle du fichier si elle correspond toujours aux prix de l'article, sinon recalculée
  const base = [{palier:1, min:GC.num(a.moq) || null, max:null, prix:GC.num(a.prixVente)}].concat(GC.liste(a.paliers).slice().sort((x, y) => x.min - y.min).map((p, i) => ({palier:i + 2, min:p.min, max:null, prix:p.prix})));
  const g = GC.liste(a.grille);
  if(g.length === base.length && g.every((x, i) => Math.abs(GC.num(x.prix) - base[i].prix) < 1e-9 && (i === 0 || GC.num(x.min) === base[i].min))) return g;
  base.forEach((x, i) => { if(base[i + 1] && base[i + 1].min) x.max = null; });
  return base;
}
const gclpAncienneFiche = renderGcArticle;
renderGcArticle = function(main){
  gclpAncienneFiche(main);
  const a = gcD().articles.find(x => x.id === gcOuvert['gc-article']), body = document.getElementById('gc-body');
  if(!a || !body) return;
  const g = gclpGrille(a), pa = GC.num(a.prixAchat), u = a.unite ? esc(a.unite) : '';
  const attrs = Object.keys(a.attributs || {});
  const lignesG = g.map((p, i) => { const marge = pa > 0 && p.prix > 0 ? (p.prix - pa) / p.prix * 100 : null;
    const borne = p.min && p.max ? 'de ' + gcQ(p.min) + ' à ' + gcQ(p.max) : p.min ? (i === g.length - 1 || !g[i + 1] ? 'à partir de ' + gcQ(p.min) : 'à partir de ' + gcQ(p.min)) : 'prix de base';
    return `<tr><td data-l="Palier">${p.palier || i + 1}</td><td data-l="Quantité">${borne} ${p.min ? u : ''}</td><td class="n" data-l="Prix de vente"><b>${gcE(p.prix)}</b></td><td class="n" data-l="Taux de marque">${marge === null ? '—' : gcPct(marge)}</td></tr>`; }).join('');
  const html = `<div class="card" data-gc="grille-prix"><h3 class="gc-h3">Prix${a.listePrix ? ' · ' + esc(a.listePrix.nom) + (a.listePrix.version && a.listePrix.nom.indexOf(a.listePrix.version) < 0 ? ' ' + esc(a.listePrix.version) : '') : ''}</h3>
      ${a.listePrix && a.listePrix.debut ? `<div class="gc-sous" style="margin-bottom:6px;">Valable du ${gcDt(a.listePrix.debut)} au ${gcDt(a.listePrix.fin)}${a.devise ? ' · ' + esc(a.devise) : ''}${a.incoterm ? ' · ' + esc(a.incoterm) : ''}</div>` : ''}
      <div class="gc-chiffres"><div class="gc-chiffre"><span>Prix d'achat net${u ? ' / ' + u : ''}</span><b>${pa ? gcE(pa) : '—'}</b></div><div class="gc-chiffre"><span>Quantité minimale (MOQ)</span><b>${a.moq ? gcQ(a.moq) + ' ' + u : '—'}</b></div><div class="gc-chiffre"><span>Fournisseur</span><b style="font-size:14px;">${esc(a.fournisseurId ? gcNomFour(a.fournisseurId) : '—')}</b></div></div>
      ${g.length ? `<div style="overflow-x:auto;"><table class="gc-lignes"><thead><tr><th>Palier</th><th>Quantité</th><th class="n">Prix de vente${u ? ' / ' + u : ''}</th><th class="n" title="Marge ÷ prix de vente">Taux de marque</th></tr></thead><tbody>${lignesG}</tbody></table></div>` : ''}
      <div class="gclp-calc no-print"><label>Calculer pour une quantité<input type="number" id="gclp-qte" min="0" step="any" value="${gcAttr(a.moq || 1)}" oninput="gclpCalculer('${a.id}')"></label><div id="gclp-res"></div></div></div>
    ${attrs.length || a.marque || a.gamme || a.description ? `<div class="card"><h3 class="gc-h3">Caractéristiques</h3><div class="gc-kv">
      ${a.marque ? `<div><span>Marque</span><b>${esc(a.marque)}</b></div>` : ''}${a.gamme ? `<div><span>Gamme</span><b>${esc(a.gamme)}</b></div>` : ''}
      ${attrs.map(k => `<div><span>${esc(gclpLibAttr(k))}</span><b>${esc(typeof a.attributs[k] === 'number' ? gcQ(a.attributs[k]) : a.attributs[k])}</b></div>`).join('')}</div>
      ${a.description ? `<div class="gc-sous" style="margin-top:8px;">${esc(a.description)}</div>` : ''}</div>` : ''}`;
  body.insertAdjacentHTML('afterbegin', html);
  gclpCalculer(a.id);
};
window.gclpCalculer = (id) => {
  const a = gcD().articles.find(x => x.id === id), z = document.getElementById('gclp-res'); if(!a || !z) return;
  const q = GC.num(gcVal('gclp-qte')), p = GC.prixPalier(a, q), pa = GC.num(a.prixAchat), g = gclpGrille(a);
  if(!(q > 0)){ z.innerHTML = ''; return; }
  const trou = g.find((x, i) => x.max && g[i + 1] && g[i + 1].min && q > x.max && q < g[i + 1].min);
  const avert = a.moq && q < a.moq ? `<div style="color:var(--warn);">En dessous de la quantité minimale (${gcQ(a.moq)} ${esc(a.unite || '')}).</div>` : trou ? `<div style="color:var(--warn);">Quantité entre deux paliers (${gcQ(trou.max)} – ${gcQ(g[g.indexOf(trou) + 1].min)}) non définie par le fournisseur : prix du palier inférieur appliqué.</div>` : '';
  z.innerHTML = `<div class="gc-chiffres" style="margin:8px 0 0;"><div class="gc-chiffre"><span>Prix unitaire</span><b>${gcE(p.prix)}</b></div><div class="gc-chiffre"><span>Total HT</span><b>${gcE(GC.r2(p.prix * q))}</b></div>
    <div class="gc-chiffre"><span>Coût d'achat</span><b>${pa ? gcE(GC.r2(pa * q)) : '—'}</b></div><div class="gc-chiffre ${pa && p.prix < pa ? 'bad' : 'good'}"><span>Marge</span><b>${pa ? gcE(GC.r2((p.prix - pa) * q)) : '—'}</b></div></div>${avert}`;
};

// ---------- Exports du catalogue : caractéristiques et paliers ----------
const gclpAnciensExports = gcDefExports;
gcDefExports = function(){
  const d = gclpAnciensExports(), D = gcD(), attrs = gclpAttributsCatalogue(D.articles.filter(a => !a.archive));
  const maxP = Math.max(1, ...D.articles.map(a => gclpGrille(a).length));
  const borne = (p) => p ? (p.min && p.max ? gcQ(p.min) + '-' + gcQ(p.max) : p.min ? '>= ' + gcQ(p.min) : '') : '';
  d.catalogue = {titre:'Catalogue des articles', cols:[['Code', a => a.ref, 't'], ['Désignation', a => a.designation, 't'], ['Fournisseur', a => a.fournisseurId ? gcNomFour(a.fournisseurId) : '', 't'], ['Marque', a => a.marque || '', 't'], ['Gamme', a => a.gamme || a.categorie || '', 't']]
    .concat(attrs.filter(x => !/description/i.test(x.cle)).map(x => [x.lib, a => { const v = (a.attributs || {})[x.cle]; return v === undefined ? '' : v; }, 'v']))
    .concat([['Unité', a => a.unite, 't'], ['MOQ', a => a.moq ? GC.num(a.moq) : '', 'q'], ['Prix d\'achat net', a => a.prixAchat ? GC.num(a.prixAchat) : '', 'n3']])
    .concat(Array.from({length:maxP}, (_, i) => [['Palier ' + (i + 1) + ' (quantité)', a => borne(gclpGrille(a)[i]), 't'], ['Palier ' + (i + 1) + ' (prix)', a => { const p = gclpGrille(a)[i]; return p ? GC.num(p.prix) : ''; }, 'n3']]).reduce((s, x) => s.concat(x), []))
    .concat([['Devise', a => a.devise || '', 't'], ['Valable du', a => (a.listePrix || {}).debut || '', 'd'], ['Valable au', a => (a.listePrix || {}).fin || '', 'd'], ['Statut', a => a.archive ? 'Archivé' : a.actif === false ? 'Inactif' : 'Actif', 't']])};
  return d;
};
const gclpAncienFmt = gcFmtCellule;
gcFmtCellule = function(v, t){
  if(t === 'n3') return v === '' || v === null || v === undefined ? '' : (Number(v) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:4});
  if(t === 'v') return v === '' || v == null ? '' : typeof v === 'number' ? gcQ(v) : String(v);
  return gclpAncienFmt(v, t);
};

// ---------- Styles ----------
(function(){
  const s = document.createElement('style');
  s.textContent = `
  .gclp-listes{display:flex;flex-direction:column;gap:8px;padding:12px 14px;}
  .gclp-liste{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;}
  .gclp-code{font-family:'IBM Plex Mono',ui-monospace,Consolas,monospace;font-size:12.5px;white-space:nowrap;}
  .gclp-art b{font-weight:600;}
  @media (min-width:761px){
    .gct[data-gct="catalogue"] .gct-t td,.gct[data-gct="catalogue"] .gct-t th{padding:7px 8px;}
    .gct[data-gct="catalogue"] .gclp-art{min-width:220px;max-width:340px;white-space:normal;}
    .gct[data-gct="catalogue"] .gct-t th{white-space:normal;vertical-align:bottom;}
  }
  .gclp-calc{margin-top:10px;padding-top:10px;border-top:1px solid var(--border);}
  .gclp-calc label{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;font-weight:600;color:var(--ink-soft);}
  .gclp-calc input{width:160px;padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);color:var(--ink);font-size:15px;}
  .gct[data-gct="catalogue"] .gct-f{max-width:220px;}
  `;
  document.head.appendChild(s);
})();

// Sous-titre des exports : « Marque : Marque : X » → « Marque : X » (libellé repris dans l'option du filtre).
const gclpAncienModeleListe = gcModeleListe;
gcModeleListe = function(cle){ const m = gclpAncienModeleListe(cle); if(m && m.sous) m.sous = m.sous.replace(/([^·:]+?) : \1 : /g, '$1 : '); return m; };
