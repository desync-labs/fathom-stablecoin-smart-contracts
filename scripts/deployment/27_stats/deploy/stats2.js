const fs = require('fs');
const { formatBytes32String } = require("ethers/lib/utils");

const { ethers, upgrades } = require("hardhat");
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

// const rawdata = fs.readFileSync('./addresses.json');
const rawdata = fs.readFileSync('./addresses_gorli.json');

let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  // console.log(">> Deploying an upgradable FathomStats contract")
  // const FathomStats = (await ethers.getContractFactory(
  //   "FathomStats"
  // ))
  // const fathomStats = await upgrades.deployProxy(FathomStats, [
  //   stablecoinAddress.bookKeeper,
  //   stablecoinAddress.fairLaunch,
  //   stablecoinAddress.WXDC,
  //   stablecoinAddress.USDT,
  //   stablecoinAddress.fathomStablecoin,
  //   stablecoinAddress.dexPriceOracle,
  //   COLLATERAL_POOL_ID,
  //   stablecoinAddress.collateralPoolConfig
  // ])
  await fathomStats.deployed()
  console.log(`>> Fathom stats Deployed at ${fathomStats.address}`)
  const tx = await fathomStats.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  const info = await fathomStats.getFathomInfo();
  console.log("fathomInfo is" + info);

  // let addressesUpdate = { 
  //   fathomStats: fathomStats.address,
  // };

  // const newAddresses = {
  //   ...stablecoinAddress,  
  //   ...addressesUpdate
  // };

  // const newData = JSON.stringify(newAddresses);
  // fs.writeFile("./addresses.json", newData, err => {
  //   if(err) throw err;
  //   console.log("New address added");
  // })



  console.log(">> Deploying an upgradable FathomStats contract")
  const GetPositionsV2 = (await ethers.getContractFactory(
    "GetPositionsV2"
  ))
  const getPositionsV2 = await upgrades.deployProxy(GetPositionsV2, 
    fathomStats.address
  )
  await getPositionsV2.deployed()
  console.log(`>> GetPositionV2 Deployed at ${getPositionsV2.address}`)
  const tx2 = await getPositionsV2.deployTransaction.wait()
  console.log(`>> Deploy block ${tx2.blockNumber}`)

  // const result2 = await getPositionsV2.getPositionWithSafetyBuffer(stablecoinAddress.positionManager, 1, 1);
  // console.log("Position Infos are"+ result2);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
