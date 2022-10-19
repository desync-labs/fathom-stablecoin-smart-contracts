const fs = require('fs');

const GetPositions = artifacts.require('./8.17/managers/GetPositionsBot.sol');

// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
module.exports =  async function(deployer) {

  console.log(">> Deploying an upgradable GetPositionsBot contract")
  let promises = [
    deployer.deploy(GetPositions, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/managers/GetPositionsBot.sol');

  let addressesUpdate = { 
    getPositionsBot:deployed.address,
  };

  // const newAddresses = {
  //   ...stablecoinAddress,  
  //   ...addressesUpdate
  // };

  // let data = JSON.stringify(newAddresses);
  // fs.writeFileSync('./addresses.json', data);

  console.log("getPositionsBot is deployed at " + deployed.address);
};