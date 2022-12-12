const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;


const IFairLaunch = artifacts.require('./8.17/apis/fathom/interfaces/IFairLaunch.sol');

module.exports = async function(deployer) {
    const fairLaunch = await artifacts.initializeInterfaceAt("IFairLaunch", "FairLaunch");

    const fairLaunch2 = await artifacts.initializeInterfaceAt("ITransferOwnership", "FairLaunch");

  await fairLaunch.addPool(0, WXDCAdd, true);
  console.log("addPool 0 WXDC done")
  await fairLaunch.addPool(1, stablecoinAddress.USDT, true);
  console.log("addPool 1 USDT done")

  await fairLaunch2.transferOwnership(stablecoinAddress.shield);
};