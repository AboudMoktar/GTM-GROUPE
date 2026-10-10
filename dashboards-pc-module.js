// Tableaux de bord des modules (TEK-TREND, GADH, MGT, RH) : sur grand écran, cartes d'indicateurs avec icône
// à gauche et cartes en deux colonnes, dans le même esprit que la Vue direction.
const DPC_TABS = ['rh-dashboard'];
(function(){
  const st = document.createElement('style');
  st.textContent = `
  @media (min-width:1024px){
    .dpc-cols{column-count:2;column-gap:16px;}
    .dpc-cols > *{break-inside:avoid;}
    .dpc-cols > .hero-card,.dpc-cols > .page-date-row,.dpc-cols > .kpi-mini-grid,.dpc-cols > .flex-header,.dpc-cols > .alert,.dpc-cols > .card:first-child{column-span:all;}
    .dpc-cols .kpi-mini-grid{gap:14px;margin-bottom:16px;}
    .dpc-cols .kpi-mini{display:grid;grid-template-columns:auto 1fr;grid-template-areas:'i v' 'i l' 'i s';column-gap:14px;row-gap:2px;text-align:left;align-items:center;justify-items:start;padding:16px 18px;min-height:92px;border-radius:14px;background:var(--surface)!important;border:1px solid var(--border)!important;box-shadow:0 1px 3px rgba(15,23,42,.06);}
    .dpc-cols .kpi-mini-icon{grid-area:i;width:46px;height:46px;border-radius:12px!important;margin:0;font-size:20px;}
    .dpc-cols .kpi-mini-icon svg{width:22px;height:22px;}
    .dpc-cols .kpi-mini-val{grid-area:v;font-size:26px!important;align-self:end;}
    .dpc-cols .kpi-mini-lbl{grid-area:l;font-size:12px;text-transform:uppercase;letter-spacing:.04em;align-self:start;}
    .dpc-cols .kpi-mini-sub,.dpc-cols .kpi-mini > div:nth-child(n+4){grid-area:s;font-size:11px;}
    .dpc-cols .card{border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(15,23,42,.06);}
  }`;
  document.head.appendChild(st);
})();
const dpcNavOrigine = window.nav;
window.nav = function(tab){
  const r = dpcNavOrigine.apply(this, arguments);
  try {
    document.querySelectorAll('.dpc-cols').forEach(e => e.classList.remove('dpc-cols'));
    if(DPC_TABS.indexOf(tab) >= 0){
      const main = document.getElementById('main'); if(!main) return r;
      const c = main.querySelector('#gadh-body, #rh-body, #mgt-body') || main;
      c.classList.add('dpc-cols');
    }
  } catch(e) { console.error('Tableaux de bord PC', e); }
  return r;
};
