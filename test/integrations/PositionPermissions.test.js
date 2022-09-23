
require("@openzeppelin/test-helpers")

const { ethers, upgrades } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const { loadProxyWalletFixtureHandler } = require("../helper/proxy");
const { formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants

const FATHOM_PER_BLOCK = ethers.utils.parseEther("100")
const COLLATERAL_POOL_ID = formatBytes32String("ibDUMMY")
const COLLATERAL_POOL_ID2 = formatBytes32String("ibDUMMY2")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10250)
const TREASURY_FEE_BPS = BigNumber.from(100)

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

  const SimplePriceFeed = (await ethers.getContractFactory("SimplePriceFeed", deployer))
  const simplePriceFeed = (await upgrades.deployProxy(SimplePriceFeed, [
    accessControlConfig.address,
  ]))
  await simplePriceFeed.deployed()

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

  // Deploy mocked BEP20
  const BEP20 = (await ethers.getContractFactory("BEP20", deployer))
  const ibDUMMY = await BEP20.deploy("ibDUMMY", "ibDUMMY")
  await ibDUMMY.deployed()
  await ibDUMMY.mint(await alice.getAddress(), ethers.utils.parseEther("100"))
  await ibDUMMY.mint(await bob.getAddress(), ethers.utils.parseEther("100"))

  // Deploy Fathom's Fairlaunch
  const FathomToken = (await ethers.getContractFactory("FathomToken", deployer))
  const fathomToken = await FathomToken.deploy(88, 89)
  await fathomToken.mint(await deployer.getAddress(), ethers.utils.parseEther("150"))
  await fathomToken.deployed()

  const FairLaunch = (await ethers.getContractFactory("FairLaunch", deployer))
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

  const collateralTokenAdapter2 = (await upgrades.deployProxy(CollateralTokenAdapter, [
    bookKeeper.address,
    COLLATERAL_POOL_ID2,
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
  await collateralTokenAdapter2.deployed()

  await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(1000))
  await collateralPoolConfig.initCollateralPool(
    COLLATERAL_POOL_ID,
    WeiPerRad.mul(1000),
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

  await collateralPoolConfig.initCollateralPool(
    COLLATERAL_POOL_ID2,
    WeiPerRad.mul(1000),
    0,
    simplePriceFeed.address,
    WeiPerRay,
    WeiPerRay,
    collateralTokenAdapter2.address,
    CLOSE_FACTOR_BPS,
    LIQUIDATOR_INCENTIVE_BPS,
    TREASURY_FEE_BPS,
    AddressZero
  )

  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployer.address)
  await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)

  await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID2, WeiPerRay)

  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["ADAPTER_ROLE"]),
    collateralTokenAdapter.address
  )
  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["ADAPTER_ROLE"]),
    collateralTokenAdapter2.address
  )
  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), deployer.address)

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

  const FathomStablecoinProxyActions = 
  (await ethers.getContractFactory("FathomStablecoinProxyActions", deployer))
  const fathomStablecoinProxyActions = await FathomStablecoinProxyActions.deploy()

  const SystemDebtEngine = (await ethers.getContractFactory("SystemDebtEngine", deployer))
  const systemDebtEngine = (await upgrades.deployProxy(SystemDebtEngine, [bookKeeper.address]))

  // Deploy StabilityFeeCollector
  const StabilityFeeCollector = (await ethers.getContractFactory(
    "StabilityFeeCollector",
    deployer
  ))
  const stabilityFeeCollector = (await upgrades.deployProxy(StabilityFeeCollector, [
    bookKeeper.address,
    systemDebtEngine.address,
  ]))
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
  await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID2, fixedSpreadLiquidationStrategy.address)

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
    collateralTokenAdapter2,
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
  }
}

