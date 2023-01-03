const fs = require('fs');

const AnkrCollateralAdapter = artifacts.require('./main/stablecoin-core/adapters/FarmableTokenAdapter/AnkrCollateralAdapter.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable AnkrCollateralAdapter contract")
  let promises = [
      deployer.deploy(AnkrCollateralAdapter, { gas: 5050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/stablecoin-core/adapters/FarmableTokenAdapter/AnkrCollateralAdapter.sol');

  let addressesUpdate = { 
    ankrCollateralAdapter:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};