const fs = require('fs');

const ShowStopper = artifacts.require('./8.17/stablecoin-core/ShowStopper.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable ShowStopper contract")
  let promises = [
      deployer.deploy(ShowStopper, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/ShowStopper.sol');

  let addressesUpdate = { 
    showStopper: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};