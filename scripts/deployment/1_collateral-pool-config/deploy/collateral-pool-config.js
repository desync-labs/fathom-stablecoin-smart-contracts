const fs = require('fs');

const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {
  console.log(">> Deploying an upgradable CollateralPoolConfig contract")

  let promises = [
      deployer.deploy(CollateralPoolConfig, { gas: 3050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');

  let addressesUpdate = { 
    collateralPoolConfig:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};