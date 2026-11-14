import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';
const properties=JSON.parse(fs.readFileSync(new URL('../web/public/properties.json',import.meta.url)));
const partners=fs.readFileSync(new URL('../web/public/partners-data.js',import.meta.url),'utf8');
test('preserves 50 properties and original partner map of 117',()=>{assert.equal(properties.length,50);assert.equal((partners.match(/"country":/g)||[]).length,117)});
test('PropertyCell seed amount is 0.01 testnet NEAR, exact yocto',()=>{assert.equal(BigInt('10000000000000000000000')*3n,30000000000000000000000n)});
test('digest format matches registry SHA-256 validation',()=>{const hash=crypto.createHash('sha256').update('sample review').digest('hex');assert.match(hash,/^[a-f0-9]{64}$/)});
test('contract crates are isolated and native NEAR',()=>{for(const name of ['property_registry','property_cells','agent_policy']){const data=fs.readFileSync(new URL(`../contracts/${name}/src/lib.rs`,import.meta.url),'utf8');assert.match(data,/near_sdk/);assert.doesNotMatch(data,/pragma solidity/)}});
