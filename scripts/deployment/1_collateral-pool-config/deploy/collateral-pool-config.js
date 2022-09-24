const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable CollateralPoolConfig contract")
  const CollateralPoolConfig = await ethers.getContractFactory(
    "CollateralPoolConfig",
    (
      await ethers.getSigners()
    )[0]
  )
  const collateralPoolConfig = await upgrades.deployProxy(CollateralPoolConfig, [stablecoinAddress.accessControlConfig]);
  await collateralPoolConfig.deployed()

  console.log(`>> Deployed at ${collateralPoolConfig.address}`)
  const tx = await collateralPoolConfig.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    collateralPoolConfig: collateralPoolConfig.address,
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
