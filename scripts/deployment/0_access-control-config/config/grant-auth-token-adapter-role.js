const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

async function main() {

  const ADAPTER_ADDR = stablecoinAddress.authTokenAdapter;

  const AccessControlConfig = await hre.ethers.getContractFactory("AccessControlConfig");
  const accessControlConfig = await AccessControlConfig.attach(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant ADAPTER_ROLE address: ${ADAPTER_ADDR}`)

  await accessControlConfig.grantRole(await accessControlConfig.ADAPTER_ROLE(), ADAPTER_ADDR, { gasLimit: 1000000 })
  console.log("✅ Done")
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});