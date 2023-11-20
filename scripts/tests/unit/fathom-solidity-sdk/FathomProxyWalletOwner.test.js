const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const fs = require('fs');
const rawdata = fs.readFileSync('./addresses.json');
let addresses = JSON.parse(rawdata);

const { formatBytes32String } = ethers.utils

const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { getProxy } = require("../../../common/proxies");
const { WeiPerWad } = require("../../helper/unit");
const { loadFixture } = require("../../helper/fixtures");

// const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

const COLLATERAL_POOL_ID = formatBytes32String("XDC")
const FathomProxyWalletOwner = artifacts.require('FathomProxyWalletOwner.sol');

const loadFixtureHandler = async () => {

  const fathomProxyWalletOwner = await artifacts.initializeInterfaceAt("FathomProxyWalletOwner", FathomProxyWalletOwner.address);
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

  return {
    fathomProxyWalletOwner,
    proxyWalletRegistry,
    fathomStablecoin
  }
}


describe("FathomProxyWalletOwner", async () => {
  let fathomProxyWalletOwner;
  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ({ fathomProxyWalletOwner, proxyWalletRegistry, fathomStablecoin } = await loadFixture(loadFixtureHandler))
    await proxyWalletRegistry.setDecentralizedMode(true);
  })

  context("check before proxyWallet creation", async () => {
    it("ProxyWallet should return zero address", async () => {
      const ProxyWalletAddress = await fathomProxyWalletOwner.proxyWallet();
      expect(ProxyWalletAddress).to.be.equal(AddressZero);
    });
    it("proxyWalletRegistry should return proper address", async () => {
      const proxyWalletRegistryAddress = await fathomProxyWalletOwner.proxyWalletRegistry();
      expect(proxyWalletRegistryAddress).to.be.equal(addresses.proxyWalletRegistry);
    });
    it("owner should be the deployer", async () => {
      const ownerAddress = await fathomProxyWalletOwner.owner();
      expect(ownerAddress).to.be.equal(DeployerAddress);
    });
    it("position manager address should be correct should be the deployer", async () => {
      const positionManagerAddress = await fathomProxyWalletOwner.positionManager();
      expect(positionManagerAddress).to.be.equal(addresses.positionManager);
    });
    it("when calling ownerLastPositionId, it should revert", async () => {
      //custom errors check are not supported for tests yet. Need to upgrade waffle version to 4.
      await expect(fathomProxyWalletOwner.ownerLastPositionId())
        .to.be.reverted;
    });
    it("when calling ownerPositionCount, it should revert", async () => {
      //custom errors check are not supported for tests yet. Need to upgrade waffle version to 4.
      await expect(fathomProxyWalletOwner.ownerPositionCount())
        .to.be.reverted;
    });
    it("when calling ownerFirstPositionId, it should revert", async () => {
      //custom errors check are not supported for tests yet. Need to upgrade waffle version to 4.
      await expect(fathomProxyWalletOwner.ownerFirstPositionId())
        .to.be.reverted;
    });
  });
  context("proxy wallet creation", async () => {
    it("buildProxyWallet should work if proxyWallet not created", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
    });
    it("buildProxyWallet should not work if proxyWallet already created", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await expect(fathomProxyWalletOwner.buildProxyWallet())
        .to.be.revertedWith("proxyWallet-already-init");
    });
    it("ProxyWallet should return non zero address", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      const ProxyWalletAddress = await fathomProxyWalletOwner.proxyWallet();
      expect(ProxyWalletAddress).to.not.equal(AddressZero);
    });
  });
  context("position opening", async () => {
    it("FXD 15 borrow and XDC 30 should be ok", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
    });
    it("After opening a posiiton, ownerPositionCount should be 1", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const positionCount = await fathomProxyWalletOwner.ownerPositionCount();
      await expect(positionCount).to.be.equal(1);
    });
    it("After opening a posiiton, ownerFirstPositionId and ownerLastPositionId should be the same", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const ownerFirstPositionId = await fathomProxyWalletOwner.ownerFirstPositionId();
      const ownerLastPositionId = await fathomProxyWalletOwner.ownerLastPositionId();
      await expect(ownerFirstPositionId).to.be.equal(ownerLastPositionId);
    });
    it("After opening a posiiton, positions should return XDC of 30 WAD", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const ownerFirstPositionId = await fathomProxyWalletOwner.ownerFirstPositionId();
      const { lockedCollateral, debtShare } = await fathomProxyWalletOwner.positions(ownerFirstPositionId);
      expect(lockedCollateral).to.equal(WeiPerWad.mul(30));
    });
    it("After opening a posiiton, getActualFXDToRepay should be more or equal to 15 WAD", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const ownerFirstPositionId = await fathomProxyWalletOwner.ownerFirstPositionId();
      const debtValue = await fathomProxyWalletOwner.getActualFXDToRepay(ownerFirstPositionId);
      expect(debtValue).to.be.at.least(WeiPerWad.mul(15));
    });
  });
  context("position closure full", async () => {
    it("Position full closure should work when there is enoguh FXD", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const ownerFirstPositionId = await fathomProxyWalletOwner.ownerFirstPositionId();
      const debtValueBeforeClose = await fathomProxyWalletOwner.getActualFXDToRepay(ownerFirstPositionId);
      await fathomStablecoin.transfer(fathomProxyWalletOwner.address, "30000000000000000000");
      const balanceBeforeClose = await fathomStablecoin.balanceOf(fathomProxyWalletOwner.address);
      // the console log looks easier when .toString() is used.
      await fathomProxyWalletOwner.closePositionFull(ownerFirstPositionId.toString());
      const balanceAfterClose = await fathomStablecoin.balanceOf(fathomProxyWalletOwner.address);
      const debtValueAfterClose = await fathomProxyWalletOwner.getActualFXDToRepay(ownerFirstPositionId);
      expect(balanceBeforeClose).to.not.equal(balanceAfterClose);
      expect(debtValueBeforeClose).to.not.equal(debtValueAfterClose);
      const FXDToRepayAfterClose = await fathomProxyWalletOwner.getActualFXDToRepay(ownerFirstPositionId);
      expect(FXDToRepayAfterClose).to.be.equal(0);
      const { lockedCollateralAfter, debtShareAfter } = await fathomProxyWalletOwner.positions(ownerFirstPositionId);
      expect(lockedCollateralAfter).to.be.undefined;
      expect(debtShareAfter).to.be.undefined;
    });
  });
  context("position closure partial", async () => {
    it("Position full closure should work when there is enoguh FXD", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const ownerFirstPositionId = await fathomProxyWalletOwner.ownerFirstPositionId();
      const debtValueBeforeClose = await fathomProxyWalletOwner.getActualFXDToRepay(ownerFirstPositionId);
      await fathomStablecoin.transfer(fathomProxyWalletOwner.address, "15000000000000000000");
      const balanceBeforeClose = await fathomStablecoin.balanceOf(fathomProxyWalletOwner.address);
      await fathomProxyWalletOwner.closePositionPartial(ownerFirstPositionId, "5000000000000000000", "10000000000000000000");
      const balanceAfterClose = await fathomStablecoin.balanceOf(fathomProxyWalletOwner.address);
      const debtValueAfterClose = await fathomProxyWalletOwner.getActualFXDToRepay(ownerFirstPositionId);
      expect(balanceBeforeClose).to.not.equal(balanceAfterClose);
      expect(debtValueBeforeClose).to.not.equal(debtValueAfterClose);
      const { lockedCollateral, debtShare } = await fathomProxyWalletOwner.positions(ownerFirstPositionId);
      expect(lockedCollateral).to.equal(WeiPerWad.mul(25));
    });
  });
  context("position counter", async () => {
    it("Opening 3 positions should return 3 in positionCount", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const positionCountAt2 = await fathomProxyWalletOwner.ownerPositionCount();
      expect(positionCountAt2).to.be.equal(2);
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const positionCountAt3 = await fathomProxyWalletOwner.ownerPositionCount();
      expect(positionCountAt3).to.be.equal(3);
    });
  });
  context("access control", async () => {
    it("buildProxyWallet should revert when not called by the owner", async () => {
      await expect(fathomProxyWalletOwner.buildProxyWallet({ from: AliceAddress }))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("openPosition should revert when not called by the owner", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await expect(fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: AliceAddress, value: WeiPerWad.mul(30) }))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("closePositionFull should revert when not called by the owner", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const ownerFirstPositionId = await fathomProxyWalletOwner.ownerFirstPositionId();
      await fathomStablecoin.transfer(fathomProxyWalletOwner.address, "15000000000000000000");
      await expect(fathomProxyWalletOwner.closePositionFull(ownerFirstPositionId, { from: AliceAddress }))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("closePositionPartial should revert when not called by the owner", async () => {
      await fathomProxyWalletOwner.buildProxyWallet();
      await fathomProxyWalletOwner.openPosition(WeiPerWad.mul(15), { from: DeployerAddress, value: WeiPerWad.mul(30) });
      const ownerFirstPositionId = await fathomProxyWalletOwner.ownerFirstPositionId();
      await fathomStablecoin.transfer(fathomProxyWalletOwner.address, "15000000000000000000");
      await expect(fathomProxyWalletOwner.closePositionPartial(ownerFirstPositionId, "1000000000000000000", "15000000000000000000", { from: AliceAddress }))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("withdrawXDC should revert when not called by the owner", async () => {
      await expect(fathomProxyWalletOwner.withdrawXDC({ from: AliceAddress }))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("withdrawStablecoin should revert when not called by the owner", async () => {
      await expect(fathomProxyWalletOwner.withdrawStablecoin({ from: AliceAddress }))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
