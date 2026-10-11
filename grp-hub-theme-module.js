// Page d'accueil / connexion du groupe : identité inspirée des trois logos.
// TEK-TREND bleu canard #006070 / #17959F · GADH bordeaux #8C1D40 + or #DF9E19 · MGT terracotta #CB4E1D.
(function(){
  const GRAD = 'linear-gradient(90deg,#006070 0%,#8C1D40 55%,#CB4E1D 100%)';
  const st = document.createElement('style');
  st.textContent = `
.login-wrap{background:
  radial-gradient(620px 520px at 0% 0%,rgba(23,149,159,.55),transparent 70%),
  radial-gradient(620px 520px at 100% 45%,rgba(140,29,64,.42),transparent 70%),
  radial-gradient(660px 520px at 20% 100%,rgba(203,78,29,.45),transparent 70%),
  linear-gradient(160deg,#F3F5F8 0%,#E9EDF3 100%);}
.login-wrap .login-card{border:0;border-radius:26px;box-shadow:0 24px 60px -24px rgba(32,39,51,.45);}
.login-wrap .logo-text,.login-wrap .logo-text .tek,.login-wrap .logo-text .trend{background:${GRAD};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}
.login-wrap .logo-sub{color:#5B6678;}
.login-wrap .btn-primary[style*="1C2430"],.login-wrap .btn-primary[style*="3A4556"]{border:2px solid transparent;background:linear-gradient(#202733,#202733) padding-box,${GRAD} border-box !important;box-shadow:0 0 14px rgba(23,149,159,.28),0 0 14px rgba(203,78,29,.22);}
.login-wrap .soc-card{border:1px solid #E3E8EF;border-radius:18px;}
.login-wrap .btn-ghost{background:#fff;border:1px solid #C9D1DC;color:#202733;border-radius:12px;}
.login-wrap .btn-ghost:hover{border-color:#8C1D40;}
`;
  document.head.appendChild(st);
})();
