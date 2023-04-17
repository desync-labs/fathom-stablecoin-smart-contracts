const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { ethers } = require("ethers");

const { WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AddressZero} = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { latest } = require('../../helper/time');
const { formatBytes32String } = ethers.utils

const COLLATERAL_POOL_ID = formatBytes32String("XDC")


describe("CentralizedOraclePriceFeed", () => {
    let mockedCentralizedPriceOracle
    let mockedAccessControlConfig

    const centralizedOraclePriceFeed = getContract("CentralizedOraclePriceFeed", DeployerAddress);

    beforeEach(async () => {
        await snapshot.revertToSnapshot();
        mockedAccessControlConfig = await createMock("AccessControlConfig");
        mockedCentralizedPriceOracle = await createMock("IFathomCentralizedOracle");

        await mockedAccessControlConfig.mock.hasRole.returns(true);
        await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
        await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

        await centralizedOraclePriceFeed.initialize(mockedCentralizedPriceOracle.address, mockedAccessControlConfig.address, COLLATERAL_POOL_ID);
    })

    describe("#setAccessControlConfig()", async () => {
        context("sender isn't owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false);
                await expect(centralizedOraclePriceFeed.setAccessControlConfig(mockedAccessControlConfig.address)).to.be.revertedWith("!ownerRole");
            })
        })

        context("sender isn't ownerfor the new accessc ontrol", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true);
                const mockedAccessControlConfig2 = await createMock("AccessControlConfig");
                await mockedAccessControlConfig2.mock.hasRole.returns(false);
                await mockedAccessControlConfig2.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));

                await expect(centralizedOraclePriceFeed.setAccessControlConfig(mockedAccessControlConfig2.address)).to.be.revertedWith("CentralizedOraclePriceFeed/msgsender-not-owner");
            })
        })

        context("sender isn't ownerfor the new accessc ontrol", async () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true);
                const mockedAccessControlConfig2 = await createMock("AccessControlConfig");
                await mockedAccessControlConfig2.mock.hasRole.returns(true);
                await mockedAccessControlConfig2.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));

                await centralizedOraclePriceFeed.setAccessControlConfig(mockedAccessControlConfig2.address);
                expect(await centralizedOraclePriceFeed.accessControlConfig()).to.be.equal(mockedAccessControlConfig2.address);
            })
        })
    })

    describe("#setPriceLife()", async () => {
        context("sender isn't owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false);
                await expect(centralizedOraclePriceFeed.setPriceLife(900)).to.be.revertedWith("!ownerRole");
            })
        })
        context("price life is less than 5 min", async () => {
            it("should revert", async () => {
                await expect(centralizedOraclePriceFeed.setPriceLife(299)).to.be.revertedWith("CentralizedOraclePriceFeed/bad-price-life");
            })
        })
        context("price life is greater than 1 day", async () => {
            it("should revert", async () => {
                await expect(centralizedOraclePriceFeed.setPriceLife(86401)).to.be.revertedWith("CentralizedOraclePriceFeed/bad-price-life");
            })
        })
        context("set price life", async () => {
            it("should succeed", async () => {
                await mockedCentralizedPriceOracle.mock.getPrice.returns(WeiPerWad, await latest());
                await centralizedOraclePriceFeed.setPriceLife(950);
                expect(await centralizedOraclePriceFeed.priceLife()).to.be.equal(950);
            })
        })
    })

    describe("#setOracle()", async () => {
        context("sender isn't owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false);
                await expect(centralizedOraclePriceFeed.setOracle(mockedCentralizedPriceOracle.address)).to.be.revertedWith("!ownerRole");
            })
        })
        context("zero address", async () => {
            it("should revert", async () => {
                await expect(centralizedOraclePriceFeed.setOracle(AddressZero)).to.be.revertedWith("CentralizedOraclePriceFeed/zero-access-control-config");
            })
        })
        context("set oracle", async () => {
            it("should succeed", async () => {
                const mockedCentralizedPriceOracle2 = await createMock("IFathomCentralizedOracle");
                await mockedCentralizedPriceOracle2.mock.getPrice.returns(WeiPerWad.mul(2), await latest());

                await centralizedOraclePriceFeed.setOracle(mockedCentralizedPriceOracle2.address);
                expect(await centralizedOraclePriceFeed.fathomOracle()).to.be.equal(mockedCentralizedPriceOracle2.address);
                expect(await centralizedOraclePriceFeed.lastPrice()).to.be.equal(WeiPerWad.mul(2));
            })
        })
    })

    describe("#peekPrice()", async () => {
        context("zero price", async () => {
            it("should revert", async () => {
                await mockedCentralizedPriceOracle.mock.getPrice.returns(0, await latest());
                await expect(centralizedOraclePriceFeed.peekPrice()).to.be.revertedWith("CentralizedOraclePriceFeed/wrong-price");
            })
        })
        context("zero invalid timestamp", async () => {
            it("should revert", async () => {
                await mockedCentralizedPriceOracle.mock.getPrice.returns(WeiPerWad, await latest() + 1);
                await expect(centralizedOraclePriceFeed.peekPrice()).to.be.revertedWith("CentralizedOraclePriceFeed/wrong-lastUpdate");
            })
        })
        context("peek price", async () => {
            it("should succeed", async () => {
                const lastTS = await latest();
                await mockedCentralizedPriceOracle.mock.getPrice.returns(WeiPerWad.mul(2), lastTS);

                const result = await centralizedOraclePriceFeed.callStatic.peekPrice();
                await centralizedOraclePriceFeed.peekPrice();
                expect(result[0]).to.be.equal(WeiPerWad.mul(2));
                expect(await centralizedOraclePriceFeed.lastPrice()).to.be.equal(WeiPerWad.mul(2));
                expect(await centralizedOraclePriceFeed.lastUpdateTS()).to.be.equal(lastTS);
            })
        })
    })

    describe("#pause(), #unpause()", () => {
        context("when caller is not the owner", () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(centralizedOraclePriceFeed.pause()).to.be.revertedWith("!(ownerRole or govRole)")
                await expect(centralizedOraclePriceFeed.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when caller is the owner", () => {
            it("should be able to call pause and unpause perfectly", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await mockedCentralizedPriceOracle.mock.getPrice.returns(WeiPerWad, await latest());

                expect(await centralizedOraclePriceFeed.paused()).to.be.false
                await centralizedOraclePriceFeed.pause()
                expect(await centralizedOraclePriceFeed.paused()).to.be.true
                await centralizedOraclePriceFeed.unpause()
                expect(await centralizedOraclePriceFeed.paused()).to.be.false
            })
        })
    })
})
