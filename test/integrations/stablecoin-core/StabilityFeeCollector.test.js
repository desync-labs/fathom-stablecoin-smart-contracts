

require("@openzeppelin/test-helpers")

const { ethers, upgrades } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const TimeHelpers = require("../../helper/time");
const AssertHelpers = require("../../helper/assert");
const { loadProxyWalletFixtureHandler } = require("../../helper/proxy");
const { formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const loadFixtureHandler = async () => {
  const [deployer, alice, , dev] = await ethers.getSigners()

  const AccessControlConfig = (await ethers.getContractFactory(
    "AccessControlConfig",
    deployer
  ))
  const accessControlConfig = (await upgrades.deployProxy(AccessControlConfig, []))
  const CollateralPoolConfig = (await ethers.getContractFactory(
    "CollateralPoolConfig",
    deployer
  ))
  const collateralPoolConfig = (await upgrades.deployProxy(CollateralPoolConfig, [
    accessControlConfig.address,
  ]))

  const BEP20 = (await ethers.getContractFactory("BEP20", deployer))
  const busd = await BEP20.deploy("BUSD", "BUSD")
  await busd.deployed()
  await busd.mint(await deployer.getAddress(), ethers.utils.parseEther("100"))
  await busd.mint(await alice.getAddress(), ethers.utils.parseEther("100"))

  // Deploy FathomStablecoin
  const FathomStablecoin = await ethers.getContractFactory("FathomStablecoin", deployer)
  const fathomStablecoin = (await upgrades.deployProxy(FathomStablecoin, ["Fathom USD", "FUSD"]))

  // Deploy mocked BookKeeper
  const BookKeeper = await ethers.getContractFactory("BookKeeper", deployer)
  const bookKeeper = (await upgrades.deployProxy(BookKeeper, [
    collateralPoolConfig.address,
    accessControlConfig.address,
  ]))
  await bookKeeper.deployed()

  await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), bookKeeper.address)

  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployer.address)

  const SimplePriceFeed = await ethers.getContractFactory("SimplePriceFeed", deployer)
  const simplePriceFeed = (await upgrades.deployProxy(SimplePriceFeed, [
    accessControlConfig.address,
  ]))
  await simplePriceFeed.deployed()

  const ShowStopper = await ethers.getContractFactory("ShowStopper", deployer)
  const showStopper = (await upgrades.deployProxy(ShowStopper, [bookKeeper.address]))
  await showStopper.deployed()

  const PositionManager = await ethers.getContractFactory("PositionManager", deployer)
  const positionManager = (await upgrades.deployProxy(PositionManager, [
    bookKeeper.address,
    showStopper.address,
  ]))
  await positionManager.deployed()

  const FathomStablecoinProxyActions = await ethers.getContractFactory("FathomStablecoinProxyActions", deployer)
  const fathomStablecoinProxyActions = await FathomStablecoinProxyActions.deploy()
  await fathomStablecoinProxyActions.deployed()

  const TokenAdapter = await ethers.getContractFactory("TokenAdapter", deployer)
  const busdTokenAdapter = (await upgrades.deployProxy(TokenAdapter, [
    bookKeeper.address,
    formatBytes32String("BUSD"),
    busd.address,
  ]))

  // Deploy TokenAdapter
  const tokenAdapter = (await upgrades.deployProxy(TokenAdapter, [
    bookKeeper.address,
    formatBytes32String("BTCB"),
    busd.address,
  ]))
  await tokenAdapter.deployed()

  const StablecoinAdapter = await ethers.getContractFactory("StablecoinAdapter", deployer)
  const stablecoinAdapter = (await upgrades.deployProxy(StablecoinAdapter, [
    bookKeeper.address,
    fathomStablecoin.address,
  ]))

  const SystemDebtEngine = (await ethers.getContractFactory("SystemDebtEngine", deployer))
  const systemDebtEngine = (await upgrades.deployProxy(SystemDebtEngine, [bookKeeper.address]))

  // Deploy StabilityFeeCollector
  const StabilityFeeCollector = await ethers.getContractFactory("StabilityFeeCollector", deployer)
  const stabilityFeeCollector = (await upgrades.deployProxy(StabilityFeeCollector, [
    bookKeeper.address,
    systemDebtEngine.address,
  ]))

  await stabilityFeeCollector.setSystemDebtEngine(await dev.getAddress())

  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["ADAPTER_ROLE"]),
    busdTokenAdapter.address
  )
  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["POSITION_MANAGER_ROLE"]),
    positionManager.address
  )
  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["COLLATERAL_MANAGER_ROLE"]),
    positionManager.address
  )
  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["STABILITY_FEE_COLLECTOR_ROLE"]),
    stabilityFeeCollector.address
  )

  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), stablecoinAdapter.address)

  await collateralPoolConfig.initCollateralPool(
    formatBytes32String("BUSD"),
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

  await collateralPoolConfig.setPriceWithSafetyMargin(formatBytes32String("BUSD"), WeiPerRay)

  // set total debt ceiling 100 rad
  await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100))

  return {
    fathomStablecoinProxyActions,
    positionManager,
    bookKeeper,
    stabilityFeeCollector,
    tokenAdapter: busdTokenAdapter,
    stablecoinAdapter,
    busd,
    fathomStablecoin,
    collateralPoolConfig,
  }
}

