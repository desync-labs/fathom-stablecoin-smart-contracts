require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const TimeHelpers = require("../../helper/time");
const AssertHelpers = require("../../helper/assert");
const { loadProxyWalletFixtureHandler } = require("../../helper/proxy");
const { parseEther, parseUnits, defaultAbiCoder, solidityKeccak256, formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants

const FATHOM_PER_BLOCK = parseEther("100")
const COLLATERAL_POOL_ID = formatBytes32String("ibDUMMY")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)
const TREASURY_FEE_BPS = BigNumber.from(5000)
const BPS = BigNumber.from(10000)

const loadFixtureHandler = async () => {
  const [deployer, alice, bob, dev] = await ethers.getSigners()

  const ProxyWalletFactory = (await ethers.getContractFactory("ProxyWalletFactory", deployer))
  const proxyWalletFactory = await ProxyWalletFactory.deploy();
  await proxyWalletFactory.deployed();

  const ProxyWalletRegistry = (await ethers.getContractFactory("ProxyWalletRegistry", deployer))
  const proxyWalletRegistry = (await upgrades.deployProxy(ProxyWalletRegistry, [
    proxyWalletFactory.address
  ]))
  await proxyWalletRegistry.deployed();

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
  // Deploy mocked BookKeeper
  const BookKeeper = (await ethers.getContractFactory("BookKeeper", deployer))
  const bookKeeper = (await upgrades.deployProxy(BookKeeper, [
    collateralPoolConfig.address,
    accessControlConfig.address,
  ]))
  await bookKeeper.deployed()

  await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), bookKeeper.address)
  await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), deployer.address)

  // Deploy mocked BEP20
  const BEP20 = (await ethers.getContractFactory("BEP20", deployer))
  const ibDUMMY = await BEP20.deploy("ibDUMMY", "ibDUMMY")
  await ibDUMMY.deployed()
  await ibDUMMY.mint(await alice.getAddress(), parseEther("1000000"))
  await ibDUMMY.mint(await bob.getAddress(), parseEther("100"))

  // Deploy Fathom's Fairlaunch
  const FathomToken = (await ethers.getContractFactory("FathomToken", deployer))
  const fathomToken = await FathomToken.deploy(88, 89)
  await fathomToken.mint(await deployer.getAddress(), parseEther("150"))
  await fathomToken.deployed()

  const FairLaunch = await ethers.getContractFactory("FairLaunch", deployer)
  const fairLaunch = await FairLaunch.deploy(fathomToken.address, await dev.getAddress(), FATHOM_PER_BLOCK, 0, 0, 0)
  await fairLaunch.deployed()

  const Shield = (await ethers.getContractFactory("Shield", deployer))
  const shield = await Shield.deploy(deployer.address, fairLaunch.address)
  await shield.deployed()

  // Config Fathom's FairLaunch
  // Assuming Deployer is timelock for easy testing
  await fairLaunch.addPool(1, ibDUMMY.address, true)
  await fairLaunch.transferOwnership(shield.address)
  await shield.transferOwnership(await deployer.getAddress())
  await fathomToken.transferOwnership(fairLaunch.address)

  // Deploy ShowStopper
  const ShowStopper = (await ethers.getContractFactory("ShowStopper", deployer))
  const showStopper = (await upgrades.deployProxy(ShowStopper, [bookKeeper.address]))

  // Deploy PositionManager
  const PositionManager = (await ethers.getContractFactory("PositionManager", deployer))
  const positionManager = (await upgrades.deployProxy(PositionManager, [
    bookKeeper.address,
    showStopper.address,
  ]))
  await positionManager.deployed()
  await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), positionManager.address)
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), positionManager.address)

  const CollateralTokenAdapter = (await ethers.getContractFactory("CollateralTokenAdapter", deployer))
  const collateralTokenAdapter = (await upgrades.deployProxy(CollateralTokenAdapter, [
    bookKeeper.address,
    COLLATERAL_POOL_ID,
    ibDUMMY.address,
    fathomToken.address,
    fairLaunch.address,
    0,
    shield.address,
    await deployer.getAddress(),
    BigNumber.from(1000),
    await dev.getAddress(),
    positionManager.address,
  ]))
  await collateralTokenAdapter.deployed()

  await accessControlConfig.grantRole(solidityKeccak256(["string"], ["ADAPTER_ROLE"]), collateralTokenAdapter.address)
  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), deployer.address)

  const SimplePriceFeed = (await ethers.getContractFactory("SimplePriceFeed", deployer))
  const simplePriceFeed = (await upgrades.deployProxy(SimplePriceFeed, [
    accessControlConfig.address,
  ]))
  await simplePriceFeed.deployed()

  await collateralPoolConfig.initCollateralPool(
    COLLATERAL_POOL_ID,
    0,
    0,
    simplePriceFeed.address,
    WeiPerRay,
    WeiPerRay,
    collateralTokenAdapter.address,
    CLOSE_FACTOR_BPS,
    LIQUIDATOR_INCENTIVE_BPS,
    TREASURY_FEE_BPS,
    AddressZero
  )
  await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10000000))
  await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRad.mul(10000000))
  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployer.address)
  await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)

  // Deploy Fathom Stablecoin
  const FathomStablecoin = (await ethers.getContractFactory("FathomStablecoin", deployer))
  const fathomStablecoin = (await upgrades.deployProxy(FathomStablecoin, ["Fathom USD", "FUSD"]))
  await fathomStablecoin.deployed()

  const StablecoinAdapter = (await ethers.getContractFactory(
    "StablecoinAdapter",
    deployer
  ))
  const stablecoinAdapter = (await upgrades.deployProxy(StablecoinAdapter, [
    bookKeeper.address,
    fathomStablecoin.address,
  ]))
  await stablecoinAdapter.deployed()

  await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), stablecoinAdapter.address)

  const FathomStablecoinProxyActions = await ethers.getContractFactory("FathomStablecoinProxyActions");
  const fathomStablecoinProxyActions = await FathomStablecoinProxyActions.deploy()

  const SystemDebtEngine = (await ethers.getContractFactory("SystemDebtEngine", deployer))
  const systemDebtEngine = (await upgrades.deployProxy(SystemDebtEngine, [bookKeeper.address]))
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), systemDebtEngine.address)

  // Deploy StabilityFeeCollector
  const StabilityFeeCollector = (await ethers.getContractFactory(
    "StabilityFeeCollector",
    deployer
  ))
  const stabilityFeeCollector = (await upgrades.deployProxy(StabilityFeeCollector, [
    bookKeeper.address,
    systemDebtEngine.address,
  ]))
  await stabilityFeeCollector.setSystemDebtEngine(systemDebtEngine.address)
  await accessControlConfig.grantRole(
    await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(),
    stabilityFeeCollector.address
  )
  await accessControlConfig.grantRole(
    await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(),
    stabilityFeeCollector.address
  )

  const LiquidationEngine = (await ethers.getContractFactory(
    "LiquidationEngine",
    deployer
  ))
  const liquidationEngine = (await upgrades.deployProxy(LiquidationEngine, [
    bookKeeper.address,
    systemDebtEngine.address,
  ]))

  const PriceOracle = (await ethers.getContractFactory("PriceOracle", deployer))
  const priceOracle = (await upgrades.deployProxy(PriceOracle, [bookKeeper.address]))

  const FixedSpreadLiquidationStrategy = (await ethers.getContractFactory(
    "FixedSpreadLiquidationStrategy",
    deployer
  ))
  const fixedSpreadLiquidationStrategy = (await upgrades.deployProxy(FixedSpreadLiquidationStrategy, [
    bookKeeper.address,
    priceOracle.address,
    liquidationEngine.address,
    systemDebtEngine.address,
  ]))
  await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, fixedSpreadLiquidationStrategy.address)
  await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), liquidationEngine.address)
  await accessControlConfig.grantRole(
    await accessControlConfig.LIQUIDATION_ENGINE_ROLE(),
    fixedSpreadLiquidationStrategy.address
  )
  await accessControlConfig.grantRole(
    await accessControlConfig.COLLATERAL_MANAGER_ROLE(),
    fixedSpreadLiquidationStrategy.address
  )

  return {
    proxyWalletRegistry,
    collateralTokenAdapter,
    stablecoinAdapter,
    bookKeeper,
    ibDUMMY,
    shield,
    fathomToken,
    fairLaunch,
    fathomStablecoinProxyActions,
    positionManager,
    stabilityFeeCollector,
    fathomStablecoin,
    liquidationEngine,
    fixedSpreadLiquidationStrategy,
    simplePriceFeed,
    systemDebtEngine,
    collateralPoolConfig,
  }
}

