/* =====================================================================
   SUIVI DES COMMANDES — TABLEAUX « COMME LA COMMANDE EXCEL » (23/11/2026)
   Présentation seule : dans les tableaux à l'écran, le modèle, la référence
   (libellé), la couleur et la matière ne sont plus répétés à chaque taille :
   les cases identiques qui se suivent sont fusionnées (comme des cellules
   fusionnées dans Excel). Les données, les calculs et les documents imprimés
   (fiches PROGES, état de commande…) ne changent pas.
   Règles :
   - seulement les colonnes dont le titre est Modèle / Model, Référence /
     Libellé / LIBELLE / Article / Nom, Couleur, Matière / Nomenclature ;
   - fusion à l'écran seulement : les cases restent dans le tableau (tri, saisie et
     calculs inchangés) ; les traits entre elles sont effacés et la valeur n'est
     écrite qu'une fois, au milieu du groupe ;
   - une case n'est fusionnée qu'avec la même valeur juste au-dessus, et
     jamais au-delà d'une fusion de la colonne de gauche (une référence ne
     déborde pas sur le modèle suivant) ;
   - jamais une case avec un champ de saisie, ni une ligne de sous-total ;
   - les titres de modèle sur toute la largeur (tr.gh) deviennent une colonne « Modèle » à gauche ;
   - les aperçus de documents (tableaux « xl » sans cmdT) ne sont pas touchés.
   ===================================================================== */
