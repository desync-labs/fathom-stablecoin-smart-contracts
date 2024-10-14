const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { smock } = require("@defi-wonderland/smock");

const { formatBytes32String } = ethers.utils;

const { DeployerAddress } = require("../../helper/address");
const { WeiPerWad, WeiPerRad } = require("../../helper/unit");
const dailyLimitNumerator = 2000; //on denomination of 10000th, 2000/10000 = 20%
const singleSwapLimitNumerator = 100; ///on denomination of 10000th, 100/10000 = 1%
const numberOfSwapsLimitPerUser = 1;
const blocksPerLimit = 2;

// Silenced due to SSM getting commented out from the deployment script
xdescribe("StableSwapModuleWrapper", () => {
  // Contracts
  let mockedAccessControlConfig;
  let mockUSD;
  let stableSwapModule;
  let mockFathomStablecoin;
  let stableSwapModuleWrapper;

  beforeEach(async () => {
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    const mockStablecoinAdapter = await smock.fake("StablecoinAdapter");
    mockFathomStablecoin = await smock.fake("FathomStablecoin");
    const mockBookKeeper = await smock.fake("BookKeeper");
    mockUSD = await smock.fake("ERC20Mintable");

    mockBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockStablecoinAdapter.stablecoin.returns(mockFathomStablecoin.address);
    mockUSD.decimals.returns(BigNumber.from(18));
    mockFathomStablecoin.decimals.returns(BigNumber.from(18));
    mockedAccessControlConfig.hasRole.returns(true);

    mockFathomStablecoin.approve.returns(true);
    mockBookKeeper.addToWhitelist.returns();
    mockFathomStablecoin.transferFrom.returns(true);
    mockFathomStablecoin.transfer.returns(true);
    mockUSD.transferFrom.returns(true);
    mockUSD.transfer.returns(true);
    mockUSD.balanceOf.returns(WeiPerWad.mul(50000));
    mockFathomStablecoin.balanceOf.returns(WeiPerWad.mul(50000));

    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

    const StableSwapModuleFactory = await ethers.getContractFactory("MockStableSwapModule");
    stableSwapModule = await StableSwapModuleFactory.deploy();
    await stableSwapModule.deployed();

    const StableSwapModuleWrapperFactory = await ethers.getContractFactory("MockStableSwapModuleWrapper");
    stableSwapModuleWrapper = await StableSwapModuleWrapperFactory.deploy();
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

  describe("#setDecentralizedStatesStatus", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModuleWrapper.setIsDecentralizedState(true)).to.be.revertedWith("!ownerRole");
      });
    });
    context("valid deployer", () => {
      it("should set status and emit an event", async () => {
        await expect(stableSwapModuleWrapper.setIsDecentralizedState(true)).to.be.emit(stableSwapModuleWrapper, "LogUpdateIsDecentralizedState");
        expect(await stableSwapModuleWrapper.isDecentralizedState()).to.be.equal(true);
      });
    });
  });

  describe("#addToWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModuleWrapper.addToWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole");
      });
    });
    context("valid deployer", () => {
      it("should add to whitelist and emit an event", async () => {
        await expect(stableSwapModuleWrapper.addToWhitelist(DeployerAddress)).to.be.emit(stableSwapModuleWrapper, "LogAddToWhitelist");
      });
    });
  });

  describe("#removeFromWhitelist", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress)).to.be.revertedWith("!ownerRole");
      });
    });
    context("valid deployer", () => {
      it("should remove from whitelist and emit an event", async () => {
        await expect(stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress)).to.be.emit(stableSwapModuleWrapper, "LogRemoveFromWhitelist");
      });
    });
  });

  describe("#depositTokens", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress);
        await expect(stableSwapModuleWrapper.depositTokens(WeiPerWad)).to.be.revertedWith("user-not-whitelisted");
      });
    });
    context("paused contract", () => {
      it("should revert", async () => {
        await stableSwapModuleWrapper.pause();

        await expect(stableSwapModuleWrapper.depositTokens(WeiPerWad)).to.be.revertedWith("Pausable: paused");
      });
    });
    context("zero amount", () => {
      it("should revert", async () => {
        mockUSD.balanceOf.returns(WeiPerWad);
        await expect(stableSwapModuleWrapper.depositTokens(BigNumber.from("0"))).to.be.revertedWith("wrapper-depositTokens/amount-zero");
      });
    });
    context("not enough balance - usd", () => {
      it("should revert", async () => {
        mockUSD.balanceOf.returns(WeiPerWad.div(2));
        await expect(stableSwapModuleWrapper.depositTokens(WeiPerWad)).to.be.revertedWith("depositTokens/token-not-enough");
      });
    });

    context("not enough balance - stablecoin", () => {
      it("should revert", async () => {
        mockFathomStablecoin.balanceOf.returns(WeiPerWad.div(2));
        await expect(stableSwapModuleWrapper.depositTokens(WeiPerWad)).to.be.revertedWith("depositTokens/FXD-not-enough");
      });
    });
  });

  describe("#withdrawTokens", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        await stableSwapModuleWrapper.removeFromWhitelist(DeployerAddress);
        await expect(stableSwapModuleWrapper.withdrawTokens(WeiPerWad)).to.be.revertedWith("user-not-whitelisted");
      });
    });

    context("zero amount", async () => {
      it("Should revert", async () => {
        await expect(stableSwapModuleWrapper.withdrawTokens(BigNumber.from("0"))).to.be.revertedWith("withdrawTokens/amount-zero");
      });
    });

    context("not enough deposit", async () => {
      it("Should revert", async () => {
        await expect(stableSwapModuleWrapper.withdrawTokens(WeiPerWad.mul(10000))).to.be.revertedWith("withdrawTokens/amount-exceeds-users-deposit");
      });
    });
  });

  describe("#pause", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModuleWrapper.pause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      it("should be success", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await expect(stableSwapModuleWrapper.pause()).to.be.emit(stableSwapModuleWrapper, "LogStableSwapWrapperPauseState").withArgs(true);
        expect(await stableSwapModuleWrapper.paused()).to.be.equal(true);
      });
    });
  });
  describe("#unpause", () => {
    context("not authorized", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(stableSwapModuleWrapper.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      it("should be success", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await stableSwapModuleWrapper.pause();
        await expect(stableSwapModuleWrapper.unpause()).to.be.emit(stableSwapModuleWrapper, "LogStableSwapWrapperPauseState").withArgs(false);
        expect(await stableSwapModuleWrapper.paused()).to.be.equal(false);
      });
    });
  });

  describe("#getters", () => {
    context("zero deposit - getActualLiquidityAvailablePerUser", () => {
      it("should revert for zero deposit - get amounts", () => {
        expect(stableSwapModuleWrapper.getAmounts(0)).to.be.revertedWith("getAmounts/amount-zero");
      });
    });
    context("zero deposit - getActualLiquidityAvailablePerUser", () => {
      it("should revert for no deposit for the user - get amounts", () => {
        expect(stableSwapModuleWrapper.getAmounts(WeiPerRad)).to.be.revertedWith("getAmounts/amount-exceeds-users-deposit");
      });
    });
  });

  describe("fees", () => {
    context("withdraw claimed fees", () => {
      it("should revert - no claimed fees", async () => {
        await expect(stableSwapModuleWrapper.withdrawClaimedFees()).to.be.revertedWith("withdrawClaimedFees/no-claimed-fees");
      });
    });

    context("emergency withdraw", () => {
      it("should revert - zero amount", async () => {
        await stableSwapModuleWrapper.pause();
        await stableSwapModule.pause();
        await expect(stableSwapModuleWrapper.emergencyWithdraw()).to.be.revertedWith("emergencyWithdraw/amount-zero");
      });
    });
  });
});
