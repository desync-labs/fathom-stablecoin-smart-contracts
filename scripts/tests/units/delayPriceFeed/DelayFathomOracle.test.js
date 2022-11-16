const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');

const { BigNumber, ethers } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, BobAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { increase } = require('../../helper/time');

const { formatBytes32String } = ethers.utils

describe("Delay Fathom Oracle - Unit Test Suite", () => {

  let delayFathomOraclePriceFeed  //<- the contract that this test is focusing on.
  let MockDexPriceOracle // <- contract that provides price to delayFathomOraclePriceFeed.
  //even though mockPrice in the contract is changed, it should not be reflected in the
  //delayFathomOraclePriceFeed unless delaytime has passed

  let mockedBookKeeper //  <- bookKeeper.collateralPoolConfig() should return the address of mockCollateralPoolConfig
  let mockedCollateralPoolConfig // <- collateralPoolConfig.collateralPools(_collateralPoolId) 
  // should return priceFeed address which is delayFathomOraclePriceFeed

  let mockToken0 = "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4"; // <- some address from Remix
  let mockToken1 = "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db"; // <- some address from Remix

  delayFathomOraclePriceFeed = getContract("DelayFathomOraclePriceFeed", DeployerAddress);
  MockDexPriceOracle = getContract("MockDexPriceOracle", DeployerAddress);
  MockPriceOracle = getContract("MockPriceOracle", DeployerAddress);

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

    await delayFathomOraclePriceFeed.initialize(MockDexPriceOracle.address, mockToken0, mockToken1, mockedAccessControlConfig.address);

    await MockPriceOracle.initialize(mockedBookKeeper.address, delayFathomOraclePriceFeed.address, WeiPerRay);

    // console.log("mockedAccessControlConfig address is " + mockedAccessControlConfig.address);


    // console.log("mockedBookKeeper address is " + mockedBookKeeper.address);
  })

  describe("MockDexPriceOracle Contract Tests", () => {
    it("Check getPrice method returns correct default price value", async () => {
      const returnValue = await MockDexPriceOracle.getPrice(mockToken0, mockToken1);
      expect(returnValue[0]).to.be.equal(0);
    });

    it("Check getPrice method returns modified price value after calling changePrice method", async () => {
      await MockDexPriceOracle.changePrice(1000);
      const returnValue = await MockDexPriceOracle.getPrice(mockToken0, mockToken1);
      expect(returnValue[0]).to.be.equal(1000);
    });
  });

  describe("DelayFathomOraclePriceFeed Contract Tests", () => {
    it("Check currentPrice method returns correct default price value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.currentPrice();
      expect(returnValue[0]).to.be.equal(0);
    });

    it("Check timeDelay method returns correct default time delay value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.timeDelay();
      expect(returnValue).to.be.equal(0);
    });

    it("Check setTimeDelay function reverts with '!ownerRole' without access control", async () => {
      await mockedAccessControlConfig.mock.hasRole.returns(false);
      await expect(delayFathomOraclePriceFeed.setTimeDelay(900)).to.be.revertedWith("!ownerRole");
    });

    it("Check setTimeDelay function reverts with 'FathomOraclePriceFeed/bad-delay-time' when parameter is less than 900(seconds) / 15 minutes", async () => {
      await expect(delayFathomOraclePriceFeed.setTimeDelay(10)).to.be.revertedWith("FathomOraclePriceFeed/bad-delay-time");
    });

    it("Check timeDelay method returns correct time delay value after calling setTimeDelay with valid parameter value", async () => {
      await delayFathomOraclePriceFeed.setTimeDelay(900);
      const returnValue = await delayFathomOraclePriceFeed.timeDelay();
      expect(returnValue).to.be.equal(900);
    });

    it("Check accessControlConfig address", async () => {
      const mockedAccessControlConfigAdd = await delayFathomOraclePriceFeed.accessControlConfig();
      expect(mockedAccessControlConfigAdd).to.be.equal(mockedAccessControlConfig.address);
    });

    it("Check fathomOracle address", async () => {
      const fathomOracleAdd = await delayFathomOraclePriceFeed.fathomOracle();
      expect(fathomOracleAdd).to.be.equal(MockDexPriceOracle.address);
    });

    //test for peekPrice()
    it("Check peekPrice method returns updated price when current price is 0 and delay time has not passed", async () => {
      await MockDexPriceOracle.changePrice(100);
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();
      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    it("Check peekPrice method returns old price when current price is not 0 and before time delay has passed", async () => {
      await MockDexPriceOracle.changePrice(100);
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();

      await MockDexPriceOracle.changePrice(200);
      await delayFathomOraclePriceFeed.peekPrice();
      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    it("Check peekPrice method returns updated price when current price is not 0 and after time delay has passed", async () => {
      await MockDexPriceOracle.changePrice(100);
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();

      await MockDexPriceOracle.changePrice(200);

      increase(900);

      await delayFathomOraclePriceFeed.peekPrice();
      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(200);
      expect(returnValue[1]).to.be.true;
    });

    it("Check readPrice method returns current price with default price value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.readPrice();
      expect(Number(returnValue)).to.be.equal(0);
    });

    it("Check readPrice method returns current price with updated price value", async () => {
      await MockDexPriceOracle.changePrice(100);
      await delayFathomOraclePriceFeed.setTimeDelay(900);
      await delayFathomOraclePriceFeed.peekPrice();

      const returnValue = await delayFathomOraclePriceFeed.readPrice();
      expect(Number(returnValue)).to.be.equal(100);
    });
  })

  describe("MockPriceOracle Contract Tests", () => {
    context("1", async () => {
      it("when changePrice(WeiPerWad) and liquidationRatio is WeiPerRay, _priceWithSafetyMargin should be WeiPerRay", async () => {
        await MockDexPriceOracle.changePrice(WeiPerWad);
        await delayFathomOraclePriceFeed.setTimeDelay(900);

        const _collateralPoolId = formatBytes32String("WXDC")

        // await delayFathomOraclePriceFeed.peekPrice();

        const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
        await expect(returnValue[1]).to.be.equal(true);
        await MockPriceOracle.setPrice(_collateralPoolId);
        const _priceWithSafetyMargin = await MockPriceOracle.callStatic.setPrice(_collateralPoolId);
        console.log("_priceWithSafetyMargin is " + _priceWithSafetyMargin);
        await expect(_priceWithSafetyMargin).to.be.equal(WeiPerRay);

      })
    })

    context("2", async () => {
      it("when changePrice(WeiPerWad.div(2)) and liquidationRatio is WeiPerRay, _priceWithSafetyMargin should be WeiPerRay.div(2)", async () => {
        await MockDexPriceOracle.changePrice(WeiPerWad.div(2));
        await delayFathomOraclePriceFeed.setTimeDelay(900);

        const _collateralPoolId = formatBytes32String("WXDC")

        // await delayFathomOraclePriceFeed.peekPrice();

        const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
        await expect(returnValue[1]).to.be.equal(true);
        await MockPriceOracle.setPrice(_collateralPoolId);
        const _priceWithSafetyMargin = await MockPriceOracle.callStatic.setPrice(_collateralPoolId);
        console.log("_priceWithSafetyMargin is " + _priceWithSafetyMargin);
        await expect(_priceWithSafetyMargin).to.be.equal(WeiPerRay.div(2));

      })
    })
  })
  //then test MockPriceOracle which has DelayFathomOraclepPriceFeed as price Feed.
  //DelayFathomOraclePriceFeed should have _fathomOracle as MockDexPriceOracle
})
