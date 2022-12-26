const fs = require('fs');

const FathomStats = artifacts.require('./main/stats/FathomStats.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable FathomStats contract")
  let promises = [
    deployer.deploy(FathomStats, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/stats/FathomStats.sol');
  console.log("FathomStatsAddress is " + deployed.address);

  let addressesUpdate = { 
    fathomStats:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};