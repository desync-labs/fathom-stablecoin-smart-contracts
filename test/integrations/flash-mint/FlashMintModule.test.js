require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");

const { WeiPerRad, WeiPerRay } = require("../../helper/unit");
const { formatBytes32String } = require("ethers/lib/utils");

const DEXRouter = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')
const WETH9 = require('@uniswap/v2-periphery/build/WETH9.json')
const DEXPair = require('@uniswap/v2-core/build/IUniswapV2Pair.json')
const DEXFactory    = require('@uniswap/v2-core/build/UniswapV2Factory.json')

const { expect } = chai
const { AddressZero } = ethers.constants

const COLLATERAL_POOL_ID = formatBytes32String("BUSD-StableSwap")
const FOREVER = "2000000000"

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const loadFixtureHandler = async () => {
  const [deployer, alice, bob, dev] = await ethers.getSigners()

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

  // Deploy mocked BEP20
  const BEP20 = (await ethers.getContractFactory("BEP20", deployer))
  const BUSD = await BEP20.deploy("BUSD", "BUSD")
  await BUSD.deployed()

  const AuthTokenAdapter = (await ethers.getContractFactory("AuthTokenAdapter", deployer))
  const authTokenAdapter = (await upgrades.deployProxy(AuthTokenAdapter, [
    bookKeeper.address,
    COLLATERAL_POOL_ID,
    BUSD.address,
  ]))
  await authTokenAdapter.deployed()
  await accessControlConfig.grantRole(
    ethers.utils.solidityKeccak256(["string"], ["ADAPTER_ROLE"]),
    authTokenAdapter.address
  )
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
    authTokenAdapter.address,
    CLOSE_FACTOR_BPS,
    LIQUIDATOR_INCENTIVE_BPS,
    TREASURY_FEE_BPS,
    AddressZero
  )
  await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100000000000000))
  await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRad.mul(100000000000000))
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
  await bookKeeper.whitelist(stablecoinAdapter.address)

  const SystemDebtEngine = (await ethers.getContractFactory("SystemDebtEngine", deployer))
  const systemDebtEngine = (await upgrades.deployProxy(SystemDebtEngine, [bookKeeper.address]))

  const StableSwapModule = (await ethers.getContractFactory("StableSwapModule", deployer))
  const stableSwapModule = (await upgrades.deployProxy(StableSwapModule, [
    authTokenAdapter.address,
    stablecoinAdapter.address,
    systemDebtEngine.address,
  ]))
  await stableSwapModule.deployed()
  await authTokenAdapter.grantRole(await authTokenAdapter.WHITELISTED(), stableSwapModule.address)
  await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), stableSwapModule.address)
  await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), stableSwapModule.address)

  const FlashMintModule = (await ethers.getContractFactory("FlashMintModule", deployer))
  const flashMintModule = (await upgrades.deployProxy(FlashMintModule, [
    stablecoinAdapter.address,
    systemDebtEngine.address,
  ]))
  await flashMintModule.deployed()
  await flashMintModule.setMax(ethers.utils.parseEther("100000000"))
  await flashMintModule.setFeeRate(ethers.utils.parseEther("25").div(10000))
  await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), flashMintModule.address)

  const FlashMintArbitrager = (await ethers.getContractFactory(
    "FlashMintArbitrager",
    deployer
  ))
  const flashMintArbitrager = (await upgrades.deployProxy(FlashMintArbitrager, []))
  await flashMintArbitrager.deployed()

  const BookKeeperFlashMintArbitrager = (await ethers.getContractFactory(
    "BookKeeperFlashMintArbitrager",
    deployer
  ))
  const bookKeeperFlashMintArbitrager = (await upgrades.deployProxy(BookKeeperFlashMintArbitrager, [
    fathomStablecoin.address,
  ]))
  await bookKeeperFlashMintArbitrager.deployed()

  // Setup Pancakeswap
  const DEXFactoryV2 = await ethers.getContractFactory(DEXFactory.abi, DEXFactory.bytecode, deployer)
  const factoryV2 = await DEXFactoryV2.deploy(await deployer.getAddress())
  await factoryV2.deployed()

  const WBNB = await ethers.getContractFactory(WETH9.abi, WETH9.bytecode, deployer)
  const wbnb = await WBNB.deploy()
  await wbnb.deployed()

  const PancakeRouterV2 = await ethers.getContractFactory(DEXRouter.abi, DEXRouter.bytecode, deployer)
  const routerV2 = await PancakeRouterV2.deploy(factoryV2.address, wbnb.address)
  await routerV2.deployed()

  /// Setup BUSD-FUSD pair on Pancakeswap
  await factoryV2.createPair(BUSD.address, fathomStablecoin.address)
  const Pair = await ethers.getContractFactory(DEXPair.abi, DEXPair.bytecode, deployer)
  const lpV2 = Pair.attach(await factoryV2.getPair(BUSD.address, fathomStablecoin.address)).connect(deployer)

  return {
    stablecoinAdapter,
    bookKeeper,
    BUSD,
    fathomStablecoin,
    flashMintModule,
    stableSwapModule,
    authTokenAdapter,
    flashMintArbitrager,
    routerV2,
    bookKeeperFlashMintArbitrager,
  }
}

