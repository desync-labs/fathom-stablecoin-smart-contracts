const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable ShowStopper contract")
  const ShowStopper = (await ethers.getContractFactory(
    "ShowStopper",
    (
      await ethers.getSigners()
    )[0]
  ))
  const showStopper = await upgrades.deployProxy(ShowStopper, [stablecoinAddress.bookKeeper])
  await showStopper.deployed()
  console.log(`>> Deployed at ${showStopper.address}`)
  const tx = await showStopper.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    showStopper: showStopper.address,
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
