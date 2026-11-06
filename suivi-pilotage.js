/* =====================================================================
   SUIVI PERCKO — PILOTAGE DE LA COMMANDE (onglet « Suivi », vue « Pilotage »)
   ---------------------------------------------------------------------
   Tableau de pilotage d'un lot : en-tête de la commande, chiffres clés, frise des
   étapes, puis une ligne par référence × taille × client avec les quantités de
   chaque étape (cumuls des mouvements du suivi), sous-totaux par modèle et total.
   - Reste à produire = quantité commandée − quantité expédiée (jamais négatif ;
     un surplus éventuel est indiqué à part).
   - Avancement = quantité expédiée / quantité commandée.
   - Tri, filtres, recherche, colonnes redimensionnables (largeurs gardées sur
     l'appareil), cases à cocher (pour les exports).
   Étape 1 : consultation. Les étapes « En assemblage (GADH) » et « Prêt à
   expédier » restent enregistrées mais n'ont pas de colonne.
   Chargé avant le script principal du suivi : n'utilise ses fonctions qu'à l'affichage.
   ===================================================================== */
(function(){
'use strict';
var CSS = [
  '.ph-head{display:flex;flex-wrap:wrap;gap:10px;align-items:stretch;margin:0 0 12px}',
  '.ph-titre{display:flex;align-items:center;gap:12px;background:#1d3557;color:#fff;border-radius:14px;padding:10px 16px;flex:1 1 280px}',
  '.ph-titre img{height:42px;width:auto;background:#fff;border-radius:8px;padding:3px 6px}.ph-titre b{display:block;font-size:20px;font-weight:800}.ph-titre span{font-size:14px;opacity:.9}',
  '.ph-info{display:flex;flex-direction:column;justify-content:center;gap:2px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 14px;flex:0 1 auto;min-width:120px}',
  '.ph-info small{font-size:12px;color:var(--mut);font-weight:600}.ph-info b{font-size:16px;font-weight:800}.ph-info input{height:32px;padding:0 6px;font-size:14px;font-weight:700}',
  '.ph-etat{align-self:center;border-radius:99px;padding:8px 18px;font-weight:800;font-size:15px}.ph-etat.cours{background:#e7f1ff;color:#1d4f91}.ph-etat.fini{background:#dcf5e5;color:#11643a}.ph-etat.retard{background:#fde2e1;color:#b42318}.ph-etat.att{background:var(--sub);color:var(--mut)}',
  '.ph-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0 0 12px}',
  '.ph-kpi{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--c);border-radius:12px;padding:9px 11px}',
  '.ph-kpi small{display:block;font-size:12.5px;font-weight:700;color:var(--mut);min-height:30px}.ph-kpi b{display:block;font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}',
  '.ph-kpi .p{font-size:13px;font-weight:700;color:var(--c)}.ph-bar{height:7px;border-radius:99px;background:var(--sub);overflow:hidden;margin-top:5px}.ph-bar i{display:block;height:100%;background:var(--c);border-radius:99px}',
  '.ph-frise{display:flex;align-items:flex-start;gap:0;overflow-x:auto;margin:0 0 12px;padding:6px 2px 2px}',
  '.ph-et{flex:1 0 92px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;font-size:12.5px;font-weight:700}',
  '.ph-et:not(:last-child)::after{content:"";position:absolute;top:16px;left:calc(50% + 20px);right:calc(-50% + 20px);height:3px;background:var(--line);border-radius:3px}',
  '.ph-et.fait:not(:last-child)::after{background:#1f9254}.ph-et .o{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;margin-bottom:4px;background:var(--sub);color:var(--mut);border:2px solid var(--line)}',
  '.ph-et.fait .o{background:#1f9254;color:#fff;border-color:#1f9254}.ph-et.cours .o{background:#fff3cd;color:#7a4b00;border-color:#d99a00}.ph-et span{color:var(--mut);font-weight:600;font-size:11.5px}',
  '.ph-outils{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}.ph-outils input[type=search]{flex:1 1 220px;height:38px}.ph-outils select{height:38px;max-width:180px}',
  '.ph-sel{font-size:13px;font-weight:700;color:var(--mut)}',
  '.ph-tw{overflow:auto;max-height:72vh;border:1px solid var(--line);border-radius:12px;background:var(--card)}',
  '.ph-t{border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:13px}',
  '.ph-t th{position:sticky;top:0;z-index:3;background:#1d3557;color:#fff;font-weight:700;font-size:12px;padding:7px 6px;text-align:center;line-height:1.2;white-space:normal;user-select:none;cursor:pointer;border-right:1px solid rgba(255,255,255,.15)}',
  '.ph-t th .rz{position:absolute;top:0;right:-3px;width:8px;height:100%;cursor:col-resize;z-index:4}.ph-t th .tri{font-size:10px;margin-left:2px}',
  '.ph-t td{padding:5px 6px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--card)}',
  '.ph-t td.g{text-align:left}.ph-t td.mod{font-weight:800;white-space:normal;background:#eef4fb;color:#1d3557;text-align:center;vertical-align:middle}',
  '.ph-t td.cou{font-weight:700;font-size:12px}.ph-t td.bad{background:#fde2e1;color:#b42318;font-weight:800}.ph-t td.ok{color:#11643a;font-weight:800}',
  '.ph-t tr.st td{background:#e3edf8;font-weight:800;color:#1d3557}.ph-t tr.tg td{background:#1d3557;color:#fff;font-weight:800;font-size:14px;border-color:#1d3557}',
  '.ph-t tr.gh td{background:#eef4fb;color:#1d3557;font-weight:800;text-align:left}',
  '.ph-t tr.cochee td:not(.mod){background:#fffbe6}',
  '.ph-av{display:flex;align-items:center;gap:6px}.ph-av .ph-bar{flex:1;margin:0;height:9px}.ph-av b{min-width:42px;text-align:right;font-size:12.5px}',
  '.ph-t .sk{position:sticky;z-index:2}.ph-t th.sk{z-index:5}',
  '.ph-vide{padding:22px;text-align:center;color:var(--mut)}',
  '.ph-t input[type=checkbox]{width:17px;height:17px;min-height:0;margin:0;padding:0;vertical-align:middle;cursor:pointer}',
  '@media (min-width:1200px){.ph-kpis{grid-template-columns:repeat(10,minmax(0,1fr))}.ph-kpi b{font-size:19px}}',
  '@media (max-width:700px){.ph-titre{flex-basis:100%}.ph-info{flex:1 1 40%;min-width:0;padding:6px 10px}.ph-info b{font-size:15px}.ph-etat{flex:1 1 40%;text-align:center}.ph-titre b{font-size:17px}.ph-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ph-et{flex-basis:80px}}'
].join('\n');
function poserCss(){ if (document.getElementById('ph-css')) return; var st = document.createElement('style'); st.id = 'ph-css'; st.textContent = CSS; document.head.appendChild(st); }

/* étapes affichées (colonnes) et couleurs */
var ETAPES = [
  ["cp", "Qté coupée", "Coupe", "#22a06b"],
  ["gadh", "Passée à l'assemblage (GADH)", "Assemblage GADH", "#e8830c"],
  ["ret", "Revenue chez TEK-TREND", "Retour TEK-TREND", "#c2410c"],
  ["conf", "En confection", "Confection", "#7c3aed"],
  ["ctl", "Contrôlée", "Contrôle", "#0e7490"],
  ["emb", "Emballée", "Emballage", "#15803d"],
  ["exp", "Expédiée", "Expédition", "#2563eb"]
];
var COLS = [
  {k:"sel", t:"", w:34},
  {k:"model", t:"Modèle", w:104, txt:1, cm:1},
  {k:"lib", t:"Référence", w:200, txt:1},
  {k:"coul", t:"Couleur", w:80, txt:1},
  {k:"size", t:"Taille", w:56, txt:1},
  {k:"client", t:"Client", w:72, txt:1},
  {k:"fr", t:"Qté commandée", w:78}
].concat(ETAPES.map(function(e){ return {k:e[0], t:e[1], w:e[0] === "gadh" || e[0] === "ret" ? 92 : 76}; }))
 .concat([{k:"rest", t:"Reste à produire", w:78}, {k:"av", t:"Avancement", w:122}]);
var CLE_LARG = "pk_pilotage_cols";
function largeurs(){ var o = {}; try { o = JSON.parse(localStorage.getItem(CLE_LARG) || "{}") || {}; } catch (e) {} return o; }
function garderLargeur(k, w){ try { var o = largeurs(); o[k] = w; localStorage.setItem(CLE_LARG, JSON.stringify(o)); } catch (e) {} }

/* couleur lue dans le libellé (tableau des fiches, sinon mot-clé) */
function couleurDe(lib){
  var m = (typeof FM !== "undefined" ? FM : []).filter(function(x){ return x[0] === lib; })[0];
  if (m && m[4]) return {t:String(m[4]).toUpperCase(), bg:m[7] || "FFFFFF", fg:m[8] || "000000"};
  var s = String(lib || "").toLowerCase();
  var L = [[/rose/, "ROSE", "FFC0CB", "000000"], [/sable|beige/, "BEIGE", "DEDC86", "000000"], [/gris/, "GRIS", "D9D9D9", "000000"], [/noir/, "NOIR", "595959", "FFFFFF"], [/blanc/, "BLANC", "FFFFFF", "000000"], [/bleu|marine/, "BLEU", "BDD7EE", "000000"], [/vert/, "VERT", "C6E0B4", "000000"], [/rouge/, "ROUGE", "F4B084", "000000"]];
  for (var i = 0; i < L.length; i++) if (L[i][0].test(s)) return {t:L[i][1], bg:L[i][2], fg:L[i][3]};
  return {t:"", bg:"FFFFFF", fg:"000000"};
}
function pct(a, b){ return b ? Math.round(a / b * 1000) / 10 : 0; }
function fmtPct(x){ return (Math.round(x * 10) / 10).toLocaleString("fr-FR", {minimumFractionDigits:1, maximumFractionDigits:1}) + " %"; }

/* ---------- données ---------- */
/* une ligne par référence × taille × client ; quantités = cumuls des mouvements de chaque étape */
function lignesPilotage(lot){
  var lo = libOrder();
  return suivi(lot, "*").map(function(r){
    var c = couleurDe(r.lib), o = {id:r.id, model:r.model, lib:r.lib, coul:c.t, cbg:c.bg, cfg:c.fg, size:r.size, client:r.client, fr:r.fr, ord:r.lib in lo ? lo[r.lib] : 1000};
    ETAPES.forEach(function(e){ o[e[0]] = r.s[e[0]] || 0; });
    o.rest = Math.max(0, o.fr - o.exp); o.surplus = Math.max(0, o.exp - o.fr); o.av = pct(o.exp, o.fr);
    return o;
  });
}
function sommer(rows){
  var t = {fr:0, rest:0, surplus:0, n:rows.length}; ETAPES.forEach(function(e){ t[e[0]] = 0; });
  rows.forEach(function(r){ t.fr += r.fr; t.rest += r.rest; t.surplus += r.surplus; ETAPES.forEach(function(e){ t[e[0]] += r[e[0]]; }); });
  t.av = pct(t.exp, t.fr);
  return t;
}
/* une étape qui dépasse l'étape précédente (sauf coupe > commande, contrôle / emballage > confection) */
function incoherent(r, k){
  var i = ETAPES.map(function(e){ return e[0]; }).indexOf(k); if (i <= 0) return false;
  if (k === "ctl" || k === "emb") return false;
  return r[k] > r[ETAPES[i - 1][0]];
}
function filtres(){ var P = ui.pil = ui.pil || {}; P.f = P.f || {}; P.sel = P.sel || {}; if (P.grp === undefined) P.grp = true; return P; }
function appliquerFiltres(rows){
  var P = filtres(), f = P.f, q = String(P.q || "").trim().toLowerCase();
  return rows.filter(function(r){
    if (f.model && r.model !== f.model) return false; if (f.coul && r.coul !== f.coul) return false;
    if (f.size && r.size !== f.size) return false; if (f.client && r.client !== f.client) return false;
    if (f.etat === "rien" && (r.cp || r.exp)) return false;
    if (f.etat === "cours" && !(r.rest > 0 && (r.cp || r.gadh || r.exp))) return false;
    if (f.etat === "fini" && r.rest > 0) return false;
    if (f.etat === "reste" && !(r.rest > 0)) return false;
    if (q && (r.lib + " " + r.model + " " + r.size + " " + r.coul + " " + r.client).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function trier(rows){
  var P = filtres(), k = P.tri, sens = P.sens === "desc" ? -1 : 1;
  var base = function(a, b){ return (a.ord - b.ord) || (a.lib < b.lib ? -1 : a.lib > b.lib ? 1 : 0) || (sizeIdx(a.size) - sizeIdx(b.size)) || (a.client < b.client ? -1 : a.client > b.client ? 1 : 0); };
  return rows.slice().sort(function(a, b){
    if (k){ var c = k === "size" ? sizeIdx(a.size) - sizeIdx(b.size) : (typeof a[k] === "number" ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]), "fr")); if (c) return c * sens; }
    return base(a, b);
  });
}
/* groupes par modèle (dans l'ordre de la commande) */
function grouper(rows){
  var g = [], par = {};
  rows.forEach(function(r){ var x = par[r.model]; if (!x){ x = par[r.model] = {model:r.model, rows:[], ord:r.ord}; g.push(x); } x.rows.push(r); x.ord = Math.min(x.ord, r.ord); });
  g.sort(function(a, b){ return a.ord - b.ord; });   /* les modèles restent dans l'ordre de la commande ; le tri se fait dans chaque modèle */
  return g;
}
function etatLot(lot, T){
  var L = S.lots[lot] || {};
  if (!T.fr) return {t:"Sans quantité", c:"att"};
  if (T.rest === 0) return {t:"✔ Terminée", c:"fini"};
  if (L.closed) return {t:"Clôturée", c:"fini"};
  if (L.livraison && L.livraison < today()) return {t:"En retard", c:"retard"};
  if (!lotReady(lot)) return {t:"À valider", c:"att"};
  return {t:"En cours", c:"cours"};
}
function derniereMaj(lot){
  var ids = {}, d = ""; S.lines.forEach(function(l){ if (l.lot === lot) ids[l.id] = 1; });
  S.moves.forEach(function(m){ if (ids[m.lineId] && m.date > d) d = m.date; });
  return d;
}

/* ---------- vue ---------- */
window.vPilotage = function(v){
  poserCss();
  var lot = ui.lot;
  if (!lot){ v.appendChild(el("div", {class:"card"}, el("div", {class:"ph-vide", text:"Choisissez une commande (lot) en haut de l'écran."}))); return; }
  var toutes = lignesPilotage(lot);
  if (!toutes.length){ v.appendChild(el("div", {class:"card"}, el("div", {class:"ph-vide", text:"Aucune ligne pour ce lot. Ajoutez la commande dans l'onglet Commandes."}))); return; }
  var P = filtres();
  if (P.lot !== lot){ P.lot = lot; P.f = {}; P.q = ""; P.sel = {}; }
  if (!P.init && ui.client && ui.client !== "*"){ P.f.client = ui.client; } P.init = true;
  var Tall = sommer(toutes), L = S.lots[lot] || {};
  var annee = (S.lines.filter(function(l){ return l.lot === lot; })[0] || {}).year || "";
  var clients = sortedUnique(toutes.map(function(r){ return r.client; }));
  /* en-tête */
  var modif = !lectureSeule() && VUE !== "gadh";
  var dc;
  if (modif){
    dc = el("input", {type:"date", value:L.dc || "", title:"Date de la commande"});
    dc.addEventListener("change", function(){ commit(function(){ ensureLot(lot); S.lots[lot].dc = dc.value || ""; }, dc.value ? "Date de commande : " + dmy(dc.value) : "Date de commande effacée"); });
  } else dc = el("b", {text:L.dc ? dmyL(L.dc) : "—"});
  var E = etatLot(lot, Tall), maj = derniereMaj(lot);
  v.appendChild(el("div", {class:"ph-head"},
    el("div", {class:"ph-titre"}, el("img", {src:"./logo-tek.png", alt:"TEK-TREND"}), el("div", null, el("b", {text:"Suivi de commande"}), el("span", {text:"N° : " + lot + " · " + clients.join(" + ")}))),
    el("div", {class:"ph-info"}, el("small", {text:"Date commande"}), dc),
    el("div", {class:"ph-info"}, el("small", {text:"Lot"}), el("b", {text:lot})),
    el("div", {class:"ph-info"}, el("small", {text:"Année"}), el("b", {text:String(annee || "—")})),
    L.livraison ? el("div", {class:"ph-info"}, el("small", {text:"Livraison prévue"}), el("b", {text:dmyL(L.livraison)})) : null,
    el("div", {class:"ph-info"}, el("small", {text:"Dernière mise à jour"}), el("b", {text:maj ? dmyL(maj) : "—"})),
    el("span", {class:"ph-etat " + E.c, text:E.t})));
  var zone = el("div");
  v.appendChild(zone);
  dessiner();
  if (window.matchMedia){ var mq = window.matchMedia("(max-width:700px)"), sur = function(){ if (!document.body.contains(zone)){ if (mq.removeEventListener) mq.removeEventListener("change", sur); return; } dessiner(); };
    if (mq.addEventListener) mq.addEventListener("change", sur); }

  function dessiner(){
    zone.innerHTML = "";
    var vis = trier(appliquerFiltres(toutes)), T = sommer(vis), filtre = vis.length !== toutes.length;
    /* chiffres clés (sur les lignes affichées) */
    var kp = el("div", {class:"ph-kpis"});
    function carte(titre, val, p, coul, sous){ return el("div", {class:"ph-kpi", style:"--c:" + coul}, el("small", {text:titre}), el("b", {text:val}), p === null ? (sous ? el("div", {class:"p", text:sous}) : null) : el("div", {class:"p", text:fmtPct(p)}), p === null ? null : el("div", {class:"ph-bar"}, el("i", {style:"width:" + Math.min(100, p) + "%"}))); }
    kp.appendChild(carte("Qté commandée" + (filtre ? " (filtre)" : ""), fmt(T.fr) + " pcs", null, "#1d3557", vis.length + " ligne(s)"));
    ETAPES.forEach(function(e){ kp.appendChild(carte(e[1], fmt(T[e[0]]) + " pcs", pct(T[e[0]], T.fr), e[3])); });
    kp.appendChild(carte("Reste à produire", fmt(T.rest) + " pcs", null, "#b42318", T.surplus ? "+ " + fmt(T.surplus) + " en surplus" : "commandée − expédiée"));
    kp.appendChild(carte("Avancement", fmtPct(T.av), T.av, T.av >= 100 ? "#1f9254" : "#2563eb"));
    zone.appendChild(kp);
    /* frise des étapes */
    var fr = el("div", {class:"ph-frise"});
    var etC = lotReady(lot) ? "fait" : "cours";
    fr.appendChild(el("div", {class:"ph-et " + etC}, el("div", {class:"o", text:etC === "fait" ? "✓" : "1"}), "Commande", el("span", {text:fmt(T.fr) + " pcs"})));
    ETAPES.forEach(function(e, i){ var q = T[e[0]], c = T.fr && q >= T.fr ? "fait" : q > 0 ? "cours" : "";
      fr.appendChild(el("div", {class:"ph-et " + c}, el("div", {class:"o", text:c === "fait" ? "✓" : String(i + 2)}), e[2], el("span", {text:fmtPct(pct(q, T.fr))}))); });
    zone.appendChild(fr);
    /* outils : recherche, filtres */
    var o = el("div", {class:"ph-outils"});
    var rq = el("input", {type:"search", placeholder:"🔍 Rechercher une référence, un modèle, une taille…", value:P.q || ""});
    rq.addEventListener("input", function(){ P.q = rq.value; var pos = rq.selectionStart; dessiner(); var n = zone.querySelector(".ph-outils input[type=search]"); if (n){ n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} } });
    o.appendChild(rq);
    function choix(cle, titre, valeurs){
      var s = el("select", {title:titre}); s.appendChild(el("option", {value:"", text:titre + " : tous"}));
      valeurs.forEach(function(x){ s.appendChild(el("option", {value:x[0], text:x[1]})); }); s.value = P.f[cle] || "";
      s.addEventListener("change", function(){ P.f[cle] = s.value; dessiner(); }); return s;
    }
    var uniq = function(k, tri){ var u = sortedUnique(toutes.map(function(r){ return r[k]; }).filter(Boolean)); if (tri) u.sort(tri); return u.map(function(x){ return [x, x]; }); };
    o.appendChild(choix("model", "Modèle", uniq("model")));
    o.appendChild(choix("coul", "Couleur", uniq("coul")));
    o.appendChild(choix("size", "Taille", uniq("size", function(a, b){ return sizeIdx(a) - sizeIdx(b); })));
    if (clients.length > 1) o.appendChild(choix("client", "Client", uniq("client")));
    o.appendChild(choix("etat", "État", [["reste", "Reste à produire"], ["cours", "En cours"], ["rien", "Pas commencé"], ["fini", "Terminé (expédié)"]]));
    o.appendChild(el("button", {class:"btn small sec", text:P.grp ? "Sans sous-totaux" : "Sous-totaux par modèle", onclick:function(){ P.grp = !P.grp; dessiner(); }}));
    if (filtre || P.tri) o.appendChild(el("button", {class:"btn small sec", text:"✕ Tout afficher", onclick:function(){ P.f = {}; P.q = ""; P.tri = ""; P.sens = ""; dessiner(); }}));
    var nSel = Object.keys(P.sel).filter(function(id){ return P.sel[id]; }).length;
    if (nSel) o.appendChild(el("span", {class:"ph-sel"}, nSel + " ligne(s) cochée(s) ", el("button", {class:"btn small sec", text:"Décocher", onclick:function(){ P.sel = {}; dessiner(); }})));
    zone.appendChild(o);
    zone.appendChild(tableau(vis, T));
    zone.appendChild(el("p", {class:"mut", style:"font-size:12.5px;margin:6px 0 0", text:"Quantités = cumul des pièces passées à chaque étape. Reste à produire = commandée − expédiée. Avancement = expédiée ÷ commandée. Case rouge : quantité plus grande que l'étape précédente. Touchez un titre de colonne pour trier ; faites glisser son bord pour la largeur."}));
  }

  function tableau(vis, T){
    var W = largeurs(), etroit = window.matchMedia && window.matchMedia("(max-width:700px)").matches;
    /* sur téléphone, la colonne Modèle devient une ligne de titre au-dessus de chaque groupe */
    var cols = COLS.filter(function(c){ return !(c.cm && etroit) && !(c.k === "client" && clients.length < 2); });   /* colonne Client seulement si la commande a plusieurs clients */
    var t = el("table", {class:"ph-t"}), cg = el("colgroup"), tot = 0;
    cols.forEach(function(c){ var w = W[c.k] || c.w; cg.appendChild(el("col", {style:"width:" + w + "px"})); tot += w; });
    t.appendChild(cg); t.style.width = tot + "px";
    /* colonnes fixes à gauche : case à cocher et référence (et modèle sur ordinateur) */
    var gauche = {}, x = 0; ["sel", "model", "lib"].forEach(function(k){ var c = cols.filter(function(y){ return y.k === k; })[0]; if (!c) return; gauche[k] = x; x += W[k] || c.w; });
    function sk(td, k){ if (k in gauche){ td.classList.add("sk"); td.style.left = gauche[k] + "px"; } return td; }
    var hr = el("tr");
    cols.forEach(function(c, i){
      var th = sk(el("th", {title:c.t}), c.k);
      if (c.k === "sel"){
        var tous = vis.length && vis.every(function(r){ return P.sel[r.id]; });
        var cb = el("input", {type:"checkbox", title:"Cocher toutes les lignes affichées"}); cb.checked = !!tous;
        cb.addEventListener("click", function(ev){ ev.stopPropagation(); vis.forEach(function(r){ P.sel[r.id] = cb.checked; }); dessiner(); });
        th.appendChild(cb); th.style.cursor = "default";
      } else {
        th.appendChild(document.createTextNode(c.t));
        if (P.tri === c.k) th.appendChild(el("span", {class:"tri", text:P.sens === "desc" ? "▼" : "▲"}));
        th.addEventListener("click", function(){ if (P.tri !== c.k){ P.tri = c.k; P.sens = "asc"; } else if (P.sens === "asc") P.sens = "desc"; else { P.tri = ""; P.sens = ""; } dessiner(); });
      }
      /* redimensionner la colonne */
      var rz = el("span", {class:"rz", title:"Faire glisser pour changer la largeur"});
      function debut(ev){
        ev.preventDefault(); ev.stopPropagation();
        var x0 = (ev.touches ? ev.touches[0] : ev).clientX, w0 = W[c.k] || c.w, col = cg.children[i], w = w0;
        function bouge(e2){ var xx = (e2.touches ? e2.touches[0] : e2).clientX; w = Math.max(30, Math.round(w0 + xx - x0)); col.style.width = w + "px"; t.style.width = (tot - w0 + w) + "px"; }
        function fin(){ document.removeEventListener("mousemove", bouge); document.removeEventListener("mouseup", fin); document.removeEventListener("touchmove", bouge); document.removeEventListener("touchend", fin); garderLargeur(c.k, w); dessiner(); }
        document.addEventListener("mousemove", bouge); document.addEventListener("mouseup", fin); document.addEventListener("touchmove", bouge, {passive:false}); document.addEventListener("touchend", fin);
      }
      rz.addEventListener("mousedown", debut); rz.addEventListener("touchstart", debut, {passive:false}); rz.addEventListener("click", function(ev){ ev.stopPropagation(); });
      th.appendChild(rz);
      hr.appendChild(th);
    });
    t.appendChild(el("thead", null, hr));
    var tb = el("tbody");
    if (!vis.length){ var tr0 = el("tr"); tr0.appendChild(el("td", {colspan:String(cols.length), class:"ph-vide", text:"Aucune ligne ne correspond à la recherche ou aux filtres."})); tb.appendChild(tr0); }
    function cellNum(r, k){ var v0 = r[k], td = el("td", {text:v0 ? fmt(v0) : "0"}); if (incoherent(r, k)) { td.className = "bad"; td.title = "Plus que l'étape précédente"; } if (k === "rest"){ td.textContent = fmt(v0); if (!v0) td.className = "ok"; if (r.surplus) td.title = "+ " + r.surplus + " en surplus"; } if (!v0 && k !== "rest") td.style.color = "var(--mut)"; return td; }
    function avance(p){ var c = p >= 100 ? "#1f9254" : p >= 50 ? "#2563eb" : "#e8830c"; return el("div", {class:"ph-av"}, el("div", {class:"ph-bar"}, el("i", {style:"width:" + Math.min(100, p) + "%;background:" + c})), el("b", {text:fmtPct(p)})); }
    function ligne(r, rowspan, avecMod){
      var tr = el("tr", {class:P.sel[r.id] ? "cochee" : ""});
      cols.forEach(function(c){
        var td;
        if (c.k === "sel"){ td = el("td"); var cb = el("input", {type:"checkbox"}); cb.checked = !!P.sel[r.id]; cb.addEventListener("change", function(){ P.sel[r.id] = cb.checked; dessiner(); }); td.appendChild(cb); }
        else if (c.k === "model"){ if (!avecMod) return; td = el("td", {class:"mod", text:r.model}); if (rowspan > 1) td.rowSpan = rowspan; }
        else if (c.k === "lib") td = el("td", {class:"g", text:r.lib, title:r.lib});
        else if (c.k === "coul"){ td = el("td", {class:"cou", text:r.coul}); td.style.background = "#" + r.cbg; td.style.color = "#" + r.cfg; }
        else if (c.k === "size") td = el("td", {text:r.size, style:"font-weight:800"});
        else if (c.k === "client") td = el("td", {text:r.client});
        else if (c.k === "av"){ td = el("td"); td.appendChild(avance(r.av)); }
        else td = cellNum(r, c.k);
        tr.appendChild(sk(td, c.k));
      });
      return tr;
    }
    function totalLigne(lib, S2, cls){
      var tr = el("tr", {class:cls}), nTxt = cols.filter(function(c){ return c.txt; }).length;
      tr.appendChild(sk(el("td"), "sel"));
      var lab = el("td", {class:"g", colspan:String(nTxt), text:lib}); if ("model" in gauche){ lab.classList.add("sk"); lab.style.left = gauche.model + "px"; } tr.appendChild(lab);
      cols.forEach(function(c){ if (c.k === "sel" || c.txt) return; var td; if (c.k === "av"){ td = el("td"); td.appendChild(avance(S2.av)); } else td = el("td", {text:fmt(S2[c.k])}); tr.appendChild(td); });
      return tr;
    }
    if (P.grp){
      grouper(vis).forEach(function(g){
        if (etroit){ var gh = el("tr", {class:"gh"}); var ght = el("td", {colspan:String(cols.length), text:g.model}); gh.appendChild(ght); tb.appendChild(gh); }
        g.rows.forEach(function(r, i){ tb.appendChild(ligne(r, g.rows.length, i === 0)); });
        tb.appendChild(totalLigne("Sous-total " + g.model, sommer(g.rows), "st"));
      });
    } else vis.forEach(function(r){ tb.appendChild(ligne(r, 1, true)); });
    if (vis.length) tb.appendChild(totalLigne("TOTAL GÉNÉRAL" + (vis.length !== toutes.length ? " (lignes affichées)" : ""), T, "tg"));
    t.appendChild(tb);
    return el("div", {class:"ph-tw"}, t);
  }
};
/* pour les tests */
window.pkPilotage = {lignesPilotage:lignesPilotage, sommer:sommer, couleurDe:couleurDe, appliquerFiltres:appliquerFiltres, trier:trier};
})();
