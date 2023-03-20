const { getProxy } = require("../../common/proxies");

const Vault = artifacts.require('Vault.sol');

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

    const promises = [
        collateralTokenAdapter.setVault(Vault.address),
    ];

    await Promise.all(promises);
}