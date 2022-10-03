require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const AssertHelpers = require("../../helper/assert");
const { latest } = require("../../helper/time");

chai.use(smock.matchers)
const { expect } = chai
const { AddressZero } = ethers.constants
const { formatBytes32String } = ethers.utils

const COLLATERAL_POOL_ID = formatBytes32String("ibDUMMY")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const nHoursAgoInSec = (now, n) => {
  return now.sub(n * 60 * 60)
}

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  const AccessControlConfig = (await ethers.getContractFactory(
    "AccessControlConfig",
    deployer
  ))
  const accessControlConfig = (await upgrades.deployProxy(AccessControlConfig, []))

  const mockedSimplePriceFeed = await smock.fake("SimplePriceFeed");
  const mockedCollateralTokenAdapter = await smock.fake("CollateralTokenAdapter");

  // Deploy mocked FlashMintModule
  const CollateralPoolConfig = (await ethers.getContractFactory(
    "CollateralPoolConfig",
    deployer
  ))
  const collateralPoolConfig = (await upgrades.deployProxy(CollateralPoolConfig, [
    accessControlConfig.address,
  ]))

  return {
    collateralPoolConfig,
    accessControlConfig,
    mockedSimplePriceFeed,
    mockedCollateralTokenAdapter,
  }
}

