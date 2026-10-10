// Rendement : « Fiche chaîne » — saisie, par ouvrière, des pièces produites à chaque heure, avec l'objectif par heure
// (réduit automatiquement selon l'état RH : absence, retard, sortie), les pertes / arrêts et l'état du jour.
const FC_MOTIFS = ['Panne machine', 'Attente matière', 'Changement de série', 'Retouche / qualité', 'Réglage', 'Autre'];
let fcDate = null;
function fcParams(){ const p = getJSON('fc_params', null) || {}; return {chain:p.chain || null, obj:p.obj || {}}; }
function fcSaveParams(p){ setJSON('fc_params', p); }
function fcJour(date){ const d = getJSON('fc_' + date, null) || {}; return {rows:d.rows || {}}; }
function fcSaveJour(date, d){ setJSON('fc_' + date, d); }
function fcOuvrieres(){
  const p = fcParams(), actifs = activeEmployees();
  if(p.chain && p.chain.length){ const m = {}; actifs.forEach(([id, e]) => { m[id] = e; }); return p.chain.filter(id => m[id]).map(id => [id, m[id]]); }
  return actifs;
}
function fcObjH(id){ const p = fcParams(); const v = parseFloat(p.obj[id]); return v > 0 ? v : getObjHoraireOp(); }
function fcEtat(id, date){
  const r = resolveDayStatus(id, date);
  if(r.source === 'periode'){ const t = ABSENCE_TYPES[r.type]; return {label:t.label, cls:t.cls}; }
  if(r.source === 'pointage'){
    if(r.status === 'absent') return {label:'Absente', cls:'bad'};
    const rh = computeRetardHours(r), au = computeAutorisationsHours(r);
    if(rh > 0 && au > 0) return {label:'Retard + sortie', cls:'warn'};
    if(rh > 0) return {label:'Retard ' + fmtH(rh), cls:'warn'};
    if((r.autorisations || []).length) return {label:'Sortie' + (au > 0 ? ' ' + fmtH(au) : ''), cls:'warn'};
    return {label:'Présente', cls:'good'};
  }
  return {label:'Non pointée', cls:''};
}
function fcCalcul(id, e, date, jour){
  const slots = getSlotsForDate(date), row = (jour.rows[id] || {}), h = row.h || {}, objh = fcObjH(id);
  let qty = 0, obj = 0;
  const det = slots.map(s => {
    const frac = (typeof rhSlotFraction === 'function') ? rhSlotFraction(e.nom, date, s.start, s.end) : 1;
    const o = Math.round(objh * frac * s.minutes / 60), q = parseInt(h[s.label]) || 0;
    qty += q; obj += o; return {label:s.label, q, o, frac, saisi:(h[s.label] !== undefined && String(h[s.label]) !== '')};
  });
  const pertes = (row.pertes || []).reduce((t, p) => t + (parseInt(p.min) || 0), 0);
  return {qty, obj, rend: obj > 0 ? qty / obj * 100 : null, pertes, det, etat:fcEtat(id, date), objh, listePertes:row.pertes || []};
}
const fcPct = (r) => r === null ? '—' : Math.round(r) + ' %';
const fcCls = (r) => r === null ? '' : rendClass(Math.round(r));

