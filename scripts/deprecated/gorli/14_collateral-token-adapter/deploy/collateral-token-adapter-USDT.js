const fs = require('fs');
require("dotenv").config();

const { ethers, upgrades } = require("hardhat");

const { BigNumber } = require("ethers");

const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("USDT-STABLE")


require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;
const USDTAdd = process.env.USDT_ADDRESS;
const FTHMAdd = process.env.FTHM_ADDRESS;


const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const deployerAddress =  "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
  const devAddress =  "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

  console.log(">> Deploying an upgradable CollateralTokenAdapter-USDT contract")
  const CollateralTokenAdapter = (await ethers.getContractFactory(
    "CollateralTokenAdapter",
    (
      await ethers.getSigners()
    )[0]
  ))

  const collateralTokenAdapter = await upgrades.deployProxy(CollateralTokenAdapter, [
    stablecoinAddress.bookKeeper,
    COLLATERAL_POOL_ID,
    USDTAdd,             //COLLATERAL_TOKEN_ADDR
    stablecoinAddress.fathomToken,  //Reward token addr
    stablecoinAddress.fairLaunch,
    1,  // Pool ID
    stablecoinAddress.shield,   //  deployerAddress as sheild
    deployerAddress,                 // deployer as TIME_LOCK
    BigNumber.from(1000),                   //TREASURY_FEE_BPS 1000
    devAddress,                 // deployer asTREASURY_ACCOUNT
    stablecoinAddress.positionManager,
  ])
  
  await collateralTokenAdapter.deployed()
  console.log(`>> Deployed at ${collateralTokenAdapter.address}`)
  const tx = await collateralTokenAdapter.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    collateralTokenAdapterUSDT: collateralTokenAdapter.address,
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
