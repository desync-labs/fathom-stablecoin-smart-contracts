const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable SystemDebtEngine contract")
  const SystemDebtEngine = (await ethers.getContractFactory(
    "SystemDebtEngine"
  ))
  const systemDebtEngine = await upgrades.deployProxy(SystemDebtEngine, [stablecoinAddress.bookKeeper])
  await systemDebtEngine.deployed()
  console.log(`>> Deployed at ${systemDebtEngine.address}`)
  const tx = await systemDebtEngine.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    systemDebtEngine: systemDebtEngine.address,
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
