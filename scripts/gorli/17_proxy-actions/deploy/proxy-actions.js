const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  console.log(">> Deploying an FathomStablecoinProxyAction contract")
  const FathomStablecoinProxyActions = (await ethers.getContractFactory(
    "FathomStablecoinProxyActions"
  ))
  const fathomStablecoinProxyActions = await FathomStablecoinProxyActions.deploy()
  await fathomStablecoinProxyActions.deployed()
  console.log(`>> Deployed at ${fathomStablecoinProxyActions.address}`)
  const tx = await fathomStablecoinProxyActions.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    fathomStablecoinProxyActions: fathomStablecoinProxyActions.address,
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
