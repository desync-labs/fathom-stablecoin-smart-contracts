const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const FairLaunch = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');

module.exports = async function (deployer) {

    const fairLaunch = await FairLaunch.at(stablecoinAddress.fairLaunch);

    console.log(">> Initializing fairLaunch with WXDC");

    const fathomAddress = await fairLaunch.devaddr();
    console.log(fathomAddress);
    await fairLaunch.addPool(0, stablecoinAddress.WXDC, true);

    console.log(">> Initializing fairLaunch with USDT");

    await fairLaunch.addPool(1, stablecoinAddress.USDT, true);

    ITransferOwnership
    await fairLaunch.transferOwnership(stablecoinAddress.shield);
};
  