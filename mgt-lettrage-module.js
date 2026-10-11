// ============================================================
// MGT — FACTURATION & LETTRAGE (logique du CRM d'origine)
// ============================================================
// Reprend l'écran « Facturation & Lettrage » du CRM : statistiques (facturé / encaissé / reste),
// « Situation de paiement » (clients × 12 mois, mois impayés en rouge) et « Registre détaillé »
// des factures, avec import de l'historique 2026. Les factures restent dans la fiche client
// (mgt_clients[id].factures : {number, date, amount, paid, type, status, note}).
// Chargé après mgt-crm-ecrans.js et mgt-historique-2026.js.

const LET = {tab:'situation', q:'', an:String(new Date().getFullYear()), cid:''};
const LET_MOIS = ['JANV', 'FÉVR', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
const LET_ALIAS = {'faitplast':'fait plast', 'ifce':'ifce doga', 'slena':'slenna', 'mmgt':'mmgt', 'tek trend':'tek trend'};
const letMt = (n) => (Number(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:3, maximumFractionDigits:3});
const letReste = (f) => Math.max(0, crmNombre(f.amount) - crmNombre(f.paid));
const letImpayee = (f) => letReste(f) > 0.0005 || crmNorm(f.status || '').includes('impay');
function letFactures(){
  return crmToutesFactures().filter(f => (LET.an === 'all' || String(crmISO(f.date) || f.date || '').slice(0, 4) === LET.an) && (!LET.cid || f.clientId === LET.cid)
    && (!LET.q || crmNorm([f.number, f.nomClient, f.type, f.status].join(' ')).includes(crmNorm(LET.q))));
}
function letStatut(f){ const p = crmNombre(f.paid), a = crmNombre(f.amount); return p >= a - 0.0005 && a > 0 ? ['Payée', 'good'] : (p > 0 ? ['Partielle', 'warn'] : ['Impayée', 'bad']); }
function renderMgtLettrage(main){
  const ed = crmEd(), clients = Object.entries(crmClients()).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || '', 'fr'));
  const annees = Array.from(new Set(crmToutesFactures().map(f => String(crmISO(f.date) || f.date || '').slice(0, 4)).filter(Boolean).concat([LET.an !== 'all' ? LET.an : String(new Date().getFullYear())]))).sort().reverse();
  const b = mgtSection(main, ICONS.invoice + ' Facturation & Lettrage', ed ? `<button class="btn btn-ghost" onclick="letImporter()">Importer historique 2026</button><button class="btn btn-primary" onclick="crmForm('factures','')">+ Facture</button>` : '');
  b.innerHTML = `<div class="card" style="padding:10px 12px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">
      <input class="mgt-in" type="search" style="flex:1;min-width:150px;" placeholder="Rechercher facture ou client…" value="${esc(LET.q)}" oninput="LET.q=this.value;letRes()">
      <select class="mgt-in" onchange="LET.an=this.value;letRes()"><option value="all" ${LET.an === 'all' ? 'selected' : ''}>Toutes les années</option>${annees.map(a => `<option ${a === LET.an ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <select class="mgt-in" onchange="LET.cid=this.value;letRes()"><option value="">Tous les clients</option>${clients.map(([id, c]) => `<option value="${id}" ${id === LET.cid ? 'selected' : ''}>${esc(c.nom || '—')}</option>`).join('')}</select></div></div>
    <div id="let-res"></div>`;
  letRes();
}
window.letRes = function(){
  const z = document.getElementById('let-res'); if(!z) return;
  const l = letFactures(), tot = l.reduce((s, f) => s + crmNombre(f.amount), 0), enc = l.reduce((s, f) => s + Math.min(crmNombre(f.paid), crmNombre(f.amount)), 0);
  const tuile = (v, lb, cls) => `<div class="kpi-mini"><div style="font-family:var(--mono);font-size:15px;font-weight:800;" class="${cls || ''}">${v}</div><div style="font-size:10.5px;color:var(--ink-soft);text-align:center;">${lb}</div></div>`;
  const onglets = `<div class="mgt-onglets no-print" style="margin-top:8px;"><button class="${LET.tab === 'situation' ? 'actif' : ''}" onclick="LET.tab='situation';letRes()">Situation de paiement</button><button class="${LET.tab === 'registre' ? 'actif' : ''}" onclick="LET.tab='registre';letRes()">Registre détaillé</button></div>`;
  let corps;
  if(LET.tab === 'registre'){
    const num = (f) => { const m = String(f.number || '').match(/(\d+)$/); return m ? Number(m[1]) : Infinity; };
    corps = crmCarte('Registre détaillé des factures (' + l.length + ')', l.length ? l.slice().sort((a, c) => num(a) - num(c) || String(a.number).localeCompare(String(c.number), 'fr')).map(f => { const [s, cls] = letStatut(f);
      return `<div class="session-row" style="cursor:pointer;align-items:flex-start;" onclick="${crmEd() ? `crmForm('factures','${f.clientId}',${f.index})` : `crmOuvrir('${f.clientId}')`}"><div style="flex:1;min-width:0;"><b style="font-size:13px;">${esc(f.number || '—')}</b> <span style="font-size:11px;color:var(--ink-soft);">${crmDateFr(f.date)} · ${esc((f.type || 'AUTRE').toUpperCase())}</span>
        <div style="font-size:12px;">${esc(f.nomClient)}</div><div style="font-size:11px;color:var(--ink-soft);">Payé ${letMt(f.paid)} · Reste ${letMt(letReste(f))}</div></div>
        <div style="text-align:right;"><b style="font-size:13px;">${letMt(f.amount)}</b><div><span class="hour-rend ${cls}">${s}</span></div></div></div>`; }).join('') : crmVide('Aucune facture pour ce filtre.'));
  } else {
    const par = {}; l.forEach(f => { const m = Number(String(crmISO(f.date)).slice(5, 7)); if(!m) return; const r = par[f.clientId] || (par[f.clientId] = {tot:Array(12).fill(0), imp:Array(12).fill(false), somme:0});
      r.tot[m - 1] += crmNombre(f.amount); r.somme += crmNombre(f.amount); if(letImpayee(f)) r.imp[m - 1] = true; });
    const lignes = Object.entries(par).filter(([, r]) => r.somme > 0.0005).sort((a, c) => c[1].somme - a[1].somme), foot = Array(12).fill(0); lignes.forEach(([, r]) => r.tot.forEach((v, i) => foot[i] += v));
    corps = `<div class="card" style="padding:6px;"><div style="font-size:12px;font-weight:800;padding:6px 8px;">Situation de paiement clients <span style="font-weight:500;color:var(--ink-soft);">· mois impayé en rouge</span></div>
      <div class="fc-scroll"><table class="fc-t"><thead><tr><th style="text-align:left;">Client</th>${LET_MOIS.map(m => `<th>${m}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      ${lignes.map(([id, r]) => `<tr><td class="fc-nom"><b style="cursor:pointer;" onclick="crmOuvrir('${id}')">${esc(crmNomClient(id))}</b></td>${r.tot.map((v, i) => `<td style="font-size:11.5px;${r.imp[i] && v ? 'background:rgba(220,63,69,.16);color:var(--bad);font-weight:700;' : ''}">${v ? letMt(v) : '—'}</td>`).join('')}<td class="fc-tot">${letMt(r.somme)}</td></tr>`).join('') || `<tr><td colspan="14" style="padding:16px;color:var(--ink-soft);">Aucune facture pour ce filtre.</td></tr>`}
      </tbody>${lignes.length ? `<tfoot><tr style="font-weight:800;"><td class="fc-nom">TOTAL MOIS</td>${foot.map(v => `<td style="font-size:11.5px;">${v ? letMt(v) : '—'}</td>`).join('')}<td class="fc-tot">${letMt(foot.reduce((s, v) => s + v, 0))}</td></tr></tfoot>` : ''}</table></div></div>`;
  }
  z.innerHTML = `<div class="kpi-mini-grid" style="grid-template-columns:repeat(2,1fr);margin-top:8px;">${tuile(letMt(tot), 'Facturé')}${tuile(letMt(enc), 'Encaissé')}${tuile(letMt(Math.max(0, tot - enc)), 'Reste à encaisser', tot - enc > 0.0005 ? 'hour-rend warn' : '')}${tuile(l.length, 'Factures')}</div>${onglets}${corps}`;
};
// ---------- Import de l'historique 2026 (les factures déjà présentes, par numéro, ne sont jamais doublées) ----------
function letClientDe(source){
  const s = crmNorm(source), al = crmNorm(LET_ALIAS[s] || ''), cl = Object.entries(crmClients());
  const ex = cl.find(([, c]) => crmNorm(c.nom) === s || (al && crmNorm(c.nom) === al)); if(ex) return ex[0];
  const cand = cl.filter(([, c]) => { const n = crmNorm(c.nom); return n && ((s && (n.includes(s) || s.includes(n))) || (al && (n.includes(al) || al.includes(n)))); });
  return cand.length === 1 ? cand[0][0] : null;
}
window.letImporter = function(){
  if(!confirm('Importer les ' + MGT_HISTORIQUE_2026.length + ' factures 2026 de l\'historique Excel (celles déjà présentes sont ignorées) ?')) return;
  {
    const existants = new Set(crmToutesFactures().map(f => String(f.number || '').trim()).filter(Boolean)), clients = crmClients(), par = {}, sans = []; let ajout = 0, doublon = 0;
    MGT_HISTORIQUE_2026.forEach(h => {
      const n = String(h.number || '').trim(); if(!n) return; if(existants.has(n)){ doublon++; return; }
      const id = letClientDe(h.sourceClient); if(!id){ sans.push(h.sourceClient); return; }
      const rec = par[id] || (par[id] = JSON.parse(JSON.stringify(clients[id]))); rec.factures = crmTableau(rec.factures).slice();
      rec.factures.push({id:'FAC-2026-' + n, number:n, date:h.date, amount:h.amount, paid:0, type:h.type || 'AUTRE', status:'Impayée', note:'Import historique Excel LETTRAGE CLIENT 2026 — paiement à renseigner.'});
      existants.add(n); ajout++;
    });
    Object.entries(par).forEach(([id, rec]) => crmEnregistrerClient(id, rec));
    const inconnus = Array.from(new Set(sans));
    showToast(ajout + ' facture(s) importée(s), ' + doublon + ' déjà présente(s)' + (inconnus.length ? ' · client introuvable : ' + inconnus.join(', ') : ''));
    nav('mgt-lettrage');
  }
};
// ---------- Branchement ----------
MGT_GROUPES.ventes.onglets.push(['mgt-lettrage', 'Lettrage']);
MGT_PARENT['mgt-lettrage'] = 'mgt-offres';
const letRenduOrigine = window.renderMgt;
window.renderMgt = function(tab, main){
  if(tab !== 'mgt-lettrage') return letRenduOrigine(tab, main);
  renderMgtLettrage(main);
  const g = MGT_GROUPES.ventes;
  main.insertAdjacentHTML('afterbegin', `<div class="mgt-onglets no-print">${g.onglets.map(([t, l]) => `<button class="${t === tab ? 'actif' : ''}" onclick="nav('${t}')">${l}</button>`).join('')}</div>`);
};
if(typeof ACCUEIL_TUILES !== 'undefined') ACCUEIL_TUILES.forEach(t => { if(t[0] === 'fact-liste') t[0] = 'mgt-lettrage'; });
