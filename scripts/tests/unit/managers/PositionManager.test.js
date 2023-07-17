const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { formatBytes32String, parseEther } = ethers.utils

const { DeployerAddress, AliceAddress, BobAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { loadFixture } = require("../../helper/fixtures");

const loadFixtureHandler = async () => {
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    const mockedBookKeeper = await createMock("BookKeeper");
    const mockedTokenAdapter = await createMock("TokenAdapter");
    const mockedShowStopper = await createMock("ShowStopper");
    const mockedPriceOracle = await createMock("PriceOracle");
    const mockedPriceFeed = await createMock("SimplePriceFeed");

    await mockedShowStopper.mock.live.returns(1);
    await mockedBookKeeper.mock.totalStablecoinIssued.returns(0);
    await mockedBookKeeper.mock.whitelist.returns();
    await mockedPriceOracle.mock.setPrice.returns()
    await mockedPriceOracle.mock.stableCoinReferencePrice.returns(WeiPerRay)
    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
    await mockedCollateralPoolConfig.mock.getAdapter.returns(mockedTokenAdapter.address)
    await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address);
    await mockedPriceFeed.mock.isPriceOk.returns(true);
    await mockedCollateralPoolConfig.mock.collateralPools.returns({
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
        positionDebtCeiling: WeiPerRay.mul(10000)
    })

    const positionManager = getContract("PositionManager", DeployerAddress)
    const positionManagerAsAlice = getContract("PositionManager", AliceAddress)
    const positionManagerAsBob = getContract("PositionManager", BobAddress)

    await positionManager.initialize(mockedBookKeeper.address, mockedShowStopper.address, mockedPriceOracle.address)

    return {
        positionManager,
        positionManagerAsAlice,
        positionManagerAsBob,
        mockedBookKeeper,
        mockedTokenAdapter,
        mockedShowStopper,
        mockedCollateralPoolConfig,
        mockedPriceOracle,
        mockedPriceFeed
    }
}

