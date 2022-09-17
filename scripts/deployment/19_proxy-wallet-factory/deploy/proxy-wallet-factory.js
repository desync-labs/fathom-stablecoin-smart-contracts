const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  console.log(">> Deploying a ProxyWalletFactory contract")
  const ProxyWalletFactory = (await ethers.getContractFactory(
    "ProxyWalletFactory",
    (
      await ethers.getSigners()
    )[0]
  ))
  const proxyWalletFactory = await ProxyWalletFactory.deploy()
  await proxyWalletFactory.deployed()
  console.log(`>> Deployed at ${proxyWalletFactory.address}`)
  const tx = await proxyWalletFactory.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    proxyWalletFactory: proxyWalletFactory.address,
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
