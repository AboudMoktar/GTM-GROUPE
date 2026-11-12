// ============================================================
// ASSISTANT GTM (chatbot) — réponses calculées dans l'application
// ------------------------------------------------------------
// Bouton « Assistant » (bulle) dans la barre du haut (et « Assistant » dans le menu du compte) :
// questions en français sur les commandes. Les réponses sont calculées par
// assistant-reponses.js en parcourant les données que le compte peut lire :
// aucune IA externe, aucune clé, rien n'est envoyé hors de l'application.
// (L'option Gemini a été retirée le 12/11/2026 ; la clé éventuellement gardée
//  sur l'appareil est effacée au chargement.)
// ============================================================

let iaHisto = [];          // [{role:'user'|'model', text}]

/* ancienne option Gemini : effacer la clé et les réglages restés sur l'appareil */
(function(){
  try { localStorage.removeItem('gtm_ia_cle_gemini'); localStorage.removeItem('gtm_ia_modele'); } catch(e){}
  try { if(window.indexedDB) indexedDB.deleteDatabase('gtm-assistant-ia'); } catch(e){}
})();

/* ---------- bouton dans la barre du haut ---------- */
/* classe propre (pas « theme-btn » : ce bouton-là est masqué dans l'affichage habituel et son icône est remplacée) */
(function(){
  const st = document.createElement('style'); st.id = 'ia-btn-css';
  st.textContent = 'html body .topbar .user-chip .ia-btn{display:inline-flex !important;align-items:center;justify-content:center;width:40px;height:40px;min-width:40px;padding:0;border:0;border-radius:10px;background:rgba(127,140,160,.18) !important;color:inherit;line-height:1;cursor:pointer;flex-shrink:0}html body .topbar .user-chip .ia-btn svg{display:block}';
  (document.head || document.documentElement).appendChild(st);
})();
const IA_ICONE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 6.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="currentColor" stroke-width="1.2"/></svg>';
function assistantBouton(){
  return `<button class="ia-btn" onclick="assistantOuvrir()" aria-label="Assistant GTM" title="Assistant GTM">${IA_ICONE}</button>`;
}

/* ---------- résumé des données (ce que l'assistant « voit ») ---------- */
function iaAujourdhui(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function iaDocsSuivi(){
  try { return (typeof suiviLireDocs === 'function') ? suiviLireDocs() : {}; } catch(e){ return {}; }
}
/* ---------- mise en forme simple des réponses (gras, listes, tableaux) ---------- */
function iaMiseEnForme(txt){
  const e = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  const L = String(txt).replace(/\r/g, '').split('\n'), out = [];
  let liste = false, i = 0;
  const fermer = () => { if(liste){ out.push('</ul>'); liste = false; } };
  while(i < L.length){
    const l = L[i];
    if(/^\s*\|.*\|\s*$/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])){
      fermer();
      const cells = s => s.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
      let h = '<div style="overflow-x:auto"><table class="ia-tab"><thead><tr>' + cells(l).map(c => `<th>${e(c)}</th>`).join('') + '</tr></thead><tbody>';
      i += 2;
      while(i < L.length && /^\s*\|.*\|\s*$/.test(L[i])){ h += '<tr>' + cells(L[i]).map(c => `<td>${e(c)}</td>`).join('') + '</tr>'; i++; }
      out.push(h + '</tbody></table></div>'); continue;
    }
    const m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(l);
    if(m){ if(!liste){ out.push('<ul>'); liste = true; } out.push(`<li>${e(m[1])}</li>`); }
    else if(/^\s*#{1,4}\s+/.test(l)){ fermer(); out.push(`<div class="ia-h">${e(l.replace(/^\s*#+\s+/, ''))}</div>`); }
    else if(!l.trim()){ fermer(); out.push('<div style="height:6px"></div>'); }
    else { fermer(); out.push(`<div>${e(l)}</div>`); }
    i++;
  }
  fermer();
  return out.join('');
}

