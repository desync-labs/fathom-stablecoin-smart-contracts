require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const { formatBytes32BigNumber } = require("../../helper/format");
const { WeiPerRay } = require("../../helper/unit");

const expect = chai.expect;
chai.use(smock.matchers);

const { One, AddressZero } = ethers.constants;
const { formatBytes32String } = ethers.utils;

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  const mockedBookKeeper = await smock.fake("BookKeeper");

  // Deploy PriceOracle
  const PriceOracle = (await ethers.getContractFactory("PriceOracle", deployer));
  const priceOracle = (await upgrades.deployProxy(PriceOracle, [mockedBookKeeper.address]));
  await priceOracle.deployed();

  return {
    priceOracle,
    mockedBookKeeper,
    mockedAccessControlConfig,
  }
}

describe("PriceOracle", () => {
  // Accounts
  let deployer
  let alice

  // Account Addresses
  let deployerAddress
  let aliceAddress

  // Contracts
  let mockedBookKeeper
  let mockedPriceFeed
  let mockedCollateralPoolConfig
  let mockedAccessControlConfig

  let priceOracle
  let priceOracleAsAlice

  beforeEach(async () => {
    ;({
      priceOracle,
      mockedBookKeeper,
      mockedAccessControlConfig,
    } = await waffle.loadFixture(loadFixtureHandler))

    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedPriceFeed = await smock.fake("MockPriceFeed");


    ;[deployer, alice] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress] = await Promise.all([deployer.getAddress(), alice.getAddress()])

    priceOracleAsAlice = priceOracle.connect(alice)
  })

  describe("#setPrice()", () => {
    context("when price from price feed is 1", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), false])
          mockedBookKeeper.accessControlConfig.returns(mockedCollateralPoolConfig.address)

          mockedCollateralPoolConfig.collateralPools.returns({
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
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedCollateralPoolConfig.setPriceWithSafetyMargin.returns()
          await expect(priceOracle.setPrice(formatBytes32String("BNB")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("BNB"), formatBytes32BigNumber(One), 0)

          expect(mockedPriceFeed.peekPrice).to.be.calledOnce;
          expect(mockedCollateralPoolConfig.setPriceWithSafetyMargin).to.be.calledOnceWith(formatBytes32String("BNB"), BigNumber.from("0"));
        })
      })

      context("and price with safety margin is 10^43", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), true])

          mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10)
          mockedCollateralPoolConfig.collateralPools.returns({
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

          mockedCollateralPoolConfig.setPriceWithSafetyMargin.returns()
          await expect(priceOracle.setPrice(formatBytes32String("BNB")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("BNB"), formatBytes32BigNumber(One), BigNumber.from("10").pow("43"))

          expect(mockedPriceFeed.peekPrice).to.be.calledOnce;

          expect(mockedCollateralPoolConfig.setPriceWithSafetyMargin).to.be.calledOnceWith(formatBytes32String("BNB"), BigNumber.from("10").pow("43"));
        })
      })

      context("and price with safety margin is 9.31322574615478515625 * 10^53", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          mockedCollateralPoolConfig.getLiquidationRatio.returns(4 ** 10)

          mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), true])

          mockedCollateralPoolConfig.collateralPools.returns({
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

          mockedCollateralPoolConfig.setPriceWithSafetyMargin.returns()
          await expect(priceOracle.setPrice(formatBytes32String("BNB")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(
              formatBytes32String("BNB"),
              formatBytes32BigNumber(One),
              BigNumber.from("931322574615478515625").mul(BigNumber.from("10").pow("33"))
            )

          expect(mockedPriceFeed.peekPrice).to.be.calledOnce;
          expect(mockedCollateralPoolConfig.setPriceWithSafetyMargin).to.be.calledOnceWith(formatBytes32String("BNB"), BigNumber.from("931322574615478515625").mul(BigNumber.from("10").pow("33")));
        })
      })
    })

    context("when price from price feed is 7 * 10^11", () => {
      context("and price with safety margin is 0", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          mockedCollateralPoolConfig.collateralPools.returns({
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

          mockedPriceFeed.peekPrice.returns([
            formatBytes32BigNumber(BigNumber.from("700000000000")),
            false,
          ])

          mockedCollateralPoolConfig.setPriceWithSafetyMargin.returns()
          await expect(priceOracle.setPrice(formatBytes32String("BNB")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(formatBytes32String("BNB"), formatBytes32BigNumber(BigNumber.from("700000000000")), 0)

          expect(mockedPriceFeed.peekPrice).to.be.calledOnce;
          expect(mockedCollateralPoolConfig.setPriceWithSafetyMargin).to.be.calledOnceWith(formatBytes32String("BNB"), BigNumber.from("0"));
        })
      })

      context("and price with safety margin is 7 * 10^54", () => {
        it("should be success", async () => {
          mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
          mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
          mockedAccessControlConfig.hasRole.returns(true)

          mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10)

          mockedPriceFeed.peekPrice.returns([
            formatBytes32BigNumber(BigNumber.from("700000000000")),
            true,
          ])

          mockedCollateralPoolConfig.collateralPools.returns({
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

          await expect(priceOracle.setPrice(formatBytes32String("BNB")))
            .to.emit(priceOracle, "LogSetPrice")
            .withArgs(
              formatBytes32String("BNB"),
              formatBytes32BigNumber(BigNumber.from("700000000000")),
              BigNumber.from("7").mul(BigNumber.from("10").pow("54"))
            )

          expect(mockedPriceFeed.peekPrice).to.be.calledOnce;
          expect(mockedCollateralPoolConfig.setPriceWithSafetyMargin).to.be.calledOnceWith(formatBytes32String("BNB"), BigNumber.from("7").mul(BigNumber.from("10").pow("54")));
        })
      })
    })
  })

  describe("#setStableCoinReferencePrice", () => {
    context("when the caller is not the owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(priceOracleAsAlice.setStableCoinReferencePrice(10 ** 10)).to.be.revertedWith("!ownerRole")
      })
    })
    context("when the caller is the owner", async () => {
      context("when priceOracle does not live", () => {
        it("should be revert", async () => {
          mockedAccessControlConfig.hasRole.returns(true)

          priceOracle.cage()

          await expect(priceOracle.setStableCoinReferencePrice(10 ** 10)).to.be.revertedWith("PriceOracle/not-live")
        })
      })
      context("when priceOracle is live", () => {
        it("should be able to call setStableCoinReferencePrice", async () => {
          await expect(priceOracle.setStableCoinReferencePrice(10 ** 10))
            .to.emit(priceOracle, "LogSetStableCoinReferencePrice")
            .withArgs(deployerAddress, 10 ** 10)
        })
      })
    })
  })

  describe("#pause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(priceOracleAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true)

          await priceOracle.pause()
        })
      })
    })

    context("when pause contract", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10)

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), true])

        await priceOracle.pause()

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), false])
        mockedCollateralPoolConfig.collateralPools.returns({
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

        mockedCollateralPoolConfig.setPriceWithSafetyMargin.returns()
        await expect(priceOracle.setPrice(formatBytes32String("BNB"))).to.be.revertedWith("Pausable: paused")
      })
    })
  })

  describe("#unpause", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(priceOracleAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })

    context("when role can access", () => {
      context("and role is owner role", () => {
        it("should be success", async () => {
          mockedAccessControlConfig.hasRole.returns(true)

          await priceOracle.pause()
          await priceOracle.unpause()
        })
      })
    })

    context("when unpause contract", () => {
      it("should be success", async () => {
        mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
        mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address)
        mockedAccessControlConfig.hasRole.returns(true)

        mockedCollateralPoolConfig.getLiquidationRatio.returns(10 ** 10)

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), true])

        // pause contract
        await priceOracle.pause()

        // unpause contract
        await priceOracle.unpause()

        mockedPriceFeed.peekPrice.returns([formatBytes32BigNumber(One), false])
        mockedCollateralPoolConfig.collateralPools.returns({
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

        mockedCollateralPoolConfig.setPriceWithSafetyMargin.returns()
        await expect(priceOracle.setPrice(formatBytes32String("BNB")))
          .to.emit(priceOracle, "LogSetPrice")
          .withArgs(formatBytes32String("BNB"), formatBytes32BigNumber(One), 0)

          expect(mockedPriceFeed.peekPrice).to.be.calledOnce;
          expect(mockedCollateralPoolConfig.setPriceWithSafetyMargin).to.be.calledOnceWith(formatBytes32String("BNB"), BigNumber.from("0"));
      })
    })
  })

  describe("#cage()", () => {
    context("when role can't access", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(priceOracleAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 0", async () => {
          mockedAccessControlConfig.hasRole.returns(true)

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
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(priceOracleAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
      })
    })

    context("when role can access", () => {
      context("caller is owner role ", () => {
        it("should be set live to 1", async () => {
          mockedAccessControlConfig.hasRole.returns(true)

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
