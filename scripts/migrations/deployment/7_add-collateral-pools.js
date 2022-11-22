const pools = require("../../common/collateral");
const { getAddresses } = require("../../common/addresses");
const { getProxy } = require("../../common/proxies");

const { BigNumber } = require("ethers");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const CLOSE_FACTOR_BPS = BigNumber.from(5000)   // <- 0.5
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(5000) // <- 0.5
const LIQUIDATIONRATIO_75 = WeiPerRay.mul(133).div(100).toString();
// LTV 75%

module.exports = async function (deployer) {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed")
    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
    const fixedSpreadLiquidationStrategy = await getProxy(proxyFactory, "FixedSpreadLiquidationStrategy")
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper")
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig")
    const priceOracle = await getProxy(proxyFactory, "PriceOracle")
    const fathomOraclePriceFeedFactory = await getProxy(proxyFactory, "FathomOraclePriceFeedFactory");

    const addresses = getAddresses(deployer.networkId())

    const wxdcAdapter = await collateralTokenAdapterFactory.adapters(pools.WXDC)
    const usdtAdapter = await collateralTokenAdapterFactory.adapters(pools.USDT)
    const fthmAdapter = await collateralTokenAdapterFactory.adapters(pools.FTHM)

    const priceFeedWXDC = await fathomOraclePriceFeedFactory.feeds(addresses.WXDC)
    const pricefeedFTHM = await fathomOraclePriceFeedFactory.feeds(addresses.FTHM)

    const debtCeilingSetUpTotal = WeiPerRad.mul(10000000);
    const debtCeilingSetUp = WeiPerRad.mul(10000000).div(2);

    await simplePriceFeed.setPrice(WeiPerWad.mul(1), { gasLimit: 1000000 });

    const promises = [
        initPool(pools.WXDC, wxdcAdapter, priceFeedWXDC, LIQUIDATIONRATIO_75),
        // we initiate pool with simple price feed because at this moment liquidity 
        initPool(pools.USDT, usdtAdapter, simplePriceFeed.address, LIQUIDATIONRATIO_75),
        initPool(pools.FTHM, fthmAdapter, pricefeedFTHM, LIQUIDATIONRATIO_75),
        initPool(pools.USDT_COL, usdtAdapter, simplePriceFeed.address, WeiPerRay),
    ]

    await Promise.all(promises);

    await bookKeeper.setTotalDebtCeiling(debtCeilingSetUpTotal, { gasLimit: 1000000 });

    async function initPool(poolId, adapter, priceFeed, liquidationRatio) {
        await collateralPoolConfig.initCollateralPool(
            poolId,
            0,
            0,
            priceFeed,
            liquidationRatio,
            WeiPerRay,
            adapter,
            CLOSE_FACTOR_BPS.mul(2),
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            fixedSpreadLiquidationStrategy.address,
            { gas: 4000000 }
        );

        await collateralPoolConfig.setDebtCeiling(poolId, debtCeilingSetUp, { gasLimit: 1000000 });
        await priceOracle.setPrice(poolId, { gasLimit: 1000000 });
    }
}