/* ---------- fenêtre de l'assistant ---------- */
const IA_CSS = `
#ia-fond{position:fixed;inset:0;z-index:9000;background:rgba(10,15,25,.45);display:flex;justify-content:flex-end}
#ia-box{width:min(480px,100%);height:100%;height:100dvh;background:var(--card,#fff);color:var(--ink,#111);display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.25)}
#ia-box .ia-tete{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#1F3864;color:#fff}
#ia-box .ia-tete b{flex:1;font-size:17px}#ia-box .ia-tete button{background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:10px;min-width:40px;height:40px;font-size:18px;cursor:pointer}
#ia-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.ia-m{max-width:92%;padding:10px 12px;border-radius:14px;font-size:15px;line-height:1.4;overflow-wrap:anywhere}
.ia-m.u{align-self:flex-end;background:#1F3864;color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap}
.ia-m.b{align-self:flex-start;background:var(--sub,#eef1f6);border-bottom-left-radius:4px}
.ia-m.err{align-self:stretch;background:#fde2e1;color:#8a1c14}
.ia-m ul{margin:4px 0 4px 18px;padding:0}.ia-h{font-weight:800;margin-top:4px}
.ia-tab{border-collapse:collapse;font-size:13px;margin:4px 0}.ia-tab th,.ia-tab td{border:1px solid #c9d1dc;padding:3px 6px;text-align:left}.ia-tab th{background:#dde5f0}
#ia-sugg{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}#ia-sugg button{border:1px solid #c9d1dc;background:var(--card,#fff);color:inherit;border-radius:99px;padding:6px 12px;font-size:13.5px;cursor:pointer}
#ia-saisie{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #d9dee6}
#ia-saisie textarea{flex:1;resize:none;min-height:44px;max-height:120px;border:1px solid #c9d1dc;border-radius:12px;padding:10px;font:inherit;font-size:15px;background:var(--card,#fff);color:inherit}
#ia-saisie button{min-width:52px;border:0;border-radius:12px;background:#1F3864;color:#fff;font-size:20px;cursor:pointer}
#ia-saisie button:disabled{opacity:.5}
#ia-regl-x{padding:14px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px;font-size:14.5px}
#ia-regl input,#ia-regl select{width:100%;height:44px;border:1px solid #c9d1dc;border-radius:10px;padding:0 10px;font:inherit;background:var(--card,#fff);color:inherit}
#ia-regl .av{background:#fff3cd;color:#4a3b00;border:1px solid #e7cf6a;border-radius:10px;padding:10px}
#ia-regl .btns{display:flex;gap:8px;flex-wrap:wrap}#ia-regl .btns button{height:44px;padding:0 16px;border-radius:10px;border:1px solid #c9d1dc;background:var(--card,#fff);color:inherit;font-weight:700;cursor:pointer}
#ia-regl .btns button.p{background:#1F3864;color:#fff;border-color:#1F3864}
.ia-src{margin-top:6px;font-size:11.5px;opacity:.6}
.ia-point{display:inline-block;animation:iaP 1s infinite}@keyframes iaP{50%{opacity:.3}}`;

let iaCompte = null;
function assistantOuvrir(){
  if(document.getElementById('ia-fond')) return;
  /* conversation propre à chaque compte : changement de compte = nouvelle conversation */
  const u = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.username || currentUser.nom) : '';
  if(u !== iaCompte){ iaHisto = []; iaCompte = u; }
  if(!document.getElementById('ia-css')){ const st = document.createElement('style'); st.id = 'ia-css'; st.textContent = IA_CSS; document.head.appendChild(st); }
  const f = document.createElement('div'); f.id = 'ia-fond';
  f.innerHTML = `<div id="ia-box" role="dialog" aria-label="Assistant GTM"><div class="ia-tete"><span style="display:inline-flex">${IA_ICONE}</span><b>Assistant GTM</b>
    <button onclick="assistantNouvelle()" title="Nouvelle conversation" aria-label="Nouvelle conversation">↺</button><button onclick="assistantFermer()" aria-label="Fermer">✕</button></div><div id="ia-corps" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div>`;
  f.addEventListener('click', ev => { if(ev.target === f) assistantFermer(); });
  document.body.appendChild(f);
  iaVueChat();
}
function assistantFermer(){ const f = document.getElementById('ia-fond'); if(f) f.remove(); }
function assistantNouvelle(){ iaHisto = []; iaVueChat(); }

