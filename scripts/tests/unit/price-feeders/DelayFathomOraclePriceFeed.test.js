const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { BigNumber, ethers } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { DeployerAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { increase } = require('../../helper/time');

const { formatBytes32String } = ethers.utils

describe("Delay Fathom Oracle with MockedDexPriceOracle - Unit Test Suite", () => {
  let mockedBookKeeper //  <- bookKeeper.collateralPoolConfig() should return the address of mockCollateralPoolConfig
  let mockedCollateralPoolConfig // <- collateralPoolConfig.collateralPools(_collateralPoolId) 
  // should return priceFeed address which is delayFathomOraclePriceFeed
  let mockedDexPriceOracle
  let mockedAccessControlConfig

  let mockToken0 = "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4"; // <- some address from Remix
  let mockToken1 = "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db"; // <- some address from Remix

  const delayFathomOraclePriceFeed = getContract("DelayFathomOraclePriceFeed", DeployerAddress);

  beforeEach(async () => {
    await snapshot.revertToSnapshot();
    mockedBookKeeper = await createMock("BookKeeper");
    mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    mockedAccessControlConfig = await createMock("AccessControlConfig");
    mockedDexPriceOracle = await createMock("DexPriceOracle");

    await mockedAccessControlConfig.mock.hasRole.returns(true);
    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(WeiPerRay);

    await delayFathomOraclePriceFeed.initialize(mockedDexPriceOracle.address, mockToken0, mockToken1, mockedAccessControlConfig.address);
  })

  describe("DelayFathomOraclePriceFeed Contract Tests", () => {
    it("Check currentPrice method returns correct default price value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.currentPrice();
      expect(returnValue[0]).to.be.equal(0);
    });

    it("Check timeDelay method returns correct default time delay value", async () => {
      const returnValue = await delayFathomOraclePriceFeed.timeDelay();
      expect(returnValue).to.be.equal(900);
    });

    it("Check setTimeDelay function reverts with '!ownerRole' without access control", async () => {
      await mockedAccessControlConfig.mock.hasRole.returns(false);
      await expect(delayFathomOraclePriceFeed.setTimeDelay(900)).to.be.revertedWith("!ownerRole");
    });

    it("Check setTimeDelay function reverts with 'FathomOraclePriceFeed/bad-delay-time' when parameter is less than 900(seconds) / 15 minutes", async () => {
      await expect(delayFathomOraclePriceFeed.setTimeDelay(10)).to.be.revertedWith("FathomOraclePriceFeed/bad-delay-time");
    });

    it("Check timeDelay method returns correct time delay value after calling setTimeDelay with valid parameter value", async () => {
      await delayFathomOraclePriceFeed.setTimeDelay(1200);
      const returnValue = await delayFathomOraclePriceFeed.timeDelay();
      expect(returnValue).to.be.equal(1200);
    })

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
      await mockedDexPriceOracle.mock.getPrice.returns(100, Math.floor(Date.now() / 1000))
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();
      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    it("Check peekPrice method returns old price when current price is not 0 and before time delay has passed", async () => {
      await mockedDexPriceOracle.mock.getPrice.returns(100, Math.floor(Date.now() / 1000))
      await delayFathomOraclePriceFeed.setTimeDelay(9000);

      await delayFathomOraclePriceFeed.peekPrice();

      await mockedDexPriceOracle.mock.getPrice.returns(200, Math.floor(Date.now() / 1000))
      await delayFathomOraclePriceFeed.peekPrice();

      const returnValue = await delayFathomOraclePriceFeed.callStatic.peekPrice();
      expect(Number(returnValue[0])).to.be.equal(100);
      expect(returnValue[1]).to.be.true;
    });

    it("Check peekPrice method returns updated price when current price is not 0 and after time delay has passed", async () => {
      await mockedDexPriceOracle.mock.getPrice.returns(100, Math.floor(Date.now() / 1000))
      await delayFathomOraclePriceFeed.setTimeDelay(900);

      await delayFathomOraclePriceFeed.peekPrice();

      await mockedDexPriceOracle.mock.getPrice.returns(200, Math.floor(Date.now() / 1000))
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
      await mockedDexPriceOracle.mock.getPrice.returns(100, Math.floor(Date.now() / 1000))
      await delayFathomOraclePriceFeed.setTimeDelay(900);
      await delayFathomOraclePriceFeed.peekPrice();

      const returnValue = await delayFathomOraclePriceFeed.readPrice();
      expect(Number(returnValue)).to.be.equal(100);
    });
  });
  describe("#pause(), #unpause()", () => {
    context("when caller is not the owner", () => {
        it("should revert", async () => {
            await mockedAccessControlConfig.mock.hasRole.returns(false)

            await expect(delayFathomOraclePriceFeed.pause()).to.be.revertedWith("!(ownerRole or govRole)")
            await expect(delayFathomOraclePriceFeed.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
        })
    })
    context("when caller is the owner", () => {
        it("should be able to call pause and unpause perfectly", async () => {
            await mockedAccessControlConfig.mock.hasRole.returns(true)

            expect(await delayFathomOraclePriceFeed.paused()).to.be.false
            await delayFathomOraclePriceFeed.pause()
            expect(await delayFathomOraclePriceFeed.paused()).to.be.true
            await delayFathomOraclePriceFeed.unpause()
            expect(await delayFathomOraclePriceFeed.paused()).to.be.false
        })
    })
})
});
