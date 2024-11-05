const { getProxy } = require("../../../common/proxies");
const pools = require("../../../common/collateral");

async function deployMocksPostDeployment(getNamedAccounts, deployments, getChainId) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
  const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

  //deploying a mockVault and mockColTokenAdapter to add one more collateral type
  await deploy("MockCollateralTokenAdapter", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("MockSimplePriceFeed", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("ReentrancyAttacker", {
    from: deployer,
    args: [proxyWalletRegistry.address],
    log: true,
  });
  await deploy("ReentrancyAttacker2", {
    from: deployer,
    args: [proxyWalletRegistry.address],
    log: true,
  });

  const MockCollateralTokenAdapter = await deployments.get("MockCollateralTokenAdapter");
  const mockCollateralTokenAdapter = await ethers.getContractAt("MockCollateralTokenAdapter", MockCollateralTokenAdapter.address);

  const WXDC = await deployments.get("WXDC");
  await mockCollateralTokenAdapter.initialize(bookKeeper.address, pools.WXDC, WXDC.address, positionManager.address, proxyWalletFactory.address);
  await deploy("MockVault", {
    from: deployer,
    args: [pools.WXDC, WXDC.address, MockCollateralTokenAdapter.address],
    log: true,
  });

  const MockVault = await deployments.get("MockVault");
  //giving ADAPTER_ROLE to MockCollateralTokenAdapter
  await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), MockCollateralTokenAdapter.address);

  await mockCollateralTokenAdapter.setVault(MockVault.address);
}

module.exports = {
  deployMocksPostDeployment,
};
