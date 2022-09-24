const fs = require('fs');

const { ethers } = require("hardhat");

const { parseEther } = require("ethers/lib/utils");

const FATHOM_PER_BLOCK = parseEther("100");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  
  const signers = await ethers.getSigners()
  const devAddress = signers[3].address;
  console.log(">> Deploying an not upgradable FairLaunch contract")
  const FairLaunch = await hre.ethers.getContractFactory("FairLaunch")
  const fairLaunch = await FairLaunch.deploy(stablecoinAddress.fathomToken, devAddress, FATHOM_PER_BLOCK, 0, 0, 0)
  await fairLaunch.deployed()
  console.log(`>> Deployed at ${fairLaunch.address}`)
  const tx = await fairLaunch.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    fairLaunch: fairLaunch.address,
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
