const { getProxy } = require("../../../common/proxies");

module.exports =  async function(deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
    const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
    const showStopper = await getProxy(proxyFactory, "ShowStopper");

    const MockCollateralTokenAdapter = await artifacts.initializeInterfaceAt("MockCollateralTokenAdapter", "MockCollateralTokenAdapter");
    await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), MockCollateralTokenAdapter.address)

    await MockCollateralTokenAdapter.whitelist(positionManager.address, { gasLimit: 1000000 });
    await MockCollateralTokenAdapter.whitelist(fixedSpreadLiquidationStrategy.address, { gasLimit: 1000000 });
    await MockCollateralTokenAdapter.whitelist(liquidationEngine.address, { gasLimit: 1000000 });
    await MockCollateralTokenAdapter.whitelist(showStopper.address, { gasLimit: 1000000 });
}