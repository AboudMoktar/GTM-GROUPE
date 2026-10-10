// Module « Suivi chaîne » (TEK-TREND) : même principe que Rendement — Tableau, Fiche (saisie), Historique, Stats, Paramètres.
// S'appuie sur la fiche chaîne (fiche-chaine-module.js) : fcJour, fcCalcul, fcOuvrieres, fcParams…
(function(){
const SC_TABS = ['chaine-tableau', 'fiche-chaine', 'chaine-historique', 'chaine-stats', 'chaine-params'];
let scJours = 30;
const isoMoins = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toISODateLocal(d); };
function scTotalJour(date){
  const slots = getSlotsForDate(date); if(!slots.length) return null;
  const jour = fcJour(date), ouv = fcOuvrieres(); let q = 0, o = 0, p = 0, saisi = false, pres = 0; const lignes = [];
  ouv.forEach(([id, e]) => { const c = fcCalcul(id, e, date, jour); q += c.qty; o += c.obj; p += c.pertes; if(c.det.some(d => d.saisi)) saisi = true; if(c.etat.cls === 'good' || c.etat.cls === 'warn') pres++; lignes.push({id, nom:e.nom, c}); });
  return {date, q, o, p, saisi, pres, n:ouv.length, rend:o > 0 ? q / o * 100 : null, lignes};
}
function scPeriode(n){ const out = []; for(let i = 0; i < n; i++){ const t = scTotalJour(isoMoins(i)); if(t && t.saisi) out.push(t); } return out; }
const scJf = (d) => d.split('-').reverse().join('/');
const scTitre = (t, extra) => `<div class="flex-header" style="margin-bottom:10px;"><h2 style="margin:0;">${t}</h2>${extra || ''}</div>`;

function renderChaineTableau(m){
  const today = getTodayISO(), t = scTotalJour(today), per = scPeriode(14).reverse();
  if(!t){ m.innerHTML = `<div class="card">${scTitre('Suivi chaîne')}${buildEmptyState('Jour non travaillé', 'Aucun créneau programmé aujourd\'hui.')}</div>`; return; }
  const r = t.rend === null ? null : Math.round(t.rend);
  const cl = t.lignes.filter(x => x.c.obj > 0).sort((a, b) => (b.c.rend || 0) - (a.c.rend || 0));
  const bar = (x) => { const v = x.c.rend === null ? 0 : Math.round(x.c.rend); return `<div class="dd-lot"><div style="width:${Math.max(Math.min(v, 100), 3)}%"></div><span style="color:var(--ink);text-shadow:none;">${esc(x.nom)}</span><b>${x.c.qty}/${x.c.obj} · ${v} %</b></div>`; };
  const maxv = Math.max(1, ...per.map(p => Math.max(p.q, p.o)));
  const graphe = per.length ? `<div style="display:flex;align-items:flex-end;gap:5px;height:130px;">${per.map(p => `<div style="flex:1;text-align:center;font-size:9px;color:var(--ink-soft);"><div style="height:100px;display:flex;align-items:flex-end;justify-content:center;gap:2px;"><i style="width:45%;background:#0A5C6A;height:${Math.round(p.q / maxv * 100)}%;border-radius:3px 3px 0 0;" title="Pièces ${p.q}"></i><i style="width:45%;background:var(--surface-3);height:${Math.round(p.o / maxv * 100)}%;border-radius:3px 3px 0 0;" title="Objectif ${p.o}"></i></div>${p.date.slice(8)}/${p.date.slice(5, 7)}</div>`).join('')}</div><div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">■ Pièces · ■ Objectif (gris)</div>` : buildEmptyState('Pas encore de saisie', 'Les jours saisis dans la Fiche apparaîtront ici.');
  m.innerHTML = `<div class="card">${scTitre('Suivi chaîne — aujourd\'hui', `<button class="btn btn-primary" onclick="fcDate=null;nav('fiche-chaine')">Saisir la fiche</button>`)}
    <div class="dd-g4" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));">
      ${ddBoite(t.q, 'Pièces produites', 'ok')}${ddBoite(t.o, 'Objectif ajusté', 'nul')}${ddBoite(r === null ? '—' : r + ' %', 'Rendement', r === null ? 'nul' : (r >= 70 ? 'ok' : 'bad'))}${ddBoite(t.p + ' min', 'Pertes / arrêts', t.p ? 'bad' : 'nul')}${ddBoite(t.pres + '/' + t.n, 'Ouvrières présentes', 'ok')}
    </div></div>
    <div class="card" style="margin-top:12px;">${scTitre('Par ouvrière (aujourd\'hui)')}${cl.length ? cl.map(bar).join('') : buildEmptyState('Aucune donnée', 'Aucune ouvrière avec objectif aujourd\'hui.')}</div>
    <div class="card" style="margin-top:12px;">${scTitre('14 derniers jours saisis')}${graphe}</div>`;
}

function renderChaineHistorique(m){
  const l = scPeriode(60);
  m.innerHTML = `<div class="card">${scTitre('Historique (60 derniers jours)')}${l.length ? `<div class="table-wrap"><table class="fc-t"><thead><tr><th>Date</th><th>Pièces</th><th>Objectif</th><th>Rend.</th><th>Pertes</th><th>Présentes</th><th></th></tr></thead><tbody>${l.map(t => `<tr><td><b>${scJf(t.date)}</b></td><td class="fc-tot">${t.q}</td><td>${t.o}</td><td><span class="hour-rend ${fcCls(t.rend)}">${fcPct(t.rend)}</span></td><td>${t.p} min</td><td>${t.pres}/${t.n}</td><td><button class="btn btn-ghost fc-btn" onclick="fcDate='${t.date}';nav('fiche-chaine')">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>` : buildEmptyState('Aucune saisie', 'Aucune fiche enregistrée sur les 60 derniers jours.')}</div>`;
}

function renderChaineStats(m){
  const l = scPeriode(scJours), par = {}, motifs = {};
  l.forEach(t => t.lignes.forEach(x => { const a = par[x.id] || (par[x.id] = {nom:x.nom, q:0, o:0, p:0, j:0}); if(x.c.det.some(d => d.saisi)){ a.q += x.c.qty; a.o += x.c.obj; a.p += x.c.pertes; a.j++; } x.c.listePertes.forEach(p => { const k = p.motif || 'Autre'; motifs[k] = (motifs[k] || 0) + (parseInt(p.min) || 0); }); }));
  const rows = Object.values(par).filter(a => a.j).sort((a, b) => (b.o ? b.q / b.o : 0) - (a.o ? a.q / a.o : 0));
  const T = l.reduce((t, x) => ({q:t.q + x.q, o:t.o + x.o, p:t.p + x.p}), {q:0, o:0, p:0});
  const mt = Object.entries(motifs).sort((a, b) => b[1] - a[1]), mmax = mt.length ? mt[0][1] : 1;
  m.innerHTML = `<div class="card">${scTitre('Statistiques', `<select onchange="scJoursSet(this.value)">${[7, 14, 30, 60, 90].map(n => `<option value="${n}" ${n === scJours ? 'selected' : ''}>${n} derniers jours</option>`).join('')}</select>`)}
    <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:12px;">${ddBoite(l.length, 'Jours saisis', 'ok')}${ddBoite(T.q, 'Pièces', 'ok')}${ddBoite(T.o ? Math.round(T.q / T.o * 100) + ' %' : '—', 'Rendement moyen', 'ok')}${ddBoite(T.p + ' min', 'Pertes', T.p ? 'bad' : 'nul')}</div>
    ${rows.length ? `<div class="table-wrap"><table class="fc-t"><thead><tr><th>Ouvrière</th><th>Jours</th><th>Pièces</th><th>Objectif</th><th>Rend.</th><th>Pertes</th></tr></thead><tbody>${rows.map(a => `<tr><td class="fc-nom"><b>${esc(a.nom)}</b></td><td>${a.j}</td><td class="fc-tot">${a.q}</td><td>${a.o}</td><td><span class="hour-rend ${fcCls(a.o ? a.q / a.o * 100 : null)}">${fcPct(a.o ? a.q / a.o * 100 : null)}</span></td><td>${a.p} min</td></tr>`).join('')}</tbody></table></div>` : buildEmptyState('Aucune donnée', 'Rien de saisi sur cette période.')}</div>
    <div class="card" style="margin-top:12px;">${scTitre('Pertes par motif')}${mt.length ? mt.map(([k, v]) => `<div class="dd-lot"><div style="width:${Math.max(3, Math.round(v / mmax * 100))}%"></div><span style="color:var(--ink);text-shadow:none;">${esc(k)}</span><b>${v} min</b></div>`).join('') : buildEmptyState('Aucune perte', 'Aucune perte saisie sur la période.')}</div>`;
}
window.scJoursSet = (v) => { scJours = parseInt(v) || 30; nav('chaine-stats'); };

function renderChaineParams(m){
  const p = fcParams(), actifs = activeEmployees(), ch = p.chain, ok = currentUser.role === 'admin';
  m.innerHTML = `<div class="card">${scTitre('Paramètres de la chaîne')}<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Cochez les ouvrières de la chaîne de confection et fixez l'objectif par heure de chacune (par défaut : objectif horaire général).</p>
    <div class="table-wrap"><table class="fc-t"><thead><tr><th>Dans la chaîne</th><th>Ouvrière</th><th>Poste</th><th>Objectif / h</th></tr></thead><tbody>${actifs.map(([id, e]) => `<tr><td><input type="checkbox" ${(!ch || !ch.length || ch.indexOf(id) >= 0) ? 'checked' : ''} ${ok ? '' : 'disabled'} onchange="scChaineToggle('${id}',this.checked)"></td><td class="fc-nom"><b>${esc(e.nom)}</b></td><td>${esc(e.poste || '')}</td><td><input class="fc-objh" type="number" min="0" step="0.5" value="${fcObjH(id)}" ${ok ? '' : 'disabled'} onchange="scObjSet('${id}',this.value)"></td></tr>`).join('')}</tbody></table></div></div>`;
}
window.scChaineToggle = function(id, on){ const p = fcParams(), tous = activeEmployees().map(([i]) => i); let l = (p.chain && p.chain.length) ? p.chain.slice() : tous; l = on ? (l.indexOf(id) < 0 ? l.concat(id) : l) : l.filter(i => i !== id); p.chain = l; fcSaveParams(p); };
window.scObjSet = function(id, v){ const p = fcParams(), n = parseFloat(v); if(n > 0) p.obj[id] = n; else delete p.obj[id]; fcSaveParams(p); };

// Navigation et module
const scNavItems = window.navItems;
window.navItems = function(){
  if(activeModule === 'chaine') return [
    {tab:'chaine-tableau', label:'Tableau', icon:ICONS.dashboard, show:true},
    {tab:'fiche-chaine', label:'Fiche', icon:ICONS.team, show:canSaisie(currentUser.role) || currentUser.role === 'viewer', onclick:"fcDate=null;nav('fiche-chaine')"},
    {tab:'chaine-historique', label:'Historique', icon:ICONS.historique, show:true},
    {tab:'chaine-stats', label:'Stats', icon:ICONS.stats, show:true},
    {tab:'chaine-params', label:'Params', icon:ICONS.params, show:currentUser.role === 'admin'}
  ].filter(i => i.show);
  return scNavItems().filter(i => i.tab !== 'fiche-chaine');
};
const scNavOrigine = window.nav;
window.nav = function(tab){
  const r = scNavOrigine.apply(this, arguments), m = document.getElementById('main');
  try {
    if(m && tab === 'chaine-tableau') renderChaineTableau(m);
    else if(m && tab === 'chaine-historique') renderChaineHistorique(m);
    else if(m && tab === 'chaine-stats') renderChaineStats(m);
    else if(m && tab === 'chaine-params') renderChaineParams(m);
  } catch(e) { console.error('Suivi chaîne', e); }
  return r;
};
const scChoose = window.chooseModule;
window.chooseModule = function(mod){ if(mod === 'chaine'){ activeModule = 'chaine'; renderShell(); return; } return scChoose.apply(this, arguments); };
const scMods = window.modulesDeSociete;
window.modulesDeSociete = function(soc){ const l = scMods(soc); return (soc === 'tek' && l.indexOf('rendement') >= 0 && l.indexOf('chaine') < 0) ? l.concat('chaine') : l; };
})();
