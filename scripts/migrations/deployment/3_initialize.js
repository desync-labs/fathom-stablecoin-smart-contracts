const fs = require('fs');

const pools = require("../../common/collateral");
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const getPositions = await getProxy(proxyFactory, "GetPositions");
    const getPositions2 = await getProxy(proxyFactory, "GetPositionsV2");
    const getPositionsBot = await getProxy(proxyFactory, "GetPositionsBot");
    const fathomStats = await getProxy(proxyFactory, "FathomStats");
    const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed");
    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
    const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const showStopper = await getProxy(proxyFactory, "ShowStopper");
    const priceOracle = await getProxy(proxyFactory, "PriceOracle");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
    const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const authTokenAdapter = await getProxy(proxyFactory, "AuthTokenAdapter");
    const flashMintArbitrager = await getProxy(proxyFactory, "FlashMintArbitrager");
    const bookKeeperFlashMintArbitrager = await getProxy(proxyFactory, "BookKeeperFlashMintArbitrager");
    const fathomOraclePriceFeedFactory = await getProxy(proxyFactory, "FathomOraclePriceFeedFactory");
    const dexPriceOracle = await getProxy(proxyFactory, "DexPriceOracle");
    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");

    const collateralTokenAdapter = await artifacts.initializeInterfaceAt("CollateralTokenAdapter", "CollateralTokenAdapter");
    const fairLaunch = await artifacts.initializeInterfaceAt("FairLaunch", "FairLaunch");
    const fathomOraclePriceFeed = await artifacts.initializeInterfaceAt("FathomOraclePriceFeed", "FathomOraclePriceFeed");
    const proxyWalletFactory = await artifacts.initializeInterfaceAt("ProxyWalletFactory", "ProxyWalletFactory");

    const FathomStablecoinProxyActions = artifacts.require('./8.17/proxy-actions/FathomStablecoinProxyActions.sol');
    const Shield = artifacts.require('./8.17/apis/fathom/Shield.sol');
    const FathomToken = artifacts.require('./8.17/apis/fathom/FathomToken.sol');

    const addresses = getAddresses(deployer.networkId())

    const promises = [
        accessControlConfig.initialize({ gasLimit: 1000000 }),
        collateralPoolConfig.initialize(accessControlConfig.address, { gasLimit: 1000000 }),
        bookKeeper.initialize(
            collateralPoolConfig.address,
            accessControlConfig.address,
            { gasLimit: 1000000 }
        ),
        fathomStablecoin.initialize("Fathom USD", "FXD", { gasLimit: 1000000 }),
        systemDebtEngine.initialize(bookKeeper.address, { gasLimit: 1000000 }),
        liquidationEngine.initialize(
            bookKeeper.address,
            systemDebtEngine.address,
            priceOracle.address,
            { gasLimit: 1000000 }
        ),
        stablecoinAdapter.initialize(
            bookKeeper.address,
            fathomStablecoin.address,
            { gasLimit: 1000000 }
        ),
        priceOracle.initialize(
            bookKeeper.address,
            { gasLimit: 1000000 }
        ),
        showStopper.initialize(
            bookKeeper.address,
            { gasLimit: 1000000 }
        ),
        positionManager.initialize(
            bookKeeper.address,
            showStopper.address,
            priceOracle.address,
            { gasLimit: 1000000 }
        ),
        simplePriceFeed.initialize(
            accessControlConfig.address,
            { gasLimit: 5000000 }
        ),
        fixedSpreadLiquidationStrategy.initialize(
            bookKeeper.address,
            priceOracle.address,
            liquidationEngine.address,
            systemDebtEngine.address,
        ),
        stabilityFeeCollector.initialize(
            bookKeeper.address,
            systemDebtEngine.address,
            { gaslimit: 4050000 }
        ),
        proxyWalletRegistry.initialize(proxyWalletFactory.address, { gasLimit: 1000000 }),
        getPositions.initialize({ gaslimit: 4050000 }),
        getPositions2.initialize(fathomStats.address, { gaslimit: 4050000 }),
        flashMintModule.initialize(
            stablecoinAdapter.address,
            systemDebtEngine.address,
            { gasLimit: 1000000 }
        ),
        authTokenAdapter.initialize(
            bookKeeper.address,
            pools.USDT_STABLE,
            addresses.USDT,
            { gasLimit: 1000000 }
        ),
        stableSwapModule.initialize(
            authTokenAdapter.address,
            stablecoinAdapter.address,
            systemDebtEngine.address,
            { gasLimit: 1000000 }
        ),
        getPositionsBot.initialize({ gasLimit: 1000000 }),
        fathomStats.initialize(
            bookKeeper.address,
            fairLaunch.address,
            addresses.WXDC,
            addresses.USDT,
            fathomStablecoin.address,
            dexPriceOracle.address,
            pools.FTHM,
            collateralPoolConfig.address,
            addresses.FTHM
        ),
        flashMintArbitrager.initialize({ gasLimit: 1000000 }),
        bookKeeperFlashMintArbitrager.initialize(fathomStablecoin.address, { gasLimit: 1000000 }),
        fathomOraclePriceFeedFactory.initialize(fathomOraclePriceFeed.address, { gasLimit: 1000000 }),
        dexPriceOracle.initialize(addresses.DEXFactory, { gasLimit: 1000000 }),
        collateralTokenAdapterFactory.initialize(collateralTokenAdapter.address, { gasLimit: 1000000 })
    ];

    await Promise.all(promises);

    const newAddresses = {
        proxyFactory: proxyFactory.address,
        getPositions: getPositions.address,
        getPositions2: getPositions2.address,
        getPositionsBot: getPositionsBot.address,
        fathomStats: fathomStats.address,
        simplePriceFeedUSDT: simplePriceFeed.address,
        fixedSpreadLiquidationStrategy: fixedSpreadLiquidationStrategy.address,
        proxyWalletRegistry: proxyWalletRegistry.address,
        stabilityFeeCollector: stabilityFeeCollector.address,
        stablecoinAdapter: stablecoinAdapter.address,
        showStopper: showStopper.address,
        priceOracle: priceOracle.address,
        fathomStablecoin: fathomStablecoin.address,
        positionManager: positionManager.address,
        systemDebtEngine: systemDebtEngine.address,
        liquidationEngine: liquidationEngine.address,
        bookKeeper: bookKeeper.address,
        collateralPoolConfig: collateralPoolConfig.address,
        accessControlConfig: accessControlConfig.address,
        flashMintModule: flashMintModule.address,
        stableSwapModule: stableSwapModule.address,
        authTokenAdapter: authTokenAdapter.address,
        flashMintArbitrager: flashMintArbitrager.address,
        bookKeeperFlashMintArbitrager: bookKeeperFlashMintArbitrager.address,
        fathomOraclePriceFeedFactory: fathomOraclePriceFeedFactory.address,
        dexPriceOracle: dexPriceOracle.address,
        collateralTokenAdapterFactory: collateralTokenAdapterFactory.address,
        fairLaunch: fairLaunch.address,
        fathomOraclePriceFeed: fathomOraclePriceFeed.address,
        proxyWalletFactory: proxyWalletFactory.address,
        fathomToken: FathomToken.address,
        shield: Shield.address,
        fathomStablecoinProxyActions: FathomStablecoinProxyActions.address
    }

    fs.writeFileSync('./addresses.json', JSON.stringify(newAddresses));
}