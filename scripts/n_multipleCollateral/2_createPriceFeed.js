const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const FathomswapFactory = process.env.FATHOMSWAP_FACTORY

let rawdata = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const WETH = {
  address : addresses.WETH
}
const WXDC = {
  address : addresses.WXDC
}
const USDT = {
  address : addresses.USDT
}

async function main() {
  // Deploy Prices
  const DexPriceOracle = await hre.ethers.getContractFactory("DexPriceOracle");
  const dexPriceOracle = await DexPriceOracle.deploy(FathomswapFactory);
  await dexPriceOracle.deployed();
  console.log("dexPriceOracle deployed to :", dexPriceOracle.address);

  const FathomOraclePriceFeed = await hre.ethers.getContractFactory("FathomOraclePriceFeed");
  const WETHfathomOraclePriceFeed = await FathomOraclePriceFeed.deploy(dexPriceOracle.address, USDT.address, WETH.address);
  await WETHfathomOraclePriceFeed.deployed();
  console.log("WETHfathomOraclePriceFeed deployed to :", WETHfathomOraclePriceFeed.address);

  const WXDCfathomOraclePriceFeed = await FathomOraclePriceFeed.deploy(dexPriceOracle.address, USDT.address, WXDC.address);
  await WXDCfathomOraclePriceFeed.deployed();
  console.log("WXDCfathomOraclePriceFeed deployed to :", WXDCfathomOraclePriceFeed.address);

  let params = { 
    WETHfathomOraclePriceFeed : WETHfathomOraclePriceFeed.address,
    WXDCfathomOraclePriceFeed : WXDCfathomOraclePriceFeed.address
  };
  
  let data = JSON.stringify(params);
  fs.writeFileSync('./scripts/n_multipleCollateral/cupcakes/1_createPriceFeed.json', data);

  console.log("price feed initiated");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
