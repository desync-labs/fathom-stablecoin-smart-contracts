const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing fathom-oracle-price-feed-FTHM")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at("0x93B19F18d834b45D305D168C9B51E95DE9fcb080");

  await fathomOraclePriceFeed.initialize(
    "0xfbba07454DAe1D94436cC4241bf31543f426257E",  //DexPriceOracle
    "0xCcdC0653935A251B6839F30359917977f994b5d9",  //USDT
    "0x4c52500DdC18EE0C6CB6155961347076E43ABb99", //FTHM
    "0x93645Ef8A2d43E415aF92621d3b18f2e5E6e786D" // Access Control Config
  )
};