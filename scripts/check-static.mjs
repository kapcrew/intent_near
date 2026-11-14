#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';import path from 'node:path';
const r=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const get=p=>fs.readFileSync(path.join(r,p),'utf8');
let failures=0;const check=(ok,text)=>{console.log(`${ok?'PASS':'FAIL'} ${text}`);if(!ok)failures++};
const props=JSON.parse(get('web/public/properties.json'));const dir=get('web/public/partners-data.js');const partners=(dir.match(/"country":/g)||[]).length;
check(props.length===50,`original catalogue count = ${props.length}`);
check(partners===117,`mandatory partner map entries = ${partners}`);
check(props.filter(p=>p.nearEnabled).length>=8,'8 sample listings available for seeding');
const html=get('web/index.html');
check(html.includes('NEAR TESTNET')&&!html.includes('SKALE TESTNET'),'branding on NEAR');
check(html.includes('skale-partners.js'),'original world-map module preserved');
const js=get('web/src/main.js');
check(js.includes('signAndSendTransaction')&&js.includes('get_holding')&&js.includes('execute_payment'),'native-wallet write/read paths present');
check(!js.includes('window.ethereum')&&!js.includes('ethers.Contract'),'no EVM wallet/signing code in NEAR application');
for(const dir of ['property_registry','property_cells','agent_policy'])check(fs.existsSync(path.join(r,`contracts/${dir}/src/lib.rs`)),`${dir} Rust source exists`);
if(failures)process.exit(1);console.log('Static integrity checks passed');
