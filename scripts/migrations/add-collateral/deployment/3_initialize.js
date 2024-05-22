const fs = require('fs');

const { getProxy, getProxyById } = require("../../../common/proxies");

const { getConfig, getProxyId, token, poolId } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);
    const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

    const collateralTokenAdapterCGO = await getProxyById(proxyFactory, "CollateralTokenAdapterCGO", getProxyId("CollateralTokenAdapterCGO"));
    const fathomPriceOracleCGO = await getProxyById(proxyFactory, "FathomPriceOracleCGO", getProxyId("FathomPriceOracleCGO"));
    const centralizedOraclePriceFeedCGO = await getProxyById(proxyFactory, "CentralizedOraclePriceFeedCGO", getProxyId("CentralizedOraclePriceFeedCGO"));

    const newAddresses = {
        fathomPriceOracleCGO: fathomPriceOracleCGO.address,
        collateralTokenAdapterCGO: collateralTokenAdapterCGO.address,
        centralizedOraclePriceFeedCGO: centralizedOraclePriceFeedCGO.address,
    }

    const promises = [
        collateralTokenAdapterCGO.initialize(
            bookKeeper.address,
            poolId,
            config.tokenAddress,
            proxyWalletFactory.address
        ),
        fathomPriceOracleCGO.initialize(accessControlConfig.address, config.fathomOracle),
        centralizedOraclePriceFeedCGO.initialize(fathomPriceOracleCGO.address, accessControlConfig.address, poolId)
    ];

    await Promise.all(promises);

    fs.writeFileSync(`./addresses_${token}.json`, JSON.stringify(newAddresses));
}