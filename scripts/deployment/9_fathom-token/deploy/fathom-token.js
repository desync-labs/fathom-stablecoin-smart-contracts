const fs = require('fs');

const FathomToken = artifacts.require('./tests/FathomToken.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an FathomToken contract")
  let promises = [
      deployer.deploy(FathomToken, 88, 89, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./tests/FathomToken.sol');

  let addressesUpdate = { 
    fathomToken:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};