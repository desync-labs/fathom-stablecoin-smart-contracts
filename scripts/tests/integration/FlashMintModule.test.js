const chai = require('chai');
const { ethers } = require("ethers");
const { parseEther } = require("ethers/lib/utils");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai

const { WeiPerRay } = require("../helper/unit");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");

const loadFixtureHandler = async () => {
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

  const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
  const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
  const authTokenAdapter = await getProxy(proxyFactory, "AuthTokenAdapter");

  const usdtAddr = await authTokenAdapter.token();
  const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const router = await artifacts.initializeInterfaceAt("MockedDexRouter", "MockedDexRouter");
  const flashMintArbitrager = await getProxy(proxyFactory, "FlashMintArbitrager");
  const bookKeeperFlashMintArbitrager = await getProxy(proxyFactory, "BookKeeperFlashMintArbitrager");

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
        expect(profitFromArbitrage).to.be.equal(parseEther("9.49"))

        const feeCollectedFromFlashMint = await bookKeeper.stablecoin(flashMintModule.address)
        expect(feeCollectedFromFlashMint).to.be.equal(parseEther("0.4").mul(WeiPerRay))
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
        expect(profitFromArbitrage).to.be.equal(parseEther("9.49"))

        const feeCollectedFromFlashMint = await bookKeeper.stablecoin(flashMintModule.address)
        expect(feeCollectedFromFlashMint).to.be.equal(parseEther("0.4").mul(WeiPerRay))
      })
    })
  })
})
