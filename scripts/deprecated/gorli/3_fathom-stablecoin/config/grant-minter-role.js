const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

async function main() {

  const FATHOM_STABLECOIN_ADDR = stablecoinAddress.fathomStablecoin
  const STABLECOIN_ADAPTER_ADDR = stablecoinAddress.stablecoinAdapter

  const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
  const fathomStablecoin = await FathomStablecoin.attach(FATHOM_STABLECOIN_ADDR);

  console.log(`>> Grant MINTER_ROLE address: ${STABLECOIN_ADAPTER_ADDR}`)
  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), STABLECOIN_ADAPTER_ADDR);
  console.log("✅ Done")

}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});