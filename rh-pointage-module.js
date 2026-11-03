// ============================================================
// RH TEK-TREND — POINTAGE : présentation des cartes salarié
// ============================================================
// Chargé après rh-module.js et rh-rapports-module.js. Ne change aucune donnée ni aucun calcul :
// mêmes fonctions d'enregistrement (rrEtat, setAttendanceField, addAutorisation…), seule la
// présentation change :
//  - une carte par salarié, avec un liseré et un badge de la couleur de son état du jour ;
//  - les 6 états sur une seule ligne (Présent, Retard, Sortie, Absent, Congé, Maladie) ;
//  - les heures d'arrivée et de départ sur une seule ligne, seulement pour un salarié présent ;
//  - les autorisations de sortie en lignes compactes ;
//  - « Effacer » remplace la liste déroulante « Non renseigné ».

const RPC_ETATS = [['present', 'Présent'], ['retard', 'Retard'], ['sortie', 'Sortie'], ['absent', 'Absent'], ['conge', 'Congé'], ['maladie', 'Maladie']];
const RPC_PERIODE = {conge:'conge', maladie:'maladie', autorisee:'retard', injustifiee:'absent', autre:'vide'};

function rpcInitiales(nom){
  const m = String(nom || '').trim().split(/\s+/).filter(Boolean);
  return ((m[0] || '?')[0] + (m.length > 1 ? m[m.length - 1][0] : '')).toUpperCase();
}
// État affiché d'un salarié pour la journée : clé de couleur + libellé du badge.
function rpcEtat(r){
  if(r.source === 'periode'){ const t = ABSENCE_TYPES[r.type] || {label:r.type}; return {cle:RPC_PERIODE[r.type] || 'vide', lib:t.label}; }
  if(r.source !== 'pointage') return {cle:'vide', lib:'À pointer'};
  if(r.status === 'absent') return {cle:'absent', lib:'Absent'};
  const ret = computeRetardHours(r), nbAut = (r.autorisations || []).length;
  if(ret > 0) return {cle:'retard', lib:'Retard ' + fmtH(ret)};
  if(nbAut) return {cle:'sortie', lib:'Sortie'};
  return {cle:'present', lib:'Présent'};
}

