const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const ADAPTER_ADDR = stablecoinAddress.ankrCollateralAdapter;

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant ADAPTER_ROLE address: ${ADAPTER_ADDR}`)

  await accessControlConfig.grantRole(await accessControlConfig.ADAPTER_ROLE(), ADAPTER_ADDR, { gasLimit: 1000000 })
  console.log("✅ Done")
};