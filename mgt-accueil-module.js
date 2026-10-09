// MGT — écran d'accueil en grille de tuiles (comme le CRM d'origine), Recherche et Listing.
// Logo officiel MGT (macpi Group Tunisia), fichier local.
const ACCUEIL_LOGO = './logo-mgt.png';
const ACCUEIL_TUILES = [
  ['mgt-projets',   'Projets',               'box'],
  ['mgt-offres',    'Offres en cours',       'invoice'],
  ['mgt-agenda',    'Calendrier commercial', 'calendarCheck'],
  ['fact-liste',    'Facturation & Lettrage','invoice'],
  ['mgt-clients',   'Clients',               'team'],
  ['mgt-recherche', 'Recherche',             null],
  ['mgt-sav',       'SAV',                   'wrench'],
  ['mgt-parc',      'Machines',              'params'],
  ['mgt-listing',   'Listing',               null],
  ['mgt-devis',     'Devis',                 'invoice'],
  ['mgt-ca',        'Chiffre d\'affaires',   'trend'],
  ['mgt-parametres','Paramètres',            'params']
];
const ACCUEIL_SVG = {
  mgt_recherche:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  mgt_listing:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>'
};
function accueilIcone(tab, nom){
  return nom ? ICONS[nom] : ACCUEIL_SVG[tab.replace(/-/g, '_')];
}
function accueilTuileAutorisee(tab){
  if(tab === 'mgt-parametres' && currentUser.role !== 'admin') return false;
  if(typeof profilOngletAutorise === 'function' && !profilOngletAutorise(tab)) return false;
  return true;
}
const accueilDashboardOrigine = window.renderMgtDashboard;
window.renderMgtDashboard = function(main){
  const clients = Object.values(crmClients()), auj = getTodayISO();
  const tuiles = ACCUEIL_TUILES.filter(t => accueilTuileAutorisee(t[0])).map(t => {
    const actif = t[0] === 'mgt-projets' ? '' : '';
    return `<button class="acc-tuile" onclick="nav('${t[0]}')"><span class="acc-ico">${accueilIcone(t[0], t[2])}</span><span class="acc-lib">${t[1]}</span></button>`;
  }).join('');
  main.innerHTML = `
    <div class="card" style="padding:18px 16px 8px;border-radius:22px;">
      <div style="display:inline-block;padding:10px 18px;border:1px solid var(--border);border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,.08);margin-bottom:14px;background:#fff;">
        <img src="${ACCUEIL_LOGO}" alt="MGT Tunisie" style="display:block;height:64px;max-width:260px;object-fit:contain;" onerror="this.outerHTML='<span style=&quot;font-size:30px;font-weight:900;letter-spacing:-1px;color:#E8400B;&quot;>m.g.t</span>'"></div>
      <div style="font-size:15px;font-weight:700;letter-spacing:2px;color:var(--ink-soft);">MGT SARL</div>
      <div style="font-size:24px;font-weight:800;margin:4px 0 6px;">CRM — Base clients</div>
      <div style="font-size:14px;color:var(--ink-soft);margin-bottom:14px;">Suivi commercial, offres, projets, SAV et facturation.</div>
      <form class="acc-rech" onsubmit="accueilLancerRecherche(event)" style="margin-bottom:12px;">
        <input id="acc-rech-q" class="mgt-in" type="search" enterkeyhint="search" placeholder="Rechercher un client, une machine, une facture…" autocomplete="off">
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
    <div style="text-align:center;font-size:20px;font-weight:800;margin:16px 0 4px;">Tous les modules</div>
    <div style="text-align:center;font-size:13px;color:var(--ink-soft);margin-bottom:12px;">Sélectionnez directement l'espace de travail souhaité.</div>
    <div class="acc-grille">${tuiles}</div>
    <div id="acc-tdb"></div>
    <div id="acc-detail"></div>`;
  try { document.getElementById('acc-tdb').innerHTML = accueilTableauDeBord(); } catch(e) { console.error('Tableau de bord', e); }
  accueilDashboardOrigine(document.getElementById('acc-detail'));
};

