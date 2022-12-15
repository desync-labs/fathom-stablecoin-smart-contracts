const { ethers } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32String } = ethers.utils

const { DeployerAddress, AddressOne, AddressTwo, AliceAddress, BobAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { latest } = require("../../helper/time");
const { loadFixture } = require("../../helper/fixtures");

const token0Address = AddressOne
const token1Address = AddressTwo

const nHoursAgoInSec = (now, n) => {
    return now.sub(n * 60 * 60)
}

const loadFixtureHandler = async () => {
    const mockedFathomOracle = await createMock("DexPriceOracle");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");

    const fathomOraclePriceFeed = getContract("FathomOraclePriceFeed", DeployerAddress)
    const fathomOraclePriceFeedAsAlice = getContract("FathomOraclePriceFeed", AliceAddress)

    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)

    await fathomOraclePriceFeed.initialize(
        mockedFathomOracle.address,
        token0Address,
        token1Address,
        mockedAccessControlConfig.address
    )

    return {
        fathomOraclePriceFeed,
        fathomOraclePriceFeedAsAlice,
        mockedFathomOracle,
        mockedAccessControlConfig
    }
}

describe("FathomOraclePriceFeed", () => {
    // Contracts
    let fathomOraclePriceFeed
    let mockedFathomOracle
    let mockedAccessControlConfig
    let fathomOraclePriceFeedAsAlice


    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            fathomOraclePriceFeed,
            fathomOraclePriceFeedAsAlice,
            mockedFathomOracle,
            mockedAccessControlConfig
        } = await loadFixture(loadFixtureHandler))
    })

    describe("#peekPrice()", () => {
        context("when priceLife is 24 hours", () => {
            context("when alpacaOracle returns 25 hours old price", () => {
                it("should be able to get price with okFlag = false", async () => {
                    const now = await latest()

                    await mockedFathomOracle.mock.getPrice.withArgs(
                        token0Address,
                        token1Address
                    ).returns(WeiPerWad.mul(10), nHoursAgoInSec(now, 25))

                    const [price, ok] = await fathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(10))
                    expect(ok).to.be.false
                })
            })
            context("when alpacaOracle returns 23 hours old price", () => {
                it("should be able to get price with okFlag = true", async () => {
                    const now = await latest()

                    await mockedFathomOracle.mock.getPrice.withArgs(
                        token0Address,
                        token1Address
                    ).returns(WeiPerWad.mul(10), nHoursAgoInSec(now, 23))
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    const [price, ok] = await fathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(10))
                    expect(ok).to.be.true
                })
            })
        })
        context("when priceLife is 2 hour", () => {
            context("when alpacaOracle returns 3 hour old price", () => {
                it("should be able to get price with okFlag = false", async () => {
                    const now = await latest()

                    await mockedFathomOracle.mock.getPrice.withArgs(
                        token0Address,
                        token1Address
                    ).returns(WeiPerWad.mul(10), nHoursAgoInSec(now, 3))
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await fathomOraclePriceFeed.setPriceLife(2 * 60 * 60)
                    const [price, ok] = await fathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(10))
                    expect(ok).to.be.false
                })
            })
            context("when alpacaOracle returns 1 hours old price", () => {
                it("should be able to get price with okFlag = true", async () => {
                    const now = await latest()
                    await mockedFathomOracle.mock.getPrice.withArgs(
                        token0Address,
                        token1Address
                    ).returns(WeiPerWad.mul(10), nHoursAgoInSec(now, 1))
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await fathomOraclePriceFeed.setPriceLife(2 * 60 * 60)
                    const [price, ok] = await fathomOraclePriceFeed.peekPrice()
                    expect(price).to.be.equal(WeiPerWad.mul(10))
                    expect(ok).to.be.true
                })
            })
        })

        context("when FathomOraclePriceFeed is in paused state", () => {
            it("should always return okFlag = false no matter what the alpacaOracle says", async () => {
                // return the price with last update nearly to present
                const now = await latest()
                await mockedFathomOracle.mock.getPrice.withArgs(
                    token0Address,
                    token1Address
                ).returns(WeiPerWad.mul(10), nHoursAgoInSec(now, 0))
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                await fathomOraclePriceFeed.pause()
                const [price, ok] = await fathomOraclePriceFeed.peekPrice()
                expect(price).to.be.equal(WeiPerWad.mul(10))
                expect(ok).to.be.false
            })
        })
    })
    describe("#pause(), #unpause()", () => {
        context("when caller is not the owner", () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(fathomOraclePriceFeedAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
                await expect(fathomOraclePriceFeedAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when caller is the owner", () => {
            it("should be able to call pause and unpause perfectly", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                expect(await fathomOraclePriceFeedAsAlice.paused()).to.be.false
                await fathomOraclePriceFeedAsAlice.pause()
                expect(await fathomOraclePriceFeedAsAlice.paused()).to.be.true
                await fathomOraclePriceFeedAsAlice.unpause()
                expect(await fathomOraclePriceFeedAsAlice.paused()).to.be.false
            })
        })
    })
})