describe("PositionManager", () => {
    // Contracts
    let positionManager

    let mockedBookKeeper
    let mockedTokenAdapter
    let mockedShowStopper
    let mockedCollateralPoolConfig
    let mockedPriceOracle
    let mockedPriceFeed

    // Signer
    let positionManagerAsAlice
    let positionManagerAsBob

    before(async () => {
        await snapshot.revertToSnapshot();
        await Promise.all([deployer.deploy(artifacts.require('PositionManager.sol'), { gas: 5050000 })]);
        await snapshot.takeSnapshot();
    })

    beforeEach(async () => {
        ; ({
            positionManager,
            positionManagerAsAlice,
            positionManagerAsBob,
            mockedDummyToken,
            mockedBookKeeper,
            mockedTokenAdapter,
            mockedShowStopper,
            mockedCollateralPoolConfig,
            mockedPriceOracle,
            mockedPriceFeed

        } = await loadFixture(loadFixtureHandler))

    })

    describe("#open()", () => {
        context("when supply zero address", () => {
            it("should revert", async () => {
                await expect(positionManager.open(formatBytes32String("WXDC"), AddressZero)).to.be.revertedWith(
                    "PositionManager/user-address(0)"
                )
            })
        })
        context("when collateral pool doesn't init", () => {
            it("should revert", async () => {
                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(0)
                await expect(positionManager.open(formatBytes32String("WXDC"), AliceAddress)).to.be.revertedWith(
                    "PositionManager/collateralPool-not-init"
                )
            })
        })
        context("when parameters are valid", () => {
            it("should be able to open CDP with an incremental CDP index", async () => {
                expect(await positionManager.owners(1)).to.equal(AddressZero)
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                expect(await positionManager.lastPositionId()).to.equal(1)
                expect(await positionManager.owners(1)).to.equal(AliceAddress)

                expect(await positionManager.owners(2)).to.equal(AddressZero)
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)
                expect(await positionManager.lastPositionId()).to.equal(2)
                expect(await positionManager.owners(2)).to.equal(BobAddress)

                expect(await positionManager.owners(3)).to.equal(AddressZero)
                await positionManager.open(formatBytes32String("COL"), AliceAddress)
                expect(await positionManager.lastPositionId()).to.equal(3)
                expect(await positionManager.owners(3)).to.equal(AliceAddress)
            })
        })
    })

    describe("#give()", () => {
        context("when caller has no access to the position (or have no allowance)", () => {
            it("should revert", async () => {

                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(positionManager.give(1, AliceAddress)).to.be.revertedWith("owner not allowed")
            })
        })
        context("when input destination as zero address", () => {
            it("should revert", async () => {

                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(positionManagerAsAlice.give(1, AddressZero)).to.be.revertedWith("destination address(0)")
            })
        })
        context("when input destination as current owner address", () => {
            it("should revert", async () => {

                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(positionManagerAsAlice.give(1, AliceAddress)).to.be.revertedWith("destination already owner")
            })
        })
        context("when parameters are valid", () => {
            it("should be able to change the owner of CDP ", async () => {

                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                expect(await positionManager.owners(1)).to.equal(AliceAddress)
                await positionManagerAsAlice.give(1, BobAddress)
                expect(await positionManager.owners(1)).to.equal(BobAddress)
            })
        })
    })

    describe("#allowManagePosition()", () => {
        context("when caller has no access to the position (or have no allowance)", () => {
            it("should revert", async () => {

                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(positionManager.allowManagePosition(1, AliceAddress, 1)).to.be.revertedWith("owner not allowed")
            })
        })
        context("ok is not valid", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)

                await expect(positionManagerAsAlice.allowManagePosition(1, BobAddress, 2)).to.be.revertedWith("PositionManager/invalid-ok")
            })
        })
        context("when parameters are valid", () => {
            it("should be able to add user allowance to a position", async () => {

                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                expect(await positionManager.ownerWhitelist(AliceAddress, 1, BobAddress)).to.be.equal(0)
                await positionManagerAsAlice.allowManagePosition(1, BobAddress, 1)
                expect(await positionManager.ownerWhitelist(AliceAddress, 1, BobAddress)).to.be.equal(1)
            })
        })
    })

    describe("#allowMigratePosition()", () => {
        context("ok is not valid", () => {
            it("should revert", async () => {
                expect(await positionManager.migrationWhitelist(AliceAddress, BobAddress)).to.be.equal(0)
                await expect(positionManagerAsAlice.allowMigratePosition(BobAddress, 2)).to.be.revertedWith("PositionManager/invalid-ok")
            })
        })
        context("when parameters are valid", () => {
            it("should be able to give/revoke migration allowance to other address", async () => {
                expect(await positionManager.migrationWhitelist(AliceAddress, BobAddress)).to.be.equal(0)
                await positionManagerAsAlice.allowMigratePosition(BobAddress, 1)
                expect(await positionManager.migrationWhitelist(AliceAddress, BobAddress)).to.be.equal(1)
                await positionManagerAsAlice.allowMigratePosition(BobAddress, 0)
                expect(await positionManager.migrationWhitelist(AliceAddress, BobAddress)).to.be.equal(0)
            })
        })
    })

    describe("#list()", () => {
        context("when a few position has been opened", () => {
            it("should work as a linklist perfectly", async () => {
                // Alice open position 1-3
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)

                // Bob open position 4-7
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)

                let [aliceCount, aliceFirst, aliceLast] = await Promise.all([
                    positionManager.ownerPositionCount(AliceAddress),
                    positionManager.ownerFirstPositionId(AliceAddress),
                    positionManager.ownerLastPositionId(AliceAddress),
                ])
                expect(aliceCount).to.equal(3)
                expect(aliceFirst).to.equal(1)
                expect(aliceLast).to.equal(3)
                expect(await positionManager.list(1)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(2)])
                expect(await positionManager.list(2)).to.be.deep.equal([BigNumber.from(1), BigNumber.from(3)])
                expect(await positionManager.list(3)).to.be.deep.equal([BigNumber.from(2), BigNumber.from(0)])

                let [bobCount, bobFirst, bobLast] = await Promise.all([
                    positionManager.ownerPositionCount(BobAddress),
                    positionManager.ownerFirstPositionId(BobAddress),
                    positionManager.ownerLastPositionId(BobAddress),
                ])
                expect(bobCount).to.equal(4)
                expect(bobFirst).to.equal(4)
                expect(bobLast).to.equal(7)
                expect(await positionManager.list(4)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(5)])
                expect(await positionManager.list(5)).to.be.deep.equal([BigNumber.from(4), BigNumber.from(6)])
                expect(await positionManager.list(6)).to.be.deep.equal([BigNumber.from(5), BigNumber.from(7)])
                expect(await positionManager.list(7)).to.be.deep.equal([BigNumber.from(6), BigNumber.from(0)])

                // try giving position 2 to Bob, the CDP#2 should be concat at the end of the link list
                await positionManagerAsAlice.give(2, BobAddress)
                    ;[aliceCount, aliceFirst, aliceLast] = await Promise.all([
                        positionManager.ownerPositionCount(AliceAddress),
                        positionManager.ownerFirstPositionId(AliceAddress),
                        positionManager.ownerLastPositionId(AliceAddress),
                    ])
                expect(aliceCount).to.equal(2)
                expect(aliceFirst).to.equal(1)
                expect(aliceLast).to.equal(3)
                expect(await positionManager.list(1)).to.be.deep.equal([BigNumber.from(0), BigNumber.from(3)])
                expect(await positionManager.list(3)).to.be.deep.equal([BigNumber.from(1), BigNumber.from(0)])
                    ;[bobCount, bobFirst, bobLast] = await Promise.all([
                        positionManager.ownerPositionCount(BobAddress),
                        positionManager.ownerFirstPositionId(BobAddress),
                        positionManager.ownerLastPositionId(BobAddress),
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
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(
                    positionManager.adjustPosition(1, parseEther("1"), parseEther("50"), "0x")
                ).to.be.revertedWith("owner not allowed")
            })
        })
        context("when price is not healthy", () => {
            it("should revert", async () => {
                await mockedPriceFeed.mock.isPriceOk.returns(false);
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.adjustPosition.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    positionAddress,
                    positionAddress,
                    parseEther("1"),
                    parseEther("50")
                ).returns()

                await expect(
                    positionManagerAsAlice.adjustPosition(1, parseEther("1"), parseEther("50"), "0x")
                ).to.be.revertedWith("PositionManager/price-is-not-healthy")
            })
        })
        context("when parameters are valid", async () => {
            it("should be able to call BookKeeper.adjustPosition", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.adjustPosition.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    positionAddress,
                    positionAddress,
                    parseEther("1"),
                    parseEther("50")
                ).returns()


                await positionManagerAsAlice.adjustPosition(
                    1,
                    parseEther("1"),
                    parseEther("50"),
                    "0x"
                )
            })
        })
    })

    describe("#moveCollateral(uint256,address,uint256,bytes)", () => {
        context("when caller has no access to the position", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(
                    positionManager["moveCollateral(uint256,address,uint256,bytes)"](
                        1,
                        AliceAddress,
                        parseEther("50"),
                        "0x"
                    )
                ).to.be.revertedWith("owner not allowed")
            })
        })
        context("when price is not healthy", () => {
            it("should revert", async () => {
                await mockedPriceFeed.mock.isPriceOk.returns(false);
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.moveCollateral.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    BobAddress,
                    parseEther("1")
                ).returns()

                await expect(
                    positionManagerAsAlice["moveCollateral(uint256,address,uint256,bytes)"](
                        1,
                        AliceAddress,
                        parseEther("50"),
                        "0x"
                    )
                ).to.be.revertedWith("PositionManager/price-is-not-healthy")
            })
        })
        context("when parameters are valid", async () => {
            it("should be able to call moveCollateral(uint256,address,uint256,bytes)", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.moveCollateral.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    BobAddress,
                    parseEther("1")
                ).returns()

                await positionManagerAsAlice["moveCollateral(uint256,address,uint256,bytes)"](
                    1,
                    BobAddress,
                    parseEther("1"),
                    "0x"
                )
            })
        })
    })

    // This function has the purpose to take away collateral from the system that doesn't correspond to the position but was sent there wrongly.
    describe("#moveCollateral(bytes32,uint256,address,uint256,address,bytes)", () => {
        context("when caller has no access to the position", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(
                    positionManager["moveCollateral(bytes32,uint256,address,uint256,bytes)"](
                        formatBytes32String("WXDC"),
                        1,
                        AliceAddress,
                        parseEther("50"),
                        "0x"
                    )
                ).to.be.revertedWith("owner not allowed")
            })
        })
        context("when price is not healthy", () => {
            it("should revert", async () => {
                await mockedPriceFeed.mock.isPriceOk.returns(false);
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.moveCollateral.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    BobAddress,
                    parseEther("1")
                ).returns()

                await expect(
                    positionManagerAsAlice["moveCollateral(bytes32,uint256,address,uint256,bytes)"](
                        formatBytes32String("WXDC"),
                        1,
                        AliceAddress,
                        parseEther("50"),
                        "0x"
                    )
                ).to.be.revertedWith("PositionManager/price-is-not-healthy")
            })
        })
        context("when parameters are valid", async () => {
            it("should be able to call moveCollateral(bytes32,uint256,address,uint256,bytes)", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.moveCollateral.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    BobAddress,
                    parseEther("1")
                ).returns()

                await positionManagerAsAlice["moveCollateral(bytes32,uint256,address,uint256,bytes)"](
                    formatBytes32String("WXDC"),
                    1,
                    BobAddress,
                    parseEther("1"),
                    "0x"
                )

                
            })
        })
    })

    describe("#moveStablecoin()", () => {
        context("when caller has no access to the position", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(positionManager.moveStablecoin(1, BobAddress, WeiPerRad.mul(10))).to.be.revertedWith(
                    "owner not allowed"
                )
            })
        })
        context("when parameters are valid", async () => {
            it("should be able to call moveStablecoin()", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.moveStablecoin.withArgs(
                    positionAddress,
                    BobAddress,
                    WeiPerRad.mul(10)
                ).returns()
                await positionManagerAsAlice.moveStablecoin(1, BobAddress, WeiPerRad.mul(10))
            })
        })
    })

    describe("#exportPosition()", () => {
        context("when caller has no access to the position", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(positionManagerAsBob.exportPosition(1, BobAddress)).to.be.revertedWith("owner not allowed")
            })
        })
        context("when destination (Bob) has no migration access on caller (Alice)", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManagerAsAlice.allowManagePosition(1, BobAddress, 1)
                await expect(positionManagerAsAlice.exportPosition(1, BobAddress)).to.be.revertedWith("migration not allowed")
            })
        })
        context("when Alice wants to export her own position to her own address", async () => {
            it("should be able to call exportPosition()", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.positions.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress
                ).returns(WeiPerWad.mul(2), WeiPerWad.mul(1))
                await mockedBookKeeper.mock.movePosition.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    AliceAddress,
                    WeiPerWad.mul(2),
                    WeiPerWad.mul(1)
                ).returns()

                await positionManagerAsAlice.exportPosition(1, AliceAddress)
            })
        })
        context("when Alice wants Bob to export her position to Bob's address", async () => {
            it("should be able to call exportPosition()", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                // Alice allows Bob to manage her position#1
                await positionManagerAsAlice.allowManagePosition(1, BobAddress, 1)

                await mockedBookKeeper.mock.positions.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress
                ).returns(WeiPerWad.mul(2), WeiPerWad.mul(1))
                await mockedBookKeeper.mock.movePosition.withArgs(
                    formatBytes32String("WXDC"),
                    positionAddress,
                    BobAddress,
                    WeiPerWad.mul(2),
                    WeiPerWad.mul(1)
                ).returns()

                // Bob exports position#1 to his address
                await positionManagerAsBob.exportPosition(1, BobAddress)
            })
        })
    })

    describe("#importPosition()", () => {
        context("when caller (Bob) has no migration access on source address (Alice)", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(positionManagerAsBob.importPosition(AliceAddress, 1)).to.be.revertedWith("migration not allowed")
            })
        })
        context("when caller has no access to the position", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                // Alice gives Bob migration access on her address
                await positionManagerAsAlice.allowMigratePosition(BobAddress, 1)
                await expect(positionManagerAsBob.importPosition(AliceAddress, 1)).to.be.revertedWith("owner not allowed")
            })
        })
        context("when Alice wants to import her own position from her address", async () => {
            it("should be able to call importPosition()", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                await mockedBookKeeper.mock.positions.withArgs(
                    formatBytes32String("WXDC"),
                    AliceAddress
                ).returns(WeiPerWad.mul(2), WeiPerWad.mul(1))
                await mockedBookKeeper.mock.movePosition.withArgs(
                    formatBytes32String("WXDC"),
                    AliceAddress,
                    positionAddress,
                    WeiPerWad.mul(2),
                    WeiPerWad.mul(1)
                ).returns()

                await positionManagerAsAlice.importPosition(AliceAddress, 1)
            })
        })
        context("when Alice wants Bob to import her position from Bob's address", async () => {
            it("should be able to call importPosition()", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const positionAddress = await positionManager.positions(1)

                // Alice allows Bob to manage her position#1
                await positionManagerAsAlice.allowManagePosition(1, BobAddress, 1)
                // Alice gives Bob migration access on her address
                await positionManagerAsAlice.allowMigratePosition(BobAddress, 1)

                await mockedBookKeeper.mock.positions.withArgs(
                    formatBytes32String("WXDC"),
                    BobAddress
                ).returns(WeiPerWad.mul(2), WeiPerWad.mul(1))
                await mockedBookKeeper.mock.movePosition.withArgs(
                    formatBytes32String("WXDC"),
                    BobAddress,
                    positionAddress,
                    WeiPerWad.mul(2),
                    WeiPerWad.mul(1)
                ).returns()

                // Bob imports position#1 from his address to position#1
                await positionManagerAsBob.importPosition(BobAddress, 1)
            })
        })
    })

    describe("#movePosition()", () => {
        context("when caller (Bob) has no access to the source position", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)

                await expect(positionManagerAsBob.movePosition(1, 2)).to.be.revertedWith("owner not allowed")
            })
        })
        context("when caller (Alice) has no access to the destination position", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)

                await expect(positionManagerAsAlice.movePosition(1, 2)).to.be.revertedWith("owner not allowed")
            })
        })
        context("when these two positions are from different collateral pool", () => {
            it("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManager.open(formatBytes32String("BTC"), BobAddress)
                await positionManagerAsBob.allowManagePosition(2, AliceAddress, 1)

                await expect(positionManagerAsAlice.movePosition(1, 2)).to.be.revertedWith("!same collateral pool")
            })
        })
        context("when Alice wants to move her position#1 to her position#2", async () => {
            it("should be able to call movePosition()", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const position1Address = await positionManager.positions(1)
                const position2Address = await positionManager.positions(2)

                await mockedBookKeeper.mock.positions.withArgs(
                    formatBytes32String("WXDC"),
                    position1Address
                ).returns(WeiPerWad.mul(2), WeiPerWad.mul(1))
                await mockedBookKeeper.mock.movePosition.withArgs(
                    formatBytes32String("WXDC"),
                    position1Address,
                    position2Address,
                    WeiPerWad.mul(2),
                    WeiPerWad.mul(1)
                ).returns()

                await positionManagerAsAlice.movePosition(1, 2)
            })
        })
        context("when Alice wants to move her position#1 to Bob's position#2", async () => {
            it("should be able to call movePosition()", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await positionManager.open(formatBytes32String("WXDC"), BobAddress)
                await positionManagerAsBob.allowManagePosition(2, AliceAddress, 1)
                const position1Address = await positionManager.positions(1)
                const position2Address = await positionManager.positions(2)

                await mockedBookKeeper.mock.positions.withArgs(
                    formatBytes32String("WXDC"),
                    position1Address
                ).returns(WeiPerWad.mul(2), WeiPerWad.mul(1))

                await mockedBookKeeper.mock.movePosition.withArgs(
                    formatBytes32String("WXDC"),
                    position1Address,
                    position2Address,
                    WeiPerWad.mul(2),
                    WeiPerWad.mul(1)
                ).returns()

                await positionManagerAsAlice.movePosition(1, 2)
            })
        })
    })

    describe("#redeemLockedCollateral()", () => {
        context("when caller has no access to the position (or have no allowance)", () => {
            xit("should revert", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                await expect(
                    positionManager.redeemLockedCollateral(1, AliceAddress, "0x")
                ).to.be.revertedWith("owner not allowed")
            })
        })
        context("when parameters are valid", () => {
            xit("should be able to redeemLockedCollateral", async () => {
                await positionManager.open(formatBytes32String("WXDC"), AliceAddress)
                const position1Address = await positionManager.positions(1)
                await mockedShowStopper.mock.redeemLockedCollateral.withArgs(
                    formatBytes32String("WXDC"),
                    mockedTokenAdapter.address,
                    position1Address,
                    AliceAddress,
                    "0x"
                ).returns()
                await positionManagerAsAlice.redeemLockedCollateral(1, AliceAddress, "0x")
            })
        })
    })
})
