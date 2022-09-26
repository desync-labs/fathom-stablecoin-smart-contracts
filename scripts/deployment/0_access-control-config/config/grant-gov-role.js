const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const deployerAddress =   "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
  const GOV_ROLE_ADDR = deployerAddress //Protocol Deployer

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant GOV_ROLE address: ${GOV_ROLE_ADDR}`)

  await accessControlConfig.grantRole(await accessControlConfig.GOV_ROLE(), GOV_ROLE_ADDR, { gasLimit: 1000000 })
  console.log("✅ Done")
};