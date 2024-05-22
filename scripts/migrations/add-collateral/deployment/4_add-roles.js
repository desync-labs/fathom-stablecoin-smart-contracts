const { getProxy, getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);

    // const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
    const fixedSpreadLiquidationStrategy = "0xfe5037504E0EF5eC2DfBEEA03f9d9cB43580EF23";
    const showStopper = await getProxy(proxyFactory, "ShowStopper");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const collateralTokenAdapterCGO = await getProxyById(proxyFactory, "CollateralTokenAdapterCGO", getProxyId("CollateralTokenAdapterCGO"));

    await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), collateralTokenAdapterCGO.address)

    await collateralTokenAdapterCGO.addToWhitelist(positionManager.address, { gasLimit: 1000000 });
    await collateralTokenAdapterCGO.addToWhitelist(fixedSpreadLiquidationStrategy, { gasLimit: 1000000 });
    await collateralTokenAdapterCGO.addToWhitelist(liquidationEngine.address, { gasLimit: 1000000 });
    await collateralTokenAdapterCGO.addToWhitelist(showStopper.address, { gasLimit: 1000000 });
}