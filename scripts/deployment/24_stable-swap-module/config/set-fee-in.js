const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const StableSwapModule = artifacts.require('./main/stablecoin-core/StableSwapModule.sol');
const { BigNumber } = require("ethers");


const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)


module.exports =  async function(deployer) {
  const FEE_IN = WeiPerWad.mul(2).div(1000); // [wad = 100%]


  const stableSwapModule = await StableSwapModule.at(stablecoinAddress.stableSwapModule);

  console.log(`>> setFeeIn to ${FEE_IN}`)
  await stableSwapModule.setFeeIn(FEE_IN, { gasLimit: 1000000 })
  console.log("✅ Done")
};