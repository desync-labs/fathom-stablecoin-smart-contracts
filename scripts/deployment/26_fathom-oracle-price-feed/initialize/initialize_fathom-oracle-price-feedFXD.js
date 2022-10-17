const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing fathom-oracle-price-feed")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at("0x3f17A8B747564400C9A837Df5c78D1644840315d");

  await fathomOraclePriceFeed.initialize(
    "0x16c5DA5b2535Dc8bE0b26B2584552a7423583967",  //DexPriceOracle
    "0x8789fE3aFE51865494A727Cb8bc73439492a04b2",  //USDT
    "0xaF23e77566298Ee5442cDf10A66F32EfC00fB44b", //FXD
    "0xE341942C21888E8dc02E3088C856462297C0Ee29" // Access Control Config
  )
};