function renderFicheChaine(container){
  if(!fcDate) fcDate = getTodayISO();
  const date = fcDate, slots = getSlotsForDate(date), jour = fcJour(date), ouv = fcOuvrieres(), edit = canSaisie(currentUser.role);
  const jf = date.split('-').reverse().join('/'), dn = (d) => { const x = new Date(date + 'T00:00:00'); x.setDate(x.getDate() + d); return toISODateLocal(x); };
  if(!slots.length){
    container.innerHTML = `<div class="card"><div class="flex-header"><h2 style="margin:0;">Fiche chaîne</h2><input type="date" value="${date}" max="${getTodayISO()}" onchange="fcDate=this.value;nav('fiche-chaine')"></div>${buildEmptyState('Jour non travaillé', 'Aucun créneau programmé le ' + jf + ' (voir Paramètres → Horaires).')}</div>`; return;
  }
  const calc = ouv.map(([id, e]) => ({id, e, c:fcCalcul(id, e, date, jour)}));
  const T = calc.reduce((t, x) => ({q:t.q + x.c.qty, o:t.o + x.c.obj, p:t.p + x.c.pertes}), {q:0, o:0, p:0});
  const presentes = calc.filter(x => x.c.etat.cls === 'good' || x.c.etat.cls === 'warn').length;
  const lignes = calc.map(x => `<tr id="fc-r-${x.id}">
      <td class="fc-nom"><b>${esc(x.e.nom)}</b><span class="hour-rend ${x.c.etat.cls}" id="fc-e-${x.id}">${esc(x.c.etat.label)}</span></td>
      <td><input class="fc-objh" type="number" min="0" step="0.5" value="${x.c.objh}" ${edit ? '' : 'disabled'} onchange="fcObjHSet('${x.id}',this.value)" title="Objectif par heure"></td>
      ${x.c.det.map(d => `<td><input class="fc-q${d.frac < 1 ? ' fc-red' : ''}" type="number" min="0" inputmode="numeric" value="${d.saisi ? (jour.rows[x.id].h[d.label]) : ''}" placeholder="${d.o}" ${edit && d.frac > 0 ? '' : 'disabled'} onchange="fcSaisir('${x.id}','${d.label}',this.value)" title="Objectif ${d.o}"></td>`).join('')}
      <td class="fc-tot" id="fc-q-${x.id}">${x.c.qty}</td><td class="fc-tot" id="fc-o-${x.id}">${x.c.obj}</td>
      <td class="fc-tot" id="fc-p-${x.id}"><span class="hour-rend ${fcCls(x.c.rend)}">${fcPct(x.c.rend)}</span></td>
      <td id="fc-l-${x.id}"><button class="btn btn-ghost fc-btn" onclick="fcPertes('${x.id}')">${x.c.pertes ? x.c.pertes + ' min' : '+ Perte'}</button></td></tr>`).join('');
  container.innerHTML = `
    <div class="card" style="padding:12px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-ghost" style="padding:9px 11px;" onclick="fcDate='${dn(-1)}';nav('fiche-chaine')">‹</button>
        <input type="date" value="${date}" max="${getTodayISO()}" onchange="fcDate=this.value;nav('fiche-chaine')" style="padding:9px 11px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-2);">
        <button class="btn btn-ghost" style="padding:9px 11px;" onclick="fcDate='${dn(1)}';nav('fiche-chaine')" ${date >= getTodayISO() ? 'disabled' : ''}>›</button>
        <span style="flex:1;"></span>
        ${edit ? `<button class="btn btn-ghost" onclick="fcChoisir()">Choisir les ouvrières</button>` : ''}
        <button class="btn btn-primary" onclick="rrExcel('chaine','${date}','${date}')">Excel</button><button class="btn btn-primary" onclick="rrPdf('chaine','${date}','${date}')">PDF</button>
      </div>
      <div class="dd-boites" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin:12px 0 0;">
        <div class="dd-bx dd-bx-${T.q ? 'ok' : 'nul'}"><div class="dd-bx-v" id="fc-T-q">${T.q}</div><div class="dd-bx-l">Pièces produites</div></div>
        <div class="dd-bx dd-bx-nul"><div class="dd-bx-v" id="fc-T-o">${T.o}</div><div class="dd-bx-l">Objectif (ajusté RH)</div></div>
        <div class="dd-bx dd-bx-nul"><div class="dd-bx-v" id="fc-T-r">${T.o ? Math.round(T.q / T.o * 100) + '%' : '—'}</div><div class="dd-bx-l">Rendement</div></div>
        <div class="dd-bx dd-bx-${T.p ? 'bad' : 'nul'}"><div class="dd-bx-v" id="fc-T-p">${T.p}</div><div class="dd-bx-l">Pertes (min)</div></div>
        <div class="dd-bx dd-bx-nul"><div class="dd-bx-v">${presentes}<small>/${ouv.length}</small></div><div class="dd-bx-l">Présentes</div></div>
      </div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:8px;">Saisissez les pièces de chaque heure. Le chiffre gris est l'objectif de l'heure : il baisse tout seul si l'ouvrière est absente, en retard ou en sortie (état repris du pointage RH).</div>
    </div>
    <div id="fc-zone"></div>
    <div class="card" style="padding:6px;"><div class="fc-scroll"><table class="fc-t"><thead><tr><th style="text-align:left;">Ouvrière</th><th>Obj/h</th>${slots.map(s => `<th>${s.label.replace(' - ', '<br>')}</th>`).join('')}<th>Total</th><th>Objectif</th><th>Rend.</th><th>Pertes</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="${slots.length + 6}" style="padding:20px;text-align:center;color:var(--ink-soft);">Aucune ouvrière : ajoutez des employés dans le module RH.</td></tr>`}</tbody></table></div></div>`;
}
function fcMajLigne(id){
  const date = fcDate, jour = fcJour(date), e = getEmployees()[id]; if(!e) return;
  const c = fcCalcul(id, e, date, jour);
  const set = (k, v) => { const el = document.getElementById(k + id); if(el) el.innerHTML = v; };
  set('fc-q-', c.qty); set('fc-o-', c.obj); set('fc-p-', `<span class="hour-rend ${fcCls(c.rend)}">${fcPct(c.rend)}</span>`);
  const T = fcOuvrieres().reduce((t, [i, ee]) => { const x = fcCalcul(i, ee, date, jour); return {q:t.q + x.qty, o:t.o + x.obj, p:t.p + x.pertes}; }, {q:0, o:0, p:0});
  const g = (k, v) => { const el = document.getElementById(k); if(el) el.textContent = v; };
  g('fc-T-q', T.q); g('fc-T-o', T.o); g('fc-T-r', T.o ? Math.round(T.q / T.o * 100) + '%' : '—'); g('fc-T-p', T.p);
}
window.fcSaisir = function(id, slot, val){
  const v = String(val).trim();
  if(v !== '' && (!/^\d+$/.test(v))){ showToast('Entrez un nombre entier positif'); renderFicheChaine(document.getElementById('main')); return; }
  const jour = fcJour(fcDate), row = jour.rows[id] || (jour.rows[id] = {}); row.h = row.h || {};
  if(v === '') delete row.h[slot]; else row.h[slot] = parseInt(v);
  fcSaveJour(fcDate, jour); fcMajLigne(id);
};
window.fcObjHSet = function(id, val){ const p = fcParams(); const n = parseFloat(val); if(n > 0) p.obj[id] = n; else delete p.obj[id]; fcSaveParams(p); nav('fiche-chaine'); };
window.fcPertes = function(id){
  const e = getEmployees()[id], jour = fcJour(fcDate), row = jour.rows[id] || {}, l = row.pertes || [], edit = canSaisie(currentUser.role);
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><h3 style="margin:0;">Pertes / arrêts — ${esc(e.nom)}</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">${fcDate.split('-').reverse().join('/')}</div>
    ${l.length ? l.map((p, i) => `<div class="session-row" style="padding:7px 0;"><div><b>${parseInt(p.min) || 0} min</b> · ${esc(p.motif || '')}${p.note ? '<div style="font-size:11px;color:var(--ink-soft);">' + esc(p.note) + '</div>' : ''}</div>${edit ? `<button class="icon-btn" onclick="fcPerteSuppr('${id}',${i})">✕</button>` : ''}</div>`).join('') : '<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;">Aucune perte enregistrée.</div>'}
    ${edit ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><div class="field" style="margin:0;"><label style="font-size:10px;">Minutes perdues</label><input id="fc-pm" type="number" min="1" style="width:100px;"></div>
      <div class="field" style="margin:0;flex:1;min-width:150px;"><label style="font-size:10px;">Motif</label><select id="fc-pt">${FC_MOTIFS.map(m => `<option>${m}</option>`).join('')}</select></div></div>
      <div class="field" style="margin-top:8px;"><label style="font-size:10px;">Précision (facultatif)</label><input id="fc-pn"></div>
      <button class="btn btn-primary" style="width:100%;" onclick="fcPerteAjout('${id}')">Ajouter</button>` : ''}
    </div></div>`;
};
window.fcFermer = () => { const z = document.getElementById('fc-zone'); if(z) z.innerHTML = ''; nav('fiche-chaine'); };
window.fcPerteAjout = function(id){
  const m = parseInt(document.getElementById('fc-pm').value);
  if(!(m > 0)){ showToast('Indiquez les minutes perdues'); return; }
  const jour = fcJour(fcDate), row = jour.rows[id] || (jour.rows[id] = {}); row.pertes = row.pertes || [];
  row.pertes.push({min:m, motif:document.getElementById('fc-pt').value, note:document.getElementById('fc-pn').value.trim()});
  fcSaveJour(fcDate, jour); fcPertes(id);
};
window.fcPerteSuppr = function(id, i){ const jour = fcJour(fcDate), row = jour.rows[id]; if(!row || !row.pertes) return; row.pertes.splice(i, 1); fcSaveJour(fcDate, jour); fcPertes(id); };
window.fcChoisir = function(){
  const actifs = activeEmployees(), p = fcParams(), sel = p.chain ? new Set(p.chain) : new Set(actifs.map(([id]) => id));
  document.getElementById('fc-zone').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this) fcFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><h3 style="margin:0;">Ouvrières de la chaîne</h3><button class="icon-btn" onclick="fcFermer()">✕</button></div>
    <div style="max-height:50vh;overflow:auto;">${actifs.map(([id, e]) => `<label style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-soft);"><input type="checkbox" class="fc-ck" value="${id}" ${sel.has(id) ? 'checked' : ''}> ${esc(e.nom)}<span style="color:var(--ink-soft);font-size:11px;">${esc(e.poste || '')}</span></label>`).join('')}</div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="fcChoisirOk()">Enregistrer</button></div></div>`;
};
window.fcChoisirOk = function(){ const p = fcParams(); p.chain = [...document.querySelectorAll('.fc-ck:checked')].map(c => c.value); fcSaveParams(p); fcFermer(); };

