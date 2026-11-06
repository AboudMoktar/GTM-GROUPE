#!/usr/bin/env node
// Suivi PERCKO, pilotage : export Excel (formules, sous-totaux, total, filtres, code de ligne) et réimport du fichier.
// Lancement (dans tests/) : npm run pilotage-excel
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
const fs = require('fs'), path = require('path'), XLSX = require('xlsx');
const DOSSIER = process.env.PILOTAGE_CAPTURES || '';
const XLSX_LOCAL = path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');
async function page(b, url){
  const p = await b.newPage(); p.on('dialog', d => d.accept());
  await p.route('**/xlsx.full.min.js', rt => rt.fulfill({contentType: 'application/javascript', body: fs.readFileSync(XLSX_LOCAL, 'utf8')}));
  await p.goto(url); await p.waitForFunction(() => typeof vPilotage === 'function' && window.XLSX);
  await p.evaluate(() => {
    const L = (id, cl, model, lib, sz, q, lot) => ({id, lot:lot || 'PK202612-1', year:2026, client:cl, model, lib, size:sz, qty:q, cc:0});
    S.lines.push(
      L('G_S', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V GRIS', 'S', 50), L('G_M', 'NEOLYS', 'PHARMA-HOMME', 'PHARMA_HOMME COL V GRIS', 'M', 130),
      L('G_MA', 'ALLOGA', 'PHARMA-HOMME', 'PHARMA_HOMME COL V GRIS', 'M', 40),
      L('R_XS', 'NEOLYS', 'PHARMA-FEMME COL V', 'PHARMA_FEMME COL V ROSE POUDRE', 'XS', 95), L('T_M', 'NEOLYS', 'Sport-H-Re-Mi', 'Tee-shirt Sport homme noir', 'M', 270),
      L('Z_1', 'NEOLYS', 'Sport-H-Re-Mi', 'Tee-shirt Sport homme noir', 'L', 10, 'PK202611'));
    const mv = {G_S:[50, 50, 50, 50, 50, 40, 40, 30], G_M:[135, 130, 130, 120, 120, 100, 100, 100], G_MA:[40, 40, 40, 40, 40, 40, 40, 40], R_XS:[100, 95, 95, 90, 90, 0, 0, 0]};
    const st = ['cp', 'gadh', 'asm', 'ret', 'conf', 'ctl', 'emb', 'exp'];
    Object.keys(mv).forEach(id => mv[id].splice(7, 0, mv[id][7])); st.splice(7, 0, 'pret');   /* prêt à expédier = expédié */
    Object.keys(mv).forEach((id, i) => mv[id].forEach((q, k) => { if (q) S.moves.push({id:'M' + i + '_' + k, date:'2026-12-0' + (1 + k), lineId:id, stage:st[k], qty:q, nc:0, note:''}); }));
    S.lots['PK202612-1'] = {ready:'2026-12-01', dc:'2026-12-01'};
    ui.lot = 'PK202612-1'; ui.client = '*'; ui.tab = 'suivi'; ui.smode = null; ui.pil = null; render();
    window.__f = []; window.saveFile = (n, d) => { window.__f.push({n, d: Array.from(d)}); };
  });
  await p.waitForTimeout(200);
  return p;
}
async function exporter(p){ const n0 = await p.evaluate(() => window.__f.length); await p.click('.ph-exp button:has-text("Excel")'); await p.waitForFunction((n) => window.__f.length > n, n0); return p.evaluate(() => { const f = window.__f[window.__f.length - 1]; return {n: f.n, d: f.d}; }); }
async function reimporter(p, wb, nom){ const buf = XLSX.write(wb, {type: 'buffer', bookType: 'xlsx'}); await p.setInputFiles('.ph-exp input[type=file]', {name: nom || 'retour.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf}); await p.waitForTimeout(500); }
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), r = [], err = [];
  const p = await page(b, 'http://localhost:8790/suivi-commandes.html'); p.on('pageerror', e => err.push(e.message));
  const f = await exporter(p), buf = Buffer.from(f.d);
  if (DOSSIER) fs.writeFileSync(DOSSIER + '/pilotage.xlsx', buf);
  r.push(['fichier Excel du pilotage', /^Suivi_PK202612-1_\d{8}\.xlsx$/.test(f.n) && buf.slice(0, 2).toString() === 'PK']);
  const wb = XLSX.read(buf, {cellFormula: true, cellStyles: true}), ws = wb.Sheets.Suivi;
  r.push(['feuilles « Suivi » et « Récapitulatif »', JSON.stringify(wb.SheetNames) === '["Suivi","Récapitulatif"]']);
  const rows = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ''});
  const head = rows[3];
  r.push(['titres de colonnes (sans « Qté finie »)', head.join('|') === 'Modèle|Référence|Couleur|Taille|Client|Qté commandée|Qté coupée|Passée à l\'assemblage (GADH)|Revenue chez TEK-TREND|En confection|Contrôlée|Emballée|Expédiée|Reste à produire|Avancement|Code (ne pas modifier)']);
  r.push(['une ligne par référence × taille × client (sans l\'autre commande)', rows.filter(x => /^(G_|R_|T_)/.test(x[15])).length === 5 && !rows.some(x => x[15] === 'Z_1')]);
  r.push(['code de ligne en colonne masquée', !!(ws['!cols'] && ws['!cols'][15] && ws['!cols'][15].hidden)]);
  r.push(['filtres automatiques', !!ws['!autofilter'] && /^A4:P\d+$/.test(ws['!autofilter'].ref)]);
  const iGS = rows.findIndex(x => x[15] === 'G_S') + 1;
  r.push(['reste et avancement en formules', ws['N' + iGS].f === 'MAX(0,F' + iGS + '-M' + iGS + ')' && ws['N' + iGS].v === 20 && ws['O' + iGS].f === 'IF(F' + iGS + '=0,0,M' + iGS + '/F' + iGS + ')' && Math.abs(ws['O' + iGS].v - 0.6) < 1e-9]);
  const iST = rows.findIndex(x => x[0] === 'Sous-total PHARMA-HOMME') + 1, iT = rows.findIndex(x => x[0] === 'TOTAL GÉNÉRAL') + 1;
  r.push(['sous-total par modèle (SOUS.TOTAL)', /^SUBTOTAL\(9,F\d+:F\d+\)$/.test(ws['F' + iST].f) && ws['F' + iST].v === 220 && ws['M' + iST].v === 170]);
  r.push(['total général', /^SUBTOTAL\(9,F5:F\d+\)$/.test(ws['F' + iT].f) && ws['F' + iT].v === 585 && ws['M' + iT].v === 170 && ws['N' + iT].v === 415 && iT > +ws['!autofilter'].ref.split(':P')[1]]);
  const rc = wb.Sheets['Récapitulatif'];
  r.push(['récapitulatif relié au total', rc.B5.f === 'Suivi!F' + iT && rc.B5.v === 585 && /^IF\(B5=0/.test(rc.C6.f)]);
  // ouverture et recalcul par un tableur (LibreOffice), si présent
  let lo = true;
  try {
    const tmp = fs.mkdtempSync('/tmp/pil-'); fs.writeFileSync(tmp + '/a.xlsx', buf);
    require('child_process').execFileSync('soffice', ['--headless', '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,1', '--outdir', tmp, tmp + '/a.xlsx'], {timeout: 90000, stdio: 'ignore'});
    const csv = fs.readFileSync(fs.readdirSync(tmp).filter(x => /\.csv$/.test(x)).map(x => tmp + '/' + x)[0], 'utf8').split('\n');
    lo = csv.some(l => /^TOTAL GÉNÉRAL/.test(l) && /,585,/.test(l) && /,415,/.test(l));
  } catch (e) { lo = !/ENOENT/.test(String(e)) ? (console.log('soffice :', String(e).slice(0, 120)), false) : true; }
  r.push(['fichier ouvert et recalculé par un tableur', lo]);
  // export des lignes cochées
  await p.locator('.ph-t tbody tr:not(.st):not(.tg) input[type=checkbox]').nth(0).check(); await p.locator('.ph-t tbody tr:not(.st):not(.tg) input[type=checkbox]').nth(3).check(); await p.waitForTimeout(150);
  r.push(['choix : lignes cochées', await p.inputValue('.ph-exp select') === 'coche']);
  const f2 = await exporter(p), w2 = XLSX.read(Buffer.from(f2.d)), r2 = XLSX.utils.sheet_to_json(w2.Sheets.Suivi, {header: 1, defval: ''});
  r.push(['export des lignes cochées', /_selection\.xlsx$/.test(f2.n) && r2.filter(x => /^(G_|R_|T_)/.test(x[15])).length === 2]);
  await p.click('text=Décocher'); await p.waitForTimeout(100);
  // réimport : modifier des quantités dans le fichier
  const wm = XLSX.read(buf), sm = wm.Sheets.Suivi, iTM = rows.findIndex(x => x[15] === 'T_M') + 1;
  sm['G' + iTM] = {t: 'n', v: 100}; sm['K' + iGS] = {t: 'n', v: 45};
  await reimporter(p, wm);
  const apercu = await p.locator('.ph-imp').textContent();
  r.push(['réimport : aperçu des différences', /Tee-shirt Sport homme noir M .*Qté coupée/.test(apercu) && /0 → 100/.test(apercu) && /40 → 45/.test(apercu) && await p.locator('.ph-imp > div').count() === 2]);
  await p.click('text=Appliquer ces 2 modification'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => { const T = stageTotals(); return {tm: (T.T_M || {}).cp, gs: (T.G_S || {}).ctl, note: S.moves.some(m => m.lineId === 'T_M' && /Pilotage/.test(m.note))}; });
  r.push(['réimport appliqué (mouvements datés)', t.tm === 100 && t.gs === 45 && t.note]);
  const wi = XLSX.read(buf); wi.Sheets.Suivi['H' + iTM] = {t: 'n', v: 500};
  await reimporter(p, wi);
  await p.click('text=Appliquer ces').catch(() => {}); await p.waitForTimeout(300);
  r.push(['réimport incohérent refusé, rien d\'enregistré', await p.evaluate(() => (stageTotals().T_M || {}).gadh || 0) === 0]);
  const wt = XLSX.read(buf); wt.Sheets.Suivi['G' + iTM] = {t: 's', v: 'cent'};
  await reimporter(p, wt);
  r.push(['valeur non numérique signalée', /nombres entiers/.test(await p.locator('#toast').textContent())]);
  await p.evaluate(() => { ui.lot = 'PK202611'; render(); }); await p.waitForTimeout(150);
  await reimporter(p, XLSX.read(buf));
  r.push(['fichier d\'une autre commande refusé', /autre commande/.test(await p.locator('#toast').textContent())]);
  // ---------- PDF ----------
  await p.evaluate(() => { for (let i = 0; i < 80; i++) S.lines.push({id:'P' + i, lot:'PK202611', year:2026, client:'NEOLYS', model:'Mod ' + (i % 6), lib:'Ref ' + (i % 6) + ' gris', size:['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'][i % 7] + (i > 41 ? '' : ''), qty:10 + i, cc:0}); S.lines = S.lines.filter((l, i, a) => a.findIndex(x => x.lot === l.lot && x.lib === l.lib && x.size === l.size) === i); render(); });
  await p.waitForTimeout(200);
  const pdf = async (fmt) => { await p.selectOption('.ph-exp select[title="Format du PDF"]', fmt); const n0 = await p.evaluate(() => window.__f.length); await p.click('.ph-exp button:has-text("PDF")'); await p.waitForFunction((n) => window.__f.length > n, n0, {timeout: 10000}); return p.evaluate(() => { const f = window.__f[window.__f.length - 1]; return {n: f.n, d: f.d}; }); };
  const P4 = await pdf('A4'), b4 = Buffer.from(P4.d), t4 = b4.toString('latin1');
  if (DOSSIER) fs.writeFileSync(DOSSIER + '/pilotage.pdf', b4);
  const tmpP = fs.mkdtempSync('/tmp/pilpdf-'); fs.writeFileSync(tmpP + '/a.pdf', b4);
  const txt4 = require('child_process').execFileSync('pdftotext', ['-layout', tmpP + '/a.pdf', '-']).toString();
  const pages = txt4.split('\f').filter(x => x.trim());
  r.push(['PDF : fichier et nom', /^Suivi_PK202611_\d{8}\.pdf$/.test(P4.n) && t4.startsWith('%PDF-1.4')]);
  r.push(['PDF : A4 paysage, plusieurs pages', /MediaBox \[0 0 841\.89 595\.28\]/.test(t4) && pages.length >= 3]);
  r.push(['PDF : logo', /\/Subtype \/Image/.test(t4) && /DCTDecode/.test(t4)]);
  r.push(['PDF : titres répétés sur chaque page du tableau', pages.slice(0, -1).every(x => /Qté coupée/.test(x) && /Suivi de commande N° PK202611/.test(x))]);
  r.push(['PDF : pagination', pages.every((x, i) => new RegExp('Page ' + (i + 1) + ' / ' + pages.length).test(x))]);
  r.push(['PDF : sous-totaux, total général et récapitulatif', /Sous-total Mod 0/.test(txt4) && /TOTAL GÉNÉRAL/.test(txt4) && /Récapitulatif/.test(pages[pages.length - 1]) && /Avancement/.test(pages[pages.length - 1])]);
  r.push(['PDF : sans la colonne « Code »', !/ne pas modifier/.test(txt4) && !/\bP1\b/.test(txt4)]);
  const P3 = await pdf('A3'), t3 = Buffer.from(P3.d).toString('latin1');
  r.push(['PDF A3 paysage', /_A3\.pdf$/.test(P3.n) && /MediaBox \[0 0 1190\.55 841\.89\]/.test(t3)]);
  // GADH : export réception / retour, réimport du retour seulement
  const g = await page(b, 'http://localhost:8790/suivi-commandes.html?vue=gadh'); g.on('pageerror', e => err.push(e.message));
  const fg = await exporter(g), wg = XLSX.read(Buffer.from(fg.d)), rg = XLSX.utils.sheet_to_json(wg.Sheets.Suivi, {header: 1, defval: ''});
  r.push(['GADH : export réception et retour', rg[3].join('|') === 'Modèle|Référence|Couleur|Taille|Client|Qté commandée|Reçue de TEK-TREND|Retournée à TEK-TREND (assemblée)|Encore à la GADH|Retourné|Code (ne pas modifier)' && /^GADH/.test(rg[0][1])]);
  const iX = rg.findIndex(x => x[10] === 'R_XS') + 1; wg.Sheets.Suivi['H' + iX] = {t: 'n', v: 95}; wg.Sheets.Suivi['F' + iX] = {t: 'n', v: 999};
  await reimporter(g, wg);
  r.push(['GADH : seul le retour est repris', await g.locator('.ph-imp > div').count() === 1 && /90 → 95/.test(await g.locator('.ph-imp').textContent())]);
  await g.click('text=Appliquer ces 1 modification'); await g.waitForTimeout(300);
  r.push(['GADH : retour enregistré', await g.evaluate(() => (stageTotals().R_XS || {}).ret === 95 && lineById('R_XS').qty === 95)]);
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if (err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
