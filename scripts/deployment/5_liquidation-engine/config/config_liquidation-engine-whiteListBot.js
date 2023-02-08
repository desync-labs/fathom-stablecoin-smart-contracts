const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const LiquidationEngine = artifacts.require('./main/stablecoin-core/LiquidationEngine.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing LiquidationEngine")

  const botAdd = "0xd2158e94c1ec20A0ebBD1C3786Bad2C99b6bF534";
  const liquidationEngine = await LiquidationEngine.at(stablecoinAddress.liquidationEngine);

  await liquidationEngine.whitelist(
    botAdd
  );

};