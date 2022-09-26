const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing collateralPoolConfig")

  const collateralPoolConfig = await CollateralPoolConfig.at(stablecoinAddress.collateralPoolConfig);

  // await collateralPoolConfig.initialize(stablecoinAddress.accessControlConfig)
  await collateralPoolConfig.initialize("0xB7095Bb7837C4c4026e887E27B8AA23B81b2e48a")

  

};