const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable LiquidationEngine contract")
  const LiquidationEngine = (await ethers.getContractFactory(
    "LiquidationEngine",
    (
      await ethers.getSigners()
    )[0]
  ))
  const liquidationEngine = await upgrades.deployProxy(LiquidationEngine, [
    stablecoinAddress.bookKeeper,
    stablecoinAddress.systemDebtEngine,
  ])
  await liquidationEngine.deployed()
  console.log(`>> Deployed at ${liquidationEngine.address}`)
  const tx = await liquidationEngine.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    liquidationEngine: liquidationEngine.address,
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
