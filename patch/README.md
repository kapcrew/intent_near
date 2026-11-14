# INTENT NEAR: Borsh dependency hotfix

## Changes
Adds the missing direct `borsh` dependency to the `[dependencies]` of all three contracts:
- contracts/property_registry/Cargo.toml
- contracts/property_cells/Cargo.toml
- contracts/agent_policy/Cargo.toml

No Rust source code, wallet configuration, web app, or smart-contract state is changed.

## Apply
Unzip this archive into the ROOT of your existing `intentNear` project, preserving paths and replacing the three Cargo.toml files.

From the project root, first test the compilation of the previously failing contract:

    cd contracts/property_registry
    cargo near build non-reproducible-wasm --no-abi
    cd ../..

If it compiles, run:

    npm run deploy:near

Note: The previous run stopped during local compilation, so it had not deployed any contract. Do not rerun deploy as a whole if any subsequent run successfully deployed and initialized a contract but failed later.
