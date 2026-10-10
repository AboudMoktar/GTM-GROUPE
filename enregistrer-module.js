// Téléchargements : demande où enregistrer le fichier (nom et dossier au choix) pour qu'on le retrouve facilement.
// Si le navigateur ne le permet pas, le fichier va dans « Téléchargements » et un message le rappelle.
(function(){
  const MIMES = {'.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pdf':'application/pdf', '.csv':'text/csv'};
  function avis(msg){
    try { if(typeof showToast === 'function') return showToast(msg); } catch(e) {}
    try { if(typeof toast === 'function') return toast(msg); } catch(e) {}
    try { if(window.parent && window.parent !== window && typeof window.parent.showToast === 'function') return window.parent.showToast(msg); } catch(e) {}
  }
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    const a = this, args = arguments;
    if(!a.download || !/^blob:/.test(a.href) || !window.showSaveFilePicker) return orig.apply(a, args);
    const nom = a.download, ext = ((nom.match(/\.[a-z0-9]+$/i) || [''])[0]).toLowerCase();
    const blobP = fetch(a.href).then(r => r.blob());
    let picker;
    try { picker = window.showSaveFilePicker({suggestedName:nom, types: MIMES[ext] ? [{description:'Fichier ' + ext.slice(1).toUpperCase(), accept:{[MIMES[ext]]:[ext]}}] : undefined}); }
    catch(e) { return orig.apply(a, args); }
    Promise.all([picker, blobP]).then(([h, blob]) => h.createWritable().then(w => w.write(blob).then(() => w.close())).then(() => avis('Fichier enregistré : ' + (h.name || nom))))
      .catch(e => {
        if(e && e.name === 'AbortError') return;
        blobP.then(b => { const b2 = document.createElement('a'); b2.href = URL.createObjectURL(b); b2.download = nom; document.body.appendChild(b2); orig.call(b2); setTimeout(() => { URL.revokeObjectURL(b2.href); b2.remove(); }, 3000); avis('Fichier dans le dossier « Téléchargements » : ' + nom + ' (Ctrl+J pour l\'ouvrir)'); }).catch(() => {});
      });
  };
})();