// Données exportables (Excel / PDF) : même moteur que les rapports RH
function fcDonnees(date){
  const slots = getSlotsForDate(date), jour = fcJour(date), ouv = fcOuvrieres();
  const lignes = ouv.map(([id, e]) => { const c = fcCalcul(id, e, date, jour);
    return [e.nom || '', e.poste || '', c.etat.label].concat(c.det.map(d => d.saisi ? d.q : '')).concat([c.qty, c.obj, c.rend === null ? '' : Math.round(c.rend), c.pertes, c.listePertes.map(p => p.min + ' min ' + (p.motif || '')).join(' ; ')]); });
  const T = ouv.reduce((t, [id, e]) => { const c = fcCalcul(id, e, date, jour); return {q:t.q + c.qty, o:t.o + c.obj, p:t.p + c.pertes}; }, {q:0, o:0, p:0});
  return {titre:'Fiche chaîne — ' + date.split('-').reverse().join('/'), fichier:'fiche_chaine_' + date, ids:ouv.map(([id]) => id),
    entetes:['Ouvrière', 'Poste', 'État du jour'].concat(slots.map(s => s.label)).concat(['Total pièces', 'Objectif ajusté', 'Rendement %', 'Pertes (min)', 'Détail des pertes']), lignes,
    resume:[['Pièces', T.q], ['Objectif', T.o], ['Rendement', T.o ? Math.round(T.q / T.o * 100) + ' %' : '—'], ['Pertes', T.p + ' min']]};
}
const fcRrOrigine = window.rrDonnees;
window.rrDonnees = function(type, debut, fin, empId){ return type === 'chaine' ? fcDonnees(debut) : fcRrOrigine(type, debut, fin, empId); };

