const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing collateralPoolConfigUSDT")

  const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfigUSDT);

  await collateralPoolConfig.initialize(stablecoinAddress.accessControlConfig)

};