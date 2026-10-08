// ============================================================
// IMPORT DE LA POINTEUSE (K80 / Temp-Supervisor)
// ============================================================
// Chaque société (TEK-TREND, GADH) a sa pointeuse. Le logiciel Temp-Supervisor
// exporte un fichier Excel « pointage » (ancien format .xls ou .xlsx) avec une
// ligne par salarié et par jour : Matricule, Prénom, Nom, Date, Début, Fin,
// Entrée, Sortie… Ses colonnes calculées (Absent, Retard, Jr travaillé) ne sont
// pas fiables (Absent = True partout) : l'application recalcule elle-même la
// présence et le retard à partir de l'heure d'entrée et de ses propres horaires.
//
// Règles d'import :
//  - le salarié est reconnu par son matricule, sinon par son nom (et prénom) ;
//  - Entrée renseignée -> présent (GADH : « retard » si l'entrée dépasse le
//    début de journée + 5 min), Entrée vide -> absent ;
//  - une saisie faite à la main dans l'application n'est jamais écrasée : on
//    complète seulement les heures manquantes. Les autorisations de sortie et
//    les absences par période (congé, maladie) ne sont jamais modifiées ;
//  - un nouvel import du même jour remplace l'import précédent.
// Lecture du fichier : SheetJS (window.XLSX), seul à lire l'ancien .xls.

function ptgNorm(s){
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[.:]/g, ' ').replace(/\s+/g, ' ').trim();
}
function ptgHeure(v){
  if(v === null || v === undefined || v === '') return '';
  if(typeof v === 'number'){ // fraction de jour Excel
    const m = Math.round((v % 1) * 1440);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  const m = /(\d{1,2})[:hH](\d{2})/.exec(String(v));
  return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
}
function ptgDate(v){
  if(v instanceof Date && !isNaN(v)) return toISODateLocal(v);
  if(typeof v === 'number'){ const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
  const s = String(v || '').trim();
  let m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s);
  if(m){ const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[0] : '';
}

// Lit le fichier et renvoie les lignes : {matricule, prenom, nom, date, entree, sortie, debut, fin, departement}
function ptgLireFichier(file){
  return new Promise((resolve, reject) => {
    if(!window.XLSX){ reject(new Error('Lecture Excel indisponible (bibliothèque non chargée). Vérifiez la connexion internet.')); return; }
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const wb = XLSX.read(fr.result, {type:'array', cellDates:true});
        const lignes = [];
        wb.SheetNames.forEach(n => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:'', raw:true});
          const hi = rows.findIndex((r, i) => i < 30 && r.some(c => ptgNorm(c) === 'matricule') && r.some(c => ptgNorm(c) === 'entree'));
          if(hi < 0) return;
          const col = {};
          rows[hi].forEach((c, i) => {
            const k = ptgNorm(c);
            ['matricule', 'prenom', 'nom', 'date', 'entree', 'sortie', 'debut', 'fin', 'departement'].forEach(want => { if(k === want && !(want in col)) col[want] = i; });
          });
          for(let i = hi + 1; i < rows.length; i++){
            const r = rows[i], get = (k) => (k in col ? r[col[k]] : '');
            const date = ptgDate(get('date'));
            const matricule = String(get('matricule')).trim(), nom = String(get('nom')).trim(), prenom = String(get('prenom')).trim();
            if(!date || (!matricule && !nom)) continue;
            lignes.push({matricule, prenom, nom, date, entree:ptgHeure(get('entree')), sortie:ptgHeure(get('sortie')),
              debut:ptgHeure(get('debut')), fin:ptgHeure(get('fin')), departement:String(get('departement')).trim()});
          }
        });
        if(!lignes.length) throw new Error('Aucune ligne de pointage trouvée (colonnes Matricule et Entrée attendues).');
        resolve(lignes);
      } catch(e){ reject(e.message ? e : new Error('Fichier illisible.')); }
    };
    fr.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    fr.readAsArrayBuffer(file);
  });
}

