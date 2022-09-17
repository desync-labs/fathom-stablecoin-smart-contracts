const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const { formatBytes32String } = require("ethers/lib/utils");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const COLLATERAL_POOL_ID = formatBytes32String("USDT-STABLE")
  const TOKEN_ADDR = stablecoinAddress.USDT // <- USDT address

  console.log(">> Deploying an upgradable AuthTokenAdapter contract")
  const AuthTokenAdapter = (await ethers.getContractFactory(
    "AuthTokenAdapter",
    (
      await ethers.getSigners()
    )[0]
  ))
  const authTokenAdapter = await upgrades.deployProxy(AuthTokenAdapter, [
    stablecoinAddress.bookKeeper,
    COLLATERAL_POOL_ID,
    TOKEN_ADDR,
  ])
  await authTokenAdapter.deployed()
  console.log(`>> Deployed at ${authTokenAdapter.address}`)
  const tx = await authTokenAdapter.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)

  let addressesUpdate = { 
    authTokenAdapter: authTokenAdapter.address,
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
