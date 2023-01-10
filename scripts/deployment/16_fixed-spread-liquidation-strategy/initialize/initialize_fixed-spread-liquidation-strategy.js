const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);


const FixedSpreadLiquidationStrategy = artifacts.require('./main/stablecoin-core/liquidation-strategies/FixedSpreadLiquidationStrategy.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing FixedSpreadLiquidationStrategy")

  const fixedSpreadLiquidationStrategy = await FixedSpreadLiquidationStrategy.at(stablecoinAddress.fixedSpreadLiquidationStrategy);
  
  await fixedSpreadLiquidationStrategy.initialize(
    stablecoinAddress.bookKeeper,
    stablecoinAddress.priceOracle,
    stablecoinAddress.liquidationEngine,
    stablecoinAddress.systemDebtEngine,
    stablecoinAddress.stablecoinAdapter
  );
};