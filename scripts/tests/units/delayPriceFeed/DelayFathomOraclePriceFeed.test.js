const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const PriceOracle = artifacts.require('./8.17/stablecoin-core/PriceOracle.sol');


const { BigNumber, ethers } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, BobAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");

const { formatBytes32String } = ethers.utils

describe("DelayFathomOraclePriceFeed", () => {

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

    //if accounts[0] is checked whether having role or not,
    //set up accessPoolConfig.hasRole()
    // accessControlConfig.hasRole(accessControlConfig.OWNER_ROLE(), msg.sender

    await delayFathomOraclePriceFeed.initialize(MockDexPriceOracle.address, mockToken0, mockToken1, mockedAccessControlConfig.address);
    // console.log("mockedAccessControlConfig address is " + mockedAccessControlConfig.address);

    // await MockPriceOracle.initialize(mockedBookKeeper.address);
    // console.log("mockedBookKeeper address is " + mockedBookKeeper.address);

  })

  describe("MockDexPriceOracle.sol check before testing DelayFathomOraclePriceFeed", () => {
    context("call getPrice", async () => {
      it("should return 0", async () => {
          const returnValue = await MockDexPriceOracle.getPrice(mockToken0, mockToken1);
          // console.log(returnValue);
          await expect(returnValue[0]).to.be.equal(0);
      })
    })

    context("call changePrice and call getPrice", async () => {
      it("should return 1000", async () => {
          await MockDexPriceOracle.changePrice(1000);
          const returnValue = await MockDexPriceOracle.getPrice(mockToken0, mockToken1);
          // console.log(returnValue);
          await expect(returnValue[0]).to.be.equal(1000);
      })
    })
  })

  describe("DelayFathomOraclePriceFeed", () => {
    context("currentPrice before peekPrice()", async () => {
      it("should return 0", async () => {
          const returnValue = await delayFathomOraclePriceFeed.currentPrice();
          // console.log(returnValue);
          await expect(returnValue[0]).to.be.equal(0);
      })
    })

    context("timeDelay before setTimeDelay()", async () => {
      it("should return 0", async () => {
          const returnValue = await delayFathomOraclePriceFeed.timeDelay();
          // console.log(returnValue);
          await expect(returnValue).to.be.equal(0);
      })
    })

    //setTimeDelay should revert when tried without access control.
    context("setTimeDelay() without owner role", async () => {
      it("should revert", async () => {
          // await delayFathomOraclePriceFeed.initialize(MockDexPriceOracle.address, mockToken0, mockToken1, mockedAccessControlConfig.address);
          // console.log(returnValue);
          await mockedAccessControlConfig.mock.hasRole.returns(false);
          await expect(delayFathomOraclePriceFeed.setTimeDelay(900)).to.be.revertedWith("!ownerRole")

      })
    })

    //setTimeDelay should revert with "FathomOraclePriceFeed/bad-delay-time" if the param is less than 15 minutes
    context("setTimeDelay() with param less than 15 min(900 sec)", async () => {
      it("should revert", async () => {
          await expect(delayFathomOraclePriceFeed.setTimeDelay(10)).to.be.revertedWith("FathomOraclePriceFeed/bad-delay-time")

      })
    })

    context("timeDelay after setTimeDelay()", async () => {
      it("should return 900", async () => {
          // await delayFathomOraclePriceFeed.initialize(MockDexPriceOracle.address, mockToken0, mockToken1, mockedAccessControlConfig.address);
          await delayFathomOraclePriceFeed.setTimeDelay(900);
          const returnValue = await delayFathomOraclePriceFeed.timeDelay();
          await expect(returnValue).to.be.equal(900);
      })
    })

    //test for peekPrice()

      //before 15 minutes passed
      //after 15 minutes passed


    //test for readPrice()

  })

  //then test MockPriceOracle which has DelayFathomOraclepPriceFeed as price Feed.
  //DelayFathomOraclePriceFeed should have _fathomOracle as MockDexPriceOracle
})
