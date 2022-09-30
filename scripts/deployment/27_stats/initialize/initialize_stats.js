const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);

const FathomStats = artifacts.require('./8.17/stats/FathomStats.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing FathomStats")

  const fathomStats = await FathomStats.at("0x1D8462D0a5FB28c47d01254e3Cc57B1f67f3DAD5");

  await fathomStats.initialize(
    "0x3518B6ac30B3B4B886E1639ada852795165b2596",  //DexPriceOracle
    "0x4658A7AD6fC8c798e0B48d94698E83d7ebAdEb9E",                  //USDT
    "0xcEc1609Efd3f12d0Da63250eF6761A7482Dda3BF", //WXDC
    "0xCcdC0653935A251B6839F30359917977f994b5d9", // Access Control Config
    "0x32333d7d5aE3Ea3bee41618838842EdA5581576c",
    "0xfbba07454DAe1D94436cC4241bf31543f426257E",
    "0x5758444300000000000000000000000000000000000000000000000000000000",
    "0x48853e29341Bf581D56cF8Ff330a0F7371BFFFC6"
    )
};