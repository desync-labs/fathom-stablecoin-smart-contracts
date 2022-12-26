const fs = require('fs');

const { BigNumber } = require("ethers");

const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)


const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const TOTAL_DEBT_CEILING = WeiPerRad.mul(200003008325123) // [RAD]

  const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
  const bookKeeper = await BookKeeper.attach(stablecoinAddress.bookKeeper);

  console.log(">> set TOTAL_DEBT_SHARE")
  await bookKeeper.setTotalDebtCeiling(TOTAL_DEBT_CEILING)
  console.log("✅ Done")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});