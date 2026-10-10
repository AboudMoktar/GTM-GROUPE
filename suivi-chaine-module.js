// Module « Suivi chaîne » (TEK-TREND) : Tableau, Fiche (saisie), Historique, Stats, Rapports, Params.
// Logique : pièces de la chaîne = dernier poste ; objectif de la chaîne = poste goulot (voir fcTotaux dans fiche-chaine-module.js).
(function(){
let scMode = '7j', scDu = null, scAu = null, scRType = 'chaine-jours';
const iso = (d) => toISODateLocal(d);
const isoMoins = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const scJf = (d) => d.split('-').reverse().join('/');
const scMin5 = () => isoMoins(1826);
// ---------- Période : jour / 7 jours / ce mois / personnalisé (jusqu'à 5 ans) ----------
function scRange(){
  const t = getTodayISO();
  if(scMode === 'jour'){ const j = scAu || t; return {du:j, au:j}; }
  if(scMode === '7j') return {du:isoMoins(6), au:t};
  if(scMode === 'mois') return {du:t.slice(0, 8) + '01', au:t};
  return {du:scDu || isoMoins(29), au:scAu || t};
}
function scLibelle(r){ return r.du === r.au ? scJf(r.du) : scJf(r.du) + ' au ' + scJf(r.au); }
function scBarre(page){
  const r = scRange(), t = getTodayISO(), mini = scMin5();
  const b = (k, l) => `<button class="btn ${scMode === k ? 'btn-primary' : 'btn-ghost'} fc-btn" onclick="scModeSet('${k}','${page}')">${l}</button>`;
  return `<div class="sc-bar">${b('jour', 'Jour')}${b('7j', '7 jours')}${b('mois', 'Ce mois')}${b('perso', 'Personnalisé')}
    ${scMode === 'jour' ? `<input type="date" value="${r.au}" min="${mini}" max="${t}" onchange="scDatesSet(this.value,this.value,'${page}')">` : ''}
    ${scMode === 'perso' ? `<label>Du <input type="date" value="${r.du}" min="${mini}" max="${r.au}" onchange="scDatesSet(this.value,null,'${page}')"></label><label>Au <input type="date" value="${r.au}" min="${r.du}" max="${t}" onchange="scDatesSet(null,this.value,'${page}')"></label>` : ''}
    <span class="sc-per">${scLibelle(r)}</span></div>`;
}
window.scModeSet = function(m, page){ const r = scRange(); scMode = m; if(m === 'perso'){ scDu = r.du; scAu = r.au; } if(m === 'jour') scAu = r.au; nav(page); };
window.scDatesSet = function(du, au, page){ if(du) scDu = du; if(au) scAu = au; if(scMode === 'jour'){ scAu = du || au; } else { if(!scDu) scDu = isoMoins(29); if(!scAu) scAu = getTodayISO(); if(scDu > scAu){ if(du) scAu = scDu; else scDu = scAu; } } nav(page); };
// ---------- Données ----------
function scTotalJour(date){
  const slots = getSlotsForDate(date); if(!slots.length) return null;
  const jour = fcJour(date), T = fcTotaux(date, jour);
  return Object.assign({date, saisi:T.calc.some(x => x.c.det.some(d => d.saisi))}, T);
}
function scPlage(du, au){ const out = [], d = new Date(au + 'T00:00:00'), f = new Date(du + 'T00:00:00'); for(; d >= f; d.setDate(d.getDate() - 1)){ const k = iso(d); if(!getJSON('fc_' + k, null)) continue; const t = scTotalJour(k); if(t && t.saisi) out.push(t); } return out; }
function scAgg(du, au){
  const jours = scPlage(du, au), ouv = {}, postes = {}, pertes = [], motifs = {};
  const tot = jours.reduce((t, j) => ({q:t.q + j.q, o:t.o + j.o, p:t.p + j.p}), {q:0, o:0, p:0});
  jours.forEach(j => { j.calc.forEach(x => {
    if(x.c.det.some(d => d.saisi)){ const a = ouv[x.id] || (ouv[x.id] = {nom:x.e.nom, poste:x.poste, j:0, q:0, o:0, p:0}); a.poste = x.poste; a.j++; a.q += x.c.qty; a.o += x.c.obj; a.p += x.c.pertes;
      const b = postes[x.poste] || (postes[x.poste] = {nom:x.poste, ids:{}, q:0, o:0, p:0}); b.ids[x.id] = 1; b.q += x.c.qty; b.o += x.c.obj; b.p += x.c.pertes; }
    x.c.listePertes.forEach(l => { const m = l.motif || 'Autre', mn = parseInt(l.min) || 0; motifs[m] = (motifs[m] || 0) + mn; pertes.push([scJf(j.date), x.e.nom, x.poste, mn, m, l.note || '']); }); }); });
  return {jours, tot, ouv:Object.values(ouv), postes:Object.values(postes), pertes, motifs};
}
const scPct = (q, o) => o > 0 ? Math.round(q / o * 100) : '';
function scRapport(type, du, au){
  const A = scAgg(du, au), per = scLibelle({du, au}), T = A.tot;
  const resume = [['Période', per], ['Jours saisis', A.jours.length], ['Pièces chaîne', T.q], ['Objectif chaîne', T.o], ['Rendement', T.o ? Math.round(T.q / T.o * 100) + ' %' : '—'], ['Pertes', T.p + ' min']];
  const nom = (k) => 'suivi_chaine_' + k + '_' + du + '_' + au;
  if(type === 'chaine-jours') return {titre:'Suivi chaîne — Journalier — ' + per, fichier:nom('jours'), entetes:['Date', 'Pièces (dernier poste)', 'Objectif chaîne (goulot)', 'Goulot', 'Rendement %', 'Pertes (min)', 'Présentes', 'Ouvrières'],
    lignes:A.jours.map(j => [scJf(j.date), j.q, j.o, j.goulot ? j.goulot.nom : '', scPct(j.q, j.o), j.p, j.pres, j.n]), resume};
  if(type === 'chaine-ouv') return {titre:'Suivi chaîne — Par ouvrière — ' + per, fichier:nom('ouvrieres'), entetes:['Ouvrière', 'Poste', 'Jours', 'Pièces', 'Objectif', 'Rendement %', 'Pertes (min)'],
    lignes:A.ouv.sort((a, b) => (b.o ? b.q / b.o : 0) - (a.o ? a.q / a.o : 0)).map(a => [a.nom, a.poste, a.j, a.q, a.o, scPct(a.q, a.o), a.p]), resume};
  if(type === 'chaine-postes') return {titre:'Suivi chaîne — Par poste — ' + per, fichier:nom('postes'), entetes:['Poste', 'Ouvrières', 'Pièces', 'Objectif', 'Rendement %', 'Pertes (min)'],
    lignes:A.postes.map(b => [b.nom, Object.keys(b.ids).length, b.q, b.o, scPct(b.q, b.o), b.p]), resume};
  if(type === 'chaine-pertes') return {titre:'Suivi chaîne — Pertes et arrêts — ' + per, fichier:nom('pertes'), entetes:['Date', 'Ouvrière', 'Poste', 'Minutes', 'Motif', 'Précision'], lignes:A.pertes,
    resume:resume.concat(Object.entries(A.motifs).map(([k, v]) => ['Motif ' + k, v + ' min']))};
  return null;
}
const scRrOrigine = window.rrDonnees;
window.rrDonnees = function(type, debut, fin, empId){ return (typeof type === 'string' && type.indexOf('chaine-') === 0) ? scRapport(type, debut, fin) : scRrOrigine(type, debut, fin, empId); };
const scTitre = (t, extra) => `<div class="flex-header" style="margin-bottom:10px;"><h2 style="margin:0;">${t}</h2>${extra || ''}</div>`;
const scBarreLigne = (nom, txt, pct) => `<div class="dd-lot"><div style="width:${Math.max(3, Math.min(100, pct))}%"></div><span style="color:var(--ink);text-shadow:none;">${esc(nom)}</span><b>${txt}</b></div>`;
const tonR = (r) => r === null ? 'nul' : (r >= 90 ? 'ok' : r >= 70 ? 'warn' : 'bad');
function scKpisPeriode(A){
  const T = A.tot, r = T.o ? Math.round(T.q / T.o * 100) : null;
  return `<div class="kp-grid" style="margin-bottom:12px;">${fcKpi('Jours saisis', A.jours.length, '', 'info', 'users')}${fcKpi('Pièces chaîne', T.q, 'dernier poste', 'info', 'box')}${fcKpi('Rendement', r === null ? '—' : r + ' %', 'pièces / objectif goulot', tonR(r), 'trend', r === null ? 0 : r)}${fcKpi('Pertes', T.p + ' min', '', T.p ? 'warn' : 'nul', 'clock')}</div>`;
}
// ---------- Écrans ----------
function renderChaineTableau(m){
  const today = getTodayISO(), t = scTotalJour(today), per = scPlage(isoMoins(13), today).reverse();
  if(!t){ m.innerHTML = `<div class="card">${scTitre('Suivi chaîne')}${buildEmptyState('Jour non travaillé', 'Aucun créneau programmé aujourd\'hui.')}</div>`; return; }
  const cl = t.calc.filter(x => x.c.obj > 0).sort((a, b) => (b.c.rend || 0) - (a.c.rend || 0));
  const maxv = Math.max(1, ...per.map(p => Math.max(p.q, p.o)));
  const graphe = per.length ? `<div style="display:flex;align-items:flex-end;gap:5px;height:130px;">${per.map(p => `<div style="flex:1;text-align:center;font-size:9px;color:var(--ink-soft);"><div style="height:100px;display:flex;align-items:flex-end;justify-content:center;gap:2px;"><i style="width:45%;background:#2563EB;height:${Math.round(p.q / maxv * 100)}%;border-radius:4px 4px 0 0;" title="Pièces ${p.q}"></i><i style="width:45%;background:var(--surface-3);height:${Math.round(p.o / maxv * 100)}%;border-radius:4px 4px 0 0;" title="Objectif ${p.o}"></i></div>${p.date.slice(8)}/${p.date.slice(5, 7)}</div>`).join('')}</div><div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">Bleu : pièces · Gris : objectif</div>` : buildEmptyState('Pas encore de saisie', 'Les jours saisis dans la Fiche apparaîtront ici.');
  m.innerHTML = `<div class="card">${scTitre('Suivi chaîne — aujourd\'hui', `<button class="btn btn-primary" onclick="fcDate=null;nav('fiche-chaine')">Saisir la fiche</button>`)}${fcKpisHTML(t)}</div>
    <div class="card" style="margin-top:12px;">${scTitre('Par ouvrière (aujourd\'hui)')}${cl.length ? cl.map(x => scBarreLigne(x.e.nom + ' · ' + x.poste, x.c.qty + '/' + x.c.obj + ' · ' + Math.round(x.c.rend || 0) + ' %', x.c.rend || 0)).join('') : buildEmptyState('Aucune donnée', 'Aucune ouvrière avec objectif aujourd\'hui.')}</div>
    <div class="card" style="margin-top:12px;">${scTitre('14 derniers jours')}${graphe}</div>`;
}
function renderChaineHistorique(m){
  const r = scRange(), l = scPlage(r.du, r.au);
  m.innerHTML = `<div class="card">${scTitre('Historique')}${scBarre('chaine-historique')}${l.length ? `<div class="table-wrap"><table class="fc-t"><thead><tr><th>Date</th><th>Pièces</th><th>Objectif</th><th>Rend.</th><th>Pertes</th><th>Présentes</th><th></th></tr></thead><tbody>${l.map(t => `<tr><td><b>${scJf(t.date)}</b></td><td class="fc-tot">${t.q}</td><td>${t.o}</td><td><span class="hour-rend ${fcCls(t.rend)}">${fcPct(t.rend)}</span></td><td>${t.p} min</td><td>${t.pres}/${t.n}</td><td><button class="btn btn-ghost fc-btn" onclick="fcDate='${t.date}';nav('fiche-chaine')">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>` : buildEmptyState('Aucune saisie', 'Aucune fiche enregistrée sur cette période.')}</div>`;
}
function renderChaineStats(m){
  const r = scRange(), A = scAgg(r.du, r.au), mt = Object.entries(A.motifs).sort((a, b) => b[1] - a[1]), mmax = mt.length ? mt[0][1] : 1;
  const ouv = A.ouv.sort((a, b) => (b.o ? b.q / b.o : 0) - (a.o ? a.q / a.o : 0)), rt = (q, o) => o ? q / o * 100 : null;
  m.innerHTML = `<div class="card">${scTitre('Statistiques')}${scBarre('chaine-stats')}${scKpisPeriode(A)}
    ${A.postes.length ? `<div class="table-wrap" style="margin-bottom:12px;"><table class="fc-t"><thead><tr><th style="text-align:left;">Poste</th><th>Ouvrières</th><th>Pièces</th><th>Objectif</th><th>Rend.</th><th>Pertes</th></tr></thead><tbody>${A.postes.map(b => `<tr><td class="fc-nom"><b>${esc(b.nom)}</b></td><td>${Object.keys(b.ids).length}</td><td class="fc-tot">${b.q}</td><td>${b.o}</td><td><span class="hour-rend ${fcCls(rt(b.q, b.o))}">${fcPct(rt(b.q, b.o))}</span></td><td>${b.p} min</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${ouv.length ? `<div class="table-wrap"><table class="fc-t"><thead><tr><th style="text-align:left;">Ouvrière</th><th>Poste</th><th>Jours</th><th>Pièces</th><th>Objectif</th><th>Rend.</th><th>Pertes</th></tr></thead><tbody>${ouv.map(a => `<tr><td class="fc-nom"><b>${esc(a.nom)}</b></td><td>${esc(a.poste)}</td><td>${a.j}</td><td class="fc-tot">${a.q}</td><td>${a.o}</td><td><span class="hour-rend ${fcCls(rt(a.q, a.o))}">${fcPct(rt(a.q, a.o))}</span></td><td>${a.p} min</td></tr>`).join('')}</tbody></table></div>` : buildEmptyState('Aucune donnée', 'Rien de saisi sur cette période.')}</div>
    <div class="card" style="margin-top:12px;">${scTitre('Pertes par motif')}${mt.length ? mt.map(([k, v]) => scBarreLigne(k, v + ' min', v / mmax * 100)).join('') : buildEmptyState('Aucune perte', 'Aucune perte saisie sur la période.')}</div>`;
}
const SC_TYPES = [['chaine-jours', 'Journalier'], ['chaine-ouv', 'Par ouvrière'], ['chaine-postes', 'Par poste'], ['chaine-pertes', 'Pertes / arrêts'], ['chaine', 'Détail par heure (1 jour)']];
window.scRTypeSet = (t) => { scRType = t; nav('chaine-rapports'); };
function renderChaineRapports(m){
  const r = scRange(); if(scRType === 'chaine' && r.du !== r.au) scRType = 'chaine-jours';
  const D = rrDonnees(scRType, r.du, r.au), args = `'${scRType}','${r.du}','${r.au}'`, MAX = 300;
  m.innerHTML = `<div class="card">${scTitre('Rapports', `<span><button class="btn btn-primary" onclick="rrExcel(${args})">Excel</button> <button class="btn btn-primary" onclick="rrPdf(${args})">PDF</button></span>`)}${scBarre('chaine-rapports')}
    <div class="rr-types" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">${SC_TYPES.filter(x => x[0] !== 'chaine' || r.du === r.au).map(([k, l]) => `<button class="btn ${scRType === k ? 'btn-primary' : 'btn-ghost'} fc-btn" onclick="scRTypeSet('${k}')">${l}</button>`).join('')}</div>
    ${D ? `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">${D.resume.map(x => esc(x[0]) + ' : <b>' + esc(String(x[1])) + '</b>').join(' · ')}</div>
    ${D.lignes.length ? `<div class="fc-scroll"><table class="fc-t"><thead><tr>${D.entetes.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${D.lignes.slice(0, MAX).map(l => `<tr>${l.map((v, i) => `<td${i === 0 ? ' style="text-align:left;"' : ''}>${v === null || v === undefined ? '' : esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${D.lignes.length > MAX ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:6px;">${MAX} premières lignes affichées sur ${D.lignes.length} : l'export Excel / PDF contient tout.</div>` : ''}` : buildEmptyState('Aucune donnée', 'Rien de saisi sur cette période.')}` : ''}</div>`;
}
let scModEdit = null;
const scNouvId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const SC_EXEMPLE = [['Ourlet manche (Goulot)', 60], ['Fermer manche', 120], ['Pointage V', 90], ['Collage encolure', 90], ['Ourlet bas', 84], ['Pose attache', 65], ['Ultrason triangle', 72], ['Fermer côté', 65], ['Montage manche', 65], ['Surpiquer côté (Goulot)', 60], ['Bride', 100], ['Pose agrafe', 120], ['Finition', 105], ['Contrôle', 108], ['Emballage', 90]];
function renderChaineParams(m){
  const ok = currentUser.role === 'admin', mods = fcModeles(), em = getEmployees(), actifs = activeEmployees();
  if(scModEdit && !mods.find(x => x.id === scModEdit)) scModEdit = null;
  const cur = mods.find(x => x.id === scModEdit);
  const liste = `<div class="card">${scTitre('Modèles et postes', ok ? `<button class="btn btn-primary" onclick="scModNouveau()">+ Nouveau modèle</button>` : '')}
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Un modèle = ses opérations (postes) dans l'ordre de la chaîne, avec la cadence de chaque poste (pièces/heure par ouvrière) et les ouvrières par défaut. Dans la Fiche, on choisit le modèle du jour : ses postes apparaissent avec leurs ouvrières, modifiables.</p>
    ${mods.length ? mods.map(x => `<div class="session-row" style="padding:10px 0;"><div><b>${esc(x.nom)}</b><div style="font-size:11px;color:var(--ink-soft);">${x.ops.length} postes · ${x.ops.reduce((t, o) => t + (o.emps || []).length, 0)} ouvrières affectées</div></div><div><button class="btn btn-ghost fc-btn" onclick="scModOuvrir('${x.id}')">${ok ? 'Modifier' : 'Voir'}</button>${ok ? ` <button class="icon-btn" title="Supprimer" onclick="scModSuppr('${x.id}')">✕</button>` : ''}</div></div>`).join('') : buildEmptyState('Aucun modèle', 'Créez un modèle puis ajoutez ses opérations (postes).')}
    ${ok && !mods.length ? `<button class="btn btn-ghost" style="margin-top:10px;" onclick="scModExemple()">Créer l'exemple « Tee-shirt Pharmacie » (15 opérations)</button>` : ''}</div>`;
  if(!cur){ m.innerHTML = liste; return; }
  m.innerHTML = `<div class="card">${scTitre('Modèle', `<button class="btn btn-ghost" onclick="scModOuvrir(null)">‹ Retour aux modèles</button>`)}<div id="fc-zone"></div>
    <div class="field"><label>Nom du modèle</label><input value="${esc(cur.nom)}" ${ok ? '' : 'disabled'} onchange="scModNom(this.value)"></div>
    ${cur.ops.map((o, i) => `<div class="pc-card"><div class="pc-top"><span class="pc-num">${i + 1}</span><input class="pc-in" value="${esc(o.nom)}" ${ok ? '' : 'disabled'} onchange="scOpSet(${i},'nom',this.value)" placeholder="Poste (opération)"><input class="pc-in pc-cad" type="number" min="0" step="0.5" inputmode="decimal" value="${o.cadence || ''}" ${ok ? '' : 'disabled'} onchange="scOpSet(${i},'cadence',this.value)" title="Cadence pièces/heure"><span style="font-size:10px;color:var(--ink-soft);">/h</span></div>
      <div class="pc-emps">${(o.emps || []).map(id => `<span class="kp-chip">${esc((em[id] || {}).nom || id)}</span>`).join('') || '<span style="font-size:12px;color:var(--ink-soft);">Aucune ouvrière</span>'}${ok ? `<button class="btn btn-ghost fc-btn" onclick="scPick(${i})">+ Ouvrières</button>` : ''}</div>
      ${ok ? `<div style="display:flex;gap:6px;margin-top:9px;justify-content:flex-end;"><button class="btn btn-ghost fc-btn" ${i ? '' : 'disabled'} onclick="scOpMove(${i},-1)">↑ Monter</button><button class="btn btn-ghost fc-btn" ${i < cur.ops.length - 1 ? '' : 'disabled'} onclick="scOpMove(${i},1)">↓ Descendre</button><button class="btn btn-ghost fc-btn" style="color:#DC3F45;" onclick="scOpSuppr(${i})">Supprimer</button></div>` : ''}</div>`).join('') || '<div style="padding:12px;color:var(--ink-soft);">Aucune opération.</div>'}
    ${ok ? `<button class="btn btn-primary" style="width:100%;" onclick="scOpAjout()">+ Ajouter une opération</button>` : ''}
    <p style="font-size:11.5px;color:var(--ink-soft);margin:10px 0 0;">Le dernier poste = sortie de la chaîne. Une ouvrière ne peut être que sur un poste à la fois.</p></div>`;
}
function scModMaj(f){ const l = fcModeles(), c = l.find(x => x.id === scModEdit); if(!c) return; f(c, l); fcSaveModeles(l); nav('chaine-params'); }
window.scModNouveau = function(){ const l = fcModeles(), id = scNouvId(); l.push({id, nom:'Nouveau modèle', ops:[]}); fcSaveModeles(l); scModEdit = id; nav('chaine-params'); };
window.scModExemple = function(){ const l = fcModeles(), id = scNouvId(); l.push({id, nom:'Tee-shirt Pharmacie', ops:SC_EXEMPLE.map(x => ({nom:x[0], cadence:x[1], emps:[]}))}); fcSaveModeles(l); scModEdit = id; nav('chaine-params'); };
window.scModOuvrir = function(id){ scModEdit = id; nav('chaine-params'); };
window.scModSuppr = function(id){ if(!confirm('Supprimer ce modèle ? Les fiches déjà saisies gardent leurs pièces.')) return; fcSaveModeles(fcModeles().filter(x => x.id !== id)); if(scModEdit === id) scModEdit = null; nav('chaine-params'); };
window.scModNom = (v) => scModMaj(c => { c.nom = String(v).trim() || 'Modèle'; });
window.scOpAjout = () => scModMaj(c => { c.ops.push({nom:'Poste ' + (Math.max(0, ...c.ops.map(o => parseInt(String(o.nom).replace(/\D/g, '')) || 0)) + 1), cadence:getObjHoraireOp(), emps:[]}); });
window.scOpSet = (i, k, v) => scModMaj(c => { if(k === 'cadence'){ const n = parseFloat(v); c.ops[i].cadence = n > 0 ? n : ''; } else c.ops[i].nom = String(v).trim() || ('Poste ' + (i + 1)); });
window.scOpSuppr = (i) => scModMaj(c => { c.ops.splice(i, 1); });
window.scOpMove = (i, d) => scModMaj(c => { const j = i + d; if(j < 0 || j >= c.ops.length) return; const t = c.ops[i]; c.ops[i] = c.ops[j]; c.ops[j] = t; });
window.scPick = function(i){
  const l = fcModeles(), c = l.find(x => x.id === scModEdit); if(!c) return; const em = activeEmployees(), ou = {}; c.ops.forEach((o, k) => (o.emps || []).forEach(id => { ou[id] = k; }));
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><h3 style="margin:0;">${esc(c.ops[i].nom)}</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">Touchez une ouvrière pour l'ajouter ou la retirer de ce poste.</div>
    <div style="max-height:58vh;overflow:auto;">${em.map(([id, e]) => { const k = ou[id], ici = k === i; return `<button type="button" class="pick-row${ici ? ' on' : ''}" onclick="scPickToggle(${i},'${id}')"><span class="pick-ck">${ici ? '✓' : ''}</span><span style="flex:1;text-align:left;">${esc(e.nom)}</span><span style="font-size:11px;color:var(--ink-soft);">${k !== undefined && !ici ? esc(c.ops[k].nom) : ''}</span></button>`; }).join('')}</div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="fcFermer()">Terminer</button></div></div>`;
};
window.scPickToggle = function(i, id){ const l = fcModeles(), c = l.find(x => x.id === scModEdit); if(!c) return; const deja = (c.ops[i].emps || []).indexOf(id) >= 0; c.ops.forEach((o, k) => { o.emps = (o.emps || []).filter(x => x !== id); if(k === i && !deja) o.emps.push(id); }); fcSaveModeles(l); scPick(i); };
// ---------- Navigation et module ----------
const scNavItems = window.navItems;
window.navItems = function(){
  if(activeModule === 'chaine') return [
    {tab:'chaine-tableau', label:'Tableau', icon:ICONS.dashboard, show:true},
    {tab:'fiche-chaine', label:'Fiche', icon:ICONS.team, show:canSaisie(currentUser.role) || currentUser.role === 'viewer', onclick:"fcDate=null;nav('fiche-chaine')"},
    {tab:'chaine-historique', label:'Historique', icon:ICONS.historique, show:true},
    {tab:'chaine-stats', label:'Stats', icon:ICONS.stats, show:true},
    {tab:'chaine-rapports', label:'Rapports', icon:ICONS.invoice || ICONS.stats, show:true},
    {tab:'chaine-params', label:'Params', icon:ICONS.params, show:currentUser.role === 'admin'}
  ].filter(i => i.show);
  return scNavItems().filter(i => i.tab !== 'fiche-chaine');
};
const scNavOrigine = window.nav;
const SC_ECRANS = {'chaine-tableau':renderChaineTableau, 'chaine-historique':renderChaineHistorique, 'chaine-stats':renderChaineStats, 'chaine-rapports':renderChaineRapports, 'chaine-params':renderChaineParams};
window.nav = function(tab){
  const r = scNavOrigine.apply(this, arguments), m = document.getElementById('main');
  try { if(m && SC_ECRANS[tab]) SC_ECRANS[tab](m); } catch(e) { console.error('Suivi chaîne', e); }
  return r;
};
const scChoose = window.chooseModule;
window.chooseModule = function(mod){ if(mod === 'chaine'){ activeModule = 'chaine'; renderShell(); return; } return scChoose.apply(this, arguments); };
const scMods = window.modulesDeSociete;
window.modulesDeSociete = function(soc){ const l = scMods(soc); return (soc === 'tek' && l.indexOf('rendement') >= 0 && l.indexOf('chaine') < 0) ? l.concat('chaine') : l; };
const scCss = document.createElement('style');
scCss.textContent = `.sc-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px;} .sc-bar input[type=date]{padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--ink);} .sc-bar label{font-size:12px;display:flex;gap:4px;align-items:center;} .sc-per{margin-left:auto;font-size:12px;font-weight:700;color:var(--ink-soft);}`;
document.head.appendChild(scCss);
})();
