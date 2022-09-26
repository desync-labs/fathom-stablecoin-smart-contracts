const fs = require('fs');

const SystemDebtEngine = artifacts.require('./8.17/stablecoin-core/SystemDebtEngine.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable SystemDebtEngine contract")
  let promises = [
      deployer.deploy(SystemDebtEngine, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/SystemDebtEngine.sol');

  let addressesUpdate = { 
    systemDebtEngine:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};