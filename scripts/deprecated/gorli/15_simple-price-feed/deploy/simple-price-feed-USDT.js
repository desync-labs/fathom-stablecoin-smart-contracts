const fs = require('fs');
const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  console.log(">> Deploying an upgradable SimplePriceFeed contract")
  const SimplePriceFeed = (await ethers.getContractFactory(
    "SimplePriceFeed"
  ))
  const simplePriceFeed = await upgrades.deployProxy(SimplePriceFeed, [stablecoinAddress.accessControlConfig])
  await simplePriceFeed.deployed()
  console.log(`>> Deployed at ${simplePriceFeed.address}`)
  const tx = await simplePriceFeed.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    simplePriceFeedUSDT: simplePriceFeed.address,
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
