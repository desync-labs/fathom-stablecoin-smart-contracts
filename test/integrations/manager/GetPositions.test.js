require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { advanceBlock } = require("../../helper/time");
const { loadProxyWalletFixtureHandler } = require("../../helper/proxy");
const {formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants
const { Zero } = ethers.constants

const FATHOM_PER_BLOCK = ethers.utils.parseEther("100")
const COLLATERAL_POOL_ID = formatBytes32String("ibDUMMY")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10250)
const TREASURY_FEE_BPS = BigNumber.from(5000)

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

  await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployer.address)
  await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), bookKeeper.address)
  await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)

  // Deploy mocked BEP20
  const BEP20 = (await ethers.getContractFactory("BEP20", deployer))
  const ibDUMMY = await BEP20.deploy("ibDUMMY", "ibDUMMY")
  await ibDUMMY.deployed()
  await ibDUMMY.mint(await alice.getAddress(), ethers.utils.parseEther("1000000"))
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

  // Deploy PositionManager
  const PositionManager = (await ethers.getContractFactory("PositionManager", deployer))
  const positionManager = (await upgrades.deployProxy(PositionManager, [
    bookKeeper.address,
    bookKeeper.address,
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

  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["ADAPTER_ROLE"]),
    collateralTokenAdapter.address
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

  const FathomStablecoinProxyActions = await ethers.getContractFactory("FathomStablecoinProxyActions", deployer)
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

  await stabilityFeeCollector.setSystemDebtEngine(systemDebtEngine.address)
  await accessControlConfig.grantRole(
    await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(),
    stabilityFeeCollector.address
  )

  const SimplePriceFeed = (await ethers.getContractFactory("SimplePriceFeed", deployer))
  const simplePriceFeed = (await upgrades.deployProxy(SimplePriceFeed, [
    accessControlConfig.address,
  ]))
  await simplePriceFeed.deployed()

  const GetPositions = (await ethers.getContractFactory("GetPositions", deployer)) 
  const getPositions = (await upgrades.deployProxy(GetPositions, []))

  await collateralPoolConfig.initCollateralPool(
    COLLATERAL_POOL_ID,
    WeiPerRad.mul(10000000),
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

  return {
    proxyWalletRegistry,
    collateralTokenAdapter,
    stablecoinAdapter,
    bookKeeper,
    ibDUMMY,
    fathomStablecoinProxyActions,
    positionManager,
    stabilityFeeCollector,
    fathomStablecoin,
    simplePriceFeed,
    systemDebtEngine,
    getPositions,
    collateralPoolConfig,
  }
}

describe("GetPositions", () => {
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
  let bobProxyWallet

  let collateralTokenAdapter
  let stablecoinAdapter
  let bookKeeper
  let ibDUMMY
  let collateralPoolConfig

  let positionManager
  let positionManagerAsBob

  let stabilityFeeCollector
  let fathomStablecoinProxyActions
  let simplePriceFeed
  let getPositions

  // Signer
  let collateralTokenAdapterAsAlice
  let collateralTokenAdapterAsBob

  let ibDUMMYasAlice
  let ibDUMMYasBob

  let simplePriceFeedAsDeployer

  before(async () => {
    ;({
      proxyWallets: [deployerProxyWallet, aliceProxyWallet, bobProxyWallet],
    } = await waffle.loadFixture(loadProxyWalletFixtureHandler))
  })

  beforeEach(async () => {
    ;({
      proxyWalletRegistry,
      collateralTokenAdapter,
      stablecoinAdapter,
      bookKeeper,
      ibDUMMY,
      fathomStablecoinProxyActions,
      positionManager,
      stabilityFeeCollector,
      fathomStablecoin,
      simplePriceFeed,
      systemDebtEngine,
      getPositions,
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

    simplePriceFeedAsDeployer = simplePriceFeed.connect(deployer)

    bookKeeperAsBob = bookKeeper.connect(bob)
    positionManagerAsBob = positionManager.connect(bob)
  })
  describe("#getPositionWithSafetyBuffer", async () => {
    context("multiple positions at risks", async () => {
      it("should query all positions at risks", async () => {
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.mul(2))

        await ibDUMMYasAlice.approve(aliceProxyWallet.address, WeiPerWad.mul(10000))
        const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
          positionManager.address,
          stabilityFeeCollector.address,
          collateralTokenAdapter.address,
          stablecoinAdapter.address,
          COLLATERAL_POOL_ID,
          ethers.utils.parseEther("1"),
          ethers.utils.parseEther("1"),
          true,
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
        ])
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
        await advanceBlock()

        const openPositionCall2 = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
          positionManager.address,
          stabilityFeeCollector.address,
          collateralTokenAdapter.address,
          stablecoinAdapter.address,
          COLLATERAL_POOL_ID,
          ethers.utils.parseEther("2"),
          ethers.utils.parseEther("1"),
          true,
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
        ])
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall2)
        await advanceBlock()

        const openPositionCall3 = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
          positionManager.address,
          stabilityFeeCollector.address,
          collateralTokenAdapter.address,
          stablecoinAdapter.address,
          COLLATERAL_POOL_ID,
          ethers.utils.parseEther("1.5"),
          ethers.utils.parseEther("1"),
          true,
          ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
        ])
        await aliceProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall3)
        await advanceBlock()

        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, ethers.utils.parseEther("0.9").mul(1e9))
        const positions = await getPositions.getPositionWithSafetyBuffer(positionManager.address, 1, 40)
        expect(positions._debtShares[0]).to.be.equal(WeiPerWad)
        expect(positions._debtShares[1]).to.be.equal(WeiPerWad)
        expect(positions._debtShares[2]).to.be.equal(WeiPerWad)
        expect(positions._safetyBuffers[0]).to.be.equal(Zero)
        expect(positions._safetyBuffers[1]).to.be.equal(WeiPerRad.mul(8).div(10))
        expect(positions._safetyBuffers[2]).to.be.equal(WeiPerRad.mul(35).div(100))
      })
    })
  })

  describe("#getAllPostionsAsc, #getPositionsAsc, #getAllPositionsDesc, #getPositionsDesc", async () => {
    context("when Bob opened 11 positions", async () => {
      context("when calling each getPositions function", async () => {
        it("should return correctly", async () => {
          const open = async () => {
            const openPositionCall = fathomStablecoinProxyActions.interface.encodeFunctionData("openLockTokenAndDraw", [
              positionManagerAsBob.address,
              stabilityFeeCollector.address,
              collateralTokenAdapter.address,
              stablecoinAdapter.address,
              COLLATERAL_POOL_ID,
              ethers.utils.parseEther("2"),
              ethers.utils.parseEther("1"),
              true,
              ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress]),
            ])
            return bobProxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall)
          }

          const open11 = async () => {
            await ibDUMMYasBob.approve(bobProxyWallet.address, MaxUint256)
            for (let i = 0; i < 11; i++) {
              await (await open()).wait()
              // call advanceBlock to prevent unknown random revert
              await advanceBlock()
            }
          }

          await open11()

          /**
           * #getAllPositionsDesc
           */
          {
            const [ids, positions, collateralPools] = await getPositions.getAllPositionsAsc(
              positionManagerAsBob.address,
              bobProxyWallet.address
            )

            expect(ids.length).to.be.equal(11)
            expect(positions.length).to.be.equal(11)
            expect(collateralPools.length).to.be.equal(11)
            expect(ids[0]).to.be.equal(1)
            expect(ids[10]).to.be.equal(11)
          }

          /**
           * #getAllPositionsDesc
           */
          {
            const [ids, positions, collateralPools] = await getPositions.getAllPositionsDesc(
              positionManagerAsBob.address,
              bobProxyWallet.address
            )

            expect(ids.length).to.be.equal(11)
            expect(positions.length).to.be.equal(11)
            expect(collateralPools.length).to.be.equal(11)
            expect(ids[0]).to.be.equal(11)
            expect(ids[10]).to.be.equal(1)
          }

          /**
           * #getPositionsAsc
           */
          {
            // 1st page
            let from = await positionManagerAsBob.ownerFirstPositionId(bobProxyWallet.address)
            let [ids, positions, collateralPools] = await getPositions.getPositionsAsc(
              positionManagerAsBob.address,
              from,
              4
            )
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(1)
            expect(ids[3]).to.be.equal(4)

            // 2nd page
            from = ids[3]
            ;[ids, positions, collateralPools] = await getPositions.getPositionsAsc(
              positionManagerAsBob.address,
              from,
              4
            )
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(4)
            expect(ids[3]).to.be.equal(7)

            // 3rd page
            from = ids[3]
            ;[ids, positions, collateralPools] = await getPositions.getPositionsAsc(
              positionManagerAsBob.address,
              from,
              4
            )
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(7)
            expect(ids[3]).to.be.equal(10)

            // 4th page
            from = ids[3]
            ;[ids, positions, collateralPools] = await getPositions.getPositionsAsc(
              positionManagerAsBob.address,
              from,
              4
            )

            // even the page is not filled up, the size will be four
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(10)
            expect(ids[1]).to.be.equal(11)
            expect(ids[2]).to.be.equal(0)
            expect(ids[3]).to.be.equal(0)
          }

          /**
           * #getPositionsDesc
           */
          {
            // 1st page
            let from = await positionManagerAsBob.ownerLastPositionId(bobProxyWallet.address)
            let [ids, positions, collateralPools] = await getPositions.getPositionsDesc(
              positionManagerAsBob.address,
              from,
              4
            )
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(11)
            expect(ids[3]).to.be.equal(8)

            // 2nd page
            from = ids[3]
            ;[ids, positions, collateralPools] = await getPositions.getPositionsDesc(
              positionManagerAsBob.address,
              from,
              4
            )
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(8)
            expect(ids[3]).to.be.equal(5)

            // 3rd page
            from = ids[3]
            ;[ids, positions, collateralPools] = await getPositions.getPositionsDesc(
              positionManagerAsBob.address,
              from,
              4
            )
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(5)
            expect(ids[3]).to.be.equal(2)

            // 4th page
            from = ids[3]
            ;[ids, positions, collateralPools] = await getPositions.getPositionsDesc(
              positionManagerAsBob.address,
              from,
              4
            )

            // even the page is not filled up, the size will be four
            expect(ids.length).to.be.equal(4)
            expect(positions.length).to.be.equal(4)
            expect(collateralPools.length).to.be.equal(4)
            expect(ids[0]).to.be.equal(2)
            expect(ids[1]).to.be.equal(1)
            expect(ids[2]).to.be.equal(0)
            expect(ids[3]).to.be.equal(0)
          }
        })
      })
    })
  })
})
