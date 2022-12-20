const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const FathomStablecoin = artifacts.require('./main/stablecoin-core/FathomStablecoin.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing FathomStablecoin")

  const NAME = "Fathom USD"
  const SYMBOL = "FXD"

  const fathomStablecoin = await FathomStablecoin.at(stablecoinAddress.fathomStablecoin);


  await fathomStablecoin.initialize(
    NAME, SYMBOL
  )

};