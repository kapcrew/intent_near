// The wallet SDK is loaded lazily after the catalogue is painted.
// Importing it eagerly can crash Vite's browser runtime before boot() runs.
import '@near-wallet-selector/modal-ui/styles.css';
let actionCreators = null;

/** INTENT × NEAR native testnet interface. No EVM / ethers / x402 assumptions. */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(v || 0);
const compact = a => a && a.length > 21 ? `${a.slice(0,12)}…${a.slice(-8)}` : a || '—';
const money = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(num(v));
const toYocto = v => {
  const s=String(v).trim();
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(s))throw new Error('Enter a positive NEAR amount (up to 24 decimals).');
  const [whole, frac='']=s.split('.');
  return (BigInt(whole)*10n**24n + BigInt((frac+'0'.repeat(24)).slice(0,24))).toString();
};
const fromYocto = v => (Number(BigInt(String(v||0))/10n**18n)/1e6).toFixed(4);
const txLink = hash => `https://testnet.nearblocks.io/txns/${encodeURIComponent(hash)}`;
const accountLink = id => `https://testnet.nearblocks.io/address/${encodeURIComponent(id)}`;
const saveKey = 'intent_near_property_id';
let props=[], cfg={}, selector=null, modal=null, account='', balance='—', active='discover';
let chosen = num(localStorage.getItem(saveKey) || 1), listings=[], chainProperties=[], evidence=[], agent=null, receipts=[];
let holdings={}, busy=false, logs=[];
let filter='all', catalogExpanded=false;
const app = $('#app');
const DEPLOYMENT_FIELDS = {registry:'registry',settlement:'settlement',policy:'policy'};
function toast(message) {
  const el=$('#toast'); el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),5200);
}
function notice(text,kind='info') { logs.unshift({text,time:new Date().toLocaleTimeString(),kind}); logs=logs.slice(0,30);const c=$('#nearConsole');if(c)c.textContent=logs.map(l=>`[${l.time}] ${l.text}`).join('\n'); }
function viewFromHash(){const p=location.hash.replace(/^#/,'');if(p.startsWith('property/')){let id=num(p.split('/')[1]);if(props.some(x=>x.id===id)){chosen=id;localStorage.setItem(saveKey,String(id))}return'property'}return ['discover','settlement','agent','passport','portfolio','partners','architecture'].includes(p)?p:'discover'}
function selected(){return props.find(p=>p.id===chosen)||props[0]}
function isReady(kind){return !!(cfg[kind] && cfg[kind].endsWith('.testnet'))}
function deploymentStatus(){return Object.keys(DEPLOYMENT_FIELDS).filter(isReady).length}
function contractAnchor(kind){return isReady(kind)?`<a href="${accountLink(cfg[kind])}" target="_blank" rel="noopener">${esc(compact(cfg[kind]))} ↗</a>`:'Not configured'}
function statusBadge(ok, yes, no){return `<span class="near-status ${ok?'ok':'pending'}">${ok?esc(yes):esc(no)}</span>`}
function walletGate(msg='Connect a NEAR Testnet wallet to authorize transactions'){
 return `<section class="wallet-gate"><div class="wallet-gate-icon">◈</div><h3>${esc(msg)}</h3><p>NEAR wallet authentication is separate from EVM wallets. All write actions require wallet confirmation and testnet NEAR for gas.</p><button class="primary" data-wallet>Connect NEAR wallet</button><small>Testnet only · ${deploymentStatus()}/3 contracts configured</small></section>`;
}
function render() {
 active=viewFromHash();$$('.nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===active));
 if(!props.length){app.innerHTML='<div class="shell page">Loading property catalogue…</div>';return}
 if(active==='partners'){window.INTENT_SKALE_PARTNERS?.render(app);return}
 if(active==='discover')return renderDiscover();
 if(active==='property')return renderProperty();
 if(active==='settlement')return renderSettlement();
 if(active==='agent')return renderAgent();
 if(active==='passport')return renderPassport();
 if(active==='portfolio')return renderPortfolio();
 if(active==='architecture')return renderArchitecture();
}
function setRoute(route){location.hash=route;if(location.hash==='#'+route)render();window.scrollTo({top:0,behavior:'smooth'})}
function selectProperty(id, screen='property'){chosen=num(id);localStorage.setItem(saveKey,String(chosen));setRoute(screen==='property'?`property/${chosen}`:screen);if(screen==='passport')loadEvidence(chosen)}
function propertyCards(items){return items.map(p=>{
 const listing=findListing(p.id);
 return `<article class="property-card" data-property-card="${p.id}">
  <div class="property-photo" style="background-image:url('${esc(p.gallery?.[0]||'')}')">
   <div class="property-tags"><span>${esc(p.tag||'Property')}</span>${listing?'<span class="arc-live">NEAR TESTNET</span>':''}</div>
   <div class="property-city">${esc(p.city)} · ${esc(p.country)}</div>
  </div>
  <div class="property-body">
   <h3><a class="property-detail-link" href="#property/${p.id}">${esc(p.name)}</a></h3>
   <small>${esc(p.type)} · ${num(p.area).toLocaleString('en-US')} m²</small>
   <div class="property-metrics">
    <div><small>Reference yield</small><b>${esc(p.targetYield)}%</b></div>
    <div><small>Passport score</small><b>${esc(p.passport)}%</b></div>
    <div><small>Occupancy</small><b>${esc(p.occupancy)}%</b></div>
   </div>
   <div class="property-actions"><button data-passport="${p.id}">Passport</button>${listing?`<button class="buy" data-buy="${p.id}">View settlement</button>`:`<button class="buy" data-open="${p.id}">View property</button>`}</div>
  </div>
 </article>`;
 }).join('')}
function findListing(id){return listings.find(l=>num(l.property_id)===num(id))}
function findRecord(id){return chainProperties.find(p=>num(p.id)===num(id))}

// Original INTENT lifecycle + institutional cooperation modules, adapted to NEAR Testnet.
// These are purely informational sections and never simulate contract state.
function renderHomepageStory(){
 return `<div class="brand-story" aria-label="Property lifecycle and institutional cooperation">
  <section class="story-process" aria-labelledby="storyLifecycleTitle">
   <div class="story-head"><div><div class="eyebrow">Property lifecycle</div><h2 id="storyLifecycleTitle">Verification, review and ongoing operations</h2></div><p>The platform connects property evidence with human decisions, Property Cells and subsequent Passport updates.</p></div>
   <div class="story-steps">
    <article class="story-step interactive-card"><span class="number">01</span><h3>Verify property evidence</h3><p>Organize title documents, valuations, inspection records and compliance evidence in the Living Property Passport.</p><a class="card-action" href="#passport">Open property Passport <span aria-hidden="true">↗</span></a></article>
    <article class="story-step interactive-card"><span class="number">02</span><h3>Complete human review</h3><p>Reviewers assess the evidence, record decisions and identify the information needed before participation.</p><a class="card-action" href="#architecture">View review infrastructure <span aria-hidden="true">↗</span></a></article>
    <article class="story-step interactive-card"><span class="number">03</span><h3>Settle Property Cells</h3><p>Listed testnet properties support wallet-confirmed Property Cell purchases using native NEAR on NEAR Testnet.</p><a class="card-action" href="#settlement">Explore settlement <span aria-hidden="true">↗</span></a></article>
    <article class="story-step interactive-card"><span class="number">04</span><h3>Maintain the Passport</h3><p>Policy-governed agents can make permitted testnet payments. New evidence is recorded separately under the property's Passport.</p><a class="card-action" href="#agent">Open agent operations <span aria-hidden="true">↗</span></a></article>
   </div>
  </section>
  <section class="story-cooperation" aria-labelledby="storyCooperationTitle">
   <div class="story-head"><div><div class="eyebrow">Institutional cooperation</div><h2 id="storyCooperationTitle">Cooperation in Japan and South Korea</h2></div><p>Proposed institutional workflows and pilot scope for property verification and ongoing operations.</p></div>
   <div class="story-partners">
    <article class="story-partner interactive-card"><div class="country">Japan · Tokyo</div><h3>Tokyu Land Corporation</h3><p>Proposed pilot areas include the Living Property Passport, property verification and ongoing operations.</p><small>Pilot scope subject to agreement; no production integration implied.</small><a class="card-action" href="https://www.tokyu-land.co.jp/english/" target="_blank" rel="noopener noreferrer">Visit Tokyu Land website <span aria-hidden="true">↗</span></a></article>
    <article class="story-partner interactive-card"><div class="country">South Korea · Seoul</div><h3>Korea Asset In Trust</h3><p>Proposed pilot areas include trust and ownership information, verification workflows and settlement readiness.</p><small>Pilot scope subject to agreement; no production integration implied.</small><a class="card-action" href="https://www.kait.com/" target="_blank" rel="noopener noreferrer">Visit Korea Asset In Trust website <span aria-hidden="true">↗</span></a></article>
   </div>
   <a href="#partners">Explore the complete property ecosystem directory ↗</a>
  </section>
 </div>`;
}

function renderDiscover(){app.innerHTML=`<div class="shell page"><section class="hero"><div class="hero-copy"><div class="eyebrow">Property infrastructure · NEAR Testnet</div><h1>Property verification<br><span>with programmable settlement</span></h1><p>Living Property Passports, human review, testnet Property Cell purchases and policy-governed AI agents — rebuilt using native NEAR smart contracts.</p><div class="hero-actions"><button class="primary" data-viewgo="settlement">Explore settlement</button><button class="ghost" data-viewgo="architecture">Explore architecture</button></div><div class="hero-caption-note">NEAR Testnet · Signed wallet transactions · No real property ownership</div><div class="hero-kpis"><div><b>50</b><span>catalogue properties</span></div><div><b>117</b><span>ecosystem organizations</span></div><div><b>3</b><span>native NEAR contracts</span></div></div></div><div class="hero-visual"><img src="/assets/courtyard.png" alt="Concept rendering of residential property"><div class="hero-property"><small>Architectural concept · sample property</small></div></div></section><section class="cooperation-ribbon" aria-label="Institutional cooperation"><div><div class="eyebrow">Institutional cooperation</div><p>Japan and South Korea.<br>Proposed testnet property lifecycle pilots.</p></div><a class="cooperation-logo" href="https://www.tokyu-land.co.jp/english/" target="_blank"><img src="/assets/tokyu-land.svg" alt="Tokyu Land Corporation"><small>Tokyu Land Corporation · Japan ↗</small></a><a class="cooperation-logo" href="https://www.kait.com/" target="_blank"><img src="/assets/kait.png" alt="Korea Asset In Trust"><small>Korea Asset In Trust · South Korea ↗</small></a></section><p class="near-note">Catalogue and imagery are illustrative. The directory is a list of prospective ecosystem organizations, not a claim that every organization is an INTENT partner.</p><div class="status-ribbon">${statusBadge(isReady('registry'),'Registry configured','Registry undeployed')}${statusBadge(isReady('settlement'),'Settlement configured','Settlement undeployed')}${statusBadge(isReady('policy'),'Agent policy configured','Policy undeployed')}</div><section class="section"><div class="section-head"><div><div class="eyebrow">Search real-estate opportunities</div><h2>Property catalogue</h2></div><p>50 reference properties; ${listings.length} currently registered NEAR settlement listings.</p></div><div class="toolbar"><input id="catalogSearch" placeholder="Search city, asset or country" aria-label="Search catalogue"><select id="catalogCountry"><option value="">All countries</option>${[...new Set(props.map(p=>p.country))].sort().map(c=>`<option>${esc(c)}</option>`).join('')}</select><button class="outline" id="showListed">${filter==='listed'?'Show all':'Show listed only'}</button></div><div id="propertyGrid" class="property-grid ${catalogExpanded?'expanded':''}">${propertyCards(filter==='listed'?props.filter(p=>findListing(p.id)):props)}</div><div class="near-actions"><button class="outline" id="showAll">${catalogExpanded?'Show featured properties':'Show all 50 properties'}</button></div></section></div>`;
 // Insert both original design sections beneath the catalogue / Show all button.
 $('#propertyGrid').closest('.section').insertAdjacentHTML('afterend',renderHomepageStory());
 const catalog=()=>{const q=$('#catalogSearch').value.trim().toLowerCase(),c=$('#catalogCountry').value;const arr=props.filter(p=>(filter==='listed'?!!findListing(p.id):true)&&(!q||`${p.name} ${p.city} ${p.country} ${p.type}`.toLowerCase().includes(q))&&(!c||p.country===c));$('#propertyGrid').innerHTML=propertyCards(arr);};
 $('#catalogSearch').oninput=catalog;$('#catalogCountry').onchange=catalog;$('#showListed').onclick=()=>{filter=filter==='listed'?'all':'listed';render()};$('#showAll').onclick=()=>{catalogExpanded=!catalogExpanded;const grid=$('#propertyGrid');grid.classList.toggle('expanded',catalogExpanded);$('#showAll').textContent=catalogExpanded?'Show featured properties':'Show all 50 properties';if(!catalogExpanded)window.scrollTo({top:Math.max(0,grid.getBoundingClientRect().top+scrollY-125),behavior:'smooth'});};
}
function renderProperty(){const p=selected(),l=findListing(p.id),r=findRecord(p.id);app.innerHTML=`<div class="shell page"><div class="section-head"><div><div class="eyebrow">Living Property Passport · ${esc(p.city)}, ${esc(p.country)}</div><h2>${esc(p.name)}</h2></div><div class="near-cta"><button class="outline" data-viewgo="discover">All properties</button><button class="primary" data-viewgo="passport">Open Passport</button></div></div><div class="near-grid"><section class="panel"><img class="near-detail-image" src="${esc(p.gallery?.[0])}" alt="${esc(p.name)}"><p class="near-note">Concept image and sample numbers. Do not interpret as investment terms or title evidence.</p><div class="near-grid"><div class="near-kpi"><small>Illustrative value</small><b>${money(p.value)}</b></div><div class="near-kpi"><small>Reference target yield</small><b>${esc(p.targetYield)}%</b></div><div class="near-kpi"><small>Sample occupancy</small><b>${esc(p.occupancy)}%</b></div></div><p>${esc(p.thesis||'')}</p></section><section class="panel"><h3>Onchain verification</h3><p>Registry: ${contractAnchor('registry')}</p><p>${statusBadge(!!r,'Property registered','Awaiting onchain registration')}</p><div class="near-divider"></div><div class="near-record"><b>Human review</b><small>${esc(r?.review_status||'Not registered')} · ${esc(r?.reviewed_by||'No reviewer onchain')}</small></div><div class="near-record"><b>Passport evidence</b><small>${r?'Open Passport to read immutable hash attestations':'No onchain evidence yet'}</small></div><div class="near-record"><b>Property Cells</b><small>${l?`${l.sold_cells} / ${l.total_cells} issued · ${fromYocto(l.price_yocto)} testnet NEAR per Cell`:'No NEAR Testnet listing yet'}</small></div><div class="near-actions"><button class="primary" data-viewgo="settlement" ${l?'':'disabled'}>Open settlement</button><button class="outline" data-viewgo="passport">Review evidence</button></div></section></div></div>`}
function renderSettlement(){const available=listings.filter(l=>l.active);const p=selected();const l=findListing(p.id);const chosenListing=l||available[0];const effective=chosenListing?props.find(x=>x.id===num(chosenListing.property_id))||p:p;const currentHolding=num(holdings[effective.id]||0);const cost=chosenListing?fromYocto(chosenListing.price_yocto):'0';app.innerHTML=`<div class="shell page"><div class="section-head"><div><div class="eyebrow">Native NEAR · Testnet-only</div><h2>Property Cell Settlement</h2></div><p>Wallet-signed purchases settle in native testnet NEAR. Every purchase changes an auditable contract-held balance.</p></div><div class="near-banner">Purchases use native NEAR Testnet tokens: each purchase is one wallet-signed transaction with an exact attached deposit.</div><section class="near-grid"><div class="panel near-stack"><h3>Purchase Property Cells</h3><img class="near-detail-image" src="${esc(effective.gallery?.[0])}" alt="${esc(effective.name)}"><form id="purchaseForm" class="near-form"><label>Property listing<select id="settlementProperty">${available.map(x=>{const pr=props.find(p=>p.id===num(x.property_id));return`<option value="${x.property_id}" ${num(x.property_id)===effective.id?'selected':''}>${esc(pr?.name||'Property '+x.property_id)}</option>`}).join('')||'<option>No listings deployed</option>'}</select></label><label>Cells to buy (1–100)<input type="number" min="1" max="100" id="cellQuantity" value="1" required></label><div class="near-grid"><div class="near-kpi"><small>Price / Cell</small><b>${cost} NEAR</b></div><div class="near-kpi"><small>Your holding</small><b>${currentHolding} Cells</b></div></div><p class="near-meta" id="settlementCost">Total: ${cost} testnet NEAR + gas</p><button class="primary" type="submit" ${!account||!chosenListing||busy?'disabled':''}>Buy Cells on NEAR</button></form>${!account?walletGate('Connect your wallet before purchasing'):''}<p class="near-meta">Contract: ${contractAnchor('settlement')}</p></div><aside class="panel near-stack"><h3>Live transaction console</h3><p>Your wallet must authorize every state-changing operation. Wait for final confirmation before reloading holdings.</p><pre id="nearConsole" class="near-console">${esc(logs.map(l=>`[${l.time}] ${l.text}`).join('\n')||'Ready to submit a NEAR Testnet transaction.')}</pre><div class="near-actions"><button class="outline" id="refreshSettlement">Refresh state</button><a href="${esc(cfg.faucetUrl||'https://near-faucet.io')}" target="_blank" rel="noopener">Testnet NEAR faucet ↗</a></div><div class="near-divider"></div><h3>Issuer controls</h3><p class="near-meta">Only the settlement contract owner may configure property listings.</p><form class="near-form" id="listingForm"><label>Property ID<select id="listingPropertyId">${props.filter(x=>x.nearEnabled).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><label>Testnet NEAR price per Cell<input id="listingPrice" value="0.01" required></label><label>Total supply<input id="listingSupply" type="number" value="1000" min="1" max="1000000" required></label><button type="submit" class="outline" ${!account||!isReady('settlement')?'disabled':''}>Configure listing (owner)</button></form></aside></section></div>`;
 $('#settlementProperty')?.addEventListener('change',e=>selectProperty(e.target.value,'settlement'));
 $('#cellQuantity')?.addEventListener('input',e=>{const quantity=Math.max(0,num(e.target.value));$('#settlementCost').textContent=`Total: ${chosenListing?fromYocto((BigInt(chosenListing.price_yocto)*BigInt(Math.floor(quantity))).toString()):'0'} testnet NEAR + gas`});
 $('#purchaseForm').onsubmit=async e=>{e.preventDefault();const quantity=Number($('#cellQuantity').value);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100)return toast('Choose between 1 and 100 Cells');if(!chosenListing)return toast('No onchain listings yet');const cost=(BigInt(chosenListing.price_yocto)*BigInt(quantity)).toString();await submit('settlement','buy_cells',{property_id:num(chosenListing.property_id),quantity},cost);};
 $('#listingForm').onsubmit=async e=>{e.preventDefault();await submit('settlement','configure_listing',{property_id:num($('#listingPropertyId').value),price_yocto:toYocto($('#listingPrice').value),total_cells:num($('#listingSupply').value)});};
 $('#refreshSettlement').onclick=refreshAll;
}
function renderPassport(){
 const p=selected(),r=findRecord(p.id),listing=findListing(p.id);
 const e=evidence.filter(x=>num(x.property_id)===p.id),hasReg=isReady('registry');
 const checkDescriptions={Title:'Ownership and title information associated with the catalogue record.',Documents:'Supporting property documents and record completeness.',Valuation:'Reference valuation and any subsequent attested valuation evidence.',Inspection:'Inspection findings and property condition information.',Compliance:'Compliance records and the human review status.'};
 app.innerHTML=`<div class="shell page near-passport-page">
  <div class="section-head"><div><div class="eyebrow">Living Property Passport · NEAR Testnet</div><h2>Living Property Passport</h2></div><p>Title, documents, valuation, inspection and ongoing operations linked to property history. NEAR stores digest attestations, not documents.</p></div>
  <div class="passport-toolbar"><label for="passportProperty">Property Passport
   <select id="passportProperty">${props.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.name)} · ${esc(x.city)}</option>`).join('')}</select>
   </label><div class="hero-actions"><button class="outline" id="passportDetail">View property</button>${listing?'<button class="primary" id="passportSettlement">Open settlement</button>':''}</div></div>
  <section class="passport">
   <article class="passport-hero"><div class="passport-image" style="background-image:url('${esc(p.gallery?.[1]||p.gallery?.[0]||'')}')">
    <div class="passport-title"><small>${esc(p.city)} · ${esc(p.country)}</small><h2>${esc(p.name)}</h2><span class="tx-pill">Reference Passport score ${esc(p.passport)}%</span></div></div>
    <div class="passport-info">
      <div><small>Illustrative asset value</small><b>${money(p.value)}</b></div>
      <div><small>Occupancy</small><b>${esc(p.occupancy)}%</b></div>
      <div><small>Evidence freshness*</small><b>${esc(p.freshness)}%</b></div>
      <div><small>Asset type</small><b>${esc(p.type)}</b></div>
      <div><small>NEAR onchain review</small><b>${esc(r?.review_status||'NOT REGISTERED')}</b></div>
      <div><small>Settlement</small><b>${listing?'NEAR Testnet':'Reference only'}</b></div>
    </div>
   </article>
   <aside class="panel near-passport-checks"><h3>Verification modules</h3><p class="near-reference-caption">Catalogue reference indicators; they are not independently verified onchain.</p>
    <div class="checks">${(p.checks||[]).map(c=>`<details class="check-detail"><summary><span class="check-icon">✓</span><span><b>${esc(c.name)}</b><small>View verification scope</small></span><span class="check-status">${esc(c.status)}</span><span class="check-chevron" aria-hidden="true">⌄</span></summary><div class="check-description"><p>${esc(checkDescriptions[c.name]||'Supporting property information.')}</p><small>Reference catalogue information, not legal due diligence or a blockchain attestation.</small></div></details>`).join('')}</div>
    <div class="near-onchain-summary"><div class="eyebrow">Verified on NEAR Testnet</div><div class="near-actions">${statusBadge(!!r,'Registry record exists','Awaiting registration')}${statusBadge(r?.review_status==='APPROVED','Human review approved','Review pending / unapproved')}</div><small>Registry: ${contractAnchor('registry')}</small></div>
   </aside>
  </section>
  <p class="near-reference-caption near-passport-note">*Reference imagery, values, scores and property checks are illustrative. Only transactions and hashes displayed below are sourced from NEAR Testnet.</p>
  <section class="near-passport-ledger section"><div class="section-head"><div><div class="eyebrow">Proof and lineage</div><h2>Onchain Passport record</h2></div><p>Stored on ${contractAnchor('registry')}. Every review or evidence addition requires a signed transaction.</p></div>
   <div class="near-grid"><article class="panel near-stack"><h3>${esc(p.name)} · Onchain state</h3><div class="near-actions">${statusBadge(!!r,'Registered','Not registered')}${statusBadge(r?.review_status==='APPROVED','Approved','Pending / rejected')}</div><div class="near-record"><b>Property metadata SHA-256</b><small class="near-tx">${esc(r?.metadata_hash||'Not registered')}</small></div><div class="near-record"><b>Reviewer</b><small>${esc(r?.reviewed_by||'Not yet assigned')}</small></div><div class="near-record"><b>Review timestamp (UTC)</b><small>${esc(r?.reviewed_at_ns?new Date(Number(BigInt(r.reviewed_at_ns)/1000000n)).toISOString():'—')}</small></div><h3>Evidence history (${e.length})</h3><div class="near-list">${e.length?e.map(x=>`<div class="near-record"><b>#${x.id} · ${esc(x.kind)}</b><small class="near-tx">${esc(x.content_hash)}</small><small>Attested by ${esc(x.author)}</small></div>`).join(''):'<p class="near-meta">No evidence attestations recorded on NEAR Testnet yet.</p>'}</div></article>
   <article class="panel near-stack"><h3>Record property</h3><p class="near-meta">Owner registration stores the SHA-256 digest of reference metadata, not an authenticity guarantee.</p><button class="primary" id="registryRegister" ${!account||!hasReg||r?'disabled':''}>Register selected property</button><div class="near-divider"></div><h3>Human review</h3><form class="near-form" id="reviewForm"><label>Review decision<select id="reviewApproved"><option value="true">Approve</option><option value="false">Reject</option></select></label><label>Review note<textarea id="reviewNote" placeholder="What was examined, what needs follow-up?" required></textarea></label><button class="outline" ${!account||!hasReg||!r?'disabled':''}>Commit reviewer decision</button></form><div class="near-divider"></div><h3>Append evidence</h3><form class="near-form" id="evidenceForm"><label>Evidence type<select id="evidenceKind"><option>Valuation</option><option>Inspection</option><option>Compliance</option><option>Document</option><option>Agent Report</option><option>Settlement</option></select></label><label>Evidence reference / description<textarea id="evidenceText" placeholder="Reference text or non-confidential note (SHA-256 generated locally)" required></textarea></label><button class="outline" ${!account||!hasReg||!r?'disabled':''}>Append evidence SHA-256</button></form></article></div>
  </section>
 </div>`;
 $('#passportProperty').onchange=e=>selectProperty(e.target.value,'passport');
 $('#passportDetail').onclick=()=>setRoute(`property/${p.id}`);
 if($('#passportSettlement'))$('#passportSettlement').onclick=()=>setRoute('settlement');
 $('#registryRegister').onclick=async()=>{const payload=JSON.stringify({id:p.id,name:p.name,city:p.city,country:p.country,type:p.type});await submit('registry','register_property',{id:p.id,name:p.name,metadata_hash:await digest(payload)});};
 $('#reviewForm').onsubmit=async e=>{e.preventDefault();await submit('registry','review_property',{property_id:p.id,approved:$('#reviewApproved').value==='true',note_hash:await digest($('#reviewNote').value)});};
 $('#evidenceForm').onsubmit=async e=>{e.preventDefault();await submit('registry','append_evidence',{property_id:p.id,kind:$('#evidenceKind').value,content_hash:await digest($('#evidenceText').value)});};
}
function renderPortfolio(){const owned=props.filter(p=>holdings[p.id]>0);const units=owned.reduce((s,p)=>s+num(holdings[p.id]),0);app.innerHTML=`<div class="shell page"><div class="section-head"><div><div class="eyebrow">NEAR account-linked holdings</div><h2>My Property Portfolio</h2></div><p>Positions are read from the PropertyCells contract, never inferred from a local purchase animation.</p></div>${!account?walletGate('Connect your NEAR wallet to see your positions'):`<div class="portfolio-head"><div><small>Account</small><b style="font-size:.9rem">${esc(compact(account))}</b></div><div><small>Testnet NEAR balance</small><b>${esc(balance)}</b></div><div><small>Owned Property Cells</small><b>${units}</b></div><div><small>Onchain positions</small><b>${owned.length}</b></div></div><section class="panel"><div class="near-actions"><button class="outline" id="portfolioRefresh">Refresh NEAR holdings</button><a target="_blank" href="${accountLink(account)}">View account on explorer ↗</a></div>${owned.map(p=>`<div class="near-property-row"><img src="${esc(p.gallery?.[0])}" alt=""><div><b>${esc(p.name)}</b><div class="near-meta">${esc(p.city)} · ${esc(p.country)}</div></div><div style="margin-left:auto;text-align:right"><b>${holdings[p.id]} Cells</b><div><button class="outline" data-open="${p.id}">View</button></div></div></div>`).join('')||'<p>No holdings yet. Open Settlement and buy testnet Cells to create a position.</p>'}</section>`}</div>`;$('#portfolioRefresh')?.addEventListener('click',refreshAll)}
function renderAgent(){const a=agent;const max=a?fromYocto(a.max_per_action_yocto):'—', daily=a?fromYocto(a.daily_budget_yocto):'—',spent=a?fromYocto(a.spent_today_yocto):'—';app.innerHTML=`<div class="shell page"><div class="section-head"><div><div class="eyebrow">Agent Constitution · Rule-based enforcement</div><h2>AI Agent Operations</h2></div><p>Reusing INTENT Protocol's core principles: policy version, delegated authority, provider allowlist, emergency freeze, receipts and auditable execution.</p></div><div class="near-banner">This is governed execution, not autonomous model reasoning: a configured agent wallet signs its own transactions. Provider payments are testnet NEAR, with async settlement status in an onchain receipt.</div><section class="near-grid"><article class="panel near-stack"><h3>Active agent status</h3><div class="near-grid"><div class="near-kpi"><small>Policy version</small><b>${esc(a?.policy_version||'—')}</b></div><div class="near-kpi"><small>Maximum per action</small><b>${max} NEAR</b></div><div class="near-kpi"><small>Daily budget</small><b>${daily} NEAR</b></div><div class="near-kpi"><small>Day spend</small><b>${spent} NEAR</b></div></div><p>${statusBadge(!!a&&!a.frozen,'Agent configured','Agent unconfigured / frozen')} ${statusBadge(isReady('policy'),'Policy contract configured','No policy contract configured')}</p><div class="near-record"><b>Agent account</b><small>${esc(account||'Connect the agent wallet')}</small></div><div class="near-record"><b>Latest policy hash</b><small class="near-tx">${esc(a?.policy_hash||'—')}</small></div><h3>Pay a whitelisted provider</h3><form class="near-form" id="agentPay"><label>Provider NEAR Testnet account<input id="payProvider" placeholder="service.testnet" required></label><label>Property ID<select id="payProperty">${props.filter(x=>x.nearEnabled).map(x=>`<option value="${x.id}" ${chosen===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label>Testnet NEAR payment<input id="payAmount" value="0.001" required></label><label>Action reference<textarea id="payReference" placeholder="Approved valuation request / attestation reference" required></textarea></label><button class="primary" ${!account||!isReady('policy')?'disabled':''}>Execute governed NEAR payment</button></form></article><article class="panel near-stack"><h3>Owner governance</h3><p class="near-meta">The contract owner manages agent accounts, policy spending limits and provider permissions. The browser never holds an operator private key.</p><form class="near-form" id="policyForm"><label>Agent NEAR account<input id="agentAccount" value="${esc(account)}" placeholder="agent.testnet" required></label><label>Max per action (NEAR)<input id="agentMax" value="0.01" required></label><label>Daily budget (NEAR)<input id="agentDaily" value="0.1" required></label><label>Policy description<textarea id="agentPolicyDescription" required>Property valuation actions limited to allowlisted providers. Owner can freeze.</textarea></label><button class="outline" ${!account||!isReady('policy')?'disabled':''}>Create / update policy</button></form><form class="near-form" id="allowProvider"><label>Agent account<input id="providerAgentId" value="${esc(account)}" placeholder="agent.testnet" required></label><label>Provider account<input id="providerAccountId" placeholder="provider.testnet" required></label><label>Authorization<select id="providerEnabled"><option value="true">Allow</option><option value="false">Revoke</option></select></label><button class="outline" ${!account||!isReady('policy')?'disabled':''}>Update provider allowlist</button></form><div class="near-ops"><button class="outline" id="freezeAll" ${!account||!isReady('policy')?'disabled':''}>Emergency freeze all agents</button><button class="outline" id="unfreezeAll" ${!account||!isReady('policy')?'disabled':''}>Unfreeze policy</button></div></article></section><section class="panel"><div class="section-head"><div><div class="eyebrow">Audit and lineage</div><h2>Execution receipts</h2></div><p>Onchain records include property, agent, provider, policy version, timestamp and completion status.</p></div><div class="near-list">${receipts.length?receipts.map(r=>`<div class="near-record"><b>Receipt #${r.id} · ${esc(r.status)}</b><small>Agent ${esc(r.agent_id)} → ${esc(r.provider_id)} · ${fromYocto(r.amount_yocto)} testnet NEAR</small><small>Property #${r.property_id} · policy v${r.policy_version} · ${esc(r.action_hash)}</small></div>`).join(''):'<p class="near-meta">No receipts yet. An allowlisted agent may create the first execution.</p>'}</div><p>Contract: ${contractAnchor('policy')}</p></section></div>`;
 $('#agentPay').onsubmit=async e=>{e.preventDefault();await submit('policy','execute_payment',{provider_id:$('#payProvider').value.trim(),property_id:num($('#payProperty').value),amount_yocto:toYocto($('#payAmount').value),action_hash:await digest($('#payReference').value)},toYocto($('#payAmount').value));};
 $('#policyForm').onsubmit=async e=>{e.preventDefault();await submit('policy','configure_agent',{account_id:$('#agentAccount').value.trim(),max_per_action_yocto:toYocto($('#agentMax').value),daily_budget_yocto:toYocto($('#agentDaily').value),policy_hash:await digest($('#agentPolicyDescription').value)});};
 $('#allowProvider').onsubmit=async e=>{e.preventDefault();await submit('policy','set_provider',{agent_id:$('#providerAgentId').value.trim(),provider_id:$('#providerAccountId').value.trim(),allowed:$('#providerEnabled').value==='true'});};
 $('#freezeAll').onclick=()=>submit('policy','set_global_freeze',{frozen:true});$('#unfreezeAll').onclick=()=>submit('policy','set_global_freeze',{frozen:false});
}
function renderArchitecture(){app.innerHTML=`<div class="shell page"><div class="section-head"><div><div class="eyebrow">NEAR-native security and payment execution</div><h2>INTENT on NEAR · Architecture</h2></div><p>Three separately deployable Rust smart contracts. The visual identity, 50-property catalogue and 117-organization map come from the existing INTENT project.</p></div><section class="architecture-grid skale-architecture"><article class="arch-card"><i>01</i><h3>PropertyRegistry</h3><p>Owner registration, independent reviewer role, review hashes, Living Property Passport evidence and linked property IDs.</p></article><article class="arch-card"><i>02</i><h3>PropertyCells</h3><p>Native testnet NEAR purchase, issuer-listed supply, NEAR settlement, wallet-linked balances and Cell transfers.</p></article><article class="arch-card"><i>03</i><h3>AgentPolicy</h3><p>Configurable per-action and daily caps, agent and provider allowlists, policy hash versioning and freeze.</p></article><article class="arch-card"><i>04</i><h3>Payment receipts</h3><p>Agent-authorized NEAR payments with asynchronous settlement callbacks and COMPLETE / FAILED receipts.</p></article><article class="arch-card"><i>05</i><h3>Review + Evidence</h3><p>A human reviewer attests document hashes. A delegated evidence agent can append history but cannot approve reviews.</p></article><article class="arch-card"><i>06</i><h3>NEAR wallet selector</h3><p>Meteor Wallet on Testnet; real signatures and JSON-RPC reads. No synthetic signatures or simulated payment receipts.</p></article></section><div class="near-architecture-flow">Property → Review → Passport → Property Cells → Wallet settlement → Agent policy → Evidence</div><section class="panel"><h3>Live deployment configuration</h3><table class="integration-table"><tbody><tr><td>NEAR network</td><td>${statusBadge(true,'TESTNET','')}</td><td>${esc(cfg.rpcUrl||'https://rpc.testnet.near.org')}</td></tr>${['registry','settlement','policy'].map(id=>`<tr><td>${esc(id)}</td><td>${statusBadge(isReady(id),'Configured','Needs deployment')}</td><td>${contractAnchor(id)}</td></tr>`).join('')}</tbody></table><p class="near-note">A configured contract ID is not proof that the contract is deployed. View a real onchain read result or an explorer transaction to verify deployment.</p><div class="near-actions"><button id="checkChain" class="primary">Refresh all onchain state</button><a class="outline" href="https://docs.near.org/tools/cli" target="_blank" rel="noopener">NEAR deployment docs ↗</a><a class="outline" href="https://near-faucet.io" target="_blank" rel="noopener">Testnet faucet ↗</a></div></section><section class="panel"><h3>Reviewer / evidence agent administration</h3><form id="reviewerForm" class="near-form"><label>NEAR account<input id="reviewerAccount" placeholder="reviewer.testnet" required></label><label>Role<select id="reviewerRole"><option value="set_reviewer">Human reviewer</option><option value="set_evidence_agent">Evidence agent</option></select></label><label>Permission<select id="reviewerAllowed"><option value="true">Grant</option><option value="false">Revoke</option></select></label><button class="outline" ${!account||!isReady('registry')?'disabled':''}>Update role (registry owner)</button></form></section><section class="panel"><h3>Hackathon scope, limitations and provenance</h3><p>This is a separate native NEAR Testnet implementation. It does not claim production custody, real-world title verification, stablecoin settlement, cross-chain NEAR Intents, production-grade AI inference or NEP token standard compliance.</p><p>The native NEAR records are intended for a hackathon demonstrator, not legal tokenization. Every catalogue value is illustrative.</p></section></div>`;
 $('#checkChain').onclick=refreshAll;$('#reviewerForm').onsubmit=async e=>{e.preventDefault();await submit('registry',$('#reviewerRole').value,{account_id:$('#reviewerAccount').value.trim(),enabled:$('#reviewerAllowed').value==='true'});};
}
async function digest(text){const data=new TextEncoder().encode(String(text));const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function rpc(method,params){const res=await fetch(cfg.rpcUrl||'https://rpc.testnet.near.org',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'intent-near',method,params})});if(!res.ok)throw Error(`NEAR RPC HTTP ${res.status}`);const data=await res.json();if(data.error)throw Error(data.error.message||'RPC error');return data.result}
async function view(kind,method,args={}) {if(!isReady(kind))return null;const bytes=new TextEncoder().encode(JSON.stringify(args));const encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));const result=await rpc('query',{request_type:'call_function',finality:'final',account_id:cfg[kind],method_name:method,args_base64:encoded});return JSON.parse(new TextDecoder().decode(new Uint8Array(result.result))||'null')}
async function readBalance(id){if(!id)return'—';const r=await rpc('query',{request_type:'view_account',finality:'final',account_id:id});return fromYocto(r.amount)+' NEAR'}
async function refreshAll(){try{const values=await Promise.allSettled([
 view('settlement','get_listings'),view('registry','get_properties'),
 account?view('policy','get_agent',{account_id:account}):Promise.resolve(null),
 view('policy','get_recent_receipts'),
 account?readBalance(account):Promise.resolve('—')
 ]);
 const val=(i,fallback)=>values[i].status==='fulfilled'?(values[i].value??fallback):fallback;
 listings=val(0,[]);chainProperties=val(1,[]);agent=val(2,null);receipts=val(3,[]);balance=val(4,'—');
 const newHoldings={};if(account&&isReady('settlement')){
  const results=await Promise.allSettled(listings.map(l=>view('settlement','get_holding',{property_id:num(l.property_id),account_id:account})));
  listings.forEach((l,i)=>{newHoldings[l.property_id]=results[i].status==='fulfilled'?num(results[i].value):0});
 }holdings=newHoldings;
 const issue=values.find(x=>x.status==='rejected');if(issue)notice(`RPC read error: ${issue.reason?.message||issue.reason}`,'error');else notice('NEAR Testnet data refreshed','ok');
 updateWalletButton();if(active==='passport')await loadEvidence(chosen);else render();
 }catch(error){notice(error.message,'error');toast(error.message);render()}}
