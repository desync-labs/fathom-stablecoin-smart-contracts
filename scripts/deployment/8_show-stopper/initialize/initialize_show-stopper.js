const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const ShowStopper = artifacts.require('./8.17/stablecoin-core/ShowStopper.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing ShowStopper")

  const showStopper = await ShowStopper.at(stablecoinAddress.showStopper);


  await showStopper.initialize(
    stablecoinAddress.bookKeeper
  )

};