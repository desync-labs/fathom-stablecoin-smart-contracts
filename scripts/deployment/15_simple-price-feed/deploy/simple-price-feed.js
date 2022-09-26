const fs = require('fs');

const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable SimplePriceFeed contract")
  let promises = [
      deployer.deploy(SimplePriceFeed, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');

  let addressesUpdate = { 
    simplePriceFeed: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};