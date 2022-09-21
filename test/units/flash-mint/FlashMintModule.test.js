require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");

chai.use(smock.matchers)
const { expect } = chai
const { keccak256, toUtf8Bytes, formatBytes32String } = ethers.utils

const loadFixture = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
  const mockBookKeeper = await smock.fake("BookKeeper");
  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  const mockFathomStablecoin = await smock.fake("FathomStablecoin");
  const mockERC20 = await smock.fake("ERC20");
  const mockStablecoinAdapter = await smock.fake("StablecoinAdapter");
  const mockSystemDebtEngine = await smock.fake("SystemDebtEngine");
  const mockMyFashLoan = await smock.fake("MockMyFlashLoan");

  mockBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
  mockBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
  mockStablecoinAdapter.bookKeeper.returns(mockBookKeeper.address)
  mockStablecoinAdapter.stablecoin.returns(mockFathomStablecoin.address)
  mockFathomStablecoin.approve.returns(true)
  mockedAccessControlConfig.hasRole.returns(true)

  // Deploy mocked FlashMintModule
  const FlashMintModule = (await ethers.getContractFactory("FlashMintModule", deployer))
  const flashMintModule = (await upgrades.deployProxy(FlashMintModule, [
    mockStablecoinAdapter.address,
    mockSystemDebtEngine.address,
  ]))

  return {
    flashMintModule,
    mockFathomStablecoin,
    mockMyFashLoan,
    mockERC20,
    mockBookKeeper,
    mockStablecoinAdapter,
    mockedAccessControlConfig,
  }
}

