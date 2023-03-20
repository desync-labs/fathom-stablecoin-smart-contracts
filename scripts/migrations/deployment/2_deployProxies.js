const { formatBytes32String } = require("ethers/lib/utils");

const ProxyAdmin = artifacts.require('FathomProxyAdmin.sol');

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const contracts = [
        "AccessControlConfig",
        "CollateralPoolConfig",
        "BookKeeper",
        "FathomStablecoin",
        "SystemDebtEngine",
        "LiquidationEngine",
        "StablecoinAdapter",
        "PriceOracle",
        "ShowStopper",
        "PositionManager",
        "FixedSpreadLiquidationStrategy",
        "StabilityFeeCollector",
        "ProxyWalletRegistry",
        "ProxyWalletFactory",
        "ProxyActionsStorage",
        "FlashMintModule",
        "StableSwapModule",
        "FlashMintArbitrager",
        "BookKeeperFlashMintArbitrager",
        "DelayFathomOraclePriceFeed",
        "DexPriceOracle",
        "CollateralTokenAdapter",
        "SlidingWindowDexOracle",
    ]

    const promises = contracts.map(contract => {
        const instance = artifacts.require(contract + ".sol");
        return proxyFactory.createProxy(formatBytes32String(contract), instance.address, ProxyAdmin.address, "0x", { gasLimit: 2000000 })
    });

    await Promise.all(promises);
}