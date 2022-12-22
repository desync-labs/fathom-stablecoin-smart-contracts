const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AuthTokenAdapter = artifacts.require('./main/stablecoin-core/adapters/AuthTokenAdapter.sol');

const STABLE_SWAP_MODULE_ADDR = stablecoinAddress.stableSwapModule;

module.exports = async function(deployer) {

  const authTokenAdapter = await AuthTokenAdapter.at(stablecoinAddress.authTokenAdapter);

  console.log(`>> AuthTokenAdapter whitelist address: ${STABLE_SWAP_MODULE_ADDR}`)

  await authTokenAdapter.grantRole(await authTokenAdapter.WHITELISTED(), STABLE_SWAP_MODULE_ADDR)
  console.log("✅ Done")
};