const { formatBytes32String } = require("ethers/lib/utils");
const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")

module.exports = async function (deployer) {
    const getPositions = await artifacts.initializeInterfaceAt("GetPositions", "GetPositions");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");
    const fixedSpreadLiquidationStrategy = await artifacts.initializeInterfaceAt("FixedSpreadLiquidationStrategy", "FixedSpreadLiquidationStrategy");
    const proxyWalletRegistry = await artifacts.initializeInterfaceAt("ProxyWalletRegistry", "ProxyWalletRegistry");
    const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
    const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
    const showStopper = await artifacts.initializeInterfaceAt("ShowStopper", "ShowStopper");
    const priceOracle = await artifacts.initializeInterfaceAt("PriceOracle", "PriceOracle");
    const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");
    const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
    const systemDebtEngine = await artifacts.initializeInterfaceAt("SystemDebtEngine", "SystemDebtEngine");
    const liquidationEngine = await artifacts.initializeInterfaceAt("LiquidationEngine", "LiquidationEngine");
    const bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
    const collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
    const accessControlConfig = await artifacts.initializeInterfaceAt("AccessControlConfig", "AccessControlConfig");
    const flashMintModule = await artifacts.initializeInterfaceAt("FlashMintModule", "FlashMintModule");
    const stableSwapModule = await artifacts.initializeInterfaceAt("StableSwapModule", "StableSwapModule");
    const authTokenAdapter = await artifacts.initializeInterfaceAt("AuthTokenAdapter", "AuthTokenAdapter");
    const proxyWalletFactory = await artifacts.initializeInterfaceAt("ProxyWalletFactory", "ProxyWalletFactory");
    const WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");

    let promises = [
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
        proxyWalletRegistry.initialize(
            proxyWalletFactory.address
        ),
        getPositions.initialize({ gaslimit: 4050000 }),
        flashMintModule.initialize(
            stablecoinAdapter.address,
            systemDebtEngine.address,
            { gasLimit: 1000000 }
        ),
        authTokenAdapter.initialize(
            bookKeeper.address,
            COLLATERAL_POOL_ID_WXDC,
            WXDC.address,
            { gasLimit: 1000000 }
        ),
        stableSwapModule.initialize(
            authTokenAdapter.address,
            stablecoinAdapter.address,
            systemDebtEngine.address,
            { gasLimit: 1000000 }
        )
    ];

    await Promise.all(promises);


}