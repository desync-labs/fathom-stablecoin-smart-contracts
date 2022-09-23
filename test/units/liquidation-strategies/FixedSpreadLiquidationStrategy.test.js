require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");
const { formatBytes32BigNumber } = require("../../helper/format");
const UnitHelpers = require("../../helper/unit");

chai.use(smock.matchers)
const { expect } = chai
const { AddressZero } = ethers.constants
const { formatBytes32String } = ethers.utils


const loadFixture = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
  const mockedBookKeeper = await smock.fake("BookKeeper");
  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  const mockedPriceOracle = await smock.fake("PriceOracle");
  const mockedPriceFeed = await smock.fake("MockPriceFeed");
  const mockedLiquidationEngine = await smock.fake("LiquidationEngine");
  const mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");
  const mockedFlashLendingCallee = await smock.fake("MockFlashLendingCallee");
  const mockedCollateralTokenAdapter = await smock.fake("CollateralTokenAdapter");

  mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
  mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
  mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address)
  mockedAccessControlConfig.hasRole.returns(true)

  const FixedSpreadLiquidationStrategy = (await ethers.getContractFactory(
    "FixedSpreadLiquidationStrategy",
    deployer
  ))
  const fixedSpreadLiquidationStrategy = (await upgrades.deployProxy(FixedSpreadLiquidationStrategy, [
    mockedBookKeeper.address,
    mockedPriceOracle.address,
    mockedLiquidationEngine.address,
    mockedSystemDebtEngine.address,
  ]))

  return {
    fixedSpreadLiquidationStrategy,
    mockedBookKeeper,
    mockedPriceOracle,
    mockedPriceFeed,
    mockedSystemDebtEngine,
    mockedFlashLendingCallee,
    mockedCollateralTokenAdapter,
    mockedAccessControlConfig,
    mockedCollateralPoolConfig,
  }
}

