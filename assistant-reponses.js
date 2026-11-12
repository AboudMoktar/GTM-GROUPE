// ============================================================
// ASSISTANT GTM — réponses calculées (sans IA externe)
// ------------------------------------------------------------
// Répond aux questions fréquentes en parcourant les données du suivi des
// commandes (PERCKO) : où en est la commande, reste à produire, prêt à
// expédier, expédié, chez la GADH, en confection, contrôle, non conformes,
// livraison / retard, exports. Les chiffres sont calculés ici, exactement,
// à partir des données que le compte peut lire : rien ne sort de l'appareil.
// Comprend les filtres écrits dans la question : commande (lot), client,
// libellé (mots du nom : « gilet femme », « tee-shirt sport homme »…), taille.
// Une question non reconnue renvoie null (l'assistant propose alors l'aide,
// ou passe la main à Gemini si une clé est enregistrée).
// Fonction pure (utilisable dans le navigateur et dans les tests Node).
// ============================================================
(function(racine){
'use strict';

const ETAPES = ['cp', 'gadh', 'asm', 'ret', 'conf', 'ctl', 'emb', 'exp'];
const NOM_ETAPE = {cp:'Coupe', gadh:'Envoi GADH', asm:'Assemblage GADH', ret:'Retour TEK-TREND', conf:'Confection', ctl:'Contrôle', emb:'Emballage', exp:'Expédition'};
const TAILLES_CONNUES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', 'XXXL', 'TU'];
const MOTS_VIDES = new Set(('a au aux avec ce ces cette combien comment de des du en est et il ils je la le les leur leurs ma me mes moi mon ne nous on ou où par pas pour qu que quel quelle quelles quels qui sa se ses son sont sur ta te tes ton tu un une vos votre vous y ' +
  'il elle ya t encore deja deja bien tout tous toute toutes quoi donne donner dis dire montre montrer voir affiche afficher liste lister peux peut fait faire faut ' +
  'commande commandes lot lots piece pieces pcs article articles modele modeles taille tailles client clients total quantite quantites nombre etat point situation resume ' +
  'reste rester restant restantes produire production fabriquer manque manquent pret prets prete pretes expedier expedie expedies expediees expedition expeditions envoye envoyes livre livres livraison ' +
  'emballe emballes emballees emballage chez gadh assemblage retour confection chaine controle controlees controles export exports carton cartons cours non conforme conformes nc defaut defauts ' +
  'retard retards date delai prevue prevu aujourd hui semaine avancement ou en sont est mes nos').split(/\s+/));

function norm(s){ return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[_\-./]/g, ' ').replace(/\s+/g, ' ').trim(); }
function nf(n){ n = Math.round(+n || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function dmy(d){ return d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : (d || ''); }
function joursEntre(a, b){ return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000); }

/* ---------- données : lignes de commande avec leurs cumuls par étape ---------- */
function donnees(docs){
  const lignes = [], parId = {}, cfg = docs.cfg || {}, lotsInfo = cfg.lots || {};
  let exports = [];
  Object.keys(docs).forEach(id => {
    const d = docs[id] || {};
    if(id.indexOf('lines-') === 0) (d.lines || []).forEach(a => { const l = {id:a[0], lot:d.lot, client:a[2], model:a[3], lib:a[4], size:String(a[5] || ''), qty:+a[6] || 0, t:{}, nc:{}, nct:0}; ETAPES.forEach(k => { l.t[k] = 0; l.nc[k] = 0; }); lignes.push(l); parId[l.id] = l; });
    else if(id === 'exports') exports = (d.liste || []).slice();
  });
  const idsExport = {}; exports.forEach(e => { idsExport[e.id] = e; (e.cartons || []).forEach(c => { idsExport[c.id] = e; }); });
  const expDates = {};   // expéditions hors export : lot -> date -> pièces
  Object.keys(docs).forEach(id => {
    if(id.indexOf('moves-') !== 0) return;
    (docs[id].moves || []).forEach(a => {
      const l = parId[a[2]], st = a[3]; if(!l || !(st in l.t)) return;
      const q = +a[4] || 0, nc = +a[6] || 0; l.t[st] += q; l.nc[st] += nc; l.nct += nc;
      if(st === 'exp' && !(a[8] && idsExport[a[8]])){ const o = expDates[l.lot] = expDates[l.lot] || {}; o[a[1]] = (o[a[1]] || 0) + q; }
    });
  });
  lignes.forEach(l => {
    const g = k => l.t[k] || 0, p = v => Math.max(0, v);
    l.a = {pasCoupe:p(l.qty - g('cp')), coupe:p(g('cp') - g('gadh')), gadh:p(g('gadh') - g('ret')), retour:p(g('ret') - g('conf')), conf:p(g('conf') - g('ctl')),
      ctl:p(g('ctl') - g('emb')), pret:p(g('emb') - g('exp')), exp:g('exp')};
    l.resteLivrer = p(l.qty - g('exp'));
    l.resteProduire = p(l.qty - g('emb'));
    /* où se trouvent les pièces qui restent à produire (les plus avancées d'abord ; les pièces en plus de la commande ne comptent pas) */
    let r = l.resteProduire; l.r = {};
    [['ctl', l.a.ctl], ['conf', l.a.conf + l.a.retour], ['gadh', l.a.gadh + l.a.coupe], ['pasCoupe', r]].forEach(x => { const v = Math.min(r, x[1]); l.r[x[0]] = v; r -= v; });
  });
  return {lignes, exports, lotsInfo, expDates};
}

/* ---------- compréhension de la question ---------- */
function filtres(q, D){
  const qn = norm(q), mots = qn.split(' ').filter(Boolean), motsBruts = String(q).replace(/[’']/g, ' ').split(/[\s,;:!?()]+/).filter(Boolean);
  const f = {};
  const lots = Array.from(new Set(D.lignes.map(l => l.lot)));
  f.lots = lots.filter(lot => qn.includes(norm(lot)) || qn.replace(/\s/g, '').includes(norm(lot).replace(/\s/g, '')));
  const clients = Array.from(new Set(D.lignes.map(l => l.client)));
  f.clients = clients.filter(c => mots.includes(norm(c)) || (norm(c) === 'fleches' && /\bfleche/.test(qn)) || (norm(c) === 'vestiaires' && /\bvestiaire/.test(qn)));
  const tailles = new Set(D.lignes.map(l => l.size.toUpperCase()).concat(TAILLES_CONNUES));
  /* taille : « XL », « xs », « 2XL »… ; les tailles d'une lettre (S, M, L) et « TU » seulement en majuscule ou après
     « taille » / « en » (pour ne pas confondre avec « l'export », « tu »…) */
  f.tailles = [];
  motsBruts.forEach((m, i) => { const u = m.toUpperCase(); if(!tailles.has(u)) return;
    const avant = norm(motsBruts[i - 1] || ''), apresTaille = avant === 'taille' || avant === 'tailles' || avant === 'en';
    const court = u.length === 1 || u === 'TU';
    if(apresTaille || (!court && m.length >= 2) || (court && m === u)) f.tailles.push(u); });
  f.tailles = Array.from(new Set(f.tailles));
  /* libellé : mots de la question qui existent dans les noms des articles */
  const voc = new Set(); D.lignes.forEach(l => norm(l.lib).split(' ').forEach(w => voc.add(w)));
  let cles = mots.filter(w => voc.has(w) && !MOTS_VIDES.has(w) && (w.length >= 2 || !/^[smlxd]$/.test(w)));   /* « col v » : le « v » compte */
  if(/\bt ?shirt|\btee ?shirt|\bteeshirt/.test(qn)) cles = cles.filter(w => w !== 't' && w !== 'tshirt' && w !== 'teeshirt').concat(['shirt']);
  cles = Array.from(new Set(cles));
  f.mots = cles;
  if(cles.length){
    const libs = Array.from(new Set(D.lignes.map(l => l.lib)));
    const score = lib => { const w = new Set(norm(lib).split(' ')); return cles.filter(c => w.has(c)).length; };
    let best = 0; libs.forEach(l => { best = Math.max(best, score(l)); });
    f.libs = best ? libs.filter(l => score(l) === best) : [];
  } else f.libs = [];
  /* mot inconnu après « en / de / du / des / pour » (ex. « reste à produire en pantalon ») : article introuvable */
  f.inconnus = [];
  if(!cles.length){ const prep = new Set(['en', 'de', 'du', 'des', 'pour', 'les', 'le', 'la']), clientsN = new Set(clients.map(norm)), taillesN = new Set(Array.from(tailles).map(t => t.toLowerCase()));
    mots.forEach((w, i) => { if(i && prep.has(mots[i - 1]) && w.length >= 3 && !MOTS_VIDES.has(w) && !voc.has(w) && !clientsN.has(w) && !taillesN.has(w) && !/^\d|^pk/.test(w)) f.inconnus.push(w); }); }
  f.export = (/export\s*(?:n\s*°?|no|numero|num)?\s*(\d+)/.exec(qn) || [])[1];
  return f;
}
function appliquer(D, f){
  return D.lignes.filter(l => (!f.lots.length || f.lots.includes(l.lot)) && (!f.clients.length || f.clients.includes(l.client)) &&
    (!f.libs.length || f.libs.includes(l.lib)) && (!f.tailles.length || f.tailles.includes(l.size.toUpperCase())));
}
function intention(q){
  const n = norm(q);
  if(/^(bonjour|bonsoir|salut|salam|hello|coucou|merci|ok|d accord)\b/.test(n) && n.split(' ').length <= 4) return 'salut';
  if(/^(aide|help|\?|menu)$|que (sais|peux) tu|quoi demander|quelles questions|comment (ca|tu) marche/.test(n)) return 'aide';
  if(/export|carton/.test(n)) return 'export';
  if(/non conform|\bnc\b|defaut|rebut/.test(n)) return 'nc';
  if(/pret|emballe/.test(n)) return 'pret';
  if(/retard|delai|livraison|en avance|date limite|a temps/.test(n)) return 'livraison';
  if(/expedi|livre|parti|envoye au client|envoyees? au client/.test(n)) return 'expedie';
  if(/gadh|assemblage/.test(n)) return 'gadh';
  if(/controle/.test(n)) return 'controle';
  if(/confection|chaine/.test(n)) return 'confection';
  if(/coupe|couper|decoupe/.test(n)) return 'coupe';
  if(/reste|produire|manque|a faire|pas encore|fabriquer/.test(n)) return 'reste';
  if(/ou en est|ou sont|etat|avancement|situation|resume|point|bilan|combien|ou en sommes/.test(n)) return 'etat';
  return null;
}

/* ---------- mise en forme ---------- */
function titreFiltre(f){
  const p = [];
  if(f.libs.length === 1) p.push(f.libs[0]); else if(f.libs.length) p.push(f.libs.length + ' articles (« ' + f.mots.join(' ') + ' »)');
  if(f.tailles.length) p.push('taille ' + f.tailles.join(', '));
  if(f.clients.length) p.push(f.clients.join(', '));
  if(f.lots.length) p.push(f.lots.join(', '));
  return p.length ? ' — ' + p.join(' · ') : '';
}
/* une ligne par article : « **Libellé** : XS 10 · S 20 — total 30 » */
function parArticle(L, val, max){
  const ordre = [], par = {};
  L.forEach(l => { const v = val(l); if(!v) return; const k = l.lib; if(!par[k]){ par[k] = {lib:l.lib, t:{}, tot:0}; ordre.push(k); } par[k].t[l.size] = (par[k].t[l.size] || 0) + v; par[k].tot += v; });
  if(!ordre.length) return {texte:'', total:0, n:0};
  const rang = z => { const i = TAILLES_CONNUES.indexOf(String(z).toUpperCase()); return i < 0 ? 50 : i; };
  let total = 0; ordre.forEach(k => { total += par[k].tot; });
  const lignes = ordre.slice(0, max || 40).map(k => { const a = par[k], z = Object.keys(a.t).sort((x, y) => rang(x) - rang(y) || (x < y ? -1 : 1));
    return `- **${a.lib}** : ${z.map(s => `${s} ${nf(a.t[s])}`).join(' · ')}${z.length > 1 ? ` — total **${nf(a.tot)}**` : ''}`; });
  if(ordre.length > (max || 40)) lignes.push(`- … et ${ordre.length - (max || 40)} autre(s) article(s)`);
  return {texte:lignes.join('\n'), total, n:ordre.length};
}
function somme(L, val){ let s = 0; L.forEach(l => { s += val(l) || 0; }); return s; }
function exportsEnCours(D, lots){
  return D.exports.filter(e => e.st !== 'fini' && (!lots || (e.cartons || []).some(c => (c.it || []).some(x => lots.includes(x[2]) || D.lignes.some(l => l.id === x[0] && lots.includes(l.lot))))));
}
function piecesExport(e){ let q = 0; (e.cartons || []).forEach(c => (c.it || []).forEach(x => { q += +x[1] || 0; })); return q; }
function vide(f){ return '_Aucune pièce trouvée' + titreFiltre(f) + '._'; }

/* ---------- réponses ---------- */
function rEtat(D, f, L, auj){
  const detail = f.libs.length || f.tailles.length;
  const lots = Array.from(new Set(L.map(l => l.lot)));
  const out = [];
  lots.forEach(lot => {
    const M = L.filter(l => l.lot === lot), info = D.lotsInfo[lot] || {}, q = somme(M, l => l.qty), exp = somme(M, l => l.t.exp);
    out.push(`### ${detail ? 'Où en sont les pièces' : 'Commande ' + lot}${titreFiltre(f)}${detail && lots.length > 1 ? ' · ' + lot : ''}`);
    out.push(`**${nf(q)}** commandées · **${nf(exp)}** expédiées (${q ? Math.round(exp / q * 100) : 0} %) · reste à livrer **${nf(Math.max(0, q - exp))}**` + (info.livraison && !detail ? ` · livraison prévue le **${dmy(info.livraison)}**` + (auj ? ` (${joursTexte(auj, info.livraison)})` : '') : ''));
    const C = [['pasCoupe', 'Pas encore coupées'], ['coupe', 'Coupées, pas encore envoyées à la GADH'], ['gadh', 'Chez la GADH (envoyées, pas revenues)'], ['retour', 'Revenues, pas encore en confection'],
      ['conf', 'En confection'], ['ctl', 'Contrôlées, pas encore emballées'], ['pret', 'Emballées, prêtes à expédier'], ['exp', 'Expédiées']];
    out.push('Où sont les pièces en ce moment :');
    C.forEach(c => { const v = somme(M, l => l.a[c[0]]); if(v) out.push(`- ${c[1]} : **${nf(v)}**`); });
    if(detail && M.length <= 12){
      out.push('', 'Détail :');
      M.forEach(l => { const parts = C.filter(c => l.a[c[0]]).map(c => `${c[1].split(',')[0].toLowerCase()} ${nf(l.a[c[0]])}`);
        out.push(`- ${l.lib} **${l.size}**${f.clients.length || new Set(M.map(x => x.client)).size === 1 ? '' : ' (' + l.client + ')'} : commandé ${nf(l.qty)} · ${parts.join(' · ') || 'rien encore'}`); });
    }
    const ec = exportsEnCours(D, [lot]);
    if(ec.length && !detail) out.push('', ec.map(e => `📦 Export N°${e.n} en préparation (${dmy(e.d)}) : ${(e.cartons || []).length} carton(s), ${nf(piecesExport(e))} pièces`).join('\n'));
    out.push('');
  });
  return out.join('\n').trim();
}
function joursTexte(auj, d){ const j = joursEntre(auj, d); return j > 1 ? `dans ${j} jours` : j === 1 ? 'demain' : j === 0 ? 'aujourd\'hui' : j === -1 ? 'en retard d\'1 jour' : `en retard de ${-j} jours`; }
function rListe(titre, L, val, f, apres){
  const a = parArticle(L, val);
  if(!a.n) return `### ${titre}${titreFiltre(f)}\n${vide(f)}`;
  return `### ${titre}${titreFiltre(f)} : ${nf(a.total)} pièces\n${a.texte}${apres ? '\n\n' + apres : ''}`;
}
function rExpedie(D, f, L){
  const tot = somme(L, l => l.t.exp), out = [`### Expédié${titreFiltre(f)} : ${nf(tot)} pièces`];
  if(!tot) return out[0] + '\n' + vide(f);
  const filtre = f.libs.length || f.tailles.length || f.clients.length;
  if(!filtre){
    const lots = Array.from(new Set(L.map(l => l.lot)));
    lots.forEach(lot => { const d = D.expDates[lot] || {}; Object.keys(d).sort().forEach(x => { if(d[x]) out.push(`- ${dmy(x)} (saisi dans Flux/Pilotage) : **${nf(d[x])}**` + (lots.length > 1 ? ` · ${lot}` : '')); }); });
    D.exports.filter(e => e.st === 'fini').forEach(e => out.push(`- Export N°${e.n} du ${dmy(e.dv || e.d)} : **${nf(piecesExport(e))}**`));
  }
  const a = parArticle(L, l => l.t.exp);
  out.push('', a.texte);
  return out.join('\n');
}
function rExport(D, f){
  let E = D.exports.slice();
  if(f.export) E = E.filter(e => String(e.n) === String(f.export));
  else { const c = E.filter(e => e.st !== 'fini'); E = c.length ? c : E.slice(-1); }
  if(!E.length) return f.export ? `_Aucun export N°${f.export}._` : '_Aucun export pour le moment (onglet Exports)._';
  const parId = {}; D.lignes.forEach(l => { parId[l.id] = l; });
  return E.map(e => {
    const C = e.cartons || [], det = {};
    C.forEach(c => (c.it || []).forEach(x => { const l = parId[x[0]], lib = l ? l.lib : x[3], z = l ? l.size : x[4]; (det[lib] = det[lib] || {})[z] = ((det[lib] || {})[z] || 0) + (+x[1] || 0); }));
    const lignes = Object.keys(det).map(lib => `- **${lib}** : ${Object.keys(det[lib]).map(z => `${z} ${nf(det[lib][z])}`).join(' · ')}`);
    return `### Export N°${e.n} · ${e.nat || e.cl} · ${dmy(e.d)}\n${e.st === 'fini' ? '✅ Validé, expédié le ' + dmy(e.dv || e.d) : '🟡 En préparation : pièces emballées, prêtes à expédier'} · **${C.length}** carton(s) · **${nf(piecesExport(e))}** pièces\n${lignes.join('\n') || '_Aucun carton pour le moment._'}`;
  }).join('\n\n');
}
function rNC(D, f, L){
  const tot = somme(L, l => l.nct);
  if(!tot) return `### Non conformes (NC)${titreFiltre(f)}\nAucune pièce non conforme enregistrée.`;
  const parEtape = ETAPES.map(k => [k, somme(L, l => l.nc[k])]).filter(x => x[1]);
  return `### Non conformes (NC)${titreFiltre(f)} : ${nf(tot)} pièces\n${parEtape.map(x => `- ${NOM_ETAPE[x[0]]} : **${nf(x[1])}**`).join('\n')}\n\n${parArticle(L, l => l.nct).texte}`;
}
function rLivraison(D, f, L, auj){
  const lots = Array.from(new Set(L.map(l => l.lot))), out = [];
  lots.forEach(lot => {
    const M = L.filter(l => l.lot === lot), info = D.lotsInfo[lot] || {}, q = somme(M, l => l.qty), exp = somme(M, l => l.t.exp), reste = Math.max(0, q - exp);
    out.push(`### Livraison — commande ${lot}${titreFiltre(f)}`);
    out.push(info.livraison ? `Livraison prévue le **${dmy(info.livraison)}**` + (auj ? ` : **${joursTexte(auj, info.livraison)}**` : '') : 'Pas de date de livraison enregistrée (onglet Commandes).');
    out.push(`Expédié **${nf(exp)}** sur ${nf(q)} (${q ? Math.round(exp / q * 100) : 0} %) · reste à livrer **${nf(reste)}**, dont **${nf(somme(M, l => l.a.pret))}** déjà prêtes à expédier.`);
    if(auj && info.livraison && reste && joursEntre(auj, info.livraison) < 0) out.push('⚠ **La date de livraison est dépassée** et il reste des pièces à livrer.');
    out.push('');
  });
  return out.join('\n').trim();
}
function aide(D){
  const lot = D && D.lignes.length ? D.lignes[D.lignes.length - 1].lot : 'PK202611-1';
  return `### Ce que je sais faire
Je calcule les réponses directement à partir de vos données. Exemples :
- « Où en est la commande ${lot} ? »
- « Qu'est-ce qui reste à produire ? » · « Reste à produire en gilet femme »
- « Qu'est-ce qui est prêt à expédier ? »
- « Combien d'expédiés ? » · « Expédié en tee-shirt sport homme XL »
- « Qu'est-ce qui est chez la GADH ? » · « En confection ? » · « Au contrôle ? »
- « Résumé de l'export en cours » · « Export N°1 »
- « Non conformes » · « Livraison / retard »
Vous pouvez préciser un **article** (ex. « gilet homme »), une **taille** (ex. « XL »), un **client** (NEOLYS, ALLOGA…) ou une **commande**.`;
}

function repondre(question, docs, auj){
  const D = donnees(docs || {});
  const it = intention(question);
  if(it === 'aide') return aide(D);
  if(it === 'salut') return /^merci/.test(norm(question)) ? 'Avec plaisir ! Posez une autre question quand vous voulez.' : 'Bonjour ! ' + aide(D).replace(/^### Ce que je sais faire\n/, '');
  if(!D.lignes.length) return it ? '_Aucune donnée de suivi des commandes n\'est disponible pour ce compte._' : null;
  if(!it) return null;
  const f = filtres(question, D);
  if((f.mots.length && !f.libs.length) || (f.inconnus.length && it !== 'export')) return `_Je ne trouve aucun article qui corresponde à « ${(f.mots.length ? f.mots : f.inconnus).join(' ')} »._ Tapez « aide » pour des exemples.`;
  const L = appliquer(D, f);
  if(!L.length && it !== 'export') return vide(f);
  switch(it){
    case 'etat': return rEtat(D, f, L, auj);
    case 'reste': return rListe('Reste à produire (commandé − emballé)', L, l => l.resteProduire, f, 'Où sont ces pièces : ' + [['ctl', 'contrôlées, à emballer'], ['conf', 'en confection'], ['gadh', 'coupées ou chez la GADH'], ['pasCoupe', 'pas encore coupées']].map(x => [x[1], somme(L, l => l.r[x[0]])]).filter(x => x[1]).map(x => `${x[0]} **${nf(x[1])}**`).join(' · ') + '.');
    case 'pret': { const ec = exportsEnCours(D, null); return rListe('Emballé, prêt à expédier', L, l => l.a.pret, f, ec.length ? ec.map(e => `📦 Export N°${e.n} en préparation (${dmy(e.d)}) : ${nf(piecesExport(e))} pièces en cartons`).join('\n') : ''); }
    case 'expedie': return rExpedie(D, f, L);
    case 'gadh': return rListe('Chez la GADH (envoyées, pas encore revenues)', L, l => l.a.gadh, f);
    case 'confection': return rListe('En confection', L, l => l.a.conf + l.a.retour, f);
    case 'controle': return rListe('Contrôlées, pas encore emballées', L, l => l.a.ctl, f);
    case 'coupe': return rListe('Pas encore coupées', L, l => l.a.pasCoupe, f, `Coupées pas encore envoyées à la GADH : **${nf(somme(L, l => l.a.coupe))}**.`);
    case 'export': return rExport(D, f);
    case 'nc': return rNC(D, f, L);
    case 'livraison': return rLivraison(D, f, L, auj);
  }
  return null;
}

const API = {repondre, aide:() => aide(null), _donnees:donnees, _filtres:filtres, _intention:intention};
if(typeof module !== 'undefined' && module.exports) module.exports = API;
racine.gtmReponses = API;
})(typeof window !== 'undefined' ? window : globalThis);
