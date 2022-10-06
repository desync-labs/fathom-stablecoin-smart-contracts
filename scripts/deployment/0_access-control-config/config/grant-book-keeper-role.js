const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');

module.exports = async function(deployer) {

  const BOOK_KEEPER_ADDR = stablecoinAddress.bookKeeper

  const accessControlConfig = await AccessControlConfig.at(stablecoinAddress.accessControlConfig);

  console.log(`>> Grant BOOK_KEEPER_ROLE address: ${BOOK_KEEPER_ADDR}`)

  await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), BOOK_KEEPER_ADDR)
  console.log("✅ Done")
};