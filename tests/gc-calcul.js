#!/usr/bin/env node
// GADH — Gestion des commandes : calculs métier (gadh-gc-calcul.js), sans navigateur ni base.
// Parcours complet chiffré : tarifs et paliers, import, offre et versions, commande, besoins nets,
// commandes fournisseurs, réceptions partielles avec frais, lots FIFO, réservations, livraisons
// partielles, retours, coûts réels figés, rentabilité, échéances, inventaire, migration, contrôles.
// Lancement (dans tests/) : npm run gc-calcul
'use strict';
const path = require('path');
const GC = require(path.join(__dirname, '..', 'gadh-gc-calcul.js'));
const r = [];
function ok(lib, cond, info){ r.push([lib, !!cond, info]); }
function egal(lib, a, b){ r.push([lib, Math.abs(a - b) < 0.006, a + ' (attendu ' + b + ')']); }
function leve(lib, fn, motif){ try { fn(); r.push([lib, false, 'aucune erreur']); } catch(e){ r.push([lib, e.gc === true && (!motif || motif.test(e.message)), e.message]); } }
const AUJ = '2026-11-11';
const ctx = (date, par) => ({date:date || AUJ, ts:Date.now(), par:par || 'Test'});

const D = {
  articles:[
    {id:'A1', ref:'TIS-001', designation:'Tissu', unite:'m', prixAchat:5, prixVente:10, paliers:[{min:100, prix:9}, {min:500, prix:8}], seuil:20, fournisseurId:'F1'},
    {id:'A2', ref:'FIL-01', designation:'Fil', unite:'bobine', prixAchat:2, prixVente:4, fournisseurId:'F2'},
    {id:'S1', ref:'SRV-POSE', designation:'Pose', unite:'service', prixAchat:20, prixVente:50, suiviStock:false}
  ],
  fournisseurs:[{id:'F1', nom:'Tissus Sfax', delai:10}, {id:'F2', nom:'Accessoires Tunis', delai:5}],
  tarifs:[
    {id:'T1', articleId:'A1', fournisseurId:'F1', prix:4.5, qteMin:0},
    {id:'T2', articleId:'A1', fournisseurId:'F1', prix:4.2, qteMin:300, debut:'2026-01-01', fin:'2026-12-31'},
    {id:'T3', articleId:'A1', fournisseurId:'F2', prix:4.4, qteMin:0},
    {id:'T4', articleId:'A1', fournisseurId:'F2', prix:3, qteMin:0, fin:'2025-12-31'}
  ],
  demandes:[], offres:[], cmdC:[], cmdF:[], receptions:[], livraisons:[], mouvements:[], reglages:{tva:19, validiteOffre:30}
};
const ajouter = (k, x) => { D[k] = D[k].filter(y => y.id !== x.id).concat([x]); };
const mvts = (l) => { D.mouvements = D.mouvements.concat(l); };

// ---------- Tarifs ----------
egal('palier : 50 m → prix de base 10', GC.prixPalier(D.articles[0], 50).prix, 10);
egal('palier : 100 m → 9', GC.prixPalier(D.articles[0], 100).prix, 9);
egal('palier : 550 m → 8', GC.prixPalier(D.articles[0], 550).prix, 8);
ok('paliers : contrôle des doublons de seuil', /même quantité/.test(GC.paliersValides([{min:10, prix:5}, {min:10, prix:4}])) && GC.paliersValides([{min:10, prix:5}]) === '');
egal('tarif d\'achat F1 pour 350 (palier négocié valable)', GC.tarifAchat(D, 'A1', 'F1', 350, AUJ).prix, 4.2);
egal('tarif d\'achat F1 pour 100', GC.tarifAchat(D, 'A1', 'F1', 100, AUJ).prix, 4.5);
const cmp = GC.comparerFournisseurs(D, 'A1', 350, AUJ);
ok('comparaison : F1 (4,20) meilleur que F2 (4,40), tarif expiré ignoré', cmp.length === 2 && cmp[0].fournisseurId === 'F1' && cmp[0].prix === 4.2 && cmp[0].meilleur && cmp[1].prix === 4.4, JSON.stringify(cmp));

