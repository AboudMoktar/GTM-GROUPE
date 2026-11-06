/* =====================================================================
   SUIVI PERCKO — EXPORTS LIBRES (onglet « Exports », TEK-TREND)
   ---------------------------------------------------------------------
   Un export = une expédition : date, nature (NEOLYS ou ALLOGA), destinataire,
   et des cartons. Saisie LIBRE : pour chaque carton, on choisit le N° de commande
   (lot), même s'il n'est pas encore enregistré, puis n'importe quel modèle du
   catalogue et les quantités par taille. Un export peut contenir plusieurs commandes.
   - Pièce d'une commande enregistrée : comptée dans le suivi (contrôle + emballage) ;
     un dépassement du retour GADH est signalé, jamais bloqué.
   - Pièce d'une commande pas encore enregistrée : figure sur les documents ; elle est
     rattachée au suivi (bouton « Rattacher ») une fois la commande enregistrée.
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
  '.xp-tot{font-size:22px;font-weight:800}',
  '.xp-ligne{grid-template-columns:minmax(0,1fr) auto auto}.xp-lot{max-width:150px;height:34px;padding:0 6px;font-size:13px;margin-top:4px}',
  '.xp-step{display:flex;align-items:center;gap:4px}.xp-step button{width:34px;height:38px;border-radius:9px;border:1px solid var(--line);background:var(--sub);color:var(--ink);font-size:20px;font-weight:700;cursor:pointer}',
  '.xp-step input{width:58px;height:38px;text-align:center;font-size:17px;font-weight:800;padding:0 2px;background:var(--edit);border-color:var(--edit-line)}',
  '.xp-sticky{position:sticky;top:0;z-index:7;display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:10px 12px;background:var(--card);border:2px solid var(--ink);border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.12)}',
  '.xp-cnum{font-size:20px;font-weight:800}',
  '.xp-mx{border-collapse:separate;border-spacing:0;min-width:100%}.xp-mx th,.xp-mx td{border-bottom:1px solid var(--line);padding:3px;text-align:center;white-space:nowrap}',
  '.xp-mx th{font-size:12.5px;color:var(--mut);background:var(--sub);position:sticky;top:0}.xp-mx .m{text-align:left;position:sticky;left:0;background:var(--card);z-index:1;font-weight:700;font-size:13px;min-width:130px;max-width:170px;white-space:normal;padding:4px 8px}',
  '.xp-mx th.m{background:var(--sub);z-index:2}.xp-mx tr.dans .m{color:var(--ink)}.xp-mx tr:not(.dans) .m{color:var(--mut);font-weight:600}',
  '.xp-mx input{width:52px;height:38px;text-align:center;font-size:16px;font-weight:800;padding:0 2px;border:1px solid var(--line);border-radius:8px;background:var(--card)}',
  '.xp-mx input::placeholder{color:#a3acb9;font-weight:600}.xp-mx input.plein{background:var(--edit);border-color:var(--edit-line)}.xp-mx input.trop{background:#fde2e1;border-color:#b42318;color:#b42318}',
  '.xp-mx input::-webkit-inner-spin-button,.xp-mx input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.xp-mx input{-moz-appearance:textfield;appearance:textfield}',
  '.xp-mx td.x{color:#c8ced6}.xp-mx td.t{font-weight:800;min-width:44px}.xp-mx tfoot td{background:var(--sub);font-weight:800}.xp-mxw{margin:0 0 10px}',
  '.xp-step input::-webkit-inner-spin-button,.xp-step input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.xp-step input{-moz-appearance:textfield;appearance:textfield}'
].join('\n');
function poserCss(){ if (document.getElementById('xp-css')) return; var st = document.createElement('style'); st.id = 'xp-css'; st.textContent = CSS; document.head.appendChild(st); }

/* ---------- données ---------- */
function EX(){ return S.exports || (S.exports = []); }
function exportDe(id){ return EX().filter(function(e){ return e.id === id; })[0] || null; }
function clientsPossibles(){ var c = sortedUnique(S.lines.map(function(l){ return l.client; })); return c.length ? c : ["NEOLYS", "ALLOGA"]; }
function destDefaut(cl){ var d = PK_DESTINATAIRES[cl] || {nom:cl, lignes:[], tel:""}; return {nom:d.nom, lignes:d.lignes.slice(), tel:d.tel || ""}; }
function destTexte(d){ return [d.nom].concat(d.lignes || []).concat(d.tel ? ["Tél : " + d.tel] : []).join("\n"); }
function destDepuisTexte(t){ var ls = String(t || "").split(/\n/).map(function(x){ return x.trim(); }).filter(Boolean), tel = ""; ls = ls.filter(function(x){ var m = /^t[ée]l[ée]?(phone)?\s*:?\s*(.*)$/i.exec(x); if (m){ tel = m[2]; return false; } return true; }); return {nom:ls[0] || "", lignes:ls.slice(1), tel:tel}; }
/* pièce d'un carton : [lineId, quantité, lot, libellé, taille] ; lineId vide = commande pas encore enregistrée */
function infoItem(x){ var l = x[0] ? lineById(x[0]) : null; return {l:l, lot:l ? l.lot : x[2], lib:l ? l.lib : x[3], size:l ? l.size : x[4], src:l ? l.client : null}; }
/* ligne de commande correspondante : celle du client de l'export, sinon le surplus d'un client limité à sa commande */
function ligneDe(cl, lot, lib, size){
  var own = null, sur = null, R = regleColis(cl);
  S.lines.forEach(function(l){ if (l.lot !== lot || l.lib !== lib || l.size !== size) return; if (l.client === cl) own = l; else if (!(R && R.cde)){ var Ro = regleColis(l.client); if (Ro && Ro.cde && !sur) sur = l; } });
  return own || sur;
}
/* pièces saisies avant l'enregistrement de leur commande : rattachées dès que la commande existe */
function aRattacher(e){ var n = 0; e.cartons.forEach(function(c){ c.it.forEach(function(x){ if (!(x[0] && lineById(x[0])) && ligneDe(e.cl, x[2], x[3], x[4])) n += x[1]; }); }); return n; }
function rattacher(e){
  e.cartons.forEach(function(c){ c.it.forEach(function(x){ var l = x[0] ? lineById(x[0]) : null; if (l){ x[2] = l.lot; x[3] = l.lib; x[4] = l.size; return; } var l2 = ligneDe(e.cl, x[2], x[3], x[4]); x[0] = l2 ? l2.id : ""; }); });
  e.cartons.slice().forEach(function(c){ enregistrerCartonExport(e, c); });
  if (e.st === "fini") validerExport(e);
}
function qteCarton(c){ var q = 0; c.it.forEach(function(x){ q += x[1]; }); return q; }
function qteExport(e){ var q = 0; e.cartons.forEach(function(c){ q += qteCarton(c); }); return q; }
function lotsExport(e){ var o = {}; e.cartons.forEach(function(c){ c.it.forEach(function(x){ var i = infoItem(x); if (i.lot) o[i.lot] = 1; }); }); return Object.keys(o).sort(); }
function lotsDeCarton(c){ var o = {}; c.it.forEach(function(x){ var i = infoItem(x); if (i.lot) o[i.lot] = 1; }); return Object.keys(o).sort(); }
function poidsDe(e, c){ if (c.kg !== null && c.kg !== undefined && c.kg !== "") return +c.kg || 0; var R = regleColis(e.cl); return R ? poidsCarton(R, qteCarton(c)) : 0; }

