const { getProxy, getProxyById } = require("../../common/proxies");
const { getConfig, getProxyIdSwitchPriceFeed} = require("../../common/swtich-price-feed-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());
    const token = config.CollateralSymbol;
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.FathomProxyFactory);
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const subscriptionsRegistry = await artifacts.initializeInterfaceAt("ISubscriptionsRegistry", config.SubscriptionsRegistry);
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    //need to instantiate a contract using directly address
    if (token == "NATIVE") {
        console.log("PriceSwitching for NATIVE");
        const fathomPriceOracle = await getProxy(proxyFactory, "FathomPriceOracle");
        const centralizedOraclePriceFeed = await getProxy(proxyFactory, "CentralizedOraclePriceFeed");
    } else {
        console.log(`PriceSwitching for ${token}`);
        const fathomPriceOracle = await getProxyById(proxyFactory, "FathomPriceOracle", getProxyIdSwitchPriceFeed("FathomPriceOracle"));
        const centralizedOraclePriceFeed = await getProxyById(proxyFactory, "CentralizedOraclePriceFeed", getProxyIdSwitchPriceFeed("CentralizedOraclePriceFeed"));    
    }
    // scripting of below doc
    // https://docs.google.com/document/d/1_Hmuyz-iwI1MdmtlL56FySoNm3Gxedt0TV2LzmPFVFI/edit?usp=sharing
    const promises = [
        // 0)subscribe to aggregator
        subscriptionsRegistry.masterSubscribe(fathomPriceOracle.address, config.PriceAggregator),
        // 1)FathomPriceOracle.initialize(accessControlConfig, PriceAggregator)
        fathomPriceOracle.initialize(accessControlConfig.address, config.PriceAggregator),
        // 2)Call peekPrice() twice on CentralizedOraclePriceFeed_Token.
        centralizedOraclePriceFeed.peekPrice(),
        centralizedOraclePriceFeed.peekPrice(),
        // 3)CollateralPoolConfig.setPriceFeed(CentralizedOraclePriceFeed_Token)
        collateralPoolConfig.setPriceFeed(centralizedOraclePriceFeed.address),
    ];

    await Promise.all(promises);

}
