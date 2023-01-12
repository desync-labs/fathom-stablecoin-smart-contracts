const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const LiquidationEngine = artifacts.require('./main/stablecoin-core/LiquidationEngine.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing LiquidationEngine")

  const botAdd = "0xe7B11F39E08089B1d76A79D6272AC7Ad11E8eFe9";
  const liquidationEngine = await LiquidationEngine.at(stablecoinAddress.liquidationEngine);

  await liquidationEngine.whitelist(
    botAdd
  );

};