#!/usr/bin/env node
/** Separately compiles & deploys 3 native NEAR contracts. NEAR CLI keychain signs. */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv.includes('--yes')){console.error('Review docs/DEPLOY_NEAR_TESTNET_RU.md and run: node --env-file=.env scripts/deploy-testnet.mjs --yes');process.exit(2)}
const owner=process.env.OWNER_ID;
if(!owner||!owner.endsWith('.testnet'))throw new Error('OWNER_ID missing or not a named Testnet account');
const mapping=[['property_registry','REGISTRY_ID'],['property_cells','SETTLEMENT_ID'],['agent_policy','POLICY_ID']];
function run(cmd,args,cwd=root){console.log('\n$',cmd,args.join(' '));const r=spawnSync(cmd,args,{cwd,stdio:'inherit',shell:false});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${cmd} returned ${r.status}`)}
for(const [name,key] of mapping){
 const account=process.env[key];if(!account||!account.endsWith('.testnet'))throw new Error(`Set ${key} in .env`);
 const cwd=path.join(root,'contracts',name);
 console.log(`\n### ${name} → ${account}`);
 run('cargo',['near','build','non-reproducible-wasm','--no-abi'],cwd);
 const wasm=path.join(cwd,'target/near',`${name}.wasm`);
 if(!fs.existsSync(wasm))throw new Error(`Expected compiled wasm: ${wasm}. Check cargo near output.`);
 const args=name==='property_cells'?{owner,treasury:owner}:{owner};
 run('near',['contract','deploy',account,'use-file',wasm,'with-init-call','new','json-args',JSON.stringify(args),'prepaid-gas','100 Tgas','attached-deposit','0 NEAR','network-config','testnet','sign-with-keychain','send']);
}
run(process.execPath,[path.join(root,'scripts/write-deployments.mjs')]);
console.log('\n3 deployments completed. Run seed-testnet.mjs --yes, then smoke-testnet.mjs.');
