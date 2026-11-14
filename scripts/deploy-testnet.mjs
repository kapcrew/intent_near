#!/usr/bin/env node
/**
 * Safe, resumable FIRST deployment of 3 NEAR Testnet contracts.
 *
 * An initialized account is VERIFIED and SKIPPED. Never calls `new` a second
 * time and never upgrades an initialized contract automatically: upgrades
 * require an explicit storage-compatibility review and separate command.
 *
 * Public JSON-RPC view calls are made BEFORE signing any transaction.
 * On network errors or unexpected state, fail closed rather than guessing.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--yes')) {
  console.error('Review docs/DEPLOY_NEAR_TESTNET_RU.md, then run: npm run deploy:near');
  process.exit(2);
}

const owner = process.env.OWNER_ID;
const isTestnetId = value => typeof value === 'string' && /^(?:[a-z0-9_-]+\.)+testnet$/.test(value);
if (!isTestnetId(owner)) throw new Error('OWNER_ID must be a valid named .testnet account');

const rpcUrl = 'https://rpc.testnet.near.org';
const mapping = [
  ['property_registry', 'REGISTRY_ID', 'get_properties'],
  ['property_cells', 'SETTLEMENT_ID', 'get_listings'],
  ['agent_policy', 'POLICY_ID', 'get_recent_receipts'],
];

function run(cmd, args, cwd = root) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} returned ${result.status}`);
}

async function rpc(params) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 'intent-deploy', method: 'query', params }),
  });
  if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`NEAR RPC: ${JSON.stringify(payload.error)}`);
  if (!payload.result) throw new Error('NEAR RPC returned no result');
  return payload.result;
}

async function viewFunction(account, method) {
  const result = await rpc({
    request_type: 'call_function', finality: 'final', account_id: account,
    method_name: method, args_base64: Buffer.from('{}').toString('base64'),
  });
  // Contract execution errors may appear in `result.error`, not at the top-level.
  if (result.error) throw new Error(`Contract ${account}.${method}: ${JSON.stringify(result.error)}`);
  if (!Array.isArray(result.result)) throw new Error(`Missing view result for ${account}.${method}`);
  try {
    return JSON.parse(Buffer.from(result.result).toString('utf8'));
  } catch (error) {
    throw new Error(`Non-JSON view response for ${account}.${method}: ${error.message}`);
  }
}

async function isInitialized(account) {
  // near-sdk's #[near(contract_state)] uses the storage key 'STATE'.
  // Do NOT treat a failed `owner()` view as proof of an uninitialized account.
  const result = await rpc({
    request_type: 'view_state', finality: 'final', account_id: account,
    prefix_base64: Buffer.from('STATE').toString('base64'),
  });
  if (!Array.isArray(result.values)) throw new Error(`Cannot inspect STATE for ${account}`);
  return result.values.some(item => Buffer.from(item.key, 'base64').toString('utf8') === 'STATE');
}

for (const [name, key, healthMethod] of mapping) {
  const account = process.env[key];
  if (!isTestnetId(account)) throw new Error(`Set valid ${key} in .env`);
  console.log(`\n### ${name} → ${account}`);
  console.log(`Checking finalized state of ${account} on NEAR Testnet...`);

  const initialized = await isInitialized(account); // RPC/account errors STOP the process.
  if (initialized) {
    const actualOwner = await viewFunction(account, 'owner');
    if (actualOwner !== owner) {
      throw new Error(`${account} is ALREADY initialized to owner=${JSON.stringify(actualOwner)}, expected ${owner}. STOP: not redeploying or overwriting state.`);
    }
    const health = await viewFunction(account, healthMethod);
    if (!Array.isArray(health)) {
      throw new Error(`${account}.${healthMethod} did not return an array. Unexpected contract version; no changes made.`);
    }
    console.log(`✅ ${account} already initialized, owner verified (${owner}), ${healthMethod} works. Skipping build and deployment; existing state preserved.`);
    continue;
  }

  console.log(`${account} has no STATE key: building and deploying this contract for the FIRST time.`);
  const cwd = path.join(root, 'contracts', name);
  run('cargo', ['near', 'build', 'non-reproducible-wasm', '--no-abi'], cwd);
  const wasm = path.join(cwd, 'target', 'near', `${name}.wasm`);
  if (!fs.existsSync(wasm)) throw new Error(`Expected compiled wasm: ${wasm}`);
  const initArgs = name === 'property_cells' ? { owner, treasury: owner } : { owner };
  run('near', [
    'contract', 'deploy', account, 'use-file', wasm,
    'with-init-call', 'new', 'json-args', JSON.stringify(initArgs),
    'prepaid-gas', '100 Tgas', 'attached-deposit', '0 NEAR',
    'network-config', 'testnet', 'sign-with-keychain', 'send',
  ]);
  // Fail if deployment returned success but the expected state/owner is missing.
  if (!await isInitialized(account)) throw new Error(`Deployment reported success, but ${account} has no STATE key`);
  const actualOwner = await viewFunction(account, 'owner');
  if (actualOwner !== owner) throw new Error(`Unexpected owner after deploy: ${account} → ${actualOwner}`);
  console.log(`✅ ${account} deployed and owner verified.`);
}

run(process.execPath, [path.join(root, 'scripts/write-deployments.mjs')]);
console.log('\n✅ All three NEAR contracts checked. Next: npm run seed:near && npm run smoke:near');
