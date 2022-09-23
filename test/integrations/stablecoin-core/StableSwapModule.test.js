require("@openzeppelin/test-helpers")

const { ethers, upgrades } = require("hardhat");
const chai = require('chai');
const { BigNumber } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants

const COLLATERAL_POOL_ID = formatBytes32String("BUSD-StableSwap")

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

  const SimplePriceFeed = (await ethers.getContractFactory("SimplePriceFeed", deployer))
  const simplePriceFeed = (await upgrades.deployProxy(SimplePriceFeed, [
    accessControlConfig.address,
  ]))
  await simplePriceFeed.deployed()

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

  await collateralPoolConfig.initCollateralPool(
    COLLATERAL_POOL_ID,
    WeiPerRad.mul(100000000000000),
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
  await stableSwapModule.setFeeIn(ethers.utils.parseEther("0.001"))
  await stableSwapModule.setFeeOut(ethers.utils.parseEther("0.001"))
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

  return {
    stablecoinAdapter,
    bookKeeper,
    BUSD,
    fathomStablecoin,
    flashMintModule,
    stableSwapModule,
    authTokenAdapter,
    systemDebtEngine,
    collateralPoolConfig,
  }
}

describe("StableSwapModule", () => {
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
  let fathomStablecoin
  let systemDebtEngine
  let collateralPoolConfig

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
      systemDebtEngine,
      collateralPoolConfig,
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
  describe("#swapTokenToStablecoin", async () => {
    context("exceed debtCeiling", async () => {
      it("should revert", async () => {
        // Set debtCeiling of StableSwapModule to 0
        await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, 0)

        // Mint 1000 BUSD to deployer
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1000"))

        // Swap 1000 BUSD to FUSD
        await BUSD.approve(authTokenAdapter.address, MaxUint256)
        await expect(
          stableSwapModule.swapTokenToStablecoin(deployerAddress, ethers.utils.parseEther("1000"))
        ).to.be.revertedWith("BookKeeper/ceiling-exceeded")
      })
    })

    context("swap BUSD when BUSD is insufficient", async () => {
      it("should revert", async () => {
        // Mint 1000 BUSD to deployer
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1000"))

        // Swap 1000 BUSD to FUSD
        await BUSD.approve(authTokenAdapter.address, MaxUint256)
        await expect(
          stableSwapModule.swapTokenToStablecoin(deployerAddress, ethers.utils.parseEther("1001"))
        ).to.be.revertedWith("!safeTransferFrom")
      })
    })
    context("swap BUSD to FUSD", async () => {
      it("should success", async () => {
        // Mint 1000 BUSD to deployer
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1000"))

        // Swap 1000 BUSD to FUSD
        await BUSD.approve(authTokenAdapter.address, MaxUint256)
        await stableSwapModule.swapTokenToStablecoin(deployerAddress, ethers.utils.parseEther("1000"))

        // 1000 * 0.001 = 1
        const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
        expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("1").mul(WeiPerRay))

        // stablecoinReceived = swapAmount - fee = 1000 - 1 = 999
        const stablecoinReceived = await fathomStablecoin.balanceOf(deployerAddress)
        expect(stablecoinReceived).to.be.equal(ethers.utils.parseEther("999"))

        const busdCollateralAmount = (await bookKeeper.positions(COLLATERAL_POOL_ID, stableSwapModule.address))
          .lockedCollateral
        expect(busdCollateralAmount).to.be.equal(ethers.utils.parseEther("1000"))
      })
    })
  })

  describe("#swapStablecoinToToken", async () => {
    context("collateral not enough", async () => {
      it("should revert", async () => {
        // Mint 1000 FUSD to deployer
        await bookKeeper.mintUnbackedStablecoin(
          deployerAddress,
          deployerAddress,
          ethers.utils.parseEther("1001").mul(WeiPerRay)
        )
        await stablecoinAdapter.withdraw(deployerAddress, ethers.utils.parseEther("1001"), "0x")

        // Swap 1000 FUSD to BUSD
        await fathomStablecoin.approve(stableSwapModule.address, MaxUint256)
        await expect(stableSwapModule.swapStablecoinToToken(deployerAddress, ethers.utils.parseEther("1000"))).to.be
          .reverted
      })
    })

    context("swap FUSD to BUSD", async () => {
      it("should success", async () => {
        // Mint 1000 BUSD to deployer
        await BUSD.mint(deployerAddress, ethers.utils.parseEther("1000"))

        // Swap 1000 BUSD to FUSD
        await BUSD.approve(authTokenAdapter.address, MaxUint256)
        await stableSwapModule.swapTokenToStablecoin(deployerAddress, ethers.utils.parseEther("1000"))

        // Swap 998 FUSD to BUSD
        await fathomStablecoin.approve(stableSwapModule.address, MaxUint256)
        await stableSwapModule.swapStablecoinToToken(deployerAddress, ethers.utils.parseEther("998"))

        // first swap = 1000 * 0.001 = 1 FUSD
        // second swap = 998 * 0.001 = 0.998 FUSD
        // total fee = 1 + 0.998 = 1.998
        const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
        expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("1.998").mul(WeiPerRay))

        const busdReceived = await BUSD.balanceOf(deployerAddress)
        expect(busdReceived).to.be.equal(ethers.utils.parseEther("998"))

        const busdCollateralAmount = (await bookKeeper.positions(COLLATERAL_POOL_ID, stableSwapModule.address))
          .lockedCollateral
        expect(busdCollateralAmount).to.be.equal(ethers.utils.parseEther("2"))
      })
    })
  })
})
