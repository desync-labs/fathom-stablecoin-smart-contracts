const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const { BigNumber } = require("ethers");

const { formatBytes32String } = require("ethers/lib/utils");
const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)
const COLLATERAL_POOL_ID = formatBytes32String("USDT-STABLE")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)   // <- 0.5
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(5000) // <- 0.5

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  console.log(">> Initializing collateral-pool-config with USDT");
  const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
  const collateralPoolConfig = await CollateralPoolConfig.attach(stablecoinAddress.collateralPoolConfig);

  const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
  const bookKeeper = await BookKeeper.attach(stablecoinAddress.bookKeeper);
 
  const SimplePriceFeed = await hre.ethers.getContractFactory("SimplePriceFeed");
  const simplePriceFeedUSDT = await SimplePriceFeed.attach(stablecoinAddress.simplePriceFeedUSDT);

  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.attach(stablecoinAddress.priceOracle);

  

  await simplePriceFeedUSDT.setPrice(WeiPerWad.mul(1));
  await priceOracle.setPrice(COLLATERAL_POOL_ID);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});