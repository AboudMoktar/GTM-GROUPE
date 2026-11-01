// ============================================================
// GADH TUNISIA — ACHATS ET STOCK (fournisseurs, articles, bons d'achat)
// ============================================================
// Module « Achats et stock » de GADH : achats de matières, accessoires et
// machines auprès des fournisseurs.
//  - Fournisseurs : fiche (contact, matricule fiscal, RIB…), total acheté, reste à payer.
//  - Articles : matière, accessoire ou machine ; unité, seuil d'alerte, dernier prix.
//  - Bons d'achat : lignes (quantité × prix HT, TVA), frais, timbre ; commande,
//    réception (partielle ou totale), paiements (partiels), impression.
//  - Stock : les matières et accessoires entrent en stock à la réception ; sorties
//    (consommation, perte) et inventaire. Les machines ne sont pas suivies en stock.
// Données (dossier Firebase gadh/, une clé par collection) :
//   gadh_achat_fournisseurs, gadh_achat_articles, gadh_achat_bons,
//   gadh_achat_mouvements, gadh_achat_compteurs.
// Droits : roles-config.js (ressource gadh.achats). Les boutons de saisie ne
// s'affichent que si le rôle peut écrire ; les règles Firebase l'imposent aussi.

const ACH = {four:'gadh_achat_fournisseurs', art:'gadh_achat_articles', bons:'gadh_achat_bons', mv:'gadh_achat_mouvements', cpt:'gadh_achat_compteurs'};
const ACH_CATEGORIES = {matiere:'Matière', accessoire:'Accessoire', machine:'Machine', produit:'Produit / prestation'};
// Seuls les matières et accessoires sont suivis en stock (machines et produits / prestations : non).
function achSuiviStock(a){ return !!a && (a.categorie === 'matiere' || a.categorie === 'accessoire'); }
const ACH_TVA = [0, 7, 13, 19];
const ACH_MODES = [['virement', 'Virement'], ['cheque', 'Chèque'], ['traite', 'Traite'], ['especes', 'Espèces']];
const ACH_UNITES = ['pièce', 'mètre', 'kg', 'rouleau', 'boîte', 'litre', 'paquet', 'lot'];
let achFiltre = 'encours', achBonOuvert = null, achBonEdite = null, achArtFiltre = 'tous', achFourOuvert = null;

