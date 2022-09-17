const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

async function main() {
    console.log(">> Initializing fairLaunch with WXDC");
    const FairLaunch = await hre.ethers.getContractFactory("FairLaunch");
    const fairLaunch = await FairLaunch.attach(stablecoinAddress.fairLaunch);

    await fairLaunch.addPool(0, stablecoinAddress.WXDC, true);
    await fairLaunch.transferOwnership(stablecoinAddress.shield);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  