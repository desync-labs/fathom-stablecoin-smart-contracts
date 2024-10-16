const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { WeiPerWad } = require("../../helper/unit");
const { parseUnits } = ethers.utils;

xdescribe("DexPriceOracle", () => {
  // Contract
  let dexPriceOracle;
  let mockedPair;
  let mockedToken;
  let mockedUSD;
  let mockedFactory;

  beforeEach(async () => {
    const DexPriceOracleFactory = await ethers.getContractFactory("MockDexPriceOracle");
    dexPriceOracle = await DexPriceOracleFactory.deploy();
    await dexPriceOracle.deployed();
    mockedFactory = await smock.fake("IFathomSwapFactory");
    mockedPair = await smock.fake("IFathomSwapPair");
    mockedToken = await smock.fake("ERC20Mintable");
    mockedUSD = await smock.fake("ERC20Mintable");

    await dexPriceOracle.initialize(mockedFactory.address);
  });

  describe("#getPrice()", async () => {
    context("same tokens", async () => {
      it("should revert", async () => {
        await expect(dexPriceOracle.getPrice(mockedToken.address, mockedToken.address)).to.be.revertedWith("DexPriceOracle/same-tokens");
      });
    });
    context("price was returned from dex", async () => {
      it("should success", async () => {
        mockedFactory.getPair.returns(mockedPair.address);
        mockedToken.decimals.returns(BigNumber.from("18"));
        mockedUSD.decimals.returns(BigNumber.from("18"));

        if (BigNumber.from(mockedToken.address).lt(BigNumber.from(mockedUSD.address))) {
          mockedPair.getReserves.returns([WeiPerWad, WeiPerWad.mul(2), await time.latest()]);
        } else {
          mockedPair.getReserves.returns([WeiPerWad.mul(2), WeiPerWad, await time.latest()]);
        }

        const price0 = await dexPriceOracle.getPrice(mockedToken.address, mockedUSD.address);
        const price1 = await dexPriceOracle.getPrice(mockedUSD.address, mockedToken.address);

        expect(price0[0]).to.be.equal(WeiPerWad.mul(2));
        expect(price1[0]).to.be.equal(WeiPerWad.div(2));
      });
    });
    context("different deciamls", async () => {
      it("should success", async () => {
        mockedFactory.getPair.returns(mockedPair.address);
        mockedToken.decimals.returns(BigNumber.from("20"));
        mockedUSD.decimals.returns(BigNumber.from("6"));

        if (BigNumber.from(mockedToken.address).lt(BigNumber.from(mockedUSD.address))) {
          mockedPair.getReserves.returns([parseUnits("1205", 20), parseUnits("49", 6), await time.latest()]);
        } else {
          mockedPair.getReserves.returns([parseUnits("49", 6), parseUnits("1205", 20), await time.latest()]);
        }

        const price0 = await dexPriceOracle.getPrice(mockedToken.address, mockedUSD.address);
        const price1 = await dexPriceOracle.getPrice(mockedUSD.address, mockedToken.address);

        expect(price0[0]).to.be.equal(BigNumber.from("40663900414937759"));
        expect(price1[0]).to.be.equal(BigNumber.from("24591836734693877551"));
      });
    });
  });
});
