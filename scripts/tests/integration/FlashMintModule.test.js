const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { parseEther } = require("ethers/lib/utils");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai

const { WeiPerRad, WeiPerRay } = require("../helper/unit");
const { AddressZero } = require("../helper/address");
const { formatBytes32String } = require("ethers/lib/utils");
const { loadFixture } = require("../helper/fixtures");
const { initializeContracts } = require("../helper/initializer");
const { addRoles } = require("../helper/access-roles");

const COLLATERAL_POOL_ID = formatBytes32String("USDT")

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const loadFixtureHandler = async () => {
  const USDT = await artifacts.initializeInterfaceAt("USDT", "USDT");
  const bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
  const collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
  const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");
  const flashMintModule = await artifacts.initializeInterfaceAt("FlashMintModule", "FlashMintModule");
  const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
  const stableSwapModule = await artifacts.initializeInterfaceAt("StableSwapModule", "StableSwapModule");
  const authTokenAdapter = await artifacts.initializeInterfaceAt("AuthTokenAdapter", "AuthTokenAdapter");
  const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");
  const router = await artifacts.initializeInterfaceAt("MockedDexRouter", "MockedDexRouter");
  const flashMintArbitrager = await artifacts.initializeInterfaceAt("FlashMintArbitrager", "FlashMintArbitrager");
  const bookKeeperFlashMintArbitrager = await artifacts.initializeInterfaceAt("BookKeeperFlashMintArbitrager", "BookKeeperFlashMintArbitrager");

  await initializeContracts();
  await addRoles();

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
    AddressZero,
    { gasLimit: 1000000 }
  )
  await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100000000000000), { gasLimit: 1000000 })
  await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRad.mul(100000000000000), { gasLimit: 1000000 })
  await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay, { gasLimit: 1000000 })

  await bookKeeper.whitelist(stablecoinAdapter.address, { gasLimit: 1000000 })

  await flashMintModule.setMax(parseEther("100000000"), { gasLimit: 1000000 })
  await flashMintModule.setFeeRate(parseEther("25").div(10000), { gasLimit: 1000000 })

  return {
    bookKeeper,
    USDT,
    fathomStablecoin,
    flashMintModule,
    flashMintArbitrager,
    router,
    stableSwapModule,
    bookKeeperFlashMintArbitrager
  }
}

describe("FlastMintModule", () => {
  // Contracts
  let bookKeeper
  let USDT
  let flashMintModule
  let flashMintArbitrager
  let fathomStablecoin
  let router
  let stableSwapModule
  let bookKeeperFlashMintArbitrager

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ; ({
      bookKeeper,
      USDT,
      fathomStablecoin,
      flashMintModule,
      flashMintArbitrager,
      router,
      stableSwapModule,
      bookKeeperFlashMintArbitrager
    } = await loadFixture(loadFixtureHandler))
  })
  describe("#flashLoan", async () => {
    context("receiver doesn't have enough tokens to return the loan + fee", async () => {
      it("should revert", async () => {
        // mocked router will return all tokens it has
        await USDT.mint(router.address, parseEther("100"), { gasLimit: 1000000 })

        await expect(
          flashMintModule.flashLoan(
            flashMintArbitrager.address,
            fathomStablecoin.address,
            parseEther("100"),
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "address"],
              [router.address, USDT.address, stableSwapModule.address]
            ),
            { gasLimit: 1000000 }
          )
        ).to.be.revertedWith("!safeTransferFrom")
      })
    })

    context("receiver has enough tokens to return the loan + fee", async () => {
      it("should success", async () => {
        // mocked router will return all tokens it has
        await USDT.mint(router.address, parseEther("110"), { gasLimit: 1000000 })

        await flashMintModule.flashLoan(
          flashMintArbitrager.address,
          fathomStablecoin.address,
          parseEther("100"),
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address"],
            [router.address, USDT.address, stableSwapModule.address]
          ),
          { gasLimit: 1000000 }
        )

        const profitFromArbitrage = await fathomStablecoin.balanceOf(flashMintArbitrager.address)
        expect(profitFromArbitrage).to.be.equal(parseEther("9.75"))

        const feeCollectedFromFlashMint = await bookKeeper.stablecoin(flashMintModule.address)
        expect(feeCollectedFromFlashMint).to.be.equal(parseEther("0.25").mul(WeiPerRay))
      })
    })
  })

  describe("#bookKeeperFlashLoan", async () => {
    context("receiver doesn't have enough tokens to return the loan + fee", async () => {
      it("should revert", async () => {
        // mocked router will return all tokens it has
        await USDT.mint(router.address, parseEther("100"), { gasLimit: 1000000 })

        await expect(
          flashMintModule.bookKeeperFlashLoan(
            bookKeeperFlashMintArbitrager.address,
            parseEther("100"),
            ethers.utils.defaultAbiCoder.encode(
              ["address", "address", "address"],
              [router.address, USDT.address, stableSwapModule.address]
            )
          )
        ).to.be.reverted
      })
    })

    context("receiver has enough tokens to return the loan + fee", async () => {
      it("should success", async () => {
        // mocked router will return all tokens it has
        await USDT.mint(router.address, parseEther("110"), { gasLimit: 1000000 })

        // Perform flash mint
        await flashMintModule.bookKeeperFlashLoan(
          bookKeeperFlashMintArbitrager.address,
          parseEther("100").mul(WeiPerRay),
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address"],
            [router.address, USDT.address, stableSwapModule.address]
          )
        )

        const profitFromArbitrage = await fathomStablecoin.balanceOf(bookKeeperFlashMintArbitrager.address)
        expect(profitFromArbitrage).to.be.equal(parseEther("9.75"))

        const feeCollectedFromFlashMint = await bookKeeper.stablecoin(flashMintModule.address)
        expect(feeCollectedFromFlashMint).to.be.equal(parseEther("0.25").mul(WeiPerRay))
      })
    })
  })
})