// ---------- Import d'une liste de besoins ----------
const lignesCSV = GC.parserCSV('﻿Référence;Désignation;Qté;Unité\nTIS-001;Tissu;300;m\nFIL-01;Fil;50;bobine\nXXX;Inconnu;5;u\nTIS-001;Tissu;250;m\nFIL-01;Fil;abc;bobine\n"tis 001";"Tissu";"1,5";"kg"\n');
const col = GC.detecterColonnes(lignesCSV[0], lignesCSV.slice(1));
ok('import : colonnes détectées (référence, désignation, quantité, unité)', col.ref === 0 && col.designation === 1 && col.qte === 2 && col.unite === 3, JSON.stringify(col));
const an = GC.analyserImport(lignesCSV.slice(1), col, D.articles);
ok('import : statuts (ok, ok, inconnu, doublon, erreur, doublon + unité)', an.lignes.map(l => l.statut).join(',') === 'ok,ok,inconnu,doublon,erreur,doublon', an.lignes.map(l => l.statut).join(','));
ok('import : alerte d\'unité différente', an.lignes[5].alertes.some(a => /Unité/.test(a)));
const fus = GC.fusionnerDoublons(an.lignes.slice(0, 5));
ok('import : doublons regroupés (Tissu 550), ligne en erreur conservée à part', fus.length === 4 && fus[0].qte === 550 && fus.filter(l => l.statut === 'erreur').length === 1, JSON.stringify(fus.map(l => [l.ref, l.qte, l.statut])));
const dem = {id:'DP1', numero:'DP-2026-001', clientId:'K1', lignes:fus};
const of1 = GC.demandeVersOffre(D, dem, ctx());
egal('offre depuis la demande : Tissu 550 m au palier 8', of1.lignes.find(l => l.articleId === 'A1').pu, 8);
ok('offre : numéro OF-2026-001, ligne inconnue écartée', of1.numero === 'OF-2026-001' && of1.lignes.length === 2);
const t1 = GC.totaux(of1);
ok('offre : HT 4 600, TVA 19 %, TTC 5 474', t1.ht === 4600 && t1.ttc === 5474, JSON.stringify(t1));
ajouter('offres', of1);

// ---------- Versions ----------
let of2 = GC.nouvelleVersion(Object.assign({}, of1, {statut:'envoyee'}), ctx());
of2.lignes = GC.appliquerPaliers(of2.lignes.map(l => l.articleId === 'A1' ? Object.assign({}, l, {qte:450}) : l), D.articles)
  .concat([{articleId:'S1', ref:'SRV-POSE', designation:'Pose', unite:'service', qte:1, pu:50, remise:0}]);
ok('nouvelle version : v2 en brouillon, v1 conservée', of2.version === 2 && of2.statut === 'brouillon' && of2.versions.length === 1 && of2.versions[0].version === 1);
egal('v2 : 450 m → palier 9', of2.lignes[0].pu, 9);
const cv = GC.comparerVersions(of2.versions[0], of2);
ok('comparaison des versions : tissu modifié, pose ajoutée, écart −300', cv.lignes.find(l => /Tissu/.test(l.designation)).etat === 'modifiee' && cv.lignes.find(l => /Pose/.test(l.designation)).etat === 'ajoutee' && cv.ecartHT === -300, JSON.stringify(cv.ecartHT));
ok('offre expirée après la date de validité', GC.statutOffre({statut:'envoyee', validite:'2026-11-01'}, AUJ).cle === 'expiree');
leve('commande refusée tant que l\'offre n\'est pas acceptée', () => { ajouter('offres', of2); GC.offreVersCommande(D, of2.id, ctx()); }, /acceptée/);
of2.statut = 'acceptee'; ajouter('offres', of2);
const cc = GC.offreVersCommande(D, of2.id, Object.assign(ctx(), {dateSouhaitee:'2026-11-30'}));
ok('offre acceptée → commande CC-2026-001 sans ressaisie (3 lignes, prix repris)', cc.numero === 'CC-2026-001' && cc.lignes.length === 3 && cc.lignes[0].pu === 9 && cc.statut === 'confirmee' && cc.offreId === of2.id);
egal('commande : HT 4 300', GC.totaux(cc).ht, 4300);
ajouter('cmdC', cc); of2.commandeId = cc.id; ajouter('offres', of2);
leve('une offre ne donne qu\'une commande', () => GC.offreVersCommande(D, of2.id, ctx()), /déjà/);

