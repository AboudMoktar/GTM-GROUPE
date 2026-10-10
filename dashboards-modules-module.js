// Tableaux de bord TEK-TREND et GADH : même forme que la Vue direction (jauges, cases chiffrées, listes à barres).
function dmPlat(titre, droite, contenu, vide){
  return `<div class="dd-card dd-plat"><div class="dd-ct"><h3>${titre}</h3><span>${droite || ''}</span></div><div class="dd-scroll">${contenu || `<div class="dd-vide">${vide}</div>`}</div></div>`;
}
function dmBarre(libelle, valeur, pct, couleur, clic){
  return `<div class="dd-lot${couleur === 'teal' ? ' fini' : ''}${pct <= 0 ? ' vide' : ''}" ${clic ? `onclick="${clic}" style="cursor:pointer;"` : ''}><div style="width:${Math.max(0, Math.min(100, pct))}%"></div><span>${esc(String(libelle))}</span><b>${valeur}</b></div>`;
}

// ---------- TEK-TREND ----------
const dmTekOrigine = window.renderDashboard;
window.renderDashboard = function(container){
  try {
    const iso = getTodayISO(), data = getDay(iso), tot = computeTotals(data), obj = getObjForDay(data), ops = getOps();
    const heures = getHoursForDate(iso);
    if(!heures.length) return dmTekOrigine(container);
    const rend = obj > 0 ? tot.totalGeneral / obj * 100 : null;
    const att = getElapsedObjective(data, iso), rythme = att > 0 ? tot.totalGeneral / att * 100 : null;
    const actives = heures.reduce((m, h) => Math.max(m, getActiveOpCount(h, data)), 0);
    const presence = OP_KEYS.length ? actives / OP_KEYS.length * 100 : null;
    const vals = OP_KEYS.map(k => tot[k] || 0), max = Math.max(0, ...vals), totalOps = vals.reduce((a, b) => a + b, 0);
    const meilleurs = max > 0 ? ops.filter((n, i) => vals[i] === max) : [];
    const ecart = tot.totalGeneral - obj;
    const jour = new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    const classement = ops.map((n, i) => ({n, k:OP_KEYS[i], v:vals[i]})).sort((a, b) => b.v - a.v);
    const parHeure = heures.map(h => ({h, v:OP_KEYS.reduce((s, k) => s + (parseInt(data.hours[h] && data.hours[h][k]) || 0), 0)}));
    const maxH = Math.max(1, ...parHeure.map(x => x.v));
    const alertes = [];
    if(tot.totalGeneral > 0 && rythme !== null && rythme < 60) alertes.push(`<div class="dd-li"><i style="background:var(--crit)"></i><div><b>En retard sur le rythme attendu</b><span>${Math.round(rythme)} % : ${tot.totalGeneral} pièces produites sur ${Math.round(att)} attendues</span></div></div>`);
    if(tot.arrets > 0) alertes.push(`<div class="dd-li"><i style="background:var(--warn)"></i><div><b>${tot.arrets} perte(s) / arrêt(s)</b><span>Aujourd'hui</span></div></div>`);
    container.innerHTML = `
      <div class="dd-haut"><div><h2 style="font-size:20px;">Aujourd'hui</h2><div class="dd-date">${jour}</div></div></div>
      <div class="dd-jauges4">${ddJaugeP('Rendement du jour', rend)}${ddJaugeP('Rythme à cette heure', rythme)}${ddJaugeP('Opératrices actives', presence)}${ddJaugeP('Objectif atteint', obj > 0 ? Math.min(100, tot.totalGeneral / obj * 100) : null)}</div>
      <div class="dd-boites">
        ${ddBoite(tot.totalGeneral, 'Pièces produites', tot.totalGeneral ? 'ok' : 'nul')}
        ${ddBoite(obj, 'Objectif du jour', 'nul')}
        ${ddBoite((ecart >= 0 ? '+' : '') + ecart, ecart >= 0 ? 'Pièces d\'avance' : 'Pièces de retard', tot.totalGeneral ? (ecart >= 0 ? 'ok' : 'bad') : 'nul')}
        ${ddBoite(actives + '<small>/' + OP_KEYS.length + '</small>', 'Opératrices actives', actives ? 'ok' : 'nul')}
        ${ddBoite(tot.arrets, 'Pertes / arrêts', tot.arrets ? 'bad' : 'nul')}
        ${ddBoite(meilleurs.length ? '<span style="font-size:20px;">' + esc(meilleurs.join(' & ')) + '</span>' : '—', 'Meilleure performance', meilleurs.length ? 'ok' : 'nul')}
      </div>
      <div class="dd-g dd-g3">
        ${dmPlat('Production par opératrice', totalOps + ' PC', totalOps ? classement.map(r => dmBarre(r.n, r.v + ' PC', max ? r.v / max * 100 : 0, 'gris', `openOperatriceDetail('${r.k}')`)).join('') : '', 'Aucune production enregistrée')}
        ${dmPlat('Production par heure', '', tot.totalGeneral ? parHeure.map(x => dmBarre(x.h, x.v, x.v / maxH * 100, 'teal')).join('') : '', 'Aucune production enregistrée')}
        ${dmPlat('À surveiller', '', alertes.join(''), 'Rien à signaler')}
      </div>
      <div id="operatrice-modal-zone"></div>`;
    window.openOperatriceDetail = (opKey) => renderOperatriceDetail(opKey, data, ops, obj);
    if(typeof prodCarteResume === 'function') prodCarteResume(container, 'tek');
  } catch(e) { console.error('Tableau de bord TEK-TREND', e); return dmTekOrigine(container); }
};

