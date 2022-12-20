const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const TimeHelpers = require("../helper/time");
const AssertHelpers = require("../helper/assert");
const { createProxyWallets } = require("../helper/proxy");
const { DeployerAddress, AliceAddress, BobAddress, AddressZero } = require("../helper/address");
const PositionHelper = require("../helper/positions");
const { parseEther, parseUnits, defaultAbiCoder, formatBytes32String } = require("ethers/lib/utils");
const { loadFixture } = require("../helper/fixtures");
const { initializeContracts } = require("../helper/initializer");
const { addRoles } = require("../helper/access-roles");

const { expect } = chai

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)
const TREASURY_FEE_BPS = BigNumber.from(5000)
const BPS = BigNumber.from(10000)

const setup = async () => {
    const collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
    const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");
    const bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
    const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");
    const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");
    const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.getAdapter(COLLATERAL_POOL_ID)
    const collateralTokenAdapter = await artifacts.initializeInterfaceAt("CollateralTokenAdapter", collateralTokenAdapterAddress);
    const wxdcAddr = await collateralTokenAdapter.collateralToken();
    const WXDC = await artifacts.initializeInterfaceAt("ERC20Mintable", wxdcAddr);
    const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
    const fathomToken = await artifacts.initializeInterfaceAt("FathomToken", "FathomToken");
    const fixedSpreadLiquidationStrategy = await artifacts.initializeInterfaceAt("FixedSpreadLiquidationStrategy", "FixedSpreadLiquidationStrategy");
    const liquidationEngine = await artifacts.initializeInterfaceAt("LiquidationEngine", "LiquidationEngine");
    const systemDebtEngine = await artifacts.initializeInterfaceAt("SystemDebtEngine", "SystemDebtEngine");

    await initializeContracts();
    await addRoles();

    ({
        proxyWallets: [aliceProxyWallet],
    } = await createProxyWallets([AliceAddress, BobAddress]));

    await collateralPoolConfig.initCollateralPool(
        COLLATERAL_POOL_ID,
        0,
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
    await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, WeiPerRad.mul(10000000), { gasLimit: 1000000 })
    await simplePriceFeed.setPrice(WeiPerWad, { gasLimit: 1000000 });
    await liquidationEngine.whitelist(BobAddress, { gasLimit: 1000000 });

    await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, fixedSpreadLiquidationStrategy.address, { gasLimit: 1000000 })

    return {
        bookKeeper,
        collateralPoolConfig,
        positionManager,
        WXDC,
        simplePriceFeed,
        aliceProxyWallet,
        stabilityFeeCollector,
        fathomToken,
        liquidationEngine,
        systemDebtEngine,
        fathomStablecoin,
        fixedSpreadLiquidationStrategy
    }
}


