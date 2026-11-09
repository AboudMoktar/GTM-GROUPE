#!/usr/bin/env node
// Suivi PERCKO, vue « Pilotage » : en-tête, chiffres clés, frise, tableau par modèle (une ligne par client), calculs, tri, filtres, recherche, largeurs, cases à cocher.
// Lancement (dans tests/) : npm run pilotage
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const DOSSIER = process.env.PILOTAGE_CAPTURES || '';
async function donnees(p){
  await p.evaluate(() => {
    const L = (id, cl, model, lib, sz, q) => ({id, lot:'PK202612-1', year:2026, client:cl, model, lib, size:sz, qty:q, cc:0});
    S.lines.push(
      L('G_S', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V GRIS', 'S', 50), L('G_M', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V GRIS', 'M', 130),
      L('G_MA', 'ALLOGA', 'PHARMA-HOMME', 'PHARMA_HOMME COL V GRIS', 'M', 40),
      L('R_XS', 'NEOLYS', 'PHARMA-FEMME COL V', 'PHARMA_FEMME COL V ROSE POUDRE', 'XS', 95), L('R_S', 'NEOLYS', 'PHARMA-FEMME COL V', 'PHARMA_FEMME COL V ROSE POUDRE', 'S', 215),
      L('T_M', 'NEOLYS', 'Sport-H-Re-Mi', 'Tee-shirt Sport homme noir', 'M', 270));
    const mv = {G_S:[50, 50, 50, 50, 50, 40, 40, 30], G_M:[135, 130, 130, 120, 120, 100, 100, 100], G_MA:[40, 40, 40, 40, 40, 40, 40, 40], R_XS:[100, 95, 95, 90, 90, 0, 0, 0], R_S:[220, 0, 0, 0, 0, 0, 0, 0], T_M:[0, 0, 0, 0, 0, 0, 0, 0]};
    const st = ['cp', 'gadh', 'asm', 'ret', 'conf', 'ctl', 'emb', 'exp'];
    Object.keys(mv).forEach(id => mv[id].splice(7, 0, mv[id][7])); st.splice(7, 0, 'pret');   /* prêt à expédier = expédié */
    Object.keys(mv).forEach((id, i) => mv[id].forEach((q, k) => { if (q) S.moves.push({id:'M' + i + '_' + k, date:'2026-12-0' + (1 + k), lineId:id, stage:st[k], qty:q, nc:0, note:''}); }));
    S.lots['PK202612-1'] = {ready:'2026-12-01', livraison:'2099-01-31'};
    ui.lot = 'PK202612-1'; ui.client = '*'; ui.tab = 'suivi'; ui.smode = null; ui.pil = null; render();
  });
}
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), r = [], err = [];
  const ctx = await b.newContext({viewport: {width: 1366, height: 900}}); const p = await ctx.newPage(); p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof vPilotage === 'function');
  await donnees(p); await p.waitForTimeout(200);
  const txt = (sel) => p.locator(sel).first().textContent();
  r.push(['Pilotage : première vue de l\'onglet Suivi', await p.locator('.seg button.on', {hasText: 'Pilotage'}).count() === 1 && await p.locator('.ph-t').count() === 1]);
  r.push(['en-tête : lot, année, état', /PK202612-1/.test(await txt('.ph-titre')) && /2026/.test(await txt('.ph-head')) && /En cours/.test(await txt('.ph-etat'))]);
  const kpi = await p.$$eval('.ph-kpi', ks => ks.map(k => k.querySelector('small').textContent + '=' + k.querySelector('b').textContent.replace(/\s/g, '')));
  r.push(['chiffres clés (commandée, coupée … expédiée, reste, avancement)', kpi.length === 10 && kpi[0] === 'Qté commandée=800pcs' && kpi[1] === 'Qté coupée=545pcs' && kpi[7] === 'Expédiée=170pcs' && kpi[8] === 'Reste à produire=630pcs' && kpi[9] === 'Avancement=21,3%']);
  r.push(['pas de colonne « Qté finie »', !/fini/i.test(await txt('.ph-t thead'))]);
  const D = await p.evaluate(() => { const L = pkPilotage.lignesPilotage('PK202612-1'), g = L.find(x => x.id === 'G_S'); return {n: L.length, g, T: pkPilotage.sommer(L), coul: pkPilotage.couleurDe('PHARMA_FEMME COL V ROSE POUDRE').t}; });
  r.push(['une ligne par référence × taille × client', D.n === 6]);
  r.push(['reste = commandée − expédiée ; avancement = expédiée ÷ commandée', D.g.rest === 20 && D.g.av === 60 && D.T.rest === 630 && D.T.exp === 170]);
  r.push(['couleur lue dans le libellé', D.coul === 'ROSE POUDRE' || D.coul === 'ROSE']);
  const val = (td) => (td.querySelector('.v') || td).textContent.trim();
  const st = await p.$$eval('.ph-t tr.st', rs => rs.map(x => [...x.children].map(td => (td.querySelector('.v') || td).textContent.trim())));
  r.push(['sous-total par modèle', st.length === 3 && st[0][1] === 'Sous-total PHARMA-HOMME' && st[0][2] === '220' && st[0][9] === '170' && st[0][10] === '50']);
  const tg = await p.$$eval('.ph-t tr.tg td', ts => ts.map(td => (td.querySelector('.v') || td).textContent.trim()));
  r.push(['total général', tg[1] === 'TOTAL GÉNÉRAL' && tg[2] === '800' && tg[9] === '170' && tg[10] === '630' && /21,3/.test(tg[11])]);
  r.push(['modèle affiché une fois par groupe', await p.locator('.ph-t td.mod').count() === 3]);
  // recherche
  await p.fill('.ph-outils input[type=search]', 'rose'); await p.waitForTimeout(150);
  r.push(['recherche d\'une référence', await p.locator('.ph-t tbody tr:not(.st):not(.tg)').count() === 2 && /\(filtre\)/.test(await txt('.ph-kpi')) && await p.evaluate(() => document.activeElement && document.activeElement.type === 'search')]);
  await p.fill('.ph-outils input[type=search]', ''); await p.waitForTimeout(150);
  // filtres
  await p.selectOption('.ph-outils select[title=Client]', 'ALLOGA'); await p.waitForTimeout(150);
  r.push(['filtre par client', await p.locator('.ph-t tbody tr:not(.st):not(.tg)').count() === 1 && /40/.test(await txt('.ph-kpi'))]);
  await p.selectOption('.ph-outils select[title=Client]', ''); await p.selectOption('.ph-outils select[title="État"]', 'rien'); await p.waitForTimeout(150);
  r.push(['filtre « pas commencé »', await p.locator('.ph-t tbody tr:not(.st):not(.tg)').count() === 1 && /Tee-shirt Sport/.test(await txt('.ph-t tbody'))]);
  await p.click('text=✕ Tout afficher'); await p.waitForTimeout(150);
  // tri
  await p.click('.ph-t th[title="Reste à produire"]'); await p.click('.ph-t th[title="Reste à produire"]'); await p.waitForTimeout(150);
  const premier = await p.evaluate(() => { const g = [...document.querySelectorAll('.ph-t tbody tr:not(.st):not(.tg)')].map(tr => tr.querySelector('td.g').textContent); return g; });
  r.push(['tri par colonne (dans chaque modèle)', premier[0] === 'PHARMA_HOMME COL V GRIS' && premier[3] === 'PHARMA_FEMME COL V ROSE POUDRE' && await p.locator('.ph-t th .tri').count() === 1]);
  await p.click('text=Sans sous-totaux'); await p.waitForTimeout(150);
  const plat = await p.evaluate(() => [...document.querySelectorAll('.ph-t tbody tr:not(.tg)')].map(tr => tr.children[tr.children.length - 2].textContent));
  r.push(['sans sous-totaux : tri sur toute la commande', await p.locator('.ph-t tr.st').count() === 0 && plat[0] === '270' && plat[1] === '215']);
  await p.click('text=Sous-totaux par modèle'); await p.click('text=✕ Tout afficher'); await p.waitForTimeout(150);
  // cases à cocher
  await p.locator('.ph-t tbody tr:not(.st):not(.tg) input[type=checkbox]').nth(0).check(); await p.locator('.ph-t tbody tr:not(.st):not(.tg) input[type=checkbox]').nth(2).check(); await p.waitForTimeout(150);
  r.push(['lignes cochées', /2 ligne\(s\) cochée/.test(await txt('.ph-outils')) && await p.locator('.ph-t tr.cochee').count() === 2]);
  // largeur de colonne
  const box = await p.locator('.ph-t th[title="Référence"] .rz').boundingBox();
  await p.mouse.move(box.x + 3, box.y + 10); await p.mouse.down(); await p.mouse.move(box.x + 83, box.y + 10, {steps: 4}); await p.mouse.up(); await p.waitForTimeout(200);
  r.push(['largeur de colonne changée et gardée', await p.evaluate(() => JSON.parse(localStorage.getItem('pk_pilotage_cols') || '{}').lib) >= 270]);
  // date de commande
  await p.fill('.ph-info input[type=date]', '2026-12-01'); await p.dispatchEvent('.ph-info input[type=date]', 'change'); await p.waitForTimeout(200);
  r.push(['date de commande enregistrée', await p.evaluate(() => S.lots['PK202612-1'].dc === '2026-12-01' && JSON.stringify(desiredDocs().cfg.lots['PK202612-1']).includes('2026-12-01'))]);
  // état en retard
  await p.evaluate(() => { S.lots['PK202612-1'].livraison = '2026-01-01'; render(); }); await p.waitForTimeout(150);
  r.push(['état « En retard » si la livraison est dépassée', /En retard/.test(await txt('.ph-etat'))]);
  // ---------- saisie directe dans le tableau ----------
  await p.evaluate(() => { S.lots['PK202612-1'].livraison = '2099-01-31'; render(); }); await p.waitForTimeout(150);
  const cell = (id, k) => p.locator('.ph-in[data-id="' + id + '"][data-k="' + k + '"]');
  const tot = (id, k) => p.evaluate(([id, k]) => (stageTotals()[id] || {})[k] || 0, [id, k]);
  r.push(['cases de saisie : commande et toutes les étapes', await p.locator('.ph-in').count() === 6 * 8]);
  const valider = async (pg) => { pg = pg || p; await pg.click('.ph-attente button:has-text("Valider")'); await pg.waitForTimeout(150); await pg.click('.sx-modal .sx-go'); await pg.waitForTimeout(300); };
  await cell('T_M', 'cp').fill('280'); await cell('T_M', 'cp').press('Enter'); await p.waitForTimeout(300);
  r.push(['saisie : en attente (case orange, barre « Valider »), rien d\'enregistré', await tot('T_M', 'cp') === 0 && await p.locator('.ph-t td.e.chg').count() === 1 && /1 modification\(s\) en attente/.test(await txt('.ph-attente'))]);
  await p.click('.ph-attente button:has-text("Valider")'); await p.waitForTimeout(150);
  r.push(['Valider : message avec chaque modification (avant → après)', /Enregistrer 1 modification/.test(await txt('.sx-modal')) && /Tee-shirt Sport homme noir M/.test(await txt('.sx-modal')) && /0 → 280/.test(await txt('.sx-modal'))]);
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(300);
  r.push(['saisie d\'une case + Entrée : enregistrée, mouvement daté avec « Pilotage »', await tot('T_M', 'cp') === 280 && await p.evaluate(() => S.moves.some(m => m.lineId === 'T_M' && m.stage === 'cp' && /Pilotage/.test(m.note)))]);
  await cell('T_M', 'gadh').fill('300'); await cell('T_M', 'gadh').press('Tab'); await p.waitForTimeout(300); await valider();
  r.push(['quantité incohérente refusée (plus que la coupe)', await tot('T_M', 'gadh') === 0 && /dépasse|Coup|ne peut/i.test(await p.locator('#toast').textContent())]);
  r.push(['refusée : la saisie reste en attente pour être corrigée', await p.locator('.ph-t td.e.chg').count() === 1]);
  await p.click('.ph-attente button:has-text("Annuler")'); await p.waitForTimeout(200);
  r.push(['Annuler : saisies en attente abandonnées', await p.locator('.ph-attente:visible').count() === 0 && await p.locator('.ph-t td.e.chg').count() === 0]);
  // une date par étape dans la confirmation (commande déjà en partie expédiée)
  await cell('G_S', 'exp').fill('35'); await cell('G_S', 'exp').press('Enter'); await cell('G_S', 'ctl').fill('45'); await cell('G_S', 'ctl').press('Enter'); await p.waitForTimeout(200);
  await p.click('.ph-attente button:has-text("Valider")'); await p.waitForTimeout(150);
  r.push(['confirmation : une date par étape modifiée', await p.locator('.sx-modal .ph-dates input[data-etape]').count() === 2]);
  await p.fill('.sx-modal input[data-etape="ctl"]', '2026-10-02'); await p.fill('.sx-modal input[data-etape="exp"]', '2026-10-05');
  await p.click('.sx-modal .sx-go'); await p.waitForTimeout(400);
  r.push(['chaque étape enregistrée à sa date', await p.evaluate(() => S.moves.some(m => m.lineId === 'G_S' && m.stage === 'ctl' && m.date === '2026-10-02') && S.moves.some(m => m.lineId === 'G_S' && m.stage === 'exp' && m.date === '2026-10-05') && S.moves.some(m => m.lineId === 'G_S' && m.stage === 'pret' && m.date === '2026-10-05'))]);
  await cell('R_XS', 'ret').fill('95'); await cell('R_XS', 'ret').press('Enter'); await p.waitForTimeout(300);
  r.push(['Entrée : la case du dessous est prête', await p.evaluate(() => { const a = document.activeElement; return !!a && a.getAttribute('data-id') === 'R_S' && a.getAttribute('data-k') === 'ret'; })]);
  await valider();
  r.push(['retour GADH : confection automatique', await tot('R_XS', 'ret') === 95 && await tot('R_XS', 'conf') === 95]);
  await cell('G_S', 'fr').fill('60'); await cell('G_S', 'fr').press('Enter'); await p.waitForTimeout(300); await valider();
  r.push(['quantité commandée modifiée', await p.evaluate(() => lineById('G_S').qty === 60)]);
  // « Tout » par modèle
  const btTout = p.locator('.ph-t tr.st', {hasText: 'Sous-total Sport-H-Re-Mi'}).locator('td').nth(4).locator('.ph-tout');
  r.push(['bouton « Tout » sur le sous-total du modèle', /Tout \+280/.test(await btTout.textContent())]);
  await btTout.click(); await p.waitForTimeout(300); await valider();
  r.push(['« Tout » : tout le modèle passé à l\'étape', await tot('T_M', 'gadh') === 280]);
  // coller un bloc copié depuis Excel
  const coller = (id, k, txt) => p.evaluate(([id, k, txt]) => { const i = document.querySelector('.ph-in[data-id="' + id + '"][data-k="' + k + '"]'); const dt = new DataTransfer(); dt.setData('text/plain', txt); i.focus(); i.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }, [id, k, txt]);
  await coller('R_XS', 'ctl', '90\t90\r\n'); await p.waitForTimeout(300); await valider();
  r.push(['coller depuis Excel : plusieurs cases', await tot('R_XS', 'ctl') === 90 && await tot('R_XS', 'emb') === 90]);
  await coller('R_XS', 'ctl', '95\t96'); await p.waitForTimeout(300); await valider(); await p.click('.ph-attente button:has-text("Annuler")'); await p.waitForTimeout(200);
  r.push(['coller incohérent : rien n\'est enregistré', await tot('R_XS', 'ctl') === 90 && await tot('R_XS', 'emb') === 90]);
  r.push(['saisies enregistrées (sauvegarde)', await p.evaluate(() => { const d = desiredDocs(); return Object.keys(d).some(k => /^moves-/.test(k) && JSON.stringify(d[k]).includes('Pilotage')); })]);
  await p.evaluate(() => { window.__ls = lectureSeule; lectureSeule = () => true; render(); }); await p.waitForTimeout(150);
  r.push(['lecture seule : pas de saisie', await p.locator('.ph-in').count() === 0 && await p.locator('.ph-tout').count() === 0]);
  await p.evaluate(() => { lectureSeule = window.__ls; render(); });
  if (DOSSIER){ await p.screenshot({path: DOSSIER + '/pc.png', fullPage: false}); await p.locator('.ph-tw').screenshot({path: DOSSIER + '/pc-tab.png'}); }
  // les autres vues restent
  await p.click('.seg button:has-text("Flux")'); await p.waitForTimeout(150);
  r.push(['les autres vues du suivi restent', await p.locator('.ph-t').count() === 0 && await p.locator('text=Exporter en Excel').count() >= 1]);
  await ctx.close();
  // téléphone
  const c2 = await b.newContext({viewport: {width: 412, height: 900}, isMobile: true, hasTouch: true}); const m = await c2.newPage(); m.on('pageerror', e => err.push(e.message));
  await m.goto('http://localhost:8790/suivi-commandes.html'); await m.waitForFunction(() => typeof vPilotage === 'function'); await donnees(m); await m.waitForTimeout(200);
  r.push(['téléphone : modèle en titre de groupe, référence fixe à gauche', await m.locator('.ph-t tr.gh').count() === 3 && await m.locator('.ph-t td.mod').count() === 0 && await m.evaluate(() => getComputedStyle(document.querySelector('.ph-t tbody td.g')).position === 'sticky')]);
  r.push(['téléphone : chiffres clés deux par ligne', await m.evaluate(() => getComputedStyle(document.querySelector('.ph-kpis')).gridTemplateColumns.split(' ').length === 2)]);
  if (DOSSIER){ await m.screenshot({path: DOSSIER + '/tel.png', fullPage: false}); await m.locator('.ph-tw').screenshot({path: DOSSIER + '/tel-tab.png'}); }
  // vue GADH : pas de pilotage (droits inchangés)
  const g = await b.newPage(); g.on('pageerror', e => err.push(e.message)); g.on('dialog', d => d.accept());
  await g.goto('http://localhost:8790/suivi-commandes.html?vue=gadh'); await g.waitForFunction(() => typeof vPilotage === 'function'); await donnees(g); await g.waitForTimeout(200);
  r.push(['GADH : pilotage avec réception et retour', await g.locator('.ph-t').count() === 1 && /Encore à la GADH/.test(await g.locator('.ph-kpis').textContent()) && !/Expédiée/.test(await g.locator('.ph-t thead').textContent())]);
  r.push(['GADH : seul le retour se saisit', await g.locator('.ph-in').count() === 6 && await g.locator('.ph-in[data-k="ret"]').count() === 6]);
  await g.locator('.ph-in[data-id="R_XS"][data-k="ret"]').fill('95'); await g.locator('.ph-in[data-id="R_XS"][data-k="ret"]').press('Enter'); await g.waitForTimeout(300); await valider(g);
  r.push(['GADH : retour saisi dans le tableau', await g.evaluate(() => (stageTotals().R_XS || {}).ret === 95 && (stageTotals().R_XS || {}).conf === 95)]);
  const gt = g.locator('.ph-t tr.st', {hasText: 'PHARMA-FEMME'}).locator('.ph-tout');
  r.push(['GADH : « Tout » pour retourner tout le modèle', await gt.count() === 0 || /Tout/.test(await gt.first().textContent())]);
  if (DOSSIER) await g.screenshot({path: DOSSIER + '/gadh.png', fullPage: false});
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