// ---------- Stock initial et besoins nets ----------
mvts([{id:'mv0', type:'initial', articleId:'A2', qte:30, coutUnit:2, date:'2026-11-01', ts:1, lot:'Reprise'}]);
let B = GC.besoins(D, AUJ);
let bA1 = B.articles.find(a => a.articleId === 'A1'), bA2 = B.articles.find(a => a.articleId === 'A2');
ok('besoins : tissu manquant 450 + seuil 20 = 470 à commander chez F1 avant le 20/11', bA1.manquant === 450 && bA1.reappro === 20 && bA1.aCommander === 470 && bA1.fournisseurId === 'F1' && bA1.dateCommande === '2026-11-20' && bA1.urgence === 'a_commander', JSON.stringify(bA1));
ok('besoins : fil 50 demandé, 30 en stock, 20 manquants', bA2.couvertStock === 30 && bA2.manquant === 20 && bA2.aCommander === 20, JSON.stringify(bA2));
ok('besoins : la pose (sans stock) n\'apparaît pas', !B.articles.some(a => a.articleId === 'S1'));
const cfs = GC.commandesDepuisBesoins(D, [{articleId:'A1', qte:470, fournisseurId:'F1'}, {articleId:'A2', qte:20, fournisseurId:'F2'}], AUJ);
ok('2 commandes fournisseurs générées (CF-2026-001 et 002), tissu au tarif négocié 4,20', cfs.length === 2 && cfs[0].numero === 'CF-2026-001' && cfs[1].numero === 'CF-2026-002' && cfs[0].lignes[0].pu === 4.2 && cfs[0].datePrevue === '2026-11-21', JSON.stringify(cfs.map(c => [c.numero, c.lignes[0].pu, c.datePrevue])));
const cf1 = Object.assign(cfs[0], {statut:'validee'}), cf2 = cfs[1];
ajouter('cmdF', cf1); ajouter('cmdF', cf2);
B = GC.besoins(D, AUJ); bA1 = B.articles.find(a => a.articleId === 'A1');
ok('besoins après validation de CF-001 : couvert par la réception attendue', bA1.couvertAttente === 450 && bA1.manquant === 0 && bA1.reappro === 0 && bA1.urgence === 'couvert', JSON.stringify(bA1));
ok('stock en attente de réception : 470', GC.stockArticle(D, 'A1').attente === 470);
leve('CF brouillon : réception refusée', () => GC.receptionner(D, cf2.id, [{lid:'l1', qte:5}], ctx()), /Validez/);

// ---------- Réceptions partielles + frais ----------
const R1 = GC.receptionner(D, cf1.id, [{lid:'l1', qte:200}], Object.assign(ctx('2026-11-15'), {frais:[{libelle:'Transport', montant:100, methode:'quantite'}]}));
ok('réception partielle : BR-2026-001, statut « reçue en partie »', R1.reception.numero === 'BR-2026-001' && R1.statut === 'partielle' && R1.mouvements.length === 1);
ajouter('receptions', R1.reception); mvts(R1.mouvements);
leve('réception supérieure au reste refusée', () => GC.receptionner(D, cf1.id, [{lid:'l1', qte:300}], ctx()), /270 restant/);
const R2 = GC.receptionner(D, cf1.id, [{lid:'l1', qte:270, pu:4}], Object.assign(ctx('2026-11-18'), {frais:[{libelle:'Manutention', montant:54, methode:'valeur'}]}));
ok('réception du solde : commande « reçue »', R2.statut === 'recue');
ajouter('receptions', R2.reception); mvts(R2.mouvements);
const lotsA1 = GC.lots(D, 'A1');
ok('2 lots FIFO : 200 à 4,20 + 0,50 de frais ; 270 à 4,00 + 0,20', lotsA1.length === 2 && lotsA1[0].coutUnit === 4.2 && lotsA1[0].fraisUnit === 0.5 && lotsA1[1].coutUnit === 4 && lotsA1[1].fraisUnit === 0.2, JSON.stringify(lotsA1.map(l => [l.qteInit, l.coutUnit, l.fraisUnit])));
let S = GC.stockArticle(D, 'A1');
ok('stock tissu : physique 470, valeur 2 074', S.physique === 470 && S.valeur === 2074 && S.attente === 0, JSON.stringify(S));
ok('frais au prorata de la valeur', GC.fraisReception({lignes:[{qte:10, pu:1}, {qte:10, pu:3}], frais:[{montant:40, methode:'valeur'}]}).parLigne.join() === '1,3');

