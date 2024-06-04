const fs = require('fs');
const { BigNumber } = require('ethers');

const rawdata = fs.readFileSync('../../../../externalAddresses.json');
let addresses = JSON.parse(rawdata);

const MockedDexRouter = artifacts.require('MockedDexRouter.sol');
const MockStablecoinAdapter = artifacts.require('MockStablecoinAdapter.sol');
const MockCollateralPoolConfig = artifacts.require('MockCollateralPoolConfig.sol');

const MockFlashMintModule = artifacts.require('MockFlashMintModule.sol');
const MockFixedSpreadLiquidationStrategy = artifacts.require('MockFixedSpreadLiquidationStrategy.sol');

const MockPositionManager = artifacts.require('MockPositionManager.sol');
const MockCentralizedOraclePriceFeed = artifacts.require('MockCentralizedOraclePriceFeed.sol');
// const MockDelayFathomOraclePriceFeed = artifacts.require('MockDelayFathomOraclePriceFeed.sol');
// const MockDexPriceOracle = artifacts.require('MockDexPriceOracle.sol');
// const MockSlidingWindowDexOracle = artifacts.require('MockSlidingWindowDexOracle.sol');
const MockAdminControls = artifacts.require('MockAdminControls.sol');
const MockBookKeeper = artifacts.require('MockBookKeeper.sol');

const MockFathomStablecoin = artifacts.require('MockFathomStablecoin.sol');

const MockLiquidationEngine = artifacts.require('MockLiquidationEngine.sol');

const MockPriceOracle = artifacts.require('MockPriceOracle.sol');

const MockShowStopper = artifacts.require('MockShowStopper.sol');

const MockStabilityFeeCollector = artifacts.require('MockStabilityFeeCollector.sol');
// const MockStableSwapModule = artifacts.require('MockStableSwapModule.sol');
// const MockStableSwapModuleWrapper = artifacts.require('MockStableSwapModuleWrapper.sol');
const MockSystemDebtEngine = artifacts.require('MockSystemDebtEngine.sol');

const TokenAdapter = artifacts.require('TokenAdapter.sol');
const FathomToken = artifacts.require('FathomToken.sol');
const ERC20 = artifacts.require('ERC20Mintable.sol');
const WNATIVE = artifacts.require('WNATIVE.sol');
const ERC20Stable = artifacts.require('ERC20MintableStableSwap.sol')
const SimplePriceFeed = artifacts.require('SimplePriceFeed.sol')
const StableswapMultipleSwapsMock = artifacts.require("StableswapMultipleSwapsMock");
const TestOracleMock = artifacts.require("TestOracleMock");

module.exports = async function (deployer) {
  const promises = [
    deployer.deploy(ERC20, "US+", "US+", { gas: 3050000 }),
    deployer.deploy(MockedDexRouter, { gas: 3050000 }),
    deployer.deploy(TokenAdapter, { gas: 3050000 }),
    deployer.deploy(FathomToken, 88, 89, { gas: 3050000 }),
    deployer.deploy(ERC20Stable, "StableCoin", "SFC", { gas: 3050000 }),
    deployer.deploy(SimplePriceFeed, { gas: 7050000 }),
    deployer.deploy(TestOracleMock, 1000, { gas: 7050000 }),
    deployer.deploy(MockStablecoinAdapter, { gas: 7050000 }),
    deployer.deploy(MockCollateralPoolConfig, { gas: 7050000 }),
    deployer.deploy(MockFlashMintModule, { gas: 7050000 }),
    deployer.deploy(MockFixedSpreadLiquidationStrategy, { gas: 7050000 }),
    deployer.deploy(MockPositionManager, { gas: 7050000 }),
    deployer.deploy(MockCentralizedOraclePriceFeed, { gas: 7050000 }),
    // deployer.deploy(MockDelayFathomOraclePriceFeed, { gas: 7050000 }),
    // deployer.deploy(MockDexPriceOracle, { gas: 7050000 }),
    // deployer.deploy(MockSlidingWindowDexOracle, { gas: 7050000 }),
    deployer.deploy(MockAdminControls, { gas: 7050000 }),
    deployer.deploy(MockBookKeeper, { gas: 7050000 }),
    deployer.deploy(MockFathomStablecoin, { gas: 7050000 }),
    deployer.deploy(MockLiquidationEngine, { gas: 7050000 }),
    deployer.deploy(MockPriceOracle, { gas: 7050000 }),
    deployer.deploy(MockShowStopper, { gas: 7050000 }),
    deployer.deploy(MockStabilityFeeCollector, { gas: 7050000 }),
    // deployer.deploy(MockStableSwapModule, { gas: 7050000 }),
    // deployer.deploy(MockStableSwapModuleWrapper, { gas: 7050000 }),
    deployer.deploy(MockSystemDebtEngine, { gas: 7050000 }),

  ];

  await Promise.all(promises);

  const chainId = deployer.networkId(ERC20.address);
  addresses[chainId].USD = ERC20.address;
  addresses[chainId].USDSTABLE = ERC20Stable.address;

  await deployer.deploy(WNATIVE, { gas: 3050000 }),
    addresses[chainId].WNATIVE = WNATIVE.address;
  addresses[chainId].testOracle = TestOracleMock.address;

  await deployer.deploy(StableswapMultipleSwapsMock, { gas: 3050000 })
  fs.writeFileSync('./externalAddresses.json', JSON.stringify(addresses));
};