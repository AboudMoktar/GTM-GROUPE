// ============================================================
// FACTURATION TEK-TREND — SAISIE DES FACTURES DÉJÀ ÉMISES (factures PERCKO 2026)
// ============================================================
// Écran de saisie rapide (Facturation › « Saisir une facture déjà émise ») pour reprendre les
// factures papier déjà faites : numéro d'origine (FA26/0xx), date, destination (NEOLYS / ALLOGA),
// quantités par article du catalogue (prix du catalogue modifiables), frais et lignes libres,
// colis et poids, et le paiement s'il a déjà été reçu.
// La facture est enregistrée directement « émise » avec son numéro d'origine (origine « Saisie »),
// et le compteur passe au-delà pour que la prochaine facture continue la numérotation.
// Une facture saisie se corrige depuis cet écran (bouton « Corriger la saisie » sur la facture).
// Données : les mêmes factures TEK-TREND (aucune nouvelle collection, aucune nouvelle règle Firebase).
(function(){
let fsId = null;   // facture en cours de correction (null = nouvelle saisie)
let fsGarde = {};  // date, destination et paiement gardés pour la facture suivante
const fsN = (x) => (Number(x) || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
function fsNumeroOk(n){ return /^FA\d{2}\/\d{1,4}$/.test(n); }
function fsAnnee(n){ return '20' + n.slice(2, 4); }
function fsRang(n){ return parseInt(n.split('/')[1], 10) || 0; }
/* numéro proposé : le suivant du plus grand numéro FA de l'année */
function fsNumeroSuivant(annee){
  const yy = String(annee).slice(2); let max = 0;
  Object.values(factToutes('tek')).forEach(f => { if(f.numero && f.numero.indexOf('FA' + yy + '/') === 0) max = Math.max(max, fsRang(f.numero)); });
  return 'FA' + yy + '/' + String(max + 1).padStart(3, '0');
}
function fsClientPercko(){
  const cl = factClients('tek'); return Object.keys(cl).find(k => (cl[k].nom || '').toUpperCase() === 'PERCKO') || Object.keys(cl)[0] || '';
}

// --- Écran ---
function renderFactSaisie(main){
  const ed = canEditFact('tek'); if(!ed){ nav('fact-liste'); return; }
  const R = percReglages(), f = fsId ? factToutes('tek')[fsId] : null, p = (f && f.percko) || {};
  const dest = f ? (p.destination || '') : (fsGarde.dest !== undefined ? fsGarde.dest : 'NEOLYS');
  const date = f ? f.date : (fsGarde.date || getTodayISO());
  const qArt = {}, puArt = {}, libres = [], frais = {};
  if(f) (f.lignes || []).forEach(l => {
    const i = l.code ? R.catalogue.findIndex(a => a.code === l.code && (a.lib + (a.etiq ? '\n' + a.etiq : '')) === l.designation) : -1;
    if(i >= 0){ qArt[i] = l.qte; puArt[i] = l.pu; return; }
    const j = R.frais.findIndex(x => x.lib === l.designation); if(j >= 0 && !(j in frais)){ frais[j] = l; return; }
    libres.push(l);
  });
  while(libres.length < 2) libres.push({designation:'', qte:'', pu:''});
  const paye = f ? (f.paiements || [])[0] : null;
  const prix = (a) => Number((a.prix || {})[dest] != null ? a.prix[dest] : a.prix.NEOLYS) || 0;
  const b = mgtSection(main, `<span style="cursor:pointer;" onclick="fsQuitter()">‹</span> ${f ? 'Corriger la facture ' + esc(f.numero) : 'Saisir une facture déjà émise'}`, '');
  b.innerHTML = `
    <div class="card"><p style="font-size:12.5px;color:var(--ink-soft);margin:0;">Pour reprendre les factures papier déjà faites (PERCKO) : la facture est enregistrée <b>émise</b>, avec son numéro d'origine. Saisissez les quantités ; les prix viennent du catalogue (modifiables).</p></div>
    <div class="card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;min-width:130px;">${mgtChamp('N° de facture', 'fs-num', f ? f.numero : fsNumeroSuivant(date.slice(0, 4)), 'text', 'placeholder="FA26/001" style="font-weight:800;"')}</div>
        <div style="flex:1;min-width:130px;">${mgtChamp('Date', 'fs-date', date, 'date')}</div>
        <div style="flex:1;min-width:130px;">${mgtChamp('Échéance', 'fs-ech', f ? f.echeance : '', 'date')}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;min-width:130px;">${mgtSelect('Destination', 'fs-dest', Object.keys(R.dest).map(k => [k, k]).concat([['', 'Autre']]), dest)}</div>
        <div style="flex:2;min-width:180px;">${mgtChamp('Objet / N° de commande', 'fs-objet', f ? f.objet : (fsGarde.objet || ''), 'text', 'placeholder="ex. Expédition PK202611"')}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;min-width:90px;">${mgtChamp('Colis', 'fs-colis', p.colis || '', 'number', 'min="0"')}</div>
        <div style="flex:1;min-width:90px;">${mgtChamp('Poids brut (kg)', 'fs-pb', p.poidsBrut || '', 'number', 'min="0" step="0.1"')}</div>
        <div style="flex:1;min-width:90px;">${mgtChamp('Poids net (kg)', 'fs-pn', p.poidsNet || '', 'number', 'min="0" step="0.1"')}</div>
      </div>
    </div>
    <div class="card" style="padding:8px 10px;">
      <h3 style="margin:2px 0 6px;font-size:14px;">Articles (quantités)</h3>
      <div class="fs-grille fs-tete"><div>Article</div><div>Qté</div><div>P.U. €</div><div>Montant</div></div>
      ${R.catalogue.map((a, i) => `<div class="fs-grille fs-art" data-i="${i}"><div class="fs-lib"><b>${esc(a.code || '—')}</b> ${esc(a.lib)} <span>${esc(a.etiq || '')}</span></div>
        <input class="mgt-in fs-q" type="number" min="0" step="1" inputmode="numeric" value="${qArt[i] || ''}" oninput="fsCalc()"><input class="mgt-in fs-pu" type="number" min="0" step="0.01" value="${i in puArt ? puArt[i] : prix(a)}" oninput="fsCalc()"><div class="fs-m"></div></div>`).join('')}
    </div>
    <div class="card" style="padding:8px 10px;">
      <h3 style="margin:2px 0 6px;font-size:14px;">Frais et déclarations</h3>
      ${R.frais.map((x, j) => { const l = frais[j]; return `<div class="fs-grille fs-fr" data-j="${j}"><input class="mgt-in fs-fl" value="${esc(l ? l.designation : x.lib)}"><input class="mgt-in fs-q" type="number" min="0" step="1" value="${l ? l.qte : ''}" oninput="fsCalc()"><input class="mgt-in fs-pu" type="number" min="0" step="0.01" value="${l ? l.pu : (x.pu || '')}" oninput="fsCalc()"><div class="fs-m"></div></div>`; }).join('')}
      <h3 style="margin:10px 0 6px;font-size:14px;">Autres lignes (article absent du catalogue…)</h3>
      <div id="fs-libres">${libres.map(l => fsLigneLibre(l)).join('')}</div>
      <button class="btn btn-ghost" style="margin-top:6px;padding:6px 12px;font-size:12px;" onclick="fsAjouterLibre()">+ Ligne</button>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;"><span style="font-size:13px;color:var(--ink-soft);">Total HT (TVA 0)</span><b id="fs-total" style="font-size:20px;font-family:var(--mono);">0,00 €</b></div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:14px;font-weight:600;"><input type="checkbox" id="fs-paye" ${paye || (!f && fsGarde.paye) ? 'checked' : ''} onchange="fsCalc()"> Déjà payée</label>
      <div id="fs-pai" style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;min-width:130px;">${mgtChamp('Date du paiement', 'fs-pdate', paye ? paye.date : (fsGarde.pdate || ''), 'date')}</div>
        <div style="flex:1;min-width:130px;">${mgtSelect('Mode', 'fs-pmode', Object.entries(FACT_MODES), paye ? paye.mode : (fsGarde.pmode || 'virement'))}</div>
        <div style="flex:1;min-width:130px;">${mgtChamp('Montant reçu (€)', 'fs-pmont', paye ? paye.montant : '', 'number', 'min="0" step="0.01" placeholder="= total"')}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${f ? '' : `<button class="btn btn-primary" style="flex:2;min-width:220px;" onclick="fsEnregistrer(true)">✔ Enregistrer et saisir la suivante</button>`}
        <button class="btn ${f ? 'btn-primary' : 'btn-ghost'}" style="flex:1;min-width:150px;" onclick="fsEnregistrer(false)">✔ Enregistrer${f ? ' la correction' : ''}</button>
        <button class="btn btn-ghost" onclick="fsQuitter()">Annuler</button>
      </div>
    </div>`;
  const d = document.getElementById('fs-dest');
  if(d) d.onchange = () => { const R2 = percReglages(); document.querySelectorAll('.fs-art').forEach(r => { const a = R2.catalogue[+r.dataset.i]; const v = Number((a.prix || {})[d.value] != null ? a.prix[d.value] : a.prix.NEOLYS) || 0; r.querySelector('.fs-pu').value = v; }); fsCalc(); };
  fsCalc();
}
function fsLigneLibre(l){
  return `<div class="fs-grille fs-li"><input class="mgt-in fs-fl" placeholder="Désignation" value="${esc(l.designation || '')}"><input class="mgt-in fs-q" type="number" min="0" step="1" value="${l.qte === '' ? '' : (l.qte || '')}" oninput="fsCalc()"><input class="mgt-in fs-pu" type="number" min="0" step="0.01" value="${l.pu === '' ? '' : (l.pu || '')}" oninput="fsCalc()"><div class="fs-m"></div></div>`;
}
window.fsAjouterLibre = () => { document.getElementById('fs-libres').insertAdjacentHTML('beforeend', fsLigneLibre({})); };
window.fsCalc = () => {
  let t = 0;
  document.querySelectorAll('.fs-art, .fs-fr, .fs-li').forEach(r => { const q = parseFloat(r.querySelector('.fs-q').value) || 0, pu = parseFloat(r.querySelector('.fs-pu').value) || 0, m = q * pu; t += m; r.querySelector('.fs-m').textContent = m ? fsN(m) : ''; r.classList.toggle('on', q > 0); });
  const e = document.getElementById('fs-total'); if(e) e.textContent = fsN(t) + ' €';
  const pa = document.getElementById('fs-pai'), c = document.getElementById('fs-paye'); if(pa && c) pa.style.display = c.checked ? 'flex' : 'none';
  return t;
};
window.fsQuitter = () => { const id = fsId; fsId = null; if(id) factOuvrir(id); else nav('fact-liste'); };
window.fsCorriger = (id) => { fsId = id; nav('fact-saisie'); };
/* lit l'écran, contrôle, enregistre la facture émise ; renvoie l'id ou null */
window.fsEnregistrer = (suivante) => {
  const R = percReglages(), l = factToutes('tek'), num = mgtVal('fs-num').toUpperCase().replace(/\s+/g, ''), date = mgtVal('fs-date'), dest = mgtVal('fs-dest');
  if(!fsNumeroOk(num)){ showToast('N° de facture attendu au format FA26/025'); return null; }
  if(Object.entries(l).some(([id, x]) => id !== fsId && x.numero === num)){ showToast('La facture ' + num + ' existe déjà'); return null; }
  if(!date){ showToast('Choisissez la date de la facture'); return null; }
  if(fsAnnee(num) !== date.slice(0, 4)){ showToast('Le numéro ' + num + ' ne correspond pas à l\'année de la date (' + date.slice(0, 4) + ')'); return null; }
  const lignes = [];
  document.querySelectorAll('.fs-art').forEach(r => { const q = parseFloat(r.querySelector('.fs-q').value) || 0; if(!q) return; const a = R.catalogue[+r.dataset.i];
    lignes.push({ref:a.code, code:a.code, refKey:a.ref, designation:a.lib + (a.etiq ? '\n' + a.etiq : ''), qte:q, pu:parseFloat(r.querySelector('.fs-pu').value) || 0, remise:0}); });
  document.querySelectorAll('.fs-fr, .fs-li').forEach(r => { const q = parseFloat(r.querySelector('.fs-q').value) || 0, d = r.querySelector('.fs-fl').value.trim(); if(!q || !d) return;
    lignes.push({ref:r.classList.contains('fs-fr') ? 'ART0002' : '', designation:d, qte:q, pu:parseFloat(r.querySelector('.fs-pu').value) || 0, remise:0}); });
  if(!lignes.some(x => x.qte * x.pu > 0)){ showToast('Saisissez au moins une quantité avec un prix'); return null; }
  const cid = fsClientPercko(), c = factClients('tek')[cid];
  if(!c){ showToast('Ajoutez d\'abord le client PERCKO (Facturation › Clients)'); return null; }
  const D = R.dest[dest] || null, ht = lignes.reduce((s, x) => s + x.qte * x.pu, 0);
  const paiements = [];
  if(document.getElementById('fs-paye').checked){
    const m = parseFloat(mgtVal('fs-pmont')), pd = mgtVal('fs-pdate');
    if(!pd){ showToast('Date du paiement manquante'); return null; }
    paiements.push({date:pd, montant:m > 0 ? m : Math.round(ht * 100) / 100, mode:mgtVal('fs-pmode') || 'virement', ref:''});
  }
  const ancien = fsId ? l[fsId] : null, pk = Object.assign({destination:'', codeClient:'', livraison:'', transport:'', colis:'', poidsBrut:'', poidsNet:'', valeurMatiere:'', composition:''}, ancien && ancien.percko || {});
  pk.destination = dest; if(!ancien || (ancien.percko || {}).destination !== dest){ pk.codeClient = D ? D.code : ''; pk.livraison = D ? D.livraison : ''; pk.transport = D ? D.transport || '' : ''; }
  pk.colis = mgtVal('fs-colis'); pk.poidsBrut = mgtVal('fs-pb'); pk.poidsNet = mgtVal('fs-pn');
  const champs = {numero:num, statut:'emise', date, echeance:mgtVal('fs-ech') || date, clientId:cid, client:{nom:c.nom, adresse:c.adresse || '', mf:c.mf || ''},
    objet:mgtVal('fs-objet'), lignes, devise:'EUR', tva:0, timbre:0, paiements, percko:pk, origine:{type:'saisie', label:'facture déjà émise'}};
  let id = fsId;
  if(id){ Object.assign(l[id], champs); factEnregistrer('tek', l); }
  else { id = factCreer('tek', Object.assign({relances:[]}, champs)); }
  /* compteur : la prochaine facture émise continue après le plus grand numéro saisi */
  const cle = factCle('tek', 'fact_compteurs'), cpt = getJSON(cle, {}) || {}, t = cpt.FA || {}, an = fsAnnee(num);
  if((t[an] || 0) < fsRang(num)){ t[an] = fsRang(num); cpt.FA = t; setJSON(cle, cpt); }
  fsGarde = {date, dest, objet:'', paye:paiements.length > 0, pdate:paiements.length ? paiements[0].date : '', pmode:paiements.length ? paiements[0].mode : 'virement'};
  showToast('Facture ' + num + ' enregistrée (' + fsN(ht) + ' €)');
  const corr = !!fsId; fsId = null;
  if(suivante && !corr){ nav('fact-saisie'); const n = document.getElementById('fs-num'); if(n) n.focus(); }
  else factOuvrir(id);
  return id;
};

// --- Raccordement : route, bouton dans la liste, correction depuis la facture, libellé d'origine ---
const fsRouteur = window.renderFact;
window.renderFact = function(tab, main){ return tab === 'fact-saisie' ? renderFactSaisie(main) : fsRouteur(tab, main); };
const fsNavParent = window.navParent;
window.navParent = function(tab){ return tab === 'fact-saisie' ? 'fact-liste' : fsNavParent(tab); };
const fsListe = window.renderFactListe;
window.renderFactListe = function(main){
  fsListe(main);
  if(factSoc() !== 'tek' || !canEditFact('tek')) return;
  const b = document.getElementById('mgt-body'); if(!b) return;
  const n = Object.values(factToutes('tek')).filter(f => f.origine && f.origine.type === 'saisie').length;
  b.insertAdjacentHTML('afterbegin', `<div class="card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <div style="flex:1;min-width:200px;"><b style="font-size:14px;">Factures déjà émises (papier)</b><div style="font-size:12px;color:var(--ink-soft);">Reprendre les factures PERCKO déjà faites : numéro, date, quantités, paiement.${n ? ' ' + n + ' déjà saisie(s).' : ''}</div></div>
    <button class="btn btn-primary" onclick="fsId=null; nav('fact-saisie')">🗂 Saisir une facture déjà émise</button></div>`);
};
window.fsIdSet = (v) => { fsId = v; };
const fsEdit = window.renderFactEdit;
window.renderFactEdit = function(main){
  fsEdit(main);
  const f = factSoc() === 'tek' ? factToutes('tek')[factId] : null;
  if(!f || !f.origine || f.origine.type !== 'saisie' || !canEditFact('tek')) return;
  const h = main.querySelector('.flex-header .actions');
  if(h) h.insertAdjacentHTML('afterbegin', `<button class="btn btn-ghost" onclick="fsCorriger('${factId}')">✏️ Corriger la saisie</button>`);
};
const fsOrigine = window.factOrigineLabel;
window.factOrigineLabel = function(o){ return o && o.type === 'saisie' ? 'Saisie (facture déjà émise)' : fsOrigine(o); };

const css = document.createElement('style');
css.textContent = `.fs-grille{display:grid;grid-template-columns:minmax(0,1fr) 74px 84px 90px;gap:6px;align-items:center;padding:4px 0;border-top:1px solid var(--border-soft);}
.fs-grille.fs-tete{font-size:11px;color:var(--ink-soft);border-top:0;} .fs-grille input{padding:6px 6px;min-height:0;height:34px;}
.fs-lib{font-size:12.5px;min-width:0;line-height:1.25;} .fs-lib span{color:var(--ink-soft);} .fs-m{text-align:right;font-family:var(--mono);font-size:12.5px;font-weight:700;}
.fs-grille.on{background:rgba(37,99,235,.06);} @media (max-width:520px){ .fs-grille{grid-template-columns:minmax(0,1fr) 60px 70px;} .fs-grille .fs-m{display:none;} }`;
document.head.appendChild(css);
})();
