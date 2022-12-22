const fs = require('fs');

const StabilityFeeCollector = artifacts.require('./main/stablecoin-core/StabilityFeeCollector.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable StabilityFeeCollector contract")
  let promises = [
      deployer.deploy(StabilityFeeCollector, { gaslimit : 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/stablecoin-core/StabilityFeeCollector.sol');

  let addressesUpdate = { 
    stabilityFeeCollector:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};