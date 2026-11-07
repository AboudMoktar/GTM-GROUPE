/* =====================================================================
   SUIVI PERCKO — ONGLET « DOCUMENTS »
   ---------------------------------------------------------------------
   Tous les documents de la commande choisie, au même endroit, chacun avec :
   👁 Aperçu (vue à imprimer depuis le navigateur), 📕 PDF, 📗 Excel.
   Format A4, pleine page, en portrait ou en paysage selon le document.
   Groupes : commande, fiches de consommation, suivi, exports de la commande, stock.
   Vue GADH : fiche d'assemblage, rapport et pilotage seulement.
   Les documents eux-mêmes sont fabriqués par les autres modules (mêmes fichiers
   qu'ailleurs dans l'application) ; cet onglet ne fait que les rassembler.
   Chargé avant le script principal du suivi : n'utilise ses fonctions qu'à l'affichage.
   ===================================================================== */
(function(){
'use strict';
var CSS = [
  '.dc-head{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}',
  '.dc-grp{margin:0 0 14px}.dc-grp h2{display:flex;align-items:center;gap:8px;margin:0 0 8px}.dc-grp h2 small{font-size:12.5px;color:var(--mut);font-weight:600}',
  '.dc-l{display:grid;gap:8px}',
  '.dc-d{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--card)}',
  '.dc-n{font-size:15.5px;font-weight:800}.dc-s{font-size:12.5px;color:var(--mut)}.dc-f{display:inline-block;margin-left:6px;font-size:11px;font-weight:800;color:#1d4f91;background:#e7f1ff;border-radius:99px;padding:1px 8px;vertical-align:middle}',
  '.dc-b{display:flex;flex-wrap:wrap;gap:6px}'
].join('\n');
function poserCss(){ if (document.getElementById('dc-css')) return; var st = document.createElement('style'); st.id = 'dc-css'; st.textContent = CSS; document.head.appendChild(st); }
function X(){ return window.pkExports || {}; }
function jour(){ return today().replace(/-/g, ""); }

/* ---------- actions communes ---------- */
/* d = {t, s, o:"portrait"|"landscape", nom, grilles:function → [{name, grid}], apercu?, pdf?, excel?} */
function apercu(d){
  if (d.apercu) return d.apercu();
  var gs = d.grilles(); if (!gs.length){ toast(d.vide || "Rien à afficher."); return; }
  var h = X().GRL_CSS + gs.map(function(x, i){ return '<div' + (i ? ' class="grl-saut"' : '') + '>' + X().grilleHtml(x.grid) + '</div>'; }).join("");
  imprimerDoc(h, "A4 " + d.o, "8mm", d.nom);
}
function pdf(d){
  if (d.pdf) return d.pdf();
  var gs = d.grilles(); if (!gs.length){ toast("Rien à exporter."); return; }
  saveFile(d.nom + ".pdf", pdfBuild(gs.map(function(x){ x.grid.plein = true; x.grid.landscape = d.o === "landscape"; return x.grid; })));
}
function excel(d){
  if (d.excel) return d.excel();
  var gs = d.grilles(); if (!gs.length){ toast("Rien à exporter."); return; }
  saveFile(d.nom + ".xlsx", xlsxBuild(gs.map(function(x, i){ x.grid.landscape = d.o === "landscape"; var f = {name:x.name, grid:x.grid, first:i === 0}; if (x.image){ f.image = x.image; f.anchors = x.anchors; } return f; })));
}

/* ---------- liste des documents ---------- */
function groupes(lot){
  var G = VUE === "gadh", out = [];
  var lignes = S.lines.filter(function(l){ return l.lot === lot; }), annee = (lignes[0] || {}).year || "";
  var clients = sortedUnique(lignes.map(function(l){ return l.client; }));
  if (!G){
    out.push({t:"📋 Commande", docs:[
      {t:"Fiche de commande", s:"Model, LIBELLE, Taille, Quantité, Total" + (clients.length > 1 ? " — une page par client (" + clients.join(", ") + ")" : ""), o:"portrait", nom:nomFichier("Commande_" + lot),
        grilles:function(){ return clients.map(function(c){ return {name:"COMMANDE " + c, grid:commandeGrid(lot, annee, c)}; }); }},
      {t:"État de commande", s:"Par client, total, exporté (une colonne par export), reste", o:"portrait", nom:nomFichier("Etat_commande_" + lot + "_" + jour()),
        grilles:function(){ return X().etatCommandeGrid ? [{name:"Etat " + lot, grid:X().etatCommandeGrid(null, lot)}] : []; }}
    ]});
    out.push({t:"🧵 Fiches de consommation", docs:[
      {t:"Fiche de coupe (PROGES)", s:"Quantités à couper et consommation de tissu", o:"landscape", nom:nomFichier("Consommation_PROGES_" + lot + "_" + jour()),
        grilles:function(){ return [{name:"PROGES", grid:ficheGrid(lot, "*", "c", true)}]; }},
      {t:"Fiche d'assemblage (GADH)", s:"Quantités et tissus pour l'assemblage", o:"landscape", nom:nomFichier("Consommation_GADH_" + lot + "_" + jour()),
        grilles:function(){ return [{name:"GADH", grid:ficheGrid(lot, "*", "a", true)}]; }},
      {t:"Consommation de toute la commande", s:"Tissus, colles et accessoires : théorique et réel", o:"landscape", nom:nomFichier("Consommation_COMMANDE_" + lot + "_" + jour()),
        grilles:function(){ return [{name:"COMMANDE", grid:ficheCommandeGrid(lot)}]; }}
    ]});
  } else {
    out.push({t:"🧵 Fiche", docs:[
      {t:"Fiche d'assemblage (GADH)", s:"Quantités et tissus pour l'assemblage", o:"landscape", nom:nomFichier("Consommation_GADH_" + lot + "_" + jour()),
        grilles:function(){ return [{name:"GADH", grid:ficheGrid(lot, "*", "a", true)}]; }}
    ]});
  }
  var P = window.pkPilotage;
  out.push({t:"📈 Suivi", docs:[
    {t:"Rapport de commande", s:"Avancement par étape, puis étapes, dates et non-conformités", o:"landscape", nom:nomFichier("Rapport_" + lot + "_" + jour()),
      grilles:function(){ return fluxSheets(lot); }},
    P && P.docPilotage ? {t:"Pilotage de la commande", s:"Tableau par modèle et taille, sous-totaux, total, récapitulatif", o:"landscape", nom:"",
      apercu:function(){ P.docPilotage(lot, "print"); }, pdf:function(){ P.docPilotage(lot, "pdf"); }, excel:function(){ P.docPilotage(lot, "xlsx"); }} : null
  ].filter(Boolean)});
  /* exports qui contiennent cette commande */
  if (!G && X().imprimerX){
    var exs = (S.exports || []).filter(function(e){ return e.cartons.some(function(c){ return c.it.some(function(y){ var l = y[0] ? lineById(y[0]) : null; return (l ? l.lot : y[2]) === lot; }); }); })
      .sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : a.n - b.n; });
    exs.forEach(function(e){
      var titre = "🚚 Export N°" + e.n + " du " + dmyL(e.d) + " · " + (e.nat || e.cl) + (e.st === "fini" ? " · expédié" : " · en cours");
      function d(quoi, t, s, o){ return {t:t, s:s, o:o, apercu:function(){ X().imprimerX(e, quoi); }, pdf:function(){ X().pdfDoc(e, quoi); }, excel:function(){ X().excelDoc(e, quoi); }}; }
      out.push({t:titre, docs:[
        d("fiches", "Fiches cartons", "Une fiche par carton, avec le logo", "landscape"),
        d("colis", "Liste de colisage", "Commande de chaque ligne, total, nombre de colis, poids", "landscape"),
        d("total", "Liste total", "Au format de la commande, une page par commande, récapitulatif", "portrait"),
        d("etat", "État des commandes", "Au format de la commande : par client, total, exporté, reste", "portrait")
      ]});
    });
  }
  if (!G){
    out.push({t:"📦 Stock", stock:true, docs:[
      {t:"État de stock PERCKO", s:"Articles PERCKO et articles visibles par le client, par famille", o:"portrait", vide:"Aucun article à inclure (voir Stock › Affectation).", nom:nomFichier("Etat_stock_PERCKO_" + jour()),
        grilles:function(){ var g = ficheClientGridUnique(etatStock(), true); return g ? [{name:"État PERCKO", grid:g}] : []; },
        pdf:function(){ exportFicheClientPerckoPdf(); }, excel:function(){ exportFicheClientPercko(); }},
      {t:"Fiche de stock TEK-TREND", s:"Tous les articles, par famille", o:"landscape", nom:nomFichier("Fiche_stock_TEK-TREND_" + jour()),
        grilles:function(){ return fichesStock(etatStock()).map(function(x){ return {name:FAM_PLUR[x.f] || x.f, grid:x.grid}; }); },
        pdf:function(){ exportStockPdf(); }, excel:function(){ exportStock(); }}
    ]});
  }
  return out;
}

