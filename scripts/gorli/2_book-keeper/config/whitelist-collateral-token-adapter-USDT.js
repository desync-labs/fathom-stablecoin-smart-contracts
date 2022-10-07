const fs = require('fs');

const { BigNumber } = require("ethers");

const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)


const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
  const bookKeeper = await BookKeeper.attach(stablecoinAddress.bookKeeper);

  console.log(">> whitelist-collateral-token-adapterUSDT")
  await bookKeeper.whitelist(stablecoinAddress.collateralTokenAdapterUSDT)
  console.log("✅ Done")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});