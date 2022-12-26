const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const LiquidationEngine = artifacts.require('./main/stablecoin-core/LiquidationEngine.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing LiquidationEngine")

  const liquidationEngine = await LiquidationEngine.at(stablecoinAddress.liquidationEngine);


  await liquidationEngine.setPriceOracle(
    stablecoinAddress.priceOracle,
  );

};