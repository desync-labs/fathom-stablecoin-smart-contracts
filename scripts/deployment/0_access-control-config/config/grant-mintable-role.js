const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const MINTER_ADDR = stablecoinAddress.flashMintModule; // <- flashMintModule gets configured as mintable role

  const AccessControlConfig = await hre.ethers.getContractFactory("AccessControlConfig");
  const accessControlConfig = await AccessControlConfig.attach(stablecoinAddress.accessControlConfig);

  console.log(">> Grant MINTABLE_ROLE")
  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), MINTER_ADDR);
  console.log("✅ Done")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});