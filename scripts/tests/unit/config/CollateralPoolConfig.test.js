const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { BigNumber, ethers } = require("ethers");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { formatBytes32BigNumber } = require("../../helper/format");
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock, loadFixtureNew } = require("../../helper/contracts");
const AssertHelpers = require("../../helper/assert");
const { latest } = require("../../helper/time");
const { loadFixture } = require("../../helper/fixtures");

const { formatBytes32String } = ethers.utils

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const nHoursAgoInSec = (now, n) => {
  return now.sub(n * 60 * 60)
}

const loadFixtureHandler = async () => {
    const collateralPoolConfig = getContract("CollateralPoolConfig", DeployerAddress)
    const collateralPoolConfigAsAlice = getContract("CollateralPoolConfig", AliceAddress)

    const mockedAccessControlConfig = await createMock("AccessControlConfig");
    const mockedSimplePriceFeed = await createMock("SimplePriceFeed");
    const mockedCollateralTokenAdapter = await createMock("TokenAdapter");

    await mockedAccessControlConfig.mock.PRICE_ORACLE_ROLE.returns(formatBytes32String("PRICE_ORACLE_ROLE"))
    await mockedAccessControlConfig.mock.BOOK_KEEPER_ROLE.returns(formatBytes32String("BOOK_KEEPER_ROLE"))
    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.STABILITY_FEE_COLLECTOR_ROLE.returns(formatBytes32String("STABILITY_FEE_COLLECTOR_ROLE"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)

    // await mockedAccessControlConfig.mock.collateralPoolId.returns(COLLATERAL_POOL_ID)

    await mockedSimplePriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(BigNumber.from("0")), true);
    await mockedCollateralTokenAdapter.mock.decimals.returns(0);
    await mockedCollateralTokenAdapter.mock.collateralPoolId.returns(COLLATERAL_POOL_ID)

    await collateralPoolConfig.initialize(mockedAccessControlConfig.address)
    return {
      collateralPoolConfig,
      collateralPoolConfigAsAlice,
      mockedAccessControlConfig,
      mockedSimplePriceFeed,
      mockedCollateralTokenAdapter,
    }
  }
  

