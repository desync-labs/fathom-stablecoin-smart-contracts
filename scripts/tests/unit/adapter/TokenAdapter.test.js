const { ethers, BigNumber } = require("ethers");
const chai = require("chai");
const { expect } = chai;
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32String } = ethers.utils;

const { DeployerAddress, AliceAddress, BobAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerWad } = require("../../helper/unit");
const { loadFixture } = require("../../helper/fixtures");

const loadFixtureHandler = async () => {
  const mockedAccessControlConfig = await createMock("AccessControlConfig");
  const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
  const mockedVault = await createMock("Vault");

  const mockedBookKeeper = await createMock("BookKeeper");
  const mockedToken = await createMock("ERC20Mintable");

  await mockedToken.mock.decimals.returns(18);
  await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
  await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
  await mockedAccessControlConfig.mock.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"));
  await mockedAccessControlConfig.mock.hasRole.returns(true);

  const tokenAdapter = getContract("TokenAdapter", DeployerAddress);
  const tokenAdapterAsAlice = getContract("TokenAdapter", AliceAddress);

  await tokenAdapter.initialize(mockedBookKeeper.address, formatBytes32String("BTCB"), mockedToken.address);
  return {
    tokenAdapter,
    tokenAdapterAsAlice,
    mockedBookKeeper,
    mockedToken,
    mockedAccessControlConfig,
    mockedCollateralPoolConfig,
    mockedVault,
  };
};

describe("TokenAdapter", () => {
  //Contract
  let tokenAdapter;
  let mockedBookKeeper;
  let mockedToken;
  let mockedAccessControlConfig;
  let mockedCollateralPoolConfig;
  let tokenAdapterAsAlice;
  let mockedVault;

  before(async () => {
    await snapshot.revertToSnapshot();
  });

  beforeEach(async () => {
    ({ tokenAdapter, tokenAdapterAsAlice, mockedBookKeeper, mockedToken, mockedVault, mockedAccessControlConfig, mockedCollateralPoolConfig } =
      await loadFixture(loadFixtureHandler));
  });

  describe("#deposit()", () => {
    context("when the token adapter is inactive", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(true);

        await tokenAdapter.cage();
        await expect(tokenAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("TokenAdapter/not-live");
      });
    });

    context("when a zero address is used for arg", () => {
      it("should revert with 'TokenAdapter/deposit-address(0)'", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(true);

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
        await mockedBookKeeper.mock.addCollateral.returns();
        await expect(tokenAdapter.deposit(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransferFrom");
      });
    });

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        await mockedBookKeeper.mock.addCollateral
          .withArgs(formatBytes32String("BTCB"), AliceAddress, BigNumber.from("1000000000000000000"))
          .returns();
        await mockedToken.mock.transferFrom.withArgs(DeployerAddress, tokenAdapter.address, BigNumber.from("1000000000000000000")).returns(true);
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
        await mockedBookKeeper.mock.addCollateral.returns();
        await expect(tokenAdapter.withdraw(AliceAddress, WeiPerWad.mul(1), "0x")).to.be.revertedWith("!safeTransfer");
      });
    });

    context("when parameters are valid", () => {
      it("should be able to call bookkeeper.addCollateral() correctly", async () => {
        await mockedBookKeeper.mock.addCollateral
          .withArgs(formatBytes32String("BTCB"), DeployerAddress, BigNumber.from("-1000000000000000000"))
          .returns();
        await mockedToken.mock.transfer.withArgs(AliceAddress, BigNumber.from("1000000000000000000")).returns(true);
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
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(false);

        await expect(tokenAdapterAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)");
      });
    });

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
          await mockedAccessControlConfig.mock.hasRole.returns(true);

          expect(await tokenAdapterAsAlice.live()).to.be.equal(1);

          await expect(tokenAdapterAsAlice.cage()).to.emit(tokenAdapterAsAlice, "LogCage").withArgs();

          expect(await tokenAdapterAsAlice.live()).to.be.equal(0);
        });
      });

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
          await mockedAccessControlConfig.mock.hasRole.returns(true);

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
        await mockedVault.mock.collateralAdapter.returns(tokenAdapter.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(true);
        await mockedAccessControlConfig.mock.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));
        await tokenAdapter.setVault(mockedVault.address);

        expect(await tokenAdapterAsAlice.vault()).to.be.equal(mockedVault.address);
        expect(await tokenAdapterAsAlice.flagVault()).to.be.equal(true);
      });
    });

    context("when vault is already set", async () => {
      it("should revert with the appropriate message", async () => {
        await mockedVault.mock.collateralAdapter.returns(tokenAdapter.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(true);
        await mockedAccessControlConfig.mock.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));
        await tokenAdapter.setVault(mockedVault.address);

        await expect(tokenAdapter.setVault(mockedVault.address)).to.be.revertedWith("CollateralTokenAdapter/Vault-set-already");
      });
    });

    context("when vault address is zero", async () => {
      it("should revert with the appropriate message", async () => {
        await mockedVault.mock.collateralAdapter.returns(tokenAdapter.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(true);
        await mockedAccessControlConfig.mock.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));

        await expect(tokenAdapter.setVault("0x0000000000000000000000000000000000000000")).to.be.revertedWith("CollateralTokenAdapter/zero-vault");
      });
    });

    context("when vault's collateral adapter does not match", async () => {
      it("should revert with the appropriate message", async () => {
        await mockedVault.mock.collateralAdapter.returns(mockedBookKeeper.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(true);
        await mockedAccessControlConfig.mock.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));
        await expect(tokenAdapter.setVault(mockedVault.address)).to.be.revertedWith("CollateralTokenAdapter/Adapter-no-match");
      });
    });

    context("when vault's adapter role is not assigned", async () => {
      it("should revert with the appropriate message", async () => {
        await mockedVault.mock.collateralAdapter.returns(tokenAdapter.address);
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
        await mockedAccessControlConfig.mock.hasRole.returns(false);
        await mockedAccessControlConfig.mock.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"));

        await expect(tokenAdapter.setVault(mockedVault.address)).to.be.revertedWith("vaultsAdapter!Adapter");
      });
    });
  });
});
