const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);


const FixedSpreadLiquidationStrategy = artifacts.require('./8.17/stablecoin-core/liquidation-strategies/FixedSpreadLiquidationStrategy.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SimplePriceFeed")

  const fixedSpreadLiquidationStrategy = await FixedSpreadLiquidationStrategy.at(stablecoinAddress.fixedSpreadLiquidationStrategy);

  await fixedSpreadLiquidationStrategy.initialize(
    stablecoinAddress.bookKeeper,
    stablecoinAddress.priceOracle,
    stablecoinAddress.liquidationEngine,
    stablecoinAddress.systemDebtEngine,
    {from:accounts[0]}
  )
};