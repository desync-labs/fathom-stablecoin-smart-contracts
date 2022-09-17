const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  const NAME = "Fathom USD"
  const SYMBOL = "AUSD"

  console.log(">> Deploying an upgradable FathomStablecoin contract")
  const FathomStablecoin = (await ethers.getContractFactory(
    "FathomStablecoin",
    (
      await ethers.getSigners()
    )[0]
  ))
  const fathomStablecoin = await upgrades.deployProxy(FathomStablecoin, [NAME, SYMBOL])
  await fathomStablecoin.deployed()
  console.log(`>> Deployed at ${fathomStablecoin.address}`)
  const tx = await fathomStablecoin.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    fathomStablecoin: fathomStablecoin.address,
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
