const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const FathomStablecoin = artifacts.require('./8.17/stablecoin-core/FathomStablecoin.sol');

const STABLECOIN_ADAPTER_ADDR = stablecoinAddress.stablecoinAdapter
module.exports =  async function(deployer) {
  console.log(`>> Grant MINTER_ROLE address: ${STABLECOIN_ADAPTER_ADDR}`)

  const fathomStablecoin = await FathomStablecoin.at(stablecoinAddress.fathomStablecoin);

  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), STABLECOIN_ADAPTER_ADDR, { gasLimit: 1000000 });
  console.log("✅ Done")

};