#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'web/public/deployments.json'),'utf8'));
let failures=0;
async function view(contract,method,args={}){
 const body={jsonrpc:'2.0',id:'smoke',method:'query',params:{request_type:'call_function',finality:'final',account_id:contract,method_name:method,args_base64:Buffer.from(JSON.stringify(args)).toString('base64')}};
 const res=await fetch(cfg.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await res.json();if(result.error)throw Error(JSON.stringify(result.error));return JSON.parse(Buffer.from(result.result.result).toString('utf8'));
}
const checks=[['Registry initialized',cfg.registry,'owner'],['Settlement initialized',cfg.settlement,'treasury'],['Policy initialized',cfg.policy,'owner'],['Property records',cfg.registry,'get_properties'],['Available listings',cfg.settlement,'get_listings'],['Policy receipts',cfg.policy,'get_recent_receipts']];
for(const [name,id,method] of checks){try{if(!id)throw Error('Contract ID unconfigured');const r=await view(id,method);console.log(`PASS ${name}: ${typeof r==='object'?JSON.stringify(r).slice(0,250):r}`)}catch(e){console.error(`FAIL ${name}: ${e.message}`);failures++}}
if(failures){console.error(`${failures} smoke tests failed`);process.exit(1)}console.log('All NEAR Testnet read-only smoke checks passed');
