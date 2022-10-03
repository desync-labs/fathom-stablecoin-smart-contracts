require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const { WeiPerRay, WeiPerWad } = require("../../helper/unit")

const { expect } = chai
const { formatBytes32String } = ethers.utils
chai.use(smock.matchers)

describe("StableSwapModule", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockAuthTokenAdapter
  let mockBookKeeper
  let mockStablecoinAdapter
  let mockFathomStablecoin
  let mockSystemDebtEngine
  let mockedAccessControlConfig
  let mockedCollateralPoolConfig

  let stableSwapModule
  let stableSwapModuleAsAlice

  async function loadFixture() {
    const [deployer] = await ethers.getSigners()
  
    const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    const mockSystemDebtEngine = await smock.fake("SystemDebtEngine");
    const mockAuthTokenAdapter = await smock.fake("AuthTokenAdapter");
    const mockStablecoinAdapter = await smock.fake("StablecoinAdapter");
    const mockFathomStablecoin = await smock.fake("FathomStablecoin");
    const mockBookKeeper = await smock.fake("BookKeeper");
  
    mockAuthTokenAdapter.bookKeeper.returns(mockBookKeeper.address)
    mockAuthTokenAdapter.collateralPoolId.returns(formatBytes32String("BUSD"))
    mockAuthTokenAdapter.decimals.returns(BigNumber.from(18))
  
    mockFathomStablecoin.approve.returns(true)
    mockStablecoinAdapter.stablecoin.returns(mockFathomStablecoin.address)
  
    // Deploy StableSwapModule
    const StableSwapModule = (await ethers.getContractFactory("StableSwapModule", deployer))
    const stableSwapModule = (await upgrades.deployProxy(StableSwapModule, [
      mockAuthTokenAdapter.address,
      mockStablecoinAdapter.address,
      mockSystemDebtEngine.address,
    ]))
  
    return {
      stableSwapModule,
      mockAuthTokenAdapter,
      mockBookKeeper,
      mockStablecoinAdapter,
      mockFathomStablecoin,
      mockSystemDebtEngine,
      mockedAccessControlConfig,
      mockedCollateralPoolConfig,
    }
  }

  beforeEach(async () => {
    ;({
      stableSwapModule,
      mockAuthTokenAdapter,
      mockBookKeeper,
      mockStablecoinAdapter,
      mockFathomStablecoin,
      mockSystemDebtEngine,
      mockedAccessControlConfig,
      mockedCollateralPoolConfig,
    } = await loadFixture())
    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    stableSwapModuleAsAlice = stableSwapModule.connect(alice)
  })

  describe("#swapTokenToStablecoin", () => {
    context("when parameters are valid", () => {
      it("should be able to call swapTokenToStablecoin", async () => {
        mockBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await stableSwapModule.setFeeIn(WeiPerWad.div(10))
        await expect(stableSwapModuleAsAlice.swapTokenToStablecoin(aliceAddress, WeiPerWad.mul(10)))
          .to.be.emit(stableSwapModule, "LogSwapTokenToStablecoin")
          .withArgs(aliceAddress, WeiPerWad.mul(10), WeiPerWad)

        expect(mockAuthTokenAdapter.deposit).to.be.calledOnceWith(stableSwapModule.address, WeiPerWad.mul(10), aliceAddress)

        expect(mockBookKeeper.adjustPosition).to.be.calledOnceWith(
          formatBytes32String("BUSD"), 
          stableSwapModule.address, 
          stableSwapModule.address, 
          stableSwapModule.address, 
          WeiPerWad.mul(10), 
          WeiPerWad.mul(10))

        expect(mockBookKeeper.moveStablecoin).to.be.calledOnceWith(stableSwapModule.address, mockSystemDebtEngine.address, WeiPerWad.mul(WeiPerRay))

        expect(mockStablecoinAdapter.withdraw).to.be.calledOnceWith(aliceAddress, WeiPerWad.mul(9), ethers.utils.defaultAbiCoder.encode(["uint256"], [0]))
      })
    })
  })
  describe("#swapStablecoinToToken", () => {
    context("when failed transfer", () => {
      it("should be revert", async () => {
        await expect(stableSwapModuleAsAlice.swapStablecoinToToken(aliceAddress, WeiPerWad.mul(10))).to.be.revertedWith(
          "!safeTransferFrom"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should be able to call swapStablecoinToToken", async () => {
        mockBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await stableSwapModule.setFeeOut(WeiPerWad.div(10))

        mockFathomStablecoin.transferFrom.returns(true)

        await expect(stableSwapModuleAsAlice.swapStablecoinToToken(aliceAddress, WeiPerWad.mul(10)))
          .to.be.emit(stableSwapModule, "LogSwapStablecoinToToken")
          .withArgs(aliceAddress, WeiPerWad.mul(10), WeiPerWad)

        expect(mockStablecoinAdapter.deposit).to.be.calledOnceWith(stableSwapModule.address, WeiPerWad.mul(11), ethers.utils.defaultAbiCoder.encode(["uint256"], [0]))

        expect(mockBookKeeper.adjustPosition).to.be.calledOnceWith(
          formatBytes32String("BUSD"), 
          stableSwapModule.address, 
          stableSwapModule.address, 
          stableSwapModule.address, 
          WeiPerWad.mul(-10), 
          WeiPerWad.mul(-10))

        expect(mockBookKeeper.moveStablecoin).to.be.calledOnceWith(stableSwapModule.address, mockSystemDebtEngine.address, WeiPerWad.mul(WeiPerRay))
        
        expect(mockAuthTokenAdapter.withdraw).to.be.calledOnceWith(aliceAddress, WeiPerWad.mul(10))
      })
    })
  })
})