// --- Adaptateurs par société ---
const PTG_SOC = {
  tek: {
    employes: () => getEmployees(),
    sauverEmployes: (l) => saveEmployees(l),
    nomComplet: (e) => e.nom || '',
    nouvelEmploye: (x) => ({matricule:x.matricule, nom:(x.prenom + ' ' + x.nom).trim(), poste:'', departement:'', dateEmbauche:'', statut:'actif'}),
    enConge: (id, d) => !!findAbsencePeriod(id, d),
    lirePointage: (d) => getAttendance(d),
    sauverPointage: (d, a) => saveAttendance(d, a),
    // TEK : statut présent/absent + heure d'arrivée (retard calculé par le module RH) + heure de départ
    appliquer: (cur, x) => {
      const manuel = cur && cur.status && cur.src !== 'pointeuse';
      if(manuel){
        const n = {...cur};
        if(!n.in && x.entree) n.in = x.entree;
        if(!n.out && x.sortie) n.out = x.sortie;
        return n;
      }
      const n = {src:'pointeuse', status: x.entree ? 'present' : 'absent'};
      if(x.entree) n.in = x.entree;
      if(x.sortie) n.out = x.sortie;
      if(cur && cur.autorisations) n.autorisations = cur.autorisations;
      return n;
    },
    estPresent: (a) => a && a.status === 'present',
    estRetard: (a, d) => a && a.status === 'present' && computeRetardHours({...a, dateISO:d}) > 0,
    debutJour: (d) => getRefStartMin(d),
    afficher: () => nav('rh-pointage')
  },
  gadh: {
    employes: () => getGadhEmployees(),
    sauverEmployes: (l) => saveGadhEmployees(l),
    nomComplet: (e) => ((e.prenom || '') + ' ' + (e.nom || '')).trim(),
    nouvelEmploye: (x) => ({matricule:x.matricule, nom:x.nom, prenom:x.prenom, poste:'', dateEmbauche:'', statut:'actif'}),
    enConge: (id, d) => !!findGadhAbsencePeriod(id, d),
    lirePointage: (d) => getGadhAttendance(d),
    sauverPointage: (d, a) => saveGadhAttendance(d, a),
    // GADH : statut present / retard / absent, d'après le début de journée du planning GADH
    appliquer: (cur, x, d) => {
      const manuel = cur && cur.statut && cur.src !== 'pointeuse';
      if(manuel){
        const n = {...cur};
        if(!n.heureEntree && x.entree) n.heureEntree = x.entree;
        if(!n.heureSortie && x.sortie) n.heureSortie = x.sortie;
        return n;
      }
      if(!x.entree) return {src:'pointeuse', statut:'absent'};
      const slots = getGadhSlotsForDate(d);
      const retard = slots.length && timeToMin(x.entree) > slots[0].start + 5;
      const n = {src:'pointeuse', statut: retard ? 'retard' : 'present', heureEntree:x.entree};
      if(retard) n.heureReelle = x.entree;
      if(x.sortie) n.heureSortie = x.sortie;
      return n;
    },
    estPresent: (a) => a && (a.statut === 'present' || a.statut === 'retard'),
    estRetard: (a) => a && a.statut === 'retard',
    debutJour: (d) => { const s = getGadhSlotsForDate(d); return s.length ? s[0].start : null; },
    afficher: () => { gadhRHView = 'pointage'; nav('gadh-rh'); }
  }
};

// Associe chaque ligne du fichier à un salarié (matricule d'abord, sinon nom).
function ptgAssocier(soc, lignes){
  const A = PTG_SOC[soc], emps = Object.entries(A.employes()).filter(([, e]) => e.statut !== 'inactif');
  const parMat = {}, parNom = {};
  emps.forEach(([id, e]) => {
    if(e.matricule) parMat[String(e.matricule).trim().replace(/^0+/, '')] = id;
    const n = ptgNorm(A.nomComplet(e)); if(n) parNom[n] = id;
    if(e.prenom || e.nom) parNom[ptgNorm((e.nom || '') + ' ' + (e.prenom || ''))] = id;
  });
  return lignes.map(x => {
    const id = (x.matricule && parMat[x.matricule.replace(/^0+/, '')])
      || parNom[ptgNorm(x.prenom + ' ' + x.nom)] || parNom[ptgNorm(x.nom + ' ' + x.prenom)] || parNom[ptgNorm(x.nom)] || null;
    return {...x, empId:id};
  });
}

let ptgEtat = null; // {soc, lignes, fichier}

function ptgModal(html){
  let z = document.getElementById('ptg-modal-zone');
  if(!z){ z = document.createElement('div'); z.id = 'ptg-modal-zone'; document.body.appendChild(z); }
  z.innerHTML = html ? `<div class="modal-backdrop" onclick="if(event.target===this) ptgFermer()"><div class="modal-sheet">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><h3 style="margin:0;">Importer la pointeuse</h3><button class="icon-btn" onclick="ptgFermer()">✕</button></div>
    ${html}</div></div>` : '';
}
window.ptgFermer = () => { ptgEtat = null; ptgModal(''); };

