const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');

let stablecoinAddress = JSON.parse(rawdata);

require("dotenv").config();
const WXDCAdd = process.env.WXDC_ADDRESS;
const USDTAdd = process.env.USDT_ADDRESS;
const FTHMAdd = process.env.FTHM_ADDRESS;


const FathomToken = artifacts.require('./8.17/apis/fathom/FathomToken.sol');

module.exports = async function(deployer) {
    console.log(">> transfering fathom token's ownership to fairLaunch");
    const fathomToken = await FathomToken.at(FTHMAdd);
    await fathomToken.transferOwnership(stablecoinAddress.fairLaunch, { gasLimit: 1000000 });
};