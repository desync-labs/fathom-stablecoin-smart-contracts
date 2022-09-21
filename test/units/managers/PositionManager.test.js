require("@openzeppelin/test-helpers")

const { ethers, upgrades, waffle } = require("hardhat");
const chai = require('chai');
const { smock } = require("@defi-wonderland/smock");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { BigNumber } = require("ethers");


chai.use(smock.matchers)
const { expect } = chai
const { AddressZero } = ethers.constants
const { parseEther, formatBytes32String } = ethers.utils

const loadFixture = async () => {
  const [deployer] = await ethers.getSigners()

  const mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
  const mockedBookKeeper = await smock.fake("BookKeeper");
  const mockedDummyToken = await smock.fake("BEP20");
  const mockedTokenAdapter = await smock.fake("TokenAdapter");
  const mockedShowStopper = await smock.fake("ShowStopper");

  // Deploy PositionManager
  const PositionManager = (await ethers.getContractFactory("PositionManager", deployer))
  const positionManager = (await upgrades.deployProxy(PositionManager, [
    mockedBookKeeper.address,
    mockedShowStopper.address,
  ]))
  await positionManager.deployed()

  return {
    positionManager,
    mockedBookKeeper,
    mockedDummyToken,
    mockedTokenAdapter,
    mockedShowStopper,
    mockedCollateralPoolConfig,
  }
}

