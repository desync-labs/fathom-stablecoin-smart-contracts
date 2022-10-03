require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");

const TimeHelpers = require("../../helper/time");
const { formatBytes32BigNumber } = require("../../helper/format");
const { BigNumber } = require("ethers");

chai.use(smock.matchers);
const { expect } = chai

const ORACLE_TIME_DELAY = 900

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()

  // Deploy mocked FathomOracle
  const MockPriceFeed = (await ethers.getContractFactory("MockPriceFeed", deployer))

  const mockedIbBasePriceFeed = await smock.fake("MockPriceFeed");
  const mockedBaseUsdPriceFeed = await smock.fake("MockPriceFeed");
  const mockedAccessControlConfig = await smock.fake("AccessControlConfig");

  // Deploy IbTokenPriceFeed
  const IbTokenPriceFeed = (await ethers.getContractFactory("IbTokenPriceFeed", deployer))
  const ibTokenPriceFeed = (await upgrades.deployProxy(IbTokenPriceFeed, [
    mockedIbBasePriceFeed.address,
    mockedBaseUsdPriceFeed.address,
    mockedAccessControlConfig.address,
    ORACLE_TIME_DELAY,
  ]))
  await ibTokenPriceFeed.deployed()

  return { ibTokenPriceFeed, mockedIbBasePriceFeed, mockedBaseUsdPriceFeed, mockedAccessControlConfig }
}

describe("IbTokenPriceFeed", () => {
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
  let ibTokenPriceFeed
  let mockedIbBasePriceFeed
  let mockedBaseUsdPriceFeed
  let mockedAccessControlConfig
  let ibTokenPriceFeedAsAlice
  let ibTokenPriceFeedAsBob

  beforeEach(async () => {
    ;({ ibTokenPriceFeed, mockedIbBasePriceFeed, mockedBaseUsdPriceFeed, mockedAccessControlConfig } =
      await waffle.loadFixture(loadFixtureHandler))
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    ibTokenPriceFeedAsAlice = ibTokenPriceFeed.connect(alice)
    ibTokenPriceFeedAsBob = ibTokenPriceFeed.connect(bob)
  })

  describe("#peekPrice()", () => {
    const assertPeekPriceCall = (calls) => {
      expect(calls).to.be.calledOnce
    }

    // We need to reset calls array because getPrice is called during the initialization
    const resetCalls = () => {
      mockedIbBasePriceFeed.peekPrice.reset();
      mockedBaseUsdPriceFeed.peekPrice.reset();
    }


    context("when ibInBasePriceFeed returns ok=false", () => {
      it("should be able to get price with okFlag = false", async () => {
        resetCalls();

        // 1 ibBNB = 1.1 BNB
        mockedIbBasePriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("1.1")), false])
        // 1 BNB = 400 USD
        mockedBaseUsdPriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("400")), true])

        await expect(ibTokenPriceFeed.setPrice()).to.be.revertedWith("IbTokenPriceFeed/not-ok")
        assertPeekPriceCall(mockedIbBasePriceFeed.peekPrice)
        assertPeekPriceCall(mockedBaseUsdPriceFeed.peekPrice)

        const [price, ok] = await ibTokenPriceFeed.peekPrice()
        expect(BigNumber.from(price)).to.be.equal(0)
        expect(ok).to.be.false
      })
    })
    context("when baseInUsdPriceFeed returns ok=false", () => {
      it("should be able to get price with okFlag = false", async () => {
        resetCalls();
        
        // 1 ibBNB = 1.1 BNB
        mockedIbBasePriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("1.1")), true])
        // 1 BNB = 400 USD
        mockedBaseUsdPriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("400")), false])

        await expect(ibTokenPriceFeed.setPrice()).to.be.revertedWith("IbTokenPriceFeed/not-ok")
        assertPeekPriceCall(mockedIbBasePriceFeed.peekPrice)
        assertPeekPriceCall(mockedBaseUsdPriceFeed.peekPrice)

        const [price, ok] = await ibTokenPriceFeed.peekPrice()
        expect(BigNumber.from(price)).to.be.equal(0)
        expect(ok).to.be.false
      })
    })
    context("when both returns ok=true", () => {
      it("should be able to get price with okFlag = true", async () => {
        resetCalls();
        
        // 1 ibBNB = 1.1 BNB
        mockedIbBasePriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("1.1")), true])
        // 1 BNB = 400 USD
        mockedBaseUsdPriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("400")), true])

        await ibTokenPriceFeed.setPrice()
        assertPeekPriceCall(mockedIbBasePriceFeed.peekPrice)
        assertPeekPriceCall(mockedBaseUsdPriceFeed.peekPrice)

        TimeHelpers.increase(BigNumber.from(900))
        await ibTokenPriceFeed.setPrice()
        const [price, ok] = await ibTokenPriceFeed.peekPrice()
        expect(BigNumber.from(price)).to.be.equal(parseEther("440"))
        expect(ok).to.be.true
      })
    })
    context("when contract is in paused state", () => {
      it("should be able to get price with okFlag = false", async () => {
        resetCalls();
        
        mockedAccessControlConfig.hasRole.returns(true)
        await ibTokenPriceFeed.pause()

        // 1 ibBNB = 1.1 BNB
        mockedIbBasePriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("1.1")), true])
        // 1 BNB = 400 USD
        mockedBaseUsdPriceFeed.peekPrice.returns([formatBytes32BigNumber(parseEther("400")), true])

        await expect(ibTokenPriceFeed.setPrice()).to.reverted
      })
    })
  })
})
