const { ethers } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32String } = ethers.utils

const { DeployerAddress, AddressOne, AddressTwo } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerWad } = require("../../helper/unit");
const { latest } = require("../../helper/time");
const { loadFixture } = require("../../helper/fixtures");

const token0Address = AddressOne
const token1Address = AddressTwo

const nHoursAgoInSec = (now, n) => {
    return now.sub(n * 60 * 60)
}

const loadFixtureHandler = async () => {
    const mockedFathomOracleA = await createMock("MockFathomOracle");
    const mockedFathomOracleB = await createMock("MockFathomOracle");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");

    const strictFathomOraclePriceFeed = getContract("StrictFathomOraclePriceFeed", DeployerAddress)

    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))

    const now = await latest()
    await mockedFathomOracleA.mock.getPrice.returns(0, nHoursAgoInSec(now, 25))
    await mockedFathomOracleB.mock.getPrice.returns(0, nHoursAgoInSec(now, 1))

    await strictFathomOraclePriceFeed.initialize(
        mockedFathomOracleA.address,
        token0Address,
        token1Address,
        mockedFathomOracleB.address,
        token0Address,
        token1Address,
        mockedAccessControlConfig.address,
    )

    return {
        strictFathomOraclePriceFeed,
        mockedFathomOracleA,
        mockedFathomOracleB,
        mockedAccessControlConfig
    }
}

describe("StrictFathomOraclePriceFeed", () => {
    // Contracts
    let strictFathomOraclePriceFeed
    let mockedFathomOracleA
    let mockedFathomOracleB
    let mockedAccessControlConfig

    before(async () => {
        await snapshot.revertToSnapshot();
        await Promise.all([deployer.deploy(artifacts.require('StrictFathomOraclePriceFeed.sol'), { gas: 5050000 })]);
        await snapshot.takeSnapshot();
    })

    beforeEach(async () => {
        ({
            strictFathomOraclePriceFeed,
            mockedFathomOracleA,
            mockedFathomOracleB,
            mockedAccessControlConfig
        } = await loadFixture(loadFixtureHandler))
    })

    describe("#peekPrice()", () => {
        context("when priceLife is 24 hours", () => {
            context("when primary alpacaOracle returns 25 hours old price", () => {
                it("should be able to get price with okFlag = false, with price from primary", async () => {
                    const now = await latest()

                    await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 25))
                    await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(99), nHoursAgoInSec(now, 1))

                    const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(100))
                    expect(ok).to.be.false
                })
            })
            context("when secondary alpacaOracle returns 25 hours old price", () => {
                it("should be able to get price with okFlag = false, with price from primary", async () => {
                    const now = await latest()

                    await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 1))
                    await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(99), nHoursAgoInSec(now, 25))

                    const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(100))
                    expect(ok).to.be.false
                })
            })
            context("when both alpacaOracle returns 1 hours old price", () => {
                it("should be able to get price with okFlag = true, with price from primary", async () => {
                    const now = await latest()

                    await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 1))
                    await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(99), nHoursAgoInSec(now, 1))

                    const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(100))
                    expect(ok).to.be.true
                })
            })
        })
        context("when maxPriceDiff is 10500 (5%)", () => {
            context("when primary returns price = 100 WAD, secondary returns price = 106 WAD (diff -6%)", () => {
                it("should be able to get price with okFlag = false (primary price too low)", async () => {
                    const now = await latest()

                    await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 1))
                    await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(106), nHoursAgoInSec(now, 1))

                    const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(100))
                    expect(ok).to.be.false
                })
            })
            context("when primary returns price = 106 WAD, secondary returns price = 100 WAD (diff +6%)", () => {
                it("should be able to get price with okFlag = false (primary price too high)", async () => {
                    const now = await latest()

                    await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(106), nHoursAgoInSec(now, 1))
                    await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 1))

                    const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(106))
                    expect(ok).to.be.false
                })
            })
            context("when primary returns price = 100 WAD, secondary returns price = 105 WAD (diff -5%)", () => {
                it("should be able to get price with okFlag = true", async () => {
                    const now = await latest()

                    await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 1))
                    await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(105), nHoursAgoInSec(now, 1))

                    const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(100))
                    expect(ok).to.be.true
                })
            })
            context("when primary returns price = 105 WAD, secondary returns price = 100 WAD (diff +5%)", () => {
                it("should be able to get price with okFlag = true", async () => {
                    const now = await latest()

                    await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(105), nHoursAgoInSec(now, 1))
                    await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 1))

                    const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(105))
                    expect(ok).to.be.true
                })
            })
        })
        context("when in paused state", () => {
            it("should be able to get price with okFlag = false", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await strictFathomOraclePriceFeed.pause()

                const now = await latest()

                await mockedFathomOracleA.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(100), nHoursAgoInSec(now, 1))
                await mockedFathomOracleB.mock.getPrice.withArgs(token0Address, token1Address).returns(WeiPerWad.mul(99), nHoursAgoInSec(now, 1))

                const [price, ok] = await strictFathomOraclePriceFeed.peekPrice()
                expect(price).to.be.equal(WeiPerWad.mul(100))
                expect(ok).to.be.false
            })
        })
    })
})
