/* Progressive motion: content remains visible if animation is unsupported. */
(()=>{
  const app=document.getElementById('app');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(!app||!('IntersectionObserver' in window)||!Element.prototype.animate)return;
  const seen=new WeakSet();const active=new Set();
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const el=entry.target;observer.unobserve(el);
      if(seen.has(el))continue;seen.add(el);
      if(reduced.matches)continue;
      const stagger=el.matches('.property-card,.story-step,.arch-card')?(Number(el.dataset.motionOrder||0)%3)*35:0;
      const animation=el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,delay:stagger,easing:'cubic-bezier(.2,.7,.25,1)',fill:'backwards'});
      active.add(animation);animation.finished.catch(()=>{}).finally(()=>active.delete(animation));
    }
  },{threshold:.07,rootMargin:'0px 0px -12px 0px'});
  function scan(){
    const destinations=['passport','settlement','agent','agent','agent','architecture'];
    const labels=['Open Passport','Open settlement','Open agent policy','Open paid valuation','Open agent identity','Check privacy readiness'];
    app.querySelectorAll('.arch-card').forEach((card,i)=>{
      if(card.querySelector('.card-action'))return;
      const a=document.createElement('a');a.className='card-action';a.href='#'+destinations[i];
      a.innerHTML=labels[i]+' <span aria-hidden="true">↗</span>';
      if(i===5)a.addEventListener('click',e=>{e.preventDefault();const button=app.querySelector('#biteStatusArch');button?.closest('.panel').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});button?.focus({preventScroll:true})});
      card.append(a);card.classList.add('interactive-card');
    });
    observer.disconnect();
    app.querySelectorAll('.section-head,.property-card,.cooperation-ribbon,.story-head,.story-step,.story-partner,.arch-card,.passport-hero,.panel,.settlement-intro').forEach((el,i)=>{
      el.dataset.motionOrder=i;
      if(!seen.has(el))observer.observe(el);
    });
  }
  const mutation=new MutationObserver(scan);mutation.observe(app,{childList:true});
  scan();
  reduced.addEventListener('change',()=>{if(reduced.matches){active.forEach(a=>a.cancel());active.clear();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){active.forEach(a=>a.finish());active.clear();}});
})();
