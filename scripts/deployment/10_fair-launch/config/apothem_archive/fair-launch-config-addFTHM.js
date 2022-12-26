const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses_ApothemV1.json');
let stablecoinAddress = JSON.parse(rawdata);

const Shield = artifacts.require('./fair-launch/Shield.sol');

module.exports = async function(deployer) {
    // const fairLaunch = await artifacts.initializeInterfaceAt("IFairLaunch", "FairLaunch");
    const shield = await Shield.at(stablecoinAddress.shield);

  await shield.addPool(0, "0x4c52500DdC18EE0C6CB6155961347076E43ABb99", false, {gaslimit : 4000000});
  console.log("addPool 0 FTHM done")
  // await fairLaunch2.transferOwnership(stablecoinAddress.shield);
};