const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");

const { expect } = chai

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const adminControls = await getProxy(proxyFactory, "AdminControls");
    const liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
    const positionManager = await getProxy(proxyFactory, "PositionManager");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
    const priceOracle = await getProxy(proxyFactory, "PriceOracle");
    // To be sunsetted on xdc mainnet, then to be deprecated
    // const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");

    return {
        adminControls,
        bookKeeper,
        liquidationEngine,
        systemDebtEngine,
        priceOracle,
        stablecoinAdapter,
        positionManager,
        // stableSwapModule,
        flashMintModule
    }
}

describe("AdminControls", () => {
    // Contract
    let adminControls
    let positionManager
    let bookKeeper
    let liquidationEngine
    let systemDebtEngine
    let priceOracle
    let stablecoinAdapter
    // let stableSwapModule
    let flashMintModule

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            adminControls,
            bookKeeper,
            liquidationEngine,
            systemDebtEngine,
            priceOracle,
            stablecoinAdapter,
            positionManager,
            // stableSwapModule,
            flashMintModule
        } = await loadFixture(setup));
    })

    describe("#pause", () => {
        context("pause protocol", () => {
            it("protocol contracts should be paused", async () => {
                await adminControls.pauseProtocol()
                
                expect(await bookKeeper.paused()).to.be.equal(true)
                expect(await liquidationEngine.paused()).to.be.equal(true)
                expect(await positionManager.paused()).to.be.equal(true)
                expect(await systemDebtEngine.paused()).to.be.equal(true)
                expect(await stablecoinAdapter.paused()).to.be.equal(true)
                expect(await priceOracle.paused()).to.be.equal(true)
                expect(await flashMintModule.paused()).to.be.equal(true)
            })
        })
    })
    describe("#unpause", () => {
        context("unpause protocol", () => {
            it("protocol contracts should be unpaused", async () => {
                await adminControls.pauseProtocol()

                await adminControls.unpauseProtocol()
                
                expect(await bookKeeper.paused()).to.be.equal(false)
                expect(await liquidationEngine.paused()).to.be.equal(false)
                expect(await positionManager.paused()).to.be.equal(false)
                expect(await systemDebtEngine.paused()).to.be.equal(false)
                expect(await stablecoinAdapter.paused()).to.be.equal(false)
                expect(await priceOracle.paused()).to.be.equal(false)
                expect(await flashMintModule.paused()).to.be.equal(false)
            })
        })
    })
})
