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
  const cellule = (lib, z, c) => p.locator('table.cmdT input[data-c="' + (c || 'NEOLYS') + '"][data-lib="' + lib + '"][data-sz="' + z + '"]');
  const nb = () => p.evaluate(() => S.lines.length);
  // ---------- nouvelle commande ----------
  r.push(['sans commande : bouton « Nouvelle commande »', await p.locator('button:has-text("Nouvelle commande")').count() === 1]);
  await p.click('button:has-text("Nouvelle commande")'); await p.waitForTimeout(150);
  r.push(['nouvelle commande : saisie avec barre Valider / Annuler', /Nouvelle commande/.test(await txt('#view h2')) && await p.locator('.cm-barre button:has-text("Valider")').count() === 1]);
  await p.fill('#mLot', 'pk202701'); await p.dispatchEvent('#mLot', 'change'); await p.waitForTimeout(150);
  await cellule('PHARMA_HOMME COL V NOIR', 'M').fill('120'); await cellule('PHARMA_HOMME COL V NOIR', 'M').press('Enter');
  await cellule('PHARMA_HOMME COL V NOIR', 'L').fill('80'); await cellule('PHARMA_HOMME COL V NOIR', 'L').press('Enter'); await p.waitForTimeout(150);
  r.push(['saisie : rien n\'est enregistré avant Valider', await nb() === 0 && await p.locator('input.chg').count() === 2 && /2 modification/.test(await txt('.cm-barre'))]);
  r.push(['une seule feuille : NEOLYS, ALLOGA, FLÉCHÉS, VESTIAIRES en colonnes', (await p.locator('table.cmdT tr.h2 th').allTextContents()).join('|').includes('NEOLYS|ALLOGA|FLÉCHÉS|VESTIAIRES|Total|Total')]);
  r.push(['ALLOGA : tailles non commandées fermées', await cellule('PHARMA_HOMME COL V GRIS', 'M', 'ALLOGA').getAttribute('readonly') !== null && await cellule('PHARMA_HOMME COL V NOIR', 'M', 'ALLOGA').getAttribute('readonly') === null]);
  await cellule('PHARMA_HOMME COL V NOIR', 'M', 'ALLOGA').fill('60'); await cellule('PHARMA_HOMME COL V NOIR', 'M', 'ALLOGA').press('Enter'); await p.waitForTimeout(100);
  await cellule('PHARMA_FEMME COL V NOIR', 'S', 'FLÉCHÉS').fill('30'); await cellule('PHARMA_FEMME COL V NOIR', 'S', 'FLÉCHÉS').press('Enter'); await p.waitForTimeout(100);
  const tl = await p.evaluate(() => { const tr = document.querySelector('table.cmdT input[data-c="NEOLYS"][data-lib="PHARMA_HOMME COL V NOIR"][data-sz="M"]').closest('tr'); const tlc = [...document.querySelectorAll('table.cmdT tr')].find(x => x.querySelector('td.tl') && x.querySelector('td.lib') && x.querySelector('td.lib').textContent === 'PHARMA_HOMME COL V NOIR'); return [tr.querySelector('td.tot:not(.tl)').textContent, tlc.querySelector('td.tl').textContent, document.querySelector('table.cmdT tr.ttot').textContent]; });
  r.push(['totaux par taille, par libellé et ligne TOTAL', tl[0] === '180' && tl[1] === '260' && /290/.test(tl[2])]);
  r.push(['saisie sur tous les clients gardée', await cellule('PHARMA_HOMME COL V NOIR', 'M').inputValue() === '120' && /4 modification/.test(await txt('.cm-barre'))]);
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  const m1 = await txt('.sx-modal');
  r.push(['Valider : message de confirmation de la création', /Créer la commande PK202701/.test(m1) && /4 taille\(s\) · 290 pièces/.test(m1) && /ALLOGA · PHARMA_HOMME COL V NOIR M/.test(m1) && /FLÉCHÉS · PHARMA_FEMME COL V NOIR S/.test(m1)]);
  await p.click('.sx-modal .sx-annul'); await p.waitForTimeout(100);
  r.push(['« Revenir à la saisie » : toujours rien d\'enregistré', await nb() === 0 && await p.locator('.cm-barre').count() === 1]);
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150); await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['confirmé : commande créée', await nb() === 4 && await p.evaluate(() => ui.lot === 'PK202701' && !ui.cmdEd && findLine('PK202701', 'ALLOGA', 'PHARMA_HOMME COL V NOIR', 'M').qty === 60)]);
  r.push(['consultation : boutons Modifier et Supprimer, quantités en lecture', await p.locator('.cm-act button:has-text("Modifier")').count() === 1 && await p.locator('.cm-act button:has-text("Supprimer")').count() === 1 && await p.locator('table.cmdT input.lu[readonly]').count() > 0]);
  // numéro déjà pris
  await p.click('.cm-act button:has-text("Nouvelle commande")'); await p.waitForTimeout(150);
  await p.fill('#mLot', 'PK202701'); await p.dispatchEvent('#mLot', 'change'); await p.waitForTimeout(100);
  await cellule('PHARMA_HOMME COL V NOIR', 'S').fill('5'); await cellule('PHARMA_HOMME COL V NOIR', 'S').press('Enter');
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  r.push(['nouvelle commande avec un N° existant : refusée', /existe déjà/.test(await txt('#toast')) && await p.locator('.sx-modal').count() === 0 && await nb() === 4]);
  await p.click('.cm-barre button:has-text("Annuler")'); await p.waitForTimeout(150);
  // ---------- modifier ----------
  await p.click('.cm-act button:has-text("Modifier")'); await p.waitForTimeout(150);
  r.push(['Modifier : saisie de la commande', /Modification de la commande PK202701/.test(await txt('#view h2')) && await p.locator('#mLot').isDisabled()]);
  await cellule('PHARMA_HOMME COL V NOIR', 'M').fill('150'); await cellule('PHARMA_HOMME COL V NOIR', 'M').press('Enter');
  await cellule('PHARMA_HOMME COL V NOIR', 'L').fill('0'); await cellule('PHARMA_HOMME COL V NOIR', 'L').press('Enter'); await p.waitForTimeout(100);
  await p.fill('#mLiv', '2027-02-15'); await p.dispatchEvent('#mLiv', 'change');
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  const m2 = await txt('.sx-modal');
  r.push(['message : chaque modification (avant → après), total, livraison', /3 modification\(s\) · total 290 → 240 pièces/.test(m2) && /120 → 150 \(\+30\)/.test(m2) && /80 → 0 \(-80\)/.test(m2) && /Livraison prévue : — → 15\/02\/27/.test(m2)]);
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['modifications enregistrées', await p.evaluate(() => findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'M').qty === 150 && !findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'L') && S.lots.PK202701.livraison === '2027-02-15')]);
  // mois de la commande : automatique (lot) ou choisi ; en-tête « COMMANDE : NOVEMBRE -1 »
  r.push(['mois lu dans le lot : « NOVEMBRE -1 »', await p.evaluate(() => libelleCommande('PK202611-1') === 'NOVEMBRE -1' && libelleCommande('PK202701') === 'JANVIER')]);
  await p.click('.cm-act button:has-text("Modifier")'); await p.waitForTimeout(150);
  r.push(['champ MOIS (automatique par défaut)', /Automatique : JANVIER/.test(await p.locator('#mMois option').first().textContent())]);
  await p.selectOption('#mMois', '3'); await p.waitForTimeout(150);
  r.push(['en-tête annoncé : COMMANDE : MARS', /COMMANDE : MARS \(mois choisi\)/.test(await txt('#view .card'))]);
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  r.push(['confirmation : changement de mois', /Mois : JANVIER \(lu dans le lot\) → MARS \(choisi\)/.test(await txt('.sx-modal'))]);
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['mois enregistré et repris dans la fiche de commande', await p.evaluate(() => S.lots.PK202701.mois === 3 && commandeGrid('PK202701', 2027, '*').rows[0].cells[0].v === 'Commande: MARS')]);
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
  // suivi automatique (Statut, Emballés, Reste) et statut saisi par libellé
  await p.evaluate(() => { const l = findLine('PK202701', 'NEOLYS', 'PHARMA_HOMME COL V NOIR', 'M'); S.moves.push({id:'MX2', date:'2027-01-08', lineId:l.id, stage:'emb', qty:30, nc:0, note:''}); render(); });
  const sh = (await p.locator('table.cmdT tr.h2 th').allTextContents()).join('|');
  r.push(['colonnes de suivi ajoutées automatiquement', /\|Statut\|Emballés,\nprêts à expédier\|Reste$/.test(sh)]);
  const rst = await p.evaluate(() => { const tr = document.querySelector('table.cmdT input[data-c="NEOLYS"][data-lib="PHARMA_HOMME COL V NOIR"][data-sz="M"]').closest('tr'); return [...tr.querySelectorAll('td.sv')].map(x => x.textContent).join('|'); });
  r.push(['emballés en attente et reste (160 commandés, 30 emballés)', rst === '30|130']);
  await p.click('.cm-act button:has-text("Modifier")'); await p.waitForTimeout(150);
  await p.fill('textarea[data-statut="PHARMA_HOMME COL V NOIR"]', 'Manque tissu'); await p.dispatchEvent('textarea[data-statut="PHARMA_HOMME COL V NOIR"]', 'change');
  await p.click('.cm-barre button:has-text("Valider")'); await p.waitForTimeout(150);
  r.push(['statut dans la confirmation', /Statut PHARMA_HOMME COL V NOIR : « — » → « Manque tissu »/.test(await txt('.sx-modal'))]);
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(250);
  r.push(['statut enregistré, affiché et repris dans l\'état de commande', await p.evaluate(() => S.lots.PK202701.statuts['PHARMA_HOMME COL V NOIR'] === 'Manque tissu' && /Manque tissu/.test(document.querySelector('table.cmdT').textContent) && pkExports.etatCommandeGrid(null, 'PK202701').rows.some(r => r.cells.some(c => c && c.v === 'Manque tissu')))]);
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
  r.push(['lecture seule : ni Modifier ni Supprimer', await p.locator('.cm-act').count() === 0 && await p.locator('table.cmdT input.lu').count() > 0]);
  await p.evaluate(() => { lectureSeule = window.__ls; render(); });
  // fluidité : le tableau de la commande garde sa position quand l'écran est redessiné (enregistrement, mise à jour d'un autre poste)
  const pos = await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '.xlwrap{max-height:60px!important;min-height:0!important}'; document.head.appendChild(st);
    ui.cmdEd = null; ui.tab = 'cmd'; render(); const w = document.querySelector('.xlwrap'); w.scrollTop = 60; const avant = w.scrollTop; render(true); const apres = document.querySelector('.xlwrap').scrollTop; st.remove(); return [avant, apres]; });
  r.push(['tableau : position gardée après un nouvel affichage', pos[0] === 60 && pos[1] === 60]);
  r.push(['nombres : formateur réutilisé', await p.evaluate(() => fmt(1234567) === (1234567).toLocaleString('fr-FR') && fmt(2.5, 1) === (2.5).toLocaleString('fr-FR', {minimumFractionDigits:1, maximumFractionDigits:1}) && fmt('') === '')]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
