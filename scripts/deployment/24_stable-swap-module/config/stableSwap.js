const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const StableSwapModule = artifacts.require('./8.17/stablecoin-core/StableSwapModule.sol');
const { BigNumber } = require("ethers");

const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)

module.exports =  async function(deployer) {
  const FEE_OUT = WeiPerWad.mul(2).div(1000); // [wad = 100%]

  const stableSwapModule = await StableSwapModule.at("0x14AB8F18FbE3e9a266C678978b319a90852da7f4");

  await stableSwapModule.swapTokenToStablecoin();
  console.log("✅ Swapped")
};