// Page d'accueil / connexion du groupe : identité inspirée des trois logos.
// TEK-TREND #006070 · GADH #8c1d40 + #df9e19 · MGT #cb4e1d.
(function(){
  const B = '1.5px solid transparent';
  const BORD = 'linear-gradient(90deg,#00838f,#8c1d40,#cb4e1d) border-box';
  const st = document.createElement('style');
  st.textContent = `
.login-wrap{position:relative;overflow:hidden;background:linear-gradient(135deg,#005f73 0%,#7b1634 50%,#cb4e1d 100%);}
.login-wrap::before{content:'';position:absolute;inset:0;pointer-events:none;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 900' preserveAspectRatio='xMidYMid slice'><g fill='none' stroke-opacity='.15'><path d='M-50 150 L100 150 L180 230 L300 230' stroke='%23df9e19' stroke-width='1.5'/><path d='M-20 180 L80 180 L140 240 L240 240' stroke='%23ffffff' stroke-width='1'/><path d='M650 800 L380 800 L300 720 L150 720' stroke='%23cb4e1d' stroke-width='1.5'/><path d='M650 840 L350 840 L280 770 L100 770' stroke='%23df9e19' stroke-width='1'/><path d='M650 330 L520 330 L470 380 L380 380' stroke='%23ffffff' stroke-width='1'/><path d='M650 360 L540 360 L500 400 L430 400' stroke='%23df9e19' stroke-width='1'/></g><g fill-opacity='.15'><circle cx='180' cy='230' r='3' fill='%23df9e19'/><circle cx='300' cy='720' r='3' fill='%23cb4e1d'/><circle cx='380' cy='380' r='3' fill='%23ffffff'/></g></svg>") center/cover no-repeat;}
.login-wrap .login-card{position:relative;z-index:1;border:0;border-radius:36px;box-shadow:0 28px 70px -24px rgba(20,12,30,.6);}
.login-wrap .logo-text,.login-wrap .logo-text .tek,.login-wrap .logo-text .trend{background:linear-gradient(90deg,#006070 0%,#8c1d40 50%,#cb4e1d 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}
.login-wrap .logo-sub{color:#64748b;font-weight:600;}
.login-wrap .btn-primary[style*="1C2430"],.login-wrap .btn-primary[style*="3A4556"]{background:linear-gradient(#1e2530,#1e2530) padding-box,${BORD} !important;border:${B};border-radius:1rem;box-shadow:0 6px 16px -8px rgba(0,0,0,.5);}
.login-wrap .btn-ghost{background:linear-gradient(#ffffff,#ffffff) padding-box,${BORD};border:${B};border-radius:1rem;color:#1e293b;}
.login-wrap .soc-card{position:relative;overflow:hidden;border:1px solid #e2e8f0;border-radius:1rem;}
.login-wrap .soc-card::after{content:'';position:absolute;pointer-events:none;background-repeat:no-repeat;}
.login-wrap .soc-card[onclick*="'tek'"]::after{right:0;top:0;height:100%;width:7rem;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 80' fill='none' stroke='%23006070' stroke-opacity='.2' stroke-width='1.4'><path d='M30 0 L100 70'/><path d='M50 0 L100 50'/><path d='M70 0 L100 30'/><path d='M10 0 L90 80'/><path d='M90 0 L20 70'/><path d='M100 20 L40 80'/></svg>");background-size:100% 100%;}
.login-wrap .soc-card[onclick*="'gadh'"]::after{right:0;top:0;height:100%;width:7rem;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 110 80' fill='none' stroke-width='1.8'><path d='M55 0 L55 35 L110 35' stroke='%238c1d40' stroke-opacity='.35'/><path d='M70 0 L70 50 L110 50' stroke='%23df9e19' stroke-opacity='.35'/><path d='M85 0 L85 65 L110 65' stroke='%23167a8c' stroke-opacity='.35'/></svg>");background-size:100% 100%;}
.login-wrap .soc-card[onclick*="'mgt'"]::after{right:-10px;bottom:-15px;width:96px;height:96px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23cb4e1d' stroke-opacity='.25' stroke-width='.9' stroke-linecap='round' stroke-linejoin='round'><path d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'/><path d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'/></svg>");background-size:100% 100%;}
.login-wrap .soc-card .soc-txt,.login-wrap .soc-card .soc-fleche{position:relative;z-index:1;}
`;
  document.head.appendChild(st);
})();
