const fs = require('fs');

const { ethers, upgrades } = require("hardhat");

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {
  const STABLE_SWAP_MODULE_ADDR = stablecoinAddress.stableSwapModule;
  const AUTH_TOKEN_ADAPTER_ADDR = stablecoinAddress.authTokenAdapter;
  const AuthTokenAdapter = await hre.ethers.getContractFactory("AuthTokenAdapter");
  const authTokenAdapter = await AuthTokenAdapter.attach(AUTH_TOKEN_ADAPTER_ADDR);
  console.log(`>> AuthTokenAdapter whitelist address: ${STABLE_SWAP_MODULE_ADDR}`)
  const tx = await authTokenAdapter.grantRole(await authTokenAdapter.WHITELISTED(), STABLE_SWAP_MODULE_ADDR)
  await tx.wait()
  console.log(`tx hash: ${tx.hash}`)
  console.log("✅ Done")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
