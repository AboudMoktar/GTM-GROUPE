// GADH — Gestion des commandes : saisie simple d'une commande (l'essentiel seulement),
// client créé à la volée, article reconnu à la frappe. Données inventées uniquement.
const { chromium } = require('playwright');
const serveur = require('./serveur.js');
let echecs = 0;
function ok(c, m){ console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if(!c) echecs++; }
(async () => {
  const s = serveur.demarrer(8796), b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:1366,height:768}, serviceWorkers:'block'});
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => { if(!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), r => r.abort());
  await p.goto('http://localhost:8796/index.html');
  await p.waitForFunction(() => typeof renderShell === 'function');
  await p.evaluate(() => {
    hlEcritureAutorisee = () => true;   // essai sans base : l'enregistrement local est accepté
    currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true,gadh:true,mgt:true}};
    activeSociete = 'gadh'; activeModule = 'gadh-commandes'; renderShell();
    gcEnregistrer('articles', [{id:'ar1', ref:'ART-001', designation:'Tissu maille exemple', unite:'m', prixVente:7, prixAchat:4.5, actif:true, suiviStock:true, paliers:[], histoPrix:[]}]);
    setJSON('gadh_fact_clients', {k1:{nom:'Client Exemple Un'}}); gcCacheD = null;
    gcNouveauDoc('commande');
  });
  const visibles = async () => p.evaluate(() => [...document.querySelectorAll('#gc-body input:not([type=hidden]), #gc-body select, #gc-body textarea')].filter(e => e.offsetParent !== null).map(e => e.id));
  let v = await visibles();
  ok(await p.evaluate(() => document.getElementById('gc-body').classList.contains('gc-simple')), 'la saisie simple est l\'écran par défaut');
  ok(v.join(',') === 'ge-tiers-nom,ge-date,ge-dateSouhaitee,gel-designation-0,gel-qte-0,gel-pu-0', 'commande simple : 6 champs visibles (client, 2 dates, article, quantité, prix) — ' + v.length);
  await p.waitForTimeout(700); await p.screenshot({path:'/tmp/audit/commande-simple.png'});
  // article reconnu à la frappe
  await p.fill('#gel-designation-0', 'ART-001 · Tissu maille exemple'); await p.dispatchEvent('#gel-designation-0', 'change');
  ok(await p.evaluate(() => gcEdit.doc.lignes[0].articleId === 'ar1' && gcEdit.doc.lignes[0].pu === 7 && gcEdit.doc.lignes[0].unite === 'm'), 'article connu : rattaché, prix et unité repris');
  ok(await p.inputValue('#gel-designation-0') === 'Tissu maille exemple', 'article connu : désignation affichée');
  await p.fill('#gel-qte-0', '20'); await p.dispatchEvent('#gel-qte-0', 'change');
  // ligne libre
  await p.click('[data-gc="ajouter-ligne"]');
  await p.fill('#gel-designation-1', 'Service exemple'); await p.dispatchEvent('#gel-designation-1', 'change');
  await p.fill('#gel-pu-1', '15'); await p.dispatchEvent('#gel-pu-1', 'change');
  ok(await p.evaluate(() => gcEdit.doc.lignes[1].articleId === '' && gcEdit.doc.lignes[1].designation === 'Service exemple'), 'article inconnu : ligne libre');
  // client inconnu → annoncé, créé à l'enregistrement
  await p.fill('#ge-tiers-nom', 'Client Tout Neuf'); await p.dispatchEvent('#ge-tiers-nom', 'change');
  ok(await p.locator('[data-gc="tiers-nouveau"]').count() === 1, 'client inconnu : création annoncée');
  ok(await p.evaluate(() => Object.keys(gcClients()).length) === 1, 'client inconnu : rien créé avant l\'enregistrement');
  await p.click('[data-gc="enregistrer-doc"]'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const D = gcD(), c = D.cmdC[0], cl = gcClients(); return {n:D.cmdC.length, client:c && (cl[c.clientId] || {}).nom, nbCli:Object.keys(cl).length, lignes:c && c.lignes.length, ht:c && GC.totaux(c).ht, numero:c && c.numero, tab:activeTab}; });
  ok(r.n === 1 && r.client === 'Client Tout Neuf' && r.nbCli === 2, 'commande enregistrée, nouveau client créé avec son nom');
  ok(r.lignes === 2 && Math.abs(r.ht - 155) < 1e-6 && !!r.numero, 'lignes et total corrects (20 × 7 + 1 × 15 = 155), numéro attribué');
  // client existant tapé (casse différente) → pas de doublon
  await p.evaluate(() => gcNouveauDoc('commande'));
  await p.fill('#ge-tiers-nom', 'client exemple un'); await p.dispatchEvent('#ge-tiers-nom', 'change');
  ok(await p.locator('[data-gc="tiers-nouveau"]').count() === 0 && await p.evaluate(() => gcEdit.doc.clientId === 'k1'), 'client existant reconnu, pas de doublon');
  // sans client → refus clair
  await p.fill('#ge-tiers-nom', ''); await p.dispatchEvent('#ge-tiers-nom', 'change');
  await p.fill('#gel-designation-0', 'Service exemple'); await p.dispatchEvent('#gel-designation-0', 'change');
  await p.click('[data-gc="enregistrer-doc"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => gcD().cmdC.length) === 1, 'sans client : rien n\'est enregistré');
  // toutes les options : écran d'origine, et rien n'est perdu en changeant de mode
  await p.click('[data-gc="mode-complet"]');
  v = await visibles();
  ok(v.indexOf('ge-client') >= 0 && v.indexOf('ge-type') >= 0 && v.indexOf('gel-remise-0') >= 0 && v.indexOf('ge-tva') >= 0, 'toutes les options : écran complet d\'origine');
  ok(await p.inputValue('#gel-designation-0') === 'Service exemple', 'changement de mode : la saisie est conservée');
  await p.fill('#gel-remise-0', '10'); await p.dispatchEvent('#gel-remise-0', 'change');
  await p.click('[data-gc="mode-simple"]');
  ok(await p.evaluate(() => gcEdit.doc.lignes[0].remise === 10 && !document.getElementById('gc-body').classList.contains('gc-simple')), 'une remise saisie n\'est jamais cachée : l\'écran complet reste affiché');
  // un document qui a déjà des options avancées s'ouvre en écran complet
  await p.evaluate(() => { try { localStorage.setItem('gc_saisie', 'simple'); } catch(e){} gcNouveauDoc('commande', {remise:5, clientId:'k1'}); });
  ok(await p.evaluate(() => !document.getElementById('gc-body').classList.contains('gc-simple')), 'document avec remise : ouvert en écran complet (rien de caché)');
  // commande fournisseur : fournisseur créé à la volée
  await p.evaluate(() => gcNouveauDoc('achat'));
  await p.fill('#ge-tiers-nom', 'Fournisseur Tout Neuf'); await p.dispatchEvent('#ge-tiers-nom', 'change');
  await p.fill('#gel-designation-0', 'Tissu maille exemple'); await p.dispatchEvent('#gel-designation-0', 'change');
  await p.click('[data-gc="enregistrer-doc"]'); await p.waitForTimeout(300);
  const a = await p.evaluate(() => { const D = gcD(), c = D.cmdF[0]; return {n:D.cmdF.length, four:c && (D.fournisseurs.find(f => f.id === c.fournisseurId) || {}).nom, pu:c && c.lignes[0].pu, art:c && c.lignes[0].articleId}; });
  ok(a.n === 1 && a.four === 'Fournisseur Tout Neuf' && a.art === 'ar1' && a.pu === 4.5, 'commande fournisseur : fournisseur créé, article reconnu au prix d\'achat');
  // téléphone
  await p.setViewportSize({width:390, height:844});
  await p.evaluate(() => gcNouveauDoc('commande'));
  ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, 'téléphone : pas de défilement horizontal');
  await p.waitForTimeout(700); await p.screenshot({path:'/tmp/audit/commande-simple-tel.png'});
  ok(err.length === 0, 'aucune erreur JavaScript' + (err.length ? ' — ' + err.join(' | ') : ''));
  await b.close(); s.close();
  console.log(echecs ? echecs + ' échec(s)' : 'ok   aucune erreur');
  process.exit(echecs ? 1 : 0);
})();
