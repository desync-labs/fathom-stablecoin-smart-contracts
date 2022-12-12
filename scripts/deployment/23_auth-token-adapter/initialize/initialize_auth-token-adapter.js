const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const AuthTokenAdapter = artifacts.require('./8.17/stablecoin-core/adapters/AuthTokenAdapter.sol');

const COLLATERAL_POOL_ID = formatBytes32String("US+STABLE")


module.exports =  async function(deployer) {
  console.log(">> Initializing AuthTokenAdapter")

  const authTokenAdapter = await AuthTokenAdapter.at(stablecoinAddress.authTokenAdapter);

  await authTokenAdapter.initialize(
    stablecoinAddress.bookKeeper,
    COLLATERAL_POOL_ID,
    stablecoinAddress.USDT,
  )
};