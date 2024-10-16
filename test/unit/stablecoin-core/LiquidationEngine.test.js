const { ethers } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");

const { WeiPerRay, WeiPerWad } = require("../../helper/unit");

const { formatBytes32String } = ethers.utils;
const provider = ethers.provider;

const COLLATERAL_POOL_ID = formatBytes32String("WNATIVE");

describe("LiquidationEngine", () => {
  // Contracts
  let mockedBookKeeper;
  let mockedFixedSpreadLiquidationStrategy;
  let mockedCollateralPoolConfig;
  let mockedAccessControlConfig;
  let mockedPriceFeed;

  let liquidationEngine;
  let liquidationEngineAsAlice;
  let liquidationEngineAsBob;

  let DeployerAddress;
  let AliceAddress;
  let BobAddress;
  let AddressZero;

  beforeEach(async () => {
    const { deployer, allice, bob, a0 } = await getNamedAccounts();
    AddressZero = a0;
    DeployerAddress = deployer;
    AliceAddress = allice;
    BobAddress = bob;

    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedFixedSpreadLiquidationStrategy = await smock.fake("FixedSpreadLiquidationStrategy");
    mockedPriceFeed = await smock.fake("SimplePriceFeed");
    const mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");

    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockedBookKeeper.totalStablecoinIssued.returns(0);
    mockedSystemDebtEngine.surplusBuffer.returns(0);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
    mockedAccessControlConfig.hasRole.returns(true);

    mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);
    mockedPriceFeed.isPriceOk.returns(true);

    const LiquidationEngineFactory = await ethers.getContractFactory("MockLiquidationEngine");
    liquidationEngine = await LiquidationEngineFactory.deploy();
    await liquidationEngine.deployed();

    liquidationEngineAsAlice = liquidationEngine.connect(provider.getSigner(AliceAddress));
    liquidationEngineAsBob = liquidationEngine.connect(provider.getSigner(BobAddress));

    await liquidationEngine.initialize(mockedBookKeeper.address, mockedSystemDebtEngine.address);
    await liquidationEngine.addToWhitelist(DeployerAddress);
    await liquidationEngine.addToWhitelist(AliceAddress);

    mockedAccessControlConfig.hasRole.returns(false);
  });

  describe("#liquidate", () => {
    context("liquidator is not whitelisted", () => {
      it("should revert", async () => {
        await expect(
          liquidationEngineAsBob["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/liquidator-not-whitelisted");
      });
    });
    context("liquidator removed from whitelist", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        await liquidationEngine.removeFromWhitelist(AliceAddress);

        await expect(
          liquidationEngineAsAlice["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/liquidator-not-whitelisted");
      });
    });
    context("when liquidation engine does not live", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        await liquidationEngine.cage();

        await expect(
          liquidationEngine["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/not-live");
      });
    });
    context("when debtShareToRepay == 0", () => {
      it("should revert", async () => {
        await expect(
          liquidationEngine["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            0,
            0,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/zero-debt-value-to-be-liquidated");
      });
    });
    context("when liquidation engine colllteral pool does not set strategy", () => {
      it("should revert", async () => {
        mockedBookKeeper.positions.returns([WeiPerWad.mul(10), WeiPerWad.mul(5)]);
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(WeiPerRay);
        mockedCollateralPoolConfig.getStrategy.returns(AddressZero);

        await expect(
          liquidationEngine["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/not-set-strategy");
      });
    });
    context("when price is unhealthy", () => {
      it("should revert", async () => {
        mockedBookKeeper.positions.returns([WeiPerWad.mul(10), WeiPerWad.mul(5)]);
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(WeiPerRay);
        mockedCollateralPoolConfig.getStrategy.returns(AddressZero);
        mockedPriceFeed.isPriceOk.returns(false);

        await expect(
          liquidationEngine["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/price-is-not-healthy");
      });
    });
  });

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(liquidationEngineAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)");
      });
    });

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1);

          await expect(liquidationEngineAsAlice.cage()).to.emit(liquidationEngineAsAlice, "LogCage").withArgs();

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0);
        });
      });

      context("when was already caged", () => {
        it("should not fail", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1);

          await expect(liquidationEngineAsAlice.cage()).to.emit(liquidationEngineAsAlice, "LogCage").withArgs();

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0);

          await liquidationEngineAsAlice.cage();

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0);
        });
      });

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          mockedAccessControlConfig.hasRole.whenCalledWith(formatBytes32String("SHOW_STOPPER_ROLE"), AliceAddress).returns(true);

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1);

          await expect(liquidationEngineAsAlice.cage()).to.emit(liquidationEngineAsAlice, "LogCage").withArgs();

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0);
        });
      });
    });
  });

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(liquidationEngineAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.whenCalledWith(formatBytes32String("OWNER_ROLE"), DeployerAddress).returns(true);

          await liquidationEngine.pause();
        });
      });
    });

    context("and role is gov role", () => {
      it("should be success", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(formatBytes32String("GOV_ROLE"), DeployerAddress).returns(true);

        await liquidationEngine.pause();
      });
    });

    context("when pause contract", () => {
      it("shouldn't be able to call liquidate", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        await liquidationEngine.pause();

        // mock contract
        mockedBookKeeper.positions.returns([WeiPerWad.mul(10), WeiPerWad.mul(10)]);
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(WeiPerRay);
        mockedCollateralPoolConfig.getStrategy.returns(mockedFixedSpreadLiquidationStrategy.address);

        mockedFixedSpreadLiquidationStrategy.execute.returns();

        await expect(
          liquidationEngine["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(liquidationEngineAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.whenCalledWith(formatBytes32String("OWNER_ROLE"), DeployerAddress).returns(true);

          await liquidationEngine.pause();
          await liquidationEngine.unpause();
        });
      });

      context("and role is gov role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.whenCalledWith(formatBytes32String("GOV_ROLE"), DeployerAddress).returns(true);

          await liquidationEngine.pause();
          await liquidationEngine.unpause();
        });
      });
    });

    context("when unpause contract", () => {
      it("should liquidate but revert because debt share not decrease", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        // pause contract
        await liquidationEngine.pause();

        // unpause contract
        await liquidationEngine.unpause();

        // mock contract
        mockedBookKeeper.positions.whenCalledWith(COLLATERAL_POOL_ID, AliceAddress).returns([WeiPerWad.mul(10), WeiPerWad.mul(10)]);
        mockedBookKeeper.stablecoin.returns(0);
        mockedFixedSpreadLiquidationStrategy.execute
          .whenCalledWith(
            COLLATERAL_POOL_ID,
            WeiPerWad.mul(10),
            WeiPerWad.mul(10),
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
          .returns();
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay.mul(2));
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(WeiPerRay);
        mockedCollateralPoolConfig.getStrategy.returns(mockedFixedSpreadLiquidationStrategy.address);

        await expect(
          liquidationEngine["liquidate(bytes32,address,uint256,uint256,address,bytes)"](
            COLLATERAL_POOL_ID,
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/debt-not-liquidated");
      });
    });
  });
});
