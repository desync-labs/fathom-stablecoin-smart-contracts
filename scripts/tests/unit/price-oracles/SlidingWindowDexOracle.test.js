const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = require("chai");
const AssertHelpers = require("../../helper/assert");

const { AliceAddress, BobAddress, DeployerAddress } = require("../../helper/address");
const { loadFixture } = require("../../helper/fixtures");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRad, WeiPerWad } = require("../../helper/unit")
const { increase, latest, getBlockTS } = require('../../helper/time');
const { BigNumber } = require('ethers');
const Resolution = BigNumber.from("5192296858534827628530496329220096")

const setup = async () => {
    const slidingWindowDexOracle = getContract("SlidingWindowDexOracle", DeployerAddress);
    const mockedFactory = await createMock("IFathomSwapFactory")
    const mockedPair = await createMock("IFathomSwapPair")
    const mockedToken = await createMock("ERC20Mintable");
    const mockedUSD = await createMock("ERC20Mintable");
    await slidingWindowDexOracle.initialize(mockedFactory.address, 900, 3)

    await mockedToken.mock.decimals.returns(18);
    await mockedUSD.mock.decimals.returns(18);

    return { slidingWindowDexOracle, mockedFactory, mockedPair, mockedToken, mockedUSD }
}

describe("SlidingWindowDexOracle", () => {
    // Contract
    let slidingWindowDexOracle
    let mockedPair
    let mockedToken
    let mockedUSD
    let mockedFactory

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({ slidingWindowDexOracle, mockedFactory, mockedPair, mockedToken, mockedUSD } = await loadFixture(setup));
    })

    describe("#update()", async () => {
        context("same tokens", async () => {
            it("should revert", async () => {
                await expect(slidingWindowDexOracle.update(mockedToken.address, mockedToken.address)).to.be.revertedWith("SlidingWindowDexOracle/same-tokens");
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
                
                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address);

                const index = await slidingWindowDexOracle.observationIndexOf(await latest());
                const observation = (await slidingWindowDexOracle.pairObservations(mockedPair.address, index))
                const expectedPrice0 = cumulativePrice0.add(WeiPerWad.mul(2).mul(Resolution).div(WeiPerWad).mul(600));
                const expectedPrice1 = cumulativePrice1.add(WeiPerWad.mul(Resolution).div(WeiPerWad.mul(2)).mul(600));
    
                AssertHelpers.assertAlmostEqual(
                    observation.price0Cumulative,
                    BigNumber.from(expectedPrice0)
                )
                AssertHelpers.assertAlmostEqual(
                    observation.price1Cumulative,
                    BigNumber.from(expectedPrice1)
                )
            })
        })
    })

    describe("#getPrice()", async () => {
        context("same tokens", async () => {
            it("should revert", async () => {
                await expect(slidingWindowDexOracle.getPrice(mockedToken.address, mockedToken.address)).to.be.revertedWith("SlidingWindowDexOracle/same-tokens");
            })
        })
        context("historical observation not exists", async () => {
            it("should revert", async () => {
                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockPairPrices(BigNumber.from("10000000000000000000000"), BigNumber.from("20000000000000000000000"), 0, 0);

                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address);
                increase(300);

                await expect(slidingWindowDexOracle.getPrice(mockedToken.address, mockedUSD.address)).to.be.revertedWith("SlidingWindowDexOracle/missing-historical-observation");
            })
        })
        context("historical observation exists", async () => {
            it("should store the cumulative price", async () => {
                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockPairPrices(
                    BigNumber.from("11000000000000000000000"),
                    BigNumber.from("18186778212239701736838"),
                    BigNumber.from("3156916489989175198146541768165818368"),
                    BigNumber.from("789229122497293799536635442041454592")
                );
                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});

                // numbers were taken from the actual fathom swap pair price
                await increase(300);
                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});

                await increase(300);
                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address), {gasLimit:200000};

                await increase(300);
                const t = await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});
                const ts = await getBlockTS(t.blockNumber);

                const firstObservation = await slidingWindowDexOracle.getFirstObservationInWindow(mockedPair.address)
                const currentCumulative = await slidingWindowDexOracle.currentCumulativePrice(mockedPair.address)

                const expectedPrice = BigNumber.from(mockedToken.address).lt(BigNumber.from(mockedUSD.address))
                    ? currentCumulative.price0Cumulative.sub(firstObservation.price0Cumulative).div(ts.sub(firstObservation.timestamp)).mul(WeiPerWad).div(Resolution)
                    : currentCumulative.price1Cumulative.sub(firstObservation.price1Cumulative).div(ts.sub(firstObservation.timestamp)).mul(WeiPerWad).div(Resolution)

                const price = await slidingWindowDexOracle.getPrice(mockedToken.address, mockedUSD.address, {gasLimit:200000});

                expect(price.price).to.be.equal(expectedPrice)
            })
            context("different decimals", async () => {
                it("return correct price", async () => {
                    await mockedUSD.mock.decimals.returns(6);
                    await mockedFactory.mock.getPair.returns(mockedPair.address);
                    if (BigNumber.from(mockedToken.address).lt(BigNumber.from(mockedUSD.address))){
                        await mockPairPrices(
                            BigNumber.from("1091000000000000000000"), 
                            BigNumber.from("44958878"), 
                            BigNumber.from("17666766243289253139872640"), 
                            BigNumber.from("10365375295630598348398591781360305351338666666620880") 
                        );
                    } else {
                        await mockPairPrices(
                            BigNumber.from("44958878"), 
                            BigNumber.from("1091000000000000000000"), 
                            BigNumber.from("10365375295630598348398591781360305351338666666620880"),
                            BigNumber.from("17666766243289253139872640")
                        );
                    }

                    await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address);
    
                    // numbers were taken from the actual fathom swap pair price
                    await increase(300);
                    await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});
                    await increase(300);
                    await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});
                    await increase(300);
                  
                    const price0 = await slidingWindowDexOracle.getPrice(mockedToken.address, mockedUSD.address, {gasLimit:200000});
                    const price1 = await slidingWindowDexOracle.getPrice(mockedUSD.address, mockedToken.address, {gasLimit:200000});
    
                    expect(price0.price).to.be.equal("41208870760769935")
                    expect(price1.price).to.be.equal("24266619820894996534")
                    expect(price0.price).to.be.equal("41208870760769935")
                    expect(price1.price).to.be.equal("24266619820894996534")
                })
            })
        })
        context("historical observation exists but time passed from the last update > time window", async () => {
            it("should revert", async () => {
                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockPairPrices(
                    BigNumber.from("11000000000000000000000"),
                    BigNumber.from("18186778212239701736838"),
                    BigNumber.from("3156916489989175198146541768165818368"),
                    BigNumber.from("789229122497293799536635442041454592")
                );
                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});

                // numbers were taken from the actual fathom swap pair price
                await increase(300);
                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});

                await increase(300);
                await slidingWindowDexOracle.update(mockedToken.address, mockedUSD.address, {gasLimit:200000});

                await increase(1300);
                await expect(
                    slidingWindowDexOracle.getPrice(mockedToken.address, mockedUSD.address), {gasLimit:200000}
                ).to.be.revertedWith("SlidingWindowDexOracle/missing-historical-observation");
            })
        })
    })


    async function mockPairPrices(r0, r1, c0, c1) {
        if (BigNumber.from(mockedToken.address).lt(BigNumber.from(mockedUSD.address))) {
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