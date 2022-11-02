const fs = require('fs');

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
require("dotenv").config();
const privateKey1 = process.env.GORLI_DEPLOYER;
const url = "https://goerli.infura.io/v3/d85fb151be214d8eaee85c855d9d3dab";

async function main() {

  const deployerAddress =   "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

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