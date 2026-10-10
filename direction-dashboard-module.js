// Vue direction : tableau de bord de groupe (barre latérale, indicateurs, graphiques, jauges, alertes, activité).
const DD_COULEURS = {tek:'#0A5C6A', gadh:'#8B1F4B', mgt:'#F26B21'};
function ddIcone(n){
  const p = {
    prod:'<path d="M3 20h18M6 20V10m6 10V4m6 16v-7"/>', gadh:'<path d="M4 7h16M4 12h16M4 17h10"/>', users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4.6-3.6-5.5"/>',
    box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>', euro:'<path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h9M4 14h9"/>', target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', cog:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>', logout:'<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', switch:'<path d="M4 8h13l-3-3m3 3-3 3M20 16H7l3-3m-3 3 3 3"/>', audit:'<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7"/>'
  }[n] || '';
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
const ddEur = (n, d) => (Number(n) || 0).toLocaleString('fr-FR', {minimumFractionDigits:d == null ? 0 : d, maximumFractionDigits:d == null ? 0 : d}) + ' €';
function ddSecuriser(fn, defaut){ try { const v = fn(); return v === undefined || v === null || Number.isNaN(v) ? defaut : v; } catch(e) { console.error('Vue direction', e); return defaut; } }

function ddDonnees(){
  const today = getTodayISO(), D = {};
  D.prodTek = ddSecuriser(() => computeTotals(getDay(today)).totalGeneral, 0);
  D.rendTek = ddSecuriser(() => { const t = computeTotals(getDay(today)).totalGeneral, o = getObjForDay(getDay(today)); return o > 0 ? t / o * 100 : null; }, null);
  D.retGadh = ddSecuriser(() => gadhDayTotals(today).totalReel, 0);
  D.rendGadh = ddSecuriser(() => { const r = gadhDayTotals(today).rendement; return typeof r === 'number' ? r : null; }, null);
  D.presents = ddSecuriser(() => {
    const a = activeEmployees(), b = activeGadhEmployees();
    const n1 = a.filter(([id]) => { const r = resolveDayStatus(id, today); return r.source === 'pointage' && r.status === 'present'; }).length;
    const n2 = b.filter(([id]) => { const r = resolveGadhDayStatus(id, today); return r.source === 'pointage' && (r.statut === 'present' || r.statut === 'retard'); }).length;
    return {n:n1 + n2, total:a.length + b.length};
  }, {n:0, total:0});
  D.cmdTek = ddSecuriser(() => suiviCommandesEnCours(), 0);
  D.cmdGadh = ddSecuriser(() => suiviLotsChezGadh(), 0);
  D.fact = {};
  SOCIETE_KEYS.forEach(s => { D.fact[s] = ddSecuriser(() => factIndicateurs(s), {aEncaisser:0, retard:0}); });
  D.aEncaisser = SOCIETE_KEYS.reduce((t, s) => t + (D.fact[s].aEncaisser || 0), 0);
  D.retard = SOCIETE_KEYS.reduce((t, s) => t + (D.fact[s].retard || 0), 0);
  D.mgt = ddSecuriser(() => mgtIndicateurs(), {pipeline:0, offresEnCours:0});
  D.sav = ddSecuriser(() => savIndicateurs(), {ticketsActifs:0, machinesArret:0});
  D.serie = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date(); d.setDate(d.getDate() - i); const iso = toISODateLocal(d);
    D.serie.push({iso, j:d.getDate(), tek:ddSecuriser(() => computeTotals(getDay(iso)).totalGeneral, 0), gadh:ddSecuriser(() => gadhDayTotals(iso).totalReel, 0)});
  }
  D.alertes = ddSecuriser(() => notifCalculer(), []);
  D.activite = ddSecuriser(() => {
    const l = []; (getJSON('audit_jours', []) || []).slice(-3).forEach(j => Object.values(auditJour(j)).forEach(e => l.push(e)));
    return l.sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 8);
  }, []);
  return D;
}

