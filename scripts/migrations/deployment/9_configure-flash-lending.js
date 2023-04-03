const { getProxy } = require("../../common/proxies");

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  
    await fixedSpreadLiquidationStrategy.setFlashLendingEnabled(1, { gasLimit: 1000000 })

}