require("@openzeppelin/test-helpers")

const chai = require('chai');
const { ethers, BigNumber } = require("ethers");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { MaxUint256 } = require("@ethersproject/constants");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const { advanceBlock } = require("../helper/time");
const { loadProxyWalletFixtureHandler } = require("../helper/proxy");
const { DeployerAddress, AliceAddress, BobAddress } = require("../helper/address");
const { openPosition, openPositionAndDraw } = require("../helper/positions");
const { formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai
const { AddressZero } = ethers.constants

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = "5000"
const LIQUIDATOR_INCENTIVE_BPS = "10250"
const TREASURY_FEE_BPS = "5000"

describe("GetPositions", () => {

    let aliceProxyWallet
    let bobProxyWallet
    let WXDC
    let collateralPoolConfig
    let positionManager
    let getPositions

    beforeEach(async () => {
        await snapshot.revertToSnapshot();
        ; ({
            proxyWallets: [deployerProxyWallet, aliceProxyWallet, bobProxyWallet],
        } = await loadProxyWalletFixtureHandler([DeployerAddress, AliceAddress, BobAddress]))

        collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
        positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
        WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");
        getPositions = await artifacts.initializeInterfaceAt("GetPositions", "GetPositions");

        const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");
        const bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
        const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");
        const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.getAdapter(COLLATERAL_POOL_ID)

        await collateralPoolConfig.initCollateralPool(
            COLLATERAL_POOL_ID,
            WeiPerRad.mul(10000000),
            0,
            simplePriceFeed.address,
            WeiPerRay,
            WeiPerRay,
            collateralTokenAdapterAddress,
            CLOSE_FACTOR_BPS,
            LIQUIDATOR_INCENTIVE_BPS,
            TREASURY_FEE_BPS,
            AddressZero
        )
        await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(10000000), { gasLimit: 1000000 })

        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay, { gasLimit: 1000000 })
    })

    describe("#getPositionWithSafetyBuffer", async () => {
        context("multiple positions at risks", async () => {
            it("should query all positions at risks", async () => {
                await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.mul(2), { gasLimit: 1000000 })

                await WXDC.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress, gasLimit: 1000000 })

                await openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, ethers.utils.parseEther("1"), ethers.utils.parseEther("1"));
                await advanceBlock()

                await openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, ethers.utils.parseEther("2"), ethers.utils.parseEther("1"));
                await advanceBlock()

                await openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, ethers.utils.parseEther("1.5"), ethers.utils.parseEther("1"));
                await advanceBlock()

                await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, ethers.utils.parseEther("0.9").mul(1e9), { gasLimit: 1000000 })
                const positions = await getPositions.getPositionWithSafetyBuffer(positionManager.address, 1, 40)
                expect(positions._debtShares[0]).to.be.equal(WeiPerWad)
                expect(positions._debtShares[1]).to.be.equal(WeiPerWad)
                expect(positions._debtShares[2]).to.be.equal(WeiPerWad)
                expect(positions._safetyBuffers[0]).to.be.equal(BigNumber.from("0"))
                expect(positions._safetyBuffers[1]).to.be.equal(WeiPerRad.mul(8).div(10))
                expect(positions._safetyBuffers[2]).to.be.equal(WeiPerRad.mul(35).div(100))
            })
        })
    })

    describe("#getAllPostionsAsc, #getPositionsAsc, #getAllPositionsDesc, #getPositionsDesc", async () => {
        context("when Bob opened 11 positions", async () => {
            context("when calling each getPositions function", async () => {
                it("should return correctly", async () => {
                    await WXDC.approve(bobProxyWallet.address, MaxUint256, { from: BobAddress, gasLimit: 1000000 });

                    for (let i = 0; i < 5; i++) {
                        await openPosition(bobProxyWallet, BobAddress, COLLATERAL_POOL_ID, ethers.utils.parseEther("2"), ethers.utils.parseEther("1"));
                        await advanceBlock();
                    }

                    /**
                     * #getAllPositionsDesc
                     */
                    {
                        const [ids, positions, collateralPools] = await getPositions.getAllPositionsAsc(
                            positionManager.address,
                            bobProxyWallet.address
                        )

                        expect(ids.length).to.be.equal(5)
                        expect(positions.length).to.be.equal(5)
                        expect(collateralPools.length).to.be.equal(5)
                        expect(ids[0]).to.be.equal(1)
                        expect(ids[4]).to.be.equal(5)
                    }

                    /**
                     * #getAllPositionsDesc
                     */
                    {
                        const [ids, positions, collateralPools] = await getPositions.getAllPositionsDesc(
                            positionManager.address,
                            bobProxyWallet.address
                        )

                        expect(ids.length).to.be.equal(5)
                        expect(positions.length).to.be.equal(5)
                        expect(collateralPools.length).to.be.equal(5)
                        expect(ids[0]).to.be.equal(5)
                        expect(ids[4]).to.be.equal(1)
                    }

                    /**
                     * #getPositionsAsc
                     */
                    {
                        // 1st page
                        let from = await positionManager.ownerFirstPositionId(bobProxyWallet.address)
                        let [ids, positions, collateralPools] = await getPositions.getPositionsAsc(
                            positionManager.address,
                            from,
                            2
                        )
                        expect(ids.length).to.be.equal(2)
                        expect(positions.length).to.be.equal(2)
                        expect(collateralPools.length).to.be.equal(2)
                        expect(ids[0]).to.be.equal(1)
                        expect(ids[1]).to.be.equal(2)

                        // 2nd page
                        from = ids[1].add(1)
                            ;[ids, positions, collateralPools] = await getPositions.getPositionsAsc(
                                positionManager.address,
                                from,
                                2
                            )
                        expect(ids.length).to.be.equal(2)
                        expect(positions.length).to.be.equal(2)
                        expect(collateralPools.length).to.be.equal(2)
                        expect(ids[0]).to.be.equal(3)
                        expect(ids[1]).to.be.equal(4)

                        // 3rd page
                        from = ids[1].add(1)
                            ;[ids, positions, collateralPools] = await getPositions.getPositionsAsc(
                                positionManager.address,
                                from,
                                2
                            )
                        expect(ids.length).to.be.equal(2)
                        expect(positions.length).to.be.equal(2)
                        expect(collateralPools.length).to.be.equal(2)
                        expect(ids[0]).to.be.equal(5)
                        expect(ids[1]).to.be.equal(0)
                    }

                    /**
                     * #getPositionsDesc
                     */
                    {
                        // 1st page
                        let from = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                        let [ids, positions, collateralPools] = await getPositions.getPositionsDesc(
                            positionManager.address,
                            from,
                            2
                        )
                        expect(ids.length).to.be.equal(2)
                        expect(positions.length).to.be.equal(2)
                        expect(collateralPools.length).to.be.equal(2)
                        expect(ids[0]).to.be.equal(5)
                        expect(ids[1]).to.be.equal(4)

                        // 2nd page
                        from = ids[1].sub(1)
                            ;[ids, positions, collateralPools] = await getPositions.getPositionsDesc(
                                positionManager.address,
                                from,
                                2
                            )
                        expect(ids.length).to.be.equal(2)
                        expect(positions.length).to.be.equal(2)
                        expect(collateralPools.length).to.be.equal(2)
                        expect(ids[0]).to.be.equal(3)
                        expect(ids[1]).to.be.equal(2)

                        // 3rd page
                        from = ids[1].sub(1)
                            ;[ids, positions, collateralPools] = await getPositions.getPositionsDesc(
                                positionManager.address,
                                from,
                                2
                            )
                        expect(ids.length).to.be.equal(2)
                        expect(positions.length).to.be.equal(2)
                        expect(collateralPools.length).to.be.equal(2)
                        expect(ids[0]).to.be.equal(1)
                        expect(ids[1]).to.be.equal(0)
                    }
                })
            })
        })
    })
})
