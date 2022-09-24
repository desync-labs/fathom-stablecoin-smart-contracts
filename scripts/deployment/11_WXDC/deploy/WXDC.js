const fs = require('fs');

const { ethers } = require("hardhat");

const { parseEther } = require("ethers/lib/utils");

const FATHOM_PER_BLOCK = parseEther("100");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const signers = await ethers.getSigners()
  const AliceAddress = signers[1].address;
  const BobAddress = signers[2].address;
  

  console.log(">> Deploying an not upgradable WXDC contract")

  const BEP20 = await hre.ethers.getContractFactory("BEP20");
  const WXDC = await BEP20.deploy("WXDC", "WXDC");
  await WXDC.deployed();
  await WXDC.mint(await AliceAddress, parseEther("1000000"))
  await WXDC.mint(await BobAddress, parseEther("1000000"))

  console.log(`>> Deployed at ${WXDC.address}`)
  const tx = await WXDC.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    WXDC: WXDC.address,
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
