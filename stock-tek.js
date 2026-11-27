/* =====================================================================
   GESTION DE STOCK TEK-TREND — module « Gestion de stock » de GTM (27/11/2026)
   Vue « stock » de suivi-commandes.html (?vue=stock) : la même page que le Suivi PERCKO, donc les MÊMES
   données et les mêmes calculs (articles, nomenclatures, besoins par commande, mouvements) — rien n'est dupliqué.
   Données (Firebase, dossier tek/, une fiche par enregistrement) :
   - articles : désignation, catégorie, unité dans la configuration du suivi (S.mat) ; le reste de la fiche
     (propriétaire, sous-catégorie, fournisseur, référence fournisseur, seuils, emplacement, prix, caractéristiques)
     dans stk_params/<code> ;
   - mouvements : stk_mv/<id>, jamais modifiés ni effacés ; une erreur se corrige par une écriture inverse ;
     chaque mouvement garde son propriétaire (PERCKO ou TEK-TREND) : une même référence peut avoir des
     quantités des deux propriétaires, sans fiche en double ;
   - paramètres du module (catégories, unités, emplacements) : stk_cfg/cfg.
   Types : E entrée, S sortie, R retour de production, P perte / rebut, A ajustement (+/−), T transfert
   d'emplacement (sans effet sur la quantité), Q quarantaine (+ mise en quarantaine, − libération : le stock
   physique ne change pas, le disponible oui).
   Stock disponible = physique − réservé − indisponible ; réservé = besoins restants des commandes en cours
   (nomenclatures du suivi). Aucune donnée réelle dans ce fichier.
   ===================================================================== */
var STOCK_VUE = /[?&]vue=stock\b/.test(location.search);
var STK_SECS = [["tb", "Tableau de bord"], ["art", "Articles"], ["etat", "Stock actuel"], ["mv", "Mouvements"], ["rec", "Réceptions"], ["sor", "Sorties"],
  ["inv", "Inventaires"], ["prod", "Stock production"], ["mach", "Machines et matériels"], ["maint", "Maintenance"], ["rap", "Rapports"], ["par", "Paramètres"]];
var STK_UNITES = ["pièce", "m", "kg", "g", "bobine", "cône", "rouleau", "boîte", "carton", "paire", "litre"];
var STK_CATS_DEF = ["Fil", "Élastique", "Bouton pression", "Pièce de rechange", "Consommable"];
var STK_ST = {
  E:[["achat", "Achat TEK-TREND"], ["client", "Fourni par PERCKO"], ["conso", "Consommables"], ["autre", "Autre entrée"]],
  S:[["production", "Production"], ["coupe", "Coupe"], ["assemblage", "Assemblage"], ["confection", "Confection"], ["maintenance", "Maintenance (machine)"], ["autre", "Autre sortie (motif)"]],
  A:[["inventaire", "Ajustement d'inventaire"], ["correction", "Correction de stock"], ["regul", "Régularisation"]]
};
var STK_TYPES_N = {E:"Entrée", S:"Sortie", R:"Retour de production", P:"Mise au rebut", A:"Ajustement", T:"Transfert", Q:"Quarantaine"};

/* ---------- paramètres du module ---------- */
function scfg(){ return (S.scfg && S.scfg.cfg) || {}; }
function stkCats(){ var c = scfg().cats; return sortedUniqueKeep(FAMILLES.concat(c && c.length ? c : STK_CATS_DEF)); }
function stkUnites(){ return sortedUniqueKeep(STK_UNITES.concat(scfg().unites || []).concat(Object.keys(S.mat || {}).map(function(r){ return S.mat[r][2]; }).filter(Boolean))); }
function stkEmps(){ return sortedUniqueKeep((scfg().emps || []).concat(Object.keys(S.sp || {}).map(function(r){ return (S.sp[r] || {}).empl; }).filter(Boolean)).concat(mvListe().map(function(m){ return m.emp; }).filter(Boolean))); }
function stkEcrireCfg(c){ stkEcrire("scfg", "cfg", c); }

/* ---------- calculs ---------- */
function propDe(ref){ var p = (S.sp[ref] || {}).prop; return p === "PERCKO" ? "PERCKO" : "TEK-TREND"; }
function mvProp(m){ return m.pr === "PERCKO" || m.pr === "TEK-TREND" ? m.pr : propDe(m.ref); }
function stkActif(ref){ return !(S.sp[ref] || {}).inactif; }
/* {ref: {PERCKO:q, "TEK-TREND":q}} : stock physique par propriétaire */
function physParProp(){ var o = {}; mvListe().forEach(function(m){ var e = mvEffet(m); if (!e) return; var x = o[m.ref] || (o[m.ref] = {}), p = mvProp(m); x[p] = r2((x[p] || 0) + e); }); return o; }
/* quantité en quarantaine (indisponible) par article et propriétaire */
function indispoParProp(){ var o = {}; mvListe().forEach(function(m){ if (m.t !== "Q") return; var x = o[m.ref] || (o[m.ref] = {}), p = mvProp(m); x[p] = r2((x[p] || 0) + m.q); }); return o; }
/* une ligne par article et par propriétaire ayant du stock ou des besoins */
function stockLignes(){
  var E = etatStock(), pp = physParProp(), ind = indispoParProp(), out = [];
  E.arts.forEach(function(a){
    if (!S.mat[a.ref] && !a.phys) return;
    var props = Object.keys(pp[a.ref] || {}).filter(function(p){ return pp[a.ref][p]; }), def = propDe(a.ref);
    if (props.indexOf(def) < 0) props.unshift(def);
    props.forEach(function(p){
      var ph = (pp[a.ref] || {})[p] || 0, rs = p === def ? a.res : 0, iv = Math.max(0, (ind[a.ref] || {})[p] || 0), sp = S.sp[a.ref] || {};
      var dsp = r2(ph - rs - iv), seuil = p === def ? a.seuil : 0;
      out.push({ref:a.ref, des:a.des, cat:a.fam, u:a.u, pr:p, phys:ph, res:rs, ind:iv, dispo:dsp, seuil:seuil, smax:+sp.smax || 0, empl:sp.empl || "", sfam:sp.sfam || "",
        actif:stkActif(a.ref), rupture:ph <= 0 && (rs > 0 || seuil > 0), sousSeuil:seuil > 0 && dsp <= seuil, manque:r2(Math.max(0, rs + iv - ph)), prix:+sp.prix || 0});
    });
  });
  return out;
}
function stkStatut(l){ return l.rupture ? ["Rupture", "bad"] : l.dispo < 0 ? ["Insuffisant", "bad"] : l.sousSeuil ? ["Sous le minimum", "warn"] : l.smax && l.phys > l.smax ? ["Au-dessus du maximum", "info"] : ["Disponible", "ok"]; }
function nomType(m){ var s = STK_TYPES_N[m.t] || MV_TYPES[m.t] || m.t, l = (STK_ST[m.t] || []).filter(function(x){ return x[0] === m.st; })[0]; if (m.t === "Q") s = m.q < 0 ? "Sortie de quarantaine" : "Mise en quarantaine"; if (m.t === "A") s = (l ? l[1] : "Ajustement"); else if (l) s += " · " + l[1]; return (m.corr ? "Annulation · " : "") + s; }
function heureDe(m){ return m.h || (m.ts ? new Date(m.ts).toTimeString().slice(0, 5) : ""); }

