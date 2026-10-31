#!/usr/bin/env node
// Écrit la matrice des permissions (Markdown) à partir de roles-config.js :
//     node outils/generer-matrice.js > MATRICE-PERMISSIONS.md
'use strict';
const C = require('../roles-config.js');
const ACT = {l: 'Lire', c: 'Créer', m: 'Modifier', s: 'Supprimer'};
const oui = (a, x) => a.indexOf(x) >= 0 ? 'oui' : '—';
const lignes = [];
lignes.push('# Matrice des permissions GTM Groupe (V2)', '');
lignes.push('Générée automatiquement depuis `roles-config.js`, la même source que les règles Firebase. Ne pas modifier à la main.', '');
lignes.push('« Supprimer » = effacer la clé entière (une collection). Retirer un élément d\'une collection est une modification.', '');
lignes.push('Collections dont la suppression entière est réservée aux rôles complets : ' + C.COLLECTIONS_PROTEGEES.map(c => '`' + c + '`').join(', ') + '.', '');
C.ORDRE.forEach(r => {
  const d = C.ROLES[r];
  lignes.push(`## ${d.label}`, '', `${d.aide}. Rôle technique : \`${d.role}\`. Sociétés : ${Object.keys(d.societes).map(s => C.SOCIETES[s]).join(', ') || 'aucune'}. Administration des comptes : ${d.admin ? 'oui' : 'non'}. Journal d'audit : ${d.auditLecture ? 'lecture' : 'non'}.`, '');
  const res = Object.keys(C.RESSOURCES).map(id => [id, C.actions(r, id)]).filter(x => x[1]);
  if(!res.length){ lignes.push('Aucun droit sur les données.', ''); return; }
  lignes.push('| Société | Module | Fonctionnalité (données) | Lire | Créer | Modifier | Supprimer |', '| --- | --- | --- | --- | --- | --- | --- |');
  res.forEach(([id, a]) => {
    const x = C.RESSOURCES[id];
    lignes.push(`| ${C.SOCIETES[x.societe] || 'TEK-TREND ↔ GADH'} | ${x.module} | ${x.libelle} | ${oui(a, 'l')} | ${oui(a, 'c')} | ${oui(a, 'm')} | ${oui(a, 's')}${a.indexOf('s') >= 0 && !(d.droits[id.split('.')[0] + '.*']) ? ' (sauf collections protégées)' : ''} |`);
  });
  lignes.push('');
});
process.stdout.write(lignes.join('\n') + '\n');
