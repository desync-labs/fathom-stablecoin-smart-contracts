const fs = require('fs');

const { getAddresses } = require("../../../common/addresses");
const { getProxy, getProxyById } = require("../../../common/proxies");

const { getConfig, getProxyId, token, poolId } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());
    const addresses = getAddresses(deployer.networkId())

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);

    const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

    const delayFathomOraclePriceFeed = await getProxyById(proxyFactory, "DelayFathomOraclePriceFeed", getProxyId("DelayFathomOraclePriceFeed"));
    const dexPriceOracle = await getProxyById(proxyFactory, "DexPriceOracle", getProxyId("DexPriceOracle"));
    const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));

    const newAddresses = {
        dexPriceOracle: dexPriceOracle.address,
        collateralTokenAdapter: collateralTokenAdapter.address,
        delayFathomOraclePriceFeed: delayFathomOraclePriceFeed.address,
    }

    const promises = [
        dexPriceOracle.initialize(addresses.DEXFactory, { gasLimit: 1000000 }),
        collateralTokenAdapter.initialize(
            bookKeeper.address,
            poolId,
            config.tokenAddress,
            proxyWalletFactory.address
        ),
        delayFathomOraclePriceFeed.initialize(
            dexPriceOracle.address,
            config.tokenAddress,
            addresses.USD,
            accessControlConfig.address,
            poolId
        )
    ];

    if (config.usePluginOracle) {
        const pluginPriceOracle = await getProxyById(proxyFactory, "PluginPriceOracle", getProxyId("PluginPriceOracle"));
        const centralizedOraclePriceFeed = await getProxyById(proxyFactory, "CentralizedOraclePriceFeed", getProxyId("CentralizedOraclePriceFeed"));

        promises.push(pluginPriceOracle.initialize(accessControlConfig.address, config.pluginOracle))
        promises.push(centralizedOraclePriceFeed.initialize(pluginPriceOracle.address, accessControlConfig.address, poolId))

        newAddresses.pluginPriceOracle = pluginPriceOracle.address,
            newAddresses.centralizedOraclePriceFeed = centralizedOraclePriceFeed.address
    }

    await Promise.all(promises);

    fs.writeFileSync(`./addresses_${token}.json`, JSON.stringify(newAddresses));
}
