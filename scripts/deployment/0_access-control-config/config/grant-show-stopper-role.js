const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const SHOW_STOPPER_ADDR = stablecoinAddress.showStopper;

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  console.log(">> Grant SHOW_STOPPER_ROLE")

  await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), SHOW_STOPPER_ADDR, { gasLimit: 1000000 });

  console.log("✅ Done")
};