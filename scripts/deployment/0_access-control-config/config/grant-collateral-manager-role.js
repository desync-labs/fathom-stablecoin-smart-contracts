const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {

  const ADDR = stablecoinAddress.fixedSpreadLiquidationStrategy;
  const ADDR2 = stablecoinAddress.positionManager;
  const ADDR3 = stablecoinAddress.stableSwapModule;


  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant COLLATERAL_MANAGER_ROLE address: ${ADDR}`)
  console.log(`>> Grant COLLATERAL_MANAGER_ROLE address: ${ADDR2}`)
  console.log(`>> Grant COLLATERAL_MANAGER_ROLE address: ${ADDR3}`)

  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), ADDR, { gasLimit: 1000000 })
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), ADDR2, { gasLimit: 1000000 })
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), ADDR3, { gasLimit: 1000000 })

  console.log("✅ Done")
};