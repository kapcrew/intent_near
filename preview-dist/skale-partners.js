(()=>{
const P=window.INTENT_PROPERTY_PARTNERS||[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const hubs={
'Hong Kong':[114.1694,22.3193],'Japan':[139.6917,35.6895],'South Korea':[126.978,37.5665],'Australia':[151.2093,-33.8688],
'France':[2.3522,48.8566],'Germany':[10.4515,51.1657],'USA':[-98.5795,39.8283],'Singapore':[103.8198,1.3521],
'UAE':[55.2708,25.2048],'Mexico':[-99.1332,19.4326],'Uruguay':[-56.1645,-34.9011],'Uruguay / LatAm':[-56.1645,-34.9011],
'South Africa':[28.0473,-26.2041],'Kenya':[36.8219,-1.2921],'Nigeria':[3.3792,6.5244],'United Kingdom':[-0.1276,51.5072],
'Spain':[-3.7038,40.4168],'Saudi Arabia':[46.6753,24.7136],'Brazil':[-46.6333,-23.5505]
};
function typeGroup(t=''){t=t.toLowerCase();if(t.includes('broker')||t.includes('marketplace')||t.includes('services'))return'Brokerage / Marketplace';if(t.includes('asset manager')||t.includes('investment manager')||t.includes('reit')||t.includes('private equity')||t.includes('trust'))return'Asset Manager / REIT';if(t.includes('proptech')||t.includes('data')||t.includes('infrastructure')||t.includes('technology'))return'PropTech / Infrastructure';return'Developer / Owner'}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
const points=P.map((p,i)=>{const c=hubs[p.country]||[10,15],h=hash(`${p.country}|${p.name}`),a=(h%360)*Math.PI/180,r=(p.country==='Hong Kong'||p.country==='Singapore'?0.09:0.35)+((h>>8)%100)/400;return{...p,key:`${p.country}|${p.name}`,group:typeGroup(p.type),lng:c[0]+Math.cos(a)*r,lat:c[1]+Math.sin(a)*r*.6}});
let visible=[...points],active='',mapApi=null,currentTransform=null;
function logo(p){try{return`${new URL(p.website).origin}/favicon.ico`}catch{return''}}
function initials(n=''){return n.replace(/[/&-]/g,' ').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function countries(){return[...new Set(points.map(x=>x.country))].sort()}
function render(app){
 app.innerHTML=`<div class="circle-partners-page shell page"><section class="circle-partners-head"><div><div class="eyebrow">Global property ecosystem</div><h1>Property ecosystem <span>and organizations</span></h1></div><div><p>Real-estate agencies, developers, asset managers, operators and property platforms from the original INTENT ecosystem directory. A directory entry does not indicate a signed partnership.</p><div class="partner-kpis"><div><b>${points.length}</b><small>organizations</small></div><div><b>${countries().length}</b><small>markets</small></div><div><b>${points.length}</b><small>mapped points</small></div></div></div></section>
 <section class="partner-map-card"><div class="partner-toolbar" role="search" aria-label="Filter organizations"><label class="partner-search-field"><span>Search organizations</span><input id="partnerSearch" type="search" placeholder="Company, country or expertise"></label><label><span>Market</span><select id="partnerCountry"><option value="">All markets</option>${countries().map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label><span>Organization type</span><select id="partnerType"><option value="">All types</option><option>Developer / Owner</option><option>Asset Manager / REIT</option><option>Brokerage / Marketplace</option><option>PropTech / Infrastructure</option></select></label><button id="partnerReset" class="outline">Clear filters</button></div>
 <div class="partner-map-layout"><div class="partner-map-wrap"><div class="partner-map-controls"><button id="partnerZoomIn" type="button" aria-label="Zoom in">+</button><button id="partnerZoomOut" type="button" aria-label="Zoom out">−</button><button id="partnerZoomHome" type="button" aria-label="Reset map">⌂</button></div><div id="circleWorldMap" class="circle-world-map"></div><div class="partner-map-hint">Scroll, pinch or click a company to focus its market.</div><div class="partner-legend"><span><i class="key"></i>Priority organizations</span><span><i></i>Mapped organizations</span></div></div><aside><div class="partner-list-head"><div><small>Visible organizations</small><b id="partnerCount" aria-live="polite">${visible.length}</b></div><span>Click a company or map point to focus its market.</span></div><div id="partnerList" class="partner-list"></div></aside></div></section></div>`;
 bind(); draw(); list();
}
function bind(){
 const q=document.querySelector('#partnerSearch'),c=document.querySelector('#partnerCountry'),t=document.querySelector('#partnerType');
 const apply=()=>{
  const n=q.value.toLowerCase().trim();
  visible=points.filter(p=>(!n||`${p.name} ${p.country} ${p.type}`.toLowerCase().includes(n))&&(!c.value||p.country===c.value)&&(!t.value||p.group===t.value));
  if(active && !visible.some(p=>p.key===active)) active='';
  document.querySelector('#partnerCount').textContent=visible.length;
  list();
  draw();
 };
 q.oninput=apply;c.onchange=apply;t.onchange=apply;
 document.querySelector('#partnerList').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('a')){e.preventDefault();e.target.closest('[data-key]')?.click()}};
 document.querySelector('#partnerReset').onclick=()=>{q.value='';c.value='';t.value='';active='';currentTransform=null;apply()};
 document.querySelector('#partnerZoomIn').onclick=()=>mapApi?.zoomIn();
 document.querySelector('#partnerZoomOut').onclick=()=>mapApi?.zoomOut();
 document.querySelector('#partnerZoomHome').onclick=()=>{active='';list();mapApi?.reset()};
 document.querySelector('#partnerList').onclick=e=>{
  if(e.target.closest('a'))return;
  const el=e.target.closest('[data-key]');
  if(el){
   active=el.dataset.key;
   list();
   const point=visible.find(p=>p.key===active);
   if(point) mapApi?.focus(point);
   el.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
 };
}
function list(){
 const el=document.querySelector('#partnerList');if(!el)return;
 el.innerHTML=visible.map(p=>`<article class="partner-row ${active===p.key?'active':''}" data-key="${esc(p.key)}" tabindex="0" aria-label="Focus ${esc(p.name)} on the map"><span class="partner-logo"><img src="${esc(logo(p))}" alt="" onerror="this.style.display='none'"><i>${esc(initials(p.name))}</i></span><div><h3>${esc(p.name)}</h3><small>${esc(p.country)} · ${esc(p.group)}</small><b>${esc(p.country)} market</b></div><span class="partner-priority">${esc(p.priority||'')}</span><a href="${esc(p.website)}" target="_blank" rel="noopener">Website ↗</a></article>`).join('')||'<div class="empty">No organizations match these filters.</div>';
}
async function draw(){
 const h=document.querySelector('#circleWorldMap');if(!h||!window.d3)return;
 const w=Math.max(700,h.clientWidth||900),ht=Math.max(430,h.clientHeight||520);
 h.innerHTML='';
 const svg=d3.select(h).append('svg').attr('viewBox',`0 0 ${w} ${ht}`);
 const proj=d3.geoNaturalEarth1().fitExtent([[14,12],[w-14,ht-12]],{type:'Sphere'});
 const path=d3.geoPath(proj);
 svg.append('rect').attr('class','partner-ocean').attr('width',w).attr('height',ht);
 const viewport=svg.append('g').attr('class','partner-viewport');
 const mapLayer=viewport.append('g').attr('class','partner-base');
 const markerLayer=viewport.append('g').attr('class','partner-markers');
 try{
  const world=await fetch('assets/countries.json').then(r=>r.json()),land=topojson.feature(world,world.objects.countries);
  mapLayer.append('g').selectAll('path').data(land.features).join('path').attr('class','partner-land').attr('d',path);
  mapLayer.append('path').datum(topojson.mesh(world,world.objects.countries,(a,b)=>a!==b)).attr('class','partner-boundary').attr('d',path)
 }catch{}
 const nodes=markerLayer.selectAll('g').data(visible,d=>d.key).join('g').attr('class',d=>markerClass(d)).attr('transform',d=>{const [x,y]=proj([d.lng,d.lat]);return`translate(${x},${y})`}).on('click',(e,d)=>{active=d.key;list();updateActiveStyles();focusPoint(d)});
 nodes.append('circle').attr('class','halo').attr('r',d=>active===d.key?11:d.priority==='P1'?8:5.5);
 nodes.append('circle').attr('class','ring').attr('r',d=>active===d.key?6.5:d.priority==='P1'?5.5:3.8);
 nodes.append('circle').attr('class','core').attr('r',d=>active===d.key?3.8:d.priority==='P1'?3.1:2);
 
 const zoom=d3.zoom().scaleExtent([1,7]).translateExtent([[-w*.4,-ht*.4],[w*1.4,ht*1.4]]).on('zoom',event=>{viewport.attr('transform',event.transform);currentTransform=event.transform;});
 svg.call(zoom).on('dblclick.zoom',null);
 svg.call(zoom.transform,currentTransform||d3.zoomIdentity);
 function markerClass(d){return`partner-marker ${d.priority==='P1'?'p1':''} ${active===d.key?'active':''}`}
 function updateActiveStyles(){
  nodes.attr('class',d=>markerClass(d));
  nodes.select('.halo').attr('r',d=>active===d.key?11:d.priority==='P1'?8:5.5);
  nodes.select('.ring').attr('r',d=>active===d.key?6.5:d.priority==='P1'?5.5:3.8);
  nodes.select('.core').attr('r',d=>active===d.key?3.8:d.priority==='P1'?3.1:2);
 }
 function focusPoint(d){
  const pt=proj([d.lng,d.lat]); if(!pt) return;
  const [x,y]=pt; const scale=d.priority==='P1'?4.8:3.8;
  const t=d3.zoomIdentity.translate(w/2-scale*x,ht/2-scale*y).scale(scale);
  svg.transition().duration(650).call(zoom.transform,t);
  updateActiveStyles();
 }
 function resetView(){svg.transition().duration(550).call(zoom.transform,d3.zoomIdentity);updateActiveStyles()}
 function zoomBy(k){svg.transition().duration(250).call(zoom.scaleBy,k)}
 mapApi={focus:focusPoint,reset:resetView,zoomIn:()=>zoomBy(1.35),zoomOut:()=>zoomBy(.74),refresh:updateActiveStyles};
 if(active){const target=visible.find(p=>p.key===active); if(target) setTimeout(()=>focusPoint(target),0); else updateActiveStyles();}
 else {updateActiveStyles();}
}
window.INTENT_SKALE_PARTNERS={render};
})();
