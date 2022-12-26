
const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { One } = ethers.constants;

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");

const { formatBytes32String } = ethers.utils

const loadFixtureHandler = async () => {
    const mockedAccessControlConfig = await createMock("AccessControlConfig")
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig")
    const mockedBookKeeper = await createMock("BookKeeper")
    const mockedPriceFeed = await createMock("SimplePriceFeed")

    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedAccessControlConfig.mock.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"))
    await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(1)
    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)

    const priceOracle = getContract("PriceOracle", DeployerAddress) 
    const priceOracleAsAlice = getContract("PriceOracle", AliceAddress)

    await priceOracle.initialize(mockedBookKeeper.address);

    return {
        priceOracle,
        priceOracleAsAlice,
        mockedBookKeeper,
        mockedPriceFeed,
        mockedAccessControlConfig,
        mockedCollateralPoolConfig
    }
    
}
describe("PriceOracle", () => {
  // Contracts
  let mockedBookKeeper
  let mockedPriceFeed
  let mockedCollateralPoolConfig
  let mockedAccessControlConfig

  let priceOracle
  let priceOracleAsAlice

  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ({
        priceOracle,
        priceOracleAsAlice,
        mockedBookKeeper,
        mockedPriceFeed,
        mockedAccessControlConfig,
        mockedCollateralPoolConfig
      } = await loadFixture(loadFixtureHandler))
  })

  describe("#setPrice()", () => {
    context("when price from price feed is 1", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(One), false)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedCollateralPoolConfig.address)

          await mockedCollateralPoolConfig.mock.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: WeiPerRay,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
          })
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
            formatBytes32String("WXDC"),
            BigNumber.from("0")
          ).returns()
          await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("WXDC"), formatBytes32BigNumber(One), 0, One)
        })
      })

      context("and price with safety margin is 10^43", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(One), true)

          await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(10 ** 10)
          await mockedCollateralPoolConfig.mock.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: 10 ** 10,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
          })

          await priceOracle.setStableCoinReferencePrice(10 ** 10)

          await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
            formatBytes32String("WXDC"),
            BigNumber.from("10").pow("43")
          ).returns()
          await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("WXDC"), formatBytes32BigNumber(One), BigNumber.from("10").pow("43"), One)
        })
      })

      context("and price with safety margin is 9.31322574615478515625 * 10^53", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(4 ** 10)

          await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(One), true)

          await mockedCollateralPoolConfig.mock.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: 4 ** 10,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
          })

          await priceOracle.setStableCoinReferencePrice(2 ** 10)

          await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
            formatBytes32String("WXDC"),
            BigNumber.from("931322574615478515625").mul(BigNumber.from("10").pow("33"))
          ).returns()
          await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(
              formatBytes32String("WXDC"),
              formatBytes32BigNumber(One),
              BigNumber.from("931322574615478515625").mul(BigNumber.from("10").pow("33")),
              One
            )
        })
      })
    })

    context("when price from price feed is 7 * 10^11", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await mockedCollateralPoolConfig.mock.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: 10 ** 10,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
          })

          await mockedPriceFeed.mock.peekPrice.returns(
            formatBytes32BigNumber(BigNumber.from("700000000000")),
            false,
          )

          await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
            formatBytes32String("WXDC"),
            BigNumber.from("0")
          ).returns()
          await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("WXDC"), formatBytes32BigNumber(BigNumber.from("700000000000")), 0, BigNumber.from("700000000000"))
        })
      })

      context("and price with safety margin is 7 * 10^54", () => {
        it("should be success", async () => {
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(10 ** 10)

          await mockedPriceFeed.mock.peekPrice.returns(
            formatBytes32BigNumber(BigNumber.from("700000000000")),
            true,
          )

          await mockedCollateralPoolConfig.mock.collateralPools.returns({
            totalDebtShare: 0,
            debtAccumulatedRate: WeiPerRay,
            priceWithSafetyMargin: WeiPerRay,
            debtCeiling: 0,
            debtFloor: 0,
            priceFeed: mockedPriceFeed.address,
            liquidationRatio: 10 ** 10,
            stabilityFeeRate: WeiPerRay,
            lastAccumulationTime: 0,
            adapter: AddressZero,
            closeFactorBps: 5000,
            liquidatorIncentiveBps: 10250,
            treasuryFeesBps: 5000,
            strategy: AddressZero,
          })

          await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
            formatBytes32String("WXDC"),
            BigNumber.from("7").mul(BigNumber.from("10").pow("54"))
          ).returns()

          await priceOracle.setStableCoinReferencePrice(10 ** 10)

          await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(
              formatBytes32String("WXDC"),
              formatBytes32BigNumber(BigNumber.from("700000000000")),
              BigNumber.from("7").mul(BigNumber.from("10").pow("54")),
              BigNumber.from("700000000000"),
            )
        })
      })
    })
  })

  describe("#setStableCoinReferencePrice", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(priceOracleAsAlice.setStableCoinReferencePrice(10 ** 10)).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      context("when priceOracle does not live", () => {
        it("should be revert", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await priceOracle.cage()

          await expect(priceOracle.setStableCoinReferencePrice(10 ** 10)).to.be.revertedWith("PriceOracle/not-live")
        })
      })
      context("when priceOracle is live", () => {
        it("should be able to call setStableCoinReferencePrice", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await expect(priceOracle.setStableCoinReferencePrice(10 ** 10))
            .to.emit(priceOracle, "LogSetStableCoinReferencePrice")
            .withArgs(DeployerAddress, 10 ** 10)
        })
      })
    })
  })

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(priceOracleAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await priceOracle.pause()
        })
      })
    })

    context("when pause contract", () => {
      it("should be success", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(10 ** 10)

        await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(One), true)

        await priceOracle.pause()

        await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(One), false)
        await mockedCollateralPoolConfig.mock.collateralPools.returns({
          totalDebtShare: 0,
          debtAccumulatedRate: WeiPerRay,
          priceWithSafetyMargin: WeiPerRay,
          debtCeiling: 0,
          debtFloor: 0,
          priceFeed: mockedPriceFeed.address,
          liquidationRatio: 10 ** 10,
          stabilityFeeRate: WeiPerRay,
          lastAccumulationTime: 0,
          adapter: AddressZero,
          closeFactorBps: 5000,
          liquidatorIncentiveBps: 10250,
          treasuryFeesBps: 5000,
          strategy: AddressZero,
        })

        await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.returns()
        await expect(priceOracle.setPrice(formatBytes32String("WXDC"))).to.be.revertedWith("Pausable: paused")
      })
    })
  })

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(priceOracleAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await priceOracle.pause()
          await priceOracle.unpause()
        })
      })
    })

    context("when unpause contract", () => {
      it("should be success", async () => {
        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
        await mockedAccessControlConfig.mock.hasRole.returns(true)

        await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(10 ** 10)

        await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(One), true)

        // pause contract
        await priceOracle.pause()

        // unpause contract
        await priceOracle.unpause()

        await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(One), false)
        await mockedCollateralPoolConfig.mock.collateralPools.returns({
          totalDebtShare: 0,
          debtAccumulatedRate: WeiPerRay,
          priceWithSafetyMargin: WeiPerRay,
          debtCeiling: 0,
          debtFloor: 0,
          priceFeed: mockedPriceFeed.address,
          liquidationRatio: 10 ** 10,
          stabilityFeeRate: WeiPerRay,
          lastAccumulationTime: 0,
          adapter: AddressZero,
          closeFactorBps: 5000,
          liquidatorIncentiveBps: 10250,
          treasuryFeesBps: 5000,
          strategy: AddressZero,
        })

        await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
          formatBytes32String("WXDC"),
          BigNumber.from("0")
        ).returns()

        await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
          .to.emit(priceOracle, "LogSetPrice")
          .withArgs(formatBytes32String("WXDC"), formatBytes32BigNumber(One), 0, One)
      })
    })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(priceOracleAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await priceOracleAsAlice.live()).to.be.equal(1)

          await expect(priceOracleAsAlice.cage()).to.emit(priceOracleAsAlice, "LogCage").withArgs()

          expect(await priceOracleAsAlice.live()).to.be.equal(0)
        })
      })
    })
  })

  describe("#uncage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.mock.hasRole.returns(false)

        await expect(priceOracleAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 1", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          expect(await priceOracleAsAlice.live()).to.be.equal(1)

          await priceOracleAsAlice.cage()

          expect(await priceOracleAsAlice.live()).to.be.equal(0)

          await expect(priceOracleAsAlice.uncage()).to.emit(priceOracleAsAlice, "LogUncage").withArgs()

          expect(await priceOracleAsAlice.live()).to.be.equal(1)
        })
      })
    })
  })
})
