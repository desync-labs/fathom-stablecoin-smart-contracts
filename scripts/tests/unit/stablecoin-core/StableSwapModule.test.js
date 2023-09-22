const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { formatBytes32String } = ethers.utils

const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRay, WeiPerWad } = require("../../helper/unit")
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
describe("StableSwapModule", () => {
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

  describe("#setDailySwapLimitNumerator", () => {
    context("not owner", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(
          stableSwapModule.setDailySwapLimitNumerator(dailyLimitNumerator)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setDailySwapLimitNumerator(1)
        ).to.be.revertedWith("StableSwapModule/less-than-minimum-daily-swap-limit")
      })
    })
    context("greater than denominator", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setDailySwapLimitNumerator(1000000)
        ).to.be.revertedWith("StableSwapModule/numerator-over-denominator")
      })
    })
    context("valid daily swap limit", () => {
      it("should set the daily swap limit and emit an event", async () => {
        const oldLimit = await stableSwapModule.dailySwapLimitNumerator();
        const newLimit = dailyLimitNumerator

        await expect(
          stableSwapModule.setDailySwapLimitNumerator(newLimit)
        ).to.be.emit(stableSwapModule, "LogDailySwapLimitUpdate")
          .withArgs(newLimit, oldLimit)
        expect(await stableSwapModule.dailySwapLimitNumerator()).to.be.equal(newLimit)
      })
    })
  })

  describe("#setSingleSwapLimitNumerator", () => {
    context("not owner", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(
          stableSwapModule.setSingleSwapLimitNumerator(dailyLimitNumerator)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setSingleSwapLimitNumerator(1)
        ).to.be.revertedWith("StableSwapModule/less-than-minimum-single-swap-limit")
      })
    })
    context("greater than denominator", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setSingleSwapLimitNumerator(1000000)
        ).to.be.revertedWith("StableSwapModule/numerator-over-denominator")
      })
    })
    context("valid single swap limit", () => {
      it("should set the singleswap limit and emit an event", async () => {
        const oldLimit = await stableSwapModule.singleSwapLimitNumerator();
        const newLimit = singleSwapLimitNumerator

        await expect(
          stableSwapModule.setSingleSwapLimitNumerator(newLimit)
        ).to.be.emit(stableSwapModule, "LogSingleSwapLimitUpdate")
          .withArgs(newLimit, oldLimit)
        expect(await stableSwapModule.singleSwapLimitNumerator()).to.be.equal(newLimit)
      })
    })
  })

  describe("#setNumberOfSwapsLimitPerUser", () => {
    context("not owner", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(
          stableSwapModule.setNumberOfSwapsLimitPerUser(numberOfSwapsLimitPerUser)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setSingleSwapLimitNumerator(0)
        ).to.be.revertedWith("StableSwapModule/less-than-minimum-single-swap-limit")
      })
    })

    context("valid number of Swaps limit per user", () => {
      it("should set the number of swaps limit per user and emit an event", async () => {
        const oldLimit = await stableSwapModule.numberOfSwapsLimitPerUser();
        const newLimit = 5

        await expect(
          stableSwapModule.setNumberOfSwapsLimitPerUser(newLimit)
        ).to.be.emit(stableSwapModule, "LogNumberOfSwapsLimitPerUserUpdate")
          .withArgs(newLimit, oldLimit)
        expect(await stableSwapModule.numberOfSwapsLimitPerUser()).to.be.equal(newLimit)
      })
    })
  })

  describe("#setBlocksPerLimit", () => {
    context("not owner", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(
          stableSwapModule.setBlocksPerLimit(numberOfSwapsLimitPerUser)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setBlocksPerLimit(0)
        ).to.be.revertedWith("StableSwapModule/less-than-minimum-blocks-per-limit")
      })
    })

    context("valid number of blocks per limit", () => {
      it("should set the valid number of blocks per limit and emit an event", async () => {
        const oldLimit = await stableSwapModule.blocksPerLimit();
        const newLimit = 5

        await expect(
          stableSwapModule.setBlocksPerLimit(newLimit)
        ).to.be.emit(stableSwapModule, "LogBlocksPerLimitUpdate")
          .withArgs(newLimit, oldLimit)
        expect(await stableSwapModule.blocksPerLimit()).to.be.equal(newLimit)
      })
    })
  })



  describe("#setFeeIn", () => {
    context("not owner", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(
          stableSwapModule.setFeeIn(WeiPerWad.div(10))
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("fee is too big", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setFeeIn(WeiPerWad)
        ).to.be.revertedWith("StableSwapModule/invalid-fee-in")
      })
    })
    context("valid fee", () => {
      it("should set the fee and emit an event", async () => {
        const newFee = WeiPerWad.div(10);

        await expect(
          stableSwapModule.setFeeIn(newFee)
        ).to.be.emit(stableSwapModule, "LogSetFeeIn")
          .withArgs(DeployerAddress, newFee)
        expect(await stableSwapModule.feeIn()).to.be.equal(newFee)
      })
    })
  })

  describe("#setFeeOut", () => {
    context("not owner", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(
          stableSwapModule.setFeeOut(WeiPerWad.div(10))
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("fee is too big", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.setFeeOut(WeiPerWad)
        ).to.be.revertedWith("StableSwapModule/invalid-fee-out")
      })
    })
    context("valid fee", () => {
      it("should set the fee and emit an event", async () => {
        const newFee = WeiPerWad.div(10);

        await expect(
          stableSwapModule.setFeeOut(newFee)
        ).to.be.emit(stableSwapModule, "LogSetFeeOut")
          .withArgs(DeployerAddress, newFee)
        expect(await stableSwapModule.feeOut()).to.be.equal(newFee)
      })
    })
  })

  describe("#setDecentralizedStatesStatus", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModule.setDecentralizedStatesStatus(true)).to.be.revertedWith("!ownerRole")
      })
    })
    context("valid deployer", () => {
      it("should set status and emit an event", async () => {
        await expect(stableSwapModule.setDecentralizedStatesStatus(true)).to.be.emit(stableSwapModule, "LogDecentralizedStateStatus")
          .withArgs(false, true);
        expect(await stableSwapModule.isDecentralizedState()).to.be.equal(true)
      })
    })
  })

  describe("#addToWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModule.addToWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole")
      })
    })
    context("valid deployer", () => {
      it("should add to whitelist and emit an event", async () => {
        await expect(stableSwapModule.addToWhitelist(DeployerAddress)).to.be.emit(stableSwapModule, "LogAddToWhitelist")

      })
    })
  })

  describe("#removeFromWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModule.removeFromWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole")
      })
    })
    context("valid deployer", () => {
      it("should remove from whitelist and emit an event", async () => {
        await expect(stableSwapModule.removeFromWhitelist(DeployerAddress)).to.be.emit(stableSwapModule, "LogRemoveFromWhitelist")
      })
    })
  })


  describe("#depositToken", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModule.depositToken(mockUSD.address, WeiPerWad)).to.be.revertedWith("only-stableswap-wrapper")
      })
    })
    context("paused contract", () => {
      it("should revert", async () => {
        await stableSwapModule.pause();

        await expect(
          stableSwapModule.depositToken(mockUSD.address, WeiPerWad)
        ).to.be.revertedWith("Pausable: paused")
      })
    })
    context("zero amount", () => {
      it("should revert", async () => {
        await mockUSD.mock.balanceOf.returns(WeiPerWad)
        await expect(
          stableSwapModule.depositToken(mockUSD.address, BigNumber.from("0"))
        ).to.be.revertedWith("only-stableswap-wrapper")
      })
    })
    context("not enough balance", () => {
      it("should revert", async () => {
        await mockUSD.mock.balanceOf.returns(WeiPerWad.div(2))
        await expect(
          stableSwapModule.depositToken(mockUSD.address, WeiPerWad)
        ).to.be.revertedWith("only-stableswap-wrapper")
      })
    })
  })

  describe("#swapTokenToStablecoin", () => {
    context("paused contract", () => {
      it("should revert", async () => {
        await stableSwapModule.pause();

        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, WeiPerWad)
        ).to.be.revertedWith("Pausable: paused")
      })
    })
    context("zero amount", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, BigNumber.from("0"))
        ).to.be.revertedWith("StableSwapModule/amount-zero")
      })
    })
    context("not enough stablecoin", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, WeiPerWad)
        ).to.be.revertedWith("swapTokenToStablecoin/not-enough-stablecoin-balance")
      })
    })


    describe("#swapStablecoinToToken", () => {
      context("paused contract", () => {
        it("should revert", async () => {
          await stableSwapModule.pause();

          await expect(
            stableSwapModule.swapStablecoinToToken(DeployerAddress, WeiPerWad)
          ).to.be.revertedWith("Pausable: paused")
        })
      })
      context("zero amount", () => {
        it("should revert", async () => {
          await expect(
            stableSwapModule.swapStablecoinToToken(DeployerAddress, BigNumber.from("0"))
          ).to.be.revertedWith("StableSwapModule/amount-zero")
        })
      })
      context("not enough stablecoin", () => {
        it("should revert", async () => {
          await expect(
            stableSwapModule.swapStablecoinToToken(DeployerAddress, WeiPerWad)
          ).to.be.revertedWith("swapStablecoinToToken/not-enough-token-balance")
        })
      })
    })

    describe("#withdrawFees", () => {
      context("only-stableswap-wrapper-can-call", () => {
        it("should revert", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(false)
          await expect(stableSwapModule.withdrawFees(DeployerAddress, WeiPerWad, WeiPerWad)).to.be.revertedWith("only-stableswap-wrapper")
        })
      })
    })

    describe("#emergencyWithdraw", () => {
      context("not authorized", () => {
        it("should revert", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(false)
          await expect(stableSwapModule.emergencyWithdraw(DeployerAddress)).to.be.revertedWith("!(ownerRole or govRole)")
        })
      })
      context("not paused", () => {
        it("should revert", async () => {
          await expect(
            stableSwapModule.emergencyWithdraw(DeployerAddress)
          ).to.be.revertedWith("Pausable: not paused")
        })
      })
      context("zero address", () => {
        it("should revert", async () => {
          await stableSwapModule.pause()
          await expect(
            stableSwapModule.emergencyWithdraw(AddressZero)
          ).to.be.revertedWith("withdrawFees/empty-account")
        })
      })
      context("emergency withdraw", () => {
        it("should emit event", async () => {
          await stableSwapModule.pause()

          await mockUSD.mock.balanceOf.returns(WeiPerWad)
          await mockFathomStablecoin.mock.balanceOf.returns(WeiPerWad)

          await expect(
            stableSwapModule.emergencyWithdraw(DeployerAddress)
          ).to.be.emit(stableSwapModule, "LogEmergencyWithdraw")
            .withArgs(DeployerAddress)
        })
      })
    })

    describe("#pause", () => {
      context("not authorized", () => {
        it("should revert", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(false)
          await expect(stableSwapModule.pause()).to.be.revertedWith("!(ownerRole or govRole)")
        })
      })

      context("when role can access", () => {
        it("should be success", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)
          await stableSwapModule.pause()
          expect(await stableSwapModule.paused()).to.be.equal(true)
        })
      })
    })
    describe("#unpause", () => {
      context("not authorized", () => {
        it("should revert", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(false)
          await expect(stableSwapModule.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
        })
      })

      context("when role can access", () => {
        it("should be success", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)
          await stableSwapModule.pause();
          await stableSwapModule.unpause()
          expect(await stableSwapModule.paused()).to.be.equal(false)
        })
      })
    })
  })
})
