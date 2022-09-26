const fs = require('fs');

const StableSwapModule = artifacts.require('./8.17/stablecoin-core/StableSwapModule.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable StableSwapModule contract")
  let promises = [
    deployer.deploy(StableSwapModule, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/StableSwapModule.sol');

  let addressesUpdate = { 
    stableSwapModule: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};