require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const UnitHelpers = require("../../helper/unit");
const TimeHelpers = require("../../helper/time");
const AssertHelpers = require("../../helper/assert");

const { expect } = chai
const { formatBytes32String } = ethers.utils

chai.use(smock.matchers)

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
  const mockedBookKeeper = await smock.fake("BookKeeper");

  // Deploy StabilityFeeCollector
  const StabilityFeeCollector = (await ethers.getContractFactory(
    "StabilityFeeCollector",
    deployer
  ))
  const stabilityFeeCollector = (await upgrades.deployProxy(StabilityFeeCollector, [
    mockedBookKeeper.address,
    deployer.address,
  ]))

  return { stabilityFeeCollector, mockedBookKeeper, mockedCollateralPoolConfig, mockedAccessControlConfig }
}

describe("StabilityFeeCollector", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockedBookKeeper
  let mockedCollateralPoolConfig
  let mockedAccessControlConfig

  let stabilityFeeCollector
  let stabilityFeeCollectorAsAlice

  beforeEach(async () => {
    ;({ stabilityFeeCollector, mockedBookKeeper, mockedCollateralPoolConfig, mockedAccessControlConfig } =
      await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    stabilityFeeCollectorAsAlice = stabilityFeeCollector.connect(alice)
  })

  describe("#collect", () => {
    context("when call collect", async () => {
      it("should be rate to ~ 1%", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)

        // rate ~ 1% annually
        // r^31536000 = 1.01
        // r =~ 1000000000315522921573372069...
        mockedCollateralPoolConfig.getStabilityFeeRate.returns(
          BigNumber.from("1000000000315522921573372069")
        )

        // time increase 1 year
        mockedCollateralPoolConfig.getLastAccumulationTime.returns(await TimeHelpers.latest())
        await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from("31536000")))
        // mock bookeeper
        // set debtAccumulatedRate = 1 ray
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay)

        // rate ~ 0.01 ray ~ 1%
        mockedBookKeeper.accrueStabilityFee.returns()
        await stabilityFeeCollectorAsAlice.collect(formatBytes32String("BNB"))

        expect(mockedBookKeeper.accrueStabilityFee).to.be.calledOnce;

        var call = mockedBookKeeper.accrueStabilityFee.getCall(0);
        expect(call.args._collateralPoolId).to.be.equal(formatBytes32String("BNB"))
        expect(call.args._stabilityFeeRecipient).to.be.equal(deployerAddress)
        // rate ~ 0.01 ray ~ 1%
        AssertHelpers.assertAlmostEqual(
          call.args._debtAccumulatedRate.toString(),
          BigNumber.from("10000000000000000000000000").toString()
        )
      })
    })
  })

  describe("#setGlobalStabilityFeeRate", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(stabilityFeeCollectorAsAlice.setGlobalStabilityFeeRate(UnitHelpers.WeiPerWad)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when the caller is the owner", async () => {
      it("should be able to call setGlobalStabilityFeeRate", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await expect(stabilityFeeCollector.setGlobalStabilityFeeRate(UnitHelpers.WeiPerRay))
          .to.emit(stabilityFeeCollector, "LogSetGlobalStabilityFeeRate")
          .withArgs(deployerAddress, UnitHelpers.WeiPerRay)
      })
    })
  })

  describe("#setSystemDebtEngine", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(stabilityFeeCollectorAsAlice.setSystemDebtEngine(mockedBookKeeper.address)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when the caller is the owner", async () => {
      it("should be able to call setSystemDebtEngine", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await expect(stabilityFeeCollector.setSystemDebtEngine(mockedBookKeeper.address))
          .to.emit(stabilityFeeCollector, "LogSetSystemDebtEngine")
          .withArgs(deployerAddress, mockedBookKeeper.address)
      })
    })
  })

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(stabilityFeeCollectorAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await stabilityFeeCollector.pause()
        })
      })
    })

    context("and role is gov role", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        await stabilityFeeCollector.pause()
      })
    })
  })

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(stabilityFeeCollectorAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await stabilityFeeCollector.pause()
          await stabilityFeeCollector.unpause()
        })
      })

      context("and role is gov role", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          await stabilityFeeCollector.pause()
          await stabilityFeeCollector.unpause()
        })
      })
    })

    context("when unpause contract", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        // pause contract
        await stabilityFeeCollector.pause()

        // unpause contract
        await stabilityFeeCollector.unpause()

        await stabilityFeeCollector.collect(formatBytes32String("BNB"))
      })
    })
  })
})
