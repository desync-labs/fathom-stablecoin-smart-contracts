require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");

const { WeiPerWad } = require("../../helper/unit");
const { latest } = require("../../helper/time");
const { AddressOne, AddressTwo } = require("../../helper/address");


chai.use(smock.matchers)
const { expect } = chai

const token0Address = AddressOne
const token1Address = AddressTwo

const nHoursAgoInSec = (now, n) => {
  return now.sub(n * 60 * 60)
}

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  // Deploy mocked FathomOracle
  const mockedFathomOracleA = await smock.fake("MockFathomOracle");
  const mockedFathomOracleB = await smock.fake("MockFathomOracle");
  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");

  // Deploy StrictFathomOraclePriceFeed
  const StrictFathomOraclePriceFeed = (await ethers.getContractFactory(
    "StrictFathomOraclePriceFeed",
    deployer
  ))
  const strictFathomOraclePriceFeed = (await upgrades.deployProxy(StrictFathomOraclePriceFeed, [
    mockedFathomOracleA.address,
    token0Address,
    token1Address,
    mockedFathomOracleB.address,
    token0Address,
    token1Address,
    mockedAccessControlConfig.address,
  ]))
  await strictFathomOraclePriceFeed.deployed()

  return { strictFathomOraclePriceFeed, mockedFathomOracleA, mockedFathomOracleB, mockedAccessControlConfig }
}

