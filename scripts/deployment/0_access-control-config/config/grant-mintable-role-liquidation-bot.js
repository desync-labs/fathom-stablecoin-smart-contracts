const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const liquidationBotAddress = ""; // please put liquidation bot's address in order to do unbackedMinting

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);
  
  console.log(">> Grant MINTABLE_ROLE to liquidation bot")
  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), liquidationBotAddress, { gasLimit: 1000000 });

  console.log("✅ Done")
};