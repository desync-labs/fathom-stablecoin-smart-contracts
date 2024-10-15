const { ethers } = require("hardhat");
const provider = ethers.provider;
const { expect } = require("chai");

const { WeiPerRay, WeiPerWad } = require("../helper/unit");
const AssertHelpers = require("../helper/assert");
const { createProxyWallets } = require("../helper/proxy-wallets");
const { AliceAddress, DevAddress } = require("../helper/address");
const PositionHelper = require("../helper/positions");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");

describe("Position Closure without collateral withdrawal", () => {
  // Proxy wallet
  let aliceProxyWallet;

  // Contract
  let positionManager;
  let bookKeeper;
  let simplePriceFeed;
  let fathomStablecoin;

  let reentrancyAttacker;
  let reentrancyAttacker2;
  let reEntrantProxyWallet;
  let reEntrantProxyWallet2;

  beforeEach(async () => {
    await deployments.fixture(["DeployTestFixture"]);

    const ProxyFactory = await deployments.get("FathomProxyFactory");
    const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
    const SimplePriceFeed = await deployments.get("SimplePriceFeed");
    simplePriceFeed = await ethers.getContractAt("SimplePriceFeed", SimplePriceFeed.address);

    bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
    positionManager = await getProxy(proxyFactory, "PositionManager");
    fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
    const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
    proxyWalletRegistry.setDecentralizedMode(true);

    ({
      proxyWallets: [aliceProxyWallet],
    } = await createProxyWallets([AliceAddress]));

    const ReentrancyAttacker = await deployments.get("ReentrancyAttacker");
    reentrancyAttacker = await ethers.getContractAt("ReentrancyAttacker", ReentrancyAttacker.address);
    const ReentrancyAttacker2 = await deployments.get("ReentrancyAttacker2");
    reentrancyAttacker2 = await ethers.getContractAt("ReentrancyAttacker2", ReentrancyAttacker2.address);

    //making proxyWallet of reentrancyAttacker contract
    await proxyWalletRegistry.build(reentrancyAttacker.address);
    await proxyWalletRegistry.build(reentrancyAttacker2.address);

    reEntrantProxyWallet = await proxyWalletRegistry.proxies(reentrancyAttacker.address);
    reEntrantProxyWallet2 = await proxyWalletRegistry.proxies(reentrancyAttacker2.address);

    await reentrancyAttacker.setProxyWallet(reEntrantProxyWallet);
    await reentrancyAttacker2.setProxyWallet(reEntrantProxyWallet2);

    await stabilityFeeCollector.setSystemDebtEngine(DevAddress);
    await fathomStablecoin.connect(provider.getSigner(AliceAddress)).approve(aliceProxyWallet.address, WeiPerWad.mul(10000));
  });

  describe("#wipeAndUnlockNATIVE", () => {
    context("open position and pay back debt without collateral withdrawal", () => {
      it("should be success", async () => {
        await simplePriceFeed.setPrice(WeiPerRay);

        // position 1
        //  a. open a new position
        //  b. lock WNATIVE
        //  c. mint FXD
        await PositionHelper.openNATIVEPositionAndDraw(aliceProxyWallet, AliceAddress, pools.NATIVE, WeiPerWad.mul(10), WeiPerWad.mul(5));

        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        const positionAddress = await positionManager.positions(positionId);

        //  a. repay 2 WAD of FXD
        //  b. alice doesn't unlock any NATIVE
        //  c. check if the position has the same amount of lockedCollateral
        //  d. check if the position has now debtShare of 3 WAD (5-2)

        await PositionHelper.wipeAndUnlockNATIVE(aliceProxyWallet, AliceAddress, positionId, 0, WeiPerWad.mul(2));

        const [lockedCollateral, debtShare] = await bookKeeper.positions(pools.NATIVE, positionAddress);

        expect(lockedCollateral).to.be.equal(WeiPerWad.mul(10));
        AssertHelpers.assertAlmostEqual(debtShare, WeiPerWad.mul(3));
      });
    });
    context("try reentry with ReentrancyAttacker", () => {
      it("should not make change to the position", async () => {
        await simplePriceFeed.setPrice(WeiPerRay);

        // position 1
        //  a. open a new position
        //  b. lock WNATIVE
        //  c. mint FXD
        await PositionHelper.openNATIVEPositionAndDraw(aliceProxyWallet, AliceAddress, pools.NATIVE, WeiPerWad.mul(10), WeiPerWad.mul(5));

        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        const positionAddress = await positionManager.positions(positionId);

        // call allowmanagerPosition so that reentrancyAttacker can close position
        await PositionHelper.allowManagePosition(aliceProxyWallet, AliceAddress, 1, reEntrantProxyWallet, true);
        //transfer some FXD to reentrancyAttacker contract
        await fathomStablecoin.connect(provider.getSigner(AliceAddress)).transfer(reentrancyAttacker.address, WeiPerWad.mul(5));
        //reentrancyAttack approve reEntrantProxyWallet as spender of FXD
        await reentrancyAttacker.approveWallet(fathomStablecoin.address);
        //reentrancyAttacker tries to call wipeAndUnlockNATIVE and then all proxyWallet again with fallback function
        //but due to gas limit set in safeTransferETH, the fn call fails.

        PositionHelper.wipeAndUnlockNATIVE(reentrancyAttacker, AliceAddress, positionId, WeiPerWad.mul(1), WeiPerWad.mul(2));

        const [lockedCollateral, debtShare] = await bookKeeper.positions(pools.NATIVE, positionAddress);

        expect(lockedCollateral).to.be.equal(WeiPerWad.mul(10));
        AssertHelpers.assertAlmostEqual(debtShare, WeiPerWad.mul(5));
      });
    });
    context("try reentry with ReentrancyAttacker2", () => {
      it("should fail", async () => {
        await simplePriceFeed.setPrice(WeiPerRay);

        // position 1
        //  a. open a new position
        //  b. lock WNATIVE
        //  c. mint FXD
        await PositionHelper.openNATIVEPositionAndDraw(aliceProxyWallet, AliceAddress, pools.NATIVE, WeiPerWad.mul(10), WeiPerWad.mul(5));

        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        const positionAddress = await positionManager.positions(positionId);

        // call allowmanagerPosition so that reentrancyAttacker can close position
        await PositionHelper.allowManagePosition(aliceProxyWallet, AliceAddress, 1, reEntrantProxyWallet2, true);
        //transfer some FXD to reentrancyAttacker contract
        await fathomStablecoin.connect(provider.getSigner(AliceAddress)).transfer(reentrancyAttacker2.address, WeiPerWad.mul(5));
        //reentrancyAttack approve reEntrantProxyWallet as spender of FXD
        await reentrancyAttacker2.approveWallet(fathomStablecoin.address);
        //reentrancyAttacker tries to call wipeAndUnlockNATIVE and then all proxyWallet again with fallback function
        //but due to gas limit set in safeTransferETH, the fn call fails.

        await expect(
          PositionHelper.wipeAndUnlockNATIVE(reentrancyAttacker2, AliceAddress, positionId, WeiPerWad.mul(1), WeiPerWad.mul(2))
        ).to.be.revertedWith("!safeTransferETH");
      });
    });
  });

  describe("#wipeAllAndUnlockNATIVE", () => {
    context("open position and pay back debt without collateral withdrawal", () => {
      it("should be success", async () => {
        await simplePriceFeed.setPrice(WeiPerRay);

        // position 1
        //  a. open a new position
        //  b. lock WNATIVE
        //  c. mint FXD
        await PositionHelper.openNATIVEPositionAndDraw(aliceProxyWallet, AliceAddress, pools.NATIVE, WeiPerWad.mul(10), WeiPerWad.mul(5));
        const positionId = await positionManager.ownerLastPositionId(aliceProxyWallet.address);
        const positionAddress = await positionManager.positions(positionId);

        // position 2
        //  a. open a new position
        //  b. lock WNATIVE
        //  c. mint FXD
        await PositionHelper.openNATIVEPositionAndDraw(aliceProxyWallet, AliceAddress, pools.NATIVE, WeiPerWad.mul(10), WeiPerWad.mul(5));

        //  a. repay debt fully for position1
        //  b. alice doesn't unlock any NATIVE
        //  c. check if the position has the same amount of lockedCollateral
        //  d. check if the position has now debtShare of 0 WAD
        await PositionHelper.wipeAllAndUnlockNATIVE(aliceProxyWallet, AliceAddress, positionId, 0);

        const [lockedCollateral, debtShare] = await bookKeeper.positions(pools.NATIVE, positionAddress);

        expect(lockedCollateral).to.be.equal(WeiPerWad.mul(10));
        expect(debtShare).to.be.equal(0);
      });
    });
  });
});
