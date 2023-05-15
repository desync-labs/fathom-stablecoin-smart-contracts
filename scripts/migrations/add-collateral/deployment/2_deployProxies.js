const { getConfig, getProxyId, token } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);
    const proxyAdmin = await artifacts.initializeInterfaceAt("FathomProxyAdmin", config.fathomProxyAdmin);

    const contracts = [
        "DelayFathomOraclePriceFeed",
        "DexPriceOracle",
        "CollateralTokenAdapter",
        "SlidingWindowDexOracle",

    ]
    if (config.usePluginOracle) {
        contracts.push("PluginPriceOracle")
        contracts.push("CentralizedOraclePriceFeed")
    }

    const promises = contracts.map(contract => {
        const instance = artifacts.require(`${contract}.sol`);
        return proxyFactory.createProxy(getProxyId(contract), instance.address, proxyAdmin.address, "0x", { gasLimit: 2000000 })
    });

    await Promise.all(promises);
}
