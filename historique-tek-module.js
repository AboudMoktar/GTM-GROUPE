// ============================================================
// TEK-TREND — HISTORIQUE (commandes et factures déjà traitées)
// ============================================================
// Pour garder l'historique de l'année sans refaire tout le suivi :
//  - Commandes : une ligne par commande (PK202601-1, PK202602-1…) avec les quantités totales
//    de sous-vêtements, de brassières et d'exosquelettes ; regroupées par mois, avec les totaux.
//  - Factures : saisie rapide « numéro, date, montant » (une ligne par facture, payée ou non).
//    Elles s'ajoutent aux factures TEK-TREND (émises, origine « historique ») et apparaissent
//    dans la liste des factures ; les numéros manquants de l'année sont signalés.
// Accès : Facturation › Historique et Suivi des Commandes › Historique (même écran).
// Modification : administrateurs ; lecture : comptes autorisés à la facturation.
// Données : tek/fact_historique {commandes:{id:{num, sv, br, exo}}} et les factures existantes.
(function(){
const HK = () => factCle('tek', 'fact_historique');
const hN = (x) => (Number(x) || 0).toLocaleString('fr-FR');
const hE = (x) => (Number(x) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
let hAnnee = String(new Date().getFullYear());
let hLignesFact = 3;     // lignes vides proposées dans la saisie rapide des factures

function hPeutModifier(){ return !!currentUser && currentUser.role === 'admin'; }
function hDonnees(){ const d = getJSON(HK(), {}) || {}; if(!d.commandes) d.commandes = {}; return d; }
function hEnregistrer(d){ setJSON(HK(), d); }
function hId(){ return 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36); }
// PK202601-1 → {annee:'2026', mois:1, rang:1}
function hLireNum(n){
  const m = String(n || '').toUpperCase().replace(/\s+/g, '').match(/^PK(\d{4})(\d{2})-(\d{1,3})$/);
  if(!m || +m[2] < 1 || +m[2] > 12) return null;
  return {num:'PK' + m[1] + m[2] + '-' + (+m[3]), annee:m[1], mois:+m[2], rang:+m[3]};
}
function hCommandes(annee){
  return Object.entries(hDonnees().commandes).map(([id, c]) => Object.assign({id}, c, hLireNum(c.num) || {}))
    .filter(c => c.annee === annee).sort((a, b) => a.mois - b.mois || a.rang - b.rang);
}
// numéro proposé : la commande suivante (mois suivant, -1) après la dernière saisie
function hNumSuivant(annee){
  const l = hCommandes(annee);
  if(!l.length) return 'PK' + annee + '01-1';
  const d = l[l.length - 1], m = Math.min(12, d.mois + 1);
  return 'PK' + annee + String(m).padStart(2, '0') + '-1';
}
function hFactures(annee){
  const yy = String(annee).slice(2), l = factToutes('tek');
  return Object.entries(l).filter(([, f]) => f.type !== 'avoir' && f.statut === 'emise' && f.numero && f.numero.indexOf('FA' + yy + '/') === 0)
    .map(([id, f]) => ({id, f, rang:parseInt(f.numero.split('/')[1], 10) || 0, t:factTotaux(f, l)})).sort((a, b) => a.rang - b.rang);
}
function hManquants(annee){
  const l = hFactures(annee); if(!l.length) return [];
  const pris = new Set(l.map(x => x.rang)), max = l[l.length - 1].rang, out = [];
  for(let i = 1; i <= max; i++) if(!pris.has(i)) out.push(i);
  return out;
}
function hEcheance(d){ const P = factParams('tek'), j = Number(P.delai) || 30, x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + j); return x.toISOString().slice(0, 10); }
// facture saisie dans l'historique (montant seul) : modifiable directement dans la liste
function hEstHisto(f){ return !!(f.origine && f.origine.type === 'saisie' && /historique/.test(f.origine.label || '') && (f.lignes || []).length <= 1); }
function hLigneListe(x, ed){
  const f = x.f, st = factStatut(f, factToutes('tek')), etat = st === 'payee' ? 'Payée' : st === 'retard' ? '<span style="color:var(--bad);">En retard</span>' : 'À encaisser';
  if(!(ed && hEstHisto(f))) return `<tr class="hk-clic" onclick="factOuvrir('${x.id}')"><td><b>${esc(f.numero)}</b></td><td>${mgtDate(f.date)}</td><td class="hk-t">${hE(x.t.ttc)} €</td><td><span class="hk-obj">${esc(f.objet || (f.origine && f.origine.label) || '')}</span></td><td>${etat}</td><td></td></tr>`;
  const paye = (f.paiements || []).length > 0 || x.t.ttc === 0;
  return `<tr class="hk-le" data-id="${x.id}" oninput="histModif(this)" onchange="histModif(this)">
    <td><input class="mgt-in hk-en" value="${esc(f.numero)}" style="font-weight:700;text-transform:uppercase;"></td>
    <td><input class="mgt-in hk-ed" type="date" value="${esc(f.date || '')}"></td>
    <td><input class="mgt-in hk-em" type="number" min="0" step="0.01" inputmode="decimal" value="${x.t.ttc ? Math.round(x.t.ttc * 100) / 100 : ''}" placeholder="0,00"></td>
    <td><input class="mgt-in hk-ec" value="${esc(f.objet || '')}" placeholder="(facultatif)"></td>
    <td style="text-align:center;"><input class="hk-ep" type="checkbox" ${paye ? 'checked' : ''} style="width:22px;height:22px;" title="${st === 'retard' ? 'En retard' : st === 'payee' ? 'Payée' : 'À encaisser'}"></td>
    <td><button class="icon-btn" title="Supprimer cette facture" onclick="histSupprFact('${x.id}')">✕</button></td></tr>`;
}
function hNumFact(annee, rang){ return 'FA' + String(annee).slice(2) + '/' + String(rang).padStart(3, '0'); }

function renderHistorique(main){
  const ed = hPeutModifier(), annees = new Set([hAnnee, String(new Date().getFullYear())]);
  Object.values(hDonnees().commandes).forEach(c => { const x = hLireNum(c.num); if(x) annees.add(x.annee); });
  const body = mgtSection(main, 'Historique ' + hAnnee,
    `<select class="mgt-in" style="width:auto;" onchange="histAnnee(this.value)">${[...annees].sort().reverse().map(a => `<option ${a === hAnnee ? 'selected' : ''}>${a}</option>`).join('')}</select>`);
  const cmds = hCommandes(hAnnee), tot = cmds.reduce((s, c) => { s.sv += +c.sv || 0; s.br += +c.br || 0; s.exo += +c.exo || 0; return s; }, {sv:0, br:0, exo:0});
  const facts = hFactures(hAnnee), totF = facts.reduce((s, x) => s + x.t.ttc, 0), totRest = facts.reduce((s, x) => s + x.t.reste, 0), totEnc = Math.max(0, totF - totRest), manq = hManquants(hAnnee);
  const kpi = (v, l) => `<div class="card hk-kpi"><b>${v}</b><span>${l}</span></div>`;
  // regroupement par mois
  const parMois = {}; cmds.forEach(c => { (parMois[c.mois] = parMois[c.mois] || []).push(c); });
  const ligneCmd = (c) => `<tr data-id="${c.id}">
      <td><b>${esc(c.num)}</b></td>
      ${['sv', 'br', 'exo'].map(k => `<td>${ed ? `<input class="mgt-in hk-q" type="number" min="0" step="1" inputmode="numeric" value="${+c[k] || ''}" onchange="histMajCmd('${c.id}', '${k}', this.value)">` : hN(c[k])}</td>`).join('')}
      <td class="hk-t">${hN((+c.sv || 0) + (+c.br || 0) + (+c.exo || 0))}</td>
      <td>${ed ? `<button class="icon-btn" title="Supprimer" onclick="histSupprCmd('${c.id}')">✕</button>` : ''}</td></tr>`;
  const tableau = Object.keys(parMois).map(Number).sort((a, b) => a - b).map(m => {
    const l = parMois[m], s = k => l.reduce((x, c) => x + (+c[k] || 0), 0);
    return `<tr class="hk-mois"><td>${MOIS[m - 1].charAt(0).toUpperCase() + MOIS[m - 1].slice(1)} ${hAnnee}</td><td>${hN(s('sv'))}</td><td>${hN(s('br'))}</td><td>${hN(s('exo'))}</td><td class="hk-t">${hN(s('sv') + s('br') + s('exo'))}</td><td></td></tr>` + l.map(ligneCmd).join('');
  }).join('');
  body.innerHTML = `
    <div class="hk-kpis">
      ${kpi(cmds.length, 'commandes')}${kpi(hN(tot.sv + tot.br + tot.exo), 'pièces au total')}${kpi(hN(tot.sv), 'sous-vêtements')}${kpi(hN(tot.br), 'brassières')}${kpi(hN(tot.exo), 'exosquelettes')}${kpi(hE(totF) + ' €', facts.length + ' facture(s)')}
    </div>
    <div class="card">
      <h3 style="margin:0 0 4px;font-size:15px;">Commandes ${hAnnee}</h3>
      <p style="margin:0 0 8px;font-size:12.5px;color:var(--ink-soft);">Quantités totales par commande (déjà traitées), regroupées par mois.</p>
      <div class="hk-scroll"><table class="hk-tab">
        <thead><tr><th>N° commande</th><th>Sous-vêtements</th><th>Brassières</th><th>Exosquelettes</th><th>Total</th><th></th></tr></thead>
        <tbody>${tableau || `<tr><td colspan="6" class="hk-vide">Aucune commande saisie pour ${hAnnee}</td></tr>`}
          ${cmds.length ? `<tr class="hk-total"><td>Total ${hAnnee}</td><td>${hN(tot.sv)}</td><td>${hN(tot.br)}</td><td>${hN(tot.exo)}</td><td class="hk-t">${hN(tot.sv + tot.br + tot.exo)}</td><td></td></tr>` : ''}</tbody>
        ${ed ? `<tfoot><tr class="hk-ajout">
          <td><input id="hk-num" class="mgt-in" value="${hNumSuivant(hAnnee)}" placeholder="PK202601-1" style="font-weight:700;text-transform:uppercase;"></td>
          <td><input id="hk-sv" class="mgt-in hk-q" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></td>
          <td><input id="hk-br" class="mgt-in hk-q" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></td>
          <td><input id="hk-exo" class="mgt-in hk-q" type="number" min="0" step="1" inputmode="numeric" placeholder="0" onkeydown="if(event.key==='Enter') histAjouterCmd()"></td>
          <td colspan="2"><button class="btn btn-primary" style="width:100%;" onclick="histAjouterCmd()">Ajouter</button></td></tr></tfoot>` : ''}
      </table></div>
    </div>
    <div class="card">
      <h3 style="margin:0 0 4px;font-size:15px;">Factures ${hAnnee}</h3>
      ${facts.length ? `<div class="hk-tots"><div><span>Total facturé</span><b>${hE(totF)} €</b></div><div><span>Encaissé</span><b style="color:#15803d;">${hE(totEnc)} €</b></div><div><span>Reste à encaisser</span><b style="color:${totRest > 0.004 ? '#b42318' : 'inherit'};">${hE(totRest)} €</b></div></div>` : ''}
      ${ed ? `<p style="margin:0 0 8px;font-size:12.5px;color:var(--ink-soft);">Saisie rapide des factures déjà faites : numéro, date et montant. Elles s'ajoutent à la liste des factures.</p>
      <p style="margin:0 0 8px;font-size:12.5px;color:var(--ink-soft);">Facture sans montant (annulée, à zéro) : laissez le montant vide, elle est enregistrée à 0 €.</p>
      <div class="hk-scroll"><table class="hk-tab hk-fs">
        <thead><tr><th>N° facture</th><th>Date</th><th>Montant €</th><th>Commande</th><th>Payée</th></tr></thead>
        <tbody id="hk-fact">${hLignesSaisie()}</tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn btn-ghost" onclick="histPlusFact()">+ Ligne</button>
        <button class="btn btn-primary" style="flex:1;min-width:200px;" onclick="histEnregistrerFact()">Enregistrer les factures</button></div>` : ''}
      ${manq.length ? `<div class="hk-manq">Numéros manquants : ${manq.slice(0, 40).map(r => hNumFact(hAnnee, r)).join(', ')}${manq.length > 40 ? '…' : ''}</div>` : ''}
      <div class="hk-scroll" style="margin-top:10px;"><table class="hk-tab hk-liste">
        <thead><tr><th>N° facture</th><th>Date</th><th>Montant €</th><th>Commande</th><th>${ed ? 'Payée' : 'État'}</th><th></th></tr></thead>
        <tbody id="hk-liste">${facts.length ? facts.map(x => hLigneListe(x, ed)).join('')
          : `<tr><td colspan="6" class="hk-vide">Aucune facture ${hAnnee}</td></tr>`}
          ${facts.length ? `<tr class="hk-total"><td>Total ${hAnnee}</td><td></td><td class="hk-t">${hE(totF)} €</td><td colspan="3"></td></tr>
            <tr class="hk-total hk-enc"><td>Total encaissé</td><td></td><td class="hk-t">${hE(totEnc)} €</td><td colspan="3"></td></tr>
            <tr class="hk-total hk-rest"><td>Reste à encaisser</td><td></td><td class="hk-t">${hE(totRest)} €</td><td colspan="3"></td></tr>` : ''}</tbody></table></div>
      ${ed && facts.some(x => hEstHisto(x.f)) ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">
        <button class="btn btn-primary" id="hk-maj" style="flex:1;min-width:220px;" onclick="histEnregistrerModifs()" disabled>Enregistrer les modifications</button>
        <span style="font-size:12.5px;color:var(--ink-soft);">Les factures saisies à la main se modifient directement ici ; les autres s'ouvrent en touchant leur ligne.</span></div>` : ''}
    </div>`;
}
// lignes vides de la saisie rapide : numéros manquants d'abord, puis la suite
function hLignesSaisie(){
  const libres = hManquants(hAnnee), facts = hFactures(hAnnee); let suite = facts.length ? facts[facts.length - 1].rang : 0;
  const nums = []; for(let i = 0; i < hLignesFact; i++) nums.push(libres.length ? libres.shift() : ++suite);
  return nums.map(r => hLigneFact(hNumFact(hAnnee, r))).join('');
}
function hLigneFact(num){
  return `<tr class="hk-lf"><td><input class="mgt-in hk-fn" value="${num}" style="font-weight:700;text-transform:uppercase;"></td>
    <td><input class="mgt-in hk-fd" type="date" min="${hAnnee}-01-01" max="${hAnnee}-12-31"></td>
    <td><input class="mgt-in hk-fm" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></td>
    <td><input class="mgt-in hk-fc" placeholder="(facultatif)"></td>
    <td style="text-align:center;"><input class="hk-fp" type="checkbox" checked style="width:22px;height:22px;"></td></tr>`;
}
window.histModif = (tr) => { tr.classList.add('hk-mod'); const b = document.getElementById('hk-maj'); if(b) b.disabled = false; };
// le compteur suit le plus grand numéro de l'année : la prochaine facture prend le numéro suivant
function hRecalerCompteur(annees){
  const l = factToutes('tek'), cle = factCle('tek', 'fact_compteurs'), cpt = getJSON(cle, {}) || {}, t = cpt.FA || {};
  annees.forEach(an => { const yy = String(an).slice(2); let max = 0;
    Object.values(l).forEach(f => { if(f.type !== 'avoir' && f.statut === 'emise' && f.numero && f.numero.indexOf('FA' + yy + '/') === 0) max = Math.max(max, parseInt(f.numero.split('/')[1], 10) || 0); });
    t[an] = max; });
  cpt.FA = t; setJSON(cle, cpt);
}
window.histEnregistrerModifs = () => {
  if(!hPeutModifier()) return;
  const l = factToutes('tek'), lignes = [...document.querySelectorAll('#hk-liste .hk-le.hk-mod')], erreurs = [], annees = new Set([hAnnee]);
  if(!lignes.length){ showToast('Aucune modification'); return; }
  const autres = new Set(Object.entries(l).filter(([id]) => !lignes.some(tr => tr.dataset.id === id)).map(([, f]) => f.numero).filter(Boolean)), vus = new Set();
  const maj = [];
  lignes.forEach(tr => {
    tr.classList.remove('hk-err'); tr.removeAttribute('title');
    const num = tr.querySelector('.hk-en').value.toUpperCase().replace(/\s+/g, ''), date = tr.querySelector('.hk-ed').value, brut = tr.querySelector('.hk-em').value.trim(), m = brut ? parseFloat(brut.replace(',', '.')) : 0;
    const err = (t) => { tr.classList.add('hk-err'); tr.title = t; erreurs.push(t); };
    if(!/^FA\d{2}\/\d{1,4}$/.test(num)) return err('N° attendu au format FA26/001');
    if(autres.has(num) || vus.has(num)) return err(num + ' existe déjà');
    if(!date) return err('Date manquante pour ' + num);
    if('20' + num.slice(2, 4) !== date.slice(0, 4)) return err(num + ' : la date n\'est pas de l\'année 20' + num.slice(2, 4));
    if(!(m >= 0)) return err('Montant illisible pour ' + num);
    vus.add(num); maj.push({tr, num, date, m:Math.round(m * 100) / 100, cmd:tr.querySelector('.hk-ec').value.trim().toUpperCase(), paye:tr.querySelector('.hk-ep').checked});
  });
  maj.forEach(x => { const f = l[x.tr.dataset.id]; if(!f) return; annees.add(f.date ? f.date.slice(0, 4) : hAnnee); annees.add(x.date.slice(0, 4));
    f.numero = x.num; f.date = x.date; f.echeance = hEcheance(x.date); f.objet = x.cmd;
    f.lignes = [{designation:'Facture ' + x.num + (x.cmd ? ' — commande ' + x.cmd : ''), qte:1, pu:x.m, remise:0}];
    f.paiements = x.paye && x.m > 0 ? [{date:x.date, montant:x.m, mode:'virement', ref:''}] : []; });
  if(maj.length){ factEnregistrer('tek', l); hRecalerCompteur([...annees]); }
  const garder = erreurs.length;
  nav(activeTab);
  showToast(maj.length + ' facture(s) modifiée(s)' + (garder ? ' — ' + garder + ' non modifiée(s) : ' + erreurs[0] : ''));
};
window.histSupprFact = (id) => {
  if(!hPeutModifier()) return;
  const l = factToutes('tek'), f = l[id]; if(!f || !hEstHisto(f)) return;
  if(!confirm('Supprimer la facture ' + f.numero + ' de l\'historique ?')) return;
  const an = (f.date || hAnnee).slice(0, 4); delete l[id]; factEnregistrer('tek', l); hRecalerCompteur([an]);
  showToast('Facture ' + f.numero + ' supprimée'); nav(activeTab);
};
window.histAnnee = (a) => { hAnnee = a; hLignesFact = 3; nav(activeTab); };
window.histPlusFact = () => {
  const t = document.getElementById('hk-fact'); if(!t) return;
  const pris = [...t.querySelectorAll('.hk-fn')].map(i => parseInt((i.value.split('/')[1] || '0'), 10) || 0);
  const libres = hManquants(hAnnee).filter(r => pris.indexOf(r) < 0), facts = hFactures(hAnnee);
  const r = libres.length ? libres[0] : Math.max(facts.length ? facts[facts.length - 1].rang : 0, ...pris) + 1;
  t.insertAdjacentHTML('beforeend', hLigneFact(hNumFact(hAnnee, r)));
};
window.histAjouterCmd = () => {
  if(!hPeutModifier()) return;
  const x = hLireNum(mgtVal('hk-num'));
  if(!x){ showToast('N° de commande attendu au format PK202601-1'); return; }
  const d = hDonnees();
  if(Object.values(d.commandes).some(c => (hLireNum(c.num) || {}).num === x.num)){ showToast('La commande ' + x.num + ' est déjà saisie'); return; }
  const q = k => Math.max(0, parseInt(mgtVal('hk-' + k), 10) || 0), c = {num:x.num, sv:q('sv'), br:q('br'), exo:q('exo')};
  if(!c.sv && !c.br && !c.exo){ showToast('Saisissez au moins une quantité'); return; }
  d.commandes[hId()] = c; hEnregistrer(d);
  hAnnee = x.annee; showToast('Commande ' + x.num + ' ajoutée'); nav(activeTab);
  const n = document.getElementById('hk-sv'); if(n) n.focus();
};
window.histMajCmd = (id, k, v) => {
  if(!hPeutModifier()) return;
  const d = hDonnees(); if(!d.commandes[id]) return;
  d.commandes[id][k] = Math.max(0, parseInt(v, 10) || 0); hEnregistrer(d); nav(activeTab);
};
window.histSupprCmd = (id) => {
  if(!hPeutModifier()) return;
  const d = hDonnees(), c = d.commandes[id]; if(!c || !confirm('Supprimer la commande ' + c.num + ' de l\'historique ?')) return;
  delete d.commandes[id]; hEnregistrer(d); nav(activeTab);
};
window.histEnregistrerFact = () => {
  if(!hPeutModifier()) return;
  const l = factToutes('tek'), existants = new Set(Object.values(l).map(f => f.numero).filter(Boolean));
  const cl = factClients('tek'), cid = Object.keys(cl).find(k => (cl[k].nom || '').toUpperCase() === 'PERCKO') || Object.keys(cl)[0];
  if(!cid){ showToast('Ajoutez d\'abord le client PERCKO (Facturation › Clients)'); return; }
  const lignes = [...document.querySelectorAll('#hk-fact .hk-lf')], aCreer = [], vus = new Set(), erreurs = [];
  for(const tr of lignes){
    const num = tr.querySelector('.hk-fn').value.toUpperCase().replace(/\s+/g, ''), date = tr.querySelector('.hk-fd').value, brut = tr.querySelector('.hk-fm').value.trim(), m = parseFloat(brut.replace(',', '.'));
    tr.classList.remove('hk-err'); tr.removeAttribute('title');
    if(!date && !brut) continue;                                             // ligne laissée vide : ignorée
    const err = (t) => { tr.classList.add('hk-err'); tr.title = t; erreurs.push(t); };
    if(!/^FA\d{2}\/\d{1,4}$/.test(num)){ err('N° attendu au format FA26/001'); continue; }
    if(existants.has(num) || vus.has(num)){ err(num + ' existe déjà' + (existants.has(num) ? ' (voir la liste ci-dessous)' : ' (en double dans la saisie)')); continue; }
    if(!date){ err('Date manquante pour ' + num); continue; }
    if('20' + num.slice(2, 4) !== date.slice(0, 4)){ err(num + ' : la date n\'est pas de l\'année 20' + num.slice(2, 4)); continue; }
    if(brut && !(m >= 0)){ err('Montant illisible pour ' + num); continue; }
    vus.add(num);
    // facture sans montant (annulée, à zéro) : enregistrée à 0 pour garder la numérotation complète
    aCreer.push({tr, num, date, m:brut ? Math.round(m * 100) / 100 : 0, cmd:tr.querySelector('.hk-fc').value.trim().toUpperCase(), paye:tr.querySelector('.hk-fp').checked});
  }
  if(!aCreer.length){ showToast(erreurs.length ? erreurs[0] : 'Remplissez au moins une ligne : numéro et date'); return; }
  const c = cl[cid];
  aCreer.forEach(x => factCreer('tek', {numero:x.num, statut:'emise', date:x.date, echeance:hEcheance(x.date), clientId:cid, client:{nom:c.nom, adresse:c.adresse || '', mf:c.mf || ''},
    objet:x.cmd, lignes:[{designation:'Facture ' + x.num + (x.cmd ? ' — commande ' + x.cmd : ''), qte:1, pu:x.m, remise:0}], devise:'EUR', tva:0, timbre:0,
    paiements:x.paye && x.m > 0 ? [{date:x.date, montant:x.m, mode:'virement', ref:''}] : [], relances:[], origine:{type:'saisie', label:'historique (montant seul)'}}));
  // compteur : la prochaine facture continue après le plus grand numéro
  const cle = factCle('tek', 'fact_compteurs'), cpt = getJSON(cle, {}) || {}, t = cpt.FA || {};
  aCreer.forEach(x => { const an = '20' + x.num.slice(2, 4), r = parseInt(x.num.split('/')[1], 10); if((t[an] || 0) < r) t[an] = r; });
  cpt.FA = t; setJSON(cle, cpt);
  // les lignes en erreur restent à l'écran (avec leur saisie) pour être corrigées ; les autres sont enregistrées
  const garder = lignes.filter(tr => tr.classList.contains('hk-err')).map(tr => ({num:tr.querySelector('.hk-fn').value, date:tr.querySelector('.hk-fd').value, m:tr.querySelector('.hk-fm').value, cmd:tr.querySelector('.hk-fc').value, paye:tr.querySelector('.hk-fp').checked, t:tr.title}));
  hLignesFact = Math.max(1, 3 - garder.length); nav(activeTab);
  const zt = document.getElementById('hk-fact');
  if(zt && garder.length){
    zt.insertAdjacentHTML('afterbegin', garder.map(g => hLigneFact(g.num)).join(''));
    [...zt.querySelectorAll('.hk-lf')].slice(0, garder.length).forEach((tr, i) => { const g = garder[i]; tr.querySelector('.hk-fd').value = g.date; tr.querySelector('.hk-fm').value = g.m; tr.querySelector('.hk-fc').value = g.cmd; tr.querySelector('.hk-fp').checked = g.paye; tr.classList.add('hk-err'); tr.title = g.t; });
  }
  showToast(aCreer.length + ' facture(s) enregistrée(s)' + (garder.length ? ' — ' + garder.length + ' ligne(s) à corriger (en rouge) : ' + garder[0].t : ''));
};

// --- Raccordement : Facturation › Historique (TEK-TREND) et Suivi des Commandes › Historique ---
const hRouteur = window.renderFact;
window.renderFact = function(tab, main){ return tab === 'fact-historique' ? renderHistorique(main) : hRouteur(tab, main); };
window.renderHistoriqueTek = renderHistorique;
const hNavFact = window.factNavItems;
window.factNavItems = function(){
  const l = hNavFact();
  if(factSoc() === 'tek') l.splice(1, 0, {tab:'fact-historique', label:'Historique', icon:ICONS.historique, show:true});
  return l;
};
const hNav = window.navItems;
window.navItems = function(){
  const l = hNav();
  if(activeModule === 'commandes' && activeSociete === 'tek' && typeof canAccessFactures === 'function' && canAccessFactures())
    l.push({tab:'cmd-historique', label:'Historique', icon:ICONS.historique, show:true});
  return l;
};

const css = document.createElement('style');
css.textContent = `.hk-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px;}
.hk-kpi{margin:0!important;padding:12px!important;text-align:center;} .hk-kpi b{display:block;font-size:20px;font-weight:800;} .hk-kpi span{font-size:12px;color:var(--ink-soft);}
.hk-scroll{overflow-x:auto;} .hk-tab{width:100%;border-collapse:collapse;font-size:13.5px;}
.hk-tab th{text-align:left;font-size:12px;color:var(--ink-soft);font-weight:700;padding:6px;border-bottom:2px solid var(--border);white-space:nowrap;}
.hk-tab td{padding:5px 6px;border-bottom:1px solid var(--border-soft);vertical-align:middle;}
.hk-tab .hk-q{width:100%;min-width:70px;max-width:130px;} .hk-t{font-weight:700;font-variant-numeric:tabular-nums;}
.hk-mois td{background:var(--accent-bg);font-weight:800;color:var(--ink);} .hk-total td{font-weight:800;border-top:2px solid var(--border);}
.hk-vide{text-align:center;color:var(--ink-faint);padding:14px!important;} .hk-ajout td{padding-top:10px;}
.hk-fs input{width:100%;min-width:90px;} .hk-err td{background:rgba(220,38,38,.08);}
.hk-tots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 10px;} .hk-tots div{border:1px solid var(--border);border-radius:10px;padding:8px 10px;} .hk-tots span{display:block;font-size:12px;color:var(--ink-soft);} .hk-tots b{font-size:17px;font-variant-numeric:tabular-nums;}
.hk-enc td{color:#15803d;border-top:1px solid var(--border)!important;} .hk-rest td{color:#b42318;border-top:1px solid var(--border)!important;}
.hk-manq{margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.12);font-size:12.5px;}
.hk-le.hk-mod td{background:rgba(22,119,232,.07);} .hk-liste input{width:100%;min-width:80px;}
.hk-clic{cursor:pointer;} .hk-clic:hover td{background:var(--accent-bg);} .hk-obj{font-size:12px;color:var(--ink-soft);}
@media (max-width:900px){ .hk-kpis{grid-template-columns:repeat(3,minmax(0,1fr));} }
@media (max-width:600px){ .hk-kpis{grid-template-columns:repeat(2,minmax(0,1fr));} .hk-tab{font-size:12.5px;} .hk-tab .hk-q{min-width:58px;} #hk-num{min-width:130px;}
  .hk-fs thead{display:none;} .hk-fs tr.hk-lf{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 0;border-bottom:1px solid var(--border);}
  .hk-fs tr.hk-lf td{display:block;padding:0;border:0;} .hk-fs tr.hk-lf td:last-child{display:flex;align-items:center;gap:8px;font-size:13px;}
  .hk-fs tr.hk-lf td:last-child::before{content:'Payée';} .hk-fs input{min-width:0;} }`;
document.head.appendChild(css);
})();
