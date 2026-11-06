#!/usr/bin/env node
// Suivi PERCKO : état de stock client (familles / sous-familles, fils à coudre exclus) et sous-vêtements SV au catalogue (données d'essai).
// Lancement (dans tests/) : npm run stock-percko
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8790), b = await chromium.launch(), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://localhost:8790/suivi-commandes.html'); await p.waitForFunction(() => typeof S === 'object' && typeof ficheClientGridUnique === 'function');
  const r = await p.evaluate(() => {
    const out = [];
    S.mat = {'TIS-CARESSE-NOIR':['Caresse Noir','Tissu','m'], 'TIS-MONOSTRECH-NOIR':['MONOSTRECH NOIR','Tissu','m'], 'ACC-ATTACHE-NOIR':['ATTACHES NOIR','Accessoire','pièce'],
      'ACC-VELCRO-MALE-NOIR-100MM':['VELCRO MALE NOIR 100MM','Accessoire','m'], 'PAC-PACK-SPORT':['PACK SPORT','Packaging','pièce'], 'FIL-M424':['Fil à Coudre GRIS COL M424 10000m','Accessoire','m'],
      'ACC-BOUTONS-PRESSION':['BOUTONS PRESSION','Accessoire','pièce'], 'TIS-FILET-SPIDER':['Filet (Spider)','Tissu','m']};
    S.sp = {'TIS-CARESSE-NOIR':{prop:'PERCKO', pfam:['Sous-vêtements']}, 'TIS-MONOSTRECH-NOIR':{prop:'PERCKO', pfam:['Sous-vêtements']}, 'ACC-ATTACHE-NOIR':{prop:'PERCKO', pfam:['Sous-vêtements']},
      'ACC-VELCRO-MALE-NOIR-100MM':{prop:'PERCKO', pfam:['Sous-vêtements']}, 'PAC-PACK-SPORT':{prop:'TEK-TREND', clientVisible:true, pfam:['Sous-vêtements']},
      'FIL-M424':{prop:'TEK-TREND', clientVisible:true, pfam:['Sous-vêtements']}, 'ACC-BOUTONS-PRESSION':{prop:'TEK-TREND', clientVisible:true, pfam:['Sous-vêtements'], sfam:'Accessoires gilet'},
      'TIS-FILET-SPIDER':{prop:'PERCKO', pfam:['Exosquelette']}};
    const E = etatStock(), grp = fichesClientGroupes(E), sv = grp.find(g => g.f === 'Sous-vêtements');
    out.push(['fil à coudre jamais dans l\'état PERCKO', !grp.some(g => g.list.some(a => a.ref === 'FIL-M424'))]);
    out.push(['sous-familles déduites', sfamDe('TIS-CARESSE-NOIR') === 'Tissu bistrech' && sfamDe('TIS-MONOSTRECH-NOIR') === 'Tissu monostrech' && sfamDe('ACC-ATTACHE-NOIR') === 'Attaches' && sfamDe('ACC-VELCRO-MALE-NOIR-100MM') === 'Velcro' && sfamDe('PAC-PACK-SPORT') === 'Packaging' && sfamDe('TIS-FILET-SPIDER') === 'Tissus techniques']);
    out.push(['sous-famille choisie sur l\'article', sfamDe('ACC-BOUTONS-PRESSION') === 'Accessoires gilet']);
    out.push(['articles rangés par sous-famille', sv && sv.list.map(a => a.ref).join(',') === 'TIS-CARESSE-NOIR,TIS-MONOSTRECH-NOIR,ACC-ATTACHE-NOIR,ACC-VELCRO-MALE-NOIR-100MM,PAC-PACK-SPORT,ACC-BOUTONS-PRESSION']);
    const g = ficheClientGridUnique(E, false), cell = (rr, c) => { const row = g.rows[rr]; return row && row.cells[c] ? row.cells[c].v : undefined; };
    out.push(['colonne Sous-famille dans l\'Excel', cell(1, 0) === 'Famille' && cell(1, 1) === 'Sous-famille' && cell(1, 2) === 'Référence']);
    out.push(['famille et sous-famille en tête de bloc', cell(2, 0) === 'Sous-vêtements' && cell(2, 1) === 'Tissu bistrech' && cell(3, 1) === 'Tissu monostrech' && cell(2, 2) === 'TIS-CARESSE-NOIR']);
    // catalogue : sous-vêtements SV
    out.push(['tailles H normalisées', normSize('h1p1') === 'H1.P1' && normSize('H2 P4') === 'H2.P4' && normSize('H1.P3') === 'H1.P3' && sizeIdx('H1.P1') > sizeIdx('XXXL') && sizeIdx('H2.P4') < sizeIdx('TU')]);
    const n0 = S.nomen.length; ajouterSousVetementsSV(); const ajout = S.nomen.length - n0;
    out.push(['49 tailles SV ajoutées (7 coloris × 7 tailles)', ajout === 49 && S.nomen.some(x => x.model === 'SV-CR-FEMME' && x.lib === 'Sous-vêtement femme col rond rose poudré' && x.size === 'H2.P4')]);
    S.nomen = S.nomen.filter(x => !(x.lib === 'Sous-vêtement homme col V gris' && x.size === 'H1.P1'));
    ajouterSousVetementsSV();
    out.push(['ajout fait une seule fois (une taille retirée ne revient pas)', !S.nomen.some(x => x.lib === 'Sous-vêtement homme col V gris' && x.size === 'H1.P1')]);
    const d = desiredDocs(); applyDocs(d);
    out.push(['ajout mémorisé dans la sauvegarde', !!(S.ajouts && S.ajouts.sv20261106) && S.nomen.some(x => x.lib === 'Sous-vêtement homme col V noir' && x.size === 'H1.P1')]);
    out.push(['modèles SV proposés dans les exports', libList().some(x => x.lib === 'Sous-vêtement homme col V sable' && x.sizes.indexOf('H2.P3') >= 0)]);
    return out;
  });
  r.push(['aucune erreur', err.length === 0]);
  r.forEach(([l, ok]) => console.log((ok ? 'ok   ' : 'ÉCHEC ') + l)); if(err.length) console.log(err);
  await b.close(); s.close(); process.exit(r.every(x => x[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
