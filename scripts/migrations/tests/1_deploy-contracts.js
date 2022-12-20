const AccessControlConfig = artifacts.require('./main/stablecoin-core/config/AccessControlConfig.sol');
const CollateralPoolConfig = artifacts.require('./main/stablecoin-core/config/CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('./main/stablecoin-core/BookKeeper.sol');
const FathomStablecoin = artifacts.require('./main/stablecoin-core/FathomStablecoin.sol');
const SystemDebtEngine = artifacts.require('./main/stablecoin-core/SystemDebtEngine.sol');
const FathomOraclePriceFeed = artifacts.require('./main/price-feeders/FathomOraclePriceFeed.sol');
const StableSwapModule = artifacts.require('./main/stablecoin-core/StableSwapModule.sol');
const AuthTokenAdapter = artifacts.require('./main/stablecoin-core/adapters/AuthTokenAdapter.sol');
const TokenAdapter = artifacts.require('./main/stablecoin-core/adapters/TokenAdapter.sol');
const DexPriceOracle = artifacts.require('./main/price-oracles/DexPriceOracle.sol');
const ProxyWalletRegistry = artifacts.require('./main/proxy-wallet/ProxyWalletRegistry.sol');
const ProxyWalletFactory = artifacts.require('./main/proxy-wallet/ProxyWalletFactory.sol');
const StabilityFeeCollector = artifacts.require('./main/stablecoin-core/StabilityFeeCollector.sol');
const FathomStablecoinProxyActions = artifacts.require('./main/proxy-actions/FathomStablecoinProxyActions.sol');
const FixedSpreadLiquidationStrategy = artifacts.require('./main/stablecoin-core/liquidation-strategies/FixedSpreadLiquidationStrategy.sol');
const SimplePriceFeed = artifacts.require('./main/price-feeders/SimplePriceFeed.sol');
const CollateralTokenAdapterFactory = artifacts.require('./main/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapterFactory.sol');
const PositionManager = artifacts.require('./main/managers/PositionManager.sol');
const FathomToken = artifacts.require('./tests/FathomToken.sol');
const ShowStopper = artifacts.require('./main/stablecoin-core/ShowStopper.sol');
const PriceOracle = artifacts.require('./main/stablecoin-core/PriceOracle.sol');
const StablecoinAdapter = artifacts.require('./main/stablecoin-core/adapters/StablecoinAdapter.sol');
const LiquidationEngine = artifacts.require('./main/stablecoin-core/LiquidationEngine.sol');
// const ERC20Mintable = artifacts.require('./tests/mocks/ERC20Mintable.sol');
const FlashMintModule = artifacts.require('./main/flash-mint/FlashMintModule.sol');
//for delayed price testing
const DelayFathomOraclePriceFeed = artifacts.require('./main/price-feeders/DelayFathomOraclePriceFeed.sol');
const FlashMintArbitrager = artifacts.require('./tests/mocks/FlashMintArbitrager.sol');
const BookKeeperFlashMintArbitrager = artifacts.require('./tests/mocks/BookKeeperFlashMintArbitrager.sol');

module.exports =  async function(deployer) {
  let promises = [
      deployer.deploy(AccessControlConfig, { gas: 3050000 }),
      deployer.deploy(CollateralPoolConfig, { gas: 3050000 }),
      deployer.deploy(BookKeeper, { gas: 3050000 }),
      deployer.deploy(FathomStablecoin, { gas: 3050000 }),
      deployer.deploy(SystemDebtEngine, { gas: 3050000 }),
      deployer.deploy(FathomOraclePriceFeed, { gas: 3050000 }),
      deployer.deploy(AuthTokenAdapter, { gas: 3050000 }),
      deployer.deploy(StableSwapModule, { gas: 3050000 }),
      deployer.deploy(DexPriceOracle, { gas: 3050000 }),
      deployer.deploy(ProxyWalletRegistry, { gas: 3050000 }),
      deployer.deploy(StabilityFeeCollector, { gas: 3050000 }),
      deployer.deploy(ProxyWalletFactory, { gas: 3050000 }),
      deployer.deploy(SimplePriceFeed, { gas: 3050000 }),
      deployer.deploy(FathomStablecoinProxyActions, { gas: 5050000 }),
      deployer.deploy(FixedSpreadLiquidationStrategy, { gas: 5050000 }),
      deployer.deploy(CollateralTokenAdapterFactory, { gas: 4050000 }),
      deployer.deploy(PositionManager, { gas: 4050000 }),
      deployer.deploy(ShowStopper, { gas: 3050000 }),
      deployer.deploy(FathomToken, 88, 89, { gas: 4050000 }),
      deployer.deploy(StablecoinAdapter, { gas: 3050000 }),
      deployer.deploy(PriceOracle, { gas: 3050000 }),
      deployer.deploy(LiquidationEngine, { gas: 3050000 }),
      deployer.deploy(FlashMintModule, { gas: 3050000 }),
//for delayed price testing
      deployer.deploy(DelayFathomOraclePriceFeed, { gas: 3050000 }),
      deployer.deploy(TokenAdapter, { gas: 3050000 }),
      deployer.deploy(FlashMintArbitrager, { gas: 3050000 }),
      deployer.deploy(BookKeeperFlashMintArbitrager, { gas: 3050000 }),
  ];

  await Promise.all(promises);
};