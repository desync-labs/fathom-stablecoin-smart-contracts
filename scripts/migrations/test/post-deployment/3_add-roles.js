const { getProxy } = require("../../../common/proxies");

module.exports = async function (deployer) {
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
  const showStopper = await getProxy(proxyFactory, "ShowStopper");

  const MockCollateralTokenAdapter = await artifacts.initializeInterfaceAt("MockCollateralTokenAdapter", "MockCollateralTokenAdapter");
  await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), MockCollateralTokenAdapter.address);

  await MockCollateralTokenAdapter.addToWhitelist(positionManager.address, { gasLimit: 1000000 });
  await MockCollateralTokenAdapter.addToWhitelist(fixedSpreadLiquidationStrategy.address, { gasLimit: 1000000 });
  await MockCollateralTokenAdapter.addToWhitelist(liquidationEngine.address, { gasLimit: 1000000 });
  await MockCollateralTokenAdapter.addToWhitelist(showStopper.address, { gasLimit: 1000000 });
};
