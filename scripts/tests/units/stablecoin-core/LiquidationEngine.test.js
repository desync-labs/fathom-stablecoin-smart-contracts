
const { ethers } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRay, WeiPerWad } = require("../../helper/unit")
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");

const { formatBytes32String } = ethers.utils

const loadFixtureHandler = async () => {
    mockedAccessControlConfig = await createMock("AccessControlConfig");
    mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    mockedBookKeeper = await createMock("BookKeeper");
    mockedSystemDebtEngine = await createMock("SystemDebtEngine");
    mockedPriceOracle = await createMock("PriceOracle");
    mockedFixedSpreadLiquidationStrategy = await createMock("FixedSpreadLiquidationStrategy");

    await mockedBookKeeper.mock.totalStablecoinIssued.returns(0)
    await mockedSystemDebtEngine.mock.surplusBuffer.returns(0)
    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)
    await mockedPriceOracle.mock.setPrice.returns()

    liquidationEngine = getContract("LiquidationEngine", DeployerAddress)
    liquidationEngineAsAlice = getContract("LiquidationEngine", AliceAddress)

    await liquidationEngine.initialize(mockedBookKeeper.address, mockedSystemDebtEngine.address, mockedPriceOracle.address);

    return {
        liquidationEngine,
        liquidationEngineAsAlice,
        mockedBookKeeper,
        mockedFixedSpreadLiquidationStrategy,
        mockedSystemDebtEngine,
        mockedCollateralPoolConfig,
        mockedAccessControlConfig
    }
}

