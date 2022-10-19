const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);


const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SimplePriceFeed")

  const simplePriceFeedUSDT = await SimplePriceFeed.at(stablecoinAddress.simplePriceFeedFTHM);

  await simplePriceFeedUSDT.initialize(
    stablecoinAddress.accessControlConfig
    , { gasLimit: 5000000 }
  )





};