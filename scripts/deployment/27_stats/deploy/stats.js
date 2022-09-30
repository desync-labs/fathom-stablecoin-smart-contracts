const fs = require('fs');

const FathomStats = artifacts.require('./8.17/stats/FathomStats.sol');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable FathomStats contract")
  let promises = [
    deployer.deploy(FathomStats, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stats/FathomStats.sol');
  console.log("FathomStatsAddress is " + deployed.address);
};