// ---------- Réservations ----------
const RES = GC.reserverTout(D, cc.id, ctx());
ok('réservation : 450 m de tissu et 30 bobines (disponible)', RES.length === 2 && RES[0].qte === 450 && RES[1].qte === 30, JSON.stringify(RES.map(m => m.qte)));
mvts(RES);
S = GC.stockArticle(D, 'A1');
ok('tissu : réservé 450, disponible 20', S.reserve === 450 && S.disponible === 20, JSON.stringify(S));
leve('réservation au-delà du reste refusée', () => GC.reserver(D, cc.id, 'l1', 1, ctx()), /reste à livrer/);
leve('une autre commande ne peut pas prendre le réservé', () => { const c2 = {id:'CC2', numero:'CC-X', clientId:'K2', statut:'confirmee', lignes:[{lid:'l1', articleId:'A1', qte:100, pu:10}]}; GC.reserver(Object.assign({}, D, {cmdC:D.cmdC.concat([c2])}), 'CC2', 'l1', 30, ctx()); }, /20 disponible/);

// ---------- Livraison partielle ----------
const L1 = GC.livrer(D, cc.id, [{lid:'l1', qte:300}, {lid:'l2', qte:30}, {lid:'l3', qte:1}], Object.assign(ctx('2026-11-20'), {frais:[{libelle:'Transport client', montant:60}]}));
ok('livraison BL-2026-001 : statut « livrée en partie »', L1.livraison.numero === 'BL-2026-001' && L1.statut === 'partielle');
const al = L1.livraison.lignes[0].allocations;
ok('FIFO : 200 du 1er lot puis 100 du 2e', al.length === 2 && al[0].qte === 200 && al[0].coutUnit === 4.2 && al[1].qte === 100 && al[1].coutUnit === 4, JSON.stringify(al));
ajouter('livraisons', L1.livraison); mvts(L1.mouvements);
ok('réservé restant : 150 m, fil 0', GC.reservations(D)[cc.id + '|l1'] === 150 && GC.reservations(D)[cc.id + '|l2'] === 0);
const c1 = GC.coutLivraison(L1.livraison);
ok('coût réel BL-001 : CA 2 870, achat 1 320, frais lots 120, frais livraison 60, coût 1 500, marge 1 370', c1.ca === 2870 && c1.achat === 1320 && c1.fraisLots === 120 && c1.fraisLivraison === 60 && c1.cout === 1500 && c1.marge === 1370, JSON.stringify(c1));
ok('taux de marque 47,74 %, taux de marge 91,33 %, provisoire (prestation au coût théorique)', c1.tauxMarque === 47.74 && c1.tauxMarge === 91.33 && c1.provisoire === true);
leve('livraison au-delà du reste refusée', () => GC.livrer(D, cc.id, [{lid:'l1', qte:151}], ctx()), /150 restant/);
leve('livraison sans stock du fil refusée', () => GC.livrer(D, cc.id, [{lid:'l2', qte:20}], ctx()), /insuffisant/);

