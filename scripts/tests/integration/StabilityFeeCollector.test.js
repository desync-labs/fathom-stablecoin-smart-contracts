require("@openzeppelin/test-helpers")

const { BigNumber } = require("ethers");
const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const TimeHelpers = require("../helper/time");
const AssertHelpers = require("../helper/assert");
const { loadProxyWalletFixtureHandler } = require("../helper/proxy");
const { AliceAddress, DevAddress, AddressZero } = require("../helper/address");
const { formatBytes32String } = require("ethers/lib/utils");
const PositionHelper = require("../helper/positions");

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

describe("Stability Fee", () => {
  // Proxy wallet
  let aliceProxyWallet

  // Contract
  let positionManager
  let bookKeeper
  let tokenAdapter
  let stablecoinAdapter
  let stabilityFeeCollector
  let fathomStablecoin
  let collateralPoolConfig

  beforeEach(async () => {
    await snapshot.revertToSnapshot();
    ; ({
      proxyWallets: [aliceProxyWallet],
    } = await loadProxyWalletFixtureHandler([AliceAddress]))

    bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
    collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
    stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
    fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");
    positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
    stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");
    const WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");

    const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");
    const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.getAdapter(COLLATERAL_POOL_ID)
    tokenAdapter = await artifacts.initializeInterfaceAt("CollateralTokenAdapter", collateralTokenAdapterAddress);

    await stabilityFeeCollector.setSystemDebtEngine(DevAddress)

    await collateralPoolConfig.initCollateralPool(
      COLLATERAL_POOL_ID,
      // set pool debt ceiling 100 rad
      WeiPerRad.mul(100),
      // set position debt floor 1 rad
      WeiPerRad.mul(1),
      simplePriceFeed.address,
      WeiPerRay,
      WeiPerRay,
      tokenAdapter.address,
      CLOSE_FACTOR_BPS,
      LIQUIDATOR_INCENTIVE_BPS,
      TREASURY_FEE_BPS,
      AddressZero
    )

    await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay, { gasLimit: 1000000 })
    await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100), { gasLimit: 1000000 })
    await WXDC.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })
    await fathomStablecoin.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })
  })
  describe("#collect", () => {
    context("when call collect directly and call deposit", () => {
      it("should be success", async () => {
        // set stability fee rate 20% per year
        // await collateralPoolConfig.setStabilityFeeRate(
        //   COLLATERAL_POOL_ID,
        //   BigNumber.from("1000000005781378656804591713"),
        //   { gasLimit: 1000000 }


    await collateralPoolConfig.setStabilityFeeRate(COLLATERAL_POOL_ID, BigNumber.from("1000000005781378656804591713"), { gasLimit: 1000000 })

        // var rate = await collateralPoolConfig.getStabilityFeeRate(COLLATERAL_POOL_ID, { gasLimit: 1000000 });

        // time increase 6 month
        await TimeHelpers.increase(TimeHelpers.duration.seconds(BigNumber.from("15768000")))
        await stabilityFeeCollector.collect(COLLATERAL_POOL_ID, { gasLimit: 1000000 })
        const debtAccumulatedRate = await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)
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
        await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(10), WeiPerWad.mul(5))
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress = await positionManager.positions(positionId)

        // position debtShare = 5000000000000000000000000000000000000000000000 / 1095445115010332226911367294 = 4564354645876384278
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.positions(COLLATERAL_POOL_ID, positionAddress)).debtShare.toString(),
          "4564354645876384278"
        )
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).totalDebtShare.toString(),
          "4564354645876384278"
        )
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).debtAccumulatedRate.toString(),
          "1095445115010332226911367294"
        )

        // time increase 1 year
        await TimeHelpers.increase(TimeHelpers.duration.seconds(BigNumber.from("31536000")))

        // position 2
        //  a. open a new position
        //  b. lock WXDC
        //  c. mint FUSD
        await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(10), WeiPerWad.mul(5))

        const positionId2 = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress2 = await positionManager.positions(positionId2)

        // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1095445115010332226911367294) = 1314534138012398672287467301
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).debtAccumulatedRate.toString(),
          "1314534138012398672287467301"
        )
        // debtShare * diffDebtAccumulatedRate =  4564354645876384278 * (1314534138012398672287467301 - 1095445115010332226911367294) = 999999999999999999792432233173942358090489946
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.stablecoin(DevAddress)).toString(),
          "999999999999999999792432233173942358090489946"
        )

        // position debtShare = 5000000000000000000000000000000000000000000000 / 1314534138012398672287467301 = 3803628871563653565
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.positions(COLLATERAL_POOL_ID, positionAddress2)).debtShare.toString(),
          "3803628871563653565"
        )
        // 4564354645876384278 + 3803628871563653565 = 8367983517440037843
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).totalDebtShare.toString(),
          "8367983517440037843"
        )

        // time increase 1 year
        await TimeHelpers.increase(TimeHelpers.duration.seconds(BigNumber.from("31536000")))

        // debtAccumulatedRate ~ 20%
        await stabilityFeeCollector.collect(COLLATERAL_POOL_ID, { gasLimit: 1000000 })

        // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1314534138012398672287467301) = 1577440965614878406737552619
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).debtAccumulatedRate.toString(),
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
        await PositionHelper.wipeAndUnlockToken(
          aliceProxyWallet,
          AliceAddress,
          tokenAdapter.address,
          stablecoinAdapter.address,
          positionId,
          WeiPerWad,
          WeiPerWad
        )

        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).debtAccumulatedRate.toString(),
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
