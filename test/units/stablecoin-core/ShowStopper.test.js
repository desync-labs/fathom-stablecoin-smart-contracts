require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay, WeiPerWad } = require("../../helper/unit")

const { formatBytes32String } = ethers.utils

const expect = chai.expect;
chai.use(smock.matchers);

describe("ShowStopper", () => {
  // Accounts
  let deployer
  let alice
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let devAddress

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

  async function loadFixtureHandler() {
    const [deployer] = await ethers.getSigners()
  
    const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    const mockedBookKeeper = await smock.fake("BookKeeper");
    const mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");
    const mockedLiquidationEngine = await smock.fake("LiquidationEngine");
    const mockedPriceFeed = await smock.fake("MockPriceFeed");
    const mockedPriceOracle = await smock.fake("PriceOracle");
    const mockedTokenAdapter = await smock.fake("TokenAdapter");
  
    // Deploy ShowStopper
    const ShowStopper = (await ethers.getContractFactory("ShowStopper", deployer))
    const showStopper = (await upgrades.deployProxy(ShowStopper, [mockedBookKeeper.address]))
    await showStopper.deployed()
  
    return {
      showStopper,
      mockedBookKeeper,
      mockedLiquidationEngine,
      mockedSystemDebtEngine,
      mockedPriceOracle,
      mockedPriceFeed,
      mockedTokenAdapter,
      mockedAccessControlConfig,
      mockedCollateralPoolConfig,
    }
  }

  const setup = async () => {
    mockedBookKeeper.cage.returns()
    mockedLiquidationEngine.cage.returns()
    mockedSystemDebtEngine.cage.returns()
    mockedPriceOracle.cage.returns()
   
    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
    mockedAccessControlConfig.hasRole.returns(true)

    await showStopper.setBookKeeper(mockedBookKeeper.address)
    await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
    await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
    await showStopper.setPriceOracle(mockedPriceOracle.address)
    await showStopper["cage()"]()

    mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address)
    mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad)

    mockedPriceFeed.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
    mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay)
    await showStopper["cage(bytes32)"](formatBytes32String("BNB"))
  }

  beforeEach(async () => {
    ;({
      showStopper,
      mockedBookKeeper,
      mockedLiquidationEngine,
      mockedSystemDebtEngine,
      mockedPriceOracle,
      mockedPriceFeed,
      mockedTokenAdapter,
      mockedAccessControlConfig,
      mockedCollateralPoolConfig,
    } = await loadFixtureHandler())
    ;[deployer, alice, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      dev.getAddress(),
    ])

    showStopperAsAlice = showStopper.connect(alice)
  })

  describe("#cage()", () => {
    context("when setting collateral pool is inactive", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        expect(await showStopper.live()).to.be.equal(1)

        mockedBookKeeper.cage.returns()
        mockedLiquidationEngine.cage.returns()
        mockedSystemDebtEngine.cage.returns()
        mockedPriceOracle.cage.returns()

        await showStopper.setBookKeeper(mockedBookKeeper.address)
        await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
        await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
        await showStopper.setPriceOracle(mockedPriceOracle.address)

        await expect(showStopper["cage()"]()).to.emit(showStopper, "LogCage()").withArgs()

        expect(await showStopper.live()).to.be.equal(0)
      })
    })

    context("when user does not have authorized", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        expect(await showStopper.live()).to.be.equal(1)

        mockedBookKeeper.cage.returns()
        mockedLiquidationEngine.cage.returns()
        mockedSystemDebtEngine.cage.returns()
        mockedPriceOracle.cage.returns()

        await showStopper.setBookKeeper(mockedBookKeeper.address)
        await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
        await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
        await showStopper.setPriceOracle(mockedPriceOracle.address)

        mockedAccessControlConfig.hasRole.returns(false)
        await expect(showStopperAsAlice["cage()"]()).to.be.revertedWith("!ownerRole")
      })
    })
  })

  describe("#cage(collateralPoolId)", () => {
    context("when setting collateral pool is inactive", () => {
      context("pool is inactive", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await showStopper.live()).to.be.equal(1)

          mockedBookKeeper.cage.returns()
          mockedLiquidationEngine.cage.returns()
          mockedSystemDebtEngine.cage.returns()
          mockedPriceOracle.cage.returns()

          await showStopper.setBookKeeper(mockedBookKeeper.address)
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
          await showStopper.setPriceOracle(mockedPriceOracle.address)
          await showStopper["cage()"]()

          mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address)
          mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad)

          mockedPriceFeed.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
          mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay)

          await expect(showStopper["cage(bytes32)"](formatBytes32String("BNB")))
            .to.emit(showStopper, "LogCageCollateralPool(bytes32)")
            .withArgs(formatBytes32String("BNB"))

          expect(await showStopper.live()).to.be.equal(0)
        })
      })

      context("pool is active", () => {
        it("should revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await expect(showStopper["cage(bytes32)"](formatBytes32String("BNB"))).to.be.revertedWith(
            "ShowStopper/still-live"
          )
        })
      })

      context("cage price is already defined", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await showStopper.live()).to.be.equal(1)

          mockedBookKeeper.cage.returns()
          mockedLiquidationEngine.cage.returns()
          mockedSystemDebtEngine.cage.returns()
          mockedPriceOracle.cage.returns()

          await showStopper.setBookKeeper(mockedBookKeeper.address)
          await showStopper.setLiquidationEngine(mockedLiquidationEngine.address)
          await showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)
          await showStopper.setPriceOracle(mockedPriceOracle.address)
          await showStopper["cage()"]()

          mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address)
          mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad)

          mockedPriceFeed.readPrice.returns(formatBytes32BigNumber(WeiPerWad))
          mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay)

          await showStopper["cage(bytes32)"](formatBytes32String("BNB"))

          await expect(showStopper["cage(bytes32)"](formatBytes32String("BNB"))).to.be.revertedWith(
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
            mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
            mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
            mockedAccessControlConfig.hasRole.returns(true)

            await setup()

            mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("1")])

            await expect(
              showStopper.redeemLockedCollateral(
                formatBytes32String("BNB"),
                mockedTokenAdapter.address,
                deployerAddress,
                deployerAddress,
                "0x"
              )
            ).to.be.revertedWith("ShowStopper/debtShare-not-zero")
          })
        })

        context("and lockedCollateral is overflow (> MaxInt256)", () => {
          it("should revert", async () => {
            await setup()

            mockedBookKeeper.positions.returns([ethers.constants.MaxUint256, BigNumber.from("0")])

            await expect(
              showStopper.redeemLockedCollateral(
                formatBytes32String("BNB"),
                mockedTokenAdapter.address,
                deployerAddress,
                deployerAddress,
                "0x"
              )
            ).to.be.revertedWith("ShowStopper/overflow")
          })
        })

        context("when the caller has no access to the position", () => {
          it("should revert", async () => {
            await setup()

            mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("0")])
            await expect(
              showStopperAsAlice.redeemLockedCollateral(
                formatBytes32String("BNB"),
                mockedTokenAdapter.address,
                deployerAddress,
                deployerAddress,
                "0x"
              )
            ).to.be.revertedWith("ShowStopper/not-allowed")
          })
        })

        context("and debtShare is 0 and lockedCollateral is 1 ray", () => {
          it("should be success", async () => {
            await setup()

            mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("0")])
            mockedBookKeeper.confiscatePosition.returns()

            await expect(
              showStopper.redeemLockedCollateral(
                formatBytes32String("BNB"),
                mockedTokenAdapter.address,
                deployerAddress,
                deployerAddress,
                "0x"
              )
            )
              .to.emit(showStopper, "LogRedeemLockedCollateral")
              .withArgs(formatBytes32String("BNB"), deployerAddress, WeiPerRay)

            expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), deployerAddress)
            expect(mockedBookKeeper.confiscatePosition).to.be.calledOnceWith(formatBytes32String("BNB"), deployerAddress, deployerAddress, mockedSystemDebtEngine.address, WeiPerRay.mul("-1"), 0)
          })
        })

        context(
          "and debtShare is 0 and lockedCollateral is 1 ray, but the caller does not have access to the position",
          () => {
            it("should be success", async () => {
              await setup()

              mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("0")])
              mockedBookKeeper.confiscatePosition.returns()

              await expect(
                showStopperAsAlice.redeemLockedCollateral(
                  formatBytes32String("BNB"),
                  mockedTokenAdapter.address,
                  deployerAddress,
                  deployerAddress,
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

              mockedAccessControlConfig.hasRole.returns(false)

              mockedBookKeeper.positions.returns([WeiPerRay, BigNumber.from("0")])
              mockedBookKeeper.positionWhitelist.returns(BigNumber.from(1))
              mockedBookKeeper.confiscatePosition.returns()

              await expect(
                showStopper.redeemLockedCollateral(
                  formatBytes32String("BNB"),
                  mockedTokenAdapter.address,
                  aliceAddress,
                  aliceAddress,
                  "0x"
                )
              )
                .to.emit(showStopper, "LogRedeemLockedCollateral")
                .withArgs(formatBytes32String("BNB"), aliceAddress, WeiPerRay)

              expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), aliceAddress)
              expect(mockedBookKeeper.confiscatePosition).to.be.calledOnceWith(formatBytes32String("BNB"), aliceAddress, aliceAddress, mockedSystemDebtEngine.address, WeiPerRay.mul("-1"), 0)
            })
          }
        )
      })

      context("pool is active", () => {
        it("should revert", async () => {
          await expect(
            showStopper.redeemLockedCollateral(
              formatBytes32String("BNB"),
              mockedTokenAdapter.address,
              deployerAddress,
              deployerAddress,
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

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/debt-not-zero")
          })
        })

        context("stablecoin is not 0", () => {
          it("should revert", async () => {
            await setup()

            mockedBookKeeper.stablecoin.returns(WeiPerRay)

            await expect(showStopper.finalizeDebt()).to.be.revertedWith("ShowStopper/surplus-not-zero")
          })
        })

        context("debt is 0 and stablecoin is 0", () => {
          it("should be sucess", async () => {
            await setup()

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
            mockedBookKeeper.stablecoin.returns(BigNumber.from("0"))

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
          await expect(showStopper.finalizeCashPrice(formatBytes32String("BNB"))).to.be.revertedWith(
            "ShowStopper/debt-zero"
          )
        })
      })

      context("cash price is already defined", () => {
        it("should revert", async () => {
          await setup()

          mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address)
          mockedCollateralPoolConfig.getTotalDebtShare.returns(WeiPerWad)
          mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerWad)

          await showStopper.finalizeCashPrice(formatBytes32String("BNB"))

          await expect(showStopper.finalizeCashPrice(formatBytes32String("BNB"))).to.be.revertedWith(
            "ShowStopper/final-cash-price-collateral-pool-id-already-defined"
          )
        })
      })

      context("cash price is 1 ray", () => {
        it("should be success", async () => {
          await setup()

          mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerWad)

          await expect(showStopper.finalizeCashPrice(formatBytes32String("BNB")))
            .to.emit(showStopper, "LogFinalizeCashPrice")
            .withArgs(formatBytes32String("BNB"))
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

          mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
          await showStopper.finalizeDebt()

          mockedBookKeeper.moveStablecoin.returns()

          await expect(showStopper.accumulateStablecoin(WeiPerWad))
            .to.emit(showStopper, "LogAccumulateStablecoin")
            .withArgs(deployerAddress, WeiPerWad)
        })
      })
    })
  })

  describe("#redeemStablecoin", () => {
    context("when calculate cash", () => {
      context("cash price is not defined", () => {
        it("should revert", async () => {
          await expect(
            showStopper.redeemStablecoin(formatBytes32String("BNB"), WeiPerWad)
          ).to.be.revertedWith("ShowStopper/final-cash-price-collateral-pool-id-not-defined")
        })
      })

      context("cash price is already defined", () => {
        context("and stablecoinAccumulator balance < withdraw", () => {
          it("should revert", async () => {
            await setup()

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerWad)

            await showStopper.finalizeCashPrice(formatBytes32String("BNB"))

            mockedBookKeeper.moveStablecoin.returns()

            await expect(
              showStopper.redeemStablecoin(formatBytes32String("BNB"), WeiPerWad)
            ).to.be.revertedWith("ShowStopper/insufficient-stablecoin-accumulator-balance")
          })
        })

        context("and stablecoinAccumulator balance = withdraw", () => {
          it("should be success", async () => {
            await setup()

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerWad)

            await showStopper.finalizeCashPrice(formatBytes32String("BNB"))

            await showStopper.accumulateStablecoin(WeiPerWad)

            mockedBookKeeper.moveCollateral.returns()

            await expect(showStopper.redeemStablecoin(formatBytes32String("BNB"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("BNB"), deployerAddress, WeiPerWad)

            expect(mockedBookKeeper.moveCollateral).to.be.calledOnceWith(formatBytes32String("BNB"), showStopper.address, deployerAddress, WeiPerRay)
          })
        })

        context("and stablecoinAccumulator balance > withdraw", () => {
          it("should be success", async () => {
            await setup()

            mockedBookKeeper.totalStablecoinIssued.returns(WeiPerRay)
            await showStopper.finalizeDebt()

            mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerWad)

            await showStopper.finalizeCashPrice(formatBytes32String("BNB"))

            await showStopper.accumulateStablecoin(WeiPerWad.mul(2))

            mockedBookKeeper.moveCollateral.returns()

            await expect(showStopper.redeemStablecoin(formatBytes32String("BNB"), WeiPerWad))
              .to.emit(showStopper, "LogRedeemStablecoin")
              .withArgs(formatBytes32String("BNB"), deployerAddress, WeiPerWad)

            expect(mockedBookKeeper.moveCollateral).to.be.calledOnceWith(formatBytes32String("BNB"), showStopper.address, deployerAddress, WeiPerRay)
          })
        })
      })
    })
  })

  describe("#setBookKeeper", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(showStopperAsAlice.setBookKeeper(mockedBookKeeper.address)).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await setup()

          await expect(showStopper.setBookKeeper(mockedBookKeeper.address)).to.be.revertedWith("ShowStopper/not-live")
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setBookKeeper", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setBookKeeper(mockedBookKeeper.address))
            .to.emit(showStopper, "LogSetBookKeeper")
            .withArgs(deployerAddress, mockedBookKeeper.address)
        })
      })
    })
  })

  describe("#setLiquidationEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(showStopperAsAlice.setLiquidationEngine(mockedLiquidationEngine.address)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await setup()

          await expect(showStopper.setLiquidationEngine(mockedLiquidationEngine.address)).to.be.revertedWith(
            "ShowStopper/not-live"
          )
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setLiquidationEngine", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setLiquidationEngine(mockedLiquidationEngine.address))
            .to.emit(showStopper, "LogSetLiquidationEngine")
            .withArgs(deployerAddress, mockedLiquidationEngine.address)
        })
      })
    })
  })

  describe("#setSystemDebtEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(showStopperAsAlice.setSystemDebtEngine(mockedSystemDebtEngine.address)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await setup()

          await expect(showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address)).to.be.revertedWith(
            "ShowStopper/not-live"
          )
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setSystemDebtEngine", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setSystemDebtEngine(mockedSystemDebtEngine.address))
            .to.emit(showStopper, "LogSetSystemDebtEngine")
            .withArgs(deployerAddress, mockedSystemDebtEngine.address)
        })
      })
    })
  })

  describe("#setPriceOracle", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(showStopperAsAlice.setPriceOracle(mockedPriceOracle.address)).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      context("when showStopper does not live", () => {
        it("should be revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await setup()

          await expect(showStopper.setPriceOracle(mockedPriceOracle.address)).to.be.revertedWith("ShowStopper/not-live")
        })
      })
      context("when showStopper is live", () => {
        it("should be able to call setPriceOracle", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          // set total debt ceiling 1 rad
          await expect(showStopper.setPriceOracle(mockedPriceOracle.address))
            .to.emit(showStopper, "LogSetPriceOracle")
            .withArgs(deployerAddress, mockedPriceOracle.address)
        })
      })
    })
  })
})