// ---------- Solde : réception du fil puis livraison ----------
cf2.statut = 'envoyee'; ajouter('cmdF', cf2);
const R3 = GC.receptionner(D, cf2.id, [{lid:'l1', qte:20, pu:2.1}], ctx('2026-11-21'));
ajouter('receptions', R3.reception); mvts(R3.mouvements);
const L2 = GC.livrer(D, cc.id, [{lid:'l1', qte:150}, {lid:'l2', qte:20}], ctx('2026-11-25'));
ok('livraison du solde : commande « livrée »', L2.statut === 'livree');
ajouter('livraisons', L2.livraison); mvts(L2.mouvements);
ok('statut de la commande calculé : livrée, reste 0', GC.statutCmdC(cc, GC.livres(D)).cle === 'livree' && GC.livres(D)[cc.id + '|l1'] === 450);
const c2 = GC.coutLivraison(L2.livraison);
ok('coût réel BL-002 : CA 1 430, coût 672, marge 758', c2.ca === 1430 && c2.cout === 672 && c2.marge === 758, JSON.stringify(c2));
S = GC.stockArticle(D, 'A1');
ok('stock tissu après livraisons : 20 (reste du 2e lot), réservé 0', S.physique === 20 && S.reserve === 0 && S.disponible === 20, JSON.stringify(S));

// ---------- Rentabilité ----------
const RT = GC.rentabilite(D, {});
ok('rentabilité totale : CA 4 300, coût 2 172, marge 2 128', RT.total.ca === 4300 && RT.total.cout === 2172 && RT.total.marge === 2128, JSON.stringify(RT.total));
egal('par article : somme des CA = total', RT.parArticle.reduce((s, x) => s + x.ca, 0), 4300);
ok('par article : somme des coûts = total (aux arrondis d\'affichage près)', Math.abs(RT.parArticle.reduce((s, x) => s + x.cout, 0) - 2172) < 0.03);
ok('par commande / client / livraison', RT.parCommande.length === 1 && RT.parCommande[0].marge === 2128 && RT.parClient[0].cle === 'K1' && RT.parLivraison.length === 2);
ok('filtre article (tissu) : CA 4 050', GC.rentabilite(D, {articleId:'A1'}).total.ca === 4050);
ok('filtre période (avant le 21/11) : seulement BL-001', GC.rentabilite(D, {au:'2026-11-21'}).total.ca === 2870);

// ---------- Coûts figés (pas de changement rétroactif) ----------
const rec1 = Object.assign({}, D.receptions.find(x => x.id === R1.reception.id)); rec1.frais = [{libelle:'Transport', montant:150, methode:'quantite'}]; ajouter('receptions', rec1);
ok('frais de réception modifiés : le BL-001 garde son coût d\'origine', GC.coutLivraison(D.livraisons.find(b => b.id === L1.livraison.id)).cout === 1500);
const RV = GC.revaloriserLivraison(D, L1.livraison.id, ctx());
ok('revalorisation volontaire : +50 de frais, ancien calcul conservé', RV.apres.cout === 1550 && RV.livraison.histoCouts.length === 1 && RV.livraison.histoCouts[0].avant.cout === 1500);

// ---------- Facturation ----------
const LF = GC.lignesFacture([D.livraisons[0], D.livraisons[1]]);
egal('lignes de facture des 2 BL : total HT 4 300', LF.reduce((s, l) => s + GC.montantLigne(l), 0), 4300);
ok('libellés de facture avec n° de BL', /BL BL-2026-001/.test(LF[0].designation));
leve('BL déjà facturé : refusé', () => GC.lignesFacture([Object.assign({}, D.livraisons[0], {factureId:'f1'})]), /déjà facturée/);
leve('annulation d\'un BL facturé refusée', () => GC.annulerLivraison(Object.assign({}, D, {livraisons:[Object.assign({}, D.livraisons[0], {factureId:'f1'})]}), D.livraisons[0].id, ctx()), /avoir/);

