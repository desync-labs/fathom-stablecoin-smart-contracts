const StableSwapModuleWrapper = artifacts.require('StableSwapModuleWrapper.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(StableSwapModuleWrapper, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const stableSwapModuleWrapper = await getProxy(proxyFactory, "StableSwapModuleWrapper")

    await proxyAdmin.upgrade(stableSwapModuleWrapper.address, StableSwapModuleWrapper.address, { gas: 8000000 });
}