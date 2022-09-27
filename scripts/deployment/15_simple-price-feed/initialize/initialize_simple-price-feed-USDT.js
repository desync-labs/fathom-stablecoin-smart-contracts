const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);


const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SimplePriceFeedUSDT")

  const simplePriceFeedUSDT = await SimplePriceFeed.at(stablecoinAddress.simplePriceFeedUSDT);

  await simplePriceFeedUSDT.initialize(
    stablecoinAddress.accessControlConfig,
   { gasLimit: 1000000 }
  )





};