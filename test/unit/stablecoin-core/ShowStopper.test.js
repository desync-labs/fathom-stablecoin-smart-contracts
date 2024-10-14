const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { smock } = require("@defi-wonderland/smock");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { formatBytes32String } = ethers.utils;
const provider = ethers.provider;

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay, WeiPerWad, WeiPerRad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress } = require("../../helper/address");
const { increase } = require("../../helper/time");

const WeekInSeconds = 604800;

describe("ShowStopper", () => {
  // Contracts
  let mockedBookKeeper;
  let mockedLiquidationEngine;
  let mockedSystemDebtEngine;
  let mockedPriceOracle;
  let mockedPriceFeed;
  let mockedTokenAdapter;
  let mockedAccessControlConfig;
  let mockedCollateralPoolConfig;

  let showStopper;
  let showStopperAsAlice;

  const setup = async () => {
    mockedBookKeeper.cage.returns();
    mockedLiquidationEngine.cage.returns();
    mockedSystemDebtEngine.cage.returns();
    mockedPriceOracle.cage.returns();

    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockedAccessControlConfig.hasRole.returns(true);

    await showStopper.setBookKeeper(await mockedBookKeeper.address);
    await showStopper.setLiquidationEngine(mockedLiquidationEngine.address);
    await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address);
    await showStopper.setPriceOracle(mockedPriceOracle.address);
    await showStopper.cage(WeekInSeconds);

    mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);
    mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad);

    mockedPriceFeed.readPrice.returns(formatBytes32BigNumber(WeiPerWad));
    mockedPriceFeed.isPriceOk.returns(true);
    mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay);
    mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad);

    await showStopper.cagePool(formatBytes32String("NATIVE"));
    mockedBookKeeper.positionWhitelist.returns(BigNumber.from(0));
    mockedBookKeeper.stablecoin.returns(0);
  };

  beforeEach(async () => {
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");
    mockedLiquidationEngine = await smock.fake("LiquidationEngine");
    mockedPriceFeed = await smock.fake("SimplePriceFeed");
    mockedPriceOracle = await smock.fake("PriceOracle");
    mockedTokenAdapter = await smock.fake("TokenAdapter");

    mockedBookKeeper.totalStablecoinIssued.returns(0);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));

    const ShowStopperFactory = await ethers.getContractFactory("MockShowStopper");
    showStopper = await ShowStopperFactory.deploy();
    await showStopper.deployed();
    showStopperAsAlice = showStopper.connect(provider.getSigner(AliceAddress));

    await showStopper.initialize(mockedBookKeeper.address);
  });

  describe("#cage()", () => {
    context("when setting collateral pool is inactive", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        expect(await showStopper.live()).to.be.equal(1);

        mockedBookKeeper.cage.returns();
        mockedLiquidationEngine.cage.returns();
        mockedSystemDebtEngine.cage.returns();
        mockedPriceOracle.cage.returns();

        await showStopper.setBookKeeper(await mockedBookKeeper.address);
        await showStopper.setLiquidationEngine(mockedLiquidationEngine.address);
        await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address);
        await showStopper.setPriceOracle(mockedPriceOracle.address);

        await expect(showStopper.cage(WeekInSeconds)).to.emit(showStopper, "LogCage(uint256)").withArgs(WeekInSeconds);

        expect(await showStopper.live()).to.be.equal(0);
      });
    });

    context("invalid cooldown time", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        // less than 1 week
        await expect(showStopper.cage(WeekInSeconds - 1)).to.be.revertedWith("ShowStopper/invalid-cool-down");

        // more than three months
        await expect(showStopper.cage(7862401)).to.be.revertedWith("ShowStopper/invalid-cool-down");
      });
    });

    context("when user does not have authorized", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);

        expect(await showStopper.live()).to.be.equal(1);

        mockedBookKeeper.cage.returns();
        mockedLiquidationEngine.cage.returns();
        mockedSystemDebtEngine.cage.returns();
        mockedPriceOracle.cage.returns();

        await showStopper.setBookKeeper(await mockedBookKeeper.address);
        await showStopper.setLiquidationEngine(mockedLiquidationEngine.address);
        await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address);
        await showStopper.setPriceOracle(mockedPriceOracle.address);

        mockedAccessControlConfig.hasRole.returns(false);
        await expect(showStopperAsAlice.cage(WeekInSeconds)).to.be.revertedWith("!ownerRole");
      });
    });
  });

  describe("#cage(collateralPoolId)", () => {
    context("when setting collateral pool is inactive", () => {
      context("pool is inactive", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);
          mockedPriceFeed.isPriceOk.returns(true);

          expect(await showStopper.live()).to.be.equal(1);

          mockedBookKeeper.cage.returns();
          mockedLiquidationEngine.cage.returns();
          mockedSystemDebtEngine.cage.returns();
          mockedPriceOracle.cage.returns();
          mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad);

          await showStopper.setBookKeeper(await mockedBookKeeper.address);
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address);
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address);
          await showStopper.setPriceOracle(mockedPriceOracle.address);
          await showStopper.cage(WeekInSeconds);

          mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);
          mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad);

          mockedPriceFeed.readPrice.returns(formatBytes32BigNumber(WeiPerWad));
          mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay);

          await expect(showStopper.cagePool(formatBytes32String("NATIVE")))
            .to.emit(showStopper, "LogCageCollateralPool(bytes32)")
            .withArgs(formatBytes32String("NATIVE"));

          expect(await showStopper.live()).to.be.equal(0);
        });
      });

      context("pool is active", () => {
        it("should revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);
          mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad);

          await expect(showStopper.cagePool(formatBytes32String("NATIVE"))).to.be.revertedWith("ShowStopper/still-live");
        });
      });

      context("priceFeed's isPriceOk is false", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          expect(await showStopper.live()).to.be.equal(1);

          mockedBookKeeper.cage.returns();
          mockedLiquidationEngine.cage.returns();
          mockedSystemDebtEngine.cage.returns();
          mockedPriceOracle.cage.returns();

          await showStopper.setBookKeeper(await mockedBookKeeper.address);
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address);
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address);
          await showStopper.setPriceOracle(mockedPriceOracle.address);
          await showStopper.cage(WeekInSeconds);

          mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);
          mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad);

          mockedPriceFeed.readPrice.returns(formatBytes32BigNumber(WeiPerWad));
          mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay);
          mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad);
          mockedPriceFeed.isPriceOk.returns(false);

          await expect(showStopper.cagePool(formatBytes32String("NATIVE"))).to.be.revertedWith("ShowStopper/price-not-ok");

          expect(await showStopper.live()).to.be.equal(0);
        });
      });

      context("cage price is already defined", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);
          mockedPriceFeed.isPriceOk.returns(true);

          expect(await showStopper.live()).to.be.equal(1);

          mockedBookKeeper.cage.returns();
          mockedLiquidationEngine.cage.returns();
          mockedSystemDebtEngine.cage.returns();
          mockedPriceOracle.cage.returns();

          await showStopper.setBookKeeper(await mockedBookKeeper.address);
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address);
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address);
          await showStopper.setPriceOracle(mockedPriceOracle.address);
          await showStopper.cage(WeekInSeconds);

          mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);
          mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad);

          mockedPriceFeed.readPrice.returns(formatBytes32BigNumber(WeiPerWad));
          mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay);
          mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad);

          await showStopper.cagePool(formatBytes32String("NATIVE"));

          await expect(showStopper.cagePool(formatBytes32String("NATIVE"))).to.be.revertedWith(
            "ShowStopper/cage-price-collateral-pool-id-already-defined"
          );

          expect(await showStopper.live()).to.be.equal(0);
        });
      });
    });
  });

  describe("#redeemLockedCollateral", () => {
    context("when setting collateral pool is active", () => {
      context("pool is inactive", () => {
        context("and debtShare is more than 0", () => {
          it("should revert", async () => {
            mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
            mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
            mockedAccessControlConfig.hasRole.returns(true);

            await setup();

            mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("1")]);

            await expect(
              showStopper.redeemLockedCollateral(formatBytes32String("NATIVE"), DeployerAddress, DeployerAddress, "0x")
            ).to.be.revertedWith("ShowStopper/debtShare-not-zero");
          });
        });

        context("and lockedCollateral is overflow (> MaxInt256)", () => {
          it("should revert", async () => {
            await setup();

            mockedBookKeeper.positions.returns([ethers.constants.MaxUint256, BigNumber.from("0")]);

            await expect(
              showStopper.redeemLockedCollateral(formatBytes32String("NATIVE"), DeployerAddress, DeployerAddress, "0x")
            ).to.be.revertedWith("ShowStopper/overflow");
          });
        });

        context("when the caller has no access to the position", () => {
          it("should revert", async () => {
            await setup();

            mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("0")]);
            await expect(
              showStopperAsAlice.redeemLockedCollateral(formatBytes32String("NATIVE"), DeployerAddress, DeployerAddress, "0x")
            ).to.be.revertedWith("ShowStopper/not-allowed");
          });
        });

        context("and debtShare is 0 and lockedCollateral is 1 ray", () => {
          it("should be success", async () => {
            await setup();

            mockedBookKeeper.positions.whenCalledWith(formatBytes32String("NATIVE"), DeployerAddress).returns([WeiPerRay, BigNumber.from("0")]);
            mockedBookKeeper.confiscatePosition
              .whenCalledWith(formatBytes32String("NATIVE"), DeployerAddress, DeployerAddress, mockedSystemDebtEngine.address, WeiPerRay.mul("-1"), 0)
              .returns();

            await expect(showStopper.redeemLockedCollateral(formatBytes32String("NATIVE"), DeployerAddress, DeployerAddress, "0x"))
              .to.emit(showStopper, "LogRedeemLockedCollateral")
              .withArgs(formatBytes32String("NATIVE"), DeployerAddress, WeiPerRay);
          });
        });

        context("and debtShare is 0 and lockedCollateral is 1 ray, but the caller does not have access to the position", () => {
          it("should be success", async () => {
            await setup();

            mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("0")]);
            mockedBookKeeper.confiscatePosition.returns();

            await expect(
              showStopperAsAlice.redeemLockedCollateral(formatBytes32String("NATIVE"), DeployerAddress, DeployerAddress, "0x")
            ).to.be.revertedWith("ShowStopper/not-allowed");
          });
        });

        context("and debtShare is 0 and lockedCollateral is 1 ray, the caller is not the owner of the address but has access to", () => {
          it("should be success", async () => {
            await setup();

            mockedAccessControlConfig.hasRole.returns(false);

            mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("0")]);
            mockedBookKeeper.positionWhitelist.returns(BigNumber.from(1));
            mockedBookKeeper.confiscatePosition.returns();

            mockedBookKeeper.positions.whenCalledWith(formatBytes32String("NATIVE"), AliceAddress).returns([WeiPerRay, BigNumber.from("0")]);
            mockedBookKeeper.confiscatePosition
              .whenCalledWith(formatBytes32String("NATIVE"), AliceAddress, AliceAddress, mockedSystemDebtEngine.address, WeiPerRay.mul("-1"), 0)
              .returns();

            await expect(showStopper.redeemLockedCollateral(formatBytes32String("NATIVE"), AliceAddress, AliceAddress, "0x"))
              .to.emit(showStopper, "LogRedeemLockedCollateral")
              .withArgs(formatBytes32String("NATIVE"), AliceAddress, WeiPerRay);
          });
        });
      });

      context("pool is active", () => {
        it("should revert", async () => {
          await expect(showStopper.redeemLockedCollateral(formatBytes32String("NATIVE"), DeployerAddress, DeployerAddress, "0x")).to.be.revertedWith(
            "ShowStopper/still-live"
          );
        });
      });
    });
  });

  describe("#finalizeDebt", () => {
    context("when calculate debt", () => {
      context("pool is inactive", () => {
        context("debt is not 0", () => {
          it("should revert", async () => {
            await setup();

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);

            await time.increase(WeekInSeconds);
            await showStopper.finalizeDebt();

            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/debt-not-zero");
          });
        });

        context("stablecoin is not 0", () => {
          it("should revert", async () => {
            await setup();

            mockedBookKeeper.stablecoin.returns(WeiPerRay);

            await time.increase(WeekInSeconds);
            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/surplus-not-zero");
          });
        });

        context("debt is 0 and stablecoin is 0", () => {
          it("should be sucess", async () => {
            await setup();

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
            mockedBookKeeper.stablecoin.returns(BigNumber.from("0"));

            await time.increase(WeekInSeconds);
            await expect(showStopper.finalizeDebt()).to.emit(showStopper, "LogFinalizeDebt").withArgs();
          });
        });
      });

      context("pool is active", () => {
        it("should revert", async () => {
          await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/still-live");
        });
      });
    });
  });

  describe("#finalizeCashPrice", () => {
    context("when calculate cash price", () => {
      context("debt is 0", () => {
        it("should revert", async () => {
          await expect(showStopper.finalizeCashPrice(formatBytes32String("NATIVE"))).to.be.revertedWith("ShowStopper/debt-zero");
        });
      });

      context("cash price is already defined", () => {
        it("should revert", async () => {
          await setup();
          await time.increase(WeekInSeconds);

          mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
          await showStopper.finalizeDebt();

          mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);
          mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad);
          mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
          mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad.mul(100));

          await showStopper.finalizeCashPrice(formatBytes32String("NATIVE"));

          await expect(showStopper.finalizeCashPrice(formatBytes32String("NATIVE"))).to.be.revertedWith(
            "ShowStopper/final-cash-price-collateral-pool-id-already-defined"
          );
        });
      });

      context("cash price is 1 ray", () => {
        it("should be success", async () => {
          await setup();
          await time.increase(WeekInSeconds);

          mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
          await showStopper.finalizeDebt();

          mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
          mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad.mul(100));

          await expect(showStopper.finalizeCashPrice(formatBytes32String("NATIVE")))
            .to.emit(showStopper, "LogFinalizeCashPrice")
            .withArgs(formatBytes32String("NATIVE"));
        });
      });
    });
  });

  describe("#accumulateStablecoin", () => {
    context("when moving stable coin", () => {
      context("debt is 0", () => {
        it("should revert", async () => {
          await expect(showStopper.accumulateStablecoin(WeiPerRay)).to.be.revertedWith("ShowStopper/debt-zero");
        });
      });

      context("debt is not 0", () => {
        it("should be success", async () => {
          await setup();
          await time.increase(WeekInSeconds);

          mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
          await showStopper.finalizeDebt();

          mockedBookKeeper.moveStablecoin.returns();

          await expect(showStopper.accumulateStablecoin(WeiPerWad))
            .to.emit(showStopper, "LogAccumulateStablecoin")
            .withArgs(DeployerAddress, WeiPerWad);
        });
      });
    });
  });

  describe("#redeemStablecoin", () => {
    context("when calculate cash", () => {
      context("cash price is not defined", () => {
        it("should revert", async () => {
          await expect(showStopper.redeemStablecoin(formatBytes32String("NATIVE"), WeiPerWad)).to.be.revertedWith(
            "ShowStopper/final-cash-price-collateral-pool-id-not-defined"
          );
        });
      });

      context("cash price is already defined", () => {
        context("and stablecoinAccumulator balance < withdraw", () => {
          it("should revert", async () => {
            await setup();
            await time.increase(WeekInSeconds);

            await mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
            await showStopper.finalizeDebt();

            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
            mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad.mul(100));

            await showStopper.finalizeCashPrice(formatBytes32String("NATIVE"));

            mockedBookKeeper.moveCollateral.returns();

            await expect(showStopper.redeemStablecoin(formatBytes32String("NATIVE"), WeiPerWad)).to.be.revertedWith(
              "ShowStopper/insufficient-stablecoin-accumulator-balance"
            );
          });
        });

        context("and stablecoinAccumulator balance = withdraw", () => {
          it("should be success", async () => {
            await setup();
            await time.increase(WeekInSeconds);

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
            await showStopper.finalizeDebt();

            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
            mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad.mul(100));

            await showStopper.finalizeCashPrice(formatBytes32String("NATIVE"));
            mockedBookKeeper.moveStablecoin.returns();
            await showStopper.accumulateStablecoin(WeiPerWad);

            // await mockedBookKeeper.mock.moveCollateral.withArgs(
            //   formatBytes32String("NATIVE"),
            //   showStopper.address,
            //   DeployerAddress,
            //   WeiPerWad
            // ).returns()

            //waffle has some issue dealing with mock function with args that does not return value
            mockedBookKeeper.moveCollateral.returns();

            await expect(showStopper.redeemStablecoin(formatBytes32String("NATIVE"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("NATIVE"), DeployerAddress, WeiPerWad);
          });
        });

        context("and stablecoinAccumulator balance > withdraw", () => {
          it("should be success", async () => {
            await setup();
            await time.increase(WeekInSeconds);

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay);
            await showStopper.finalizeDebt();

            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
            mockedBookKeeper.poolStablecoinIssued.returns(WeiPerRad.mul(100));

            await showStopper.finalizeCashPrice(formatBytes32String("NATIVE"));

            mockedBookKeeper.moveStablecoin.returns();
            await showStopper.accumulateStablecoin(WeiPerWad.mul(2));
            // await mockedBookKeeper.mock.moveCollateral.withArgs(
            //   formatBytes32String("NATIVE"),
            //   showStopper.address,
            //   DeployerAddress,
            //   WeiPerRad
            // ).returns()

            //waffle has some issue dealing with mock function with args that does not return value
            mockedBookKeeper.moveCollateral.returns();

            await expect(showStopper.redeemStablecoin(formatBytes32String("NATIVE"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("NATIVE"), DeployerAddress, WeiPerWad);
          });
        });
      });
    });
  });

  describe("#setBookKeeper", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(showStopperAsAlice.setBookKeeper(await mockedBookKeeper.address)).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          await setup();

          await expect(showStopper.setBookKeeper(await mockedBookKeeper.address)).to.be.revertedWith("ShowStopper/not-live");
        });
      });
      context("when showStopper is live", () => {
        it("should be able to call setBookKeeper", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          // set total debt ceiling 1 rad
          await expect(showStopper.setBookKeeper(await mockedBookKeeper.address))
            .to.emit(showStopper, "LogSetBookKeeper")
            .withArgs(DeployerAddress, await mockedBookKeeper.address);
        });
      });
    });
  });

  describe("#setLiquidationEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(showStopperAsAlice.setLiquidationEngine(mockedLiquidationEngine.address)).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          await setup();

          await expect(showStopper.setLiquidationEngine(mockedLiquidationEngine.address)).to.be.revertedWith("ShowStopper/not-live");
        });
      });
      context("when showStopper is live", () => {
        it("should be able to call setLiquidationEngine", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          // set total debt ceiling 1 rad
          await expect(showStopper.setLiquidationEngine(mockedLiquidationEngine.address))
            .to.emit(showStopper, "LogSetLiquidationEngine")
            .withArgs(DeployerAddress, mockedLiquidationEngine.address);
        });
      });
    });
  });

  describe("#setSystemDebtEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(showStopperAsAlice.setSystemDebtEngine(mockedSystemDebtEngine.address)).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          await setup();

          await expect(showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)).to.be.revertedWith("ShowStopper/not-live");
        });
      });
      context("when showStopper is live", () => {
        it("should be able to call setSystemDebtEngine", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          // set total debt ceiling 1 rad
          await expect(showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address))
            .to.emit(showStopper, "LogSetSystemDebtEngine")
            .withArgs(DeployerAddress, mockedSystemDebtEngine.address);
        });
      });
    });
  });

  describe("#setPriceOracle", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(showStopperAsAlice.setPriceOracle(mockedPriceOracle.address)).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          await setup();

          await expect(showStopper.setPriceOracle(mockedPriceOracle.address)).to.be.revertedWith("ShowStopper/not-live");
        });
      });
      context("when showStopper is live", () => {
        it("should be able to call setPriceOracle", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
          mockedAccessControlConfig.hasRole.returns(true);

          // set total debt ceiling 1 rad
          await expect(showStopper.setPriceOracle(mockedPriceOracle.address))
            .to.emit(showStopper, "LogSetPriceOracle")
            .withArgs(DeployerAddress, mockedPriceOracle.address);
        });
      });
    });
  });
});
