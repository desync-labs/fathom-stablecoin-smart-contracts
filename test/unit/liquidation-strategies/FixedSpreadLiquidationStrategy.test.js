const { ethers } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");

const { BigNumber } = ethers;
const { formatBytes32String } = ethers.utils;
const provider = ethers.provider;

const { formatBytes32BigNumber } = require("../../helper/format");
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const UnitHelpers = require("../../helper/unit");

const LIQUIDATION_ENGINE_ROLE = "0x73cc1824a5ac1764c2e141cf3615a9dcb73677c4e5be5154addc88d3e0cc1480";

describe("FixedSpreadLiquidationStrategy", () => {
  // Contracts
  let mockedBookKeeper;
  let mockedPriceOracle;
  let mockedPriceFeed;
  let mockedSystemDebtEngine;
  let mockedFlashLendingCallee;
  let mockedCollateralTokenAdapter;
  let mockedCollateralPoolConfig;
  let mockedAccessControlConfig;
  let mockedFathomStablecoin;
  let mockedStablecoinAdapter;
  let fixedSpreadLiquidationStrategy;
  let fixedSpreadLiquidationStrategyAsAlice;
  let mockedLiquidationEngine;

  beforeEach(async () => {
    mockedCollateralTokenAdapter = await smock.fake("TokenAdapter");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedLiquidationEngine = await smock.fake("LiquidationEngine");
    mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");
    mockedPriceOracle = await smock.fake("PriceOracle");
    mockedFlashLendingCallee = await smock.fake("IFlashLendingCallee");
    mockedPriceFeed = await smock.fake("SimplePriceFeed");
    mockedStablecoinAdapter = await smock.fake("StablecoinAdapter");
    mockedFathomStablecoin = await smock.fake("FathomStablecoin");

    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);

    mockedBookKeeper.totalStablecoinIssued.returns(BigNumber.from("0"));
    mockedLiquidationEngine.live.returns(BigNumber.from("1"));
    mockedSystemDebtEngine.surplusBuffer.returns(BigNumber.from("0"));
    mockedPriceOracle.stableCoinReferencePrice.returns(BigNumber.from("0"));
    mockedAccessControlConfig.hasRole.returns(true);

    mockedAccessControlConfig.LIQUIDATION_ENGINE_ROLE.returns(LIQUIDATION_ENGINE_ROLE); //keccak256 of LIQUIDATION_ENGINE_ROLE
    mockedStablecoinAdapter.stablecoin.returns(mockedFathomStablecoin.address);

    const FixedSpreadLiquidationStrategyFactory = await ethers.getContractFactory("MockFixedSpreadLiquidationStrategy");
    fixedSpreadLiquidationStrategy = await FixedSpreadLiquidationStrategyFactory.deploy();
    await fixedSpreadLiquidationStrategy.deployed();

    fixedSpreadLiquidationStrategyAsAlice = fixedSpreadLiquidationStrategy.connect(provider.getSigner(AliceAddress));

    await fixedSpreadLiquidationStrategy.initialize(
      mockedBookKeeper.address,
      mockedPriceOracle.address,
      mockedLiquidationEngine.address,
      mockedSystemDebtEngine.address,
      mockedStablecoinAdapter.address
    );
  });

  describe("#execute", () => {
    context("when the caller is not allowed", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(
          fixedSpreadLiquidationStrategyAsAlice.execute(
            formatBytes32String("WNATIVE"),
            UnitHelpers.WeiPerRad,
            UnitHelpers.WeiPerWad,
            AliceAddress,
            UnitHelpers.WeiPerWad,
            UnitHelpers.WeiPerWad,
            DeployerAddress,
            DeployerAddress,
            "0x"
          )
        ).to.be.revertedWith("!liquidationEngineRole");
      });
    });
    context("when input is invalid", () => {
      context("when positionDebtShare <= 0", () => {
        it("should be revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("WNATIVE"),
              0,
              UnitHelpers.WeiPerWad,
              AliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              DeployerAddress,
              DeployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-debt");
        });
      });

      context("when positionCollateralAmount <= 0", () => {
        it("should be revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("WNATIVE"),
              UnitHelpers.WeiPerWad,
              0,
              AliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              DeployerAddress,
              DeployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-collateral-amount");
        });
      });

      context("when positionAddress == 0", () => {
        it("should be revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("WNATIVE"),
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              AddressZero,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              DeployerAddress,
              DeployerAddress,
              ethers.utils.defaultAbiCoder.encode(["address", "bytes"], [DeployerAddress, []])
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-position-address");
        });
      });
    });

    context("when feedprice is invalid", () => {
      context("when priceFeed marked price as not ok", () => {
        it("should be revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(BigNumber.from("700000000000")), false]);

          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("WNATIVE"),
              UnitHelpers.WeiPerRad,
              UnitHelpers.WeiPerWad,
              AliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              DeployerAddress,
              DeployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/invalid-price");
        });
      });
      context("feedprice <= 0", () => {
        it("should be revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true);

          mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay);
          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(BigNumber.from("0")), true]);

          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("WNATIVE"),
              UnitHelpers.WeiPerRad,
              UnitHelpers.WeiPerWad,
              AliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              DeployerAddress,
              DeployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-collateral-price");
        });
      });
    });

    context("when contract doesn't call FlashLending", () => {
      context("when feedprice == 1", () => {
        context("and debtAccumulatedRate == 2", () => {
          it("should be success", async () => {
            mockedAccessControlConfig.hasRole.returns(true);
            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(2));
            mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay);
            mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10);
            mockedCollateralPoolConfig.getCloseFactorBps.returns(10000);
            mockedCollateralPoolConfig.getLiquidatorIncentiveBps.returns(10250);
            mockedCollateralPoolConfig.getTreasuryFeesBps.returns(2500);
            mockedCollateralPoolConfig.getDebtFloor.returns(10);
            mockedCollateralPoolConfig.getAdapter.returns(mockedCollateralTokenAdapter.address);
            mockedCollateralTokenAdapter.withdraw.returns();
            mockedStablecoinAdapter.depositRAD.returns();
            mockedFathomStablecoin.transferFrom.returns(true);
            mockedFathomStablecoin.approve.returns(true);

            mockedBookKeeper.confiscatePosition
              .whenCalledWith(
                formatBytes32String("WNATIVE"),
                AliceAddress,
                fixedSpreadLiquidationStrategy.address,
                mockedSystemDebtEngine.address,
                ethers.utils.parseEther("2.05").mul(-1),
                UnitHelpers.WeiPerWad.mul(-1)
              )
              .returns();
            mockedBookKeeper.moveCollateral
              .whenCalledWith(
                formatBytes32String("WNATIVE"),
                fixedSpreadLiquidationStrategy.address,
                DeployerAddress,
                ethers.utils.parseEther("2.0375")
              )
              .returns();
            mockedBookKeeper.moveCollateral
              .whenCalledWith(
                formatBytes32String("WNATIVE"),
                fixedSpreadLiquidationStrategy.address,
                mockedSystemDebtEngine.address,
                ethers.utils.parseEther("0.0125")
              )
              .returns();
            mockedBookKeeper.moveStablecoin.returns();
            mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay);
            mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(UnitHelpers.WeiPerWad), true]);

            await expect(
              fixedSpreadLiquidationStrategy.execute(
                formatBytes32String("WNATIVE"),
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad.mul(7),
                AliceAddress,
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad,
                DeployerAddress,
                DeployerAddress,
                "0x"
              )
            )
              .to.emit(fixedSpreadLiquidationStrategy, "LogFixedSpreadLiquidate")
              .withArgs(
                formatBytes32String("WNATIVE"),
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad.mul(7),
                AliceAddress,
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad,
                DeployerAddress,
                DeployerAddress,
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerRad.mul(2),
                ethers.utils.parseEther("2.05"),
                ethers.utils.parseEther("0.0125")
              );
          });
        });

        context("and debtAccumulatedRate == 12345", () => {
          it("should be success", async () => {
            mockedAccessControlConfig.hasRole.returns(true);
            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(12345));
            mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay);
            mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10);
            mockedCollateralPoolConfig.getCloseFactorBps.returns(5000);
            mockedCollateralPoolConfig.getLiquidatorIncentiveBps.returns(10300);
            mockedCollateralPoolConfig.getTreasuryFeesBps.returns(700);
            mockedCollateralPoolConfig.getDebtFloor.returns(10);
            mockedCollateralPoolConfig.getAdapter.returns(mockedCollateralTokenAdapter.address);
            mockedCollateralTokenAdapter.withdraw.returns();
            mockedStablecoinAdapter.depositRAD.returns();
            mockedFathomStablecoin.transferFrom.returns(true);
            mockedFathomStablecoin.approve.returns(true);

            mockedBookKeeper.confiscatePosition
              .whenCalledWith(
                formatBytes32String("WNATIVE"),
                AliceAddress,
                fixedSpreadLiquidationStrategy.address,
                mockedSystemDebtEngine.address,
                UnitHelpers.WeiPerWad.mul(-158941875).div(100000),
                UnitHelpers.WeiPerWad.mul(-25).div(100)
              )
              .returns();
            mockedBookKeeper.moveCollateral
              .whenCalledWith(
                formatBytes32String("WNATIVE"),
                fixedSpreadLiquidationStrategy.address,
                DeployerAddress,
                ethers.utils.parseEther("1586.1781875")
              )
              .returns();
            mockedBookKeeper.moveCollateral
              .whenCalledWith(
                formatBytes32String("WNATIVE"),
                fixedSpreadLiquidationStrategy.address,
                mockedSystemDebtEngine.address,
                ethers.utils.parseEther("3.2405625")
              )
              .returns();
            mockedBookKeeper.moveStablecoin.returns();
            mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay);
            mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(UnitHelpers.WeiPerWad.mul(2)), true]);

            await fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("WNATIVE"),
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad.mul(98765),
              AliceAddress,
              UnitHelpers.WeiPerWad.div(4),
              UnitHelpers.WeiPerWad.div(4),
              DeployerAddress,
              DeployerAddress,
              "0x"
            );
          });
        });
      });
    });

    context("when contract call FlashLending", () => {
      it("should be success", async () => {
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
        mockedAccessControlConfig.hasRole.returns(true);
        mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32BigNumber(BigNumber.from("1")));
        mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32BigNumber(BigNumber.from("1")));
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(3));
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay);
        mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10);
        mockedCollateralPoolConfig.getCloseFactorBps.returns(5000);
        mockedCollateralPoolConfig.getLiquidatorIncentiveBps.returns(10001);
        mockedCollateralPoolConfig.getTreasuryFeesBps.returns(17);
        mockedCollateralPoolConfig.getDebtFloor.returns(10);
        mockedCollateralPoolConfig.getAdapter.returns(mockedCollateralTokenAdapter.address);
        mockedCollateralTokenAdapter.withdraw.returns();
        mockedStablecoinAdapter.depositRAD.returns();
        mockedFathomStablecoin.transferFrom.returns(true);
        mockedFathomStablecoin.approve.returns(true);

        mockedBookKeeper.confiscatePosition
          .whenCalledWith(
            formatBytes32String("WNATIVE"),
            AliceAddress,
            fixedSpreadLiquidationStrategy.address,
            mockedSystemDebtEngine.address,
            UnitHelpers.WeiPerWad.mul(-1110111).div(1000000),
            UnitHelpers.WeiPerWad.mul(-37).div(100)
          )
          .returns();
        mockedBookKeeper.moveCollateral
          .whenCalledWith(
            formatBytes32String("WNATIVE"),
            fixedSpreadLiquidationStrategy.address,
            mockedFlashLendingCallee.address,
            ethers.utils.parseEther("1.1101108113")
          )
          .returns();
        mockedBookKeeper.moveCollateral
          .whenCalledWith(
            formatBytes32String("WNATIVE"),
            fixedSpreadLiquidationStrategy.address,
            mockedSystemDebtEngine.address,
            ethers.utils.parseEther("0.0000001887")
          )
          .returns();
        mockedBookKeeper.moveStablecoin.returns();
        mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay);

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(UnitHelpers.WeiPerWad), true]);
        mockedFlashLendingCallee.flashLendingCall.returns();
        mockedFlashLendingCallee.supportsInterface.returns(true);

        await fixedSpreadLiquidationStrategy.setFlashLendingEnabled(true);

        await expect(
          fixedSpreadLiquidationStrategy.execute(
            formatBytes32String("WNATIVE"),
            UnitHelpers.WeiPerWad,
            UnitHelpers.WeiPerWad.mul(8),
            AliceAddress,
            UnitHelpers.WeiPerWad.mul(37).div(100),
            UnitHelpers.WeiPerWad.mul(37).div(100),
            DeployerAddress,
            mockedFlashLendingCallee.address,
            ethers.utils.defaultAbiCoder.encode(["bytes"], [ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress])])
          )
        )
          .to.emit(fixedSpreadLiquidationStrategy, "LogFixedSpreadLiquidate")
          .withArgs(
            formatBytes32String("WNATIVE"),
            UnitHelpers.WeiPerWad,
            UnitHelpers.WeiPerWad.mul(8),
            AliceAddress,
            UnitHelpers.WeiPerWad.mul(37).div(100),
            UnitHelpers.WeiPerWad.mul(37).div(100),
            DeployerAddress,
            mockedFlashLendingCallee.address,
            UnitHelpers.WeiPerWad.mul(37).div(100),
            ethers.utils.parseEther("1.11").mul(UnitHelpers.WeiPerRay),
            ethers.utils.parseEther("1.110111"),
            ethers.utils.parseEther("0.0000001887")
          );
      });
    });
  });
});
