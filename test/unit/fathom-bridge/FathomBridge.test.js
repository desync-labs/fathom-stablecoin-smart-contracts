const { ethers } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");

const { WeiPerRad, WeiPerWad } = require("../../helper/unit");
const { formatBytes32String } = ethers.utils;

describe("FathomBridge", () => {
  let mockedAccessControlConfig;
  let fathomBridge;
  let mockedToken;
  let DeployerAddress;
  let AliceAddress;
  let AddressZero;

  beforeEach(async () => {
    const { deployer, allice, a0 } = await getNamedAccounts();
    DeployerAddress = deployer;
    AliceAddress = allice;
    AddressZero = a0;

    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedToken = await smock.fake("ERC20MintableStableSwap");

    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.MINTABLE_ROLE.returns(formatBytes32String("MINTABLE_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
    mockedAccessControlConfig.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"));
    mockedAccessControlConfig.hasRole.returns(true);
    mockedToken.transfer.returns(true);
    mockedToken.transferFrom.returns(true);
    mockedToken.balanceOf.returns(WeiPerRad);
    mockedToken.approve.returns(true);
    mockedToken.mint.returns();
    // No burn fn on ERC20MintableStableSwap
    // mockedToken.burn.returns();

    const FathomBridge = await ethers.getContractFactory("MockFathomBridge");
    fathomBridge = await FathomBridge.deploy();
    await fathomBridge.deployed();

    await fathomBridge.initialize(mockedToken.address, mockedAccessControlConfig.address);
  });

  describe("#addToWhitelist", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.addToWhitelist(AliceAddress)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await expect(fathomBridge.addToWhitelist(AliceAddress)).to.be.emit(fathomBridge, "LogAddToWhitelist").withArgs(AliceAddress);
      });
    });
    context("when the caller is the owner but trying to add ZeroAddress", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await expect(fathomBridge.addToWhitelist(AddressZero)).to.be.revertedWith("FathomBridge/zero-address");
      });
    });
  });

  describe("#removeFromWhitelist", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.removeFromWhitelist(AliceAddress)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await fathomBridge.addToWhitelist(AliceAddress);
        await expect(fathomBridge.removeFromWhitelist(AliceAddress)).to.be.emit(fathomBridge, "LogRemoveFromWhitelist").withArgs(AliceAddress);
      });
    });
    context("when the caller is the owner but trying to add ZeroAddress", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await expect(fathomBridge.removeFromWhitelist(AddressZero)).to.be.revertedWith("FathomBridge/zero-address");
      });
    });
  });

  describe("#setDecentralizedMode", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.setDecentralizedMode(true)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        const decentralizedModeBefore = await fathomBridge.isDecentralizedMode();
        expect(decentralizedModeBefore).to.be.equal(false);
        await expect(fathomBridge.setDecentralizedMode(true)).to.be.emit(fathomBridge, "LogSetDecentralizedMode").withArgs(true);
        const decentralizedModeAfter = await fathomBridge.isDecentralizedMode();
        expect(decentralizedModeAfter).to.be.equal(true);
      });
    });
  });

  describe("#setFee", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.setFee(WeiPerRad)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        const feeBefore = await fathomBridge.fixedBridgeFee();
        expect(feeBefore).to.be.equal(0);
        await expect(fathomBridge.setFee(WeiPerRad)).to.be.emit(fathomBridge, "LogSetFee").withArgs(WeiPerRad);
        const feeAfter = await fathomBridge.fixedBridgeFee();
        expect(feeAfter).to.be.equal(WeiPerRad);
      });
    });
  });

  describe("#withdrawFees", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.withdrawFees(AliceAddress)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await expect(fathomBridge.withdrawFees(AliceAddress))
          .to.be.emit(fathomBridge, "LogWithdrawFees")
          .withArgs(DeployerAddress, AliceAddress, WeiPerRad);
      });
    });
    context("when the caller is the owner but withdraw fee to ZeroAddress", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await expect(fathomBridge.withdrawFees(AddressZero)).to.be.revertedWith("FathomBridge/zero-address");
      });
    });
  });

  describe("#crossChainTransfer", () => {
    context("when the caller is not whitelisted", async () => {
      it("should revert", async () => {
        await fathomBridge.removeFromWhitelist(DeployerAddress);
        await expect(fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerWad)).to.be.revertedWith("FathomBridge/not-whitelisted");
      });
    });
    context("when the caller is the whitelisted", async () => {
      it("should work and emit LogCrossChainTransferOut", async () => {
        await fathomBridge.addToWhitelist(DeployerAddress);
        await expect(fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerWad))
          .to.be.emit(fathomBridge, "LogCrossChainTransferOut")
          .withArgs(5522, DeployerAddress, AliceAddress, WeiPerWad, 1);
      });
    });
    context("when the caller is the whitelisted", async () => {
      it("should work and emit LogFeeCollection", async () => {
        await fathomBridge.addToWhitelist(DeployerAddress);
        await expect(fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerWad))
          .to.be.emit(fathomBridge, "LogFeeCollection")
          .withArgs(DeployerAddress, 0, 1);
      });
    });
    context("when the caller is the whitelisted but try to send to ZeroAddress", async () => {
      it("should revert", async () => {
        await fathomBridge.addToWhitelist(DeployerAddress);
        await expect(fathomBridge.crossChainTransfer(5522, AddressZero, WeiPerWad)).to.be.revertedWith("FathomBridge/zero-address");
      });
    });
    context("when the caller is the whitelisted and fee is set", async () => {
      it("should work and emit LogFeeCollection", async () => {
        await fathomBridge.addToWhitelist(DeployerAddress);
        const feeBefore = await fathomBridge.fixedBridgeFee();
        expect(feeBefore).to.be.equal(0);
        await fathomBridge.setFee(WeiPerWad);
        const feeAfter = await fathomBridge.fixedBridgeFee();
        expect(feeAfter).to.be.equal(WeiPerWad);
        await expect(fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerRad))
          .to.be.emit(fathomBridge, "LogFeeCollection")
          .withArgs(DeployerAddress, WeiPerWad, 1);
      });
    });
  });

  describe("#Cage", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await expect(fathomBridge.cage()).to.be.emit(fathomBridge, "LogCage");
      });
    });
  });
  describe("#pause", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.pause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await fathomBridge.pause();
      });
    });
  });
  describe("#unpause", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(fathomBridge.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", async () => {
      it("should work", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await fathomBridge.pause();
      });
    });
  });
});
