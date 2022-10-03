const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

const { AddressZero } = ethers.constants

const ProxyWalletArtifact = require("../../../artifacts/contracts/8.17/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");

const proxyWalletAbi = ProxyWalletArtifact.abi

const loadFixtureHandler = async () => {
  const [deployer] = await ethers.getSigners()
  const ProxyWalletFactory = (await ethers.getContractFactory("ProxyWalletFactory", deployer))
  const proxyWalletFactory = await ProxyWalletFactory.deploy();
  await proxyWalletFactory.deployed();

  const ProxyWalletRegistry = (await ethers.getContractFactory("ProxyWalletRegistry", deployer))
  const proxyWalletRegistry = (await upgrades.deployProxy(ProxyWalletRegistry, [
    proxyWalletFactory.address
  ]))
  await proxyWalletRegistry.deployed();
  return { proxyWalletRegistry }
}

describe("ProxyWallet", () => {
  // Accounts
  let deployer
  let alice
  let bob
  let dev

  // Account Addresses
  let deployerAddress
  let aliceAddress
  let bobAddress
  let devAddress

  // Contract
  let proxyWalletRegistry

  let proxyWalletRegistryAsAlice
  let proxyWalletRegistryAsBob

  beforeEach(async () => {
    ;({ proxyWalletRegistry } = await loadFixtureHandler())
    ;[deployer, alice, bob, dev] = await ethers.getSigners()
    ;[deployerAddress, aliceAddress, bobAddress, devAddress] = await Promise.all([
      deployer.getAddress(),
      alice.getAddress(),
      bob.getAddress(),
      dev.getAddress(),
    ])
    proxyWalletRegistryAsAlice = proxyWalletRegistry.connect(alice)
    proxyWalletRegistryAsBob = proxyWalletRegistry.connect(bob)
  })
  describe("#new user create a new proxy wallet", async () => {
    context("alice create a new proxy wallet", async () => {
      it("alice should be able to create a proxy wallet", async () => {
        expect(await proxyWalletRegistry.proxies(aliceAddress)).to.be.equal(AddressZero)
        // #1 alice create a proxy wallet
        await proxyWalletRegistryAsAlice.build(aliceAddress)
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(aliceAddress)
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
        const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAliceAddress, proxyWalletAbi, alice)
        expect(await proxyWalletAsAlice.owner()).to.be.equal(aliceAddress)
      })
    })
  })
  describe("#user already has a proxy wallet", async () => {
    context("alice already has a proxy wallet and alice creates a new proxy wallet", async () => {
      it("alice should not be able to create a proxy wallet", async () => {
        expect(await proxyWalletRegistry.proxies(aliceAddress)).to.be.equal(AddressZero)
        // #1 alice create a proxy wallet 1
        await proxyWalletRegistryAsAlice.build(aliceAddress)
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(aliceAddress)
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
        const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAliceAddress, proxyWalletAbi, alice)
        expect(await proxyWalletAsAlice.owner()).to.be.equal(aliceAddress)

        // #2 alice create a proxy wallet 2
        await expect(proxyWalletRegistryAsAlice.build()).to.be.reverted
      })
    })
  })
  describe("#user want to change the owner of a proxy wallet", async () => {
    context("alice want to change the owner of a proxy wallet to bob, but bob already has proxy wallet", async () => {
      it("alice should not be able to change the owner of a proxy wallet", async () => {
        // #1 alice create a proxy wallet
        await proxyWalletRegistryAsAlice.build(aliceAddress)
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(aliceAddress)
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
        const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAliceAddress, proxyWalletAbi, alice)
        expect(await proxyWalletAsAlice.owner()).to.be.equal(aliceAddress)

        // #2 bob create a proxy wallet
        await proxyWalletRegistryAsBob.build(bobAddress)
        const proxyWalletBobAddress = await proxyWalletRegistry.proxies(bobAddress)
        expect(proxyWalletBobAddress).to.be.not.equal(AddressZero)
        const proxyWalletAsBob = new hre.ethers.Contract(proxyWalletBobAddress, proxyWalletAbi, bob)
        expect(await proxyWalletAsBob.owner()).to.be.equal(bobAddress)

        // #3 alice set bob to owner proxy wallet registry
        await expect(proxyWalletRegistryAsAlice.setOwner(bobAddress)).to.be.reverted
      })
    })
    context("alice only change the owner of a proxy wallet registry", async () => {
      it("alice should not be able to change the owner of a proxy wallet registry", async () => {
        // #1 alice create a proxy wallet
        await proxyWalletRegistryAsAlice.build(aliceAddress)
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(aliceAddress)
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
        const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAliceAddress, proxyWalletAbi, alice)
        expect(await proxyWalletAsAlice.owner()).to.be.equal(aliceAddress)

        // #2 alice set bob to owner proxy wallet registry
        await expect(proxyWalletRegistryAsAlice.setOwner(bobAddress)).to.be.reverted
      })
    })
    context("alice change the owner of a proxy wallet and proxy wallet registry", async () => {
      it("alice should be able to change the owner of a proxy wallet", async () => {
        // #1 alice create a proxy wallet
        await proxyWalletRegistryAsAlice.build(aliceAddress)
        const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(aliceAddress)
        expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
        const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAliceAddress, proxyWalletAbi, alice)
        expect(await proxyWalletAsAlice.owner()).to.be.equal(aliceAddress)

        // #2 alice set bob to owner proxy wallet
        await proxyWalletAsAlice.setOwner(bobAddress)
        expect(await proxyWalletAsAlice.owner()).to.be.equal(bobAddress)

        // #3 alice set bob to owner proxy wallet registry
        await proxyWalletRegistryAsAlice.setOwner(bobAddress)
        expect(await proxyWalletRegistry.proxies(bobAddress)).to.be.equal(proxyWalletAliceAddress)
        expect(await proxyWalletRegistry.proxies(aliceAddress)).to.be.equal(AddressZero)
      })
    })
  })
})
