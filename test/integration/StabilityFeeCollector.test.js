const { ethers } = require("hardhat");
const provider = ethers.provider;
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { BigNumber } = ethers;

const { WeiPerRay, WeiPerWad } = require("../helper/unit");
const AssertHelpers = require("../helper/assert");
const { createProxyWallets } = require("../helper/proxy-wallets");
const { AliceAddress, DevAddress } = require("../helper/address");
const PositionHelper = require("../helper/positions");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");

describe("Stability Fee", () => {
  // Proxy wallet
  let aliceProxyWallet;

  // Contract
  let positionManager;
  let bookKeeper;
  // let tokenAdapter
  let stablecoinAdapter;
  let stabilityFeeCollector;
  let collateralPoolConfig;
  let simplePriceFeed;

  beforeEach(async () => {
    await deployments.fixture(["DeployTestFixture"]);

    const ProxyFactory = await deployments.get("FathomProxyFactory");
    const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
    const SimplePriceFeed = await deployments.get("SimplePriceFeed");
    simplePriceFeed = await ethers.getContractAt("SimplePriceFeed", SimplePriceFeed.address);

    collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    positionManager = await getProxy(proxyFactory, "PositionManager");
    stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

    const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
    await proxyWalletRegistry.setDecentralizedMode(true);

    ({
      proxyWallets: [aliceProxyWallet],
    } = await createProxyWallets([AliceAddress]));

    await stabilityFeeCollector.setSystemDebtEngine(DevAddress);

    await fathomStablecoin.connect(provider.getSigner(AliceAddress)).approve(aliceProxyWallet.address, WeiPerWad.mul(10000));
  });

  describe("#collect", () => {
    context("when call collect directly and call deposit", () => {
      it("should be success", async () => {
        await collateralPoolConfig.setStabilityFeeRate(pools.NATIVE, BigNumber.from("1000000005781378656804591713"));

        // time increase 6 month
        await time.increase(15768000);
        await simplePriceFeed.setPrice(WeiPerRay);
        await stabilityFeeCollector.collect(pools.NATIVE);
        const debtAccumulatedRate = await collateralPoolConfig.collateralPools(pools.NATIVE);
        // debtAccumulatedRate = RAY(1000000005781378656804591713^15768000) = 1095445115010332226911367294
        AssertHelpers.assertAlmostEqual(debtAccumulatedRate.debtAccumulatedRate.toString(), "1095445115010332226911367294");
        AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "0");

        // position 1
        //  a. open a new position
        //  b. lock WNATIVE
        //  c. mint FXD
        await PositionHelper.openNATIVEPositionAndDraw(aliceProxyWallet, AliceAddress, pools.NATIVE, WeiPerWad.mul(10), WeiPerWad.mul(5));
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        const positionAddress = await positionManager.positions(positionId);

        // position debtShare = 5000000000000000000000000000000000000000000000 / 1095445115010332226911367294 = 4564354645876384278
        AssertHelpers.assertAlmostEqual((await bookKeeper.positions(pools.NATIVE, positionAddress)).debtShare.toString(), "4564354645876384278");
        AssertHelpers.assertAlmostEqual((await collateralPoolConfig.collateralPools(pools.NATIVE)).totalDebtShare.toString(), "4564354645876384278");
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(pools.NATIVE)).debtAccumulatedRate.toString(),
          "1095445115010332226911367294"
        );

        // time increase 1 year
        await time.increase(31536000);
        await simplePriceFeed.setPrice(WeiPerRay);

        // position 2
        //  a. open a new position
        //  b. lock WNATIVE
        //  c. mint FXD
        await PositionHelper.openNATIVEPositionAndDraw(aliceProxyWallet, AliceAddress, pools.NATIVE, WeiPerWad.mul(10), WeiPerWad.mul(5));

        const positionId2 = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        const positionAddress2 = await positionManager.positions(positionId2);

        // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1095445115010332226911367294) = 1314534138012398672287467301
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(pools.NATIVE)).debtAccumulatedRate.toString(),
          "1314534138012398672287467301"
        );
        // debtShare * diffDebtAccumulatedRate =  4564354645876384278 * (1314534138012398672287467301 - 1095445115010332226911367294) = 999999999999999999792432233173942358090489946
        AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "999999999999999999792432233173942358090489946");

        // position debtShare = 5000000000000000000000000000000000000000000000 / 1314534138012398672287467301 = 3803628871563653565
        AssertHelpers.assertAlmostEqual((await bookKeeper.positions(pools.NATIVE, positionAddress2)).debtShare.toString(), "3803628871563653565");
        // 4564354645876384278 + 3803628871563653565 = 8367983517440037843
        AssertHelpers.assertAlmostEqual((await collateralPoolConfig.collateralPools(pools.NATIVE)).totalDebtShare.toString(), "8367983517440037843");

        // time increase 1 year
        await time.increase(31536000);
        await simplePriceFeed.setPrice(WeiPerRay);

        // debtAccumulatedRate ~ 20%
        await stabilityFeeCollector.collect(pools.NATIVE);

        // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1314534138012398672287467301) = 1577440965614878406737552619
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(pools.NATIVE)).debtAccumulatedRate.toString(),
          "1577440965614878406737552619"
        );
        // debtShare * diffDebtAccumulatedRate =  8367983517440037843 * (1577440965614878406737552619 - 1314534138012398672287467301) = 2199999999999999999533019044066331740498689074
        // 2199999999999999999533019044066331740498689074 + 999999999999999999792432233173942358090489946 = 3199999999999999999325451277240274098589179020
        AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "3199999999999999999325451277240274098589179020");

        //  a. repay some FXD
        //  b. alice unlock some WNATIVE
        await PositionHelper.wipeAndUnlockNATIVE(aliceProxyWallet, AliceAddress, positionId, WeiPerWad, WeiPerWad);

        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(pools.NATIVE)).debtAccumulatedRate.toString(),
          "1577440965614878406737552619"
        );
        AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(DevAddress)).toString(), "3199999999999999999325451277240274098589179020");
      });
    });
  });
});
