const SystemDebtEngine = artifacts.require('SystemDebtEngine.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(SystemDebtEngine, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");

    await proxyAdmin.upgrade(systemDebtEngine.address, systemDebtEngine.address, { gas: 8000000 });
}