/* =====================================================================
   SUIVI PERCKO — COMMANDES PAR MODÈLE EXCEL (onglet « Commandes »)
   ---------------------------------------------------------------------
   1. « 📥 Modèle Excel » : un classeur à remplir, une feuille par commande, au format de la
      fiche de commande (Model, LIBELLE, Taille, NEOLYS, ALLOGA, Total), avec TOUS les modèles
      du catalogue (y compris exosquelette et brassières). En haut : LOT, ANNEE, date de
      commande, STATUT (« En cours » ou « Expédiée »), date d'expédition.
   2. « 📤 Importer » : relit le classeur, montre ce qui sera créé, puis enregistre chaque commande :
      - En cours : les quantités (comme une saisie dans la fiche de commande) ; la commande reste
        à vérifier puis valider comme d'habitude ;
      - Expédiée (historique) : les quantités, et toutes les étapes passées d'un coup (coupe →
        expédition, à la date d'expédition, notées « Historique ») : la commande est terminée et
        va dans l'Archive. Refusé si la commande existe déjà avec un suivi.
   Chargé avant le script principal du suivi : n'utilise ses fonctions qu'à l'affichage.
   ===================================================================== */
(function(){
'use strict';
var ETAPES_HIST = ["cp", "gadh", "asm", "ret", "conf", "ctl", "emb", "pret", "exp"];
var TITRES = ["Model", "LIBELLE", "Taille", "NEOLYS", "ALLOGA", "Total"];
var RH = 5;   /* ligne (0 = première) des titres du tableau */
function couleur(lib){
  var m = (typeof FM !== "undefined" ? FM : []).filter(function(x){ return x[0] === lib; })[0]; if (m) return [m[5], m[6]];
  var t = String(lib).toLowerCase();
  if (/noir/.test(t)) return ["595959", "FFFFFF"]; if (/sable|beige/.test(t)) return ["DEDC86", "000000"]; if (/rose/.test(t)) return ["FFC0CB", "000000"]; if (/gris/.test(t)) return ["D9D9D9", "000000"];
  return ["FFFFFF", "000000"];
}
/* ---------- modèle Excel ---------- */
function feuilleModele(lot){
  var g = {cols:[24, 40, 11, 12, 13, 12], rows:[], merges:[], plein:true, sticky:RH + 1}, J = "FFF3BF";
  var H = {b:1, sz:9, al:"c", bd:"m", bg:"DDEBF7", wrap:1}, V = {b:1, sz:11, al:"c", bd:"m", bg:J};
  gset(g, 0, 0, "FICHE DE COMMANDE PERCKO — à remplir (cases jaunes)", {b:1, sz:13, fg:"1D3557", al:"l"}); gmerge(g, 0, 0, 0, 5); g.rows[0].h = 22;
  ["LOT", "ANNEE", "DATE COMMANDE", "STATUT", "DATE EXPÉDITION", ""].forEach(function(t, i){ if (t) gset(g, 2, i, t, H); });
  var lm = lotMonth(lot);
  gset(g, 3, 0, lot, V); gset(g, 3, 1, lm ? lm.y : new Date().getFullYear(), V); gset(g, 3, 2, "", V); gset(g, 3, 3, "En cours", V); gset(g, 3, 4, "", V);
  gset(g, 4, 0, "STATUT : « En cours » ou « Expédiée ». Dates au format jj/mm/aaaa. Quantités dans NEOLYS et ALLOGA (cases grises : taille non commandée par ALLOGA).", {sz:8, fg:"666666", al:"l"}); gmerge(g, 4, 0, 4, 5);
  g.rows[2].h = 26; g.rows[3].h = 20;
  TITRES.forEach(function(t, i){ gset(g, RH, i, t, {b:1, sz:10, al:"c", bd:"m", bg:"1D3557", fg:"FFFFFF"}); }); g.rows[RH].h = 18;
  var r = RH + 1, deb = r + 1, pm = null, mt = r, fins = {};
  libList().forEach(function(li){
    var col = couleur(li.lib), allo = ALLOGA_ONLY[li.lib] || [];
    li.sizes.slice().sort(function(a, b){ return sizeIdx(a) - sizeIdx(b); }).forEach(function(z){
      if (li.model !== pm){ pm = li.model; mt = r; } fins[mt] = r;
      gset(g, r, 0, r === mt ? li.model : "", {b:1, sz:10, al:"c", bd:"t"});
      gset(g, r, 1, li.lib, {sz:9, al:"l", bd:"t", bg:col[0], fg:col[1]});
      gset(g, r, 2, z, {b:1, sz:10, al:"c", bd:"t"});
      gset(g, r, 3, "", {sz:10, al:"c", bd:"t", bg:J});
      gset(g, r, 4, "", {sz:10, al:"c", bd:"t", bg:allo.indexOf(z) >= 0 ? J : "D9D9D9"});
      gset(g, r, 5, 0, {b:1, sz:10, al:"c", bd:"t"}); g.rows[r].cells[5].f = "SUM(D" + (r + 1) + ":E" + (r + 1) + ")";
      g.rows[r].h = 15; r++;
    });
  });
  Object.keys(fins).forEach(function(t){ if (fins[t] > +t) gmerge(g, +t, 0, fins[t], 0); });
  var T = {b:1, sz:11, al:"c", bd:"m", bg:"EEEEEE"};
  gset(g, r, 0, "TOTAL", {b:1, sz:11, al:"l", bd:"m", bg:"EEEEEE"}); gset(g, r, 1, "", T); gset(g, r, 2, "", T); gmerge(g, r, 0, r, 2);
  ["D", "E", "F"].forEach(function(c, i){ gset(g, r, 3 + i, 0, T); g.rows[r].cells[3 + i].f = "SUM(" + c + deb + ":" + c + r + ")"; });
  return g;
}
function telechargerModele(annee){
  annee = annee || new Date().getFullYear();
  var feuilles = [];
  for (var m = 1; m <= 12; m++){ var lot = "PK" + annee + (m < 10 ? "0" : "") + m; feuilles.push({name:lot, grid:feuilleModele(lot), first:m === 1}); }
  saveFile("Modele_commandes_" + annee + ".xlsx", xlsxBuild(feuilles));
}
/* ---------- lecture ---------- */
function dateIso(v){
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v === "number" && v > 20000 && v < 80000){ var d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  var s = String(v).trim(), m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s);
  if (m){ var y = +m[3]; if (y < 100) y += 2000; return y + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2); }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}
