// Page d'accueil / connexion du groupe : identité inspirée des trois logos.
// TEK-TREND bleu canard #006070 / #17959F · GADH bordeaux #8C1D40 + or #DF9E19 · MGT terracotta #CB4E1D.
(function(){
  const GRAD = 'linear-gradient(90deg,#006070,#8C1D40,#CB4E1D)';
  const st = document.createElement('style');
  st.textContent = `
.login-wrap{position:relative;background:
  radial-gradient(700px 600px at 0% 0%,#17959F 0%,rgba(23,149,159,0) 70%),
  radial-gradient(700px 600px at 100% 0%,#8C1D40 0%,rgba(140,29,64,0) 72%),
  radial-gradient(900px 640px at 50% 112%,#CB4E1D 0%,rgba(203,78,29,0) 72%),
  linear-gradient(180deg,#3A3A55 0%,#5A2A45 100%);}
.login-wrap::before{content:'';position:absolute;inset:0;pointer-events:none;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><g fill='none' stroke='white' stroke-opacity='.12' stroke-width='.8'><path d='M45 0 L90 45 L45 90 L0 45 Z'/><path d='M45 20 L70 45 L45 70 L20 45 Z'/></g></svg>");background-size:90px 90px;}
.login-wrap .login-card{position:relative;border:0;border-radius:26px;box-shadow:0 28px 70px -24px rgba(20,12,30,.6);}
.login-wrap .logo-text,.login-wrap .logo-text .tek,.login-wrap .logo-text .trend{background:${GRAD};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}
.login-wrap .logo-sub{color:#5B6678;}
.login-wrap .btn-primary[style*="1C2430"],.login-wrap .btn-primary[style*="3A4556"]{border:1.5px solid transparent;background:linear-gradient(#202733,#202733) padding-box,${GRAD} border-box !important;box-shadow:0 0 10px rgba(23,149,159,.2),0 0 10px rgba(203,78,29,.16);}
.login-wrap .soc-card{position:relative;border:1px solid #E3E8EF;border-radius:18px;}
.login-wrap .soc-card::after{content:'';position:absolute;right:0;top:0;bottom:0;width:62%;pointer-events:none;background-repeat:no-repeat;background-position:right center;background-size:cover;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 45%);mask-image:linear-gradient(90deg,transparent 0%,#000 45%);}
.login-wrap .soc-card[onclick*="'tek'"]::after{background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100' preserveAspectRatio='xMaxYMid slice'><g fill='none' stroke='%23006070' stroke-opacity='.28' stroke-width='.9'><path d='M40 0 L100 100'/><path d='M100 0 L40 100'/><path d='M58 0 L118 100'/><path d='M118 0 L58 100'/><path d='M76 0 L136 100'/><path d='M136 0 L76 100'/><path d='M94 0 L154 100'/><path d='M154 0 L94 100'/><path d='M112 0 L172 100'/><path d='M172 0 L112 100'/><path d='M130 0 L190 100'/><path d='M190 0 L130 100'/><path d='M148 0 L208 100'/><path d='M208 0 L148 100'/><path d='M166 0 L226 100'/><path d='M226 0 L166 100'/><path d='M184 0 L244 100'/><path d='M244 0 L184 100'/><path d='M30 20 H200'/><path d='M30 50 H200'/><path d='M30 80 H200'/></g></svg>");}
.login-wrap .soc-card[onclick*="'gadh'"]::after{background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100' preserveAspectRatio='xMaxYMid slice'><g fill='none' stroke-opacity='.4' stroke-width='1.4'><path d='M30 0 L56 50 L30 100' stroke='%238C1D40'/><path d='M47 0 L73 50 L47 100' stroke='%23DF9E19'/><path d='M64 0 L90 50 L64 100' stroke='%23167A8C'/><path d='M81 0 L107 50 L81 100' stroke='%238C1D40'/><path d='M98 0 L124 50 L98 100' stroke='%23DF9E19'/><path d='M115 0 L141 50 L115 100' stroke='%23167A8C'/><path d='M132 0 L158 50 L132 100' stroke='%238C1D40'/><path d='M149 0 L175 50 L149 100' stroke='%23DF9E19'/><path d='M166 0 L192 50 L166 100' stroke='%23167A8C'/><path d='M183 0 L209 50 L183 100' stroke='%238C1D40'/></g></svg>");}
.login-wrap .soc-card[onclick*="'mgt'"]::after{background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100' preserveAspectRatio='xMaxYMid slice'><g fill='none' stroke='%23CB4E1D' stroke-opacity='.25' stroke-width='1.6'><path d='M187.0 52.0 L186.8 55.7 L195.4 59.7 L192.0 70.7 L182.7 69.3 L182.0 70.5 L180.0 73.6 L185.4 81.3 L177.0 89.2 L169.7 83.3 L168.5 84.0 L165.2 85.7 L166.0 95.1 L154.8 97.7 L151.4 89.0 L150.0 89.0 L146.3 88.8 L142.3 97.4 L131.3 94.0 L132.7 84.7 L131.5 84.0 L128.4 82.0 L120.7 87.4 L112.8 79.0 L118.7 71.7 L118.0 70.5 L116.3 67.2 L106.9 68.0 L104.3 56.8 L113.0 53.4 L113.0 52.0 L113.2 48.3 L104.6 44.3 L108.0 33.3 L117.3 34.7 L118.0 33.5 L120.0 30.4 L114.6 22.7 L123.0 14.8 L130.3 20.7 L131.5 20.0 L134.8 18.3 L134.0 8.9 L145.2 6.3 L148.6 15.0 L150.0 15.0 L153.7 15.2 L157.7 6.6 L168.7 10.0 L167.3 19.3 L168.5 20.0 L171.6 22.0 L179.3 16.6 L187.2 25.0 L181.3 32.3 L182.0 33.5 L183.7 36.8 L193.1 36.0 L195.7 47.2 L187.0 50.6 Z'/><circle cx='150' cy='52' r='20'/><circle cx='150' cy='52' r='8'/></g></svg>");}
.login-wrap .soc-card .soc-txt,.login-wrap .soc-card .soc-fleche{position:relative;z-index:1;}
.login-wrap .btn-ghost{background:linear-gradient(#fff,#fff) padding-box,${GRAD} border-box;border:1.5px solid transparent;color:#202733;border-radius:12px;}
`;
  document.head.appendChild(st);
})();
