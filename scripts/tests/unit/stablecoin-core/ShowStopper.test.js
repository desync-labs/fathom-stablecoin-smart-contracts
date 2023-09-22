const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay, WeiPerWad, WeiPerRad } = require("../../helper/unit")
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");
const { increase } = require("../../helper/time");

const { formatBytes32String } = ethers.utils

const WeekInSeconds = 604800;

const loadFixtureHandler = async () => {
    const mockedAccessControlConfig = await createMock("AccessControlConfig");
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    const mockedBookKeeper = await createMock("BookKeeper");
    const mockedSystemDebtEngine = await createMock("SystemDebtEngine");
    const mockedLiquidationEngine = await createMock("LiquidationEngine");
    const mockedPriceFeed = await createMock("SimplePriceFeed");
    const mockedPriceOracle = await createMock("PriceOracle");
    const mockedTokenAdapter = await createMock("TokenAdapter");

    await mockedBookKeeper.mock.totalStablecoinIssued.returns(0)
    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))

    const showStopper = getContract("ShowStopper", DeployerAddress)
    const showStopperAsAlice = getContract("ShowStopper", AliceAddress)

    await showStopper.initialize(mockedBookKeeper.address);

    return {
        showStopper,
        showStopperAsAlice,
        mockedBookKeeper,
        mockedLiquidationEngine,
        mockedSystemDebtEngine,
        mockedPriceOracle,
        mockedPriceFeed,
        mockedTokenAdapter,
        mockedAccessControlConfig,
        mockedCollateralPoolConfig
    }
}
describe("ShowStopper", () => {
  // Contracts
  let mockedBookKeeper
  let mockedLiquidationEngine
  let mockedSystemDebtEngine
  let mockedPriceOracle
  let mockedPriceFeed
  let mockedTokenAdapter
  let mockedAccessControlConfig
  let mockedCollateralPoolConfig

  let showStopper
  let showStopperAsAlice

  const setup = async () => {
    await mockedBookKeeper.mock.cage.returns()
    await mockedLiquidationEngine.mock.cage.returns()
    await mockedSystemDebtEngine.mock.cage.returns()
    await mockedPriceOracle.mock.cage.returns()

    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
    await mockedAccessControlConfig.mock.hasRole.returns(true)

    await showStopper.setBookKeeper(await mockedBookKeeper.address)
    await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
    await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
    await showStopper.setPriceOracle(mockedPriceOracle.address)
    await showStopper.cage(WeekInSeconds)

    await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
    await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)

    await mockedPriceFeed.mock.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
    await mockedPriceFeed.mock.isPriceOk.returns(true);
    await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)
    await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad);
    
    await showStopper.cagePool(formatBytes32String("XDC"))
    await mockedBookKeeper.mock.positionWhitelist.returns(BigNumber.from(0))
    await mockedBookKeeper.mock.stablecoin.returns(0)

  }

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ({
        showStopper,
        showStopperAsAlice,
        mockedBookKeeper,
        mockedLiquidationEngine,
        mockedSystemDebtEngine,
        mockedPriceOracle,
        mockedPriceFeed,
        mockedTokenAdapter,
        mockedAccessControlConfig,
        mockedCollateralPoolConfig
      } = await loadFixture(loadFixtureHandler))

  })

  describe("#cage()", () => {
    context("when setting collateral pool is inactive", () => {
      it("should be success", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        expect(await showStopper.live()).to.be.equal(1)

        await mockedBookKeeper.mock.cage.returns()
        await mockedLiquidationEngine.mock.cage.returns()
        await mockedSystemDebtEngine.mock.cage.returns()
        await mockedPriceOracle.mock.cage.returns()

        await showStopper.setBookKeeper(await mockedBookKeeper.address)
        await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
        await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
        await showStopper.setPriceOracle(mockedPriceOracle.address)

        await expect(showStopper.cage(WeekInSeconds)).to.emit(showStopper, "LogCage(uint256)").withArgs(WeekInSeconds)

        expect(await showStopper.live()).to.be.equal(0)
      })
    })

    context("invalid cooldown time", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        // less than 1 week
        await expect(showStopper.cage(WeekInSeconds-1)).to.be.revertedWith("ShowStopper/invalid-cool-down")

        // more than three months
        await expect(showStopper.cage(7862401)).to.be.revertedWith("ShowStopper/invalid-cool-down")
      })
    })

    context("when user does not have authorized", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        expect(await showStopper.live()).to.be.equal(1)

        await mockedBookKeeper.mock.cage.returns()
        await mockedLiquidationEngine.mock.cage.returns()
        await mockedSystemDebtEngine.mock.cage.returns()
        await mockedPriceOracle.mock.cage.returns()

        await showStopper.setBookKeeper(await mockedBookKeeper.address)
        await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
        await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
        await showStopper.setPriceOracle(mockedPriceOracle.address)

        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(showStopperAsAlice.cage(WeekInSeconds)).to.be.revertedWith("!ownerRole")
      })
    })
  })

  describe("#cage(collateralPoolId)", () => {
    context("when setting collateral pool is inactive", () => {
      context("pool is inactive", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)
          await mockedPriceFeed.mock.isPriceOk.returns(true);

          expect(await showStopper.live()).to.be.equal(1)

          await mockedBookKeeper.mock.cage.returns()
          await mockedLiquidationEngine.mock.cage.returns()
          await mockedSystemDebtEngine.mock.cage.returns()
          await mockedPriceOracle.mock.cage.returns()
          await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad);

          await showStopper.setBookKeeper(await mockedBookKeeper.address)
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
          await showStopper.setPriceOracle(mockedPriceOracle.address)
          await showStopper.cage(WeekInSeconds)

          await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
          await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)

          await mockedPriceFeed.mock.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
          await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)

          await expect(showStopper.cagePool(formatBytes32String("XDC")))
            .to.emit(showStopper, "LogCageCollateralPool(bytes32)")
            .withArgs(formatBytes32String("XDC"))

          expect(await showStopper.live()).to.be.equal(0)
        })
      })

      context("pool is active", () => {
        it("should revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)
          await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad);

          await expect(showStopper.cagePool(formatBytes32String("XDC"))).to.be.revertedWith(
            "ShowStopper/still-live"
          )
        })
      })

      context("priceFeed's isPriceOk is false", () => {
        it("should be revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await showStopper.live()).to.be.equal(1)

          await mockedBookKeeper.mock.cage.returns()
          await mockedLiquidationEngine.mock.cage.returns()
          await mockedSystemDebtEngine.mock.cage.returns()
          await mockedPriceOracle.mock.cage.returns()

          await showStopper.setBookKeeper(await mockedBookKeeper.address)
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
          await showStopper.setPriceOracle(mockedPriceOracle.address)
          await showStopper.cage(WeekInSeconds)

          await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
          await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)

          await mockedPriceFeed.mock.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
          await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)
          await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad);
          await mockedPriceFeed.mock.isPriceOk.returns(false);

          await expect(showStopper.cagePool(formatBytes32String("XDC"))).to.be.revertedWith(
            "ShowStopper/price-not-ok"
          )

          expect(await showStopper.live()).to.be.equal(0)
        })
      })

      context("cage price is already defined", () => {
        it("should be revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)
          await mockedPriceFeed.mock.isPriceOk.returns(true);

          expect(await showStopper.live()).to.be.equal(1)

          await mockedBookKeeper.mock.cage.returns()
          await mockedLiquidationEngine.mock.cage.returns()
          await mockedSystemDebtEngine.mock.cage.returns()
          await mockedPriceOracle.mock.cage.returns()

          await showStopper.setBookKeeper(await mockedBookKeeper.address)
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
          await showStopper.setPriceOracle(mockedPriceOracle.address)
          await showStopper.cage(WeekInSeconds)

          await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
          await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)

          await mockedPriceFeed.mock.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
          await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)
          await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad);

          await showStopper.cagePool(formatBytes32String("XDC"))

          await expect(showStopper.cagePool(formatBytes32String("XDC"))).to.be.revertedWith(
            "ShowStopper/cage-price-collateral-pool-id-already-defined"
          )

          expect(await showStopper.live()).to.be.equal(0)
        })
      })
    })
  })

  describe("#redeemLockedCollateral", () => {
    context("when setting collateral pool is active", () => {
      context("pool is inactive", () => {
        context("and debtShare is more than 0", () => {
          it("should revert", async () => {
            await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
            await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
            await mockedAccessControlConfig.mock.hasRole.returns(true)

            await setup()

            await mockedBookKeeper.mock.positions.returns(WeiPerRay, BigNumber.from("1"))

            await expect(
              showStopper.redeemLockedCollateral(
                formatBytes32String("XDC"),
                DeployerAddress,
                DeployerAddress,
                "0x"
              )
            ).to.be.revertedWith("ShowStopper/debtShare-not-zero")
          })
        })

        context("and lockedCollateral is overflow (> MaxInt256)", () => {
           it("should revert", async () => {
            await setup()

            await mockedBookKeeper.mock.positions.returns(ethers.constants.MaxUint256, BigNumber.from("0"))

            await expect(
              showStopper.redeemLockedCollateral(
                formatBytes32String("XDC"),
                DeployerAddress,
                DeployerAddress,
                "0x"
              )
            ).to.be.revertedWith("ShowStopper/overflow")
          })
        })

        context("when the caller has no access to the position", () => {
           it("should revert", async () => {
            await setup()

            await mockedBookKeeper.mock.positions.returns(WeiPerRay, BigNumber.from("0"))
            await expect(
              showStopperAsAlice.redeemLockedCollateral(
                formatBytes32String("XDC"),
                DeployerAddress,
                DeployerAddress,
                "0x"
              )
            ).to.be.revertedWith("ShowStopper/not-allowed")
          })
        })

        context("and debtShare is 0 and lockedCollateral is 1 ray", () => {
           it("should be success", async () => {
            await setup()

            await mockedBookKeeper.mock.positions.withArgs(
              formatBytes32String("XDC"),
              DeployerAddress
            ).returns(WeiPerRay, BigNumber.from("0"))
            await mockedBookKeeper.mock.confiscatePosition.withArgs(
              formatBytes32String("XDC"),
              DeployerAddress,
              DeployerAddress,
              mockedSystemDebtEngine.address,
              WeiPerRay.mul("-1"),
              0
            ).returns()

            await expect(
              showStopper.redeemLockedCollateral(
                formatBytes32String("XDC"),
                DeployerAddress,
                DeployerAddress,
                "0x"
              )
            )
              .to.emit(showStopper, "LogRedeemLockedCollateral")
              .withArgs(formatBytes32String("XDC"), DeployerAddress, WeiPerRay)
          })
        })

        context(
          "and debtShare is 0 and lockedCollateral is 1 ray, but the caller does not have access to the position",
          () => {
             it("should be success", async () => {
              await setup()

              await mockedBookKeeper.mock.positions.returns(WeiPerRay, BigNumber.from("0"))
              await mockedBookKeeper.mock.confiscatePosition.returns()

              await expect(
                showStopperAsAlice.redeemLockedCollateral(
                  formatBytes32String("XDC"),
                  DeployerAddress,
                  DeployerAddress,
                  "0x"
                )
              ).to.be.revertedWith("ShowStopper/not-allowed")
            })
          }
        )

        context(
          "and debtShare is 0 and lockedCollateral is 1 ray, the caller is not the owner of the address but has access to",
          () => {
             it("should be success", async () => {
              await setup()

              await mockedAccessControlConfig.mock.hasRole.returns(false)

              await mockedBookKeeper.mock.positions.returns(WeiPerRay, BigNumber.from("0"))
              await mockedBookKeeper.mock.positionWhitelist.returns(BigNumber.from(1))
              await mockedBookKeeper.mock.confiscatePosition.returns()

              await mockedBookKeeper.mock.positions.withArgs(
                formatBytes32String("XDC"),
                AliceAddress
              ).returns(WeiPerRay, BigNumber.from("0"))
              await mockedBookKeeper.mock.confiscatePosition.withArgs(
                formatBytes32String("XDC"),
                AliceAddress,
                AliceAddress,
                mockedSystemDebtEngine.address,
                WeiPerRay.mul("-1"),
                0
              ).returns()

              await expect(
                showStopper.redeemLockedCollateral(
                  formatBytes32String("XDC"),
                  AliceAddress,
                  AliceAddress,
                  "0x"
                )
              )
                .to.emit(showStopper, "LogRedeemLockedCollateral")
                .withArgs(formatBytes32String("XDC"), AliceAddress, WeiPerRay)
            })
          }
        )
      })

      context("pool is active", () => {
         it("should revert", async () => {
          await expect(
            showStopper.redeemLockedCollateral(
              formatBytes32String("XDC"),
              DeployerAddress,
              DeployerAddress,
              "0x"
            )
          ).to.be.revertedWith("ShowStopper/still-live")
        })
      })
    })
  })

  describe("#finalizeDebt", () => {
    context("when calculate debt", () => {
      context("pool is inactive", () => {
        context("debt is not 0", () => {
          it("should revert", async () => {
            await setup()

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)

            await increase(WeekInSeconds);
            await showStopper.finalizeDebt()

            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/debt-not-zero")
          })
        })

        context("stablecoin is not 0", () => {
          it("should revert", async () => {
            await setup()

            await mockedBookKeeper.mock.stablecoin.returns(WeiPerRay)

            await increase(WeekInSeconds);
            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/surplus-not-zero")
          })
        })

        context("debt is 0 and stablecoin is 0", () => {
          it("should be sucess", async () => {
            await setup()

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await mockedBookKeeper.mock.stablecoin.returns(BigNumber.from("0"))


            await increase(WeekInSeconds);
            await expect(showStopper.finalizeDebt()).to.emit(showStopper, "LogFinalizeDebt").withArgs()
          })
        })
      })

      context("pool is active", () => {
        it("should revert", async () => {
          await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/still-live")
        })
      })
    })
  })

  describe("#finalizeCashPrice", () => {
    context("when calculate cash price", () => {
      context("debt is 0", () => {
        it("should revert", async () => {
          await expect(showStopper.finalizeCashPrice(formatBytes32String("XDC"))).to.be.revertedWith(
            "ShowStopper/debt-zero"
          )
        })
      })

      context("cash price is already defined", () => {
        it("should revert", async () => {
          await setup()
          await increase(WeekInSeconds);

          await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
          await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)
          await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
          await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad.mul(100))

          await showStopper.finalizeCashPrice(formatBytes32String("XDC"))

          await expect(showStopper.finalizeCashPrice(formatBytes32String("XDC"))).to.be.revertedWith(
            "ShowStopper/final-cash-price-collateral-pool-id-already-defined"
          )
        })
      })

      context("cash price is 1 ray", () => {
        it("should be success", async () => {
          await setup()
          await increase(WeekInSeconds);

          await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
          await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad.mul(100))

          await expect(showStopper.finalizeCashPrice(formatBytes32String("XDC")))
            .to.emit(showStopper, "LogFinalizeCashPrice")
            .withArgs(formatBytes32String("XDC"))
        })
      })
    })
  })

  describe("#accumulateStablecoin", () => {
    context("when moving stable coin", () => {
      context("debt is 0", () => {
        it("should revert", async () => {
          await expect(showStopper.accumulateStablecoin(WeiPerRay)).to.be.revertedWith(
            "ShowStopper/debt-zero"
          )
        })
      })

      context("debt is not 0", () => {
        it("should be success", async () => {
          await setup()
          await increase(WeekInSeconds);

          await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          await mockedBookKeeper.mock.moveStablecoin.returns()

          await expect(showStopper.accumulateStablecoin(WeiPerWad))
            .to.emit(showStopper, "LogAccumulateStablecoin")
            .withArgs(DeployerAddress, WeiPerWad)
        })
      })
    })
  })

  describe("#redeemStablecoin", () => {
    context("when calculate cash", () => {
      context("cash price is not defined", () => {
        it("should revert", async () => {
          await expect(
            showStopper.redeemStablecoin(formatBytes32String("XDC"), WeiPerWad)
          ).to.be.revertedWith("ShowStopper/final-cash-price-collateral-pool-id-not-defined")
        })
      })

      context("cash price is already defined", () => {
        context("and stablecoinAccumulator balance < withdraw", () => {
          it("should revert", async () => {
            await setup()
            await increase(WeekInSeconds);

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
            await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad.mul(100))

            await showStopper.finalizeCashPrice(formatBytes32String("XDC"))

            await mockedBookKeeper.mock.moveCollateral.returns()

            await expect(
              showStopper.redeemStablecoin(formatBytes32String("XDC"), WeiPerWad)
            ).to.be.revertedWith("ShowStopper/insufficient-stablecoin-accumulator-balance")
          })
        })

        context("and stablecoinAccumulator balance = withdraw", () => {
          it("should be success", async () => {
            await setup()
            await increase(WeekInSeconds);

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
            await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad.mul(100))

            await showStopper.finalizeCashPrice(formatBytes32String("XDC"))
            await mockedBookKeeper.mock.moveStablecoin.returns()
            await showStopper.accumulateStablecoin(WeiPerWad)

            // await mockedBookKeeper.mock.moveCollateral.withArgs(
            //   formatBytes32String("XDC"),
            //   showStopper.address,
            //   DeployerAddress,
            //   WeiPerWad
            // ).returns()

            //waffle has some issue dealing with mock function with args that does not return value
            await mockedBookKeeper.mock.moveCollateral.returns()

            await expect(showStopper.redeemStablecoin(formatBytes32String("XDC"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("XDC"), DeployerAddress, WeiPerWad)
          })
        })

        context("and stablecoinAccumulator balance > withdraw", () => {
          it("should be success", async () => {
            await setup()
            await increase(WeekInSeconds);

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
            await mockedBookKeeper.mock.poolStablecoinIssued.returns(WeiPerRad.mul(100))

            await showStopper.finalizeCashPrice(formatBytes32String("XDC"))
            
            await mockedBookKeeper.mock.moveStablecoin.returns()
            await showStopper.accumulateStablecoin(WeiPerWad.mul(2))
            // await mockedBookKeeper.mock.moveCollateral.withArgs(
            //   formatBytes32String("XDC"),
            //   showStopper.address,
            //   DeployerAddress,
            //   WeiPerRad
            // ).returns()
            
            //waffle has some issue dealing with mock function with args that does not return value
            await mockedBookKeeper.mock.moveCollateral.returns()

            await expect(showStopper.redeemStablecoin(formatBytes32String("XDC"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("XDC"), DeployerAddress, WeiPerWad)
          })
        })
      })
    })
  })

  describe("#setBookKeeper", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(showStopperAsAlice.setBookKeeper(await mockedBookKeeper.address)).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await setup()

          await expect(showStopper.setBookKeeper(await mockedBookKeeper.address)).to.be.revertedWith("ShowStopper/not-live")
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setBookKeeper", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setBookKeeper(await mockedBookKeeper.address))
            .to.emit(showStopper, "LogSetBookKeeper")
            .withArgs(DeployerAddress, await mockedBookKeeper.address)
        })
      })
    })
  })

  describe("#setLiquidationEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(showStopperAsAlice.setLiquidationEngine(mockedLiquidationEngine.address)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await setup()

          await expect(showStopper.setLiquidationEngine(mockedLiquidationEngine.address)).to.be.revertedWith(
            "ShowStopper/not-live"
          )
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setLiquidationEngine", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setLiquidationEngine(mockedLiquidationEngine.address))
            .to.emit(showStopper, "LogSetLiquidationEngine")
            .withArgs(DeployerAddress, mockedLiquidationEngine.address)
        })
      })
    })
  })

  describe("#setSystemDebtEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(showStopperAsAlice.setSystemDebtEngine(mockedSystemDebtEngine.address)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await setup()

          await expect(showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)).to.be.revertedWith(
            "ShowStopper/not-live"
          )
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setSystemDebtEngine", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address))
            .to.emit(showStopper, "LogSetSystemDebtEngine")
            .withArgs(DeployerAddress, mockedSystemDebtEngine.address)
        })
      })
    })
  })

  describe("#setPriceOracle", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(showStopperAsAlice.setPriceOracle(mockedPriceOracle.address)).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await setup()

          await expect(showStopper.setPriceOracle(mockedPriceOracle.address)).to.be.revertedWith("ShowStopper/not-live")
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setPriceOracle", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setPriceOracle(mockedPriceOracle.address))
            .to.emit(showStopper, "LogSetPriceOracle")
            .withArgs(DeployerAddress, mockedPriceOracle.address)
        })
      })
    })
  })
})
