const fs = require('fs');

const SimplePriceFeed = artifacts.require('./tests/SimplePriceFeed.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable SimplePriceFeedUSDT contract")
  let promises = [
      deployer.deploy(SimplePriceFeed, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./tests/SimplePriceFeed.sol');

  let addressesUpdate = { 
    simplePriceFeedUSDT:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};