describe("FlastMintModule", () => {
  // Accounts
  let deployer
  let alice
  let bob
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let bobAddress

  // Contracts
  let stablecoinAdapter
  let bookKeeper
  let BUSD
  let flashMintModule
  let stableSwapModule
  let authTokenAdapter
  let flashMintArbitrager
  let bookKeeperFlashMintArbitrager
  let fathomStablecoin
  let systemDebtEngine
  let routerV2

  // Signer

  let busdAsAlice
  let busdAsBob

  let bookKeeperAsBob

  beforeEach(async () => {
    ;({
      stablecoinAdapter,
      bookKeeper,
      BUSD,
      fathomStablecoin,
      flashMintModule,
      stableSwapModule,
      authTokenAdapter,
      flashMintArbitrager,
      routerV2,
      bookKeeperFlashMintArbitrager,
    } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
    ])

    busdAsAlice = BUSD.connect(alice)
    busdAsBob = BUSD.connect(bob)

    bookKeeperAsBob = bookKeeper.connect(bob)
  })
  describe("#flashLoan", async () => {
    context("FUSD price at $1", async () => {
      it("should revert, because there is no arbitrage opportunity, thus no profit to pay for flash mint fee", async () => {
        // Deployer adds 1000 BUSD + 1000 FUSD
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1000"))
        await bookKeeper.mintUnbackedStablecoin(
          deployerAddress,
          deployerAddress,
          ethers.utils.parseEther("1000").mul(WeiPerRay)
        )
        await stablecoinAdapter.withdraw(deployerAddress, ethers.utils.parseEther("1000"), "0x")
        await BUSD.approve(routerV2.address, ethers.utils.parseEther("1000"))
        await fathomStablecoin.approve(routerV2.address, ethers.utils.parseEther("1000"))
        await routerV2.addLiquidity(
          BUSD.address,
          fathomStablecoin.address,
          ethers.utils.parseEther("1000"),
          ethers.utils.parseEther("1000"),
          "0",
          "0",
          await deployerAddress,
          FOREVER
        )

        // Current FUSD price is $1
        // Perform flash mint to arbitrage
        await expect(
          flashMintModule.flashLoan(
            flashMintArbitrager.address,
            fathomStablecoin.address,
            ethers.utils.parseEther("10"),
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "address"],
              [routerV2.address, BUSD.address, stableSwapModule.address]
            )
          )
        ).to.be.revertedWith("!safeTransferFrom")
      })
    })

    context("FUSD price at $1.5", async () => {
      it("should success", async () => {
        // Deployer adds 1500 BUSD + 1000 FUSD
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1500"))
        await bookKeeper.mintUnbackedStablecoin(
          deployerAddress,
          deployerAddress,
          ethers.utils.parseEther("1000").mul(WeiPerRay)
        )
        await stablecoinAdapter.withdraw(deployerAddress, ethers.utils.parseEther("1000"), "0x")
        await BUSD.approve(routerV2.address, ethers.utils.parseEther("1500"))
        await fathomStablecoin.approve(routerV2.address, ethers.utils.parseEther("1000"))
        await routerV2.addLiquidity(
          BUSD.address,
          fathomStablecoin.address,
          ethers.utils.parseEther("1500"),
          ethers.utils.parseEther("1000"),
          "0",
          "0",
          await deployerAddress,
          FOREVER
        )

        // Current FUSD price is $1.5
        // Perform flash mint to arbitrage
        await flashMintModule.flashLoan(
          flashMintArbitrager.address,
          fathomStablecoin.address,
          ethers.utils.parseEther("50"),
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address"],
            [routerV2.address, BUSD.address, stableSwapModule.address]
          )
        )

        const profitFromArbitrage = await fathomStablecoin.balanceOf(flashMintArbitrager.address)
        expect(profitFromArbitrage).to.be.gt(0)

        const feeCollectedFromFlashMint = await bookKeeper.stablecoin(flashMintModule.address)
        expect(feeCollectedFromFlashMint).to.be.equal(ethers.utils.parseEther("0.125").mul(WeiPerRay))
      })
    })
  })

  describe("#bookKeeperFlashLoan", async () => {
    context("FUSD price at $1", async () => {
      it("should revert, because there is no arbitrage opportunity, thus no profit to pay for flash mint fee", async () => {
        // Deployer adds 1000 BUSD + 1000 FUSD
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1000"))
        await bookKeeper.mintUnbackedStablecoin(
          deployerAddress,
          deployerAddress,
          ethers.utils.parseEther("1000").mul(WeiPerRay)
        )
        await stablecoinAdapter.withdraw(deployerAddress, ethers.utils.parseEther("1000"), "0x")
        await BUSD.approve(routerV2.address, ethers.utils.parseEther("1000"))
        await fathomStablecoin.approve(routerV2.address, ethers.utils.parseEther("1000"))
        await routerV2.addLiquidity(
          BUSD.address,
          fathomStablecoin.address,
          ethers.utils.parseEther("1000"),
          ethers.utils.parseEther("1000"),
          "0",
          "0",
          await deployerAddress,
          FOREVER
        )

        // Current FUSD price is $1
        // Perform flash mint to arbitrage
        await expect(
          flashMintModule.bookKeeperFlashLoan(
            bookKeeperFlashMintArbitrager.address,
            ethers.utils.parseEther("10"),
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "address"],
              [routerV2.address, BUSD.address, stableSwapModule.address]
            )
          )
        ).to.be.reverted
      })
    })

    context("FUSD price at $1.5", async () => {
      it("should success", async () => {
        // Deployer adds 1500 BUSD + 1000 FUSD
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1500"))
        await bookKeeper.mintUnbackedStablecoin(
          deployerAddress,
          deployerAddress,
          ethers.utils.parseEther("1000").mul(WeiPerRay)
        )
        await stablecoinAdapter.withdraw(deployerAddress, ethers.utils.parseEther("1000"), "0x")
        await BUSD.approve(routerV2.address, ethers.utils.parseEther("1500"))
        await fathomStablecoin.approve(routerV2.address, ethers.utils.parseEther("1000"))
        await routerV2.addLiquidity(
          BUSD.address,
          fathomStablecoin.address,
          ethers.utils.parseEther("1500"),
          ethers.utils.parseEther("1000"),
          "0",
          "0",
          await deployerAddress,
          FOREVER
        )

        // Current FUSD price is $1.5
        // Perform flash mint to arbitrage
        await flashMintModule.bookKeeperFlashLoan(
          bookKeeperFlashMintArbitrager.address,
          ethers.utils.parseEther("50").mul(WeiPerRay),
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address"],
            [routerV2.address, BUSD.address, stableSwapModule.address]
          )
        )

        const profitFromArbitrage = await fathomStablecoin.balanceOf(bookKeeperFlashMintArbitrager.address)
        expect(profitFromArbitrage).to.be.gt(0)

        const feeCollectedFromFlashMint = await bookKeeper.stablecoin(flashMintModule.address)
        expect(feeCollectedFromFlashMint).to.be.equal(ethers.utils.parseEther("0.125").mul(WeiPerRay))
      })
    })
  })
})
