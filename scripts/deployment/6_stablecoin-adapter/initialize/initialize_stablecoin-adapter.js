const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const StablecoinAdapter = artifacts.require('./8.17/stablecoin-core/adapters/StablecoinAdapter.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing StablecoinAdapter")

  const stablecoinAdapter = await StablecoinAdapter.at(stablecoinAddress.stablecoinAdapter);


  await stablecoinAdapter.initialize(
    stablecoinAddress.bookKeeper,
    stablecoinAddress.fathomStablecoin,
  )

};