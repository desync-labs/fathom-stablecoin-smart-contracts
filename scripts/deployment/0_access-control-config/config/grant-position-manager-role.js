const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const POSITION_MANAGER_ADDR = stablecoinAddress.positionManager;

  const AccessControlConfig = await hre.ethers.getContractFactory("AccessControlConfig");
  const accessControlConfig = await AccessControlConfig.attach(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant POSITION_MANAGER_ROLE address: ${POSITION_MANAGER_ADDR}`)
  await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), POSITION_MANAGER_ADDR);
  console.log("✅ Done")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});