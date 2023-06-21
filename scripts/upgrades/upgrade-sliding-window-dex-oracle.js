const SlidingWindowDexOracle = artifacts.require('SlidingWindowDexOracle.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(SlidingWindowDexOracle, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const slidingWindowDexOracle = await getProxy(proxyFactory, "SlidingWindowDexOracle");

    await proxyAdmin.upgrade(slidingWindowDexOracle.address, SlidingWindowDexOracle.address, { gas: 8000000 });
}