const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log(">> Deploying an upgradable AccessControlConfig contract")
  const Box = await ethers.getContractFactory("AccessControlConfig");
  const AccessControlConfig = await ethers.getContractFactory(
    "AccessControlConfig",
    (
      await ethers.getSigners()
    )[0]
  )
  const accessControlConfig = await upgrades.deployProxy(AccessControlConfig);
  await accessControlConfig.deployed()

  console.log(`>> Deployed at ${accessControlConfig.address}`)
  const tx = await accessControlConfig.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addresses = { 
    accessControlConfig: accessControlConfig.address,
  };
  
  let data = JSON.stringify(addresses);
  fs.writeFileSync('./addresses.json', data);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
