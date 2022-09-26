const fs = require('fs');

const ProxyWalletFactory = artifacts.require('./8.17/proxy-wallet/ProxyWalletFactory.sol');

const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports =  async function(deployer) {

  console.log(">> Deploying ProxyWalletFactory contract")
  let promises = [
      deployer.deploy(ProxyWalletFactory, { gas: 4050000 }),
  ];

  await Promise.all(promises);

  const deployed = artifacts.require('./8.17/proxy-wallet/ProxyWalletFactory.sol');

  let addressesUpdate = { 
    proxyWalletFactory:deployed.address,
  };

  const newAddresses = {
    ...stablecoinAddress,  
    ...addressesUpdate
  };

  let data = JSON.stringify(newAddresses);
  fs.writeFileSync('./addresses.json', data);
};