describe("PositionManager", () => {
  // Accounts
  let deployer
  let alice
  let bob
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let bobAddress
  let devAddress

  // Contracts
  let positionManager

  let mockedBookKeeper
  let mockedDummyToken
  let mockedTokenAdapter
  let mockedShowStopper
  let mockedCollateralPoolConfig

  // Signer
  let positionManagerAsAlice
  let positionManagerAsBob

  beforeEach(async () => {
    ;({
      positionManager,
      mockedBookKeeper,
      mockedDummyToken,
      mockedTokenAdapter,
      mockedShowStopper,
      mockedCollateralPoolConfig,
    } = await loadFixture())
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])

    mockedDummyToken.decimals.returns(18)
    mockedBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(WeiPerRay)
    mockedCollateralPoolConfig.getAdapter.returns(mockedTokenAdapter.address)
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
    })

    positionManagerAsAlice = positionManager.connect(alice)
    positionManagerAsBob = positionManager.connect(bob)
  })

  describe("#open()", () => {
    context("when supply zero address", () => {
      it("should revert", async () => {
        await expect(positionManager.open(formatBytes32String("BNB"), AddressZero)).to.be.revertedWith(
          "PositionManager/user-address(0)"
        )
      })
    })
    context("when collateral pool doesn't init", () => {
      it("should revert", async () => {
        mockedCollateralPoolConfig.getDebtAccumulatedRate.returns(0)
        await expect(positionManager.open(formatBytes32String("BNB"), aliceAddress)).to.be.revertedWith(
          "PositionManager/collateralPool-not-init"
        )
      })
    })
    context("when parameters are valid", () => {
      it("should be able to open CDP with an incremental CDP index", async () => {
        expect(await positionManager.owners(1)).to.equal(AddressZero)
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        expect(await positionManager.lastPositionId()).to.equal(1)
        expect(await positionManager.owners(1)).to.equal(aliceAddress)

        expect(await positionManager.owners(2)).to.equal(AddressZero)
        await positionManager.open(formatBytes32String("BNB"), bobAddress)
        expect(await positionManager.lastPositionId()).to.equal(2)
        expect(await positionManager.owners(2)).to.equal(bobAddress)

        expect(await positionManager.owners(3)).to.equal(AddressZero)
        await positionManager.open(formatBytes32String("COL"), aliceAddress)
        expect(await positionManager.lastPositionId()).to.equal(3)
        expect(await positionManager.owners(3)).to.equal(aliceAddress)
      })
    })
  })

  describe("#give()", () => {
    context("when caller has no access to the position (or have no allowance)", () => {
      it("should revert", async () => {
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(positionManager.give(1, aliceAddress)).to.be.revertedWith("owner not allowed")
      })
    })
    context("when input destination as zero address", () => {
      it("should revert", async () => {
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(positionManagerAsAlice.give(1, AddressZero)).to.be.revertedWith("destination address(0)")
      })
    })
    context("when input destination as current owner address", () => {
      it("should revert", async () => {
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(positionManagerAsAlice.give(1, aliceAddress)).to.be.revertedWith("destination already owner")
      })
    })
    context("when parameters are valid", () => {
      it("should be able to change the owner of CDP ", async () => {
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        expect(await positionManager.owners(1)).to.equal(aliceAddress)
        await positionManagerAsAlice.give(1, bobAddress)
        expect(await positionManager.owners(1)).to.equal(bobAddress)
      })
    })
  })

  describe("#allowManagePosition()", () => {
    context("when caller has no access to the position (or have no allowance)", () => {
      it("should revert", async () => {
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(positionManager.allowManagePosition(1, aliceAddress, 1)).to.be.revertedWith("owner not allowed")
      })
    })
    context("when parameters are valid", () => {
      it("should be able to add user allowance to a position", async () => {
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        expect(await positionManager.ownerWhitelist(aliceAddress, 1, bobAddress)).to.be.equal(0)
        await positionManagerAsAlice.allowManagePosition(1, bobAddress, 1)
        expect(await positionManager.ownerWhitelist(aliceAddress, 1, bobAddress)).to.be.equal(1)
      })
    })
  })

  describe("#allowMigratePosition()", () => {
    context("when parameters are valid", () => {
      it("should be able to give/revoke migration allowance to other address", async () => {
        expect(await positionManager.migrationWhitelist(aliceAddress, bobAddress)).to.be.equal(0)
        await positionManagerAsAlice.allowMigratePosition(bobAddress, 1)
        expect(await positionManager.migrationWhitelist(aliceAddress, bobAddress)).to.be.equal(1)
        await positionManagerAsAlice.allowMigratePosition(bobAddress, 0)
        expect(await positionManager.migrationWhitelist(aliceAddress, bobAddress)).to.be.equal(0)
      })
    })
  })

  describe("#list()", () => {
    context("when a few position has been opened", () => {
      it("should work as a linklist perfectly", async () => {
        // Alice open position 1-3
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)

        // Bob open position 4-7
        await positionManager.open(formatBytes32String("BNB"), bobAddress)
        await positionManager.open(formatBytes32String("BNB"), bobAddress)
        await positionManager.open(formatBytes32String("BNB"), bobAddress)
        await positionManager.open(formatBytes32String("BNB"), bobAddress)

        let [aliceCount, aliceFirst, aliceLast] = await Promise.all([
          positionManager.ownerPositionCount(aliceAddress),
          positionManager.ownerFirstPositionId(aliceAddress),
          positionManager.ownerLastPositionId(aliceAddress),
        ])
        expect(aliceCount).to.equal(3)
        expect(aliceFirst).to.equal(1)
        expect(aliceLast).to.equal(3)
        expect(await positionManager.list(1)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(2)])
        expect(await positionManager.list(2)).to.be.deep.equal([BigNumber.from(1), BigNumber.from(3)])
        expect(await positionManager.list(3)).to.be.deep.equal([BigNumber.from(2), BigNumber.from(0)])

        let [bobCount, bobFirst, bobLast] = await Promise.all([
          positionManager.ownerPositionCount(bobAddress),
          positionManager.ownerFirstPositionId(bobAddress),
          positionManager.ownerLastPositionId(bobAddress),
        ])
        expect(bobCount).to.equal(4)
        expect(bobFirst).to.equal(4)
        expect(bobLast).to.equal(7)
        expect(await positionManager.list(4)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(5)])
        expect(await positionManager.list(5)).to.be.deep.equal([BigNumber.from(4), BigNumber.from(6)])
        expect(await positionManager.list(6)).to.be.deep.equal([BigNumber.from(5), BigNumber.from(7)])
        expect(await positionManager.list(7)).to.be.deep.equal([BigNumber.from(6), BigNumber.from(0)])

        // try giving position 2 to Bob, the CDP#2 should be concat at the end of the link list
        await positionManagerAsAlice.give(2, bobAddress)
        ;[aliceCount, aliceFirst, aliceLast] = await Promise.all([
          positionManager.ownerPositionCount(aliceAddress),
          positionManager.ownerFirstPositionId(aliceAddress),
          positionManager.ownerLastPositionId(aliceAddress),
        ])
        expect(aliceCount).to.equal(2)
        expect(aliceFirst).to.equal(1)
        expect(aliceLast).to.equal(3)
        expect(await positionManager.list(1)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(3)])
        expect(await positionManager.list(3)).to.be.deep.equal([BigNumber.from(1), BigNumber.from(0)])
        ;[bobCount, bobFirst, bobLast] = await Promise.all([
          positionManager.ownerPositionCount(bobAddress),
          positionManager.ownerFirstPositionId(bobAddress),
          positionManager.ownerLastPositionId(bobAddress),
        ])
        expect(bobCount).to.equal(5)
        expect(bobFirst).to.equal(4)
        expect(bobLast).to.equal(2) // CDP#2 concatted at the end of the list
        expect(await positionManager.list(4)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(5)])
        expect(await positionManager.list(5)).to.be.deep.equal([BigNumber.from(4), BigNumber.from(6)])
        expect(await positionManager.list(6)).to.be.deep.equal([BigNumber.from(5), BigNumber.from(7)])
        expect(await positionManager.list(7)).to.be.deep.equal([BigNumber.from(6), BigNumber.from(2)])
        expect(await positionManager.list(2)).to.be.deep.equal([BigNumber.from(7), BigNumber.from(0)])
      })
    })
  })

  describe("#adjustPosition()", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(
          positionManager.adjustPosition(1, parseEther("1"), parseEther("50"), mockedTokenAdapter.address, "0x")
        ).to.be.revertedWith("owner not allowed")
      })
    })
    context("when parameters are valid", async () => {
      it("should be able to call BookKeeper.adjustPosition", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        mockedBookKeeper.adjustPosition.returns()
        await positionManagerAsAlice.adjustPosition(
          1,
          parseEther("1"),
          parseEther("50"),
          mockedTokenAdapter.address,
          "0x"
        )

        expect(mockedBookKeeper.adjustPosition).to.be.called.calledOnceWith(
          formatBytes32String("BNB"), 
          positionAddress, 
          positionAddress, 
          positionAddress, 
          parseEther("1"), 
          parseEther("50")
        )

        expect(mockedTokenAdapter.onAdjustPosition).to.be.calledOnceWith(positionAddress, positionAddress, parseEther("1"), parseEther("50"), "0x")
      })
    })
  })

  describe("#moveCollateral(uint256,address,uint256,address,bytes)", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(
          positionManager["moveCollateral(uint256,address,uint256,address,bytes)"](
            1,
            aliceAddress,
            parseEther("50"),
            mockedTokenAdapter.address,
            "0x"
          )
        ).to.be.revertedWith("owner not allowed")
      })
    })
    context("when parameters are valid", async () => {
      it("should be able to call moveCollateral(uint256,address,uint256,address,bytes)", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        mockedBookKeeper.moveCollateral.returns()
        await positionManagerAsAlice["moveCollateral(uint256,address,uint256,address,bytes)"](
          1,
          bobAddress,
          parseEther("1"),
          mockedTokenAdapter.address,
          "0x"
        )

        expect(mockedBookKeeper.moveCollateral).to.be.calledOnceWith(formatBytes32String("BNB"), positionAddress, bobAddress, parseEther("1"))
        expect(mockedTokenAdapter.onMoveCollateral).to.be.calledOnceWith(positionAddress,  bobAddress, parseEther("1"),  "0x")
      })
    })
  })

  // This function has the purpose to take away collateral from the system that doesn't correspond to the position but was sent there wrongly.
  describe("#moveCollateral(bytes32,uint256,address,uint256,address,bytes)", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(
          positionManager["moveCollateral(bytes32,uint256,address,uint256,address,bytes)"](
            formatBytes32String("BNB"),
            1,
            aliceAddress,
            parseEther("50"),
            mockedTokenAdapter.address,
            "0x"
          )
        ).to.be.revertedWith("owner not allowed")
      })
    })
    context("when parameters are valid", async () => {
      it("should be able to call moveCollateral(bytes32,uint256,address,uint256,address,bytes)", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        mockedBookKeeper.moveCollateral.returns()
        await positionManagerAsAlice["moveCollateral(bytes32,uint256,address,uint256,address,bytes)"](
          formatBytes32String("BNB"),
          1,
          bobAddress,
          parseEther("1"),
          mockedTokenAdapter.address,
          "0x"
        )

        expect(mockedBookKeeper.moveCollateral).to.be.calledOnceWith(formatBytes32String("BNB"), positionAddress, bobAddress, parseEther("1"))
        expect(mockedTokenAdapter.onMoveCollateral).to.be.calledOnceWith(positionAddress,  bobAddress, parseEther("1"),  "0x")
      })
    })
  })

  describe("#moveStablecoin()", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(positionManager.moveStablecoin(1, bobAddress, WeiPerRad.mul(10))).to.be.revertedWith(
          "owner not allowed"
        )
      })
    })
    context("when parameters are valid", async () => {
      it("should be able to call moveStablecoin()", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        mockedBookKeeper.moveStablecoin.returns()
        await positionManagerAsAlice.moveStablecoin(1, bobAddress, WeiPerRad.mul(10))

        expect(mockedBookKeeper.moveStablecoin).to.be.calledOnceWith(positionAddress,  bobAddress, WeiPerRad.mul(10))
      })
    })
  })

  describe("#exportPosition()", () => {
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(positionManagerAsBob.exportPosition(1, bobAddress)).to.be.revertedWith("owner not allowed")
      })
    })
    context("when destination (Bob) has no migration access on caller (Alice)", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManagerAsAlice.allowManagePosition(1, bobAddress, 1)
        await expect(positionManagerAsAlice.exportPosition(1, bobAddress)).to.be.revertedWith("migration not allowed")
      })
    })
    context("when Alice wants to export her own position to her own address", async () => {
      it("should be able to call exportPosition()", async () => {
        mockedTokenAdapter.onMoveCollateral.returns()
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        mockedBookKeeper.positions.returns([WeiPerWad.mul(2), WeiPerWad.mul(1)])
        mockedBookKeeper.movePosition.returns()

        await positionManagerAsAlice.exportPosition(1, aliceAddress)

        expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), positionAddress)
        expect(mockedBookKeeper.movePosition).to.be.calledOnceWith(formatBytes32String("BNB"), positionAddress, aliceAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
      })
    })
    context("when Alice wants Bob to export her position to Bob's address", async () => {
      it("should be able to call exportPosition()", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        // Alice allows Bob to manage her position#1
        await positionManagerAsAlice.allowManagePosition(1, bobAddress, 1)

        mockedBookKeeper.positions.returns([WeiPerWad.mul(2), WeiPerWad.mul(1)])
        mockedBookKeeper.movePosition.returns()

        // Bob exports position#1 to his address
        await positionManagerAsBob.exportPosition(1, bobAddress)

        expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), positionAddress)
        expect(mockedBookKeeper.movePosition).to.be.calledOnceWith(formatBytes32String("BNB"), positionAddress, bobAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
      })
    })
  })

  describe("#importPosition()", () => {
    context("when caller (Bob) has no migration access on source address (Alice)", () => {
      it("should revert", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(positionManagerAsBob.importPosition(aliceAddress, 1)).to.be.revertedWith("migration not allowed")
      })
    })
    context("when caller has no access to the position", () => {
      it("should revert", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        // Alice gives Bob migration access on her address
        await positionManagerAsAlice.allowMigratePosition(bobAddress, 1)
        await expect(positionManagerAsBob.importPosition(aliceAddress, 1)).to.be.revertedWith("owner not allowed")
      })
    })
    context("when Alice wants to import her own position from her address", async () => {
      it("should be able to call importPosition()", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        mockedBookKeeper.positions.returns([WeiPerWad.mul(2), WeiPerWad.mul(1)])
        mockedBookKeeper.movePosition.returns()

        await positionManagerAsAlice.importPosition(aliceAddress, 1)

        expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), aliceAddress)
        expect(mockedBookKeeper.movePosition).to.be.calledOnceWith(formatBytes32String("BNB"), aliceAddress, positionAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
      })
    })
    context("when Alice wants Bob to import her position from Bob's address", async () => {
      it("should be able to call importPosition()", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const positionAddress = await positionManager.positions(1)

        // Alice allows Bob to manage her position#1
        await positionManagerAsAlice.allowManagePosition(1, bobAddress, 1)
        // Alice gives Bob migration access on her address
        await positionManagerAsAlice.allowMigratePosition(bobAddress, 1)

        mockedBookKeeper.positions.returns([WeiPerWad.mul(2), WeiPerWad.mul(1)])
        mockedBookKeeper.movePosition.returns()

        // Bob imports position#1 from his address to position#1
        await positionManagerAsBob.importPosition(bobAddress, 1)

        expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), bobAddress)
        expect(mockedBookKeeper.movePosition).to.be.calledOnceWith(formatBytes32String("BNB"), bobAddress, positionAddress, WeiPerWad.mul(2), WeiPerWad.mul(1))
      })
    })
  })

  describe("#movePosition()", () => {
    context("when caller (Bob) has no access to the source position", () => {
      it("should revert", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManager.open(formatBytes32String("BNB"), bobAddress)

        await expect(positionManagerAsBob.movePosition(1, 2)).to.be.revertedWith("owner not allowed")
      })
    })
    context("when caller (Alice) has no access to the destination position", () => {
      it("should revert", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManager.open(formatBytes32String("BNB"), bobAddress)

        await expect(positionManagerAsAlice.movePosition(1, 2)).to.be.revertedWith("owner not allowed")
      })
    })
    context("when these two positions are from different collateral pool", () => {
      it("should revert", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManager.open(formatBytes32String("BTC"), bobAddress)
        await positionManagerAsBob.allowManagePosition(2, aliceAddress, 1)

        await expect(positionManagerAsAlice.movePosition(1, 2)).to.be.revertedWith("!same collateral pool")
      })
    })
    context("when Alice wants to move her position#1 to her position#2", async () => {
      it("should be able to call movePosition()", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const position1Address = await positionManager.positions(1)
        const position2Address = await positionManager.positions(2)

        mockedBookKeeper.positions.returns([WeiPerWad.mul(2), WeiPerWad.mul(1)])
        mockedBookKeeper.movePosition.returns()

        await positionManagerAsAlice.movePosition(1, 2)

        expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), position1Address)
        expect(mockedBookKeeper.movePosition).to.be.calledOnceWith(formatBytes32String("BNB"), position1Address, position2Address, WeiPerWad.mul(2), WeiPerWad.mul(1))
      })
    })
    context("when Alice wants to move her position#1 to Bob's position#2", async () => {
      it("should be able to call movePosition()", async () => {
        
        
        
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await positionManager.open(formatBytes32String("BNB"), bobAddress)
        await positionManagerAsBob.allowManagePosition(2, aliceAddress, 1)
        const position1Address = await positionManager.positions(1)
        const position2Address = await positionManager.positions(2)

        mockedBookKeeper.positions.returns([WeiPerWad.mul(2), WeiPerWad.mul(1)])
        mockedBookKeeper.movePosition.returns()

        await positionManagerAsAlice.movePosition(1, 2)

        expect(mockedBookKeeper.positions).to.be.calledOnceWith(formatBytes32String("BNB"), position1Address)
        expect(mockedBookKeeper.movePosition).to.be.calledOnceWith(formatBytes32String("BNB"), position1Address, position2Address, WeiPerWad.mul(2), WeiPerWad.mul(1))
      })
    })
  })

  describe("#redeemLockedCollateral()", () => {
    context("when caller has no access to the position (or have no allowance)", () => {
      it("should revert", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        await expect(
          positionManager.redeemLockedCollateral(1, mockedTokenAdapter.address, aliceAddress, "0x")
        ).to.be.revertedWith("owner not allowed")
      })
    })
    context("when parameters are valid", () => {
      it("should be able to redeemLockedCollateral", async () => {
        await positionManager.open(formatBytes32String("BNB"), aliceAddress)
        const position1Address = await positionManager.positions(1)
        await positionManagerAsAlice.redeemLockedCollateral(1, mockedTokenAdapter.address, aliceAddress, "0x")

        expect(mockedShowStopper.redeemLockedCollateral).to.be.calledOnceWith(formatBytes32String("BNB"), mockedTokenAdapter.address, position1Address, aliceAddress, "0x")
      })
    })
  })
})
