const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const IFairLaunch = artifacts.require('./8.17/apis/fathom/interfaces/IFairLaunch.sol');

module.exports = async function(deployer) {
    const fairLaunch = await artifacts.initializeInterfaceAt("IFairLaunch", "FairLaunch");

    const fairLaunch2 = await artifacts.initializeInterfaceAt("ITransferOwnership", "FairLaunch");

  await fairLaunch.addPool(0, stablecoinAddress.WXDC, true);
  await fairLaunch.addPool(1, stablecoinAddress.USDT, true);
  await fairLaunch2.transferOwnership(stablecoinAddress.shield);
};