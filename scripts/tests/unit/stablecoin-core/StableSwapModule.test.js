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
const numberOfSwapsLimitPerBlock = 2;

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

  await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
  await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))

  stableSwapModule = getContract("StableSwapModule", DeployerAddress)
  stableSwapModuleAsAlice = getContract("StableSwapModule", AliceAddress)
  await stableSwapModule.initialize(
    mockBookKeeper.address,
    mockUSD.address,
    mockFathomStablecoin.address,
    dailyLimitNumerator,
    singleSwapLimitNumerator,
    numberOfSwapsLimitPerUser,
    numberOfSwapsLimitPerBlock,
    [DeployerAddress]
  )

  return {
    stableSwapModule,
    mockUSD,
    mockedAccessControlConfig,
    mockFathomStablecoin
  }
}
describe("StableSwapModule", () => {
  // Contracts
  let mockedAccessControlConfig
  let mockUSD
  let stableSwapModule
  let mockFathomStablecoin

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ; ({
      stableSwapModule,
      mockUSD,
      mockedAccessControlConfig,
      mockFathomStablecoin
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
          await expect(stableSwapModule.setDecentralizedStatesStatus(true)).to.be.emit(stableSwapModule,"LogDecentralizedStateStatus")
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
        await expect(stableSwapModule.addToWhitelist(DeployerAddress)).to.be.emit(stableSwapModule,"LogAddToWhitelist")
            
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
        await expect(stableSwapModule.removeFromWhitelist(DeployerAddress)).to.be.emit(stableSwapModule,"LogRemoveFromWhitelist")
      })
    })
  })


  describe("#depositToken", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(stableSwapModule.depositToken(mockUSD.address, WeiPerWad)).to.be.revertedWith("!(ownerRole or govRole)")
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
    context("invalid token", () => {
      it("should revert", async () => {
        const mockToken = await createMock("ERC20Mintable");

        await expect(
          stableSwapModule.depositToken(mockToken.address, WeiPerWad)
        ).to.be.revertedWith("depositStablecoin/invalid-token")
      })
    })
    context("zero amount", () => {
      it("should revert", async () => {
        await mockUSD.mock.balanceOf.returns(WeiPerWad)
        await expect(
          stableSwapModule.depositToken(mockUSD.address, BigNumber.from("0"))
        ).to.be.revertedWith("depositStablecoin/amount-zero")
      })
    })
    context("not enough balance", () => {
      it("should revert", async () => {
        await mockUSD.mock.balanceOf.returns(WeiPerWad.div(2))
        await expect(
          stableSwapModule.depositToken(mockUSD.address, WeiPerWad)
        ).to.be.revertedWith("depositStablecoin/not-enough-balance")
      })
    })
    context("deposit token", () => {
      it("should emit event and save balance", async () => {
        await mockUSD.mock.balanceOf.returns(WeiPerWad)

        await expect(
          stableSwapModule.depositToken(mockUSD.address, WeiPerWad)
        ).to.be.emit(stableSwapModule, "LogDepositToken")
          .withArgs(DeployerAddress, mockUSD.address, WeiPerWad)
        expect(await stableSwapModule.tokenBalance(mockUSD.address)).to.be.equal(WeiPerWad)
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
    context("exceed single swap limit", () => {
      it("should revert after setting decentralized state - single swap limit", async () => {
        const bigMoney = WeiPerWad.mul(1000000);
        await mockFathomStablecoin.mock.balanceOf.returns(bigMoney)
        await stableSwapModule.depositToken(mockFathomStablecoin.address, bigMoney)
        await stableSwapModule.setDecentralizedStatesStatus(true)
        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, bigMoney)
        ).to.be.revertedWith("_checkSingleSwapLimit/single-swap-exceeds-limit")
      })
    })

    context("multiple swaps in one block", () => {
      it("should revert after setting decentralized state - one transaction per block", async () => {
        const swapMoney = WeiPerWad.mul(1);
        const bigMoney = WeiPerWad.mul(1000000);
        await mockFathomStablecoin.mock.balanceOf.returns(bigMoney)
        await stableSwapModule.depositToken(mockFathomStablecoin.address, bigMoney)
        await stableSwapModule.setDecentralizedStatesStatus(true)
        await stableSwapModule.swapTokenToStablecoin(DeployerAddress, swapMoney)
        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, swapMoney)
        ).to.be.revertedWith("_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded")
      })
    })

    context("swap token to stablecoin", () => {
      it("should swap and emit event", async () => {
        await mockFathomStablecoin.mock.balanceOf.returns(WeiPerWad)
        await mockUSD.mock.balanceOf.returns(WeiPerWad.mul(2))
        await stableSwapModule.depositToken(mockFathomStablecoin.address, WeiPerWad)
        await stableSwapModule.setFeeIn(WeiPerWad.div(10))
        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, WeiPerWad)
        ).to.be.emit(stableSwapModule, "LogSwapTokenToStablecoin")
          .withArgs(DeployerAddress, WeiPerWad, WeiPerWad.div(10))
      })
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

    context("exceed single swap limit", () => {
      it("should revert after setting decentralized state - single swap limit", async () => {
        const bigMoney = WeiPerWad.mul(1000000);
        await mockUSD.mock.balanceOf.returns(bigMoney)
        await stableSwapModule.depositToken(mockUSD.address, bigMoney)
        await stableSwapModule.setDecentralizedStatesStatus(true)
        await expect(
          stableSwapModule.swapStablecoinToToken(DeployerAddress, bigMoney)
        ).to.be.revertedWith("_checkSingleSwapLimit/single-swap-exceeds-limit")
      })
    })

    context("multiple swaps in one block", () => {
      it("should revert after setting decentralized state -one transaction per block", async () => {
        const bigMoney = WeiPerWad.mul(1000000);
        const swapMoney = WeiPerWad.mul(1);
        await mockUSD.mock.balanceOf.returns(bigMoney)
        await stableSwapModule.depositToken(mockUSD.address, bigMoney)
        await stableSwapModule.setDecentralizedStatesStatus(true)
        await stableSwapModule.swapStablecoinToToken(DeployerAddress, swapMoney)
        await expect(
          stableSwapModule.swapStablecoinToToken(DeployerAddress, swapMoney)
        ).to.be.revertedWith("_updateAndCheckNumberOfSwapsInBlocksPerLimit/swap-limit-exceeded")
      })
    })
    context("swap stablecoin to token", () => {
      it("should swap and emit event", async () => {
        await mockFathomStablecoin.mock.balanceOf.returns(WeiPerWad.mul(2))
        await mockUSD.mock.balanceOf.returns(WeiPerWad)
        await stableSwapModule.depositToken(mockUSD.address, WeiPerWad)
        await stableSwapModule.setFeeOut(WeiPerWad.div(10))
        await expect(
          stableSwapModule.swapStablecoinToToken(DeployerAddress, WeiPerWad)
        ).to.be.emit(stableSwapModule, "LogSwapStablecoinToToken")
          .withArgs(DeployerAddress, WeiPerWad, WeiPerWad.div(10))
      })
    })
    context("token decimals less then 18", () => {
      it("should swap and emit event", async () => {
        await mockFathomStablecoin.mock.balanceOf.returns(WeiPerWad.mul(2))
        await mockUSD.mock.balanceOf.returns(WeiPerWad)
        await mockUSD.mock.decimals.returns(10)
        await stableSwapModule.depositToken(mockUSD.address, WeiPerWad)
        await stableSwapModule.setFeeOut(WeiPerWad.div(10))
        await expect(
          stableSwapModule.swapStablecoinToToken(DeployerAddress, WeiPerWad)
        ).to.be.emit(stableSwapModule, "LogSwapStablecoinToToken")
          .withArgs(DeployerAddress, WeiPerWad, WeiPerWad.div(10))
      })
    })
  })

  describe("#withdrawFees", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(stableSwapModule.withdrawFees(DeployerAddress)).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })
    context("zero balance", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.withdrawFees(DeployerAddress)
        ).to.be.revertedWith("withdrawFees/no-fee-balance")
      })
    })
    context("zero address", () => {
      it("should revert", async () => {
        await expect(
          stableSwapModule.withdrawFees(AddressZero)
        ).to.be.revertedWith("withdrawFees/wrong-destination")
      })
    })
    context("withdraw fees", () => {
      it("should emit event", async () => {
        await mockFathomStablecoin.mock.balanceOf.returns(WeiPerWad.mul(2))
        await mockUSD.mock.balanceOf.returns(WeiPerWad)
        await stableSwapModule.depositToken(mockUSD.address, WeiPerWad)
        await stableSwapModule.setFeeOut(WeiPerWad.div(10))
        await stableSwapModule.swapStablecoinToToken(DeployerAddress, WeiPerWad)
        await expect(
          stableSwapModule.withdrawFees(DeployerAddress)
        ).to.be.emit(stableSwapModule, "LogWithdrawFees")
          .withArgs(DeployerAddress, 0, WeiPerWad.div(10))
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
        await expect(
          stableSwapModule.pause()
        ).to.be.emit(stableSwapModule, "LogStableSwapPauseState")
          .withArgs(true)
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
        await expect(
          stableSwapModule.unpause()
        ).to.be.emit(stableSwapModule, "LogStableSwapPauseState")
          .withArgs(false)
        expect(await stableSwapModule.paused()).to.be.equal(false)
      })
    })
  })
})
