const chai = require('chai');
const { ethers } = require("ethers");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const { advanceBlock } = require("../helper/time");
const { createProxyWallets } = require("../helper/proxy-wallets");
const { AliceAddress, BobAddress } = require("../helper/address");
const PositionHelper = require("../helper/positions");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");

const { expect } = chai

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
    const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
    const priceOracle = await getProxy(proxyFactory, "PriceOracle");
    const showStopper = await getProxy(proxyFactory, "ShowStopper");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");

    ({
        proxyWallets: [aliceProxyWallet, bobProxyWallet],
    } = await createProxyWallets([AliceAddress, BobAddress]));

    await collateralPoolConfig.setStabilityFeeRate(pools.XDC, WeiPerRay, { gasLimit: 1000000 });

    await fathomStablecoin.approve(stablecoinAdapter.address, WeiPerWad.mul(10000), { from: AliceAddress })

    return {
        bookKeeper,
        showStopper,
        liquidationEngine,
        systemDebtEngine,
        priceOracle,
        stablecoinAdapter,
        accessControlConfig,
        positionManager,
        aliceProxyWallet,
        bobProxyWallet,
    }
}

describe("ShowStopper", () => {
    // Proxy wallet
    let aliceProxyWallet
    let bobProxyWallet

    // Contract
    let positionManager
    let showStopper
    let bookKeeper
    let liquidationEngine
    let systemDebtEngine
    let priceOracle
    let stablecoinAdapter
    let accessControlConfig

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            bookKeeper,
            showStopper,
            liquidationEngine,
            systemDebtEngine,
            priceOracle,
            stablecoinAdapter,
            accessControlConfig,
            positionManager,
            aliceProxyWallet,
            bobProxyWallet
        } = await loadFixture(setup));
    })

    describe("#cage", () => {
        context("when doesn't grant showStopperRole for showStopper", () => {
            it("should be revert", async () => {
                await expect(showStopper.cage(), { gasLimit: 1000000 }).to.be.revertedWith("!(ownerRole or showStopperRole)")
            })
        })
        context("when grant showStopperRole for all contract", () => {
            it("should be able to cage", async () => {
                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)
                await showStopper.cage({ gasLimit: 1000000 });

                expect(await bookKeeper.live()).to.be.equal(0)
                expect(await liquidationEngine.live()).to.be.equal(0)
                expect(await systemDebtEngine.live()).to.be.equal(0)
                expect(await priceOracle.live()).to.be.equal(0)
            })
        })
    })
    describe("#cage(collateralPoolId)", () => {
        context("deployer cage WXDC pool", () => {
            it("should be able to cage", async () => {
                // 1.
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()
                await showStopper.cagePool(pools.XDC)

                expect(await showStopper.cagePrice(pools.XDC)).to.be.equal(WeiPerRay)
                expect(await showStopper.totalDebtShare(pools.XDC)).to.be.equal(WeiPerWad.mul(5))
            })
        })
    })
    describe("#accumulateBadDebt, #redeemLockedCollateral", () => {
        context("when the caller is not the position owner", () => {
            it("should be able to redeemLockedCollateral", async () => {
                // alice's position #1
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(pools.XDC)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(pools.XDC, positionAddress)

                // redeem lock collateral position #1
                await expect(
                    PositionHelper.redeemLockedCollateral(bobProxyWallet, BobAddress, positionId)
                ).to.be.revertedWith("owner not allowed")
            })
        })
        context("when the caller is the position owner", () => {
            it("should be able to redeemLockedCollateral", async () => {
                // alice's position #1
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                // bob's position #2
                await PositionHelper.openXDCPositionAndDraw(bobProxyWallet, BobAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                const positionAddress2 = await positionManager.positions(positionId2)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(pools.XDC)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(pools.XDC, positionAddress)
                const position1 = await bookKeeper.positions(pools.XDC, positionAddress)
                expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position1.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(pools.XDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

                // accumulate bad debt posiion #2
                await showStopper.accumulateBadDebt(pools.XDC, positionAddress2)
                const position2 = await bookKeeper.positions(pools.XDC, positionAddress2)
                expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position2.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(pools.XDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(10)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

                // redeem lock collateral position #1
                await PositionHelper.redeemLockedCollateral(aliceProxyWallet, AliceAddress, positionId)

                expect((await bookKeeper.positions(pools.XDC, positionAddress)).lockedCollateral).to.be.equal(
                    0
                )
                expect(await bookKeeper.collateralToken(pools.XDC, aliceProxyWallet.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )

                // redeem lock collateral position #2
                await PositionHelper.redeemLockedCollateral(bobProxyWallet, BobAddress, positionId2)

                expect(
                    (await bookKeeper.positions(pools.XDC, positionAddress2)).lockedCollateral
                ).to.be.equal(0)
                expect(await bookKeeper.collateralToken(pools.XDC, bobProxyWallet.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
            })
        })
    })
    describe("#finalizeDebt, #finalizeCashPrice", () => {
        context("when finalizeDebt and finalizeCashPrice", () => {
            it("should be able to call", async () => {
                // alice's position #1
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                // bob's position #2
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openXDCPositionAndDraw(bobProxyWallet, BobAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                const positionAddress2 = await positionManager.positions(positionId2)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(pools.XDC)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(pools.XDC, positionAddress)
                const position1 = await bookKeeper.positions(pools.XDC, positionAddress)
                expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position1.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(pools.XDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

                // accumulate bad debt posiion #2
                await showStopper.accumulateBadDebt(pools.XDC, positionAddress2)
                const position2 = await bookKeeper.positions(pools.XDC, positionAddress2)
                expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position2.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(pools.XDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(10)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

                // finalize debt
                await showStopper.finalizeDebt()
                // total debt
                expect(await showStopper.debt()).to.be.equal(WeiPerRad.mul(10))

                // finalize cash price
                await showStopper.finalizeCashPrice(pools.XDC)
                // badDebtAccumulator / totalDebt = 10000000000000000000000000000000000000000000000 / 10000000000000000000 = 1000000000000000000000000000
                expect(await showStopper.finalCashPrice(pools.XDC)).to.be.equal(WeiPerRay)
            })
        })
    })
    describe("#accumulateStablecoin, #redeemStablecoin", () => {
        context("when redeem stablecoin", () => {
            it("should be able to accumulateStablecoin, redeemStablecoin", async () => {
                // alice's position #1
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                // bob's position #2
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openXDCPositionAndDraw(bobProxyWallet, BobAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                const positionAddress2 = await positionManager.positions(positionId2)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(pools.XDC)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(pools.XDC, positionAddress)
                const position1 = await bookKeeper.positions(pools.XDC, positionAddress)
                expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position1.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(pools.XDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

                // accumulate bad debt posiion #2
                await showStopper.accumulateBadDebt(pools.XDC, positionAddress2)
                const position2 = await bookKeeper.positions(pools.XDC, positionAddress2)
                expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position2.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(pools.XDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(10)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

                // finalize debt
                await showStopper.finalizeDebt()
                expect(await showStopper.debt()).to.be.equal(WeiPerRad.mul(10))

                // finalize cash price WXDC
                await showStopper.finalizeCashPrice(pools.XDC)
                // badDebtAccumulator / totalDebt = 10000000000000000000000000000000000000000000000 / 10000000000000000000 = 1000000000000000000000000000
                expect(await showStopper.finalCashPrice(pools.XDC)).to.be.equal("1000000000000000000000000000")

                // accumulate stablecoin
                await stablecoinAdapter.deposit(
                    AliceAddress,
                    WeiPerWad.mul(5),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                await bookKeeper.whitelist(showStopper.address, { from: AliceAddress })

                await showStopper.accumulateStablecoin(WeiPerWad.mul(5), { from: AliceAddress })

                // redeem stablecoin
                await showStopper.redeemStablecoin(pools.XDC, WeiPerWad.mul(5), { from: AliceAddress })
                expect(await bookKeeper.collateralToken(pools.XDC, AliceAddress)).to.be.equal(
                    "5000000000000000000"
                )
            })
        })
    })
})