/* ---------- vue ---------- */
window.vDocuments = function(v){
  poserCss();
  var lot = ui.lot;
  v.appendChild(el("div", {class:"card"}, el("div", {class:"dc-head"},
    el("div", null, el("h2", {style:"margin:0", text:"📄 Documents" + (lot ? " — commande " + lot : "")}),
      el("div", {class:"mut", text:"Tous les documents au même endroit : 👁 Aperçu (pour imprimer), 📕 PDF ou 📗 Excel. Format A4, pleine page, portrait ou paysage selon le document."})))));
  var avecLot = !!lot && S.lines.some(function(l){ return l.lot === lot; });
  if (!avecLot) v.appendChild(el("div", {class:"card"}, el("p", {class:"mut", text:"Choisissez une commande (lot) en haut de l'écran pour ses documents."})));
  groupes(lot).filter(function(g){ return avecLot || g.stock; }).forEach(function(g){
    if (!g.docs.length) return;
    var c = el("div", {class:"card dc-grp"}, el("h2", null, g.t)), l = el("div", {class:"dc-l"});
    g.docs.forEach(function(d){
      l.appendChild(el("div", {class:"dc-d", "data-doc":d.t},
        el("div", null, el("div", {class:"dc-n"}, d.t, el("span", {class:"dc-f", text:"A4 " + (d.o === "landscape" ? "paysage" : "portrait")})), el("div", {class:"dc-s", text:d.s})),
        el("div", {class:"dc-b"},
          el("button", {class:"btn small", text:"👁 Aperçu", onclick:function(){ try { apercu(d); } catch (e) { toast(e.message); } }}),
          el("button", {class:"btn small sec", text:"📕 PDF", onclick:function(){ try { pdf(d); } catch (e) { toast(e.message); } }}),
          el("button", {class:"btn small sec", text:"📗 Excel", onclick:function(){ try { excel(d); } catch (e) { toast(e.message); } }}))));
    });
    c.appendChild(l); v.appendChild(c);
  });
};
window.pkDocuments = {groupes:groupes};
})();
