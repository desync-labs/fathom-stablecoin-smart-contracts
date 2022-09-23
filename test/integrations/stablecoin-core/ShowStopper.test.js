require("@openzeppelin/test-helpers")

const { ethers, upgrades } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { advanceBlock } = require("../../helper/time");
const { loadProxyWalletFixtureHandler } = require("../../helper/proxy");
const { formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const loadFixtureHandler = async () => {
  const [deployer, alice, bob] = await ethers.getSigners()

  const AccessControlConfig = (await ethers.getContractFactory(
    "AccessControlConfig",
    deployer
  ))
  const accessControlConfig = (await upgrades.deployProxy(AccessControlConfig))

  const CollateralPoolConfig = (await ethers.getContractFactory(
    "CollateralPoolConfig",
    deployer
  ))
  const collateralPoolConfig = (await upgrades.deployProxy(CollateralPoolConfig, [
    accessControlConfig.address,
  ]))

  // Deploy BEP20
  const BEP20 = (await ethers.getContractFactory("BEP20", deployer))

  const BUSD = await BEP20.deploy("BUSD", "BUSD")
  await BUSD.deployed()
  //   await baseToken.mint(await deployer.getAddress(), ethers.utils.parseEther("100"))
  await BUSD.mint(await alice.getAddress(), ethers.utils.parseEther("100"))
  await BUSD.mint(await bob.getAddress(), ethers.utils.parseEther("100"))

  const USDT = await BEP20.deploy("BUSD", "BUSD")
  await USDT.deployed()
  await USDT.mint(await bob.getAddress(), ethers.utils.parseEther("100"))

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

  const PriceOracle = await ethers.getContractFactory("PriceOracle", deployer)
  const priceOracle = (await upgrades.deployProxy(PriceOracle, [bookKeeper.address]))

  const SimplePriceFeed = await ethers.getContractFactory("SimplePriceFeed", deployer)
  const simplePriceFeed = (await upgrades.deployProxy(SimplePriceFeed, [
    accessControlConfig.address,
  ]))
  await simplePriceFeed.setPrice(WeiPerWad)

  await accessControlConfig.grantRole(await accessControlConfig.OWNER_ROLE(), deployer.address)

  collateralPoolConfig.setPriceFeed(formatBytes32String("BUSD"), simplePriceFeed.address)
  collateralPoolConfig.setPriceFeed(formatBytes32String("USDT"), simplePriceFeed.address)

  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployer.address)
  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), priceOracle.address)

  await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100))

  const ShowStopper = await ethers.getContractFactory("ShowStopper", deployer)
  const showStopper = (await upgrades.deployProxy(ShowStopper, [bookKeeper.address]))

  const PositionManager = await ethers.getContractFactory("PositionManager", deployer)
  const positionManager = (await upgrades.deployProxy(PositionManager, [
    bookKeeper.address,
    showStopper.address,
  ]))

  const GetPositions = await ethers.getContractFactory("GetPositions", deployer)
  const getPositions = await GetPositions.deploy()

  const FathomStablecoinProxyActions = await ethers.getContractFactory("FathomStablecoinProxyActions", deployer)
  const fathomStablecoinProxyActions = await FathomStablecoinProxyActions.deploy()

  const TokenAdapter = await ethers.getContractFactory("TokenAdapter", deployer)
  const busdTokenAdapter = (await upgrades.deployProxy(TokenAdapter, [
    bookKeeper.address,
    formatBytes32String("BUSD"),
    BUSD.address,
  ]))

  const usdtTokenAdapter = (await upgrades.deployProxy(TokenAdapter, [
    bookKeeper.address,
    formatBytes32String("USDT"),
    USDT.address,
  ]))

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

  const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine", deployer)
  const liquidationEngine = (await upgrades.deployProxy(LiquidationEngine, [
    bookKeeper.address,
    systemDebtEngine.address,
  ]))

  // await showStopper.setBookKeeper(bookKeeper.address)
  await showStopper.setLiquidationEngine(liquidationEngine.address)
  await showStopper.setSystemDebtEngine(systemDebtEngine.address)
  await showStopper.setPriceOracle(priceOracle.address)

  // init BUSD pool
  await collateralPoolConfig.initCollateralPool(
    formatBytes32String("BUSD"),
    // set pool debt ceiling 100 rad
    WeiPerRad.mul(100),
    // set position debt floor 1 rad
    WeiPerRad.mul(1),
    simplePriceFeed.address,
    WeiPerRay,
    WeiPerRay,
    busdTokenAdapter.address,
    CLOSE_FACTOR_BPS,
    LIQUIDATOR_INCENTIVE_BPS,
    TREASURY_FEE_BPS,
    AddressZero
  )
  // set price with safety margin 1 ray (1 BUSD = 1 USD)
  await collateralPoolConfig.setPriceWithSafetyMargin(formatBytes32String("BUSD"), WeiPerRay)

  // init USDT pool
  await collateralPoolConfig.initCollateralPool(
    formatBytes32String("USDT"),
    // set pool debt ceiling 100 rad
    WeiPerRad.mul(100),
    // set position debt floor 1 rad
    WeiPerRad.mul(1),
    simplePriceFeed.address,
    WeiPerRay,
    WeiPerRay,
    usdtTokenAdapter.address,
    CLOSE_FACTOR_BPS,
    LIQUIDATOR_INCENTIVE_BPS,
    TREASURY_FEE_BPS,
    AddressZero
  )
  // set price with safety margin 1 ray (1 USDT = 1 USD)
  await collateralPoolConfig.setPriceWithSafetyMargin(formatBytes32String("USDT"), WeiPerRay)

  await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), bookKeeper.address)
  await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), liquidationEngine.address)
  await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), showStopper.address)
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), showStopper.address)
  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), priceOracle.address)
  await accessControlConfig.grantRole(await accessControlConfig.ADAPTER_ROLE(), busdTokenAdapter.address)
  await accessControlConfig.grantRole(await accessControlConfig.ADAPTER_ROLE(), usdtTokenAdapter.address)
  await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), positionManager.address)
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), positionManager.address)
  await accessControlConfig.grantRole(
    await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(),
    stabilityFeeCollector.address
  )
  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), stablecoinAdapter.address)

  return {
    positionManager,
    fathomStablecoinProxyActions,
    stabilityFeeCollector,
    busdTokenAdapter,
    usdtTokenAdapter,
    stablecoinAdapter,
    showStopper,
    bookKeeper,
    liquidationEngine,
    systemDebtEngine,
    priceOracle,
    getPositions,
    accessControlConfig,
    BUSD,
    USDT,
    fathomStablecoin
  }
}


