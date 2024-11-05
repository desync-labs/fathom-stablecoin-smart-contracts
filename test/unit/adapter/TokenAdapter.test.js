const { ethers } = require("hardhat");
const provider = ethers.provider;
const { BigNumber } = ethers;
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");

const { formatBytes32String } = ethers.utils;

const { WeiPerWad } = require("../../helper/unit");

describe("TokenAdapter", () => {
  let tokenAdapter,
    tokenAdapterAsAlice,
    mockedBookKeeper,
    mockedToken,
    mockedAccessControlConfig,
    mockedCollateralPoolConfig,
    mockedVault,
    DeployerAddress,
    AliceAddress;

  beforeEach(async () => {
    const { deployer, allice } = await getNamedAccounts();
    DeployerAddress = deployer;
    AliceAddress = allice;

    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedVault = await smock.fake("Vault");

    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedToken = await smock.fake("ERC20Mintable");

    mockedToken.decimals.returns(18);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
    mockedAccessControlConfig.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"));
    mockedAccessControlConfig.hasRole.returns(true);

    const TokenAdapterFactory = await ethers.getContractFactory("TokenAdapter");
    tokenAdapter = await TokenAdapterFactory.deploy();
    await tokenAdapter.deployed();

    tokenAdapterAsAlice = tokenAdapter.connect(provider.getSigner(AliceAddress));

    await tokenAdapter.initialize(mockedBookKeeper.address, formatBytes32String("BTCB"), mockedToken.address);
  });

  describe("#deposit()", () => {
    context("when the token adapter is inactive", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        await tokenAdapter.cage();
        await expect(tokenAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("TokenAdapter/not-live");
      });
    });

    context("when a zero address is used for arg", () => {
      it("should revert with 'TokenAdapter/deposit-address(0)'", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        await expect(tokenAdapter.deposit("0x0000000000000000000000000000000000000000", WeiPerWad.mul(1), "0x")).to.be.revertedWith(
          "TokenAdapter/deposit-address(0)"
        );
      });
    });

    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        await expect(tokenAdapter.deposit(AliceAddress, ethers.constants.MaxUint256, "0x")).to.be.revertedWith("TokenAdapter/overflow");
      });
    });

    context("when transfer fail", () => {
      it("should revert", async () => {
        mockedBookKeeper.addCollateral.returns();
        await expect(tokenAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransferFrom");
      });
    });

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        mockedBookKeeper.addCollateral.whenCalledWith(formatBytes32String("BTCB"), AliceAddress, BigNumber.from("1000000000000000000")).returns();
        mockedToken.transferFrom.whenCalledWith(DeployerAddress, tokenAdapter.address, BigNumber.from("1000000000000000000")).returns(true);
        await tokenAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x");
      });
    });
    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        // Set the wad input to a value that is greater than MaxInt256
        const wad = BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639930");

        // Call the deposit function
        await expect(tokenAdapter.deposit(AliceAddress, wad, "0x")).to.be.revertedWith("TokenAdapter/overflow");
      });
    });
  });

  describe("#withdraw()", () => {
    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        await expect(tokenAdapter.withdraw(AliceAddress, ethers.constants.MaxUint256, "0x")).to.be.revertedWith("TokenAdapter/overflow");
      });
    });

    context("when transfer fail", () => {
      it("should revert", async () => {
        mockedBookKeeper.addCollateral.returns();
        await expect(tokenAdapter.withdraw(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransfer");
      });
    });

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        mockedBookKeeper.addCollateral.whenCalledWith(formatBytes32String("BTCB"), DeployerAddress, BigNumber.from("-1000000000000000000")).returns();
        mockedToken.transfer.whenCalledWith(AliceAddress, BigNumber.from("1000000000000000000")).returns(true);
        await tokenAdapter.withdraw(AliceAddress, WeiPerWad.mul(1), "0x");
      });
    });

    context("when wad input is overflow (> MaxInt256)", () => {
      it("should revert", async () => {
        // Set the wad input to be greater than MaxInt256
        const wad = BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639930");

        // Call the _withdraw() function
        await expect(tokenAdapter.withdraw(AliceAddress, wad, "0x")).to.be.revertedWith("TokenAdapter/overflow");
      });
    });
  });

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(tokenAdapterAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)");
      });
    });

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1);

          await expect(tokenAdapterAsAlice.cage()).to.emit(tokenAdapterAsAlice, "LogCage").withArgs();

          expect(await tokenAdapterAsAlice.live()).to.be.equal(0);
        });
      });

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1);

          await expect(tokenAdapterAsAlice.cage()).to.emit(tokenAdapterAsAlice, "LogCage").withArgs();

          expect(await tokenAdapterAsAlice.live()).to.be.equal(0);
        });
      });
    });
  });

  describe("#emergencyWithdraw()", () => {
    context("when _to is a zero address", () => {
      it("should revert with 'TokenAdapter/emergency-address(0)'", async () => {
        await expect(tokenAdapter.emergencyWithdraw("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
          "TokenAdapter/emergency-address(0)"
        );
      });
    });
  });

  describe("#setVault", async () => {
    context("when vault is not yet set", async () => {
      it("should set the vault", async () => {
        mockedVault.collateralAdapter.returns(tokenAdapter.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);
        mockedAccessControlConfig.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));
        await tokenAdapter.setVault(mockedVault.address);

        expect(await tokenAdapterAsAlice.vault()).to.be.equal(mockedVault.address);
        expect(await tokenAdapterAsAlice.flagVault()).to.be.equal(true);
      });
    });

    context("when vault is already set", async () => {
      it("should revert with the appropriate message", async () => {
        mockedVault.collateralAdapter.returns(tokenAdapter.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);
        mockedAccessControlConfig.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));
        await tokenAdapter.setVault(mockedVault.address);

        await expect(tokenAdapter.setVault(mockedVault.address)).to.be.revertedWith("CollateralTokenAdapter/Vault-set-already");
      });
    });

    context("when vault address is zero", async () => {
      it("should revert with the appropriate message", async () => {
        mockedVault.collateralAdapter.returns(tokenAdapter.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);
        mockedAccessControlConfig.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));

        await expect(tokenAdapter.setVault("0x0000000000000000000000000000000000000000")).to.be.revertedWith("CollateralTokenAdapter/zero-vault");
      });
    });

    context("when vault's collateral adapter does not match", async () => {
      it("should revert with the appropriate message", async () => {
        mockedVault.collateralAdapter.returns(mockedBookKeeper.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);
        mockedAccessControlConfig.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));
        await expect(tokenAdapter.setVault(mockedVault.address)).to.be.revertedWith("CollateralTokenAdapter/Adapter-no-match");
      });
    });

    context("when vault's adapter role is not assigned", async () => {
      it("should revert with the appropriate message", async () => {
        mockedVault.collateralAdapter.returns(tokenAdapter.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);
        mockedAccessControlConfig.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));

        await expect(tokenAdapter.setVault(mockedVault.address)).to.be.revertedWith("vaultsAdapter!Adapter");
      });
    });
  });
});
