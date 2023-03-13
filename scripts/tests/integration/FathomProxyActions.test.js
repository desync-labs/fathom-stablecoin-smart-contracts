const { BigNumber } = require("ethers");
const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);


const { WeiPerRay, WeiPerWad } = require("../helper/unit");
const TimeHelpers = require("../helper/time");
const AssertHelpers = require("../helper/assert");
const { createProxyWallets } = require("../helper/proxy-wallets");
const { AliceAddress, DevAddress } = require("../helper/address");
const PositionHelper = require("../helper/positions");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");

    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

    ({
        proxyWallets: [aliceProxyWallet],
    } = await createProxyWallets([AliceAddress]));

    await stabilityFeeCollector.setSystemDebtEngine(DevAddress)

    await fathomStablecoin.approve(aliceProxyWallet.address, WeiPerWad.mul(10000), { from: AliceAddress })

    return {
        bookKeeper,
        stablecoinAdapter,
        positionManager,
        stabilityFeeCollector,
        simplePriceFeed,
        collateralPoolConfig,
        aliceProxyWallet
    }
}

describe("Position Closure without collateral withdrawl", () => {
    // Proxy wallet
    let aliceProxyWallet

    // Contract
    let positionManager
    let bookKeeper
    // let tokenAdapter
    let stablecoinAdapter
    let stabilityFeeCollector
    let collateralPoolConfig
    let simplePriceFeed

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            bookKeeper,
            stablecoinAdapter,
            positionManager,
            // tokenAdapter,
            stabilityFeeCollector,
            simplePriceFeed,
            collateralPoolConfig,
            aliceProxyWallet
        } = await loadFixture(setup));
    })

    describe("#wipeAndUnlockXDC", () => {
        context("open position and pay back debt without collateral withdrawl", () => {
            it("should be success", async () => {
                await simplePriceFeed.setPrice(WeiPerRay, { gasLimit: 1000000 })

                // position 1
                //  a. open a new position
                //  b. lock WXDC
                //  c. mint FUSD
                await PositionHelper.openXDCPositionAndDraw(aliceProxyWallet, AliceAddress, pools.XDC, WeiPerWad.mul(10), WeiPerWad.mul(5))
                const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address)
                const positionAddress = await positionManager.positions(positionId)

                //  a. repay 2 WAD of FXD
                //  b. alice doesn't unlock any XDC
                //  c. check if the position has the same amount of lockedCollateral
                //  d. check if the position has now debtShare of 3 WAD (5-2)
                await PositionHelper.wipeAndUnlockXDC(
                    aliceProxyWallet,
                    AliceAddress,
                    positionId,
                    0,
                    WeiPerWad.mul(2)
                )

                const [lockedCollateral, debtShare] = await bookKeeper.positions(
                    pools.XDC,
                    positionAddress
                )
                    console.log(lockedCollateral);
                // expect(lockedCollateral).to.be.equal(BigNumber.from("10000000000000000000"));
                expect(lockedCollateral).to.be.equal(WeiPerWad.mul(10));

                // expect(debtShare).to.be.equal(WeiPerWad.mul(2));
            })
        })
    })
})
