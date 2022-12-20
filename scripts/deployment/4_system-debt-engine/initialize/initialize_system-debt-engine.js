const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const SystemDebtEngine = artifacts.require('./main/stablecoin-core/SystemDebtEngine.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing SystemDebtEngine")

  const systemDebtEngine = await SystemDebtEngine.at(stablecoinAddress.systemDebtEngine);


  await systemDebtEngine.initialize(
    stablecoinAddress.bookKeeper
  )

};