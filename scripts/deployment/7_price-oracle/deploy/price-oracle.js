const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  console.log(">> Deploying an upgradable PriceOracle contract")
  const PriceOracle = (await ethers.getContractFactory(
    "PriceOracle",
    (
      await ethers.getSigners()
    )[0]
  ))
  const priceOracle = await upgrades.deployProxy(PriceOracle, [stablecoinAddress.bookKeeper])
  await priceOracle.deployed()
  console.log(`>> Deployed at ${priceOracle.address}`)
  const tx = await priceOracle.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    priceOracle: priceOracle.address,
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
