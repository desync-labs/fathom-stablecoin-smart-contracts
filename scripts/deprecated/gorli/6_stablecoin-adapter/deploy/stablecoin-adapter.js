const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable StablecoinAdapter contract")
  const StablecoinAdapter = (await ethers.getContractFactory(
    "StablecoinAdapter"
  ))
  const stablecoinAdapter = await upgrades.deployProxy(StablecoinAdapter, [
    stablecoinAddress.bookKeeper,
    stablecoinAddress.fathomStablecoin,
  ])
  await stablecoinAdapter.deployed()
  console.log(`>> Deployed at ${stablecoinAdapter.address}`)
  const tx = await stablecoinAdapter.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    stablecoinAdapter: stablecoinAdapter.address,
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
