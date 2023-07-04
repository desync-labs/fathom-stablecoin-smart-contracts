const CollateralPoolConfig = artifacts.require('CollateralPoolConfig.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(CollateralPoolConfig, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");

    await proxyAdmin.upgrade(collateralPoolConfig.address, CollateralPoolConfig.address, { gas: 8000000 });
}