// Point d'entrée : bouton « Importer la pointeuse » des écrans de pointage.
window.ptgOuvrir = (soc) => {
  ptgEtat = {soc, lignes:null};
  ptgModal(`
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Fichier Excel exporté par Temp-Supervisor (pointage du jour ou de plusieurs jours, .xls ou .xlsx), pointeuse ${soc === 'gadh' ? 'GADH TUNISIA' : 'TEK-TREND'}.</p>
    <input type="file" id="ptg-fichier" accept=".xls,.xlsx" style="width:100%;margin-bottom:10px;">
    <button class="btn btn-primary" style="width:100%;" onclick="ptgLire()">Lire le fichier</button>
    <div id="ptg-resultat" style="margin-top:12px;"></div>`);
};
window.ptgLire = () => {
  const f = document.getElementById('ptg-fichier');
  if(!f || !f.files.length){ showToast('Choisissez le fichier de la pointeuse'); return; }
  ptgLireFichier(f.files[0]).then(lignes => { ptgEtat.lignes = lignes; ptgApercu(); })
    .catch(e => { const z = document.getElementById('ptg-resultat'); if(z) z.innerHTML = `<div style="color:var(--bad);font-size:12.5px;font-weight:600;">${esc(e.message)}</div>`; });
};
function ptgApercu(){
  const soc = ptgEtat.soc, A = PTG_SOC[soc];
  const L = ptgAssocier(soc, ptgEtat.lignes);
  const dates = Array.from(new Set(L.map(x => x.date))).sort();
  const deps = Array.from(new Set(L.map(x => x.departement).filter(Boolean)));
  const ok = L.filter(x => x.empId), inconnus = L.filter(x => !x.empId);
  const presents = ok.filter(x => x.entree).length;
  // Le retard est calculé avec les horaires de l'application : on signale si la pointeuse a un autre début de journée.
  const debuts = {}; L.forEach(x => { if(x.debut) debuts[x.debut] = (debuts[x.debut] || 0) + 1; });
  const debutFichier = Object.keys(debuts).sort((a, b) => debuts[b] - debuts[a])[0] || '';
  const debutApp = A.debutJour(dates[0]);
  const ecartHoraire = debutFichier && debutApp !== null && timeToMin(debutFichier) !== debutApp;
  const fmtD = (d) => d.split('-').reverse().join('/');
  const z = document.getElementById('ptg-resultat'); if(!z) return;
  z.innerHTML = `
    <div style="font-size:13px;line-height:1.6;">
      <div><b>${L.length}</b> ligne(s) · ${dates.length === 1 ? 'jour du <b>' + fmtD(dates[0]) + '</b>' : 'du <b>' + fmtD(dates[0]) + '</b> au <b>' + fmtD(dates[dates.length - 1]) + '</b>'}${deps.length ? ' · département ' + deps.map(esc).join(', ') : ''}</div>
      <div><b>${ok.length}</b> salarié(s) reconnu(s) : ${presents} avec une entrée, ${ok.length - presents} sans entrée (absents).</div>
      ${inconnus.length ? `<div style="color:var(--warn);font-weight:600;margin-top:6px;">${inconnus.length} ligne(s) sans salarié correspondant :</div>
        <div style="font-size:12px;color:var(--ink-soft);max-height:120px;overflow:auto;">${inconnus.map(x => esc((x.matricule ? x.matricule + ' · ' : '') + x.prenom + ' ' + x.nom)).join('<br>')}</div>
        <button class="btn btn-ghost" style="width:100%;margin-top:6px;" onclick="ptgCreerInconnus()">Ajouter ces salariés à la liste du personnel</button>` : ''}
    </div>
    ${ecartHoraire ? `<div style="font-size:12px;color:var(--warn);font-weight:600;margin-top:8px;">Attention : la pointeuse commence la journée à ${debutFichier}, l'application à ${minToHHMM(debutApp).replace('h', ':')}. Les retards sont calculés avec l'horaire de l'application (${soc === 'gadh' ? 'Paramètres GADH' : 'Params'}).</div>` : ''}
    <p style="font-size:11.5px;color:var(--ink-faint);margin:10px 0;">Les saisies faites à la main, les autorisations et les congés ne sont pas écrasés.</p>
    <button class="btn btn-primary" style="width:100%;" onclick="ptgAppliquer()" ${ok.length ? '' : 'disabled'}>Importer ${ok.length} pointage(s)</button>`;
}
window.ptgCreerInconnus = () => {
  const soc = ptgEtat.soc, A = PTG_SOC[soc];
  const list = A.employes(), vus = new Set();
  ptgAssocier(soc, ptgEtat.lignes).filter(x => !x.empId).forEach(x => {
    const k = x.matricule || ptgNorm(x.prenom + ' ' + x.nom);
    if(vus.has(k)) return; vus.add(k);
    list[(soc === 'gadh' ? 'g' : 'e') + Date.now() + Math.floor(Math.random() * 100000)] = A.nouvelEmploye(x);
  });
  A.sauverEmployes(list);
  showToast(vus.size + ' salarié(s) ajouté(s)');
  ptgApercu();
};
window.ptgAppliquer = () => {
  const soc = ptgEtat.soc, A = PTG_SOC[soc];
  const L = ptgAssocier(soc, ptgEtat.lignes).filter(x => x.empId);
  const parDate = {};
  L.forEach(x => { (parDate[x.date] = parDate[x.date] || []).push(x); });
  let n = 0, conges = 0;
  Object.keys(parDate).forEach(d => {
    const att = A.lirePointage(d);
    parDate[d].forEach(x => {
      if(A.enConge(x.empId, d)){ conges++; return; }
      att[x.empId] = A.appliquer(att[x.empId], x, d); n++;
    });
    A.sauverPointage(d, att);
  });
  const dates = Object.keys(parDate).sort();
  if(soc === 'gadh') gadhAttDate = dates[dates.length - 1]; else rhAttDate = dates[dates.length - 1];
  ptgFermer();
  showToast(n + ' pointage(s) importé(s)' + (conges ? ' · ' + conges + ' en congé ignoré(s)' : ''));
  A.afficher();
};
