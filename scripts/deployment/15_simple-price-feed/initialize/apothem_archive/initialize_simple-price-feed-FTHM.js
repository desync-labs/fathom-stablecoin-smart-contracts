const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);


const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SimplePriceFeed")

  const simplePriceFeedUSDT = await SimplePriceFeed.at("0x212d2fFcC949C84556F2eBcA5bDA37D83ba3e035");

  await simplePriceFeedUSDT.initialize(
    "0x93645Ef8A2d43E415aF92621d3b18f2e5E6e786D"
    , { gasLimit: 5000000 }
  )





};