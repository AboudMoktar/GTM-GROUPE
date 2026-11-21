#!/usr/bin/env node
// Déchiffre une sauvegarde produite par outils/sauvegarde-firebase.js, SUR VOTRE POSTE uniquement.
//   SAUVEGARDE_CLE='la phrase secrète' node outils/dechiffrer-sauvegarde.js gtm-2026-11-22.json.gz.chiffre
// → écrit gtm-2026-11-22.json (base complète + règles) à côté du fichier. N'écrit JAMAIS dans Firebase :
// une restauration se fait ensuite à la main (console Firebase > Importer JSON), après vérification.
'use strict';
const fs = require('fs'), crypto = require('crypto'), zlib = require('zlib');
const f = process.argv[2], phrase = process.env.SAUVEGARDE_CLE || '';
if(!f || !phrase){ console.error('Usage : SAUVEGARDE_CLE=… node outils/dechiffrer-sauvegarde.js <fichier.chiffre>'); process.exit(1); }
const b = fs.readFileSync(f);
if(b.slice(0, 5).toString() !== 'GTMS1'){ console.error('Ce fichier n\'est pas une sauvegarde GTM.'); process.exit(1); }
const sel = b.slice(5, 21), iv = b.slice(21, 33), tag = b.slice(33, 49), corps = b.slice(49);
const cle = crypto.scryptSync(phrase, sel, 32, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024});
const d = crypto.createDecipheriv('aes-256-gcm', cle, iv); d.setAuthTag(tag);
let clair; try { clair = zlib.gunzipSync(Buffer.concat([d.update(corps), d.final()])); } catch(e){ console.error('Phrase secrète incorrecte ou fichier abîmé.'); process.exit(1); }
const sortie = f.replace(/\.json\.gz\.chiffre$/, '') + '.json';
fs.writeFileSync(sortie, clair); const p = JSON.parse(clair);
console.log(`Déchiffré : ${sortie} (sauvegarde du ${p.date}, ${Math.round(clair.length / 1024)} Ko)`);
