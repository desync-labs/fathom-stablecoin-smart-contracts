const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32String } = ethers.utils

const { DeployerAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { parseEther } = require("ethers/lib/utils");
const TimeHelpers = require("../../helper/time");
const { formatBytes32BigNumber } = require("../../helper/format");
const { loadFixture } = require("../../helper/fixtures");

const ORACLE_TIME_DELAY = 900

const loadFixtureHandler = async () => {
    const mockedIbBasePriceFeed = await createMock("MockPriceFeed");
    const mockedBaseUsdPriceFeed = await createMock("MockPriceFeed");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");

    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)
    await mockedIbBasePriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("1")), true)
    await mockedBaseUsdPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("1")), true)

    const ibTokenPriceFeed = getContract("IbTokenPriceFeed", DeployerAddress)

    await ibTokenPriceFeed.initialize(
        mockedIbBasePriceFeed.address,
        mockedBaseUsdPriceFeed.address,
        mockedAccessControlConfig.address,
        ORACLE_TIME_DELAY,
    )

    return {
        ibTokenPriceFeed,
        mockedIbBasePriceFeed,
        mockedBaseUsdPriceFeed,
        mockedAccessControlConfig
    }
}
describe("IbTokenPriceFeed", () => {
    // Contracts
    let ibTokenPriceFeed
    let mockedIbBasePriceFeed
    let mockedBaseUsdPriceFeed
    let mockedAccessControlConfig

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            ibTokenPriceFeed,
            ibTokenPriceFeedAsAlice,
            ibTokenPriceFeedAsBob,
            mockedIbBasePriceFeed,
            mockedBaseUsdPriceFeed,
            mockedAccessControlConfig
        } = await loadFixture(loadFixtureHandler))

    })

    describe("#peekPrice()", () => {
        context("when ibInBasePriceFeed returns ok=false", () => {
            it("should be able to get price with okFlag = false", async () => {
                // 1 ibBNB = 1.1 BNB
                await mockedIbBasePriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("1.1")), false)
                // 1 BNB = 400 USD
                await mockedBaseUsdPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("400")), true)

                await expect(ibTokenPriceFeed.setPrice()).to.be.revertedWith("IbTokenPriceFeed/not-ok")

                const [price, ok] = await ibTokenPriceFeed.peekPrice()
                expect(BigNumber.from(price)).to.be.equal(0)
                expect(ok).to.be.false
            })
        })
        context("when baseInUsdPriceFeed returns ok=false", () => {
            it("should be able to get price with okFlag = false", async () => {
                // 1 ibBNB = 1.1 BNB
                await mockedIbBasePriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("1.1")), true)
                // 1 BNB = 400 USD
                await mockedBaseUsdPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("400")), false)

                await expect(ibTokenPriceFeed.setPrice()).to.be.revertedWith("IbTokenPriceFeed/not-ok")

                const [price, ok] = await ibTokenPriceFeed.peekPrice()
                expect(BigNumber.from(price)).to.be.equal(0)
                expect(ok).to.be.false
            })
        })
        context("when both returns ok=true", () => {
            it("should be able to get price with okFlag = true", async () => {
                // 1 ibBNB = 1.1 BNB
                await mockedIbBasePriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("1.1")), true)
                // 1 BNB = 400 USD
                await mockedBaseUsdPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("400")), true)

                await ibTokenPriceFeed.setPrice()

                TimeHelpers.increase(BigNumber.from(900))
                await ibTokenPriceFeed.setPrice()
                const [price, ok] = await ibTokenPriceFeed.peekPrice()
                expect(BigNumber.from(price)).to.be.equal(parseEther("440"))
                expect(ok).to.be.true
            })
        })
        context("when contract is in paused state", () => {
            it("should be able to get price with okFlag = false", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await ibTokenPriceFeed.pause()

                // 1 ibBNB = 1.1 BNB
                await mockedIbBasePriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("1.1")), true)
                // 1 BNB = 400 USD
                await mockedBaseUsdPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(parseEther("400")), true)

                await expect(ibTokenPriceFeed.setPrice()).to.reverted
            })
        })
    })
})
