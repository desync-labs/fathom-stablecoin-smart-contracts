const fs = require('fs');

const GetPositionsV2 = artifacts.require('./8.17/stats/GetPositionsV2.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable GetPositionsV2 contract")
  let promises = [
    deployer.deploy(GetPositionsV2, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/stats/GetPositionsV2.sol');

  console.log(deployed.address);
  let addressesUpdate = { 
    getPositionsV2:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};