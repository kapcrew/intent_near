#!/usr/bin/env node
import fs from 'node:fs';
for(const file of ['web/src/main.js','scripts/deploy-testnet.mjs','scripts/seed-testnet.mjs','scripts/smoke-testnet.mjs','scripts/check-static.mjs']){
 const data=fs.readFileSync(file,'utf8');if(/(DEPLOYER_PRIVATE_KEY\s*=|sk-[A-Za-z0-9]{20,})/.test(data))throw Error(`Suspect secret in ${file}`);
}console.log('No obvious credential literals in execution scripts');
