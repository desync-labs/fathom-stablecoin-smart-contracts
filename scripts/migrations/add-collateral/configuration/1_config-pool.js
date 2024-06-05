const { getProxy, getProxyById } = require("../../../common/proxies");

const { BigNumber } = require("ethers");
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const CLOSE_FACTOR_BPS = BigNumber.from(500)   // <- 0.5
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)  // <- 1.05
const TREASURY_FEE_BPS = BigNumber.from(8000) // <- 0.8
const STABILITY_FEE = BigNumber.from("1000000000627937192491029811")
const LIQUIDATIONRATIO_75 = WeiPerRay.mul(133).div(100).toString(); // LTV 75%
const DEBT_CEILING = WeiPerRad.mul(10000000)

const { getConfig, getProxyId, poolId } = require("../../../common/add-collateral-helper")

module.exports = async function (deployer) {
    const config = getConfig(deployer.networkId());

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", config.fathomProxyFactory);
    const collateralTokenAdapter = await getProxyById(proxyFactory, "CollateralTokenAdapter", getProxyId("CollateralTokenAdapter"));
    const fixedSpreadLiquidationStrategy = "0xfe5037504E0EF5eC2DfBEEA03f9d9cB43580EF23";
    // above FSLS better be hardcoded
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig")
    const priceOracle = await getProxy(proxyFactory, "PriceOracle")

    // const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed");
    // 2024.05.23 simplePriceFeed should be the one that's been recently deployed. so use below line instead of getProxy
    const simplePriceFeedNewCol = await artifacts.initializeInterfaceAt("SimplePriceFeedNewCol", "SimplePriceFeedNewCol");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");

    await simplePriceFeedNewCol.initialize(accessControlConfig.address);
    await simplePriceFeedNewCol.setPoolId(poolId);
    await simplePriceFeedNewCol.setPrice(WeiPerWad.toString());

    const priceFeed = simplePriceFeedNewCol;
=
    const priceFeed = await getProxyById(proxyFactory, "CentralizedOraclePriceFeed", getProxyId("CentralizedOraclePriceFeed"));
    await priceFeed.peekPrice({ gasLimit: 2000000 });

    await collateralPoolConfig.initCollateralPool(
        poolId,
        DEBT_CEILING,
        0,
        WeiPerRad.mul(50000),
        priceFeed.address,
        LIQUIDATIONRATIO_75,
        STABILITY_FEE,
        collateralTokenAdapter.address,
        CLOSE_FACTOR_BPS,
        LIQUIDATOR_INCENTIVE_BPS,
        TREASURY_FEE_BPS,
        fixedSpreadLiquidationStrategy,
        { gas: 5000000 }
    )

    await priceOracle.setPrice(poolId, { gasLimit: 2000000 });
}