async function loadEvidence(propertyId){try{evidence=await view('registry','get_evidence',{property_id:num(propertyId)})||[]}catch(err){notice(err.message,'error');evidence=[]}render()}
async function submit(kind, method, args, deposit='0'){
 if(busy)return;
 if(!isReady(kind))return toast(`Deploy ${kind} contract and configure deployments.json first`);
 if(!account||!selector||!actionCreators)return toast('Connect a NEAR Testnet wallet before writing onchain');
 try{
  busy=true;notice(`Request: ${method}() on ${cfg[kind]}`);const wallet=await selector.wallet();
  const outcome=await wallet.signAndSendTransaction({signerId:account,receiverId:cfg[kind],actions:[actionCreators.functionCall(method,args,BigInt('100000000000000'),BigInt(deposit))]});
  const hash=outcome?.transaction?.hash||outcome?.transaction_outcome?.id||'';
  if(hash){notice(`Submitted: ${hash} · ${txLink(hash)}`,'ok');toast(`Transaction submitted · ${compact(hash)}`)}
  else {notice('Wallet redirect opened. On return, refresh the onchain state.');toast('Confirm transaction in your NEAR wallet');}
 }catch(error){notice(`Transaction failed or rejected: ${error.message}`,'error');toast(error.message||'Wallet declined transaction');console.error(error)}finally{busy=false;await refreshAll()}
}
async function connectWallet(){if(!modal){toast('Wallet selector is not available. See configuration / browser console.');return}modal.show()}
function updateWalletButton(){const b=$('#walletBtn');if(!b)return;b.textContent=account?`◈ ${compact(account)}${balance!=='—'?' · '+balance:''}`:'Connect NEAR wallet';b.classList.toggle('connected',!!account)}
async function initializeWallet(){try{
 // Do not make the page render depend on wallet package/module initialization.
 const [{setupWalletSelector,actionCreators:walletActions},{setupModal},{setupMeteorWallet}]=await Promise.all([
  import('@near-wallet-selector/core'),
  import('@near-wallet-selector/modal-ui'),
  import('@near-wallet-selector/meteor-wallet')
 ]);
 actionCreators=walletActions;
 selector=await setupWalletSelector({network:'testnet',modules:[setupMeteorWallet()]});
 // A contract must exist before the wallet can authorize its restricted function-call key.
 // The UI can be examined read-only before deployment; wallet connection enables after config.
 if(isReady('settlement')) modal=setupModal(selector,{contractId:cfg.settlement});
 const sync=async()=>{const state=selector.store.getState();account=state.accounts.find(a=>a.active)?.accountId||state.accounts[0]?.accountId||'';await refreshAll()};
 selector.store.observable.subscribe(sync);await sync();
 }catch(error){notice(`Wallet selector initialization: ${error.message}`,'error');console.error(error);toast('NEAR wallet selector unavailable. Read-only catalogue remains usable.')}}
