const fs = require('fs');

const CollateralTokenAdapter = artifacts.require('./8.17/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapter.sol');

// const rawdata = fs.readFileSync('../../../../addresses_ApothemV1.json');
// let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable CollateralTokenAdapterFTHM contract")
  let promises = [
      deployer.deploy(CollateralTokenAdapter, { gas: 5050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapter.sol');

  // let addressesUpdate = { 
    // collateralTokenAdapterFTHM:deployed.address,
  // };
console.log("collateralTokenAdapterFTHM is " + deployed.address);
  // const newAddresses = {
  //   ...stablecoinAddress,  
  //   ...addressesUpdate
  // };

  // let data = JSON.stringify(newAddresses);
  // fs.writeFileSync('./addresses.json', data);
};