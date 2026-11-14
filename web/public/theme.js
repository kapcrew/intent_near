(()=>{
 const root=document.documentElement,button=document.getElementById('themeToggle'),system=matchMedia('(prefers-color-scheme: dark)');
 if(!button)return;
 const read=()=>{try{return localStorage.getItem('intent-blue-theme')}catch{return null}};
 function set(theme,save=false){root.dataset.theme=theme;const dark=theme==='dark';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');button.title=dark?'Switch to light theme':'Switch to dark theme';if(save){try{localStorage.setItem('intent-blue-theme',theme)}catch{}}}
 set(root.dataset.theme||'light');
 button.addEventListener('click',()=>set(root.dataset.theme==='dark'?'light':'dark',true));
 system.addEventListener('change',e=>{if(!read())set(e.matches?'dark':'light')});
 window.addEventListener('storage',e=>{if(e.key==='intent-blue-theme')set(e.newValue==='dark'?'dark':e.newValue==='light'?'light':system.matches?'dark':'light')});
})();
