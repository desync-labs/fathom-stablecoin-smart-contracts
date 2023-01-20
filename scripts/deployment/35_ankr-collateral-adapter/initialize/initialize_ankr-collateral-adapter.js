const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { formatBytes32String } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const COLLATERAL_POOL_ID = formatBytes32String("XDC")

const AnkrCollateralAdapter = artifacts.require('./main/stablecoin-core/adapters/FarmableTokenAdapter/AnkrCollateralAdapter.sol');

//for testnet
// const deployerAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
// const devAddress = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

//for ganache
const deployerAddress = accounts[0];
const devAddress = accounts[0];


module.exports =  async function(deployer) {
  console.log(">> Initializing ankrCollateralAdapter")

  const ankrCollateralAdapter = await AnkrCollateralAdapter.at(stablecoinAddress.ankrCollateralAdapter);
  
  await ankrCollateralAdapter.initialize(
    stablecoinAddress.bookKeeper,
    COLLATERAL_POOL_ID,
    stablecoinAddress.mockXDCStakingPool,
    stablecoinAddress.mockaXDCc,
    stablecoinAddress.positionManager
    , { gasLimit: 5000000 }
    )
};