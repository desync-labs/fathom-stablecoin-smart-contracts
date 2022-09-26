const fs = require('fs');

const StablecoinAdapter = artifacts.require('./8.17/stablecoin-core/adapters/StablecoinAdapter.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable StablecoinAdapter contract")
  let promises = [
      deployer.deploy(StablecoinAdapter, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/adapters/StablecoinAdapter.sol');

  let addressesUpdate = { 
    stablecoinAdapter: ("xdc"+(deployed.address).slice(2)),
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};