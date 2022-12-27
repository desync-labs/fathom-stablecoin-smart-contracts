const { parseEther } = require("ethers/lib/utils");

const {Deployer} = require("../../common/addresses");

const AccessControlConfig = artifacts.require('AccessControlConfig.sol');
const CollateralPoolConfig = artifacts.require('CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('BookKeeper.sol');
const FathomStablecoin = artifacts.require('FathomStablecoin.sol');
const SystemDebtEngine = artifacts.require('SystemDebtEngine.sol');
const StableSwapModule = artifacts.require('StableSwapModule.sol');
const AuthTokenAdapter = artifacts.require('AuthTokenAdapter.sol');
const DexPriceOracle = artifacts.require('DexPriceOracle.sol');
const ProxyWalletRegistry = artifacts.require('ProxyWalletRegistry.sol');
const ProxyWalletFactory = artifacts.require('ProxyWalletFactory.sol');
const StabilityFeeCollector = artifacts.require('StabilityFeeCollector.sol');
const FathomStablecoinProxyActions = artifacts.require('FathomStablecoinProxyActions.sol');
const FixedSpreadLiquidationStrategy = artifacts.require('FixedSpreadLiquidationStrategy.sol');
const SimplePriceFeed = artifacts.require('SimplePriceFeed.sol');
const CollateralTokenAdapter = artifacts.require('CollateralTokenAdapter.sol');
const CollateralTokenAdapterFactory = artifacts.require('CollateralTokenAdapterFactory.sol');
const PositionManager = artifacts.require('PositionManager.sol');
const FathomToken = artifacts.require('FathomToken.sol');
const ShowStopper = artifacts.require('ShowStopper.sol');
const PriceOracle = artifacts.require('PriceOracle.sol');
const StablecoinAdapter = artifacts.require('StablecoinAdapter.sol');
const LiquidationEngine = artifacts.require('LiquidationEngine.sol');
const FlashMintModule = artifacts.require('FlashMintModule.sol');
const FlashMintArbitrager = artifacts.require('FlashMintArbitrager.sol');
const BookKeeperFlashMintArbitrager = artifacts.require('BookKeeperFlashMintArbitrager.sol');
const Shield = artifacts.require('Shield.sol');
const FairLaunch = artifacts.require('FairLaunch.sol');
const FathomProxyFactory = artifacts.require('FathomProxyFactory.sol');
const FathomProxyAdmin = artifacts.require('FathomProxyAdmin.sol');
const FathomOraclePriceFeedFactory = artifacts.require('FathomOraclePriceFeedFactory.sol');
const FathomOraclePriceFeed = artifacts.require('FathomOraclePriceFeed.sol');
const DelayFathomOraclePriceFeed = artifacts.require('DelayFathomOraclePriceFeed.sol');

module.exports =  async function(deployer) {
  let promises = [
      deployer.deploy(AccessControlConfig, { gas: 7050000 }),
      deployer.deploy(CollateralPoolConfig, { gas: 7050000 }),
      deployer.deploy(CollateralTokenAdapter, { gas: 7050000 }),
      deployer.deploy(CollateralTokenAdapterFactory, { gas: 7050000 }),
      deployer.deploy(BookKeeper, { gas: 7050000 }),
      deployer.deploy(FathomStablecoin, { gas: 7050000 }),
      deployer.deploy(SystemDebtEngine, { gas: 7050000 }),
      deployer.deploy(LiquidationEngine, { gas: 7050000 }),
      deployer.deploy(StablecoinAdapter, { gas: 7050000 }),
      deployer.deploy(PriceOracle, { gas: 7050000 }),
      deployer.deploy(ShowStopper, { gas: 7050000 }),
      deployer.deploy(FathomToken, 88, 89, { gas: 7050000 }),
      deployer.deploy(PositionManager, { gas: 7050000 }),
      deployer.deploy(FathomOraclePriceFeed, { gas: 7050000 }),
      deployer.deploy(SimplePriceFeed, { gas: 7050000 }),
      deployer.deploy(FixedSpreadLiquidationStrategy, { gas: 7050000 }),
      deployer.deploy(FathomStablecoinProxyActions, { gas: 7050000 }),
      deployer.deploy(StabilityFeeCollector, { gas: 7050000 }),
      deployer.deploy(ProxyWalletFactory, { gas: 7050000 }),
      deployer.deploy(ProxyWalletRegistry, { gas: 7050000 }),
      deployer.deploy(DexPriceOracle, { gas: 7050000 }),
      deployer.deploy(AuthTokenAdapter, { gas: 7050000 }),
      deployer.deploy(StableSwapModule, { gas: 7050000 }),
      deployer.deploy(FlashMintModule, { gas: 7050000 }),
      deployer.deploy(FlashMintArbitrager, { gas: 7050000 }),
      deployer.deploy(BookKeeperFlashMintArbitrager, { gas: 7050000 }),
      deployer.deploy(FathomProxyFactory, { gas: 7050000 }),
      deployer.deploy(FathomProxyAdmin, { gas: 7050000 }),
      deployer.deploy(FathomOraclePriceFeedFactory, { gas: 7050000 }),
      deployer.deploy(DelayFathomOraclePriceFeed, { gas: 7050000 }),
  ];

  await Promise.all(promises);

  await deployer.deploy(FairLaunch, FathomToken.address, Deployer, parseEther("100"), 0, 0, 0, { gas: 7050000 }),
  await deployer.deploy(Shield, Deployer, FairLaunch.address, { gas: 7050000 })
};