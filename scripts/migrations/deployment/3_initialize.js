const fs = require('fs');
const { BigNumber } = require('ethers');

const pools = require("../../common/collateral");
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");
const { ethers } = require("ethers");

const FathomStablecoinProxyActions = artifacts.require('FathomStablecoinProxyActions.sol');

const {Deployer} = require("../../common/addresses");

const TREASURY_FEE_BPS = BigNumber.from(5000) // <- 0.5
const ERC20Stable = artifacts.require('ERC20MintableStableSwap.sol')

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const proxyWalletFactory = await artifacts.initializeInterfaceAt("ProxyWalletFactory", "ProxyWalletFactory");

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
    const delayFathomOraclePriceFeed = await getProxy(proxyFactory, "DelayFathomOraclePriceFeed");
    const dexPriceOracle = await getProxy(proxyFactory, "DexPriceOracle");
    const ankrCollateralAdapter = await getProxy(proxyFactory, "AnkrCollateralAdapter");

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
        simplePriceFeed.initialize(
            accessControlConfig.address,
            { gasLimit: 5000000 }
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
        proxyWalletRegistry.initialize(proxyWalletFactory.address, { gasLimit: 1000000 }),
        flashMintModule.initialize(
            stablecoinAdapter.address,
            systemDebtEngine.address,
            { gasLimit: 1000000 }
        ),
        authTokenAdapter.initialize(
            bookKeeper.address,
            pools.USD_STABLE,
            addresses.USD,
            { gasLimit: 1000000 }
        ),
        //@notice: IMP!! ERC20Stable.address has to be changed to real address FXD in prod 
        stableSwapModule.initialize(
            bookKeeper.address,
            addresses.USD,
            ERC20Stable.address,
            dailyLimit,
            { gasLimit: 1000000 }
        ),
        flashMintArbitrager.initialize({ gasLimit: 1000000 }),
        bookKeeperFlashMintArbitrager.initialize(fathomStablecoin.address, { gasLimit: 1000000 }),
        dexPriceOracle.initialize(addresses.DEXFactory, { gasLimit: 1000000 }),
        ankrCollateralAdapter.initialize(
            bookKeeper.address,
            pools.XDC,
            addresses.xdcPool,
            addresses.aXDCc,
            TREASURY_FEE_BPS,
            //TODO: use treasury wallet
            Deployer,
            positionManager.address
        ),
        delayFathomOraclePriceFeed.initialize(
            dexPriceOracle.address,
            addresses.USD,
            addresses.WXDC,
            accessControlConfig.address
        )
    ];

    await Promise.all(promises);

    const newAddresses = {
        proxyFactory: proxyFactory.address,
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
        dexPriceOracle: dexPriceOracle.address,
        proxyWalletFactory: proxyWalletFactory.address,
        fathomStablecoinProxyActions: FathomStablecoinProxyActions.address,
        ankrCollateralAdapter: ankrCollateralAdapter.address,
        delayFathomOraclePriceFeed: delayFathomOraclePriceFeed.address
    }

    fs.writeFileSync('./addresses.json', JSON.stringify(newAddresses));
}