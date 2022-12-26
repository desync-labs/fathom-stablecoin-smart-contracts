const fs = require('fs');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const liquidationBotAddress = "0xe7B11F39E08089B1d76A79D6272AC7Ad11E8eFe9"; // <- flashMintModule gets configured as mintable role

  const accessControlConfig = await AccessControlConfig.at("0x1047d775213c7657330E5B12BFC6667eBdCa0c5A");
  
  console.log(">> Grant MINTABLE_ROLE to liquidation bot")
  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), liquidationBotAddress, { gasLimit: 1000000 });

  console.log("✅ Done")
};