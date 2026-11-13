// ============================================================
// AFFICHAGE DE CET ÉCRAN : contraste renforcé
// ============================================================
// Pour les anciens écrans (ex. moniteur de Windows 7) où les gris clairs et les
// textes fins deviennent presque invisibles : textes secondaires plus foncés,
// police un peu plus épaisse, bordures et champs de saisie plus marqués.
// Réglage propre à chaque appareil (localStorage), sans rien changer pour les autres.
// Par défaut (« automatique ») : activé sous Windows 7 / 8, désactivé ailleurs.
// Chargé par les trois pages (application, CRM MGT, suivi des commandes) : un
// changement s'applique aussitôt partout (événement « storage »).
// La taille se règle avec le zoom du navigateur (Ctrl + / Ctrl −), mémorisé par Chrome.
(function(){
  var CLE = 'gtm_affichage_v1';
  function ancienSysteme(){ try { return /Windows NT 6\.[0-3]/.test(navigator.userAgent || ''); } catch(e) { return false; } }
  function lire(){
    var v = null; try { v = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch(e) {}
    if(!v || typeof v !== 'object' || v.mode === 'auto' || !v.mode) return {mode: 'auto', contraste: ancienSysteme()};
    return {mode: v.mode, contraste: v.mode === 'renforce'};
  }
  function appliquer(){
    var r = document.documentElement; if(!r) return;
    if(lire().contraste) r.setAttribute('data-affichage', 'renforce'); else r.removeAttribute('data-affichage');
    /* ancien ordinateur : effets graphiques coûteux coupés (voir multiplateforme.css) */
    if(ancienSysteme()) r.setAttribute('data-ancien', '1');
  }
  var R = 'html[data-affichage="renforce"]';
  var CLAIR = R + ':not([data-theme="dark"]):not([data-mgt-theme="dark"])';
  var css = [
    /* police un peu plus épaisse partout (les textes déjà en gras ne changent pas) */
    R + ' body{font-weight:500;}',
    /* application : gris secondaires et bordures plus foncés */
    CLAIR + '{--ink-soft:#1E293B;--ink-faint:#334155;--border:#B8C4D3;--border-soft:#D5DDE7;--border-strong:#8796AB;--surface-2:#F1F5F9;--surface-3:#E2E8F0;--nav-ink:#E2E8F0;}',
    /* suivi des commandes */
    CLAIR + '{--mut:#334155;}',
    /* CRM MGT (thème clair) */
    CLAIR + '[data-mgt-theme="light"]{--muted:#2F3A4A;--theme-muted:#2F3A4A;--line:#AFBACA;--theme-line:#AFBACA;}',
    /* champs de saisie bien visibles */
    CLAIR + ' input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),' + CLAIR + ' select,' + CLAIR + ' textarea{border-color:#8796AB !important;}',
    CLAIR + ' ::placeholder{color:#5B6678 !important;opacity:1;}',
    /* petits libellés gris des cartes et tableaux */
    CLAIR + ' .muted,' + CLAIR + ' .mut,' + CLAIR + ' .text-muted,' + CLAIR + ' .hint,' + CLAIR + ' .sub{color:#334155 !important;}'
  ].join('\n');
  function poserStyle(){
    if(document.getElementById('gtm-affichage-css')) return;
    var st = document.createElement('style'); st.id = 'gtm-affichage-css'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  window.gtmAffichage = {
    lire: lire,
    regler: function(mode){ try { localStorage.setItem(CLE, JSON.stringify({mode: mode})); } catch(e) {} appliquer(); },
    ancienSysteme: ancienSysteme
  };
  window.addEventListener('storage', function(e){ if(e.key === CLE) appliquer(); });
  poserStyle(); appliquer();
})();
