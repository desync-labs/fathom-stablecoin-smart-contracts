const fs = require('fs');

const GetPositionsV2Mock = artifacts.require('./8.17/stats/GetPositionsV2Mock.sol');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable GetPositionsV2Mock contract")
  let promises = [
    deployer.deploy(GetPositionsV2Mock, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stats/GetPositionsV2Mock.sol');
  console.log("getPositions is "+ deployed.address);
  let addressesUpdate = { 
    getPositionsV2Mock:deployed.address,
  };

  const newAddresses = {
    // ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./getPositionsV2Mock.json', data);
};