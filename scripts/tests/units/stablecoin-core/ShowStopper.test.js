const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay, WeiPerWad } = require("../../helper/unit")
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");

const { formatBytes32String } = ethers.utils

const loadFixtureHandler = async () => {
    const mockedAccessControlConfig = await createMock("AccessControlConfig");
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    const mockedBookKeeper = await createMock("BookKeeper");
    const mockedSystemDebtEngine = await createMock("SystemDebtEngine");
    const mockedLiquidationEngine = await createMock("LiquidationEngine");
    const mockedPriceFeed = await createMock("MockPriceFeed");
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
    await showStopper.cage()

    await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
    await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)

    await mockedPriceFeed.mock.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
    await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)
    await showStopper.cagePool(formatBytes32String("WXDC"))
    await mockedBookKeeper.mock.positionWhitelist.returns(BigNumber.from(0))
    await mockedTokenAdapter.mock.onMoveCollateral.returns();
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

        await expect(showStopper.cage()).to.emit(showStopper, "LogCage()").withArgs()

        expect(await showStopper.live()).to.be.equal(0)
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
        await expect(showStopperAsAlice.cage()).to.be.revertedWith("!ownerRole")
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

          expect(await showStopper.live()).to.be.equal(1)

          await mockedBookKeeper.mock.cage.returns()
          await mockedLiquidationEngine.mock.cage.returns()
          await mockedSystemDebtEngine.mock.cage.returns()
          await mockedPriceOracle.mock.cage.returns()

          await showStopper.setBookKeeper(await mockedBookKeeper.address)
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
          await showStopper.setPriceOracle(mockedPriceOracle.address)
          await showStopper.cage()

          await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
          await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)

          await mockedPriceFeed.mock.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
          await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)

          await expect(showStopper.cagePool(formatBytes32String("WXDC")))
            .to.emit(showStopper, "LogCageCollateralPool(bytes32)")
            .withArgs(formatBytes32String("WXDC"))

          expect(await showStopper.live()).to.be.equal(0)
        })
      })

      context("pool is active", () => {
        it("should revert", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await expect(showStopper.cagePool(formatBytes32String("WXDC"))).to.be.revertedWith(
            "ShowStopper/still-live"
          )
        })
      })

      context("cage price is already defined", () => {
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
          await showStopper.cage()

          await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
          await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)

          await mockedPriceFeed.mock.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
          await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)

          await showStopper.cagePool(formatBytes32String("WXDC"))

          await expect(showStopper.cagePool(formatBytes32String("WXDC"))).to.be.revertedWith(
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
                formatBytes32String("WXDC"),
                mockedTokenAdapter.address,
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
                formatBytes32String("WXDC"),
                mockedTokenAdapter.address,
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
                formatBytes32String("WXDC"),
                mockedTokenAdapter.address,
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
              formatBytes32String("WXDC"),
              DeployerAddress
            ).returns(WeiPerRay, BigNumber.from("0"))
            await mockedBookKeeper.mock.confiscatePosition.withArgs(
              formatBytes32String("WXDC"),
              DeployerAddress,
              DeployerAddress,
              mockedSystemDebtEngine.address,
              WeiPerRay.mul("-1"),
              0
            ).returns()

            await expect(
              showStopper.redeemLockedCollateral(
                formatBytes32String("WXDC"),
                mockedTokenAdapter.address,
                DeployerAddress,
                DeployerAddress,
                "0x"
              )
            )
              .to.emit(showStopper, "LogRedeemLockedCollateral")
              .withArgs(formatBytes32String("WXDC"), DeployerAddress, WeiPerRay)
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
                  formatBytes32String("WXDC"),
                  mockedTokenAdapter.address,
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
                formatBytes32String("WXDC"),
                AliceAddress
              ).returns(WeiPerRay, BigNumber.from("0"))
              await mockedBookKeeper.mock.confiscatePosition.withArgs(
                formatBytes32String("WXDC"),
                AliceAddress,
                AliceAddress,
                mockedSystemDebtEngine.address,
                WeiPerRay.mul("-1"),
                0
              ).returns()

              await expect(
                showStopper.redeemLockedCollateral(
                  formatBytes32String("WXDC"),
                  mockedTokenAdapter.address,
                  AliceAddress,
                  AliceAddress,
                  "0x"
                )
              )
                .to.emit(showStopper, "LogRedeemLockedCollateral")
                .withArgs(formatBytes32String("WXDC"), AliceAddress, WeiPerRay)
            })
          }
        )
      })

      context("pool is active", () => {
        it("should revert", async () => {
          await expect(
            showStopper.redeemLockedCollateral(
              formatBytes32String("WXDC"),
              mockedTokenAdapter.address,
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
            await showStopper.finalizeDebt()

            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/debt-not-zero")
          })
        })

        context("stablecoin is not 0", () => {
          it("should revert", async () => {
            await setup()

            await mockedBookKeeper.mock.stablecoin.returns(WeiPerRay)

            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/surplus-not-zero")
          })
        })

        context("debt is 0 and stablecoin is 0", () => {
          it("should be sucess", async () => {
            await setup()

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await mockedBookKeeper.mock.stablecoin.returns(BigNumber.from("0"))

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
          await expect(showStopper.finalizeCashPrice(formatBytes32String("WXDC"))).to.be.revertedWith(
            "ShowStopper/debt-zero"
          )
        })
      })

      context("cash price is already defined", () => {
        it("should revert", async () => {
          await setup()

          await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)
          await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad)
          await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerWad)

          await showStopper.finalizeCashPrice(formatBytes32String("WXDC"))

          await expect(showStopper.finalizeCashPrice(formatBytes32String("WXDC"))).to.be.revertedWith(
            "ShowStopper/final-cash-price-collateral-pool-id-already-defined"
          )
        })
      })

      context("cash price is 1 ray", () => {
        it("should be success", async () => {
          await setup()

          await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerWad)

          await expect(showStopper.finalizeCashPrice(formatBytes32String("WXDC")))
            .to.emit(showStopper, "LogFinalizeCashPrice")
            .withArgs(formatBytes32String("WXDC"))
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
            showStopper.redeemStablecoin(formatBytes32String("WXDC"), WeiPerWad)
          ).to.be.revertedWith("ShowStopper/final-cash-price-collateral-pool-id-not-defined")
        })
      })

      context("cash price is already defined", () => {
        context("and stablecoinAccumulator balance < withdraw", () => {
          it("should revert", async () => {
            await setup()

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerWad)

            await showStopper.finalizeCashPrice(formatBytes32String("WXDC"))

            await mockedBookKeeper.mock.moveCollateral.returns()

            await expect(
              showStopper.redeemStablecoin(formatBytes32String("WXDC"), WeiPerWad)
            ).to.be.revertedWith("ShowStopper/insufficient-stablecoin-accumulator-balance")
          })
        })

        context("and stablecoinAccumulator balance = withdraw", () => {
          it("should be success", async () => {
            await setup()

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerWad)

            await showStopper.finalizeCashPrice(formatBytes32String("WXDC"))
            await mockedBookKeeper.mock.moveStablecoin.returns()
            await showStopper.accumulateStablecoin(WeiPerWad)

            await mockedBookKeeper.mock.moveCollateral.withArgs(
              formatBytes32String("WXDC"),
              showStopper.address,
              DeployerAddress,
              WeiPerRay
            ).returns()

            await expect(showStopper.redeemStablecoin(formatBytes32String("WXDC"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("WXDC"), DeployerAddress, WeiPerWad)
          })
        })

        context("and stablecoinAccumulator balance > withdraw", () => {
          it("should be success", async () => {
            await setup()

            await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerWad)

            await showStopper.finalizeCashPrice(formatBytes32String("WXDC"))
            
            await mockedBookKeeper.mock.moveStablecoin.returns()
            await showStopper.accumulateStablecoin(WeiPerWad.mul(2))
            await mockedBookKeeper.mock.moveCollateral.withArgs(
              formatBytes32String("WXDC"),
              showStopper.address,
              DeployerAddress,
              WeiPerRay
            ).returns()

            await expect(showStopper.redeemStablecoin(formatBytes32String("WXDC"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("WXDC"), DeployerAddress, WeiPerWad)
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
