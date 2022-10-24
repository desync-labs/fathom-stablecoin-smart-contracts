const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');
const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');
const FathomStablecoin = artifacts.require('./8.17/stablecoin-core/FathomStablecoin.sol');
const SystemDebtEngine = artifacts.require('./8.17/stablecoin-core/SystemDebtEngine.sol');
const FathomOraclePriceFeed = artifacts.require('./8.17/price-feeders/FathomOraclePriceFeed.sol');
const GetPositions = artifacts.require('./8.17/managers/GetPositions.sol');
const StableSwapModule = artifacts.require('./8.17/stablecoin-core/StableSwapModule.sol');
const AuthTokenAdapter = artifacts.require('./8.17/stablecoin-core/adapters/AuthTokenAdapter.sol');
const DexPriceOracle = artifacts.require('./8.17/price-oracles/DexPriceOracle.sol');
const ProxyWalletRegistry = artifacts.require('./8.17/proxy-wallet/ProxyWalletRegistry.sol');
const ProxyWalletFactory = artifacts.require('./8.17/proxy-wallet/ProxyWalletFactory.sol');
const StabilityFeeCollector = artifacts.require('./8.17/stablecoin-core/StabilityFeeCollector.sol');
const FathomStablecoinProxyActions = artifacts.require('./8.17/proxy-actions/FathomStablecoinProxyActions.sol');
const FixedSpreadLiquidationStrategy = artifacts.require('./8.17/stablecoin-core/liquidation-strategies/FixedSpreadLiquidationStrategy.sol');
const SimplePriceFeed = artifacts.require('./8.17/price-feeders/SimplePriceFeed.sol');
const CollateralTokenAdapterFactory = artifacts.require('./8.17/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapterFactory.sol');
const PositionManager = artifacts.require('./8.17/managers/PositionManager.sol');
const FathomToken = artifacts.require('./8.17/apis/fathom/FathomToken.sol');
const ShowStopper = artifacts.require('./8.17/stablecoin-core/ShowStopper.sol');
const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');
const StablecoinAdapter = artifacts.require('./8.17/stablecoin-core/adapters/StablecoinAdapter.sol');
const LiquidationEngine = artifacts.require('./8.17/stablecoin-core/LiquidationEngine.sol');
const WXDC = artifacts.require('./8.17/mocks/WXDC.sol');
const USDT = artifacts.require('./8.17/mocks/USDT.sol');
const FlashMintModule = artifacts.require('./8.17/flash-mint/FlashMintModule.sol');

module.exports =  async function(deployer) {
  let promises = [
      deployer.deploy(AccessControlConfig, { gas: 3050000 }),
      deployer.deploy(CollateralPoolConfig, { gas: 3050000 }),
      deployer.deploy(BookKeeper, { gas: 3050000 }),
      deployer.deploy(FathomStablecoin, { gas: 3050000 }),
      deployer.deploy(SystemDebtEngine, { gas: 3050000 }),
      deployer.deploy(FathomOraclePriceFeed, { gas: 3050000 }),
      deployer.deploy(GetPositions, { gas: 3050000 }),
      deployer.deploy(AuthTokenAdapter, { gas: 3050000 }),
      deployer.deploy(StableSwapModule, { gas: 3050000 }),
      deployer.deploy(DexPriceOracle, { gas: 3050000 }),
      deployer.deploy(ProxyWalletRegistry, { gas: 3050000 }),
      deployer.deploy(StabilityFeeCollector, { gas: 3050000 }),
      deployer.deploy(ProxyWalletFactory, { gas: 3050000 }),
      deployer.deploy(SimplePriceFeed, { gas: 3050000 }),
      deployer.deploy(FathomStablecoinProxyActions, { gas: 5050000 }),
      deployer.deploy(FixedSpreadLiquidationStrategy, { gas: 3050000 }),
      deployer.deploy(CollateralTokenAdapterFactory, { gas: 4050000 }),
      deployer.deploy(PositionManager, { gas: 4050000 }),
      deployer.deploy(ShowStopper, { gas: 3050000 }),
      deployer.deploy(FathomToken, 88, 89, { gas: 4050000 }),
      deployer.deploy(StablecoinAdapter, { gas: 3050000 }),
      deployer.deploy(PriceOracle, { gas: 3050000 }),
      deployer.deploy(LiquidationEngine, { gas: 3050000 }),
      deployer.deploy(WXDC, "WXDC", "WXDC", { gas: 3050000 }),
      deployer.deploy(USDT, "USDT", "USDT", { gas: 3050000 }),
      deployer.deploy(FlashMintModule, { gas: 3050000 })
  ];

  await Promise.all(promises);
};