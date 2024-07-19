const fs = require('fs');

const { getProxy, getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId, token, poolId } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);
    const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

    const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));
    const fathomPriceOracle = await getProxyById(proxyFactory, "FathomPriceOracle", getProxyId("FathomPriceOracle"));
    const centralizedOraclePriceFeed = await getProxyById(proxyFactory, "CentralizedOraclePriceFeed", getProxyId("CentralizedOraclePriceFeed"));

    const newAddresses = {
        fathomPriceOracle: fathomPriceOracle.address,
        collateralTokenAdapter: collateralTokenAdapter.address,
        centralizedOraclePriceFeed: centralizedOraclePriceFeed.address,
    }

    const promises = [
        collateralTokenAdapter.initialize(
            bookKeeper.address,
            poolId,
            config.tokenAddress,
            proxyWalletFactory.address
        ),
        // fathomPriceOracle.initialize(accessControlConfig.address, config.fathomOracle),
        centralizedOraclePriceFeed.initialize(fathomPriceOracle.address, accessControlConfig.address, poolId)
    ];

    await Promise.all(promises);

    fs.writeFileSync(`./addresses_${token}.json`, JSON.stringify(newAddresses));
}