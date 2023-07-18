const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { BigNumber, ethers } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, BobAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");

const { formatBytes32String } = ethers.utils
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const loadFixtureHandler = async () => {
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");

    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.MINTABLE_ROLE.returns(formatBytes32String("MINTABLE_ROLE"))
    await mockedAccessControlConfig.mock.LIQUIDATION_ENGINE_ROLE.returns(formatBytes32String("LIQUIDATION_ENGINE_ROLE"))
    await mockedAccessControlConfig.mock.ADAPTER_ROLE.returns(formatBytes32String("ADAPTER_ROLE"))
    await mockedAccessControlConfig.mock.STABILITY_FEE_COLLECTOR_ROLE.returns(formatBytes32String("STABILITY_FEE_COLLECTOR_ROLE"))
    await mockedAccessControlConfig.mock.COLLATERAL_MANAGER_ROLE.returns(formatBytes32String("COLLATERAL_MANAGER_ROLE"))
    await mockedAccessControlConfig.mock.POSITION_MANAGER_ROLE.returns(formatBytes32String("POSITION_MANAGER_ROLE"))
    await mockedAccessControlConfig.mock.SHOW_STOPPER_ROLE.returns(formatBytes32String("SHOW_STOPPER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)
    await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

    const bookKeeper = getContract("BookKeeper", DeployerAddress)
    const bookKeeperAsAlice = getContract("BookKeeper", AliceAddress)
    const bookKeeperAsBob = getContract("BookKeeper", BobAddress)

    await bookKeeper.initialize(mockedCollateralPoolConfig.address, mockedAccessControlConfig.address)

    return {
        bookKeeper,
        bookKeeperAsAlice,
        bookKeeperAsBob,
        mockedCollateralPoolConfig,
        mockedAccessControlConfig
    }
}
describe("BookKeeper", () => {
    let bookKeeper
    let bookKeeperAsAlice
    let bookKeeperAsBob

    let mockedCollateralPoolConfig
    let mockedAccessControlConfig

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            bookKeeper,
            bookKeeperAsAlice,
            bookKeeperAsBob,
            mockedCollateralPoolConfig,
            mockedAccessControlConfig
        } = await loadFixture(loadFixtureHandler))
    })

    describe("#addCollateral", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(
                    bookKeeperAsAlice.addCollateral(COLLATERAL_POOL_ID, DeployerAddress, WeiPerWad)
                ).to.be.revertedWith("!adapterRole")
            })
        })

        context("when the caller is the owner", async () => {
            context("when collateral to add is positive", () => {
                it("should be able to call addCollateral", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    // init WXDC collateral pool
                    await mockedCollateralPoolConfig.mock.getStabilityFeeRate.returns(WeiPerRay)

                    const collateralTokenBefore = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, DeployerAddress)
                    expect(collateralTokenBefore).to.be.equal(0)

                    await bookKeeper.addCollateral(COLLATERAL_POOL_ID, DeployerAddress, WeiPerWad, { gasLimit: 1000000 })

                    const collateralTokenAfter = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, DeployerAddress)
                    expect(collateralTokenAfter).to.be.equal(WeiPerWad)
                })
            })

            context("when collateral to add is negative", () => {
                // test is disabled due to broken negative nubmer support
                it("should be able to call addCollateral", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    // init WXDC collateral pool
                    await mockedCollateralPoolConfig.mock.getStabilityFeeRate.returns(WeiPerRay)

                    // add collateral 1 WXDC
                    await bookKeeper.addCollateral(COLLATERAL_POOL_ID, DeployerAddress, WeiPerWad, { gasLimit: 1000000 })

                    const collateralTokenBefore = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, DeployerAddress)
                    expect(collateralTokenBefore).to.be.equal(WeiPerWad)

                    // add collateral -1 WXDC
                    await bookKeeper.addCollateral(COLLATERAL_POOL_ID, DeployerAddress, WeiPerWad.mul(-1), { gasLimit: 1000000 })

                    const collateralTokenAfter = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, DeployerAddress)
                    expect(collateralTokenAfter).to.be.equal(0)
                })
            })
        })
    })

    describe("#moveCollateral", () => {
        context("when the caller is not the owner", () => {
            it("should be revert", async () => {
                // bob call move collateral from alice to bob
                await await expect(
                    bookKeeperAsBob.moveCollateral(COLLATERAL_POOL_ID, AliceAddress, BobAddress, WeiPerWad, { gasLimit: 1000000 })
                ).to.be.revertedWith("BookKeeper/not-allowed-position-adjustment")
            })

            context("when alice allow bob to move collateral", () => {
                it("should be able to call moveCollateral", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    // add collateral 1 WXDC to alice
                    await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad, { gasLimit: 1000000 })

                    const collateralTokenAliceBefore = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, AliceAddress)
                    expect(collateralTokenAliceBefore).to.be.equal(WeiPerWad)
                    const collateralTokenBobBefore = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)
                    expect(collateralTokenBobBefore).to.be.equal(0)

                    // alice allow bob to move collateral
                    await bookKeeperAsAlice.whitelist(BobAddress)

                    // bob call move collateral from alice to bob
                    await bookKeeperAsBob.moveCollateral(COLLATERAL_POOL_ID, AliceAddress, BobAddress, WeiPerWad, { gasLimit: 1000000 })

                    const collateralTokenAliceAfter = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, AliceAddress)
                    expect(collateralTokenAliceAfter).to.be.equal(0)
                    const collateralTokenBobAfter = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)
                    expect(collateralTokenBobAfter).to.be.equal(WeiPerWad)
                })
            })
        })

        context("when the caller is the owner", () => {
            context("when alice doesn't have enough collateral", () => {
                it("shold be revert", async () => {
                    // alice call move collateral from alice to bob
                    await expect(
                        bookKeeperAsAlice.moveCollateral(COLLATERAL_POOL_ID, AliceAddress, BobAddress, WeiPerWad, { gasLimit: 1000000 })
                    ).to.be.reverted
                })
            })
            context("when alice has enough collateral", () => {
                it("should be able to call moveCollateral", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    // add collateral 1 WXDC to alice
                    await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad, { gasLimit: 1000000 })

                    const collateralTokenAliceBefore = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, AliceAddress)
                    expect(collateralTokenAliceBefore).to.be.equal(WeiPerWad)
                    const collateralTokenBobBefore = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)
                    expect(collateralTokenBobBefore).to.be.equal(0)

                    // move collateral 1 WXDC from alice to bob
                    await bookKeeperAsAlice.moveCollateral(COLLATERAL_POOL_ID, AliceAddress, BobAddress, WeiPerWad, { gasLimit: 1000000 })

                    const collateralTokenAliceAfter = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, AliceAddress)
                    expect(collateralTokenAliceAfter).to.be.equal(0)
                    const collateralTokenBobAfter = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)
                    expect(collateralTokenBobAfter).to.be.equal(WeiPerWad)
                })
            })
        })
    })

    describe("#moveStablecoin", () => {
        context("when the caller is not the owner", () => {
            it("should be revert", async () => {
                // bob call move stablecoin from alice to bob
                await await expect(bookKeeperAsBob.moveStablecoin(AliceAddress, BobAddress, WeiPerRad, { gasLimit: 1000000 })).to.be.revertedWith(
                    "BookKeeper/not-allowed"
                )
            })

            context("when alice allow bob to move collateral", () => {
                it("should be able to call moveStablecoin", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    // mint 1 rad to alice
                    await bookKeeper.mintUnbackedStablecoin(DeployerAddress, AliceAddress, WeiPerRad, { gasLimit: 1000000 })

                    const stablecoinAliceBefore = await bookKeeper.stablecoin(AliceAddress)
                    expect(stablecoinAliceBefore).to.be.equal(WeiPerRad)
                    const stablecoinBobBefore = await bookKeeper.stablecoin(BobAddress)
                    expect(stablecoinBobBefore).to.be.equal(0)

                    // alice allow bob to move stablecoin
                    await bookKeeperAsAlice.whitelist(BobAddress)

                    // bob call move stablecoin from alice to bob
                    await expect(bookKeeperAsBob.moveStablecoin(AliceAddress, BobAddress, WeiPerRad, { gasLimit: 1000000 }))
                        .to.be.emit(bookKeeperAsBob, "LogMoveStablecoin")
                        .withArgs(BobAddress, AliceAddress, BobAddress, WeiPerRad);

                    const stablecoinAliceAfter = await bookKeeper.stablecoin(AliceAddress)
                    expect(stablecoinAliceAfter).to.be.equal(0)
                    const stablecoinBobAfter = await bookKeeper.stablecoin(BobAddress)
                    expect(stablecoinBobAfter).to.be.equal(WeiPerRad)
                })
            })
        })

        context("when the caller is the owner", () => {
            context("when alice doesn't have enough stablecoin", () => {
                it("shold be revert", async () => {
                    // alice call move stablecoin from alice to bob
                    await expect(bookKeeperAsAlice.moveStablecoin(AliceAddress, BobAddress, WeiPerRad, { gasLimit: 1000000 })).to.be.reverted
                })
            })
            context("when alice has enough stablecoin", () => {
                it("should be able to call moveStablecoin", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    // mint 1 rad to alice
                    await bookKeeper.mintUnbackedStablecoin(DeployerAddress, AliceAddress, WeiPerRad, { gasLimit: 1000000 })

                    const stablecoinAliceBefore = await bookKeeper.stablecoin(AliceAddress)
                    expect(stablecoinAliceBefore).to.be.equal(WeiPerRad)
                    const stablecoinBobBefore = await bookKeeper.stablecoin(BobAddress)
                    expect(stablecoinBobBefore).to.be.equal(0)

                    // alice call move stablecoin from alice to bob
                    await expect(bookKeeperAsAlice.moveStablecoin(AliceAddress, BobAddress, WeiPerRad, { gasLimit: 1000000 }))
                        .to.be.emit(bookKeeperAsAlice, "LogMoveStablecoin")
                        .withArgs(AliceAddress, AliceAddress, BobAddress, WeiPerRad);

                    const stablecoinAliceAfter = await bookKeeper.stablecoin(AliceAddress)
                    expect(stablecoinAliceAfter).to.be.equal(0)
                    const stablecoinBobAfter = await bookKeeper.stablecoin(BobAddress)
                    expect(stablecoinBobAfter).to.be.equal(WeiPerRad)
                })
            })
        })
    })

    describe("#adjustPosition", () => {
        context("when bookkeeper does not live", () => {
            it("should be revert", async () => {
                // grant role access
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await bookKeeper.cage()

                await expect(
                    bookKeeper.adjustPosition(
                        COLLATERAL_POOL_ID,
                        DeployerAddress,
                        DeployerAddress,
                        DeployerAddress,
                        WeiPerWad,
                        0,
                        { gasLimit: 1000000 }
                    )
                ).to.be.revertedWith("BookKeeper/not-live")
            })
        })

        context("when collateral pool not init", () => {
            it("should be revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                    debtAccumulatedRate: 0,
                    totalDebtShare: 0,
                    debtCeiling: 0,
                    priceWithSafetyMargin: 0,
                    debtFloor: 0,
                    positionDebtCeiling: WeiPerRad.mul(1000000)
                })

                await expect(
                    bookKeeper.adjustPosition(
                        COLLATERAL_POOL_ID,
                        DeployerAddress,
                        DeployerAddress,
                        DeployerAddress,
                        WeiPerWad,
                        0,
                        { gasLimit: 1000000 }
                    )
                ).to.be.revertedWith("BookKeeper/collateralPool-not-init")
            })
        })
        context("when call adjustPosition(lock, free)", () => {
            context("when call adjustPosition(lock)", () => {
                context("when alice call but bob is collateral owner", () => {
                    it("should be revert", async () => {
                        await mockedAccessControlConfig.mock.hasRole.returns(true)

                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10000),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: 0,
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        await expect(
                            bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                BobAddress,
                                AliceAddress,
                                WeiPerWad.mul(10),
                                0,
                                { gasLimit: 1000000 }
                            )
                        ).to.be.revertedWith("BookKeeper/not-allowed-collateral-owner")
                    })
                    context("when bob allow alice to move collateral", () => {
                        context("when bob doesn't have enough collateral", () => {
                            it("should be revert", async () => {
                                await mockedAccessControlConfig.mock.hasRole.returns(true)

                                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                                await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                                // alice allow bob to move stablecoin
                                await bookKeeperAsBob.whitelist(AliceAddress)

                                await expect(
                                    bookKeeperAsAlice.adjustPosition(
                                        COLLATERAL_POOL_ID,
                                        AliceAddress,
                                        BobAddress,
                                        AliceAddress,
                                        WeiPerWad.mul(10),
                                        0,
                                        { gasLimit: 1000000 }
                                    )
                                ).to.be.reverted
                            })
                        })

                        context("when bob has enough collateral", () => {
                            it("should be able to call adjustPosition(lock)", async () => {
                                await mockedAccessControlConfig.mock.hasRole.returns(true)

                                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                                await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                                await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                    debtAccumulatedRate: WeiPerRay,
                                    totalDebtShare: 0,
                                    debtCeiling: WeiPerRad.mul(10000),
                                    priceWithSafetyMargin: WeiPerRay,
                                    debtFloor: 0,
                                    positionDebtCeiling: WeiPerRad.mul(1000000)
                                })

                                // add collateral to bob 10 WXDC
                                await bookKeeper.addCollateral(COLLATERAL_POOL_ID, BobAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                                // alice allow bob to move stablecoin
                                await bookKeeperAsBob.whitelist(AliceAddress)

                                const positionBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                                expect(positionBefore.lockedCollateral).to.be.equal(0)

                                // lock collateral
                                await bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    BobAddress,
                                    AliceAddress,
                                    WeiPerWad.mul(10),
                                    0,
                                    { gasLimit: 1000000 }
                                )

                                const positionAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                                expect(positionAfter.lockedCollateral).to.be.equal(WeiPerWad.mul(10))
                            })
                        })
                    })
                })
                context("when alice call and alice is collateral owner", () => {
                    context("when alice doesn't have enough collateral", () => {
                        it("should be revert", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await expect(
                                bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    WeiPerWad.mul(10),
                                    0,
                                    { gasLimit: 1000000 }
                                )
                            ).to.be.reverted
                        })
                    })

                    context("when alice has enough collateral", () => {
                        it("should be able to call adjustPosition(lock)", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)
                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad.mul(10000),
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: 0,
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // add collateral to bob 10 WXDC
                            await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                            const positionBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionBefore.lockedCollateral).to.be.equal(0)

                            // lock collateral
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                AliceAddress,
                                AliceAddress,
                                WeiPerWad.mul(10),
                                0,
                                { gasLimit: 1000000 }
                            )

                            const positionAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionAfter.lockedCollateral).to.be.equal(WeiPerWad.mul(10))
                        })
                    })
                })
            })
            context("when call adjustPosition(free)", () => {
                context("when alice call and alice is collateral owner", () => {
                    context("when alice doesn't have enough lock collateral in position", () => {
                        it("should be revert", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            // free collateral
                            await expect(
                                bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    WeiPerWad.mul(-1),
                                    0,
                                    { gasLimit: 1000000 }
                                )
                            ).to.be.reverted
                        })
                    })
                    context("when alice has enough lock collateral in position", () => {
                        // test is disabled due to broken negative nubmer support
                        it("should be able to call adjustPosition(free)", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad.mul(10000),
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: 0,
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // add collateral to alice 10 WXDC
                            await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                            // lock collateral
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                AliceAddress,
                                AliceAddress,
                                WeiPerWad.mul(10),
                                0,
                                { gasLimit: 1000000 }
                            )

                            const positionAliceBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionAliceBefore.lockedCollateral).to.be.equal(WeiPerWad.mul(10))
                            const collateralTokenAliceBefore = await bookKeeper.collateralToken(
                                COLLATERAL_POOL_ID,
                                AliceAddress
                            )
                            expect(collateralTokenAliceBefore).to.be.equal(0)

                            // free collateral
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                AliceAddress,
                                AliceAddress,
                                WeiPerWad.mul(-1),
                                0
                            )

                            const positionAliceAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionAliceAfter.lockedCollateral).to.be.equal(WeiPerWad.mul(9))
                            const collateralTokenAliceAfter = await bookKeeper.collateralToken(
                                COLLATERAL_POOL_ID,
                                AliceAddress
                            )
                            expect(collateralTokenAliceAfter).to.be.equal(WeiPerWad)
                        })
                    })
                })
                context("when alice call but bob is collateral owner", () => {
                    context("when alice doesn't have enough lock collateral in position", () => {
                        it("should be revert", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            // free collateral
                            await expect(
                                bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    BobAddress,
                                    AliceAddress,
                                    WeiPerWad.mul(-1),
                                    0,
                                    { gasLimit: 1000000 }
                                )
                            ).to.be.reverted
                        })
                    })
                    context("when alice has enough lock collateral in position", () => {
                        // test is disabled due to broken negative nubmer support
                        it("should be able to call adjustPosition(free)", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10000))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad.mul(10000),
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: 0,
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // add collateral to alice 10 WXDC
                            await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                            // lock collateral
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                AliceAddress,
                                AliceAddress,
                                WeiPerWad.mul(10),
                                0,
                                { gasLimit: 1000000 }
                            )

                            const positionAliceBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionAliceBefore.lockedCollateral).to.be.equal(WeiPerWad.mul(10))
                            const collateralTokenBobBefore = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)
                            expect(collateralTokenBobBefore).to.be.equal(0)

                            // free collateral
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                BobAddress,
                                AliceAddress,
                                WeiPerWad.mul(-1),
                                0,
                                { gasLimit: 1000000 }
                            )

                            const positionAliceAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionAliceAfter.lockedCollateral).to.be.equal(WeiPerWad.mul(9))
                            const collateralTokenBobAfter = await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)
                            expect(collateralTokenBobAfter).to.be.equal(WeiPerWad)
                        })
                    })
                })
            })

            context("when call adjustPosition(draw, wipe)", () => {
                context("when debt ceilings are exceeded", () => {
                    context("when pool debt ceiling are exceeded", () => {
                        it("should be revert", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad)
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad,
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: 0,
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // set total debt ceiling 10 rad
                            await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                            await expect(
                                bookKeeper.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    DeployerAddress,
                                    DeployerAddress,
                                    DeployerAddress,
                                    0,
                                    WeiPerWad.mul(10),
                                    { gasLimit: 1000000 }
                                )
                            ).to.be.revertedWith("BookKeeper/ceiling-exceeded")
                        })
                    })
                    context("when total debt ceiling are exceeded", () => {
                        it("should be revert", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad.mul(10),
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: 0,
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // set total debt ceiling 1 rad
                            await bookKeeper.setTotalDebtCeiling(WeiPerRad, { gasLimit: 1000000 })

                            await expect(
                                bookKeeper.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    DeployerAddress,
                                    DeployerAddress,
                                    DeployerAddress,
                                    0,
                                    WeiPerWad.mul(10),
                                    { gasLimit: 1000000 }
                                )
                            ).to.be.revertedWith("BookKeeper/ceiling-exceeded")
                        })
                    })
                })
                context("when position is not safe", () => {
                    it("should be revert", async () => {
                        await mockedAccessControlConfig.mock.hasRole.returns(true)

                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: 0,
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                        await expect(
                            bookKeeper.adjustPosition(
                                COLLATERAL_POOL_ID,
                                DeployerAddress,
                                DeployerAddress,
                                DeployerAddress,
                                0,
                                WeiPerWad.mul(10),
                                { gasLimit: 1000000 }
                            )
                        ).to.be.revertedWith("BookKeeper/not-safe")
                    })
                })
                context("when call adjustPosition(draw)", () => {
                    context("when alice call but bob is position owner", () => {
                        it("should be revert", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad.mul(10),
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: 0,
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // set total debt ceiling 10 rad
                            await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                            // add collateral to 10 WXDC
                            await bookKeeper.addCollateral(COLLATERAL_POOL_ID, BobAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                            // bob lock collateral 10 WXDC
                            await bookKeeperAsBob.adjustPosition(
                                COLLATERAL_POOL_ID,
                                BobAddress,
                                BobAddress,
                                BobAddress,
                                WeiPerWad.mul(10),
                                0,
                                { gasLimit: 1000000 }
                            )

                            await expect(
                                bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    BobAddress,
                                    BobAddress,
                                    BobAddress,
                                    0,
                                    WeiPerWad.mul(10),
                                    { gasLimit: 1000000 }
                                )
                            ).to.be.revertedWith("BookKeeper/not-allowed-position-address")
                        })

                        context("when bob allow alice to manage position", () => {
                            it("should be able to call adjustPosition(draw)", async () => {
                                await mockedAccessControlConfig.mock.hasRole.returns(true)

                                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                                await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                                await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                    debtAccumulatedRate: WeiPerRay,
                                    totalDebtShare: 0,
                                    debtCeiling: WeiPerRad.mul(10),
                                    priceWithSafetyMargin: WeiPerRay,
                                    debtFloor: 0,
                                    positionDebtCeiling: WeiPerRad.mul(1000000)
                                })

                                // set total debt ceiling 10 rad
                                await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                                // add collateral to 10 WXDC
                                await bookKeeper.addCollateral(COLLATERAL_POOL_ID, BobAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                                // bob lock collateral 10 WXDC
                                await bookKeeperAsBob.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    BobAddress,
                                    BobAddress,
                                    BobAddress,
                                    WeiPerWad.mul(10),
                                    0,
                                    { gasLimit: 1000000 }
                                )

                                const positionBobBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, BobAddress)
                                expect(positionBobBefore.debtShare).to.be.equal(0)

                                const stablecoinAliceBefore = await bookKeeper.stablecoin(AliceAddress)
                                expect(stablecoinAliceBefore).to.be.equal(0)

                                // bob allow alice
                                await bookKeeperAsBob.whitelist(AliceAddress)

                                // alice draw
                                await bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    BobAddress,
                                    BobAddress,
                                    AliceAddress,
                                    0,
                                    WeiPerWad.mul(10),
                                    { gasLimit: 1000000 }
                                );

                                const positionBobAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, BobAddress)
                                expect(positionBobAfter.debtShare).to.be.equal(WeiPerWad.mul(10))

                                const stablecoinAliceAfter = await bookKeeper.stablecoin(AliceAddress)
                                expect(stablecoinAliceAfter).to.be.equal(WeiPerRad.mul(10))
                            })
                        })
                    })
                    context("when alice call and alice is position owner", () => {
                        it("should be able to call adjustPosition(draw)", async () => {
                            await mockedAccessControlConfig.mock.hasRole.returns(true)
                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad.mul(10),
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: 0,
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // set total debt ceiling 10 rad
                            await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                            // add collateral to 10 WXDC
                            await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                            // alice lock collateral 10 WXDC
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                AliceAddress,
                                AliceAddress,
                                WeiPerWad.mul(10),
                                0,
                                { gasLimit: 1000000 }
                            )

                            const positionaliceBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionaliceBefore.debtShare).to.be.equal(0)

                            const stablecoinAliceBefore = await bookKeeper.stablecoin(AliceAddress)
                            expect(stablecoinAliceBefore).to.be.equal(0)

                            // alice draw
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                AliceAddress,
                                AliceAddress,
                                0,
                                WeiPerWad.mul(10),
                                { gasLimit: 1000000 }
                            )

                            const positionaliceAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                            expect(positionaliceAfter.debtShare).to.be.equal(WeiPerWad.mul(10))
                            const stablecoinAliceAfter = await bookKeeper.stablecoin(AliceAddress)
                            expect(stablecoinAliceAfter).to.be.equal(WeiPerRad.mul(10))
                        })
                    })
                    context("when position debt value < debt floor", () => {
                        it("should be revert", async () => {
                            await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                            await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                            await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(20))
                            await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                            await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                            await mockedAccessControlConfig.mock.hasRole.returns(true)

                            await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                debtAccumulatedRate: WeiPerRay,
                                totalDebtShare: 0,
                                debtCeiling: WeiPerRad.mul(10),
                                priceWithSafetyMargin: WeiPerRay,
                                debtFloor: WeiPerRad.mul(20),
                                positionDebtCeiling: WeiPerRad.mul(1000000)
                            })

                            // set total debt ceiling 10 rad
                            await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                            // add collateral to 10 WXDC
                            await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                            // alice lock collateral 10 WXDC
                            await bookKeeperAsAlice.adjustPosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                AliceAddress,
                                AliceAddress,
                                WeiPerWad.mul(10),
                                0,
                                { gasLimit: 1000000 }
                            )

                            // alice draw
                            await expect(
                                bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    0,
                                    WeiPerWad.mul(10),
                                    { gasLimit: 1000000 }
                                )
                            ).to.be.revertedWith("BookKeeper/debt-floor")
                        })
                    })

                    context("when call adjustPosition(wipe)", () => {
                        context("when alice call and alice is position owner", () => {
                            it("should be able to call adjustPosition(wipe)", async () => {
                                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                                await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                                await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                                await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                    debtAccumulatedRate: WeiPerRay,
                                    totalDebtShare: BigNumber.from(0),
                                    debtCeiling: WeiPerRad.mul(10),
                                    priceWithSafetyMargin: WeiPerRay,
                                    debtFloor: WeiPerRad.mul(1),
                                    positionDebtCeiling: WeiPerRad.mul(1000000)
                                })

                                // set total debt ceiling 10 rad
                                await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                                // add collateral to 10 WXDC
                                await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                                // alice lock collateral 10 WXDC
                                await bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    WeiPerWad.mul(10),
                                    0,
                                    { gasLimit: 1000000 }
                                )

                                // alice draw
                                await bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    0,
                                    WeiPerWad.mul(10),
                                    { gasLimit: 1000000 }
                                )

                                const positionaliceBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                                expect(positionaliceBefore.debtShare).to.be.equal(WeiPerWad.mul(10))
                                const stablecoinAliceBefore = await bookKeeper.stablecoin(AliceAddress)
                                expect(stablecoinAliceBefore).to.be.equal(WeiPerRad.mul(10))
                                await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad.mul(10))
                                await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                    debtAccumulatedRate: WeiPerRay,
                                    totalDebtShare: WeiPerWad.mul(10),
                                    debtCeiling: WeiPerRad.mul(10),
                                    priceWithSafetyMargin: WeiPerRay,
                                    debtFloor: WeiPerRad.mul(1),
                                    positionDebtCeiling: WeiPerRad.mul(1000000)
                                })
                                // alice wipe
                                await bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    0,
                                    WeiPerWad.mul(-10),
                                    { gasLimit: 1000000 }
                                )

                                const positionaliceAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                                expect(positionaliceAfter.debtShare).to.be.equal(0)

                                const stablecoinAliceAfter = await bookKeeper.stablecoin(AliceAddress)
                                expect(stablecoinAliceAfter).to.be.equal(0)
                            })
                        })
                        context("when position debt value < debt floor", () => {
                            it("should be revert", async () => {
                                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                                await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                                await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(5))
                                await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                                await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                                await mockedAccessControlConfig.mock.hasRole.returns(true)

                                await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                    debtAccumulatedRate: WeiPerRay,
                                    totalDebtShare: 0,
                                    debtCeiling: WeiPerRad.mul(10),
                                    priceWithSafetyMargin: WeiPerRay,
                                    debtFloor: WeiPerRad.mul(5),
                                    positionDebtCeiling: WeiPerRad.mul(1000000)
                                })

                                // set total debt ceiling 10 rad
                                await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                                // add collateral to 10 WXDC
                                await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                                // alice lock collateral 10 WXDC
                                await bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    WeiPerWad.mul(10),
                                    0,
                                    { gasLimit: 1000000 }
                                )

                                // alice draw
                                await bookKeeperAsAlice.adjustPosition(
                                    COLLATERAL_POOL_ID,
                                    AliceAddress,
                                    AliceAddress,
                                    AliceAddress,
                                    0,
                                    WeiPerWad.mul(10),
                                    { gasLimit: 1000000 }
                                )
                                await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad.mul(10))
                                await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                                    debtAccumulatedRate: WeiPerRay,
                                    totalDebtShare: WeiPerWad.mul(10),
                                    debtCeiling: WeiPerRad.mul(10),
                                    priceWithSafetyMargin: WeiPerRay,
                                    debtFloor: WeiPerRad.mul(5),
                                    positionDebtCeiling: WeiPerRad.mul(1000000)
                                })
                                // alice wipe
                                await expect(
                                    bookKeeperAsAlice.adjustPosition(
                                        COLLATERAL_POOL_ID,
                                        AliceAddress,
                                        AliceAddress,
                                        AliceAddress,
                                        0,
                                        WeiPerWad.mul(-9),
                                        { gasLimit: 1000000 }
                                    )
                                ).to.be.revertedWith("BookKeeper/debt-floor")
                            })
                        })
                    })
                })
            })
        })
    })

    describe("#movePosition", () => {
        context("when alice move position to bob", () => {
            context("when alice and bob don't allow anyone else to manage the position", () => {
                it("should be revert", async () => {
                    await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                    await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                    await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                    await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                    await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                    await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                        debtAccumulatedRate: WeiPerRay,
                        totalDebtShare: 0,
                        debtCeiling: WeiPerRad.mul(10),
                        priceWithSafetyMargin: WeiPerRay,
                        debtFloor: WeiPerRad.mul(1),
                        positionDebtCeiling: WeiPerRad.mul(1000000)
                    })

                    // set total debt ceiling 10 rad
                    await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                    // add collateral to 10 WXDC
                    await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                    // alice lock collateral 10 WXDC
                    await bookKeeperAsAlice.adjustPosition(
                        COLLATERAL_POOL_ID,
                        AliceAddress,
                        AliceAddress,
                        AliceAddress,
                        WeiPerWad.mul(10),
                        WeiPerWad.mul(2),
                        { gasLimit: 1000000 }
                    )

                    await expect(
                        bookKeeperAsAlice.movePosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            BobAddress,
                            WeiPerWad.mul(5),
                            WeiPerWad.mul(1),
                            { gasLimit: 1000000 }
                        )
                    ).to.be.revertedWith("BookKeeper/movePosition/not-allowed")
                })
            })
            context("when bob allow alice to manage a position", () => {
                context("when after moving alice position was not safe", () => {
                    it("should be revert", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(1),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                        // add collateral to 10 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                        // alice lock collateral 10 WXDC
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad.mul(10),
                            WeiPerWad.mul(2),
                            { gasLimit: 1000000 }
                        )

                        // bob allow alice to manage a position
                        await bookKeeperAsBob.whitelist(AliceAddress)

                        await expect(
                            bookKeeperAsAlice.movePosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                BobAddress,
                                WeiPerWad.mul(10),
                                WeiPerWad.mul(0),
                                { gasLimit: 1000000 }
                            )
                        ).to.be.revertedWith("BookKeeper/not-safe-src")
                    })
                })
                context("when after moving bob position was not safe", () => {
                    it("should be revert", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(1),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                        // add collateral to 10 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                        // alice lock collateral 10 WXDC
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad.mul(10),
                            WeiPerWad.mul(2),
                            { gasLimit: 1000000 }
                        )

                        // bob allow alice to manage a position
                        await bookKeeperAsBob.whitelist(AliceAddress)

                        await expect(
                            bookKeeperAsAlice.movePosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                BobAddress,
                                WeiPerWad.mul(0),
                                WeiPerWad.mul(2),
                                { gasLimit: 1000000 }
                            )
                        ).to.be.revertedWith("BookKeeper/not-safe-dst")
                    })
                })
                context("when after moving alice position was not enough debt", () => {
                    it("should be revert", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(2))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(2),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                        // add collateral to 10 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                        // alice lock collateral 10 WXDC
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad.mul(10),
                            WeiPerWad.mul(2),
                            { gasLimit: 1000000 }
                        )

                        // bob allow alice to manage a position
                        await bookKeeperAsBob.whitelist(AliceAddress)

                        await expect(
                            bookKeeperAsAlice.movePosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                BobAddress,
                                WeiPerWad.mul(5),
                                WeiPerWad.mul(1),
                                { gasLimit: 1000000 }
                            )
                        ).to.be.revertedWith("BookKeeper/debt-floor-src")
                    })
                })
                context("when after moving bob position was not enough debt", () => {
                    it("should be revert", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(2))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(2),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                        // add collateral to 10 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                        // alice lock collateral 10 WXDC
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad.mul(10),
                            WeiPerWad.mul(3),
                            { gasLimit: 1000000 }
                        )

                        // bob allow alice to manage a position
                        await bookKeeperAsBob.whitelist(AliceAddress)

                        await expect(
                            bookKeeperAsAlice.movePosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                BobAddress,
                                WeiPerWad.mul(5),
                                WeiPerWad.mul(1),
                                { gasLimit: 1000000 }
                            )
                        ).to.be.revertedWith("BookKeeper/debt-floor-dst")
                    })
                })
                context("when after moving bob position has too much debt", () => {
                    it("should revert", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(2))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(100),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(2),
                            positionDebtCeiling: WeiPerRad.mul(10)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100), { gasLimit: 1000000 })

                        // add collateral to 10 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, BobAddress, WeiPerWad.mul(20), { gasLimit: 1000000 })

                        // alice lock collateral 10 WXDC
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad.mul(10),
                            WeiPerWad.mul(3),
                            { gasLimit: 1000000 }
                        )

                        // bob lock collateral 100 WXDC and borrow 10 FXD
                        await bookKeeperAsBob.adjustPosition(
                            COLLATERAL_POOL_ID,
                            BobAddress,
                            BobAddress,
                            BobAddress,
                            WeiPerWad.mul(20),
                            WeiPerWad.mul(10),
                            { gasLimit: 1000000 }
                        )

                        // bob allow alice to manage a position
                        await bookKeeperAsBob.whitelist(AliceAddress)

                        await expect(
                            bookKeeperAsAlice.movePosition(
                                COLLATERAL_POOL_ID,
                                AliceAddress,
                                BobAddress,
                                WeiPerWad.mul(5),
                                WeiPerWad.mul(1),
                                { gasLimit: 1000000 }
                            )
                        ).to.be.revertedWith("BookKeeper/position-debt-ceiling-exceeded-dst")
                    })
                })
                context("when alice and bob positions are safe", () => {
                    it("should be able to call movePosition", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(1),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                        // add collateral to 10 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(10), { gasLimit: 1000000 })

                        // alice lock collateral 10 WXDC
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad.mul(10),
                            WeiPerWad.mul(2),
                            { gasLimit: 1000000 }
                        )

                        // bob allow alice to manage a position
                        await bookKeeperAsBob.whitelist(AliceAddress)

                        const positionAliceBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                        expect(positionAliceBefore.lockedCollateral).to.be.equal(WeiPerWad.mul(10))
                        expect(positionAliceBefore.debtShare).to.be.equal(WeiPerWad.mul(2))

                        const positionBobBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, BobAddress)
                        expect(positionBobBefore.lockedCollateral).to.be.equal(0)
                        expect(positionBobBefore.debtShare).to.be.equal(0)

                        await bookKeeperAsAlice.movePosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            BobAddress,
                            WeiPerWad.mul(5),
                            WeiPerWad.mul(1)
                        )

                        const positionAliceAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                        expect(positionAliceAfter.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                        expect(positionAliceAfter.debtShare).to.be.equal(WeiPerWad.mul(1))

                        const positionBobAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, BobAddress)
                        expect(positionBobAfter.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                        expect(positionBobAfter.debtShare).to.be.equal(WeiPerWad.mul(1))
                    })
                })
            })
        })
    })

    describe("#confiscatePosition", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    bookKeeperAsAlice.confiscatePosition(
                        COLLATERAL_POOL_ID,
                        AliceAddress,
                        DeployerAddress,
                        DeployerAddress,
                        WeiPerWad.mul(-1),
                        WeiPerWad.mul(-1),
                        { gasLimit: 1000000 }
                    )
                ).to.be.revertedWith("!liquidationEngineRole")
            })
        })
        context("when the caller is the owner", async () => {
            context("when start liquidation", () => {
                context("when liquidating all in position", () => {
                    // test is disabled due to broken negative nubmer support
                    it("should be able to call confiscatePosition", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                        await mockedAccessControlConfig.mock.hasRole.returns(true)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(1),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 1 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad, { gasLimit: 1000000 })

                        // add collateral to 1 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad, { gasLimit: 1000000 })
                        // adjust position
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad,
                            WeiPerWad,
                            { gasLimit: 1000000 }
                        )

                        const positionBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                        expect(positionBefore.lockedCollateral).to.be.equal(WeiPerWad)
                        expect(positionBefore.debtShare).to.be.equal(WeiPerWad)
                        const collateralTokenCreditorBefore = await bookKeeper.collateralToken(
                            COLLATERAL_POOL_ID,
                            DeployerAddress
                        )
                        expect(collateralTokenCreditorBefore).to.be.equal(0)
                        const systemBadDebtDebtorBefore = await bookKeeper.systemBadDebt(DeployerAddress)
                        expect(systemBadDebtDebtorBefore).to.be.equal(0)
                        const totalUnbackedStablecoinBefore = await bookKeeper.totalUnbackedStablecoin()
                        expect(totalUnbackedStablecoinBefore).to.be.equal(0)
                        const poolStablecoinIssuedBefore = await bookKeeper.poolStablecoinIssued(COLLATERAL_POOL_ID)
                        expect(poolStablecoinIssuedBefore).to.be.equal(WeiPerRad)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad.mul(1))
                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: WeiPerWad.mul(1),
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(1),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })
                        // confiscate position
                        await bookKeeper.confiscatePosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            DeployerAddress,
                            DeployerAddress,
                            WeiPerWad.mul(-1),
                            WeiPerWad.mul(-1),
                            { gasLimit: 1000000 }
                        )

                        const positionAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                        expect(positionAfter.lockedCollateral).to.be.equal(0)
                        expect(positionAfter.debtShare).to.be.equal(0)
                        const collateralTokenCreditorAfter = await bookKeeper.collateralToken(
                            COLLATERAL_POOL_ID,
                            DeployerAddress
                        )
                        expect(collateralTokenCreditorAfter).to.be.equal(WeiPerWad)
                        const systemBadDebtDebtorAfter = await bookKeeper.systemBadDebt(DeployerAddress)
                        expect(systemBadDebtDebtorAfter).to.be.equal(WeiPerRad)
                        const totalUnbackedStablecoinAfter = await bookKeeper.totalUnbackedStablecoin()
                        expect(totalUnbackedStablecoinAfter).to.be.equal(WeiPerRad)
                        const poolStablecoinIssuedAfter = await bookKeeper.poolStablecoinIssued(COLLATERAL_POOL_ID)
                        expect(poolStablecoinIssuedAfter).to.be.equal(0)
                    })
                })
                context("when liquidating some in position", () => {
                    // test is disabled due to broken negative nubmer support
                    it("should be able to call confiscatePosition", async () => {
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                        await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                        await mockedAccessControlConfig.mock.hasRole.returns(true)

                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: 0,
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(1),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })

                        // set total debt ceiling 10 rad
                        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10), { gasLimit: 1000000 })

                        // add collateral to 2 WXDC
                        await bookKeeper.addCollateral(COLLATERAL_POOL_ID, AliceAddress, WeiPerWad.mul(2), { gasLimit: 1000000 })
                        // adjust position
                        await bookKeeperAsAlice.adjustPosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            AliceAddress,
                            AliceAddress,
                            WeiPerWad.mul(2),
                            WeiPerWad.mul(2),
                            { gasLimit: 1000000 }
                        )

                        const positionBefore = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                        expect(positionBefore.lockedCollateral).to.be.equal(WeiPerWad.mul(2))
                        expect(positionBefore.debtShare).to.be.equal(WeiPerWad.mul(2))
                        const collateralTokenCreditorBefore = await bookKeeper.collateralToken(
                            COLLATERAL_POOL_ID,
                            DeployerAddress
                        )
                        expect(collateralTokenCreditorBefore).to.be.equal(0)
                        const systemBadDebtDebtorBefore = await bookKeeper.systemBadDebt(DeployerAddress)
                        expect(systemBadDebtDebtorBefore).to.be.equal(0)
                        const totalUnbackedStablecoinBefore = await bookKeeper.totalUnbackedStablecoin()
                        expect(totalUnbackedStablecoinBefore).to.be.equal(0)
                        await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad.mul(2))
                        await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                            debtAccumulatedRate: WeiPerRay,
                            totalDebtShare: WeiPerWad.mul(2),
                            debtCeiling: WeiPerRad.mul(10),
                            priceWithSafetyMargin: WeiPerRay,
                            debtFloor: WeiPerRad.mul(1),
                            positionDebtCeiling: WeiPerRad.mul(1000000)
                        })
                        // confiscate position
                        await bookKeeper.confiscatePosition(
                            COLLATERAL_POOL_ID,
                            AliceAddress,
                            DeployerAddress,
                            DeployerAddress,
                            WeiPerWad.mul(-1),
                            WeiPerWad.mul(-1),
                            { gasLimit: 1000000 }
                        )

                        const positionAfter = await bookKeeper.positions(COLLATERAL_POOL_ID, AliceAddress)
                        expect(positionAfter.lockedCollateral).to.be.equal(WeiPerWad)
                        expect(positionAfter.debtShare).to.be.equal(WeiPerWad)
                        const collateralTokenCreditorAfter = await bookKeeper.collateralToken(
                            COLLATERAL_POOL_ID,
                            DeployerAddress
                        )
                        expect(collateralTokenCreditorAfter).to.be.equal(WeiPerWad)
                        const systemBadDebtDebtorAfter = await bookKeeper.systemBadDebt(DeployerAddress)
                        expect(systemBadDebtDebtorAfter).to.be.equal(WeiPerRad)
                        const totalUnbackedStablecoinAfter = await bookKeeper.totalUnbackedStablecoin()
                        expect(totalUnbackedStablecoinAfter).to.be.equal(WeiPerRad)
                    })
                })
            })
        })
    })

    describe("#mintUnbackedStablecoin", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    bookKeeperAsAlice.mintUnbackedStablecoin(DeployerAddress, AliceAddress, WeiPerRad, { gasLimit: 1000000 })
                ).to.be.revertedWith("!mintableRole")
            })
        })
        context("when the caller is the owner", async () => {
            context("when mint unbacked stable coin", () => {
                it("should be able to call mintUnbackedStablecoin", async () => {
                    const systemBadDebtBefore = await bookKeeper.systemBadDebt(DeployerAddress)
                    expect(systemBadDebtBefore).to.be.equal(0)
                    const stablecoinAliceBefore = await bookKeeper.stablecoin(AliceAddress)
                    expect(stablecoinAliceBefore).to.be.equal(0)
                    const totalUnbackedStablecoinBefore = await bookKeeper.totalUnbackedStablecoin()
                    expect(totalUnbackedStablecoinBefore).to.be.equal(0)
                    const totalStablecoinIssuedBefore = await bookKeeper.totalStablecoinIssued()
                    expect(totalStablecoinIssuedBefore).to.be.equal(0)

                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    //  mint 1 rad to alice
                    await bookKeeper.mintUnbackedStablecoin(DeployerAddress, AliceAddress, WeiPerRad, { gasLimit: 1000000 })

                    const systemBadDebtAfter = await bookKeeper.systemBadDebt(DeployerAddress)
                    expect(systemBadDebtAfter).to.be.equal(WeiPerRad)
                    const stablecoinAliceAfter = await bookKeeper.stablecoin(AliceAddress)
                    expect(stablecoinAliceAfter).to.be.equal(WeiPerRad)
                    const totalUnbackedStablecoinAfter = await bookKeeper.totalUnbackedStablecoin()
                    expect(totalUnbackedStablecoinAfter).to.be.equal(WeiPerRad)
                    const totalStablecoinIssuedAfter = await bookKeeper.totalStablecoinIssued()
                    expect(totalStablecoinIssuedAfter).to.be.equal(WeiPerRad)
                })
            })
        })
    })

    describe("#settleSystemBadDebt", () => {
        context("when settle system bad debt", () => {
            it("should be able to call settleSystemBadDebt", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                //  mint 1 rad to deployer
                await bookKeeper.mintUnbackedStablecoin(DeployerAddress, DeployerAddress, WeiPerRad, { gasLimit: 1000000 })

                const systemBadDebtBefore = await bookKeeper.systemBadDebt(DeployerAddress)
                expect(systemBadDebtBefore).to.be.equal(WeiPerRad)
                const stablecoinDeployerBefore = await bookKeeper.stablecoin(DeployerAddress)
                expect(stablecoinDeployerBefore).to.be.equal(WeiPerRad)
                const totalUnbackedStablecoinBefore = await bookKeeper.totalUnbackedStablecoin()
                expect(totalUnbackedStablecoinBefore).to.be.equal(WeiPerRad)
                const totalStablecoinIssuedBefore = await bookKeeper.totalStablecoinIssued()
                expect(totalStablecoinIssuedBefore).to.be.equal(WeiPerRad)

                // settle system bad debt 1 rad
                await bookKeeper.settleSystemBadDebt(WeiPerRad, { gasLimit: 1000000 })

                const systemBadDebtAfter = await bookKeeper.systemBadDebt(DeployerAddress)
                expect(systemBadDebtAfter).to.be.equal(0)
                const stablecoinDeployerAfter = await bookKeeper.stablecoin(DeployerAddress)
                expect(stablecoinDeployerAfter).to.be.equal(0)
                const totalUnbackedStablecoinAfter = await bookKeeper.totalUnbackedStablecoin()
                expect(totalUnbackedStablecoinAfter).to.be.equal(0)
                const totalStablecoinIssuedAfter = await bookKeeper.totalStablecoinIssued()
                expect(totalStablecoinIssuedAfter).to.be.equal(0)
            })
        })
    })

    describe("#accrueStabilityFee", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(
                    bookKeeperAsAlice.accrueStabilityFee(COLLATERAL_POOL_ID, DeployerAddress, WeiPerRay, { gasLimit: 1000000 })
                ).to.be.revertedWith("!stabilityFeeCollectorRole")
            })
        })
        context("when the caller is the owner", async () => {
            context("when bookkeeper does not live", () => {
                it("should be revert", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await bookKeeper.cage()

                    await expect(
                        bookKeeper.accrueStabilityFee(COLLATERAL_POOL_ID, DeployerAddress, WeiPerRay, { gasLimit: 1000000 })
                    ).to.be.revertedWith("BookKeeper/not-live")
                })
            })
            context("when bookkeeper is live", () => {
                it("should be able to call accrueStabilityFee", async () => {
                    await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(WeiPerRay)
                    await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(0)
                    await mockedCollateralPoolConfig.mock.getDebtFloor.returns(WeiPerRad.mul(1))
                    await mockedCollateralPoolConfig.mock.getDebtCeiling.returns(WeiPerRad.mul(10))
                    await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(WeiPerRay)
                    await mockedCollateralPoolConfig.mock.setDebtAccumulatedRate.returns()
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                        debtAccumulatedRate: WeiPerRay,
                        totalDebtShare: 0,
                        debtCeiling: WeiPerRad.mul(10),
                        priceWithSafetyMargin: WeiPerRay,
                        debtFloor: WeiPerRad.mul(1),
                        positionDebtCeiling: WeiPerRad.mul(1000000)
                    })

                    // set total debt ceiling 1 rad
                    await bookKeeper.setTotalDebtCeiling(WeiPerRad, { gasLimit: 1000000 })

                    // add collateral to 1 WXDC
                    await bookKeeper.addCollateral(COLLATERAL_POOL_ID, DeployerAddress, WeiPerWad, { gasLimit: 1000000 })
                    // adjust position
                    await bookKeeper.adjustPosition(
                        COLLATERAL_POOL_ID,
                        DeployerAddress,
                        DeployerAddress,
                        DeployerAddress,
                        WeiPerWad,
                        WeiPerWad,
                        { gasLimit: 1000000 }
                    )

                    const stablecoinDeployerBefore = await bookKeeper.stablecoin(DeployerAddress)
                    expect(stablecoinDeployerBefore).to.be.equal(WeiPerRad)
                    const totalStablecoinIssuedBefore = await bookKeeper.totalStablecoinIssued()
                    expect(totalStablecoinIssuedBefore).to.be.equal(WeiPerRad)
                    const poolStablecoinIssuedBefore = await bookKeeper.poolStablecoinIssued(COLLATERAL_POOL_ID)
                    expect(poolStablecoinIssuedBefore).to.be.equal(WeiPerRad)

                    await mockedCollateralPoolConfig.mock.getTotalDebtShare.returns(WeiPerWad.mul(1))
                    await mockedCollateralPoolConfig.mock.getCollateralPoolInfo.returns({
                        debtAccumulatedRate: WeiPerRay,
                        totalDebtShare: WeiPerWad.mul(1),
                        debtCeiling: WeiPerRad.mul(10),
                        priceWithSafetyMargin: WeiPerRay,
                        debtFloor: WeiPerRad.mul(1),
                        positionDebtCeiling: WeiPerRad.mul(1000000)
                    })

                    await bookKeeper.accrueStabilityFee(COLLATERAL_POOL_ID, DeployerAddress, WeiPerRay, { gasLimit: 1000000 })

                    const stablecoinDeployerAfter = await bookKeeper.stablecoin(DeployerAddress)
                    expect(stablecoinDeployerAfter).to.be.equal(WeiPerRad.mul(2))
                    const totalStablecoinIssuedAfter = await bookKeeper.totalStablecoinIssued()
                    expect(totalStablecoinIssuedAfter).to.be.equal(WeiPerRad.mul(2))
                    const poolStablecoinIssuedAfter = await bookKeeper.poolStablecoinIssued(COLLATERAL_POOL_ID)
                    expect(poolStablecoinIssuedAfter).to.be.equal(WeiPerRad.mul(2))
                })
            })
        })
    })

    describe("#setTotalDebtCeiling", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(bookKeeperAsAlice.setTotalDebtCeiling(WeiPerRad)).to.be.revertedWith("!ownerRole")
            })
        })
        context("when the caller is the owner", async () => {
            context("when bookkeeper does not live", () => {
                it("should be revert", async () => {
                    // grant role access
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await bookKeeper.cage()

                    await expect(bookKeeper.setTotalDebtCeiling(WeiPerRad, { gasLimit: 1000000 })).to.be.revertedWith("BookKeeper/not-live")
                })
            })
            context("when bookkeeper is live", () => {
                it("should be able to call setTotalDebtCeiling", async () => {
                    // grant role access
                    await mockedAccessControlConfig.mock.hasRole.returns(true)
                    // set total debt ceiling 1 rad
                    await expect(bookKeeper.setTotalDebtCeiling(WeiPerRad, { gasLimit: 1000000 }))
                        .to.emit(bookKeeper, "LogSetTotalDebtCeiling")
                        .withArgs(DeployerAddress, WeiPerRad)
                })
            })
        })
    })

    describe("#pause", () => {
        context("when role can't access", () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(bookKeeperAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })

        context("when role can access", () => {
            context("and role is owner role", () => {
                it("should be success", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)
                    await bookKeeper.pause()
                })
            })
        })
    })

    describe("#unpause", () => {
        context("when role can't access", () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(bookKeeperAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })

        context("when role can access", () => {
            context("and role is owner role", () => {
                it("should be success", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)
                    await bookKeeper.pause()
                    await bookKeeper.unpause()
                })
            })
        })
    })

    describe("#cage", () => {
        context("when role can't access", () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(bookKeeperAsAlice.cage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
            })
        })

        context("when owner role can access", () => {
            it("should be success", async () => {
                // grant role access
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                expect(await bookKeeperAsAlice.live()).to.be.equal(1)

                await expect(bookKeeperAsAlice.cage()).to.emit(bookKeeperAsAlice, "LogCage").withArgs()

                expect(await bookKeeperAsAlice.live()).to.be.equal(0)
            })
        })

        context("when was already caged", () => {
            it("should not fail", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                expect(await bookKeeperAsAlice.live()).to.be.equal(1)

                await expect(bookKeeperAsAlice.cage()).to.emit(bookKeeperAsAlice, "LogCage").withArgs()

                expect(await bookKeeperAsAlice.live()).to.be.equal(0)

                await bookKeeperAsAlice.cage()

                expect(await bookKeeperAsAlice.live()).to.be.equal(0)
            })
        })
    })

    describe("#uncage", () => {
        context("when role can't access", () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(bookKeeperAsAlice.uncage()).to.be.revertedWith("!(ownerRole or showStopperRole)")
            })
        })

        context("when owner role can access", () => {
            it("should be success", async () => {
                // grant role access
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                expect(await bookKeeperAsAlice.live()).to.be.equal(1)

                await bookKeeperAsAlice.cage()

                expect(await bookKeeperAsAlice.live()).to.be.equal(0)

                await expect(bookKeeperAsAlice.uncage()).to.emit(bookKeeperAsAlice, "LogUncage").withArgs()

                expect(await bookKeeperAsAlice.live()).to.be.equal(1)
            })
        })
    })
})
