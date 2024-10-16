const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { formatBytes32String } = ethers.utils;
const provider = ethers.provider;

const UnitHelpers = require("../../helper/unit");

describe("StabilityFeeCollector", () => {
  // Contracts
  let mockedBookKeeper;
  let mockedCollateralPoolConfig;
  let mockedAccessControlConfig;

  let stabilityFeeCollector;
  let stabilityFeeCollectorAsAlice;

  let DeployerAddress;
  let AliceAddress;

  beforeEach(async () => {
    const { deployer, allice } = await getNamedAccounts();
    DeployerAddress = deployer;
    AliceAddress = allice;

    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedBookKeeper = await smock.fake("BookKeeper");
    const mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");

    const StabilityFeeCollectorFactory = await ethers.getContractFactory("MockStabilityFeeCollector");
    stabilityFeeCollector = await StabilityFeeCollectorFactory.deploy();
    await stabilityFeeCollector.deployed();
    stabilityFeeCollectorAsAlice = stabilityFeeCollector.connect(provider.getSigner(AliceAddress));

    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
    mockedCollateralPoolConfig.updateLastAccumulationTime.returns();

    await stabilityFeeCollector.initialize(mockedBookKeeper.address, mockedSystemDebtEngine.address);
  });

  describe("#collect", () => {
    context("when call collect", async () => {
      it("should be rate to ~ 1%", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedBookKeeper.accrueStabilityFee.returns();

        // rate ~ 1% annually
        // r^31536000 = 1.01
        // r =~ 1000000000315522921573372069...
        mockedCollateralPoolConfig.getStabilityFeeRate.returns(BigNumber.from("1000000000315522921573372069"));

        // time increase 1 year
        mockedCollateralPoolConfig.getLastAccumulationTime.returns(await time.latest());
        await time.increase(31536000);
        // set debtAccumulatedRate = 1 ray
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay);

        // Set expectations
        const expectedCollateralPoolId = formatBytes32String("NATIVE");
        const expectedStabilityFeeRecipient = DeployerAddress;
        const expectedDebtAccumulatedRate = BigNumber.from("10000000000000000000000000");

        mockedBookKeeper.accrueStabilityFee
          .whenCalledWith(expectedCollateralPoolId, expectedStabilityFeeRecipient, expectedDebtAccumulatedRate)
          .returns();

        // Execute the function
        await stabilityFeeCollectorAsAlice.collect(formatBytes32String("WNATIVE"));

        // Verify if the mocked function was called with the expected arguments
        // Waffle automatically checks this based on the expectations set earlier
      });
    });
  });

  describe("#setSystemDebtEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(stabilityFeeCollectorAsAlice.setSystemDebtEngine(mockedBookKeeper.address)).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      it("should be able to call setSystemDebtEngine", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        await expect(stabilityFeeCollector.setSystemDebtEngine(mockedBookKeeper.address))
          .to.emit(stabilityFeeCollector, "LogSetSystemDebtEngine")
          .withArgs(DeployerAddress, mockedBookKeeper.address);
      });
    });
  });

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(stabilityFeeCollectorAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          await stabilityFeeCollector.pause();
        });
      });
    });

    context("and role is gov role", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        await stabilityFeeCollector.pause();
      });
    });
  });

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(stabilityFeeCollectorAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          await stabilityFeeCollector.pause();
          await stabilityFeeCollector.unpause();
        });
      });

      context("and role is gov role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          await stabilityFeeCollector.pause();
          await stabilityFeeCollector.unpause();
        });
      });
    });

    context("when unpause contract", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        // pause contract
        await stabilityFeeCollector.pause();

        // unpause contract
        await stabilityFeeCollector.unpause();

        mockedCollateralPoolConfig.getStabilityFeeRate.returns(BigNumber.from("1000000000315522921573372069"));
        mockedCollateralPoolConfig.getLastAccumulationTime.returns(await time.latest());
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay);
        mockedBookKeeper.accrueStabilityFee.returns();

        await stabilityFeeCollector.collect(formatBytes32String("WNATIVE"));
      });
    });
  });
});
