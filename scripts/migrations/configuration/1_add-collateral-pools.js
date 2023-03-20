const pools = require("../../common/collateral");
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");

const { BigNumber } = require("ethers");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const CLOSE_FACTOR_BPS = BigNumber.from(2500)   // <- 0.25
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(8000) // <- 0.8
const STABILITY_FEE = BigNumber.from("1000000000627937192491029811")
const LIQUIDATIONRATIO_75 = WeiPerRay.mul(133).div(100).toString(); // LTV 75%

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy")
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper")
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig")
    const priceOracle = await getProxy(proxyFactory, "PriceOracle")
    const delayFathomOraclePriceFeed = await getProxy(proxyFactory, "DelayFathomOraclePriceFeed");
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

    const debtCeilingSetUpTotal = WeiPerRad.mul(10000000);
    const debtCeilingSetUp = WeiPerRad.mul(10000000).div(2);

    const promises = [
        initPool(pools.XDC, collateralTokenAdapter.address, delayFathomOraclePriceFeed.address, LIQUIDATIONRATIO_75),
    ]

    await Promise.all(promises);

    await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal, { gasLimit: 2000000 });
    await delayFathomOraclePriceFeed.peekPrice({ gasLimit: 2000000 });

    async function initPool(poolId, adapter, priceFeed, liquidationRatio) {
        await collateralPoolConfig.initCollateralPool(
            poolId,
            debtCeilingSetUp,
            0,
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