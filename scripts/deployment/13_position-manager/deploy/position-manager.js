const fs = require('fs');

const PositionManager = artifacts.require('./8.17/managers/PositionManager.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable PositionManager contract")
  let promises = [
      deployer.deploy(PositionManager, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/managers/PositionManager.sol');

  let addressesUpdate = { 
    positionManager: ("xdc"+(deployed.address).slice(2)),
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};