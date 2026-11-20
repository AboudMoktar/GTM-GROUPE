// ============================================================
// GTM GROUPE — CRM GADH V 0.0.2 : réglages chargés EN DERNIER (après les fichiers de l'ami). 20/11/2026.
//  1. Prix d'achat : Excel / PDF / Imprimer exportent ce que l'écran montre — accords de prix (paliers) + tarifs —
//     au lieu de « Rien à exporter » quand aucun tarif simple n'est valable.
//  2. Téléphone : les cartes (tableaux en mode carte) gardent leur texte À L'INTÉRIEUR : retour à la ligne, aucune
//     largeur fixe qui dépasse, libellés toujours visibles.
// ============================================================
(function(){
  const base = gcModeleListe;
  gcModeleListe = function(cle){
    const m = base(cle);
    if(cle !== 'tarifs' || typeof activeTab === 'undefined' || activeTab !== 'gc-prix-achat' || typeof gcfrAccords !== 'function') return m;
    const cols = [['Type', 't'], ['Fournisseur', 't'], ['Offre / réf.', 't'], ['Article', 't'], ['Réservé à', 't'], ['Quantité', 't'], ['Variante', 't'], ['Prix d\'achat', 'n3'], ['Valable du', 'd'], ['Valable au', 'd']];
    const L = [];
    gcfrAccords().slice().sort((x, y) => (y.date || '').localeCompare(x.date || '')).forEach(ac => {
      const a = gcArticle(ac.articleId), lib = a ? gcLibArticle(a) : '', cl = ac.clientId ? gcNomClient(ac.clientId) + (ac.clientLib ? ' (' + ac.clientLib + ')' : '') : '';
      GC.liste(ac.paliers).forEach(p => L.push(['Accord', gcNomFour(ac.fournisseurId), (ac.numero || '') + (ac.revision ? ' rév. ' + ac.revision : ''), lib, cl,
        p.max ? (p.min === p.max ? gcQ(p.min) + ' exactement' : 'de ' + gcQ(p.min) + ' à ' + gcQ(p.max)) : 'à partir de ' + gcQ(p.min), p.variante || '', GC.num(p.prix), ac.debut || '', ac.fin || '']));
    });
    const T = m && m.colonnes ? m.colonnes.map(c => c[0]) : [], i = (n) => T.indexOf(n);
    (m && m.lignes || []).forEach(r => L.push(['Tarif', r[i('Fournisseur')], r[i('Réf. fournisseur')] || '', r[i('Article')], '', r[i('À partir de')] ? 'à partir de ' + gcQ(r[i('À partir de')]) : '', '', r[i('Prix')], r[i('Valable du')] || '', r[i('Valable au')] || '']));
    return {titre:'Prix d\'achat (accords de prix et tarifs)', sous:(m && m.sous) || ('Édité le ' + gcDt(getTodayISO())), colonnes:cols, lignes:L};
  };
  const css = `@media (max-width:700px){
    .gc-lignes, .gct-t{max-width:100%;}
    .gc-lignes tr, .gct-t tr, .gc-lignes td, .gct-t td{box-sizing:border-box;max-width:100%;}
    .gc-lignes td, .gct-t td{min-width:0;flex-wrap:wrap;white-space:normal !important;overflow-wrap:anywhere;}
    .gc-lignes td[data-l]::before, .gct-t td::before{flex:0 0 36%;max-width:36%;white-space:normal;}
    .gc-lignes td.n, .gct-t td.n{justify-content:space-between;text-align:right;}
    .gc-lignes td > *, .gct-t td > *{min-width:0;max-width:100%;}
    #gc-body, #gc-body .card{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;}
    #gc-body [style*="overflow-x:auto"]{max-width:100%;}
    .gc-onglets, .gcv-onglets{max-width:100%;}
    #gc-body label, #gc-body select, #gc-body input, #gc-body textarea{max-width:100%;box-sizing:border-box;min-width:0;}
  }`;
  const st = document.createElement('style'); st.id = 'gadh-gc-gtm-fin'; st.textContent = css; document.head.appendChild(st);
})();
