require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock")

const { WeiPerRay, WeiPerWad } = require("../../helper/unit")

const { formatBytes32String } = ethers.utils
const { AddressZero } = ethers.constants;

const expect = chai.expect;
chai.use(smock.matchers);

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
  const mockedBookKeeper = await smock.fake("BookKeeper");
  const mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");
  const mockedFixedSpreadLiquidationStrategy = await smock.fake("FixedSpreadLiquidationStrategy");

  const LiquidationEngine = (await ethers.getContractFactory(
    "LiquidationEngine",
    deployer
  )) 
  const liquidationEngine = (await upgrades.deployProxy(LiquidationEngine, [
    mockedBookKeeper.address,
    mockedSystemDebtEngine.address
  ]))

  return {
    liquidationEngine,
    mockedBookKeeper,
    mockedFixedSpreadLiquidationStrategy,
    mockedSystemDebtEngine,
    mockedCollateralPoolConfig,
    mockedAccessControlConfig,
  }
}

describe("LiquidationEngine", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockedBookKeeper
  let mockedFixedSpreadLiquidationStrategy
  let mockedSystemDebtEngine
  let mockedCollateralPoolConfig
  let mockedAccessControlConfig

  let liquidationEngine
  let liquidationEngineAsAlice

  beforeEach(async () => {
    ;({
      liquidationEngine,
      mockedBookKeeper,
      mockedFixedSpreadLiquidationStrategy,
      mockedSystemDebtEngine,
      mockedCollateralPoolConfig,
      mockedAccessControlConfig,
    } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    liquidationEngineAsAlice = liquidationEngine.connect(alice)
  })

  describe("#liquidate", () => {
    context("when liquidation engine does not live", () => {
      it("should be revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await liquidationEngine.cage()
        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            aliceAddress,
            WeiPerWad,
            WeiPerWad,
            deployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/not-live")
      })
    })
    context("when debtShareToRepay == 0", () => {
      it("should be revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            aliceAddress,
            0,
            0,
            deployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/zero-debt-value-to-be-liquidated")
      })
    })
    context("when liquidation engine colllteral pool does not set strategy", () => {
      it("should be revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        mockedBookKeeper.positions.returns([
          WeiPerWad.mul(10),
          WeiPerWad.mul(5),
        ])
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay)
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(WeiPerRay)
        mockedCollateralPoolConfig.getStrategy.returns(AddressZero)

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            aliceAddress,
            WeiPerWad,
            WeiPerWad,
            deployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/not-set-strategy")
      })
    })
    // @dev move to integration test
    // context("when position is safe", () => {
    //   it("should be revert", async () => {
    //     mockedBookKeeper.positions.returns([
    //       WeiPerWad.mul(10),
    //       WeiPerWad.mul(5),
    //     ])
    //     mockedBookKeeper.smocked.collateralPools.will.return.with({
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
    //         aliceAddress,
    //         WeiPerWad,
    //         WeiPerWad,
    //         deployerAddress,
    //         "0x"
    //       )
    //     ).to.be.revertedWith("LiquidationEngine/position-is-safe")
    //   })
    // })
    // context("when liquidating in position", () => {
    //   it("should be able to call liquidate", async () => {
    //     // mock contract
    //     mockedBookKeeper.positions.returns([
    //       WeiPerWad.mul(10),
    //       WeiPerWad.mul(10),
    //     ])
    //     mockedCollateralPoolConfig.smocked.collateralPools.will.return.with([
    //       BigNumber.from(0),
    //       WeiPerRay.mul(2),
    //       WeiPerRay,
    //       BigNumber.from(0),
    //       BigNumber.from(0),
    //     ])
    //     mockedBookKeeper.smocked.moveStablecoin.will.return.with()
    //     mockedFixedSpreadLiquidationStrategy.execute.returns()

    //     await liquidationEngine.setStrategy(formatBytes32String("BNB"), mockedFixedSpreadLiquidationStrategy.address)

    //     await liquidationEngine.liquidate(
    //       formatBytes32String("BNB"),
    //       aliceAddress,
    //       WeiPerWad,
    //       WeiPerWad,
    //       deployerAddress,
    //       ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress])
    //     )

    //     const { calls: positions } = mockedBookKeeper.smocked.positions
    //     expect(positions.length).to.be.equal(2)
    //     expect(positions[0][0]).to.be.equal(formatBytes32String("BNB"))
    //     expect(positions[0][1]).to.be.equal(aliceAddress)

    //     const { calls: collateralPools } = mockedCollateralPoolConfig.smocked.collateralPools
    //     expect(collateralPools.length).to.be.equal(1)
    //     expect(collateralPools[0][0]).to.be.equal(formatBytes32String("BNB"))

    //     const { calls: moveStablecoin } = mockedBookKeeper.smocked.moveStablecoin
    //     expect(moveStablecoin.length).to.be.equal(1)
    //     expect(moveStablecoin[0].src).to.be.equal(deployerAddress)
    //     expect(moveStablecoin[0].dst).to.be.equal(mockedSystemDebtEngine.address)
    //     expect(moveStablecoin[0].value).to.be.equal(WeiPerRad.mul(2))

    //     const { calls: execute } = mockedFixedSpreadLiquidationStrategy.smocked.execute
    //     expect(execute.length).to.be.equal(1)
    //     expect(execute[0].collateralPoolId).to.be.equal(formatBytes32String("BNB"))
    //     expect(execute[0].positionDebtShare).to.be.equal(WeiPerWad.mul(10))
    //     expect(execute[0].positionCollateralAmount).to.be.equal(WeiPerWad.mul(10))
    //     expect(execute[0].positionAddress).to.be.equal(aliceAddress)
    //     expect(execute[0].debtShareToRepay).to.be.equal(WeiPerWad)
    //     expect(execute[0].data).to.be.equal(
    //       ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress])
    //     )
    //   })
    // })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)

          await expect(liquidationEngineAsAlice.cage()).to.emit(liquidationEngineAsAlice, "LogCage").withArgs()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

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
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 1", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)

          await liquidationEngineAsAlice.cage()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(0)

          await expect(liquidationEngineAsAlice.uncage()).to.emit(liquidationEngineAsAlice, "LogUncage").withArgs()

          expect(await liquidationEngineAsAlice.live()).to.be.equal(1)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 1", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

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
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await liquidationEngine.pause()
        })
      })
    })

    context("and role is gov role", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await liquidationEngine.pause()
      })
    })

    context("when pause contract", () => {
      it("shouldn't be able to call liquidate", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await liquidationEngine.pause()

        // mock contract
        mockedBookKeeper.positions.returns([
          WeiPerWad.mul(10),
          WeiPerWad.mul(10),
        ])
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay)
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(WeiPerRay)
        mockedCollateralPoolConfig.getStrategy.returns(mockedFixedSpreadLiquidationStrategy.address)

        mockedFixedSpreadLiquidationStrategy.execute.returns()

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            aliceAddress,
            WeiPerWad,
            WeiPerWad,
            deployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress])
          )
        ).to.be.revertedWith("Pausable: paused")
      })
    })
  })

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(liquidationEngineAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await liquidationEngine.pause()
          await liquidationEngine.unpause()
        })
      })

      context("and role is gov role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await liquidationEngine.pause()
          await liquidationEngine.unpause()
        })
      })
    })

    context("when unpause contract", () => {
      it("should liquidate but revert because debt share not decrease", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        // pause contract
        await liquidationEngine.pause()

        // unpause contract
        await liquidationEngine.unpause()

        // mock contract
        mockedBookKeeper.positions.returns([
          WeiPerWad.mul(10),
          WeiPerWad.mul(10),
        ])

        mockedFixedSpreadLiquidationStrategy.execute.returns()

        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay.mul(2))
        mockedCollateralPoolConfig.getPriceWithSafetyMargin.returns(WeiPerRay)
        mockedCollateralPoolConfig.getStrategy.returns(mockedFixedSpreadLiquidationStrategy.address)

        await expect(
          liquidationEngine.liquidate(
            formatBytes32String("BNB"),
            aliceAddress,
            WeiPerWad,
            WeiPerWad,
            deployerAddress,
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress])
          )
        ).to.be.revertedWith("LiquidationEngine/debt-not-liquidated")

        expect(mockedBookKeeper.positions).to.be.calledWith(formatBytes32String("BNB"), aliceAddress)

        expect(mockedFixedSpreadLiquidationStrategy.execute).to.be.calledOnceWith(
            formatBytes32String("BNB"), 
            WeiPerWad.mul(10), 
            WeiPerWad.mul(10), 
            aliceAddress, 
            WeiPerWad, 
            WeiPerWad, 
            deployerAddress, 
            deployerAddress, 
            ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployerAddress, deployerAddress]));
      })
    })
  })
})
