// ============================================================
// Simulateur local des règles Realtime Database (contrôle préalable)
// ============================================================
// Évalue database.rules.v2.json sur une base en mémoire, avec la même logique
// que Firebase : une lecture ou une écriture est autorisée si une règle .read /
// .write est vraie sur le chemin visé ou sur un de ses parents ; toutes les
// règles .validate des nœuds modifiés (non vides) doivent être vraies.
// Il ne remplace PAS l'émulateur officiel : il sert à vérifier la logique
// tant que l'émulateur ne peut pas être téléchargé. Les mêmes tests tournent
// ensuite sur l'émulateur (voir tests/emulateur.js).
'use strict';

const clone = (v) => v === undefined ? null : JSON.parse(JSON.stringify(v));
const decoupe = (p) => String(p).split('/').filter(Boolean);
function lireA(arbre, segs){ let n = arbre; for(const s of segs){ if(n === null || typeof n !== 'object' || !(s in n)) return null; n = n[s]; } return n === undefined ? null : n; }
function nettoyer(v){
  if(v === null || typeof v !== 'object') return v;
  const o = {};
  Object.keys(v).forEach(k => { const c = nettoyer(v[k]); if(c !== null && c !== undefined) o[k] = c; });
  return Object.keys(o).length ? o : null;
}
function ecrireA(arbre, segs, valeur){
  const racine = clone(arbre) || {};
  if(!segs.length) return nettoyer(clone(valeur)) || {};
  let n = racine;
  for(let i = 0; i < segs.length - 1; i++){ if(n[segs[i]] === null || typeof n[segs[i]] !== 'object') n[segs[i]] = {}; n = n[segs[i]]; }
  n[segs[segs.length - 1]] = clone(valeur);
  return nettoyer(racine) || {};
}

class Instantane {
  constructor(arbre, segs){ this._a = arbre; this._s = segs; }
  child(p){ return new Instantane(this._a, this._s.concat(decoupe(p))); }
  val(){ const v = lireA(this._a, this._s); return v; }
  exists(){ return lireA(this._a, this._s) !== null; }
  hasChildren(l){ const v = this.val(); if(v === null || typeof v !== 'object') return false; return !l || l.every(k => v[k] !== undefined && v[k] !== null); }
  hasChild(k){ return this.child(k).exists(); }
  isString(){ return typeof this.val() === 'string'; }
  isNumber(){ return typeof this.val() === 'number'; }
  isBoolean(){ return typeof this.val() === 'boolean'; }
}
// Méthodes de chaîne propres aux règles Firebase.
if(!String.prototype.beginsWith) Object.defineProperty(String.prototype, 'beginsWith', {value: function(p){ return this.startsWith(p); }});
if(!String.prototype.matches) Object.defineProperty(String.prototype, 'matches', {value: function(re){ return re.test(String(this)); }});

const cacheFn = new Map();
function evaluer(expr, ctx){
  if(expr === true || expr === false) return expr;
  const noms = Object.keys(ctx);
  const cle = noms.join(',') + '|' + expr;
  let f = cacheFn.get(cle);
  if(!f){ f = new Function(...noms, '"use strict"; return (' + expr + ');'); cacheFn.set(cle, f); }
  try { return f(...noms.map(n => ctx[n])) === true; } catch(e) { return false; } // une erreur dans une règle = refus
}

class Simulateur {
  constructor(regles){ this.regles = regles.rules || regles; this.donnees = {}; this.maintenant = () => Date.now(); }
  charger(d){ this.donnees = nettoyer(clone(d)) || {}; }
  // Règles applicables le long d'un chemin : [{noeud, segs, vars}]
  chaine(segs){
    const out = [{noeud:this.regles, segs:[], vars:{}}];
    let noeud = this.regles, vars = {};
    for(let i = 0; i < segs.length; i++){
      if(!noeud || typeof noeud !== 'object') break;
      let suivant = noeud[segs[i]];
      if(suivant === undefined){
        const joker = Object.keys(noeud).find(k => k[0] === '$');
        if(!joker) { noeud = null; break; }
        suivant = noeud[joker]; vars = Object.assign({}, vars, {[joker]: segs[i]});
      }
      noeud = suivant;
      out.push({noeud, segs:segs.slice(0, i + 1), vars});
    }
    return out;
  }
  ctx(auth, segs, vars, ancien, nouveau, query){
    return Object.assign({root:new Instantane(ancien, []), data:new Instantane(ancien, segs), newData:new Instantane(nouveau, segs),
      auth: auth ? {uid:auth.uid, token:{}} : null, now:this.maintenant(), query:query || {}}, vars);
  }
  lire(chemin, auth, query){
    const segs = decoupe(chemin);
    const q = query ? {orderByKey:!!query.orderByKey, startAt:query.startAt === undefined ? null : query.startAt, endAt:query.endAt === undefined ? null : query.endAt} : {orderByKey:false, startAt:null, endAt:null};
    return this.chaine(segs).some(({noeud, segs:s, vars}) => noeud && noeud['.read'] !== undefined &&
      evaluer(noeud['.read'], this.ctx(auth, s, vars, this.donnees, this.donnees, q)));
  }
  ecrire(chemin, valeur, auth){
    const segs = decoupe(chemin);
    const nouveau = ecrireA(this.donnees, segs, valeur);
    const ok = this.chaine(segs).some(({noeud, segs:s, vars}) => noeud && noeud['.write'] !== undefined &&
      evaluer(noeud['.write'], this.ctx(auth, s, vars, this.donnees, nouveau)));
    if(!ok) return false;
    if(!this.valider(segs, nouveau, auth)) return false;
    this.donnees = nouveau;
    return true;
  }
  // .validate : nœuds parents du chemin + tous les nœuds écrits (valeurs non nulles).
  valider(segs, nouveau, auth){
    const verifier = (s) => {
      if(lireA(nouveau, s) === null) return true;
      const c = this.chaine(s); const dernier = c[c.length - 1];
      if(c.length !== s.length + 1 || !dernier.noeud) return true;
      const v = dernier.noeud['.validate'];
      if(v === undefined) return true;
      return evaluer(v, this.ctx(auth, s, dernier.vars, this.donnees, nouveau));
    };
    for(let i = 1; i <= segs.length; i++) if(!verifier(segs.slice(0, i))) return false;
    const parcourir = (s) => {
      const v = lireA(nouveau, s);
      if(v === null || typeof v !== 'object') return true;
      return Object.keys(v).every(k => { const e = s.concat([k]); return verifier(e) && parcourir(e); });
    };
    return parcourir(segs);
  }
}
module.exports = {Simulateur};
