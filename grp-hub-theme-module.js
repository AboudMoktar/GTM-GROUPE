// Page d'accueil / connexion du groupe : identité inspirée des trois logos.
// TEK-TREND #006070 · GADH #8c1d40 + #df9e19 · MGT #cb4e1d.
(function(){
  const BORD = 'linear-gradient(90deg,#00838f 0%,#8c1d40 50%,#cb4e1d 100%) border-box';
  const st = document.createElement('style');
  st.textContent = `
.login-wrap{position:relative;overflow:hidden;background:radial-gradient(circle at 10% 15%,#006070 0%,transparent 45%),radial-gradient(circle at 90% 10%,#7b1634 0%,transparent 45%),radial-gradient(circle at 95% 85%,#d65018 0%,#a43812 40%,#521805 100%),#0a2530;}
.login-wrap::before{content:'';position:absolute;inset:0;pointer-events:none;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 900' preserveAspectRatio='xMaxYMid slice'><g fill='none' stroke-opacity='.3'><path d='M250 -50 L400 100 L400 300 L550 450' stroke='%23df9e19' stroke-width='1.2'/><path d='M280 -50 L430 100 L430 280 L580 430' stroke='%23ffffff' stroke-width='.8' stroke-opacity='.12'/><path d='M150 900 L300 750 L480 750 L600 870' stroke='%23df9e19' stroke-width='1.5'/><path d='M120 950 L270 800 L450 800 L570 920' stroke='%23cb4e1d' stroke-width='1.2'/><path d='M350 650 L420 580 L500 580' stroke='%23df9e19' stroke-width='1'/></g><g fill-opacity='.3'><circle cx='400' cy='100' r='3' fill='%23df9e19'/><circle cx='300' cy='750' r='3' fill='%23cb4e1d'/><circle cx='420' cy='580' r='2.5' fill='%23df9e19'/></g></svg>") right center/cover no-repeat;}
.login-wrap .login-card{position:relative;z-index:1;border:0;border-radius:36px;box-shadow:0 28px 70px -24px rgba(0,0,0,.6);}
.login-wrap .logo-text{-webkit-text-fill-color:initial;}
.login-wrap .logo-text .tek{color:#104861;background:none;-webkit-text-fill-color:#104861;}
.login-wrap .logo-text .trend{color:#cb4e1d;background:none;-webkit-text-fill-color:#cb4e1d;}
.login-wrap .logo-sub{color:#8c6239;font-weight:700;}
.login-wrap .btn-primary[style*="1C2430"],.login-wrap .btn-primary[style*="3A4556"]{background:linear-gradient(#1e2530,#1e2530) padding-box,${BORD} !important;border:1.8px solid transparent;border-radius:1rem;}
.login-wrap .btn-ghost{background:linear-gradient(#ffffff,#ffffff) padding-box,${BORD};border:1.8px solid transparent;border-radius:1rem;color:#1e293b;}
.login-wrap .soc-card{position:relative;overflow:hidden;border:1px solid #e2e8f0;border-radius:1rem;}
.login-wrap .soc-card::after{content:'';position:absolute;pointer-events:none;background-repeat:no-repeat;}
.login-wrap .soc-card[onclick*="'tek'"]::after{right:0;top:0;height:100%;width:7rem;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 110 80' fill='none' stroke='%23006070' stroke-opacity='.2' stroke-width='1.6'><line x1='30' y1='0' x2='110' y2='70'/><line x1='60' y1='0' x2='110' y2='45'/><line x1='10' y1='0' x2='100' y2='80'/><line x1='110' y1='10' x2='40' y2='80'/><line x1='90' y1='0' x2='20' y2='65'/></svg>");background-size:100% 100%;}
.login-wrap .soc-card[onclick*="'gadh'"]::after{right:0;top:0;height:100%;width:7rem;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 80' fill='none'><path d='M35 0 L75 0 L75 40' stroke='%238c1d40' stroke-width='2.2' stroke-opacity='.4'/><path d='M50 0 L88 0 L88 55' stroke='%23df9e19' stroke-width='2.2' stroke-opacity='.5'/><path d='M65 0 L100 0 L100 70' stroke='%23167a8c' stroke-width='2.2' stroke-opacity='.4'/></svg>");background-size:100% 100%;}
.login-wrap .soc-card[onclick*="'mgt'"]::after{right:-16px;bottom:-24px;width:105px;height:105px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23cb4e1d' stroke-opacity='.25' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'><path d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'/><circle cx='12' cy='12' r='3.2'/></svg>");background-size:100% 100%;}
.login-wrap .soc-card .soc-txt,.login-wrap .soc-card .soc-fleche{position:relative;z-index:1;}

.login-wrap .login-brand{background:radial-gradient(circle at 15% 10%,#004d5a 0%,transparent 55%),radial-gradient(circle at 92% 12%,#63122c 0%,transparent 55%),radial-gradient(circle at 85% 100%,#9e3912 0%,transparent 60%),#0d1721 !important;}
.login-wrap .lb-titre{color:#fff;letter-spacing:2px;}
.login-wrap .lb-titre span{background:linear-gradient(90deg,#1DB5C7,#DF9E19 55%,#FF7B47);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;}
.login-wrap .lb-sous{opacity:.75;}
.login-wrap .lb-chip{box-shadow:0 6px 18px -8px rgba(0,0,0,.6);}
.login-wrap .lb-pied{opacity:.75;color:#DF9E19;}
.login-wrap .login-cote .btn-primary{background:linear-gradient(90deg,#00838f 0%,#8c1d40 55%,#cb4e1d 100%) !important;border:0;border-radius:14px;box-shadow:0 10px 22px -10px rgba(140,29,64,.7);}
.login-wrap .login-cote .field input:focus{border-color:#00838f;box-shadow:0 0 0 3px rgba(0,131,143,.18);}
.login-wrap .lc-titre{color:#0d1721;}
`;
  document.head.appendChild(st);
})();
