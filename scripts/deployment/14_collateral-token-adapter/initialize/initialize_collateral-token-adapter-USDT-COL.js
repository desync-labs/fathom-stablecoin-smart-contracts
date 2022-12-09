const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const COLLATERAL_POOL_ID = formatBytes32String("US+COL")

require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;
const USDTAdd = process.env.USDT_ADDRESS;
const FTHMAdd = process.env.FTHM_ADDRESS;
const CollateralTokenAdapter = artifacts.require('./8.17/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapter.sol');

//for testnet
// const deployerAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
// const devAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

//for ganache
const deployerAddress = accounts[0];
const devAddress = accounts[0];

module.exports =  async function(deployer) {
  console.log(">> Initializing collateralTokenAdapterUSDT");

  const collateralTokenAdapter = await CollateralTokenAdapter.at(stablecoinAddress.collateralTokenAdapterUSDTCOL);

  await collateralTokenAdapter.initialize(
    stablecoinAddress.bookKeeper,
    COLLATERAL_POOL_ID,
    USDTAdd,             //COLLATERAL_TOKEN_ADDR
    FTHMAdd,  //Reward token addr
    stablecoinAddress.fairLaunch,
    1,  // Pool ID
    stablecoinAddress.shield,   //  deployerAddress as sheild
    deployerAddress,                 // deployer as TIME_LOCK
    BigNumber.from(1000),                   //TREASURY_FEE_BPS 1000
    devAddress,                 // deployer asTREASURY_ACCOUNT
    stablecoinAddress.positionManager, { gasLimit: 3000000 }
  );
};