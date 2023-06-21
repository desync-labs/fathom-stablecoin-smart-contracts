const ProxyWalletFactory = artifacts.require('ProxyWalletFactory.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(ProxyWalletFactory, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");

    await proxyAdmin.upgrade(proxyWalletFactory.address, ProxyWalletFactory.address, { gas: 8000000 });
}