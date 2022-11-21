const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { BigNumber, ethers } = require("ethers");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, BobAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { increase } = require('../../helper/time');
const { weiToRay } = require('../../helper/unit');
const { formatBytes32String } = ethers.utils

describe("Delay Fathom Oracle with DexPriceOracle - Unit Test Suite", () => {
    let dexPriceOracle;
    let delayFathomOraclePriceFeed;
    let mockPriceOracle;

    let mockedBookKeeper;
    let mockedCollateralPoolConfig;

    let dexToken0 = "0x0D2B0406bc8400E61f7507bDed415c98E54A8b11";
    let dexToken1 = "0xce75A95160D96F5388437993aB5825F322426E04";
    let dexFactoryAddress = "0xb9AdA6B44E4CFF8FE00443Fadf8ad006CfCc2d10";

    dexPriceOracle = getContract("DexPriceOracle", DeployerAddress);
    delayFathomOraclePriceFeed = getContract("DelayFathomOraclePriceFeed", DeployerAddress);
    mockPriceOracle = getContract("MockPriceOracle", DeployerAddress);

    beforeEach(async () => {
        await snapshot.revertToSnapshot();
        mockedBookKeeper = await createMock("BookKeeper");
        mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
        mockedAccessControlConfig = await createMock("AccessControlConfig");

        await mockedAccessControlConfig.mock.hasRole.returns(true);
        await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
        await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

        await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
        // await mockedCollateralPoolConfig.mock.collateralPools.priceFeed.returns(delayFathomOraclePriceFeed.address);
        await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(WeiPerRay);

        //if accounts[0] is checked whether having role or not,
        //set up accessPoolConfig.hasRole()
        // accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender

        await dexPriceOracle.initialize(dexFactoryAddress);
        await delayFathomOraclePriceFeed.initialize(dexPriceOracle.address, dexToken0, dexToken1, mockedAccessControlConfig.address);
        await mockPriceOracle.initialize(mockedBookKeeper.address, delayFathomOraclePriceFeed.address, WeiPerRay);

        // console.log("mockedAccessControlConfig address is " + mockedAccessControlConfig.address);
        // console.log("mockedBookKeeper address is " + mockedBookKeeper.address);
    });

    describe("DexPriceOracle Contract Tests", () => {
        it("Check getPrice method returns correct default price value from DEX", async () => {
            const returnValue = await dexPriceOracle.getPrice(dexToken0, dexToken1);
            expect(returnValue[0]).to.be.equal("3000000000000000000");
        });
    });

    describe("DelayFathomOraclePriceFeed Contract Tests", () => {
        it("Check peekPrice method returns default price from DexPriceOracle when current price is 0 and delay time has not passed", async () => {
            const dexPriceOraclePrice = await dexPriceOracle.getPrice(dexToken0, dexToken1);

            await delayFathomOraclePriceFeed.setTimeDelay(900);

            await delayFathomOraclePriceFeed.peekPrice();
            const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
            expect(returnValue[0]).to.be.equal(dexPriceOraclePrice[0]);
            expect(returnValue[1]).to.be.true;
        });
    });

    describe("MockPriceOracle Contract Tests", () => {
        it("Check setPrice method returns default price from delayPriceFeed <- DexPriceOracle", async () => {
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

