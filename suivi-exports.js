/* =====================================================================
   SUIVI PERCKO — EXPORTS LIBRES (onglet « Exports », TEK-TREND)
   ---------------------------------------------------------------------
   Un export = une expédition : date, nature (NEOLYS ou ALLOGA), destinataire,
   et des cartons. Chaque carton contient un ou plusieurs modèles, par taille ;
   chaque pièce est rattachée à une commande (lot) : automatiquement (la plus
   ancienne commande d'abord) ou la commande choisie. Un export peut donc
   contenir des pièces de plusieurs commandes.
   - Enregistrer un carton = emballer ces pièces (contrôle + emballage dans le suivi).
   - On ne met en carton que des pièces revenues de la GADH (et, pour un client
     « limité à la commande » comme ALLOGA, pas plus que sa commande).
   - Valider l'export (« Fini ») = pièces expédiées, affectées à leurs commandes.
   - Documents : fiches cartons, liste de colisage, liste total par commande avec
     l'état des commandes, base NiceLabel ; tout imprimer ou tout en Excel.
   Données : S.exports (document « exports » du suivi).
   Chargé avant le script principal du suivi : n'utilise ses fonctions qu'à l'affichage.
   ===================================================================== */
(function(){
'use strict';
var CSS = [
  '.xp-tab{width:100%;border-collapse:collapse}.xp-tab th,.xp-tab td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}',
  '.xp-tab th{font-size:12.5px;color:var(--mut);font-weight:700;white-space:nowrap}.xp-tab td.n{text-align:right;font-weight:700}',
  '.xp-et{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:800}.xp-et.cours{background:#fff3cd;color:#7a4b00}.xp-et.fini{background:#dcf5e5;color:#11643a}',
  '.xp-head{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;justify-content:space-between}',
  '.xp-meta{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:14px;margin-top:4px}.xp-meta b{font-weight:800}',
  '.xp-carton{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:0 0 8px;background:var(--card)}',
  '.xp-carton .t{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between}',
  '.xp-carton .num{font-weight:800;font-size:16px}.xp-carton .lg{font-size:13.5px;margin-top:4px;color:var(--ink)}.xp-carton .lg span{color:var(--mut)}',
  '.xp-ligne{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:14px}',
  '.xp-ligne:first-child{border-top:0}.xp-x{border:1px solid var(--line);background:var(--sub);border-radius:8px;width:34px;height:34px;cursor:pointer;font-weight:800}',
  '.xp-dispo{font-size:12.5px;color:var(--mut);font-weight:600}.xp-dispo b{color:var(--ink)}',
  '.xp-cmd{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}',
  '.xp-vide{padding:18px;text-align:center;color:var(--mut);border:1px dashed var(--line);border-radius:12px}',
  '.xp-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 14px}',
  '.xp-form label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px}',
  '.xp-form textarea{min-height:96px;font:inherit}',
  '.xp-tot{font-size:22px;font-weight:800}'
].join('\n');
function poserCss(){ if (document.getElementById('xp-css')) return; var st = document.createElement('style'); st.id = 'xp-css'; st.textContent = CSS; document.head.appendChild(st); }

/* ---------- données ---------- */
function EX(){ return S.exports || (S.exports = []); }
function exportDe(id){ return EX().filter(function(e){ return e.id === id; })[0] || null; }
function clientsPossibles(){ var c = sortedUnique(S.lines.map(function(l){ return l.client; })); return c.length ? c : ["NEOLYS", "ALLOGA"]; }
function destDefaut(cl){ var d = PK_DESTINATAIRES[cl] || {nom:cl, lignes:[], tel:""}; return {nom:d.nom, lignes:d.lignes.slice(), tel:d.tel || ""}; }
function destTexte(d){ return [d.nom].concat(d.lignes || []).concat(d.tel ? ["Tél : " + d.tel] : []).join("\n"); }
function destDepuisTexte(t){ var ls = String(t || "").split(/\n/).map(function(x){ return x.trim(); }).filter(Boolean), tel = ""; ls = ls.filter(function(x){ var m = /^t[ée]l[ée]?(phone)?\s*:?\s*(.*)$/i.exec(x); if (m){ tel = m[2]; return false; } return true; }); return {nom:ls[0] || "", lignes:ls.slice(1), tel:tel}; }
function qteCarton(c){ var q = 0; c.it.forEach(function(x){ q += x[1]; }); return q; }
function qteExport(e){ var q = 0; e.cartons.forEach(function(c){ q += qteCarton(c); }); return q; }
function lotsExport(e){ var o = {}; e.cartons.forEach(function(c){ c.it.forEach(function(x){ var l = lineById(x[0]); if (l) o[l.lot] = 1; }); }); return Object.keys(o).sort(); }
function lotsDeCarton(c){ var o = {}; c.it.forEach(function(x){ var l = lineById(x[0]); if (l) o[l.lot] = 1; }); return Object.keys(o).sort(); }
function poidsDe(e, c){ if (c.kg !== null && c.kg !== undefined && c.kg !== "") return +c.kg || 0; var R = regleColis(e.cl); return R ? poidsCarton(R, qteCarton(c)) : 0; }

/* pièces encore disponibles pour l'export de nature cl, sur une ligne de commande (hors un carton en modification) */
function dispoLigne(l, cl, saufCt){
  var ret = dispoRetour(l.lot, l.id, saufCt), R = regleColis(cl);
  if (l.client === cl) return Math.min(ret, (R && R.cde) ? Math.max(0, l.qty - enCarton(l.lot, cl, l.id, saufCt)) : Infinity);
  /* surplus d'un client limité à sa commande (ex. surplus ALLOGA sur un export NEOLYS) : ce qui dépasse sa commande */
  var Ro = regleColis(l.client); if (!(Ro && Ro.cde) || (R && R.cde)) return 0;
  return Math.max(0, ret - Math.max(0, l.qty - enCarton(l.lot, l.client, l.id, null)));
}
/* modèles proposés : {cle, lib, src (client de la commande), sur (surplus)} */
function modelesExport(cl, saufCt, dansCarton){
  var o = [], vus = {};
  S.lines.forEach(function(l){
    var k = l.client + "|" + l.lib; if (vus[k]) return;
    var d = dispoLigne(l, cl, saufCt) > 0 || (dansCarton && dansCarton[l.id]);
    if (!d) return; vus[k] = 1; o.push({cle:k, lib:l.lib, src:l.client, sur:l.client !== cl});
  });
  return o.sort(function(a, b){ return (a.sur - b.sur) || (a.lib < b.lib ? -1 : a.lib > b.lib ? 1 : 0); });
}
function lignesModele(m, lot, size){ return S.lines.filter(function(l){ return l.lib === m.lib && l.client === m.src && (!lot || lot === "auto" || l.lot === lot) && (!size || l.size === size); }).sort(function(a, b){ return a.lot < b.lot ? -1 : a.lot > b.lot ? 1 : 0; }); }

/* ---------- mouvements (contrôle + emballage par carton ; prêt + expédié à la validation) ---------- */
function mvtsCarton(e, c){
  var out = [];
  c.it.forEach(function(x){ if (!x[1]) return;
    out.push({id:nid("M"), date:e.d, lineId:x[0], stage:"ctl", qty:x[1], nc:0, note:"Contrôle (auto) · export N°" + e.n + " carton N°" + c.n, ct:c.id});
    out.push({id:nid("M"), date:e.d, lineId:x[0], stage:"emb", qty:x[1], nc:0, note:"Export N°" + e.n + " · carton N°" + c.n, ct:c.id});
  });
  return out;
}
function anciensDe(id){ var o = {}; S.moves.forEach(function(m){ if (m.ct === id) o[m.id] = 1; }); return o; }
function enregistrerCartonExport(e, c){
  var anc = anciensDe(c.id), nm = mvtsCarton(e, c);
  checkMoves(nm, anc);
  S.moves = S.moves.filter(function(m){ return !anc[m.id]; }).concat(nm);
  var i = e.cartons.findIndex(function(x){ return x.id === c.id; });
  if (i >= 0) e.cartons[i] = c; else e.cartons.push(c);
}
function supprimerCartonExport(e, id){
  var c = e.cartons.filter(function(x){ return x.id === id; })[0]; if (!c) return;
  var anc = anciensDe(id); checkMoves([], anc);
  S.moves = S.moves.filter(function(m){ return !anc[m.id]; });
  e.cartons = e.cartons.filter(function(x){ return x.id !== id; });
  e.cartons.forEach(function(x){ if (x.n > c.n){ x.n--; S.moves.forEach(function(m){ if (m.ct === x.id) m.note = (m.stage === "ctl" ? "Contrôle (auto) · export N°" + e.n + " carton N°" : "Export N°" + e.n + " · carton N°") + x.n; }); } });
}
function validerExport(e){
  if (!e.cartons.length) throw new Error("L'export n'a aucun carton.");
  var nm = [];
  e.cartons.forEach(function(c){ c.it.forEach(function(x){ if (!x[1]) return;
    nm.push({id:nid("M"), date:e.d, lineId:x[0], stage:"pret", qty:x[1], nc:0, note:"Export N°" + e.n + " · carton N°" + c.n, ct:e.id});
    nm.push({id:nid("M"), date:e.d, lineId:x[0], stage:"exp", qty:x[1], nc:0, note:"Expédié · export N°" + e.n + " · carton N°" + c.n, ct:e.id}); }); });
  checkMoves(nm, anciensDe(e.id));
  S.moves = S.moves.filter(function(m){ return m.ct !== e.id; }).concat(nm);
  e.st = "fini"; e.dv = today();
}
function rouvrirExport(e){ var anc = anciensDe(e.id); checkMoves([], anc); S.moves = S.moves.filter(function(m){ return !anc[m.id]; }); e.st = "cours"; e.dv = ""; }
function supprimerExport(e){
  if (e.st === "fini") throw new Error("Export validé : rouvrez-le d'abord.");
  var anc = {}; e.cartons.forEach(function(c){ var a = anciensDe(c.id); Object.keys(a).forEach(function(k){ anc[k] = 1; }); });
  checkMoves([], anc); S.moves = S.moves.filter(function(m){ return !anc[m.id]; });
  S.exports = EX().filter(function(x){ return x.id !== e.id; });
}

/* ---------- vues ---------- */
window.vExports = function(v){
  poserCss(); sxFermer();
  ui.xp = ui.xp || {};
  var e = ui.xp.id ? exportDe(ui.xp.id) : null;
  if (ui.xp.id && !e) ui.xp = {};
  if (ui.xp.nouveau || ui.xp.modif) return formExport(v, ui.xp.modif ? e : null);
  if (e && ui.xp.carton) return editeurCarton(v, e);
  if (e) return ficheExport(v, e);
  listeExports(v);
};
function listeExports(v){
  var L = EX().slice().sort(function(a, b){ return (b.d || "").localeCompare(a.d || "") || b.n - a.n; });
  var enCours = L.filter(function(e){ return e.st !== "fini"; }).length;
  v.appendChild(el("div", {class:"card"},
    el("div", {class:"xp-head"}, el("div", null, el("h2", {style:"margin:0", text:"Exports"}), el("div", {class:"mut", text:L.length + " export(s) · " + enCours + " en cours"})),
      el("button", {class:"btn", text:"+ Nouvel export", onclick:function(){ ui.xp = {nouveau:true}; render(); }}))));
  if (!L.length){ v.appendChild(el("div", {class:"card"}, el("div", {class:"xp-vide", text:"Aucun export pour l'instant. Touchez « + Nouvel export » : date, nature (NEOLYS ou ALLOGA), puis les cartons."}))); return; }
  var t = el("table", {class:"xp-tab"}), tb = el("tbody");
  t.appendChild(el("thead", null, el("tr", null, ["N°", "Date d'export", "Nature", "Commandes", "Cartons", "Pièces", "État", ""].map(function(h){ return el("th", {text:h}); }))));
  L.forEach(function(e){
    var ouvrir = function(){ ui.xp = {id:e.id}; render(); };
    tb.appendChild(el("tr", {style:"cursor:pointer", onclick:ouvrir},
      el("td", {text:String(e.n)}), el("td", {text:dmyL(e.d)}), el("td", null, el("b", {text:e.nat || e.cl})),
      el("td", {text:lotsExport(e).join(", ") || "—"}), el("td", {class:"n", text:String(e.cartons.length)}), el("td", {class:"n", text:fmt(qteExport(e))}),
      el("td", null, el("span", {class:"xp-et " + (e.st === "fini" ? "fini" : "cours"), text:e.st === "fini" ? "FINI" : "EN COURS"})),
      el("td", null, el("button", {class:"btn small sec", text:"Ouvrir", onclick:function(ev){ ev.stopPropagation(); ouvrir(); }}))));
  });
  t.appendChild(tb); v.appendChild(el("div", {class:"card"}, el("div", {class:"tw"}, t)));
}
function formExport(v, e){
  var cls = clientsPossibles(), cl = e ? e.cl : (cls.indexOf("NEOLYS") >= 0 ? "NEOLYS" : cls[0]);
  var dI = el("input", {type:"date", value:e ? e.d : today()});
  var dest = el("textarea", {rows:"5"}); dest.value = destTexte(e && e.dest ? e.dest : destDefaut(cl));
  var seg = el("div", {class:"seg"});
  function dessinerSeg(){ seg.innerHTML = ""; cls.forEach(function(c){ seg.appendChild(el("button", {class:c === cl ? "on" : "", text:c, onclick:function(){
    if (e && e.cartons.length && c !== e.cl){ toast("L'export a déjà des cartons : la nature ne peut plus changer."); return; }
    var defAvant = destTexte(destDefaut(cl)); cl = c; if (dest.value.trim() === defAvant.trim()) dest.value = destTexte(destDefaut(cl)); dessinerSeg(); }})); }); }
  dessinerSeg();
  v.appendChild(el("div", {class:"card"}, el("h2", {text:e ? "Modifier l'export N°" + e.n : "Nouvel export"}),
    el("div", {class:"xp-form"},
      el("label", null, "Date d'export", dI),
      el("label", null, "Nature (destination)", seg),
      el("label", {style:"grid-column:1/-1"}, "Destinataire (repris sur les fiches cartons et la liste de colisage)", dest)),
    el("div", {class:"actions", style:"margin-top:12px"},
      el("button", {class:"btn", text:e ? "✔ Enregistrer" : "✔ Créer l'export et ajouter les cartons", onclick:function(){
        if (!dI.value){ toast("Choisissez la date d'export."); return; }
        var d = destDepuisTexte(dest.value), def = destDefaut(cl), memeDest = destTexte(d) === destTexte(def);
        var id = e ? e.id : nid("X");
        var ok = commit(function(){
          if (e){
            e.d = dI.value; e.cl = cl; e.nat = cl; e.dest = memeDest ? null : d;
            /* date des mouvements : celle de l'export */
            var ids = {}; e.cartons.forEach(function(c){ ids[c.id] = 1; }); ids[e.id] = 1;
            S.moves.forEach(function(m){ if (ids[m.ct]) m.date = e.d; });
          } else {
            var n = 0; EX().forEach(function(x){ if (x.n > n) n = x.n; });
            EX().push({id:id, n:n + 1, d:dI.value, cl:cl, nat:cl, dest:memeDest ? null : d, st:"cours", dv:"", cartons:[]});
          }
          ui.xp = e ? {id:id} : {id:id, carton:{nouveau:true}};
        });
        if (ok && !e) toast("Export créé : ajoutez le premier carton.");
      }}),
      el("button", {class:"btn sec", text:"Annuler", onclick:function(){ ui.xp = e ? {id:e.id} : {}; render(); }}))));
}
function resumeCarton(c){
  var par = {}, ordre = [];
  c.it.forEach(function(x){ var l = lineById(x[0]); if (!l) return; var k = l.lib + "|" + l.lot + "|" + l.client; if (!par[k]){ par[k] = {l:l, t:[]}; ordre.push(k); } par[k].t.push([l.size, x[1]]); });
  return ordre.map(function(k){ var p = par[k]; p.t.sort(function(a, b){ return sizeIdx(a[0]) - sizeIdx(b[0]); });
    return el("div", {class:"lg"}, el("b", {text:nomDoc(p.l.lib)}), " ", el("span", {text:"(" + p.l.lot + (p.l.client !== ui.xpCl ? " · surplus " + p.l.client : "") + ")"}), " : " + p.t.map(function(t){ return t[0] + " " + t[1]; }).join(" · ")); });
}
function ficheExport(v, e){
  var fini = e.st === "fini", q = qteExport(e), pds = 0; e.cartons.forEach(function(c){ pds += poidsDe(e, c); });
  ui.xpCl = e.cl;
  var dest = e.dest || destDefaut(e.cl);
  v.appendChild(el("button", {class:"btn small sec", style:"margin-bottom:10px", text:"← Tous les exports", onclick:function(){ ui.xp = {}; render(); }}));
  var head = el("div", {class:"card"},
    el("div", {class:"xp-head"},
      el("div", null, el("h2", {style:"margin:0", text:"Export N°" + e.n + " · " + (e.nat || e.cl)}),
        el("div", {class:"xp-meta"}, el("span", null, "Date d'export : ", el("b", {text:dmyL(e.d)})), el("span", null, "Destinataire : ", el("b", {text:dest.nom})),
          el("span", null, "Commandes : ", el("b", {text:lotsExport(e).join(", ") || "—"})))),
      el("span", {class:"xp-et " + (fini ? "fini" : "cours"), text:fini ? "FINI · expédié le " + dmyL(e.d) : "EN COURS"})),
    el("div", {class:"stat", style:"margin:12px 0 0"},
      el("div", null, el("b", {text:String(e.cartons.length)}), el("span", {text:"carton(s)"})),
      el("div", null, el("b", {text:fmt(q)}), el("span", {text:"pièces"})),
      el("div", null, el("b", {text:fmt(Math.round(pds * 10) / 10, pds % 1 ? 1 : 0) + " kg"}), el("span", {text:"poids brut"}))));
  var acts = el("div", {class:"actions", style:"margin:12px 0 0"});
  if (!fini){
    acts.appendChild(el("button", {class:"btn", text:"+ Ajouter un carton", onclick:function(){ ui.xp = {id:e.id, carton:{nouveau:true}}; render(); }}));
    acts.appendChild(el("button", {class:"btn sec", text:"Modifier date / destinataire", onclick:function(){ ui.xp = {id:e.id, modif:true}; render(); }}));
  }
  head.appendChild(acts);
  v.appendChild(head);
  /* cartons */
  var cc = el("div", {class:"card"}, el("h2", {text:"Cartons"}));
  if (!e.cartons.length) cc.appendChild(el("div", {class:"xp-vide", text:"Pas encore de carton. Touchez « + Ajouter un carton »."}));
  e.cartons.slice().sort(function(a, b){ return a.n - b.n; }).forEach(function(c){
    var b = el("div", {class:"xp-carton"},
      el("div", {class:"t"}, el("span", {class:"num", text:"📦 Carton N°" + c.n}), el("span", {class:"mut", text:fmt(qteCarton(c)) + " pièce(s) · " + fmt(poidsDe(e, c), poidsDe(e, c) % 1 ? 1 : 0) + " kg"})));
    resumeCarton(c).forEach(function(x){ b.appendChild(x); });
    if (!fini) b.appendChild(el("div", {class:"actions", style:"margin:8px 0 0"},
      el("button", {class:"btn small sec", text:"Modifier", onclick:function(){ ui.xp = {id:e.id, carton:{id:c.id}}; render(); }}),
      el("button", {class:"btn small sec", text:"Refaire le même", title:"Nouveau carton avec le même contenu", onclick:function(){ ui.xp = {id:e.id, carton:{nouveau:true, depuis:c.id}}; render(); }}),
      el("button", {class:"btn small sec", style:"color:#b42318", text:"Supprimer", onclick:function(){ if (!confirm("Supprimer le carton N°" + c.n + " ? Les cartons suivants sont renumérotés.")) return; commit(function(){ supprimerCartonExport(e, c.id); }, "Carton supprimé"); }})));
    cc.appendChild(b);
  });
  v.appendChild(cc);
  /* documents */
  if (e.cartons.length) v.appendChild(docsCard(e));
  /* validation */
  var vc = el("div", {class:"card"});
  if (!fini){
    vc.appendChild(el("h2", {text:"Valider l'export"}));
    vc.appendChild(el("p", {class:"mut", style:"margin:0 0 10px", text:"À la validation, les pièces passent en « Expédiée » dans le suivi, chacune sur sa commande. L'export ne peut plus être modifié (sauf en le rouvrant)."}));
    vc.appendChild(el("div", {class:"actions"},
      el("button", {class:"btn", text:"✔ Valider l'export (Fini)", onclick:function(){ confirmerValidation(e); }}),
      el("button", {class:"btn sec", style:"color:#b42318", text:"Supprimer l'export", onclick:function(){ if (!confirm("Supprimer l'export N°" + e.n + " et ses " + e.cartons.length + " carton(s) ? Les pièces redeviennent à emballer.")) return; var ok = commit(function(){ supprimerExport(e); ui.xp = {}; }); if (ok) toast("Export supprimé"); }})));
  } else {
    vc.appendChild(el("h2", {text:"Export validé"}));
    vc.appendChild(el("p", {class:"mut", style:"margin:0 0 10px", text:"Les pièces sont expédiées et affectées à leurs commandes. Pour corriger l'export, rouvrez-le."}));
    vc.appendChild(el("button", {class:"btn sec", text:"Rouvrir l'export", onclick:function(){ if (!confirm("Rouvrir l'export N°" + e.n + " ? Les pièces ne seront plus comptées comme expédiées.")) return; commit(function(){ rouvrirExport(e); }, "Export rouvert"); }}));
  }
  v.appendChild(vc);
}
function confirmerValidation(e){
  var par = {}, lots = [];
  e.cartons.forEach(function(c){ c.it.forEach(function(x){ var l = lineById(x[0]); if (!l) return; if (!(l.lot in par)){ par[l.lot] = 0; lots.push(l.lot); } par[l.lot] += x[1]; }); });
  lots.sort();
  ui.pend = {modal:true};
  var box = sxModal();
  box.appendChild(el("div", {class:"sx-cnum", style:"text-align:center", text:"🚚 Export N°" + e.n}));
  var rec = el("div", {class:"sx-cdet"});
  lots.forEach(function(lot){ rec.appendChild(el("div", null, el("span", {text:"Commande " + lot}), el("b", {text:fmt(par[lot]) + " pièce(s)"}))); });
  rec.appendChild(el("div", {class:"tot"}, el("span", {text:e.cartons.length + " carton(s) · " + dmyL(e.d)}), el("b", {text:fmt(qteExport(e)) + " pièces"})));
  box.appendChild(rec);
  box.appendChild(el("button", {class:"sx-go", style:"width:100%", text:"✔ Oui, valider (pièces expédiées)", onclick:function(){ sxClose(); commit(function(){ validerExport(e); }, "Export N°" + e.n + " validé : pièces expédiées"); }}));
  box.appendChild(el("button", {class:"sx-annul", text:"Non, revenir", onclick:sxClose}));
}

/* ---------- éditeur de carton ---------- */
function editeurCarton(v, e){
  if (e.st === "fini"){ ui.xp = {id:e.id}; return ficheExport(v, e); }
  var C = ui.xp.carton;
  if (!C.etat){
    var src = C.id ? e.cartons.filter(function(x){ return x.id === C.id; })[0] : C.depuis ? e.cartons.filter(function(x){ return x.id === C.depuis; })[0] : null;
    var n = 0; e.cartons.forEach(function(x){ if (x.n > n) n = x.n; });
    C.etat = {it:src ? src.it.map(function(x){ return [x[0], x[1]]; }) : [], kg:C.id && src && src.kg !== null && src.kg !== undefined ? String(src.kg) : "", n:C.id && src ? src.n : n + 1, m:null, lot:"auto", q:{}};
    if (C.depuis && src){ /* « refaire le même » : seulement ce qui reste disponible */
      var pris = {}; C.etat.it = C.etat.it.map(function(x){ var l = lineById(x[0]), d = l ? dispoLigne(l, e.cl, null) - (pris[x[0]] || 0) : 0, q = Math.max(0, Math.min(x[1], d)); pris[x[0]] = (pris[x[0]] || 0) + q; return [x[0], q]; }).filter(function(x){ return x[1] > 0; });
      if (!C.etat.it.length) toast("Plus assez de pièces disponibles pour refaire ce carton.");
    }
  }
  var E = C.etat, saufCt = C.id || null, R = regleColis(e.cl), t1 = !!(R && R.t1);
  function dansBrouillon(id){ var q = 0; E.it.forEach(function(x){ if (x[0] === id) q += x[1]; }); return q; }
  function dispo(l){ return Math.max(0, dispoLigne(l, e.cl, saufCt) - dansBrouillon(l.id)); }
  v.appendChild(el("button", {class:"btn small sec", style:"margin-bottom:10px", text:"← Export N°" + e.n, onclick:function(){ ui.xp = {id:e.id}; render(); }}));
  /* 1. contenu du carton */
  var tot = 0; E.it.forEach(function(x){ tot += x[1]; });
  var carte = el("div", {class:"card"},
    el("div", {class:"xp-head"}, el("div", {class:"sx-cnum", text:"📦 Carton N°" + E.n}), el("div", null, el("span", {class:"xp-tot", text:fmt(tot)}), el("span", {class:"mut", text:" pièce(s)"}))),
    el("div", {class:"mut", style:"margin:2px 0 8px", text:(C.id ? "Modification du carton" : "Nouveau carton") + " — export N°" + e.n + " · " + e.cl + (R ? " · " + R.n + " pièces maximum" + (t1 ? ", une seule taille" : "") : "")}));
  if (!E.it.length) carte.appendChild(el("div", {class:"xp-vide", text:"Carton vide : choisissez un modèle ci-dessous, remplissez les tailles, puis « Ajouter dans le carton »."}));
  var lst = el("div");
  E.it.slice().map(function(x, i){ return [x, i]; }).sort(function(a, b){ var la = lineById(a[0][0]), lb = lineById(b[0][0]); if (!la || !lb) return 0; return la.lib === lb.lib ? (la.lot === lb.lot ? sizeIdx(la.size) - sizeIdx(lb.size) : (la.lot < lb.lot ? -1 : 1)) : (la.lib < lb.lib ? -1 : 1); }).forEach(function(p){
    var x = p[0], l = lineById(x[0]); if (!l) return;
    lst.appendChild(el("div", {class:"xp-ligne"},
      el("div", null, el("b", {text:nomDoc(l.lib) + " · " + l.size}), el("div", {class:"xp-dispo", text:"Commande " + l.lot + (l.client !== e.cl ? " (surplus " + l.client + ")" : "")})),
      el("b", {style:"font-size:18px", text:fmt(x[1])}),
      el("button", {class:"xp-x", title:"Retirer", text:"✖", onclick:function(){ E.it.splice(p[1], 1); render(true); }})));
  });
  carte.appendChild(lst);
  v.appendChild(carte);
  /* 2. ajouter des pièces */
  var ajout = el("div", {class:"card"}, el("h2", {text:"Ajouter des pièces"}));
  var dans = {}; E.it.forEach(function(x){ dans[x[0]] = 1; });
  var mods = modelesExport(e.cl, saufCt, dans).filter(function(m){ return lignesModele(m).some(function(l){ return dispo(l) > 0; }); });
  if (E.m && !mods.some(function(m){ return m.cle === E.m; })){ E.m = null; E.q = {}; }
  if (!mods.length) ajout.appendChild(el("div", {class:"xp-vide", text:"Aucune pièce disponible à emballer pour " + e.cl + " : les pièces doivent d'abord revenir de la GADH (étape Retour GADH)."}));
  else {
    ajout.appendChild(el("div", {class:"mut", style:"font-weight:600;margin:0 0 6px", text:"1. Choisissez le modèle"}));
    var ch = el("div", {class:"sx-opts"});
    mods.forEach(function(m){ var on = E.m === m.cle, tot = 0; lignesModele(m).forEach(function(l){ tot += dispo(l); });
      ch.appendChild(el("button", {class:"sx-chip" + (on ? " on" : ""), text:(on ? "✓ " : "") + nomDoc(m.lib) + (m.sur ? " (surplus " + m.src + ")" : "") + " · " + fmt(tot), title:fmt(tot) + " pièce(s) disponible(s)", onclick:function(){ E.m = on ? null : m.cle; E.lot = "auto"; E.q = {}; render(true); }})); });
    ajout.appendChild(ch);
    var M = mods.filter(function(m){ return m.cle === E.m; })[0];
    if (M){
      var lots = sortedUnique(lignesModele(M).filter(function(l){ return dispo(l) > 0; }).map(function(l){ return l.lot; }));
      if (E.lot !== "auto" && lots.indexOf(E.lot) < 0) E.lot = "auto";
      ajout.appendChild(el("div", {class:"mut", style:"font-weight:600;margin:12px 0 6px", text:"2. Commande de référence"}));
      var sc = el("div", {class:"xp-cmd"});
      [["auto", "Automatique (la plus ancienne d'abord)"]].concat(lots.map(function(lot){ var d = 0; lignesModele(M, lot).forEach(function(l){ d += dispo(l); }); return [lot, lot + " · " + fmt(d) + " dispo"]; })).forEach(function(o){
        sc.appendChild(el("button", {class:"sx-chip" + (E.lot === o[0] ? " on" : ""), text:o[1], onclick:function(){ E.lot = o[0]; E.q = {}; render(true); }})); });
      ajout.appendChild(sc);
      ajout.appendChild(el("div", {class:"mut", style:"font-weight:600;margin:12px 0 6px", text:"3. Quantités par taille"}));
      var tailles = sortedUniqueKeep(lignesModele(M, E.lot).filter(function(l){ return dispo(l) > 0; }).map(function(l){ return l.size; })).sort(function(a, b){ return sizeIdx(a) - sizeIdx(b); });
      var art = el("div", {class:"sx-art"}, el("div", {class:"hd"}, el("span", {text:nomDoc(M.lib)}), el("span", {class:"cli", text:E.lot === "auto" ? "automatique" : E.lot})));
      var totAj = el("b", {text:"0"});
      function majTot(){ var t = 0; Object.keys(E.q).forEach(function(s){ t += E.q[s] || 0; }); totAj.textContent = fmt(t); }
      tailles.forEach(function(sz){
        var ls = lignesModele(M, E.lot, sz), max = 0, det = [];
        ls.forEach(function(l){ var d = dispo(l); if (d > 0){ max += d; det.push(l.lot + " : " + fmt(d)); } });
        var inp = el("input", {type:"number", inputmode:"numeric", min:"0", value:String(E.q[sz] || 0)});
        function poser(q){ q = Math.max(0, Math.min(max, Math.round(q) || 0)); E.q[sz] = q; inp.value = String(q); majTot(); }
        inp.addEventListener("focus", function(){ try { inp.select(); } catch (er) {} });
        inp.addEventListener("input", function(){ var q = Math.max(0, num(inp.value)); if (q > max){ q = max; inp.value = String(q); toast("Taille " + sz + " : " + fmt(max) + " pièce(s) disponible(s) au maximum."); } E.q[sz] = q; majTot(); });
        art.appendChild(el("div", {class:"sx-row"}, el("div", {class:"sx-sz", text:sz}),
          el("div", {class:"sx-mid"}, el("div", {class:"sx-af", text:"Disponible " + fmt(max) + (E.lot === "auto" && det.length > 1 ? " (" + det.join(" · ") + ")" : "")}),
            el("div", {class:"sx-step"}, el("button", {text:"−", onclick:function(){ poser(num(inp.value) - 1); }}), inp, el("button", {text:"+", onclick:function(){ poser(num(inp.value) + 1); }}))),
          el("button", {class:"sx-def", title:"Tout le disponible", onclick:function(){ poser(R ? Math.min(max, Math.max(0, R.n - tot - sommeQ(sz))) : max); }}, el("span", {text:"Max"}))));
      });
      ajout.appendChild(art);
      ajout.appendChild(el("div", {class:"actions", style:"margin:10px 0 0;align-items:center"},
        el("button", {class:"btn", text:"➕ Ajouter dans le carton", onclick:function(){
          var e1 = ajouterAuBrouillon(M); if (e1){ toast(e1); return; }
          E.q = {}; E.m = null; E.lot = "auto"; render(true); }}),
        el("span", {class:"mut"}, "à ajouter : ", totAj, " pièce(s)")));
      majTot();
    }
  }
  function sommeQ(sauf){ var t = 0; Object.keys(E.q).forEach(function(s){ if (s !== sauf) t += E.q[s] || 0; }); return t; }
  /* répartit les quantités saisies sur les lignes de commande (la plus ancienne d'abord en automatique) */
  function ajouterAuBrouillon(M){
    var ajouts = [], err = "";
    Object.keys(E.q).forEach(function(sz){
      var q = E.q[sz] || 0; if (!q) return;
      lignesModele(M, E.lot, sz).forEach(function(l){ if (!q) return; var d = dispo(l) - ajouts.filter(function(a){ return a[0] === l.id; }).reduce(function(s, a){ return s + a[1]; }, 0); var p = Math.min(q, Math.max(0, d)); if (p > 0){ ajouts.push([l.id, p]); q -= p; } });
      if (q > 0) err = "Taille " + sz + " : il manque " + q + " pièce(s) disponible(s).";
    });
    if (err) return err;
    if (!ajouts.length) return "Saisissez au moins une quantité.";
    ajouts.forEach(function(a){ var x = E.it.filter(function(y){ return y[0] === a[0]; })[0]; if (x) x[1] += a[1]; else E.it.push([a[0], a[1]]); });
    return "";
  }
  v.appendChild(ajout);
  /* 3. enregistrer */
  var fin = el("div", {class:"card"});
  var kgI = el("input", {type:"number", inputmode:"decimal", step:"0.1", min:"0", value:E.kg, placeholder:R ? "auto (" + R.kg + " kg le carton plein)" : "facultatif", style:"max-width:220px"});
  kgI.addEventListener("input", function(){ E.kg = kgI.value; });
  fin.appendChild(el("div", {class:"row", style:"margin-bottom:8px"}, el("label", {text:"Poids brut du carton (kg)"}, kgI)));
  var msgs = [];
  var szs = {}; E.it.forEach(function(x){ var l = lineById(x[0]); if (l) szs[l.size] = 1; });
  if (R && t1 && Object.keys(szs).length > 1) msgs.push("⛔ Une seule taille par carton (" + e.cl + ").");
  if (R && tot > R.n) msgs.push((t1 ? "⛔ " : "⚠ ") + R.n + " pièces maximum par carton (" + e.cl + ").");
  if (msgs.length) fin.appendChild(el("div", {class:"msg", style:"background:#fff3cd;color:#5c3b00", text:msgs.join(" ")}));
  var bloque = !tot || msgs.some(function(m){ return m.charAt(0) === "⛔"; });
  function enregistrer(suivant){
    var c = {id:C.id || nid("XC"), n:E.n, kg:E.kg === "" ? null : (parseFloat(String(E.kg).replace(",", ".")) || 0), it:E.it.filter(function(x){ return x[1] > 0; })};
    var meme = c.it.map(function(x){ return [x[0], x[1]]; });
    var ok = commit(function(){
      /* contrôle final : rien au-delà du disponible (retour GADH, commande) */
      c.it.forEach(function(x){ var l = lineById(x[0]); if (!l) throw new Error("Ligne de commande introuvable."); var d = dispoLigne(l, e.cl, saufCt); if (x[1] > d) throw new Error(nomDoc(l.lib) + " taille " + l.size + " (commande " + l.lot + ") : " + d + " pièce(s) disponible(s) seulement."); });
      enregistrerCartonExport(e, c);
      ui.xp = suivant ? {id:e.id, carton:{nouveau:true, depuis:suivant === "meme" ? c.id : null}} : {id:e.id};
    });
    if (ok) toast("Carton N°" + c.n + (C.id ? " modifié" : " enregistré") + (suivant ? " — carton suivant" : ""));
    void meme;
  }
  var go = el("button", {class:"sx-go", text:C.id ? "✔ Enregistrer le carton" : "✔ Valider le carton", onclick:function(){ enregistrer(null); }});
  go.disabled = bloque;
  var acts = el("div", {class:"actions", style:"margin:8px 0 0"});
  if (!C.id){
    var b1 = el("button", {class:"btn sec", text:"✔ Valider et nouveau carton", onclick:function(){ enregistrer("vide"); }}); b1.disabled = bloque; acts.appendChild(b1);
    var b2 = el("button", {class:"btn sec", text:"✔ Valider et refaire le même", onclick:function(){ enregistrer("meme"); }}); b2.disabled = bloque; acts.appendChild(b2);
  }
  acts.appendChild(el("button", {class:"btn sec", text:"Annuler", onclick:function(){ ui.xp = {id:e.id}; render(); }}));
  fin.appendChild(el("div", {class:"sx-bar", style:"position:static;margin:0;padding:0;box-shadow:none;border:0"}, el("div", {class:"sx-bartxt"}, el("b", {text:fmt(tot)}), " pièce(s)"), go));
  fin.appendChild(acts);
  v.appendChild(fin);
}

/* ---------- documents ---------- */
function colisExport(e){
  return e.cartons.slice().sort(function(a, b){ return a.n - b.n; }).map(function(c){
    var items = [], q = 0;
    c.it.forEach(function(x){ var l = lineById(x[0]); if (!l || !x[1]) return; items.push({lineId:l.id, lib:l.lib, size:l.size, q:x[1], lot:l.lot, src:l.client}); q += x[1]; });
    items.sort(function(a, b){ return a.lib === b.lib ? (a.lot === b.lot ? sizeIdx(a.size) - sizeIdx(b.size) : (a.lot < b.lot ? -1 : 1)) : (a.lib < b.lib ? -1 : 1); });
    return {n:c.n, id:c.id, manuel:true, items:items, q:q, poids:Math.round(poidsDe(e, c) * 10) / 10, ouvert:false, lots:lotsDeCarton(c)};
  });
}
function avecDest(e, fn){ var avant = PK_DEST_FORCE; PK_DEST_FORCE = e.dest ? {client:e.cl, d:e.dest} : null; try { return fn(); } finally { PK_DEST_FORCE = avant; } }
function libelleLots(e){ return lotsExport(e).join(" + ") || "—"; }
function titreFichier(e, quoi){ return nomFichier(quoi + "_Export" + e.n + "_" + e.cl + "_" + e.d.replace(/-/g, "")); }
/* liste de colisage : une ligne par modèle et par commande dans chaque carton */
function colisageHtml(e, colis){
  var tailles = SZ.filter(function(t){ return colis.some(function(c){ return c.items.some(function(x){ return x.size === t; }); }); });
  var totT = {}, total = 0, ex = PK_EXPEDITEUR; tailles.forEach(function(t){ totT[t] = 0; });
  var corps = colis.map(function(c){
    var cles = [], par = {};
    c.items.forEach(function(x){ var k = x.lib + "|" + x.lot; if (!par[k]){ par[k] = {lib:x.lib, lot:x.lot, q:{}}; cles.push(k); } par[k].q[x.size] = (par[k].q[x.size] || 0) + x.q; totT[x.size] += x.q; total += x.q; });
    return cles.map(function(k, i){ var p = par[k], s = 0; tailles.forEach(function(t){ s += p.q[t] || 0; });
      return '<tr>' + (i === 0 ? '<td rowspan="' + cles.length + '">' + c.n + '</td>' : '') + '<td>' + hx(p.lot) + '</td><td class="gauche">' + hx(nomDoc(p.lib)) + '</td>' + tailles.map(function(t){ return "<td>" + (p.q[t] || "") + "</td>"; }).join("") + '<td><b>' + s + '</b></td></tr>'; }).join("");
  }).join("");
  return '<div class="col-entete"><div>Expéditeur : <b>' + hx(ex.nom) + '</b>' + ex.lignes.map(function(l){ return "<br>" + hx(l); }).join("") + ' <b>' + hx(ex.pays) + '</b><br>Date d\'export : le ' + dmyL(e.d) + '</div><div>' + destHtml(e.cl) + '</div></div>' +
    '<div class="col-info">Export N°' + e.n + ' · ' + hx(e.nat || e.cl) + ' · commandes ' + hx(lotsExport(e).join(", ")) + '</div>' +
    '<table class="col-tab"><thead><tr><th>N° colis</th><th>Commande</th><th>Référence</th>' + tailles.map(function(t){ return "<th>" + t + "</th>"; }).join("") + '<th>Total</th></tr></thead><tbody>' + corps +
    '</tbody><tfoot><tr><td colspan="3" class="gauche">Total t-shirt pour export</td>' + tailles.map(function(t){ return "<td>" + totT[t] + "</td>"; }).join("") + '<td>' + total + '</td></tr></tfoot></table>' +
    '<table class="col-pied"><tr><td>Nombre de colis</td><td>' + colis.length + '</td></tr><tr><td>Poids brut</td><td>' + (poidsTotal(colis) ? poidsTotal(colis) + " kg" : "") + '</td></tr></table>';
}
/* quantités de l'export par commande, puis état de chaque commande (commandé, expédié avant, cet export, reste) */
function totalDonneesExport(e, colis){
  var parLot = {}, lots = [];
  colis.forEach(function(c){ c.items.forEach(function(x){ var P = parLot[x.lot]; if (!P){ P = parLot[x.lot] = {libs:[], by:{}, total:0}; lots.push(x.lot); }
    var k = x.lib + "|" + x.src, b = P.by[k]; if (!b){ b = P.by[k] = {lib:x.lib, src:x.src, q:{}}; P.libs.push(b); } b.q[x.size] = (b.q[x.size] || 0) + x.q; P.total += x.q; }); });
  lots.sort();
  var cetExport = {}; colis.forEach(function(c){ c.items.forEach(function(x){ cetExport[x.lineId] = (cetExport[x.lineId] || 0) + x.q; }); });
  var avant = {}; S.moves.forEach(function(m){ if (m.stage === "exp" && m.ct !== e.id) avant[m.lineId] = (avant[m.lineId] || 0) + m.qty; });
  var etat = lots.map(function(lot){
    var rows = S.lines.filter(function(l){ return l.lot === lot && l.client === e.cl; }).sort(function(a, b){ return a.lib === b.lib ? sizeIdx(a.size) - sizeIdx(b.size) : (a.lib < b.lib ? -1 : 1); })
      .map(function(l){ var av = Math.max(0, avant[l.id] || 0), ce = cetExport[l.id] || 0; return {nom:nomDoc(l.lib).toUpperCase() + " " + l.size, cde:l.qty, av:av, ce:ce, reste:Math.max(0, l.qty - av - ce)}; });
    var T = {cde:0, av:0, ce:0, reste:0}; rows.forEach(function(r){ T.cde += r.cde; T.av += r.av; T.ce += r.ce; T.reste += r.reste; });
    return {lot:lot, rows:rows, T:T};
  });
  return {lots:lots, parLot:parLot, etat:etat, total:colis.reduce(function(s, c){ return s + c.q; }, 0)};
}
function totalHtml(e, colis){
  var D = totalDonneesExport(e, colis), h = '<div class="tot-info">Export N°' + e.n + ' du ' + dmyL(e.d) + ' · ' + hx((e.dest || destDefaut(e.cl)).nom) + '</div>';
  D.lots.forEach(function(lot){
    var P = D.parLot[lot];
    h += '<div class="tot-info" style="margin-top:4mm">Commande ' + hx(lot) + '</div><table class="tot-tab"><thead><tr><th>MODELE</th><th>QUANTITE</th></tr></thead><tbody>' +
      P.libs.map(function(b){ var nom = nomDoc(b.lib).toUpperCase() + (b.src !== e.cl ? " (SURPLUS " + b.src + ")" : ""), sizes = SZ.filter(function(s){ return s in b.q; });
        return '<tr class="tot-grp"><td>' + hx(nom) + '</td><td></td></tr>' + sizes.map(function(s){ return '<tr><td>' + hx(nomDoc(b.lib).toUpperCase()) + ' ' + s + '</td><td>' + b.q[s] + '</td></tr>'; }).join(""); }).join("") +
      '</tbody><tfoot><tr><td>TOTAL COMMANDE ' + hx(lot) + '</td><td>' + P.total + '</td></tr></tfoot></table>';
  });
  h += '<table class="tot-tab" style="margin-top:4mm"><tfoot><tr><td>TOTAL DE L\'EXPORT</td><td>' + D.total + '</td></tr></tfoot></table>';
  h += '<div class="tot-info" style="margin-top:6mm;break-before:page;page-break-before:always">État des commandes ' + hx(e.cl) + ' après cet export</div>';
  D.etat.forEach(function(E){
    h += '<div class="tot-info" style="font-size:11pt;margin-top:3mm">Commande ' + hx(E.lot) + '</div><table class="col-tab"><thead><tr><th>Modèle / taille</th><th>Commandé</th><th>Expédié avant</th><th>Cet export</th><th>Reste à expédier</th></tr></thead><tbody>' +
      E.rows.map(function(r){ return '<tr><td class="gauche">' + hx(r.nom) + '</td><td>' + r.cde + '</td><td>' + r.av + '</td><td><b>' + r.ce + '</b></td><td>' + r.reste + '</td></tr>'; }).join("") +
      '</tbody><tfoot><tr><td class="gauche">Total ' + hx(E.lot) + '</td><td>' + E.T.cde + '</td><td>' + E.T.av + '</td><td>' + E.T.ce + '</td><td>' + E.T.reste + '</td></tr></tfoot></table>';
  });
  return h;
}
function colisageGridX(e, colis){
  var tailles = SZ.filter(function(t){ return colis.some(function(c){ return c.items.some(function(x){ return x.size === t; }); }); });
  var nc = 4 + tailles.length, last = nc - 1, ex = PK_EXPEDITEUR, d = destDe(e.cl);
  var g = {cols:[10, 13, 34].concat(tailles.map(function(){ return 8; })).concat([9]), rows:[], merges:[], landscape:ori("col") === "landscape"}, r = 0, mid = Math.max(2, Math.floor(nc / 2));
  var gauche = ["Expéditeur : " + ex.nom].concat(ex.lignes).concat([ex.pays, "Date d'export : le " + dmyL(e.d)]);
  var droite = ["Destinataire :", d.nom].concat(d.lignes).concat(d.tel ? ["TÉLÉPHONE : " + d.tel] : []);
  for (var i = 0; i < Math.max(gauche.length, droite.length); i++){
    gset(g, r, 0, gauche[i] || "", {sz:10, al:"l", b:i === 0 ? 1 : 0}); gmerge(g, r, 0, r, mid - 1);
    gset(g, r, mid, droite[i] || "", {sz:10, al:"l", b:i > 0 && String(droite[i] || "").indexOf("TÉLÉPHONE") < 0 ? 1 : 0}); gmerge(g, r, mid, r, last); r++;
  }
  gset(g, r, 0, "Export N°" + e.n + " · " + (e.nat || e.cl) + " · commandes " + lotsExport(e).join(", "), {sz:9, al:"l"}); gmerge(g, r, 0, r, last); r += 2;
  var H = {b:1, sz:10, al:"c", bd:"t", bg:"EEEEEE"}, Cc = {sz:10, al:"c", bd:"t"};
  ["N° colis", "Commande", "Référence"].concat(tailles).concat(["Total"]).forEach(function(h, k){ gset(g, r, k, h, H); }); g.sticky = r + 1; r++;
  var totT = {}, total = 0; tailles.forEach(function(t){ totT[t] = 0; });
  colis.forEach(function(c){
    var cles = [], par = {};
    c.items.forEach(function(x){ var k = x.lib + "|" + x.lot; if (!par[k]){ par[k] = {lib:x.lib, lot:x.lot, q:{}}; cles.push(k); } par[k].q[x.size] = (par[k].q[x.size] || 0) + x.q; totT[x.size] += x.q; total += x.q; });
    var top = r;
    cles.forEach(function(k, j){ var p = par[k], s = 0;
      gset(g, r, 0, j ? "" : String(c.n), Cc); gset(g, r, 1, p.lot, Cc); gset(g, r, 2, nomDoc(p.lib), {sz:10, al:"l", bd:"t"});
      tailles.forEach(function(t, kk){ var q = p.q[t] || 0; s += q; gset(g, r, 3 + kk, q || "", Cc); });
      gset(g, r, last, s, {b:1, sz:10, al:"c", bd:"t"}); r++; });
    if (cles.length > 1) gmerge(g, top, 0, r - 1, 0);
  });
  var T = {b:1, sz:10, al:"c", bd:"t", bg:"EEEEEE"};
  gset(g, r, 0, "Total t-shirt pour export", {b:1, sz:10, al:"l", bd:"t", bg:"EEEEEE"}); gset(g, r, 1, "", T); gset(g, r, 2, "", T); gmerge(g, r, 0, r, 2);
  tailles.forEach(function(t, k){ gset(g, r, 3 + k, totT[t], T); }); gset(g, r, last, total, T); r += 2;
  gset(g, r, 0, "Nombre de colis", {sz:10, al:"l", bd:"t"}); gset(g, r, 1, "", {bd:"t"}); gmerge(g, r, 0, r, 1); gset(g, r, 2, colis.length, {b:1, sz:10, al:"l", bd:"t"}); r++;
  var pb = poidsTotal(colis);
  gset(g, r, 0, "Poids brut", {sz:10, al:"l", bd:"t"}); gset(g, r, 1, "", {bd:"t"}); gmerge(g, r, 0, r, 1); gset(g, r, 2, pb ? pb + " kg" : "", {b:1, sz:10, al:"l", bd:"t"});
  return g;
}
function totalGridX(e, colis){
  var D = totalDonneesExport(e, colis), g = {cols:[46, 16], rows:[], merges:[], landscape:ori("tot") === "landscape"}, r = 0;
  gset(g, r, 0, "Export N°" + e.n + " du " + dmyL(e.d) + " · " + (e.dest || destDefaut(e.cl)).nom, {b:1, sz:12, al:"l"}); gmerge(g, r, 0, r, 1); r += 2;
  D.lots.forEach(function(lot){
    var P = D.parLot[lot];
    gset(g, r, 0, "Commande " + lot, {b:1, sz:12, al:"l"}); gmerge(g, r, 0, r, 1); r++;
    gset(g, r, 0, "MODELE", {sz:11, al:"c", bd:"t"}); gset(g, r, 1, "QUANTITE", {sz:11, al:"c", bd:"t"}); r++;
    P.libs.forEach(function(b){ var nom = nomDoc(b.lib).toUpperCase();
      gset(g, r, 0, nom + (b.src !== e.cl ? " (SURPLUS " + b.src + ")" : ""), {b:1, sz:13, al:"l", bd:"t"}); gset(g, r, 1, "", {bd:"t"}); g.rows[r].h = 20; r++;
      SZ.filter(function(s){ return s in b.q; }).forEach(function(s){ gset(g, r, 0, nom + " " + s, {sz:11, al:"l", bd:"t"}); gset(g, r, 1, b.q[s], {sz:11, al:"c", bd:"t"}); r++; }); });
    gset(g, r, 0, "TOTAL COMMANDE " + lot, {b:1, sz:11, al:"l", bd:"t"}); gset(g, r, 1, P.total, {b:1, sz:11, al:"c", bd:"t"}); r += 2;
  });
  gset(g, r, 0, "TOTAL DE L'EXPORT", {b:1, sz:12, al:"l", bd:"t", bg:"EEEEEE"}); gset(g, r, 1, D.total, {b:1, sz:12, al:"c", bd:"t", bg:"EEEEEE"});
  return g;
}
function etatGridX(e, colis){
  var D = totalDonneesExport(e, colis), g = {cols:[40, 13, 15, 13, 17], rows:[], merges:[]}, r = 0, H = {b:1, sz:10, al:"c", bd:"t", bg:"EEEEEE"}, Cc = {sz:10, al:"c", bd:"t"};
  gset(g, r, 0, "État des commandes " + e.cl + " après l'export N°" + e.n + " du " + dmyL(e.d), {b:1, sz:12, al:"l"}); gmerge(g, r, 0, r, 4); r += 2;
  D.etat.forEach(function(E){
    gset(g, r, 0, "Commande " + E.lot, {b:1, sz:11, al:"l"}); gmerge(g, r, 0, r, 4); r++;
    ["Modèle / taille", "Commandé", "Expédié avant", "Cet export", "Reste à expédier"].forEach(function(h, k){ gset(g, r, k, h, H); }); r++;
    E.rows.forEach(function(x){ gset(g, r, 0, x.nom, {sz:10, al:"l", bd:"t"}); gset(g, r, 1, x.cde, Cc); gset(g, r, 2, x.av, Cc); gset(g, r, 3, x.ce, {b:1, sz:10, al:"c", bd:"t"}); gset(g, r, 4, x.reste, Cc); r++; });
    gset(g, r, 0, "Total " + E.lot, {b:1, sz:10, al:"l", bd:"t", bg:"EEEEEE"}); [E.T.cde, E.T.av, E.T.ce, E.T.reste].forEach(function(q, k){ gset(g, r, 1 + k, q, H); }); r += 2;
  });
  return g;
}
function imprimerX(e, quoi){
  var colis = colisExport(e), pp = PP_CHOIX.indexOf(ui.etqPP) >= 0 ? ui.etqPP : "4L", lot = libelleLots(e);
  avecDest(e, function(){
    if (quoi === "fiches") return imprimerDoc(docCartonsHtml(e.cl, colis, pp, lot), pp === "4L" ? "A4 landscape" : "A4 portrait", "8mm", titreFichier(e, "Fiches_cartons"));
    if (quoi === "colis") return imprimerDoc(colisageHtml(e, colis), "A4 " + ori("col"), "10mm", titreFichier(e, "Colisage"));
    if (quoi === "total") return imprimerDoc(totalHtml(e, colis), "A4 " + ori("tot"), "10mm", titreFichier(e, "Liste_total"));
    var css = "<style>@page fiches{size:A4 " + (pp === "4L" ? "landscape" : "portrait") + ";margin:8mm}@page colis{size:A4 " + ori("col") + ";margin:10mm}@page total{size:A4 " + ori("tot") + ";margin:10mm}" +
      "#pk-doc-zone .sec-fiches{page:fiches}#pk-doc-zone .sec-colis{page:colis;break-before:page;page-break-before:always}#pk-doc-zone .sec-total{page:total;break-before:page;page-break-before:always}</style>";
    imprimerDoc(css + '<div class="sec-fiches">' + docCartonsHtml(e.cl, colis, pp, lot) + '</div><div class="sec-colis">' + colisageHtml(e, colis) + '</div><div class="sec-total">' + totalHtml(e, colis) + '</div>', "A4 portrait", "8mm", titreFichier(e, "Export"));
  });
}
function excelX(e){
  var colis = colisExport(e), lot = libelleLots(e);
  avecDest(e, function(){
    var f = fichesCartonsGrid(lot, e.cl, colis, ui.etqPP);
    saveFile(titreFichier(e, "Export") + ".xlsx", xlsxBuild([
      {name:"Fiches cartons", grid:f.grid, first:1, image:{data:logoOctets(), ext:"jpeg"}, anchors:f.anchors},
      {name:"Liste de colisage", grid:colisageGridX(e, colis)},
      {name:"Liste total", grid:totalGridX(e, colis)},
      {name:"Etat des commandes", grid:etatGridX(e, colis)}]));
  });
}
function niceLabelX(e){
  var colis = colisExport(e);
  avecDest(e, function(){
    var rows = [NL_CHAMPS].concat(niceLabelLignes(libelleLots(e), e.cl, colis));
    var g = {cols:NL_CHAMPS.map(function(h){ return Math.max(12, h.length + 2); }), rows:[], merges:[]};
    rows.forEach(function(r, i){ r.forEach(function(v, k){ gset(g, i, k, v, {sz:10}); }); });
    saveFile(titreFichier(e, "NiceLabel_cartons") + ".xlsx", xlsxBuild([{name:"Etiquettes", grid:g, first:1}]));
  });
}
function docsCard(e){
  if (PP_CHOIX.indexOf(ui.etqPP) < 0) ui.etqPP = "4L";
  var c = el("div", {class:"card cartons"}, el("h2", {text:"Documents de l'export"}));
  c.appendChild(el("div", {class:"sx-tout"},
    el("div", {class:"mut", style:"font-weight:700;margin-bottom:6px", text:"Tout en un clic : fiches cartons + liste de colisage + liste total (par commande, avec l'état des commandes)"}),
    el("div", {class:"actions", style:"margin:0"},
      el("button", {class:"btn", text:"🖨 Tout imprimer", onclick:function(){ imprimerX(e, "tout"); }}),
      el("button", {class:"btn sec", text:"📗 Tout en Excel (4 feuilles)", onclick:function(){ excelX(e); }})),
    oriBloc()));
  var seg = el("div", {class:"seg"}, el("span", {class:"mut", style:"align-self:center", text:"Fiches cartons par page :"}));
  PP_CHOIX.forEach(function(n){ seg.appendChild(el("button", {class:ui.etqPP === n ? "on" : "", text:n === "4L" ? "4 (paysage)" : String(n), onclick:function(){ ui.etqPP = n; render(true); }})); });
  c.appendChild(seg);
  c.appendChild(el("div", {class:"actions", style:"margin:8px 0 0"},
    el("button", {class:"btn small sec", text:"🖨 Fiches cartons", onclick:function(){ imprimerX(e, "fiches"); }}),
    el("button", {class:"btn small sec", text:"🖨 Liste de colisage", onclick:function(){ imprimerX(e, "colis"); }}),
    el("button", {class:"btn small sec", text:"🖨 Liste total et état des commandes", onclick:function(){ imprimerX(e, "total"); }}),
    el("button", {class:"btn small sec", text:"🏷 Base NiceLabel (Excel)", onclick:function(){ niceLabelX(e); }})));
  return c;
}
/* pour les tests */
window.pkExports = {dispoLigne:dispoLigne, enregistrerCartonExport:enregistrerCartonExport, supprimerCartonExport:supprimerCartonExport, validerExport:validerExport, rouvrirExport:rouvrirExport, supprimerExport:supprimerExport, colisExport:colisExport, totalDonneesExport:totalDonneesExport, colisageHtml:colisageHtml, totalHtml:totalHtml};
})();
