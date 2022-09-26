const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const StabilityFeeCollector = artifacts.require('./8.17/stablecoin-core/StabilityFeeCollector.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing stabilityFeeCollector")

  const stabilityFeeCollector = await StabilityFeeCollector.at(stablecoinAddress.stabilityFeeCollector);


  await stabilityFeeCollector.initialize(
    stablecoinAddress.bookKeeper,
    stablecoinAddress.systemDebtEngine,
  )

};