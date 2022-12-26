const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable PositionManager contract")
  const PositionManager = (await ethers.getContractFactory(
    "PositionManager"
  ))
  const positionManager = await upgrades.deployProxy(PositionManager, [
    stablecoinAddress.bookKeeper,
    stablecoinAddress.showStopper
  ])
  await positionManager.deployed()
  console.log(`>> Deployed at ${positionManager.address}`)
  const tx = await positionManager.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    positionManager: positionManager.address,
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