describe("PositionPermissions", () => {
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
  let deployerProxyWallet
  let aliceProxyWallet
  let bobProxyWallet

  let collateralTokenAdapter
  let collateralTokenAdapter2

  let stablecoinAdapter
  let stablecoinAdapterAsAlice
  let stablecoinAdapterAsBob

  let bookKeeper
  let ibDUMMY

  let positionManager
  let positionManagerAsAlice
  let positionManagerAsBob

  let stabilityFeeCollector

  let fathomStablecoinProxyActions

  let fathomStablecoin

  let ibDUMMYasAlice
  let ibDUMMYasBob

  let bookKeeperAsAlice
  let bookKeeperAsBob

  before(async () => {
    ;({
      proxyWallets: [deployerProxyWallet, aliceProxyWallet, bobProxyWallet],
    } = await waffle.loadFixture(loadProxyWalletFixtureHandler))
  })

  beforeEach(async () => {
    ;({
      collateralTokenAdapter,
      collateralTokenAdapter2,
      stablecoinAdapter,
      bookKeeper,
      ibDUMMY,
      fathomStablecoinProxyActions,
      positionManager,
      stabilityFeeCollector,
      fathomStablecoin,
    } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    ibDUMMYasAlice = ibDUMMY.connect(alice)
    ibDUMMYasBob = ibDUMMY.connect(bob)

    stablecoinAdapterAsAlice = stablecoinAdapter.connect(alice)
    stablecoinAdapterAsBob = stablecoinAdapter.connect(bob)

    bookKeeperAsAlice = bookKeeper.connect(alice)
    bookKeeperAsBob = bookKeeper.connect(bob)

    positionManagerAsAlice = positionManager.connect(alice)
    positionManagerAsBob = positionManager.connect(bob)
  })
  describe("#permissions", async () => {
    context("position owner is able to", async () => {
      context("lock collateral into their own position", async () => {
        it("should success", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad,
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
          // 2. Alice try to adjust position, add 2 ibDummy to position
          const lockToken = fathomStablecoinProxyActions.interface.encodeFunctionData("lockToken", [
            positionManager.address,
            collateralTokenAdapter.address,
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            WeiPerWad.mul(2),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, lockToken)
          const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            aliceAdjustPosition.lockedCollateral,
            "lockedCollateral should be 3 ibDUMMY, because Alice locked 2 more ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(3))
          expect(
            aliceAdjustPosition.debtShare,
            "debtShare should be 1 FUSD, because Alice didn't draw more"
          ).to.be.equal(WeiPerWad)
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
        })
      })

      context("move collateral", async () => {
        context("same collateral pool", async () => {
          context(
            "call openLockTokenAndDraw, unlock collateral and move the collateral from one position to another position within the same collateral pool",
            async () => {
              it("should success", async () => {
                // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
                const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad,
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                expect(
                  alicePosition.lockedCollateral,
                  "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                // 2. Alice open a second new position with 2 ibDUMMY and draw 1 FUSD at same collateral pool
                const openPositionCall2 = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad.mul(2),
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  openPositionCall2
                )
                const alicePositionAddress2 = await positionManager.positions(2)
                const fathomStablecoinBalance2 = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition2 = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress2)
                expect(
                  alicePosition2.lockedCollateral,
                  "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(alicePosition2.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress2),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(
                  fathomStablecoinBalance2,
                  "Alice should receive 2 FUSD from drawing FUSD 2 times form 2 positions"
                ).to.be.equal(WeiPerWad.mul(2))
                // 3. Alice try to unlock 1 ibDUMMY at second position
                const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  WeiPerWad.mul(-1),
                  0,
                  collateralTokenAdapter.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
                const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress2)
                expect(
                  aliceAdjustPosition.lockedCollateral,
                  "Position #2's lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY from it"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceAdjustPosition.debtShare,
                  "debtShare should be 1 FUSD, because Alice didn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress2),
                  "collateralToken inside Alice's Position#2 address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY from the position"
                ).to.be.equal(WeiPerWad)
                // 4. Alice try to move collateral from second position to first position
                const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  alicePositionAddress,
                  WeiPerWad,
                  collateralTokenAdapter.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
                const aliceMoveCollateral = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                const fathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
                expect(
                  aliceMoveCollateral.lockedCollateral,
                  "Alice's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceMoveCollateral.debtShare,
                  "Alice's Position #1 debtShare should be 1 FUSD, because Alice doesn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's Position #1 address should be 1 ibDUMMY, because Alice moved 1 ibDUMMY from Position #2 to Position #1."
                ).to.be.equal(WeiPerWad)
                expect(
                  fathomStablecoinBalancefinal,
                  "Alice should receive 2 FUSD from drawing 2 FUSD, because Alice draw 2 times"
                ).to.be.equal(WeiPerWad.mul(2))
              })
            }
          )
          context(
            "open position, deposit collateral and move collateral from one position to another position",
            async () => {
              it("should success", async () => {
                // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
                const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad,
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                expect(
                  alicePosition.lockedCollateral,
                  "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                // 2. Alice open a second new position at same collateral pool
                const openPositionCall2 = fathomStablecoinProxyActions.interface.encodeFunctionData("open", [
                  positionManager.address,
                  COLLATERAL_POOL_ID,
                  aliceProxyWallet.address,
                ])
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  openPositionCall2
                )
                const alicePositionAddress2 = await positionManager.positions(2)
                const alicePosition2 = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress2)
                expect(
                  alicePosition2.lockedCollateral,
                  "lockedCollateral should be 0 ibDUMMY, because Alice doesn't locked ibDUMMY"
                ).to.be.equal(0)
                expect(alicePosition2.debtShare, "debtShare should be 0 FUSD, because doesn't drew FUSD").to.be.equal(0)
                // 3. Alice deposit 3 ibDUMMY to new position
                const depositPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "tokenAdapterDeposit",
                  [
                    collateralTokenAdapter.address,
                    await positionManager.positions(2),
                    WeiPerWad.mul(3),
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  depositPositionCall
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress2),
                  "collateralToken inside Alice's second position address should be 3 ibDUMMY, because Alice deposit 3 ibDUMMY into the second position"
                ).to.be.equal(WeiPerWad.mul(3))
                // 4. Alice try to move collateral from second position to first position
                const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  alicePositionAddress,
                  WeiPerWad,
                  collateralTokenAdapter.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
                const aliceMoveCollateral = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                const fathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
                expect(
                  aliceMoveCollateral.lockedCollateral,
                  "Alice's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceMoveCollateral.debtShare,
                  "Alice's Position #1 debtShare should be 1 FUSD, because Alice doesn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's Position #1 address should be 1 ibDUMMY, because Alice moved 1 ibDUMMY from Position #2 to Position #1."
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress2),
                  "collateralToken inside Alice's Position #2 address should be 2 ibDUMMY, because Alice moved 1 ibDUMMY to Position #1"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(
                  fathomStablecoinBalancefinal,
                  "Alice should receive 1 FUSD, because Alice draw 1 time"
                ).to.be.equal(WeiPerWad)
              })
            }
          )
          context("Alice open a position, lock collateral and move collateral to Bob's position", async () => {
            it("should success", async () => {
              // 1. Alice open position
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("open", [
                positionManager.address,
                COLLATERAL_POOL_ID,
                aliceProxyWallet.address,
              ])
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 0 ibDUMMY, because Alice doesn't locked ibDUMMY"
              ).to.be.equal(0)
              expect(alicePosition.debtShare, "debtShare should be 0 FUSD, because doesn't drew FUSD").to.be.equal(0)
              // 2. Alice deposit 3 ibDUMMY to new position
              const depositPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "tokenAdapterDeposit",
                [
                  collateralTokenAdapter.address,
                  await positionManager.positions(1),
                  WeiPerWad.mul(3),
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await aliceProxyWallet.execute2(
                fathomStablecoinProxyActions.address,
                depositPositionCall
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's second position address should be 3 ibDUMMY, because Alice deposit 3 ibDUMMY into the second position"
              ).to.be.equal(WeiPerWad.mul(3))
              // 3. Bob open a position with 1 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad,
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 4. Alice try to move collateral to bob position
              const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                bobPositionAddress,
                WeiPerWad,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
              const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
              const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's Position address should be 2 ibDUMMY, because Alice move 1 ibDUMMY from Alice's Position to Bob's Position."
              ).to.be.equal(WeiPerWad.mul(2))
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's Position address should be 1 ibDUMMY, because Alice moved 1 ibDUMMY from Alice's Position to Bob's position"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceFathomStablecoinBalancefinal,
                "Alice should receive 0 FUSD, because Alice doesn't draw"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob draw 1 time").to.be.equal(
                WeiPerWad
              )
            })
          })
        })
        context("between 2 collateral pool", async () => {
          context(
            "Alice opens 2 positions on 2 collateral pools (one position for each collateral pool) and Alice move collateral from one position to another position by calling openLockTokenAndDraw() twice",
            async () => {
              it("should success", async () => {
                // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
                const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad,
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                expect(
                  alicePosition.lockedCollateral,
                  "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                // 2. Alice open a second new position with 2 ibDUMMY and draw 1 FUSD at new collateral pool
                const openPositionCall2 = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter2.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID2,
                    WeiPerWad.mul(2),
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  openPositionCall2
                )
                const alicePositionAddress2 = await positionManager.positions(2)
                const fathomStablecoinBalance2 = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition2 = await bookKeeper.positions(COLLATERAL_POOL_ID2, alicePositionAddress2)
                expect(
                  alicePosition2.lockedCollateral,
                  "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(alicePosition2.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress2),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(
                  fathomStablecoinBalance2,
                  "Alice should receive 2 FUSD from drawing 1 FUSD 2 times form 2 positions"
                ).to.be.equal(WeiPerWad.mul(2))
                // 3. Alice try to unlock 1 ibDUMMY at second position
                const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  WeiPerWad.mul(-1),
                  0,
                  collateralTokenAdapter2.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
                const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, alicePositionAddress2)
                expect(
                  aliceAdjustPosition.lockedCollateral,
                  "lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceAdjustPosition.debtShare,
                  "debtShare should be 1 FUSD, because Alice didn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress2),
                  "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY into the position"
                ).to.be.equal(WeiPerWad)
                // 4. Alice try to move collateral from second position to first position
                const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  alicePositionAddress,
                  WeiPerWad,
                  collateralTokenAdapter2.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
                const aliceMoveCollateral = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                const fathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
                expect(
                  aliceMoveCollateral.lockedCollateral,
                  "Alice's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceMoveCollateral.debtShare,
                  "Alice's Position #1 debtShare should be 1 FUSD, because Alice didn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken from Collateral Pool #1 inside Alice's Position #1 address should be 0 ibDUMMY, because Alice can't move collateral from Position #2 to Position #1 as they are not from the same Collateral Pool."
                ).to.be.equal(0)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress2),
                  "collateralToken from Collateral Pool #2 inside Alice's position #2 address should be 0 ibDUMMY, because Alice moved 1 ibDUMMY into Collateral Pool #2 inside Alice's position #1"
                ).to.be.equal(0)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress),
                  "collateralToken from Collateral Pool #2 inside Alice's position #1 address should be 1 ibDUMMY, because Alice moved 1 ibDUMMY form Alice's position #2 to Collateral Pool #2 inside Alice's position #1"
                ).to.be.equal(WeiPerWad)
                expect(
                  fathomStablecoinBalancefinal,
                  "Alice should receive 2 FUSD from drawing 2 FUSD, because Alice drew 2 times"
                ).to.be.equal(WeiPerWad.mul(2))
              })
            }
          )
          context(
            "Alice opens 2 positions on 2 collateral pools (one position for each collateral pool) and Alice move collateral from one position to another position",
            async () => {
              it("should success", async () => {
                // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
                const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad,
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                expect(
                  alicePosition.lockedCollateral,
                  "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                // 2. Alice open a second position at another collateral pool
                const openPositionCall2 = fathomStablecoinProxyActions.interface.encodeFunctionData("open", [
                  positionManager.address,
                  COLLATERAL_POOL_ID2,
                  aliceProxyWallet.address,
                ])
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  openPositionCall2
                )
                const alicePositionAddress2 = await positionManager.positions(2)
                const alicePosition2 = await bookKeeper.positions(COLLATERAL_POOL_ID2, alicePositionAddress2)
                expect(
                  alicePosition2.lockedCollateral,
                  "lockedCollateral should be 0 ibDUMMY, because Alice doesn't locked ibDUMMY"
                ).to.be.equal(0)
                expect(alicePosition2.debtShare, "debtShare should be 0 FUSD, because doesn't drew FUSD").to.be.equal(0)
                // 3. Alice deposit 3 ibDUMMY to second position
                const depositPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "tokenAdapterDeposit",
                  [
                    collateralTokenAdapter2.address,
                    await positionManager.positions(2),
                    WeiPerWad.mul(3),
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  depositPositionCall
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress2),
                  "collateralToken inside Alice's second position address should be 3 ibDUMMY, because Alice deposit 3 ibDUMMY into the second position"
                ).to.be.equal(WeiPerWad.mul(3))
                // 4. Alice try to move collateral from second position to first position
                const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  alicePositionAddress,
                  WeiPerWad,
                  collateralTokenAdapter2.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
                const aliceMoveCollateral = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                const fathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
                expect(
                  aliceMoveCollateral.lockedCollateral,
                  "Alice's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceMoveCollateral.debtShare,
                  "Alice's Position #1 debtShare should be 1 FUSD, because Alice doesn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken from Collateral Pool #1 inside Alice's Position #1 address should be 0 ibDUMMY, because Alice can't move collateral from Position #2 to Position #1 as they are not from the same Collateral Pool."
                ).to.be.equal(0)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress2),
                  "collateralToken from Collateral Pool #2 inside Alice's Position #2 address should be 2 ibDUMMY, because Alice move 1 ibDUMMY into Collateral Pool #2 inside Alice's position #1"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress),
                  "collateralToken from Collateral Pool #2 inside Alice's Position #1 address should be 1 ibDUMMY, because Alice move 1 ibDUMMY form Alice's position #2 to Collateral Pool #2 inside Alice's position #1"
                ).to.be.equal(WeiPerWad)
                expect(
                  fathomStablecoinBalancefinal,
                  "Alice should receive 1 FUSD, because Alice draw 1 time"
                ).to.be.equal(WeiPerWad)
              })
            }
          )
          context(
            "Alice open a position, lock collateral and move collateral to Bob's position at another collateral pool by calling openLockTokenAndDraw() once and open() once",
            async () => {
              it("should success", async () => {
                // 1. Alice open position
                const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("open", [
                  positionManager.address,
                  COLLATERAL_POOL_ID,
                  aliceProxyWallet.address,
                ])
                await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
                const alicePositionAddress = await positionManager.positions(1)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                expect(
                  alicePosition.lockedCollateral,
                  "Alice's Position #1 lockedCollateral should be 0 ibDUMMY, because Alice didn't lock ibDUMMY"
                ).to.be.equal(0)
                expect(
                  alicePosition.debtShare,
                  "Alice's Position #1 debtShare should be 0 FUSD, because didn't draw FUSD"
                ).to.be.equal(0)
                // 2. Alice deposit 3 ibDUMMY to her position
                const depositPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "tokenAdapterDeposit",
                  [
                    collateralTokenAdapter.address,
                    await positionManager.positions(1),
                    WeiPerWad.mul(3),
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  depositPositionCall
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken from Collateral Pool #1 inside Alice's Position #1 address should be 3 ibDUMMY, because Alice deposit 3 ibDUMMY into the her position"
                ).to.be.equal(WeiPerWad.mul(3))
                // 3. Bob open a position with 1 ibDUMMY and draw 1 FUSD at another collateral pool
                const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter2.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID2,
                    WeiPerWad,
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                  ]
                )
                await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
                await bobProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  bobOpenPositionCall
                )
                const bobPositionAddress = await positionManager.positions(2)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
                const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
                expect(
                  bobPosition.lockedCollateral,
                  "lockedCollateral from Collateral Pool #2 inside Bob's Position #1 address should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  bobPosition.debtShare,
                  "debtShare from Collateral Pool #2 inside Bob's Position #1 address should be 1 FUSD, because Bob drew 1 FUSD"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                  "collateralToken from Collateral Pool #2 inside Bob's Position #1 address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
                // 4. Alice try to move collateral to Bob's position across collateral pool
                const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  bobPositionAddress,
                  WeiPerWad,
                  collateralTokenAdapter.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
                const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
                const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken from Collateral Pool #1 inside Alice's Position #1 address should be 2 ibDUMMY, because Alice move 1 ibDUMMY to Bob's position"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                  "collateralToken from Collateral Pool #1 inside new Bob's Position address should be 1 ibDUMMY, because System auto create Bob's position at Collateral Pool #1, so Alice can move 1 ibDUMMY into the new Bob's position"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                  "collateralToken from Collateral Pool #2 inside Bob's Position #1 address should be 0 ibDUMMY, because Alice can't move ibDUMMY across collateral pool"
                ).to.be.equal(0)
                expect(
                  aliceFathomStablecoinBalancefinal,
                  "Alice should receive 0 FUSD, because Alice didn't draw more"
                ).to.be.equal(0)
                expect(
                  bobFathomStablecoinBalancefinal,
                  "Bob should receive 1 FUSD, because Bob drew 1 time"
                ).to.be.equal(WeiPerWad)
              })
            }
          )
        })
      })

      context("mint FUSD", async () => {
        it("should success", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad.mul(2),
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

          // 2. Alice try to mint FUSD
          const drawFUSD = fathomStablecoinProxyActions.interface.encodeFunctionData("draw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            WeiPerWad,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, drawFUSD)
          const fathomStablecoinBalance2 = await fathomStablecoin.balanceOf(aliceAddress)
          const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            aliceAdjustPosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice doesn't add ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(aliceAdjustPosition.debtShare, "debtShare should be 2 FUSD, because Alice drew more").to.be.equal(
            WeiPerWad.mul(2)
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance2, "Alice should receive 2 FUSD from drawing 2 FUSD").to.be.equal(
            WeiPerWad.mul(2)
          )
        })
      })

      context("move position", async () => {
        context("same collateral pool", async () => {
          context(
            "call openLockTokenAndDraw, unlock collateral and move the collateral from one position to another position within the same collateral pool",
            async () => {
              it("should success", async () => {
                // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
                const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad,
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

                expect(
                  alicePosition.lockedCollateral,
                  "Alice's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "Alice's Position #1 collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                  WeiPerWad
                )

                // 2. Alice open a second new position with 2 ibDUMMY and draw 1 FUSD at same collateral pool
                const openPositionCall2 = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad.mul(2),
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  openPositionCall2
                )
                const alicePositionAddress2 = await positionManager.positions(2)
                const fathomStablecoinBalance2 = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition2 = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress2)

                expect(
                  alicePosition2.lockedCollateral,
                  "Alice's Position #2 lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(alicePosition2.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                  WeiPerWad
                )
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress2),
                  "Alice's Position #2 collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(
                  fathomStablecoinBalance2,
                  "Alice should receive 2 FUSD, because Alice drew FUSD 2 times form 2 positions"
                ).to.be.equal(WeiPerWad.mul(2))

                // 3. Alice try to unlock 1 ibDUMMY at second position
                const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  WeiPerWad.mul(-1),
                  0,
                  collateralTokenAdapter.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
                const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress2)
                expect(
                  aliceAdjustPosition.lockedCollateral,
                  "Alice's Position #2 lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceAdjustPosition.debtShare,
                  "Alice's Position #2 debtShare should be 1 FUSD, because Alice didn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress2),
                  "Alice's Position #2 collateralToken should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY into the position"
                ).to.be.equal(WeiPerWad)

                // 4. Alice try to move position from second position to first position
                const movePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("movePosition", [
                  positionManager.address,
                  2,
                  1,
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, movePosition)
                const alicemovePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                const fathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
                expect(
                  alicemovePosition.lockedCollateral,
                  "Alice's Position #1 lockedCollateral should be 2 ibDUMMY, because Alice move form Position #2 to Postion #1"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(
                  alicemovePosition.debtShare,
                  "Alice's Position #1 debtShare should be 2 FUSD, because Alice move form Position #2 to Postion #1"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress2),
                  "collateralToken inside Alice's Position #2 address should still be 1 ibDUMMY, because Alice moving position will not move collateral"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's Position #1 address should still be 0 ibDUMMY, because Alice moving position will not move collateral"
                ).to.be.equal(0)
                expect(
                  fathomStablecoinBalancefinal,
                  "Alice should receive 2 FUSD from drawing 2 FUSD, because Alice drew 2 times"
                ).to.be.equal(WeiPerWad.mul(2))
                const alicePosition1Stake = await collateralTokenAdapter.stake(alicePositionAddress)
                expect(alicePosition1Stake, "Stake must be correctly updated after movePosition").to.be.equal(
                  WeiPerWad.mul(2)
                )
              })
            }
          )
        })

        context("between 2 collateral pool", async () => {
          context(
            "Alice opens 2 positions on 2 collateral pools (one position for each collateral pool) and Alice move collateral from one position to another position",
            async () => {
              it("should revert", async () => {
                // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
                const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID,
                    WeiPerWad,
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

                expect(
                  alicePosition.lockedCollateral,
                  "Collateral Pool #1 inside Bob's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  alicePosition.debtShare,
                  "Collateral Pool #1 inside Bob's Position #1 debtShare should be 1 FUSD, because Alice drew 1 FUSD"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                  WeiPerWad
                )

                // 2. Alice open a second new position with 2 ibDUMMY and draw 1 FUSD at new collateral pool
                const openPositionCall2 = fathomStablecoinProxyActions.interface.encodeFunctionData(
                  "openLockTokenAndDraw",
                  [
                    positionManager.address,
                    stabilityFeeCollector.address,
                    collateralTokenAdapter2.address,
                    stablecoinAdapter.address,
                    COLLATERAL_POOL_ID2,
                    WeiPerWad.mul(2),
                    WeiPerWad,
                    true,
                    ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                  ]
                )
                await aliceProxyWallet.execute2(
                  fathomStablecoinProxyActions.address,
                  openPositionCall2
                )
                const alicePositionAddress2 = await positionManager.positions(2)
                const fathomStablecoinBalance2 = await fathomStablecoin.balanceOf(aliceAddress)
                const alicePosition2 = await bookKeeper.positions(COLLATERAL_POOL_ID2, alicePositionAddress2)

                expect(
                  alicePosition2.lockedCollateral,
                  "Collateral Pool #2 inside Bob's Position #2 lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
                ).to.be.equal(WeiPerWad.mul(2))
                expect(
                  alicePosition2.debtShare,
                  "Collateral Pool #2 inside Bob's Position #2 debtShare should be 1 FUSD, because Alice drew 1 FUSD"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress2),
                  "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
                ).to.be.equal(0)
                expect(
                  fathomStablecoinBalance2,
                  "Alice should receive 2 FUSD from drawing 1 FUSD 2 times form 2 positions"
                ).to.be.equal(WeiPerWad.mul(2))

                // 3. Alice try to unlock 1 ibDUMMY at second position
                const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                  positionManager.address,
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  WeiPerWad.mul(-1),
                  0,
                  collateralTokenAdapter2.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ])
                await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
                const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, alicePositionAddress2)
                expect(
                  aliceAdjustPosition.lockedCollateral,
                  "Collateral Pool #2 inside Bob's Position #2 lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
                ).to.be.equal(WeiPerWad)
                expect(
                  aliceAdjustPosition.debtShare,
                  "Collateral Pool #2 inside Bob's Position #2 debtShare should be 1 FUSD, because Alice didn't draw more"
                ).to.be.equal(WeiPerWad)
                expect(
                  await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress2),
                  "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY into the position"
                ).to.be.equal(WeiPerWad)

                // 4. Alice try to move collateral from second position to first position
                const movePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("movePosition", [
                  positionManager.address,
                  2,
                  1,
                ])
                await expect(
                  aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, movePosition)
                ).to.be.revertedWith("!same collateral pool")
              })
            }
          )
        })
      })
    })

    context("position owner allow other user to manage position with proxy wallet", async () => {
      context("lock collateral into their own position", async () => {
        it("should success", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad,
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
          // 2. Alice allow Bob to manage position
          const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("allowManagePosition", [
            positionManager.address,
            1,
            bobProxyWallet.address,
            1,
          ])
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
          expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobProxyWallet.address)).to.be.equal(
            1
          )
          // 3. Bob try to adjust Alice's position, add 2 ibDummy to position
          const lockToken = fathomStablecoinProxyActions.interface.encodeFunctionData("lockToken", [
            positionManager.address,
            collateralTokenAdapter.address,
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            WeiPerWad.mul(2),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
          await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, lockToken)
          const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            aliceAdjustPosition.lockedCollateral,
            "lockedCollateral should be 3 ibDUMMY, because Bob add locked 2 ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(3))
        })
      })
      context("move collateral", async () => {
        context("same collateral pool", async () => {
          context("and Bob move collateral of Alice to himself", async () => {
            it("should success", async () => {
              // 1. Alice open a new position with 2 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad,
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Alice try to unlock 1 ibDUMMY at her position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                aliceAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Alice doesn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY into the position"
              ).to.be.equal(WeiPerWad)
              // 4. Alice allow Bob to manage position
              const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "allowManagePosition",
                [positionManager.address, 1, bobProxyWallet.address, 1]
              )
              await aliceProxyWallet.execute2(
                fathomStablecoinProxyActions.address,
                allowManagePosition
              )
              expect(
                await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobProxyWallet.address)
              ).to.be.equal(1)
              // 5. Bob try to move collateral to Alice position
              const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                bobPositionAddress,
                WeiPerWad,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
              const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
              const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY of Alice's position to his position"
              ).to.be.equal(0)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY of Alice's position to his position"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceFathomStablecoinBalancefinal,
                "Alice should receive 1 FUSD, because Alice drew 1 time"
              ).to.be.equal(WeiPerWad)
              expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
                WeiPerWad
              )
            })
          })
        })
        context("between collateral pool", async () => {
          context("and Bob move collateral of Alice to himself", async () => {
            it("should success", async () => {
              // 1. Alice open a new position with 2 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position at collateral pool 2 with 1 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter2.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID2,
                  WeiPerWad,
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Alice try to unlock 1 ibDUMMY at her position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                aliceAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Alice didn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY at her position"
              ).to.be.equal(WeiPerWad)
              // 4. Alice allow Bob to manage position
              const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "allowManagePosition",
                [positionManager.address, 1, bobProxyWallet.address, 1]
              )
              await aliceProxyWallet.execute2(
                fathomStablecoinProxyActions.address,
                allowManagePosition
              )
              expect(
                await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobProxyWallet.address)
              ).to.be.equal(1)
              // 5. Bob try to move collateral to Alice position
              const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                bobPositionAddress,
                WeiPerWad,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
              const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
              const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY of Alice's position to himself"
              ).to.be.equal(0)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 1 ibDUMMY, because Bob move 1 ibDUMMY of Alice's position to himself"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY of Alice's position to himself"
              ).to.be.equal(0)
              expect(
                aliceFathomStablecoinBalancefinal,
                "Alice should receive 1 FUSD, because Alice drew 1 time"
              ).to.be.equal(WeiPerWad)
              expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
                WeiPerWad
              )
            })
          })
        })
      })
      context("mint FUSD", async () => {
        it("should success", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad.mul(2),
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
          // 2. Alice allow Bob to manage position
          const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("allowManagePosition", [
            positionManager.address,
            1,
            bobProxyWallet.address,
            1,
          ])
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
          expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobProxyWallet.address)).to.be.equal(
            1
          )
          // 3. Bob try to mint FUSD at Alice position
          const drawFUSD = fathomStablecoinProxyActions.interface.encodeFunctionData("draw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            WeiPerWad,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, drawFUSD)
          const fathomStablecoinBalance2 = await fathomStablecoin.balanceOf(aliceAddress)
          const BobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
          const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            aliceAdjustPosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice didn't add ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(aliceAdjustPosition.debtShare, "debtShare should be 2 FUSD, because Alice drew more").to.be.equal(
            WeiPerWad.mul(2)
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance2, "Alice should receive 1 FUSD from Alice drew 1 time").to.be.equal(WeiPerWad)
          expect(BobFathomStablecoinBalance, "Bob should receive 1 FUSD from mint Ausd at Alice position").to.be.equal(
            WeiPerWad
          )
        })
      })
      context("move position", async () => {
        context("same collateral pool", async () => {
          it("should success", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
            ])
            await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
            await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
            const alicePositionAddress = await positionManager.positions(1)
            const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
            const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
            expect(
              alicePosition.lockedCollateral,
              "Collateral Pool #1 inside Alice's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(
              alicePosition.debtShare,
              "Collateral Pool #1 inside Alice's Position #1 debtShare should be 1 FUSD, because Alice drew 1 FUSD"
            ).to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "Collateral Pool #1 inside Bob's Position #1 lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(
              bobPosition.debtShare,
              "Collateral Pool #1 inside Bob's Position #1 debtShare should be 1 FUSD, because Bob drew 1 FUSD"
            ).to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 3. Alice allow Bob to manage position
            const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "allowManagePosition",
              [positionManager.address, 1, bobProxyWallet.address, 1]
            )
            await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
            expect(
              await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobProxyWallet.address)
            ).to.be.equal(1)
            // 4. Bob try to move collateral to alice position
            const movePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("movePosition", [
              positionManager.address,
              2,
              1,
            ])
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, movePosition)
            const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
            const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
            const alicePositionAfterMovePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
            expect(
              alicePositionAfterMovePosition.lockedCollateral,
              "Collateral Pool #1 inside Alice's Position #1 lockedCollateral should be 2 ibDUMMY, because Bob move locked 1 ibDUMMY to Alice"
            ).to.be.equal(WeiPerWad.mul(2))
            expect(
              alicePositionAfterMovePosition.debtShare,
              "Collateral Pool #1 inside Alice's Position #1 debtShare should be 1 FUSD, because Bob move DebtShare to Alice"
            ).to.be.equal(WeiPerWad.mul(2))
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice all lock collateral"
            ).to.be.equal(0)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob all lock collateral"
            ).to.be.equal(0)
            expect(
              aliceFathomStablecoinBalancefinal,
              "Alice should receive 1 FUSD, because Alice drew 1 time"
            ).to.be.equal(WeiPerWad)
            expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
              WeiPerWad
            )
          })
        })
        context("between 2 collateral pool", async () => {
          it("should revert", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
            ])
            await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
            await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
            const alicePositionAddress = await positionManager.positions(1)
            const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
            const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
            expect(
              alicePosition.lockedCollateral,
              "Collateral Pool #1 inside Alice's Position #1 lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(
              alicePosition.debtShare,
              "Collateral Pool #1 inside Bob's Position #1 debtShare should be 1 FUSD, because Alice drew 1 FUSD"
            ).to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD at collateral pool id 2
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter2.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID2,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "Collateral Pool #1 inside Bob's Position #1 lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(
              bobPosition.debtShare,
              "Collateral Pool #1 inside Bob's Position #1 debtShare should be 1 FUSD, because Bob drew 1 FUSD"
            ).to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 3. Alice allow Bob to manage position
            const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "allowManagePosition",
              [positionManager.address, 1, bobProxyWallet.address, 1]
            )
            await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
            expect(
              await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobProxyWallet.address)
            ).to.be.equal(1)
            // 4. Bob try to move position to Alice position
            const movePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("movePosition", [
              positionManager.address,
              2,
              1,
            ])
            await expect(
              bobProxyWallet.execute2(fathomStablecoinProxyActions.address, movePosition)
            ).to.be.revertedWith("!same collateral pool")
          })
        })
      })
    })

    context("position owner not allow other user to manage position with proxy wallet", async () => {
      context("lock collateral into their own position", async () => {
        it("should revert", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad,
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

          // 2. Bob try to adjust Alice's position, add 2 ibDummy to position
          const lockToken = fathomStablecoinProxyActions.interface.encodeFunctionData("lockToken", [
            positionManager.address,
            collateralTokenAdapter.address,
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            WeiPerWad.mul(2),
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
          await expect(
            bobProxyWallet.execute2(fathomStablecoinProxyActions.address, lockToken)
          ).to.be.revertedWith("owner not allowed")
        })
      })
      context("move collateral", async () => {
        context("same collateral pool", async () => {
          context("and Bob move collateral to Alice", async () => {
            it("should success", async () => {
              // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad,
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position with 2 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Bob locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Bob try to unlock 1 ibDUMMY at second position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(bobProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ])
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const bobAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
              expect(
                bobAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Bob unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                bobAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Bob doesn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 1 ibDUMMY, because Bob unlocked 1 ibDUMMY into the position"
              ).to.be.equal(WeiPerWad)
              // 4. Bob try to move collateral to Alice position
              const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                positionManager.address,
                await positionManager.ownerLastPositionId(bobProxyWallet.address),
                alicePositionAddress,
                WeiPerWad,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ])
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
              const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
              const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Bob move 1 ibDUMMY to Alice's position"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY to Alice's position"
              ).to.be.equal(0)
              expect(
                aliceFathomStablecoinBalancefinal,
                "Alice should receive 1 FUSD, because Alice drew 1 time"
              ).to.be.equal(WeiPerWad)
              expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
                WeiPerWad
              )
            })
          })
        })
        context("between collateral pool", async () => {
          context("and Bob move collateral to Alice", async () => {
            it("should success", async () => {
              // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad,
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice locked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position at collateral pool 2 with 2 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter2.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID2,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Bob locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Bob try to unlock 1 ibDUMMY at second position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(bobProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter2.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ])
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const bobAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
              expect(
                bobAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Bob unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                bobAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Bob didn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                "collateralToken inside Bob's position address should be 1 ibDUMMY, because Bob unlocked 1 ibDUMMY into the position"
              ).to.be.equal(WeiPerWad)
              // 4. Bob try to move collateral to Alice position
              const moveCollateral = fathomStablecoinProxyActions.interface.encodeFunctionData("moveCollateral", [
                positionManager.address,
                await positionManager.ownerLastPositionId(bobProxyWallet.address),
                alicePositionAddress,
                WeiPerWad,
                collateralTokenAdapter2.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ])
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, moveCollateral)
              const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
              const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY to Alice's position"
              ).to.be.equal(0)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Bob move 1 ibDUMMY to Alice's position"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY to Alice's position"
              ).to.be.equal(0)
              expect(
                aliceFathomStablecoinBalancefinal,
                "Alice should receive 1 FUSD, because Alice drew 1 time"
              ).to.be.equal(WeiPerWad)
              expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
                WeiPerWad
              )
            })
          })
        })
      })
      context("mint FUSD", async () => {
        it("should revert", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad.mul(2),
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
          // 2. Bob try to mint FUSD at Alice position
          const drawFUSD = fathomStablecoinProxyActions.interface.encodeFunctionData("draw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            WeiPerWad,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await expect(
            bobProxyWallet.execute2(fathomStablecoinProxyActions.address, drawFUSD)
          ).to.be.revertedWith("owner not allowed")
        })
      })
      context("move position", async () => {
        context("same collateral pool", async () => {
          it("should revert", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
            expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
              WeiPerWad
            )
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 3. Bob try to move collateral to alice position
            const movePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("movePosition", [
              positionManager.address,
              2,
              1,
            ])
            await expect(
              bobProxyWallet.execute2(fathomStablecoinProxyActions.address, movePosition)
            ).to.be.revertedWith("owner not allowed")
          })
        })
        context("between 2 collateral pool", async () => {
          it("should revert", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
            expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
              WeiPerWad
            )
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD at collateral pool id 2
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter2.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID2,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

            // 3. Bob try to move position to Alice position
            const movePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("movePosition", [
              positionManager.address,
              2,
              1,
            ])
            await expect(
              bobProxyWallet.execute2(fathomStablecoinProxyActions.address, movePosition)
            ).to.be.revertedWith("owner not allowed")
          })
        })
      })
    })

    context("position owner allow other user to manage position with user wallet address", async () => {
      context("move collateral", async () => {
        context("same collateral pool", async () => {
          context("and Bob move collateral of Alice to himself", async () => {
            it("should success", async () => {
              // 1. Alice open a new position with 2 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad,
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Alice try to unlock 1 ibDUMMY at her position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                aliceAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Alice didn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY into the position"
              ).to.be.equal(WeiPerWad)

              // 4. Alice allow Bob to manage position
              const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "allowManagePosition",
                [positionManager.address, 1, bobAddress, 1]
              )
              await aliceProxyWallet.execute2(
                fathomStablecoinProxyActions.address,
                allowManagePosition
              )
              expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobAddress)).to.be.equal(1)

              // 5. Bob try to move collateral of Alice position to Bob position
              await positionManagerAsBob["moveCollateral(uint256,address,uint256,address,bytes)"](
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                bobPositionAddress,
                WeiPerWad,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
              )

              const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
              const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY to his position"
              ).to.be.equal(0)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Bob move 1 ibDUMMY to his position"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceFathomStablecoinBalancefinal,
                "Alice should receive 1 FUSD, because Alice drew 1 time"
              ).to.be.equal(WeiPerWad)
              expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
                WeiPerWad
              )
            })
          })
        })
        context("between collateral pool", async () => {
          context("and Bob move collateral of Alice to himself", async () => {
            it("should success", async () => {
              // 1. Alice open a new position with 2 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position at collateral pool 2 with 2 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter2.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID2,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Bob locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Alice try to unlock 1 ibDUMMY at her position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                aliceAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Alice didn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)

              // 4. Alice allow Bob to manage her position
              const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "allowManagePosition",
                [positionManager.address, 1, bobAddress, 1]
              )
              await aliceProxyWallet.execute2(
                fathomStablecoinProxyActions.address,
                allowManagePosition
              )
              expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobAddress)).to.be.equal(1)

              // 5. Bob try to move collateral of Alice position to his position
              await positionManagerAsBob["moveCollateral(uint256,address,uint256,address,bytes)"](
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                bobPositionAddress,
                WeiPerWad,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
              )
              const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
              const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Bob move 1 ibDUMMY to his position"
              ).to.be.equal(0)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 1 ibDUMMY at collater pool 1, because Bob move 1 ibDUMMY to his position"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY at collater pool 2, because Bob move 1 ibDUMMY to his position at collateral pool 1"
              ).to.be.equal(0)
              expect(
                aliceFathomStablecoinBalancefinal,
                "Alice should receive 1 FUSD, because Alice drew 1 time"
              ).to.be.equal(WeiPerWad)
              expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
                WeiPerWad
              )
            })
          })
        })
      })
      context("mint FUSD", async () => {
        it("should success", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad.mul(2),
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
          // 2. Alice allow Bob to manage position
          const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("allowManagePosition", [
            positionManager.address,
            1,
            bobAddress,
            1,
          ])
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
          expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobAddress)).to.be.equal(1)
          // 3. Bob try to mint FUSD at Alice position
          await positionManagerAsBob.adjustPosition(
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            0,
            alicePosition.debtShare,
            collateralTokenAdapter.address,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
          )

          // 4. move stablecoin of alice to bob
          await positionManagerAsBob.moveStablecoin(
            await positionManager.ownerLastPositionId(aliceProxyWallet.address),
            bobAddress,
            WeiPerRad
          )

          // 5. allow bob to window
          await bookKeeperAsBob.whitelist(stablecoinAdapter.address)

          // 6. mint ausd
          await stablecoinAdapterAsBob.withdraw(
            bobAddress,
            WeiPerWad,
            ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress])
          )
          const fathomStablecoinBalance2 = await fathomStablecoin.balanceOf(aliceAddress)
          const BobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
          const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            aliceAdjustPosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice doesn't add ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(aliceAdjustPosition.debtShare, "debtShare should be 2 FUSD, because Alice drew more").to.be.equal(
            WeiPerWad.mul(2)
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance2, "Alice should receive 1 FUSD, because Alice drew 1 time").to.be.equal(
            WeiPerWad
          )
          expect(BobFathomStablecoinBalance, "Bob should receive 1 FUSD from Alice position").to.be.equal(WeiPerWad)
        })
      })
      context("move position", async () => {
        context("same collateral pool", async () => {
          it("should success", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
            expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
              WeiPerWad
            )
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 3. Alice allow Bob to manage position
            const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "allowManagePosition",
              [positionManager.address, 1, bobAddress, 1]
            )
            await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
            expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobAddress)).to.be.equal(1)

            // 4. bob proxy wallet allow Bob address to manage position
            const bobAllowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "allowManagePosition",
              [positionManager.address, 2, bobAddress, 1]
            )
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobAllowManagePosition)
            expect(await positionManager.ownerWhitelist(bobProxyWallet.address, 2, bobAddress)).to.be.equal(1)

            // 5. Bob try to move collateral to alice position
            await positionManagerAsBob.movePosition(2, 1)
            const aliceFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(aliceAddress)
            const bobFathomStablecoinBalancefinal = await fathomStablecoin.balanceOf(bobAddress)
            const alicePositionAfterMovePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
            expect(
              alicePositionAfterMovePosition.lockedCollateral,
              "lockedCollateral should be 2 ibDUMMY, because Bob move locked 1 ibDUMMY to Alice"
            ).to.be.equal(WeiPerWad.mul(2))
            expect(
              alicePositionAfterMovePosition.debtShare,
              "debtShare should be 1 FUSD, because Bob move DebtShare to Alice"
            ).to.be.equal(WeiPerWad.mul(2))
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice all lock collateral"
            ).to.be.equal(0)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob all lock collateral"
            ).to.be.equal(0)
            expect(
              aliceFathomStablecoinBalancefinal,
              "Alice should receive 1 FUSD, because Alice drew 1 time"
            ).to.be.equal(WeiPerWad)
            expect(bobFathomStablecoinBalancefinal, "Bob should receive 1 FUSD, because Bob drew 1 time").to.be.equal(
              WeiPerWad
            )
          })
        })
        context("between 2 collateral pool", async () => {
          it("should revert", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
            expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
              WeiPerWad
            )
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD at collateral pool id 2
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter2.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID2,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

            // 3. Alice allow Bob to manage position
            const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "allowManagePosition",
              [positionManager.address, 1, bobAddress, 1]
            )
            await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
            expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, bobAddress)).to.be.equal(1)

            // 4. bob proxy wallet allow Bob address to manage position
            const bobAllowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "allowManagePosition",
              [positionManager.address, 2, bobAddress, 1]
            )
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobAllowManagePosition)
            expect(await positionManager.ownerWhitelist(bobProxyWallet.address, 2, bobAddress)).to.be.equal(1)

            // 5. Bob try to move position to Alice position
            await expect(positionManagerAsBob.movePosition(2, 1)).to.be.revertedWith("!same collateral pool")
          })
        })
      })
    })

    context("position owner not allow other user to manage position with user wallet address", async () => {
      context("move collateral", async () => {
        context("same collateral pool", async () => {
          context("and Bob move collateral of Alice to himself", async () => {
            it("should revert", async () => {
              // 1. Alice open a new position with 2 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad,
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Alice try to unlock 1 ibDUMMY at her position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                aliceAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Alice didn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY into the position"
              ).to.be.equal(WeiPerWad)

              // 4. Bob try to move collateral of Alice position to Bob position
              await expect(
                positionManagerAsBob["moveCollateral(uint256,address,uint256,address,bytes)"](
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  bobPositionAddress,
                  WeiPerWad,
                  collateralTokenAdapter.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
                )
              ).to.be.revertedWith("owner not allowed")
            })
          })
        })

        context("between collateral pool", async () => {
          context("and Bob move collateral of Alice to himself", async () => {
            it("should revert", async () => {
              // 1. Alice open a new position with 2 ibDUMMY and draw 1 FUSD
              const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
                ]
              )
              await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
              const alicePositionAddress = await positionManager.positions(1)
              const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
              const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                alicePosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 2. Bob open a position at collateral pool 2 with 2 ibDUMMY and draw 1 FUSD
              const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
                "openLockTokenAndDraw",
                [
                  positionManager.address,
                  stabilityFeeCollector.address,
                  collateralTokenAdapter2.address,
                  stablecoinAdapter.address,
                  COLLATERAL_POOL_ID2,
                  WeiPerWad.mul(2),
                  WeiPerWad,
                  true,
                  ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
                ]
              )
              await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
              await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
              const bobPositionAddress = await positionManager.positions(2)
              const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
              const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
              expect(
                bobPosition.lockedCollateral,
                "lockedCollateral should be 2 ibDUMMY, because Bob locked 2 ibDUMMY"
              ).to.be.equal(WeiPerWad.mul(2))
              expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(
                WeiPerWad
              )
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
                "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
              ).to.be.equal(0)
              expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
              // 3. Alice try to unlock 1 ibDUMMY at her position
              const adjustPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("adjustPosition", [
                positionManager.address,
                await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                WeiPerWad.mul(-1),
                0,
                collateralTokenAdapter.address,
                ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
              ])
              await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, adjustPosition)
              const aliceAdjustPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
              expect(
                aliceAdjustPosition.lockedCollateral,
                "lockedCollateral should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)
              expect(
                aliceAdjustPosition.debtShare,
                "debtShare should be 1 FUSD, because Alice didn't draw more"
              ).to.be.equal(WeiPerWad)
              expect(
                await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                "collateralToken inside Alice's position address should be 1 ibDUMMY, because Alice unlocked 1 ibDUMMY"
              ).to.be.equal(WeiPerWad)

              // 4. Bob try to move collateral of Alice position to his position
              await expect(
                positionManagerAsBob["moveCollateral(uint256,address,uint256,address,bytes)"](
                  await positionManager.ownerLastPositionId(aliceProxyWallet.address),
                  bobPositionAddress,
                  WeiPerWad,
                  collateralTokenAdapter.address,
                  ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
                )
              ).to.be.revertedWith("owner not allowed")
            })
          })
        })
      })

      context("mint FUSD", async () => {
        it("should revert", async () => {
          // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
          const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad.mul(2),
            WeiPerWad,
            true,
            ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
          ])
          await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
          await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          const alicePositionAddress = await positionManager.positions(1)
          const fathomStablecoinBalance = await fathomStablecoin.balanceOf(aliceAddress)
          const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
          expect(
            alicePosition.lockedCollateral,
            "lockedCollateral should be 2 ibDUMMY, because Alice locked 2 ibDUMMY"
          ).to.be.equal(WeiPerWad.mul(2))
          expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
            WeiPerWad
          )
          expect(
            await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
            "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
          ).to.be.equal(0)
          expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

          // 2. Bob try to mint FUSD at Alice position
          await expect(
            positionManagerAsBob.adjustPosition(
              await positionManager.ownerLastPositionId(aliceProxyWallet.address),
              0,
              alicePosition.debtShare,
              collateralTokenAdapter.address,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])
            )
          ).to.be.revertedWith("owner not allowed")
        })
      })

      context("move position", async () => {
        context("same collateral pool", async () => {
          it("should revert", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
            expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
              WeiPerWad
            )
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

            // 3. Bob try to move collateral to alice position
            await expect(positionManagerAsBob.movePosition(2, 1)).to.be.revertedWith("owner not allowed")
          })
        })
        context("between 2 collateral pool", async () => {
          it("should revert", async () => {
            // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManager.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              WeiPerWad,
              WeiPerWad,
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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
            expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
              WeiPerWad
            )
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
              "collateralToken inside Alice's position address should be 0 ibDUMMY, because Alice locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
            // 2. Bob open a position with 1 ibDUMMY and draw 1 FUSD at collateral pool id 2
            const bobOpenPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData(
              "openLockTokenAndDraw",
              [
                positionManager.address,
                stabilityFeeCollector.address,
                collateralTokenAdapter2.address,
                stablecoinAdapter.address,
                COLLATERAL_POOL_ID2,
                WeiPerWad,
                WeiPerWad,
                true,
                ethers.utils.defaultAbiCoder.encode(["address"], [bobAddress]),
              ]
            )
            await ibDUMMYasBob.approve(bobProxyWallet.address, WeiPerWad.mul(10000))
            await bobProxyWallet.execute2(fathomStablecoinProxyActions.address, bobOpenPositionCall)
            const bobPositionAddress = await positionManager.positions(2)
            const bobFathomStablecoinBalance = await fathomStablecoin.balanceOf(bobAddress)
            const bobPosition = await bookKeeper.positions(COLLATERAL_POOL_ID2, bobPositionAddress)
            expect(
              bobPosition.lockedCollateral,
              "lockedCollateral should be 1 ibDUMMY, because Bob locked 1 ibDUMMY"
            ).to.be.equal(WeiPerWad)
            expect(bobPosition.debtShare, "debtShare should be 1 FUSD, because Bob drew 1 FUSD").to.be.equal(WeiPerWad)
            expect(
              await bookKeeper.collateralToken(COLLATERAL_POOL_ID2, bobPositionAddress),
              "collateralToken inside Bob's position address should be 0 ibDUMMY, because Bob locked all ibDUMMY into the position"
            ).to.be.equal(0)
            expect(bobFathomStablecoinBalance, "Bob should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

            // 3. Bob try to move position to Alice position
            await expect(positionManagerAsBob.movePosition(2, 1)).to.be.revertedWith("owner not allowed")
          })
        })
      })
    })

    context("position owner can export and can import", async () => {
      it("should success", async () => {
        // 1. Alice open a new position with 1 ibDUMMY and draw 1 FUSD
        const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
          positionManager.address,
          stabilityFeeCollector.address,
          collateralTokenAdapter.address,
          stablecoinAdapter.address,
          COLLATERAL_POOL_ID,
          WeiPerWad,
          WeiPerWad,
          true,
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
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

        // 2. alice allow manage position
        const allowManagePosition = fathomStablecoinProxyActions.interface.encodeFunctionData("allowManagePosition", [
          positionManager.address,
          1,
          aliceAddress,
          1,
        ])
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, allowManagePosition)
        expect(await positionManager.ownerWhitelist(aliceProxyWallet.address, 1, aliceAddress)).to.be.equal(1)

        // 3. alice allow positionManage
        await bookKeeperAsAlice.whitelist(positionManager.address)

        // 4. alice allow migration
        await positionManagerAsAlice.allowMigratePosition(aliceProxyWallet.address, 1)
        expect(await positionManager.migrationWhitelist(aliceAddress, aliceProxyWallet.address)).to.be.equal(1)

        // 5. Alice export position
        const exportPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("exportPosition", [
          positionManager.address,
          1,
          aliceAddress,
        ])
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, exportPosition)
        const alicePositionAfterExport = await bookKeeper.positions(COLLATERAL_POOL_ID, aliceAddress)
        expect(
          alicePositionAfterExport.lockedCollateral,
          "lockedCollateral should be 1 ibDUMMY, because Alice export"
        ).to.be.equal(WeiPerWad)
        expect(alicePositionAfterExport.debtShare, "debtShare should be 1 FUSD, because Alice export").to.be.equal(
          WeiPerWad
        )
        const alicePositionWalletPositionAfterExport = await bookKeeper.positions(
          COLLATERAL_POOL_ID,
          alicePositionAddress
        )
        expect(
          alicePositionWalletPositionAfterExport.lockedCollateral,
          "lockedCollateral should be 0 ibDUMMY, because Alice export"
        ).to.be.equal(0)
        expect(
          alicePositionWalletPositionAfterExport.debtShare,
          "debtShare should be 0 FUSD, because Alice export"
        ).to.be.equal(0)
        const aliceAddressStake = await collateralTokenAdapter.stake(aliceAddress)
        expect(aliceAddressStake, "Stake must be correctly updated after exportPosition").to.be.equal(WeiPerWad)

        //6. alice import position back
        const importPosition = fathomStablecoinProxyActions.interface.encodeFunctionData("importPosition", [
          positionManager.address,
          aliceAddress,
          1,
        ])
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, importPosition)
        const alicePositionAfterImport = await bookKeeper.positions(COLLATERAL_POOL_ID, aliceAddress)
        expect(
          alicePositionAfterImport.lockedCollateral,
          "lockedCollateral should be 0 ibDUMMY, because Alice Import"
        ).to.be.equal(0)
        expect(alicePositionAfterImport.debtShare, "debtShare should be 0 FUSD, because Alice Import").to.be.equal(0)
        const alicePositionWalletPositionAfterImport = await bookKeeper.positions(
          COLLATERAL_POOL_ID,
          alicePositionAddress
        )
        expect(
          alicePositionWalletPositionAfterImport.lockedCollateral,
          "lockedCollateral should be 1 ibDUMMY, because Alice Import"
        ).to.be.equal(WeiPerWad)
        expect(
          alicePositionWalletPositionAfterImport.debtShare,
          "debtShare should be 1 FUSD, because Alice Import"
        ).to.be.equal(WeiPerWad)
        const alicePositionStake = await collateralTokenAdapter.stake(alicePositionAddress)
        expect(alicePositionStake, "Stake must be correctly updated after importPosition").to.be.equal(WeiPerWad)
      })
    })
  })
})