describe("LiquidationEngine", () => {
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

  // Contracts
  let proxyWalletRegistry

  let proxyWalletRegistryAsAlice
  let proxyWalletRegistryAsBob

  let deployerProxyWallet
  let aliceProxyWallet

  let collateralTokenAdapter
  let stablecoinAdapter
  let bookKeeper
  let ibDUMMY
  let shield
  let fathomToken
  let fairLaunch

  let positionManager
  let stabilityFeeCollector

  let liquidationEngine
  let fixedSpreadLiquidationStrategy

  let fathomStablecoinProxyActions
  let fathomStablecoin
  let simplePriceFeed
  let systemDebtEngine
  let collateralPoolConfig

  // Signer
  let collateralTokenAdapterAsAlice
  let collateralTokenAdapterAsBob

  let ibDUMMYasAlice
  let ibDUMMYasBob

  let liquidationEngineAsBob
  let simplePriceFeedAsDeployer
  let bookKeeperAsBob

  before(async () => {
    ;({
      proxyWallets: [deployerProxyWallet, aliceProxyWallet],
    } = await waffle.loadFixture(loadProxyWalletFixtureHandler))
  })

  beforeEach(async () => {
    ;({
      proxyWalletRegistry,
      collateralTokenAdapter,
      stablecoinAdapter,
      bookKeeper,
      ibDUMMY,
      shield,
      fathomToken,
      fairLaunch,
      fathomStablecoinProxyActions,
      positionManager,
      stabilityFeeCollector,
      fathomStablecoin,
      liquidationEngine,
      fixedSpreadLiquidationStrategy,
      simplePriceFeed,
      systemDebtEngine,
      collateralPoolConfig,
    } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])
    proxyWalletRegistryAsAlice = proxyWalletRegistry.connect(alice)
    proxyWalletRegistryAsBob = proxyWalletRegistry.connect(bob)

    collateralTokenAdapterAsAlice = collateralTokenAdapter.connect(alice)
    collateralTokenAdapterAsBob = collateralTokenAdapter.connect(bob)

    ibDUMMYasAlice = ibDUMMY.connect(alice)
    ibDUMMYasBob = ibDUMMY.connect(bob)

    liquidationEngineAsBob = liquidationEngine.connect( bob)
    simplePriceFeedAsDeployer = simplePriceFeed.connect(deployer)
    bookKeeperAsBob = bookKeeper.connect(bob)
  })
  describe("#liquidate", async () => {
    context("price drop but does not make the position underwater", async () => {
      it("should revert", async () => {
        // 1. Set priceWithSafetyMargin for ibDUMMY to 2 USD
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.mul(2))

        // 2. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
        const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
          positionManager.address,
          stabilityFeeCollector.address,
          collateralTokenAdapter.address,
          stablecoinAdapter.address,
          COLLATERAL_POOL_ID,
          WeiPerWad,
          WeiPerWad,
          true,
          defaultAbiCoder.encode(["address"], [aliceAddress]),
        ])
        await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
        const alicePositionAddress = await positionManager.positions(1)
        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
        const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

        expect(
          alicePosition.lockedCollateral,
          "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
        ).to.be.equal(WeiPerWad)
        expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(WeiPerWad)
        expect(
          await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
          "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
        ).to.be.equal(0)
        expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

        // 3. ibDUMMY price drop to 1 USD
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)

        // 4. Bob try to liquidate Alice's position but failed due to the price did not drop low enough
        await expect(
          liquidationEngineAsBob.liquidate(COLLATERAL_POOL_ID, alicePositionAddress, 1, 1, aliceAddress, "0x")
        ).to.be.revertedWith("LiquidationEngine/position-is-safe")
      })
    })

    context("safety buffer -0.1%, but liquidator does not have enough FUSD to liquidate", async () => {
      it("should success", async () => {
        // 1. Set priceWithSafetyMargin for ibDUMMY to 2 USD
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.mul(2))

        // 2. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
        const lockedCollateralAmount = WeiPerWad
        const drawStablecoinAmount = WeiPerWad
        const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
          positionManager.address,
          stabilityFeeCollector.address,
          collateralTokenAdapter.address,
          stablecoinAdapter.address,
          COLLATERAL_POOL_ID,
          lockedCollateralAmount,
          drawStablecoinAmount,
          true,
          defaultAbiCoder.encode(["address"], [aliceAddress]),
        ])
        await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
        const alicePositionAddress = await positionManager.positions(1)
        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
        const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

        expect(
          alicePosition.lockedCollateral,
          "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
        ).to.be.equal(WeiPerWad)
        expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(WeiPerWad)
        expect(
          await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
          "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
        ).to.be.equal(0)
        expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
        expect(
          await fathomToken.balanceOf(aliceProxyWallet.address),
          "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
        ).to.be.equal(0)

        // 3. ibDUMMY price drop to 0.99 USD
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.sub(1))
        await simplePriceFeedAsDeployer.setPrice(WeiPerRay.sub(1).div(1e9))

        // 4. Bob liquidate Alice's position up to full close factor successfully
        const debtShareToRepay = parseEther("0.5")
        await bookKeeperAsBob.whitelist(liquidationEngine.address)

        await expect(
          liquidationEngineAsBob.liquidate(
            COLLATERAL_POOL_ID,
            alicePositionAddress,
            debtShareToRepay,
            MaxUint256,
            bobAddress,
            defaultAbiCoder.encode(["address", "bytes"], [bobAddress, []])
          )
        ).to.be.reverted
      })
    })

    context("main liquidation scenarios", async () => {
      const testParams = [
        {
          label: "safety buffer -0.18%, position is liquidated up to full close factor",
          collateralAmount: "10",
          collateralFactor: "0.7",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "2000",
          startingPrice: "420",
          nextPrice: "285",
          debtShareToRepay: "1000",
          expectedDebtValueToRepay: "1000",
          expectedSeizedCollateral: "3.684210526315790000",
          expectedDebtShareAfterLiquidation: "1000",
          expectedSystemBadDebt: "0",
        },
        {
          label: "safety buffer -0.18%, position is liquidated up to some portion of close factor",
          collateralAmount: "10",
          collateralFactor: "0.7",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "2000",
          startingPrice: "420",
          nextPrice: "285",
          debtShareToRepay: "200",
          expectedDebtValueToRepay: "200",
          expectedSeizedCollateral: "0.7368",
          expectedDebtShareAfterLiquidation: "1800",
          expectedSystemBadDebt: "0",
        },
        {
          label: "safety buffer -0.18%, position is liquidated exceeding close factor",
          collateralAmount: "10",
          collateralFactor: "0.7",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "2000",
          startingPrice: "420",
          nextPrice: "285",
          debtShareToRepay: "2000",
          expectedDebtValueToRepay: "1000",
          expectedSeizedCollateral: "3.684210526315790000",
          expectedDebtShareAfterLiquidation: "1000",
          expectedSystemBadDebt: "0",
        },
        {
          label: "safety buffer -30%, position is liquidated up to full close factor, bad debt",
          collateralAmount: "10",
          collateralFactor: "0.7",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "2000",
          startingPrice: "420",
          nextPrice: "200",
          debtShareToRepay: "1000",
          expectedDebtValueToRepay: "1904.761905",
          expectedSeizedCollateral: "10",
          expectedDebtShareAfterLiquidation: "0",
          expectedSystemBadDebt: "95.238095",
        },
        {
          label: "safety buffer -30%, position is liquidated up to some portion of full close factor, bad debt",
          collateralAmount: "10",
          collateralFactor: "0.7",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "2000",
          startingPrice: "420",
          nextPrice: "200",
          debtShareToRepay: "200",
          expectedDebtValueToRepay: "1904.761905",
          expectedSeizedCollateral: "10",
          expectedDebtShareAfterLiquidation: "0",
          expectedSystemBadDebt: "95.238095",
        },
        {
          label: "safety buffer -10%, position collateral is fully liquidated because debt floor",
          collateralAmount: "10",
          collateralFactor: "0.7",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "1500",
          drawStablecoinAmount: "2000",
          startingPrice: "420",
          nextPrice: "250",
          debtShareToRepay: "1000",
          expectedDebtValueToRepay: "2000",
          expectedSeizedCollateral: "8.4",
          expectedDebtShareAfterLiquidation: "0",
          expectedSystemBadDebt: "0",
        },
        {
          label:
            "safety buffer -5.71% with 99% collateral factor, position is liquidated up to full close factor, bad debt",
          collateralAmount: "2000",
          collateralFactor: "0.99",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "1975",
          startingPrice: "1",
          nextPrice: "0.99",
          debtShareToRepay: "987.5",
          expectedDebtValueToRepay: "1885.714286",
          expectedSeizedCollateral: "2000",
          expectedDebtShareAfterLiquidation: "0",
          expectedSystemBadDebt: "89.285714",
        },
        {
          label:
            "safety buffer -5.71% with 99% collateral factor, position collateral is fully liquidated because debt floor",
          collateralAmount: "2000",
          collateralFactor: "0.9",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "1800",
          startingPrice: "1",
          nextPrice: "0.99",
          debtShareToRepay: "900",
          expectedDebtValueToRepay: "900",
          expectedSeizedCollateral: "954.5455",
          expectedDebtShareAfterLiquidation: "900",
          expectedSystemBadDebt: "0",
        },
        {
          label:
            "safety buffer -7.83% with 99% collateral factor, position is liquidated up to full close factor, bad debt",
          collateralAmount: "2000",
          collateralFactor: "0.9",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "1800",
          startingPrice: "1",
          nextPrice: "0.92",
          debtShareToRepay: "900",
          expectedDebtValueToRepay: "1752.380952",
          expectedSeizedCollateral: "2000",
          expectedDebtShareAfterLiquidation: "0",
          expectedSystemBadDebt: "47.619048",
        },
        {
          label:
            "safety buffer -8.90% with 99% collateral factor, position is liquidated up to full close factor, bad debt",
          collateralAmount: "2000",
          collateralFactor: "0.9",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "2500",
          debtFloor: "100",
          drawStablecoinAmount: "1800",
          startingPrice: "1",
          nextPrice: "0.91",
          debtShareToRepay: "450",
          expectedDebtValueToRepay: "1733.333333",
          expectedSeizedCollateral: "2000",
          expectedDebtShareAfterLiquidation: "0",
          expectedSystemBadDebt: "66.666667",
        },
        {
          label:
            "safety buffer -0.91% with 99% collateral factor, position collateral is fully liquidated because debt floor",
          collateralAmount: "555.560",
          collateralFactor: "0.9",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "2500",
          debtFloor: "500",
          drawStablecoinAmount: "500",
          startingPrice: "1",
          nextPrice: "0.99",
          debtShareToRepay: "125",
          expectedDebtValueToRepay: "500",
          expectedSeizedCollateral: "530.3030303",
          expectedDebtShareAfterLiquidation: "0",
          expectedSystemBadDebt: "0",
        },
        {
          label: "safety buffer -0.91% with 99% collateral factor, position is liquidated up to full close factor",
          collateralAmount: "555.560",
          collateralFactor: "0.9",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "2500",
          debtFloor: "100",
          drawStablecoinAmount: "500",
          startingPrice: "1",
          nextPrice: "0.99",
          debtShareToRepay: "125",
          expectedDebtValueToRepay: "125",
          expectedSeizedCollateral: "132.5758",
          expectedDebtShareAfterLiquidation: "375.00",
          expectedSystemBadDebt: "0",
        },
      ]
      for (let i = 0; i < testParams.length; i++) {
        const testParam = testParams[i]
        it(testParam.label, async () => {
          await ibDUMMY.mint(aliceAddress, parseEther(testParam.collateralAmount))
          await collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, testParam.liquidatorIncentiveBps)
          await collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, testParam.closeFactorBps)
          await simplePriceFeedAsDeployer.setPrice(parseUnits(testParam.startingPrice, 18))
          await collateralPoolConfig.setPriceWithSafetyMargin(
            COLLATERAL_POOL_ID,
            parseUnits(testParam.startingPrice, 18)
              .mul(parseUnits(testParam.collateralFactor, 18))
              .div(parseUnits("1", 9))
          )
          await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, parseUnits(testParam.debtFloor, 45))

          // 2. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const lockedCollateralAmount = parseEther(testParam.collateralAmount)
          const drawStablecoinAmount = parseEther(testParam.drawStablecoinAmount)
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            lockedCollateralAmount,
            drawStablecoinAmount,
            true,
            defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])

          await ibDUMMYasAlice.approve(aliceProxyWallet.address, lockedCollateralAmount)
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
          ).to.be.equal(lockedCollateralAmount)
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            drawStablecoinAmount
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
            drawStablecoinAmount
          )
          expect(
            await fathomToken.balanceOf(aliceProxyWallet.address),
            "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
          ).to.be.equal(0)

          // 3. ibDUMMY price drop to 0.99 USD
          await simplePriceFeedAsDeployer.setPrice(parseUnits(testParam.nextPrice, 18))
          await collateralPoolConfig.setPriceWithSafetyMargin(
            COLLATERAL_POOL_ID,
            parseUnits(testParam.nextPrice, 18).mul(parseUnits(testParam.collateralFactor, 18)).div(parseUnits("1", 9))
          )

          // 4. Bob liquidate Alice's position up to full close factor successfully
          const debtShareToRepay = parseEther(testParam.debtShareToRepay)
          await bookKeeperAsBob.whitelist(liquidationEngine.address)
          await bookKeeperAsBob.whitelist(fixedSpreadLiquidationStrategy.address)
          await bookKeeper.mintUnbackedStablecoin(
            deployerAddress,
            bobAddress,
            parseUnits(testParam.debtShareToRepay, 46)
          )
          const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(bobAddress)
          await liquidationEngineAsBob.liquidate(
            COLLATERAL_POOL_ID,
            alicePositionAddress,
            debtShareToRepay,
            MaxUint256,
            bobAddress,
            "0x"
          )

          // 5. Settle system bad debt
          await systemDebtEngine.settleSystemBadDebt(await bookKeeper.stablecoin(systemDebtEngine.address))

          const bobStablecoinAfterLiquidation = await bookKeeper.stablecoin(bobAddress)

          const alicePositionAfterLiquidation = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          const expectedSeizedCollateral = parseUnits(testParam.expectedSeizedCollateral, 18)
          const expectedLiquidatorIncentive = expectedSeizedCollateral.sub(
            expectedSeizedCollateral.mul(BPS).div(testParam.liquidatorIncentiveBps)
          )
          const expectedTreasuryFee = expectedLiquidatorIncentive.mul(testParam.treasuryFeeBps).div(BPS)
          const expectedCollateralBobShouldReceive = expectedSeizedCollateral.sub(expectedTreasuryFee)

          AssertHelpers.assertAlmostEqual(
            alicePosition.lockedCollateral.sub(alicePositionAfterLiquidation.lockedCollateral).toString(),
            expectedSeizedCollateral.toString()
          )
          expect(alicePositionAfterLiquidation.debtShare).to.be.eq(
            parseUnits(testParam.expectedDebtShareAfterLiquidation, 18)
          )
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.systemBadDebt(systemDebtEngine.address)).toString(),
            parseUnits(testParam.expectedSystemBadDebt, 45).toString()
          )
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobAddress)).toString(),
            expectedCollateralBobShouldReceive.toString()
          )
          AssertHelpers.assertAlmostEqual(
            bobStablecoinBeforeLiquidation.sub(bobStablecoinAfterLiquidation).toString(),
            parseUnits(testParam.expectedDebtValueToRepay, 45).toString()
          )
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, systemDebtEngine.address)).toString(),
            expectedTreasuryFee.toString()
          )
          expect(
            await fathomToken.balanceOf(aliceProxyWallet.address),
            "Alice's proxy wallet should have more than 0 FATHOM, because the liquidation process will distribute the pending FATHOM rewards to the position owner"
          ).to.not.equal(0)
        })
      }
    })

    context("1st liquidation keep position unsafe, 2nd position fully liquidate the position", async () => {
      it("should success", async () => {
        const testParam = {
          label: "safety buffer -0.18%, position is liquidated up to full close factor",
          collateralAmount: "10",
          collateralFactor: "0.7",
          liquidatorIncentiveBps: "10500",
          treasuryFeeBps: "5000",
          closeFactorBps: "5000",
          debtFloor: "100",
          drawStablecoinAmount: "2000",
          startingPrice: "420",
          nextPrice: "250",
          debtShareToRepay: "200",
          expectedDebtValueToRepay: "200",
          expectedSeizedCollateral: "0.84",
          expectedDebtShareAfterLiquidation: "1800",
          expectedSystemBadDebt: "0",
        }
        it(testParam.label, async () => {
          await ibDUMMY.mint(aliceAddress, parseEther(testParam.collateralAmount))
          await collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, testParam.liquidatorIncentiveBps)
          await collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, testParam.closeFactorBps)
          await simplePriceFeedAsDeployer.setPrice(parseUnits(testParam.startingPrice, 18))
          await collateralPoolConfig.setPriceWithSafetyMargin(
            COLLATERAL_POOL_ID,
            parseUnits(testParam.startingPrice, 18)
              .mul(parseUnits(testParam.collateralFactor, 18))
              .div(parseUnits("1", 9))
          )
          await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, parseUnits(testParam.debtFloor, 45))

          // 2. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const lockedCollateralAmount = parseEther(testParam.collateralAmount)
          const drawStablecoinAmount = parseEther(testParam.drawStablecoinAmount)
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            lockedCollateralAmount,
            drawStablecoinAmount,
            true,
            defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])

          await ibDUMMYasAlice.approve(aliceProxyWallet.address, lockedCollateralAmount)
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
          ).to.be.equal(lockedCollateralAmount)
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            drawStablecoinAmount
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
            drawStablecoinAmount
          )
          expect(
            await fathomToken.balanceOf(aliceProxyWallet.address),
            "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
          ).to.be.equal(0)

          // 3. ibDUMMY price drop to 0.99 USD
          await simplePriceFeedAsDeployer.setPrice(parseUnits(testParam.nextPrice, 18))
          await collateralPoolConfig.setPriceWithSafetyMargin(
            COLLATERAL_POOL_ID,
            parseUnits(testParam.nextPrice, 18).mul(parseUnits(testParam.collateralFactor, 18)).div(parseUnits("1", 9))
          )

          // 4. Bob liquidate Alice's position up to full close factor successfully
          const debtShareToRepay = parseEther(testParam.debtShareToRepay)
          await bookKeeperAsBob.whitelist(liquidationEngine.address)
          await bookKeeperAsBob.whitelist(fixedSpreadLiquidationStrategy.address)
          await bookKeeper.mintUnbackedStablecoin(
            deployerAddress,
            bobAddress,
            parseUnits(testParam.debtShareToRepay, 46)
          )
          const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(bobAddress)
          await liquidationEngineAsBob.liquidate(
            COLLATERAL_POOL_ID,
            alicePositionAddress,
            debtShareToRepay,
            MaxUint256,
            bobAddress,
            "0x"
          )

          // 5. Settle system bad debt
          await systemDebtEngine.settleSystemBadDebt(await bookKeeper.stablecoin(systemDebtEngine.address))

          const bobStablecoinAfterLiquidation = await bookKeeper.stablecoin(bobAddress)

          const alicePositionAfterLiquidation = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          const expectedSeizedCollateral = parseUnits(testParam.expectedSeizedCollateral, 18)
          const expectedLiquidatorIncentive = expectedSeizedCollateral.sub(
            expectedSeizedCollateral.mul(BPS).div(testParam.liquidatorIncentiveBps)
          )
          const expectedTreasuryFee = expectedLiquidatorIncentive.mul(testParam.treasuryFeeBps).div(BPS)
          const expectedCollateralBobShouldReceive = expectedSeizedCollateral.sub(expectedTreasuryFee)

          AssertHelpers.assertAlmostEqual(
            alicePosition.lockedCollateral.sub(alicePositionAfterLiquidation.lockedCollateral).toString(),
            expectedSeizedCollateral.toString()
          )
          expect(alicePositionAfterLiquidation.debtShare).to.be.eq(
            parseUnits(testParam.expectedDebtShareAfterLiquidation, 18)
          )
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.systemBadDebt(systemDebtEngine.address)).toString(),
            parseUnits(testParam.expectedSystemBadDebt, 45).toString()
          )
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobAddress)).toString(),
            expectedCollateralBobShouldReceive.toString()
          )
          AssertHelpers.assertAlmostEqual(
            bobStablecoinBeforeLiquidation.sub(bobStablecoinAfterLiquidation).toString(),
            parseUnits(testParam.expectedDebtValueToRepay, 45).toString()
          )
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, systemDebtEngine.address)).toString(),
            expectedTreasuryFee.toString()
          )
          expect(
            await fathomToken.balanceOf(aliceProxyWallet.address),
            "Alice's proxy wallet should have more than 0 FATHOM, because the liquidation process will distribute the pending FATHOM rewards to the position owner"
          ).to.not.equal(0)

          // Second Liquidation
          await liquidationEngineAsBob.liquidate(
            COLLATERAL_POOL_ID,
            alicePositionAddress,
            MaxUint256,
            MaxUint256,
            bobAddress,
            "0x"
          )
          const alicePositionAfterLiquidation2 = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(alicePositionAfterLiquidation2.lockedCollateral).to.be.eq(parseEther("4.62"))
          expect(alicePositionAfterLiquidation2.debtShare).to.be.eq(parseEther("900"))
        })
      })
    })

    context("price feed is manipulated", async () => {
      it("should revert, preventing position from being liquidated", async () => {
        // 1. Set priceWithSafetyMargin for ibDUMMY to 2 USD
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.mul(2))

        // 2. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
        const lockedCollateralAmount = WeiPerWad
        const drawStablecoinAmount = WeiPerWad
        const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
          positionManager.address,
          stabilityFeeCollector.address,
          collateralTokenAdapter.address,
          stablecoinAdapter.address,
          COLLATERAL_POOL_ID,
          lockedCollateralAmount,
          drawStablecoinAmount,
          true,
          defaultAbiCoder.encode(["address"], [aliceAddress]),
        ])
        await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
        const alicePositionAddress = await positionManager.positions(1)
        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
        const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

        expect(
          alicePosition.lockedCollateral,
          "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
        ).to.be.equal(WeiPerWad)
        expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(WeiPerWad)
        expect(
          await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
          "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
        ).to.be.equal(0)
        expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
        expect(
          await fathomToken.balanceOf(aliceProxyWallet.address),
          "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
        ).to.be.equal(0)

        // 3. ibDUMMY price drop to 0.99 USD
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.sub(1))
        await simplePriceFeedAsDeployer.setPrice(WeiPerRay.sub(1).div(1e9))

        // 4. Bob liquidate Alice's position up to full close factor successfully
        const debtShareToRepay = parseEther("0.5")
        await bookKeeperAsBob.whitelist(liquidationEngine.address)
        await bookKeeperAsBob.whitelist(fixedSpreadLiquidationStrategy.address)
        await bookKeeper.mintUnbackedStablecoin(deployerAddress, bobAddress, WeiPerRad.mul(100))
        const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(bobAddress)
        await simplePriceFeed.setPriceLife(60 * 60) // 1 hour
        await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from(60 * 60 * 2))) // move forward 2 hours
        await expect(
          liquidationEngineAsBob.liquidate(
            COLLATERAL_POOL_ID,
            alicePositionAddress,
            debtShareToRepay,
            MaxUint256,
            bobAddress,
            defaultAbiCoder.encode(["address", "bytes"], [bobAddress, []])
          )
        ).to.be.revertedWith("FixedSpreadLiquidationStrategy/invalid-price")
      })
    })

    context(
      "safety buffer -20%, position is liquidated up to full close factor with some interest and debt floor",
      async () => {
        it("should success", async () => {
          // 1. Set priceWithSafetyMargin for ibDUMMY to 420 USD
          await simplePriceFeedAsDeployer.setPrice(parseUnits("420", 18))
          await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, parseUnits("294", 27))
          await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, parseEther("100").mul(WeiPerRay))

          // 2. Alice open a new position with 10 ibDUMMY and draw 2000 FUSD
          const lockedCollateralAmount = parseEther("10")
          const drawStablecoinAmount = parseEther("2000")
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            lockedCollateralAmount,
            drawStablecoinAmount,
            true,
            defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasAlice.approve(aliceProxyWallet.address, lockedCollateralAmount)
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)

          // Set stability fee rate to 0.5% APR
          await collateralPoolConfig.setStabilityFeeRate(
            COLLATERAL_POOL_ID,
            BigNumber.from("1000000000158153903837946258")
          )

          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 10 ibDUMMY, because Alice locked 10 ibDUMMY"
          ).to.be.equal(parseEther("10"))
          expect(alicePosition.debtShare, "debtShare should be 2000 FUSD, because Alice drew 2000 FUSD").to.be.equal(
            parseEther("2000")
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 2000 FUSD from drawing 2000 FUSD").to.be.equal(
            parseEther("2000")
          )
          expect(
            await fathomToken.balanceOf(aliceProxyWallet.address),
            "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
          ).to.be.equal(0)

          // 3. 1 year passed, ibDUMMY price drop to 285 USD
          await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from("31536000")))
          await stabilityFeeCollector.collect(COLLATERAL_POOL_ID)
          const aliceDebtValueAfterOneYear = (
            await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          ).debtShare.mul((await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).debtAccumulatedRate)
          AssertHelpers.assertAlmostEqual(
            aliceDebtValueAfterOneYear.toString(),
            parseEther("2010").mul(WeiPerRay).toString()
          )
          await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, parseUnits("199.5", 27))
          await simplePriceFeedAsDeployer.setPrice(parseEther("285"))

          // 4. Bob liquidate Alice's position up to full close factor successfully
          const debtShareToRepay = parseEther("1000")
          await bookKeeperAsBob.whitelist(liquidationEngine.address)
          await bookKeeperAsBob.whitelist(fixedSpreadLiquidationStrategy.address)
          await bookKeeper.mintUnbackedStablecoin(deployerAddress, bobAddress, parseUnits("3000", 45))
          const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(bobAddress)
          await liquidationEngineAsBob.liquidate(
            COLLATERAL_POOL_ID,
            alicePositionAddress,
            debtShareToRepay,
            MaxUint256,
            bobAddress,
            defaultAbiCoder.encode(["address", "bytes"], [bobAddress, []])
          )

          // 5. Settle system bad debt
          await systemDebtEngine.settleSystemBadDebt(await bookKeeper.systemBadDebt(systemDebtEngine.address))
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.stablecoin(systemDebtEngine.address)).toString(),
            parseEther("10").mul(WeiPerRay).toString()
          ) // There should be 10 FUSD left in SystemDebtEngine collected from stability fee after `settleSystemBadDebt`

          const bobStablecoinAfterLiquidation = await bookKeeper.stablecoin(bobAddress)

          const alicePositionAfterLiquidation = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

          AssertHelpers.assertAlmostEqual(
            alicePositionAfterLiquidation.lockedCollateral.toString(),
            parseEther("6.297").toString()
          )
          expect(
            alicePositionAfterLiquidation.debtShare,
            "debtShare should be 1000 FUSD, because Bob liquidated 1000 FUSD from Alice's position"
          )
            .to.be.equal(alicePosition.debtShare.sub(debtShareToRepay))
            .to.be.equal(parseEther("1000"))
          expect(
            await bookKeeper.systemBadDebt(systemDebtEngine.address),
            "System bad debt should be 0 FUSD"
          ).to.be.equal(0)
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobAddress)).toString(),
            parseEther("3.61447369").toString()
          ) // Bob should receive 3.61447369 ibDUMMY
          AssertHelpers.assertAlmostEqual(
            bobStablecoinBeforeLiquidation.sub(bobStablecoinAfterLiquidation).toString(),
            parseEther("1005").mul(WeiPerRay).toString()
          ) // Bob should pay 1005 FUSD for this liquidation
          AssertHelpers.assertAlmostEqual(
            (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, systemDebtEngine.address)).toString(),
            parseEther("0.08815789").toString()
          ) // SystemDebtEngine should receive 0.08815789 ibDUMMY as treasury fee
          expect(
            await fathomToken.balanceOf(aliceProxyWallet.address),
            "Alice's proxy wallet should have more than 0 FATHOM, because the liquidation process will distribute the pending FATHOM rewards to the position owner"
          ).to.not.equal(0)
        })
      }
    )
  })
})
