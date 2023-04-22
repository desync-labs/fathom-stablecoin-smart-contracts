const pools = require("../../../common/collateral");
const { getProxy } = require("../../../common/proxies");

const { BigNumber } = require("ethers");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const CLOSE_FACTOR_BPS = BigNumber.from(2500)   // <- 0.25
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(8000) // <- 0.8
const STABILITY_FEE = BigNumber.from("1000000000627937192491029811")

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");

    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy")
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper")
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig")
    const priceOracle = await getProxy(proxyFactory, "PriceOracle")
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

    await simplePriceFeed.initialize(accessControlConfig.address, { gasLimit: 5000000 });

    const debtCeilingSetUpTotal = WeiPerRad.mul(100000000000000);
    const debtCeilingSetUp = WeiPerRad.mul(100000000000000);
    await simplePriceFeed.setPoolId(pools.XDC);
    await simplePriceFeed.setPrice(WeiPerWad.mul(1), { gasLimit: 2000000 });
    await simplePriceFeed.setPoolId(pools.XDC, { gasLimit: 2000000 });

    const promises = [
        initPool(pools.XDC, collateralTokenAdapter.address, simplePriceFeed.address, WeiPerRay)
    ]

    await Promise.all(promises);

    await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal, { gasLimit: 2000000 });

    async function initPool(poolId, adapter, priceFeed, liquidationRatio) {
        await collateralPoolConfig.initCollateralPool(
            poolId,
            debtCeilingSetUp,
            0,
            WeiPerRad.mul(10000),
            priceFeed,
            liquidationRatio,
            STABILITY_FEE,
            adapter,
            CLOSE_FACTOR_BPS.mul(2),
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            fixedSpreadLiquidationStrategy.address,
            { gas: 5000000 }
        );

        await priceOracle.setPrice(poolId, { gasLimit: 2000000 });
    }
}