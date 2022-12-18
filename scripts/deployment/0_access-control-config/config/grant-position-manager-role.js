
  const fs = require('fs');

  const rawdata = fs.readFileSync('../../../../addresses.json');
  let stablecoinAddress = JSON.parse(rawdata);
  const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');
  
  module.exports = async function(deployer) {
    const POSITION_MANAGER_ADDR = stablecoinAddress.positionManager;
    const STABLE_SWAP_MODULE_ADDR = stablecoinAddress.stableSwapModule;

    const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);
  
    console.log(`>> Grant POSITION_MANAGER_ROLE address: ${POSITION_MANAGER_ADDR}`)
    await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), POSITION_MANAGER_ADDR, { gasLimit: 1000000 });

    console.log(`>> Grant POSITION_MANAGER_ROLE address: ${POSITION_MANAGER_ADDR}`)
    await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), STABLE_SWAP_MODULE_ADDR, { gasLimit: 1000000 });
    console.log("✅ Done")
  };