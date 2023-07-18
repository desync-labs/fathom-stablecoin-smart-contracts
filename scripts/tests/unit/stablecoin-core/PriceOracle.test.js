
const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { One } = ethers.constants;

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay, WeiPerRad } = require("../../helper/unit");
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
    await mockedBookKeeper.mock.totalStablecoinIssued.returns(WeiPerRay)
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
            positionDebtCeiling: WeiPerRad.mul(1000000)

          })
          await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
            formatBytes32String("WXDC"),
            BigNumber.from("0")
          ).returns()
          await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("WXDC"), One, 0)
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
            positionDebtCeiling: WeiPerRad.mul(1000000)
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
            .withArgs(formatBytes32String("WXDC"), BigNumber.from("700000000000"), 0)
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
      context("new price is lower than min", () => {
        it("should revert", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await expect(priceOracle.setStableCoinReferencePrice(WeiPerRay.div(1005))).to.be.revertedWith("PriceOracle/invalid-reference-price")
        })
      })
      context("new price is greater than max", () => {
        it("should revert", async () => {
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await expect(priceOracle.setStableCoinReferencePrice(WeiPerRay.mul(3))).to.be.revertedWith("PriceOracle/invalid-reference-price")
        })
      })
      context("when priceOracle is live", () => {
        it("should be able to call setStableCoinReferencePrice", async () => {
          const referencePrice = WeiPerRay.mul(11).div(10)
          await mockedAccessControlConfig.mock.hasRole.returns(true)

          await expect(priceOracle.setStableCoinReferencePrice(referencePrice))
            .to.emit(priceOracle, "LogSetStableCoinReferencePrice")
            .withArgs(DeployerAddress, referencePrice)
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
          positionDebtCeiling: WeiPerRad.mul(1000000)
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
          positionDebtCeiling: WeiPerRad.mul(1000000)
        })

        await mockedCollateralPoolConfig.mock.setPriceWithSafetyMargin.withArgs(
          formatBytes32String("WXDC"),
          BigNumber.from("0")
        ).returns()

        await expect(priceOracle.setPrice(formatBytes32String("WXDC")))
          .to.emit(priceOracle, "LogSetPrice")
          .withArgs(formatBytes32String("WXDC"), One, 0)
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