(function(){
  var TITRES = /^(mod[eè]les?|model|r[ée]f[ée]rences?|libell[ée]s?|article|nom|couleurs?|mati[eè]re|nomenclature(\s*:\s*tissu)?)$/i;
  function txt(c){ return (c.textContent || "").replace(/\s+/g, " ").trim(); }
  function saisie(c){ return !!c.querySelector("input,select,textarea,button"); }
  /* grille logique : pour chaque ligne du corps, la cellule qui occupe chaque colonne (rowspan / colspan compris) */
  function grille(rows){
    var G = [], occ = {};
    rows.forEach(function(tr, r){
      G[r] = []; var c = 0;
      Array.prototype.forEach.call(tr.cells, function(td){
        while (occ[r + "," + c]) { G[r][c] = occ[r + "," + c]; c++; }
        var rs = td.rowSpan || 1, cs = td.colSpan || 1;
        for (var i = 0; i < rs; i++) for (var j = 0; j < cs; j++){ if (i || j) occ[(r + i) + "," + (c + j)] = td; G[r][c + j] = td; }
        c += cs;
      });
      while (occ[r + "," + c]) { G[r][c] = occ[r + "," + c]; c++; }
    });
    return G;
  }
  function colonnes(t){
    var th = t.tHead && t.tHead.rows.length ? t.tHead.rows[t.tHead.rows.length - 1] : null;
    if (!th) return [];
    /* position logique de chaque titre (les titres fusionnés sur plusieurs lignes de l'en-tête comptent) */
    var hr = Array.prototype.slice.call(t.tHead.rows), H = grille(hr), last = H[H.length - 1] || [], out = [];
    last.forEach(function(cell, i){ if (cell && cell.colSpan === 1 && TITRES.test(txt(cell))) out.push(i); });
    return out;
  }
  /* « Article » écrit avec la taille (ex. « Lyne Pro Homme Gris XS ») : la taille passe dans une colonne
     « Taille » à droite, pour que l'article puisse être fusionné sur ses tailles. Seulement si toutes les
     lignes du tableau se terminent par une taille (les lignes de total s'étendent sur les deux colonnes). */
  var TAILLE = /^(.+?)\s+(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|TU|T\d{1,2})$/;
  function separerTailles(t){
    var th = t.tHead && t.tHead.rows.length === 1 ? t.tHead.rows[0] : null; if (!th) return;
    var i = -1; Array.prototype.forEach.call(th.cells, function(c, k){ if (i < 0 && c.colSpan === 1 && /^(article|r[ée]f[ée]rence)$/i.test(txt(c))) i = k; });
    if (i < 0) return;
    var lignes = [], autres = [], ok = true;
    Array.prototype.forEach.call(t.tBodies, function(tb){ Array.prototype.forEach.call(tb.rows, function(tr){
      if (tr.cells.length !== th.cells.length) { autres.push(tr); return; }
      var c = tr.cells[i], m = c && c.colSpan === 1 && !saisie(c) && c.children.length === 0 ? TAILLE.exec(txt(c)) : null;
      if (m) lignes.push([c, m]); else autres.push(tr);
    }); });
    if (lignes.length < 2 || autres.some(function(tr){ return tr.cells.length === th.cells.length && !/tot|stot|sous/i.test(tr.className) && !/^total/i.test(txt(tr.cells[0] || tr)); })) return;
    var nt = document.createElement("th"); nt.textContent = "Taille"; nt.className = th.cells[i].className; th.insertBefore(nt, th.cells[i].nextSibling);
    lignes.forEach(function(x){ var c = x[0], z = document.createElement("td"); c.textContent = x[1][1]; z.textContent = x[1][2]; z.className = "taille"; z.style.cssText = "text-align:center;font-weight:700"; c.parentNode.insertBefore(z, c.nextSibling); });
    autres.forEach(function(tr){ var c = tr.cells[i]; if (c) c.colSpan = (c.colSpan || 1) + 1; });
    Array.prototype.forEach.call(t.querySelectorAll("tfoot tr"), function(tr){ var c = tr.cells[i]; if (c) c.colSpan = (c.colSpan || 1) + 1; });
    var cg = t.querySelector("colgroup"); if (cg && cg.children[i]) { var col = document.createElement("col"); col.style.width = "56px"; cg.insertBefore(col, cg.children[i].nextSibling); }
  }
  /* Lignes de titre de modèle (tr.gh, une case sur toute la largeur) → colonne « Modèle » à gauche, écrite une
     fois sur toutes ses tailles, comme la commande Excel. Le contenu (nom, client, bouton « Tout ») est déplacé tel quel. */
  function titresEnColonne(t){
    if (/ph-t/.test(t.className) || !t.tHead || !t.tBodies.length) return;
    var gh = t.querySelectorAll("tbody > tr.gh"); if (!gh.length) return;
    var hr = t.tHead.rows[t.tHead.rows.length - 1], th = document.createElement("th"); th.className = "l"; th.textContent = "Modèle"; hr.insertBefore(th, hr.firstChild);
    Array.prototype.forEach.call(t.tHead.rows, function(r){ if (r !== hr && r.cells[0]) r.cells[0].colSpan = (r.cells[0].colSpan || 1) + 1; });
    var cg = t.querySelector("colgroup"); if (cg){ var col = document.createElement("col"); col.style.width = "180px"; cg.insertBefore(col, cg.firstChild); }
    Array.prototype.forEach.call(t.tBodies, function(tb){
      var cur = null;
      Array.prototype.slice.call(tb.rows).forEach(function(tr){
        if (tr.classList.contains("gh")){
          var td = document.createElement("td"); td.className = "xm"; td.rowSpan = 0;
          var cells = Array.prototype.slice.call(tr.cells), seul = cells.length === 1 && cells[0].childNodes.length === 1 && cells[0].firstChild.nodeType === 3;
          if (seul){ var parts = cells[0].textContent.split(" · "), bb = document.createElement("b"); bb.textContent = parts[0]; td.appendChild(bb);
            if (parts.length > 1){ var sm = document.createElement("small"); sm.textContent = parts.slice(1).join(" · "); td.appendChild(sm); } }
          else cells.forEach(function(c){ while (c.firstChild) td.appendChild(c.firstChild); });
          tr.parentNode.removeChild(tr); cur = td; return;
        }
        if (/tot/i.test(tr.className) || !cur){   /* ligne hors modèle (total…) : sur toute la largeur de gauche */
          if (tr.cells[0]) tr.cells[0].colSpan = (tr.cells[0].colSpan || 1) + 1; if (/tot/i.test(tr.className)) cur = null; return;
        }
        if (!cur.parentNode) tr.insertBefore(cur, tr.firstChild);
        cur.rowSpan = (cur.rowSpan || 0) + 1;
      });
    });
    t.classList.add("gh-col");
  }
  function fusionner(t){
    if (t.getAttribute("data-fus") === "1" || t.closest("[data-nofus]")) return;
    if (/(^|\s)xl(\s|$)/.test(t.className) && !/cmdT/.test(t.className)) return;   /* aperçu de document */
    if (!t.getAttribute("data-tz")) { t.setAttribute("data-tz", "1"); try { titresEnColonne(t); } catch (e) {} try { separerTailles(t); } catch (e) {} }
    var cols = colonnes(t);
    Array.prototype.forEach.call(t.querySelectorAll("td.fz"), function(c){ c.classList.remove("fz", "fz-haut", "fz-bas", "fz-cache"); });
    if (!cols.length) { t.setAttribute("data-fus", "1"); return; }
    /* fusion « à l'écran » : les cases restent en place (le code et le tri continuent de les trouver) ;
       on efface les traits entre elles et on n'écrit la valeur qu'une fois, au milieu du groupe */
    Array.prototype.forEach.call(t.tBodies, function(tb){
      var rows = Array.prototype.slice.call(tb.rows); if (rows.length < 2) return;
      var G = grille(rows), groupe = rows.map(function(){ return 0; });   /* groupes de la colonne de gauche */
      cols.forEach(function(c){
        var nv = rows.map(function(){ return 0; }), id = 0, enCours = [];
        rows.forEach(function(_, r){ if (G[r][c]) G[r][c]._fzId = 0; });
        function clore(){
          if (enCours.length > 1){
            enCours.forEach(function(cell, k){ cell.classList.add("fz"); if (k === 0) cell.classList.add("fz-haut"); if (k === enCours.length - 1) cell.classList.add("fz-bas");
              if (k !== Math.floor((enCours.length - 1) / 2)) cell.classList.add("fz-cache"); });
          }
          enCours = [];
        }
        for (var r = 0; r < rows.length; r++){
          var cell = G[r][c];
          if (cell && ((cell.rowSpan || 1) > 1 || cell.parentNode !== rows[r])) {   /* déjà fusionnée par l'écran lui-même (rowspan) : un seul groupe */
            clore(); if (!cell._fzId) cell._fzId = ++id; nv[r] = cell._fzId; continue; }
          if (!cell || cell.colSpan > 1 || saisie(cell) || /tot|stot|sous/i.test(rows[r].className)) { clore(); nv[r] = ++id; continue; }
          var v = txt(cell), prec = enCours[enCours.length - 1];
          if (prec && v && v === txt(prec) && groupe[r] === groupe[r - 1] && nv[r - 1] === id) { enCours.push(cell); nv[r] = id; }
          else { clore(); enCours = [cell]; nv[r] = ++id; }
        }
        clore();
        groupe = rows.map(function(_, r){ return groupe[r] + "/" + nv[r]; });
      });
    });
    t.setAttribute("data-fus", "1");
  }
  function tout(){ Array.prototype.forEach.call(document.querySelectorAll("table:not([data-fus])"), function(t){ try { fusionner(t); } catch (e) { t.setAttribute("data-fus", "1"); } }); }
  var prevu = false;
  function planifier(){ if (prevu) return; prevu = true; (window.requestAnimationFrame || setTimeout)(function(){ prevu = false; tout(); }); }
  /* un tableau modifié (lignes réordonnées, recalcul) est repris de zéro au prochain rendu : on retire la marque */
  new MutationObserver(function(ms){
    var n = false;
    ms.forEach(function(m){
      if (m.type !== "childList") return;
      var t = m.target.closest ? m.target.closest("table[data-fus]") : null;
      if (t && Array.prototype.some.call(m.addedNodes, function(x){ return x.nodeName === "TR" || x.nodeName === "TBODY"; })) t.removeAttribute("data-fus");
      if (m.addedNodes.length) n = true;
    });
    if (n) planifier();
  }).observe(document.documentElement, {childList:true, subtree:true});
  window.pkFusionnerTableaux = tout;
  if (document.readyState !== "loading") planifier(); else document.addEventListener("DOMContentLoaded", planifier);
})();
