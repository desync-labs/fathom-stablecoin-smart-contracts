const fs = require('fs');

const GetPositions = artifacts.require('./main/managers/GetPositions.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable GetPositions contract")
  let promises = [
    deployer.deploy(GetPositions, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./main/managers/GetPositions.sol');
  console.log("getPositions is "+ deployed.address);
  let addressesUpdate = { 
    getPositions:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};