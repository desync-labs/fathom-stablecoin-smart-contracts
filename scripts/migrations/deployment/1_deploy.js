const { parseEther } = require("ethers/lib/utils");

const {Deployer} = require("../../common/addresses");

const AccessControlConfig = artifacts.require('./8.17/stablecoin-core/config/AccessControlConfig.sol');
const CollateralPoolConfig = artifacts.require('./8.17/stablecoin-core/config/CollateralPoolConfig.sol');
const BookKeeper = artifacts.require('./8.17/stablecoin-core/BookKeeper.sol');
const FathomStablecoin = artifacts.require('./8.17/stablecoin-core/FathomStablecoin.sol');
const SystemDebtEngine = artifacts.require('./8.17/stablecoin-core/SystemDebtEngine.sol');
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
const CollateralTokenAdapter = artifacts.require('./8.17/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapter.sol');
const CollateralTokenAdapterFactory = artifacts.require('./8.17/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapterFactory.sol');
const PositionManager = artifacts.require('./8.17/managers/PositionManager.sol');
const FathomToken = artifacts.require('./8.17/apis/fathom/FathomToken.sol');
const ShowStopper = artifacts.require('./8.17/stablecoin-core/ShowStopper.sol');
const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');
const StablecoinAdapter = artifacts.require('./8.17/stablecoin-core/adapters/StablecoinAdapter.sol');
const LiquidationEngine = artifacts.require('./8.17/stablecoin-core/LiquidationEngine.sol');
const FlashMintModule = artifacts.require('./8.17/flash-mint/FlashMintModule.sol');
const FlashMintArbitrager = artifacts.require('./8.17/mocks/FlashMintArbitrager.sol');
const BookKeeperFlashMintArbitrager = artifacts.require('./8.17/mocks/BookKeeperFlashMintArbitrager.sol');
const GetPositionsV2 = artifacts.require('./8.17/stats/GetPositionsV2.sol');
const GetPositionsBot = artifacts.require('./8.17/managers/GetPositionsBot.sol');
const FathomStats = artifacts.require('./8.17/stats/FathomStats.sol');
const Shield = artifacts.require('./8.17/apis/fathom/Shield.sol');
const FairLaunch = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');
const FathomProxyFactory = artifacts.require('FathomProxyFactory.sol');
const FathomProxyAdmin = artifacts.require('FathomProxyAdmin.sol');
const FathomOraclePriceFeedFactory = artifacts.require('FathomOraclePriceFeedFactory.sol');
const FathomOraclePriceFeed = artifacts.require('FathomOraclePriceFeed.sol');


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
      deployer.deploy(GetPositions, { gas: 7050000 }),
      deployer.deploy(GetPositionsV2, { gas: 7050000 }),
      deployer.deploy(GetPositionsBot, { gas: 7050000 }),
      deployer.deploy(FathomStats, { gas: 7050000 }),
      deployer.deploy(FlashMintModule, { gas: 7050000 }),
      deployer.deploy(FlashMintArbitrager, { gas: 7050000 }),
      deployer.deploy(BookKeeperFlashMintArbitrager, { gas: 7050000 }),
      deployer.deploy(FathomProxyFactory, { gas: 7050000 }),
      deployer.deploy(FathomProxyAdmin, { gas: 7050000 }),
      deployer.deploy(FathomOraclePriceFeedFactory, { gas: 7050000 }),
  ];

  await Promise.all(promises);

  await deployer.deploy(FairLaunch, FathomToken.address, Deployer, parseEther("100"), 0, 0, 0, { gas: 7050000 }),
  await deployer.deploy(Shield, Deployer, FairLaunch.address, { gas: 7050000 })
};