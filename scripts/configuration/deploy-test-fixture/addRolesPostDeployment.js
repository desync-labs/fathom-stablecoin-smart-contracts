const { ethers } = require("hardhat");
const { getProxy } = require("../../../common/proxies");

async function addRolesPostDeployment(deployments) {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
  const showStopper = await getProxy(proxyFactory, "ShowStopper");

  const MockCollateralTokenAdapter = await deployments.get("MockCollateralTokenAdapter");
  const mockCollateralTokenAdapter = await ethers.getContractAt("MockCollateralTokenAdapter", MockCollateralTokenAdapter.address);
  await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), MockCollateralTokenAdapter.address);

  await mockCollateralTokenAdapter.addToWhitelist(positionManager.address);
  await mockCollateralTokenAdapter.addToWhitelist(fixedSpreadLiquidationStrategy.address);
  await mockCollateralTokenAdapter.addToWhitelist(liquidationEngine.address);
  await mockCollateralTokenAdapter.addToWhitelist(showStopper.address);
}

module.exports = {
  addRolesPostDeployment,
};
