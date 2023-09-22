const ShowStopper = artifacts.require('ShowStopper.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(ShowStopper, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const showStopper = await getProxy(proxyFactory, "ShowStopper");

    await proxyAdmin.upgrade(showStopper.address, ShowStopper.address, { gas: 8000000 });
}