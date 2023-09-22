const FathomProxyActions = artifacts.require('FathomStablecoinProxyActions.sol');

const { getProxy } = require("../common/proxies");
const { ProxyFactoryAddress } = require("./common/addresses");

module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(FathomProxyActions, { gas: 7050000 }),
    ];

    await Promise.all(promises);

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const proxyActionsStorage = await getProxy(proxyFactory, "ProxyActionsStorage");

    await proxyActionsStorage.setProxyAction(FathomProxyActions.address, { gas: 1000000 });
}