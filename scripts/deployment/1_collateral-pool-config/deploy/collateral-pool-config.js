const fs = require('fs');

const CollateralPoolConfig = artifacts.require('./main/stablecoin-core/config/CollateralPoolConfig.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {
  console.log(">> Deploying an upgradable CollateralPoolConfig contract")

  let promises = [
      deployer.deploy(CollateralPoolConfig, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/stablecoin-core/config/CollateralPoolConfig.sol');

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