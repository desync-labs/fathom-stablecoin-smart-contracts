const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const STABILITY_FEE_COLLECTOR_ADDR = stablecoinAddress.stabilityFeeCollector;

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant STABILITY_FEE_COLLECTOR_ADDR address: ${STABILITY_FEE_COLLECTOR_ADDR}`)
  await accessControlConfig.grantRole(await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(), STABILITY_FEE_COLLECTOR_ADDR, { gasLimit: 1000000 });

  console.log("✅ Done")
};