// --- Graphiques en SVG ---
function ddBarres(serie){
  const W = 640, H = 220, base = 190, top = 14, gw = W / serie.length, max = Math.max(5, ...serie.map(s => Math.max(s.tek, s.gadh)));
  const y = (v) => base - (v / max) * (base - top);
  const barres = serie.map((s, i) => { const x = i * gw + gw * .14, w = gw * .34;
    return `<rect x="${x}" y="${y(s.tek)}" width="${w}" height="${Math.max(0, base - y(s.tek))}" rx="3" fill="${DD_COULEURS.tek}"/><rect x="${x + w + 2}" y="${y(s.gadh)}" width="${w}" height="${Math.max(0, base - y(s.gadh))}" rx="3" fill="${DD_COULEURS.gadh}"/>
      <text x="${i * gw + gw / 2}" y="${base + 16}" text-anchor="middle" font-size="10" fill="currentColor">${s.j}</text>`; }).join('');
  const grille = [0, .5, 1].map(f => `<line x1="0" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="var(--border)" stroke-dasharray="3 4"/><text x="0" y="${y(max * f) - 3}" font-size="10" fill="currentColor">${Math.round(max * f)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;color:var(--ink-soft);">${grille}${barres}</svg>`;
}
function ddJauge(valeur, couleur){
  const v = valeur === null ? 0 : Math.max(0, Math.min(100, valeur)), R = 70, cx = 90, cy = 90, a = Math.PI * (1 - v / 100);
  const pt = (ang) => [cx + R * Math.cos(ang), cy - R * Math.sin(ang)];
  const [x1, y1] = pt(Math.PI), [x2, y2] = pt(0), [x3, y3] = pt(a);
  return `<svg viewBox="0 0 180 104" style="width:100%;max-width:200px;display:block;margin:0 auto;"><path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}" fill="none" stroke="var(--surface-3)" stroke-width="16" stroke-linecap="round"/>
    ${v > 0 ? `<path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x3} ${y3}" fill="none" stroke="${couleur}" stroke-width="16" stroke-linecap="round"/>` : ''}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="26" font-weight="800" fill="var(--ink)">${valeur === null ? '—' : Math.round(valeur) + '%'}</text></svg>`;
}
function ddDonut(parts){
  const total = parts.reduce((s, p) => s + p.v, 0), R = 54, C = 2 * Math.PI * R;
  if(total <= 0) return `<div style="text-align:center;color:var(--ink-soft);font-size:13px;padding:40px 0;">Rien à encaisser</div>`;
  let off = 0;
  const arcs = parts.filter(p => p.v > 0).map(p => { const l = p.v / total * C, s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${p.c}" stroke-width="20" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += l; return s; }).join('');
  return `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center;"><svg viewBox="0 0 140 140" style="width:150px;height:150px;"><circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="20"/>${arcs}
    <text x="70" y="68" text-anchor="middle" font-size="13" font-weight="800" fill="var(--ink)">${Math.round(total).toLocaleString('fr-FR')}</text><text x="70" y="84" text-anchor="middle" font-size="10" fill="var(--ink-soft)">€ à encaisser</text></svg>
    <div style="font-size:12.5px;line-height:2;">${parts.map(p => `<div><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${p.c};margin-right:7px;"></i>${p.l} <b style="float:right;margin-left:14px;">${ddEur(p.v)}</b></div>`).join('')}</div></div>`;
}
const ddCouleurRend = (v) => v === null ? 'var(--ink-faint)' : v >= 85 ? 'var(--good)' : v >= 60 ? 'var(--warn)' : 'var(--crit)';

function ddKpi(titre, valeur, sous, icone, teinte, clic){
  return `<div class="dd-kpi" ${clic ? `onclick="${clic}" style="cursor:pointer;"` : ''}><div class="dd-kpi-t"><span>${titre}</span><i style="background:${teinte}1f;color:${teinte};">${ddIcone(icone)}</i></div><div class="dd-kpi-v">${valeur}</div><div class="dd-kpi-s">${sous}</div></div>`;
}
function ddCarteSociete(soc, ind){
  const S = SOCIETES[soc];
  return `<div class="dd-card dd-soc"><div class="dd-soc-band" style="background:${societeBande(soc, 90)};"></div>
    <div class="dd-soc-tete" style="background:${S.teinte};">${societeLogo(soc, 38, '', 110)}<div><b>${S.nom}</b><span>${S.sous}</span></div></div>
    <div class="dd-soc-grille">${ind.filter(i => !i.large).slice(0, 4).map(i => `<div><span>${i.label}</span><b>${esc(String(i.valeur))}</b></div>`).join('')}</div>
    <button class="btn btn-ghost" style="width:calc(100% - 28px);margin:0 14px 14px;" onclick="chooseSociete('${soc}')">Ouvrir ${S.nom}</button></div>`;
}
function ddHeure(t){ const d = new Date(t || 0); return d.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}) + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}); }

