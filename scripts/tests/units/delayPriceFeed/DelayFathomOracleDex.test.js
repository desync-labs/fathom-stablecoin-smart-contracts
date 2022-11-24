const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { BigNumber, ethers } = require("ethers");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, BobAddress } = require("../../helper/address");
const { getContract, createMock, connectToContractWithAddress } = require("../../helper/contracts");
const { increase } = require('../../helper/time');
const { weiToRay, weiToDecimal } = require('../../helper/unit');
const { formatBytes32String } = ethers.utils
const { getDeadlineTimestamp } = require("../../helper/timeStamp");
const { approve } = require("../../helper/token");

describe("Delay Fathom Oracle with DexPriceOracle - Unit Test Suite", () => {
    let dexPriceOracle;
    let delayFathomOraclePriceFeed;
    let mockPriceOracle;

    let bookKeeper;
    let collateralPoolConfig;
    let accessControlConfig;

    let mockedBookKeeper;
    let mockedCollateralPoolConfig;

    let Router;

    let dexToken0 = "0xce75A95160D96F5388437993aB5825F322426E04";
    let dexToken1 = "0x0D2B0406bc8400E61f7507bDed415c98E54A8b11";
    let dexFactoryAddress = "0xb9AdA6B44E4CFF8FE00443Fadf8ad006CfCc2d10";
    let routerAddress = "0xf72f1a39ae0736Ef6A532605C85aFB0A4E349714";

    dexPriceOracle = getContract("DexPriceOracle", DeployerAddress);
    delayFathomOraclePriceFeed = getContract("DelayFathomOraclePriceFeed", DeployerAddress);
    mockPriceOracle = getContract("MockPriceOracle", DeployerAddress);

    bookKeeper = getContract("BookKeeper", DeployerAddress);
    collateralPoolConfig = getContract("CollateralPoolConfig", DeployerAddress);
    accessControlConfig = getContract("AccessControlConfig", DeployerAddress);

    before(async () => {
        await approve(dexToken0, routerAddress, 200000);
        await approve(dexToken1, routerAddress, 200000);
        Router = await artifacts.initializeInterfaceAt("IUniswapV2Router01", routerAddress);
    });

    beforeEach(async () => {
        await snapshot.revertToSnapshot();
        await dexPriceOracle.initialize(dexFactoryAddress);
        await delayFathomOraclePriceFeed.initialize(dexPriceOracle.address, dexToken0, dexToken1, accessControlConfig.address);
        await mockPriceOracle.initialize(bookKeeper.address, delayFathomOraclePriceFeed.address, WeiPerRay);
    });

    describe("DexPriceOracle Contract Tests", () => {

        // getPrice method tests
        it("Check getPrice method returns correct default price from DEX", async () => {
            const returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            expect(returnValue[0]).to.be.equal("3000000000000000000");
        });

        it("Check getPrice method returns 1 when same token addresses are given as arguments", async () => {
            const returnValue = await dexPriceOracle.getPrice(dexToken0, dexToken0);
            expect(returnValue[0]).to.be.equal("1000000000000000000");
        });
    });

    describe("Swap Tokens on DEX Tests", () => {
        it("Check Tokan1 price increases after swapping 100 Token0 with 200 Token1 (1:3) ", async () => {
            //spending mockToken0 to receive mockToken1. The amount of mockToken0 to spend is fixed but mockToken1 amount should be more than 200, otherwise refault.
            await Router.swapExactTokensForTokens(100, 200, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));
            const returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            expect(weiToDecimal(returnValue[0])).to.be.lessThan(3);
        });
    });

    describe("DelayFathomOraclePriceFeed Contract Tests", () => {

        // setTimeDelay method tests
        it("Check setTimeDelay method reverts with !ownerRole when calling it with address having no role", async () => {
            const delayFathomOraclePriceFeed2 = await connectToContractWithAddress(delayFathomOraclePriceFeed, AliceAddress);
            await expect(delayFathomOraclePriceFeed2.setTimeDelay(900)).to.be.revertedWith("!ownerRole");
        });

        it("Check setTimeDelay method reverts with !ownerRole when calling it with address having GOV role", async () => {
            await accessControlConfig.grantRole(accessControlConfig.GOV_ROLE(), BobAddress, { gasLimit: 1000000 });

            const delayFathomOraclePriceFeed2 = await connectToContractWithAddress(delayFathomOraclePriceFeed, BobAddress);
            await expect(delayFathomOraclePriceFeed2.setTimeDelay(900)).to.be.revertedWith("!ownerRole");
        });

        it("Check setTimeDelay method succeeds when calling it with address having OWNER role", async () => {
            await delayFathomOraclePriceFeed.setTimeDelay(900);
            const returnValue = await delayFathomOraclePriceFeed.timeDelay();
            expect(returnValue).to.be.eq(900);
        });

        it("Check setTimeDelay method reverts with 'FathomOraclePriceFeed/bad-delay-time' when parameter is less than 900(seconds) / 15 minutes", async () => {
            await expect(delayFathomOraclePriceFeed.setTimeDelay(899)).to.be.revertedWith("FathomOraclePriceFeed/bad-delay-time");
        });

        it("Check setTimeDelay method reverts with 'FathomOraclePriceFeed/bad-delay-time' when parameter is more than 86,400(seconds) / 1 day", async () => {
            await expect(delayFathomOraclePriceFeed.setTimeDelay(86401)).to.be.revertedWith("FathomOraclePriceFeed/bad-delay-time");
        });


        //setPriceLife method tests
        it("Check setPriceLife method reverts with !ownerRole when calling it with address having no role", async () => {
            const delayFathomOraclePriceFeed2 = await connectToContractWithAddress(delayFathomOraclePriceFeed, AliceAddress);
            await expect(delayFathomOraclePriceFeed2.setPriceLife(3600)).to.be.revertedWith("!ownerRole");
        });

        it("Check setPriceLife method reverts with !ownerRole when calling it with address having GOV role", async () => {
            await accessControlConfig.grantRole(accessControlConfig.GOV_ROLE(), BobAddress, { gasLimit: 1000000 });

            const delayFathomOraclePriceFeed2 = await connectToContractWithAddress(delayFathomOraclePriceFeed, BobAddress);
            await expect(delayFathomOraclePriceFeed2.setTimeDelay(3600)).to.be.revertedWith("!ownerRole");
        });

        it("Check setPriceLife method succeeds when calling it with address having OWNER role", async () => {
            await delayFathomOraclePriceFeed.setPriceLife(3600);
            const returnValue = await delayFathomOraclePriceFeed.priceLife();
            expect(returnValue).to.be.eq(3600);
        });

        it("Check setPriceLife method reverts with 'FathomOraclePriceFeed/bad-price-life' when parameter is less than 3600(seconds) / 1 hour", async () => {
            await expect(delayFathomOraclePriceFeed.setPriceLife(3599)).to.be.revertedWith("FathomOraclePriceFeed/bad-price-life");
        });

        it("Check setPriceLife method reverts with 'FathomOraclePriceFeed/bad-price-life' when parameter is more than 86,400(seconds) / 1 day", async () => {
            await expect(delayFathomOraclePriceFeed.setPriceLife(86401)).to.be.revertedWith("FathomOraclePriceFeed/bad-price-life");
        });

        // pause method tests
        it("Check pause method reverts with !ownerRole when calling it with address having no role", async () => {
            const delayFathomOraclePriceFeed2 = await connectToContractWithAddress(delayFathomOraclePriceFeed, AliceAddress);
            await expect(delayFathomOraclePriceFeed2.pause()).to.be.revertedWith("!(ownerRole or govRole)");
        });

        it("Check pause method reverts with !ownerRole when calling it with address having GOV role", async () => {
            await accessControlConfig.grantRole(accessControlConfig.GOV_ROLE(), BobAddress, { gasLimit: 1000000 });

            const delayFathomOraclePriceFeed2 = await connectToContractWithAddress(delayFathomOraclePriceFeed, BobAddress);
            await expect(delayFathomOraclePriceFeed2.pause()).not.to.be.reverted;
        });

        it("Check pause method succeeds when calling it with address having OWNER role", async () => {
            await expect(delayFathomOraclePriceFeed.pause()).not.to.be.reverted;
        });

        //unpause method tests
        it("Check unpause method reverts with !ownerRole when calling it with address having no role", async () => {
            const delayFathomOraclePriceFeed2 = await connectToContractWithAddress(delayFathomOraclePriceFeed, AliceAddress);
            await expect(delayFathomOraclePriceFeed2.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
        });

        // peekPrice method tests
        it("Check peekPrice method returns default price from DexPriceOracle when current price is 0 and delay time has not passed", async () => {
            const dexPriceOraclePrice = await dexPriceOracle.getPrice(dexToken0, dexToken1);

            await delayFathomOraclePriceFeed.setTimeDelay(900);

            await delayFathomOraclePriceFeed.peekPrice();
            const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
            expect(returnValue[0]).to.be.equal(dexPriceOraclePrice[0]);
            expect(returnValue[1]).to.be.true;
        });

        // readPrice method tests
        it("Check readPrice method returns default price from DexPriceOracle after calling peekPrice", async () => {
            const dexPriceOraclePrice = await dexPriceOracle.getPrice(dexToken0, dexToken1);
            await delayFathomOraclePriceFeed.setTimeDelay(900);
            await delayFathomOraclePriceFeed.peekPrice();

            const returnValue = await delayFathomOraclePriceFeed.readPrice();
            expect(returnValue).to.be.equal(dexPriceOraclePrice[0]);
        });
    });

    describe("MockPriceOracle Contract Tests", () => {

        // setPrice method tests
        it("Check setPrice method returns default price from DelayPriceFeed when DexPriceOracle price is also the default one", async () => {
            const dexPriceOraclePrice = await dexPriceOracle.getPrice(dexToken0, dexToken1);
            await delayFathomOraclePriceFeed.setTimeDelay(900);

            await delayFathomOraclePriceFeed.peekPrice();

            await delayFathomOraclePriceFeed.callStatic.peekPrice();

            const _collateralPoolId = formatBytes32String("WXDC");

            await mockPriceOracle.setPrice(_collateralPoolId);
            const _priceWithSafetyMargin = await mockPriceOracle.callStatic.setPrice(_collateralPoolId);
            await expect(_priceWithSafetyMargin).to.be.equal(weiToRay(dexPriceOraclePrice[0]));
        });
    });
});