const fcNavOrigine = window.nav;
window.nav = function(tab){
  const r = fcNavOrigine.apply(this, arguments);
  if(tab === 'fiche-chaine'){ try { const m = document.getElementById('main'); if(m) renderFicheChaine(m); } catch(e) { console.error('Fiche chaîne', e); } }
  return r;
};
const fcCss = document.createElement('style');
fcCss.textContent = `
.fc-scroll{overflow:auto;max-height:72vh;} .fc-t{border-collapse:collapse;font-size:12px;width:100%;} .fc-t th{position:sticky;top:0;background:#0F3D66;color:#fff;padding:6px 5px;font-size:10.5px;z-index:2;white-space:nowrap;}
.fc-t td{border:1px solid var(--border);padding:3px;text-align:center;} .fc-nom{text-align:left!important;position:sticky;left:0;background:var(--surface);z-index:1;min-width:150px;} .fc-nom b{display:block;font-size:12.5px;} .fc-nom .hour-rend{font-size:10px;}
.fc-q,.fc-objh{width:58px;padding:6px 4px;text-align:center;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--ink);font-size:14px;font-weight:700;} .fc-objh{width:52px;font-weight:600;} .fc-q::placeholder{color:#9aa4b2;font-weight:400;}
.fc-q.fc-red{background:rgba(245,158,11,.12);} .fc-q:disabled{background:var(--surface-3);opacity:.6;} .fc-tot{font-weight:800;font-size:13px;} .fc-btn{padding:5px 9px;font-size:11px;white-space:nowrap;}
`;
document.head.appendChild(fcCss);
