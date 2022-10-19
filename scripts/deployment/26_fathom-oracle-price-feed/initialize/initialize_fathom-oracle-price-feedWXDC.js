const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing fathom-oracle-price-feed")

  const fathomOraclePriceFeed = await FathomOraclePriceFeed.at("0x00CDb38D1989De7D3E32c15dFd2b5DAa9fe3B56d");

  await fathomOraclePriceFeed.initialize(
    "0x16c5DA5b2535Dc8bE0b26B2584552a7423583967",  //DexPriceOracle
    "0x8789fE3aFE51865494A727Cb8bc73439492a04b2",  //USDT
    "0x6e7acf1d6A89130Fe8894E818FF57858D9C1A405", //WXDC
    "0xE341942C21888E8dc02E3088C856462297C0Ee29" // Access Control Config
  )
};