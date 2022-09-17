const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const { BigNumber } = require("ethers");

const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const signers = await ethers.getSigners()
  const deployerAddress = signers[0].address;
  const devAddress = signers[3].address;

  console.log(">> Deploying an upgradable IbTokenAdapter contract")
  const IbTokenAdapter = (await ethers.getContractFactory(
    "IbTokenAdapter",
    (
      await ethers.getSigners()
    )[0]
  ))

  const ibTokenAdapter = await upgrades.deployProxy(IbTokenAdapter, [
    stablecoinAddress.bookKeeper,
    COLLATERAL_POOL_ID,
    stablecoinAddress.WXDC,             //COLLATERAL_TOKEN_ADDR
    stablecoinAddress.fathomToken,  //Reward token addr
    stablecoinAddress.fairLaunch,
    0,  // Pool ID
    stablecoinAddress.shield,   //  deployerAddress as sheild
    deployerAddress,                 // deployer as TIME_LOCK
    BigNumber.from(1000),                   //TREASURY_FEE_BPS 1000
    devAddress,                 // deployer asTREASURY_ACCOUNT
    stablecoinAddress.positionManager,
  ])
  
  await ibTokenAdapter.deployed()
  console.log(`>> Deployed at ${ibTokenAdapter.address}`)
  const tx = await ibTokenAdapter.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    ibTokenAdapter: ibTokenAdapter.address,
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
