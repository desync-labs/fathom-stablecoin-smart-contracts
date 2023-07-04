const BookKeeper = artifacts.require('BookKeeper.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(BookKeeper, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");

    await proxyAdmin.upgrade(bookKeeper.address, BookKeeper.address, { gas: 8000000 });
}