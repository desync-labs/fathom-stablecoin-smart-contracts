const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

  const signers = await ethers.getSigners()
  const deployerAddress = signers[0].address;

  const GOV_ROLE_ADDR = deployerAddress //Protocol Deployer

  const AccessControlConfig = await hre.ethers.getContractFactory("AccessControlConfig");
  const accessControlConfig = await AccessControlConfig.attach(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant GOV_ROLE address: ${GOV_ROLE_ADDR}`)
  await accessControlConfig.grantRole(await accessControlConfig.GOV_ROLE(), GOV_ROLE_ADDR)
  console.log("✅ Done")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});