const { ethers } = require("hardhat");
const { formatBytes32String } = ethers.utils;

const contracts = [
  "AccessControlConfig",
  "CollateralPoolConfig",
  "BookKeeper",
  "FathomStablecoin",
  "SystemDebtEngine",
  "LiquidationEngine",
  "StablecoinAdapter",
  "PriceOracle",
  "ShowStopper",
  "PositionManager",
  "FixedSpreadLiquidationStrategy",
  "StabilityFeeCollector",
  "ProxyWalletRegistry",
  "ProxyWalletFactory",
  "ProxyActionsStorage",
  "FlashMintModule",
  "StableSwapModule",
  "FlashMintArbitrager",
  "BookKeeperFlashMintArbitrager",
  "DelayFathomOraclePriceFeed",
  "DexPriceOracle",
  "CollateralTokenAdapter",
  "SlidingWindowDexOracle",
  "AdminControls",
  "CentralizedOraclePriceFeed",
  "StableSwapModuleWrapper",
  "SimplePriceFeed",
  "FathomBridge",
];

async function deployProxies(deployments) {
  const fathomProxyFactory = await deployments.get("FathomProxyFactory");
  const fathomProxyFactoryAddress = fathomProxyFactory.address;

  const fathomProxyAdmin = await deployments.get("FathomProxyAdmin");
  const fathomProxyAdminAddress = fathomProxyAdmin.address;

  const fathomProxyFactoryContract = await ethers.getContractAt("FathomProxyFactory", fathomProxyFactoryAddress);
  await Promise.all(
    contracts.map(async (contract) => {
      const instance = await deployments.get(contract);
      return fathomProxyFactoryContract.createProxy(formatBytes32String(contract), instance.address, fathomProxyAdminAddress, "0x");
    })
  );
}

module.exports = {
  deployProxies,
};