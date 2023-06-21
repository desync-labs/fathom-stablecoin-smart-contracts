const DexPriceOracle = artifacts.require('DexPriceOracle.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(DexPriceOracle, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const dexPriceOracle = await getProxy(proxyFactory, "DexPriceOracle");

    await proxyAdmin.upgrade(dexPriceOracle.address, DexPriceOracle.address, { gas: 8000000 });
}