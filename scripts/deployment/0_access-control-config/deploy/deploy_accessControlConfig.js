const fs = require('fs');

const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable AccessControlConfig contract")
  let promises = [
      deployer.deploy(AccessControlConfig, { gas: 3050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');

  let addressesUpdate = { 
    accessControlConfig:deployed.address,
  };

  let data = JSON.stringify(addressesUpdate);
  fs.writeFileSync('./addresses.json', data);
};