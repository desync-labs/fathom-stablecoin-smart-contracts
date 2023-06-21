const StabilityFeeCollector = artifacts.require('StabilityFeeCollector.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(StabilityFeeCollector, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");

    await proxyAdmin.upgrade(stabilityFeeCollector.address, StabilityFeeCollector.address, { gas: 8000000 });
}