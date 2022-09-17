const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const AUTH_TOKEN_ADAPTER_ADDR = stablecoinAddress.authTokenAdapter;
  const STABLECOIN_ADAPTER_ADDR = stablecoinAddress.stablecoinAdapter;
  const SYSTEM_DEBT_ENGINE_ADDR = stablecoinAddress.systemDebtEngine;

  console.log(">> Deploying an upgradable StableSwapModule contract")
  const StableSwapModule = (await ethers.getContractFactory(
    "StableSwapModule",
    (
      await ethers.getSigners()
    )[0]
  ))
  const stableSwapModule = await upgrades.deployProxy(StableSwapModule, [
    AUTH_TOKEN_ADAPTER_ADDR,
    STABLECOIN_ADAPTER_ADDR,
    SYSTEM_DEBT_ENGINE_ADDR,
  ])
  await stableSwapModule.deployed()
  console.log(`>> Deployed at ${stableSwapModule.address}`)
  const tx = await stableSwapModule.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    stableSwapModule: stableSwapModule.address,
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
