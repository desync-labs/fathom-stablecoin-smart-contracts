const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { smock } = require("@defi-wonderland/smock");

const { One } = ethers.constants;
const provider = ethers.provider;
const { formatBytes32String } = ethers.utils;

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay, WeiPerRad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");

describe("PriceOracle", () => {
  // Contracts
  let mockedBookKeeper;
  let mockedPriceFeed;
  let mockedCollateralPoolConfig;
  let mockedAccessControlConfig;

  let priceOracle;
  let priceOracleAsAlice;

  beforeEach(async () => {
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedPriceFeed = await smock.fake("SimplePriceFeed");

    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));
    mockedAccessControlConfig.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"));
    mockedCollateralPoolConfig.getLiquidationRatio.returns(1);
    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);

    const PriceOracleFactory = await ethers.getContractFactory("MockPriceOracle");
    priceOracle = await PriceOracleFactory.deploy();
    await priceOracle.deployed();

    priceOracleAsAlice = priceOracle.connect(provider.getSigner(AliceAddress));

    await priceOracle.initialize(mockedBookKeeper.address);
  });

  describe("#setPrice()", () => {
    context("when price from price feed is 1", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), false]);
          mockedBookKeeper.accessControlConfig.returns(mockedCollateralPoolConfig.address);

          mockedCollateralPoolConfig.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: WeiPerRay,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
            positionDebtCeiling: WeiPerRad.mul(1000000),
          });
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedCollateralPoolConfig.setPriceWithSafetyMargin.whenCalledWith(formatBytes32String("WNATIVE"), BigNumber.from("0")).returns();
          await expect(priceOracle.setPrice(formatBytes32String("WNATIVE")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("WNATIVE"), One, 0);
        });
      });
    });

    context("when price from price feed is 7 * 10^11", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          mockedCollateralPoolConfig.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: 10 ** 10,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
            positionDebtCeiling: WeiPerRad.mul(1000000),
          });

          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(BigNumber.from("700000000000")), false]);

          mockedCollateralPoolConfig.setPriceWithSafetyMargin.whenCalledWith(formatBytes32String("WNATIVE"), BigNumber.from("0")).returns();
          await expect(priceOracle.setPrice(formatBytes32String("WNATIVE")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("WNATIVE"), BigNumber.from("700000000000"), 0);
        });
      });
    });
  });

  describe("#setPriceBatch()", () => {
    context("when price from price feed is 1", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), false]);
          mockedBookKeeper.accessControlConfig.returns(mockedCollateralPoolConfig.address);

          mockedCollateralPoolConfig.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: WeiPerRay,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
            positionDebtCeiling: WeiPerRad.mul(1000000),
          });
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedCollateralPoolConfig.setPriceWithSafetyMargin.whenCalledWith(formatBytes32String("WNATIVE"), BigNumber.from("0")).returns();
          mockedCollateralPoolConfig.setPriceWithSafetyMargin.whenCalledWith(formatBytes32String("JEJU"), BigNumber.from("0")).returns();

          await expect(priceOracle.setPriceForBatch([formatBytes32String("WNATIVE"), formatBytes32String("JEJU")]))
            .to.emit(priceOracle, "LogSetPriceForBatch")
            .withArgs([formatBytes32String("WNATIVE"), formatBytes32String("JEJU")]);
        });
      });
    });

    context("when price from price feed is 7 * 10^11", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          mockedCollateralPoolConfig.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: 10 ** 10,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
            positionDebtCeiling: WeiPerRad.mul(1000000),
          });

          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(BigNumber.from("700000000000")), false]);

          mockedCollateralPoolConfig.setPriceWithSafetyMargin.whenCalledWith(formatBytes32String("WNATIVE"), BigNumber.from("0")).returns();
          mockedCollateralPoolConfig.setPriceWithSafetyMargin.whenCalledWith(formatBytes32String("JEJU"), BigNumber.from("0")).returns();
          await expect(priceOracle.setPriceForBatch([formatBytes32String("WNATIVE"), formatBytes32String("JEJU")]))
            .to.emit(priceOracle, "LogSetPriceForBatch")
            .withArgs([formatBytes32String("WNATIVE"), formatBytes32String("JEJU")]);
        });
      });
    });
  });

  describe("#setStableCoinReferencePrice", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(priceOracleAsAlice.setStableCoinReferencePrice(10 ** 10)).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      context("when priceOracle does not live", () => {
        it("should be revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await priceOracle.cage();

          await expect(priceOracle.setStableCoinReferencePrice(10 ** 10)).to.be.revertedWith("PriceOracle/not-live");
        });
      });
      context("new price is lower than min", () => {
        it("should revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await expect(priceOracle.setStableCoinReferencePrice(WeiPerRay.div(1005))).to.be.revertedWith("PriceOracle/invalid-reference-price");
        });
      });
      context("new price is greater than max", () => {
        it("should revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await expect(priceOracle.setStableCoinReferencePrice(WeiPerRay.mul(3))).to.be.revertedWith("PriceOracle/invalid-reference-price");
        });
      });
      context("when priceOracle is live", () => {
        it("should be able to call setStableCoinReferencePrice", async () => {
          const referencePrice = WeiPerRay.mul(11).div(10);
          mockedAccessControlConfig.hasRole.returns(true);

          await expect(priceOracle.setStableCoinReferencePrice(referencePrice))
            .to.emit(priceOracle, "LogSetStableCoinReferencePrice")
            .withArgs(DeployerAddress, referencePrice);
        });
      });
    });
  });

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(priceOracleAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await priceOracle.pause();
        });
      });
    });

    context("when pause contract", () => {
      it("should be success", async () => {
        mockedAccessControlConfig.hasRole.returns(true);

        mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10);

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), true]);

        await priceOracle.pause();

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), false]);
        mockedCollateralPoolConfig.collateralPools.returns({
          totalDebtShare: 0,
          debtAccumulatedRate: WeiPerRay,
          priceWithSafetyMargin: WeiPerRay,
          debtCeiling: 0,
          debtFloor: 0,
          priceFeed: mockedPriceFeed.address,
          liquidationRatio: 10 ** 10,
          stabilityFeeRate: WeiPerRay,
          lastAccumulationTime: 0,
          adapter: AddressZero,
          closeFactorBps: 5000,
          liquidatorIncentiveBps: 10250,
          treasuryFeesBps: 5000,
          strategy: AddressZero,
          positionDebtCeiling: WeiPerRad.mul(1000000),
        });

        mockedCollateralPoolConfig.setPriceWithSafetyMargin.returns();
        await expect(priceOracle.setPrice(formatBytes32String("WNATIVE"))).to.be.revertedWith("Pausable: paused");
      });
    });
  });

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(priceOracleAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await priceOracle.pause();
          await priceOracle.unpause();
        });
      });
    });

    context("when unpause contract", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10);

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), true]);

        // pause contract
        await priceOracle.pause();

        // unpause contract
        await priceOracle.unpause();

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), false]);
        mockedCollateralPoolConfig.collateralPools.returns({
          totalDebtShare: 0,
          debtAccumulatedRate: WeiPerRay,
          priceWithSafetyMargin: WeiPerRay,
          debtCeiling: 0,
          debtFloor: 0,
          priceFeed: mockedPriceFeed.address,
          liquidationRatio: 10 ** 10,
          stabilityFeeRate: WeiPerRay,
          lastAccumulationTime: 0,
          adapter: AddressZero,
          closeFactorBps: 5000,
          liquidatorIncentiveBps: 10250,
          treasuryFeesBps: 5000,
          strategy: AddressZero,
          positionDebtCeiling: WeiPerRad.mul(1000000),
        });

        mockedCollateralPoolConfig.setPriceWithSafetyMargin.whenCalledWith(formatBytes32String("WNATIVE"), BigNumber.from("0")).returns();

        await expect(priceOracle.setPrice(formatBytes32String("WNATIVE")))
          .to.emit(priceOracle, "LogSetPrice")
          .withArgs(formatBytes32String("WNATIVE"), One, 0);
      });
    });
  });

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(priceOracleAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)");
      });
    });

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          expect(await priceOracleAsAlice.live()).to.be.equal(1);

          await expect(priceOracleAsAlice.cage()).to.emit(priceOracleAsAlice, "LogCage").withArgs();

          expect(await priceOracleAsAlice.live()).to.be.equal(0);
        });
      });
    });
  });
});
