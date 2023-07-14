const CollateralTokenAdapter = artifacts.require('CollateralTokenAdapter.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(CollateralTokenAdapter, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

    await proxyAdmin.upgrade(collateralTokenAdapter.address, CollateralTokenAdapter.address, { gas: 8000000 });
}