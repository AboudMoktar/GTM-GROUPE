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
   - Documents, chacun à part (imprimer, PDF ou Excel) : fiches cartons, liste de colisage,
     liste total au format de la commande, état des commandes, base NiceLabel.
   - Poids d'un carton : automatique (90 pièces : 18 kg ; sinon 12 kg) ou saisi à la main.
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
  '.xp-step input::-webkit-inner-spin-button,.xp-step input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.xp-step input{-moz-appearance:textfield;appearance:textfield}',
  /* liste des exports en cartes */
  '.xp-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:0 0 14px}',
  '.xp-li{background:var(--card);border:1px solid var(--line);border-left:6px solid #d99a00;border-radius:14px;padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;gap:5px;box-shadow:0 1px 3px rgba(0,0,0,.06)}',
  '.xp-li.fini{border-left-color:#1f9254}.xp-li:hover{box-shadow:0 4px 14px rgba(0,0,0,.12)}.xp-li .btn{align-self:flex-start;margin-top:6px}',
  '.xp-li-h{display:flex;justify-content:space-between;align-items:center;gap:8px}.xp-li-n{font-size:18px;font-weight:800}',
  '.xp-li-d{font-size:14.5px}.xp-li-c{font-size:13px;color:var(--mut)}.xp-li-s{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}.xp-li-s b{font-weight:800}',
  '.xp-li-com{font-size:13px;color:var(--mut);font-style:italic}',
  /* fiche de l'export */
  '.xp-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 0}.xp-kpi div{background:var(--sub);border-radius:12px;padding:10px;text-align:center}',
  '.xp-kpi b{display:block;font-size:22px;font-weight:800}.xp-kpi span{font-size:12.5px;color:var(--mut);font-weight:600}',
  '.xp-com-box{margin-top:10px;padding:8px 12px;border-radius:10px;background:rgba(255,193,7,.14);border:1px solid rgba(217,154,0,.45);font-size:14px;white-space:pre-wrap}',
  '.xp-cartons{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}.xp-cartons .xp-carton{margin:0;box-shadow:0 1px 3px rgba(0,0,0,.06)}',
  '.xp-cq{font-weight:800;font-size:14px;background:var(--sub);border-radius:99px;padding:3px 10px}',
  '.xp-rl{margin-top:8px}.xp-rl-n{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:14px}',
  '.xp-tag{display:inline-block;line-height:1.5;white-space:nowrap;font-size:11.5px;font-weight:700;color:var(--mut);background:var(--sub);border-radius:99px;padding:1px 8px}.xp-tag.libre{background:#fff3cd;color:#7a4b00}',
  '.xp-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.xp-pill{border:1px solid var(--line);border-radius:8px;padding:2px 8px;font-size:13px;color:var(--mut)}.xp-pill b{color:var(--ink);font-weight:800}',
  '.xp-cedit{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 10px;margin-top:10px;padding-top:8px;border-top:1px dashed var(--line)}',
  '.xp-cedit label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:700;color:var(--mut)}.xp-cedit input{height:38px}.xp-cedit label.lg2{flex:1 1 140px}',
  '.xp-kg{width:96px;font-weight:800;text-align:center}.xp-cin{width:100%}',
  /* documents : chacun à part */
  '.xp-docs{display:grid;gap:8px;margin-top:10px}',
  '.xp-doc{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--card)}',
  '.xp-doc-n{font-size:15.5px;font-weight:800}.xp-doc-s{font-size:12.5px}.xp-doc-b{display:flex;flex-wrap:wrap;gap:6px}.xp-pp{margin-top:6px;flex-wrap:wrap}',
  '.xp-reg{margin-top:10px}.xp-reg summary{cursor:pointer;color:var(--mut);font-weight:600;font-size:13.5px}'
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
/* poids brut d'un carton : saisi à la main, sinon automatique (carton plein de 90 pièces : 18 kg ; sinon 12 kg) */
function poidsAuto(q){ return q > 0 ? (q >= 90 ? 18 : 12) : 0; }
function aPoidsSaisi(c){ return c.kg !== null && c.kg !== undefined && c.kg !== ""; }
function poidsDe(e, c){ return aPoidsSaisi(c) ? (+c.kg || 0) : poidsAuto(qteCarton(c)); }
function fmtKg(x){ x = Math.round((+x || 0) * 10) / 10; return fmt(x, x % 1 ? 1 : 0); }
function lireKg(v){ v = String(v === null || v === undefined ? "" : v).trim().replace(",", "."); return v === "" ? null : (parseFloat(v) || 0); }

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
  var grille = el("div", {class:"xp-list"});
  L.forEach(function(e){
    var ouvrir = function(){ ui.xp = {id:e.id}; render(); }, fini = e.st === "fini", pds = 0; e.cartons.forEach(function(c){ pds += poidsDe(e, c); });
    grille.appendChild(el("div", {class:"xp-li " + (fini ? "fini" : "cours"), role:"button", tabindex:"0", onclick:ouvrir},
      el("div", {class:"xp-li-h"}, el("span", {class:"xp-li-n", text:"Export N°" + e.n}), el("span", {class:"xp-et " + (fini ? "fini" : "cours"), text:fini ? "FINI" : "EN COURS"})),
      el("div", {class:"xp-li-d"}, el("b", {text:e.nat || e.cl}), " · " + dmyL(e.d)),
      el("div", {class:"xp-li-c", text:"Commandes : " + (lotsExport(e).join(", ") || "—")}),
      el("div", {class:"xp-li-s"}, el("span", null, el("b", {text:String(e.cartons.length)}), " carton(s)"), el("span", null, el("b", {text:fmt(qteExport(e))}), " pièces"), el("span", null, el("b", {text:fmtKg(pds)}), " kg")),
      e.com ? el("div", {class:"xp-li-com", text:"💬 " + e.com}) : null,
      el("button", {class:"btn small sec", text:"Ouvrir", onclick:function(ev){ ev.stopPropagation(); ouvrir(); }})));
  });
  v.appendChild(grille);
}
function formExport(v, e){
  var cls = clientsPossibles(), cl = e ? e.cl : (cls.indexOf("NEOLYS") >= 0 ? "NEOLYS" : cls[0]);
  var dI = el("input", {type:"date", value:e ? e.d : today()});
  var dest = el("textarea", {rows:"5"}); dest.value = destTexte(e && e.dest ? e.dest : destDefaut(cl));
  var nI = e ? el("input", {type:"number", min:"1", inputmode:"numeric", value:String(e.n)}) : null;
  var com = el("textarea", {rows:"3", placeholder:"Ex. transporteur, remarque pour le client, palette…"}); com.value = e ? e.com || "" : "";
  var seg = el("div", {class:"seg"});
  function dessinerSeg(){ seg.innerHTML = ""; cls.forEach(function(c){ seg.appendChild(el("button", {class:c === cl ? "on" : "", text:c, onclick:function(){
    if (e && e.cartons.length && c !== e.cl){ toast("L'export a déjà des cartons : la nature ne peut plus changer (créez un nouvel export)."); return; }
    var defAvant = destTexte(destDefaut(cl)); cl = c; if (dest.value.trim() === defAvant.trim()) dest.value = destTexte(destDefaut(cl)); dessinerSeg(); }})); }); }
  dessinerSeg();
  v.appendChild(el("div", {class:"card"}, el("h2", {text:e ? "Modifier les informations de l'export N°" + e.n : "Nouvel export"}),
    el("div", {class:"xp-form"},
      nI ? el("label", null, "N° de l'export", nI) : null,
      el("label", null, "Date d'export", dI),
      el("label", null, "Nature (destination)", seg),
      el("label", {style:"grid-column:1/-1"}, "Destinataire (repris sur les fiches cartons et la liste de colisage)", dest),
      el("label", {style:"grid-column:1/-1"}, "Commentaire (pour vous, n'apparaît pas sur les documents)", com)),
    el("div", {class:"actions", style:"margin-top:12px"},
      el("button", {class:"btn", text:e ? "✔ Enregistrer" : "✔ Créer l'export et ajouter les cartons", onclick:function(){
        if (!dI.value){ toast("Choisissez la date d'export."); return; }
        var nN = nI ? parseInt(nI.value, 10) : 0;
        if (nI && !(nN > 0)){ toast("Écrivez le N° de l'export."); return; }
        if (nI && EX().some(function(x){ return x !== e && x.n === nN; })){ toast("Le N° " + nN + " est déjà pris par un autre export."); return; }
        var d = destDepuisTexte(dest.value), def = destDefaut(cl), memeDest = destTexte(d) === destTexte(def);
        var id = e ? e.id : nid("X");
        var ok = commit(function(){
          if (e){
            e.d = dI.value; e.cl = cl; e.nat = cl; e.dest = memeDest ? null : d; e.com = com.value.trim(); e.n = nN;
            /* date et libellé des mouvements : ceux de l'export */
            var ids = {}; e.cartons.forEach(function(c){ ids[c.id] = 1; }); ids[e.id] = 1;
            S.moves.forEach(function(m){ if (ids[m.ct]){ m.date = e.d; m.note = String(m.note || "").replace(/([Ee]xport N°)\d+/, "$1" + e.n); } });
          } else {
            var n = 0; EX().forEach(function(x){ if (x.n > n) n = x.n; });
            EX().push({id:id, n:n + 1, d:dI.value, cl:cl, nat:cl, dest:memeDest ? null : d, st:"cours", dv:"", com:com.value.trim(), cartons:[]});
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
    return el("div", {class:"xp-rl"}, el("div", {class:"xp-rl-n"}, el("b", {text:nomDoc(i.lib)}), el("span", {class:"xp-tag" + (!i.l ? " libre" : ""), text:i.lot + (!i.l ? " · non enregistrée" : i.src !== ui.xpCl ? " · surplus " + i.src : "")})),
      el("div", {class:"xp-pills"}, p.t.map(function(t){ return el("span", {class:"xp-pill"}, t[0] + " ", el("b", {text:String(t[1])})); }))); });
}
function ficheExport(v, e){
  var fini = e.st === "fini", q = qteExport(e), pds = 0; e.cartons.forEach(function(c){ pds += poidsDe(e, c); });
  ui.xpCl = e.cl;
  var dest = e.dest || destDefaut(e.cl);
  v.appendChild(el("button", {class:"btn small sec", style:"margin-bottom:10px", text:"← Tous les exports", onclick:function(){ ui.xp = {}; render(); }}));
  var head = el("div", {class:"card xp-fh"},
    el("div", {class:"xp-head"},
      el("div", null, el("h2", {style:"margin:0", text:"Export N°" + e.n + " · " + (e.nat || e.cl)}),
        el("div", {class:"xp-meta"}, el("span", null, "Date d'export : ", el("b", {text:dmyL(e.d)})), el("span", null, "Destinataire : ", el("b", {text:dest.nom})),
          el("span", null, "Commandes : ", el("b", {text:lotsExport(e).join(", ") || "—"})))),
      el("span", {class:"xp-et " + (fini ? "fini" : "cours"), text:fini ? "FINI · expédié" : "EN COURS"})),
    el("div", {class:"xp-kpi"},
      el("div", null, el("b", {text:String(e.cartons.length)}), el("span", {text:"carton(s)"})),
      el("div", null, el("b", {text:fmt(q)}), el("span", {text:"pièces"})),
      el("div", null, el("b", {text:fmtKg(pds) + " kg"}), el("span", {text:"poids brut"}))),
    e.com ? el("div", {class:"xp-com-box", text:"💬 " + e.com}) : null);
  var acts = el("div", {class:"actions", style:"margin:12px 0 0"});
  if (!fini) acts.appendChild(el("button", {class:"btn", text:"+ Ajouter un carton", onclick:function(){ ui.xp = {id:e.id, carton:{nouveau:true}}; render(); }}));
  acts.appendChild(el("button", {class:"btn sec", text:"✏️ Modifier les informations", title:"N°, date, nature, destinataire, commentaire", onclick:function(){ ui.xp = {id:e.id, modif:true}; render(); }}));
  head.appendChild(acts);
  v.appendChild(head);
  var ar = aRattacher(e), libres = 0; e.cartons.forEach(function(c){ c.it.forEach(function(x){ if (!(x[0] && lineById(x[0]))) libres += x[1]; }); });
  if (ar) v.appendChild(el("div", {class:"sx-tout", style:"margin-bottom:12px"},
    el("div", {style:"font-weight:700", text:fmt(ar) + " pièce(s) concernent des commandes maintenant enregistrées."}),
    el("div", {class:"mut", style:"margin:4px 0 8px", text:"Rattachez-les pour qu'elles comptent dans le suivi de ces commandes (emballées" + (fini ? ", expédiées" : "") + ")."}),
    el("button", {class:"btn", text:"Rattacher aux commandes", onclick:function(){ commit(function(){ rattacher(e); }, "Pièces rattachées aux commandes"); }})));
  else if (libres) v.appendChild(el("div", {class:"msg", style:"margin:0 0 12px", text:fmt(libres) + " pièce(s) sur des commandes pas encore enregistrées : elles figurent sur les documents ; elles seront rattachées au suivi quand la commande sera enregistrée."}));
  /* cartons : contenu, poids et commentaire (modifiables à tout moment) */
  var cc = el("div", {class:"card"}, el("h2", {text:"Cartons"}));
  if (!e.cartons.length) cc.appendChild(el("div", {class:"xp-vide", text:"Pas encore de carton. Touchez « + Ajouter un carton »."}));
  var lst = el("div", {class:"xp-cartons"});
  e.cartons.slice().sort(function(a, b){ return a.n - b.n; }).forEach(function(c){
    var qc = qteCarton(c);
    var b = el("div", {class:"xp-carton"},
      el("div", {class:"t"}, el("span", {class:"num", text:"📦 Carton N°" + c.n}), el("span", {class:"xp-cq", text:fmt(qc) + " pcs · " + fmtKg(poidsDe(e, c)) + " kg"})));
    resumeCarton(c).forEach(function(x){ b.appendChild(x); });
    var kgIn = el("input", {type:"number", step:"0.1", min:"0", inputmode:"decimal", class:"xp-kg", value:aPoidsSaisi(c) ? String(c.kg) : "", placeholder:String(poidsAuto(qc)), title:"Vide = automatique (90 pièces : 18 kg ; sinon 12 kg)"});
    kgIn.addEventListener("change", function(){ commit(function(){ c.kg = lireKg(kgIn.value); }, "Poids du carton N°" + c.n + " : " + fmtKg(poidsDe(e, c)) + " kg"); });
    var comIn = el("input", {type:"text", class:"xp-cin", value:c.com || "", placeholder:"Commentaire (facultatif)"});
    comIn.addEventListener("change", function(){ commit(function(){ c.com = comIn.value.trim(); }, "Commentaire du carton N°" + c.n + " enregistré"); });
    b.appendChild(el("div", {class:"xp-cedit"}, el("label", null, "Poids (kg)", kgIn), el("label", {class:"lg2"}, "Commentaire", comIn)));
    if (!fini) b.appendChild(el("div", {class:"actions", style:"margin:8px 0 0"},
      el("button", {class:"btn small sec", text:"Modifier", onclick:function(){ ui.xp = {id:e.id, carton:{id:c.id}}; render(); }}),
      el("button", {class:"btn small sec", text:"Refaire le même", title:"Nouveau carton avec le même contenu", onclick:function(){ ui.xp = {id:e.id, carton:{nouveau:true, depuis:c.id}}; render(); }}),
      el("button", {class:"btn small sec", style:"color:#b42318", text:"Supprimer", onclick:function(){ if (!confirm("Supprimer le carton N°" + c.n + " ? Les cartons suivants sont renumérotés.")) return; commit(function(){ supprimerCartonExport(e, c.id); }, "Carton supprimé"); }})));
    lst.appendChild(b);
  });
  cc.appendChild(lst);
  if (e.cartons.length) cc.appendChild(el("div", {class:"mut", style:"font-size:12.5px;margin-top:4px", text:"Poids vide = automatique : 18 kg pour un carton de 90 pièces, sinon 12 kg."}));
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
    C.etat = {it:src ? src.it.map(function(x){ return x.slice(); }) : [], kg:C.id && src && aPoidsSaisi(src) ? String(src.kg) : "", com:C.id && src ? src.com || "" : "", n:C.id && src ? src.n : n + 1,
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
  var lotsLibres = lotsExport(e).concat(E.it.map(function(x){ return infoItem(x).lot; })).concat(E.lot ? [E.lot] : []).filter(function(l){ return l && lotsConnus.indexOf(l) < 0; });
  sortedUnique(lotsConnus.concat(lotsLibres)).reverse().forEach(function(lot){ lc.appendChild(el("button", {class:"sx-chip" + (E.lot === lot ? " on" : ""), text:(E.lot === lot ? "✓ " : "") + lot + (lotsConnus.indexOf(lot) < 0 ? " (non enregistrée)" : ""), onclick:function(){ E.lot = lot; render(true); }})); });
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
  /* poids : automatique (90 pièces : 18 kg ; sinon 12 kg) tant qu'on ne le change pas */
  var kgI = el("input", {type:"number", inputmode:"decimal", step:"0.1", min:"0", class:"xp-kg"}), kgInfo = el("div", {class:"mut", style:"font-size:12.5px;margin-top:4px"});
  var kgAuto = el("button", {class:"btn small sec", text:"Automatique", onclick:function(){ E.kg = ""; majKg(); }});
  function majKg(){ var a = E.kg === ""; if (a) kgI.value = poidsAuto(total()) ? String(poidsAuto(total())) : ""; kgAuto.style.display = a ? "none" : "";
    kgInfo.textContent = a ? "Automatique : 18 kg pour 90 pièces, sinon 12 kg. Changez le chiffre si besoin." : "Poids saisi à la main."; }
  kgI.addEventListener("input", function(){ E.kg = kgI.value; majKg(); });
  if (E.kg !== "") kgI.value = E.kg;
  majs.push(majKg); majKg();
  var comI = el("input", {type:"text", class:"xp-cin", value:E.com || "", placeholder:"Commentaire (facultatif)"});
  comI.addEventListener("input", function(){ E.com = comI.value; });
  fin.appendChild(el("div", {class:"xp-cedit", style:"margin-bottom:10px"},
    el("label", null, "Poids brut (kg)", el("span", {style:"display:flex;gap:6px;align-items:center"}, kgI, kgAuto)),
    el("label", {class:"lg2"}, "Commentaire du carton", comI)));
  fin.appendChild(kgInfo);
  function enregistrer(suivant){
    var c = {id:C.id || nid("XC"), n:E.n, kg:lireKg(E.kg), com:String(E.com || "").trim(), it:E.it.filter(function(x){ return x[1] > 0; }).map(function(x){ return x.slice(); })};
    if (!c.it.length){ toast("Le carton est vide."); return; }
    var szs = {}; c.it.forEach(function(x){ szs[infoItem(x).size] = 1; });
    var av = []; if (R && t1 && Object.keys(szs).length > 1) av.push("plusieurs tailles (règle " + e.cl + " : une seule)"); if (R && total() > R.n) av.push("plus de " + R.n + " pièces (règle " + e.cl + ")");
    if (av.length && !confirm("Attention : " + av.join(", ") + ".\nValider quand même ?")) return;
    var ok = commit(function(){ enregistrerCartonExport(e, c); ui.xp = suivant ? {id:e.id, carton:{nouveau:true}} : {id:e.id}; if (suivant) ui.xp.carton.etat = {it:[], kg:"", com:"", n:Math.max.apply(null, e.cartons.map(function(x){ return x.n; })) + 1, lot:E.lot, tous:E.tous}; });
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
    /* seulement les modèles et les tailles qui ont une quantité dans l'export */
    var tz = li.sizes.filter(function(z){ return q[li.lib + "|" + z] > 0; });
    if (!tz.length) return;
    var top = r, tot = 0, col = couleurLib(li.lib);
    tz.forEach(function(z){
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
/* ---------- récapitulatif de la liste total ----------
   Une ligne par référence (Model, LIBELLE), une colonne par commande (lot) puis le total ;
   en bas : total des pièces par commande et nombre de cartons. Sans lot : seulement le total.
   Sommes en formules dans l'Excel. */
function recapTotalGrid(e, colis, sansLot){
  var lots = sansLot ? [] : lotsExport(e), q = {}, ordre = [], lo = libOrder(), cartons = {};
  colis.forEach(function(c){ var vus = {};
    c.items.forEach(function(x){ if (!q[x.lib]){ q[x.lib] = {}; ordre.push(x.lib); } q[x.lib][x.lot] = (q[x.lib][x.lot] || 0) + x.q; q[x.lib].__t = (q[x.lib].__t || 0) + x.q; vus[x.lot] = 1; });
    Object.keys(vus).forEach(function(l){ cartons[l] = (cartons[l] || 0) + 1; }); });
  ordre.sort(function(a, b){ return ((a in lo ? lo[a] : 999) - (b in lo ? lo[b] : 999)) || (a < b ? -1 : 1); });
  var nL = lots.length, cT = 2 + nL, L = colName;
  var g = {cols:[20, 34].concat(lots.map(function(){ return 14; })).concat([14]), rows:[], merges:[]};
  var H = {b:1, sz:11, fg:"C00000", al:"c", bd:"m"}, C = {sz:10, al:"c", bd:"t"}, TT = {b:1, sz:11, al:"c", bd:"m", bg:"EEEEEE"};
  gset(g, 0, 0, "Récapitulatif — Export N°" + e.n + " — " + dmyL(e.d) + " — " + (e.dest || destDefaut(e.cl)).nom, {b:1, sz:12, al:"l"}); gmerge(g, 0, 0, 0, cT); g.rows[0].h = 20;
  ["Model", "LIBELLE"].concat(lots).concat(["TOTAL"]).forEach(function(h, i){ gset(g, 2, i, h, H); }); g.rows[2].h = 18;
  var r = 3, deb = 4, pm = null, mtop = 3, fins = {};
  ordre.forEach(function(lib){
    var mod = modelOf(lib) || lib, col = couleurLib(lib);
    gset(g, r, 0, mod !== pm ? mod : "", {b:1, sz:10, al:"c", bd:"t"});
    if (mod !== pm){ mtop = r; pm = mod; } fins[mtop] = r;
    gset(g, r, 1, lib, {sz:9, al:"l", bd:"t", bg:col[0], fg:col[1]});
    lots.forEach(function(l, i){ gset(g, r, 2 + i, q[lib][l] || "", C); });
    gset(g, r, cT, q[lib].__t, {b:1, sz:11, al:"c", bd:"t"});
    if (nL) g.rows[r].cells[cT].f = "SUM(" + L(2) + (r + 1) + ":" + L(1 + nL) + (r + 1) + ")";
    g.rows[r].h = 15; r++;
  });
  Object.keys(fins).forEach(function(t){ if (fins[t] > +t) gmerge(g, +t, 0, fins[t], 0); });
  var fin = r, tot = 0; ordre.forEach(function(lib){ tot += q[lib].__t; });
  gset(g, r, 0, "TOTAL PIÈCES", {b:1, sz:11, al:"l", bd:"m", bg:"EEEEEE"}); gset(g, r, 1, "", TT); gmerge(g, r, 0, r, 1);
  lots.forEach(function(l, i){ var s = 0; ordre.forEach(function(lib){ s += q[lib][l] || 0; }); gset(g, r, 2 + i, s, TT); g.rows[r].cells[2 + i].f = "SUM(" + L(2 + i) + deb + ":" + L(2 + i) + fin + ")"; });
  gset(g, r, cT, tot, {b:1, sz:12, al:"c", bd:"m", bg:"EEEEEE", fg:"C00000"}); g.rows[r].cells[cT].f = "SUM(" + L(cT) + deb + ":" + L(cT) + fin + ")"; g.rows[r].h = 18; r++;
  gset(g, r, 0, "Nombre de cartons", {b:1, sz:10, al:"l", bd:"t"}); gset(g, r, 1, "", {bd:"t"}); gmerge(g, r, 0, r, 1);
  lots.forEach(function(l, i){ gset(g, r, 2 + i, cartons[l] || 0, C); });
  gset(g, r, cT, colis.length, {b:1, sz:10, al:"c", bd:"t"}); g.rows[r].h = 16;
  if (nL > 1){ r++; gset(g, r, 0, "Un carton peut contenir plusieurs commandes : le total des cartons est celui de l'export.", {sz:8, fg:"666666", al:"l"}); gmerge(g, r, 0, r, cT); }
  g.sticky = 3;
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
  var css = GRL_CSS;
  var recap = '<div class="grl-recap">' + grilleHtml(recapTotalGrid(e, colis, sansLot)) + '</div>';
  if (sansLot) return css + grilleHtml(totalCommandeGrid(e, colis, null)) + recap;
  return css + lotsExport(e).map(function(lot, i){ return '<div' + (i ? ' class="grl-saut"' : '') + '>' + grilleHtml(totalCommandeGrid(e, colis, lot)) + '</div>'; }).join("") + recap;
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
/* ---------- état d'une commande, au format de la commande initiale ----------
   Model | LIBELLE | Taille | un client par colonne (NEOLYS, ALLOGA…) | Total | Total du libellé
   | SUIVI : expédié avant les exports (ancien suivi), une colonne « Exporté jj/mm » par export
   de cette commande jusqu'à celui-ci | Reste = total − expédié (jamais négatif).
   Seulement les tailles commandées (ou exportées). Totaux en formules dans l'Excel. */
function etatCommandeGrid(e, lot){
  var lignes = S.lines.filter(function(l){ return l.lot === lot; }), lo = libOrder();
  var cls = sortedUnique(lignes.map(function(l){ return l.client; })).sort(function(a, b){ var o = ["NEOLYS", "ALLOGA"]; var ia = o.indexOf(a), ib = o.indexOf(b); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || (a < b ? -1 : 1); });
  var R = {}, cle = function(lib, z){ return lib + "|" + z; };
  function ref(lib, z){ var k = cle(lib, z); return R[k] || (R[k] = {lib:lib, size:z, q:{}, tot:0, av:0, ex:{}}); }
  lignes.forEach(function(l){ if (!(l.qty > 0)) return; var x = ref(l.lib, l.size); x.q[l.client] = (x.q[l.client] || 0) + l.qty; x.tot += l.qty; });
  /* exports de cette commande jusqu'à celui-ci (date, puis N°) */
  var exs = EX().filter(function(x){ return (x.d < e.d || (x.d === e.d && x.n <= e.n)) && x.cartons.some(function(c){ return c.it.some(function(y){ return infoItem(y).lot === lot; }); }); })
    .sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : a.n - b.n; });
  var idsX = {}; EX().forEach(function(x){ idsX[x.id] = 1; x.cartons.forEach(function(c){ idsX[c.id] = 1; }); });
  exs.forEach(function(x){ x.cartons.forEach(function(c){ c.it.forEach(function(y){ var i = infoItem(y); if (i.lot !== lot || !y[1]) return; var r = ref(i.lib, i.size); r.ex[x.id] = (r.ex[x.id] || 0) + y[1]; }); }); });
  /* expédié par l'ancien suivi (hors exports) */
  var parId = {}; lignes.forEach(function(l){ parId[l.id] = l; });
  S.moves.forEach(function(m){ if (m.stage !== "exp" || !parId[m.lineId] || idsX[m.ct]) return; var l = parId[m.lineId]; ref(l.lib, l.size).av += m.qty; });
  var avant = Object.keys(R).some(function(k){ return R[k].av; });
  var refs = Object.keys(R).map(function(k){ return R[k]; }).sort(function(a, b){ return ((a.lib in lo ? lo[a.lib] : 999) - (b.lib in lo ? lo[b.lib] : 999)) || (a.lib < b.lib ? -1 : a.lib > b.lib ? 1 : sizeIdx(a.size) - sizeIdx(b.size)); });
  /* colonnes */
  var dates = {}; exs.forEach(function(x){ var d = dmyL(x.d).slice(0, 5); dates[d] = (dates[d] || 0) + 1; });
  var cC = 3, cT = cC + cls.length, cTL = cT + 1, cAv = avant ? cTL + 1 : -1, cE = cTL + 1 + (avant ? 1 : 0), cR = cE + exs.length, L = colName;
  var g = {cols:[22, 34, 11].concat(cls.map(function(){ return 9; })).concat([9, 9]).concat(avant ? [11] : []).concat(exs.map(function(){ return 12; })).concat([9]), rows:[], merges:[]};
  var Tt = {b:1, sz:11, al:"c", bd:"m", bg:"DDEBF7"}, H = {b:1, sz:10, al:"c", bd:"m", bg:"1F3864", fg:"FFFFFF", wrap:1};
  var lm = lotMonth(lot), mois = MOIS[lm ? lm.m - 1 : +e.d.slice(5, 7) - 1], annee = (lignes[0] || {}).year || (lm ? lm.y : e.d.slice(0, 4));
  gset(g, 0, 0, "Commande: " + mois, Tt); gset(g, 0, 1, "", Tt); gset(g, 1, 0, "", Tt); gset(g, 1, 1, "", Tt); gmerge(g, 0, 0, 1, 1);
  gset(g, 0, 2, "LOT", {b:1, sz:10, al:"c", bd:"m", bg:"DDEBF7", fg:"C00000"}); gset(g, 1, 2, lot, {b:1, sz:10, al:"c", bd:"m", bg:"DDEBF7"});
  for (var k = cC; k <= cTL; k++){ gset(g, 0, k, k === cC ? "ANNEE" : "", Tt); gset(g, 1, k, k === cC ? String(annee) : "", Tt); }
  gmerge(g, 0, cC, 0, cTL); gmerge(g, 1, cC, 1, cTL);
  var s0 = avant ? cAv : cE;
  for (k = s0; k <= cR; k++){ gset(g, 0, k, k === s0 ? "SUIVI" : "", Tt); gset(g, 1, k, "", Tt); }
  gmerge(g, 0, s0, 1, cR);
  g.rows[0].h = 18; g.rows[1].h = 16;
  ["Model", "LIBELLE", "Taille"].concat(cls).concat(["Total", "Total"]).concat(avant ? ["Expédié avant"] : [])
    .concat(exs.map(function(x){ var d = dmyL(x.d).slice(0, 5); return "Exporté " + d + (dates[d] > 1 ? " (N°" + x.n + ")" : ""); })).concat(["Reste"])
    .forEach(function(h, i){ gset(g, 2, i, h, H); });
  g.rows[2].h = 28;
  var r = 3, deb = 4, pm = null, tm = {}, pl = null, tl = {}, mt = 3, lt = 3, C = {sz:10, al:"c", bd:"t"};
  refs.forEach(function(x){
    var rr = r + 1, col = couleurLib(x.lib), mod = modelOf(x.lib) || x.lib;
    if (mod !== pm){ mt = r; pm = mod; } tm[mt] = r;
    if (x.lib !== pl){ lt = r; pl = x.lib; } tl[lt] = r;
    gset(g, r, 0, r === mt ? mod : "", {b:1, sz:10, al:"c", bd:"t"});
    gset(g, r, 1, x.lib, {sz:9, al:"l", bd:"t", bg:col[0], fg:col[1]});
    gset(g, r, 2, x.size, {b:1, sz:10, al:"c", bd:"t"});
    cls.forEach(function(c, i){ gset(g, r, cC + i, x.q[c] || "", C); });
    gset(g, r, cT, x.tot || "", {b:1, sz:10, al:"c", bd:"t"}); if (cls.length) g.rows[r].cells[cT].f = "SUM(" + L(cC) + rr + ":" + L(cT - 1) + rr + ")";
    gset(g, r, cTL, "", {b:1, sz:12, al:"c", bd:"t"});
    if (avant) gset(g, r, cAv, x.av || "", C);
    var sx = x.av; exs.forEach(function(ex, i){ var v = x.ex[ex.id] || 0; sx += v; gset(g, r, cE + i, v || "", {b:1, sz:10, al:"c", bd:"t"}); });
    gset(g, r, cR, Math.max(0, x.tot - sx), {b:1, sz:10, al:"c", bd:"t"});
    var s1 = avant ? cAv : cE;
    g.rows[r].cells[cR].f = cR - 1 >= s1 ? "MAX(0," + L(cT) + rr + "-SUM(" + L(s1) + rr + ":" + L(cR - 1) + rr + "))" : "MAX(0," + L(cT) + rr + ")";
    g.rows[r].h = 15; r++;
  });
  Object.keys(tm).forEach(function(t){ if (tm[t] > +t) gmerge(g, +t, 0, tm[t], 0); });
  Object.keys(tl).forEach(function(t){ var a = +t, b = tl[t], s2 = 0; refs.slice(a - 3, b - 2).forEach(function(x){ s2 += x.tot; });
    g.rows[a].cells[cTL].v = s2 || ""; g.rows[a].cells[cTL].f = "SUM(" + L(cT) + (a + 1) + ":" + L(cT) + (b + 1) + ")"; if (b > a) gmerge(g, a, cTL, b, cTL); });
  var fin = r, TT = {b:1, sz:11, al:"c", bd:"m", bg:"EEEEEE"};
  gset(g, r, 0, "TOTAL", {b:1, sz:11, al:"l", bd:"m", bg:"EEEEEE"}); gset(g, r, 1, "", TT); gset(g, r, 2, "", TT); gmerge(g, r, 0, r, 2);
  for (k = cC; k <= cR; k++){
    var sv = 0; for (var i2 = 3; i2 < fin; i2++){ var cv = g.rows[i2].cells[k]; if (cv && typeof cv.v === "number") sv += cv.v; }
    gset(g, r, k, sv, k === cR ? {b:1, sz:11, al:"c", bd:"m", bg:"EEEEEE", fg:"C00000"} : TT); g.rows[r].cells[k].f = "SUM(" + L(k) + deb + ":" + L(k) + fin + ")";
  }
  g.rows[r].h = 18; g.sticky = 3;
  return g;
}
function etatsCommandes(e){ return lotsExport(e).map(function(lot){ return {lot:lot, grid:etatCommandeGrid(e, lot)}; }); }
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
var GRL_CSS = '<style>#pk-doc-zone table.grl{width:100%;border-collapse:collapse;font-size:9pt}#pk-doc-zone table.grl td{padding:0.8mm 1.5mm;line-height:1.2}#pk-doc-zone table.grl tr{break-inside:avoid;page-break-inside:avoid}#pk-doc-zone .grl-saut{break-before:page;page-break-before:always}#pk-doc-zone .grl-recap{margin-top:8mm;break-inside:avoid;page-break-inside:avoid}</style>';
function suffixe(){ return ui.xpSansLot ? "_sans_lot" : ""; }
function imprimerX(e, quoi){
  var colis = colisExport(e), pp = PP_CHOIX.indexOf(ui.etqPP) >= 0 ? ui.etqPP : "4L", lot = libelleLots(e), sl = !!ui.xpSansLot, suf = suffixe();
  avecDest(e, function(){
    if (quoi === "fiches") return imprimerDoc(docCartonsHtml(e.cl, colis, pp, lot), pp === "4L" ? "A4 landscape" : "A4 portrait", "8mm", titreFichier(e, "Fiches_cartons"));
    if (quoi === "colis") return imprimerDoc(colisageHtml(e, colis, sl), "A4 " + ori("col"), "10mm", titreFichier(e, "Colisage") + suf);
    if (quoi === "total") return imprimerDoc(totalHtml(e, colis, sl), "A4 " + ori("tot"), "10mm", titreFichier(e, "Liste_total") + suf);
    if (quoi === "etat") return imprimerDoc(GRL_CSS + etatsCommandes(e).map(function(x, i){ return '<div' + (i ? ' class="grl-saut"' : '') + '>' + grilleHtml(x.grid) + '</div>'; }).join(""), "A4 portrait", "10mm", titreFichier(e, "Etat_commandes"));
  });
}
/* un document de l'export, en feuilles (Excel) ou en pages (PDF) : chacun à part */
var DOCS = {fiches:"Fiches_cartons", colis:"Colisage", total:"Liste_total", etat:"Etat_commandes"};
function feuillesDoc(e, quoi){
  var colis = colisExport(e), sl = !!ui.xpSansLot;
  if (quoi === "fiches"){ var f = fichesCartonsGrid(libelleLots(e), e.cl, colis, ui.etqPP === 1 || ui.etqPP === 2 ? 2 : "4L"); f.grid.img = logoOctets(); f.grid.anchors = f.anchors;
    return [{name:"Fiches cartons", grid:f.grid, first:1, image:{data:logoOctets(), ext:"jpeg"}, anchors:f.anchors}]; }
  if (quoi === "colis") return [{name:"Liste de colisage", grid:colisageGridX(e, colis, sl)}];
  if (quoi === "total") return (sl ? [{name:"Liste total", grid:totalCommandeGrid(e, colis, null)}] : lotsExport(e).map(function(l){ return {name:"Liste total " + l, grid:totalCommandeGrid(e, colis, l)}; }))
    .concat([{name:"Récapitulatif", grid:recapTotalGrid(e, colis, sl)}]);
  return etatsCommandes(e).map(function(x){ return {name:"Etat " + x.lot, grid:x.grid}; });
}
function nomDocX(e, quoi){ return titreFichier(e, DOCS[quoi]) + (quoi === "colis" || quoi === "total" ? suffixe() : ""); }
function pdfDoc(e, quoi){ avecDest(e, function(){ saveFile(nomDocX(e, quoi) + ".pdf", pdfBuild(feuillesDoc(e, quoi).map(function(f){ return f.grid; }))); }); }
function excelDoc(e, quoi){ avecDest(e, function(){ saveFile(nomDocX(e, quoi) + ".xlsx", xlsxBuild(feuillesDoc(e, quoi))); }); }
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
  var sansLot = !!ui.xpSansLot;
  var c = el("div", {class:"card cartons"}, el("h2", {text:"Documents de l'export"}));
  var sl = el("div", {class:"seg", style:"flex-wrap:wrap"}, el("span", {class:"mut", style:"align-self:center;font-weight:600", text:"Colisage et liste total :"}));
  [[false, "Avec les lots (par commande)"], [true, "Sans lot"]].forEach(function(o){ sl.appendChild(el("button", {class:sansLot === o[0] ? "on" : "", text:o[1], onclick:function(){ ui.xpSansLot = o[0]; render(true); }})); });
  c.appendChild(sl);
  var pp = el("div", {class:"seg xp-pp"}, el("span", {class:"mut", style:"align-self:center", text:"Par page :"}));
  PP_CHOIX.forEach(function(n){ pp.appendChild(el("button", {class:ui.etqPP === n ? "on" : "", text:n === "4L" ? "4 paysage" : String(n), onclick:function(){ ui.etqPP = n; render(true); }})); });
  var docs = [
    ["fiches", "📦 Fiches cartons", "Une fiche à coller sur chaque carton", pp],
    ["colis", "📋 Liste de colisage", sansLot ? "Sans N° de commande" : "Avec le N° de commande de chaque ligne"],
    ["total", "🧾 Liste total", sansLot ? "Tout l'export, au format de la commande" : "Au format de la commande, une page par commande"]
  ];
  if (!sansLot) docs.push(["etat", "📊 État des commandes", "Au format de la commande : par client, total, exporté, reste"]);
  var L = el("div", {class:"xp-docs"});
  docs.forEach(function(d){
    L.appendChild(el("div", {class:"xp-doc", "data-doc":d[0]},
      el("div", {class:"xp-doc-i"}, el("div", {class:"xp-doc-n", text:d[1]}), el("div", {class:"mut xp-doc-s", text:d[2]}), d[3] || null),
      el("div", {class:"xp-doc-b"},
        el("button", {class:"btn small", text:"🖨 Imprimer", onclick:function(){ imprimerX(e, d[0]); }}),
        el("button", {class:"btn small sec", text:"📕 PDF", title:"Fichier PDF : s'imprime avec n'importe quel lecteur PDF", onclick:function(){ pdfDoc(e, d[0]); }}),
        el("button", {class:"btn small sec", text:"📗 Excel", onclick:function(){ excelDoc(e, d[0]); }}))));
  });
  L.appendChild(el("div", {class:"xp-doc", "data-doc":"nicelabel"},
    el("div", {class:"xp-doc-i"}, el("div", {class:"xp-doc-n", text:"🏷 Base NiceLabel"}), el("div", {class:"mut xp-doc-s", text:"Pour imprimer les étiquettes des cartons"})),
    el("div", {class:"xp-doc-b"}, el("button", {class:"btn small sec", text:"📗 Excel", onclick:function(){ niceLabelX(e); }}))));
  c.appendChild(L);
  c.appendChild(el("details", {class:"xp-reg"}, el("summary", {text:"Orientation d'impression (portrait / paysage)"}), oriBloc()));
  return c;
}
/* pour les tests */
window.pkExports = {rattacher:rattacher, aRattacher:aRattacher, ligneDe:ligneDe, dispoLigne:dispoLigne, enregistrerCartonExport:enregistrerCartonExport, supprimerCartonExport:supprimerCartonExport, validerExport:validerExport, rouvrirExport:rouvrirExport, supprimerExport:supprimerExport, colisExport:colisExport, totalDonneesExport:totalDonneesExport, colisageHtml:colisageHtml, totalHtml:totalHtml, colisageGridX:colisageGridX, totalGridX:totalGridX, totalCommandeGrid:totalCommandeGrid, recapTotalGrid:recapTotalGrid, etatCommandeGrid:etatCommandeGrid, grilleHtml:grilleHtml, pdfDoc:pdfDoc, excelDoc:excelDoc, feuillesDoc:feuillesDoc, poidsAuto:poidsAuto, poidsDe:poidsDe};
})();
