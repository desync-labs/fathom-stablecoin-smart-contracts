const { ethers } = require("hardhat");
const { expect } = require("chai");

const { getProxy } = require("../../common/proxies");

describe("AdminControls", () => {
  // Contract
  let adminControls;
  let positionManager;
  let bookKeeper;
  let liquidationEngine;
  let systemDebtEngine;
  let priceOracle;
  let stablecoinAdapter;
  // let stableSwapModule
  let flashMintModule;

  beforeEach(async () => {
    await deployments.fixture(["DeployTestFixture"]);

    const ProxyFactory = await deployments.get("FathomProxyFactory");
    const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

    adminControls = await getProxy(proxyFactory, "AdminControls");
    liquidationEngine = await getProxy(proxyFactory, "LiquidationEngine");
    positionManager = await getProxy(proxyFactory, "PositionManager");
    stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
    priceOracle = await getProxy(proxyFactory, "PriceOracle");
    // To be sunsetted on xdc mainnet, then to be deprecated
    // const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
    bookKeeper = await getProxy(proxyFactory, "BookKeeper");
  });

  describe("#pause", () => {
    context("pause protocol", () => {
      it("protocol contracts should be paused", async () => {
        await adminControls.pauseProtocol();

        expect(await bookKeeper.paused()).to.be.equal(true);
        expect(await liquidationEngine.paused()).to.be.equal(true);
        expect(await positionManager.paused()).to.be.equal(true);
        expect(await systemDebtEngine.paused()).to.be.equal(true);
        expect(await stablecoinAdapter.paused()).to.be.equal(true);
        expect(await priceOracle.paused()).to.be.equal(true);
        expect(await flashMintModule.paused()).to.be.equal(true);
      });
    });
  });
  describe("#unpause", () => {
    context("unpause protocol", () => {
      it("protocol contracts should be unpaused", async () => {
        await adminControls.pauseProtocol();

        await adminControls.unpauseProtocol();

        expect(await bookKeeper.paused()).to.be.equal(false);
        expect(await liquidationEngine.paused()).to.be.equal(false);
        expect(await positionManager.paused()).to.be.equal(false);
        expect(await systemDebtEngine.paused()).to.be.equal(false);
        expect(await stablecoinAdapter.paused()).to.be.equal(false);
        expect(await priceOracle.paused()).to.be.equal(false);
        expect(await flashMintModule.paused()).to.be.equal(false);
      });
    });
  });
});
