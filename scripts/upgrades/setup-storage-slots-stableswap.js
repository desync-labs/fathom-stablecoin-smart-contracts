const StableSwapModule = artifacts.require('StableSwapModule.sol');

const { getProxy } = require("../common/proxies");
const { ProxyAdminAddress, ProxyFactoryAddress } = require("./common/addresses");
module.exports = async function (deployer) {
    let promises = [
        deployer.deploy(StableSwapModule, { gas: 7050000 })
    ];

    await Promise.all(promises);

    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", ProxyAdminAddress);
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", ProxyFactoryAddress);

    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule")

    await stableSwapModule.udpateTotalValueDeposited({ gas: 8000000 });
    await stableSwapModule.initializeFeesAfterUpgrade({ gas: 8000000 });
}