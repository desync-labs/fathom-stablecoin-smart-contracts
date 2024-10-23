const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { smock } = require("@defi-wonderland/smock");
const { formatBytes32String } = ethers.utils;
const provider = ethers.provider;

const UnitHelpers = require("../../helper/unit");

describe("SystemDebtEngine", () => {
  // Contracts
  let mockedBookKeeper;
  let mockedCollateralTokenAdapter;
  let mockedAccessControlConfig;

  let systemDebtEngine;
  let systemDebtEngineAsAlice;

  let DeployerAddress, AliceAddress;

  beforeEach(async () => {
    const { deployer, allice } = await getNamedAccounts();
    DeployerAddress = deployer;
    AliceAddress = allice;

    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedCollateralTokenAdapter = await smock.fake("TokenAdapter");

    const SystemDebtEngineFactory = await ethers.getContractFactory("MockSystemDebtEngine");
    systemDebtEngine = await SystemDebtEngineFactory.deploy();
    await systemDebtEngine.deployed();

    systemDebtEngineAsAlice = systemDebtEngine.connect(provider.getSigner(AliceAddress));

    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockedBookKeeper.stablecoin.returns(0);
    mockedBookKeeper.systemBadDebt.returns(0);

    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
    mockedAccessControlConfig.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"));

    await systemDebtEngine.initialize(mockedBookKeeper.address);
  });

  describe("#settleSystemBadDebt", () => {
    context("when insufficient surplus", () => {
      it("should be revert", async () => {
        await expect(systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad)).to.be.revertedWith("SystemDebtEngine/insufficient-surplus");
      });
    });
    context("when insufficient debt", () => {
      it("should be revert", async () => {
        mockedBookKeeper.stablecoin.returns(UnitHelpers.WeiPerRad);

        await expect(systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad)).to.be.revertedWith("SystemDebtEngine/insufficient-debt");
      });
    });
    context("when parameters are valid", () => {
      it("should be able to call settleSystemBadDebt", async () => {
        mockedBookKeeper.stablecoin.returns(UnitHelpers.WeiPerRad);
        mockedBookKeeper.systemBadDebt.returns(UnitHelpers.WeiPerRad);
        mockedBookKeeper.settleSystemBadDebt.whenCalledWith(UnitHelpers.WeiPerRad).returns();

        await systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad);
      });
    });
  });

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(systemDebtEngineAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)");
      });
    });

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedAccessControlConfig.hasRole.returns(true);
          mockedBookKeeper.settleSystemBadDebt.returns();

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1);

          await expect(systemDebtEngineAsAlice.cage()).to.emit(systemDebtEngineAsAlice, "LogCage").withArgs();

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0);
        });
      });

      context("when was already caged", () => {
        it("should not fail", async () => {
          mockedAccessControlConfig.hasRole.returns(true);
          mockedBookKeeper.settleSystemBadDebt.returns();

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1);

          await expect(systemDebtEngineAsAlice.cage()).to.emit(systemDebtEngineAsAlice, "LogCage").withArgs();

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0);

          await systemDebtEngineAsAlice.cage();

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0);
        });
      });

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          mockedAccessControlConfig.hasRole.returns(true);
          mockedBookKeeper.settleSystemBadDebt.returns();

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1);

          await expect(systemDebtEngineAsAlice.cage()).to.emit(systemDebtEngineAsAlice, "LogCage").withArgs();

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0);
        });
      });
    });
  });

  describe("#setSurplusBuffer", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(systemDebtEngineAsAlice.setSurplusBuffer(UnitHelpers.WeiPerRad)).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      it("should be able to call setSurplusBuffer", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        await expect(systemDebtEngine.setSurplusBuffer(UnitHelpers.WeiPerRad))
          .to.emit(systemDebtEngine, "LogSetSurplusBuffer")
          .withArgs(DeployerAddress, UnitHelpers.WeiPerRad);
      });
    });
    context("when the caller is the owner but the setSurplusBuffer value is less than RAD", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        await expect(systemDebtEngineAsAlice.setSurplusBuffer(BigNumber.from("100"))).to.be.revertedWith("SystemDebtEngine/invalidSurplusBuffer");
      });
    });
  });

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.hasRole.returns(false);

        await expect(systemDebtEngineAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          await mockedAccessControlConfig.hasRole.returns(true);

          await systemDebtEngine.pause();
        });
      });
    });

    context("and role is gov role", () => {
      it("should be success", async () => {
        await mockedAccessControlConfig.hasRole.returns(true);

        await systemDebtEngine.pause();
      });
    });

    context("when pause contract", () => {
      it("should be success", async () => {
        await mockedAccessControlConfig.hasRole.returns(true);

        await systemDebtEngine.pause();

        await expect(systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad)).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(systemDebtEngineAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await systemDebtEngine.pause();
          await systemDebtEngine.unpause();
        });
      });

      context("and role is gov role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await systemDebtEngine.pause();
          await systemDebtEngine.unpause();
        });
      });
    });

    context("when unpause contract", () => {
      it("should be success", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        // pause contract
        await systemDebtEngine.pause();

        // unpause contract
        await systemDebtEngine.unpause();

        await expect(systemDebtEngine.setSurplusBuffer(UnitHelpers.WeiPerRad))
          .to.emit(systemDebtEngine, "LogSetSurplusBuffer")
          .withArgs(DeployerAddress, UnitHelpers.WeiPerRad);
      });
    });
  });

  describe("#withdrawCollateralSurplus", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(
          systemDebtEngineAsAlice.withdrawCollateralSurplus(formatBytes32String("WXDC"), DeployerAddress, UnitHelpers.WeiPerWad)
        ).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      it("should be able to call withdrawCollateralSurplus", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        mockedBookKeeper.moveCollateral
          .whenCalledWith(formatBytes32String("WXDC"), systemDebtEngine.address, DeployerAddress, UnitHelpers.WeiPerWad)
          .returns();

        await systemDebtEngine.withdrawCollateralSurplus(formatBytes32String("WXDC"), DeployerAddress, UnitHelpers.WeiPerWad);
      });
    });

    describe("#withdrawStablecoinSurplus", () => {
      context("when the caller is not the owner", async () => {
        it("should revert", async () => {
          mockedAccessControlConfig.hasRole.returns(false);

          await expect(systemDebtEngineAsAlice.withdrawStablecoinSurplus(DeployerAddress, UnitHelpers.WeiPerRad)).to.be.revertedWith("!ownerRole");
        });
      });
      context("when the caller is the owner", async () => {
        context("when there is no system bad debt", async () => {
          it("should be able to call withdrawStablecoinSurplus", async () => {
            mockedAccessControlConfig.hasRole.returns(true);
            mockedBookKeeper.stablecoin.returns(UnitHelpers.WeiPerRad.mul(2));

            mockedBookKeeper.systemBadDebt.returns(0);

            mockedBookKeeper.moveStablecoin.whenCalledWith(systemDebtEngine.address, DeployerAddress, UnitHelpers.WeiPerRad).returns();

            await systemDebtEngine.withdrawStablecoinSurplus(DeployerAddress, UnitHelpers.WeiPerRad);
          });
        });

        context("when there is system bad debt", async () => {
          it("should revert", async () => {
            mockedAccessControlConfig.hasRole.returns(true);

            mockedBookKeeper.systemBadDebt.returns(1000);

            mockedBookKeeper.moveStablecoin.returns();

            await expect(systemDebtEngine.withdrawStablecoinSurplus(DeployerAddress, UnitHelpers.WeiPerRad)).to.be.revertedWith(
              "SystemDebtEngine/system-bad-debt-remaining"
            );
          });
        });
      });
    });
  });
});