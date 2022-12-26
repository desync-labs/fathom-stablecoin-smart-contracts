const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
require("dotenv").config();
// const WXDCAdd = process.env.WXDC_ADDRESS;
// const rawdata = fs.readFileSync('../../../../addresses_ApothemV1.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const FathomStats = artifacts.require('./main/stats/FathomStats.sol');
const COLLATERAL_POOL_ID_FTHM = formatBytes32String("FTHM")

module.exports =  async function(deployer) {
  console.log(">> Initializing FathomStats")

  const fathomStats = await FathomStats.at("0x88E004Cc69A813c97e0D33B90e1C075eC4495B31");

  await fathomStats.initialize(
    stablecoinAddress.bookKeeper,  //bookKeeper
    stablecoinAddress.fairLaunch,                  //FairLaunch
    // WXDCAdd, //WXDC
    stablecoinAddress.WXDC,
    stablecoinAddress.USDT, // USDT
    stablecoinAddress.fathomStablecoin, //FXD
    "0xfbba07454DAe1D94436cC4241bf31543f426257E", //dEXPriceOracle
    COLLATERAL_POOL_ID_FTHM, //bytes32 of WXDC string
    stablecoinAddress.collateralPoolConfig, //CollateralPoolConfig
    "0x4c52500DdC18EE0C6CB6155961347076E43ABb99"  //FathomToken
    )
};