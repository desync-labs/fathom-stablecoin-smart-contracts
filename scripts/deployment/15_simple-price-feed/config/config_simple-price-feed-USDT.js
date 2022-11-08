const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const { BigNumber } = require("ethers");

const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)

const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SimplePriceFeedUSDT")

  const simplePriceFeedUSDT = await SimplePriceFeed.at(stablecoinAddress.simplePriceFeedUSDT);

  // await simplePriceFeedUSDT.setPrice(WeiPerWad.div(100).toString());

  await simplePriceFeedUSDT.setPrice(WeiPerWad.div(1).toString());
};