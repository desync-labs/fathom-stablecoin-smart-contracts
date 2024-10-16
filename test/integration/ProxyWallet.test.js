const { ethers } = require("hardhat");
const provider = ethers.provider;
const { expect } = require("chai");

const { getProxy } = require("../../common/proxies");

describe("ProxyWallet", () => {
  // Contract
  let proxyWalletRegistry;

  let AliceAddress;
  let BobAddress;
  let AddressZero;

  beforeEach(async () => {
    await deployments.fixture(["DeployTestFixture"]);

    const { allice, bob, a0 } = await getNamedAccounts();
    AliceAddress = allice;
    BobAddress = bob;
    AddressZero = a0;

    const ProxyFactory = await deployments.get("FathomProxyFactory");
    const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);

    proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");
    proxyWalletRegistry.setDecentralizedMode(true);
  });
  describe("#new user create a new proxy wallet", async () => {
    context("alice create a new proxy wallet", async () => {
      it("alice should be able to create a proxy wallet", async () => {
        expect(await proxyWalletRegistry.proxies(AliceAddress)).to.be.equal(AddressZero);

        await proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).build(AliceAddress);
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress);
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero);
        const proxyWalletAsAlice = await ethers.getContractAt("ProxyWallet", proxyWalletAliceAddress);
        expect(await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).owner()).to.be.equal(AliceAddress);
      });
    });
  });
  describe("#user already has a proxy wallet", async () => {
    context("alice already has a proxy wallet and alice creates a new proxy wallet", async () => {
      it("alice should not be able to create a proxy wallet", async () => {
        expect(await proxyWalletRegistry.proxies(AliceAddress)).to.be.equal(AddressZero);
        // #1 alice create a proxy wallet 1
        await proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).build(AliceAddress);
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress);
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero);
        const proxyWalletAsAlice = await ethers.getContractAt("ProxyWallet", proxyWalletAliceAddress);
        expect(await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).owner()).to.be.equal(AliceAddress);

        // #2 alice create a proxy wallet 2
        await expect(proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).build(AliceAddress)).to.be.reverted;
      });
    });
  });
  describe("#user want to change the owner of a proxy wallet", async () => {
    context("alice want to change the owner of a proxy wallet to bob, but bob already has proxy wallet", async () => {
      it("alice should not be able to change the owner of a proxy wallet", async () => {
        // #1 alice create a proxy wallet
        await proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).build(AliceAddress);
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress);
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero);
        const proxyWalletAsAlice = await ethers.getContractAt("ProxyWallet", proxyWalletAliceAddress);
        expect(await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).owner()).to.be.equal(AliceAddress);

        // #2 bob create a proxy wallet
        await proxyWalletRegistry.connect(provider.getSigner(BobAddress)).build(BobAddress);
        const proxyWalletBobAddress = await proxyWalletRegistry.proxies(BobAddress);
        expect(proxyWalletBobAddress).to.be.not.equal(AddressZero);
        const proxyWalletAsBob = await ethers.getContractAt("ProxyWallet", proxyWalletBobAddress);
        expect(await proxyWalletAsBob.connect(provider.getSigner(BobAddress)).owner()).to.be.equal(BobAddress);

        // #3 alice set bob to owner proxy wallet registry
        await expect(proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).setOwner(BobAddress)).to.be.reverted;
      });
    });
    context("alice only change the owner of a proxy wallet registry", async () => {
      it("alice should not be able to change the owner of a proxy wallet registry", async () => {
        // #1 alice create a proxy wallet
        await proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).build(AliceAddress);
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress);
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero);
        const proxyWalletAsAlice = await ethers.getContractAt("ProxyWallet", proxyWalletAliceAddress);
        expect(await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).owner()).to.be.equal(AliceAddress);

        // #2 alice set bob to owner proxy wallet registry
        await expect(proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).setOwner(BobAddress)).to.be.reverted;
      });
    });
    context("alice change the owner of a proxy wallet and proxy wallet registry", async () => {
      it("alice should be able to change the owner of a proxy wallet", async () => {
        // #1 alice create a proxy wallet
        await proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).build(AliceAddress);
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress);
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero);
        const proxyWalletAsAlice = await ethers.getContractAt("ProxyWallet", proxyWalletAliceAddress);
        expect(await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).owner()).to.be.equal(AliceAddress);

        // #2 alice set bob to owner proxy wallet
        await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).setOwner(BobAddress);
        expect(await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).owner()).to.be.equal(BobAddress);

        // #3 alice set bob to owner proxy wallet registry
        await proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).setOwner(BobAddress);
        expect(await proxyWalletRegistry.proxies(BobAddress)).to.be.equal(proxyWalletAliceAddress);
        expect(await proxyWalletRegistry.proxies(AliceAddress)).to.be.equal(AddressZero);
      });
    });
  });

  describe("Should fail for empty data", async () => {
    context("Should not be able to execute empty data", async () => {
      it("Should revert for empty data", async () => {
        await proxyWalletRegistry.connect(provider.getSigner(AliceAddress)).build(AliceAddress);
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress);
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero);
        const proxyWalletAsAlice = await ethers.getContractAt("ProxyWallet", proxyWalletAliceAddress);
        expect(await proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).owner()).to.be.equal(AliceAddress);
        await expect(
          proxyWalletAsAlice.connect(provider.getSigner(AliceAddress)).execute(
            [] //EMPTY DATA
          )
        ).to.be.revertedWith("proxy-wallet-data-required");
      });
    });
  });
});
