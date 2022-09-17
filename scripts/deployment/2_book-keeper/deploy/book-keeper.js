const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable BookKeeper contract")
  const BookKeeper = (await ethers.getContractFactory(
    "BookKeeper",
    (
      await ethers.getSigners()
    )[0]
  ))
  const bookKeeper = await upgrades.deployProxy(BookKeeper, [
    stablecoinAddress.collateralPoolConfig,
    stablecoinAddress.accessControlConfig,
  ])
  await bookKeeper.deployed()
  console.log(`>> Deployed at ${bookKeeper.address}`)
  const tx = await bookKeeper.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)


  let addressesUpdate = { 
    bookKeeper: bookKeeper.address,
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
