#!/usr/bin/env node
// Assistant IA : le bouton 🤖 est visible dans le vrai en-tête de l'application (téléphone et ordinateur) et ouvre l'assistant.
// Lancement (dans tests/) : npm run assistant-ia-entete
'use strict';
const T=__dirname+'/';
const {chromium}=require('playwright'); const serveur=require(T+'serveur.js');
(async()=>{const s=serveur.demarrer(8795),b=await chromium.launch(),r=[];
for (const [nom,vp,mob] of [['tel',{width:412,height:900},true],['pc',{width:1366,height:800},false]]){
 const p=await (await b.newContext({viewport:vp,isMobile:mob,hasTouch:mob,serviceWorkers:'block'})).newPage(); const err=[]; p.on('pageerror',e=>err.push(e.message));
 await p.route(u=>!String(u).startsWith('http://localhost'), rt=>rt.abort());
 await p.goto('http://localhost:8795/index.html'); await p.waitForFunction(()=>typeof renderShell==='function'&&typeof assistantBouton==='function',null,{timeout:20000});
 await p.evaluate(()=>{ currentUser={username:'admin',nom:'Administrateur',role:'admin',profil:'sysadmin',groupe:true,societes:{tek:true,gadh:true,mgt:true}}; activeSociete='tek'; activeModule='commandes'; try{renderShell();}catch(e){console.log(e)} });
 await p.waitForTimeout(800);
 const v=await p.evaluate(()=>{const x=document.querySelector('.topbar .ia-btn'); if(!x) return 'absent'; const st=getComputedStyle(x), rc=x.getBoundingClientRect(); return st.display+' '+Math.round(rc.width)+'x'+Math.round(rc.height)+' '+x.textContent+' visible:'+(rc.width>0&&rc.top>=0&&rc.right<=innerWidth);});
 r.push([nom+' : bouton 🤖 visible dans l\'en-tête', /^inline-flex|^flex/.test(v) && /visible:true/.test(v)]);
 await p.screenshot({path:'/tmp/essai/entete-'+nom+'.png',clip:{x:0,y:0,width:vp.width,height:120}});
 await p.click('.topbar .ia-btn'); await p.waitForTimeout(200); r.push([nom+' : ouvre l\'assistant', await p.locator('#ia-fond').count()===1]);
}
let ko=0; r.forEach(x=>{ if(!x[1]) ko++; console.log((x[1]?'ok   ':'ÉCHEC ')+x[0]); }); console.log(ko?ko+' échec(s)':'ok   aucune erreur');
await b.close(); s.close(); process.exit(ko?1:0);})();
