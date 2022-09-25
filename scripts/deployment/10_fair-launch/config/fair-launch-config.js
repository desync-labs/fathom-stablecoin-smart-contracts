const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const FairLaunch = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');

async function main() {

    const fairLaunch = await FairLaunch.at(stablecoinAddress.fairLaunch);

    console.log(">> Initializing fairLaunch with WXDC");

    await fairLaunch.addPool(0, stablecoinAddress.WXDC, true);

    console.log(">> Initializing fairLaunch with USDT");

    await fairLaunch.addPool(1, stablecoinAddress.USDT, true);
    await fairLaunch.transferOwnership(stablecoinAddress.shield);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  