const { ethers } = require("hardhat");
const { getProxy, getProxyById } = require("../../../common/proxies");
const { getConfig, getProxyId } = require("../../../common/add-collateral-helper");

async function addRoles(getChainId, forFixture = false) {
  const chainId = await getChainId();
  const config = getConfig(chainId);

  let proxyFactoryAddress;
  if (forFixture) {
    const ProxyFactory = await deployments.get("FathomProxyFactory");
    proxyFactoryAddress = ProxyFactory.address;
  } else {
    proxyFactoryAddress = config.fathomProxyFactory;
  }
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", proxyFactoryAddress);

  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  const showStopper = await getProxy(proxyFactory, "ShowStopper");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
  const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));

  await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), collateralTokenAdapter.address);

  await collateralTokenAdapter.addToWhitelist(positionManager.address);
  await collateralTokenAdapter.addToWhitelist(fixedSpreadLiquidationStrategy.address);
  await collateralTokenAdapter.addToWhitelist(liquidationEngine.address);
  await collateralTokenAdapter.addToWhitelist(showStopper.address);
}
module.exports = { addRoles };