describe("CollateralPoolConfig", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockedSimplePriceFeed
  let mockedCollateralTokenAdapter
  let accessControlConfig

  let collateralPoolConfig
  let collateralPoolConfigAsAlice

  beforeEach(async () => {
    ;({ collateralPoolConfig, accessControlConfig, mockedSimplePriceFeed, mockedCollateralTokenAdapter } =
      await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    collateralPoolConfigAsAlice = collateralPoolConfig.connect(alice)
  })
  describe("#initCollateralPool", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerRay,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when collateral pool already init", () => {
      it("should be revert", async () => {
        await collateralPoolConfig.initCollateralPool(
          COLLATERAL_POOL_ID,
          WeiPerRad.mul(10000000),
          0,
          mockedSimplePriceFeed.address,
          WeiPerRay,
          WeiPerRay,
          mockedCollateralTokenAdapter.address,
          CLOSE_FACTOR_BPS,
          LIQUIDATOR_INCENTIVE_BPS,
          TREASURY_FEE_BPS,
          AddressZero
        )
        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerRay,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/collateral-pool-already-init")
      })
    })
    context("when stability fee rate invalid", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerWad,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/invalid-stability-fee-rate")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.initCollateralPool(
          COLLATERAL_POOL_ID,
          WeiPerRad.mul(10000000),
          0,
          mockedSimplePriceFeed.address,
          WeiPerRay,
          WeiPerRay,
          mockedCollateralTokenAdapter.address,
          CLOSE_FACTOR_BPS,
          LIQUIDATOR_INCENTIVE_BPS,
          TREASURY_FEE_BPS,
          AddressZero
        )
        expect(await (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).adapter).to.be.equal(
          mockedCollateralTokenAdapter.address
        )
      })
    })
  })
  describe("#setPriceWithSafetyMargin", () => {
    context("when the caller is not the RriceOracle Role", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)
        ).to.be.revertedWith("!priceOracleRole")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployerAddress)
        await expect(collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetPriceWithSafetyMargin")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setDebtCeiling", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetDebtCeiling")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setDebtFloor", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetDebtFloor")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setDebtFloor", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetDebtFloor")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setPriceFeed", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setPriceFeed(COLLATERAL_POOL_ID, mockedSimplePriceFeed.address)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setPriceFeed(COLLATERAL_POOL_ID, mockedSimplePriceFeed.address))
          .to.be.emit(collateralPoolConfig, "LogSetPriceFeed")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, mockedSimplePriceFeed.address)
      })
    })
  })
  describe("#setLiquidationRatio", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetLiquidationRatio")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setStabilityFeeRate", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setStabilityFeeRate(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when stability fee rate invalid", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfig.setStabilityFeeRate(COLLATERAL_POOL_ID, WeiPerWad)).to.be.revertedWith(
          "CollateralPoolConfig/invalid-stability-fee-rate"
        )
      })
    })
    context("when stability fee rate too large", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfig.setStabilityFeeRate(COLLATERAL_POOL_ID, WeiPerRad)).to.be.revertedWith(
          "CollateralPoolConfig/stability-fee-rate-too-large"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setStabilityFeeRate(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetStabilityFeeRate")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setAdapter", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setAdapter(COLLATERAL_POOL_ID, mockedCollateralTokenAdapter.address)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setAdapter(COLLATERAL_POOL_ID, mockedCollateralTokenAdapter.address))
          .to.be.emit(collateralPoolConfig, "LogSetAdapter")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, mockedCollateralTokenAdapter.address)
      })
    })
  })
  describe("#setCloseFactorBps", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setCloseFactorBps(COLLATERAL_POOL_ID, CLOSE_FACTOR_BPS)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when close factor bps is more than 10000", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, BigNumber.from(20000))
        ).to.be.revertedWith("CollateralPoolConfig/invalid-close-factor-bps")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, CLOSE_FACTOR_BPS))
          .to.be.emit(collateralPoolConfig, "LogSetCloseFactorBps")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, CLOSE_FACTOR_BPS)
      })
    })
  })
  describe("#setLiquidatorIncentiveBps", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, LIQUIDATOR_INCENTIVE_BPS)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when liquidator incentive bps is more than 20000", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, BigNumber.from(20000))
        ).to.be.revertedWith("CollateralPoolConfig/invalid-liquidator-incentive-bps")
      })
    })
    context("when liquidator incentive bps is less than 10000", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, BigNumber.from(9000))
        ).to.be.revertedWith("CollateralPoolConfig/invalid-liquidator-incentive-bps")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, LIQUIDATOR_INCENTIVE_BPS))
          .to.be.emit(collateralPoolConfig, "LogSetLiquidatorIncentiveBps")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, LIQUIDATOR_INCENTIVE_BPS)
      })
    })
  })
  describe("#setTreasuryFeesBps", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setTreasuryFeesBps(COLLATERAL_POOL_ID, TREASURY_FEE_BPS)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when treasury fee bps is more than 9000", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfig.setTreasuryFeesBps(COLLATERAL_POOL_ID, BigNumber.from(20000))
        ).to.be.revertedWith("CollateralPoolConfig/invalid-treasury-fees-bps")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setTreasuryFeesBps(COLLATERAL_POOL_ID, TREASURY_FEE_BPS))
          .to.be.emit(collateralPoolConfig, "LogSetTreasuryFeesBps")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, TREASURY_FEE_BPS)
      })
    })
  })
  describe("#setTotalDebtShare", () => {
    context("when the caller is not the Bookkeeper Role", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setTotalDebtShare(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!bookKeeperRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), deployerAddress)
        await expect(collateralPoolConfig.setTotalDebtShare(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetTotalDebtShare")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setDebtAccumulatedRate", () => {
    context("when the caller is not the Bookkeeper Role", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setDebtAccumulatedRate(COLLATERAL_POOL_ID, WeiPerRay)
        ).to.be.revertedWith("!bookKeeperRole")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), deployerAddress)
        await expect(collateralPoolConfig.setDebtAccumulatedRate(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetDebtAccumulatedRate")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setStrategy", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setStrategy(COLLATERAL_POOL_ID, AddressZero)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, AddressZero))
          .to.be.emit(collateralPoolConfig, "LogSetStrategy")
          .withArgs(deployerAddress, COLLATERAL_POOL_ID, AddressZero)
      })
    })
  })
  describe("#updateLastAccumulationTime", () => {
    context("when the caller is not the StabilityFeeCollector role", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.updateLastAccumulationTime(COLLATERAL_POOL_ID)).to.be.revertedWith(
          "!stabilityFeeCollectorRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(), deployerAddress)
        await collateralPoolConfig.updateLastAccumulationTime(COLLATERAL_POOL_ID)

        const now = await latest()
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).lastAccumulationTime.toString(),
          nHoursAgoInSec(now, 0).toString()
        )
      })
    })
  })
  describe("#getTotalDebtShare", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), deployerAddress)
        await collateralPoolConfig.setTotalDebtShare(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getTotalDebtShare(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getDebtAccumulatedRate", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), deployerAddress)
        await collateralPoolConfig.setDebtAccumulatedRate(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getPriceWithSafetyMargin", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), deployerAddress)
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getPriceWithSafetyMargin(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getDebtCeiling", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getDebtCeiling(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getDebtFloor", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getDebtFloor(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getPriceFeed", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setPriceFeed(COLLATERAL_POOL_ID, mockedSimplePriceFeed.address)

        expect(await collateralPoolConfig.getPriceFeed(COLLATERAL_POOL_ID)).to.be.equal(mockedSimplePriceFeed.address)
      })
    })
  })
  describe("#getLiquidationRatio", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getLiquidationRatio(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getStabilityFeeRate", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setStabilityFeeRate(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getStabilityFeeRate(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getLastAccumulationTime", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await accessControlConfig.grantRole(await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(), deployerAddress)
        await collateralPoolConfig.updateLastAccumulationTime(COLLATERAL_POOL_ID)

        const now = await latest()
        AssertHelpers.assertAlmostEqual(
          (await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).lastAccumulationTime.toString(),
          nHoursAgoInSec(now, 0).toString()
        )
      })
    })
  })
  describe("#getAdapter", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setAdapter(COLLATERAL_POOL_ID, mockedCollateralTokenAdapter.address)

        expect(await collateralPoolConfig.getAdapter(COLLATERAL_POOL_ID)).to.be.equal(mockedCollateralTokenAdapter.address)
      })
    })
  })
  describe("#getCloseFactorBps", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, CLOSE_FACTOR_BPS)

        expect(await collateralPoolConfig.getCloseFactorBps(COLLATERAL_POOL_ID)).to.be.equal(CLOSE_FACTOR_BPS)
      })
    })
  })
  describe("#getLiquidatorIncentiveBps", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, LIQUIDATOR_INCENTIVE_BPS)

        expect(await collateralPoolConfig.getLiquidatorIncentiveBps(COLLATERAL_POOL_ID)).to.be.equal(
          LIQUIDATOR_INCENTIVE_BPS
        )
      })
    })
  })
  describe("#getTreasuryFeesBps", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setTreasuryFeesBps(COLLATERAL_POOL_ID, TREASURY_FEE_BPS)

        expect(await collateralPoolConfig.getTreasuryFeesBps(COLLATERAL_POOL_ID)).to.be.equal(TREASURY_FEE_BPS)
      })
    })
  })
  describe("#getStrategy", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, AddressZero)

        expect(await collateralPoolConfig.getStrategy(COLLATERAL_POOL_ID)).to.be.equal(AddressZero)
      })
    })
  })
})
