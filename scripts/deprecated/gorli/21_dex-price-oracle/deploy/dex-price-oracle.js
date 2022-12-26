const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  // const DEX_FACTORY_ADDR = "" //<- please fill in after deploying a DEX smart contract
  const DEX_FACTORY_ADDR = "0x0000000000000000000000000000000000000000" // <-for mock deployment

  console.log(">> Deploying an upgradable DexPriceOracle contract")
  const DexPriceOracle = (await ethers.getContractFactory(
    "DexPriceOracle"
  ))
  const dexPriceOracle = await upgrades.deployProxy(DexPriceOracle, [DEX_FACTORY_ADDR])
  await dexPriceOracle.deployed()
  console.log(`>> Deployed at ${dexPriceOracle.address}`)
  const tx = await dexPriceOracle.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)
  let addressesUpdate = { 
    dexPriceOracle: dexPriceOracle.address,
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
