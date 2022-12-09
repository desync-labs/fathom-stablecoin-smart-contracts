const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const DexPriceOracle = artifacts.require('./8.17/price-oracles/DexPriceOracle.sol');

  //goerli
  // const DEX_FACTORY_ADDR = "0xcaef5a76Caa3C7aCe06E5596b0a7c3d1e088c0fe" //

  //Apothem
  const DEX_FACTORY_ADDR = "0xe350508951929D3e19222824F41790621fb18A15" //

module.exports =  async function(deployer) {
  console.log(">> Initializing DexPriceOracle")

  const dexPriceOracle = await DexPriceOracle.at(stablecoinAddress.dexPriceOracle);


  await dexPriceOracle.initialize(
    DEX_FACTORY_ADDR
  )
};