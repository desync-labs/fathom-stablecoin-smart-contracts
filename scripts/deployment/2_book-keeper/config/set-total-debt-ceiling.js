const fs = require('fs');

const { BigNumber } = require("ethers");

const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');

module.exports =  async function(deployer) {

  const TOTAL_DEBT_CEILING = WeiPerRad.mul(200003008325123) // [RAD]

  const bookKeeper = await BookKeeper.at(stablecoinAddress.bookKeeper);

  console.log(">> set TOTAL_DEBT_SHARE")
  await bookKeeper.setTotalDebtCeiling(TOTAL_DEBT_CEILING)
  console.log("✅ Done")

};