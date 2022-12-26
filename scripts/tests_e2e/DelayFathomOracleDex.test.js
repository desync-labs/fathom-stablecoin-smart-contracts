const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { BigNumber, ethers } = require("ethers");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../tests/helper/unit");
const { DeployerAddress, AliceAddress, BobAddress } = require("../tests/helper/address");
const { getContract, createMock, connectToContractWithAddress } = require("../tests/helper/contracts");
const { increase } = require('../tests/helper/time');
const { weiToRay, weiToDecimal, rayToDecimal } = require('../tests/helper/unit');
const { formatBytes32String } = ethers.utils
const { getDeadlineTimestamp } = require("../tests/helper/timeStamp");
const { approve } = require("../tests/helper/token");

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

    beforeEach(async () => {
        await snapshot.revertToSnapshot();
        await dexPriceOracle.initialize(dexFactoryAddress);
        await delayFathomOraclePriceFeed.initialize(dexPriceOracle.address, dexToken1, dexToken0, accessControlConfig.address);
        await mockPriceOracle.initialize(bookKeeper.address, delayFathomOraclePriceFeed.address, WeiPerRay);
        Router = await artifacts.initializeInterfaceAt("IUniswapV2Router01", routerAddress);
    });

    after(async () => {
        await snapshot.revertToSnapshot();
    });

    describe("DexPriceOracle Contract Tests", () => {

        // getPrice method tests
        it("Check getPrice method returns correct default price from DEX", async () => {
            const dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1DexPrice = weiToDecimal(dexReturnValue[0]);
            expect(token1DexPrice).to.be.equal(3);
        });

        it("Check getPrice method returns 1 when same token addresses are given as arguments", async () => {
            const dexReturnValue = await dexPriceOracle.getPrice(dexToken0, dexToken0);
            const token0DexPrice = weiToDecimal(dexReturnValue[0]);
            expect(token0DexPrice).to.be.equal(1);
        });
    });

    describe("Swap Tokens on DEX Tests", () => {
        it("Check Token1 price increases after swapping 100 Token0 with 200 Token1 (1:3) ", async () => {
            await approve(dexToken0, routerAddress, 200000);
            await Router.swapExactTokensForTokens(100, 200, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));
            const dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1DexPrice = weiToDecimal(dexReturnValue[0]);
            expect(token1DexPrice).to.be.lessThan(3);
        });

        it("Check Token1 price keeps fluctuating in a correct direcation after continously swapping different amount of Token0 with Token1 and vice versa", async () => {
            let token1PreviousPrice = 3;
            let returnValue;
            let token1CurrentPrice;

            // Swap 1: 100 Token0 for 200 Token1 -> Token1 Price should increase
            await approve(dexToken0, routerAddress, 20000);
            increase(900);
            await Router.swapExactTokensForTokens(100, 200, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));
            returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            token1CurrentPrice = weiToDecimal(returnValue[0]);
            expect(token1CurrentPrice).to.be.lessThan(token1PreviousPrice);
            token1PreviousPrice = token1CurrentPrice;

            // Swap 2: 500 Token0 for 200 Token1 -> Token1 Price should increase
            await approve(dexToken0, routerAddress, 20000);
            increase(900);
            await Router.swapExactTokensForTokens(500, 100, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));
            returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            token1CurrentPrice = weiToDecimal(returnValue[0]);
            expect(token1CurrentPrice).to.be.lessThan(token1PreviousPrice);
            token1PreviousPrice = token1CurrentPrice;

            // Swap 3: 1000 Token0 for 200 Token1 -> Token1 Price should increase
            await approve(dexToken0, routerAddress, 20000);
            increase(900);
            await Router.swapExactTokensForTokens(1000, 100, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));
            returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            token1CurrentPrice = weiToDecimal(returnValue[0]);
            expect(token1CurrentPrice).to.be.lessThan(token1PreviousPrice);
            token1PreviousPrice = token1CurrentPrice;

            // Swap 4: 300 Token1 for 50 Token0 -> Token1 Price should decrease
            await approve(dexToken1, routerAddress, 20000);
            increase(900);
            await Router.swapExactTokensForTokens(300, 50, [dexToken1, dexToken0], DeployerAddress, await getDeadlineTimestamp(10000));
            returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            token1CurrentPrice = weiToDecimal(returnValue[0]);
            expect(token1CurrentPrice).to.be.greaterThan((token1PreviousPrice));
            token1PreviousPrice = token1CurrentPrice;

            // Swap 5: 300 Token1 for 50 Token0 -> Token1 Price should decrease
            await approve(dexToken1, routerAddress, 20000);
            increase(900);
            await Router.swapExactTokensForTokens(600, 50, [dexToken1, dexToken0], DeployerAddress, await getDeadlineTimestamp(10000));
            returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            token1CurrentPrice = weiToDecimal(returnValue[0]);
            expect(token1CurrentPrice).to.be.greaterThan((token1PreviousPrice));
            token1PreviousPrice = token1CurrentPrice;

            // Swap 6: 300 Token1 for 50 Token0 -> Token1 Price should decrease
            await approve(dexToken1, routerAddress, 20000);
            increase(900);
            await Router.swapExactTokensForTokens(1000, 50, [dexToken1, dexToken0], DeployerAddress, await getDeadlineTimestamp(10000));
            returnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            token1CurrentPrice = weiToDecimal(returnValue[0]);
            expect(token1CurrentPrice).to.be.greaterThan((token1PreviousPrice));
            token1PreviousPrice = token1CurrentPrice;
        });

        it("Check swap method reverts when trying to call it with less amount than approved", async () => {
            await approve(dexToken0, routerAddress, 50);
            await expect(Router.swapExactTokensForTokens(100, 200, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000)))
            .to.be.revertedWith("TransferHelper::transferFrom: transferFrom failed");
        });

        it("Check swap method reverts when trying to swap Token0 for more Token1 than the max amount it should give", async () => {
            await approve(dexToken0, routerAddress, 200000);
            await expect(Router.swapExactTokensForTokens(100, 301, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000)))
            .to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
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
            const dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            await delayFathomOraclePriceFeed.setTimeDelay(900);

            await delayFathomOraclePriceFeed.peekPrice();
            const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
            expect(returnValue[0]).to.be.equal(dexReturnValue[0]);
            expect(returnValue[1]).to.be.true;
        });

        it("Check peekPrice method returns old price from DexPriceOracle when current price is not 0 and delay time has not passed", async () => {
            await delayFathomOraclePriceFeed.setTimeDelay(900);
            await delayFathomOraclePriceFeed.peekPrice();

            let dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1PreviousPrice = weiToDecimal(dexReturnValue[0]);

            await approve(dexToken0, routerAddress, 200000);
            await Router.swapExactTokensForTokens(100, 200, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));

            dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1CurrentPrice = weiToDecimal(dexReturnValue[0]);

            await delayFathomOraclePriceFeed.peekPrice();
            const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();

            expect(weiToDecimal(returnValue[0])).not.to.be.equal(token1CurrentPrice);
            expect(weiToDecimal(returnValue[0])).to.be.eq(token1PreviousPrice);
            expect(returnValue[1]).to.be.true;
        });

        it("Check peekPrice method returns updated price from DexPriceOracle when current price is not 0 and delay time has passed", async () => {
            await delayFathomOraclePriceFeed.setTimeDelay(900);
            await delayFathomOraclePriceFeed.peekPrice();

            let dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1PreviousPrice = weiToDecimal(dexReturnValue[0]);
            
            await approve(dexToken0, routerAddress, 200000);
            await Router.swapExactTokensForTokens(100, 200, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));

            dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1CurrentPrice = weiToDecimal(dexReturnValue[0]);

            increase(900);
            await delayFathomOraclePriceFeed.peekPrice();
            const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();

            expect(weiToDecimal(returnValue[0])).not.to.be.eq(token1PreviousPrice);
            expect(weiToDecimal(returnValue[0])).to.be.equal(token1CurrentPrice);
            expect(returnValue[1]).to.be.true;
        });

        // readPrice method tests
        it("Check readPrice method returns default current price (0) when peekPrice is never called", async () => {
            const returnValue = await delayFathomOraclePriceFeed.readPrice();
            expect(weiToDecimal(returnValue)).to.be.equal(0);
          });
          
        it("Check readPrice method returns current price from DexPriceOracle after calling peekPrice", async () => {
            const dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            await delayFathomOraclePriceFeed.setTimeDelay(900);
            await delayFathomOraclePriceFeed.peekPrice();

            const returnValue = await delayFathomOraclePriceFeed.readPrice();
            expect(returnValue).to.be.equal(dexReturnValue[0]);
        });
    });

    describe("MockPriceOracle Contract Tests", () => {

        // setPrice method tests
        it("Check setPrice method returns default price from DelayPriceFeed when DexPriceOracle price is also the default one", async () => {
            const dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1DexPrice = weiToDecimal(dexReturnValue[0]);

            await delayFathomOraclePriceFeed.setTimeDelay(900);
            await delayFathomOraclePriceFeed.peekPrice();
            const delayReturnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
            const token1DelayPrice = weiToDecimal(delayReturnValue[0]);

            const _collateralPoolId = formatBytes32String("WXDC");

            await mockPriceOracle.setPrice(_collateralPoolId);
            const _priceWithSafetyMargin = await mockPriceOracle.callStatic.setPrice(_collateralPoolId);
            const token1PriceOraclePrice = rayToDecimal(_priceWithSafetyMargin);

            expect(token1PriceOraclePrice).to.be.equal(token1DexPrice);
            expect(token1PriceOraclePrice).to.be.equal(token1DelayPrice);
        });

        it("Check setPrice method returns updated price from DelayPriceFeed after delay time has passed when DexPriceOracle price is changed", async () => {
            await delayFathomOraclePriceFeed.setTimeDelay(900);
            await delayFathomOraclePriceFeed.peekPrice();

            await approve(dexToken0, routerAddress, 200000);
            await Router.swapExactTokensForTokens(100, 200, [dexToken0, dexToken1], DeployerAddress, await getDeadlineTimestamp(10000));
            const dexReturnValue = await dexPriceOracle.getPrice(dexToken1, dexToken0);
            const token1DexPrice = weiToDecimal(dexReturnValue[0]);

            increase(900);
            await delayFathomOraclePriceFeed.peekPrice();
            const delayReturnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
            const token1DelayPrice = weiToDecimal(delayReturnValue[0]);

            const _collateralPoolId = formatBytes32String("WXDC");

            await mockPriceOracle.setPrice(_collateralPoolId);
            const _priceWithSafetyMargin = await mockPriceOracle.callStatic.setPrice(_collateralPoolId);
            const token1PriceOraclePrice = rayToDecimal(_priceWithSafetyMargin);

            expect(token1PriceOraclePrice).to.be.equal(token1DexPrice);
            expect(token1PriceOraclePrice).to.be.equal(token1DelayPrice);
        });
    });
});

