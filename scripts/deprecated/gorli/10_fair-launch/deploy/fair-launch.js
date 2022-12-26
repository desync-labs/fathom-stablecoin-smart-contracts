const fs = require('fs');
require("dotenv").config();
const privateKey1 = process.env.PRIVATE_KEY1;
const url = "https://goerli.infura.io/v3/d85fb151be214d8eaee85c855d9d3dab";

const { ethers } = require("hardhat");

const { parseEther } = require("ethers/lib/utils");

const FATHOM_PER_BLOCK = parseEther("100");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

async function main() {

  const devAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
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
