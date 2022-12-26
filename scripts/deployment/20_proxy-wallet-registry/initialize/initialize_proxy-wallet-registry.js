const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const ProxyWalletRegistry = artifacts.require('./main/proxy-wallet/ProxyWalletRegistry.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing ProxyWalletRegistry")

  const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);


  await proxyWalletRegistry.initialize(
    stablecoinAddress.proxyWalletFactory
  )

};