// Thème clair / sombre (bouton dans la barre du haut) + barre compacte « ← Accueil » dans les modules (téléphone).
const THEME_CLE = 'gtm_theme';
function themeActuel(){ try { return localStorage.getItem(THEME_CLE) === 'dark' ? 'dark' : 'light'; } catch(e) { return 'light'; } }
function themeAppliquer(t){
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content', t === 'dark' ? '#0b1220' : '#0F3D66');
  document.querySelectorAll('iframe').forEach(f => { try { f.contentDocument.documentElement.setAttribute('data-theme', t); } catch(e) {} });
  document.querySelectorAll('.theme-btn').forEach(b => { b.innerHTML = t === 'dark' ? '☀️' : '🌙'; b.title = t === 'dark' ? 'Mode clair' : 'Mode sombre'; });
}
window.themeBasculer = function(){
  const t = themeActuel() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_CLE, t); } catch(e) {}
  themeAppliquer(t);
};
themeAppliquer(themeActuel());
document.addEventListener('load', (e) => { if(e.target && e.target.tagName === 'IFRAME') themeAppliquer(themeActuel()); }, true);

// --- Accueil du module courant ---
function navAccueilTab(){
  return activeModule === 'factures' ? 'fact-liste' : activeModule === 'machines' ? 'arr-dashboard' : activeModule === 'mgt' ? 'mgt-dashboard'
    : activeModule === 'rh' ? 'rh-dashboard' : activeModule === 'gadh' ? 'gadh-dashboard' : activeModule === 'commandes' ? 'commandes-home' : 'dashboard';
}
window.navRetour = function(){
  if(history.state && typeof history.state.nh === 'number' && history.state.nh > 0) history.back();
  else nav(navAccueilTab());
};
window.navAccueil = function(){
  // Revient à l'accueil et efface le chemin parcouru pour que « Retour » ne rejoue pas tous les écrans.
  if(typeof mgtFicheId !== 'undefined') mgtFicheId = null;
  nav(navAccueilTab());
};
function navMajBarre(){
  const app = document.getElementById('app'), body = document.querySelector('.app-body');
  if(!app || !body || !currentUser) return;
  const profond = activeTab !== navAccueilTab() && activeModule && activeModule !== 'admin';
  app.classList.toggle('en-profondeur', !!profond);
  let barre = document.getElementById('deepbar');
  if(!profond){ if(barre) barre.remove(); return; }
  if(!barre){
    barre = document.createElement('div'); barre.id = 'deepbar'; barre.className = 'deepbar no-print';
    barre.innerHTML = '<button onclick="navRetour()" aria-label="Retour">←</button><button onclick="navAccueil()" aria-label="Accueil">🏠</button><span class="deep-titre"></span><button class="theme-btn" onclick="themeBasculer()"></button>';
    body.insertBefore(barre, body.firstChild);
    themeAppliquer(themeActuel());
  }
  const it = (typeof navItems === 'function' ? navItems() : []).find(i => i.tab === activeTab);
  barre.querySelector('.deep-titre').textContent = it ? it.label : '';
}
const navThemeOrigine = window.nav;
window.nav = function(){ const r = navThemeOrigine.apply(this, arguments); try { navMajBarre(); } catch(e) {} return r; };
const navThemeShell = window.renderShell;
window.renderShell = function(){ const r = navThemeShell.apply(this, arguments); try { themeAppliquer(themeActuel()); } catch(e) {} return r; };

const themeCss = document.createElement('style');
themeCss.textContent = `
.theme-btn{background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:10px;width:34px;height:34px;font-size:16px;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;}
.deepbar{display:none;}
@media (max-width:1023px){
  .en-profondeur .topbar{display:none;}
  .en-profondeur .deepbar{display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:20;padding:7px 10px;background:linear-gradient(120deg,#001f3f 0%,#0a2f52 100%);color:#fff;}
  .deepbar button{background:rgba(255,255,255,.14);border:none;color:#fff;border-radius:10px;min-width:40px;height:38px;font-size:19px;cursor:pointer;}
  .deepbar .deep-titre{flex:1;min-width:0;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
}
/* ---------- thème sombre ---------- */
[data-theme="dark"]{
  color-scheme:dark;
  --bg:#0b1220; --surface:#131c2e; --surface-2:#1a2438; --surface-3:#223049;
  --ink:#e8edf5; --ink-soft:#a9b4c6; --ink-faint:#7886a0;
  --accent:#5aa2e6; --accent-2:#7bb6ee; --accent-bg:#1b3350;
  --crit:#f07575; --crit-bg:#3a1c22; --warn:#f0a14e; --warn-bg:#3b2a14;
  --good:#46c28b; --good-bg:#12332a; --excellent:#e0b23a; --excellent-bg:#38300f;
  --bad:#f07575; --bad-bg:#3a1c22; --border:#2a3850; --border-soft:#223049;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4); --shadow-md:0 4px 16px rgba(0,0,0,.45);
}
[data-theme="dark"] .login-wrap{background:linear-gradient(160deg,#0b1220 0%,#111a2c 100%);}
[data-theme="dark"] input,[data-theme="dark"] select,[data-theme="dark"] textarea{background:var(--surface-2);color:var(--ink);border-color:var(--border);}
[data-theme="dark"] input::placeholder,[data-theme="dark"] textarea::placeholder{color:var(--ink-faint);}
[data-theme="dark"] .field input:focus{background:var(--surface-3);}
[data-theme="dark"] .btn-primary{background:#2f6fb0;color:#fff;}
[data-theme="dark"] .t-black,[data-theme="dark"] .trend{color:var(--ink);}
[data-theme="dark"] table{color:var(--ink);}
[data-theme="dark"] .modal,[data-theme="dark"] .modal-box{background:var(--surface);color:var(--ink);}
`;
document.head.appendChild(themeCss);
