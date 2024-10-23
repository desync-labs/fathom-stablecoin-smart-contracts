const { ethers } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { WeiPerRay } = require("../../helper/unit");
const { formatBytes32String } = ethers.utils;

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

describe("Delay Fathom Oracle with MockedDexPriceOracle - Unit Test Suite", () => {
  let mockedBookKeeper; //  <- bookKeeper.collateralPoolConfig() should return the address of mockCollateralPoolConfig
  let mockedCollateralPoolConfig; // <- collateralPoolConfig.collateralPools(_collateralPoolId)
  // should return priceFeed address which is delayFathomOraclePriceFeed
  let mockedDexPriceOracle;
  let mockedAccessControlConfig;

  let mockToken0 = "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4"; // <- some address from Remix
  let mockToken1 = "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db"; // <- some address from Remix

  let delayFathomOraclePriceFeed;

  beforeEach(async () => {
    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedDexPriceOracle = await smock.fake("DexPriceOracle");

    mockedAccessControlConfig.hasRole.returns(true);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedCollateralPoolConfig.getLiquidationRatio.returns(WeiPerRay);

    const DelayFathomOraclePriceFeed = await ethers.getContractFactory("MockDelayFathomOraclePriceFeed");
    delayFathomOraclePriceFeed = await DelayFathomOraclePriceFeed.deploy();
    await delayFathomOraclePriceFeed.deployed();

    await delayFathomOraclePriceFeed.initialize(
      mockedDexPriceOracle.address,
      mockToken0,
      mockToken1,
      mockedAccessControlConfig.address,
      COLLATERAL_POOL_ID
    );
  });

  describe("DelayFathomOraclePriceFeed Contract Tests", () => {
    it("Check latestrice method returns correct default price value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.delayedPrice();
      expect(returnValue.price).to.be.equal(0);
    });

    it("Check timeDelay method returns correct default time delay value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.timeDelay();
      expect(returnValue).to.be.equal(900);
    });

    it("Check setTimeDelay function reverts with '!ownerRole' without access control", async () => {
      mockedAccessControlConfig.hasRole.returns(false);
      await expect(delayFathomOraclePriceFeed.setTimeDelay(900)).to.be.revertedWith("!ownerRole");
    });

    it("Check setTimeDelay function reverts with 'FathomOraclePriceFeed/bad-delay-time' when parameter is less than 900(seconds) / 15 minutes", async () => {
      await expect(delayFathomOraclePriceFeed.setTimeDelay(10)).to.be.revertedWith("DelayPriceFeed/bad-delay-time");
    });

    it("Check timeDelay method returns correct time delay value after calling setTimeDelay with valid parameter value", async () => {
      mockedDexPriceOracle.getPrice.returns([100, await time.latest()]);
      await delayFathomOraclePriceFeed.setTimeDelay(800);
      const returnValue = await delayFathomOraclePriceFeed.timeDelay();
      expect(returnValue).to.be.equal(800);
    });

    it("Check accessControlConfig address", async () => {
      const mockedAccessControlConfigAdd = await delayFathomOraclePriceFeed.accessControlConfig();
      expect(mockedAccessControlConfigAdd).to.be.equal(mockedAccessControlConfig.address);
    });

    it("Check fathomOracle address", async () => {
      const fathomOracleAdd = await delayFathomOraclePriceFeed.fathomOracle();
      expect(fathomOracleAdd).to.be.equal(mockedDexPriceOracle.address);
    });

    //test for peekPrice()
    it("Check peekPrice method returns updated price when current price is 0 and delay time has not passed", async () => {
      mockedDexPriceOracle.getPrice.returns([100, await time.latest()]);
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();
      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    //todo
    it("Check peekPrice method returns updated price when current price is 0 and delay time has not passed", async () => {
      mockedDexPriceOracle.getPrice.returns([100, await time.latest()]);
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();
      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    it("Check peekPrice method returns old price when current price is not 0 and before time delay has passed", async () => {
      mockedDexPriceOracle.getPrice.returns([100, await time.latest()]);
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();

      mockedDexPriceOracle.getPrice.returns([200, await time.latest()]);
      await delayFathomOraclePriceFeed.peekPrice();

      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    it("Check peekPrice method returns delayed price when current price is not 0 and after time delay has passed", async () => {
      const latestTS = await time.latest();
      mockedDexPriceOracle.getPrice.returns([100, latestTS]);
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await time.increase(900);
      mockedDexPriceOracle.getPrice.returns([200, await time.latest()]);
      await delayFathomOraclePriceFeed.peekPrice();

      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    it("peek price should update latest price and delayed price if time delay passed", async () => {
      mockedDexPriceOracle.getPrice.returns([100, await time.latest()]);
      // set time delay will call peekPrice and set initial price in this test run
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      expect(await delayFathomOraclePriceFeed.readPrice()).to.be.equal(100);
      expect(await delayFathomOraclePriceFeed.nextPrice()).to.be.equal(100);

      // not enough time passed for update
      await time.increase(300);
      mockedDexPriceOracle.getPrice.returns([90, await time.latest()]);
      await delayFathomOraclePriceFeed.peekPrice();

      expect(await delayFathomOraclePriceFeed.readPrice()).to.be.equal(100);
      expect(await delayFathomOraclePriceFeed.nextPrice()).to.be.equal(100);

      // now we expect to get price updated
      await time.increase(600);
      mockedDexPriceOracle.getPrice.returns([200, await time.latest()]);
      await delayFathomOraclePriceFeed.peekPrice();

      expect(await delayFathomOraclePriceFeed.readPrice()).to.be.equal(100);
      expect(await delayFathomOraclePriceFeed.nextPrice()).to.be.equal(200);

      // and update price one more time
      await time.increase(900);
      mockedDexPriceOracle.getPrice.returns([250, await time.latest()]);
      await delayFathomOraclePriceFeed.peekPrice();

      expect(await delayFathomOraclePriceFeed.readPrice()).to.be.equal(200);
      expect(await delayFathomOraclePriceFeed.nextPrice()).to.be.equal(250);
    });

    it("Check readPrice method returns current price with default price value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.readPrice();
      expect(Number(returnValue)).to.be.equal(0);
    });

    it("Check readPrice method returns current price with updated price value", async () => {
      mockedDexPriceOracle.getPrice.returns([100, await time.latest()]);
      await delayFathomOraclePriceFeed.setTimeDelay(900);
      await delayFathomOraclePriceFeed.peekPrice();

      const returnValue = await delayFathomOraclePriceFeed.readPrice();
      expect(Number(returnValue)).to.be.equal(100);
    });
  });
  describe("#pause(), #unpause()", () => {
    context("when caller is not the owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(delayFathomOraclePriceFeed.pause()).to.be.revertedWith("!(ownerRole or govRole)");
        await expect(delayFathomOraclePriceFeed.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when caller is the owner", () => {
      it("should be able to call pause and unpause perfectly", async () => {
        mockedDexPriceOracle.getPrice.returns([100, await time.latest()]);
        mockedAccessControlConfig.hasRole.returns(true);

        expect(await delayFathomOraclePriceFeed.paused()).to.be.false;
        await delayFathomOraclePriceFeed.pause();
        expect(await delayFathomOraclePriceFeed.paused()).to.be.true;
        await delayFathomOraclePriceFeed.unpause();
        expect(await delayFathomOraclePriceFeed.paused()).to.be.false;
      });
    });
  });
});
