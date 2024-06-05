const pools = require("../../common/collateral");
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");
const { 
    getConfig
} = require("../../common/collateral-setup-helper");

const { BigNumber } = require("ethers");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());
    const CLOSE_FACTOR_BPS = BigNumber.from(config.CLOSE_FACTOR_BPS)   // <- 0.25
    const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(config.LIQUIDATOR_INCENTIVE_BPS)  // <- 1.05
    const TREASURY_FEE_BPS = BigNumber.from(config.TREASURY_FEE_BPS) // <- 0.8
    const STABILITY_FEE = BigNumber.from(config.STABILITY_FEE)
    const LIQUIDATIONRATIO = WeiPerRay.mul(config.LIQUIDATIONRATIO_NUMERATOR).div(config.LIQUIDATIONRATIO_DENOMINATOR).toString(); // LTV 75%
    const debtCeilingSetUpTotal = WeiPerRad.mul(config.DEBTCELINGSETUP_TOTAL);
    const debtCeilingSetUp = WeiPerRad.mul(config.DEBTCELINGSETUP_NUMERATOR).div(config.DEBTCELINGSETUP_DENOMINATOR);
    const debtFloor = WeiPerRad.mul(config.DEBT_FLOOR);
    const positionDebtCeiling = WeiPerRad.mul(config.POSITION_DEBT_CEILING);

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy")
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper")
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig")
    const priceOracle = await getProxy(proxyFactory, "PriceOracle")
    const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed");
    // const centralizedOraclePriceFeed = await getProxy(proxyFactory, "CentralizedOraclePriceFeed");
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");

    // initial collateral price as 1 USD
    await simplePriceFeed.setPrice(WeiPerWad.toString());
    await simplePriceFeed.setPoolId(pools.XDC);
    await simplePriceFeed.peekPrice();
    // await centralizedOraclePriceFeed.peekPrice({ gasLimit: 2000000 });

    const promises = [
        initPool(pools.NATIVE, collateralTokenAdapter.address, simplePriceFeed.address, LIQUIDATIONRATIO),
    ]

    await Promise.all(promises);

    await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal, { gasLimit: 2000000 });


    async function initPool(poolId, adapter, priceFeed, liquidationRatio) {
        await collateralPoolConfig.initCollateralPool(
            poolId,
            debtCeilingSetUp,
            debtFloor, // _debtFloor
            positionDebtCeiling, // _positionDebtCeiling
            priceFeed,
            liquidationRatio,
            STABILITY_FEE,
            adapter,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            fixedSpreadLiquidationStrategy.address,
            { gas: 5000000 }
        );

        await priceOracle.setPrice(poolId, { gasLimit: 2000000 });
    }
}