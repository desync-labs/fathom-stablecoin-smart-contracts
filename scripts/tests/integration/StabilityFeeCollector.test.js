const { BigNumber } = require("ethers");
const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRay, WeiPerWad } = require("../helper/unit");
const TimeHelpers = require("../helper/time");
const AssertHelpers = require("../helper/assert");
const { createProxyWallets } = require("../helper/proxy-wallets");
const { AliceAddress, DevAddress } = require("../helper/address");
const PositionHelper = require("../helper/positions");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");

    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

    ({
        proxyWallets: [aliceProxyWallet],
    } = await createProxyWallets([AliceAddress]));

    await stabilityFeeCollector.setSystemDebtEngine(DevAddress)

    await fathomStablecoin.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })

    return {
        bookKeeper,
        stablecoinAdapter,
        positionManager,
        stabilityFeeCollector,
        simplePriceFeed,
        collateralPoolConfig,
        aliceProxyWallet
    }
}

describe("Stability Fee", () => {
    // Proxy wallet
    let aliceProxyWallet

    // Contract
    let positionManager
    let bookKeeper
    // let tokenAdapter
    let stablecoinAdapter
    let stabilityFeeCollector
    let collateralPoolConfig
    let simplePriceFeed

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            bookKeeper,
            stablecoinAdapter,
            positionManager,
            // tokenAdapter,
            stabilityFeeCollector,
            simplePriceFeed,
            collateralPoolConfig,
            aliceProxyWallet
        } = await loadFixture(setup));
    })

    describe("#collect", () => {
        context("when call collect directly and call deposit", () => {
            it("should be success", async () => {
                await collateralPoolConfig.setStabilityFeeRate(pools.XDC, BigNumber.from("1000000005781378656804591713"), { gasLimit: 1000000 })

                // time increase 6 month
                await TimeHelpers.increase(TimeHelpers.duration.seconds(BigNumber.from("15768000")))
                await simplePriceFeed.setPrice(WeiPerRay, { gasLimit: 1000000 })
                await stabilityFeeCollector.collect(pools.XDC, { gasLimit: 1000000 })
                const debtAccumulatedRate = await collateralPoolConfig.collateralPools(pools.XDC)
                // debtAccumulatedRate = RAY(1000000005781378656804591713^15768000) = 1095445115010332226911367294
                AssertHelpers.assertAlmostEqual(
                    (debtAccumulatedRate).debtAccumulatedRate.toString(),
                    "1095445115010332226911367294"
                )
                AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "0")

                // position 1
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FUSD
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                // position debtShare = 5000000000000000000000000000000000000000000000 / 1095445115010332226911367294 = 4564354645876384278
                AssertHelpers.assertAlmostEqual(
                    (await bookKeeper.positions(pools.XDC, positionAddress)).debtShare.toString(),
                    "4564354645876384278"
                )
                AssertHelpers.assertAlmostEqual(
                    (await collateralPoolConfig.collateralPools(pools.XDC)).totalDebtShare.toString(),
                    "4564354645876384278"
                )
                AssertHelpers.assertAlmostEqual(
                    (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
                    "1095445115010332226911367294"
                )

                // time increase 1 year
                await TimeHelpers.increase(TimeHelpers.duration.seconds(BigNumber.from("31536000")))
                await simplePriceFeed.setPrice(WeiPerRay, { gasLimit: 1000000 })

                // position 2
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FUSD
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))

                const positionId2 = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress2 = await positionManager.positions(positionId2)

                // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1095445115010332226911367294) = 1314534138012398672287467301
                AssertHelpers.assertAlmostEqual(
                    (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
                    "1314534138012398672287467301"
                )
                // debtShare * diffDebtAccumulatedRate =  4564354645876384278 * (1314534138012398672287467301 - 1095445115010332226911367294) = 999999999999999999792432233173942358090489946
                AssertHelpers.assertAlmostEqual(
                    (await bookKeeper.stablecoin(DevAddress)).toString(),
                    "999999999999999999792432233173942358090489946"
                )

                // position debtShare = 5000000000000000000000000000000000000000000000 / 1314534138012398672287467301 = 3803628871563653565
                AssertHelpers.assertAlmostEqual(
                    (await bookKeeper.positions(pools.XDC, positionAddress2)).debtShare.toString(),
                    "3803628871563653565"
                )
                // 4564354645876384278 + 3803628871563653565 = 8367983517440037843
                AssertHelpers.assertAlmostEqual(
                    (await collateralPoolConfig.collateralPools(pools.XDC)).totalDebtShare.toString(),
                    "8367983517440037843"
                )

                // time increase 1 year
                await TimeHelpers.increase(TimeHelpers.duration.seconds(BigNumber.from("31536000")))
                await simplePriceFeed.setPrice(WeiPerRay, { gasLimit: 1000000 })

                // debtAccumulatedRate ~ 20%
                await stabilityFeeCollector.collect(pools.XDC, { gasLimit: 1000000 })

                // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1314534138012398672287467301) = 1577440965614878406737552619
                AssertHelpers.assertAlmostEqual(
                    (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
                    "1577440965614878406737552619"
                )
                // debtShare * diffDebtAccumulatedRate =  8367983517440037843 * (1577440965614878406737552619 - 1314534138012398672287467301) = 2199999999999999999533019044066331740498689074
                // 2199999999999999999533019044066331740498689074 + 999999999999999999792432233173942358090489946 = 3199999999999999999325451277240274098589179020
                AssertHelpers.assertAlmostEqual(
                    (await bookKeeper.stablecoin(DevAddress)).toString(),
                    "3199999999999999999325451277240274098589179020"
                )

                //  a. repay some FUSD
                //  b. alice unlock some WXDC
                await PositionHelper.wipeAndUnlockXDC(
                    aliceProxyWallet,
                    AliceAddress,
                    positionId,
                    WeiPerWad,
                    WeiPerWad
                )

                AssertHelpers.assertAlmostEqual(
                    (await collateralPoolConfig.collateralPools(pools.XDC)).debtAccumulatedRate.toString(),
                    "1577440965614878406737552619"
                )
                AssertHelpers.assertAlmostEqual(
                    (await bookKeeper.stablecoin(DevAddress)).toString(),
                    "3199999999999999999325451277240274098589179020"
                )
            })
        })
    })
})