describe("FlashMintModule", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockFathomStablecoin
  let mockERC20
  let mockMyFashLoan
  let mockBookKeeper
  let mockStablecoinAdapter
  let mockedAccessControlConfig

  let flashMintModule
  let flashMintModuleAsAlice

  beforeEach(async () => {
    ;({
      flashMintModule,
      mockFathomStablecoin,
      mockMyFashLoan,
      mockERC20,
      mockBookKeeper,
      mockStablecoinAdapter,
      mockedAccessControlConfig,
    } = await loadFixture())
    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    flashMintModuleAsAlice = flashMintModule.connect(alice)
  })
  describe("#setMax", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(flashMintModuleAsAlice.setMax(WeiPerWad.mul(100))).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", () => {
      it("should be able setMax", async () => {
        const maxBefore = await flashMintModule.max()
        expect(maxBefore).to.be.equal(0)

        await expect(flashMintModule.setMax(WeiPerWad.mul(100)))
          .to.be.emit(flashMintModule, "LogSetMax")
          .withArgs(WeiPerWad.mul(100))

        const maxAfter = await flashMintModule.max()
        expect(maxAfter).to.be.equal(WeiPerWad.mul(100))
      })
    })
  })
  describe("#setFeeRate", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(flashMintModuleAsAlice.setFeeRate(WeiPerWad.div(10))).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", () => {
      it("should be able setFeeRate", async () => {
        const maxBefore = await flashMintModule.feeRate()
        expect(maxBefore).to.be.equal(0)

        await expect(flashMintModule.setFeeRate(WeiPerWad.div(10)))
          .to.be.emit(flashMintModule, "LogSetFeeRate")
          .withArgs(WeiPerWad.div(10))

        const maxAfter = await flashMintModule.feeRate()
        expect(maxAfter).to.be.equal(WeiPerWad.div(10))
      })
    })
  })
  describe("#flashFee", () => {
    context("when token invalid", () => {
      it("should be revert", async () => {
        expect(flashMintModule.flashFee(mockERC20.address, WeiPerWad.mul(10))).to.be.revertedWith(
          "FlashMintModule/token-unsupported"
        )
      })
    })
    context("when token valid", () => {
      it("should be able to call flashFee", async () => {
        flashMintModule.setFeeRate(WeiPerWad.div(10))
        const fee = await flashMintModule.flashFee(mockFathomStablecoin.address, WeiPerWad.mul(10))
        expect(fee).to.be.equal(WeiPerWad)
      })
    })
  })
  describe("#flashLoan", () => {
    context("when invalid token", () => {
      it("should be revert", async () => {
        await expect(
          flashMintModule.flashLoan(
            mockMyFashLoan.address,
            mockERC20.address,
            WeiPerWad.mul(10),
            formatBytes32String("")
          )
        ).to.be.revertedWith("FlashMintModule/token-unsupported")
      })
    })
    context("when ceiling exceeded", () => {
      it("should be revert", async () => {
        await expect(
          flashMintModule.flashLoan(
            mockMyFashLoan.address,
            mockFathomStablecoin.address,
            WeiPerWad.mul(10),
            formatBytes32String("")
          )
        ).to.be.revertedWith("FlashMintModule/ceiling-exceeded")
      })
    })
    context("when callback failed", () => {
      it("should be revert", async () => {
        await flashMintModule.setMax(WeiPerWad.mul(100))
        await flashMintModule.setFeeRate(WeiPerWad.div(10))
        await expect(
          flashMintModule.flashLoan(
            mockMyFashLoan.address,
            mockFathomStablecoin.address,
            WeiPerWad.mul(10),
            formatBytes32String("")
          )
        ).to.be.revertedWith("FlashMintModule/callback-failed")
      })
    })
    context("when parameters are valid", () => {
      it("should be able to call flashLoan", async () => {
        mockFathomStablecoin.transferFrom.returns(true)

        await flashMintModule.setMax(WeiPerWad.mul(100))
        await flashMintModule.setFeeRate(WeiPerWad.div(10))
        mockMyFashLoan.onFlashLoan.returns(keccak256(toUtf8Bytes("ERC3156FlashBorrower.onFlashLoan")))
        await expect(
          flashMintModule.flashLoan(
            mockMyFashLoan.address,
            mockFathomStablecoin.address,
            WeiPerWad.mul(10),
            formatBytes32String("")
          )
        ).to.be.emit(flashMintModule, "LogFlashLoan")

        expect(mockBookKeeper.mintUnbackedStablecoin).to.be.calledOnceWith(flashMintModule.address, flashMintModule.address, WeiPerRad.mul(10))
        expect(mockStablecoinAdapter.withdraw).to.be.calledOnceWith(mockMyFashLoan.address, WeiPerWad.mul(10), ethers.utils.defaultAbiCoder.encode(["uint256"], [0]))
        expect(mockFathomStablecoin.transferFrom).to.be.calledOnceWith(mockMyFashLoan.address, flashMintModule.address, WeiPerWad.mul(11))
        expect(mockStablecoinAdapter.deposit).to.be.calledOnceWith(flashMintModule.address, WeiPerWad.mul(11), ethers.utils.defaultAbiCoder.encode(["uint256"], [0]))
        expect(mockBookKeeper.settleSystemBadDebt).to.be.calledOnceWith(WeiPerRad.mul(10))
      })
    })
  })

  describe("#bookKeeperFlashLoan", () => {
    context("when ceiling exceeded", () => {
      it("should be revert", async () => {
        await expect(
          flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
        ).to.be.revertedWith("FlashMintModule/ceiling-exceeded")
      })
    })
    context("when callback failed", () => {
      it("should be revert", async () => {
        await flashMintModule.setMax(WeiPerWad.mul(100))
        await flashMintModule.setFeeRate(WeiPerWad.div(10))
        await expect(
          flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
        ).to.be.revertedWith("FlashMintModule/callback-failed")
      })
    })
    context("when insufficient fee", () => {
      it("should be revert", async () => {
        await flashMintModule.setMax(WeiPerWad.mul(100))
        await flashMintModule.setFeeRate(WeiPerWad.div(10))
        mockMyFashLoan.onBookKeeperFlashLoan.returns(
          keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan"))
        )
        await expect(
          flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
        ).to.be.revertedWith("FlashMintModule/insufficient-fee")
      })
    })
    context("when parameters are valid", () => {
      it("should be able to call flashLoan", async () => {
        await flashMintModule.setMax(WeiPerWad.mul(100))
        mockMyFashLoan.onBookKeeperFlashLoan.returns(
          keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan"))
        )
        await expect(
          flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
        ).to.be.emit(flashMintModule, "LogBookKeeperFlashLoan")

        expect(mockBookKeeper.mintUnbackedStablecoin).to.be.calledOnceWith(flashMintModule.address, mockMyFashLoan.address, WeiPerRad.mul(10))
        expect(mockBookKeeper.settleSystemBadDebt).to.be.calledOnceWith( WeiPerRad.mul(10))
      })
    })
  })
})
