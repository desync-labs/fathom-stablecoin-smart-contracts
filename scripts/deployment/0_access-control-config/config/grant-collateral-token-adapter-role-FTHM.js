const fs = require('fs');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {
  const ADAPTER_ADDR = "0x86B2E78555fAEA58A522e72193935153D1bBF2Cc";

  const accessControlConfig = await AccessControlConfig.at("0x93645Ef8A2d43E415aF92621d3b18f2e5E6e786D");

  console.log(`>> Grant ADAPTER_ROLE address: ${ADAPTER_ADDR}`)

  await accessControlConfig.grantRole(await accessControlConfig.ADAPTER_ROLE(), ADAPTER_ADDR, { gasLimit: 1000000 })
  console.log("✅ Done")
};