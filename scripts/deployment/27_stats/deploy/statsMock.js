const fs = require('fs');
const { formatBytes32String } = require("ethers/lib/utils");

const { ethers, upgrades } = require("hardhat");
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const rawdata = fs.readFileSync('./addresses_gorli.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  console.log(">> Deploying an upgradable stats contract")
  const FathomStatsMock = (await ethers.getContractFactory(
    "FathomStatsMock",
    (
      await ethers.getSigners()
    )[0]
  ))
  const fathomStats = await upgrades.deployProxy(FathomStatsMock);
  await fathomStats.deployed()
  console.log(`>> Deployed at ${fathomStats.address}`)
  const tx = await fathomStats.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  const info = await fathomStats.getFathomInfo();
  console.log("fathomInfo is" + info);

  let addressesUpdate = { 
    fathomStatsMock: fathomStats.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  const newData = JSON.stringify(newAddresses);
  fs.writeFile("./addresses_gorli.json", newData, err => {
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