describe("CollateralPoolConfig", () => {
  // Contracts
  let mockedSimplePriceFeed
  let mockedCollateralTokenAdapter
  let mockedAccessControlConfig

  let collateralPoolConfig
  let collateralPoolConfigAsAlice

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => { 
    ;({ collateralPoolConfig,collateralPoolConfigAsAlice, mockedAccessControlConfig, mockedSimplePriceFeed, mockedCollateralTokenAdapter } =
        await loadFixture(loadFixtureHandler))
  })

  describe("#initCollateralPool", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await expect(
          collateralPoolConfigAsAlice.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            WeiPerRad.mul(10000),
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
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await collateralPoolConfig.initCollateralPool(
          COLLATERAL_POOL_ID,
          WeiPerRad.mul(10000000),
          0,
          WeiPerRad.mul(10000),
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
            WeiPerRad.mul(10000),
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
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            WeiPerRad.mul(10000),
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
    context("when debtCeiling is not bigger than debtFloor", () => {
      it("should be revert", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000),
            WeiPerRad.mul(10000),
            WeiPerRad.mul(10000),
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerWad,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/invalid-ceiliing")
      })
    })
    context("when positionDebtCeiling is not bigger than debtFloor", () => {
      it("should be revert", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(100000),
            WeiPerRad.mul(10000),
            WeiPerRad.mul(10000),
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerWad,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/invalid-position-ceiling")
      })
    })
    context("when positionDebtCeiling is not bigger than debtCeiling", () => {
      it("should be revert", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(100000),
            WeiPerRad.mul(10000),
            WeiPerRad.mul(1000000),
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerWad,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/invalid-position-ceiling")
      })
    })
    context("price feed is not healthy", () => {
      it("should revert", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(false)

        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            WeiPerRad.mul(10000),
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerWad,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/unhealthy-price-feed")
      })
    })
    context("wrong price feed pool", () => {
      it("should revert", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(formatBytes32String("GOLD"))
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            WeiPerRad.mul(10000),
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerWad,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/wrong-price-feed-pool")
      })
    })
    context("adapter with wrong id", () => {
      it("should revert", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)
        await mockedCollateralTokenAdapter.mock.collateralPoolId.returns(formatBytes32String("GOLD"));

        await expect(
          collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            WeiPerRad.mul(10000),
            mockedSimplePriceFeed.address,
            WeiPerRay,
            WeiPerRay,
            mockedCollateralTokenAdapter.address,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
          )
        ).to.be.revertedWith("CollateralPoolConfig/wrong-adapter")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)
        
        await collateralPoolConfig.initCollateralPool(
          COLLATERAL_POOL_ID,
          WeiPerRad.mul(10000000),
          0,
          WeiPerRad.mul(10000),
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
        await mockedAccessControlConfig.mock.hasRole.returns(false)
        await expect(
          collateralPoolConfigAsAlice.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)
        ).to.be.revertedWith("!priceOracleRole")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetPriceWithSafetyMargin")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setDebtCeiling", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(collateralPoolConfigAsAlice.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("not bigger than floor", () => {
      it("should revert", async () => {
        await collateralPoolConfigAsAlice.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)
        await collateralPoolConfigAsAlice.setPositionDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)
        await collateralPoolConfigAsAlice.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay.div(10))
        await expect(collateralPoolConfigAsAlice.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay.div(10))).to.be.revertedWith(
          "CollateralPoolConfig/invalid-debt-ceiling"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetDebtCeiling")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setDebtFloor", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(collateralPoolConfigAsAlice.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("not less than ceiling", () => {
      it("should be revert", async () => {
        await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)
        await expect(collateralPoolConfigAsAlice.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "CollateralPoolConfig/invalid-debt-floor"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await collateralPoolConfigAsAlice.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)
        await collateralPoolConfigAsAlice.setPositionDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)
        await collateralPoolConfigAsAlice.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay.div(10))

        await expect(collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay.div(15)))
          .to.be.emit(collateralPoolConfig, "LogSetDebtFloor")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, WeiPerRay.div(15))
      })
    })
  })
  describe("#setPriceFeed", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(
          collateralPoolConfigAsAlice.setPriceFeed(COLLATERAL_POOL_ID, mockedSimplePriceFeed.address)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when price feed is zero", () => {
      it("should revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setPriceFeed(COLLATERAL_POOL_ID, AddressZero)
        ).to.be.revertedWith("CollateralPoolConfig/zero-price-feed")
      })
    })
    context("price feed for another pool", () => {
      it("should revert", async () => {
        const poolId = formatBytes32String("GOLD")

        await mockedSimplePriceFeed.mock.poolId.returns(poolId)
        await expect(
          collateralPoolConfigAsAlice.setPriceFeed(COLLATERAL_POOL_ID, mockedSimplePriceFeed.address)
        ).to.be.revertedWith("CollateralPoolConfig/wrong-price-feed-pool")
      })
    })
    context("price feed is not healthy", () => {
      it("should revert", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(false)

        await expect(
          collateralPoolConfigAsAlice.setPriceFeed(COLLATERAL_POOL_ID, mockedSimplePriceFeed.address)
        ).to.be.revertedWith("CollateralPoolConfig/unhealthy-price-feed")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)

        await expect(collateralPoolConfig.setPriceFeed(COLLATERAL_POOL_ID, mockedSimplePriceFeed.address))
          .to.be.emit(collateralPoolConfig, "LogSetPriceFeed")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, mockedSimplePriceFeed.address)
      })
    })
  })
  describe("#setLiquidationRatio", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(collateralPoolConfigAsAlice.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("ratio less than ray", () => {
      it("should revert", async () => {
        await expect(collateralPoolConfigAsAlice.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay.sub(1))).to.be.revertedWith(
          "CollateralPoolConfig/invalid-liquidation-ratio"
        )
      })
    })
    context("ratio higher than max", () => {
      it("should revert", async () => {
        await expect(collateralPoolConfigAsAlice.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay.mul(101))).to.be.revertedWith(
          "CollateralPoolConfig/invalid-liquidation-ratio"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetLiquidationRatio")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setStabilityFeeRate", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

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
    context("when stability fee rate is zero", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfig.setStabilityFeeRate(COLLATERAL_POOL_ID, 0)).to.be.revertedWith(
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
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setAdapter", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(
          collateralPoolConfigAsAlice.setAdapter(COLLATERAL_POOL_ID, mockedCollateralTokenAdapter.address)
        ).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the parameters are invalid", () => {
      it("should be revert when adapter's input is address(0)", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await expect(
          collateralPoolConfigAsAlice.setAdapter(COLLATERAL_POOL_ID, ethers.constants.AddressZero)
        ).to.be.revertedWith("CollateralPoolConfig/setAdapter-zero-address")
      })
      it("should be revert when collateralPoolId is wrong)", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(true)
        
        await expect(
          collateralPoolConfigAsAlice.setAdapter(ethers.constants.HashZero, mockedCollateralTokenAdapter.address)
        ).to.be.revertedWith("CollateralPoolConfig/setAdapter-wrongPoolId")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setAdapter(COLLATERAL_POOL_ID, mockedCollateralTokenAdapter.address))
          .to.be.emit(collateralPoolConfig, "LogSetAdapter")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, mockedCollateralTokenAdapter.address)
      })
    })
  })
  describe("#setCloseFactorBps", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)
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
    context("when close factor bps is 0", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, BigNumber.from(0))
        ).to.be.revertedWith("CollateralPoolConfig/invalid-close-factor-bps")
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        await expect(collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, CLOSE_FACTOR_BPS))
          .to.be.emit(collateralPoolConfig, "LogSetCloseFactorBps")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, CLOSE_FACTOR_BPS)
      })
    })
  })
  describe("#setLiquidatorIncentiveBps", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

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
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, LIQUIDATOR_INCENTIVE_BPS)
      })
    })
  })
  describe("#setTreasuryFeesBps", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

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
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, TREASURY_FEE_BPS)
      })
    })
  })
  describe("#setTotalDebtShare", () => {
    context("when the caller is not the Bookkeeper Role", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(collateralPoolConfigAsAlice.setTotalDebtShare(COLLATERAL_POOL_ID, WeiPerRay)).to.be.revertedWith(
          "!bookKeeperRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {

        await expect(collateralPoolConfig.setTotalDebtShare(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetTotalDebtShare")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setDebtAccumulatedRate", () => {
    context("when the caller is not the Bookkeeper Role", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(
          collateralPoolConfigAsAlice.setDebtAccumulatedRate(COLLATERAL_POOL_ID, WeiPerRay)
        ).to.be.revertedWith("!bookKeeperRole")
      })
    })
    context("zero debt accumulated rate", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setDebtAccumulatedRate(COLLATERAL_POOL_ID, 0)
        ).to.be.revertedWith("CollateralPoolConfig/invalid-debt-accumulated-rate")
      })
    })
    context("debt accumulated rate less then ray", () => {
      it("should be revert", async () => {
        await expect(
          collateralPoolConfigAsAlice.setDebtAccumulatedRate(COLLATERAL_POOL_ID, WeiPerRay.sub(1))
        ).to.be.revertedWith("CollateralPoolConfig/invalid-debt-accumulated-rate")
      })
    })

    context("when parameters are valid", () => {
      it("should success", async () => {

        await expect(collateralPoolConfig.setDebtAccumulatedRate(COLLATERAL_POOL_ID, WeiPerRay))
          .to.be.emit(collateralPoolConfig, "LogSetDebtAccumulatedRate")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, WeiPerRay)
      })
    })
  })
  describe("#setStrategy", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(collateralPoolConfigAsAlice.setStrategy(COLLATERAL_POOL_ID, AddressZero)).to.be.revertedWith(
          "!ownerRole"
        )
      })
    })
    context("zero address", () => {
      it("should be revert", async () => {
        await expect(collateralPoolConfigAsAlice.setStrategy(COLLATERAL_POOL_ID, AddressZero)).to.be.revertedWith(
          "CollateralPoolConfig/zero-strategy"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {
        const randomAddress = "0x0E6C131863690D810c84F920356c20EaF7240F47";

        await expect(collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, randomAddress))
          .to.be.emit(collateralPoolConfig, "LogSetStrategy")
          .withArgs(DeployerAddress, COLLATERAL_POOL_ID, randomAddress)
      })
    })
  })
  describe("#updateLastAccumulationTime", () => {
    context("when the caller is not the StabilityFeeCollector role", () => {
      it("should be revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(collateralPoolConfigAsAlice.updateLastAccumulationTime(COLLATERAL_POOL_ID)).to.be.revertedWith(
          "!stabilityFeeCollectorRole"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should success", async () => {

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

        await collateralPoolConfig.setTotalDebtShare(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getTotalDebtShare(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getDebtAccumulatedRate", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {

        await collateralPoolConfig.setDebtAccumulatedRate(COLLATERAL_POOL_ID, WeiPerRay)

        expect(await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay)
      })
    })
  })
  describe("#getPriceWithSafetyMargin", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {

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
        await collateralPoolConfigAsAlice.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)
        await collateralPoolConfigAsAlice.setPositionDebtCeiling(COLLATERAL_POOL_ID, WeiPerRay)
        await collateralPoolConfigAsAlice.setDebtFloor(COLLATERAL_POOL_ID, WeiPerRay.div(20))

        expect(await collateralPoolConfig.getDebtFloor(COLLATERAL_POOL_ID)).to.be.equal(WeiPerRay.div(20))
      })
    })
  })
  describe("#getPriceFeed", () => {
    context("when parameters are valid", () => {
      it("should success", async () => {
        await mockedSimplePriceFeed.mock.poolId.returns(COLLATERAL_POOL_ID)
        await mockedSimplePriceFeed.mock.isPriceOk.returns(true)
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
        const randomAddress = "0x0E6C131863690D810c84F920356c20EaF7240F47";
        await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, randomAddress)

        expect(await collateralPoolConfig.getStrategy(COLLATERAL_POOL_ID)).to.be.equal(randomAddress)
      })
    })
  })
})
