const fs = require('fs');

const LiquidationEngine = artifacts.require('./main/stablecoin-core/LiquidationEngine.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable LiquidationEngine contract")
  let promises = [
      deployer.deploy(LiquidationEngine, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/stablecoin-core/LiquidationEngine.sol');

  let addressesUpdate = { 
    liquidationEngine:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};