const { ethers } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AddressZero } = require("../../helper/address");
const { latest } = require("../../helper/time");
const { formatBytes32String } = ethers.utils;

const COLLATERAL_POOL_ID = formatBytes32String("NATIVE");

describe("CentralizedOraclePriceFeed", () => {
  let mockedAccessControlConfig;
  let mockedCentralizedPriceOracle;
  let centralizedOraclePriceFeed;

  beforeEach(async function () {
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedCentralizedPriceOracle = await smock.fake("IFathomCentralizedOracle");

    mockedAccessControlConfig.hasRole.returns(true);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

    const CentralizedOraclePriceFeedFactory = await ethers.getContractFactory("MockCentralizedOraclePriceFeed");
    centralizedOraclePriceFeed = await CentralizedOraclePriceFeedFactory.deploy();
    await centralizedOraclePriceFeed.deployed();
    await centralizedOraclePriceFeed.initialize(mockedCentralizedPriceOracle.address, mockedAccessControlConfig.address, COLLATERAL_POOL_ID);
  });

  describe("#setAccessControlConfig()", async () => {
    context("sender isn't owner", async () => {
      it("should revert", async () => {
        await mockedAccessControlConfig.hasRole.returns(false);
        await expect(centralizedOraclePriceFeed.setAccessControlConfig(mockedAccessControlConfig.address)).to.be.revertedWith("!ownerRole");
      });
    });

    context("sender isn't owner for the new access control", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        const mockedAccessControlConfig2 = await smock.fake("AccessControlConfig");
        mockedAccessControlConfig2.hasRole.returns(false);
        mockedAccessControlConfig2.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));

        await expect(centralizedOraclePriceFeed.setAccessControlConfig(mockedAccessControlConfig2.address)).to.be.revertedWith(
          "DelayPriceFeed/msgsender-not-owner"
        );
      });
    });

    context("sender isn't owner for the new access control", async () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        const mockedAccessControlConfig2 = await smock.fake("AccessControlConfig");
        mockedAccessControlConfig2.hasRole.returns(true);
        mockedAccessControlConfig2.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));

        await centralizedOraclePriceFeed.setAccessControlConfig(mockedAccessControlConfig2.address);
        expect(await centralizedOraclePriceFeed.accessControlConfig()).to.be.equal(mockedAccessControlConfig2.address);
      });
    });
  });

  describe("#setPriceLife()", async () => {
    context("sender isn't owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(centralizedOraclePriceFeed.setPriceLife(900)).to.be.revertedWith("!ownerRole");
      });
    });
    context("price life is less than 5 min", async () => {
      it("should revert", async () => {
        await expect(centralizedOraclePriceFeed.setPriceLife(299)).to.be.revertedWith("DelayPriceFeed/bad-price-life");
      });
    });
    context("price life is greater than 1 day", async () => {
      it("should revert", async () => {
        await expect(centralizedOraclePriceFeed.setPriceLife(86401)).to.be.revertedWith("DelayPriceFeed/bad-price-life");
      });
    });
    context("set price life", async () => {
      it("should succeed", async () => {
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad, await time.latest()]);
        await centralizedOraclePriceFeed.setPriceLife(2000);
        expect(await centralizedOraclePriceFeed.priceLife()).to.be.equal(2000);
      });
    });
  });

  describe("#setOracle()", async () => {
    context("sender isn't owner", async () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(centralizedOraclePriceFeed.setOracle(mockedCentralizedPriceOracle.address)).to.be.revertedWith("!ownerRole");
      });
    });
    context("zero address", async () => {
      it("should revert", async () => {
        await expect(centralizedOraclePriceFeed.setOracle(AddressZero)).to.be.revertedWith("CentralizedOraclePriceFeed/zero-access-control-config");
      });
    });
    context("set oracle", async () => {
      it("should succeed", async () => {
        const mockedCentralizedPriceOracle2 = await smock.fake("IFathomCentralizedOracle");
        mockedCentralizedPriceOracle2.getPrice.returns([WeiPerWad.mul(2), await time.latest()]);

        await centralizedOraclePriceFeed.setOracle(mockedCentralizedPriceOracle2.address);
        expect(await centralizedOraclePriceFeed.oracle()).to.be.equal(mockedCentralizedPriceOracle2.address);
        expect(await centralizedOraclePriceFeed.readPrice()).to.be.equal(WeiPerWad.mul(2));
      });
    });
  });

  describe("#peekPrice()", async () => {
    context("oracle reverts", async () => {
      it("should emit event", async () => {
        mockedCentralizedPriceOracle.getPrice.reverts("some-error");
        await expect(centralizedOraclePriceFeed.peekPrice())
          .to.emit(centralizedOraclePriceFeed, "LogPeekPriceFailed")
          .withArgs(DeployerAddress, "some-error");
      });
    });
    context("zero price", async () => {
      it("should revert", async () => {
        mockedCentralizedPriceOracle.getPrice.returns([0, await time.latest()]);
        await expect(centralizedOraclePriceFeed.peekPrice()).to.be.revertedWith("DelayPriceFeed/wrong-price");
      });
    });
    context("zero invalid timestamp", async () => {
      it("should revert", async () => {
        // TODO: why time.latest() + 1 is not working?
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad, (await latest()) + 1]);
        await expect(centralizedOraclePriceFeed.peekPrice()).to.be.revertedWith("DelayPriceFeed/wrong-lastUpdate");
      });
    });
    context("peek price", async () => {
      it("should succeed", async () => {
        const lastTS = await time.latest();
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(2), lastTS]);

        const result = await centralizedOraclePriceFeed.callStatic.peekPrice();
        await centralizedOraclePriceFeed.peekPrice();
        expect(result[0]).to.be.equal(WeiPerWad.mul(2));
        expect(await centralizedOraclePriceFeed.readPrice()).to.be.equal(WeiPerWad.mul(2));
        expect((await centralizedOraclePriceFeed.delayedPrice()).lastUpdate).to.be.equal(lastTS);
      });
    });
    context("delay not passed", async () => {
      it("price not updated", async () => {
        const expectedTS = await time.latest();
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(2), expectedTS]);
        await centralizedOraclePriceFeed.peekPrice();

        await time.increase(900);
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(3), await time.latest()]);
        await centralizedOraclePriceFeed.peekPrice();

        await time.increase(800);
        await centralizedOraclePriceFeed.peekPrice();

        expect(await centralizedOraclePriceFeed.readPrice()).to.be.equal(WeiPerWad.mul(2));
        expect((await centralizedOraclePriceFeed.delayedPrice()).lastUpdate).to.be.equal(expectedTS);
      });
    });
    context("delay not passed, but price is outdated", async () => {
      it("price updated", async () => {
        const oldPriceTS = (await time.latest()) - 1800;
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad, oldPriceTS]);
        await centralizedOraclePriceFeed.peekPrice();

        await time.increase(100);
        const expectedTS = await time.latest();
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(3), expectedTS]);
        await centralizedOraclePriceFeed.peekPrice();

        await time.increase(100);
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(3), await time.latest()]);
        await centralizedOraclePriceFeed.peekPrice();

        expect(await centralizedOraclePriceFeed.readPrice()).to.be.equal(WeiPerWad.mul(3));
        expect((await centralizedOraclePriceFeed.delayedPrice()).lastUpdate).to.be.equal(expectedTS);
      });
    });
    context("delay passed", async () => {
      it("price updated", async () => {
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(2), await time.latest()]);
        await centralizedOraclePriceFeed.peekPrice();

        await time.increase(900);

        const expectedTS = await time.latest();
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(3), expectedTS]);
        await centralizedOraclePriceFeed.peekPrice();

        await time.increase(900);
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad.mul(4), await time.latest()]);
        await centralizedOraclePriceFeed.peekPrice();

        expect(await centralizedOraclePriceFeed.readPrice()).to.be.equal(WeiPerWad.mul(3));
        expect((await centralizedOraclePriceFeed.delayedPrice()).lastUpdate).to.be.equal(expectedTS);
      });
    });
  });

  describe("#pause(), #unpause()", () => {
    context("when caller is not the owner", () => {
      it("should revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(centralizedOraclePriceFeed.pause()).to.be.revertedWith("!(ownerRole or govRole)");
        await expect(centralizedOraclePriceFeed.unpause()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when caller is the owner", () => {
      it("should be able to call pause and unpause perfectly", async () => {
        mockedAccessControlConfig.hasRole.returns(true);
        mockedCentralizedPriceOracle.getPrice.returns([WeiPerWad, await time.latest()]);

        expect(await centralizedOraclePriceFeed.paused()).to.be.false;
        await centralizedOraclePriceFeed.pause();
        expect(await centralizedOraclePriceFeed.paused()).to.be.true;
        await centralizedOraclePriceFeed.unpause();
        expect(await centralizedOraclePriceFeed.paused()).to.be.false;
      });
    });
  });
});
