// SDK Admin de Firebase pour les tests (celui de functions/), avec la même écriture qu'avant :
// admin.initializeApp(...), admin.auth(), admin.database().
// firebase-admin 14 n'a plus l'ancien espace de noms « admin.auth() » : on l'assemble ici.
'use strict';
const path = require('path');
const dossier = path.join(__dirname, '..', 'functions');
const charger = (m) => require(require.resolve(m, {paths:[dossier]}));
const {initializeApp} = charger('firebase-admin/app'), {getAuth} = charger('firebase-admin/auth'), {getDatabase} = charger('firebase-admin/database');
module.exports = {initializeApp, auth: () => getAuth(), database: () => getDatabase()};
