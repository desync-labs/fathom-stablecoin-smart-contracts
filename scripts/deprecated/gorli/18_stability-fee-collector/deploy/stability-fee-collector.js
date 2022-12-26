const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  console.log(">> Deploying an upgradable StabilityFeeCollector contract")
  const StabilityFeeCollector = (await ethers.getContractFactory(
    "StabilityFeeCollector"
  ))
  const stabilityFeeCollector = await upgrades.deployProxy(StabilityFeeCollector, [
    stablecoinAddress.bookKeeper,
    stablecoinAddress.systemDebtEngine,
  ])
  await stabilityFeeCollector.deployed()
  console.log(`>> Deployed at ${stabilityFeeCollector.address}`)
  const tx = await stabilityFeeCollector.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    stabilityFeeCollector: stabilityFeeCollector.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  const newData = JSON.stringify(newAddresses);
  fs.writeFile("./addresses.json", newData, err => {
    if(err) throw err;
    console.log("New address added");
  })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
