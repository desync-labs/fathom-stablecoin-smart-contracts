const fs = require('fs');

const Shield = artifacts.require('./8.17/apis/fathom/Shield.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

//for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

module.exports =  async function(deployer) {

  console.log(">> Deploying an Shield contract")
  let promises = [
      deployer.deploy(Shield, walletDeployer, stablecoinAddress.fairLaunch, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/apis/fathom/Shield.sol');

  let addressesUpdate = { 
    shield:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};