const ddRenderOrigine = window.renderDirection;
window.renderDirection = function(){
  directionOuverte = true;
  let D;
  try { D = ddDonnees(); } catch(e) { console.error('Vue direction', e); return ddRenderOrigine(); }
  const jour = new Date(getTodayISO() + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const nav = (ic, lib, act, actif) => `<button class="${actif ? 'on' : ''}" onclick="${act}">${ddIcone(ic)}<span>${lib}</span></button>`;
  const peutAudit = typeof peutVoirAudit === 'function' && peutVoirAudit(), peutAdmin = typeof canManageAccounts === 'function' && canManageAccounts();
  const menu = nav('crown', 'Vue direction', 'renderDirection()', true) + SOCIETE_KEYS.map(k => nav(k === 'mgt' ? 'target' : k === 'gadh' ? 'gadh' : 'prod', SOCIETES[k].nom, `chooseSociete('${k}')`)).join('')
    + (peutAudit ? nav('audit', 'Journal d\'audit', 'auditOuvrir()') : '') + (peutAdmin ? nav('cog', 'Administration', 'ouvrirAdmin()') : '');
  const kpis = [
    ddKpi('Production TEK-TREND', D.prodTek.toLocaleString('fr-FR'), 'Rendement ' + (D.rendTek === null ? '—' : Math.round(D.rendTek) + ' %'), 'prod', DD_COULEURS.tek),
    ddKpi('Pièces retournées GADH', D.retGadh.toLocaleString('fr-FR'), 'Rendement ' + (D.rendGadh === null ? '—' : Math.round(D.rendGadh) + ' %'), 'gadh', DD_COULEURS.gadh),
    ddKpi('Présents aujourd\'hui', D.presents.n + ' <small>/ ' + D.presents.total + '</small>', 'TEK-TREND + GADH', 'users', '#2563eb'),
    ddKpi('Commandes en cours', D.cmdTek, D.cmdGadh + ' chez GADH', 'box', '#7c3aed'),
    ddKpi('À encaisser', ddEur(D.aEncaisser), D.retard ? D.retard + ' facture(s) en retard' : 'Aucun retard', 'euro', '#16a34a'),
    ddKpi('Pipeline MGT', Math.round(D.mgt.pipeline || 0).toLocaleString('fr-FR') + ' €', (D.mgt.offresEnCours || 0) + ' offres · ' + (D.sav.ticketsActifs || 0) + ' tickets SAV', 'target', DD_COULEURS.mgt)
  ].join('');
  const alertes = D.alertes.slice(0, 6).map(a => `<div class="dd-li"><i style="background:${a.niveau === 'crit' ? 'var(--crit)' : a.niveau === 'warn' ? 'var(--warn)' : 'var(--accent-2)'};"></i><div><b>${esc(a.titre)}</b><span>${SOCIETES[a.soc] ? SOCIETES[a.soc].nom : ''}${a.detail ? ' · ' + esc(a.detail) : ''}</span></div></div>`).join('');
  const activite = D.activite.map(e => `<div class="dd-li"><i style="background:${DD_COULEURS[e.soc] || 'var(--ink-faint)'};"></i><div><b>${esc(e.u || '')}</b><span>${esc(e.txt || e.lib || '')} · ${ddHeure(e.t)}</span></div></div>`).join('');
  let offresMgt = ''; try { offresMgt = typeof accueilGraphique === 'function' ? accueilGraphique() : ''; } catch(e) {}
  document.getElementById('app').innerHTML = `<div class="dd">
    <aside class="dd-side"><div class="dd-logo"><b>GTM</b> GROUPE<span>TEK-TREND · GADH · MGT</span></div><nav>${menu}</nav><div class="dd-side-bas">
      <button onclick="switchSociete()">${ddIcone('switch')}<span>Sociétés</span></button><button onclick="themeBasculer()">${ddIcone('clock')}<span>Mode clair / sombre</span></button><button onclick="logout()">${ddIcone('logout')}<span>Déconnexion</span></button></div></aside>
    <main class="dd-main">
      <div class="dd-haut"><div><h2>Vue direction</h2><div class="dd-date">${jour}</div></div>
        <div class="dd-actions">${typeof notifCloche === 'function' ? notifCloche().replace('class="notif-btn"', 'class="notif-btn notif-btn-clair btn btn-ghost" style="padding:10px 12px;"') : ''}<button class="theme-btn dd-theme" onclick="themeBasculer()"></button>
          <button class="btn btn-ghost dd-mob" onclick="switchSociete()">Sociétés</button>${peutAudit ? '<button class="btn btn-ghost dd-mob" onclick="auditOuvrir()">Audit</button>' : ''}<button class="btn btn-ghost dd-mob" onclick="logout()">Déconnexion</button></div></div>
      <div class="dd-kpis">${kpis}</div>
      <div class="dd-g dd-g2">
        <div class="dd-card"><div class="dd-ct"><h3>Production des 14 derniers jours</h3><span><i style="background:${DD_COULEURS.tek}"></i>TEK-TREND <i style="background:${DD_COULEURS.gadh}"></i>GADH</span></div>${ddBarres(D.serie)}</div>
        <div class="dd-card"><div class="dd-ct"><h3>Rendement du jour</h3></div><div class="dd-jauges"><div>${ddJauge(D.rendTek, ddCouleurRend(D.rendTek))}<div class="dd-jl">TEK-TREND</div></div><div>${ddJauge(D.rendGadh, ddCouleurRend(D.rendGadh))}<div class="dd-jl">GADH TUNISIA</div></div></div></div>
      </div>
      <div class="dd-g dd-g3">
        <div class="dd-card"><div class="dd-ct"><h3>À encaisser par société</h3></div>${ddDonut(SOCIETE_KEYS.map(k => ({l:SOCIETES[k].nom, v:D.fact[k].aEncaisser || 0, c:DD_COULEURS[k]})))}</div>
        <div class="dd-card"><div class="dd-ct"><h3>MGT · offres et chiffre d'affaires</h3></div>${offresMgt || '<div style="color:var(--ink-soft);font-size:13px;padding:30px 0;text-align:center;">Pas de données</div>'}</div>
        <div class="dd-card"><div class="dd-ct"><h3>À surveiller</h3><button class="dd-lien" onclick="notifOuvrir()">Tout voir</button></div>${alertes || '<div style="color:var(--ink-soft);font-size:13px;padding:24px 0;text-align:center;">Rien à signaler</div>'}</div>
      </div>
      <div class="dd-g dd-g4">
        ${SOCIETE_KEYS.map(k => ddCarteSociete(k, directionIndicateurs(k))).join('')}
        <div class="dd-card"><div class="dd-ct"><h3>Activité récente</h3>${peutAudit ? '<button class="dd-lien" onclick="auditOuvrir()">Journal</button>' : ''}</div>${activite || '<div style="color:var(--ink-soft);font-size:13px;padding:24px 0;text-align:center;">Aucune activité enregistrée</div>'}</div>
      </div></main></div>`;
  themeAppliquer(themeActuel());
  if(typeof notifMajCloche === 'function') notifMajCloche();
};

const ddCss = document.createElement('style');
ddCss.textContent = `
.dd{display:flex;width:100%;flex:1 1 100%;min-height:100vh;background:var(--bg);}
.dd-side{display:none;width:236px;flex-shrink:0;background:#0F1F3D;color:#B8C4DA;padding:20px 12px;flex-direction:column;position:sticky;top:0;height:100vh;}
.dd-logo{background:#fff;color:#0F1F3D;border-radius:12px;padding:12px 14px;margin-bottom:18px;font-size:17px;letter-spacing:.5px;line-height:1.2;} .dd-logo b{font-size:22px;font-weight:900;} .dd-logo span{display:block;font-size:8.5px;letter-spacing:1.6px;color:#6b7686;margin-top:3px;}
.dd-side nav,.dd-side-bas{display:flex;flex-direction:column;gap:3px;} .dd-side-bas{margin-top:auto;border-top:1px solid rgba(255,255,255,.15);padding-top:10px;}
.dd-side button{display:flex;align-items:center;gap:11px;background:none;border:none;color:inherit;padding:11px 12px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;text-align:left;font-family:inherit;} .dd-side button:hover{background:rgba(255,255,255,.08);color:#fff;} .dd-side button.on{background:rgba(255,255,255,.14);color:#fff;}
.dd-main{flex:1;min-width:0;max-width:1500px;margin:0 auto;padding:18px 16px 40px;}
.dd-haut{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;} .dd-haut h2{margin:0;font-size:24px;} .dd-date{font-size:12.5px;color:var(--ink-soft);text-transform:capitalize;} .dd-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.dd-theme{background:var(--surface);color:var(--ink);border:1px solid var(--border);width:42px;height:42px;border-radius:10px;}
.dd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px;}
.dd-kpi,.dd-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-sm);} .dd-kpi{padding:14px 16px;}
.dd-kpi-t{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:11.5px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.03em;} .dd-kpi-t i{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.dd-kpi-v{font-size:26px;font-weight:800;margin:8px 0 4px;letter-spacing:-.02em;} .dd-kpi-v small{font-size:14px;color:var(--ink-soft);font-weight:600;} .dd-kpi-s{font-size:12px;color:var(--ink-soft);}
.dd-g{display:grid;gap:14px;margin-bottom:14px;grid-template-columns:1fr;} .dd-card{padding:16px;}
.dd-ct{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;} .dd-ct h3{margin:0;font-size:15px;} .dd-ct span{font-size:12px;color:var(--ink-soft);} .dd-ct span i{display:inline-block;width:9px;height:9px;border-radius:3px;margin:0 5px 0 10px;}
.dd-lien{background:none;border:none;color:var(--accent-2);font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;}
.dd-jauges{display:grid;grid-template-columns:1fr 1fr;gap:10px;} .dd-jl{text-align:center;font-size:12.5px;font-weight:700;color:var(--ink-soft);margin-top:4px;}
.dd-li{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--border-soft);} .dd-li:first-of-type{border-top:0;} .dd-li i{width:9px;height:9px;border-radius:50%;margin-top:5px;flex-shrink:0;} .dd-li b{display:block;font-size:13px;} .dd-li span{display:block;font-size:11.5px;color:var(--ink-soft);}
.dd-soc{padding:0;overflow:hidden;} .dd-soc-band{height:6px;} .dd-soc-tete{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border);} .dd-soc-tete b{display:block;font-size:15px;} .dd-soc-tete span{display:block;font-size:11.5px;color:var(--ink-soft);}
.dd-soc-grille{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px;} .dd-soc-grille div{border:1px solid var(--border);border-radius:11px;padding:8px 10px;} .dd-soc-grille span{display:block;font-size:10.5px;color:var(--ink-soft);font-weight:700;} .dd-soc-grille b{display:block;font-family:var(--mono);font-size:16px;margin-top:2px;}
@media (min-width:760px){.dd-g2{grid-template-columns:2fr 1fr;}.dd-g3{grid-template-columns:repeat(3,1fr);}.dd-g4{grid-template-columns:repeat(2,1fr);}}
@media (min-width:1024px){.dd-side{display:flex;}.dd-mob{display:none;}.dd-main{padding:22px 28px 40px;}.dd-g4{grid-template-columns:repeat(4,1fr);}}
`;
document.head.appendChild(ddCss);
