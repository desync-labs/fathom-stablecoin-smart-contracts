const { ethers } = require("hardhat");
const { getProxy } = require("../../../common/proxies");

async function addRoles(deployments) {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

  const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const showStopper = await getProxy(proxyFactory, "ShowStopper");
  const priceOracle = await getProxy(proxyFactory, "PriceOracle");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
  const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
  const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
  const adminControls = await getProxy(proxyFactory, "AdminControls");
  // TODO
  const fathomBridge = await getProxy(proxyFactory, "FathomBridge");

  await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), bookKeeper.address);

  await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), positionManager.address);
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), positionManager.address);

  await accessControlConfig.grantRole(await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(), stabilityFeeCollector.address);

  await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), liquidationEngine.address);

  await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), fixedSpreadLiquidationStrategy.address);
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), fixedSpreadLiquidationStrategy.address);

  await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), showStopper.address);
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), showStopper.address);
  await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address);

  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), priceOracle.address);

  await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), collateralTokenAdapter.address);

  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), flashMintModule.address);

  await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), stableSwapModule.address);
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), stableSwapModule.address);

  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), systemDebtEngine.address);

  // TODO
  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), fathomBridge.address);
  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), stablecoinAdapter.address);

  await accessControlConfig.grantRole(await accessControlConfig.GOV_ROLE(), adminControls.address);

  await bookKeeper.whitelist(stablecoinAdapter.address);

  await collateralTokenAdapter.addToWhitelist(positionManager.address);
  await collateralTokenAdapter.addToWhitelist(fixedSpreadLiquidationStrategy.address);
  await collateralTokenAdapter.addToWhitelist(liquidationEngine.address);
  await collateralTokenAdapter.addToWhitelist(showStopper.address);
}

module.exports = {
  addRoles,
};