#!/usr/bin/env node
// Écran Comptes (23/11/2026) : en ligne maintenant ou depuis combien de temps un compte est déconnecté,
// d'après les sessions et les entrées « Session » du journal. Données inventées.
// Lancement (dans tests/) : node presence-comptes.js
'use strict';
const {chromium} = require('playwright'); const serveur = require(__dirname + '/serveur.js');
(async () => {
  const s = serveur.demarrer(8819), b = await chromium.launch(), r = [], err = [];
  const ctx = await b.newContext({viewport: {width: 1280, height: 900}, serviceWorkers: 'block'});
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-11-23T16:00:00'));
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) err.push(e.message); });
  await p.route(u => !String(u).startsWith('http://localhost'), rt => rt.abort());
  await p.goto('http://localhost:8819/index.html'); await p.waitForFunction(() => typeof profilsPresence === 'function' && typeof auditPresence === 'function', null, {timeout: 20000});
  const res = await p.evaluate(() => {
    const T = Date.now(), min = 60000;
    sessionsCache = {
      s1: {username:'awatef', nom:'Awatef', device:'Téléphone Android', loginAt:T - 135 * min, lastSeen:T - 20000},
      s2: {username:'hela', nom:'Hela', device:'PC Windows', loginAt:T - 60 * min, lastSeen:T - 12 * min}
    };
    profilsPresenceAudit = {charge:T, etat:'ok', entrees:[
      {un:'hela', cle:'session', t:T - 12 * min, debut:T - 60 * min, appareil:'PC Windows'},
      {un:'marwa', cle:'session', t:T - 190 * min, debut:T - 300 * min, fin:T - 190 * min, appareil:'Téléphone Android'},
      {un:'marwa', cle:'factures', t:T - 250 * min},
      {un:'samir', cle:'connexion', t:T - 26 * 60 * min}
    ]};
    const P0 = {aw:profilsPresence('awatef'), he:profilsPresence('hela'), ma:profilsPresence('marwa'), sa:profilsPresence('samir'), no:profilsPresence('personne')};
    // enregistrement : une entrée « Session » mise à jour, puis « Déconnexion »
    currentUser = {username:'test', nom:'Test', role:'admin'}; mySessionId = 'sx';
    auditPresence(false); const j = auditJour(getTodayISO()); const ids1 = Object.keys(j).filter(k => j[k].cle === 'session');
    Date.now = (() => { const t0 = T; return () => t0 + 3 * min; })();
    auditPresence(false); auditPresence(true);
    const j2 = auditJour(getTodayISO()), ids2 = Object.keys(j2).filter(k => j2[k].cle === 'session');
    return {...P0, ids1:ids1.length, ids2:ids2.length, e:j2[ids2[0]]};
  });
  r.push(['en ligne : appareil et durée de connexion', res.aw.code === 'en-ligne' && /Téléphone Android/.test(res.aw.txt) && /depuis 2 h 15 min/.test(res.aw.txt)]);
  r.push(['session sans activité depuis 12 min : hors ligne depuis 12 min', res.he.code === 'hors-ligne' && /^Hors ligne depuis 12 min/.test(res.he.txt) && /PC Windows/.test(res.he.txt)]);
  r.push(['déconnexion enregistrée : déconnecté depuis 3 h 10 min', res.ma.code === 'hors-ligne' && /^Déconnecté depuis 3 h 10 min/.test(res.ma.txt) && /dernière connexion aujourd'hui/.test(res.ma.txt)]);
  r.push(['seule une connexion d\'hier : depuis 1 j 2 h', /depuis 1 j 2 h/.test(res.sa.txt) && /hier à/.test(res.sa.txt)]);
  r.push(['jamais vu : aucune connexion ces 30 jours', res.no.code === 'jamais' && /30 derniers jours/.test(res.no.txt)]);
  r.push(['une seule entrée « Session » par connexion, mise à jour', res.ids1 === 1 && res.ids2 === 1]);
  r.push(['déconnexion : heure de fin et texte', res.e && res.e.fin && /^Déconnexion · /.test(res.e.txt) && res.e.un === 'test']);
  r.push(['aucune erreur JavaScript', err.length === 0]); if (err.length) console.log(err.slice(0, 5));
  let n = 0; r.forEach(x => { if (!x[1]) n++; console.log((x[1] ? 'ok   ' : 'ÉCHEC ') + x[0]); });
  console.log(n ? n + ' échec(s)' : 'ok   aucune erreur');
  await b.close(); s.close(); process.exit(n ? 1 : 0);
})();
