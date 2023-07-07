const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { formatBytes32String } = ethers.utils

const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRay, WeiPerWad, WeiPerRad } = require("../../helper/unit")
const { loadFixture } = require("../../helper/fixtures");
const dailyLimitNumerator = 2000//on denomination of 10000th, 2000/10000 = 20%
const singleSwapLimitNumerator = 100 ///on denomination of 10000th, 100/10000 = 1%
const numberOfSwapsLimitPerUser = 1;
const blocksPerLimit = 2;

const loadFixtureHandler = async () => {
  mockedAccessControlConfig = await createMock("AccessControlConfig");
  mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
  mockSystemDebtEngine = await createMock("SystemDebtEngine");
  mockStablecoinAdapter = await createMock("StablecoinAdapter");
  mockFathomStablecoin = await createMock("FathomStablecoin");
  mockBookKeeper = await createMock("BookKeeper");
  mockUSD = await createMock("ERC20Mintable");

  await mockBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
  await mockBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
  await mockStablecoinAdapter.mock.stablecoin.returns(mockFathomStablecoin.address)
  await mockUSD.mock.decimals.returns(BigNumber.from(18))
  await mockFathomStablecoin.mock.decimals.returns(BigNumber.from(18))
  await mockedAccessControlConfig.mock.hasRole.returns(true)

  await mockFathomStablecoin.mock.approve.returns(true)
  await mockBookKeeper.mock.whitelist.returns()
  await mockFathomStablecoin.mock.transferFrom.returns(true)
  await mockFathomStablecoin.mock.transfer.returns(true)
  await mockUSD.mock.transferFrom.returns(true)
  await mockUSD.mock.transfer.returns(true)
  await mockUSD.mock.balanceOf.returns(WeiPerWad.mul(50000))
  await mockFathomStablecoin.mock.balanceOf.returns(WeiPerWad.mul(50000))

  await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
  await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))

  stableSwapModule = getContract("StableSwapModule", DeployerAddress)
  stableSwapModuleAsAlice = getContract("StableSwapModule", AliceAddress)
  stableSwapModuleWrapper = getContract("StableSwapModuleWrapper", DeployerAddress)
  stableSwapModuleWrapperAsAlice = getContract("StableSwapModuleWrapper", AliceAddress)
  
  
  await stableSwapModule.initialize(
    mockBookKeeper.address,
    mockUSD.address,
    mockFathomStablecoin.address,
    dailyLimitNumerator,
    singleSwapLimitNumerator,
    numberOfSwapsLimitPerUser,
    blocksPerLimit
  )

  await stableSwapModuleWrapper.initialize(
    mockBookKeeper.address,
    stableSwapModule.address
  )

  await stableSwapModule.addToWhitelist(DeployerAddress)
  await stableSwapModuleWrapper.addToWhitelist(DeployerAddress)
  await stableSwapModule.setStableSwapWrapper(stableSwapModuleWrapper.address)

  return {
    stableSwapModule,
    mockUSD,
    mockedAccessControlConfig,
    mockFathomStablecoin,
    stableSwapModuleWrapper
  }
}
describe("StableSwapModuleWrapper", () => {
  // Contracts
  let mockedAccessControlConfig
  let mockUSD
  let stableSwapModule
  let mockFathomStablecoin
  let stableSwapModuleWrapper

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ; ({
      stableSwapModule,
      mockUSD,
      mockedAccessControlConfig,
      mockFathomStablecoin,
      stableSwapModuleWrapper
    } = await loadFixture(loadFixtureHandler))
  })


  describe("#setDecentralizedStatesStatus", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModuleWrapper.setIsDecentralizedState(true)).to.be.revertedWith("!ownerRole")
      })
    })
    context("valid deployer", () => {
      it("should set status and emit an event", async () => {
        await expect(stableSwapModuleWrapper.setIsDecentralizedState(true)).to.be.emit(stableSwapModuleWrapper, "LogUpdateIsDecentralizedState")
        expect(await stableSwapModuleWrapper.isDecentralizedState()).to.be.equal(true)
      })
    })
  })

  describe("#addToWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModuleWrapper.addToWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole")
      })
    })
    context("valid deployer", () => {
      it("should add to whitelist and emit an event", async () => {
        await expect(stableSwapModuleWrapper.addToWhitelist(DeployerAddress)).to.be.emit(stableSwapModuleWrapper, "LogAddToWhitelist")

      })
    })
  })

  describe("#removeFromWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole")
      })
    })
    context("valid deployer", () => {
      it("should remove from whitelist and emit an event", async () => {
        await expect(stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress)).to.be.emit(stableSwapModuleWrapper, "LogRemoveFromWhitelist")
      })
    })
  })


  describe("#depositTokens", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress)
        await expect(stableSwapModuleWrapper.depositTokens(WeiPerWad)).to.be.revertedWith("user-not-whitelisted")
      })
    })
    context("paused contract", () => {
      it("should revert", async () => {
        await stableSwapModuleWrapper.pause();

        await expect(
          stableSwapModuleWrapper.depositTokens(WeiPerWad)
        ).to.be.revertedWith("Pausable: paused")
      })
    })
    context("zero amount", () => {
      it("should revert", async () => {
        await mockUSD.mock.balanceOf.returns(WeiPerWad)
        await expect(
          stableSwapModuleWrapper.depositTokens(BigNumber.from("0"))
        ).to.be.revertedWith("wrapper-depositTokens/amount-zero")
      })
    })
    context("not enough balance - usd", () => {
      it("should revert", async () => {
        await mockUSD.mock.balanceOf.returns(WeiPerWad.div(2))
        await expect(
          stableSwapModuleWrapper.depositTokens(WeiPerWad)
        ).to.be.revertedWith("depositTokens/token-not-enough")
      })
    })

    context("not enough balance - stablecoin", () => {
      it("should revert", async () => {
        await mockFathomStablecoin.mock.balanceOf.returns(WeiPerWad.div(2))
        await expect(
          stableSwapModuleWrapper.depositTokens(WeiPerWad)
        ).to.be.revertedWith("depositTokens/FXD-not-enough")
      })
    })
  })

  describe("#withdrawTokens", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress)
        await expect(stableSwapModuleWrapper.withdrawTokens(WeiPerWad)).to.be.revertedWith("user-not-whitelisted")
      })
    })

    context("zero amount", async() => {
      it("Should revert", async() => {
        await expect(stableSwapModuleWrapper.withdrawTokens(BigNumber.from("0"))).to.be.revertedWith("withdrawTokens/amount-zero")
      })
    })

    context("not enough deposit", async() => {
      it("Should revert", async() => {
        await expect(stableSwapModuleWrapper.withdrawTokens(WeiPerWad.mul(10000))).to.be.revertedWith("withdrawTokens/amount-exceeds-users-deposit")
      })
    })
  })

  describe("#pause", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModuleWrapper.pause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      it("should be success", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(true)
        await expect(
          stableSwapModuleWrapper.pause()
        ).to.be.emit(stableSwapModuleWrapper, "LogStableSwapWrapperPauseState")
          .withArgs(true)
        expect(await stableSwapModuleWrapper.paused()).to.be.equal(true)
      })
    })
  })
  describe("#unpause", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModuleWrapper.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      it("should be success", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(true)
        await stableSwapModuleWrapper.pause();
        await expect(
          stableSwapModuleWrapper.unpause()
        ).to.be.emit(stableSwapModuleWrapper, "LogStableSwapWrapperPauseState")
          .withArgs(false)
        expect(await stableSwapModuleWrapper.paused()).to.be.equal(false)
      })
    })
  })

  describe("#getters", () => {
    context("zero deposit - getActualLiquidityAvailablePerUser", () => {
      it("should revert for zero deposit - get amounts", () => {
        expect(stableSwapModuleWrapper.getAmounts(0)).to.be.revertedWith("getAmounts/amount-zero")
      })
    })
    context("zero deposit - getActualLiquidityAvailablePerUser", () => {
      it("should revert for no deposit for the user - get amounts", () => {
        expect(stableSwapModuleWrapper.getAmounts(WeiPerRad)).to.be.revertedWith("getAmounts/amount-exceeds-users-deposit")
      })
    })
  })

  describe("fees", () => {
    context("withdraw claimed fees", () => {
      it("should revert - no claimed fees", async () => {
        await expect(stableSwapModuleWrapper.withdrawClaimedFees()).to.be.revertedWith("withdrawClaimedFees/no-claimed-fees")
      })
    })

    context("emergency withdraw", () => {
      it("should revert - zero amount", async () => {
        await stableSwapModuleWrapper.pause();
        await stableSwapModule.pause();
        await expect(stableSwapModuleWrapper.emergencyWithdraw()).to.be.revertedWith("emergencyWithdraw/amount-zero")
      })
    })
  })
})
