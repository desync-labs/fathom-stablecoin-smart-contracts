const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

// const rawdata = fs.readFileSync('./addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  
  // const DEX_FACTORY_ADDR = "" //<- please fill in after deploying a DEX smart contract
  const WXDC_ADDR = "0xce75A95160D96F5388437993aB5825F322426E04";
  const USDT_ADDR = "0x0D2B0406bc8400E61f7507bDed415c98E54A8b11";

  const DexPriceOracle = await hre.ethers.getContractFactory("DexPriceOracle");
  const dexPriceOracle = await DexPriceOracle.attach(
    "0x9582b403791662a0727D162e328Fe84CaCd9978D" // The deployed contract address
  )
 
  const Price = await dexPriceOracle.callStatic.getPrice(WXDC_ADDR, USDT_ADDR);
  // const price = await Price.wait();
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
