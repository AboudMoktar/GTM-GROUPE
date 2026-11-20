// ============================================================
// GTM GROUPE — adaptateur du CRM GADH V 0.0.2 (fichiers gadh-gc-listes-prix … gadh-gc-donnees, livrés par l'ami).
// Ces fichiers ont été écrits pour une « coque » autonome (stockage dans le navigateur). Ici, ils tournent dans GTM :
// mêmes clés getJSON / setJSON, données dans Firebase (dossier gadh). Ce fichier fournit les quelques fonctions de la
// coque qui n'existent pas dans GTM. Chargé AVANT les fichiers ajoutés. Aucune donnée dans ce fichier.
// ============================================================
// Bibliothèques de l'import PDF (lecture + OCR), servies par le site (dossier vendor/), chargées à la demande.
window.GC_LOCAL = Object.assign({pdfjs:'vendor/pdf.min.js', pdfjsworker:'vendor/pdf.worker.min.js', tesseract:'vendor/tesseract.min.js', ocr:'vendor/ocr-moteur.js'}, window.GC_LOCAL || {});
if(typeof window.chargerScript !== 'function') window.chargerScript = function(src){
  return new Promise(function(ok, ko){ var sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = function(){ ko(new Error('Bibliothèque indisponible')); }; document.head.appendChild(sc); });
};
if(typeof window.chargerIntegree !== 'function') window.chargerIntegree = function(nom, url){
  if(document.getElementById('bib-' + nom)) return Promise.resolve();
  var loc = window.GC_LOCAL && window.GC_LOCAL[nom], src = loc || url;
  return chargerScript(src).then(function(){ var m = document.createElement('meta'); m.id = 'bib-' + nom; document.head.appendChild(m); });
};
// Clés des données GADH présentes (sans le préfixe du cache) : utilisées par la sauvegarde et l'export des données.
if(typeof window.appCles !== 'function') window.appCles = function(){
  var l = []; try { Object.keys(memoryCache).forEach(function(k){ if(k.indexOf(CACHE_PREFIX + 'gadh_') === 0) l.push(k.slice(CACHE_PREFIX.length)); }); } catch(e) {}
  return l;
};
if(typeof window.appSauvegarder !== 'function') window.appSauvegarder = function(){
  var d = {format:'gadh-gc-autonome', version:1, date:new Date().toISOString(), donnees:{}};
  appCles().forEach(function(k){ d.donnees[k] = getJSON(k, null); });
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], {type:'application/json'}));
  a.download = 'gestion-commandes-sauvegarde-' + getTodayISO() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  showToast('Sauvegarde téléchargée');
};
// Restaurer une sauvegarde : passe par le chargeur de données (fusion, fiches du fichier prioritaires), jamais un effacement.
if(typeof window.appRestaurer !== 'function') window.appRestaurer = function(input){
  if(typeof gcdChargerFichier === 'function') return gcdChargerFichier(input);
  showToast('Utilisez « Charger un fichier de données »');
};
// Société et coordonnées : écran Paramètres de la Facturation GADH (l'utilisateur est celui du compte GTM).
if(typeof window.appParametres !== 'function') window.appParametres = function(){
  if(typeof switchModule === 'function' && typeof canAccessFactures === 'function' && canAccessFactures()){ switchModule('factures'); setTimeout(function(){ try { nav('fact-params'); } catch(e) {} }, 50); }
  else showToast('Paramètres de la société : module Facturation');
};
if(typeof window.basculerTheme !== 'function') window.basculerTheme = function(){ if(typeof themeBasculer === 'function') themeBasculer(); };
// Le menu de GTM est dessiné par renderShell() et mis à jour par nav() : rien à redessiner ici (un renderShell()
// relancerait nav() → renderGC() → dessinerMenu() en boucle).
if(typeof window.dessinerMenu !== 'function') window.dessinerMenu = function(){};
