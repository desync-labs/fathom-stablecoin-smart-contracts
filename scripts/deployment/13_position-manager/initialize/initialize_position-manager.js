const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const PositionManager = artifacts.require('./8.17/managers/PositionManager.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing positionManager")

  const positionManager = await PositionManager.at(stablecoinAddress.positionManager);

  await positionManager.initialize(
    stablecoinAddress.bookKeeper,
    stablecoinAddress.showStopper
    , { gasLimit: 1000000 }
  )

};