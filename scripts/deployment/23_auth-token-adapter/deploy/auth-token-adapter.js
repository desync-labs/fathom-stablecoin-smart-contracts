const fs = require('fs');

const AuthTokenAdapter = artifacts.require('./8.17/stablecoin-core/adapters/AuthTokenAdapter.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable AuthTokenAdapter contract")
  let promises = [
    deployer.deploy(AuthTokenAdapter, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/adapters/AuthTokenAdapter.sol');

  let addressesUpdate = { 
    authTokenAdapter:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};