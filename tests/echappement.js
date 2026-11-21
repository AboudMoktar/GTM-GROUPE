#!/usr/bin/env node
// Garde-fou : les noms saisis par les utilisateurs (comptes, opératrices) ne doivent jamais être
// insérés dans le HTML sans esc(). Un nom contenant du HTML ne doit pas pouvoir exécuter de code.
'use strict';
const fs = require('fs'), path = require('path');
const racine = path.join(__dirname, '..');
const fichiers = fs.readdirSync(racine).filter(f => /\.(js|html)$/.test(f));
const INTERDITS = [/\$\{u\.nom\}/, /\$\{u\.username\}/, /\$\{r\.name\}/, /\$\{currentUser\.nom\}/, /\$\{currentUser\.username\}/, /\$\{x\.nom\}'!/];
let echecs = 0;
fichiers.forEach(f => fs.readFileSync(path.join(racine, f), 'utf8').split('\n').forEach((l, i) => INTERDITS.forEach(re => {
  if (re.test(l)) { console.log(`ÉCHEC ${f}:${i + 1} insertion sans esc() : ${l.trim().slice(0, 120)}`); echecs++; }
})));
// esc() neutralise bien une balise
const esc = eval('(' + fs.readFileSync(path.join(racine, 'index.html'), 'utf8').match(/function esc\(s\)\{[^\n]*\}/)[0] + ')');
const x = esc('<img src=x onerror="alert(1)">');
if (/[<>"]/.test(x)) { console.log('ÉCHEC esc() laisse passer du HTML : ' + x); echecs++; } else console.log('ok    esc() neutralise le HTML');
if (!echecs) console.log('ok    aucun nom inséré sans esc() (' + fichiers.length + ' fichiers)');
process.exit(echecs ? 1 : 0);
