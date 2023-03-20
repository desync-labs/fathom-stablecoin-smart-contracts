const fs = require('fs');

const pools = require("../../common/collateral");
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");
const { ethers } = require("ethers");

const FathomStablecoinProxyActions = artifacts.require('FathomStablecoinProxyActions.sol');

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy");
    const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
    const proxyWalletFactory = await getProxy(proxyFactory, "ProxyWalletFactory");
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
    const flashMintArbitrager = await getProxy(proxyFactory, "FlashMintArbitrager");
    const bookKeeperFlashMintArbitrager = await getProxy(proxyFactory, "BookKeeperFlashMintArbitrager");
    const delayFathomOraclePriceFeed = await getProxy(proxyFactory, "DelayFathomOraclePriceFeed");
    const dexPriceOracle = await getProxy(proxyFactory, "DexPriceOracle");
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
    const proxyActionsStorage = await getProxy(proxyFactory, "ProxyActionsStorage");
    const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");

    const addresses = getAddresses(deployer.networkId())
    const dailyLimit = ethers.utils.parseUnits("10000", "ether");

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
        fixedSpreadLiquidationStrategy.initialize(
            bookKeeper.address,
            priceOracle.address,
            liquidationEngine.address,
            systemDebtEngine.address,
            stablecoinAdapter.address
        ),
        stabilityFeeCollector.initialize(
            bookKeeper.address,
            systemDebtEngine.address,
            { gaslimit: 4050000 }
        ),
        proxyActionsStorage.initialize(fathomStablecoinProxyActions.address, { gasLimit: 1000000 }),
        proxyWalletFactory.initialize(proxyActionsStorage.address, { gasLimit: 1000000 }),
        proxyWalletRegistry.initialize(proxyWalletFactory.address, { gasLimit: 1000000 }),
        flashMintModule.initialize(
            stablecoinAdapter.address,
            systemDebtEngine.address,
            { gasLimit: 1000000 }
        ),
        
        stableSwapModule.initialize(
            bookKeeper.address,
            addresses.USD,
            fathomStablecoin.address,
            dailyLimit,
            { gasLimit: 1000000 }
        ),
        flashMintArbitrager.initialize({ gasLimit: 1000000 }),
        bookKeeperFlashMintArbitrager.initialize(fathomStablecoin.address, { gasLimit: 1000000 }),

        dexPriceOracle.initialize(addresses.DEXFactory, { gasLimit: 1000000 }),

        collateralTokenAdapter.initialize(
            bookKeeper.address,
            pools.XDC,
            addresses.WXDC,
            positionManager.address,
            proxyWalletFactory.address
        ),

        delayFathomOraclePriceFeed.initialize(
            dexPriceOracle.address,
            addresses.USD,
            addresses.WXDC,
            accessControlConfig.address,
            pools.XDC
        ),
    ];

    await Promise.all(promises);

    const newAddresses = {
        proxyFactory: proxyFactory.address,
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
        flashMintArbitrager: flashMintArbitrager.address,
        bookKeeperFlashMintArbitrager: bookKeeperFlashMintArbitrager.address,
        dexPriceOracle: dexPriceOracle.address,
        proxyWalletFactory: proxyWalletFactory.address,
        fathomStablecoinProxyActions: FathomStablecoinProxyActions.address,
        collateralTokenAdapter: collateralTokenAdapter.address,
        delayFathomOraclePriceFeed: delayFathomOraclePriceFeed.address,
    }

    fs.writeFileSync('./addresses.json', JSON.stringify(newAddresses));
}