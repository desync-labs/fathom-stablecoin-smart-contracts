const fs = require('fs');

const USDT = artifacts.require('./8.17/mocks/USDT.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

module.exports =  async function(deployer) {

  console.log(">> Deploying a USDT contract")
  let promises = [
      deployer.deploy(USDT, "USDT", "USDT", { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/mocks/USDT.sol');

  let addressesUpdate = { 
    USDT: deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};