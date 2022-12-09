const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses_ApothemV1.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const COLLATERAL_POOL_ID = formatBytes32String("FTHM")

require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;
const USDTAdd = process.env.USDT_ADDRESS;
const FTHMAdd = process.env.FTHM_ADDRESS;


const CollateralTokenAdapter = artifacts.require('./8.17/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapter.sol');

//for testnet
const deployerAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
const devAddress =      "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

module.exports =  async function(deployer) {
  console.log(">> Initializing collateralTokenAdapterFTHM");

  const collateralTokenAdapter = await CollateralTokenAdapter.at("0x86B2E78555fAEA58A522e72193935153D1bBF2Cc");
  // const collateralTokenAdapter = await artifacts.initializeInterfaceAt("ICollateralTokenAdapter", "CollateralTokenAdapter");

  await collateralTokenAdapter.initialize(
    stablecoinAddress.bookKeeper,
    COLLATERAL_POOL_ID,
    "0x4c52500DdC18EE0C6CB6155961347076E43ABb99",             //COLLATERAL_TOKEN_ADDR
    FTHMAdd,  //Reward token addr
    stablecoinAddress.fairLaunch,
    4,  // Pool ID
    stablecoinAddress.shield,   //  deployerAddress as sheild
    deployerAddress,                 // deployer as TIME_LOCK
    BigNumber.from(1000),                   //TREASURY_FEE_BPS 1000
    devAddress,                 // deployer asTREASURY_ACCOUNT
    stablecoinAddress.positionManager
    , { gasLimit: 5000000 }
  );

  // await collateralTokenAdapter.initialize(
  //   "0x3518B6ac30B3B4B886E1639ada852795165b2596",
  //   COLLATERAL_POOL_ID,
  //   "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0",             //COLLATERAL_TOKEN_ADDR  <- new FTHM
  //   "0x3Ac56D4ff6D2BbDFcfD0d90621041925a80F812e",  //Reward token addr
  //   "0x4658A7AD6fC8c798e0B48d94698E83d7ebAdEb9E",
  //   2,  // Pool ID
  //   "0xf59a69039d8f29390C60d651349ed54C5AaE28Cc",   //  deployerAddress as sheild
  //   deployerAddress,                 // deployer as TIME_LOCK
  //   BigNumber.from(500).toString(),                   //TREASURY_FEE_BPS 1000
  //   devAddress,                 // deployer asTREASURY_ACCOUNT
  //   "0xC0FeEa2f3C9a6F208E75715b1BAc71f1B61ED43b", { gasLimit: 50000000 }
  // );
};