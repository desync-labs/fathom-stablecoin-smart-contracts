const { getProxy, getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);

    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
    const showStopper = await getProxy(proxyFactory, "ShowStopper");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));

    await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), collateralTokenAdapter.address)

    await collateralTokenAdapter.whitelist(positionManager.address, { gasLimit: 1000000 });
    await collateralTokenAdapter.whitelist(fixedSpreadLiquidationStrategy.address, { gasLimit: 1000000 });
    await collateralTokenAdapter.whitelist(liquidationEngine.address, { gasLimit: 1000000 });
    await collateralTokenAdapter.whitelist(showStopper.address, { gasLimit: 1000000 });
}