// ---------- GADH ----------
const dmGadhOrigine = window.renderGadhDashboard;
window.renderGadhDashboard = function(container){
  try {
    if(!gadhAttDate) gadhAttDate = getTodayISO();
    const date = gadhAttDate, auj = date === getTodayISO();
    const emps = activeGadhEmployees(), t = gadhDayTotals(date), y = gadhDayTotals(gadhYesterdayISO(date));
    const res = emps.map(([id]) => resolveGadhDayStatus(id, date));
    const present = res.filter(r => r.source === 'pointage' && r.statut === 'present').length;
    const absent = res.filter(r => r.source === 'pointage' && r.statut === 'absent').length + res.filter(r => r.source === 'periode').length;
    const retard = res.filter(r => r.source === 'pointage' && r.statut === 'retard').length;
    const nonRens = res.filter(r => r.source === null).length;
    const rythme = typeof gadhComputeRhythm === 'function' ? gadhComputeRhythm(date) : null;
    const presence = emps.length ? (present + retard) / emps.length * 100 : null;
    const refs = Object.entries(t.parRef).map(([rk, q]) => [gadhRefName(rk), q]).sort((a, b) => b[1] - a[1]);
    const maxRef = Math.max(1, ...refs.map(r => r[1]));
    const cmds = cmdCommandesEnCoursPourGadh();
    const alertes = [];
    if(!isGadhWorkingDay(date)) alertes.push(['warn', 'Jour non travaillé', 'Selon le planning actuel']);
    if(Object.keys(getGadhCadences()).length === 0) alertes.push(['warn', 'Aucune cadence configurée', 'Voir Paramètres']);
    if(nonRens > 0) alertes.push(['warn', nonRens + ' salarié(s) non renseigné(s)', 'Pointage du jour']);
    const chartDays = [];
    for(let i = 5; i >= 0; i--){ const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() - i); const iso = toISODateLocal(d), tt = gadhDayTotals(iso); chartDays.push({label:iso.split('-')[2] + '/' + iso.split('-')[1], reel:tt.totalReel, obj:tt.totalObj}); }
    const rendTxt = t.rendement != null ? t.rendement : null;
    container.innerHTML = `
      <div class="dd-haut"><div><h2 style="font-size:20px;">${auj ? 'Aujourd\'hui' : 'Production du ' + date.split('-').reverse().join('/')}</h2>
        <input type="date" value="${date}" max="${getTodayISO()}" onchange="gadhAttDate=this.value; nav('gadh-dashboard')" style="margin-top:6px;padding:7px 10px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--ink);font-size:13px;"></div></div>
      <div class="dd-jauges4">${ddJaugeP('Rendement du jour', rendTxt)}${ddJaugeP('Rythme à cette heure', rythme ? rythme.pct : null)}${ddJaugeP('Présence du personnel', presence)}${ddJaugeP('Objectif atteint', t.totalObj > 0 ? Math.min(100, t.totalReel / t.totalObj * 100) : null)}</div>
      <div class="dd-boites">
        ${ddBoite(t.totalReel, 'Pièces retournées', t.totalReel ? 'ok' : 'nul')}
        ${ddBoite(t.totalObj, 'Objectif', 'nul')}
        ${ddBoite(present, 'Présents', present ? 'ok' : 'nul', "nav('gadh-rh')")}
        ${ddBoite(absent, 'Absents', absent ? 'bad' : 'nul', "nav('gadh-rh')")}
        ${ddBoite(retard, 'Retards', retard ? 'bad' : 'nul', "nav('gadh-rh')")}
        ${ddBoite(cmds.length, 'Commandes en cours', cmds.length ? 'ok' : 'nul')}
      </div>
      <div class="dd-g dd-g3">
        ${dmPlat('À surveiller', '', alertes.map(a => `<div class="dd-li"><i style="background:var(--warn)"></i><div><b>${esc(a[1])}</b><span>${esc(a[2])}</span></div></div>`).join(''), 'Aucune anomalie détectée')}
        ${dmPlat('Production par modèle', t.totalReel + ' PC', refs.map(([n, q]) => dmBarre(n, q, q / maxRef * 100, 'gris')).join(''), 'Aucune saisie ce jour-là')}
        ${dmPlat('Commandes en cours', cmds.length, cmds.map(c => dmBarre(c.numero, c.retourFait + ' / ' + c.total, c.pct, c.pct >= 100 ? 'teal' : 'gris')).join(''), 'Aucune commande en cours')}
      </div>
      <div class="dd-card" style="margin-bottom:14px;"><div class="dd-ct"><h3>Évolution de la production (6 derniers jours)</h3><span>${t.totalReel} vs ${y.totalReel} la veille</span></div>${gadhWeekChart(chartDays)}</div>
      <div class="dd-boites" style="grid-template-columns:repeat(2,1fr);">
        ${ddBoite('Production', 'Voir la production du jour', 'nul', "nav('gadh-production')")}${ddBoite('Historique', 'Productions passées', 'nul', "nav('gadh-historique')")}
        ${ddBoite('Stats', 'Statistiques', 'nul', "nav('gadh-stats')")}${ddBoite('Paramètres', 'Configuration', 'nul', "nav('gadh-parametres')")}
      </div>`;
    container.querySelectorAll('.dd-boites:last-child .dd-bx-v').forEach(e => { e.style.fontSize = '20px'; });
    if(typeof prodCarteResume === 'function') prodCarteResume(container, 'gadh');
  } catch(e) { console.error('Tableau de bord GADH', e); return dmGadhOrigine(container); }
};

const dmCss = document.createElement('style');
dmCss.textContent = '.dd-lot.vide span{color:var(--ink-soft);text-shadow:none;}';
document.head.appendChild(dmCss);