function bindGlobal(){
 $('.nav').onclick=e=>{const b=e.target.closest('[data-view]');if(b)setRoute(b.dataset.view)};
 $('#walletBtn').onclick=connectWallet;
 app.onclick=e=>{const passport=e.target.closest('[data-passport]');if(passport){selectProperty(passport.dataset.passport,'passport');return}const buy=e.target.closest('[data-buy]');if(buy){selectProperty(buy.dataset.buy,'settlement');return}const b=e.target.closest('[data-open]');if(b){selectProperty(b.dataset.open);return}const d=e.target.closest('[data-viewgo]');if(d){setRoute(d.dataset.viewgo);return}const w=e.target.closest('[data-wallet]');if(w)connectWallet()};
 window.addEventListener('hashchange',async()=>{active=viewFromHash();if(active==='passport')await loadEvidence(chosen);else render()});
 $('#themeToggle').onclick=()=>{const current=document.documentElement.dataset.theme||'light';const next=current==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('intent-blue-theme',next)};
 const saved=localStorage.getItem('intent-blue-theme');document.documentElement.dataset.theme=saved==='dark'?'dark':'light';
}
async function boot(){bindGlobal();const [propertyData,deployments]=await Promise.all([
 fetch('/properties.json').then(r=>{if(!r.ok)throw Error(`Catalogue HTTP ${r.status}`);return r.json()}),
 fetch('/deployments.json').then(r=>{if(!r.ok)throw Error(`Deployment configuration HTTP ${r.status}`);return r.json()}).catch(e=>{console.warn('NEAR deployment configuration unavailable:',e);return {}})
]);
 if(!Array.isArray(propertyData)||!propertyData.length)throw Error('Property catalogue is empty or invalid');
 props=propertyData;
 cfg={rpcUrl:'https://rpc.testnet.near.org',explorerUrl:'https://testnet.nearblocks.io',faucetUrl:'https://near-faucet.io',...deployments};
 active=viewFromHash();
 render(); // The property catalogue must work even if wallet modules fail to load.
 void initializeWallet();
}
boot().catch(error=>{console.error(error);app.innerHTML=`<div class="shell page"><h2>Failed to load INTENT</h2><p>${esc(error.message)}</p></div>`});
