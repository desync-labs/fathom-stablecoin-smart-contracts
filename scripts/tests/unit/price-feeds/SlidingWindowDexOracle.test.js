const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = require("chai");

const { AliceAddress, BobAddress, DeployerAddress } = require("../../helper/address");
const { loadFixture } = require("../../helper/fixtures");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRad, WeiPerWad } = require("../../helper/unit")
const { increase, latest, getBlockTS } = require('../../helper/time');
const { BigNumber } = require('ethers');
const { assertAlmostEqual } = require('../../helper/assert');
const Resolution = BigNumber.from("5192296858534827628530496329220096")

const setup = async () => {
    const slidingWindowDexOracle = getContract("SlidingWindowDexOracle", DeployerAddress);
    const mockedFactory = await createMock("IFathomSwapFactory")
    const mockedPair = await createMock("IFathomSwapPair")
    const mockedStablecoin = await createMock("FathomStablecoin");
    const mockedUSD = await createMock("ERC20Mintable");
    await slidingWindowDexOracle.initialize(mockedFactory.address, 900, 3)

    return { slidingWindowDexOracle, mockedFactory, mockedPair, mockedStablecoin, mockedUSD }
}

describe("SlidingWindowDexOracle", () => {
    // Contract
    let slidingWindowDexOracle
    let mockedPair
    let mockedStablecoin
    let mockedUSD
    let mockedFactory

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({ slidingWindowDexOracle, mockedFactory, mockedPair, mockedStablecoin, mockedUSD } = await loadFixture(setup));
    })

    describe("#update()", async () => {
        context("same tokens", async () => {
            xit("should revert", async () => {
                await expect(slidingWindowDexOracle.update(mockedStablecoin.address, mockedStablecoin.address)).to.be.revertedWith("SlidingWindowDexOracle/same-tokens");
            })
        })
        context("price was returned from dex", async () => {
            it("should store the cumulative price", async () => {
                const cumulativePrice0 = WeiPerRad.mul(2)
                const cumulativePrice1 = WeiPerRad

                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockedPair.mock.price0CumulativeLast.returns(cumulativePrice0);
                await mockedPair.mock.price1CumulativeLast.returns(cumulativePrice1);
                await mockedPair.mock.getReserves.returns(WeiPerWad, WeiPerWad.mul(2), (await latest()) - 600);
                
                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);

                const index = await slidingWindowDexOracle.observationIndexOf(await latest());
                const observation = (await slidingWindowDexOracle.pairObservations(mockedPair.address, index))
                const expectedPrice0 = cumulativePrice0.add(WeiPerWad.mul(2).mul(Resolution).div(WeiPerWad).mul(600));
                const expectedPrice1 = cumulativePrice1.add(WeiPerWad.mul(Resolution).div(WeiPerWad.mul(2)).mul(600));

                expect(observation.price0Cumulative).to.be.equal(BigNumber.from(expectedPrice0))
                expect(observation.price1Cumulative).to.be.equal(BigNumber.from(expectedPrice1))
            })
        })
    })

    describe("#getPrice()", async () => {
        context("same tokens", async () => {
            it("should revert", async () => {
                await expect(slidingWindowDexOracle.getPrice(mockedStablecoin.address, mockedStablecoin.address)).to.be.revertedWith("SlidingWindowDexOracle/same-tokens");
            })
        })
        context("historical observation not exists", async () => {
            it("should revert", async () => {
                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockPairPrices(BigNumber.from("10000000000000000000000"), BigNumber.from("20000000000000000000000"), 0, 0);

                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);
                increase(300);

                await expect(slidingWindowDexOracle.getPrice(mockedStablecoin.address, mockedUSD.address)).to.be.revertedWith("SlidingWindowDexOracle/missing-historical-observation");
            })
        })
        context("historical observation exists", async () => {
            it("should store the cumulative price", async () => {
                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockPairPrices(BigNumber.from("10000000000000000000000"), BigNumber.from("20000000000000000000000"), 0, 0);

                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);

                // numbers were taken from the actual fathom swap pair price
                await increase(300);
                await mockPairPrices(
                    BigNumber.from("11000000000000000000000"),
                    BigNumber.from("18186778212239701736838"),
                    BigNumber.from("3156916489989175198146541768165818368"),
                    BigNumber.from("789229122497293799536635442041454592")
                );
                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);

                await increase(300);
                await mockPairPrices(
                    BigNumber.from("9021716403197827754406"),
                    BigNumber.from("22186778212239701736838"),
                    BigNumber.from("5740896177703978601037806152244690497"),
                    BigNumber.from("1734514466497299452615975126943463388")
                );
                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);

                await increase(300);
                await mockPairPrices(
                    BigNumber.from("10021716403197827754406"),
                    BigNumber.from("19978888799326233841056"),
                    BigNumber.from("9597202535219205699004125628603866923"),
                    BigNumber.from("2372133666807708883515158441562161932")
                );
                const t = await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);
                const ts = await getBlockTS(t.blockNumber);

                const firstObservation = await slidingWindowDexOracle.getFirstObservationInWindow(mockedPair.address)
                const currentCumulative = await slidingWindowDexOracle.currentCumulativePrice(mockedPair.address)

                const expectedPrice = BigNumber.from(mockedStablecoin.address).lt(BigNumber.from(mockedUSD.address))
                    ? currentCumulative.price0Cumulative.sub(firstObservation.price0Cumulative).div(ts.sub(firstObservation.timestamp)).mul(WeiPerWad).div(Resolution)
                    : currentCumulative.price1Cumulative.sub(firstObservation.price1Cumulative).div(ts.sub(firstObservation.timestamp)).mul(WeiPerWad).div(Resolution)

                const price = await slidingWindowDexOracle.getPrice(mockedStablecoin.address, mockedUSD.address);

                expect(price.price).to.be.equal(expectedPrice)
            })
        })
        context("historical observation exists but time passed from the last update > time window", async () => {
            it("should revert", async () => {
                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockPairPrices(BigNumber.from("10000000000000000000000"), BigNumber.from("20000000000000000000000"), 0, 0);

                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);

                // numbers were taken from the actual fathom swap pair price
                await increase(300);
                await mockPairPrices(
                    BigNumber.from("11000000000000000000000"),
                    BigNumber.from("18186778212239701736838"),
                    BigNumber.from("3156916489989175198146541768165818368"),
                    BigNumber.from("789229122497293799536635442041454592")
                );
                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);

                await increase(300);
                await mockPairPrices(
                    BigNumber.from("9021716403197827754406"),
                    BigNumber.from("22186778212239701736838"),
                    BigNumber.from("5740896177703978601037806152244690497"),
                    BigNumber.from("1734514466497299452615975126943463388")
                );
                await slidingWindowDexOracle.update(mockedStablecoin.address, mockedUSD.address);

                await increase(300);
                await mockPairPrices(
                    BigNumber.from("10021716403197827754406"),
                    BigNumber.from("19978888799326233841056"),
                    BigNumber.from("9597202535219205699004125628603866923"),
                    BigNumber.from("2372133666807708883515158441562161932")
                );

                await increase(1000);

                await expect(slidingWindowDexOracle.getPrice(mockedStablecoin.address, mockedUSD.address)).to.be.revertedWith("SlidingWindowDexOracle/missing-historical-observation");
            })
        })
    })


    async function mockPairPrices(r0, r1, c0, c1) {
        if (BigNumber.from(mockedStablecoin.address).lt(BigNumber.from(mockedUSD.address))) {
            await mockedPair.mock.getReserves.returns(r0, r1, await latest());
            await mockedPair.mock.price0CumulativeLast.returns(c0);
            await mockedPair.mock.price1CumulativeLast.returns(c1);
        } else {
            await mockedPair.mock.getReserves.returns(r0, r1, await latest());
            await mockedPair.mock.price0CumulativeLast.returns(c1);
            await mockedPair.mock.price1CumulativeLast.returns(c0);
        }
    }
})