/* pièces encore disponibles pour l'export de nature cl, sur une ligne de commande (hors un carton en modification) */
function dispoLigne(l, cl, saufCt){
  var ret = dispoRetour(l.lot, l.id, saufCt), R = regleColis(cl);
  if (l.client === cl) return Math.min(ret, (R && R.cde) ? Math.max(0, l.qty - enCarton(l.lot, cl, l.id, saufCt)) : Infinity);
  /* surplus d'un client limité à sa commande (ex. surplus ALLOGA sur un export NEOLYS) : ce qui dépasse sa commande */
  var Ro = regleColis(l.client); if (!(Ro && Ro.cde) || (R && R.cde)) return 0;
  return Math.max(0, ret - Math.max(0, l.qty - enCarton(l.lot, l.client, l.id, null)));
}
/* ---------- mouvements (contrôle + emballage par carton ; prêt + expédié à la validation) ---------- */
function mvtsCarton(e, c){
  var out = [];
  c.it.forEach(function(x){ if (!x[1] || !x[0] || !lineById(x[0])) return;
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
  e.cartons.forEach(function(c){ c.it.forEach(function(x){ if (!x[1] || !x[0] || !lineById(x[0])) return;
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
  c.it.forEach(function(x){ var i = infoItem(x), k = i.lib + "|" + i.lot + "|" + (i.src || ""); if (!par[k]){ par[k] = {i:i, t:[]}; ordre.push(k); } par[k].t.push([i.size, x[1]]); });
  return ordre.map(function(k){ var p = par[k], i = p.i; p.t.sort(function(a, b){ return sizeIdx(a[0]) - sizeIdx(b[0]); });
    return el("div", {class:"lg"}, el("b", {text:nomDoc(i.lib)}), " ", el("span", {text:"(" + i.lot + (!i.l ? " · pas encore enregistrée" : i.src !== ui.xpCl ? " · surplus " + i.src : "") + ")"}), " : " + p.t.map(function(t){ return t[0] + " " + t[1]; }).join(" · ")); });
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
  var ar = aRattacher(e), libres = 0; e.cartons.forEach(function(c){ c.it.forEach(function(x){ if (!(x[0] && lineById(x[0]))) libres += x[1]; }); });
  if (ar) v.appendChild(el("div", {class:"sx-tout", style:"margin-bottom:12px"},
    el("div", {style:"font-weight:700", text:fmt(ar) + " pièce(s) concernent des commandes maintenant enregistrées."}),
    el("div", {class:"mut", style:"margin:4px 0 8px", text:"Rattachez-les pour qu'elles comptent dans le suivi de ces commandes (emballées" + (fini ? ", expédiées" : "") + ")."}),
    el("button", {class:"btn", text:"Rattacher aux commandes", onclick:function(){ commit(function(){ rattacher(e); }, "Pièces rattachées aux commandes"); }})));
  else if (libres) v.appendChild(el("div", {class:"msg", style:"margin:0 0 12px", text:fmt(libres) + " pièce(s) sur des commandes pas encore enregistrées : elles figurent sur les documents ; elles seront rattachées au suivi quand la commande sera enregistrée."}));
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
  e.cartons.forEach(function(c){ c.it.forEach(function(x){ var i = infoItem(x); if (!(i.lot in par)){ par[i.lot] = 0; lots.push(i.lot); } par[i.lot] += x[1]; }); });
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

/* ---------- éditeur de carton (saisie libre) ----------
   1. N° de commande (lot) : une commande enregistrée, ou un autre N° (commande pas encore inscrite).
   2. Tous les modèles du catalogue (nomenclature), ceux de la commande en premier.
   3. Quantités libres par taille : les chiffres de la commande (commandé, retour GADH, déjà en carton)
      sont affichés pour information ; un dépassement est signalé, jamais bloqué. */
function catalogueModeles(lot, cl){
  var o = [], par = {};
  function aj(lib, size, dans){ var m = par[lib]; if (!m){ m = par[lib] = {lib:lib, sizes:[], dans:false}; o.push(m); } if (size && m.sizes.indexOf(size) < 0) m.sizes.push(size); if (dans) m.dans = true; }
  S.lines.forEach(function(l){ if (l.lot === lot) aj(l.lib, l.size, l.client === cl); });
  libList().forEach(function(x){ x.sizes.forEach(function(s){ aj(x.lib, s, false); }); });
  o.forEach(function(m){ m.sizes.sort(function(a, b){ return sizeIdx(a) - sizeIdx(b); }); });
  var ordre = libOrder();
  return o.sort(function(a, b){ return (b.dans - a.dans) || ((a.lib in ordre ? ordre[a.lib] : 999) - (b.lib in ordre ? ordre[b.lib] : 999)) || (a.lib < b.lib ? -1 : 1); });
}
function editeurCarton(v, e){
  if (e.st === "fini"){ ui.xp = {id:e.id}; return ficheExport(v, e); }
  var C = ui.xp.carton;
  if (!C.etat){
    var src = C.id ? e.cartons.filter(function(x){ return x.id === C.id; })[0] : C.depuis ? e.cartons.filter(function(x){ return x.id === C.depuis; })[0] : null;
    var n = 0; e.cartons.forEach(function(x){ if (x.n > n) n = x.n; });
    var dernier = null; e.cartons.forEach(function(c){ c.it.forEach(function(x){ dernier = infoItem(x).lot; }); });
    C.etat = {it:src ? src.it.map(function(x){ return x.slice(); }) : [], kg:C.id && src && src.kg !== null && src.kg !== undefined ? String(src.kg) : "", n:C.id && src ? src.n : n + 1,
      lot:(src && src.it[0] ? infoItem(src.it[0]).lot : dernier) || sortedUnique(S.lines.map(function(l){ return l.lot; })).pop() || null, tous:false};
  }
  var E = C.etat, saufCt = C.id || null, R = regleColis(e.cl), t1 = !!(R && R.t1), nbC = e.cartons.length + (C.id ? 0 : 1);
  var lotsConnus = sortedUnique(S.lines.map(function(l){ return l.lot; })).reverse();
  function itemDe(lot, lib, size){ return E.it.filter(function(y){ var i = infoItem(y); return i.lot === lot && i.lib === lib && i.size === size; })[0]; }
  function total(){ var t = 0; E.it.forEach(function(x){ t += x[1]; }); return t; }
  /* bandeau toujours visible : dans quel carton on est */
  var totEl = el("b", {class:"xp-tot", text:fmt(total())});
  v.appendChild(el("div", {class:"xp-sticky"},
    el("button", {class:"btn small sec", text:"←", title:"Retour à l'export", onclick:function(){ ui.xp = {id:e.id}; render(); }}),
    el("div", {style:"flex:1;min-width:0"}, el("div", {class:"xp-cnum", text:"📦 Carton N°" + E.n + (C.id ? "" : " (nouveau)")}),
      el("div", {class:"mut", style:"font-size:12.5px", text:"Export N°" + e.n + " · " + e.cl + " · " + dmyL(e.d) + " · carton " + E.n + " sur " + nbC})),
    el("div", {style:"text-align:right"}, totEl, el("div", {class:"mut", style:"font-size:12px", text:"pièces"}))));
  /* 1. commande (lot) */
  var cc = el("div", {class:"card"}, el("div", {class:"mut", style:"font-weight:700;margin:0 0 6px", text:"Commande (N° de lot)"}));
  var lc = el("div", {class:"xp-cmd"});
  sortedUnique(lotsConnus.concat(E.lot ? [E.lot] : [])).reverse().forEach(function(lot){ lc.appendChild(el("button", {class:"sx-chip" + (E.lot === lot ? " on" : ""), text:(E.lot === lot ? "✓ " : "") + lot + (lotsConnus.indexOf(lot) < 0 ? " (non enregistrée)" : ""), onclick:function(){ E.lot = lot; render(true); }})); });
  var autre = el("input", {type:"text", placeholder:"Autre N° (ex. PK202612)", style:"max-width:200px;text-transform:uppercase"});
  function prendreAutre(){ var t = String(autre.value || "").trim().toUpperCase().replace(/\s+/g, ""); if (!t){ toast("Écrivez le N° de lot."); return; } E.lot = t; render(true); }
  autre.addEventListener("keydown", function(ev){ if (ev.key === "Enter"){ ev.preventDefault(); prendreAutre(); } });
  lc.appendChild(el("span", {style:"display:inline-flex;gap:6px;align-items:center"}, autre, el("button", {class:"btn small sec", text:"OK", onclick:prendreAutre})));
  cc.appendChild(lc);
  var autresLots = {}; E.it.forEach(function(x){ var i = infoItem(x); if (i.lot !== E.lot) autresLots[i.lot] = (autresLots[i.lot] || 0) + x[1]; });
  Object.keys(autresLots).forEach(function(lot){ cc.appendChild(el("div", {class:"msg", style:"margin:8px 0 0"}, "Ce carton contient aussi " + fmt(autresLots[lot]) + " pièce(s) de la commande " + lot + ". ", el("button", {class:"btn small sec", text:"Voir " + lot, onclick:function(){ E.lot = lot; render(true); }}))); });
  v.appendChild(cc);
  if (!E.lot){ v.appendChild(el("div", {class:"card"}, el("div", {class:"xp-vide", text:"Choisissez la commande (N° de lot)."}))); return; }
  /* 2. tableau : un modèle par ligne, une taille par colonne ; on tape les quantités directement */
  var mods = catalogueModeles(E.lot, e.cl), dansCmd = mods.some(function(m){ return m.dans; });
  var dansCarton = {}; E.it.forEach(function(x){ var i = infoItem(x); if (i.lot === E.lot) dansCarton[i.lib] = 1; });
  var montres = mods.filter(function(m){ return E.tous || !dansCmd || m.dans || dansCarton[m.lib]; });
  var groupes = [], parG = {};
  montres.forEach(function(m){ var k = m.sizes.every(function(z){ return /^H\d/.test(z); }) ? "H" : (m.sizes.length === 1 && m.sizes[0] === "TU") ? "TU" : "STD";
    var g = parG[k]; if (!g){ g = parG[k] = {k:k, mods:[], tailles:[]}; groupes.push(g); } g.mods.push(m); m.sizes.forEach(function(z){ if (g.tailles.indexOf(z) < 0) g.tailles.push(z); }); });
  groupes.forEach(function(g){ g.tailles.sort(function(a, b){ return sizeIdx(a) - sizeIdx(b); }); });
  groupes.sort(function(a, b){ return ["STD", "H", "TU"].indexOf(a.k) - ["STD", "H", "TU"].indexOf(b.k); });
  var mx = el("div", {class:"card"}, el("div", {class:"xp-head"}, el("div", {class:"mut", style:"font-weight:700", text:"Quantités du carton — commande " + E.lot}),
    dansCmd ? el("button", {class:"btn small sec", text:E.tous ? "Seulement les modèles de la commande" : "Afficher tous les modèles", onclick:function(){ E.tous = !E.tous; render(true); }}) : null));
  mx.appendChild(el("div", {class:"mut", style:"font-size:12.5px;margin:4px 0 8px", text:"Chiffre gris dans une case = pièces revenues de la GADH pas encore mises en carton. Case rouge = plus que le retour GADH."}));
  var majs = [];
  function recalc(){ totEl.textContent = fmt(total()); majs.forEach(function(f){ f(); }); }
  groupes.forEach(function(g){
    var t = el("table", {class:"xp-mx"}), th = el("tr", null, el("th", {class:"m", text:"Modèle"}));
    g.tailles.forEach(function(z){ th.appendChild(el("th", {text:z})); }); th.appendChild(el("th", {text:"Total"}));
    t.appendChild(el("thead", null, th));
    var tb = el("tbody");
    g.mods.forEach(function(m){
      var tr = el("tr", {class:m.dans ? "dans" : ""}, el("td", {class:"m", text:nomDoc(m.lib)}));
      var totRow = el("td", {class:"t"});
      g.tailles.forEach(function(z){
        if (m.sizes.indexOf(z) < 0){ tr.appendChild(el("td", {class:"x", text:"·"})); return; }
        var l = ligneDe(e.cl, E.lot, m.lib, z), reste = l ? Math.max(0, retourGadh(l.id) - totalEnCartons(l.lot, l.id, saufCt)) : null, it0 = itemDe(E.lot, m.lib, z);
        var inp = el("input", {type:"number", inputmode:"numeric", min:"0", value:it0 ? String(it0[1]) : "", placeholder:reste ? String(reste) : "", title:nomDoc(m.lib) + " · " + z + (l ? " — commandé " + l.qty + ", retour GADH " + retourGadh(l.id) + ", reste " + reste : " — hors commande")});
        function marquer(){ var x = itemDe(E.lot, m.lib, z), q = x ? x[1] : 0; inp.className = (q && l && q > reste) ? "trop" : q ? "plein" : ""; }
        inp.addEventListener("focus", function(){ try { inp.select(); } catch (er) {} });
        inp.addEventListener("input", function(){
          var q = Math.max(0, num(inp.value)), x = itemDe(E.lot, m.lib, z);
          if (x){ if (q) x[1] = q; else E.it.splice(E.it.indexOf(x), 1); } else if (q) E.it.push([l ? l.id : "", q, E.lot, m.lib, z]);
          marquer(); recalc(); });
        marquer();
        tr.appendChild(el("td", null, inp));
      });
      majs.push(function(){ var s = 0; m.sizes.forEach(function(z){ var x = itemDe(E.lot, m.lib, z); if (x) s += x[1]; }); totRow.textContent = s ? fmt(s) : ""; });
      tr.appendChild(totRow); tb.appendChild(tr);
    });
    t.appendChild(tb);
    var tf = el("tr", null, el("td", {class:"m", text:"Total"}));
    g.tailles.forEach(function(z){ var td = el("td", {class:"t"}); majs.push(function(){ var s = 0; g.mods.forEach(function(m){ var x = itemDe(E.lot, m.lib, z); if (x) s += x[1]; }); td.textContent = s ? fmt(s) : ""; }); tf.appendChild(td); });
    var tdT = el("td", {class:"t"}); majs.push(function(){ var s = 0; g.mods.forEach(function(m){ m.sizes.forEach(function(z){ var x = itemDe(E.lot, m.lib, z); if (x) s += x[1]; }); }); tdT.textContent = s ? fmt(s) : ""; }); tf.appendChild(tdT);
    t.appendChild(el("tfoot", null, tf));
    mx.appendChild(el("div", {class:"tw xp-mxw"}, t));
  });
  v.appendChild(mx);
  recalc();
  /* 3. valider */
  var fin = el("div", {class:"card"});
  var kgI = el("input", {type:"number", inputmode:"decimal", step:"0.1", min:"0", value:E.kg, placeholder:R ? "auto (" + R.kg + " kg le carton plein)" : "facultatif", style:"max-width:220px"});
  kgI.addEventListener("input", function(){ E.kg = kgI.value; });
  fin.appendChild(el("div", {class:"row", style:"margin-bottom:8px"}, el("label", {text:"Poids brut du carton (kg)"}, kgI)));
  function enregistrer(suivant){
    var c = {id:C.id || nid("XC"), n:E.n, kg:E.kg === "" ? null : (parseFloat(String(E.kg).replace(",", ".")) || 0), it:E.it.filter(function(x){ return x[1] > 0; }).map(function(x){ return x.slice(); })};
    if (!c.it.length){ toast("Le carton est vide."); return; }
    var szs = {}; c.it.forEach(function(x){ szs[infoItem(x).size] = 1; });
    var av = []; if (R && t1 && Object.keys(szs).length > 1) av.push("plusieurs tailles (règle " + e.cl + " : une seule)"); if (R && total() > R.n) av.push("plus de " + R.n + " pièces (règle " + e.cl + ")");
    if (av.length && !confirm("Attention : " + av.join(", ") + ".\nValider quand même ?")) return;
    var ok = commit(function(){ enregistrerCartonExport(e, c); ui.xp = suivant ? {id:e.id, carton:{nouveau:true}} : {id:e.id}; if (suivant) ui.xp.carton.etat = {it:[], kg:"", n:Math.max.apply(null, e.cartons.map(function(x){ return x.n; })) + 1, lot:E.lot, tous:E.tous}; });
    if (ok) toast("Carton N°" + c.n + (C.id ? " modifié" : " enregistré") + (suivant ? " — carton N°" + (c.n + 1) : ""));
  }
  fin.appendChild(el("div", {class:"actions"},
    el("button", {class:"sx-go", style:"flex:1 1 220px", text:C.id ? "✔ Enregistrer le carton N°" + E.n : "✔ Valider le carton N°" + E.n, onclick:function(){ enregistrer(false); }}),
    C.id ? null : el("button", {class:"btn sec", text:"✔ Valider et carton suivant", onclick:function(){ enregistrer(true); }}),
    el("button", {class:"btn sec", text:"Annuler", onclick:function(){ ui.xp = {id:e.id}; render(); }})));
  v.appendChild(fin);
}

/* ---------- documents ---------- */
/* ---------- liste total au format de la commande PERCKO ----------
   Model | LIBELLE | Taille | Quantité | Total : toutes les références du client (comme la commande),
   avec les quantités de l'export (par commande, ou pour tout l'export « sans lot »). */
function couleurLib(lib){
  var m = FM.filter(function(x){ return x[0] === lib; })[0]; if (m) return [m[5], m[6]];
  var t = String(lib).toLowerCase();
  if (/noir/.test(t)) return ["595959", "FFFFFF"]; if (/sable|beige/.test(t)) return ["DEDC86", "000000"]; if (/rose/.test(t)) return ["FFC0CB", "000000"]; if (/gris/.test(t)) return ["D9D9D9", "000000"];
  return ["FFFFFF", "000000"];
}
function totalCommandeGrid(e, colis, lot){
  var q = {}, lotsE = lotsExport(e);
  colis.forEach(function(c){ c.items.forEach(function(x){ if (lot && x.lot !== lot) return; var k = x.lib + "|" + x.size; q[k] = (q[k] || 0) + x.q; }); });
  var libs = clientLibs(lot || lotsE[0] || "", e.cl), vus = {};
  libs.forEach(function(l){ vus[l.lib] = l; });
  Object.keys(q).forEach(function(k){ var p = k.split("|"); if (!vus[p[0]]){ vus[p[0]] = {lib:p[0], model:modelOf(p[0]) || p[0], sizes:[]}; libs.push(vus[p[0]]); } if (vus[p[0]].sizes.indexOf(p[1]) < 0){ vus[p[0]].sizes.push(p[1]); vus[p[0]].sizes.sort(function(a, b){ return sizeIdx(a) - sizeIdx(b); }); } });
  var g = {cols:[20, 44, 8, 12, 12], rows:[], merges:[]}, B = {b:1, sz:11, al:"c", bd:"t"};
  gset(g, 0, 0, "Export N°" + e.n + " — " + dmyL(e.d) + " — " + (e.dest || destDefaut(e.cl)).nom, {b:1, sz:11}); gmerge(g, 0, 0, 0, 2);
  gset(g, 0, 3, "LOT", B); gset(g, 0, 4, "DATE", B);
  gset(g, 1, 3, lot || lotsE.join(" + ") || "", B); gset(g, 1, 4, dmyL(e.d), B);
  ["Model", "LIBELLE", "Taille", "Quantité", "Total"].forEach(function(h, i){ gset(g, 3, i, h, {b:1, sz:11, fg:"C00000", al:"c", bd:"m"}); });
  var r = 4, pm = null, tops = {}, mtop = null, grand = 0;
  libs.forEach(function(li){
    if (!li.sizes.length) return;
    var top = r, tot = 0, col = couleurLib(li.lib);
    li.sizes.forEach(function(z){
      var v = q[li.lib + "|" + z] || 0; tot += v;
      gset(g, r, 0, "", {b:1, sz:10, al:"c", bd:"t"}); gset(g, r, 1, li.lib, {sz:9, al:"l", bd:"t", bg:col[0], fg:col[1]});
      gset(g, r, 2, z, {b:1, sz:10, al:"c", bd:"t"}); gset(g, r, 3, v || "", {b:1, sz:11, al:"c", bd:"t"}); gset(g, r, 4, "", {b:1, sz:11, al:"c", bd:"t"}); r++;
    });
    g.rows[top].cells[4].v = tot || ""; if (r - 1 > top) gmerge(g, top, 4, r - 1, 4); grand += tot;
    if (li.model !== pm){ mtop = top; g.rows[top].cells[0].v = li.model; pm = li.model; tops[top] = r - 1; } else tops[mtop] = r - 1;
  });
  Object.keys(tops).forEach(function(t){ if (tops[t] > +t) gmerge(g, +t, 0, tops[t], 0); });
  gset(g, r, 0, "TOTAL", {b:1, sz:11, al:"l", bd:"m", bg:"EEEEEE"}); gset(g, r, 1, "", {bd:"m", bg:"EEEEEE"}); gset(g, r, 2, "", {bd:"m", bg:"EEEEEE"}); gmerge(g, r, 0, r, 2);
  gset(g, r, 3, grand, {b:1, sz:11, al:"c", bd:"m", bg:"EEEEEE"}); gset(g, r, 4, grand, {b:1, sz:11, al:"c", bd:"m", bg:"EEEEEE"});
  g.sticky = 4;
  return g;
}
/* grille → tableau HTML pour l'impression (fusions, couleurs, gras) */
function grilleHtml(g){
  var cov = {}, mAt = {}, tot = 0; g.cols.forEach(function(w){ tot += w; });
  g.merges.forEach(function(m){ mAt[m[0] + "," + m[1]] = m; for (var r = m[0]; r <= m[2]; r++) for (var c = m[1]; c <= m[3]; c++) if (r !== m[0] || c !== m[1]) cov[r + "," + c] = 1; });
  var h = '<table class="grl"><colgroup>' + g.cols.map(function(w){ return '<col style="width:' + (100 * w / tot).toFixed(1) + '%">'; }).join("") + '</colgroup>';
  g.rows.forEach(function(row, ri){
    h += "<tr>";
    for (var ci = 0; ci < g.cols.length; ci++){
      if (cov[ri + "," + ci]) continue;
      var cell = row.cells[ci], m = mAt[ri + "," + ci], st = (cell && cell.st) || {}, v = cell ? cell.v : "";
      var css = (st.bd ? "border:" + (st.bd === "m" ? "1.5px" : "1px") + " solid #000;" : "border:0;") + (st.bg ? "background:#" + st.bg + ";" : "") + (st.fg ? "color:#" + st.fg + "!important;" : "") + (st.b ? "font-weight:bold;" : "") + "text-align:" + (st.al === "l" ? "left" : st.al === "r" ? "right" : "center") + ";" + (st.sz ? "font-size:" + (st.sz * 0.85).toFixed(1) + "pt!important;" : "");
      h += "<td" + (m ? ' rowspan="' + (m[2] - m[0] + 1) + '" colspan="' + (m[3] - m[1] + 1) + '"' : "") + ' style="' + css + '">' + (v === "" || v === null || v === undefined ? "" : hx(typeof v === "number" ? fmt(v) : v)) + "</td>";
    }
    h += "</tr>";
  });
  return h + "</table>";
}


function colisExport(e){
  return e.cartons.slice().sort(function(a, b){ return a.n - b.n; }).map(function(c){
    var items = [], q = 0;
    c.it.forEach(function(x){ if (!x[1]) return; var i = infoItem(x); items.push({lineId:i.l ? i.l.id : null, lib:i.lib, size:i.size, q:x[1], lot:i.lot, src:i.src || e.cl}); q += x[1]; });
    items.sort(function(a, b){ return a.lib === b.lib ? (a.lot === b.lot ? sizeIdx(a.size) - sizeIdx(b.size) : (a.lot < b.lot ? -1 : 1)) : (a.lib < b.lib ? -1 : 1); });
    return {n:c.n, id:c.id, manuel:true, items:items, q:q, poids:Math.round(poidsDe(e, c) * 10) / 10, ouvert:false, lots:lotsDeCarton(c)};
  });
}
function avecDest(e, fn){ var avant = PK_DEST_FORCE; PK_DEST_FORCE = e.dest ? {client:e.cl, d:e.dest} : null; try { return fn(); } finally { PK_DEST_FORCE = avant; } }
function libelleLots(e){ return lotsExport(e).join(" + ") || "—"; }
function titreFichier(e, quoi){ return nomFichier(quoi + "_Export" + e.n + "_" + e.cl + "_" + e.d.replace(/-/g, "")); }
/* liste de colisage : une ligne par modèle et par commande dans chaque carton */
function colisageHtml(e, colis, sansLot){
  var tailles = SZ.filter(function(t){ return colis.some(function(c){ return c.items.some(function(x){ return x.size === t; }); }); });
  var totT = {}, total = 0, ex = PK_EXPEDITEUR; tailles.forEach(function(t){ totT[t] = 0; });
  var corps = colis.map(function(c){
    var cles = [], par = {};
    c.items.forEach(function(x){ var k = sansLot ? x.lib : x.lib + "|" + x.lot; if (!par[k]){ par[k] = {lib:x.lib, lot:x.lot, q:{}}; cles.push(k); } par[k].q[x.size] = (par[k].q[x.size] || 0) + x.q; totT[x.size] += x.q; total += x.q; });
    return cles.map(function(k, i){ var p = par[k], s = 0; tailles.forEach(function(t){ s += p.q[t] || 0; });
      return '<tr>' + (i === 0 ? '<td rowspan="' + cles.length + '">' + c.n + '</td>' : '') + '<td>' + hx(sansLot ? "PERCKO" : p.lot) + '</td><td class="gauche">' + hx(nomDoc(p.lib)) + '</td>' + tailles.map(function(t){ return "<td>" + (p.q[t] || "") + "</td>"; }).join("") + '<td><b>' + s + '</b></td></tr>'; }).join("");
  }).join("");
  return '<div class="col-entete"><div>Expéditeur : <b>' + hx(ex.nom) + '</b>' + ex.lignes.map(function(l){ return "<br>" + hx(l); }).join("") + ' <b>' + hx(ex.pays) + '</b><br>Date d\'export : le ' + dmyL(e.d) + '</div><div>' + destHtml(e.cl) + '</div></div>' +
    '<div class="col-info">Export N°' + e.n + ' · ' + hx(e.nat || e.cl) + (sansLot ? '' : ' · commandes ' + hx(lotsExport(e).join(", "))) + '</div>' +
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
  var cetExport = {}, libres = {}; colis.forEach(function(c){ c.items.forEach(function(x){ if (x.lineId) cetExport[x.lineId] = (cetExport[x.lineId] || 0) + x.q; else { var k = x.lot + "|" + x.lib + "|" + x.size; libres[k] = (libres[k] || 0) + x.q; } }); });
  var avant = {}; S.moves.forEach(function(m){ if (m.stage === "exp" && m.ct !== e.id) avant[m.lineId] = (avant[m.lineId] || 0) + m.qty; });
  var etat = lots.map(function(lot){
    var rows = S.lines.filter(function(l){ return l.lot === lot && l.client === e.cl; }).sort(function(a, b){ return a.lib === b.lib ? sizeIdx(a.size) - sizeIdx(b.size) : (a.lib < b.lib ? -1 : 1); })
      .map(function(l){ var av = Math.max(0, avant[l.id] || 0), ce = cetExport[l.id] || 0; return {nom:nomDoc(l.lib).toUpperCase() + " " + l.size, cde:l.qty, av:av, ce:ce, reste:Math.max(0, l.qty - av - ce)}; });
    /* pièces sur une commande pas encore enregistrée */
    Object.keys(libres).filter(function(k){ return k.split("|")[0] === lot; }).sort(function(a, b){ var A = a.split("|"), B = b.split("|"); return A[1] === B[1] ? sizeIdx(A[2]) - sizeIdx(B[2]) : (A[1] < B[1] ? -1 : 1); })
      .forEach(function(k){ var p = k.split("|"); rows.push({nom:nomDoc(p[1]).toUpperCase() + " " + p[2] + " (non enregistrée)", cde:null, av:null, ce:libres[k], reste:null}); });
    var T = {cde:0, av:0, ce:0, reste:0}; rows.forEach(function(r){ T.cde += r.cde || 0; T.av += r.av || 0; T.ce += r.ce; T.reste += r.reste || 0; });
    return {lot:lot, rows:rows, T:T};
  });
  return {lots:lots, parLot:parLot, etat:etat, total:colis.reduce(function(s, c){ return s + c.q; }, 0)};
}
/* liste total sans lot : quantités de tout l'export par modèle et taille (format habituel) */
function totalSansLot(colis){
  var libs = [], by = {}, total = 0;
  colis.forEach(function(c){ c.items.forEach(function(x){ var b = by[x.lib]; if (!b){ b = by[x.lib] = {lib:x.lib, q:{}}; libs.push(b); } b.q[x.size] = (b.q[x.size] || 0) + x.q; total += x.q; }); });
  return {grp:libs.map(function(b){ var nom = nomDoc(b.lib).toUpperCase(); return {nom:nom, rows:SZ.filter(function(z){ return z in b.q; }).map(function(z){ return [nom + " " + z, b.q[z]]; })}; }), total:total};
}
function totalHtml(e, colis, sansLot){
  var css = '<style>#pk-doc-zone table.grl{width:100%;border-collapse:collapse;font-size:9pt}#pk-doc-zone table.grl td{padding:0.8mm 1.5mm;line-height:1.2}#pk-doc-zone table.grl tr{break-inside:avoid;page-break-inside:avoid}#pk-doc-zone .grl-saut{break-before:page;page-break-before:always}</style>';
  if (sansLot) return css + grilleHtml(totalCommandeGrid(e, colis, null));
  return css + lotsExport(e).map(function(lot, i){ return '<div' + (i ? ' class="grl-saut"' : '') + '>' + grilleHtml(totalCommandeGrid(e, colis, lot)) + '</div>'; }).join("");
}
function totalHtmlAncien(e, colis, sansLot){
  if (sansLot){ var T = totalSansLot(colis);
    return '<div class="tot-info">Export N°' + e.n + ' du ' + dmyL(e.d) + ' ' + hx((e.dest || destDefaut(e.cl)).nom) + '</div><table class="tot-tab"><thead><tr><th>MODELE</th><th>QUANTITE</th></tr></thead><tbody>' +
      T.grp.map(function(g){ return '<tr class="tot-grp"><td>' + hx(g.nom) + '</td><td></td></tr>' + g.rows.map(function(r){ return '<tr><td>' + hx(r[0]) + '</td><td>' + r[1] + '</td></tr>'; }).join(""); }).join("") +
      '</tbody><tfoot><tr><td>TOTAL</td><td>' + T.total + '</td></tr></tfoot></table>'; }
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
      E.rows.map(function(r){ var t = function(v){ return v === null ? "—" : v; }; return '<tr><td class="gauche">' + hx(r.nom) + '</td><td>' + t(r.cde) + '</td><td>' + t(r.av) + '</td><td><b>' + r.ce + '</b></td><td>' + t(r.reste) + '</td></tr>'; }).join("") +
      '</tbody><tfoot><tr><td class="gauche">Total ' + hx(E.lot) + '</td><td>' + E.T.cde + '</td><td>' + E.T.av + '</td><td>' + E.T.ce + '</td><td>' + E.T.reste + '</td></tr></tfoot></table>';
  });
  return h;
}
function colisageGridX(e, colis, sansLot){
  var tailles = SZ.filter(function(t){ return colis.some(function(c){ return c.items.some(function(x){ return x.size === t; }); }); });
  var nc = 4 + tailles.length, last = nc - 1, ex = PK_EXPEDITEUR, d = destDe(e.cl);
  var g = {cols:[10, 13, 34].concat(tailles.map(function(){ return 8; })).concat([9]), rows:[], merges:[], landscape:ori("col") === "landscape"}, r = 0, mid = Math.max(2, Math.floor(nc / 2));
  var gauche = ["Expéditeur : " + ex.nom].concat(ex.lignes).concat([ex.pays, "Date d'export : le " + dmyL(e.d)]);
  var droite = ["Destinataire :", d.nom].concat(d.lignes).concat(d.tel ? ["TÉLÉPHONE : " + d.tel] : []);
  for (var i = 0; i < Math.max(gauche.length, droite.length); i++){
    gset(g, r, 0, gauche[i] || "", {sz:10, al:"l", b:i === 0 ? 1 : 0}); gmerge(g, r, 0, r, mid - 1);
    gset(g, r, mid, droite[i] || "", {sz:10, al:"l", b:i > 0 && String(droite[i] || "").indexOf("TÉLÉPHONE") < 0 ? 1 : 0}); gmerge(g, r, mid, r, last); r++;
  }
  gset(g, r, 0, "Export N°" + e.n + " · " + (e.nat || e.cl) + (sansLot ? "" : " · commandes " + lotsExport(e).join(", ")), {sz:9, al:"l"}); gmerge(g, r, 0, r, last); r += 2;
  var H = {b:1, sz:10, al:"c", bd:"t", bg:"EEEEEE"}, Cc = {sz:10, al:"c", bd:"t"};
  ["N° colis", "Commande", "Référence"].concat(tailles).concat(["Total"]).forEach(function(h, k){ gset(g, r, k, h, H); }); g.sticky = r + 1; r++;
  var totT = {}, total = 0; tailles.forEach(function(t){ totT[t] = 0; });
  colis.forEach(function(c){
    var cles = [], par = {};
    c.items.forEach(function(x){ var k = sansLot ? x.lib : x.lib + "|" + x.lot; if (!par[k]){ par[k] = {lib:x.lib, lot:x.lot, q:{}}; cles.push(k); } par[k].q[x.size] = (par[k].q[x.size] || 0) + x.q; totT[x.size] += x.q; total += x.q; });
    var top = r;
    cles.forEach(function(k, j){ var p = par[k], s = 0;
      gset(g, r, 0, j ? "" : String(c.n), Cc); gset(g, r, 1, sansLot ? "PERCKO" : p.lot, Cc); gset(g, r, 2, nomDoc(p.lib), {sz:10, al:"l", bd:"t"});
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
function totalGridX(e, colis, sansLot){
  var g = {cols:[46, 16], rows:[], merges:[], landscape:ori("tot") === "landscape"}, r = 0;
  if (sansLot){ var T = totalSansLot(colis);
    gset(g, r, 0, "Export N°" + e.n + " du " + dmyL(e.d) + " " + (e.dest || destDefaut(e.cl)).nom, {b:1, sz:12, al:"l"}); gmerge(g, r, 0, r, 1); r += 2;
    gset(g, r, 0, "MODELE", {sz:11, al:"c", bd:"t"}); gset(g, r, 1, "QUANTITE", {sz:11, al:"c", bd:"t"}); r++;
    T.grp.forEach(function(gr){ gset(g, r, 0, gr.nom, {b:1, sz:13, al:"l", bd:"t"}); gset(g, r, 1, "", {bd:"t"}); g.rows[r].h = 20; r++;
      gr.rows.forEach(function(x){ gset(g, r, 0, x[0], {sz:11, al:"l", bd:"t"}); gset(g, r, 1, x[1], {sz:11, al:"c", bd:"t"}); r++; }); });
    gset(g, r, 0, "TOTAL", {b:1, sz:11, al:"l", bd:"t"}); gset(g, r, 1, T.total, {b:1, sz:11, al:"c", bd:"t"});
    return g; }
  var D = totalDonneesExport(e, colis);
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
    E.rows.forEach(function(x){ var t = function(v){ return v === null ? "—" : v; }; gset(g, r, 0, x.nom, {sz:10, al:"l", bd:"t"}); gset(g, r, 1, t(x.cde), Cc); gset(g, r, 2, t(x.av), Cc); gset(g, r, 3, x.ce, {b:1, sz:10, al:"c", bd:"t"}); gset(g, r, 4, t(x.reste), Cc); r++; });
    gset(g, r, 0, "Total " + E.lot, {b:1, sz:10, al:"l", bd:"t", bg:"EEEEEE"}); [E.T.cde, E.T.av, E.T.ce, E.T.reste].forEach(function(q, k){ gset(g, r, 1 + k, q, H); }); r += 2;
  });
  return g;
}
function imprimerX(e, quoi){
  var colis = colisExport(e), pp = PP_CHOIX.indexOf(ui.etqPP) >= 0 ? ui.etqPP : "4L", lot = libelleLots(e), sl = !!ui.xpSansLot, suf = sl ? "_sans_lot" : "";
  avecDest(e, function(){
    if (quoi === "fiches") return imprimerDoc(docCartonsHtml(e.cl, colis, pp, lot), pp === "4L" ? "A4 landscape" : "A4 portrait", "8mm", titreFichier(e, "Fiches_cartons"));
    if (quoi === "colis") return imprimerDoc(colisageHtml(e, colis, sl), "A4 " + ori("col"), "10mm", titreFichier(e, "Colisage") + suf);
    if (quoi === "total") return imprimerDoc(totalHtml(e, colis, sl), "A4 " + ori("tot"), "10mm", titreFichier(e, "Liste_total") + suf);
    var css = "<style>@page fiches{size:A4 " + (pp === "4L" ? "landscape" : "portrait") + ";margin:8mm}@page colis{size:A4 " + ori("col") + ";margin:10mm}@page total{size:A4 " + ori("tot") + ";margin:10mm}" +
      "#pk-doc-zone .sec-fiches{page:fiches}#pk-doc-zone .sec-colis{page:colis;break-before:page;page-break-before:always}#pk-doc-zone .sec-total{page:total;break-before:page;page-break-before:always}</style>";
    imprimerDoc(css + '<div class="sec-fiches">' + docCartonsHtml(e.cl, colis, pp, lot) + '</div><div class="sec-colis">' + colisageHtml(e, colis, sl) + '</div><div class="sec-total">' + totalHtml(e, colis, sl) + '</div>', "A4 portrait", "8mm", titreFichier(e, "Export") + suf);
  });
}
function excelX(e){
  var colis = colisExport(e), lot = libelleLots(e), sl = !!ui.xpSansLot;
  avecDest(e, function(){
    var f = fichesCartonsGrid(lot, e.cl, colis, ui.etqPP);
    var feuilles = [{name:"Fiches cartons", grid:f.grid, first:1, image:{data:logoOctets(), ext:"jpeg"}, anchors:f.anchors},
      {name:"Liste de colisage", grid:colisageGridX(e, colis, sl)}
    ].concat(sl ? [{name:"Liste total", grid:totalCommandeGrid(e, colis, null)}] : lotsExport(e).map(function(lot){ return {name:"Liste total " + lot, grid:totalCommandeGrid(e, colis, lot)}; }));
    if (!sl) feuilles.push({name:"Etat des commandes", grid:etatGridX(e, colis)});
    saveFile(titreFichier(e, "Export") + (sl ? "_sans_lot" : "") + ".xlsx", xlsxBuild(feuilles));
  });
}
/* tout en PDF (fichier à imprimer avec n'importe quel lecteur PDF) : fiches cartons avec logo, liste de colisage, liste total */
function pdfX(e){
  var colis = colisExport(e), lot = libelleLots(e), sl = !!ui.xpSansLot;
  avecDest(e, function(){
    var f = fichesCartonsGrid(lot, e.cl, colis, ui.etqPP === 1 || ui.etqPP === 2 ? 2 : "4L"); f.grid.img = logoOctets(); f.grid.anchors = f.anchors;
    var grids = [f.grid, colisageGridX(e, colis, sl)].concat(sl ? [totalCommandeGrid(e, colis, null)] : lotsExport(e).map(function(l){ return totalCommandeGrid(e, colis, l); }));
    saveFile(titreFichier(e, "Export") + (sl ? "_sans_lot" : "") + ".pdf", pdfBuild(grids));
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
  var sl = el("div", {class:"seg"}, el("span", {class:"mut", style:"align-self:center;font-weight:600", text:"Liste de colisage et liste total :"}));
  [[false, "Avec les lots (par commande)"], [true, "Sans lot"]].forEach(function(o){ sl.appendChild(el("button", {class:!!ui.xpSansLot === o[0] ? "on" : "", text:o[1], onclick:function(){ ui.xpSansLot = o[0]; render(true); }})); });
  c.appendChild(sl);
  c.appendChild(el("div", {class:"sx-tout"},
    el("div", {class:"mut", style:"font-weight:700;margin-bottom:6px", text:"Tout en un clic : fiches cartons + liste de colisage + liste total (au format de la commande)"}),
    el("div", {class:"actions", style:"margin:0"},
      el("button", {class:"btn", text:"🖨 Tout imprimer", onclick:function(){ imprimerX(e, "tout"); }}),
      el("button", {class:"btn sec", text:"📕 Tout en PDF", title:"Fichier PDF à imprimer (Adobe Reader, navigateur…)", onclick:function(){ pdfX(e); }}),
      el("button", {class:"btn sec", text:"📗 Tout en Excel", onclick:function(){ excelX(e); }})),
    oriBloc()));
  var seg = el("div", {class:"seg"}, el("span", {class:"mut", style:"align-self:center", text:"Fiches cartons par page :"}));
  PP_CHOIX.forEach(function(n){ seg.appendChild(el("button", {class:ui.etqPP === n ? "on" : "", text:n === "4L" ? "4 (paysage)" : String(n), onclick:function(){ ui.etqPP = n; render(true); }})); });
  c.appendChild(seg);
  c.appendChild(el("div", {class:"actions", style:"margin:8px 0 0"},
    el("button", {class:"btn small sec", text:"🖨 Fiches cartons", onclick:function(){ imprimerX(e, "fiches"); }}),
    el("button", {class:"btn small sec", text:ui.xpSansLot ? "🖨 Liste de colisage (sans lot)" : "🖨 Liste de colisage", onclick:function(){ imprimerX(e, "colis"); }}),
    el("button", {class:"btn small sec", text:ui.xpSansLot ? "🖨 Liste total (sans lot)" : "🖨 Liste total (par commande)", onclick:function(){ imprimerX(e, "total"); }}),
    el("button", {class:"btn small sec", text:"🏷 Base NiceLabel (Excel)", onclick:function(){ niceLabelX(e); }})));
  return c;
}
/* pour les tests */
window.pkExports = {rattacher:rattacher, aRattacher:aRattacher, ligneDe:ligneDe, dispoLigne:dispoLigne, enregistrerCartonExport:enregistrerCartonExport, supprimerCartonExport:supprimerCartonExport, validerExport:validerExport, rouvrirExport:rouvrirExport, supprimerExport:supprimerExport, colisExport:colisExport, totalDonneesExport:totalDonneesExport, colisageHtml:colisageHtml, totalHtml:totalHtml, colisageGridX:colisageGridX, totalGridX:totalGridX, totalCommandeGrid:totalCommandeGrid, grilleHtml:grilleHtml, pdfX:pdfX};
})();
