/* Ordre d'affichage des modèles dans toutes les commandes et fiches (24/11/2026, demandé par TEK-TREND) :
   PHARMA-HOMME (noir, gris, sable) · PHARMA-FEMME COL V (noir, rose poudré) · PHARMA-FEMME COL ROND (noir, rose
   poudré) · SPORT-H · SPORT-F · GILET-H · GILET-F · PRO HOMME · PRO FEMME · FLEX HOMME · FLEX FEMME ·
   EXOSQUELETTE · BRASSIÈRE A-B, C-D, E-F, G-H. Un libellé inconnu passe après, dans l'ordre d'origine. */
(function(){
  var REGLES = [
    [/PHARMA HOMME.*NOIR/], [/PHARMA HOMME.*GRIS/], [/PHARMA HOMME.*(SABLE|BEIGE)/], [/PHARMA HOMME/],
    [/PHARMA FEMME COL V.*NOIR/], [/PHARMA FEMME COL V.*ROSE/], [/PHARMA FEMME COL V/],
    [/PHARMA FEMME COL ROND.*NOIR/], [/PHARMA FEMME COL ROND.*ROSE/], [/PHARMA FEMME COL ROND/],
    [/SPORT.*HOMME|SPORT[ -]H\b/], [/SPORT.*FEMME|SPORT[ -]F\b/],
    [/GILET.*HOMME|GILET[ -]H\b/], [/GILET.*FEMME|GILET[ -]F\b/],
    [/PRO HOMME/], [/PRO FEMME/], [/FLEX HOMME/], [/FLEX FEMME/],
    [/EXOSQUELETTE/],
    [/BRASSI.*\bA ?- ?B\b/], [/BRASSI.*\bC ?- ?D\b/], [/BRASSI.*\bE ?- ?F\b/], [/BRASSI.*\bG ?- ?H\b/], [/BRASSI/]
  ];
  function norm(x){ return String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[_]+/g, " ").replace(/\s+/g, " ").trim(); }
  var cache = {};
  /* rang d'un libellé (0, 1, 2… ; 999 si inconnu) */
  window.rangLibelle = function(lib){
    var k = String(lib || ""); if (k in cache) return cache[k];
    var n = norm(k), r = 999;
    for (var i = 0; i < REGLES.length; i++) if (REGLES[i][0].test(n)){ r = i; break; }
    return (cache[k] = r);
  };
  /* comparaison de deux libellés : ordre ci-dessus, puis ordre alphabétique */
  window.compareLibelles = function(a, b){ return (rangLibelle(a) - rangLibelle(b)) || (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0); };
})();
