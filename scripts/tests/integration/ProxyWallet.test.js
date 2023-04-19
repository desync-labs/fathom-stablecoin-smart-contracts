const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = require("chai");

const { AliceAddress, BobAddress, AddressZero } = require("../helper/address");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");

    return { proxyWalletRegistry }
}

describe("ProxyWallet", () => {
    // Contract
    let proxyWalletRegistry

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({ proxyWalletRegistry } = await loadFixture(setup));
    })
    describe("#new user create a new proxy wallet", async () => {
        context("alice create a new proxy wallet", async () => {
            it("alice should be able to create a proxy wallet", async () => {
                expect(await proxyWalletRegistry.proxies(AliceAddress)).to.be.equal(AddressZero)

                await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
                const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)
                expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
                const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
                expect(await proxyWalletAsAlice.owner({ from: AliceAddress })).to.be.equal(AliceAddress)
            })
        })
    })
    describe("#user already has a proxy wallet", async () => {
        context("alice already has a proxy wallet and alice creates a new proxy wallet", async () => {
            it("alice should not be able to create a proxy wallet", async () => {
                expect(await proxyWalletRegistry.proxies(AliceAddress)).to.be.equal(AddressZero)
                // #1 alice create a proxy wallet 1
                await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
                const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)
                expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
                const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
                expect(await proxyWalletAsAlice.owner({ from: AliceAddress })).to.be.equal(AliceAddress)

                // #2 alice create a proxy wallet 2
                await expect(proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })).to.be.reverted
            })
        })
    })
    describe("#user want to change the owner of a proxy wallet", async () => {
        context("alice want to change the owner of a proxy wallet to bob, but bob already has proxy wallet", async () => {
            it("alice should not be able to change the owner of a proxy wallet", async () => {
                // #1 alice create a proxy wallet
                await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
                const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)
                expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
                const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
                expect(await proxyWalletAsAlice.owner({ from: AliceAddress })).to.be.equal(AliceAddress)

                // #2 bob create a proxy wallet
                await proxyWalletRegistry.build(BobAddress, { from: BobAddress, gasLimit: 2000000 })
                const proxyWalletBobAddress = await proxyWalletRegistry.proxies(BobAddress)
                expect(proxyWalletBobAddress).to.be.not.equal(AddressZero)
                const proxyWalletAsBob = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletBobAddress);
                expect(await proxyWalletAsBob.owner({ from: BobAddress })).to.be.equal(BobAddress)

                // #3 alice set bob to owner proxy wallet registry
                await expect(proxyWalletRegistry.setOwner(BobAddress, { from: AliceAddress })).to.be.reverted
            })
        })
        context("alice only change the owner of a proxy wallet registry", async () => {
            it("alice should not be able to change the owner of a proxy wallet registry", async () => {
                // #1 alice create a proxy wallet
                await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
                const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)
                expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
                const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
                expect(await proxyWalletAsAlice.owner({ from: AliceAddress })).to.be.equal(AliceAddress)

                // #2 alice set bob to owner proxy wallet registry
                await expect(proxyWalletRegistry.setOwner(BobAddress, { from: AliceAddress })).to.be.reverted
            })
        })
        context("alice change the owner of a proxy wallet and proxy wallet registry", async () => {
            it("alice should be able to change the owner of a proxy wallet", async () => {
                // #1 alice create a proxy wallet
                await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
                const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)
                expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
                const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
                expect(await proxyWalletAsAlice.owner({ from: AliceAddress })).to.be.equal(AliceAddress)

                // #2 alice set bob to owner proxy wallet
                await proxyWalletAsAlice.setOwner(BobAddress, { from: AliceAddress })
                expect(await proxyWalletAsAlice.owner({ from: AliceAddress })).to.be.equal(BobAddress)

                // #3 alice set bob to owner proxy wallet registry
                await proxyWalletRegistry.setOwner(BobAddress, { from: AliceAddress })
                expect(await proxyWalletRegistry.proxies(BobAddress)).to.be.equal(proxyWalletAliceAddress)
                expect(await proxyWalletRegistry.proxies(AliceAddress)).to.be.equal(AddressZero)
            })
        })
    })

    describe("Should fail for empty data", async() => {
        context("Should not be able to execute empty data", async() => {
            it("Should revert for empty data", async() => {
                await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
                const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)
                expect(proxyWalletAliceAddress).to.be.not.equal(AddressZero)
                const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
                expect(await proxyWalletAsAlice.owner({ from: AliceAddress })).to.be.equal(AliceAddress)
                await expect(
                    proxyWalletAsAlice.execute(
                        [],//EMPTY DATA
                        {
                            from: AliceAddress
                        }
                    )
                ).to.be.revertedWith("proxy-wallet-data-required")

            })
        })
    })
})