function lireClasseur(sheets){
  var out = [];
  sheets.forEach(function(sh){
    var rows = sh.rows, hi = -1, col = {};
    for (var i = 0; i < rows.length && i < 20; i++){
      var m = {}; rows[i].forEach(function(v, c){ var h = upperHead(v); if (h === "LIBELLE") m.lib = c; if (h === "TAILLE") m.size = c; if (h === "NEOLYS") m.NEOLYS = c; if (h === "ALLOGA") m.ALLOGA = c; if (h === "MODEL" || h === "MODELE") m.model = c; });
      if ("lib" in m && "size" in m && ("NEOLYS" in m || "ALLOGA" in m)){ hi = i; col = m; break; }
    }
    if (hi < 0) return;
    var info = {lot:"", annee:0, dc:"", statut:"", dexp:""};
    for (i = 0; i < hi; i++) rows[i].forEach(function(v, c){
      var h = upperHead(v), nx = rows[i + 1] ? rows[i + 1][c] : "";
      if (h === "LOT") info.lot = cleanTxt(nx).toUpperCase();
      if (h === "ANNEE") info.annee = parseInt(nx, 10) || 0;
      if (h === "DATE COMMANDE") info.dc = dateIso(nx);
      if (h === "STATUT") info.statut = cleanTxt(nx);
      if (h === "DATE EXPEDITION") info.dexp = dateIso(nx);
    });
    var q = [], err = [], model = "";
    for (i = hi + 1; i < rows.length; i++){
      var row = rows[i]; if ("model" in col && cleanTxt(row[col.model])) model = cleanTxt(row[col.model]);
      var lib = cleanTxt(row[col.lib]), z = normSize(row[col.size]);
      if (!lib || !z || /^TOTAL/i.test(lib)) continue;
      ["NEOLYS", "ALLOGA"].forEach(function(cl){
        if (!(cl in col)) return; var v = row[col[cl]];
        if (v === "" || v === null || v === undefined) return;
        var n = parseQty(v); if (n === null || n < 0){ err.push(lib + " " + z + " " + cl + " : « " + v + " »"); return; }
        if (n > 0) q.push({client:cl, lib:lib, size:z, q:n, model:model});
      });
    }
    if (!q.length && !err.length) return;   /* feuille vide : ignorée */
    var hist = /exp[eé]di|histor|termin|livr/i.test(info.statut);
    if (!info.lot) err.push("N° de lot manquant");
    if (info.dc === null) err.push("date de commande illisible");
    if (info.dexp === null) err.push("date d'expédition illisible");
    if (hist && !info.dexp && !info.dc) err.push("date d'expédition manquante");
    var existe = S.lines.some(function(l){ return l.lot === info.lot; }), suivi = existe && S.moves.some(function(m){ var l = lineById(m.lineId); return l && l.lot === info.lot; });
    if (hist && suivi) err.push("la commande existe déjà avec un suivi : importez-la « En cours »");
    var nom = nomIndex(), inconnus = {}; q.forEach(function(x){ if (!nom[refP(x.lib, x.size)]) inconnus[x.lib + " " + x.size] = 1; });
    var tot = {NEOLYS:0, ALLOGA:0}; q.forEach(function(x){ tot[x.client] += x.q; });
    out.push({feuille:sh.name, lot:info.lot, annee:info.annee || (lotMonth(info.lot) || {}).y || 0, dc:info.dc || "", dexp:info.dexp || "", hist:hist, q:q, tot:tot, err:err, existe:existe, inconnus:Object.keys(inconnus)});
  });
  /* même lot sur deux feuilles */
  var vus = {}; out.forEach(function(c){ if (c.lot && vus[c.lot]) c.err.push("même lot que la feuille « " + vus[c.lot] + " »"); else vus[c.lot] = c.feuille; });
  return out;
}
/* ---------- enregistrement ---------- */
function enregistrer(c){
  c.q.forEach(function(x){
    setLine(c.lot, c.annee, x.client, x.lib, x.size, x.q);
    var l = findLine(c.lot, x.client, x.lib, x.size); if (l && !l.model) l.model = modelOf(x.lib) || x.model;
  });
  ensureLot(c.lot); var L = S.lots[c.lot];
  if (c.dc) L.dc = c.dc;
  if (c.hist){
    var d = c.dexp || c.dc;
    L.ready = L.ready || c.dc || d; L.historique = d;
    var mv = [];
    c.q.forEach(function(x){ var l = findLine(c.lot, x.client, x.lib, x.size); if (!l) return;
      ETAPES_HIST.forEach(function(st){ mv.push({id:nid("M"), date:d, lineId:l.id, stage:st, qty:l.qty, nc:0, note:"Historique (commande importée, expédiée le " + dmyL(d) + ")"}); }); });
    checkMoves(mv);
    mv.forEach(function(m){ S.moves.push(m); });
  }
}
function importer(file){
  readWorkbook(file).then(function(sheets){
    var L = lireClasseur(sheets);
    if (!L.length){ toast("Aucune commande remplie dans ce fichier (modèle Excel des commandes attendu)."); return; }
    var bons = L.filter(function(c){ return !c.err.length; }), mauvais = L.filter(function(c){ return c.err.length; });
    ui.pend = {modal:true};
    var box = sxModal();
    box.appendChild(el("div", {class:"sx-cnum", style:"text-align:center", text:"📤 Importer les commandes"}));
    var lst = el("div", {class:"ic-l"});
    L.forEach(function(c){
      lst.appendChild(el("div", {class:"ic-c" + (c.err.length ? " ko" : "")},
        el("div", {class:"ic-h"}, el("b", {text:c.lot || c.feuille}), el("span", {class:"ic-st " + (c.hist ? "h" : "e"), text:c.hist ? "Expédiée (historique)" : "En cours"})),
        el("div", {class:"mut", text:"NEOLYS " + fmt(c.tot.NEOLYS) + " · ALLOGA " + fmt(c.tot.ALLOGA) + " · total " + fmt(c.tot.NEOLYS + c.tot.ALLOGA) + " pièces" + (c.dc ? " · commandée le " + dmyL(c.dc) : "") + (c.hist ? " · expédiée le " + dmyL(c.dexp || c.dc) : "") + (c.existe ? " · existe déjà : quantités mises à jour" : "")}),
        c.inconnus.length ? el("div", {class:"ic-w", text:"Absents de la nomenclature : " + c.inconnus.slice(0, 6).join(", ") + (c.inconnus.length > 6 ? "…" : "")}) : null,
        c.err.length ? el("div", {class:"ic-e", text:"Non importée : " + c.err.slice(0, 4).join(" ; ")}) : null));
    });
    box.appendChild(lst);
    if (bons.length) box.appendChild(el("button", {class:"sx-go", style:"width:100%", text:"✔ Importer " + bons.length + " commande(s)", onclick:function(){
      sxClose();
      var ok = commit(function(){
        var m0 = S.moves.slice(), l0 = S.lines.slice(), q0 = S.lines.map(function(l){ return [l, l.qty, l.cc]; }), lots0 = JSON.stringify(S.lots);
        try { bons.forEach(enregistrer); }
        catch (e){ S.moves = m0; S.lines = l0; q0.forEach(function(x){ x[0].qty = x[1]; x[0].cc = x[2]; }); S.lots = JSON.parse(lots0); throw e; }
        ui.lot = bons[bons.length - 1].lot;
      });
      if (ok) toast(bons.length + " commande(s) importée(s)" + (mauvais.length ? " · " + mauvais.length + " non importée(s)" : ""));
    }}));
    box.appendChild(el("button", {class:"sx-annul", text:bons.length ? "Annuler" : "Fermer", onclick:sxClose}));
  }).catch(function(e){ toast(e.message); });
}
/* ---------- carte de l'onglet Commandes ---------- */
window.carteImportCommandes = function(){
  if (!document.getElementById("ic-css")){ var st = document.createElement("style"); st.id = "ic-css";
    st.textContent = ".ic-l{max-height:50vh;overflow:auto;display:grid;gap:8px;margin:0 0 12px}.ic-c{border:1px solid var(--line);border-left:5px solid #1f9254;border-radius:10px;padding:8px 10px;font-size:13px}.ic-c.ko{border-left-color:#b42318}" +
      ".ic-h{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:15px}.ic-st{font-size:11.5px;font-weight:800;border-radius:99px;padding:2px 9px}.ic-st.h{background:#dcf5e5;color:#11643a}.ic-st.e{background:#e7f1ff;color:#1d4f91}" +
      ".ic-e{color:#b42318;font-weight:700;margin-top:4px}.ic-w{color:#7a4b00;margin-top:4px}";
    document.head.appendChild(st); }
  var fi = el("input", {type:"file", accept:".xlsx", class:"ic-file", style:"display:none"});
  fi.addEventListener("change", function(){ if (fi.files.length) importer(fi.files[0]); fi.value = ""; });
  var an = el("input", {type:"number", class:"ic-an", value:String(new Date().getFullYear()), style:"width:90px"});
  return el("details", {class:"card ic-carte"}, el("summary", {text:"📥 Saisir plusieurs commandes avec un fichier Excel (modèle avec tous les modèles, exosquelette et brassières)"}),
    el("p", {class:"mut", text:"1. Téléchargez le modèle : une feuille par mois (PK…01 à PK…12), au format de la fiche de commande, avec tous les modèles du catalogue. Copiez une feuille pour une commande « -1 », « -2 »… et changez le LOT. " +
      "2. Remplissez les cases jaunes : LOT, date de commande, STATUT (« En cours » ou « Expédiée ») et date d'expédition, puis les quantités NEOLYS et ALLOGA. Laissez vides les feuilles inutiles. " +
      "3. Importez le fichier : chaque commande est vérifiée avant d'être enregistrée. Une commande « Expédiée » est enregistrée comme terminée (toutes les étapes à la date d'expédition) et va dans l'Archive."}),
    el("div", {class:"actions"}, el("label", {class:"mut", style:"display:flex;align-items:center;gap:6px"}, "Année ", an),
      el("button", {class:"btn sec", text:"📥 Télécharger le modèle Excel", onclick:function(){ telechargerModele(parseInt(an.value, 10) || new Date().getFullYear()); }}),
      el("button", {class:"btn", text:"📤 Importer le fichier rempli", onclick:function(){ fi.click(); }}), fi));
};
window.pkImportCommandes = {feuilleModele:feuilleModele, lireClasseur:lireClasseur, enregistrer:enregistrer, telechargerModele:telechargerModele, dateIso:dateIso};
})();
