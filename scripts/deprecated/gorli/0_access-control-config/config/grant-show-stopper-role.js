const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const SHOW_STOPPER_ADDR = stablecoinAddress.showStopper;

  const AccessControlConfig = await hre.ethers.getContractFactory("AccessControlConfig");
  const accessControlConfig = await AccessControlConfig.attach(stablecoinAddress.accessControlConfig);

  console.log(">> Grant SHOW_STOPPER_ROLE")
  await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), SHOW_STOPPER_ADDR);
  console.log("✅ Done")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});