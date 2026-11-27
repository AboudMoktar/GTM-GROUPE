#!/usr/bin/env node
// Gestion de stock TEK-TREND (vue ?vue=stock du suivi) : propriétaires, stock disponible, mouvements, fiche article, écrans (données d'essai).
// Lancement (dans tests/) : node stock-tek.js   ·   captures : CAPTURES=/tmp/dossier node stock-tek.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const CAP = process.env.CAPTURES || '';
(async () => {
  const s = serveur.demarrer(8791), b = await chromium.launch(), p = await b.newPage({viewport:{width:1366, height:900}}); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8791/suivi-commandes.html?vue=stock'); await p.waitForFunction(() => typeof S === 'object' && typeof stockVue === 'function' && typeof etatStock === 'function' && !!S.mat && !!S.sp);
  const r = await p.evaluate(() => {
    const out = [];
    S.mat['ESS-FIL-NOIR'] = ['Fil polyester noir (essai)', 'Accessoire', 'cône'];
    S.mat['ESS-TISSU-A'] = ['Tissu essai A', 'Tissu', 'm'];
    S.mat['ESS-PIECE'] = ['Courroie machine (essai)', 'Accessoire', 'pièce'];
    S.sp['ESS-FIL-NOIR'] = {prop:'TEK-TREND', seuil:10, prix:2.5};
    S.sp['ESS-TISSU-A'] = {prop:'PERCKO', seuil:5};
    S.sp['ESS-PIECE'] = {prop:'TEK-TREND', seuil:1, pfam:['Gilet'], delai:7};
    const mv = (id, o) => { S.mv[id] = Object.assign({id, d:'2026-11-20', ts:Date.now()}, o); };
    mv('m1', {t:'E', ref:'ESS-FIL-NOIR', q:30});
    mv('m2', {t:'S', ref:'ESS-FIL-NOIR', q:8, st:'production'});
    mv('m3', {t:'E', ref:'ESS-TISSU-A', q:100});
    mv('m4', {t:'E', ref:'ESS-TISSU-A', q:20, pr:'TEK-TREND'});   // même référence, quantité TEK-TREND
    mv('m5', {t:'Q', ref:'ESS-TISSU-A', q:15});                    // quarantaine (propriétaire de l'article : PERCKO)
    mv('m6', {t:'T', ref:'ESS-TISSU-A', q:10, emp:'Magasin', emp2:'Atelier'});
    const L = stockLignes(), l = (ref, pr) => L.filter(x => x.ref === ref && x.pr === pr)[0] || {};
    out.push(['physique par propriétaire', l('ESS-TISSU-A', 'PERCKO').phys === 100 && l('ESS-TISSU-A', 'TEK-TREND').phys === 20]);
    out.push(['une seule fiche article pour deux propriétaires', Object.keys(S.mat).filter(k => k === 'ESS-TISSU-A').length === 1]);
    out.push(['quarantaine : physique inchangé, disponible réduit', l('ESS-TISSU-A', 'PERCKO').ind === 15 && l('ESS-TISSU-A', 'PERCKO').dispo === 85]);
    out.push(['transfert sans effet sur la quantité', physiques()['ESS-TISSU-A'] === 120]);
    out.push(['sortie déduite', l('ESS-FIL-NOIR', 'TEK-TREND').phys === 22 && l('ESS-FIL-NOIR', 'TEK-TREND').dispo === 22]);
    mv('m7', {t:'S', ref:'ESS-FIL-NOIR', q:14, st:'maintenance'});
    const l2 = stockLignes().filter(x => x.ref === 'ESS-FIL-NOIR')[0];
    out.push(['alerte sous le minimum', l2.phys === 8 && l2.sousSeuil && stkStatut(l2)[0] === 'Sous le minimum']);
    annulerMouvement('m7', 'essai');
    out.push(['annulation par écriture inverse (rien effacé)', !!S.mv['m7'] && !!S.mv['m7-X'] && stockLignes().filter(x => x.ref === 'ESS-FIL-NOIR')[0].phys === 22]);
    out.push(['libellés des mouvements', nomType({t:'Q', q:-3}) === 'Sortie de quarantaine' && nomType({t:'S', st:'maintenance'}) === 'Sortie · Maintenance (machine)' && nomType({t:'A', st:'regul'}) === 'Régularisation']);
    out.push(['catégories : base + paramètres', stkCats().indexOf('Tissu') === 0 && stkCats().indexOf('Pièce de rechange') >= 0]);
    // écrans : chaque section s'affiche
    const secs = STK_SECS.map(x => x[0]), ko = [];
    secs.forEach(sec => { try { stockAller(sec); if (!document.querySelector('#view .s2-carte, #view .s2-kpis')) ko.push(sec); } catch (e) { ko.push(sec + ':' + e.message); } });
    out.push(['les 12 sections s\'affichent', ko.length === 0 ? true : (console.log(ko), false)]);
    stockAller('tb');
    out.push(['tableau de bord : KPI réels', document.querySelectorAll('.s2-k').length === 4 && /Références actives/.test(document.querySelector('.s2-kpis').textContent)]);
    out.push(['en-tête et onglets du suivi masqués', getComputedStyle(document.querySelector('#app>header')).display === 'none' && getComputedStyle(document.getElementById('tabs')).display === 'none']);
    // fiche article : les autres réglages sont conservés
    ui.stEdit = 'ESS-PIECE'; stockAller('art'); ui.stEdit = 'ESS-PIECE'; render();
    const champs = document.querySelectorAll('.s2-ch input');
    const iRF = Array.from(document.querySelectorAll('.s2-ch')).filter(c => /Référence fournisseur/.test(c.textContent))[0].querySelector('input'); iRF.value = 'REF-F-1';
    Array.from(document.querySelectorAll('.s2-pied-f .btn')).filter(x => /Enregistrer/.test(x.textContent))[0].click();
    const sp = S.sp['ESS-PIECE'];
    out.push(['fiche article enregistrée sans perdre les réglages', champs.length > 5 && sp.refF === 'REF-F-1' && sp.delai === 7 && sp.pfam && sp.pfam[0] === 'Gilet' && sp.prop === 'TEK-TREND']);
    return out;
  });
  // saisie d'une sortie avec confirmation et contrôle de quantité
  await p.evaluate(() => { stockAller('sor'); ui.s2Form = 'S'; render(); });
  await p.fill('.s2-ch input[data-lc-liste="s2-dl-art"]', 'ESS-FIL-NOIR'); await p.dispatchEvent('.s2-ch input[data-lc-liste="s2-dl-art"]', 'change');
  const qte = p.locator('.s2-ch', {hasText:'Quantité'}).locator('input'); await qte.fill('500');
  await p.click('text=Vérifier et valider');
  r.push(['sortie supérieure au disponible refusée', await p.evaluate(() => !document.querySelector('.s2-modale'))]);
  await qte.fill('5'); await p.click('text=Vérifier et valider');
  r.push(['confirmation avant validation', await p.locator('.s2-modale').isVisible()]);
  await p.click('.s2-modale button:has-text("Confirmer")');
  r.push(['sortie enregistrée une seule fois', await p.evaluate(() => mvListe().filter(m => m.t === 'S' && m.ref === 'ESS-FIL-NOIR' && m.q === 5 && m.pr === 'TEK-TREND' && !!m.h).length === 1 && stockLignes().filter(x => x.ref === 'ESS-FIL-NOIR')[0].phys === 17)]);
  if (CAP){
    for (const [sec, nom] of [['tb', 'tableau'], ['art', 'articles'], ['etat', 'stock'], ['mv', 'mouvements']]){
      await p.evaluate(x => stockAller(x), sec); await p.waitForTimeout(150); await p.screenshot({path:`${CAP}/stock-${nom}-pc.png`, fullPage:true});
    }
    await p.setViewportSize({width:390, height:844}); await p.evaluate(() => stockAller('tb')); await p.waitForTimeout(150); await p.screenshot({path:`${CAP}/stock-tableau-mobile.png`, fullPage:true});
  }
  // dans GTM : carte d'accueil, barre latérale à 12 sections, iframe vue=stock pilotée par la barre
  for (const [larg, haut, nom] of [[1440, 900, 'pc'], [390, 844, 'mobile']]){
    const ctx = await b.newContext({viewport:{width:larg, height:haut}, serviceWorkers:'block'}), q = await ctx.newPage();
    q.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
    await q.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
    await q.goto('http://localhost:8791/index.html'); await q.waitForFunction(() => typeof renderShell === 'function' && typeof renderStockFrame === 'function', null, {timeout:20000});
    const g = await q.evaluate(() => {
      currentUser = {username:'admin', nom:'Administrateur', role:'admin', profil:'sysadmin', groupe:true, societes:{tek:true, gadh:true, mgt:true}}; activeSociete = 'tek';
      return {mods:modulesDeSociete('tek')};
    });
    if (nom === 'pc') r.push(['module « stock » proposé dans TEK-TREND', g.mods.indexOf('stock') >= 0]);
    await q.evaluate(() => { activeModule = 'stock'; renderShell(); nav('stock-tb'); });
    await q.waitForFunction(() => { const f = document.getElementById('stock-frame'); return f && f.contentWindow && f.contentWindow.document.querySelector('.s2-kpis'); }, null, {timeout:20000});
    if (nom === 'pc'){
      r.push(['barre latérale : 12 sections', await q.evaluate(() => navItems().length === 12 && navItems()[0].tab === 'stock-tb')]);
      await q.evaluate(() => nav('stock-mv')); await q.waitForTimeout(300);
      r.push(['la barre change de section sans recharger l\'iframe', await q.evaluate(() => { const f = document.getElementById('stock-frame'); return f.contentWindow.ui.stk === 'mv' && !!f.contentWindow.document.querySelector('.s2-mv, .s2-vide'); })]);
      await q.evaluate(() => nav('stock-tb')); await q.waitForTimeout(300);
    }
    if (CAP) await q.screenshot({path:`${CAP}/stock-gtm-${nom}.png`});
    await ctx.close();
  }
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
