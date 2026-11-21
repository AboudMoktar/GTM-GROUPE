#!/usr/bin/env node
// Facture « En retard » seulement 30 jours après sa date de création (ou après l'échéance si elle est plus tardive).
'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../factures-module.js', 'utf8');
const a = src.indexOf('const FACT_RETARD_JOURS'), b = src.indexOf('function factStatut');
const ctx = {getTodayISO: () => '2026-11-21'}; vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
const r = (date, echeance) => ctx.factEnRetard({date, echeance});
assert.strictEqual(r('2026-11-20', '2026-11-20'), false, 'créée hier, échéance = date : pas en retard');
assert.strictEqual(r('2026-10-22', '2026-10-22'), false, '30 jours pile : pas encore en retard');
assert.strictEqual(r('2026-10-21', '2026-10-21'), true, '31 jours : en retard');
assert.strictEqual(r('2026-10-01', '2026-12-31'), false, 'échéance plus tardive respectée');
assert.strictEqual(r('2026-10-01', ''), true, 'sans échéance : 30 jours après la date');
console.log('ok    Retard des factures à 30 jours');
