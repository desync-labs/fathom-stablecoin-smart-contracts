const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

async function main() {
    console.log(">> Initializing fairLaunch with WXDC");
    const FathomToken = await hre.ethers.getContractFactory("FathomToken");
    const fathomToken = await FathomToken.attach(stablecoinAddress.fathomToken);

    await fathomToken.transferOwnership(stablecoinAddress.fairLaunch);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  