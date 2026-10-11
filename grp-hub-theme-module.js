// Page d'accueil / connexion du groupe : couleurs inspirées des trois logos (turquoise TEK-TREND, prune et or GADH, rouille MGT).
(function(){
  const lignes = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='none' stroke='white' stroke-opacity='.16' stroke-width='1.2'><path d='M0 120 L120 0 M-30 120 L90 0 M30 120 L150 0 M0 60 L60 0 M60 120 L120 60'/></g></svg>\")";
  const st = document.createElement('style');
  st.textContent = `
.login-wrap{position:relative;background:
  radial-gradient(520px 420px at 0% 0%,rgba(5,138,158,.95),transparent 70%),
  radial-gradient(560px 460px at 100% 18%,rgba(139,31,75,.92),transparent 68%),
  radial-gradient(620px 520px at 100% 100%,rgba(232,96,42,.95),transparent 70%),
  radial-gradient(520px 420px at 0% 100%,rgba(207,168,36,.55),transparent 70%),
  #6B1538;}
.login-wrap::before{content:'';position:absolute;inset:0;background:${lignes};background-size:120px 120px;pointer-events:none;}
.login-wrap .login-card{position:relative;border:0;border-radius:28px;box-shadow:0 30px 70px -20px rgba(20,8,30,.55);}
.login-wrap .logo-text .tek,.login-wrap .logo-text .trend{background:linear-gradient(90deg,#058A9E 0%,#8B1F4B 55%,#E8602A 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}
.login-wrap .logo-text{background:linear-gradient(90deg,#058A9E 0%,#8B1F4B 55%,#E8602A 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.login-wrap .logo-sub{background:linear-gradient(90deg,#058A9E,#8B1F4B,#E8602A);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;}
.login-wrap .btn-primary[style*="1C2430"],.login-wrap .btn-primary[style*="3A4556"],.login-wrap .btn-primary[onclick*="Admin"],.login-wrap .btn-primary[onclick*="admin"],.login-wrap .btn-primary[onclick*="Direction"]{border:2px solid transparent;background:linear-gradient(#1C2430,#1C2430) padding-box,linear-gradient(90deg,#058A9E,#8B1F4B,#E8602A) border-box !important;}
.login-wrap .btn-ghost{border:2px solid transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(90deg,#058A9E,#8B1F4B,#E8602A) border-box;}
.login-wrap .soc-card{position:relative;border-radius:20px;border:1px solid rgba(20,8,30,.08);}
.login-wrap .soc-card::after{content:'';position:absolute;right:0;top:0;bottom:0;width:46%;pointer-events:none;opacity:.5;background:repeating-linear-gradient(135deg,var(--m) 0 1.5px,transparent 1.5px 11px);-webkit-mask-image:linear-gradient(90deg,transparent,#000);mask-image:linear-gradient(90deg,transparent,#000);}
.login-wrap .soc-card .soc-txt,.login-wrap .soc-card .soc-fleche{position:relative;z-index:1;}
`;
  document.head.appendChild(st);
})();
