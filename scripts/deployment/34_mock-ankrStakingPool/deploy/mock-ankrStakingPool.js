const fs = require('fs');

const MockXDCStakingPool = artifacts.require('./contracts/tests/mocks/MockXDCStakingPool.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable GetPositions contract")
  let promises = [
    deployer.deploy(MockXDCStakingPool, stablecoinAddress.mockaXDCc, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./contracts/tests/mocks/MockXDCStakingPool.sol');
  console.log("MockXDCStakingPool is "+ deployed.address);
  let addressesUpdate = { 
    mockXDCStakingPool : deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};