describe("Stability Fee", () => {
  // Accounts
  let deployer
  let alice
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let devAddress

  // Proxy wallet
  let deployerProxyWallet
  let aliceProxyWallet
  let bobProxyWallet

  // Contract
  let positionManager
  let fathomStablecoinProxyActions
  let fathomStablecoinProxyActionsAsAlice
  let bookKeeper
  let tokenAdapter
  let stablecoinAdapter
  let busd
  let stabilityFeeCollector
  let fathomStablecoin
  let collateralPoolConfig

  beforeEach(async () => {
    ;[deployer, alice, , dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      dev.getAddress(),
    ])
    ;({
      proxyWallets: [deployerProxyWallet, aliceProxyWallet, bobProxyWallet],
    } = await loadProxyWalletFixtureHandler())
    ;({
      fathomStablecoinProxyActions,
      positionManager,
      bookKeeper,
      tokenAdapter,
      stablecoinAdapter,
      busd,
      stabilityFeeCollector,
      fathomStablecoin,
      collateralPoolConfig,
    } = await loadFixtureHandler())

    const busdTokenAsAlice = busd.connect(alice)
    const fathomStablecoinAsAlice = fathomStablecoin.connect(alice)

    fathomStablecoinProxyActionsAsAlice = fathomStablecoinProxyActions.connect(alice)

    await busdTokenAsAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
    await fathomStablecoinAsAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
  })
  describe("#collect", () => {
    context("when call collect directly and call deposit", () => {
      it("should be success", async () => {
        // set stability fee rate 20% per year
        await collateralPoolConfig.setStabilityFeeRate(
          formatBytes32String("BUSD"),
          BigNumber.from("1000000005781378656804591713")
        )

        // time increase 6 month
        await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from("15768000")))
        await stabilityFeeCollector.collect(formatBytes32String("BUSD"))

        // debtAccumulatedRate = RAY(1000000005781378656804591713^15768000) = 1095445115010332226911367294
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(formatBytes32String("BUSD"))).debtAccumulatedRate.toString(),
          "1095445115010332226911367294"
        )
        AssertHelpers.assertAlmostEqual((await bookKeeper.stablecoin(devAddress)).toString(), "0")

        // position 1
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDrawCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            tokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        const openLockTokenAndDrawTx = await aliceProxyWallet.execute2(
          fathomStablecoinProxyActions.address,
          openLockTokenAndDrawCall
        )
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress = await positionManager.positions(positionId)

        // position debtShare = 5000000000000000000000000000000000000000000000 / 1095445115010332226911367294 = 4564354645876384278
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress)).debtShare.toString(),
          "4564354645876384278"
        )
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(formatBytes32String("BUSD"))).totalDebtShare.toString(),
          "4564354645876384278"
        )
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(formatBytes32String("BUSD"))).debtAccumulatedRate.toString(),
          "1095445115010332226911367294"
        )

        // time increase 1 year
        await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from("31536000")))

        // position 2
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDraw2Call = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            tokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        const openLockTokenAndDraw2Tx = await aliceProxyWallet.execute2(
          fathomStablecoinProxyActions.address,
          openLockTokenAndDrawCall
        )
        const positionId2 = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress2 = await positionManager.positions(positionId2)

        // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1095445115010332226911367294) = 1314534138012398672287467301
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(formatBytes32String("BUSD"))).debtAccumulatedRate.toString(),
          "1314534138012398672287467301"
        )
        // debtShare * diffDebtAccumulatedRate =  4564354645876384278 * (1314534138012398672287467301 - 1095445115010332226911367294) = 999999999999999999792432233173942358090489946
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.stablecoin(devAddress)).toString(),
          "999999999999999999792432233173942358090489946"
        )

        // position debtShare = 5000000000000000000000000000000000000000000000 / 1314534138012398672287467301 = 3803628871563653565
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress2)).debtShare.toString(),
          "3803628871563653565"
        )
        // 4564354645876384278 + 3803628871563653565 = 8367983517440037843
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(formatBytes32String("BUSD"))).totalDebtShare.toString(),
          "8367983517440037843"
        )

        // time increase 1 year
        await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from("31536000")))

        // debtAccumulatedRate ~ 20%
        await stabilityFeeCollector.collect(formatBytes32String("BUSD"))

        // debtAccumulatedRate = RAY((1000000005781378656804591713^31536000) * 1314534138012398672287467301) = 1577440965614878406737552619
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(formatBytes32String("BUSD"))).debtAccumulatedRate.toString(),
          "1577440965614878406737552619"
        )
        // debtShare * diffDebtAccumulatedRate =  8367983517440037843 * (1577440965614878406737552619 - 1314534138012398672287467301) = 2199999999999999999533019044066331740498689074
        // 2199999999999999999533019044066331740498689074 + 999999999999999999792432233173942358090489946 = 3199999999999999999325451277240274098589179020
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.stablecoin(devAddress)).toString(),
          "3199999999999999999325451277240274098589179020"
        )

        //  a. repay some FUSD
        //  b. alice unlock some ibBUSD
        //  c. convert BUSD to ibBUSD
        const wipeAndUnlockTokenCall = fathomStablecoinProxyActions.interface.encodeFunctionData("wipeAndUnlockToken", [
          positionManager.address,
          tokenAdapter.address,
          stablecoinAdapter.address,
          positionId,
          WeiPerWad.mul(1),
          WeiPerWad.mul(1),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
        ])
        const wipeAndUnlockTokenTx = await aliceProxyWallet.execute2(
          fathomStablecoinProxyActions.address,
          wipeAndUnlockTokenCall
        )

        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(formatBytes32String("BUSD"))).debtAccumulatedRate.toString(),
          "1577440965614878406737552619"
        )
        AssertHelpers.assertAlmostEqual(
          (await bookKeeper.stablecoin(devAddress)).toString(),
          "3199999999999999999325451277240274098589179020"
        )
      })
    })
  })
})
