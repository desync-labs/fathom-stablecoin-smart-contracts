const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

// const rawdata = fs.readFileSync('./addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  // const DEX_FACTORY_ADDR = "" //<- please fill in after deploying a DEX smart contract
  const DEX_FACTORY_ADDR = "0xb9AdA6B44E4CFF8FE00443Fadf8ad006CfCc2d10" // <-for mock deployment
  const WXDC_ADDR = "0xce75A95160D96F5388437993aB5825F322426E04";
  const USDT_ADDR = "0x0D2B0406bc8400E61f7507bDed415c98E54A8b11";

  console.log(">> Deploying an upgradable DexPriceOracle contract")
  const DexPriceOracle = (await ethers.getContractFactory(
    "DexPriceOracle",
    (
      await ethers.getSigners()
    )[0]
  ))
  const dexPriceOracle = await upgrades.deployProxy(DexPriceOracle, [DEX_FACTORY_ADDR])
  await dexPriceOracle.deployed()
  console.log(`>> Deployed at ${dexPriceOracle.address}`)
  const tx = await dexPriceOracle.deployTransaction.wait()
  console.log(`>> Deploy block ${tx.blockNumber}`)
 
  const Price = await dexPriceOracle.callStatic.getPrice(WXDC_ADDR, USDT_ADDR);
  console.log(Price);
  console.log("Price of WXDC in DEX is " + Price);
  // let addressesUpdate = { 
  //   dexPriceOracle: dexPriceOracle.address,
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
