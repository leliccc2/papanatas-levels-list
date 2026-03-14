// ui.js - toggle sidebar with initial 'no-animate' to avoid flicker on load
(function(){
  // add no-animate class immediately to prevent CSS transitions on initial state
  try { document.documentElement.classList.add('no-animate'); } catch(e){}

  const btn = document.getElementById('sidebarToggle');

  // apply stored state synchronously (before removing no-animate)
  try{
    const v = sessionStorage.getItem('papan_sidebar_hidden');
    if(v === '1') document.body.classList.add('sidebar-hidden');
    else document.body.classList.remove('sidebar-hidden');
  }catch(e){
    // ignore
  }

  // remove no-animate after a frame so future transitions animate
  requestAnimationFrame(()=> {
    requestAnimationFrame(()=> {
      try { document.documentElement.classList.remove('no-animate'); } catch(e){}
    });
  });

  if(!btn) return;
  btn.addEventListener('click', ()=>{
    const hidden = document.body.classList.toggle('sidebar-hidden');
    try { sessionStorage.setItem('papan_sidebar_hidden', hidden ? '1' : '0'); } catch(e){}
  });
})();