describe("LiquidationEngine", () => {
    // Contracts
    let aliceProxyWallet

    let bookKeeper
    let WXDC
    let fathomToken
    let positionManager
    let stabilityFeeCollector
    let liquidationEngine
    let fixedSpreadLiquidationStrategy
    let fathomStablecoin
    let simplePriceFeed
    let systemDebtEngine
    let collateralPoolConfig

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            bookKeeper,
            collateralPoolConfig,
            positionManager,
            WXDC,
            simplePriceFeed,
            aliceProxyWallet,
            stabilityFeeCollector,
            fathomToken,
            liquidationEngine,
            systemDebtEngine,
            fathomStablecoin,
            fixedSpreadLiquidationStrategy
        } = await loadFixture(setup));
    })

    describe("#liquidate", async () => {
        context("price drop but does not make the position underwater", async () => {
            it("should revert", async () => {
                // 1. Set price for WXDC to 2 USD
                await simplePriceFeed.setPrice(WeiPerRay.mul(2), { gasLimit: 1000000 });

                await WXDC.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })

                // 2. Alice open a new position with 1 WXDC and draw 1 FUSD
                await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad, WeiPerWad);
                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(AliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

                expect(
                    alicePosition.lockedCollateral,
                    "lockedCollateral should be 1 WXDC, because Alice locked 1 WXDC"
                ).to.be.equal(WeiPerWad)
                expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(WeiPerWad)
                expect(
                    await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                    "collateralToken inside Alice's position address should be 0 WXDC, because Alice locked all WXDC into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)

                // 3. WXDC price drop to 1 USD
                await simplePriceFeed.setPrice(WeiPerRay, { gasLimit: 1000000 });
                // await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay, { gasLimit: 1000000 })

                // 3.5 whitelist bob as liquidator
                await liquidationEngine.whitelist(BobAddress);
                // 4. Bob try to liquidate Alice's position but failed due to the price did not drop low enough
                await expect(
                    liquidationEngine.liquidate(COLLATERAL_POOL_ID, alicePositionAddress, 1, 1, AliceAddress, "0x", { from: BobAddress, gasLimit: 1000000 })
                ).to.be.revertedWith("LiquidationEngine/position-is-safe")
            })
        })

        context("safety buffer -0.1%, but liquidator does not have enough FUSD to liquidate", async () => {
            it("should success", async () => {
                // 1. Set priceWithSafetyMargin for WXDC to 2 USD
                await simplePriceFeed.setPrice(WeiPerRay.mul(2), { gasLimit: 1000000 });
                await collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, WeiPerRay, { gasLimit: 1000000 })
                await WXDC.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })

                // 2. Alice open a new position with 1 WXDC and draw 1 FUSD
                await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad, WeiPerWad);

                const alicePositionAddress = await positionManager.positions(1)
                const fathomStablecoinBalance = await fathomStablecoin.balanceOf(AliceAddress)
                const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

                expect(
                    alicePosition.lockedCollateral,
                    "lockedCollateral should be 1 WXDC, because Alice locked 1 WXDC"
                ).to.be.equal(WeiPerWad)
                expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(WeiPerWad)
                expect(
                    await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                    "collateralToken inside Alice's position address should be 0 WXDC, because Alice locked all WXDC into the position"
                ).to.be.equal(0)
                expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(WeiPerWad)
                expect(
                    await fathomToken.balanceOf(aliceProxyWallet.address),
                    "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
                ).to.be.equal(0)

                // 3. WXDC price drop to 0.99 USD
                await simplePriceFeed.setPrice(WeiPerRay.sub(1).div(1e9), { gasLimit: 1000000 })

                // 3.5 whitelist bob as liquidator
                await liquidationEngine.whitelist(BobAddress);

                // 4. Bob liquidate Alice's position up to full close factor successfully
                const debtShareToRepay = parseEther("0.5")
                await bookKeeper.whitelist(liquidationEngine.address, { from: BobAddress, gasLimit: 1000000 })

                await expect(
                    liquidationEngine.liquidate(
                        COLLATERAL_POOL_ID,
                        alicePositionAddress,
                        debtShareToRepay,
                        MaxUint256,
                        BobAddress,
                        defaultAbiCoder.encode(["address", "bytes"], [BobAddress, []]),
                        { from: BobAddress, gasLimit: 1000000 }
                    )
                ).to.be.reverted
            })
        })

        context("main liquidation scenarios", async () => {
            const testParams = [
                {
                    label: "safety buffer -0.18%, position is liquidated up to full close factor",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "285",
                    debtShareToRepay: "1000",
                    expectedDebtValueToRepay: "1000",
                    expectedSeizedCollateral: "3.684210526315790000",
                    expectedDebtShareAfterLiquidation: "1000",
                    expectedSystemBadDebt: "0",
                },
                {
                    label: "safety buffer -0.18%, position is liquidated up to some portion of close factor",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "285",
                    debtShareToRepay: "200",
                    expectedDebtValueToRepay: "200",
                    expectedSeizedCollateral: "0.7368",
                    expectedDebtShareAfterLiquidation: "1800",
                    expectedSystemBadDebt: "0",
                },
                {
                    label: "safety buffer -0.18%, position is liquidated exceeding close factor",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "285",
                    debtShareToRepay: "2000",
                    expectedDebtValueToRepay: "1000",
                    expectedSeizedCollateral: "3.684210526315790000",
                    expectedDebtShareAfterLiquidation: "1000",
                    expectedSystemBadDebt: "0",
                },
                {
                    label: "safety buffer -30%, position is liquidated up to full close factor, bad debt",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "200",
                    debtShareToRepay: "1000",
                    expectedDebtValueToRepay: "1904.761905",
                    expectedSeizedCollateral: "10",
                    expectedDebtShareAfterLiquidation: "0",
                    expectedSystemBadDebt: "95.238095",
                },
                {
                    label: "safety buffer -30%, position is liquidated up to some portion of full close factor, bad debt",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "200",
                    debtShareToRepay: "200",
                    expectedDebtValueToRepay: "1904.761905",
                    expectedSeizedCollateral: "10",
                    expectedDebtShareAfterLiquidation: "0",
                    expectedSystemBadDebt: "95.238095",
                },
                {
                    label: "safety buffer -10%, position collateral is fully liquidated because debt floor",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "1500",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "250",
                    debtShareToRepay: "1000",
                    expectedDebtValueToRepay: "2000",
                    expectedSeizedCollateral: "8.4",
                    expectedDebtShareAfterLiquidation: "0",
                    expectedSystemBadDebt: "0",
                },
                {
                    label:
                        "safety buffer -5.71% with 99% collateral factor, position is liquidated up to full close factor, bad debt",
                    collateralAmount: "2000",
                    collateralFactor: "0.99",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "1975",
                    startingPrice: "1",
                    nextPrice: "0.99",
                    debtShareToRepay: "987.5",
                    expectedDebtValueToRepay: "1885.714286",
                    expectedSeizedCollateral: "2000",
                    expectedDebtShareAfterLiquidation: "0",
                    expectedSystemBadDebt: "89.285714",
                },
                {
                    label:
                        "safety buffer -5.71% with 99% collateral factor, position collateral is fully liquidated because debt floor",
                    collateralAmount: "2000",
                    collateralFactor: "0.9",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "1800",
                    startingPrice: "1",
                    nextPrice: "0.99",
                    debtShareToRepay: "900",
                    expectedDebtValueToRepay: "900",
                    expectedSeizedCollateral: "954.5455",
                    expectedDebtShareAfterLiquidation: "900",
                    expectedSystemBadDebt: "0",
                },
                {
                    label:
                        "safety buffer -7.83% with 99% collateral factor, position is liquidated up to full close factor, bad debt",
                    collateralAmount: "2000",
                    collateralFactor: "0.9",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "1800",
                    startingPrice: "1",
                    nextPrice: "0.92",
                    debtShareToRepay: "900",
                    expectedDebtValueToRepay: "1752.380952",
                    expectedSeizedCollateral: "2000",
                    expectedDebtShareAfterLiquidation: "0",
                    expectedSystemBadDebt: "47.619048",
                },
                {
                    label:
                        "safety buffer -8.90% with 99% collateral factor, position is liquidated up to full close factor, bad debt",
                    collateralAmount: "2000",
                    collateralFactor: "0.9",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "2500",
                    debtFloor: "100",
                    drawStablecoinAmount: "1800",
                    startingPrice: "1",
                    nextPrice: "0.91",
                    debtShareToRepay: "450",
                    expectedDebtValueToRepay: "1733.333333",
                    expectedSeizedCollateral: "2000",
                    expectedDebtShareAfterLiquidation: "0",
                    expectedSystemBadDebt: "66.666667",
                },
                {
                    label:
                        "safety buffer -0.91% with 99% collateral factor, position collateral is fully liquidated because debt floor",
                    collateralAmount: "555.560",
                    collateralFactor: "0.9",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "2500",
                    debtFloor: "500",
                    drawStablecoinAmount: "500",
                    startingPrice: "1",
                    nextPrice: "0.99",
                    debtShareToRepay: "125",
                    expectedDebtValueToRepay: "500",
                    expectedSeizedCollateral: "530.3030303",
                    expectedDebtShareAfterLiquidation: "0",
                    expectedSystemBadDebt: "0",
                },
                {
                    label: "safety buffer -0.91% with 99% collateral factor, position is liquidated up to full close factor",
                    collateralAmount: "555.560",
                    collateralFactor: "0.9",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "2500",
                    debtFloor: "100",
                    drawStablecoinAmount: "500",
                    startingPrice: "1",
                    nextPrice: "0.99",
                    debtShareToRepay: "125",
                    expectedDebtValueToRepay: "125",
                    expectedSeizedCollateral: "132.5758",
                    expectedDebtShareAfterLiquidation: "375.00",
                    expectedSystemBadDebt: "0",
                },
            ]
            for (let i = 0; i < testParams.length; i++) {
                const testParam = testParams[i]
                it(testParam.label, async () => {
                    await WXDC.mint(AliceAddress, parseEther(testParam.collateralAmount), { gasLimit: 3000000 })
                    await collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, testParam.liquidatorIncentiveBps)
                    await collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, testParam.closeFactorBps)
                    await simplePriceFeed.setPrice(parseUnits(testParam.startingPrice, 18), { gasLimit: 3000000 })
                    let ratio = WeiPerRay.mul(1000).div(parseUnits(testParam.collateralFactor, 3))
                    await collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, ratio, { gasLimit: 3000000 })
                    await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, parseUnits(testParam.debtFloor, 45), { gasLimit: 1000000 })

                    // 2. Alice open a new position with 1 WXDC and draw 1 FUSD
                    const lockedCollateralAmount = parseEther(testParam.collateralAmount)
                    const drawStablecoinAmount = parseEther(testParam.drawStablecoinAmount)
                    await WXDC.approve(aliceProxyWallet.address, lockedCollateralAmount, { from: AliceAddress })

                    await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, lockedCollateralAmount, drawStablecoinAmount);
                    const alicePositionAddress = await positionManager.positions(1)
                    const fathomStablecoinBalance = await fathomStablecoin.balanceOf(AliceAddress)
                    const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                    expect(
                        alicePosition.lockedCollateral,
                        "lockedCollateral should be 1 WXDC, because Alice locked 1 WXDC"
                    ).to.be.equal(lockedCollateralAmount)
                    expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                        drawStablecoinAmount
                    )
                    expect(
                        await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                        "collateralToken inside Alice's position address should be 0 WXDC, because Alice locked all WXDC into the position"
                    ).to.be.equal(0)
                    expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                        drawStablecoinAmount
                    )
                    expect(
                        await fathomToken.balanceOf(aliceProxyWallet.address),
                        "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
                    ).to.be.equal(0)

                    // 3. WXDC price drop to 0.99 USD
                    await simplePriceFeed.setPrice(parseUnits(testParam.nextPrice, 18), { gasLimit: 3000000 })

                    // 3.5 whitelist bob as liquidator
                    await liquidationEngine.whitelist(BobAddress);

                    // 4. Bob liquidate Alice's position up to full close factor successfully
                    const debtShareToRepay = parseEther(testParam.debtShareToRepay)
                    await bookKeeper.whitelist(liquidationEngine.address, { from: BobAddress, gasLimit: 3000000 })
                    await bookKeeper.whitelist(fixedSpreadLiquidationStrategy.address, { from: BobAddress, gasLimit: 3000000 })
                    await bookKeeper.mintUnbackedStablecoin(
                        DeployerAddress,
                        BobAddress,
                        parseUnits(testParam.debtShareToRepay, 46),
                        { gasLimit: 3000000 }
                    )
                    const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(BobAddress)
                    await liquidationEngine.liquidate(
                        COLLATERAL_POOL_ID,
                        alicePositionAddress,
                        debtShareToRepay,
                        MaxUint256,
                        BobAddress,
                        "0x",
                        { from: BobAddress, gasLimit: 3000000 }
                    )

                    // 5. Settle system bad debt
                    await systemDebtEngine.settleSystemBadDebt(await bookKeeper.stablecoin(systemDebtEngine.address), { gasLimit: 1000000 })

                    const bobStablecoinAfterLiquidation = await bookKeeper.stablecoin(BobAddress)

                    const alicePositionAfterLiquidation = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                    const expectedSeizedCollateral = parseUnits(testParam.expectedSeizedCollateral, 18)
                    const expectedLiquidatorIncentive = expectedSeizedCollateral.sub(
                        expectedSeizedCollateral.mul(BPS).div(testParam.liquidatorIncentiveBps)
                    )
                    const expectedTreasuryFee = expectedLiquidatorIncentive.mul(testParam.treasuryFeeBps).div(BPS)
                    const expectedCollateralBobShouldReceive = expectedSeizedCollateral.sub(expectedTreasuryFee)

                    AssertHelpers.assertAlmostEqual(
                        alicePosition.lockedCollateral.sub(alicePositionAfterLiquidation.lockedCollateral).toString(),
                        expectedSeizedCollateral.toString()
                    )
                    expect(alicePositionAfterLiquidation.debtShare).to.be.eq(
                        parseUnits(testParam.expectedDebtShareAfterLiquidation, 18)
                    )
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.systemBadDebt(systemDebtEngine.address)).toString(),
                        parseUnits(testParam.expectedSystemBadDebt, 45).toString()
                    )
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)).toString(),
                        expectedCollateralBobShouldReceive.toString()
                    )
                    AssertHelpers.assertAlmostEqual(
                        bobStablecoinBeforeLiquidation.sub(bobStablecoinAfterLiquidation).toString(),
                        parseUnits(testParam.expectedDebtValueToRepay, 45).toString()
                    )
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, systemDebtEngine.address)).toString(),
                        expectedTreasuryFee.toString()
                    )
                    expect(
                        await fathomToken.balanceOf(aliceProxyWallet.address),
                        "Alice's proxy wallet should have more than 0 FATHOM, because the liquidation process will distribute the pending FATHOM rewards to the position owner"
                    ).to.not.equal(0)
                })
            }
        })

        context("1st liquidation keep position unsafe, 2nd position fully liquidate the position", async () => {
            it("should success", async () => {
                const testParam = {
                    label: "safety buffer -0.18%, position is liquidated up to full close factor",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "250",
                    debtShareToRepay: "200",
                    expectedDebtValueToRepay: "200",
                    expectedSeizedCollateral: "0.84",
                    expectedDebtShareAfterLiquidation: "1800",
                    expectedSystemBadDebt: "0",
                }
                it(testParam.label, async () => {
                    await WXDC.mint(AliceAddress, parseEther(testParam.collateralAmount), { gasLimit: 1000000 })
                    await collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, testParam.liquidatorIncentiveBps)
                    await collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, testParam.closeFactorBps)
                    await simplePriceFeed.setPrice(parseUnits(testParam.startingPrice, 18), { gasLimit: 1000000 })
                    let ratio = WeiPerRay.mul(1000).div(parseUnits(testParam.collateralFactor, 3))
                    await collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, ratio, { gasLimit: 1000000 })
                    await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, parseUnits(testParam.debtFloor, 45), { gasLimit: 1000000 })

                    // 2. Alice open a new position with 1 WXDC and draw 1 FUSD
                    const lockedCollateralAmount = parseEther(testParam.collateralAmount)
                    const drawStablecoinAmount = parseEther(testParam.drawStablecoinAmount)
                    await WXDC.approve(aliceProxyWallet.address, lockedCollateralAmount, { from: AliceAddress })
                    await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, lockedCollateralAmount, drawStablecoinAmount);
                    const alicePositionAddress = await positionManager.positions(1)
                    const fathomStablecoinBalance = await fathomStablecoin.balanceOf(AliceAddress)
                    const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                    expect(
                        alicePosition.lockedCollateral,
                        "lockedCollateral should be 1 WXDC, because Alice locked 1 WXDC"
                    ).to.be.equal(lockedCollateralAmount)
                    expect(alicePosition.debtShare, "debtShare should be 1 FUSD, because Alice drew 1 FUSD").to.be.equal(
                        drawStablecoinAmount
                    )
                    expect(
                        await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                        "collateralToken inside Alice's position address should be 0 WXDC, because Alice locked all WXDC into the position"
                    ).to.be.equal(0)
                    expect(fathomStablecoinBalance, "Alice should receive 1 FUSD from drawing 1 FUSD").to.be.equal(
                        drawStablecoinAmount
                    )
                    expect(
                        await fathomToken.balanceOf(aliceProxyWallet.address),
                        "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
                    ).to.be.equal(0)

                    // 3. WXDC price drop to 0.99 USD
                    await simplePriceFeed.setPrice(parseUnits(testParam.nextPrice, 18), { gasLimit: 1000000 })

                    // 3.5 whitelist bob as liquidator
                    await liquidationEngine.whitelist(BobAddress);

                    // 4. Bob liquidate Alice's position up to full close factor successfully
                    const debtShareToRepay = parseEther(testParam.debtShareToRepay)
                    await bookKeeper.whitelist(liquidationEngine.address, { from: BobAddress, gasLimit: 1000000 })
                    await bookKeeper.whitelist(fixedSpreadLiquidationStrategy.address, { from: BobAddress, gasLimit: 1000000 })
                    await bookKeeper.mintUnbackedStablecoin(
                        DeployerAddress,
                        BobAddress,
                        parseUnits(testParam.debtShareToRepay, 46),
                        { gasLimit: 1000000 }
                    )
                    const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(BobAddress)
                    await liquidationEngine.liquidate(
                        COLLATERAL_POOL_ID,
                        alicePositionAddress,
                        debtShareToRepay,
                        MaxUint256,
                        BobAddress,
                        "0x",
                        { from: BobAddress, gasLimit: 1000000 }
                    )

                    // 5. Settle system bad debt
                    await systemDebtEngine.settleSystemBadDebt(await bookKeeper.stablecoin(systemDebtEngine.address), { gasLimit: 1000000 })

                    const bobStablecoinAfterLiquidation = await bookKeeper.stablecoin(BobAddress)

                    const alicePositionAfterLiquidation = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                    const expectedSeizedCollateral = parseUnits(testParam.expectedSeizedCollateral, 18)
                    const expectedLiquidatorIncentive = expectedSeizedCollateral.sub(
                        expectedSeizedCollateral.mul(BPS).div(testParam.liquidatorIncentiveBps)
                    )
                    const expectedTreasuryFee = expectedLiquidatorIncentive.mul(testParam.treasuryFeeBps).div(BPS)
                    const expectedCollateralBobShouldReceive = expectedSeizedCollateral.sub(expectedTreasuryFee)

                    AssertHelpers.assertAlmostEqual(
                        alicePosition.lockedCollateral.sub(alicePositionAfterLiquidation.lockedCollateral).toString(),
                        expectedSeizedCollateral.toString()
                    )
                    expect(alicePositionAfterLiquidation.debtShare).to.be.eq(
                        parseUnits(testParam.expectedDebtShareAfterLiquidation, 18)
                    )
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.systemBadDebt(systemDebtEngine.address)).toString(),
                        parseUnits(testParam.expectedSystemBadDebt, 45).toString()
                    )
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)).toString(),
                        expectedCollateralBobShouldReceive.toString()
                    )
                    AssertHelpers.assertAlmostEqual(
                        bobStablecoinBeforeLiquidation.sub(bobStablecoinAfterLiquidation).toString(),
                        parseUnits(testParam.expectedDebtValueToRepay, 45).toString()
                    )
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, systemDebtEngine.address)).toString(),
                        expectedTreasuryFee.toString()
                    )
                    expect(
                        await fathomToken.balanceOf(aliceProxyWallet.address),
                        "Alice's proxy wallet should have more than 0 FATHOM, because the liquidation process will distribute the pending FATHOM rewards to the position owner"
                    ).to.not.equal(0)

                    // Second Liquidation
                    await liquidationEngine.liquidate(
                        COLLATERAL_POOL_ID,
                        alicePositionAddress,
                        MaxUint256,
                        MaxUint256,
                        BobAddress,
                        "0x",
                        { from: BobAddress, gasLimit: 1000000 }
                    )
                    const alicePositionAfterLiquidation2 = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                    expect(alicePositionAfterLiquidation2.lockedCollateral).to.be.eq(parseEther("4.62"))
                    expect(alicePositionAfterLiquidation2.debtShare).to.be.eq(parseEther("900"))
                })
            })
        })

        context(
            "safety buffer -20%, position is liquidated up to full close factor with some interest and debt floor",
            async () => {
                it("should success", async () => {
                    // 0 whitelist bob as liquidator
                    await liquidationEngine.whitelist(BobAddress);

                    // 1. Set priceWithSafetyMargin for WXDC to 420 USD
                    await simplePriceFeed.setPrice(parseUnits("367", 18), { gasLimit: 1000000 })
                    let ratio = WeiPerRay.mul(1000).div(parseUnits("0.8", 3))
                    await collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, ratio, { gasLimit: 1000000 })
                    //   await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, parseUnits("294", 27), { gasLimit: 1000000 })
                    await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, parseEther("100").mul(WeiPerRay), { gasLimit: 1000000 })

                    // 2. Alice open a new position with 10 WXDC and draw 2000 FUSD
                    const lockedCollateralAmount = parseEther("10")
                    const drawStablecoinAmount = parseEther("2000")

                    await WXDC.approve(aliceProxyWallet.address, lockedCollateralAmount, { from: AliceAddress })
                    await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, lockedCollateralAmount, drawStablecoinAmount);

                    // Set stability fee rate to 0.5% APR
                    await collateralPoolConfig.setStabilityFeeRate(
                        COLLATERAL_POOL_ID,
                        BigNumber.from("1000000000158153903837946258"),
                        { gasLimit: 1000000 }
                    )

                    const alicePositionAddress = await positionManager.positions(1)
                    const fathomStablecoinBalance = await fathomStablecoin.balanceOf(AliceAddress)
                    const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

                    expect(
                        alicePosition.lockedCollateral,
                        "lockedCollateral should be 10 WXDC, because Alice locked 10 WXDC"
                    ).to.be.equal(parseEther("10"))
                    expect(alicePosition.debtShare, "debtShare should be 2000 FUSD, because Alice drew 2000 FUSD").to.be.equal(
                        parseEther("2000")
                    )
                    expect(
                        await bookKeeper.collateralToken(COLLATERAL_POOL_ID, alicePositionAddress),
                        "collateralToken inside Alice's position address should be 0 WXDC, because Alice locked all WXDC into the position"
                    ).to.be.equal(0)
                    expect(fathomStablecoinBalance, "Alice should receive 2000 FUSD from drawing 2000 FUSD").to.be.equal(
                        parseEther("2000")
                    )
                    expect(
                        await fathomToken.balanceOf(aliceProxyWallet.address),
                        "Alice's proxy wallet should have 0 FATHOM, as Alice has not harvest any rewards from her position"
                    ).to.be.equal(0)

                    // 3. 1 year passed, WXDC price drop to 285 USD
                    await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from("31536000")))
                    await stabilityFeeCollector.collect(COLLATERAL_POOL_ID, { gasLimit: 1000000 })
                    const aliceDebtValueAfterOneYear = (
                        await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)
                    ).debtShare.mul((await collateralPoolConfig.collateralPools(COLLATERAL_POOL_ID)).debtAccumulatedRate)
                    AssertHelpers.assertAlmostEqual(
                        aliceDebtValueAfterOneYear.toString(),
                        parseEther("2010").mul(WeiPerRay).toString()
                    )
                    //   await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, parseUnits("199.5", 27), { gasLimit: 1000000 })
                    await simplePriceFeed.setPrice(parseEther("249.37"), { gasLimit: 1000000 })



                    // 4. Bob liquidate Alice's position up to full close factor successfully
                    const debtShareToRepay = parseEther("1000")
                    await bookKeeper.whitelist(liquidationEngine.address, { from: BobAddress, gasLimit: 1000000 })
                    await bookKeeper.whitelist(fixedSpreadLiquidationStrategy.address, { from: BobAddress, gasLimit: 1000000 })
                    await bookKeeper.mintUnbackedStablecoin(DeployerAddress, BobAddress, parseUnits("3000", 45), { gasLimit: 1000000 })
                    const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(BobAddress)
                    await liquidationEngine.liquidate(
                        COLLATERAL_POOL_ID,
                        alicePositionAddress,
                        debtShareToRepay,
                        MaxUint256,
                        BobAddress,
                        defaultAbiCoder.encode(["address", "bytes"], [BobAddress, []]),
                        { from: BobAddress, gasLimit: 2000000 }
                    )

                    // // 5. Settle system bad debt
                    await systemDebtEngine.settleSystemBadDebt(await bookKeeper.systemBadDebt(systemDebtEngine.address), { gasLimit: 1000000 })
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.stablecoin(systemDebtEngine.address)).toString(),
                        parseEther("10").mul(WeiPerRay).toString()
                    ) // There should be 10 FUSD left in SystemDebtEngine collected from stability fee after `settleSystemBadDebt`

                    const bobStablecoinAfterLiquidation = await bookKeeper.stablecoin(BobAddress)

                    const alicePositionAfterLiquidation = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress)

                    AssertHelpers.assertAlmostEqual(
                        alicePositionAfterLiquidation.lockedCollateral.toString(),
                        parseEther("5.768").toString()
                    )
                    expect(
                        alicePositionAfterLiquidation.debtShare,
                        "debtShare should be 1000 FUSD, because Bob liquidated 1000 FUSD from Alice's position"
                    )
                        .to.be.equal(alicePosition.debtShare.sub(debtShareToRepay))
                        .to.be.equal(parseEther("1000"))
                    expect(
                        await bookKeeper.systemBadDebt(systemDebtEngine.address),
                        "System bad debt should be 0 FUSD"
                    ).to.be.equal(0)
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)).toString(),
                        parseEther("4.1309099").toString()
                    )
                    AssertHelpers.assertAlmostEqual(
                        bobStablecoinBeforeLiquidation.sub(bobStablecoinAfterLiquidation).toString(),
                        parseEther("1005").mul(WeiPerRay).toString()
                    ) // Bob should pay 1005 FUSD for this liquidation
                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, systemDebtEngine.address)).toString(),
                        parseEther("0.1007539").toString()
                    )
                    expect(
                        await fathomToken.balanceOf(aliceProxyWallet.address),
                        "Alice's proxy wallet should have more than 0 FATHOM, because the liquidation process will distribute the pending FATHOM rewards to the position owner"
                    ).to.not.equal(0)
                })
            }
        )

        context("batch liquidation", async () => {
            const testParams = [
                {
                    label: "safety buffer -0.18%, position is liquidated up to full close factor",
                    collateralAmount: "10",
                    collateralFactor: "0.7",
                    liquidatorIncentiveBps: "10500",
                    treasuryFeeBps: "5000",
                    closeFactorBps: "5000",
                    debtFloor: "100",
                    drawStablecoinAmount: "2000",
                    startingPrice: "420",
                    nextPrice: "285",
                    debtShareToRepay: "1000",
                    expectedDebtValueToRepay: "1000",
                    expectedSeizedCollateral: "3.684210526315790000",
                    expectedDebtShareAfterLiquidation: "1000",
                    expectedSystemBadDebt: "0",
                },
            ]
                const testParam = testParams[0];
                it(testParam.label, async () => {
                    await WXDC.mint(AliceAddress, parseEther(testParam.collateralAmount), { gasLimit: 1000000 })
                    await WXDC.mint(AliceAddress, parseEther(testParam.collateralAmount), { gasLimit: 1000000 })

                    await collateralPoolConfig.setLiquidatorIncentiveBps(COLLATERAL_POOL_ID, testParam.liquidatorIncentiveBps)
                    await collateralPoolConfig.setCloseFactorBps(COLLATERAL_POOL_ID, testParam.closeFactorBps)
                    await simplePriceFeed.setPrice(parseUnits(testParam.startingPrice, 18), { gasLimit: 1000000 })
                    let ratio = WeiPerRay.mul(1000).div(parseUnits(testParam.collateralFactor, 3))
                    await collateralPoolConfig.setLiquidationRatio(COLLATERAL_POOL_ID, ratio, { gasLimit: 1000000 })
                    await collateralPoolConfig.setDebtFloor(COLLATERAL_POOL_ID, parseUnits(testParam.debtFloor, 45), { gasLimit: 1000000 })

                    // 2. Alice open a new position with 1 WXDC and draw 1 FUSD
                    const lockedCollateralAmount = parseEther(testParam.collateralAmount)
                    const drawStablecoinAmount = parseEther(testParam.drawStablecoinAmount)
                    await WXDC.approve(aliceProxyWallet.address, parseEther("20"), { from: AliceAddress })
                    // await WXDC.approve(aliceProxyWallet.address, lockedCollateralAmount, { from: AliceAddress })

                    await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, lockedCollateralAmount, drawStablecoinAmount);
                    await PositionHelper.openPositionAndDraw(aliceProxyWallet, AliceAddress, COLLATERAL_POOL_ID, lockedCollateralAmount, drawStablecoinAmount);

                    const alicePositionAddress1 = await positionManager.positions(1)
                    const alicePositionAddress2 = await positionManager.positions(2)

                    const fathomStablecoinBalance = await fathomStablecoin.balanceOf(AliceAddress)
                    const alicePosition = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress1)


                    // 3. WXDC price drop to 0.99 USD
                    await simplePriceFeed.setPrice(parseUnits(testParam.nextPrice, 18), { gasLimit: 1000000 })

                    // 3.5 whitelist bob as liquidator
                    await liquidationEngine.whitelist(BobAddress);

                    // 4. Bob liquidate Alice's position up to full close factor successfully
                    const debtShareToRepay = parseEther(testParam.debtShareToRepay)

                    await bookKeeper.whitelist(liquidationEngine.address, { from: BobAddress, gasLimit: 1000000 })
                    await bookKeeper.whitelist(fixedSpreadLiquidationStrategy.address, { from: BobAddress, gasLimit: 1000000 })
                    await bookKeeper.mintUnbackedStablecoin(
                        DeployerAddress,
                        BobAddress,
                        parseUnits("2000", 46),
                        { gasLimit: 1000000 }
                    )

                    const bobStablecoinBeforeLiquidation = await bookKeeper.stablecoin(BobAddress)

                    await liquidationEngine.batchLiquidate(
                        [COLLATERAL_POOL_ID, COLLATERAL_POOL_ID],
                        [alicePositionAddress1, alicePositionAddress2],
                        [debtShareToRepay, debtShareToRepay],
                        [MaxUint256, MaxUint256],
                        [BobAddress, BobAddress],
                        ["0x00", "0x00"],
                        { from: BobAddress, gasLimit: 4000000 }
                    )

                    // 5. Settle system bad debt
                    await systemDebtEngine.settleSystemBadDebt(await bookKeeper.stablecoin(systemDebtEngine.address), { gasLimit: 1000000 })

                    const bobStablecoinAfterLiquidation = await bookKeeper.stablecoin(BobAddress)

                    const alicePositionAfterLiquidation = await bookKeeper.positions(COLLATERAL_POOL_ID, alicePositionAddress1)
                    const expectedSeizedCollateral = parseUnits(testParam.expectedSeizedCollateral, 18)
                    const expectedLiquidatorIncentive = expectedSeizedCollateral.sub(
                        expectedSeizedCollateral.mul(BPS).div(testParam.liquidatorIncentiveBps)
                    )
                    const expectedTreasuryFee = expectedLiquidatorIncentive.mul(testParam.treasuryFeeBps).div(BPS)
                    const expectedCollateralBobShouldReceive = expectedSeizedCollateral.sub(expectedTreasuryFee).mul(2)

                    AssertHelpers.assertAlmostEqual(
                        alicePosition.lockedCollateral.sub(alicePositionAfterLiquidation.lockedCollateral).toString(),
                        expectedSeizedCollateral.toString()
                    )

                    expect(alicePositionAfterLiquidation.debtShare).to.be.eq(
                        parseUnits(testParam.expectedDebtShareAfterLiquidation, 18)
                    )

                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.systemBadDebt(systemDebtEngine.address)).toString(),
                        parseUnits(testParam.expectedSystemBadDebt, 45).toString()
                    )

                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress)).toString(),
                        expectedCollateralBobShouldReceive.toString()
                    )

                    AssertHelpers.assertAlmostEqual(
                        bobStablecoinBeforeLiquidation.sub(bobStablecoinAfterLiquidation).toString(),
                        // parseUnits(testParam.expectedDebtValueToRepay, 45).toString()
                        parseUnits((Number.parseInt(testParam.expectedDebtValueToRepay) * 2).toString(), 45).toString()
                        
                    )

                    AssertHelpers.assertAlmostEqual(
                        (await bookKeeper.collateralToken(COLLATERAL_POOL_ID, systemDebtEngine.address)).toString(),
                        expectedTreasuryFee.mul(2).toString()
                    )

                    expect(
                        await fathomToken.balanceOf(aliceProxyWallet.address),
                        "Alice's proxy wallet should have more than 0 FATHOM, because the liquidation process will distribute the pending FATHOM rewards to the position owner"
                    ).to.not.equal(0)
                })
        })
    })
})
