#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ids={registry:process.env.REGISTRY_ID,settlement:process.env.SETTLEMENT_ID,policy:process.env.POLICY_ID};
const isTestnet=s=>typeof s==='string'&&/^(?:[a-z0-9_-]+\.)+testnet$/.test(s);
for(const [type,id] of Object.entries(ids))if(!isTestnet(id))throw new Error(`Missing / invalid ${type} ID. Set ${type.toUpperCase()}_ID in .env to an existing named .testnet account.`);
const data={network:'testnet',...ids,rpcUrl:'https://rpc.testnet.near.org',explorerUrl:'https://testnet.nearblocks.io',faucetUrl:'https://near-faucet.io'};
const destination=path.join(root,'web/public/deployments.json');
fs.writeFileSync(destination,JSON.stringify(data,null,2)+'\n');
const dist=path.join(root,'web/dist');if(fs.existsSync(dist))fs.writeFileSync(path.join(dist,'deployments.json'),JSON.stringify(data,null,2)+'\n');
console.log('Configured NEAR Testnet contract IDs (not proof of deployment):');console.table(ids);console.log(destination);
