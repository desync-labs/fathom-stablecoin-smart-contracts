const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const { BigNumber } = require("ethers");

const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)

const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SimplePriceFeedUSDT")

  const simplePriceFeedUSDT = await SimplePriceFeed.at("0x77f2326df42E8d2241B9f52Cd1216224b8fc7aE6");

  // await simplePriceFeedUSDT.setPrice(WeiPerWad.div(100).toString());

  await simplePriceFeedUSDT.setPrice(WeiPerWad.toString());
};