const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const { advanceBlock } = require("../helper/time");
const { createProxyWallets } = require("../helper/proxy");
const { AliceAddress, BobAddress, AddressZero } = require("../helper/address");
const { formatBytes32String } = require("ethers/lib/utils");
const PositionHelper = require("../helper/positions");
const { loadFixture } = require("../helper/fixtures");
const { initializeContracts } = require("../helper/initializer");
const { addRoles } = require("../helper/access-roles");

const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_USDT = formatBytes32String("USDT")

const { expect } = chai

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const setup = async () => {
    const bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
    const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
    const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");
    const liquidationEngine = await artifacts.initializeInterfaceAt("LiquidationEngine", "LiquidationEngine");
    const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
    const systemDebtEngine = await artifacts.initializeInterfaceAt("SystemDebtEngine", "SystemDebtEngine");
    const priceOracle = await artifacts.initializeInterfaceAt("PriceOracle", "PriceOracle");
    const showStopper = await artifacts.initializeInterfaceAt("ShowStopper", "ShowStopper");
    const accessControlConfig = await artifacts.initializeInterfaceAt("AccessControlConfig", "AccessControlConfig");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");
    const collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
    const WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");
    const USDT = await artifacts.initializeInterfaceAt("USDT", "USDT");
    const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");

    const wxdcTokenAdapter = await collateralTokenAdapterFactory.adapters(COLLATERAL_POOL_ID_WXDC);
    const usdtTokenAdapter = await collateralTokenAdapterFactory.adapters(COLLATERAL_POOL_ID_USDT);

    await initializeContracts();
    await addRoles();

    ({
        proxyWallets: [aliceProxyWallet, bobProxyWallet],
    } = await createProxyWallets([AliceAddress, BobAddress]));

    await WXDC.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })
    await WXDC.approve(bobProxyWallet.address, WeiPerWad.mul(10000), { from: BobAddress })
    await USDT.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })
    await USDT.approve(bobProxyWallet.address, WeiPerWad.mul(10000), { from: BobAddress })
    await fathomStablecoin.approve(stablecoinAdapter.address, WeiPerWad.mul(10000), { from: AliceAddress })

    await simplePriceFeed.setPrice(WeiPerWad, { gasLimit: 1000000 })

    await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100), { gasLimit: 1000000 })

    await showStopper.setBookKeeper(bookKeeper.address, { gasLimit: 1000000 })
    await showStopper.setLiquidationEngine(liquidationEngine.address, { gasLimit: 1000000 })
    await showStopper.setSystemDebtEngine(systemDebtEngine.address, { gasLimit: 1000000 })
    await showStopper.setPriceOracle(priceOracle.address, { gasLimit: 1000000 })

    await collateralPoolConfig.initCollateralPool(
        COLLATERAL_POOL_ID_WXDC,
        WeiPerRad.mul(100),
        WeiPerRad.mul(1),
        simplePriceFeed.address,
        WeiPerRay,
        WeiPerRay,
        wxdcTokenAdapter,
        CLOSE_FACTOR_BPS,
        LIQUIDATOR_INCENTIVE_BPS,
        TREASURY_FEE_BPS,
        AddressZero

    )
    // set price with safety margin 1 ray (1 WXDC = 1 USD)
    await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID_WXDC, WeiPerRay, { gasLimit: 1000000 })

    // init USDT pool
    await collateralPoolConfig.initCollateralPool(
        COLLATERAL_POOL_ID_USDT,
        WeiPerRad.mul(100),
        WeiPerRad.mul(1),
        simplePriceFeed.address,
        WeiPerRay,
        WeiPerRay,
        usdtTokenAdapter,
        CLOSE_FACTOR_BPS,
        LIQUIDATOR_INCENTIVE_BPS,
        TREASURY_FEE_BPS,
        AddressZero,
        { gasLimit: 1000000 }
    )
    // set price with safety margin 1 ray (1 USDT = 1 USD)
    await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID_USDT, WeiPerRay, { gasLimit: 1000000 })

    return {
        bookKeeper,
        showStopper,
        liquidationEngine,
        systemDebtEngine,
        priceOracle,
        wxdcTokenAdapter,
        usdtTokenAdapter,
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
    let wxdcTokenAdapter
    let usdtTokenAdapter
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
            wxdcTokenAdapter,
            usdtTokenAdapter,
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
                await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()
                await showStopper.cagePool(COLLATERAL_POOL_ID_WXDC)

                expect(await showStopper.cagePrice(COLLATERAL_POOL_ID_WXDC)).to.be.equal(WeiPerRay)
                expect(await showStopper.totalDebtShare(COLLATERAL_POOL_ID_WXDC)).to.be.equal(WeiPerWad.mul(5))
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
                await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(COLLATERAL_POOL_ID_WXDC)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_WXDC, positionAddress)

                // redeem lock collateral position #1
                await expect(
                    PositionHelper.redeemLockedCollateral(bobProxyWallet, BobAddress, positionId, wxdcTokenAdapter)
                ).to.be.revertedWith("owner not allowed")
            })
        })
        context("when the caller is the position owner", () => {
            it("should be able to redeemLockedCollateral", async () => {
                // alice's position #1
                await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                // bob's position #2
                await PositionHelper.openPositionAndDraw(bobProxyWallet, BobAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                const positionAddress2 = await positionManager.positions(positionId2)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(COLLATERAL_POOL_ID_WXDC)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_WXDC, positionAddress)
                const position1 = await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress)
                expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position1.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

                // accumulate bad debt posiion #2
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_WXDC, positionAddress2)
                const position2 = await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress2)
                expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position2.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(10)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

                // redeem lock collateral position #1
                await PositionHelper.redeemLockedCollateral(aliceProxyWallet, AliceAddress, positionId, wxdcTokenAdapter)

                expect((await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress)).lockedCollateral).to.be.equal(
                    0
                )
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, aliceProxyWallet.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )

                // redeem lock collateral position #2
                await PositionHelper.redeemLockedCollateral(bobProxyWallet, BobAddress, positionId2, wxdcTokenAdapter)

                expect(
                    (await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress2)).lockedCollateral
                ).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, bobProxyWallet.address)).to.be.equal(
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
                await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                // bob's position #2
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openPositionAndDraw(bobProxyWallet, BobAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                const positionAddress2 = await positionManager.positions(positionId2)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(COLLATERAL_POOL_ID_WXDC)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_WXDC, positionAddress)
                const position1 = await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress)
                expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position1.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

                // accumulate bad debt posiion #2
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_WXDC, positionAddress2)
                const position2 = await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress2)
                expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position2.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(10)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

                // finalize debt
                await showStopper.finalizeDebt()
                // total debt
                expect(await showStopper.debt()).to.be.equal(WeiPerRad.mul(10))

                // finalize cash price
                await showStopper.finalizeCashPrice(COLLATERAL_POOL_ID_WXDC)
                // badDebtAccumulator / totalDebt = 10000000000000000000000000000000000000000000000 / 10000000000000000000 = 1000000000000000000000000000
                expect(await showStopper.finalCashPrice(COLLATERAL_POOL_ID_WXDC)).to.be.equal(WeiPerRay)
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
                await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                // bob's position #2
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FXD
                await PositionHelper.openPositionAndDraw(bobProxyWallet, BobAddress, COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId2 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                const positionAddress2 = await positionManager.positions(positionId2)

                // bob's position #3
                //  a. open a new position
                //  b. lock USDT
                //  c. mint FXD
                await PositionHelper.openPositionAndDraw(bobProxyWallet, BobAddress, COLLATERAL_POOL_ID_USDT, WeiPerWad.mul(10), WeiPerWad.mul(5))
                await advanceBlock()
                const positionId3 = await positionManager.ownerLastPositionId(bobProxyWallet.address)
                const positionAddress3 = await positionManager.positions(positionId3)

                await accessControlConfig.grantRole(await accessControlConfig.SHOW_STOPPER_ROLE(), showStopper.address)

                await showStopper.cage()

                await showStopper.cagePool(COLLATERAL_POOL_ID_WXDC)
                await showStopper.cagePool(COLLATERAL_POOL_ID_USDT)

                // accumulate bad debt posiion #1
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_WXDC, positionAddress)
                const position1 = await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress)
                expect(position1.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position1.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(5))

                // accumulate bad debt posiion #2
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_WXDC, positionAddress2)
                const position2 = await bookKeeper.positions(COLLATERAL_POOL_ID_WXDC, positionAddress2)
                expect(position2.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position2.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(10)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(10))

                // accumulate bad debt posiion #3
                await showStopper.accumulateBadDebt(COLLATERAL_POOL_ID_USDT, positionAddress3)
                const position3 = await bookKeeper.positions(COLLATERAL_POOL_ID_USDT, positionAddress3)
                expect(position3.lockedCollateral).to.be.equal(WeiPerWad.mul(5))
                expect(position3.debtShare).to.be.equal(0)
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_USDT, showStopper.address)).to.be.equal(
                    WeiPerWad.mul(5)
                )
                expect(await bookKeeper.systemBadDebt(systemDebtEngine.address)).to.be.equal(WeiPerRad.mul(15))

                // finalize debt
                await showStopper.finalizeDebt()
                expect(await showStopper.debt()).to.be.equal(WeiPerRad.mul(15))

                // finalize cash price WXDC
                await showStopper.finalizeCashPrice(COLLATERAL_POOL_ID_WXDC)
                // badDebtAccumulator / totalDebt = 10000000000000000000000000000000000000000000000 / 15000000000000000000 = 666666666666666666666666666
                expect(await showStopper.finalCashPrice(COLLATERAL_POOL_ID_WXDC)).to.be.equal("666666666666666666666666666")
                // finalize cash price USDT
                await showStopper.finalizeCashPrice(COLLATERAL_POOL_ID_USDT)
                // badDebtAccumulator / totalDebt = 5000000000000000000000000000000000000000000000 / 15000000000000000000 = 333333333333333333333333333
                expect(await showStopper.finalCashPrice(COLLATERAL_POOL_ID_USDT)).to.be.equal("333333333333333333333333333")

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
                await showStopper.redeemStablecoin(COLLATERAL_POOL_ID_WXDC, WeiPerWad.mul(5), { from: AliceAddress })
                // WAD(5000000000000000000 * 666666666666666666666666666) = 3333333333333333333
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_WXDC, AliceAddress)).to.be.equal(
                    "3333333333333333333"
                )
                await showStopper.redeemStablecoin(COLLATERAL_POOL_ID_USDT, WeiPerWad.mul(5), { from: AliceAddress })
                // WAD(5000000000000000000 * 333333333333333333333333333) = 3333333333333333333
                expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID_USDT, AliceAddress)).to.be.equal(
                    "1666666666666666666"
                )

                // over redeem stablecoin
                await expect(
                    showStopper.redeemStablecoin(COLLATERAL_POOL_ID_USDT, WeiPerWad.mul(5), { from: AliceAddress })
                ).to.be.revertedWith("ShowStopper/insufficient-stablecoin-accumulator-balance")
            })
        })
    })
})
