// GADH — Gestion des commandes : modèle Excel à trois feuilles (Articles, Fournisseurs, Clients)
// et import de tout le fichier en une fois. Données inventées uniquement.
const { chromium } = require('playwright');
const serveur = require('./serveur.js');
const fs = require('fs'), path = require('path'), os = require('os'), XLSX = require('xlsx');
const BIB = require.resolve('xlsx/dist/xlsx.full.min.js');
let echecs = 0;
function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if(!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8798), b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:1366,height:768}, serviceWorkers:'block', acceptDownloads:true});
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => { if(!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8798/index.html');
  await p.waitForFunction(() => typeof renderShell === 'function');
  await p.addScriptTag({path:BIB});
  await p.evaluate(() => {
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true,gadh:true,mgt:true}};
    hlEcritureAutorisee = () => true;   // essai sans base : l'enregistrement local est accepté
    activeSociete = 'gadh'; activeModule = 'gadh-commandes'; renderShell(); nav('gc-import-catalogue');
  });
  // 1. le modèle
  ok(await p.locator('[data-gc="modele-import"]').count() === 1, 'bouton « Télécharger le modèle Excel »');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-gc="modele-import"]')]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gcimp-')), modele = path.join(tmp, 'modele.xlsx');
  await dl.saveAs(modele);
  const wb = XLSX.readFile(modele);
  ok(['Articles', 'Fournisseurs', 'Clients'].every(n => wb.SheetNames.indexOf(n) >= 0), 'modèle : feuilles Articles, Fournisseurs, Clients');
  ok(wb.SheetNames.some(n => /mode/i.test(n)), 'modèle : feuille de mode d\'emploi');
  const tetes = n => XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1})[0];
  ok(tetes('Articles').join('|') === 'Référence|Désignation|Catégorie|Unité|Prix d\'achat|Prix de vente|Seuil|Fournisseur', 'modèle : colonnes des articles');
  ok(tetes('Fournisseurs')[0] === 'Nom' && tetes('Clients')[0] === 'Nom', 'modèle : le nom en première colonne des tiers');
  // 2. le modèle rempli
  const ajouter = (n, lignes) => XLSX.utils.sheet_add_aoa(wb.Sheets[n], lignes, {origin:1});
  ajouter('Fournisseurs', [['Tissus Exemple', 'Mme Test', '70 000 001', 'contact@tissus-exemple.test', '0000001A', '', '30 jours', '10', 'Tissu', 'Zone A', ''],
    ['Fils Exemple', '', '', 'adresse-fausse', '', '', '', '', '', '', ''], ['', 'sans nom', '', '', '', '', '', '', '', '', '']]);
  ajouter('Clients', [['Client Exemple Un', '0000002B', 'M. Essai', '70 000 002', 'achats@client-un.test', 'Comptant', 'Rue 1'], ['Client Exemple Deux', '', '', '', '', '', '']]);
  ajouter('Articles', [['ART-001', 'Tissu maille exemple', 'Tissu', 'm', '4,5', '7', '100', 'Tissus Exemple'], ['ART-002', 'Fil exemple', 'Fil', 'cône', '2', '3,2', '', ''], ['', '', '', '', 'abc', '', '', '']]);
  const rempli = path.join(tmp, 'rempli.xlsx'); XLSX.writeFile(wb, rempli);
  await p.setInputFiles('#gc-cat-fichier', rempli);
  await p.waitForSelector('[data-gc="valider-import-catalogue"]');
  const txt = await p.locator('#gc-body').innerText();
  ok(/Fournisseurs\s*·\s*3 ligne/.test(txt) && /1 création/.test(txt), 'aperçu : fournisseurs lus, lignes fautives signalées');
  ok(/E-mail invalide/.test(txt) && /Nom manquant/.test(txt), 'aperçu : e-mail invalide et nom manquant refusés');
  ok(/Clients\s*·\s*2 ligne/.test(txt), 'aperçu : clients lus');
  ok(/Importer 5 fiche/.test(await p.locator('[data-gc="valider-import-catalogue"]').innerText()), 'bouton : 5 fiches valides (1 fournisseur, 2 clients, 2 articles)');
  const avant = await p.evaluate(() => ({a:gcD().articles.length, f:gcD().fournisseurs.length, c:Object.keys(gcClients()).length}));
  ok(avant.a === 0 && avant.f === 0 && avant.c === 0, 'rien n\'est enregistré avant validation');
  await p.click('[data-gc="valider-import-catalogue"]');
  await p.waitForTimeout(300);
  const ap = await p.evaluate(() => { const D = gcD(), f = D.fournisseurs.find(x => x.nom === 'Tissus Exemple'), a = D.articles.find(x => x.ref === 'ART-001'), c = Object.values(gcClients());
    return {a:D.articles.length, f:D.fournisseurs.length, c:c.length, four:f, art:a, cli:c.find(x => x.nom === 'Client Exemple Un')}; });
  ok(ap.f === 1 && ap.four && ap.four.tel === '70 000 001' && ap.four.delai === 10 && ap.four.actif === true, 'fournisseur créé avec ses coordonnées et son délai');
  ok(ap.c === 2 && ap.cli && ap.cli.mf === '0000002B' && ap.cli.conditions === 'Comptant', 'clients créés avec leurs informations');
  ok(ap.a === 2 && ap.art && ap.art.prixAchat === 4.5 && ap.art.fournisseurId === ap.four.id, 'articles créés et rattachés au fournisseur du fichier');
  // 3. réimport : mise à jour, pas de doublon
  await p.evaluate(() => nav('gc-import-catalogue'));
  const wb2 = XLSX.readFile(rempli);
  XLSX.utils.sheet_add_aoa(wb2.Sheets['Fournisseurs'], [['tissus exemple', '', '70 999 999']], {origin:1});
  XLSX.utils.sheet_add_aoa(wb2.Sheets['Fournisseurs'], [['', '', '', '', '', '', '', '', '', '', '']], {origin:2});
  const maj = path.join(tmp, 'maj.xlsx'); XLSX.writeFile(wb2, maj);
  await p.setInputFiles('#gc-cat-fichier', maj);
  await p.waitForSelector('[data-gc="valider-import-catalogue"]');
  await p.click('[data-gc="valider-import-catalogue"]');
  await p.waitForTimeout(300);
  const ap2 = await p.evaluate(() => { const D = gcD(), f = D.fournisseurs.find(x => x.nom.toLowerCase() === 'tissus exemple'); return {a:D.articles.length, f:D.fournisseurs.length, c:Object.keys(gcClients()).length, tel:f.tel, contact:f.contact}; });
  ok(ap2.f === 1 && ap2.a === 2 && ap2.c === 2, 'réimport : aucun doublon');
  ok(ap2.tel === '70 999 999' && ap2.contact === 'Mme Test', 'réimport : fiche mise à jour, une case vide ne vide pas l\'information existante');
  // 4. un fichier simple (une seule feuille d'articles) fonctionne toujours
  await p.evaluate(() => nav('gc-import-catalogue'));
  const csv = path.join(tmp, 'simple.csv'); fs.writeFileSync(csv, 'Référence;Désignation;Prix de vente\nART-003;Bouton exemple;0,5\n');
  await p.setInputFiles('#gc-cat-fichier', csv);
  await p.waitForSelector('[data-gc="valider-import-catalogue"]');
  await p.click('[data-gc="valider-import-catalogue"]');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => gcD().articles.length) === 3, 'fichier simple d\'articles (CSV) : import inchangé');
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close();
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  process.exit(echecs ? 1 : 0);
})();
