const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
// require("dotenv").config();
// const WXDCAdd = process.env.WXDC_ADDRESS;

// const rawdata = fs.readFileSync('../../../../addresses_ApothemV1.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");

const FathomStats = artifacts.require('./8.17/stats/FathomStats.sol');
const COLLATERAL_POOL_ID_FTHM = formatBytes32String("FTHM")


module.exports =  async function(deployer) {
  console.log(">> Initializing FathomStats")

  const fathomStats = await FathomStats.at(stablecoinAddress.fathomStats);

  await fathomStats.initialize(
    stablecoinAddress.bookKeeper,  //bookKeeper
    stablecoinAddress.fairLaunch,                  //FairLaunch
    // WXDCAdd, //WXDC
    stablecoinAddress.WXDC,
    stablecoinAddress.USDT, // USDT
    stablecoinAddress.fathomStablecoin, //FXD
    stablecoinAddress.dexPriceOracle, //dEXPriceOracle
    COLLATERAL_POOL_ID_FTHM, //bytes32 of WXDC string
    stablecoinAddress.collateralPoolConfig, //CollateralPoolConfig
    stablecoinAddress.fathomToken  //FathomToken
    )
};