// --- Tableau de bord (cartes, flux d'activité, calendrier de la semaine, graphique, tickets) ---
const ACC_MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
function accueilIlYA(iso){
  const j = crmJoursDepuis(iso);
  if(j === null) return '';
  return j <= 0 ? 'aujourd\'hui' : j === 1 ? 'hier' : 'il y a ' + j + ' j';
}
function accueilGraphique(){
  const auj = new Date(), mois = [];
  for(let i = 6; i >= 0; i--){ const d = new Date(auj.getFullYear(), auj.getMonth() - i, 1); mois.push({k:d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l:ACC_MOIS[d.getMonth()], env:0, gag:0, ca:0}); }
  const par = {}; mois.forEach(m => par[m.k] = m);
  Object.values(crmClients()).forEach(c => {
    crmOffres(c).forEach(o => { const m = par[crmISO(crmOffreEnvoi(o)).slice(0, 7)]; if(m){ m.env++; if(crmOffreValidation(o).cle === 'validee') m.gag++; } });
    crmFactures(c).forEach(f => { const m = par[crmISO(f.date).slice(0, 7)]; if(m) m.ca += crmNombre(f.amount) / 1000; });
  });
  const W = 520, H = 190, base = 160, top = 14, gw = W / mois.length;
  const maxB = Math.max(1, ...mois.map(m => Math.max(m.env, m.gag))), maxC = Math.max(1, ...mois.map(m => m.ca));
  const yB = v => base - (v / maxB) * (base - top), yC = v => base - (v / maxC) * (base - top);
  const barres = mois.map((m, i) => { const x = i * gw + gw * 0.18, w = gw * 0.28;
    return `<rect x="${x}" y="${yB(m.env)}" width="${w}" height="${base - yB(m.env)}" rx="3" fill="#0F1F3D"/><rect x="${x + w + 3}" y="${yB(m.gag)}" width="${w}" height="${base - yB(m.gag)}" rx="3" fill="#22A06B"/><text x="${i * gw + gw / 2}" y="${base + 20}" text-anchor="middle" font-size="12" fill="currentColor">${m.l}</text>`; }).join('');
  const ligne = mois.map((m, i) => (i ? 'L' : 'M') + (i * gw + gw / 2).toFixed(1) + ' ' + yC(m.ca).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;color:var(--ink-soft);"><line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="var(--border)"/>${barres}<path d="${ligne}" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linejoin="round"/></svg>
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--ink-soft);margin-top:6px;"><span><i style="display:inline-block;width:10px;height:10px;background:#0F1F3D;border-radius:2px;margin-right:5px;"></i>Offres envoyées</span><span><i style="display:inline-block;width:10px;height:10px;background:#22A06B;border-radius:2px;margin-right:5px;"></i>Offres validées</span><span><i style="display:inline-block;width:14px;height:3px;background:#3B82F6;margin-right:5px;vertical-align:middle;"></i>CA facturé (k€)</span></div>`;
}
function accueilTableauDeBord(){
  const cl = Object.entries(crmClients()), auj = getTodayISO(), k = mgtIndicateurs(), s = savIndicateurs();
  const clientsActifs = cl.filter(([, c]) => !crmEstProspect(c)).length, prospects = cl.length - clientsActifs;
  const offres = cl.flatMap(([, c]) => crmOffres(c)).filter(crmOffreEnCours);
  const projets = crmProjets().filter(p => p.phase !== 'fini').length;
  const pill = (t, cls) => `<span class="pil-pill ${cls || ''}">${t}</span>`;
  const kpi = (titre, val, badge, tab) => `<div class="pil-kpi" onclick="nav('${tab}')"><div class="pil-kt">${titre}</div><div class="pil-kv"><span>${val}</span>${badge}</div></div>`;
  const kpis = `<div class="pil-kpis">
    ${kpi('Clients actifs', clientsActifs.toLocaleString('fr-FR'), pill(prospects + ' prospects'), 'mgt-clients')}
    ${kpi('Offres en cours', offres.length, pill((k.offresRelance || 0) + ' à relancer', k.offresRelance ? 'warn' : ''), 'mgt-offres')}
    ${kpi('Projets actifs', projets, '', 'mgt-projets')}
    ${kpi('Interventions SAV', s.ticketsActifs, s.urgents ? pill(s.urgents + ' urgentes', 'bad') : pill('Aucune urgence', 'good'), 'mgt-sav')}
    ${kpi('Alerte stock', s.piecesSousSeuil, pill('Pièces', s.piecesSousSeuil ? 'warn' : ''), 'mgt-pieces')}
  </div>`;
  // Flux d'activité : offres envoyées, tickets SAV, factures (les plus récents)
  const flux = [], nomT = {};
  cl.forEach(([id, c]) => {
    crmOffres(c).forEach(o => { const d = crmISO(crmOffreEnvoi(o)); if(d) flux.push({d, ico:'#22A06B', bg:'#E3F5EC', txt:`Client "${esc(c.nom || '—')}" — offre ${esc(o.machine || o.type || '')} envoyée`, id}); });
    crmFactures(c).forEach(f => { const d = crmISO(f.date); if(d) flux.push({d, ico:'#D97706', bg:'#FDF1DC', txt:`Client "${esc(c.nom || '—')}" — facture ${esc(f.number || '')}`, id}); });
  });
  const tickets = Object.values(mgtGet('tickets')), machines = mgtGet('machines');
  tickets.forEach(t => { const c = crmClients()[t.clientId]; if(t.date) flux.push({d:crmISO(t.date), ico:'#3B82F6', bg:'#E5EEFD', txt:`SAV "${esc(c ? c.nom : '—')}" — ${esc(t.objet || 'ticket')}`, id:t.clientId}); });
  flux.sort((a, b) => b.d.localeCompare(a.d));
  const fluxHTML = flux.filter(x => x.d <= auj).slice(0, 6).map(x => `<div class="pil-flux" onclick="${x.id ? "crmOuvrir('" + x.id + "')" : ''}"><span class="pil-dot" style="background:${x.bg};"><i style="background:${x.ico};"></i></span><span class="pil-ft">${x.txt}</span><span class="pil-fd">${accueilIlYA(x.d)}</span></div>`).join('') || crmVide('Aucune activité récente');
  // Calendrier de la semaine
  const d0 = new Date(); const lundi = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - ((d0.getDay() + 6) % 7));
  const jours = [...Array(7)].map((_, i) => { const d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i); return {iso:toISODateLocal(d), l:['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i], n:d.getDate()}; });
  const acts = crmActionsAPlanifier(), couleur = (a) => { const t = crmNorm(a.type); return t.includes('visite') ? '#3B82F6' : t.includes('offre') ? '#22A06B' : (t.includes('appel') || t.includes('rappel')) ? '#F26B2A' : '#6B7280'; };
  const cal = jours.map(j => { const l = acts.filter(a => crmISO(a.date) === j.iso);
    return `<div class="pil-jour ${j.iso === auj ? 'auj' : ''}"><div class="pil-jh">${j.l} <b>${j.n}</b></div>${l.slice(0, 4).map(a => `<div class="pil-ev" style="background:${couleur(a)};" onclick="crmOuvrir('${a.clientId}')">${esc((a.c && a.c.nom) || a.type || '')}</div>`).join('')}${l.length > 4 ? `<div class="pil-plus">+${l.length - 4}</div>` : ''}</div>`; }).join('');
  // Tickets SAV & machines
  const rang = t => (SAV_ACTIFS.indexOf(t.statut) >= 0 ? 0 : 1);
  const lt = tickets.slice().sort((a, b) => rang(a) - rang(b) || String(b.date).localeCompare(String(a.date))).slice(0, 6).map(t => {
    const c = crmClients()[t.clientId], m = machines[t.machineId], st = SAV_STATUTS[t.statut] || {label:t.statut, cls:''};
    const urgent = t.priorite === 'urgente' && SAV_ACTIFS.indexOf(t.statut) >= 0;
    return `<tr onclick="nav('mgt-sav')"><td>${esc(c ? c.nom : '—')}</td><td>${esc(m ? [m.marque, m.modele].filter(Boolean).join(' ') : '—')}</td><td>${urgent ? pill('Urgent', 'bad') : pill(st.label, st.cls === 'good' ? 'good' : st.cls === 'warn' ? 'warn' : st.cls === 'bad' ? 'bad' : '')}</td></tr>`; }).join('');
  const carte = (t, c, extra) => `<div class="pil-carte ${extra || ''}"><div class="pil-ct">${t}</div>${c}</div>`;
  return `<div class="pil-barre"><div class="pil-titre">Tableau de bord</div>
      <input class="mgt-in pil-rech" placeholder="Rechercher un client, une machine, un projet…" readonly onfocus="nav('mgt-recherche')"></div>
    ${kpis}
    <div class="pil-grille">
      ${carte('Flux d\'activité client', fluxHTML)}
      ${carte('Calendrier de la semaine', `<div class="pil-cal">${cal}</div>`)}
      ${carte('Suivi des activités <span class="pil-sub">Offres, validations et CA</span>', accueilGraphique())}
      ${carte('Tickets SAV & machines', lt ? `<table class="pil-tab"><thead><tr><th>Client</th><th>Machine</th><th>Statut</th></tr></thead><tbody>${lt}</tbody></table>` : crmVide('Aucun ticket SAV'))}
    </div>
    <div style="font-size:15px;font-weight:800;margin:22px 2px 8px;">Alertes et actions</div>`;
}

// --- Recherche globale -------------------------------------------------
let accueilRecDelai = null;
function renderMgtRecherche(main){
  const b = mgtSection(main, 'Recherche');
  b.innerHTML = `<div class="card" style="padding:10px 12px;"><input id="rec-q" class="mgt-in" placeholder="Client, contact, machine, n° de série, facture, offre…" oninput="accueilRechercher(this.value)" autocomplete="off"></div><div id="rec-res"></div>`;
  const q = document.getElementById('rec-q');
  if(q){
    if(window.accueilRecInit){ q.value = window.accueilRecInit; window.accueilRecInit = ''; accueilRechercherMaintenant(q.value); }
    q.focus();
  }
}
window.accueilLancerRecherche = (e) => {
  e.preventDefault();
  const el = document.getElementById('acc-rech-q');
  window.accueilRecInit = el ? el.value.trim() : '';
  nav('mgt-recherche');
};
window.accueilRechercher = (v) => { clearTimeout(accueilRecDelai); accueilRecDelai = setTimeout(() => accueilRechercherMaintenant(v), 200); };
function accueilRechercherMaintenant(v){
  const zone = document.getElementById('rec-res'); if(!zone) return;
  const q = crmNorm(v).trim();
  if(q.length < 2){ zone.innerHTML = crmVide('Saisissez au moins 2 lettres.'); return; }
  const idx = crmIndexRecherche(), cl = crmClients(), L = 8;
  const ligne = (id, titre, sous) => `<div class="session-row" style="cursor:pointer;align-items:flex-start;" onclick="crmOuvrir('${id}')"><div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:13.5px;">${esc(titre)}</div><div style="font-size:12px;color:var(--ink-soft);">${esc(sous)}</div></div></div>`;
  const rClients = [], rOffres = [], rFact = [];
  Object.entries(cl).forEach(([id, c]) => {
    if(idx.get(id).includes(q)) rClients.push(ligne(id, c.nom || '—', [c.ville, c.tel].filter(Boolean).join(' · ')));
    crmOffres(c).forEach(o => { if(crmNorm([o.type, o.machine, o.marque, o.offerId, o.note].join(' ')).includes(q)) rOffres.push(ligne(id, (c.nom || '—') + ' — ' + (o.machine || o.type || 'Offre'), [o.marque, crmOffreMontant(o) ? crmOffreMontant(o) + ' ' + (o.devise || 'EUR') : '', crmDateFr(crmOffreEnvoi(o))].filter(Boolean).join(' · '))); });
    crmFactures(c).forEach(f => { if(crmNorm([f.number, f.type, f.status].join(' ')).includes(q)) rFact.push(ligne(id, (c.nom || '—') + ' — ' + (f.number || 'Facture'), [crmDateFr(f.date), f.amount ? f.amount + ' €' : ''].filter(Boolean).join(' · '))); });
  });
  const rMach = Object.values(mgtGet('machines')).filter(m => crmNorm([m.marque, m.modele, m.serie].join(' ')).includes(q) && cl[m.clientId]).map(m => ligne(m.clientId, [m.marque, m.modele].filter(Boolean).join(' ') || 'Machine', (cl[m.clientId].nom || '') + (m.serie ? ' · série ' + m.serie : '')));
  const bloc = (t, l) => l.length ? crmCarte(t + ' (' + l.length + ')', l.slice(0, L).join('') + (l.length > L ? crmVide('… ' + (l.length - L) + ' de plus, affinez la recherche') : '')) : '';
  zone.innerHTML = (bloc('Clients', rClients) + bloc('Offres', rOffres) + bloc('Machines', rMach) + bloc('Factures', rFact)) || crmVide('Aucun résultat.');
}

// --- Listing : liste compacte de tous les clients ------------------------
let accueilListe = {q:'', n:100};
function renderMgtListing(main){
  const b = mgtSection(main, 'Listing', typeof exportMgtExcel === 'function' ? '<button class="btn btn-ghost" onclick="exportMgtExcel()">Excel</button>' : '');
  b.innerHTML = `<div class="card" style="padding:10px 12px;"><input class="mgt-in" placeholder="Filtrer la liste…" value="${esc(accueilListe.q)}" oninput="accueilFiltrerListe(this.value)"></div><div id="lst-zone"></div>`;
  accueilDessinerListe();
}
let accueilListDelai = null;
window.accueilFiltrerListe = (v) => { accueilListe.q = v; accueilListe.n = 100; clearTimeout(accueilListDelai); accueilListDelai = setTimeout(accueilDessinerListe, 200); };
window.accueilPlus = () => { accueilListe.n += 100; accueilDessinerListe(); };
function accueilDessinerListe(){
  const zone = document.getElementById('lst-zone'); if(!zone) return;
  const q = crmNorm(accueilListe.q), idx = crmIndexRecherche();
  const l = Object.entries(crmClients()).filter(([id]) => !q || idx.get(id).includes(q)).sort((a, b) => (a[1].nom || '').localeCompare(b[1].nom || ''));
  const vue = l.slice(0, accueilListe.n);
  zone.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);margin:0 2px 6px;">${l.length} client${l.length > 1 ? 's' : ''}</div>
    <div class="card" style="padding:4px 12px;">${vue.map(([id, c]) => `<div class="session-row" style="align-items:center;gap:8px;cursor:pointer;" onclick="crmOuvrir('${id}')"><div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:13.5px;">${esc(c.nom || '—')}</div><div style="font-size:12px;color:var(--ink-soft);">${esc([c.ville, c.activite].filter(Boolean).join(' · '))}</div></div>${c.tel ? `<a href="tel:${esc(String(c.tel).split(/[\/|]/)[0].replace(/\s/g, ''))}" onclick="event.stopPropagation()" style="font-size:12px;font-weight:700;color:var(--accent-2);white-space:nowrap;">${esc(String(c.tel).split(/[\/|]/)[0].trim())}</a>` : ''}</div>`).join('') || crmVide('Aucun client')}</div>
    ${l.length > vue.length ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="accueilPlus()">Voir plus (${l.length - vue.length})</button>` : ''}`;
}

// Routage des deux nouveaux écrans + navigation.
const accueilRenderMgtOrigine = window.renderMgt;
window.renderMgt = function(tab, main){
  if(tab === 'mgt-recherche') return renderMgtRecherche(main);
  if(tab === 'mgt-listing') return renderMgtListing(main);
  return accueilRenderMgtOrigine(tab, main);
};
Object.assign(MGT_PARENT, {'mgt-recherche':'mgt-dashboard', 'mgt-listing':'mgt-dashboard'});
const accueilNavItemsOrigine = window.mgtNavItems;
window.mgtNavItems = function(){ return accueilNavItemsOrigine().map(i => i.tab === 'mgt-dashboard' ? Object.assign({}, i, {label:'Accueil'}) : i); };

(function(){
  const st = document.createElement('style');
  st.textContent = '.acc-grille{display:grid;grid-template-columns:1fr 1fr;gap:12px;}'
    + '.acc-tuile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:120px;padding:16px 8px;border:1px solid var(--border);border-radius:22px;background:var(--surface);color:var(--ink);font:inherit;font-size:15px;font-weight:700;text-align:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.05);}'
    + '.acc-tuile:active{transform:scale(.97);border-color:#E8400B;}'
    + '.acc-ico{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:#FDEDE6;border:1px solid #F6C9B8;color:#E8400B;}'
    + '.acc-ico svg{width:28px;height:28px;}'
    + '@media (min-width:700px){.acc-grille{grid-template-columns:repeat(4,1fr);}}'
    + '.acc-rech{display:flex;gap:8px;}.acc-rech input{flex:1;min-width:0;}'
    + '@media (min-width:700px){.acc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}.acc-stats .card{margin:0 !important;}}'
    + '.pil-barre{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:22px 0 12px;}.pil-titre{font-size:18px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;flex:1;min-width:200px;}.pil-rech{flex:1;min-width:220px;max-width:420px;}'
    + '.pil-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px;}'
    + '.pil-kpi{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.05);}.pil-kt{font-size:14px;font-weight:600;color:var(--ink);}.pil-kv{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;flex-wrap:wrap;}.pil-kv>span:first-child{font-size:30px;font-weight:800;line-height:1.1;}'
    + '.pil-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#ECEEF1;color:#3A4556;white-space:nowrap;}.pil-pill.good{background:#DDF3E7;color:#17784C;}.pil-pill.warn{background:#FDEBC8;color:#9A5B00;}.pil-pill.bad{background:#FBD9D9;color:#B42318;}'
    + '.pil-grille{display:grid;grid-template-columns:1fr;gap:14px;}@media (min-width:900px){.pil-grille{grid-template-columns:1fr 1fr;}}'
    + '.pil-carte{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.05);min-width:0;}.pil-ct{font-size:16px;font-weight:800;margin-bottom:10px;}.pil-sub{display:block;font-size:12.5px;font-weight:500;color:var(--ink-soft);}'
    + '.pil-flux{display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;font-size:13.5px;}.pil-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}.pil-dot i{width:10px;height:10px;border-radius:50%;display:block;}.pil-ft{flex:1;min-width:0;}.pil-fd{font-size:12px;color:var(--ink-soft);white-space:nowrap;}'
    + '.pil-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;overflow-x:auto;}.pil-jour{min-height:150px;background:var(--surface-2);border-radius:8px;padding:5px 4px;min-width:0;}.pil-jour.auj{outline:2px solid #3B82F6;background:#F0F6FF;}.pil-jh{font-size:11.5px;text-align:center;margin-bottom:5px;color:var(--ink-soft);}.pil-jh b{display:block;color:var(--ink);font-size:14px;}.pil-ev{color:#fff;font-size:10.5px;font-weight:600;border-radius:5px;padding:3px 4px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;}.pil-plus{font-size:11px;text-align:center;color:var(--ink-soft);}'
    + '.pil-tab{width:100%;border-collapse:collapse;font-size:13.5px;}.pil-tab th{text-align:left;font-weight:700;padding:6px 4px;border-bottom:1px solid var(--border);}.pil-tab td{padding:9px 4px;border-bottom:1px solid var(--border);}.pil-tab tr{cursor:pointer;}'
    + '#acc-detail .kpi-mini-grid, #acc-detail .flex-header{display:none;}'
  document.head.appendChild(st);
})();
