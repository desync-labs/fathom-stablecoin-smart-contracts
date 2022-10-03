require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");

const UnitHelpers = require("../../helper/unit");
const { formatBytes32String } = ethers.utils

chai.use(smock.matchers)
const { expect } = chai

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
  const mockedBookKeeper = await smock.fake("BookKeeper");
  const mockedCollateralTokenAdapter = await smock.fake("CollateralTokenAdapter");

  const SystemDebtEngine = (await ethers.getContractFactory("SystemDebtEngine", deployer))
  const systemDebtEngine = (await upgrades.deployProxy(SystemDebtEngine, [
    mockedBookKeeper.address,
  ]))
  return {
    systemDebtEngine,
    mockedBookKeeper,
    mockedCollateralTokenAdapter,
    mockedAccessControlConfig,
    mockedCollateralPoolConfig,
  }
}

describe("SystemDebtEngine", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockedBookKeeper
  let mockedCollateralTokenAdapter
  let mockedAccessControlConfig
  let mockedCollateralPoolConfig

  let systemDebtEngine
  let systemDebtEngineAsAlice

  beforeEach(async () => {
    ;({
      systemDebtEngine,
      mockedBookKeeper,
      mockedCollateralTokenAdapter,
      mockedAccessControlConfig,
      mockedCollateralPoolConfig,
    } = await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    systemDebtEngineAsAlice = systemDebtEngine.connect(alice)
  })

  describe("#settleSystemBadDebt", () => {
    context("when insufficient surplus", () => {
      it("should be revert", async () => {
        await expect(systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad)).to.be.revertedWith(
          "SystemDebtEngine/insufficient-surplus"
        )
      })
    })
    context("when insufficient debt", () => {
      it("should be revert", async () => {
        mockedBookKeeper.stablecoin.returns(UnitHelpers.WeiPerRad)

        await expect(systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad)).to.be.revertedWith(
          "SystemDebtEngine/insufficient-debt"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should be able to call settleSystemBadDebt", async () => {
        mockedBookKeeper.stablecoin.returns(UnitHelpers.WeiPerRad)
        mockedBookKeeper.systemBadDebt.returns(UnitHelpers.WeiPerRad)

        await systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad)

        expect(mockedBookKeeper.settleSystemBadDebt).to.be.calledOnceWith(UnitHelpers.WeiPerRad)
      })
    })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(systemDebtEngineAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1)

          await expect(systemDebtEngineAsAlice.cage()).to.emit(systemDebtEngineAsAlice, "LogCage").withArgs()

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 0", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1)

          await expect(systemDebtEngineAsAlice.cage()).to.emit(systemDebtEngineAsAlice, "LogCage").withArgs()

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0)
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

        await expect(systemDebtEngineAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 1", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1)

          await systemDebtEngineAsAlice.cage()

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0)

          await expect(systemDebtEngineAsAlice.uncage()).to.emit(systemDebtEngineAsAlice, "LogUncage").withArgs()

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1)
        })
      })

      context("caller is showStopper role", () => {
        it("should be set live to 1", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1)

          await systemDebtEngineAsAlice.cage()

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(0)

          await expect(systemDebtEngineAsAlice.uncage()).to.emit(systemDebtEngineAsAlice, "LogUncage").withArgs()

          expect(await systemDebtEngineAsAlice.live()).to.be.equal(1)
        })
      })
    })
  })

  describe("#setSurplusBuffer", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(systemDebtEngineAsAlice.setSurplusBuffer(UnitHelpers.WeiPerRad)).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      it("should be able to call setSurplusBuffer", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await expect(systemDebtEngine.setSurplusBuffer(UnitHelpers.WeiPerRad))
          .to.emit(systemDebtEngine, "LogSetSurplusBuffer")
          .withArgs(deployerAddress, UnitHelpers.WeiPerRad)
      })
    })
  })

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(systemDebtEngineAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await systemDebtEngine.pause()
        })
      })
    })

    context("and role is gov role", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await systemDebtEngine.pause()
      })
    })

    context("when pause contract", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await systemDebtEngine.pause()

        await expect(systemDebtEngine.settleSystemBadDebt(UnitHelpers.WeiPerRad)).to.be.revertedWith("Pausable: paused")
      })
    })
  })

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(systemDebtEngineAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await systemDebtEngine.pause()
          await systemDebtEngine.unpause()
        })
      })

      context("and role is gov role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await systemDebtEngine.pause()
          await systemDebtEngine.unpause()
        })
      })
    })

    context("when unpause contract", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        // pause contract
        await systemDebtEngine.pause()

        // unpause contract
        await systemDebtEngine.unpause()

        await expect(systemDebtEngine.setSurplusBuffer(UnitHelpers.WeiPerRad))
          .to.emit(systemDebtEngine, "LogSetSurplusBuffer")
          .withArgs(deployerAddress, UnitHelpers.WeiPerRad)
      })
    })
  })

  describe("#withdrawCollateralSurplus", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(
          systemDebtEngineAsAlice.withdrawCollateralSurplus(
            formatBytes32String("BNB"),
            mockedCollateralTokenAdapter.address,
            deployerAddress,
            UnitHelpers.WeiPerWad
          )
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      it("should be able to call withdrawCollateralSurplus", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        mockedBookKeeper.moveCollateral.returns()

        await systemDebtEngine.withdrawCollateralSurplus(
          formatBytes32String("BNB"),
          mockedCollateralTokenAdapter.address,
          deployerAddress,
          UnitHelpers.WeiPerWad
        )

        expect(mockedBookKeeper.moveCollateral).to.be.calledOnceWith(formatBytes32String("BNB"), systemDebtEngine.address, deployerAddress, UnitHelpers.WeiPerWad)
        expect(mockedCollateralTokenAdapter.onMoveCollateral).to.be.calledOnceWith(
          systemDebtEngine.address, 
          deployerAddress, 
          UnitHelpers.WeiPerWad, 
          ethers.utils.defaultAbiCoder.encode(["address"], [deployerAddress]))
    })
  })

  describe("#withdrawStablecoinSurplus", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(
          systemDebtEngineAsAlice.withdrawStablecoinSurplus(deployerAddress, UnitHelpers.WeiPerRad)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      context("when there is no system bad debt", async () => {
        it("should be able to call withdrawStablecoinSurplus", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          mockedBookKeeper.systemBadDebt.returns(0)

          mockedBookKeeper.moveStablecoin.returns()

          await systemDebtEngine.withdrawStablecoinSurplus(deployerAddress, UnitHelpers.WeiPerRad)

          expect(mockedBookKeeper.moveStablecoin).to.be.calledOnceWith(systemDebtEngine.address, deployerAddress, UnitHelpers.WeiPerRad)
        })
      })

      context("when there is system bad debt", async () => {
        it("should revert", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          mockedBookKeeper.systemBadDebt.returns(1000)

          mockedBookKeeper.moveStablecoin.returns()

          await expect(
            systemDebtEngine.withdrawStablecoinSurplus(deployerAddress, UnitHelpers.WeiPerRad)
          ).to.be.revertedWith("SystemDebtEngine/system-bad-debt-remaining")
        })
      })
    })
  })
})
})