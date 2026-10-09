// Bouton « Retour » du téléphone / du navigateur : revient à l'écran précédent de l'application
// (fenêtre ouverte → fiche → liste → accueil du module → choix du module → choix de société)
// au lieu de fermer l'application. Sur l'écran de départ, un message demande d'appuyer une seconde fois pour quitter.
const NH = {init:false, pile:[], cles:[], pause:false, quitter:0};

function nhEtat(){
  if(!currentUser) return {t:'login'};
  if(typeof directionOuverte !== 'undefined' && directionOuverte) return {t:'direction'};
  if(activeModule === 'admin') return {t:'admin', tab:activeTab};
  if(!activeSociete) return {t:'societes'};
  if(!activeModule) return {t:'modules', soc:activeSociete};
  const ctx = {};
  if(typeof mgtFicheId !== 'undefined') ctx.fiche = mgtFicheId;
  if(typeof mgtDevisId !== 'undefined') ctx.devis = mgtDevisId;
  if(typeof savTicketId !== 'undefined') ctx.ticket = savTicketId;
  if(typeof factId !== 'undefined') ctx.fact = factId;
  return {t:'tab', soc:activeSociete, mod:activeModule, tab:activeTab, ctx};
}
function nhPoser(){
  if(NH.pause || !currentUser) return;
  const s = nhEtat(), k = JSON.stringify(s);
  if(!NH.init){
    NH.init = true; NH.pile = [s]; NH.cles = [k];
    try { history.replaceState({nh:-1}, ''); history.pushState({nh:0}, ''); } catch(e) {}
    return;
  }
  if(k === NH.cles[NH.cles.length - 1]) return;
  NH.pile.push(s); NH.cles.push(k);
  try { history.pushState({nh:NH.pile.length - 1}, ''); } catch(e) {}
}
function nhRestaurer(s){
  NH.pause = true;
  try {
    if(s.t === 'direction') openDirection();
    else if(s.t === 'societes') switchSociete();
    else if(s.t === 'modules'){ directionOuverte = false; activeSociete = s.soc; activeModule = null; renderModuleSelect(); }
    else if(s.t === 'admin'){ ouvrirAdmin(); nav(s.tab); }
    else if(s.t === 'tab'){
      const c = s.ctx || {};
      if('fiche' in c && typeof mgtFicheId !== 'undefined') mgtFicheId = c.fiche;
      if('devis' in c && typeof mgtDevisId !== 'undefined') mgtDevisId = c.devis;
      if('ticket' in c && typeof savTicketId !== 'undefined') savTicketId = c.ticket;
      if('fact' in c && typeof factId !== 'undefined') factId = c.fact;
      if((typeof directionOuverte !== 'undefined' && directionOuverte) || activeSociete !== s.soc || activeModule !== s.mod || !document.getElementById('main')){
        directionOuverte = false; activeSociete = s.soc; activeModule = s.mod; renderShell();
      }
      nav(s.tab);
    }
  } catch(err) { console.error('Retour', err); }
  NH.pause = false;
}
window.addEventListener('popstate', (e) => {
  if(!currentUser || !NH.init) return;
  const n = e.state && typeof e.state.nh === 'number' ? e.state.nh : null;
  // Une fenêtre ou le menu du compte est ouvert : le retour le ferme d'abord.
  const um = document.getElementById('user-menu'), bd = document.querySelector('.modal-backdrop');
  if(um || bd){
    if(um) um.remove(); else bd.click();
    try { history.pushState({nh:NH.pile.length - 1}, ''); } catch(err) {}
    return;
  }
  if(n === -1){
    if(NH.quitter && Date.now() - NH.quitter < 2500){ NH.quitter = 0; NH.init = false; history.back(); return; }
    NH.quitter = Date.now();
    if(typeof showToast === 'function') showToast('Appuyez encore sur Retour pour quitter');
    try { history.pushState({nh:0}, ''); } catch(err) {}
    return;
  }
  if(n !== null && n < NH.pile.length - 1){
    NH.pile.length = n + 1; NH.cles.length = n + 1;
    nhRestaurer(NH.pile[n]);
  }
});
// Chaque changement d'écran ajoute une entrée dans l'historique.
['nav', 'chooseSociete', 'chooseModule', 'openDirection', 'switchSociete', 'switchModule', 'ouvrirAdmin', 'renderModuleSelect', 'renderSocieteSelect'].forEach(nom => {
  const orig = window[nom]; if(typeof orig !== 'function') return;
  window[nom] = function(){ const r = orig.apply(this, arguments); try { nhPoser(); } catch(e) {} return r; };
});
const nhLogoutOrigine = window.logout;
if(typeof nhLogoutOrigine === 'function') window.logout = function(){ NH.init = false; NH.pile = []; NH.cles = []; return nhLogoutOrigine.apply(this, arguments); };
