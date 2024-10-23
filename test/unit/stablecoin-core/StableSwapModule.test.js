const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const provider = ethers.provider;
const { smock } = require("@defi-wonderland/smock");
const { formatBytes32String } = ethers.utils;

const { WeiPerWad } = require("../../helper/unit");
const dailyLimitNumerator = 2000; //on denomination of 10000th, 2000/10000 = 20%
const singleSwapLimitNumerator = 100; ///on denomination of 10000th, 100/10000 = 1%
const numberOfSwapsLimitPerUser = 1;
const blocksPerLimit = 2;

describe("StableSwapModule", () => {
  // Contracts
  let mockedAccessControlConfig;
  let mockUSD;
  let stableSwapModule;
  let mockFathomStablecoin;
  let stableSwapModuleWrapper;
  let mockedCollateralPoolConfig;
  let mockSystemDebtEngine;
  let mockStablecoinAdapter;
  let mockBookKeeper;
  let stableSwapModuleAsAlice;

  let DeployerAddress;
  let AliceAddress;
  let AddressZero;

  beforeEach(async () => {
    const { deployer, allice, a0 } = await getNamedAccounts();
    DeployerAddress = deployer;
    AliceAddress = allice;
    AddressZero = a0;

    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockSystemDebtEngine = await smock.fake("SystemDebtEngine");
    mockStablecoinAdapter = await smock.fake("StablecoinAdapter");
    mockFathomStablecoin = await smock.fake("FathomStablecoin");
    mockBookKeeper = await smock.fake("BookKeeper");
    mockUSD = await smock.fake("ERC20Mintable");

    mockBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockStablecoinAdapter.stablecoin.returns(mockFathomStablecoin.address);
    mockUSD.decimals.returns(BigNumber.from(18));
    mockFathomStablecoin.decimals.returns(BigNumber.from(18));
    mockedAccessControlConfig.hasRole.returns(true);

    mockFathomStablecoin.approve.returns(true);
    mockBookKeeper.whitelist.returns();
    mockFathomStablecoin.transferFrom.returns(true);
    mockFathomStablecoin.transfer.returns(true);
    mockUSD.transferFrom.returns(true);
    mockUSD.transfer.returns(true);
    mockUSD.balanceOf.returns(WeiPerWad.mul(50000));
    mockFathomStablecoin.balanceOf.returns(WeiPerWad.mul(50000));

    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

    const StableSwapModule = await ethers.getContractFactory("MockStableSwapModule");
    stableSwapModule = await StableSwapModule.deploy();
    await stableSwapModule.deployed();

    stableSwapModuleAsAlice = stableSwapModule.connect(provider.getSigner(AliceAddress));

    const StableSwapModuleWrapper = await ethers.getContractFactory("MockStableSwapModuleWrapper");
    stableSwapModuleWrapper = await StableSwapModuleWrapper.deploy();
    await stableSwapModuleWrapper.deployed();

    await stableSwapModule.initialize(
      mockBookKeeper.address,
      mockUSD.address,
      mockFathomStablecoin.address,
      dailyLimitNumerator,
      singleSwapLimitNumerator,
      numberOfSwapsLimitPerUser,
      blocksPerLimit
    );

    await stableSwapModuleWrapper.initialize(mockBookKeeper.address, stableSwapModule.address);

    await stableSwapModule.addToWhitelist(DeployerAddress);
    await stableSwapModuleWrapper.addToWhitelist(DeployerAddress);
    await stableSwapModule.setStableSwapWrapper(stableSwapModuleWrapper.address);
  });

  describe("#setDailySwapLimitNumerator", () => {
    context("not owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(stableSwapModule.setDailySwapLimitNumerator(dailyLimitNumerator)).to.be.revertedWith("!ownerRole");
      });
    });
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setDailySwapLimitNumerator(1)).to.be.revertedWith("StableSwapModule/less-than-minimum-daily-swap-limit");
      });
    });
    context("greater than denominator", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setDailySwapLimitNumerator(1000000)).to.be.revertedWith("StableSwapModule/numerator-over-denominator");
      });
    });
    context("valid daily swap limit", () => {
      it("should set the daily swap limit and emit an event", async () => {
        const oldLimit = await stableSwapModule.dailySwapLimitNumerator();
        const newLimit = dailyLimitNumerator;

        await expect(stableSwapModule.setDailySwapLimitNumerator(newLimit))
          .to.be.emit(stableSwapModule, "LogDailySwapLimitUpdate")
          .withArgs(newLimit, oldLimit);
        expect(await stableSwapModule.dailySwapLimitNumerator()).to.be.equal(newLimit);
      });
    });
  });

  describe("#setSingleSwapLimitNumerator", () => {
    context("not owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.setSingleSwapLimitNumerator(dailyLimitNumerator)).to.be.revertedWith("!ownerRole");
      });
    });
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setSingleSwapLimitNumerator(1)).to.be.revertedWith("StableSwapModule/less-than-minimum-single-swap-limit");
      });
    });
    context("greater than denominator", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setSingleSwapLimitNumerator(1000000)).to.be.revertedWith("StableSwapModule/numerator-over-denominator");
      });
    });
    context("valid single swap limit", () => {
      it("should set the singleswap limit and emit an event", async () => {
        const oldLimit = await stableSwapModule.singleSwapLimitNumerator();
        const newLimit = singleSwapLimitNumerator;

        await expect(stableSwapModule.setSingleSwapLimitNumerator(newLimit))
          .to.be.emit(stableSwapModule, "LogSingleSwapLimitUpdate")
          .withArgs(newLimit, oldLimit);
        expect(await stableSwapModule.singleSwapLimitNumerator()).to.be.equal(newLimit);
      });
    });
  });

  describe("#setNumberOfSwapsLimitPerUser", () => {
    context("not owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.setNumberOfSwapsLimitPerUser(numberOfSwapsLimitPerUser)).to.be.revertedWith("!ownerRole");
      });
    });
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setSingleSwapLimitNumerator(0)).to.be.revertedWith("StableSwapModule/less-than-minimum-single-swap-limit");
      });
    });

    context("valid number of Swaps limit per user", () => {
      it("should set the number of swaps limit per user and emit an event", async () => {
        const oldLimit = await stableSwapModule.numberOfSwapsLimitPerUser();
        const newLimit = 5;

        await expect(stableSwapModule.setNumberOfSwapsLimitPerUser(newLimit))
          .to.be.emit(stableSwapModule, "LogNumberOfSwapsLimitPerUserUpdate")
          .withArgs(newLimit, oldLimit);
        expect(await stableSwapModule.numberOfSwapsLimitPerUser()).to.be.equal(newLimit);
      });
    });
  });

  describe("#setBlocksPerLimit", () => {
    context("not owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.setBlocksPerLimit(numberOfSwapsLimitPerUser)).to.be.revertedWith("!ownerRole");
      });
    });
    context("lower than minimum", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setBlocksPerLimit(0)).to.be.revertedWith("StableSwapModule/less-than-minimum-blocks-per-limit");
      });
    });

    context("valid number of blocks per limit", () => {
      it("should set the valid number of blocks per limit and emit an event", async () => {
        const oldLimit = await stableSwapModule.blocksPerLimit();
        const newLimit = 5;

        await expect(stableSwapModule.setBlocksPerLimit(newLimit))
          .to.be.emit(stableSwapModule, "LogBlocksPerLimitUpdate")
          .withArgs(newLimit, oldLimit);
        expect(await stableSwapModule.blocksPerLimit()).to.be.equal(newLimit);
      });
    });
  });

  describe("#setFeeIn", () => {
    context("not owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(stableSwapModule.setFeeIn(WeiPerWad.div(10))).to.be.revertedWith("!ownerRole");
      });
    });
    context("fee is too big", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setFeeIn(WeiPerWad)).to.be.revertedWith("StableSwapModule/invalid-fee-in");
      });
    });
    context("valid fee", () => {
      it("should set the fee and emit an event", async () => {
        const newFee = WeiPerWad.div(10);

        await expect(stableSwapModule.setFeeIn(newFee)).to.be.emit(stableSwapModule, "LogSetFeeIn").withArgs(DeployerAddress, newFee);
        expect(await stableSwapModule.feeIn()).to.be.equal(newFee);
      });
    });
  });

  describe("#setFeeOut", () => {
    context("not owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.setFeeOut(WeiPerWad.div(10))).to.be.revertedWith("!ownerRole");
      });
    });
    context("fee is too big", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.setFeeOut(WeiPerWad)).to.be.revertedWith("StableSwapModule/invalid-fee-out");
      });
    });
    context("valid fee", () => {
      it("should set the fee and emit an event", async () => {
        const newFee = WeiPerWad.div(10);

        await expect(stableSwapModule.setFeeOut(newFee)).to.be.emit(stableSwapModule, "LogSetFeeOut").withArgs(DeployerAddress, newFee);
        expect(await stableSwapModule.feeOut()).to.be.equal(newFee);
      });
    });
  });

  describe("#setDecentralizedStatesStatus", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.setDecentralizedStatesStatus(true)).to.be.revertedWith("!ownerRole");
      });
    });
    context("valid deployer", () => {
      it("should set status and emit an event", async () => {
        await expect(stableSwapModule.setDecentralizedStatesStatus(true))
          .to.be.emit(stableSwapModule, "LogDecentralizedStateStatus")
          .withArgs(false, true);
        expect(await stableSwapModule.isDecentralizedState()).to.be.equal(true);
      });
    });
  });

  describe("#addToWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.addToWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole");
      });
    });
    context("valid deployer", () => {
      it("should add to whitelist and emit an event", async () => {
        await expect(stableSwapModule.addToWhitelist(DeployerAddress)).to.be.emit(stableSwapModule, "LogAddToWhitelist");
      });
    });
  });

  describe("#removeFromWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.removeFromWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole");
      });
    });
    context("valid deployer", () => {
      it("should remove from whitelist and emit an event", async () => {
        await expect(stableSwapModule.removeFromWhitelist(DeployerAddress)).to.be.emit(stableSwapModule, "LogRemoveFromWhitelist");
      });
    });
  });

  describe("#depositToken", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModule.depositToken(mockUSD.address, WeiPerWad)).to.be.revertedWith("only-stableswap-wrapper");
      });
    });
    context("paused contract", () => {
      it("should revert", async () => {
        await stableSwapModule.pause();

        await expect(stableSwapModule.depositToken(mockUSD.address, WeiPerWad)).to.be.revertedWith("Pausable: paused");
      });
    });
    context("zero amount", () => {
      it("should revert", async () => {
        mockUSD.balanceOf.returns(WeiPerWad);
        await expect(stableSwapModule.depositToken(mockUSD.address, BigNumber.from("0"))).to.be.revertedWith("only-stableswap-wrapper");
      });
    });
    context("not enough balance", () => {
      it("should revert", async () => {
        mockUSD.balanceOf.returns(WeiPerWad.div(2));
        await expect(stableSwapModule.depositToken(mockUSD.address, WeiPerWad)).to.be.revertedWith("only-stableswap-wrapper");
      });
    });
  });

  describe("#swapTokenToStablecoin", () => {
    context("paused contract", () => {
      it("should revert", async () => {
        await stableSwapModule.pause();

        await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress, WeiPerWad)).to.be.revertedWith("Pausable: paused");
      });
    });
    context("zero amount", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress, BigNumber.from("0"))).to.be.revertedWith("StableSwapModule/amount-zero");
      });
    });
    context("not enough stablecoin", () => {
      it("should revert", async () => {
        await expect(stableSwapModule.swapTokenToStablecoin(DeployerAddress, WeiPerWad)).to.be.revertedWith(
          "swapTokenToStablecoin/not-enough-stablecoin-balance"
        );
      });
    });

    describe("#swapStablecoinToToken", () => {
      context("paused contract", () => {
        it("should revert", async () => {
          await stableSwapModule.pause();

          await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress, WeiPerWad)).to.be.revertedWith("Pausable: paused");
        });
      });
      context("zero amount", () => {
        it("should revert", async () => {
          await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress, BigNumber.from("0"))).to.be.revertedWith(
            "StableSwapModule/amount-zero"
          );
        });
      });
      context("not enough stablecoin", () => {
        it("should revert", async () => {
          await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress, WeiPerWad)).to.be.revertedWith(
            "swapStablecoinToToken/not-enough-token-balance"
          );
        });
      });
    });

    describe("#withdrawFees", () => {
      context("only-stableswap-wrapper-can-call", () => {
        it("should revert", async () => {
          mockedAccessControlConfig.hasRole.returns(false);
          await expect(stableSwapModule.withdrawFees(DeployerAddress, WeiPerWad, WeiPerWad)).to.be.revertedWith("only-stableswap-wrapper");
        });
      });
    });

    describe("#emergencyWithdraw", () => {
      context("not authorized", () => {
        it("should revert", async () => {
          mockedAccessControlConfig.hasRole.returns(false);
          await expect(stableSwapModule.emergencyWithdraw(DeployerAddress)).to.be.revertedWith("!(ownerRole or govRole)");
        });
      });
      context("not paused", () => {
        it("should revert", async () => {
          await expect(stableSwapModule.emergencyWithdraw(DeployerAddress)).to.be.revertedWith("Pausable: not paused");
        });
      });
      context("zero address", () => {
        it("should revert", async () => {
          await stableSwapModule.pause();
          await expect(stableSwapModule.emergencyWithdraw(AddressZero)).to.be.revertedWith("withdrawFees/empty-account");
        });
      });
      context("emergency withdraw", () => {
        it("should emit event", async () => {
          await stableSwapModule.pause();

          mockUSD.balanceOf.returns(WeiPerWad);
          mockFathomStablecoin.balanceOf.returns(WeiPerWad);

          await expect(stableSwapModule.emergencyWithdraw(DeployerAddress))
            .to.be.emit(stableSwapModule, "LogEmergencyWithdraw")
            .withArgs(DeployerAddress);
        });
      });
    });

    describe("#pause", () => {
      context("not authorized", () => {
        it("should revert", async () => {
          mockedAccessControlConfig.hasRole.returns(false);
          await expect(stableSwapModule.pause()).to.be.revertedWith("!(ownerRole or govRole)");
        });
      });

      context("when role can access", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true);
          await stableSwapModule.pause();
          expect(await stableSwapModule.paused()).to.be.equal(true);
        });
      });
    });
    describe("#unpause", () => {
      context("not authorized", () => {
        it("should revert", async () => {
          mockedAccessControlConfig.hasRole.returns(false);
          await expect(stableSwapModule.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
        });
      });

      context("when role can access", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true);
          await stableSwapModule.pause();
          await stableSwapModule.unpause();
          expect(await stableSwapModule.paused()).to.be.equal(false);
        });
      });
    });
  });
});