describe("StrictFathomOraclePriceFeed", () => {
  // Accounts
  let deployer
  let alice
  let bob
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let bobAddress
  let devAddress

  // Contracts
  let strictFathomOraclePriceFeed
  let mockedFathomOracleA
  let mockedFathomOracleB
  let mockedAccessControlConfig

  const loadFixtureHandler = async () => {
    const [deployer] = await ethers.getSigners()
  
    // Deploy mocked FathomOracle
    const mockedFathomOracleA = await smock.fake("MockFathomOracle");
    const mockedFathomOracleB = await smock.fake("MockFathomOracle");
    const mockedAccessControlConfig = await smock.fake("AccessControlConfig");
  
    // Deploy StrictFathomOraclePriceFeed
    const StrictFathomOraclePriceFeed = (await ethers.getContractFactory(
      "StrictFathomOraclePriceFeed",
      deployer
    ))
    const strictFathomOraclePriceFeed = (await upgrades.deployProxy(StrictFathomOraclePriceFeed, [
      mockedFathomOracleA.address,
      token0Address,
      token1Address,
      mockedFathomOracleB.address,
      token0Address,
      token1Address,
      mockedAccessControlConfig.address,
    ]))
    await strictFathomOraclePriceFeed.deployed()
  
    return { strictFathomOraclePriceFeed, mockedFathomOracleA, mockedFathomOracleB, mockedAccessControlConfig }
  }

  beforeEach(async () => {
    ;({ strictFathomOraclePriceFeed, mockedFathomOracleA, mockedFathomOracleB, mockedAccessControlConfig } =
      await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    alpacaOraclePriceFeedAsAlice = strictFathomOraclePriceFeed.connect(alice)
    alpacaOraclePriceFeedAsBob = strictFathomOraclePriceFeed.connect(bob)
  })

  describe("#peekPrice()", () => {
    const assertGetPriceCall = (calls) => {
      expect(calls).to.be.calledOnceWith(token0Address, token1Address);
    }

    // We need to reset calls array because getPrice is called during the initialization
    const resetCalls = () => {
      mockedFathomOracleA.getPrice.reset();
      mockedFathomOracleB.getPrice.reset();
    }

    context("when priceLife is 24 hours", () => {
      context("when primary alpacaOracle returns 25 hours old price", () => {
        it("should be able to get price with okFlag = false, with price from primary", async () => {
          const now = await latest()
          
          resetCalls();
          
          mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 25)])
          mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(99), nHoursAgoInSec(now, 1)])

          const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(100))
          expect(ok).to.be.false

          assertGetPriceCall(mockedFathomOracleA.getPrice)
          assertGetPriceCall(mockedFathomOracleB.getPrice)
        })
      })
      context("when secondary alpacaOracle returns 25 hours old price", () => {
        it("should be able to get price with okFlag = false, with price from primary", async () => {
          const now = await latest()

          resetCalls();

          mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 1)])
          mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(99), nHoursAgoInSec(now, 25)])

          const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(100))
          expect(ok).to.be.false

          assertGetPriceCall(mockedFathomOracleA.getPrice)
          assertGetPriceCall(mockedFathomOracleB.getPrice)
        })
      })
      context("when both alpacaOracle returns 1 hours old price", () => {
        it("should be able to get price with okFlag = true, with price from primary", async () => {
          const now = await latest()

          resetCalls();

          mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 1)])
          mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(99), nHoursAgoInSec(now, 1)])

          const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(100))
          expect(ok).to.be.true

          assertGetPriceCall(mockedFathomOracleA.getPrice)
          assertGetPriceCall(mockedFathomOracleB.getPrice)
        })
      })
    })
    context("when maxPriceDiff is 10500 (5%)", () => {
      context("when primary returns price = 100 WAD, secondary returns price = 106 WAD (diff -6%)", () => {
        it("should be able to get price with okFlag = false (primary price too low)", async () => {
          const now = await latest()

          resetCalls();

          mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 1)])
          mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(106), nHoursAgoInSec(now, 1)])

          const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(100))
          expect(ok).to.be.false

          assertGetPriceCall(mockedFathomOracleA.getPrice)
          assertGetPriceCall(mockedFathomOracleB.getPrice)
        })
      })
      context("when primary returns price = 106 WAD, secondary returns price = 100 WAD (diff +6%)", () => {
        it("should be able to get price with okFlag = false (primary price too high)", async () => {
          const now = await latest()

          resetCalls();

          mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(106), nHoursAgoInSec(now, 1)])
          mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 1)])

          const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(106))
          expect(ok).to.be.false

          assertGetPriceCall(mockedFathomOracleA.getPrice)
          assertGetPriceCall(mockedFathomOracleB.getPrice)
        })
      })
      context("when primary returns price = 100 WAD, secondary returns price = 105 WAD (diff -5%)", () => {
        it("should be able to get price with okFlag = true", async () => {
          const now = await latest()

          resetCalls();

          mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 1)])
          mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(105), nHoursAgoInSec(now, 1)])

          const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(100))
          expect(ok).to.be.true

          assertGetPriceCall(mockedFathomOracleA.getPrice)
          assertGetPriceCall(mockedFathomOracleB.getPrice)
        })
      })
      context("when primary returns price = 105 WAD, secondary returns price = 100 WAD (diff +5%)", () => {
        it("should be able to get price with okFlag = true", async () => {
          const now = await latest()

          resetCalls();

          mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(105), nHoursAgoInSec(now, 1)])
          mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 1)])

          const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(105))
          expect(ok).to.be.true

          assertGetPriceCall(mockedFathomOracleA.getPrice)
          assertGetPriceCall(mockedFathomOracleB.getPrice)
        })
      })
    })
    context("when in paused state", () => {
      it("should be able to get price with okFlag = false", async () => {
        mockedAccessControlConfig.hasRole.returns(true)
        await strictFathomOraclePriceFeed.pause()

        resetCalls();

        const now = await latest()

        mockedFathomOracleA.getPrice.returns([WeiPerWad.mul(100), nHoursAgoInSec(now, 1)])
        mockedFathomOracleB.getPrice.returns([WeiPerWad.mul(99), nHoursAgoInSec(now, 1)])

        const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
        expect(price).to.be.equal(WeiPerWad.mul(100))
        expect(ok).to.be.false

        assertGetPriceCall(mockedFathomOracleA.getPrice)
        assertGetPriceCall(mockedFathomOracleB.getPrice)
      })
    })
  })
})
