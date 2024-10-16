const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const { smock } = require("@defi-wonderland/smock");

const { formatBytes32String, parseEther } = ethers.utils;
const provider = ethers.provider;
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");

describe("PositionManager", () => {
  // Contracts
  let positionManager;

  let mockedBookKeeper;
  let mockedTokenAdapter;
  let mockedShowStopper;
  let mockedCollateralPoolConfig;
  let mockedPriceOracle;
  let mockedPriceFeed;
  let mockedAccessControlConfig;

  // Signer
  let positionManagerAsAlice;
  let positionManagerAsBob;

  let AliceAddress;
  let BobAddress;
  let AddressZero;

  beforeEach(async () => {
    const { allice, bob, a0 } = await getNamedAccounts();
    AliceAddress = allice;
    BobAddress = bob;
    AddressZero = a0;

    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockedBookKeeper = await smock.fake("BookKeeper");
    mockedTokenAdapter = await smock.fake("TokenAdapter");
    mockedShowStopper = await smock.fake("ShowStopper");
    mockedPriceOracle = await smock.fake("PriceOracle");
    mockedPriceFeed = await smock.fake("SimplePriceFeed");

    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockedAccessControlConfig.hasRole.returns(true);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

    mockedShowStopper.live.returns(1);
    mockedBookKeeper.totalStablecoinIssued.returns(0);
    mockedBookKeeper.addToWhitelist.returns();
    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockedPriceOracle.setPrice.returns();
    mockedPriceOracle.stableCoinReferencePrice.returns(WeiPerRay);
    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay);
    mockedCollateralPoolConfig.getAdapter.returns(mockedTokenAdapter.address);
    mockedCollateralPoolConfig.getPriceFeed.returns(mockedPriceFeed.address);
    mockedPriceFeed.isPriceOk.returns(true);
    mockedCollateralPoolConfig.collateralPools.returns({
      totalDebtShare: 0,
      debtAccumulatedRate: WeiPerRay,
      priceWithSafetyMargin: WeiPerRay,
      debtCeiling: 0,
      debtFloor: 0,
      priceFeed: AddressZero,
      liquidationRatio: WeiPerRay,
      stabilityFeeRate: WeiPerRay,
      lastAccumulationTime: 0,
      adapter: AddressZero,
      closeFactorBps: 5000,
      liquidatorIncentiveBps: 10250,
      treasuryFeesBps: 5000,
      strategy: AddressZero,
      positionDebtCeiling: WeiPerRay.mul(10000),
    });

    const PositionManagerFactory = await ethers.getContractFactory("MockPositionManager");
    positionManager = await PositionManagerFactory.deploy();
    await positionManager.deployed();

    positionManagerAsAlice = positionManager.connect(provider.getSigner(AliceAddress));
    positionManagerAsBob = positionManager.connect(provider.getSigner(BobAddress));

    await positionManager.initialize(mockedBookKeeper.address, mockedShowStopper.address, mockedPriceOracle.address);
  });

  describe("#open()", () => {
    context("when supply zero address", () => {
      it("should revert", async () => {
        await expect(positionManager.open(formatBytes32String("WNATIVE"), AddressZero)).to.be.revertedWith("PositionManager/user-address(0)");
      });
    });
    context("when collateral pool doesn't init", () => {
      it("should revert", async () => {
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(0);
        await expect(positionManager.open(formatBytes32String("WNATIVE"), AliceAddress)).to.be.revertedWith(
          "PositionManager/collateralPool-not-init"
        );
      });
    });
    context("when parameters are valid", () => {
      it("should be able to open CDP with an incremental CDP index", async () => {
        expect(await positionManager.owners(1)).to.equal(AddressZero);
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        expect(await positionManager.lastPositionId()).to.equal(1);
        expect(await positionManager.owners(1)).to.equal(AliceAddress);

        expect(await positionManager.owners(2)).to.equal(AddressZero);
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);
        expect(await positionManager.lastPositionId()).to.equal(2);
        expect(await positionManager.owners(2)).to.equal(BobAddress);

        expect(await positionManager.owners(3)).to.equal(AddressZero);
        await positionManager.open(formatBytes32String("COL"), AliceAddress);
        expect(await positionManager.lastPositionId()).to.equal(3);
        expect(await positionManager.owners(3)).to.equal(AliceAddress);
      });
    });
  });

  describe("#give()", () => {
    context("when caller has no access to the position (or have no allowance)", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManager.give(1, AliceAddress)).to.be.revertedWith("owner not allowed");
      });
    });
    context("when input destination as zero address", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManagerAsAlice.give(1, AddressZero)).to.be.revertedWith("destination address(0)");
      });
    });
    context("when input destination as current owner address", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManagerAsAlice.give(1, AliceAddress)).to.be.revertedWith("destination already owner");
      });
    });
    context("when parameters are valid", () => {
      it("should be able to change the owner of CDP ", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        expect(await positionManager.owners(1)).to.equal(AliceAddress);
        await positionManagerAsAlice.give(1, BobAddress);
        expect(await positionManager.owners(1)).to.equal(BobAddress);
      });
    });
  });

  describe("#allowManagePosition()", () => {
    context("when caller has no access to the position (or have no allowance)", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManager.allowManagePosition(1, AliceAddress, true)).to.be.revertedWith("owner not allowed");
      });
    });
    context("when _user address is zero", () => {
      it("should revert with user address zero error", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManagerAsAlice.allowManagePosition(1, "0x0000000000000000000000000000000000000000", true)).to.be.revertedWith(
          "PositionManager/user-address(0)"
        );
      });
    });
    context("when parameters are valid", () => {
      it("should be able to add user allowance to a position", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        expect(await positionManager.ownerWhitelist(AliceAddress, 1, BobAddress)).to.be.equal(false);
        await positionManagerAsAlice.allowManagePosition(1, BobAddress, true);
        expect(await positionManager.ownerWhitelist(AliceAddress, 1, BobAddress)).to.be.equal(true);
      });
    });
  });

  describe("#allowMigratePosition()", () => {
    context("when _user address is zero", () => {
      it("should revert with user address zero error", async () => {
        await expect(positionManagerAsAlice.allowMigratePosition("0x0000000000000000000000000000000000000000", true)).to.be.revertedWith(
          "PositionManager/user-address(0)"
        );
      });
    });
    context("when parameters are valid", () => {
      it("should be able to give/revoke migration allowance to other address", async () => {
        expect(await positionManager.migrationWhitelist(AliceAddress, BobAddress)).to.be.equal(false);
        await positionManagerAsAlice.allowMigratePosition(BobAddress, true);
        expect(await positionManager.migrationWhitelist(AliceAddress, BobAddress)).to.be.equal(true);
        await positionManagerAsAlice.allowMigratePosition(BobAddress, false);
        expect(await positionManager.migrationWhitelist(AliceAddress, BobAddress)).to.be.equal(false);
      });
    });
  });

  describe("#list()", () => {
    context("when a few position has been opened", () => {
      it("should work as a linklist perfectly", async () => {
        // Alice open position 1-3
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);

        // Bob open position 4-7
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);

        let [aliceCount, aliceFirst, aliceLast] = await Promise.all([
          positionManager.ownerPositionCount(AliceAddress),
          positionManager.ownerFirstPositionId(AliceAddress),
          positionManager.ownerLastPositionId(AliceAddress),
        ]);
        expect(aliceCount).to.equal(3);
        expect(aliceFirst).to.equal(1);
        expect(aliceLast).to.equal(3);
        expect(await positionManager.list(1)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(2)]);
        expect(await positionManager.list(2)).to.be.deep.equal([BigNumber.from(1), BigNumber.from(3)]);
        expect(await positionManager.list(3)).to.be.deep.equal([BigNumber.from(2), BigNumber.from(0)]);

        let [bobCount, bobFirst, bobLast] = await Promise.all([
          positionManager.ownerPositionCount(BobAddress),
          positionManager.ownerFirstPositionId(BobAddress),
          positionManager.ownerLastPositionId(BobAddress),
        ]);
        expect(bobCount).to.equal(4);
        expect(bobFirst).to.equal(4);
        expect(bobLast).to.equal(7);
        expect(await positionManager.list(4)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(5)]);
        expect(await positionManager.list(5)).to.be.deep.equal([BigNumber.from(4), BigNumber.from(6)]);
        expect(await positionManager.list(6)).to.be.deep.equal([BigNumber.from(5), BigNumber.from(7)]);
        expect(await positionManager.list(7)).to.be.deep.equal([BigNumber.from(6), BigNumber.from(0)]);

        // try giving position 2 to Bob, the CDP#2 should be concat at the end of the link list
        await positionManagerAsAlice.give(2, BobAddress);
        [aliceCount, aliceFirst, aliceLast] = await Promise.all([
          positionManager.ownerPositionCount(AliceAddress),
          positionManager.ownerFirstPositionId(AliceAddress),
          positionManager.ownerLastPositionId(AliceAddress),
        ]);
        expect(aliceCount).to.equal(2);
        expect(aliceFirst).to.equal(1);
        expect(aliceLast).to.equal(3);
        expect(await positionManager.list(1)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(3)]);
        expect(await positionManager.list(3)).to.be.deep.equal([BigNumber.from(1), BigNumber.from(0)]);
        [bobCount, bobFirst, bobLast] = await Promise.all([
          positionManager.ownerPositionCount(BobAddress),
          positionManager.ownerFirstPositionId(BobAddress),
          positionManager.ownerLastPositionId(BobAddress),
        ]);
        expect(bobCount).to.equal(5);
        expect(bobFirst).to.equal(4);
        expect(bobLast).to.equal(2); // CDP#2 concatted at the end of the list
        expect(await positionManager.list(4)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(5)]);
        expect(await positionManager.list(5)).to.be.deep.equal([BigNumber.from(4), BigNumber.from(6)]);
        expect(await positionManager.list(6)).to.be.deep.equal([BigNumber.from(5), BigNumber.from(7)]);
        expect(await positionManager.list(7)).to.be.deep.equal([BigNumber.from(6), BigNumber.from(2)]);
        expect(await positionManager.list(2)).to.be.deep.equal([BigNumber.from(7), BigNumber.from(0)]);
      });
    });
  });

  describe("#adjustPosition()", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManager.adjustPosition(1, parseEther("1"), parseEther("50"), "0x")).to.be.revertedWith("owner not allowed");
      });
    });
    context("when price is not healthy", () => {
      it("should revert", async () => {
        mockedPriceFeed.isPriceOk.returns(false);
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.adjustPosition
          .whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, positionAddress, positionAddress, parseEther("1"), parseEther("50"))
          .returns();

        await expect(positionManagerAsAlice.adjustPosition(1, parseEther("1"), parseEther("50"), "0x")).to.be.revertedWith(
          "PositionManager/price-is-not-healthy"
        );
      });
    });
    context("when parameters are valid", async () => {
      it("should be able to call BookKeeper.adjustPosition", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.adjustPosition
          .whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, positionAddress, positionAddress, parseEther("1"), parseEther("50"))
          .returns();

        await positionManagerAsAlice.adjustPosition(1, parseEther("1"), parseEther("50"), "0x");
      });
    });
  });

  describe("#moveCollateral(uint256,address,uint256,bytes)", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManager["moveCollateral(uint256,address,uint256,bytes)"](1, AliceAddress, parseEther("50"), "0x")).to.be.revertedWith(
          "owner not allowed"
        );
      });
    });
    context("when price is not healthy", () => {
      it("should revert", async () => {
        mockedPriceFeed.isPriceOk.returns(false);
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.moveCollateral.whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, BobAddress, parseEther("1")).returns();

        await expect(
          positionManagerAsAlice["moveCollateral(uint256,address,uint256,bytes)"](1, AliceAddress, parseEther("50"), "0x")
        ).to.be.revertedWith("PositionManager/price-is-not-healthy");
      });
    });
    context("when parameters are valid", async () => {
      it("should be able to call moveCollateral(uint256,address,uint256,bytes)", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.moveCollateral.whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, BobAddress, parseEther("1")).returns();

        await positionManagerAsAlice["moveCollateral(uint256,address,uint256,bytes)"](1, BobAddress, parseEther("1"), "0x");
      });
    });
    context("when _destination argument is a zero address, four args", () => {
      it("should revert with 'PositionManager/dst-address(0)'", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(
          positionManagerAsAlice["moveCollateral(uint256,address,uint256,bytes)"](
            1,
            "0x0000000000000000000000000000000000000000", // Zero address for _destination
            parseEther("1"),
            "0x"
          )
        ).to.be.revertedWith("PositionManager/dst-address(0)");
      });
    });
    context("when _destination argument is a zero address, five args", () => {
      it("should revert with 'PositionManager/dst-address(0)' message", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);

        await expect(
          positionManagerAsAlice["moveCollateral(bytes32,uint256,address,uint256,bytes)"](
            formatBytes32String("WNATIVE"),
            1,
            "0x0000000000000000000000000000000000000000",
            parseEther("50"),
            "0x"
          )
        ).to.be.revertedWith("PositionManager/dst-address(0)");
      });
    });
  });

  // This function has the purpose to take away collateral from the system that doesn't correspond to the position but was sent there wrongly.
  describe("#moveCollateral(bytes32,uint256,address,uint256,address,bytes)", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(
          positionManager["moveCollateral(bytes32,uint256,address,uint256,bytes)"](
            formatBytes32String("WNATIVE"),
            1,
            AliceAddress,
            parseEther("50"),
            "0x"
          )
        ).to.be.revertedWith("owner not allowed");
      });
    });
    context("when price is not healthy", () => {
      it("should revert", async () => {
        mockedPriceFeed.isPriceOk.returns(false);
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.moveCollateral.whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, BobAddress, parseEther("1")).returns();

        await expect(
          positionManagerAsAlice["moveCollateral(bytes32,uint256,address,uint256,bytes)"](
            formatBytes32String("WNATIVE"),
            1,
            AliceAddress,
            parseEther("50"),
            "0x"
          )
        ).to.be.revertedWith("PositionManager/price-is-not-healthy");
      });
    });
    context("when parameters are valid", async () => {
      it("should be able to call moveCollateral(bytes32,uint256,address,uint256,bytes)", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.moveCollateral.whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, BobAddress, parseEther("1")).returns();

        await positionManagerAsAlice["moveCollateral(bytes32,uint256,address,uint256,bytes)"](
          formatBytes32String("WNATIVE"),
          1,
          BobAddress,
          parseEther("1"),
          "0x"
        );
      });
    });
  });

  describe("#moveStablecoin()", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManager.moveStablecoin(1, BobAddress, WeiPerRad.mul(10))).to.be.revertedWith("owner not allowed");
      });
    });
    context("when parameters are valid", async () => {
      it("should be able to call moveStablecoin()", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.moveStablecoin.whenCalledWith(positionAddress, BobAddress, WeiPerRad.mul(10)).returns();
        await positionManagerAsAlice.moveStablecoin(1, BobAddress, WeiPerRad.mul(10));
      });
    });
    context("when _destination argument is a zero address", () => {
      it("should revert with 'PositionManager/dst-address(0)' message", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.moveStablecoin.whenCalledWith(positionAddress, BobAddress, WeiPerRad.mul(10)).returns();

        await expect(positionManagerAsAlice.moveStablecoin(1, "0x0000000000000000000000000000000000000000", WeiPerRad.mul(10))).to.be.revertedWith(
          "PositionManager/dst-address(0)"
        );
      });
    });
  });

  describe("#exportPosition()", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManagerAsBob.exportPosition(1, BobAddress)).to.be.revertedWith("owner not allowed");
      });
    });
    context("when destination (Bob) has no migration access on caller (Alice)", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManagerAsAlice.allowManagePosition(1, BobAddress, true);
        await expect(positionManagerAsAlice.exportPosition(1, BobAddress)).to.be.revertedWith("migration not allowed");
      });
    });
    context("when Alice wants to export her own position to her own address", async () => {
      it("should be able to call exportPosition()", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.positions.whenCalledWith(formatBytes32String("WNATIVE"), positionAddress).returns([WeiPerWad.mul(2), WeiPerWad.mul(1)]);
        mockedBookKeeper.movePosition
          .whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, AliceAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
          .returns();

        await positionManagerAsAlice.exportPosition(1, AliceAddress);
      });
    });
    context("when Alice wants Bob to export her position to Bob's address", async () => {
      it("should be able to call exportPosition()", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        // Alice allows Bob to manage her position#1
        await positionManagerAsAlice.allowManagePosition(1, BobAddress, true);

        mockedBookKeeper.positions.whenCalledWith(formatBytes32String("WNATIVE"), positionAddress).returns([WeiPerWad.mul(2), WeiPerWad.mul(1)]);
        mockedBookKeeper.movePosition
          .whenCalledWith(formatBytes32String("WNATIVE"), positionAddress, BobAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
          .returns();

        // Bob exports position#1 to his address
        await positionManagerAsBob.exportPosition(1, BobAddress);
      });
    });
    context("when _destination is a zero address", () => {
      it("onlyMigrationAllowed modifier will make sure zero address _destination provided fn flow will revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        //migrationWhiteList can never have address(0) as the first key, therefore _destination as zero address will always be reverted in the modifier
        await positionManagerAsAlice.allowManagePosition(1, BobAddress, true);
        await positionManagerAsAlice.allowMigratePosition(BobAddress, true);

        await expect(positionManagerAsBob.exportPosition(1, "0x0000000000000000000000000000000000000000")).to.be.revertedWith(
          "migration not allowed"
        );
      });
    });
  });

  describe("#importPosition()", () => {
    context("when caller (Bob) has no migration access on source address (Alice)", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManagerAsBob.importPosition(AliceAddress, 1)).to.be.revertedWith("migration not allowed");
      });
    });
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        // Alice gives Bob migration access on her address
        await positionManagerAsAlice.allowMigratePosition(BobAddress, true);
        await expect(positionManagerAsBob.importPosition(AliceAddress, 1)).to.be.revertedWith("owner not allowed");
      });
    });
    context("when Alice wants to import her own position from her address", async () => {
      it("should be able to call importPosition()", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        mockedBookKeeper.positions.whenCalledWith(formatBytes32String("WNATIVE"), AliceAddress).returns([WeiPerWad.mul(2), WeiPerWad.mul(1)]);
        mockedBookKeeper.movePosition
          .whenCalledWith(formatBytes32String("WNATIVE"), AliceAddress, positionAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
          .returns();

        await positionManagerAsAlice.importPosition(AliceAddress, 1);
      });
    });
    context("when Alice wants Bob to import her position from Bob's address", async () => {
      it("should be able to call importPosition()", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const positionAddress = await positionManager.positions(1);

        // Alice allows Bob to manage her position#1
        await positionManagerAsAlice.allowManagePosition(1, BobAddress, true);
        // Alice gives Bob migration access on her address
        await positionManagerAsAlice.allowMigratePosition(BobAddress, true);

        mockedBookKeeper.positions.whenCalledWith(formatBytes32String("WNATIVE"), BobAddress).returns([WeiPerWad.mul(2), WeiPerWad.mul(1)]);
        mockedBookKeeper.movePosition
          .whenCalledWith(formatBytes32String("WNATIVE"), BobAddress, positionAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
          .returns();

        // Bob imports position#1 from his address to position#1
        await positionManagerAsBob.importPosition(BobAddress, 1);
      });
    });
  });

  describe("#movePosition()", () => {
    context("when caller (Bob) has no access to the source position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);

        await expect(positionManagerAsBob.movePosition(1, 2)).to.be.revertedWith("owner not allowed");
      });
    });
    context("when caller (Alice) has no access to the destination position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);

        await expect(positionManagerAsAlice.movePosition(1, 2)).to.be.revertedWith("owner not allowed");
      });
    });
    context("when these two positions are from different collateral pool", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManager.open(formatBytes32String("BTC"), BobAddress);
        await positionManagerAsBob.allowManagePosition(2, AliceAddress, true);

        await expect(positionManagerAsAlice.movePosition(1, 2)).to.be.revertedWith("!same collateral pool");
      });
    });
    context("when Alice wants to move her position#1 to her position#2", async () => {
      it("should be able to call movePosition()", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const position1Address = await positionManager.positions(1);
        const position2Address = await positionManager.positions(2);

        mockedBookKeeper.positions.whenCalledWith(formatBytes32String("WNATIVE"), position1Address).returns([WeiPerWad.mul(2), WeiPerWad.mul(1)]);
        mockedBookKeeper.movePosition
          .whenCalledWith(formatBytes32String("WNATIVE"), position1Address, position2Address, WeiPerWad.mul(2), WeiPerWad.mul(1))
          .returns();

        await positionManagerAsAlice.movePosition(1, 2);
      });
    });
    context("when Alice wants to move her position#1 to Bob's position#2", async () => {
      it("should be able to call movePosition()", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await positionManager.open(formatBytes32String("WNATIVE"), BobAddress);
        await positionManagerAsBob.allowManagePosition(2, AliceAddress, true);
        const position1Address = await positionManager.positions(1);
        const position2Address = await positionManager.positions(2);

        mockedBookKeeper.positions.whenCalledWith(formatBytes32String("WNATIVE"), position1Address).returns([WeiPerWad.mul(2), WeiPerWad.mul(1)]);

        mockedBookKeeper.movePosition
          .whenCalledWith(formatBytes32String("WNATIVE"), position1Address, position2Address, WeiPerWad.mul(2), WeiPerWad.mul(1))
          .returns();

        await positionManagerAsAlice.movePosition(1, 2);
      });
    });
  });

  describe("#setBookKeeper()", () => {
    context("when setting a new BookKeeper", () => {
      it("should emit BookKeeperUpdated event with old and new addresses", async () => {
        const oldBookKeeper = await positionManager.bookKeeper();
        const mockedBookKeeper2 = await smock.fake("BookKeeper");
        mockedBookKeeper2.totalStablecoinIssued.returns(WeiPerRad);
        // Set the newBookKeeper and expect an event
        await expect(positionManager.setBookKeeper(mockedBookKeeper2.address))
          .to.emit(positionManager, "LogBookKeeperUpdated")
          .withArgs(oldBookKeeper, mockedBookKeeper2.address);
      });
    });
  });

  describe("#setPriceOracle()", () => {
    context("when stablecoinReferencePrice is 0 for the new priceOracle", () => {
      it("should revert", async () => {
        const mockedPriceOracle2 = await smock.fake("PriceOracle");
        mockedPriceOracle2.stableCoinReferencePrice.returns(0);
        // Set the newPriceOracle and expect an event
        await expect(positionManager.setPriceOracle(mockedPriceOracle2.address)).to.be.revertedWith("PositionManager/invalid-priceOracle");
      });
    });
    context("when setting a new PriceOracle", () => {
      it("should emit PriceOracleUpdated event with old and new addresses", async () => {
        const oldPriceOracle = await positionManager.priceOracle();
        const mockedPriceOracle2 = await smock.fake("PriceOracle");
        mockedPriceOracle2.stableCoinReferencePrice.returns(WeiPerRad);
        // Set the newPriceOracle and expect an event
        await expect(positionManager.setPriceOracle(mockedPriceOracle2.address))
          .to.emit(positionManager, "LogPriceOracleUpdated")
          .withArgs(oldPriceOracle, mockedPriceOracle2.address);
      });
    });
  });

  describe("#redeemLockedCollateral()", () => {
    context("when caller has no access to the position (or have no allowance)", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        await expect(positionManager.redeemLockedCollateral(1, AliceAddress, "0x")).to.be.revertedWith("owner not allowed");
      });
    });
    context("when parameters are valid", () => {
      it("should be able to redeemLockedCollateral", async () => {
        await positionManager.open(formatBytes32String("WNATIVE"), AliceAddress);
        const position1Address = await positionManager.positions(1);
        mockedShowStopper.redeemLockedCollateral.whenCalledWith(formatBytes32String("WNATIVE"), position1Address, AliceAddress, "0x").returns();
        await positionManagerAsAlice.redeemLockedCollateral(1, AliceAddress, "0x");
      });
    });
  });
});
