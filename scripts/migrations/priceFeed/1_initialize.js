const fs = require('fs');

const pools = require("../../common/collateral");
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    // const delayFathomOraclePriceFeed = await getProxy(proxyFactory, "DelayFathomOraclePriceFeed");
    // const dexPriceOracle = await getProxy(proxyFactory, "DexPriceOracle");
    // const centralizedOraclePriceFeed = await getProxy(proxyFactory, "CentralizedOraclePriceFeed");
    // const slidingWindowDexOracle = await getProxy(proxyFactory, "SlidingWindowDexOracle");
    // const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

    const addresses = getAddresses(deployer.networkId())

    const promises = [
        // dexPriceOracle.initialize(addresses.DEXFactory, { gasLimit: 1000000 }),
        // slidingWindowDexOracle.initialize(addresses.DEXFactory, 1800, 15),
        // delayFathomOraclePriceFeed.initialize(
        //     dexPriceOracle.address,
        //     addresses.WNATIVE,
        //     addresses.USD,
        //     accessControlConfig.address,
        //     pools.NATIVE
        // ),
        // centralizedOraclePriceFeed.initialize(priceOracleAddress, accessControlConfig.address, pools.NATIVE),
    ];

    await Promise.all(promises);

}
