#!/usr/bin/env node
/** Optional zero-dependency static READ-ONLY preview. Live wallet build: npm run web:build. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'preview-dist');
fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});fs.cpSync(path.join(root,'web/public'),target,{recursive:true});
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8').replace('<script type="module" src="/src/main.js"></script>','<script type="module" src="/preview.js"></script>').replace('Connect NEAR wallet','Read-only preview').replace(/(src|href)="\//g,'$1="./').replace('</header>','</header><div style="padding:9px 22px;background:#fff4dc;color:#5b3e0c;text-align:center">READ-ONLY visual preview. For actual NEAR wallet interactions build with Vite: npm run web:install &amp;&amp; npm run web:dev</div>');
fs.writeFileSync(path.join(target,'index.html'),html);
let js=fs.readFileSync(path.join(root,'web/src/main.js'),'utf8').replace(/^import .*?;\s*$/gm,'');
js=js.replace(/async function initializeWallet\(\)\{try\{[\s\S]*?\}\}\nfunction bindGlobal\(\)/m, 'async function initializeWallet(){notice("Read-only preview: build web/ with Vite to connect a wallet.")}\nfunction bindGlobal()');
js=js.replace('async function connectWallet(){','async function connectWallet(){toast("Read-only preview. Use npm run web:dev to enable NEAR Wallet Selector.");return;\n/*');
// Avoid comment accidentally swallowing code: surgical function replacement below.
js=js.replace(/async function connectWallet\(\)\{toast\("Read-only preview[\s\S]*?\}\nfunction updateWalletButton/m,'async function connectWallet(){toast("Read-only preview. Use npm run web:dev for wallet transactions.")}\nfunction updateWalletButton');
js=js.replaceAll("fetch('/properties.json')","fetch('./properties.json')").replaceAll("fetch('/deployments.json')","fetch('./deployments.json')");
fs.writeFileSync(path.join(target,'preview.js'),js);
console.log('Read-only visual preview built at preview-dist/ (do not submit this as working wallet demo)');
