const ProxyWalletRegistry = artifacts.require('ProxyWalletRegistry.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(ProxyWalletRegistry, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");

    await proxyAdmin.upgrade(proxyWalletRegistry.address, ProxyWalletRegistry.address, { gas: 8000000 });
}