describe("FixedSpreadLiquidationStrategy", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockedBookKeeper
  let mockedPriceOracle
  let mockedPriceFeed
  let mockedSystemDebtEngine
  let mockedFlashLendingCallee
  let mockedCollateralTokenAdapter
  let mockedCollateralPoolConfig
  let mockedAccessControlConfig

  let fixedSpreadLiquidationStrategy
  let fixedSpreadLiquidationStrategyAsAlice

  beforeEach(async () => {
    ;({
      fixedSpreadLiquidationStrategy,
      mockedBookKeeper,
      mockedPriceOracle,
      mockedPriceFeed,
      mockedSystemDebtEngine,
      mockedFlashLendingCallee,
      mockedCollateralTokenAdapter,
      mockedCollateralPoolConfig,
      mockedAccessControlConfig,
    } = await loadFixture())
    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    fixedSpreadLiquidationStrategyAsAlice = fixedSpreadLiquidationStrategy.connect(alice)
  })

  describe("#execute", () => {
    context("when the caller is not allowed", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(
          fixedSpreadLiquidationStrategyAsAlice.execute(
            formatBytes32String("BNB"),
            UnitHelpers.WeiPerRad,
            UnitHelpers.WeiPerWad,
            aliceAddress,
            UnitHelpers.WeiPerWad,
            UnitHelpers.WeiPerWad,
            deployerAddress,
            deployerAddress,
            "0x"
          )
        ).to.be.revertedWith("!liquidationEngingRole")
      })
    })
    context("when input is invalid", () => {
      context("when positionDebtShare <= 0", () => {
        it("should be revert", async () => {
          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("BNB"),
              0,
              UnitHelpers.WeiPerWad,
              aliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              deployerAddress,
              deployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-debt")
        })
      })

      context("when positionCollateralAmount <= 0", () => {
        it("should be revert", async () => {
          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("BNB"),
              UnitHelpers.WeiPerWad,
              0,
              aliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              deployerAddress,
              deployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-collateral-amount")
        })
      })

      context("when positionAddress == 0", () => {
        it("should be revert", async () => {
          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("BNB"),
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              AddressZero,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              deployerAddress,
              deployerAddress,
              ethers.utils.defaultAbiCoder.encode(["address", "bytes"], [deployerAddress, []])
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-position-address")
        })
      })
    })

    context("when feedprice is invalid", () => {
      context("when priceFeed marked price as not ok", () => {
        it("should be revert", async () => {
          mockedPriceFeed.peekPrice.returns([
            formatBytes32BigNumber(BigNumber.from("700000000000")),
            false,
          ])

          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("BNB"),
              UnitHelpers.WeiPerRad,
              UnitHelpers.WeiPerWad,
              aliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              deployerAddress,
              deployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/invalid-price")
        })
      })
      context("feedprice <= 0", () => {
        it("should be revert", async () => {
          mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)
          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(BigNumber.from("0")), true])

          await expect(
            fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("BNB"),
              UnitHelpers.WeiPerRad,
              UnitHelpers.WeiPerWad,
              aliceAddress,
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad,
              deployerAddress,
              deployerAddress,
              "0x"
            )
          ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-collateral-price")
        })
      })
    })

    context("when contract doesn't call FlashLending", () => {
      context("when feedprice == 1", () => {
        context("and debtAccumulatedRate == 2", () => {
          it("should be success", async () => {
            mockedPriceOracle.stableCoinReferencePrice.reset()
            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(2))
            mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay)
            mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10)
            mockedCollateralPoolConfig.getCloseFactorBps.returns(10000)
            mockedCollateralPoolConfig.getLiquidatorIncentiveBps.returns(10250)
            mockedCollateralPoolConfig.getTreasuryFeesBps.returns(2500)
            mockedCollateralPoolConfig.getAdapter.returns(mockedCollateralTokenAdapter.address)

            mockedCollateralTokenAdapter.onMoveCollateral.returns()

            mockedBookKeeper.confiscatePosition.returns()
            mockedBookKeeper.moveCollateral.returns()
            mockedBookKeeper.moveStablecoin.returns()
            mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)
            mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(UnitHelpers.WeiPerWad), true])

            await expect(
              fixedSpreadLiquidationStrategy.execute(
                formatBytes32String("BNB"),
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad.mul(7),
                aliceAddress,
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad,
                deployerAddress,
                deployerAddress,
                "0x"
              )
            )
              .to.emit(fixedSpreadLiquidationStrategy, "LogFixedSpreadLiquidate")
              .withArgs(
                formatBytes32String("BNB"),
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad.mul(7),
                aliceAddress,
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerWad,
                deployerAddress,
                deployerAddress,
                UnitHelpers.WeiPerWad,
                UnitHelpers.WeiPerRad.mul(2),
                ethers.utils.parseEther("2.05"),
                ethers.utils.parseEther("0.0125")
              )

            expect(mockedBookKeeper.confiscatePosition).to.be.calledOnceWith(
              formatBytes32String("BNB"), 
              aliceAddress, 
              fixedSpreadLiquidationStrategy.address, 
              mockedSystemDebtEngine.address, 
              ethers.utils.parseEther("2.05").mul(-1),
              UnitHelpers.WeiPerWad.mul(-1)
            )

            //Give the collateral to the collateralRecipient
            expect(mockedBookKeeper.moveCollateral).to.be.calledWith(
              formatBytes32String("BNB"), 
              fixedSpreadLiquidationStrategy.address, 
              deployerAddress, 
              ethers.utils.parseEther("2.0375")
            )
            //Give the treasury fees to System Debt Engine to be stored as system surplus
            expect(mockedBookKeeper.moveCollateral).to.be.calledWith(
              formatBytes32String("BNB"), 
              fixedSpreadLiquidationStrategy.address, 
              mockedSystemDebtEngine.address, 
              ethers.utils.parseEther("0.0125")
            )

            expect(mockedPriceOracle.stableCoinReferencePrice).to.be.calledOnce
            expect(mockedPriceFeed.peekPrice).to.be.calledOnce
          })
        })

        context("and debtAccumulatedRate == 12345", () => {
          it("should be success", async () => {
            mockedPriceOracle.stableCoinReferencePrice.reset()
            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(12345))
            mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay)
            mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10)
            mockedCollateralPoolConfig.getCloseFactorBps.returns(5000)
            mockedCollateralPoolConfig.getLiquidatorIncentiveBps.returns(10300)
            mockedCollateralPoolConfig.getTreasuryFeesBps.returns(700)
            mockedCollateralPoolConfig.getAdapter.returns(mockedCollateralTokenAdapter.address)

            mockedCollateralTokenAdapter.onMoveCollateral.returns()

            mockedBookKeeper.confiscatePosition.returns()
            mockedBookKeeper.moveCollateral.returns()
            mockedBookKeeper.moveStablecoin.returns()
            mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)
            mockedPriceFeed.peekPrice.returns([
              formatBytes32BigNumber(UnitHelpers.WeiPerWad.mul(2)),
              true,
            ])

            await fixedSpreadLiquidationStrategy.execute(
              formatBytes32String("BNB"),
              UnitHelpers.WeiPerWad,
              UnitHelpers.WeiPerWad.mul(98765),
              aliceAddress,
              UnitHelpers.WeiPerWad.div(4),
              UnitHelpers.WeiPerWad.div(4),
              deployerAddress,
              deployerAddress,
              "0x"
            )

            expect(mockedBookKeeper.confiscatePosition).to.be.calledOnceWith(
              formatBytes32String("BNB"), 
              aliceAddress, 
              fixedSpreadLiquidationStrategy.address, 
              mockedSystemDebtEngine.address, 
              UnitHelpers.WeiPerWad.mul(-158941875).div(100000),
              UnitHelpers.WeiPerWad.mul(-25).div(100)
            )

            //Give the collateral to the collateralRecipient
            expect(mockedBookKeeper.moveCollateral).to.be.calledWith(
              formatBytes32String("BNB"), 
              fixedSpreadLiquidationStrategy.address, 
              deployerAddress, 
              ethers.utils.parseEther("1586.1781875")
            )
            //Give the treasury fees to System Debt Engine to be stored as system surplus
            expect(mockedBookKeeper.moveCollateral).to.be.calledWith(
              formatBytes32String("BNB"), 
              fixedSpreadLiquidationStrategy.address, 
              mockedSystemDebtEngine.address, 
              ethers.utils.parseEther("3.2405625")
          )

            expect(mockedPriceOracle.stableCoinReferencePrice).to.be.calledOnce
            expect(mockedPriceFeed.peekPrice).to.be.calledOnce
            expect(mockedFlashLendingCallee.flashLendingCall).to.not.be.calledOnce
          })
        })
      })
    })

    context("when contract call FlashLending", () => {
      it("should be success", async () => {
        mockedPriceOracle.stableCoinReferencePrice.reset()
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(3))
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay)
        mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10)
        mockedCollateralPoolConfig.getCloseFactorBps.returns(5000)
        mockedCollateralPoolConfig.getLiquidatorIncentiveBps.returns(10001)
        mockedCollateralPoolConfig.getTreasuryFeesBps.returns(17)
        mockedCollateralPoolConfig.getAdapter.returns(mockedCollateralTokenAdapter.address)

        mockedCollateralTokenAdapter.onMoveCollateral.returns()

        mockedBookKeeper.confiscatePosition.returns()
        mockedBookKeeper.moveCollateral.returns()
        mockedBookKeeper.moveStablecoin.returns()
        mockedPriceOracle.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)
        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(UnitHelpers.WeiPerWad), true])
        mockedFlashLendingCallee.flashLendingCall.returns()

        await fixedSpreadLiquidationStrategy.setFlashLendingEnabled(1)

        await expect(
          fixedSpreadLiquidationStrategy.execute(
            formatBytes32String("BNB"),
            UnitHelpers.WeiPerWad,
            UnitHelpers.WeiPerWad.mul(8),
            aliceAddress,
            UnitHelpers.WeiPerWad.mul(37).div(100),
            UnitHelpers.WeiPerWad.mul(37).div(100),
            deployerAddress,
            mockedFlashLendingCallee.address,
            ethers.utils.defaultAbiCoder.encode(
              ["bytes"],
              [ethers.utils.defaultAbiCoder.encode(["address"], [aliceAddress])]
            )
          )
        )
          .to.emit(fixedSpreadLiquidationStrategy, "LogFixedSpreadLiquidate")
          .withArgs(
            formatBytes32String("BNB"),
            UnitHelpers.WeiPerWad,
            UnitHelpers.WeiPerWad.mul(8),
            aliceAddress,
            UnitHelpers.WeiPerWad.mul(37).div(100),
            UnitHelpers.WeiPerWad.mul(37).div(100),
            deployerAddress,
            mockedFlashLendingCallee.address,
            UnitHelpers.WeiPerWad.mul(37).div(100),
            ethers.utils.parseEther("1.11").mul(UnitHelpers.WeiPerRay),
            ethers.utils.parseEther("1.110111"),
            ethers.utils.parseEther("0.0000001887")
          )


        expect(mockedBookKeeper.confiscatePosition).to.be.calledOnceWith(
          formatBytes32String("BNB"), 
          aliceAddress, 
          fixedSpreadLiquidationStrategy.address, 
          mockedSystemDebtEngine.address, 
          UnitHelpers.WeiPerWad.mul(-1110111).div(1000000),
          UnitHelpers.WeiPerWad.mul(-37).div(100)
        )

        //Give the collateral to the collateralRecipient
        expect(mockedBookKeeper.moveCollateral).to.be.calledWith(
          formatBytes32String("BNB"), 
          fixedSpreadLiquidationStrategy.address, 
          mockedFlashLendingCallee.address, 
          ethers.utils.parseEther("1.1101108113")
        )
        //Give the treasury fees to System Debt Engine to be stored as system surplus
        expect(mockedBookKeeper.moveCollateral).to.be.calledWith(
          formatBytes32String("BNB"), 
          fixedSpreadLiquidationStrategy.address, 
          mockedSystemDebtEngine.address, 
          ethers.utils.parseEther("0.0000001887")
        )

        expect(mockedPriceOracle.stableCoinReferencePrice).to.be.calledOnce
        expect(mockedPriceFeed.peekPrice).to.be.calledOnce
        expect(mockedFlashLendingCallee.flashLendingCall).to.be.calledOnce
      })
    })
  })
})
