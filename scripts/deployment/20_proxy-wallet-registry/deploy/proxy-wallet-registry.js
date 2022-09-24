const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  console.log(">> Deploying an upgradable ProxyWalletRegistry contract")
  const ProxyWalletRegistry = (await ethers.getContractFactory(
    "ProxyWalletRegistry",
    (
      await ethers.getSigners()
    )[0]
  ))
  const proxyWalletRegistry = await upgrades.deployProxy(ProxyWalletRegistry, [stablecoinAddress.proxyWalletFactory])
  await proxyWalletRegistry.deployed()
  console.log(`>> Deployed at ${proxyWalletRegistry.address}`)
  const tx = await proxyWalletRegistry.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    proxyWalletRegistry: proxyWalletRegistry.address,
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
