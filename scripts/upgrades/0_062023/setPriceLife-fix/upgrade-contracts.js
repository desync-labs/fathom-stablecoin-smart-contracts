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
    const delayFathomOraclePriceFeed = await artifacts.initializeInterfaceAt("DelayFathomOraclePriceFeed", delayFathomOraclePriceFeedAddress);
    const centralizedOraclePriceFeed = await artifacts.initializeInterfaceAt("CentralizedOraclePriceFeed", centralizedOraclePriceFeedAddress);

    await proxyAdmin.upgrade(delayFathomOraclePriceFeed.address, DelayFathomOraclePriceFeed.address, { gas: 8000000 })
    await proxyAdmin.upgrade(centralizedOraclePriceFeed.address, CentralizedOraclePriceFeed.address, { gas: 8000000 })

     console.log(await delayFathomOraclePriceFeed.getVersion());
}