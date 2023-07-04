const DelayFathomOraclePriceFeed = artifacts.require('DelayFathomOraclePriceFeed.sol');
const CentralizedOraclePriceFeed = artifacts.require('CentralizedOraclePriceFeed.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(DelayFathomOraclePriceFeed, { gas: 7050000 }),
        deployer.deploy(CentralizedOraclePriceFeed, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const delayFathomOraclePriceFeed = await getProxy(proxyFactory, "DelayFathomOraclePriceFeed");
    const centralizedOraclePriceFeed = await getProxy(proxyFactory, "CentralizedOraclePriceFeed");

    await proxyAdmin.upgrade(delayFathomOraclePriceFeed.address, DelayFathomOraclePriceFeed.address, { gas: 8000000 });
    await proxyAdmin.upgrade(centralizedOraclePriceFeed.address, CentralizedOraclePriceFeed.address, { gas: 8000000 });
}