function achGet(k){ return getJSON(ACH[k], {}) || {}; }
function achSet(k, v){ setJSON(ACH[k], v); }
function achListe(v){ return Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]).filter(x => x != null) : []); }
function achDT(n){ return (Number(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €'; } // Toute l'application est en euros.
function achQte(n){ return (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('fr-FR'); }
function achDate(d){ return d ? d.split('-').reverse().join('/') : '—'; }
function achNombre(v){ const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }
// Le rôle peut-il saisir dans les achats ? (configuration centrale ; anciens comptes : rôle admin)
function achPeutModifier(){
  if(!currentUser) return false;
  const R = window.GTM_ROLES, p = currentUser.profil;
  if(R && p && R.ROLES[p]) return R.autorise(p, 'gadh', ACH.bons, 'm');
  return currentUser.role === 'admin';
}
function achNomFour(id){ const f = achGet('four')[id]; return f ? f.nom : '—'; }
function achNomArt(id){ const a = achGet('art')[id]; return a ? a.nom : ''; }

// --- Calculs ---
function achTotaux(b){
  let ht = 0, tva = 0;
  achListe(b.lignes).forEach(l => { const x = achNombre(l.qte) * achNombre(l.pu); ht += x; tva += x * achNombre(l.tva) / 100; });
  const frais = achNombre(b.frais), timbre = achNombre(b.timbre);
  const ttc = ht + tva + frais + timbre;
  const paye = achListe(b.paiements).reduce((s, p) => s + achNombre(p.montant), 0);
  return {ht, tva, frais, timbre, ttc, paye, reste: Math.max(0, Math.round((ttc - paye) * 1000) / 1000)};
}
function achReception(b){
  const l = achListe(b.lignes); if(!l.length) return 'aucune';
  const recu = l.reduce((s, x) => s + achNombre(x.recu), 0), cmd = l.reduce((s, x) => s + achNombre(x.qte), 0);
  return recu <= 0 ? 'aucune' : (recu + 1e-9 >= cmd ? 'totale' : 'partielle');
}
function achStatut(b){
  if(b.statut === 'annule') return {cle:'annule', label:'Annulé', cls:''};
  if(b.statut !== 'commande') return {cle:'brouillon', label:'Brouillon', cls:''};
  const r = achReception(b), t = achTotaux(b);
  if(r === 'totale' && t.reste <= 0.0005) return {cle:'solde', label:'Reçu et payé', cls:'good'};
  if(r === 'totale') return {cle:'recu', label:'Reçu · à payer', cls:'warn'};
  if(r === 'partielle') return {cle:'partiel', label:'Reçu en partie', cls:'warn'};
  return {cle:'commande', label:'Commandé', cls:'warn'};
}
function achEnRetard(b){ const t = achTotaux(b); return b.statut === 'commande' && t.reste > 0.0005 && b.echeance && b.echeance < getTodayISO(); }
function achStock(){
  const s = {};
  Object.values(achGet('mv')).forEach(m => { if(!m || !m.articleId) return; s[m.articleId] = (s[m.articleId] || 0) + (m.type === 'sortie' ? -1 : 1) * achNombre(m.qte); });
  return s;
}
function achSousSeuil(){
  const st = achStock();
  return Object.entries(achGet('art')).filter(([id, a]) => a && a.actif !== false && achSuiviStock(a) && achNombre(a.seuil) > 0 && (st[id] || 0) <= achNombre(a.seuil));
}
function achNumero(){
  const an = getTodayISO().slice(0, 4), c = achGet('cpt'), t = c.BA || {};
  t[an] = (t[an] || 0) + 1; c.BA = t; achSet('cpt', c);
  return 'BA-' + an + '-' + String(t[an]).padStart(3, '0');
}
function achBadge(st){ return `<span class="hour-rend ${st.cls}" style="font-size:12px;">${esc(st.label)}</span>`; }

// --- Navigation ---
function achNavItems(){
  return [
    {tab:'ach-accueil', label:'Accueil', icon:ICONS.dashboard, show:true},
    {tab:'ach-bons', label:'Achats', icon:ICONS.invoice, show:true},
    {tab:'ach-stock', label:'Stock', icon:ICONS.box, show:true},
    {tab:'ach-articles', label:'Articles', icon:ICONS.prodchain, show:true},
    {tab:'ach-fournisseurs', label:'Fournisseurs', court:'Fourn.', icon:ICONS.team, show:true}
  ];
}
function renderAchats(tab, main){
  const titres = {'ach-accueil':'Achats et stock', 'ach-bons':'Bons d\'achat', 'ach-stock':'Stock', 'ach-articles':'Articles', 'ach-fournisseurs':'Fournisseurs'};
  const c = gadhSectionContainer(main, titres[tab] || 'Achats');
  if(tab === 'ach-bons'){ if(achBonEdite) return renderAchBonForm(c); if(achBonOuvert) return renderAchBon(c); return renderAchBons(c); }
  const rendus = {'ach-accueil':renderAchAccueil, 'ach-stock':renderAchStock, 'ach-articles':renderAchArticles, 'ach-fournisseurs':renderAchFournisseurs};
  (rendus[tab] || renderAchAccueil)(c);
}

// --- Accueil ---
function renderAchAccueil(c){
  const bons = Object.entries(achGet('bons')).filter(([, b]) => b && b.statut === 'commande');
  const mois = getTodayISO().slice(0, 7);
  const duMois = bons.filter(([, b]) => (b.date || '').slice(0, 7) === mois).reduce((s, [, b]) => s + achTotaux(b).ttc, 0);
  const aPayer = bons.map(([id, b]) => [id, b, achTotaux(b)]).filter(x => x[2].reste > 0.0005).sort((a, b) => (a[1].echeance || '9999').localeCompare(b[1].echeance || '9999'));
  const resteTotal = aPayer.reduce((s, x) => s + x[2].reste, 0);
  const aRecevoir = bons.filter(([, b]) => achReception(b) !== 'totale').sort((a, b) => (a[1].date || '').localeCompare(b[1].date || ''));
  const alertes = achSousSeuil(), st = achStock();
  const ligneBon = ([id, b, t]) => `<div class="session-row" style="cursor:pointer;" onclick="achOuvrirBon('${id}')"><div style="min-width:0;"><b style="font-size:13px;">${esc(b.numero || 'Brouillon')}</b> <span style="font-size:12px;color:var(--ink-soft);">${esc(achNomFour(b.fournisseurId))}</span>
    <div style="font-size:12px;color:${achEnRetard(b) ? 'var(--bad)' : 'var(--ink-soft)'};">${b.echeance ? 'Échéance ' + achDate(b.echeance) + (achEnRetard(b) ? ' · en retard' : '') : 'Sans échéance'}</div></div><b style="font-size:13px;white-space:nowrap;">${achDT((t || achTotaux(b)).reste)}</b></div>`;
  c.innerHTML = `
    ${achPeutModifier() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"><button class="btn btn-primary" onclick="achNouveauBon()">+ Nouveau bon d'achat</button><button class="btn btn-ghost" onclick="achFormSortie()">Sortie de stock</button></div>` : ''}
    <div class="kpi-mini-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="kpi-mini tint-blue"><div class="kpi-mini-val" style="font-size:18px;">${achDT(duMois)}</div><div class="kpi-mini-lbl">Achats du mois</div></div>
      <div class="kpi-mini ${resteTotal > 0 ? 'tint-red' : ''}"><div class="kpi-mini-val" style="font-size:18px;">${achDT(resteTotal)}</div><div class="kpi-mini-lbl">Reste à payer</div></div>
      <div class="kpi-mini"><div class="kpi-mini-val">${aRecevoir.length}</div><div class="kpi-mini-lbl">Bons à recevoir</div></div>
      <div class="kpi-mini ${alertes.length ? 'tint-gold' : ''}"><div class="kpi-mini-val">${alertes.length}</div><div class="kpi-mini-lbl">Articles sous le seuil</div></div>
    </div>
    <div class="pg-grille2">
      <div class="card"><h3 style="margin-top:0;">À payer</h3>${aPayer.length ? aPayer.slice(0, 8).map(ligneBon).join('') : buildEmptyState('Rien à payer')}</div>
      <div class="card"><h3 style="margin-top:0;">À recevoir</h3>${aRecevoir.length ? aRecevoir.slice(0, 8).map(([id, b]) => { const l = achListe(b.lignes).filter(x => achNombre(x.recu) + 1e-9 < achNombre(x.qte));
        return `<div class="session-row" style="cursor:pointer;" onclick="achOuvrirBon('${id}')"><div style="min-width:0;"><b style="font-size:13px;">${esc(b.numero || '')}</b> <span style="font-size:12px;color:var(--ink-soft);">${esc(achNomFour(b.fournisseurId))} · commandé le ${achDate(b.date)}</span>
          <div style="font-size:12px;color:var(--ink-soft);">${esc(l.map(x => achQte(achNombre(x.qte) - achNombre(x.recu)) + ' ' + (x.unite || '') + ' ' + x.designation).join(' · '))}</div></div></div>`; }).join('') : buildEmptyState('Aucune livraison en attente')}</div>
    </div>
    <div class="card"><h3 style="margin-top:0;">Alertes de stock</h3>${alertes.length ? alertes.map(([id, a]) => `<div class="session-row"><b style="font-size:13px;">${esc(a.nom)}</b><span style="font-size:13px;color:var(--bad);">${achQte(st[id] || 0)} ${esc(a.unite || '')} · seuil ${achQte(a.seuil)}</span></div>`).join('') : buildEmptyState('Aucun article sous le seuil')}</div>`;
}

// --- Bons d'achat : liste ---
function renderAchBons(c){
  const ed = achPeutModifier();
  const filtres = [['encours', 'En cours'], ['apayer', 'À payer'], ['brouillon', 'Brouillons'], ['tous', 'Tous']];
  const l = Object.entries(achGet('bons')).filter(([, b]) => b).filter(([, b]) => {
    const st = achStatut(b).cle;
    if(achFiltre === 'encours') return ['commande', 'partiel', 'recu'].indexOf(st) >= 0;
    if(achFiltre === 'apayer') return b.statut === 'commande' && achTotaux(b).reste > 0.0005;
    if(achFiltre === 'brouillon') return st === 'brouillon';
    return true;
  }).sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''));
  c.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      ${filtres.map(([k, lib]) => `<button class="btn ${achFiltre === k ? 'btn-primary' : 'btn-ghost'}" style="padding:7px 12px;font-size:13px;" onclick="achFiltre='${k}'; nav('ach-bons')">${lib}</button>`).join('')}
      ${ed ? `<button class="btn btn-primary" style="margin-left:auto;padding:7px 12px;font-size:13px;" onclick="achNouveauBon()">+ Nouveau bon</button>` : ''}
    </div>
    <div class="card" style="padding:4px 14px;">${l.length ? l.map(([id, b]) => { const t = achTotaux(b), st = achStatut(b); return `<div class="session-row" style="cursor:pointer;flex-wrap:wrap;gap:6px;" onclick="achOuvrirBon('${id}')">
      <div style="min-width:0;flex:1 1 240px;"><b style="font-size:13.5px;">${esc(b.numero || 'Brouillon')}</b> <span style="font-size:12.5px;color:var(--ink-soft);">${achDate(b.date)} · ${esc(achNomFour(b.fournisseurId))}</span>
        <div style="font-size:12px;color:var(--ink-soft);">${achListe(b.lignes).length} ligne(s)${b.echeance ? ' · échéance ' + achDate(b.echeance) : ''}${achEnRetard(b) ? ' · <b style="color:var(--bad);">paiement en retard</b>' : ''}</div></div>
      <div style="text-align:right;"><b style="font-size:13.5px;">${achDT(t.ttc)}</b><div>${achBadge(st)}${b.statut === 'commande' && t.reste > 0.0005 && t.paye > 0 ? ` <span style="font-size:12px;color:var(--ink-soft);">reste ${achDT(t.reste)}</span>` : ''}</div></div></div>`; }).join('') : buildEmptyState('Aucun bon d\'achat', ed ? 'Créez le premier avec « + Nouveau bon ».' : '')}</div>`;
}
window.achOuvrirBon = (id) => { achBonOuvert = id; achBonEdite = null; nav('ach-bons'); };
window.achFermerBon = () => { achBonOuvert = null; achBonEdite = null; nav('ach-bons'); };

// --- Bon d'achat : détail ---
function renderAchBon(c){
  const b = achGet('bons')[achBonOuvert];
  if(!b){ achBonOuvert = null; return renderAchBons(c); }
  const ed = achPeutModifier(), t = achTotaux(b), st = achStatut(b), f = achGet('four')[b.fournisseurId] || {};
  const lignes = achListe(b.lignes), pai = achListe(b.paiements);
  c.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="btn btn-ghost" style="padding:7px 12px;font-size:13px;" onclick="achFermerBon()">← Bons d'achat</button>
      <span style="flex:1;"></span>
      <button class="btn btn-ghost" style="padding:7px 12px;font-size:13px;" onclick="achImprimer('${achBonOuvert}')">Imprimer</button>
      ${ed && b.statut !== 'annule' && achReception(b) === 'aucune' && !pai.length ? `<button class="btn btn-ghost" style="padding:7px 12px;font-size:13px;" onclick="achModifierBon('${achBonOuvert}')">Modifier</button>` : ''}
      ${ed && b.statut === 'brouillon' ? `<button class="btn btn-primary" style="padding:7px 12px;font-size:13px;" onclick="achCommander('${achBonOuvert}')">Passer la commande</button>` : ''}
      ${ed && b.statut === 'commande' && achReception(b) !== 'totale' ? `<button class="btn btn-primary" style="padding:7px 12px;font-size:13px;" onclick="achFormReception('${achBonOuvert}')">Réceptionner</button>` : ''}
      ${ed && b.statut === 'commande' && t.reste > 0.0005 ? `<button class="btn btn-primary" style="padding:7px 12px;font-size:13px;" onclick="achFormPaiement('${achBonOuvert}')">Paiement</button>` : ''}
    </div>
    <div class="card">
      <div class="flex-header" style="margin-bottom:6px;"><h3 style="margin:0;">${esc(b.numero || 'Brouillon')}</h3>${achBadge(st)}</div>
      <div style="font-size:13px;color:var(--ink-soft);line-height:1.6;">Fournisseur : <b style="color:var(--ink);">${esc(f.nom || '—')}</b>${f.tel ? ' · ' + esc(f.tel) : ''}<br>Date : ${achDate(b.date)}${b.echeance ? ' · échéance de paiement : <b style="color:' + (achEnRetard(b) ? 'var(--bad)' : 'var(--ink)') + ';">' + achDate(b.echeance) + '</b>' : ''}${b.refFournisseur ? '<br>Référence facture fournisseur : ' + esc(b.refFournisseur) : ''}${b.note ? '<br>' + esc(b.note) : ''}</div>
      <div style="overflow-x:auto;margin-top:12px;"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px;">
        <thead><tr style="text-align:left;"><th style="padding:6px;">Article</th><th style="padding:6px;text-align:right;">Qté</th><th style="padding:6px;text-align:right;">Reçu</th><th style="padding:6px;text-align:right;">P.U. HT</th><th style="padding:6px;text-align:right;">TVA</th><th style="padding:6px;text-align:right;">Total HT</th></tr></thead>
        <tbody>${lignes.map(l => `<tr style="border-top:1px solid var(--border);"><td style="padding:6px;">${esc(l.designation || achNomArt(l.articleId))}${l.articleId && achGet('art')[l.articleId] ? ` <span style="font-size:11.5px;color:var(--ink-soft);">${esc(ACH_CATEGORIES[achGet('art')[l.articleId].categorie] || '')}</span>` : ''}</td>
          <td style="padding:6px;text-align:right;">${achQte(l.qte)} ${esc(l.unite || '')}</td><td style="padding:6px;text-align:right;color:${achNombre(l.recu) + 1e-9 >= achNombre(l.qte) ? 'var(--good)' : 'var(--ink-soft)'};">${achQte(l.recu || 0)}</td>
          <td style="padding:6px;text-align:right;">${achDT(l.pu)}</td><td style="padding:6px;text-align:right;">${achNombre(l.tva)} %</td><td style="padding:6px;text-align:right;">${achDT(achNombre(l.qte) * achNombre(l.pu))}</td></tr>`).join('')}</tbody>
      </table></div>
      ${(() => { const L = (lib, v, st) => `<div style="display:flex;justify-content:space-between;gap:24px;padding:3px 0;${st || ''}"><span>${lib}</span><span style="white-space:nowrap;">${achDT(v)}</span></div>`;
        return `<div style="margin:12px 0 0 auto;max-width:340px;font-size:13.5px;">${L('Total HT', t.ht)}${L('TVA', t.tva)}${t.frais ? L('Frais (transport…)', t.frais) : ''}${t.timbre ? L('Timbre fiscal', t.timbre) : ''}
          ${L('Total TTC', t.ttc, 'font-weight:700;border-top:1px solid var(--border);margin-top:4px;padding-top:6px;')}${L('Payé', t.paye)}${L('Reste à payer', t.reste, 'font-weight:700;color:' + (t.reste > 0.0005 ? 'var(--bad)' : 'var(--good)') + ';')}</div>`; })()}
    </div>
    <div class="pg-grille2">
      <div class="card"><h3 style="margin-top:0;">Paiements</h3>${pai.length ? pai.map((p, i) => `<div class="session-row"><div><b style="font-size:13px;">${achDT(p.montant)}</b><div style="font-size:12px;color:var(--ink-soft);">${achDate(p.date)} · ${esc((ACH_MODES.find(m => m[0] === p.mode) || ['', p.mode || ''])[1])}${p.ref ? ' · ' + esc(p.ref) : ''}</div></div>${ed ? `<button class="btn btn-ghost" style="padding:5px 9px;font-size:12px;" onclick="achSupprimerPaiement('${achBonOuvert}', ${i})">Retirer</button>` : ''}</div>`).join('') : buildEmptyState('Aucun paiement')}</div>
      <div class="card"><h3 style="margin-top:0;">Réceptions</h3>${achListe(b.receptions).length ? achListe(b.receptions).map(r => `<div class="session-row"><b style="font-size:13px;">${achDate(r.date)}</b><span style="font-size:12px;color:var(--ink-soft);text-align:right;">${esc(achListe(r.lignes).map(x => achQte(x.qte) + ' × ' + (x.designation || '')).join(' · '))}</span></div>`).join('') : buildEmptyState('Rien de reçu')}</div>
    </div>
    ${ed && b.statut !== 'annule' ? `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
      ${b.statut === 'brouillon' ? `<button class="btn btn-ghost" style="color:var(--bad);" onclick="achSupprimerBon('${achBonOuvert}')">Supprimer le brouillon</button>` : `<button class="btn btn-ghost" style="color:var(--bad);" onclick="achAnnulerBon('${achBonOuvert}')">Annuler le bon</button>`}</div>` : ''}`;
}

// --- Bon d'achat : création / modification ---
window.achNouveauBon = () => {
  if(!achPeutModifier()) return;
  achBonEdite = {nouveau:true, b:{date:getTodayISO(), statut:'brouillon', fournisseurId:'', lignes:[{articleId:'', designation:'', qte:1, pu:0, tva:19, unite:''}], frais:0, timbre:1, echeance:'', refFournisseur:'', note:''}};
  achBonOuvert = null; nav('ach-bons');
};
window.achModifierBon = (id) => { const b = achGet('bons')[id]; if(!b) return; achBonEdite = {id, b:JSON.parse(JSON.stringify(b))}; achBonEdite.b.lignes = achListe(achBonEdite.b.lignes); nav('ach-bons'); };
function achOptionsArticles(val){
  const arts = Object.entries(achGet('art')).filter(([, a]) => a && a.actif !== false).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || ''));
  return `<option value="">— Article libre —</option>` + Object.keys(ACH_CATEGORIES).map(cat => {
    const l = arts.filter(([, a]) => a.categorie === cat);
    return l.length ? `<optgroup label="${ACH_CATEGORIES[cat]}">${l.map(([id, a]) => `<option value="${id}" ${id === val ? 'selected' : ''}>${esc(a.nom)}${a.ref ? ' (' + esc(a.ref) + ')' : ''}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function renderAchBonForm(c){
  const e = achBonEdite, b = e.b;
  const fours = Object.entries(achGet('four')).filter(([, f]) => f && f.actif !== false).sort((a, x) => (a[1].nom || '').localeCompare(x[1].nom || ''));
  const champ = 'style="width:100%;padding:8px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:13.5px;"';
  c.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">${e.nouveau ? 'Nouveau bon d\'achat' : 'Modifier ' + esc(b.numero || 'le brouillon')}</h3>
      <div class="pg-grille2">
        <div class="field"><label>Fournisseur *</label><div style="display:flex;gap:6px;"><select id="ab-four" ${champ}><option value="">— Choisir —</option>${fours.map(([id, f]) => `<option value="${id}" ${id === b.fournisseurId ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select>
          <button class="btn btn-ghost" style="padding:0 12px;" title="Nouveau fournisseur" onclick="achFormFournisseur(null, true)">+</button></div></div>
        <div class="field"><label>Date</label><input id="ab-date" type="date" value="${esc(b.date || '')}" ${champ}></div>
        <div class="field"><label>Échéance de paiement</label><input id="ab-ech" type="date" value="${esc(b.echeance || '')}" ${champ}></div>
        <div class="field"><label>Référence facture fournisseur</label><input id="ab-ref" value="${esc(b.refFournisseur || '')}" ${champ}></div>
      </div>
    </div>
    <div class="card">
      <div class="flex-header" style="margin-bottom:8px;"><h3 style="margin:0;">Lignes</h3><div style="display:flex;gap:6px;"><button class="btn btn-ghost" style="padding:6px 10px;font-size:12.5px;" onclick="achFormArticle(null, true)">+ Nouvel article</button><button class="btn btn-primary" style="padding:6px 10px;font-size:12.5px;" onclick="achAjouterLigne()">+ Ligne</button></div></div>
      <div id="ab-lignes">${b.lignes.map((l, i) => `<div class="ab-ligne" data-i="${i}" style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(140px,2fr) 80px 110px 80px 32px;gap:6px;align-items:end;padding:8px 0;border-bottom:1px solid var(--border);">
          <div><label style="font-size:12px;color:var(--ink-soft);">Article</label><select class="ab-art" ${champ} onchange="achChoixArticle(${i}, this.value)">${achOptionsArticles(l.articleId)}</select></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">Désignation</label><input class="ab-des" value="${esc(l.designation || '')}" ${champ}></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">Qté</label><input class="ab-qte" inputmode="decimal" value="${esc(String(l.qte))}" ${champ} oninput="achRecalc()"></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">P.U. HT (€)</label><input class="ab-pu" inputmode="decimal" value="${esc(String(l.pu))}" ${champ} oninput="achRecalc()"></div>
          <div><label style="font-size:12px;color:var(--ink-soft);">TVA</label><select class="ab-tva" ${champ} onchange="achRecalc()">${ACH_TVA.map(x => `<option value="${x}" ${achNombre(l.tva) === x ? 'selected' : ''}>${x} %</option>`).join('')}</select></div>
          <button class="icon-btn" title="Retirer" onclick="achRetirerLigne(${i})" style="height:38px;">✕</button>
        </div>`).join('')}</div>
      <div class="pg-grille2" style="margin-top:12px;">
        <div class="field"><label>Frais (transport…) (€)</label><input id="ab-frais" inputmode="decimal" value="${esc(String(b.frais || 0))}" ${champ} oninput="achRecalc()"></div>
        <div class="field"><label>Timbre fiscal (€)</label><input id="ab-timbre" inputmode="decimal" value="${esc(String(b.timbre || 0))}" ${champ} oninput="achRecalc()"></div>
      </div>
      <div class="field"><label>Note</label><textarea id="ab-note" rows="2" ${champ}>${esc(b.note || '')}</textarea></div>
      <div id="ab-totaux" style="text-align:right;font-size:14px;line-height:1.7;"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
      <button class="btn btn-ghost" onclick="achAnnulerEdition()">Annuler</button>
      <button class="btn btn-ghost" onclick="achEnregistrerBon(false)">Enregistrer le brouillon</button>
      <button class="btn btn-primary" onclick="achEnregistrerBon(true)">${e.b.statut === 'commande' ? 'Enregistrer' : 'Enregistrer et commander'}</button>
    </div>
    <style>@media (max-width:760px){.ab-ligne{grid-template-columns:1fr 1fr !important;}.ab-ligne > div:nth-child(1), .ab-ligne > div:nth-child(2){grid-column:1 / -1;}}</style>`;
  achRecalc();
}
function achLireForm(){
  const b = achBonEdite.b;
  b.fournisseurId = mgtVal('ab-four'); b.date = mgtVal('ab-date') || getTodayISO(); b.echeance = mgtVal('ab-ech'); b.refFournisseur = mgtVal('ab-ref');
  b.frais = achNombre(mgtVal('ab-frais')); b.timbre = achNombre(mgtVal('ab-timbre')); b.note = mgtVal('ab-note');
  b.lignes = Array.from(document.querySelectorAll('.ab-ligne')).map((el, i) => {
    const anc = b.lignes[i] || {};
    const articleId = el.querySelector('.ab-art').value, a = achGet('art')[articleId];
    return {articleId, designation: el.querySelector('.ab-des').value.trim() || (a ? a.nom : ''), qte: achNombre(el.querySelector('.ab-qte').value), pu: achNombre(el.querySelector('.ab-pu').value),
      tva: achNombre(el.querySelector('.ab-tva').value), unite: a ? (a.unite || '') : (anc.unite || ''), recu: achNombre(anc.recu)};
  });
  return b;
}
window.achRecalc = () => { const t = achTotaux(achLireForm()); const z = document.getElementById('ab-totaux'); if(z) z.innerHTML = `Total HT <b>${achDT(t.ht)}</b> · TVA <b>${achDT(t.tva)}</b><br>Total TTC <b style="font-size:16px;">${achDT(t.ttc)}</b>`; };
window.achAjouterLigne = () => { achLireForm(); achBonEdite.b.lignes.push({articleId:'', designation:'', qte:1, pu:0, tva:19, unite:''}); nav('ach-bons'); };
window.achRetirerLigne = (i) => { achLireForm(); achBonEdite.b.lignes.splice(i, 1); if(!achBonEdite.b.lignes.length) achBonEdite.b.lignes.push({articleId:'', designation:'', qte:1, pu:0, tva:19, unite:''}); nav('ach-bons'); };
window.achChoixArticle = (i, id) => {
  achLireForm(); const a = achGet('art')[id], l = achBonEdite.b.lignes[i];
  if(a){ l.articleId = id; l.designation = a.nom; l.unite = a.unite || ''; if(achNombre(a.prix) > 0) l.pu = achNombre(a.prix); if(a.tva !== undefined) l.tva = achNombre(a.tva); if(!achBonEdite.b.fournisseurId && a.fournisseurId) achBonEdite.b.fournisseurId = a.fournisseurId; }
  nav('ach-bons');
};
window.achAnnulerEdition = () => { const id = achBonEdite && achBonEdite.id; achBonEdite = null; achBonOuvert = id || null; nav('ach-bons'); };
window.achEnregistrerBon = (commander) => {
  if(!achPeutModifier()) return;
  const b = achLireForm();
  if(!b.fournisseurId){ showToast('Choisissez le fournisseur'); return; }
  b.lignes = b.lignes.filter(l => l.designation && l.qte > 0);
  if(!b.lignes.length){ showToast('Ajoutez au moins une ligne avec une désignation et une quantité'); return; }
  const bons = achGet('bons'), id = achBonEdite.id || mgtId('ba');
  if(commander && b.statut !== 'commande'){ b.statut = 'commande'; b.commandeLe = Date.now(); }
  if(b.statut === 'commande' && !b.numero) b.numero = achNumero();
  b.maj = Date.now(); b.par = currentUser.nom || currentUser.username;
  bons[id] = b; achSet('bons', bons);
  achBonEdite = null; achBonOuvert = id; showToast(commander ? 'Commande enregistrée' : 'Brouillon enregistré'); nav('ach-bons');
};
window.achCommander = (id) => {
  const bons = achGet('bons'), b = bons[id]; if(!b || !achPeutModifier()) return;
  b.statut = 'commande'; b.commandeLe = Date.now(); if(!b.numero) b.numero = achNumero();
  achSet('bons', bons); showToast('Commande ' + b.numero + ' enregistrée'); nav('ach-bons');
};
window.achSupprimerBon = (id) => {
  if(!confirm('Supprimer ce brouillon ?')) return;
  const bons = achGet('bons'); if(!bons[id] || bons[id].statut !== 'brouillon') return;
  delete bons[id]; achSet('bons', bons); achBonOuvert = null; showToast('Brouillon supprimé'); nav('ach-bons');
};
window.achAnnulerBon = (id) => {
  const bons = achGet('bons'), b = bons[id]; if(!b) return;
  const avert = achReception(b) !== 'aucune' || achListe(b.paiements).length ? '\n\nAttention : des réceptions ou paiements sont déjà enregistrés. Ils restent dans l\'historique et le stock n\'est pas modifié.' : '';
  if(!confirm('Annuler le bon ' + (b.numero || '') + ' ?' + avert)) return;
  b.statut = 'annule'; b.annuleLe = Date.now(); achSet('bons', bons); showToast('Bon annulé'); nav('ach-bons');
};

// --- Réception ---
window.achFormReception = (id) => {
  const b = achGet('bons')[id]; if(!b) return;
  const lignes = achListe(b.lignes);
  mgtModal('Réception ' + esc(b.numero || ''), `<p style="font-size:13px;margin-top:0;color:var(--ink-soft);">Quantités reçues aujourd'hui. Les matières et accessoires entrent en stock.</p>
    ${mgtChamp('Date de réception', 'ar-date', getTodayISO(), 'date')}
    ${lignes.map((l, i) => { const reste = Math.max(0, achNombre(l.qte) - achNombre(l.recu)); return `<div class="field"><label>${esc(l.designation)} — reste ${achQte(reste)} ${esc(l.unite || '')}</label><input id="ar-q${i}" inputmode="decimal" value="${reste ? achQte(reste).replace(/\s/g, '') : 0}"></div>`; }).join('')}
    <button class="btn btn-primary" style="width:100%;" onclick="achValiderReception('${id}')">Valider la réception</button>`);
};
window.achValiderReception = (id) => {
  const bons = achGet('bons'), b = bons[id]; if(!b || !achPeutModifier()) return;
  const date = mgtVal('ar-date') || getTodayISO(), arts = achGet('art'), mv = achGet('mv'), recus = [];
  b.lignes = achListe(b.lignes);
  b.lignes.forEach((l, i) => {
    const q = achNombre(mgtVal('ar-q' + i)); if(q <= 0) return;
    l.recu = achNombre(l.recu) + q; recus.push({designation:l.designation, qte:q, articleId:l.articleId || ''});
    const a = arts[l.articleId];
    if(a){ if(achNombre(l.pu) > 0) a.prix = achNombre(l.pu); a.dernierAchat = date;
      if(achSuiviStock(a)) mv[mgtId('mv')] = {date, articleId:l.articleId, type:'entree', qte:q, bonId:id, pu:achNombre(l.pu), motif:'Réception ' + (b.numero || ''), par:currentUser.nom || currentUser.username, t:Date.now()}; }
  });
  if(!recus.length){ showToast('Aucune quantité saisie'); return; }
  b.receptions = achListe(b.receptions).concat([{date, lignes:recus, par:currentUser.nom || currentUser.username}]);
  bons[id] = b; achSet('bons', bons); achSet('mv', mv); achSet('art', arts);
  mgtFermer(); showToast('Réception enregistrée'); nav('ach-bons');
};

// --- Paiements ---
window.achFormPaiement = (id) => {
  const b = achGet('bons')[id]; if(!b) return; const t = achTotaux(b);
  mgtModal('Paiement ' + esc(b.numero || ''), `<p style="font-size:13px;margin-top:0;">Reste à payer : <b>${achDT(t.reste)}</b></p>
    ${mgtChamp('Date', 'ap-date', getTodayISO(), 'date')}${mgtChamp('Montant (€)', 'ap-montant', String(t.reste), 'text', 'inputmode="decimal"')}
    ${mgtSelect('Mode', 'ap-mode', ACH_MODES, 'virement')}${mgtChamp('Référence (n° chèque, virement…)', 'ap-ref', '')}
    <button class="btn btn-primary" style="width:100%;" onclick="achValiderPaiement('${id}')">Enregistrer le paiement</button>`);
};
window.achValiderPaiement = (id) => {
  const bons = achGet('bons'), b = bons[id]; if(!b || !achPeutModifier()) return;
  const m = achNombre(mgtVal('ap-montant')); if(m <= 0){ showToast('Montant invalide'); return; }
  b.paiements = achListe(b.paiements).concat([{date:mgtVal('ap-date') || getTodayISO(), montant:m, mode:mgtVal('ap-mode'), ref:mgtVal('ap-ref'), par:currentUser.nom || currentUser.username}]);
  achSet('bons', bons); mgtFermer(); showToast('Paiement enregistré'); nav('ach-bons');
};
window.achSupprimerPaiement = (id, i) => {
  if(!confirm('Retirer ce paiement ?')) return;
  const bons = achGet('bons'), b = bons[id]; if(!b) return;
  const l = achListe(b.paiements); l.splice(i, 1); b.paiements = l; achSet('bons', bons); nav('ach-bons');
};

// --- Impression du bon de commande ---
window.achImprimer = (id) => {
  const b = achGet('bons')[id]; if(!b) return;
  const f = achGet('four')[b.fournisseurId] || {}, t = achTotaux(b);
  let P = {raison:SOCIETES.gadh.nom, adresse:'', mf:'', tel:'', email:''};
  try { if(typeof factParams === 'function') P = Object.assign(P, factParams('gadh')); } catch(e) {}
  const n = (x) => (Number(x) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(b.numero || 'Bon de commande')}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:13px;} h1{font-size:20px;margin:0 0 4px;} .ent{display:flex;justify-content:space-between;gap:20px;margin-bottom:22px;}
    .boite{border:1px solid #999;border-radius:6px;padding:10px 12px;min-width:240px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left;} th{background:#eee;} .n{text-align:right;white-space:nowrap;}
    .tot{width:auto;margin-left:auto;margin-top:14px;} .tot td{border:none;padding:3px 10px;} .sig{margin-top:50px;display:flex;justify-content:space-between;} @media print{body{margin:12mm;}}</style></head><body>
    <div class="ent"><div><h1>${esc(P.raison || SOCIETES.gadh.nom)}</h1><div>${esc(P.adresse || '')}</div><div>${P.mf ? 'MF ' + esc(P.mf) : ''}${P.tel ? ' · ' + esc(P.tel) : ''}</div></div>
      <div class="boite"><b>BON DE COMMANDE ${esc(b.numero || '(brouillon)')}</b><br>Date : ${achDate(b.date)}${b.echeance ? '<br>Échéance : ' + achDate(b.echeance) : ''}</div></div>
    <div class="boite" style="max-width:360px;"><b>Fournisseur</b><br>${esc(f.nom || '')}<br>${esc(f.adresse || '')}${f.mf ? '<br>MF ' + esc(f.mf) : ''}${f.tel ? '<br>Tél. ' + esc(f.tel) : ''}</div>
    <table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">P.U. HT</th><th class="n">TVA</th><th class="n">Total HT</th></tr></thead><tbody>
      ${achListe(b.lignes).map(l => `<tr><td>${esc(l.designation)}</td><td class="n">${achQte(l.qte)} ${esc(l.unite || '')}</td><td class="n">${n(l.pu)}</td><td class="n">${achNombre(l.tva)} %</td><td class="n">${n(achNombre(l.qte) * achNombre(l.pu))}</td></tr>`).join('')}</tbody></table>
    <table class="tot"><tr><td>Total HT</td><td class="n">${n(t.ht)} €</td></tr><tr><td>TVA</td><td class="n">${n(t.tva)} €</td></tr>${t.frais ? `<tr><td>Frais</td><td class="n">${n(t.frais)} €</td></tr>` : ''}${t.timbre ? `<tr><td>Timbre fiscal</td><td class="n">${n(t.timbre)} €</td></tr>` : ''}<tr><td><b>Total TTC</b></td><td class="n"><b>${n(t.ttc)} €</b></td></tr></table>
    ${b.note ? `<p style="margin-top:16px;">${esc(b.note)}</p>` : ''}<div class="sig"><div>Le fournisseur</div><div>Pour ${esc(P.raison || SOCIETES.gadh.nom)}</div></div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if(!w){ showToast('Autorisez les fenêtres pop-up pour imprimer'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

// --- Stock ---
function renderAchStock(c){
  const ed = achPeutModifier(), st = achStock(), arts = Object.entries(achGet('art')).filter(([, a]) => achSuiviStock(a) && a.actif !== false)
    .sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || ''));
  const valeur = arts.reduce((s, [id, a]) => s + Math.max(0, st[id] || 0) * achNombre(a.prix), 0);
  const mvs = Object.entries(achGet('mv')).filter(([, m]) => m).sort((a, b) => (b[1].date || '').localeCompare(a[1].date || '') || (b[1].t || 0) - (a[1].t || 0)).slice(0, 40);
  c.innerHTML = `
    ${ed ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"><button class="btn btn-primary" onclick="achFormSortie()">Sortie de stock</button><button class="btn btn-ghost" onclick="achFormInventaire()">Inventaire (corriger une quantité)</button></div>` : ''}
    <div class="kpi-mini-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="kpi-mini tint-blue"><div class="kpi-mini-val">${arts.length}</div><div class="kpi-mini-lbl">Articles suivis</div></div>
      <div class="kpi-mini"><div class="kpi-mini-val" style="font-size:18px;">${achDT(valeur)}</div><div class="kpi-mini-lbl">Valeur du stock (dernier prix HT)</div></div>
      <div class="kpi-mini ${achSousSeuil().length ? 'tint-gold' : ''}"><div class="kpi-mini-val">${achSousSeuil().length}</div><div class="kpi-mini-lbl">Sous le seuil</div></div>
    </div>
    <div class="card" style="padding:4px 14px;">${arts.length ? arts.map(([id, a]) => { const q = st[id] || 0, bas = achNombre(a.seuil) > 0 && q <= achNombre(a.seuil); return `<div class="session-row">
      <div><b style="font-size:13px;">${esc(a.nom)}</b> <span style="font-size:12px;color:var(--ink-soft);">${esc(ACH_CATEGORIES[a.categorie] || '')}${a.ref ? ' · ' + esc(a.ref) : ''}</span>${achNombre(a.seuil) > 0 ? `<div style="font-size:12px;color:var(--ink-soft);">Seuil ${achQte(a.seuil)} ${esc(a.unite || '')}</div>` : ''}</div>
      <b style="font-size:14px;color:${bas ? 'var(--bad)' : 'var(--ink)'};white-space:nowrap;">${achQte(q)} ${esc(a.unite || '')}</b></div>`; }).join('') : buildEmptyState('Aucun article en stock', 'Les matières et accessoires apparaissent ici après leur création dans Articles.')}</div>
    <div class="card"><h3 style="margin-top:0;">Derniers mouvements</h3>${mvs.length ? mvs.map(([, m]) => `<div class="session-row"><div><b style="font-size:13px;">${esc(achNomArt(m.articleId) || '—')}</b><div style="font-size:12px;color:var(--ink-soft);">${achDate(m.date)} · ${esc(m.motif || '')}${m.par ? ' · ' + esc(m.par) : ''}</div></div>
      <b style="font-size:13px;color:${m.type === 'sortie' ? 'var(--bad)' : 'var(--good)'};">${m.type === 'sortie' ? '−' : (achNombre(m.qte) < 0 ? '' : '+')}${achQte(Math.abs(achNombre(m.qte)) * (m.type !== 'sortie' && achNombre(m.qte) < 0 ? -1 : 1))}</b></div>`).join('') : buildEmptyState('Aucun mouvement')}</div>`;
}
function achOptionsStock(){ return Object.entries(achGet('art')).filter(([, a]) => achSuiviStock(a) && a.actif !== false).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '')).map(([id, a]) => [id, a.nom + (a.unite ? ' (' + a.unite + ')' : '')]); }
window.achFormSortie = () => {
  const opts = achOptionsStock(); if(!opts.length){ showToast('Créez d\'abord des matières ou accessoires dans Articles'); return; }
  mgtModal('Sortie de stock', `${mgtSelect('Article', 'as-art', opts, opts[0][0])}${mgtChamp('Quantité', 'as-qte', '', 'text', 'inputmode="decimal"')}${mgtChamp('Date', 'as-date', getTodayISO(), 'date')}
    ${mgtSelect('Motif', 'as-motif', [['Consommation production', 'Consommation production'], ['Perte / casse', 'Perte / casse'], ['Retour fournisseur', 'Retour fournisseur'], ['Autre', 'Autre']], 'Consommation production')}
    <button class="btn btn-primary" style="width:100%;" onclick="achValiderSortie()">Enregistrer la sortie</button>`);
};
window.achValiderSortie = () => {
  if(!achPeutModifier()) return;
  const art = mgtVal('as-art'), q = achNombre(mgtVal('as-qte')); if(!art || q <= 0){ showToast('Quantité invalide'); return; }
  const st = achStock()[art] || 0;
  if(q > st + 1e-9 && !confirm('La quantité dépasse le stock enregistré (' + achQte(st) + '). Enregistrer quand même ?')) return;
  const mv = achGet('mv'); mv[mgtId('mv')] = {date:mgtVal('as-date') || getTodayISO(), articleId:art, type:'sortie', qte:q, motif:mgtVal('as-motif'), par:currentUser.nom || currentUser.username, t:Date.now()};
  achSet('mv', mv); mgtFermer(); showToast('Sortie enregistrée'); if(typeof activeTab !== 'undefined') nav(activeTab);
};
window.achFormInventaire = () => {
  const opts = achOptionsStock(); if(!opts.length){ showToast('Aucun article en stock'); return; }
  const st = achStock();
  mgtModal('Inventaire', `<p style="font-size:13px;margin-top:0;color:var(--ink-soft);">Saisissez la quantité réellement comptée : l'écart est enregistré comme ajustement.</p>
    ${mgtSelect('Article', 'ai-art', opts.map(([id, l]) => [id, l + ' — stock ' + achQte(st[id] || 0)]), opts[0][0])}${mgtChamp('Quantité comptée', 'ai-qte', '', 'text', 'inputmode="decimal"')}
    <button class="btn btn-primary" style="width:100%;" onclick="achValiderInventaire()">Enregistrer</button>`);
};
window.achValiderInventaire = () => {
  if(!achPeutModifier()) return;
  const art = mgtVal('ai-art'), v = mgtVal('ai-qte'); if(!art || v === ''){ showToast('Quantité requise'); return; }
  const ecart = Math.round((achNombre(v) - (achStock()[art] || 0)) * 1000) / 1000;
  if(!ecart){ mgtFermer(); showToast('Aucun écart'); return; }
  const mv = achGet('mv'); mv[mgtId('mv')] = {date:getTodayISO(), articleId:art, type:'ajustement', qte:ecart, motif:'Inventaire', par:currentUser.nom || currentUser.username, t:Date.now()};
  achSet('mv', mv); mgtFermer(); showToast('Inventaire enregistré (écart ' + (ecart > 0 ? '+' : '') + achQte(ecart) + ')'); nav('ach-stock');
};

// --- Articles ---
function renderAchArticles(c){
  const ed = achPeutModifier(), st = achStock();
  const l = Object.entries(achGet('art')).filter(([, a]) => a && (achArtFiltre === 'tous' || a.categorie === achArtFiltre)).sort((a, b) => (a[1].actif === false) - (b[1].actif === false) || (a[1].nom || '').localeCompare(b[1].nom || ''));
  c.innerHTML = `
    <div class="card" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      ${[['tous', 'Tous']].concat(Object.entries(ACH_CATEGORIES)).map(([k, lib]) => `<button class="btn ${achArtFiltre === k ? 'btn-primary' : 'btn-ghost'}" style="padding:7px 12px;font-size:13px;" onclick="achArtFiltre='${k}'; nav('ach-articles')">${lib}${k === 'tous' ? '' : 's'}</button>`).join('')}
      ${ed ? `<button class="btn btn-primary" style="margin-left:auto;padding:7px 12px;font-size:13px;" onclick="achFormArticle()">+ Nouvel article</button>` : ''}
    </div>
    <div class="card" style="padding:4px 14px;">${l.length ? l.map(([id, a]) => `<div class="session-row" ${ed ? `style="cursor:pointer;" onclick="achFormArticle('${id}')"` : ''}>
      <div style="min-width:0;"><b style="font-size:13px;${a.actif === false ? 'color:var(--ink-faint);' : ''}">${esc(a.nom)}</b> <span style="font-size:12px;color:var(--ink-soft);">${esc(ACH_CATEGORIES[a.categorie] || '')}${a.ref ? ' · ' + esc(a.ref) : ''}${a.actif === false ? ' · inactif' : ''}</span>
        <div style="font-size:12px;color:var(--ink-soft);">${a.fournisseurId ? esc(achNomFour(a.fournisseurId)) + ' · ' : ''}${achNombre(a.prix) > 0 ? 'dernier prix ' + achDT(a.prix) + (a.unite ? ' / ' + esc(a.unite) : '') : 'pas encore acheté'}</div></div>
      ${achSuiviStock(a) ? `<b style="font-size:13px;white-space:nowrap;">${achQte(st[id] || 0)} ${esc(a.unite || '')}</b>` : ''}</div>`).join('') : buildEmptyState('Aucun article', ed ? 'Créez vos matières, accessoires et machines avec « + Nouvel article ».' : '')}</div>`;
}
window.achFormArticle = (id, depuisBon) => {
  if(!achPeutModifier()) return;
  if(depuisBon && achBonEdite) achLireForm();
  const a = id ? (achGet('art')[id] || {}) : {categorie:'matiere', unite:'pièce', tva:19};
  const fours = [['', '— Aucun —']].concat(Object.entries(achGet('four')).filter(([, f]) => f && f.actif !== false).sort((x, y) => (x[1].nom || '').localeCompare(y[1].nom || '')).map(([k, f]) => [k, f.nom]));
  mgtModal(id ? 'Modifier l\'article' : 'Nouvel article', `${mgtChamp('Nom *', 'aa-nom', a.nom || '')}${mgtChamp('Référence', 'aa-ref', a.ref || '')}
    ${mgtSelect('Catégorie', 'aa-cat', Object.entries(ACH_CATEGORIES), a.categorie || 'matiere')}
    ${mgtSelect('Unité', 'aa-unite', ACH_UNITES.map(u => [u, u]).concat(a.unite && ACH_UNITES.indexOf(a.unite) < 0 ? [[a.unite, a.unite]] : []), a.unite || 'pièce')}
    ${mgtChamp('Seuil d\'alerte (matières et accessoires)', 'aa-seuil', a.seuil || '', 'text', 'inputmode="decimal"')}
    ${mgtChamp('Prix d\'achat HT habituel (€)', 'aa-prix', a.prix || '', 'text', 'inputmode="decimal"')}
    ${mgtChamp('Prix de vente HT (€)', 'aa-pv', a.prixVente || '', 'text', 'inputmode="decimal"')}
    ${mgtSelect('TVA habituelle', 'aa-tva', ACH_TVA.map(x => [String(x), x + ' %']), String(a.tva === undefined ? 19 : a.tva))}
    ${mgtSelect('Fournisseur habituel', 'aa-four', fours, a.fournisseurId || '')}
    ${id ? `<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:12px;"><input type="checkbox" id="aa-actif" ${a.actif === false ? '' : 'checked'} style="width:18px;height:18px;"> Article actif</label>` : ''}
    <button class="btn btn-primary" style="width:100%;" onclick="achSauverArticle('${id || ''}', ${depuisBon ? 'true' : 'false'})">${id ? 'Enregistrer' : 'Créer l\'article'}</button>`);
};
window.achSauverArticle = (id, depuisBon) => {
  if(!achPeutModifier()) return;
  const nom = mgtVal('aa-nom'); if(!nom){ showToast('Nom requis'); return; }
  const arts = achGet('art'), k = id || mgtId('ar'), anc = arts[k] || {};
  const actif = document.getElementById('aa-actif');
  arts[k] = Object.assign({}, anc, {nom, ref:mgtVal('aa-ref'), categorie:mgtVal('aa-cat'), unite:mgtVal('aa-unite'), seuil:achNombre(mgtVal('aa-seuil')), prix:achNombre(mgtVal('aa-prix')), prixVente:achNombre(mgtVal('aa-pv')), tva:achNombre(mgtVal('aa-tva')),
    fournisseurId:mgtVal('aa-four'), actif:actif ? actif.checked : true, maj:Date.now()});
  achSet('art', arts); mgtFermer(); showToast(id ? 'Article enregistré' : 'Article créé');
  nav(depuisBon ? 'ach-bons' : 'ach-articles');
};

// --- Fournisseurs ---
function renderAchFournisseurs(c){
  const ed = achPeutModifier(), bons = Object.values(achGet('bons')).filter(b => b && b.statut === 'commande');
  if(achFourOuvert){
    const f = achGet('four')[achFourOuvert];
    if(f){
      const sesBons = Object.entries(achGet('bons')).filter(([, b]) => b && b.fournisseurId === achFourOuvert).sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''));
      const tot = sesBons.filter(([, b]) => b.statut === 'commande').reduce((s, [, b]) => { const t = achTotaux(b); s.ttc += t.ttc; s.reste += t.reste; return s; }, {ttc:0, reste:0});
      c.innerHTML = `<div class="card" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost" style="padding:7px 12px;font-size:13px;" onclick="achFourOuvert=null; nav('ach-fournisseurs')">← Fournisseurs</button><span style="flex:1;"></span>${ed ? `<button class="btn btn-ghost" style="padding:7px 12px;font-size:13px;" onclick="achFormFournisseur('${achFourOuvert}')">Modifier</button>` : ''}</div>
        <div class="card"><h3 style="margin-top:0;">${esc(f.nom)}</h3><div style="font-size:13px;color:var(--ink-soft);line-height:1.7;">${[f.contact && 'Contact : ' + esc(f.contact), f.tel && 'Tél. : ' + esc(f.tel), f.email && esc(f.email), f.adresse && esc(f.adresse), f.mf && 'MF : ' + esc(f.mf), f.rib && 'RIB : ' + esc(f.rib), f.categories && 'Fournit : ' + esc(f.categories), f.note && esc(f.note)].filter(Boolean).join('<br>') || '—'}</div></div>
        <div class="kpi-mini-grid" style="grid-template-columns:repeat(3,1fr);"><div class="kpi-mini"><div class="kpi-mini-val">${sesBons.length}</div><div class="kpi-mini-lbl">Bons d'achat</div></div><div class="kpi-mini tint-blue"><div class="kpi-mini-val" style="font-size:18px;">${achDT(tot.ttc)}</div><div class="kpi-mini-lbl">Total acheté (TTC)</div></div><div class="kpi-mini ${tot.reste > 0.0005 ? 'tint-red' : ''}"><div class="kpi-mini-val" style="font-size:18px;">${achDT(tot.reste)}</div><div class="kpi-mini-lbl">Reste à payer</div></div></div>
        <div class="card" style="padding:4px 14px;">${sesBons.length ? sesBons.map(([id, b]) => `<div class="session-row" style="cursor:pointer;" onclick="achFourOuvert=null; achOuvrirBon('${id}')"><span><b style="font-size:13px;">${esc(b.numero || 'Brouillon')}</b> <span style="font-size:12px;color:var(--ink-soft);">${achDate(b.date)}</span></span><span>${achBadge(achStatut(b))} <b style="font-size:13px;">${achDT(achTotaux(b).ttc)}</b></span></div>`).join('') : buildEmptyState('Aucun achat chez ce fournisseur')}</div>`;
      return;
    }
    achFourOuvert = null;
  }
  const l = Object.entries(achGet('four')).filter(([, f]) => f).sort((a, b) => (a[1].actif === false) - (b[1].actif === false) || (a[1].nom || '').localeCompare(b[1].nom || ''));
  c.innerHTML = `${ed ? `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><button class="btn btn-primary" onclick="achFormFournisseur()">+ Nouveau fournisseur</button></div>` : ''}
    <div class="card" style="padding:4px 14px;">${l.length ? l.map(([id, f]) => { const r = bons.filter(b => b.fournisseurId === id).reduce((s, b) => s + achTotaux(b).reste, 0); return `<div class="session-row" style="cursor:pointer;" onclick="achFourOuvert='${id}'; nav('ach-fournisseurs')">
      <div><b style="font-size:13px;${f.actif === false ? 'color:var(--ink-faint);' : ''}">${esc(f.nom)}</b>${f.actif === false ? ' <span style="font-size:12px;color:var(--ink-faint);">inactif</span>' : ''}<div style="font-size:12px;color:var(--ink-soft);">${esc([f.categories, f.tel].filter(Boolean).join(' · '))}</div></div>
      ${r > 0.0005 ? `<span style="font-size:12.5px;color:var(--bad);white-space:nowrap;">reste ${achDT(r)}</span>` : ''}</div>`; }).join('') : buildEmptyState('Aucun fournisseur', ed ? 'Créez le premier avec « + Nouveau fournisseur ».' : '')}</div>`;
}
window.achFormFournisseur = (id, depuisBon) => {
  if(!achPeutModifier()) return;
  if(depuisBon && achBonEdite) achLireForm();
  const f = id ? (achGet('four')[id] || {}) : {};
  mgtModal(id ? 'Modifier le fournisseur' : 'Nouveau fournisseur', `${mgtChamp('Nom / raison sociale *', 'af-nom', f.nom || '')}${mgtChamp('Contact', 'af-contact', f.contact || '')}
    ${mgtChamp('Téléphone', 'af-tel', f.tel || '', 'tel')}${mgtChamp('E-mail', 'af-email', f.email || '', 'email')}${mgtChamp('Adresse', 'af-adresse', f.adresse || '')}
    ${mgtChamp('Matricule fiscal', 'af-mf', f.mf || '')}${mgtChamp('RIB', 'af-rib', f.rib || '')}${mgtChamp('Ce qu\'il fournit (matières, accessoires, machines…)', 'af-cat', f.categories || '')}
    ${mgtZone('Note', 'af-note', f.note || '')}
    ${id ? `<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin-bottom:12px;"><input type="checkbox" id="af-actif" ${f.actif === false ? '' : 'checked'} style="width:18px;height:18px;"> Fournisseur actif</label>` : ''}
    <button class="btn btn-primary" style="width:100%;" onclick="achSauverFournisseur('${id || ''}', ${depuisBon ? 'true' : 'false'})">${id ? 'Enregistrer' : 'Créer le fournisseur'}</button>`);
};
window.achSauverFournisseur = (id, depuisBon) => {
  if(!achPeutModifier()) return;
  const nom = mgtVal('af-nom'); if(!nom){ showToast('Nom requis'); return; }
  const fours = achGet('four'), k = id || mgtId('fo'), actif = document.getElementById('af-actif');
  fours[k] = Object.assign({}, fours[k] || {}, {nom, contact:mgtVal('af-contact'), tel:mgtVal('af-tel'), email:mgtVal('af-email'), adresse:mgtVal('af-adresse'), mf:mgtVal('af-mf'), rib:mgtVal('af-rib'),
    categories:mgtVal('af-cat'), note:mgtVal('af-note'), actif:actif ? actif.checked : true, maj:Date.now()});
  achSet('four', fours); mgtFermer(); showToast(id ? 'Fournisseur enregistré' : 'Fournisseur créé');
  if(depuisBon && achBonEdite){ if(!id) achBonEdite.b.fournisseurId = k; nav('ach-bons'); } else nav('ach-fournisseurs');
};
