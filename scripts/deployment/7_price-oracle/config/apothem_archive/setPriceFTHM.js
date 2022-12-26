const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("FTHM")

const PriceOracle = artifacts.require('./main/stablecoin-core/PriceOracle.sol');

module.exports =  async function(deployer) {
  console.log(">> Set Price FTHM")

  const priceOracle = await PriceOracle.at("0x32CCe8931422bca01dE1664fcD6A16a5f20585f6");


  await priceOracle.setPrice(
    COLLATERAL_POOL_ID
  )

};