function iaVueChat(){
  const corps = document.getElementById('ia-corps'); if(!corps) return;
  corps.innerHTML = `<div id="ia-msgs"></div><div id="ia-sugg"></div>
    <div id="ia-saisie"><textarea id="ia-q" rows="1" placeholder="Posez votre question…" enterkeyhint="send"></textarea><button id="ia-envoi" aria-label="Envoyer">➤</button></div>`;
  const msgs = document.getElementById('ia-msgs');
  if(!iaHisto.length) msgs.innerHTML = `<div class="ia-m b">Bonjour ! Je réponds aux questions sur les commandes en calculant directement à partir de vos données : où en sont les pièces, ce qui reste à produire, ce qui est prêt à expédier, les exports… Touchez une question ci-dessous ou écrivez la vôtre (« aide » pour des exemples).</div>`;
  iaHisto.forEach(m => iaAjouter(m.role === 'user' ? 'u' : 'b', m.text, m.src));
  const sugg = document.getElementById('ia-sugg');
  if(!iaHisto.length) ['Où en est la commande ?', 'Qu\'est-ce qui reste à produire ?', 'Qu\'est-ce qui est prêt à expédier ?', 'Chez la GADH ?', 'Résumé de l\'export en cours', 'Livraison', 'Aide'].forEach(s => {
    const b = document.createElement('button'); b.textContent = s; b.onclick = () => iaEnvoyer(s); sugg.appendChild(b); });
  const q = document.getElementById('ia-q');
  q.addEventListener('input', () => { q.style.height = 'auto'; q.style.height = Math.min(120, q.scrollHeight) + 'px'; });
  q.addEventListener('keydown', ev => { if(ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); iaEnvoyer(q.value); } });
  document.getElementById('ia-envoi').onclick = () => iaEnvoyer(q.value);
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => { try { q.focus(); } catch(e){} }, 50);
}
function iaSource(src){ return src === 'local' ? '<div class="ia-src">📊 Calculé à partir des données</div>' : ''; }
function iaAjouter(cls, texte, src){
  const msgs = document.getElementById('ia-msgs'); if(!msgs) return null;
  const d = document.createElement('div'); d.className = 'ia-m ' + cls;
  if(cls === 'b') d.innerHTML = iaMiseEnForme(texte) + iaSource(src); else d.textContent = texte;
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
}
function iaEnvoyer(question){
  question = String(question || '').trim(); if(!question) return;
  const q = document.getElementById('ia-q'), sugg = document.getElementById('ia-sugg');
  if(q){ q.value = ''; q.style.height = 'auto'; } if(sugg) sugg.innerHTML = '';
  iaAjouter('u', question);
  let rep = null, src = 'local';
  try { rep = window.gtmReponses ? gtmReponses.repondre(question, iaDocsSuivi(), iaAujourdhui()) : null; } catch(e){ rep = null; }
  if(rep == null){ src = ''; rep = 'Je n\'ai pas compris cette question. ' + (window.gtmReponses ? gtmReponses.aide().replace(/^### Ce que je sais faire\n/, '') : ''); }
  iaHisto.push({role:'user', text:question}, {role:'model', text:rep, src});
  iaAjouter('b', rep, src);
}

window.assistantBouton = assistantBouton;
window.assistantOuvrir = assistantOuvrir;
window.assistantFermer = assistantFermer;
window.assistantNouvelle = assistantNouvelle;
window.gtmIA = {miseEnForme:iaMiseEnForme, icone:IA_ICONE};
