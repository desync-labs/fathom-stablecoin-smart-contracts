const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const StableSwapModule = artifacts.require('./main/stablecoin-core/StableSwapModule.sol');
// const AUTH_TOKEN_ADAPTER_ADDR = stablecoinAddress.authTokenAdapter;
const STABLECOIN_ADAPTER_ADDR = stablecoinAddress.stablecoinAdapter;
const SYSTEM_DEBT_ENGINE_ADDR = stablecoinAddress.systemDebtEngine;

module.exports =  async function(deployer) {
  console.log(">> Initializing StableSwapModule")

  const stableSwapModule = await StableSwapModule.at(stablecoinAddress.stableSwapModule);

  await stableSwapModule.initialize(
    // AUTH_TOKEN_ADAPTER_ADDR,
    stablecoinAddress.bookKeeper,
    STABLECOIN_ADAPTER_ADDR,
    SYSTEM_DEBT_ENGINE_ADDR,
  )
};