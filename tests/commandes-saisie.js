#!/usr/bin/env node
// Suivi PERCKO, onglet « Commandes » : consultation, Nouvelle commande, Modifier (brouillon + Valider + message de confirmation),
// Supprimer (en tapant EFFACER), modification à n'importe quelle étape.
// Lancement (dans tests/) : npm run commandes-saisie
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), r = [], err = [];
  const p = await b.newPage(); p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.print = () => {}; });
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof vCmd === 'function' && typeof S === 'object');
  await p.evaluate(() => { ui.lot = ''; ui.tab = 'cmd'; render(); });
  const txt = (sel) => p.locator(sel).first().textContent();
  const cellule = (lib, z) => p.locator('table.entry tr', {has: p.locator('td.lib', {hasText: lib})}).filter({has: p.locator('td.sz', {hasText: new RegExp('^' + z + '$')})}).locator('input');
  const nb = () => p.evaluate(() => S.lines.length);
  // ---------- nouvelle commande ----------
  r.push(['sans commande : bouton « Nouvelle commande »', await p.locator('button:has-text("Nouvelle commande")').count() === 1]);
  await p.click('button:has-text("Nouvelle commande")'); await p.waitForTimeout(150);
  r.push(['nouvelle commande : saisie avec barre Valider / Annuler', /Nouvelle commande/.test(await txt('#view h2')) && await p.locator('.cm-barre button:has-text("Valider")').count() === 1]);
  await p.fill('#mLot', 'pk202701'); await p.dispatchEvent('#mLot', 'change'); await p.waitForTimeout(150);
  await cellule('PHARMA_HOMME COL V NOIR', 'M').fill('120'); await cellule('PHARMA_HOMME COL V NOIR', 'M').press('Enter');
  await cellule('PHARMA_HOMME COL V NOIR', 'L').fill('80'); await cellule('PHARMA_HOMME COL V NOIR', 'L').press('Enter'); await p.waitForTimeout(150);
  r.push(['saisie : rien n\'est enregistré avant Valider', await nb() === 0 && await p.locator('input.chg').count() === 2 && /2 modification/.test(await txt('.cm-barre'))]);
  await p.click('.seg button:has-text("ALLOGA")'); await p.waitForTimeout(150);
  await cellule('PHARMA_HOMME COL V NOIR', 'M').fill('60'); await cellule('PHARMA_HOMME COL V NOIR', 'M').press('Enter'); await p.waitForTimeout(100);
  await p.click('.seg button:has-text("NEOLYS")'); await p.waitForTimeout(150);
  r.push(['changer de client garde la saisie', await cellule('PHARMA_HOMME COL V NOIR', 'M').inputValue() === '120' && /3 modification/.test(await txt('.cm-barre'))]);
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  const m1 = await txt('.sx-modal');
  r.push(['Valider : message de confirmation de la création', /Créer la commande PK202701/.test(m1) && /3 taille\(s\) · 260 pièces/.test(m1) && /ALLOGA · PHARMA_HOMME COL V NOIR M/.test(m1)]);
  await p.click('.sx-modal .sx-annul'); await p.waitForTimeout(100);
  r.push(['« Revenir à la saisie » : toujours rien d\'enregistré', await nb() === 0 && await p.locator('.cm-barre').count() === 1]);
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150); await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['confirmé : commande créée', await nb() === 3 && await p.evaluate(() => ui.lot === 'PK202701' && !ui.cmdEd && findLine('PK202701', 'ALLOGA', 'PHARMA_HOMME COL V NOIR', 'M').qty === 60)]);
  r.push(['consultation : boutons Modifier et Supprimer, quantités en lecture', await p.locator('.cm-act button:has-text("Modifier")').count() === 1 && await p.locator('.cm-act button:has-text("Supprimer")').count() === 1 && await p.locator('table.entry input.lu[readonly]').count() > 0]);
  // numéro déjà pris
  await p.click('.cm-act button:has-text("Nouvelle commande")'); await p.waitForTimeout(150);
  await p.fill('#mLot', 'PK202701'); await p.dispatchEvent('#mLot', 'change'); await p.waitForTimeout(100);
  await cellule('PHARMA_HOMME COL V NOIR', 'S').fill('5'); await cellule('PHARMA_HOMME COL V NOIR', 'S').press('Enter');
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  r.push(['nouvelle commande avec un N° existant : refusée', /existe déjà/.test(await txt('#toast')) && await p.locator('.sx-modal').count() === 0 && await nb() === 3]);
  await p.click('.cm-barre button:has-text("Annuler")'); await p.waitForTimeout(150);
  // ---------- modifier ----------
  await p.click('.cm-act button:has-text("Modifier")'); await p.waitForTimeout(150);
  r.push(['Modifier : saisie de la commande', /Modification de la commande PK202701/.test(await txt('#view h2')) && await p.locator('#mLot').isDisabled()]);
  await cellule('PHARMA_HOMME COL V NOIR', 'M').fill('150'); await cellule('PHARMA_HOMME COL V NOIR', 'M').press('Enter');
  await cellule('PHARMA_HOMME COL V NOIR', 'L').fill('0'); await cellule('PHARMA_HOMME COL V NOIR', 'L').press('Enter'); await p.waitForTimeout(100);
  await p.fill('#mLiv', '2027-02-15'); await p.dispatchEvent('#mLiv', 'change');
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  const m2 = await txt('.sx-modal');
  r.push(['message : chaque modification (avant → après), total, livraison', /3 modification\(s\) · total 260 → 210 pièces/.test(m2) && /120 → 150 \(\+30\)/.test(m2) && /80 → 0 \(-80\)/.test(m2) && /Livraison prévue : — → 15\/02\/27/.test(m2)]);
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['modifications enregistrées', await p.evaluate(() => findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'M').qty === 150 && !findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'L') && S.lots.PK202701.livraison === '2027-02-15')]);
  // Annuler abandonne
  await p.click('.cm-act button:has-text("Modifier")'); await p.waitForTimeout(150);
  await cellule('PHARMA_HOMME COL V NOIR', 'M').fill('999'); await cellule('PHARMA_HOMME COL V NOIR', 'M').press('Enter');
  await p.click('.cm-barre button:has-text("Annuler")'); await p.waitForTimeout(150);
  r.push(['Annuler : rien n\'est changé', await p.evaluate(() => findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'M').qty === 150 && !ui.cmdEd)]);
  // ---------- à n'importe quelle étape ----------
  await p.evaluate(() => { const l = findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'M'); S.lots.PK202701.ready = '2027-01-05'; S.moves.push({id:'MX1', date:'2027-01-06', lineId:l.id, stage:'cp', qty:150, nc:0, note:''}); render(); });
  await p.click('.cm-act button:has-text("Modifier")'); await p.waitForTimeout(150);
  await cellule('PHARMA_HOMME COL V NOIR', 'M').fill('100'); await cellule('PHARMA_HOMME COL V NOIR', 'M').press('Enter');
  await cellule('PHARMA_HOMME COL V NOIR', 'XL').fill('40'); await cellule('PHARMA_HOMME COL V NOIR', 'XL').press('Enter'); await p.waitForTimeout(100);
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  const m3 = await txt('.sx-modal');
  r.push(['commande en cours : message avec recalcul et alerte « déjà passées »', /déjà validée/.test(m3) && /150 pièce\(s\) déjà passées/.test(m3)]);
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['commande en cours : modifiée et notée au journal', await p.evaluate(() => findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'XL').qty === 40 && (S.lots.PK202701.modifs || []).length === 2)]);
  // ---------- supprimer ----------
  await p.evaluate(() => { S.exports = [{id:'X1', n:1, d:'2027-01-20', cl:'NEOLYS', nat:'NEOLYS', st:'cours', cartons:[{id:'C1', n:1, it:[[findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'M').id, 10, 'PK202701', 'PHARMA_HOMME COL V NOIR', 'M']]}]}]; render(); });
  await p.click('.cm-act button:has-text("Supprimer")'); await p.waitForTimeout(150);
  r.push(['Supprimer : impossible si des pièces sont dans un export', /Impossible/.test(await txt('.sx-modal')) && await p.locator('.sx-modal .cm-eff').count() === 0]);
  await p.click('.sx-modal .sx-annul'); await p.evaluate(() => { S.exports = []; render(); });
  await p.click('.cm-act button:has-text("Supprimer")'); await p.waitForTimeout(150);
  r.push(['Supprimer : message et bouton bloqué tant que EFFACER n\'est pas tapé', /Supprimer la commande PK202701/.test(await txt('.sx-modal')) && await p.locator('.sx-modal .sx-go').isDisabled()]);
  await p.fill('.cm-eff', 'EFFAC'); await p.waitForTimeout(50);
  const bloque = await p.locator('.sx-modal .sx-go').isDisabled();
  await p.fill('.cm-eff', 'EFFACER'); await p.waitForTimeout(50);
  r.push(['« EFFACER » tapé : bouton actif', bloque && !(await p.locator('.sx-modal .sx-go').isDisabled())]);
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['commande supprimée (lignes, étapes, lot), sauvegarde à jour', await p.evaluate(() => !S.lines.some(l => l.lot === 'PK202701') && !S.moves.some(m => m.id === 'MX1') && !S.lots.PK202701 && !Object.keys(desiredDocs()).some(k => /PK202701/.test(k)))]);
  // ---------- lecture seule ----------
  await p.evaluate(() => { S.lines.push({id:'Z1', lot:'PK202702', year:2027, client:'NEOLYS', model:'PHARMA-HOMME', lib:'PHARMA_HOMME COL V NOIR', size:'M', qty:10}); ui.lot = 'PK202702'; window.__ls = lectureSeule; lectureSeule = () => true; render(); });
  r.push(['lecture seule : ni Modifier ni Supprimer', await p.locator('.cm-act').count() === 0 && await p.locator('table.entry input.lu').count() > 0]);
  await p.evaluate(() => { lectureSeule = window.__ls; render(); });
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
