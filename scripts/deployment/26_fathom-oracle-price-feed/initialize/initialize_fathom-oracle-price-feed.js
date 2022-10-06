const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing GetPositions")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at("0x4d107B3ca3472f12d211a392084D731Db9Fe0Ea2");

  await fathomOraclePriceFeed.initialize(
    "0xfbba07454DAe1D94436cC4241bf31543f426257E",  //DexPriceOracle
    "0xCcdC0653935A251B6839F30359917977f994b5d9",                  //USDT
    "0xcEc1609Efd3f12d0Da63250eF6761A7482Dda3BF", //WXDC
    "0x93645Ef8A2d43E415aF92621d3b18f2e5E6e786D" // Access Control Config
  )
};