const AccessControlConfig = artifacts.require('AccessControlConfig.sol');
const CollateralPoolConfig = artifacts.require('CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('BookKeeper.sol');
const FathomStablecoin = artifacts.require('FathomStablecoin.sol');
const SystemDebtEngine = artifacts.require('SystemDebtEngine.sol');
const StableSwapModule = artifacts.require('StableSwapModule.sol');
const DexPriceOracle = artifacts.require('DexPriceOracle.sol');
const SlidingWindowDexOracle = artifacts.require('SlidingWindowDexOracle.sol');
const ProxyWalletRegistry = artifacts.require('ProxyWalletRegistry.sol');
const ProxyWalletFactory = artifacts.require('ProxyWalletFactory.sol');
const StabilityFeeCollector = artifacts.require('StabilityFeeCollector.sol');
const FathomStablecoinProxyActions = artifacts.require('FathomStablecoinProxyActions.sol');
const FixedSpreadLiquidationStrategy = artifacts.require('FixedSpreadLiquidationStrategy.sol');
const PositionManager = artifacts.require('PositionManager.sol');
const ShowStopper = artifacts.require('ShowStopper.sol');
const PriceOracle = artifacts.require('PriceOracle.sol');
const StablecoinAdapter = artifacts.require('StablecoinAdapter.sol');
const LiquidationEngine = artifacts.require('LiquidationEngine.sol');
const FlashMintModule = artifacts.require('FlashMintModule.sol');
const FlashMintArbitrager = artifacts.require('FlashMintArbitrager.sol');
const BookKeeperFlashMintArbitrager = artifacts.require('BookKeeperFlashMintArbitrager.sol');
const FathomProxyFactory = artifacts.require('FathomProxyFactory.sol');
const FathomProxyAdmin = artifacts.require('FathomProxyAdmin.sol');
const DelayFathomOraclePriceFeed = artifacts.require('DelayFathomOraclePriceFeed.sol');
const CollateralTokenAdapter = artifacts.require('CollateralTokenAdapter.sol');
const ProxyActionsStorage = artifacts.require('ProxyActionsStorage.sol');
const AdminControls = artifacts.require('AdminControls.sol');
// const PluginPriceOracle = artifacts.require('PluginPriceOracle.sol');
// const CentralizedOraclePriceFeed = artifacts.require('CentralizedOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  let promises = [
      deployer.deploy(AccessControlConfig, { gas: 7050000 }),
      deployer.deploy(CollateralPoolConfig, { gas: 7050000 }),
      deployer.deploy(BookKeeper, { gas: 7050000 }),
      deployer.deploy(FathomStablecoin, { gas: 7050000 }),
      deployer.deploy(SystemDebtEngine, { gas: 7050000 }),
      deployer.deploy(LiquidationEngine, { gas: 7050000 }),
      deployer.deploy(StablecoinAdapter, { gas: 7050000 }),
      deployer.deploy(PriceOracle, { gas: 7050000 }),
      deployer.deploy(ShowStopper, { gas: 7050000 }),
      deployer.deploy(PositionManager, { gas: 7050000 }),
      deployer.deploy(FixedSpreadLiquidationStrategy, { gas: 7050000 }),
      deployer.deploy(FathomStablecoinProxyActions, { gas: 7050000 }),
      deployer.deploy(StabilityFeeCollector, { gas: 7050000 }),
      deployer.deploy(ProxyWalletFactory, { gas: 7050000 }),
      deployer.deploy(ProxyWalletRegistry, { gas: 7050000 }),
      deployer.deploy(DexPriceOracle, { gas: 7050000 }),
      deployer.deploy(StableSwapModule, { gas: 7050000 }),
      deployer.deploy(FlashMintModule, { gas: 7050000 }),
      deployer.deploy(FlashMintArbitrager, { gas: 7050000 }),
      deployer.deploy(BookKeeperFlashMintArbitrager, { gas: 7050000 }),
      deployer.deploy(FathomProxyFactory, { gas: 7050000 }),
      deployer.deploy(FathomProxyAdmin, { gas: 7050000 }),
      deployer.deploy(DelayFathomOraclePriceFeed, { gas: 7050000 }),
      deployer.deploy(CollateralTokenAdapter, { gas: 7050000 }),
      deployer.deploy(ProxyActionsStorage, { gas: 7050000 }),
      deployer.deploy(SlidingWindowDexOracle, { gas: 7050000 }),
      deployer.deploy(AdminControls, { gas: 7050000 }),
      // deployer.deploy(PluginPriceOracle, { gas: 7050000 }),
      // deployer.deploy(CentralizedOraclePriceFeed, { gas: 7050000 })
  ];

  await Promise.all(promises);
};