// ---------- Retours, annulations, inventaire ----------
const RC = GC.retourClient(D, L2.livraison.id, 'l1', 10, Object.assign(ctx(), {motif:'Défaut'}));
ajouter('livraisons', RC.livraison); mvts(RC.mouvements);
ok('retour client 10 m : stock 30, coût du BL-002 recalculé sur 140 m (marge 710)', GC.stockArticle(D, 'A1').physique === 30 && GC.coutLivraison(RC.livraison).marge === 710, GC.coutLivraison(RC.livraison).marge);
ok('après retour : reste à livrer 10 m, commande de nouveau « livrée en partie »', GC.statutCmdC(cc, GC.livres(D)).cle === 'partielle');
leve('retour supérieur au livré refusé', () => GC.retourClient(D, L2.livraison.id, 'l1', 141, ctx()), /supérieur/);
leve('annulation d\'une réception déjà consommée refusée', () => GC.annulerReception(D, R3.reception.id, ctx()), /déjà sortie/);
leve('retour fournisseur supérieur au lot refusé', () => GC.retourFournisseur(D, lotsA1[1].id, 100, ctx()), /reste du lot/);
leve('ajustement sans motif refusé', () => GC.ajuster(D, 'A1', -1, ctx()), /motif/);
const INV = GC.inventaire(D, 'A1', 25, ctx());
ok('inventaire : 25 comptés pour 30 → sortie de 5 (FIFO)', INV.ecart === -5 && INV.mouvements.length === 1 && INV.mouvements[0].type === 'inventaire_moins' && INV.mouvements[0].qte === 5);
mvts(INV.mouvements);
const AJ = GC.ajuster(D, 'A1', 4, Object.assign(ctx(), {motif:'Trouvé en réserve', coutUnit:4.1}));
ok('ajustement + : nouveau lot au coût indiqué', AJ[0].type === 'ajustement_plus' && AJ[0].coutUnit === 4.1);
mvts(AJ);
ok('stock tissu : 29', GC.stockArticle(D, 'A1').physique === 29);
leve('stock jamais négatif (sortie > physique)', () => GC.ajuster(D, 'A1', -30, Object.assign(ctx(), {motif:'x'})), /physique/);

// ---------- Commandes annuelles ----------
const E = GC.genererEcheances([{lid:'l1', qte:100}], '2026-01-15', 4, 3);
ok('échéances : 4 dates trimestrielles de 25', E.map(e => e.date).join() === '2026-01-15,2026-04-15,2026-07-15,2026-10-15' && E.every(e => e.qtes.l1 === 25));
ok('fin de mois : 31/01 + 1 mois = 28/02', GC.ajouterMois('2026-01-31', 1) === '2026-02-28');
const ca = {id:'CA1', numero:'CC-A', type:'annuelle', statut:'confirmee', lignes:[{lid:'l1', articleId:'A2', qte:100}], echeances:E};
const se = GC.suiviEcheances(ca, {'CA1|l1':30}, '2026-05-01');
ok('suivi des échéances : 1re livrée, 2e en retard (reste 20), 3e et 4e à venir', se.map(e => e.cle).join() === 'livree,retard,a_venir,a_venir' && se[1].reste === 20, se.map(e => e.cle + ':' + e.reste).join());
ok('commande annuelle en retard', GC.retardCmdC(ca, {'CA1|l1':30}, '2026-05-01') === true);
ok('contrôle : échéances supérieures à la quantité prévue', /dépassent/.test(GC.echeancesValides({type:'annuelle', lignes:[{lid:'l1', qte:10, designation:'Fil'}], echeances:[{date:'2026-01-01', qtes:{l1:11}}]})));
const DB = Object.assign({}, D, {cmdC:D.cmdC.concat([Object.assign({}, ca, {echeances:GC.genererEcheances([{lid:'l1', qte:100}], '2026-12-01', 4, 1)})])});
const BA = GC.besoins(DB, AUJ).lignes.filter(l => l.cmdId === 'CA1');
ok('besoins de la commande annuelle : une ligne par échéance non livrée', BA.length === 4 && BA[0].date === '2026-12-01' && BA[0].qte === 25, JSON.stringify(BA.map(b => [b.date, b.qte])));

