const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const MINTER_ADDR = stablecoinAddress.flashMintModule; // <- flashMintModule gets configured as mintable role

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  console.log(">> Grant MINTABLE_ROLE")
  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), MINTER_ADDR, { gasLimit: 1000000 });

  console.log("✅ Done")
};