describe("LiquidationEngine", () => {
  // Contracts
  let mockedBookKeeper
  let mockedFixedSpreadLiquidationStrategy
  let mockedSystemDebtEngine
  let mockedCollateralPoolConfig
  let mockedAccessControlConfig

  let liquidationEngine
  let liquidationEngineAsAlice

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ({
        liquidationEngine,
        liquidationEngineAsAlice,
        mockedBookKeeper,
        mockedFixedSpreadLiquidationStrategy,
        mockedSystemDebtEngine,
        mockedCollateralPoolConfig,
        mockedAccessControlConfig,
      } = await loadFixture(loadFixtureHandler))
  })

  describe("#liquidate", () => {
    context("when liquidation engine does not live", () => {
      it("should be revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await liquidationEngine.cage()

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress]),
            { gasLimit: 1000000 }
          )
        ).to.be.revertedWith("LiquidationEngine/not-live")
      })
    })
    context("when debtShareToRepay == 0", () => {
      it("should be revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            AliceAddress,
            0,
            0,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress]),
            { gasLimit: 1000000 }
          )
        ).to.be.revertedWith("LiquidationEngine/zero-debt-value-to-be-liquidated")
      })
    })
    context("when liquidation engine colllteral pool does not set strategy", () => {
      it("should be revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await mockedBookKeeper.mock.positions.returns(WeiPerWad.mul(10), WeiPerWad.mul(5))
        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
        await mockedCollateralPoolConfig.mock.getStrategy.returns(AddressZero)

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress]),
            { gasLimit: 1000000 }
          )
        ).to.be.revertedWith("LiquidationEngine/not-set-strategy")
      })
    })
    // @dev move to integration test
    // context("when position is safe", () => {
    //   it("should be revert", async () => {
    //  await mockedBookKeeper.mock.positions.returns([
    //       WeiPerWad.mul(10),
    //       WeiPerWad.mul(5),
    //     ])
    //  await mockedBookKeeper.mock.smocked.collateralPools.will.return.with({
    //       totalDebtShare: 0,
    //       debtAccumulatedRate: WeiPerRay,
    //       priceWithSafetyMargin: WeiPerRay,
    //       debtCeiling: 0,
    //       debtFloor: 0,
    //       priceFeed: AddressZero,
    //       liquidationRatio: WeiPerRay,
    //       stabilityFeeRate: WeiPerRay,
    //       lastAccumulationTime: 0,
    //       adapter: AddressZero,
    //       closeFactorBps: 5000,
    //       liquidatorIncentiveBps: 10250,
    //       treasuryFeesBps: 5000,
    //     })

    //     await liquidationEngine.setStrategy(formatBytes32String("BNB"), mockedFixedSpreadLiquidationStrategy.address)

    //     await expect(
    //       liquidationEngine.liquidate(
    //         formatBytes32String("BNB"),
    //         AliceAddress,
    //         WeiPerWad,
    //         WeiPerWad,
    //         DeployerAddress,
    //         "0x"
    //       )
    //     ).to.be.revertedWith("LiquidationEngine/position-is-safe")
    //   })
    // })
    // context("when liquidating in position", () => {
    //   it("should be able to call liquidate", async () => {
    //     // mock contract
    //  await mockedBookKeeper.mock.positions.returns([
    //       WeiPerWad.mul(10),
    //       WeiPerWad.mul(10),
    //     ])
    //  await mockedCollateralPoolConfig.mock.smocked.collateralPools.will.return.with([
    //       BigNumber.from(0),
    //       WeiPerRay.mul(2),
    //       WeiPerRay,
    //       BigNumber.from(0),
    //       BigNumber.from(0),
    //     ])
    //  await mockedBookKeeper.mock.smocked.moveStablecoin.will.return.with()
    //  await mockedFixedSpreadLiquidationStrategy.mock.execute.returns()

    //     await liquidationEngine.setStrategy(formatBytes32String("BNB"), mockedFixedSpreadLiquidationStrategy.address)

    //     await liquidationEngine.liquidate(
    //       formatBytes32String("BNB"),
    //       AliceAddress,
    //       WeiPerWad,
    //       WeiPerWad,
    //       DeployerAddress,
    //       ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
    //     )

    //     const { calls: positions } = mockedBookKeeper.mock.smocked.positions
    //     expect(positions.length).to.be.equal(2)
    //     expect(positions[0][0]).to.be.equal(formatBytes32String("BNB"))
    //     expect(positions[0][1]).to.be.equal(AliceAddress)

    //     const { calls: collateralPools } = mockedCollateralPoolConfig.mock.smocked.collateralPools
    //     expect(collateralPools.length).to.be.equal(1)
    //     expect(collateralPools[0][0]).to.be.equal(formatBytes32String("BNB"))

    //     const { calls: moveStablecoin } = mockedBookKeeper.mock.smocked.moveStablecoin
    //     expect(moveStablecoin.length).to.be.equal(1)
    //     expect(moveStablecoin[0].src).to.be.equal(DeployerAddress)
    //     expect(moveStablecoin[0].dst).to.be.equal(mockedSystemDebtEngine.address)
    //     expect(moveStablecoin[0].value).to.be.equal(WeiPerRad.mul(2))

    //     const { calls: execute } = mockedFixedSpreadLiquidationStrategy.mock.smocked.execute
    //     expect(execute.length).to.be.equal(1)
    //     expect(execute[0].collateralPoolId).to.be.equal(formatBytes32String("BNB"))
    //     expect(execute[0].positionDebtShare).to.be.equal(WeiPerWad.mul(10))
    //     expect(execute[0].positionCollateralAmount).to.be.equal(WeiPerWad.mul(10))
    //     expect(execute[0].positionAddress).to.be.equal(AliceAddress)
    //     expect(execute[0].debtShareToRepay).to.be.equal(WeiPerWad)
    //     expect(execute[0].data).to.be.equal(
    //       ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
    //     )
    //   })
    // })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)

          await expect(liquidationEngineAsAlice.cage()).to.emit(liquidationEngineAsAlice, "LogCage").withArgs()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)

          await expect(liquidationEngineAsAlice.cage()).to.emit(liquidationEngineAsAlice, "LogCage").withArgs()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0)
        })
      })
    })
  })

  describe("#uncage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 1", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)

          await liquidationEngineAsAlice.cage()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0)

          await expect(liquidationEngineAsAlice.uncage()).to.emit(liquidationEngineAsAlice, "LogUncage").withArgs()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 1", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)

          await liquidationEngineAsAlice.cage()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0)

          await expect(liquidationEngineAsAlice.uncage()).to.emit(liquidationEngineAsAlice, "LogUncage").withArgs()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)
        })
      })
    })
  })

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await liquidationEngine.pause()
        })
      })
    })

    context("and role is gov role", () => {
      it("should be success", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await liquidationEngine.pause()
      })
    })

    context("when pause contract", () => {
      it("shouldn't be able to call liquidate", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await liquidationEngine.pause()

        // mock contract
        await mockedBookKeeper.mock.positions.returns(WeiPerWad.mul(10), WeiPerWad.mul(10))
        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
        await mockedCollateralPoolConfig.mock.getStrategy.returns(mockedFixedSpreadLiquidationStrategy.address)

        await mockedFixedSpreadLiquidationStrategy.mock.execute.returns()

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress]),
            { gasLimit: 1000000 }
          )
        ).to.be.revertedWith("Pausable: paused")
      })
    })
  })

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await liquidationEngine.pause()
          await liquidationEngine.unpause()
        })
      })

      context("and role is gov role", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await liquidationEngine.pause()
          await liquidationEngine.unpause()
        })
      })
    })

    context("when unpause contract", () => {
      it("should liquidate but revert because debt share not decrease", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        // pause contract
        await liquidationEngine.pause()

        // unpause contract
        await liquidationEngine.unpause()

        // mock contract
        await mockedBookKeeper.mock.positions.withArgs(formatBytes32String("BNB"), AliceAddress).returns(WeiPerWad.mul(10), WeiPerWad.mul(10))
        await mockedBookKeeper.mock.stablecoin.returns(0)
        await mockedFixedSpreadLiquidationStrategy.mock.execute.withArgs(
          formatBytes32String("BNB"),
          WeiPerWad.mul(10),
          WeiPerWad.mul(10),
          AliceAddress,
          WeiPerWad,
          WeiPerWad,
          DeployerAddress,
          DeployerAddress,
          ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress])
        ).returns()
        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay.mul(2))
        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
        await mockedCollateralPoolConfig.mock.getStrategy.returns(mockedFixedSpreadLiquidationStrategy.address)

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            AliceAddress,
            WeiPerWad,
            WeiPerWad,
            DeployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [DeployerAddress, DeployerAddress]),
            { gasLimit: 1000000 }
          )
        ).to.be.revertedWith("LiquidationEngine/debt-not-liquidated")
      })
    })
  })
})
