const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = require("chai");

const { DeployerAddress } = require("../../helper/address");
const { loadFixture } = require("../../helper/fixtures");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerWad } = require("../../helper/unit")
const { latest } = require('../../helper/time');
const { BigNumber } = require('ethers');

const setup = async () => {
    const dexPriceOracle = getContract("DexPriceOracle", DeployerAddress);
    const mockedFactory = await createMock("IFathomSwapFactory")
    const mockedPair = await createMock("IFathomSwapPair")
    const mockedStablecoin = await createMock("FathomStablecoin");
    const mockedUSD = await createMock("ERC20Mintable");

    await dexPriceOracle.initialize(mockedFactory.address)

    return { dexPriceOracle, mockedFactory, mockedPair, mockedStablecoin, mockedUSD }
}

describe("DexPriceOracle", () => {
    // Contract
    let dexPriceOracle
    let mockedPair
    let mockedStablecoin
    let mockedUSD
    let mockedFactory

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({ dexPriceOracle, mockedFactory, mockedPair, mockedStablecoin, mockedUSD } = await loadFixture(setup));
    })

    describe("#getPrice()", async () => {
        context("same tokens", async () => {
            it("should revert", async () => {
                await expect(dexPriceOracle.getPrice(mockedStablecoin.address, mockedStablecoin.address)).to.be.revertedWith("DexPriceOracle/same-tokens");
            })
        })
        context("price was returned from dex", async () => {
            it("should success", async () => {

                await mockedFactory.mock.getPair.returns(mockedPair.address);
                await mockedStablecoin.mock.decimals.returns(BigNumber.from("18"));
                await mockedUSD.mock.decimals.returns(BigNumber.from("18"));

                if(BigNumber.from(mockedStablecoin.address).lt(BigNumber.from(mockedUSD.address))){
                    await mockedPair.mock.getReserves.returns(WeiPerWad, WeiPerWad.mul(2), await latest());
                } else {
                    await mockedPair.mock.getReserves.returns(WeiPerWad.mul(2), WeiPerWad, await latest());
                }
                
                const price0 = await dexPriceOracle.getPrice(mockedStablecoin.address, mockedUSD.address);
                const price1 = await dexPriceOracle.getPrice(mockedUSD.address, mockedStablecoin.address);

                expect(price0[0]).to.be.equal(WeiPerWad.div(2))
                expect(price1[0]).to.be.equal(WeiPerWad.mul(2))
  
            })
        })
    })
})