describe("ShowStopper", () => {
  // Accounts
  let deployer
  let alice
  let bob
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let bobAddress
  let devAddress

  // Proxy wallet
  let deployerProxyWallet
  let aliceProxyWallet
  let bobProxyWallet

  // Contract
  let positionManager
  let fathomStablecoinProxyActions
  let showStopper
  let bookKeeper
  let liquidationEngine
  let systemDebtEngine
  let priceOracle
  let priceFeed
  let stabilityFeeCollector
  let busdTokenAdapter
  let usdtTokenAdapter
  let stablecoinAdapter
  let getPositions

  let showStopperAsAlice
  let stablecoinAdapterAsAlice
  let bookKeeperAsAlice
  let accessControlConfig

  beforeEach(async () => {
    ;({
      fathomStablecoinProxyActions,
      positionManager,
      stabilityFeeCollector,
      busdTokenAdapter,
      usdtTokenAdapter,
      stablecoinAdapter,
      showStopper,
      bookKeeper,
      liquidationEngine,
      systemDebtEngine,
      priceOracle,
      accessControlConfig,
      BUSD,
      USDT,
      fathomStablecoin
    } = await loadFixtureHandler())
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])
    ;({
      proxyWallets: [deployerProxyWallet, aliceProxyWallet, bobProxyWallet],
    } = await loadProxyWalletFixtureHandler())

    const busdAsAlice = BUSD.connect(alice)
    const busdAsBob = BUSD.connect(bob)

    await busdAsAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
    await busdAsBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))

    const usdtAsAlice = USDT.connect(alice)
    const usdtAsBob = USDT.connect(bob)

    await usdtAsAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
    await usdtAsBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))

    showStopperAsAlice = showStopper.connect(alice)
    stablecoinAdapterAsAlice = stablecoinAdapter.connect(alice)
    bookKeeperAsAlice = bookKeeper.connect(alice)

    const stablecoinAsAlice = fathomStablecoin.connect(alice)

    stablecoinAsAlice.approve(stablecoinAdapter.address, WeiPerWad.mul(10000))
  })

  describe("#cage", () => {
    context("when doesn't grant showStopperRole for showStopper", () => {
      it("should be revert", async () => {
        await expect(showStopper["cage()"]()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })
    context("when grant showStopperRole for all contract", () => {
      it("should be able to cage", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

        await showStopper["cage()"]()

        expect(await bookKeeper.live()).to.be.equal(0)
        expect(await liquidationEngine.live()).to.be.equal(0)
        expect(await systemDebtEngine.live()).to.be.equal(0)
        expect(await priceOracle.live()).to.be.equal(0)
      })
    })
  })
  describe("#cage(collateralPoolId)", () => {
    context("deployer cage BUSD pool", () => {
      it("should be able to cage", async () => {
        // 1.
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDrawCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDrawCall)

        await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

        await showStopper["cage()"]()

        await showStopper["cage(bytes32)"](formatBytes32String("BUSD"))

        expect(await showStopper.cagePrice(formatBytes32String("BUSD"))).to.be.equal(WeiPerRay)
        expect(await showStopper.totalDebtShare(formatBytes32String("BUSD"))).to.be.equal(WeiPerWad.mul(5))
      })
    })
  })
  describe("#accumulateBadDebt, #redeemLockedCollateral", () => {
    context("when the caller is not the position owner", () => {
      it("should be able to redeemLockedCollateral", async () => {
        // alice's position #1
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDrawCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDrawCall)
        await advanceBlock()
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress = await positionManager.positions(positionId)

        await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

        await showStopper["cage()"]()

        await showStopper["cage(bytes32)"](formatBytes32String("BUSD"))

        // accumulate bad debt posiion #1
        await showStopper.accumulateBadDebt(formatBytes32String("BUSD"), positionAddress)

        // redeem lock collateral position #1
        const redeemLockedCollateralCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "redeemLockedCollateral",
          [
            positionManager.address,
            positionId,
            busdTokenAdapter.address,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await expect(
          bobProxyWallet.execute2(fathomStablecoinProxyActions.address, redeemLockedCollateralCall)
        ).to.be.revertedWith("owner not allowed")
      })
    })
    context("when the caller is the position owner", () => {
      it("should be able to redeemLockedCollateral", async () => {
        // alice's position #1
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDrawCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDrawCall)
        await advanceBlock()
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress = await positionManager.positions(positionId)

        // bob's position #2
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDraw2Call = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDraw2Call)
        await advanceBlock()
        const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
        const positionAddress2 = await positionManager.positions(positionId2)

        await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

        await showStopper["cage()"]()

        await showStopper["cage(bytes32)"](formatBytes32String("BUSD"))

        // accumulate bad debt posiion #1
        await showStopper.accumulateBadDebt(formatBytes32String("BUSD"), positionAddress)
        const position1 = await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress)
        expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
        expect(position1.debtShare).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), showStopper.address)).to.be.equal(
          WeiPerWad.mul(5)
        )
        expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

        // accumulate bad debt posiion #2
        await showStopper.accumulateBadDebt(formatBytes32String("BUSD"), positionAddress2)
        const position2 = await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress2)
        expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
        expect(position2.debtShare).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), showStopper.address)).to.be.equal(
          WeiPerWad.mul(10)
        )
        expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

        // redeem lock collateral position #1
        const redeemLockedCollateralCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "redeemLockedCollateral",
          [
            positionManager.address,
            positionId,
            busdTokenAdapter.address,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await aliceProxyWallet.execute2(
          fathomStablecoinProxyActions.address,
          redeemLockedCollateralCall
        )
        expect((await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress)).lockedCollateral).to.be.equal(
          0
        )
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), aliceProxyWallet.address)).to.be.equal(
          WeiPerWad.mul(5)
        )

        // redeem lock collateral position #2
        const redeemLockedCollateral2Call = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "redeemLockedCollateral",
          [
            positionManager.address,
            positionId2,
            busdTokenAdapter.address,
            ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
          ]
        )
        await bobProxyWallet.execute2(
          fathomStablecoinProxyActions.address,
          redeemLockedCollateral2Call
        )
        expect(
          (await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress2)).lockedCollateral
        ).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), bobProxyWallet.address)).to.be.equal(
          WeiPerWad.mul(5)
        )
      })
    })
  })
  describe("#finalizeDebt, #finalizeCashPrice", () => {
    context("when finalizeDebt and finalizeCashPrice", () => {
      it("should be able to call", async () => {
        // alice's position #1
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDrawCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDrawCall)
        await advanceBlock()
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress = await positionManager.positions(positionId)

        // bob's position #2
        //  a. open a new position
        //  b. lock ibBUSD
        //  c. mint FUSD
        const openLockTokenAndDraw2Call = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDraw2Call)
        await advanceBlock()
        const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
        const positionAddress2 = await positionManager.positions(positionId2)

        await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

        await showStopper["cage()"]()

        await showStopper["cage(bytes32)"](formatBytes32String("BUSD"))

        // accumulate bad debt posiion #1
        await showStopper.accumulateBadDebt(formatBytes32String("BUSD"), positionAddress)
        const position1 = await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress)
        expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
        expect(position1.debtShare).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), showStopper.address)).to.be.equal(
          WeiPerWad.mul(5)
        )
        expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

        // accumulate bad debt posiion #2
        await showStopper.accumulateBadDebt(formatBytes32String("BUSD"), positionAddress2)
        const position2 = await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress2)
        expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
        expect(position2.debtShare).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), showStopper.address)).to.be.equal(
          WeiPerWad.mul(10)
        )
        expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

        // finalize debt
        await showStopper.finalizeDebt()
        // total debt
        expect(await showStopper.debt()).to.be.equal(WeiPerRad.mul(10))

        // finalize cash price
        await showStopper.finalizeCashPrice(formatBytes32String("BUSD"))
        // badDebtAccumulator / totalDebt = 10000000000000000000000000000000000000000000000 / 10000000000000000000 = 1000000000000000000000000000
        expect(await showStopper.finalCashPrice(formatBytes32String("BUSD"))).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#accumulateStablecoin, #redeemStablecoin", () => {
    context("when redeem stablecoin", () => {
      it("should be able to accumulateStablecoin, redeemStablecoin", async () => {
        // alice's position #1
        //  a. open a new position
        //  b. lock BUSD
        //  c. mint FUSD
        const openLockTokenAndDrawCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDrawCall)
        await advanceBlock()
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
        const positionAddress = await positionManager.positions(positionId)

        // bob's position #2
        //  a. open a new position
        //  b. lock BUSD
        //  c. mint FUSD
        const openLockTokenAndDraw2Call = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            busdTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("BUSD"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ]
        )
        await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDraw2Call)
        await advanceBlock()
        const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
        const positionAddress2 = await positionManager.positions(positionId2)

        // bob's position #3
        //  a. open a new position
        //  b. lock USDT
        //  c. mint FUSD
        const openLockTokenAndDraw3Call = fathomStablecoinProxyActions.interface.encodeFunctionData(
          "openLockTokenAndDraw",
          [
            positionManager.address,
            stabilityFeeCollector.address,
            usdtTokenAdapter.address,
            stablecoinAdapter.address,
            formatBytes32String("USDT"),
            WeiPerWad.mul(10),
            WeiPerWad.mul(5),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
          ]
        )
        await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, openLockTokenAndDraw3Call)
        await advanceBlock()
        const positionId3 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
        const positionAddress3 = await positionManager.positions(positionId3)

        await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

        await showStopper["cage()"]()

        await showStopper["cage(bytes32)"](formatBytes32String("BUSD"))
        await showStopper["cage(bytes32)"](formatBytes32String("USDT"))

        // accumulate bad debt posiion #1
        await showStopper.accumulateBadDebt(formatBytes32String("BUSD"), positionAddress)
        const position1 = await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress)
        expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
        expect(position1.debtShare).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), showStopper.address)).to.be.equal(
          WeiPerWad.mul(5)
        )
        expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

        // accumulate bad debt posiion #2
        await showStopper.accumulateBadDebt(formatBytes32String("BUSD"), positionAddress2)
        const position2 = await bookKeeper.positions(formatBytes32String("BUSD"), positionAddress2)
        expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
        expect(position2.debtShare).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), showStopper.address)).to.be.equal(
          WeiPerWad.mul(10)
        )
        expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

        // accumulate bad debt posiion #3
        await showStopper.accumulateBadDebt(formatBytes32String("USDT"), positionAddress3)
        const position3 = await bookKeeper.positions(formatBytes32String("USDT"), positionAddress3)
        expect(position3.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
        expect(position3.debtShare).to.be.equal(0)
        expect(await bookKeeper.collateralToken(formatBytes32String("USDT"), showStopper.address)).to.be.equal(
          WeiPerWad.mul(5)
        )
        expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(15))

        // finalize debt
        await showStopper.finalizeDebt()
        expect(await showStopper.debt()).to.be.equal(WeiPerRad.mul(15))

        // finalize cash price BUSD
        await showStopper.finalizeCashPrice(formatBytes32String("BUSD"))
        // badDebtAccumulator / totalDebt = 10000000000000000000000000000000000000000000000 / 15000000000000000000 = 666666666666666666666666666
        expect(await showStopper.finalCashPrice(formatBytes32String("BUSD"))).to.be.equal("666666666666666666666666666")
        // finalize cash price USDT
        await showStopper.finalizeCashPrice(formatBytes32String("USDT"))
        // badDebtAccumulator / totalDebt = 5000000000000000000000000000000000000000000000 / 15000000000000000000 = 333333333333333333333333333
        expect(await showStopper.finalCashPrice(formatBytes32String("USDT"))).to.be.equal("333333333333333333333333333")

        // accumulate stablecoin
        await stablecoinAdapterAsAlice.deposit(
          aliceAddress,
          WeiPerWad.mul(5),
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
        )

        await bookKeeperAsAlice.whitelist(showStopper.address)

        await showStopperAsAlice.accumulateStablecoin(WeiPerWad.mul(5))

        // redeem stablecoin
        await showStopperAsAlice.redeemStablecoin(formatBytes32String("BUSD"), WeiPerWad.mul(5))
        // WAD(5000000000000000000 * 666666666666666666666666666) = 3333333333333333333
        expect(await bookKeeper.collateralToken(formatBytes32String("BUSD"), aliceAddress)).to.be.equal(
          "3333333333333333333"
        )
        await showStopperAsAlice.redeemStablecoin(formatBytes32String("USDT"), WeiPerWad.mul(5))
        // WAD(5000000000000000000 * 333333333333333333333333333) = 3333333333333333333
        expect(await bookKeeper.collateralToken(formatBytes32String("USDT"), aliceAddress)).to.be.equal(
          "1666666666666666666"
        )

        // over redeem stablecoin
        await expect(
          showStopperAsAlice.redeemStablecoin(formatBytes32String("USDT"), WeiPerWad.mul(5))
        ).to.be.revertedWith("ShowStopper/insufficient-stablecoin-accumulator-balance")
      })
    })
  })
})
