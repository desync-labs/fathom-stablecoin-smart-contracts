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
  const mockedFathomOracle = await smock.fake("MockFathomOracle");
  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");

  // Deploy FathomOraclePriceFeed
  const FathomOraclePriceFeed = (await ethers.getContractFactory(
    "FathomOraclePriceFeed",
    deployer
  ))
  const alpacaOraclePriceFeed = (await upgrades.deployProxy(FathomOraclePriceFeed, [
    mockedFathomOracle.address,
    token0Address,
    token1Address,
    mockedAccessControlConfig.address,
  ]))
  await alpacaOraclePriceFeed.deployed()

  return { alpacaOraclePriceFeed, mockedFathomOracle, mockedAccessControlConfig }
}

describe("FathomOraclePriceFeed", () => {
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
  let alpacaOraclePriceFeed
  let mockedFathomOracle
  let mockedAccessControlConfig
  let alpacaOraclePriceFeedAsAlice
  let alpacaOraclePriceFeedAsBob

  beforeEach(async () => {
    ;({ alpacaOraclePriceFeed, mockedFathomOracle, mockedAccessControlConfig } = await waffle.loadFixture(
      loadFixtureHandler
    ))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    alpacaOraclePriceFeedAsAlice = alpacaOraclePriceFeed.connect(alice)
    alpacaOraclePriceFeedAsBob = alpacaOraclePriceFeed.connect(bob)
  })

  describe("#peekPrice()", () => {
    context("when priceLife is 24 hours", () => {
      context("when alpacaOracle returns 25 hours old price", () => {
        it("should be able to get price with okFlag = false", async () => {
          mockedFathomOracle.getPrice.reset();
          const now = await latest()

          mockedFathomOracle.getPrice.returns([WeiPerWad.mul(10), nHoursAgoInSec(now, 25)])

          const [price, ok] = await alpacaOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(10))
          expect(ok).to.be.false

          expect(mockedFathomOracle.getPrice).to.be.calledOnceWith(token0Address, token1Address);
        })
      })
      context("when alpacaOracle returns 23 hours old price", () => {
        it("should be able to get price with okFlag = true", async () => {
          mockedFathomOracle.getPrice.reset();
          const now = await latest()

          mockedFathomOracle.getPrice.returns([WeiPerWad.mul(10), nHoursAgoInSec(now, 23)])
          mockedAccessControlConfig.hasRole.returns(true)

          const [price, ok] = await alpacaOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(10))
          expect(ok).to.be.true

          expect(mockedFathomOracle.getPrice).to.be.calledOnceWith(token0Address, token1Address);
        })
      })
    })
    context("when priceLife is 2 hour", () => {
      context("when alpacaOracle returns 3 hour old price", () => {
        it("should be able to get price with okFlag = false", async () => {
          mockedFathomOracle.getPrice.reset();
          const now = await latest()

          mockedFathomOracle.getPrice.returns([WeiPerWad.mul(10), nHoursAgoInSec(now, 3)])
          mockedAccessControlConfig.hasRole.returns(true)

          await alpacaOraclePriceFeed.setPriceLife(2 * 60 * 60)
          const [price, ok] = await alpacaOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(10))
          expect(ok).to.be.false

          expect(mockedFathomOracle.getPrice).to.be.calledOnceWith(token0Address, token1Address);
        })
      })
      context("when alpacaOracle returns 1 hours old price", () => {
        it("should be able to get price with okFlag = true", async () => {
          mockedFathomOracle.getPrice.reset();
          const now = await latest()
          mockedFathomOracle.getPrice.returns([WeiPerWad.mul(10), nHoursAgoInSec(now, 1)])
          mockedAccessControlConfig.hasRole.returns(true)

          await alpacaOraclePriceFeed.setPriceLife(2 * 60 * 60)
          const [price, ok] = await alpacaOraclePriceFeed.peekPrice()
          expect(price).to.be.equal(WeiPerWad.mul(10))
          expect(ok).to.be.true

          expect(mockedFathomOracle.getPrice).to.be.calledOnceWith(token0Address, token1Address);
        })
      })
    })

    context("when FathomOraclePriceFeed is in paused state", () => {
      it("should always return okFlag = false no matter what the alpacaOracle says", async () => {
        mockedFathomOracle.getPrice.reset();
        // return the price with last update nearly to present
        const now = await latest()
        mockedFathomOracle.getPrice.returns([WeiPerWad.mul(10), nHoursAgoInSec(now, 0)])
        mockedAccessControlConfig.hasRole.returns(true)

        await alpacaOraclePriceFeed.pause()
        const [price, ok] = await alpacaOraclePriceFeed.peekPrice()
        expect(price).to.be.equal(WeiPerWad.mul(10))
        expect(ok).to.be.false

        expect(mockedFathomOracle.getPrice).to.be.calledOnceWith(token0Address, token1Address);
      })
    })
  })
  describe("#pause(), #unpause()", () => {
    context("when caller is not the owner", () => {
      it("should revert", async () => {
        mockedFathomOracle.getPrice.reset();
        mockedAccessControlConfig.hasRole.returns(false)

        await expect(alpacaOraclePriceFeedAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
        await expect(alpacaOraclePriceFeedAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
      })
    })
    context("when caller is the owner", () => {
      it("should be able to call pause and unpause perfectly", async () => {
        mockedAccessControlConfig.hasRole.returns(true)

        expect(await alpacaOraclePriceFeedAsAlice.paused()).to.be.false
        await alpacaOraclePriceFeedAsAlice.pause()
        expect(await alpacaOraclePriceFeedAsAlice.paused()).to.be.true
        await alpacaOraclePriceFeedAsAlice.unpause()
        expect(await alpacaOraclePriceFeedAsAlice.paused()).to.be.false
      })
    })
  })
})
