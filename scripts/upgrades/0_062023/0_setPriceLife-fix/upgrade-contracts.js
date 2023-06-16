const DelayFathomOraclePriceFeed = artifacts.require('DelayFathomOraclePriceFeed.sol');
const CentralizedOraclePriceFeed = artifacts.require('CentralizedOraclePriceFeed.sol');

const proxyAdminAddress = "0x0000000000000000000000000000000000000000"
const delayFathomOraclePriceFeedAddress = "0x0000000000000000000000000000000000000000"
const centralizedOraclePriceFeedAddress = "0x0000000000000000000000000000000000000000"

module.exports =  async function(deployer) { 
    let promises = [
        deployer.deploy(DelayFathomOraclePriceFeed, { gas: 7050000 }),
        deployer.deploy(CentralizedOraclePriceFeed, { gas: 7050000 })
    ];
  
    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", proxyAdminAddress);

    await proxyAdmin.upgrade(delayFathomOraclePriceFeedAddress, DelayFathomOraclePriceFeed.address, { gas: 8000000 });
    await proxyAdmin.upgrade(centralizedOraclePriceFeedAddress, CentralizedOraclePriceFeed.address, { gas: 8000000 });
}