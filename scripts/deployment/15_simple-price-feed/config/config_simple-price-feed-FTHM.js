const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const { BigNumber } = require("ethers");

const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)

const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SimplePriceFeedFTHM")

  const simplePriceFeedUSDT = await SimplePriceFeed.at("0x212d2fFcC949C84556F2eBcA5bDA37D83ba3e035");

  // await simplePriceFeedUSDT.setPrice(WeiPerWad.div(100).toString());

  await simplePriceFeedUSDT.setPrice(WeiPerWad.div(2).toString());
};