// ---------- Migration ----------
const D0 = {articles:[{id:'N1', ref:'TIS-001', designation:'Tissu existant'}], fournisseurs:[], tarifs:[], offres:[], cmdC:[], cmdF:[], receptions:[], livraisons:[], mouvements:[]};
const anciens = {
  four:{fo1:{nom:'Tissus Sfax', tel:'1'}},
  art:{ar1:{nom:'Fil', categorie:'accessoire', prix:2, prixVente:4, fournisseurId:'fo1', unite:'bobine', seuil:5}, ar2:{nom:'Tissu', ref:'TIS-001', categorie:'matiere'}, ar3:{nom:'Pose', categorie:'produit', prixVente:50}},
  mv:{m1:{articleId:'ar1', type:'entree', qte:30}, m2:{articleId:'ar1', type:'sortie', qte:5}},
  bons:{b1:{numero:'BA-2026-001', statut:'commande', fournisseurId:'fo1', lignes:[{articleId:'ar1', qte:30, pu:2, recu:30}]}},
  devis:{d1:{numero:'DV-2026-001', statut:'accepte', clientId:'K1', lignes:[{articleId:'ar1', qte:10, pu:4}]}},
  cmd:{c1:{numero:'CC-2026-001', statut:'encours', clientId:'K1', lignes:[{articleId:'ar1', designation:'Fil', qte:10, pu:4, livre:5}]}},
  bl:{l1:{numero:'BL-2026-001', commandeId:'c1', clientId:'K1', statut:'livre', lignes:[{articleId:'ar1', designation:'Fil', qte:5, pu:4, _i:0}]}}
};
const M = GC.migrerAnciens(D0, anciens, ctx());
ok('migration : tissu rattaché à l\'article existant (même référence), pas de doublon', M.ajouts.articles.length === 2 && !M.ajouts.articles.some(a => a.ref === 'TIS-001'));
ok('migration : prestation non suivie en stock', M.ajouts.articles.find(a => a.designation === 'Pose').suiviStock === false);
ok('migration : stock initial 25 bobines au dernier prix', M.ajouts.mouvements.length === 1 && M.ajouts.mouvements[0].qte === 25 && M.ajouts.mouvements[0].coutUnit === 2);
ok('migration : devis → offre acceptée, commande et BL reliés', M.ajouts.offres[0].statut === 'acceptee' && M.ajouts.livraisons[0].cmdId === M.ajouts.cmdC[0].id && M.ajouts.livraisons[0].lignes[0].lid === 'l1');
ok('migration : bon d\'achat → commande fournisseur + réception historique sans mouvement', M.ajouts.cmdF[0].numero === 'CF-2026-001' && M.ajouts.receptions[0].historique === true);
const D1 = {}; Object.keys(D0).forEach(k => { D1[k] = D0[k].concat(M.ajouts[k] || []); });
const DL = GC.livres(D1);
ok('migration : livré repris (5 sur 10), commande « livrée en partie »', GC.statutCmdC(M.ajouts.cmdC[0], DL).cle === 'partielle');
const M2 = GC.migrerAnciens(D1, anciens, ctx());
ok('migration relancée : aucun doublon', Object.values(M2.ajouts).every(l => l.length === 0), JSON.stringify(Object.fromEntries(Object.entries(M2.ajouts).map(([k, v]) => [k, v.length]))));
ok('références croisées après migration : aucune anomalie', GC.verifierReferences(D1).length === 0, GC.verifierReferences(D1).join(' | '));

// ---------- Contrôles finaux ----------
ok('références croisées du parcours complet : aucune anomalie', GC.verifierReferences(D).length === 0, GC.verifierReferences(D).join(' | '));
ok('numéro en double détecté', GC.verifierReferences(Object.assign({}, D, {livraisons:D.livraisons.concat([Object.assign({}, D.livraisons[0], {id:'dbl'})])})).some(x => /double/.test(x)));
ok('doublon du catalogue détecté (même référence, casse et tirets ignorés)', !!GC.doublonArticle(D.articles, {ref:'tis 001'}) && !GC.doublonArticle(D.articles, {ref:'TIS-002', designation:'Autre'}));

r.forEach(([l, o, i]) => console.log((o ? 'ok   ' : 'ÉCHEC ') + l + (o ? '' : ' → ' + i)));
const n = r.filter(x => x[1]).length;
console.log(n + '/' + r.length);
process.exit(n === r.length ? 0 : 1);
