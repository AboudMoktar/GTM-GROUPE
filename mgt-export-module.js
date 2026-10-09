// MGT — export Excel (clients, offres, factures) depuis Paramètres.
// La bibliothèque Excel n'est chargée qu'au premier export.
const exportParametresOrigine = window.renderMgtParametres;
window.renderMgtParametres = function(main){
  exportParametresOrigine(main);
  main.insertAdjacentHTML('beforeend', `<div class="card"><h3 style="margin:0 0 6px;font-size:14px;">Exporter vers Excel</h3>
    <p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Un fichier Excel avec trois feuilles : Clients, Offres et Factures.</p>
    <button class="btn btn-primary" style="width:100%;" onclick="exportMgtExcel()">Télécharger le fichier Excel</button>
    <div id="exp-etat" style="font-size:12.5px;margin-top:8px;color:var(--ink-soft);"></div></div>`);
};
window.exportMgtExcel = async () => {
  const etat = (t) => { const e = document.getElementById('exp-etat'); if(e) e.textContent = t; };
  etat('Préparation…');
  try { await chargerBib('exceljs'); } catch(e) { etat('Bibliothèque Excel indisponible : vérifiez la connexion.'); return; }
  const wb = new ExcelJS.Workbook(), cl = Object.entries(crmClients());
  const feuille = (nom, cols, lignes) => {
    const ws = wb.addWorksheet(nom);
    ws.columns = cols.map(c => ({header:c[0], key:c[1], width:c[2]}));
    ws.getRow(1).font = {bold:true}; ws.views = [{state:'frozen', ySplit:1}];
    lignes.forEach(l => ws.addRow(l));
    ws.autoFilter = {from:{row:1, column:1}, to:{row:1, column:cols.length}};
  };
  const nomC = {};
  cl.forEach(([id, c]) => { nomC[id] = c.nom || ''; });
  feuille('Clients', [['Nom','nom',32],['Type','type',12],['Importance','imp',11],['Ville','ville',18],['Région','region',16],['Activité','act',22],['Téléphone','tel',16],['Email','email',26],['Dernière visite','vis',14],['Jours sans visite','jsv',16],['Pipeline pondéré','pipe',16]],
    cl.map(([id, c]) => { const lv = crmDerniereVisite(c), j = crmJoursSansVisite(c);
      return {nom:c.nom, type:crmEstProspect(c) ? 'Prospect' : 'Client', imp:crmLettre(c), ville:c.ville, region:c.region, act:c.activite, tel:c.tel, email:c.email, vis:lv && lv.date ? crmDateFr(lv.date) : '', jsv:j, pipe:Math.round(crmPipeline(c))}; }));
  const off = [], fac = [];
  cl.forEach(([id, c]) => {
    crmOffres(c).forEach(o => off.push({client:c.nom, type:o.type, machine:o.machine, marque:o.marque, montant:crmOffreMontant(o), devise:o.devise || 'EUR', envoi:crmDateFr(crmOffreEnvoi(o)), etat:crmOffreValidation ? crmOffreValidation(o).label : (o.status || ''), relance:o.reminder ? crmDateFr(o.reminder) : ''}));
    crmFactures(c).forEach(f => fac.push({client:c.nom, numero:f.number, date:crmDateFr(f.date), type:f.type, montant:crmNombre(f.amount), payee:f.paid ? 'Oui' : 'Non', statut:f.status}));
  });
  feuille('Offres', [['Client','client',30],['Type','type',16],['Machine','machine',24],['Marque','marque',16],['Montant','montant',14],['Devise','devise',8],['Envoi','envoi',12],['État','etat',14],['Relance','relance',12]], off);
  feuille('Factures', [['Client','client',30],['N°','numero',16],['Date','date',12],['Type','type',16],['Montant','montant',14],['Payée','payee',8],['Statut','statut',14]], fac);
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download = 'MGT_export_' + getTodayISO() + '.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  etat(cl.length + ' clients, ' + off.length + ' offres, ' + fac.length + ' factures exportés.');
};

// Confort téléphone : champs à 16 px (pas de zoom automatique sur iPhone), zones tactiles plus grandes.
(function(){
  const st = document.createElement('style');
  st.textContent = '@media (max-width:700px){ .mgt-in, textarea.mgt-in, select.mgt-in{font-size:16px !important;min-height:42px;} .mgt-onglets button{min-height:40px;font-size:13.5px;} .mgt-section .btn, #main .btn{min-height:42px;} }';
  document.head.appendChild(st);
})();
