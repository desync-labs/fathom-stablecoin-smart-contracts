const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { formatBytes32String } = ethers.utils

const { DeployerAddress, AliceAddress, BobAddress, AddressZero } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerWad } = require("../../helper/unit");
const { loadFixture } = require("../../helper/fixtures");

const COLLATERAL_POOL_ID = formatBytes32String("XDC")

const loadFixtureHandler = async () => {

  const FathomProxyWalletOwner = artifacts.require('FathomProxyWalletOwner.sol');

  return {
    FathomProxyWalletOwner
  }
}


describe("FathomProxyWalletOwner", async () => {
  let FathomProxyWalletOwner;
  before(async () => {
    await snapshot.revertToSnapshot();
  })

  beforeEach(async () => {
    ({ FathomProxyWalletOwner } = await loadFixture(loadFixtureHandler))
  })

  context("check before proxyWallet creation", async () => {
    it("ProxyWallet should return zero address", async () => {
      const ProxyWalletAddress = await FathomProxyWalletOwner.ProxyWallet();
      expect(ProxyWalletAddress).to.be.equal(AddressZero);
    });
  });
});