/* ---------- petits éléments d'interface ---------- */
var STK_ICO = {
  boite:'<path d="M12 2.5l8.5 4.6v9.8L12 21.5l-8.5-4.6V7.1z"/><path d="M3.5 7.1L12 11.7l8.5-4.6M12 11.7v9.8"/>',
  alerte:'<path d="M12 3L2 20.5h20z"/><path d="M12 10v4.6M12 17.4v.2"/>',
  horloge:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  cle:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  doc:'<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h5"/>',
  camembert:'<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M14 3.3A9 9 0 0 1 20.7 10H14z"/>',
  ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
function ico(k){ var s = el("span", {class:"s2-ico"}); s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + STK_ICO[k] + "</svg>"; return s; }
function carteS2(titre, k, extra){ var c = el("section", {class:"s2-carte"}), t = el("div", {class:"s2-tete"}, ico(k), el("h3", {text:titre})); if (extra) t.appendChild(extra); c.appendChild(t); return c; }
function badgeS2(txt, cls){ return el("span", {class:"s2-badge " + (cls || ""), text:txt}); }
function propBadge(p){ return badgeS2(p, p === "PERCKO" ? "percko" : "tek"); }
function lienS2(txt, sec){ return el("button", {class:"s2-lien", text:txt + " →", onclick:function(){ stockAller(sec); }}); }
function tableS2(heads, rows, cls){
  var t = el("table", {class:"s2-t " + (cls || ""), "data-fus":"1"}), h = el("tr");   /* data-fus : pas de fusion de cases (suivi-fusion.js) */
  heads.forEach(function(x){ h.appendChild(el("th", {class:x[1] || "", text:x[0]})); });
  t.appendChild(el("thead", null, h)); var b = el("tbody"); rows.forEach(function(r){ b.appendChild(r); }); t.appendChild(b);
  return el("div", {class:"tw s2-tw"}, t);
}
function tdS2(v, cls){ var td = el("td", {class:cls || ""}); if (v && v.nodeType) td.appendChild(v); else td.textContent = v == null ? "" : String(v); return td; }
function qS2(ref, q){ return fq(ref, q); }
function videS2(t){ return el("p", {class:"mut s2-vide", text:t}); }

/* ---------- navigation (appelée par GTM : barre latérale du module) ---------- */
window.stockAller = function(sec){ if (!STK_SECS.some(function(s){ return s[0] === sec; })) sec = "tb"; ui.stk = sec; ui.stEdit = null; ui.s2Form = null; ui.s2Voir = null; render(); };
window.stockRecharger = function(){ var a = document.activeElement; if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return; try { chargerStock(); render(true); } catch (e) {} };

function stockVue(v){
  if (!S.mat || !S.lines){ v.appendChild(el("p", {class:"mut", text:"Chargement du stock…"})); return; }
  if (!ui.stk){ var h = (location.hash || "").slice(1); ui.stk = STK_SECS.some(function(s){ return s[0] === h; }) ? h : "tb"; }
  var nom = (STK_SECS.filter(function(s){ return s[0] === ui.stk; })[0] || STK_SECS[0])[1];
  var hero = el("div", {class:"s2-hero"}, el("div", {class:"s2-hero-photo"}),
    el("div", {class:"s2-hero-tx"}, el("h1", {text:ui.stk === "tb" ? "Gestion de stock" : nom}), el("p", {text:"TEK-TREND" + (ui.stk === "tb" ? " · matières, consommables, machines" : " · Gestion de stock")})),
    el("div", {class:"s2-hero-date", text:new Date().toLocaleDateString("fr-FR", {weekday:"long", day:"numeric", month:"long", year:"numeric"})}));
  v.appendChild(hero);
  if (!HOST || !window.parent || window.parent === window){   /* page ouverte seule (essais) : navigation interne */
    var nav = el("nav", {class:"s2-nav"}); STK_SECS.forEach(function(s){ nav.appendChild(el("button", {class:ui.stk === s[0] ? "on" : "", text:s[1], onclick:function(){ stockAller(s[0]); }})); }); v.appendChild(nav);
  }
  if (lectureSeule()) v.appendChild(el("div", {class:"msg", text:"Lecture seule : vous consultez le stock sans pouvoir le modifier."}));
  ({tb:s2Tableau, art:s2Articles, etat:s2Etat, mv:s2Mouvements, rec:s2Receptions, sor:s2Sorties, inv:s2Inventaires, prod:s2Production, mach:s2Machines, maint:s2Maintenance, rap:s2Rapports, par:s2Parametres})[ui.stk](v);
}

/* ---------- 1. Tableau de bord ---------- */
function s2Tableau(v){
  var L = stockLignes(), refs = Object.keys(S.mat).filter(stkActif), mvs = mvListe();
  var enStock = function(p){ return L.filter(function(l){ return l.pr === p && l.phys > 0; }); };
  var tissu = function(p){ return r2(L.filter(function(l){ return l.pr === p && l.cat === "Tissu" && l.u === "m"; }).reduce(function(s, l){ return s + Math.max(0, l.phys); }, 0)); };
  var valTek = r2(L.filter(function(l){ return l.pr === "TEK-TREND"; }).reduce(function(s, l){ return s + Math.max(0, l.phys) * l.prix; }, 0));
  var alertes = L.filter(function(l){ return l.actif && (l.rupture || l.sousSeuil || l.dispo < 0); });
  var k = el("div", {class:"s2-kpis"});
  function kpi(cls, icone, val, lib, sous, sec){ k.appendChild(el("button", {class:"s2-k " + cls, onclick:function(){ stockAller(sec); }}, ico(icone), el("span", {class:"s2-k-tx"}, el("span", {class:"s2-k-lib", text:lib}), el("b", {text:val}), el("em", {text:sous})))); }
  kpi("bleu", "boite", fmt(refs.length, 0), "Références actives", Object.keys(S.mat).length - refs.length ? (Object.keys(S.mat).length - refs.length) + " inactive(s)" : "articles de la fiche", "art");
  var tT = tissu("TEK-TREND"), tP = tissu("PERCKO");
  kpi("vert", "boite", fmt(enStock("TEK-TREND").length, 0) + " art.", "Stock TEK-TREND", (tT ? fmt(tT, 0) + " m de tissu · " : "") + (valTek ? "valeur " + fmt(valTek, 0) : "valeur : prix à saisir"), "etat");
  kpi("violet", "boite", fmt(enStock("PERCKO").length, 0) + " art.", "Stock PERCKO", tP ? fmt(tP, 0) + " m de tissu" : "matières du client", "etat");
  kpi(alertes.length ? "rouge" : "gris", "alerte", fmt(alertes.length, 0), "Alertes stock", alertes.length ? "sous le minimum ou en rupture" : "aucune alerte", "etat");
  v.appendChild(k);

  var g1 = el("div", {class:"s2-grille2"});
  var cm = carteS2("Mouvements récents", "horloge", lienS2("Voir tous", "mv"));
  var rec = mvs.slice().sort(function(a, b){ return (b.ts || 0) - (a.ts || 0) || (a.d < b.d ? 1 : -1); }).slice(0, 6);
  cm.appendChild(rec.length ? tableS2([["Date"], ["Type"], ["Article"], ["Propriétaire"], ["Quantité", "n"], ["Référence"]], rec.map(function(m){
    var e = mvEffet(m), t = m.t === "T" ? "info" : e > 0 ? "ok" : e < 0 ? "bad" : "info";
    return el("tr", null, tdS2(dmy(m.d) + " " + heureDe(m)), tdS2(badgeS2(nomType(m).split(" · ")[0], t)), tdS2(artNom(m.ref)), tdS2(propBadge(mvProp(m))), tdS2((e > 0 ? "+" : "") + qS2(m.ref, e || m.q), "n " + t), tdS2(m.lot || m.doc || ""));
  })) : videS2("Aucun mouvement enregistré pour l'instant."));
  g1.appendChild(cm);
  var cp = carteS2("Stock par propriétaire", "camembert"), nT = enStock("TEK-TREND").length, nP = enStock("PERCKO").length, tot = nT + nP;
  var pctP = tot ? Math.round(nP / tot * 100) : 0;
  var donut = el("div", {class:"s2-donut", style:"background:conic-gradient(var(--s2-percko) 0 " + pctP + "%, var(--s2-tek) " + pctP + "% 100%)" + (tot ? "" : ";background:var(--line)")}, el("div", null, el("b", {text:String(tot)}), el("span", {text:"articles en stock"})));
  cp.appendChild(el("div", {class:"s2-repart"}, donut, el("ul", {class:"s2-leg"},
    el("li", null, el("i", {class:"percko"}), el("span", null, el("b", {text:"PERCKO"}), el("small", {text:nP + " article(s)" + (tP ? " · " + fmt(tP, 0) + " m de tissu" : "")})), el("strong", {text:tot ? pctP + " %" : "—"})),
    el("li", null, el("i", {class:"tek"}), el("span", null, el("b", {text:"TEK-TREND"}), el("small", {text:nT + " article(s)" + (tT ? " · " + fmt(tT, 0) + " m de tissu" : "")})), el("strong", {text:tot ? (100 - pctP) + " %" : "—"})))));
  g1.appendChild(cp); v.appendChild(g1);

  var g2 = el("div", {class:"s2-grille3"});
  var ce = carteS2("État du stock", "boite"), sous = L.filter(function(l){ return l.actif && l.sousSeuil && !l.rupture; }).length, rup = L.filter(function(l){ return l.actif && l.rupture; }).length;
  var resv = L.filter(function(l){ return l.res > 0; }).length, act = L.filter(function(l){ return l.actif; }), taux = act.length ? Math.round(act.filter(function(l){ return l.dispo > 0; }).length / act.length * 100) : 0;
  ce.appendChild(el("div", {class:"s2-etat"}, [[sous, "Sous le seuil", "warn"], [rup, "En rupture", "bad"], [resv, "Matières réservées", "info"], [taux + " %", "Taux de disponibilité", "ok"]].map(function(x){ return el("div", {class:"s2-etat-c " + x[2]}, el("b", {text:String(x[0])}), el("span", {text:x[1]})); })));
  g2.appendChild(ce);
  var cs = carteS2("Sorties par commande", "doc", lienS2("Voir plus", "prod")), par = {};
  mvs.forEach(function(m){ if (m.t !== "S" || !m.lot) return; var x = par[m.lot] || (par[m.lot] = {n:0, d:""}); x.n++; if (m.d > x.d) x.d = m.d; });
  var lots = Object.keys(par).sort(function(a, b){ return par[a].d < par[b].d ? 1 : -1; }).slice(0, 3);
  cs.appendChild(lots.length ? el("div", {class:"s2-cmds"}, lots.map(function(l){ return el("button", {class:"s2-cmd", onclick:function(){ ui.s2Lot = l; stockAller("prod"); }}, el("b", {text:l}), el("span", {text:par[l].n + " sortie(s) de matières"}), el("em", {text:"dernière le " + dmy(par[l].d)})); })) : videS2("Aucune sortie de matières vers une commande."));
  g2.appendChild(cs);
  var cmac = carteS2("État des machines", "cle", lienS2("Voir plus", "mach")), M = machinesTek();
  if (!M.liste.length) cmac.appendChild(videS2("Aucune machine enregistrée pour TEK-TREND."));
  else {
    var pc = Math.round(M.n.service / M.liste.length * 100);
    cmac.appendChild(el("div", {class:"s2-repart"}, el("div", {class:"s2-donut vert", style:"background:conic-gradient(var(--s2-ok) 0 " + pc + "%, var(--line) " + pc + "% 100%)"}, el("div", null, el("b", {text:pc + " %"}), el("span", {text:"en service"}))),
      el("ul", {class:"s2-leg"}, [["En service", M.n.service, "ok"], ["En maintenance", M.n.maintenance, "warn"], ["En panne", M.n.panne, "bad"], ["Hors service", M.n.hors, "gris"]].filter(function(x){ return x[1] || x[2] !== "gris"; }).map(function(x){ return el("li", null, el("i", {class:x[2]}), el("span", null, el("b", {text:x[0]})), el("strong", {text:String(x[1])})); }))));
  }
  g2.appendChild(cmac); v.appendChild(g2);
  if (alertes.length){
    var ca = carteS2("Alertes de stock", "alerte", lienS2("Stock actuel", "etat"));
    ca.appendChild(tableS2([["Article"], ["Propriétaire"], ["Disponible", "n"], ["Minimum", "n"], ["État"]], alertes.slice(0, 8).map(function(l){ var s = stkStatut(l); return el("tr", null, tdS2(l.des), tdS2(propBadge(l.pr)), tdS2(qS2(l.ref, l.dispo), "n"), tdS2(l.seuil ? qS2(l.ref, l.seuil) : "—", "n"), tdS2(badgeS2(s[0], s[1]))); })));
    v.appendChild(ca);
  }
}
/* machines TEK-TREND (module Machines : tek_machines, tek_arrets) — lecture seule ici */
function machinesTek(){
  var m = {}, a = {}; try { m = window.parent.getJSON("tek_machines", {}) || {}; a = window.parent.getJSON("tek_arrets", {}) || {}; } catch (e) {}
  var ouverts = {}; Object.keys(a).forEach(function(k){ var x = a[k]; if (x && !x.fin) ouverts[x.machineId] = x; });
  var n = {service:0, maintenance:0, panne:0, hors:0};
  var liste = Object.keys(m).map(function(id){ var x = m[id] || {}, ar = ouverts[id], et = x.statut === "retiree" ? "hors" : ar ? (ar.cause === "maintenance" || ar.cause === "reglage" ? "maintenance" : "panne") : "service"; n[et]++; return {id:id, nom:x.nom || id, type:x.type || "", marque:x.marque || "", serie:x.serie || "", etat:et, arret:ar || null}; });
  return {liste:liste, n:n};
}

/* ---------- 2. Articles ---------- */
function s2Filtres(opts){
  var f = ui.s2F || (ui.s2F = {}), row = el("div", {class:"s2-filtres"});
  var q = el("input", {type:"search", placeholder:"Rechercher : code, désignation, code-barres…", value:f.q || ""});
  q.addEventListener("input", function(){ f.q = q.value; clearTimeout(ui.s2T); ui.s2T = setTimeout(function(){ render(true); var x = document.querySelector(".s2-filtres input[type=search]"); if (x){ x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); });
  row.appendChild(el("label", {class:"s2-rech"}, q));
  function s(k, lbl, list){ var x = sel([["", lbl]].concat(list.map(function(o){ return Array.isArray(o) ? o : [o, o]; })), f[k] || ""); x.addEventListener("change", function(){ f[k] = x.value; render(true); }); row.appendChild(x); }
  s("pr", "Tous les propriétaires", PROPRIETAIRES);
  s("cat", "Toutes les catégories", stkCats());
  if (!opts || opts.emp !== false) s("emp", "Tous les emplacements", stkEmps());
  return row;
}
function s2Garde(l){
  var f = ui.s2F || {}, q = slugRef(f.q || "").toLowerCase();
  if (f.pr && l.pr !== f.pr) return false;
  if (f.cat && l.cat !== f.cat) return false;
  if (f.emp && l.empl !== f.emp) return false;
  if (q && (slugRef(l.ref + " " + l.des + " " + ((S.sp[l.ref] || {}).refF || "") + " " + ((S.sp[l.ref] || {}).cb || "")).toLowerCase().indexOf(q) < 0)) return false;
  return true;
}
function s2Articles(v){
  if (ui.stEdit){ s2Fiche(v, ui.stEdit); return; }
  if (ui.s2Voir){ s2ArticleDetail(v, ui.s2Voir); return; }
  var c = carteS2("Articles", "boite", lectureSeule() ? null : el("button", {class:"btn small", text:"+ Nouvel article", onclick:function(){ ui.stEdit = "+"; render(); }}));
  c.appendChild(s2Filtres());
  var L = stockLignes(), par = {}; L.forEach(function(l){ (par[l.ref] = par[l.ref] || []).push(l); });
  var refs = Object.keys(S.mat).map(function(r){ var sp = S.sp[r] || {}; return {ref:r, des:S.mat[r][0], cat:S.mat[r][1], u:S.mat[r][2], pr:propDe(r), empl:sp.empl || "", actif:stkActif(r)}; })
    .filter(s2Garde).sort(function(a, b){ return stkCats().indexOf(a.cat) - stkCats().indexOf(b.cat) || (a.des < b.des ? -1 : 1); });
  c.appendChild(el("p", {class:"mut s2-compte", text:refs.length + " article(s)"}));
  c.appendChild(refs.length ? tableS2([["Code"], ["Désignation"], ["Catégorie"], ["Propriétaire"], ["Unité"], ["Stock", "n"], ["Emplacement"], [""]], refs.map(function(a){
    var st = (par[a.ref] || []).reduce(function(s, l){ return s + l.phys; }, 0), sp = S.sp[a.ref] || {};
    var tr = el("tr", {class:a.actif ? "" : "inactif"}, tdS2(a.ref, "code"), tdS2(el("span", null, el("b", {text:a.des}), sp.sfam ? el("small", {text:sp.sfam}) : null)), tdS2(a.cat), tdS2(propBadge(a.pr)), tdS2(a.u), tdS2(qS2(a.ref, st), "n" + (st < 0 ? " neg" : "")), tdS2(a.empl || "—"),
      tdS2(el("span", {class:"s2-act"}, el("button", {class:"btn small sec", text:"Voir", onclick:function(){ ui.s2Voir = a.ref; render(); }}), lectureSeule() ? null : el("button", {class:"btn small sec", text:"Modifier", onclick:function(){ ui.stEdit = a.ref; render(); }}))));
    return tr;
  }), "s2-arts") : videS2("Aucun article ne correspond."));
  v.appendChild(c);
}
function s2ArticleDetail(v, ref){
  var a = art(ref), sp = S.sp[ref] || {}, L = stockLignes().filter(function(l){ return l.ref === ref; });
  var c = carteS2(a.des, "boite", el("span", {class:"s2-act"}, el("button", {class:"btn small sec", text:"← Articles", onclick:function(){ ui.s2Voir = null; render(); }}), lectureSeule() ? null : el("button", {class:"btn small", text:"Modifier", onclick:function(){ ui.s2Voir = null; ui.stEdit = ref; render(); }})));
  var info = [["Code", ref], ["Catégorie", a.fam + (sp.sfam ? " · " + sp.sfam : "")], ["Propriétaire", propDe(ref)], ["Unité", a.u], ["Fournisseur", sp.fourn], ["Réf. fournisseur", sp.refF], ["Emplacement", sp.empl],
    ["Stock minimum", sp.seuil ? qS2(ref, sp.seuil) : ""], ["Stock maximum", sp.smax ? qS2(ref, sp.smax) : ""], ["Prix d'achat", propDe(ref) === "TEK-TREND" && sp.prix ? fmt(sp.prix, 3) + " / " + a.u : ""]];
  var car = sp.car || {}; Object.keys(CAR_LIB).forEach(function(k){ if (car[k]) info.push([CAR_LIB[k], car[k]]); });
  c.appendChild(el("dl", {class:"s2-dl"}, info.filter(function(x){ return x[1]; }).map(function(x){ return el("div", null, el("dt", {text:x[0]}), el("dd", {text:String(x[1])})); })));
  c.appendChild(tableS2([["Propriétaire"], ["Physique", "n"], ["Réservé", "n"], ["Indisponible", "n"], ["Disponible", "n"], ["État"]], L.map(function(l){ var s = stkStatut(l); return el("tr", null, tdS2(propBadge(l.pr)), tdS2(qS2(ref, l.phys), "n"), tdS2(qS2(ref, l.res), "n"), tdS2(qS2(ref, l.ind), "n"), tdS2(qS2(ref, l.dispo), "n b"), tdS2(badgeS2(s[0], s[1]))); })));
  v.appendChild(c);
  var h = carteS2("Historique des mouvements", "horloge"), ms = mvListe().filter(function(m){ return m.ref === ref; }).sort(function(x, y){ return x.d < y.d ? 1 : x.d > y.d ? -1 : (y.ts || 0) - (x.ts || 0); });
  h.appendChild(ms.length ? mvTable(ms) : videS2("Aucun mouvement pour cet article."));
  v.appendChild(h);
}
var CAR_LIB = {compo:"Composition", coul:"Couleur", larg:"Largeur", gram:"Grammage", lotN:"N° de lot", type:"Type", dims:"Dimensions", emb:"Caractéristiques d'emballage"};
var CAR_PAR_CAT = {Tissu:["compo", "coul", "larg", "gram", "lotN"], Fil:["coul", "type"], Packaging:["type", "dims", "emb"]};
function s2Fiche(v, ref0){
  var neuf = ref0 === "+", m0 = neuf ? ["", "Accessoire", "pièce"] : (S.mat[ref0] || ["", "", ""]), sp0 = neuf ? {} : (S.sp[ref0] || {}), car0 = sp0.car || {};
  var nbMv = neuf ? 0 : mvListe().filter(function(m){ return m.ref === ref0; }).length;
  var c = carteS2(neuf ? "Nouvel article" : "Modifier l'article " + ref0, "boite");
  function champ(lbl, inp, aide){ return el("label", {class:"s2-ch"}, el("span", {text:lbl}), inp, aide ? el("small", {text:aide}) : null); }
  function liste(id, vals){ var d = el("datalist", {id:id}); vals.forEach(function(x){ d.appendChild(el("option", {value:x})); }); return d; }
  var iRef = el("input", {type:"text", value:neuf ? "" : ref0, placeholder:"ex. FIL-POLY-NOIR"}); if (!neuf) iRef.disabled = true;
  var iDes = el("input", {type:"text", value:m0[0]});
  var iCat = sel(stkCats().map(function(x){ return [x, x]; }), m0[1] || "Accessoire");
  var iSf = el("input", {type:"text", value:sp0.sfam || "", list:"s2-dl-sf"});
  var iProp = sel(PROPRIETAIRES.map(function(x){ return [x, x]; }), sp0.prop === "PERCKO" ? "PERCKO" : "TEK-TREND");
  var iU = el("input", {type:"text", value:m0[2], list:"s2-dl-u"}); if (nbMv){ iU.disabled = true; iU.title = "Unité figée : l'article a déjà des mouvements"; }
  var iRF = el("input", {type:"text", value:sp0.refF || ""}), iF = el("input", {type:"text", value:sp0.fourn || ""}), iCb = el("input", {type:"text", value:sp0.cb || "", placeholder:"facultatif"});
  var iMin = el("input", {type:"number", inputmode:"decimal", step:"0.01", value:sp0.seuil || ""}), iMax = el("input", {type:"number", inputmode:"decimal", step:"0.01", value:sp0.smax || "", placeholder:"facultatif"});
  var iE = el("input", {type:"text", value:sp0.empl || "", list:"s2-dl-e"}), iP = el("input", {type:"number", inputmode:"decimal", step:"0.001", value:sp0.prix || ""});
  var iAct = el("input", {type:"checkbox"}); iAct.checked = !sp0.inactif;
  var iDocs = el("input", {type:"text", value:sp0.docs || "", placeholder:"lien vers la fiche technique (facultatif)"});
  var gCar = el("div", {class:"s2-champs"}), iCar = {};
  function majCar(){ gCar.innerHTML = ""; (CAR_PAR_CAT[iCat.value] || []).forEach(function(k){ iCar[k] = iCar[k] || el("input", {type:"text", value:car0[k] || ""}); gCar.appendChild(champ(CAR_LIB[k], iCar[k])); }); gCar.hidden = !gCar.children.length; }
  iCat.addEventListener("change", majCar);
  function majPrix(){ wPrix.hidden = iProp.value !== "TEK-TREND"; }
  var wPrix = champ("Prix d'achat (par unité)", iP, "articles TEK-TREND seulement"); iProp.addEventListener("change", majPrix);
  c.appendChild(liste("s2-dl-sf", sortedUnique(Object.keys(S.sp).map(function(r){ return (S.sp[r] || {}).sfam; }).filter(Boolean)))); c.appendChild(liste("s2-dl-u", stkUnites())); c.appendChild(liste("s2-dl-e", stkEmps()));
  c.appendChild(el("h4", {class:"s2-sous", text:"Identification"}));
  c.appendChild(el("div", {class:"s2-champs"}, champ("Code article", iRef, neuf ? "majuscules, sans espace : le code ne change plus ensuite" : ""), champ("Désignation", iDes), champ("Catégorie", iCat, "liste dans Paramètres"), champ("Sous-catégorie", iSf), champ("Propriétaire", iProp, "PERCKO ou TEK-TREND ; chaque mouvement garde aussi le sien"), champ("Unité de mesure", iU, nbMv ? "figée : " + nbMv + " mouvement(s)" : "")));
  c.appendChild(el("h4", {class:"s2-sous", text:"Approvisionnement et stock"}));
  c.appendChild(el("div", {class:"s2-champs"}, champ("Fournisseur principal", iF), champ("Référence fournisseur", iRF), champ("Code-barres", iCb), champ("Stock minimum", iMin), champ("Stock maximum", iMax), champ("Emplacement principal", iE), wPrix));
  c.appendChild(el("h4", {class:"s2-sous", text:"Caractéristiques"})); c.appendChild(gCar);
  c.appendChild(el("div", {class:"s2-champs"}, champ("Documents / fiche technique", iDocs), el("label", {class:"s2-coche"}, iAct, el("span", {text:"Article actif"}))));
  majCar(); majPrix();
  c.appendChild(el("div", {class:"actions s2-pied-f"}, el("button", {class:"btn sec", text:"Annuler", onclick:function(){ ui.stEdit = null; render(); }}),
    el("button", {class:"btn", text:"✔ Enregistrer l'article", onclick:function(){
      commit(function(){
        var ref = neuf ? slugRef(iRef.value) : ref0;
        if (!ref) throw new Error("Code article obligatoire.");
        if (neuf && S.mat[ref]) throw new Error("Le code " + ref + " existe déjà.");
        var des = cleanTxt(iDes.value), u = cleanTxt(iU.value);
        if (!des) throw new Error("Désignation obligatoire."); if (!u) throw new Error("Unité obligatoire.");
        if (nbMv && u !== S.mat[ref][2]) throw new Error("Unité figée (mouvements existants).");
        var mn = numStk(iMin.value), mx = numStk(iMax.value); if (mx && mn && mx < mn) throw new Error("Le stock maximum est inférieur au minimum.");
        var car = {}; Object.keys(iCar).forEach(function(k){ if ((CAR_PAR_CAT[iCat.value] || []).indexOf(k) >= 0 && cleanTxt(iCar[k].value)) car[k] = cleanTxt(iCar[k].value); });
        /* on GARDE les autres réglages de l'article (familles produit, conditionnement, délai…) */
        var sp = JSON.parse(JSON.stringify(S.sp[ref] || {}));
        Object.assign(sp, {prop:iProp.value, sfam:cleanTxt(iSf.value), fourn:cleanTxt(iF.value), refF:cleanTxt(iRF.value), cb:cleanTxt(iCb.value), seuil:mn || 0, smax:mx || 0, empl:cleanTxt(iE.value),
          prix:iProp.value === "TEK-TREND" ? numStk(iP.value) || 0 : 0, car:car, docs:cleanTxt(iDocs.value), inactif:!iAct.checked});
        Object.keys(sp).forEach(function(k){ var x = sp[k]; if (!x || (Array.isArray(x) && !x.length) || (typeof x === "object" && !Array.isArray(x) && !Object.keys(x).length)) delete sp[k]; });
        if (JSON.stringify(sp) !== JSON.stringify(S.sp[ref] || {})) stkEcrire("sp", ref, Object.keys(sp).length ? sp : null);
        var old = S.mat[ref] || [], rec = [des, iCat.value, u]; if (old[3]) rec.push(old[3]);
        S.mat[ref] = rec; ui.stEdit = null; ui.s2Voir = ref;
      }, "Article enregistré");
    }})));
  v.appendChild(c);
}

/* ---------- 3. Stock actuel ---------- */
function s2Etat(v){
  var c = carteS2("Stock actuel", "boite");
  c.appendChild(s2Filtres());
  var f = ui.s2F || {}, sv = sel([["", "Tous les états"], ["alerte", "Alertes (minimum, rupture)"], ["dispo", "Disponibles"], ["zero", "Sans stock"]], f.st || "");
  sv.addEventListener("change", function(){ f.st = sv.value; ui.s2F = f; render(true); }); c.querySelector(".s2-filtres").appendChild(sv);
  var L = stockLignes().filter(function(l){ return l.actif && s2Garde(l) && (!f.st || (f.st === "alerte" ? (l.rupture || l.sousSeuil || l.dispo < 0) : f.st === "dispo" ? l.dispo > 0 : l.phys <= 0)); })
    .sort(function(a, b){ return stkCats().indexOf(a.cat) - stkCats().indexOf(b.cat) || (a.des < b.des ? -1 : 1) || (a.pr < b.pr ? -1 : 1); });
  c.appendChild(el("p", {class:"mut s2-compte", text:L.length + " ligne(s) · disponible = physique − réservé − indisponible"}));
  c.appendChild(L.length ? tableS2([["Article"], ["Catégorie"], ["Propriétaire"], ["Physique", "n"], ["Réservé", "n"], ["Indisponible", "n"], ["Disponible", "n"], ["Minimum", "n"], ["Emplacement"], ["État"]], L.map(function(l){
    var s = stkStatut(l);
    return el("tr", {class:s[1] === "bad" ? "alerte" : ""}, tdS2(el("button", {class:"s2-nom", onclick:function(){ ui.s2Voir = l.ref; stockAller2("art"); }}, el("b", {text:l.des}), el("small", {text:l.ref}))), tdS2(l.cat), tdS2(propBadge(l.pr)),
      tdS2(qS2(l.ref, l.phys), "n"), tdS2(l.res ? qS2(l.ref, l.res) : "—", "n"), tdS2(l.ind ? qS2(l.ref, l.ind) : "—", "n"), tdS2(qS2(l.ref, l.dispo), "n b" + (l.dispo < 0 ? " neg" : "")), tdS2(l.seuil ? qS2(l.ref, l.seuil) : "—", "n"), tdS2(l.empl || "—"), tdS2(badgeS2(s[0], s[1])));
  }), "s2-etat-t") : videS2("Aucun article ne correspond."));
  c.appendChild(el("p", {class:"mut s2-note", text:"Réservé = matières encore nécessaires aux commandes en cours (nomenclatures du suivi), comptées sur le propriétaire de l'article. Indisponible = en quarantaine."}));
  v.appendChild(c);
}
function stockAller2(sec){ var voir = ui.s2Voir; ui.stk = sec; ui.stEdit = null; ui.s2Form = null; ui.s2Voir = voir; render(); }

/* ---------- 4. Mouvements ---------- */
function mvTable(ms){
  return tableS2([["Date"], ["Type"], ["Article"], ["Propriétaire"], ["Quantité", "n"], ["Emplacement"], ["Commande / doc."], ["Motif"], ["Par"], [""]], ms.map(function(m){
    var e = mvEffet(m), cls = m.t === "T" || m.t === "Q" ? "info" : e > 0 ? "ok" : "bad", ann = mvAnnule(m.id);
    return el("tr", {class:ann || m.corr ? "annule" : ""}, tdS2(dmy(m.d) + (heureDe(m) ? " " + heureDe(m) : "")), tdS2(badgeS2(nomType(m), cls)), tdS2(el("span", null, el("b", {text:artNom(m.ref)}), el("small", {text:m.ref}))), tdS2(propBadge(mvProp(m))),
      tdS2((m.t === "T" || m.t === "Q" ? "" : e > 0 ? "+" : "") + qS2(m.ref, m.t === "T" || m.t === "Q" ? m.q : e), "n " + cls), tdS2(m.t === "T" ? (m.emp || "?") + " → " + (m.emp2 || "?") : (m.emp || "")),
      tdS2([m.lot, m.doc, m.mach ? "machine " + m.mach : ""].filter(Boolean).join(" · ")), tdS2([m.motif, m.com].filter(Boolean).join(" · ")), tdS2(m.u || ""),
      tdS2(ann || m.corr || lectureSeule() ? (ann ? badgeS2("annulé", "gris") : null) : confirmBtn("Annuler", "sec", function(){ commit(function(){ annulerMouvement(m.id, "annulation depuis Gestion de stock"); }, "Écriture corrective enregistrée"); })));
  }), "s2-mv");
}
function s2Mouvements(v){
  if (ui.s2Form){ s2Saisie(v, ui.s2Form); return; }
  var c = carteS2("Historique des mouvements", "horloge", lectureSeule() ? null : el("span", {class:"s2-act"},
    el("button", {class:"btn small", text:"+ Ajustement / correction", onclick:function(){ ui.s2Form = "A"; render(); }}),
    el("button", {class:"btn small sec", text:"Transfert", onclick:function(){ ui.s2Form = "T"; render(); }}),
    el("button", {class:"btn small sec", text:"Quarantaine", onclick:function(){ ui.s2Form = "Q"; render(); }}),
    el("button", {class:"btn small sec", text:"Retour de production", onclick:function(){ ui.s2Form = "R"; render(); }})));
  var f = ui.s2F || (ui.s2F = {});
  c.appendChild(s2Filtres({emp:false}));
  var row = c.querySelector(".s2-filtres"), st = sel([["", "Tous les types"]].concat(Object.keys(STK_TYPES_N).map(function(k){ return [k, STK_TYPES_N[k]]; })), f.t || "");
  st.addEventListener("change", function(){ f.t = st.value; render(true); }); row.appendChild(st);
  var du = el("input", {type:"date", value:f.du || "", title:"Du"}), au = el("input", {type:"date", value:f.au || "", title:"Au"});
  du.addEventListener("change", function(){ f.du = du.value; render(true); }); au.addEventListener("change", function(){ f.au = au.value; render(true); }); row.appendChild(du); row.appendChild(au);
  var q = slugRef(f.q || "").toLowerCase();
  var ms = mvListe().filter(function(m){ return (!f.t || m.t === f.t) && (!f.pr || mvProp(m) === f.pr) && (!f.cat || art(m.ref).fam === f.cat) && (!f.du || m.d >= f.du) && (!f.au || m.d <= f.au)
    && (!q || slugRef(m.ref + " " + artNom(m.ref) + " " + (m.lot || "") + " " + (m.doc || "")).toLowerCase().indexOf(q) >= 0); })
    .sort(function(a, b){ return a.d < b.d ? 1 : a.d > b.d ? -1 : (b.ts || 0) - (a.ts || 0); });
  c.appendChild(el("p", {class:"mut s2-compte", text:ms.length + " mouvement(s)" + (ms.length > 300 ? " · 300 premiers affichés" : "")}));
  c.appendChild(ms.length ? mvTable(ms.slice(0, 300)) : videS2("Aucun mouvement ne correspond."));
  c.appendChild(el("p", {class:"mut s2-note", text:"Un mouvement validé ne s'efface jamais : « Annuler » ajoute une écriture inverse, visible ici avec son auteur."}));
  v.appendChild(c);
}

/* ---------- saisie d'un mouvement (entrée, sortie, retour, rebut, ajustement, transfert, quarantaine) ---------- */
var S2_TITRES = {E:"Réception de matières", S:"Sortie de stock", R:"Retour de production", P:"Mise au rebut", A:"Ajustement, correction ou régularisation", T:"Transfert entre emplacements", Q:"Quarantaine (stock indisponible)"};
function s2Saisie(v, t){
  var c = carteS2(S2_TITRES[t], "doc", el("button", {class:"btn small sec", text:"Fermer", onclick:function(){ ui.s2Form = null; render(); }}));
  if (lectureSeule()){ c.appendChild(videS2("Lecture seule.")); v.appendChild(c); return; }
  function champ(lbl, inp, aide){ return el("label", {class:"s2-ch"}, el("span", {text:lbl}), inp, aide ? el("small", {text:aide}) : null); }
  var refs = Object.keys(S.mat).filter(stkActif).sort(function(a, b){ return S.mat[a][0] < S.mat[b][0] ? -1 : 1; });
  var dl = el("datalist", {id:"s2-dl-art"}); refs.forEach(function(r){ dl.appendChild(el("option", {value:r + " — " + S.mat[r][0]})); }); c.appendChild(dl);
  var iArt = el("input", {type:"text", list:"s2-dl-art", placeholder:"code, désignation ou code-barres"});
  var iPr = sel(PROPRIETAIRES.map(function(x){ return [x, x]; }), "TEK-TREND"), iQ = el("input", {type:"number", inputmode:"decimal", step:"0.01", placeholder:t === "A" || t === "Q" ? "+ ajoute, − retire" : ""});
  var maintenant = new Date(), iD = el("input", {type:"date", value:today()}), iH = el("input", {type:"time", value:String(maintenant.getHours()).padStart(2, "0") + ":" + String(maintenant.getMinutes()).padStart(2, "0")});
  var emps = stkEmps(); var dle = el("datalist", {id:"s2-dl-emp"}); emps.forEach(function(x){ dle.appendChild(el("option", {value:x})); }); c.appendChild(dle);
  var iEmp = el("input", {type:"text", list:"s2-dl-emp"}), iEmp2 = el("input", {type:"text", list:"s2-dl-emp"});
  var iSt = STK_ST[t] ? sel(STK_ST[t], STK_ST[t][0][0]) : null, iMotif = el("input", {type:"text", placeholder:t === "A" || t === "P" || t === "Q" ? "obligatoire" : "facultatif"});
  var lots = lotsValides ? lotsValides() : [], iLot = sel([["", "—"]].concat(lots.slice().reverse().map(function(l){ return [l, l]; })), "");
  var M = machinesTek(), iMach = sel([["", "—"]].concat(M.liste.map(function(m){ return [m.id, m.nom + (m.serie ? " (" + m.serie + ")" : "")]; })), "");
  var iDoc = el("input", {type:"text", placeholder:t === "E" ? "bon de livraison, facture…" : "facultatif"}), iCom = el("input", {type:"text", placeholder:"facultatif"});
  var iForce = el("input", {type:"checkbox"}), info = el("p", {class:"s2-info"});
  function refChoisie(){ var x = cleanTxt(iArt.value).split(" — ")[0], up = x.toUpperCase(); if (S.mat[x]) return x; if (S.mat[up]) return up; var cb = refs.filter(function(r){ return (S.sp[r] || {}).cb === x; })[0]; return cb || ""; }
  function majInfo(){
    var ref = refChoisie(); info.textContent = ""; if (!ref) return;
    if (!iArt.dataset.fait || iArt.dataset.fait !== ref){ iArt.dataset.fait = ref; iPr.value = propDe(ref); if (!iEmp.value) iEmp.value = (S.sp[ref] || {}).empl || ""; }
    var l = stockLignes().filter(function(x){ return x.ref === ref && x.pr === iPr.value; })[0];
    info.textContent = artNom(ref) + " · " + iPr.value + " : physique " + qS2(ref, l ? l.phys : 0) + " · disponible " + qS2(ref, l ? l.dispo : 0) + " · unité " + artUnite(ref);
  }
  iArt.addEventListener("input", majInfo); iArt.addEventListener("change", majInfo); iPr.addEventListener("change", majInfo);
  var g = el("div", {class:"s2-champs"}, champ("Article", iArt), champ("Propriétaire", iPr), champ(t === "A" || t === "Q" ? "Quantité (+ / −)" : "Quantité", iQ), champ("Date", iD), champ("Heure", iH));
  if (iSt) g.appendChild(champ(t === "A" ? "Nature" : "Type", iSt));
  if (t === "T"){ g.appendChild(champ("De l'emplacement", iEmp)); g.appendChild(champ("Vers l'emplacement", iEmp2)); } else g.appendChild(champ("Emplacement", iEmp));
  if (t === "S" || t === "R" || t === "P") g.appendChild(champ("Commande (OF)", iLot, "si la matière va à une commande"));
  if (t === "S" || t === "P") g.appendChild(champ("Machine", iMach, "pièce de rechange, maintenance"));
  g.appendChild(champ("Motif", iMotif)); g.appendChild(champ("Document", iDoc)); g.appendChild(champ("Commentaire", iCom));
  c.appendChild(g); c.appendChild(info);
  if (t === "S" || t === "P") c.appendChild(el("label", {class:"s2-coche"}, iForce, el("span", {text:"Autoriser même si le stock disponible est insuffisant (réception pas encore saisie)"})));
  var jeton = ui.s2Jeton || (ui.s2Jeton = nid("K"));
  c.appendChild(el("div", {class:"actions s2-pied-f"}, el("button", {class:"btn sec", text:"Annuler", onclick:function(){ ui.s2Form = null; ui.s2Jeton = null; render(); }}),
    el("button", {class:"btn", text:"Vérifier et valider", onclick:function(){
      var ref = refChoisie(), q = r2(numStk(iQ.value)), sub = iSt ? iSt.value : "", pr = iPr.value, err = "";
      if (!ref) err = "Choisissez un article de la liste.";
      else if (!q) err = "Saisissez une quantité.";
      else if (t !== "A" && t !== "Q" && q < 0) err = "Quantité positive : pour corriger, utilisez un ajustement.";
      else if ((t === "A" || t === "P" || t === "Q" || sub === "autre") && !cleanTxt(iMotif.value)) err = "Motif obligatoire pour ce mouvement.";
      else if (t === "T" && (!cleanTxt(iEmp.value) || !cleanTxt(iEmp2.value) || cleanTxt(iEmp.value) === cleanTxt(iEmp2.value))) err = "Indiquez deux emplacements différents.";
      else if (sub === "maintenance" && !iMach.value) err = "Choisissez la machine.";
      if (err){ toast(err); return; }
      var l = stockLignes().filter(function(x){ return x.ref === ref && x.pr === pr; })[0] || {phys:0, dispo:0, ind:0};
      if ((t === "S" || t === "P") && !iForce.checked && q > l.dispo + 1e-9){ toast("Stock disponible insuffisant (" + qS2(ref, l.dispo) + "). Cochez « autoriser » si nécessaire."); return; }
      if (t === "A" && q < 0 && -q > l.phys + 1e-9){ toast("L'ajustement rendrait le stock négatif (" + qS2(ref, l.phys) + ")."); return; }
      if (t === "Q" && q > 0 && q > l.phys - l.ind + 1e-9){ toast("Quantité supérieure au stock non encore en quarantaine."); return; }
      if (t === "Q" && q < 0 && -q > l.ind + 1e-9){ toast("Quantité supérieure au stock en quarantaine (" + qS2(ref, l.ind) + ")."); return; }
      var rec = {id:jeton + "-0", d:iD.value || today(), h:iH.value || "", t:t, ref:ref, q:q, pr:pr, emp:cleanTxt(iEmp.value), st:sub, motif:cleanTxt(iMotif.value), lot:(t === "S" || t === "R" || t === "P") ? iLot.value : "", mach:iMach.value || "", doc:cleanTxt(iDoc.value), com:cleanTxt(iCom.value), u:utilisateur(), ts:Date.now()};
      if (t === "T") rec.emp2 = cleanTxt(iEmp2.value);
      Object.keys(rec).forEach(function(k){ if (rec[k] === "") delete rec[k]; });
      s2Confirmer(rec, function(){
        commit(function(){ if (S.mv[rec.id]) throw new Error("Déjà enregistré."); stkEcrire("mv", rec.id, rec); ui.s2Form = null; ui.s2Jeton = null; }, "Mouvement enregistré");
      });
    }})));
  v.appendChild(c);
  if (ui.s2Pref){ iArt.value = ui.s2Pref + " — " + artNom(ui.s2Pref); ui.s2Pref = null; majInfo(); }
}
/* confirmation avant validation (récapitulatif) */
function s2Confirmer(rec, ok){
  var o = el("div", {class:"s2-modale", role:"dialog"}), b = el("div", {class:"s2-modale-b"});
  var lignes = [["Mouvement", nomType(rec)], ["Article", artNom(rec.ref) + " (" + rec.ref + ")"], ["Propriétaire", rec.pr], ["Quantité", qS2(rec.ref, rec.q)], ["Date", dmy(rec.d) + (rec.h ? " " + rec.h : "")],
    ["Emplacement", rec.t === "T" ? rec.emp + " → " + rec.emp2 : rec.emp], ["Commande", rec.lot], ["Machine", rec.mach], ["Motif", rec.motif], ["Document", rec.doc]].filter(function(x){ return x[1]; });
  b.appendChild(el("h3", {text:"Confirmer le mouvement"}));
  b.appendChild(el("dl", {class:"s2-dl"}, lignes.map(function(x){ return el("div", null, el("dt", {text:x[0]}), el("dd", {text:x[1]})); })));
  b.appendChild(el("p", {class:"mut", text:"Un mouvement validé ne peut plus être modifié : une erreur se corrige par une écriture inverse."}));
  var fermer = function(){ o.remove(); };
  b.appendChild(el("div", {class:"actions"}, el("button", {class:"btn sec", text:"Retour", onclick:fermer}), el("button", {class:"btn", text:"✔ Confirmer", onclick:function(e){ e.target.disabled = true; fermer(); ok(); }})));
  o.appendChild(b); o.addEventListener("click", function(e){ if (e.target === o) fermer(); }); document.body.appendChild(o);
}

/* ---------- 5. Réceptions · 6. Sorties ---------- */
function s2Receptions(v){
  if (ui.s2Form){ s2Saisie(v, ui.s2Form); return; }
  var c = carteS2("Réceptions", "doc", lectureSeule() ? null : el("button", {class:"btn small", text:"+ Réception libre", onclick:function(){ ui.s2Form = "E"; render(); }}));
  var rec = mvListe().filter(function(m){ return m.t === "E"; }).sort(function(a, b){ return a.d < b.d ? 1 : a.d > b.d ? -1 : (b.ts || 0) - (a.ts || 0); }).slice(0, 12);
  c.appendChild(el("p", {class:"mut", text:"Réception libre : matières fournies par PERCKO, achats sans commande, consommables. Réception d'une commande fournisseur (même partielle) : ci-dessous."}));
  c.appendChild(rec.length ? mvTable(rec) : videS2("Aucune réception."));
  v.appendChild(c);
  var E = etatStock(), z = el("div", {class:"s2-ancien"}); stkEntrees(z, E); stkAchats(z, E); v.appendChild(z);
}
function s2Sorties(v){
  if (ui.s2Form){ s2Saisie(v, ui.s2Form); return; }
  var c = carteS2("Sorties", "doc", lectureSeule() ? null : el("span", {class:"s2-act"}, el("button", {class:"btn small", text:"+ Sortie (production, maintenance, autre)", onclick:function(){ ui.s2Form = "S"; render(); }}), el("button", {class:"btn small sec", text:"Mise au rebut", onclick:function(){ ui.s2Form = "P"; render(); }})));
  var rec = mvListe().filter(function(m){ return m.t === "S" || m.t === "P"; }).sort(function(a, b){ return a.d < b.d ? 1 : a.d > b.d ? -1 : (b.ts || 0) - (a.ts || 0); }).slice(0, 12);
  c.appendChild(el("p", {class:"mut", text:"Sortie vers une commande, par étape (coupe, assemblage, confection, emballage) avec les besoins de la nomenclature : ci-dessous."}));
  c.appendChild(rec.length ? mvTable(rec) : videS2("Aucune sortie."));
  v.appendChild(c);
  var E = etatStock(), z = el("div", {class:"s2-ancien"}); stkSorties(z, E); v.appendChild(z);
}

/* ---------- 8. Stock production (besoins par commande) ---------- */
function s2Production(v){
  var E = etatStock(), lots = E.cmd;
  var c = carteS2("Besoins en matières par commande", "doc");
  if (!lots.length){ c.appendChild(videS2("Aucune commande en cours.")); v.appendChild(c); return; }
  var lot = ui.s2Lot && lots.some(function(x){ return x.lot === ui.s2Lot; }) ? ui.s2Lot : lots[0].lot, s = sel(lots.map(function(x){ return [x.lot, x.lot + (x.ok ? " · matières disponibles" : " · " + x.manque.length + " manquante(s)")]; }), lot);
  s.addEventListener("change", function(){ ui.s2Lot = s.value; render(true); });
  c.appendChild(el("div", {class:"s2-filtres"}, s));
  c.appendChild(el("div", {class:"s2-cmd-etat"}, lots.map(function(x){ return el("button", {class:"s2-pill " + (x.ok ? "ok" : "bad") + (x.lot === lot ? " on" : ""), text:x.lot + (x.ok ? " ✓" : " · " + x.manque.length + " manque"), onclick:function(){ ui.s2Lot = x.lot; render(true); }}); })));
  var b = besoinsMatieres(lot), so = sortiesLot(lot), phys = physiques(), man = {}; ((lots.filter(function(x){ return x.lot === lot; })[0] || {}).manque || []).forEach(function(m){ man[m.ref] = m.q; });
  var refs = Object.keys(b).sort(function(a, c2){ return artNom(a) < artNom(c2) ? -1 : 1; });
  c.appendChild(refs.length ? tableS2([["Matière"], ["Propriétaire"], ["Besoin théorique", "n"], ["Déjà sorti", "n"], ["Reste à sortir (réservé)", "n"], ["Stock physique", "n"], ["Manquant", "n"]], refs.map(function(r){
    var bt = r2(b[r].tot), sr = r2((so[r] || {}).tot || 0), rs = r2(Math.max(0, bt - sr));
    return el("tr", {class:man[r] ? "alerte" : ""}, tdS2(el("span", null, el("b", {text:artNom(r)}), el("small", {text:r}))), tdS2(propBadge(propDe(r))), tdS2(qS2(r, bt), "n"), tdS2(qS2(r, sr), "n"), tdS2(qS2(r, rs), "n"), tdS2(qS2(r, phys[r] || 0), "n"), tdS2(man[r] ? qS2(r, man[r]) : "—", "n" + (man[r] ? " neg b" : "")));
  }), "s2-prod") : videS2("Pas de nomenclature de matières pour cette commande."));
  c.appendChild(el("p", {class:"mut s2-note", text:"Besoin théorique = nomenclature × quantités de la commande ; les commandes sont servies dans l'ordre de livraison. Les sorties se saisissent dans Sorties (par étape)."}));
  v.appendChild(c);
  var h = carteS2("Historique des consommations · " + lot, "horloge"), ms = mvListe().filter(function(m){ return m.lot === lot; }).sort(function(x, y){ return x.d < y.d ? 1 : -1; });
  h.appendChild(ms.length ? mvTable(ms) : videS2("Aucune sortie ni retour pour cette commande."));
  v.appendChild(h);
}

/* ---------- 9. Machines · 7. Inventaires · 10. Maintenance (étapes suivantes) ---------- */
function s2Machines(v){
  var M = machinesTek(), c = carteS2("Machines et matériels", "cle");
  var NOMS = {service:["En service", "ok"], maintenance:["En maintenance", "warn"], panne:["En panne", "bad"], hors:["Hors service", "gris"]};
  c.appendChild(M.liste.length ? tableS2([["Machine"], ["Type"], ["Marque"], ["N° de série"], ["État"]], M.liste.map(function(m){ return el("tr", null, tdS2(m.nom), tdS2(m.type), tdS2(m.marque), tdS2(m.serie || "—"), tdS2(badgeS2(NOMS[m.etat][0], NOMS[m.etat][1]))); })) : videS2("Aucune machine enregistrée pour TEK-TREND."));
  c.appendChild(etapeSuivante("Étape 7 du module", ["Fiche équipement complète : code, catégorie, modèle, date et prix d'achat, fournisseur, emplacement, responsable, documents.", "États : en service, en panne, en maintenance, hors service, réformé.", "Sorties de pièces de rechange liées à une machine : déjà possibles dans Sorties (type Maintenance)."]));
  v.appendChild(c);
}
function etapeSuivante(t, l){ return el("div", {class:"s2-suite"}, el("b", {text:t + " · prévu"}), el("ul", null, l.map(function(x){ return el("li", {text:x}); }))); }
function s2Inventaires(v){
  var c = carteS2("Inventaires", "doc");
  c.appendChild(el("p", {class:"mut", text:"En attendant, un écart constaté se corrige par un ajustement d'inventaire (Mouvements › Ajustement), avec son motif."}));
  c.appendChild(etapeSuivante("Étape 5 du module", ["Inventaire général, par catégorie, propriétaire, emplacement ou article.", "Saisie des quantités comptées, comparaison avec le stock théorique, écarts calculés.", "Validation par un responsable, régularisation automatique des écarts, historique des inventaires."]));
  v.appendChild(c);
}
function s2Maintenance(v){
  var c = carteS2("Maintenance", "cle");
  c.appendChild(etapeSuivante("Étape 8 du module", ["Maintenance préventive et corrective, dates de dernière et prochaine intervention.", "Coût de réparation, pièces de rechange utilisées (sorties de stock liées à la machine).", "Historique des pannes (déjà suivies dans les arrêts machines) et des interventions."]));
  v.appendChild(c);
}

/* ---------- 11. Rapports et exports (Excel, PDF : bibliothèques déjà présentes) ---------- */
function grilleS2(titre, heads, rows, larg){
  var g = {cols:larg || heads.map(function(){ return 16; }), rows:[], merges:[]}, H = {b:1, bg:"1F3864", fg:"FFFFFF", al:"c", bd:"t", wrap:1};
  gset(g, 0, 0, "TEK-TREND · " + titre, {b:1, sz:13}); gset(g, 1, 0, "Édité le " + dmyL(today()), {sz:9});
  heads.forEach(function(h, i){ gset(g, 3, i, h, H); });
  rows.forEach(function(r, j){ r.forEach(function(x, i){ gset(g, 4 + j, i, x, {bd:"t", al:typeof x === "number" ? "r" : "l"}); }); });
  return g;
}
function rapportsS2(){
  var L = stockLignes().filter(function(l){ return l.actif; }), ms = mvListe().slice().sort(function(a, b){ return a.d < b.d ? -1 : 1; });
  var ligne = function(l){ return [l.ref, l.des, l.cat, l.pr, l.u, l.phys, l.res, l.ind, l.dispo, l.seuil || "", l.empl, stkStatut(l)[0]]; };
  var hE = ["Code", "Désignation", "Catégorie", "Propriétaire", "Unité", "Physique", "Réservé", "Indisponible", "Disponible", "Minimum", "Emplacement", "État"], lE = [14, 34, 14, 13, 8, 11, 11, 11, 11, 10, 14, 16];
  return [
    ["etat", "État actuel du stock", function(){ return grilleS2("État actuel du stock", hE, L.map(ligne), lE); }],
    ["percko", "Matières appartenant à PERCKO", function(){ return grilleS2("Matières PERCKO", hE, L.filter(function(l){ return l.pr === "PERCKO"; }).map(ligne), lE); }],
    ["min", "Articles sous le stock minimum", function(){ return grilleS2("Articles sous le minimum ou en rupture", hE, L.filter(function(l){ return l.rupture || l.sousSeuil || l.dispo < 0; }).map(ligne), lE); }],
    ["valo", "Valorisation du stock TEK-TREND", function(){ var t = 0, R = L.filter(function(l){ return l.pr === "TEK-TREND"; }).map(function(l){ var v2 = r2(Math.max(0, l.phys) * l.prix); t += v2; return [l.ref, l.des, l.cat, l.u, l.phys, l.prix || "", v2]; }); R.push(["", "TOTAL", "", "", "", "", r2(t)]); return grilleS2("Valorisation du stock TEK-TREND", ["Code", "Désignation", "Catégorie", "Unité", "Quantité", "Prix d'achat", "Valeur"], R, [14, 34, 14, 8, 12, 12, 14]); }],
    ["mv", "Historique des mouvements", function(){ return grilleS2("Historique des mouvements", ["Date", "Heure", "Type", "Code", "Article", "Propriétaire", "Quantité", "Unité", "Emplacement", "Commande", "Motif", "Document", "Par"], ms.map(function(m){ var e = mvEffet(m); return [dmyL(m.d), heureDe(m), nomType(m), m.ref, artNom(m.ref), mvProp(m), m.t === "T" || m.t === "Q" ? m.q : e, artUnite(m.ref), m.t === "T" ? (m.emp || "") + " → " + (m.emp2 || "") : m.emp || "", m.lot || "", m.motif || "", m.doc || "", m.u || ""]; }), [11, 7, 22, 14, 30, 12, 10, 8, 16, 12, 22, 14, 14]); }],
    ["of", "Consommation par commande (OF)", function(){ var R = []; etatStock().cmd.forEach(function(x){ var b = besoinsMatieres(x.lot), so = sortiesLot(x.lot); Object.keys(b).forEach(function(r){ var sr = r2((so[r] || {}).tot || 0); R.push([x.lot, r, artNom(r), artUnite(r), r2(b[r].tot), sr, r2(Math.max(0, b[r].tot - sr))]); }); }); return grilleS2("Consommation par commande", ["Commande", "Code", "Matière", "Unité", "Besoin théorique", "Sorti", "Reste"], R, [14, 14, 32, 8, 14, 12, 12]); }]
  ];
}
function s2Rapports(v){
  var c = carteS2("Rapports et exports", "doc");
  c.appendChild(el("div", {class:"s2-rapports"}, rapportsS2().map(function(r){
    return el("div", {class:"s2-rap"}, el("b", {text:r[1]}), el("span", {class:"s2-act"},
      el("button", {class:"btn small", text:"Excel", onclick:function(){ try { saveFile("Stock_" + r[0] + "_" + today() + ".xlsx", xlsxBuild([{name:r[1].slice(0, 30), grid:r[2](), first:4}])); } catch (e) { toast(e.message); } }}),
      el("button", {class:"btn small sec", text:"PDF", onclick:function(){ try { saveFile("Stock_" + r[0] + "_" + today() + ".pdf", pdfBuild([r[2]()])); } catch (e) { toast(e.message); } }})));
  })));
  v.appendChild(c);
}

/* ---------- 12. Paramètres ---------- */
function s2Parametres(v){
  var c = carteS2("Paramètres du stock", "cle"), cfg = JSON.parse(JSON.stringify(scfg()));
  function bloc(titre, cle, def, aide){
    var vals = (cfg[cle] && cfg[cle].length ? cfg[cle] : def).slice(), ta = el("textarea", {rows:"5"}); ta.value = vals.join("\n");
    return el("label", {class:"s2-ch"}, el("span", {text:titre}), ta, el("small", {text:aide}));
  }
  var bC = bloc("Catégories ajoutées", "cats", STK_CATS_DEF, "une par ligne ; Tissu, Colle, Accessoire et Packaging existent toujours"), bU = bloc("Unités ajoutées", "unites", [], "une par ligne, en plus de : " + STK_UNITES.join(", ")), bE = bloc("Emplacements", "emps", [], "une par ligne (ex. Magasin A, Rayon 2, Atelier coupe)");
  c.appendChild(el("div", {class:"s2-champs"}, bC, bU, bE));
  if (!lectureSeule()) c.appendChild(el("div", {class:"actions s2-pied-f"}, el("button", {class:"btn", text:"✔ Enregistrer les paramètres", onclick:function(){
    var lire = function(b){ return sortedUniqueKeep(b.querySelector("textarea").value.split(/\n/).map(cleanTxt).filter(Boolean)); };
    commit(function(){ stkEcrireCfg({cats:lire(bC), unites:lire(bU), emps:lire(bE), maj:today(), u:utilisateur()}); }, "Paramètres enregistrés");
  }})));
  v.appendChild(c);
}
