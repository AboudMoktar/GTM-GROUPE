// MGT — écran d'accueil en grille de tuiles (comme le CRM d'origine), Recherche et Listing.
// Logo officiel, chargé depuis le site de MGT (remplacé par le texte « m.g.t » s'il est indisponible).
const ACCUEIL_LOGO = 'https://www.macpi-tunisia.com/assets/img/logo.png';
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
  const nbA = clients.filter(c => crmLettre(c) === 'A').length;
  const nbAuj = crmActionsAPlanifier().filter(a => crmISO(a.date) === auj).length;
  const stat = (v, l) => `<div class="card" style="margin:0 0 10px;padding:14px 18px;border-radius:18px;"><div style="font-size:30px;font-weight:700;line-height:1.1;">${v}</div><div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;margin-top:6px;">${l}</div></div>`;
  const tuiles = ACCUEIL_TUILES.filter(t => accueilTuileAutorisee(t[0])).map(t => {
    const actif = t[0] === 'mgt-projets' ? '' : '';
    return `<button class="acc-tuile" onclick="nav('${t[0]}')"><span class="acc-ico">${accueilIcone(t[0], t[2])}</span><span class="acc-lib">${t[1]}</span></button>`;
  }).join('');
  main.innerHTML = `
    <div class="card" style="padding:18px 16px 8px;border-radius:22px;">
      <div style="display:inline-block;padding:10px 18px;border:1px solid var(--border);border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,.08);margin-bottom:14px;background:#fff;">
        <img src="${ACCUEIL_LOGO}" alt="MGT Tunisie" style="display:block;height:48px;max-width:200px;object-fit:contain;" onerror="this.outerHTML='<span style=&quot;font-size:30px;font-weight:900;letter-spacing:-1px;color:#E8400B;&quot;>m.g.t</span>'"></div>
      <div style="font-size:15px;font-weight:700;letter-spacing:2px;color:var(--ink-soft);">MGT SARL</div>
      <div style="font-size:24px;font-weight:800;margin:4px 0 6px;">CRM — Base clients</div>
      <div style="font-size:14px;color:var(--ink-soft);margin-bottom:14px;">Suivi commercial, offres, projets, SAV et facturation.</div>
      ${stat(clients.length.toLocaleString('fr-FR'), 'Total clients')}
      ${stat(nbAuj, 'Actions aujourd\'hui')}
      ${stat(nbA, 'Priorité A')}
    </div>
    <div style="text-align:center;font-size:20px;font-weight:800;margin:16px 0 4px;">Tous les modules</div>
    <div style="text-align:center;font-size:13px;color:var(--ink-soft);margin-bottom:12px;">Sélectionnez directement l'espace de travail souhaité.</div>
    <div class="acc-grille">${tuiles}</div>
    <div style="font-size:15px;font-weight:800;margin:20px 2px 8px;">Pilotage</div>
    <div id="acc-pilotage"></div>`;
  accueilDashboardOrigine(document.getElementById('acc-pilotage'));
};

// --- Recherche globale -------------------------------------------------
let accueilRecDelai = null;
function renderMgtRecherche(main){
  const b = mgtSection(main, 'Recherche');
  b.innerHTML = `<div class="card" style="padding:10px 12px;"><input id="rec-q" class="mgt-in" placeholder="Client, contact, machine, n° de série, facture, offre…" oninput="accueilRechercher(this.value)" autocomplete="off"></div><div id="rec-res"></div>`;
  const q = document.getElementById('rec-q'); if(q) q.focus();
}
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
    + '@media (min-width:700px){.acc-grille{grid-template-columns:repeat(4,1fr);}}';
  document.head.appendChild(st);
})();
