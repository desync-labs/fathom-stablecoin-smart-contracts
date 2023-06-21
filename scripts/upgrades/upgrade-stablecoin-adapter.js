const StablecoinAdapter = artifacts.require('StablecoinAdapter.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(StablecoinAdapter, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");

    await proxyAdmin.upgrade(stablecoinAdapter.address, StablecoinAdapter.address, { gas: 8000000 });
}