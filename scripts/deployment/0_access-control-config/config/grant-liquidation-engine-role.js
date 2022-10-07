const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const LIQUIDATION_ENGINE_ADDR = stablecoinAddress.liquidationEngine;

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);


  console.log(`>> Grant LIQUIDATION_ENGINE_ROLE address: ${LIQUIDATION_ENGINE_ADDR}`)

  await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), LIQUIDATION_ENGINE_ADDR, { gasLimit: 1000000 })
  console.log("✅ Done")
};