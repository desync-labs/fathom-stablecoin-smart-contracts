const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const PriceOracle = artifacts.require('./main/stablecoin-core/PriceOracle.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing PriceOracle")

  const priceOracle = await PriceOracle.at("0x31Ee9Eb0f46f5142A4F848dA027F82A1282438ed");


  await priceOracle.setPrice(
    COLLATERAL_POOL_ID
  )

};