window.rhPointageCard = function(x, canEdit){
  const {id, e, r} = x, et = rpcEtat(r);
  const sous = [e.matricule ? 'Mat. ' + esc(e.matricule) : '', esc(e.poste || '')].filter(Boolean).join(' · ');
  const tete = `<div class="ptg-tete">
      <div class="ptg-av">${esc(rpcInitiales(e.nom))}</div>
      <div class="ptg-id"><div class="ptg-nom">${esc(e.nom)}</div>${sous ? `<div class="ptg-sous">${sous}</div>` : ''}</div>
      <span class="ptg-badge">${esc(et.lib)}</span>
    </div>`;

  // Absence sur une période (congé, maladie…) : saisie dans « Absences », pas au jour le jour.
  if(r.source === 'periode'){
    return `<div class="ptg-carte ptg-${et.cle}">${tete}
      <div class="ptg-info">Du ${r.dateStart.split('-').reverse().join('/')} au ${r.dateEnd.split('-').reverse().join('/')}${r.motif ? ' · ' + esc(r.motif) : ''}</div>
      ${canEdit ? `<button class="ptg-lien" onclick="showEditAbsenceForm('${r.periodId}')">Modifier ou supprimer l'absence</button>` : ''}
    </div>`;
  }

  const st = r.source === 'pointage' ? r.status : '';
  const ret = st === 'present' ? computeRetardHours(r) : 0, auths = r.autorisations || [];
  const actif = {present: et.cle === 'present', retard: et.cle === 'retard', sortie: et.cle === 'sortie', absent: et.cle === 'absent'};
  const notes = [];
  // (le retard est déjà dans le badge de la carte)
  if(st === 'present' && departAnticipe(r)) notes.push('<span class="ptg-note warn">Départ anticipé</span>');
  if(r.src === 'pointeuse') notes.push('<span class="ptg-note">Pointeuse</span>');

  // Consultation seule
  if(!canEdit){
    const det = st === 'present' ? [r.in ? 'Arrivée ' + r.in : '', r.out ? 'Départ ' + r.out : ''].filter(Boolean).join(' · ') : '';
    return `<div class="ptg-carte ptg-${et.cle}">${tete}
      ${det || notes.length ? `<div class="ptg-info">${det}${notes.length ? ' ' + notes.join(' ') : ''}</div>` : ''}
      ${auths.filter(au => au.sortie).map(au => `<div class="ptg-info">Sortie ${au.sortie}${au.retour ? ' → ' + au.retour : ''}${autorisationDureeH(au) > 0 ? ' (' + fmtH(autorisationDureeH(au)) + ')' : ''}</div>`).join('')}
    </div>`;
  }

  return `<div class="ptg-carte ptg-${et.cle}">${tete}
    <div class="ptg-etats">${RPC_ETATS.map(([k, l]) => `<button class="ptg-e ptg-e-${k}${actif[k] ? ' on' : ''}" onclick="rrEtat('${id}','${k}')">${l}</button>`).join('')}</div>
    ${st === 'present' ? `
    <div class="ptg-heures">
      <label class="ptg-h"><span>Arrivée</span><input type="time" value="${r.in || ''}" onchange="setAttendanceField('${id}','in',this.value)"></label>
      <label class="ptg-h"><span>Départ</span><input type="time" value="${r.out || ''}" onchange="setAttendanceField('${id}','out',this.value)"></label>
    </div>
    ${auths.map((au, i) => `
    <div class="ptg-aut">
      <span class="ptg-aut-t">Sortie</span>
      <input type="time" value="${au.sortie || ''}" onchange="setAutorisationField('${id}',${i},'sortie',this.value)" aria-label="Heure de sortie">
      <span class="ptg-aut-f">→</span>
      <input type="time" value="${au.retour || ''}" onchange="setAutorisationField('${id}',${i},'retour',this.value)" aria-label="Heure de retour">
      <label class="ptg-aut-p"><span>prévu</span><input type="time" value="${au.prevue || ''}" onchange="setAutorisationField('${id}',${i},'prevue',this.value)"></label>
      ${autorisationDureeH(au) > 0 ? `<span class="ptg-note warn">−${fmtH(autorisationDureeH(au))}</span>` : ''}
      ${autorisationDepassee(au) ? '<span class="ptg-note bad">Dépassée</span>' : ''}
      <button class="ptg-x" onclick="removeAutorisation('${id}',${i})" title="Retirer cette sortie" aria-label="Retirer cette sortie">✕</button>
    </div>`).join('')}` : ''}
    ${(notes.length || st) ? `<div class="ptg-pied">
      <div class="ptg-notes">${notes.join('')}</div>
      <div class="ptg-pied-a">
        ${st === 'present' ? `<button class="ptg-lien" onclick="addAutorisation('${id}')">+ Autorisation</button>` : ''}
        ${st ? `<button class="ptg-lien ptg-eff" onclick="if(confirm('Effacer le pointage de ce salarié pour ce jour ?')) setAttendanceStatus('${id}','')">Effacer</button>` : ''}
      </div>
    </div>` : ''}
  </div>`;
};

(function(){
  const css = document.createElement('style');
  css.textContent = `
/* ----- En-tête ----- */
.ptg-entete{padding:12px !important;}
.ptg-date{display:flex;align-items:center;gap:8px;}
.ptg-fl{padding:9px 13px !important;font-size:18px !important;line-height:1;}
.ptg-date-c{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:44px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);cursor:pointer;}
.ptg-date-t{font-weight:700;font-size:15px;color:var(--ink);}
.ptg-date-c input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;}
.ptg-av-l{display:flex;justify-content:space-between;align-items:center;margin:12px 0 6px;font-size:12.5px;font-weight:700;}
.ptg-ok{color:var(--good);} .ptg-aff{color:var(--warn);} .ptg-av-n{color:var(--ink-soft);}
.ptg-barre{height:7px;border-radius:99px;background:var(--surface-3);overflow:hidden;}
.ptg-barre div{height:100%;background:var(--warn);border-radius:99px;transition:width .3s;} .ptg-barre div.ok{background:var(--good);}
.ptg-cpts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;}
.ptg-cpt{display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px;border-radius:10px;border:1.5px solid transparent;cursor:pointer;font-family:inherit;}
.ptg-cpt b{font-size:20px;line-height:1.1;} .ptg-cpt span{font-size:11px;font-weight:600;}
.ptg-cpt-present{background:#ECFDF3;color:#15803D;} .ptg-cpt-absent{background:#FEF2F2;color:#B91C1C;}
.ptg-cpt-retard{background:#FFF7ED;color:#B45309;} .ptg-cpt-vide{background:#F1F5F9;color:#475569;}
.ptg-cpt.on{border-color:currentColor;}
.ptg-actions{display:flex;gap:8px;margin-top:12px;}
.ptg-actions .btn{flex:1;padding:10px 6px !important;font-size:12.5px !important;}
.ptg-actions .ptg-reinit{flex:0 0 46px;font-size:17px !important;}
/* ----- Recherche et filtres ----- */
.ptg-filtres{padding:10px 12px !important;}
.ptg-recherche{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface-2);font-size:14px;font-family:inherit;}
.ptg-pilules{display:flex;gap:6px;overflow-x:auto;margin-top:9px;padding-bottom:2px;scrollbar-width:none;}
.ptg-pilules::-webkit-scrollbar{display:none;}
.ptg-pil{flex-shrink:0;white-space:nowrap;border:1.5px solid var(--border);background:var(--surface);color:var(--ink-soft);border-radius:99px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}
.ptg-pil b{margin-left:3px;color:var(--ink);} .ptg-pil.on{background:var(--accent);border-color:var(--accent);color:#fff;} .ptg-pil.on b{color:#fff;}
/* ----- Cartes salarié ----- */
.ptg-liste{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
.ptg-carte{--c:#94A3B8;--cf:#F1F5F9;background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--c);border-radius:12px;padding:11px 12px;}
.ptg-present{--c:#16A34A;--cf:#ECFDF3;} .ptg-retard{--c:#D97706;--cf:#FFF7ED;} .ptg-sortie{--c:#CA8A04;--cf:#FEFCE8;}
.ptg-absent{--c:#DC2626;--cf:#FEF2F2;} .ptg-conge{--c:#2563EB;--cf:#EFF6FF;} .ptg-maladie{--c:#9333EA;--cf:#F5F3FF;} .ptg-vide{--c:#94A3B8;--cf:#F1F5F9;}
.ptg-tete{display:flex;align-items:center;gap:10px;}
.ptg-av{flex:0 0 36px;height:36px;border-radius:50%;background:var(--cf);color:var(--c);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;}
.ptg-id{flex:1;min-width:0;}
.ptg-nom{font-weight:700;font-size:14.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ptg-sous{font-size:11.5px;color:var(--ink-faint);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ptg-badge{flex-shrink:0;background:var(--cf);color:var(--c);font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:99px;}
.ptg-etats{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:10px;}
.ptg-e{border:1.5px solid var(--border);background:var(--surface);color:var(--ink-soft);border-radius:8px;padding:8px 0;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ptg-e.on{color:#fff;} .ptg-e-present.on{background:#16A34A;border-color:#16A34A;} .ptg-e-retard.on{background:#D97706;border-color:#D97706;}
.ptg-e-sortie.on{background:#CA8A04;border-color:#CA8A04;} .ptg-e-absent.on{background:#DC2626;border-color:#DC2626;}
.ptg-heures{display:flex;gap:8px;margin-top:9px;}
.ptg-h{flex:1;display:flex;align-items:center;gap:6px;border:1.5px solid var(--border);border-radius:9px;padding:3px 4px 3px 9px;background:var(--surface-2);min-width:0;}
.ptg-h span{font-size:11.5px;font-weight:600;color:var(--ink-soft);}
.ptg-h input{flex:1;min-width:0;border:0 !important;background:transparent !important;font-size:14px;padding:6px 2px !important;font-family:inherit;color:var(--ink);box-shadow:none !important;}
.ptg-aut{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:7px;background:var(--cf);border-radius:9px;padding:6px 8px;}
.ptg-aut input{flex:1 1 96px;min-width:96px;width:auto;border:1px solid var(--border);border-radius:7px;padding:5px 4px;font-size:13px;background:var(--surface);font-family:inherit;}
.ptg-aut-t{font-size:11.5px;font-weight:700;color:var(--ink-soft);} .ptg-aut-f{color:var(--ink-faint);}
.ptg-aut-p{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-faint);flex:1 1 130px;}
.ptg-x{margin-left:auto;border:0;background:transparent;color:var(--ink-faint);font-size:14px;cursor:pointer;padding:4px 6px;}
.ptg-pied{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;}
.ptg-notes{display:flex;gap:5px;flex-wrap:wrap;} .ptg-pied-a{display:flex;gap:4px;margin-left:auto;}
.ptg-note{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--surface-3);color:var(--ink-soft);}
.ptg-note.warn{background:#FFF7ED;color:#B45309;} .ptg-note.bad{background:#FEF2F2;color:#B91C1C;}
.ptg-info{font-size:12px;color:var(--ink-soft);margin-top:7px;}
.ptg-lien{border:0;background:transparent;color:var(--accent);font-weight:700;font-size:12.5px;padding:6px 6px;cursor:pointer;font-family:inherit;}
.ptg-eff{color:var(--ink-faint);}
@media (min-width:1024px){ .ptg-liste{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));align-items:start;} }
html[data-theme="dark"] .ptg-cpt-present,html[data-theme="dark"] .ptg-cpt-absent,html[data-theme="dark"] .ptg-cpt-retard,html[data-theme="dark"] .ptg-cpt-vide{background:var(--surface-2);}
html[data-theme="dark"] .ptg-carte{--cf:var(--surface-2);}
`;
  document.head.appendChild(css);
})();
