#!/usr/bin/env node
/** Idempotent bootstrap: 8 sample properties & 8 purchasable listings. */
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const owner=process.env.OWNER_ID,registry=process.env.REGISTRY_ID,settlement=process.env.SETTLEMENT_ID;
if(!process.argv.includes('--yes')){console.log('Seeds up to 8 synthetic testnet property records + listings. To proceed: node --env-file=.env scripts/seed-testnet.mjs --yes');process.exit(2)}
if(!owner||!registry||!settlement)throw new Error('Set OWNER_ID, REGISTRY_ID, SETTLEMENT_ID');
const all=JSON.parse(readFileSync(path.join(root,'web/public/properties.json'),'utf8')).filter(p=>p.nearEnabled).slice(0,8);
function run(contract,method,body){const args=['contract','call-function','as-transaction',contract,method,'json-args',JSON.stringify(body),'prepaid-gas','100 Tgas','attached-deposit','0 NEAR','sign-as',owner,'network-config','testnet','sign-with-keychain','send'];
 console.log(`$ near ${contract} ${method}: ${JSON.stringify(body)}`);let r=spawnSync('near',args,{stdio:'inherit',shell:false});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${method} failed (exit ${r.status})`)}
const sha=s=>createHash('sha256').update(s).digest('hex');
async function view(id,method,args){const r=await fetch('https://rpc.testnet.near.org',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'seed',method:'query',params:{request_type:'call_function',finality:'final',account_id:id,method_name:method,args_base64:Buffer.from(JSON.stringify(args)).toString('base64')}})});const data=await r.json();if(data.error)throw Error(JSON.stringify(data.error));return JSON.parse(Buffer.from(data.result.result).toString('utf8'))}
for(const p of all){
 const registryItem=await view(registry,'get_property',{property_id:p.id});
 if(!registryItem){const metadata=JSON.stringify({id:p.id,name:p.name,city:p.city,country:p.country,type:p.type});run(registry,'register_property',{id:p.id,name:p.name,metadata_hash:sha(metadata)})} else console.log(`Registry property ${p.id} exists; skipping`);
 const listing=await view(settlement,'get_listing',{property_id:p.id});
 if(!listing){run(settlement,'configure_listing',{property_id:p.id,price_yocto:'10000000000000000000000',total_cells:1000})}else console.log(`PropertyCell listing ${p.id} exists; skipping`);
}
console.log('Seed complete. All entries are synthetic and initially PENDING human review.');
