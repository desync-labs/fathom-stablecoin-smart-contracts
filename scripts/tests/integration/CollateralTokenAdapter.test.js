const chai = require('chai');
const { ethers } = require("ethers");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { weiToRay, WeiPerWad } = require("../helper/unit");
const { advanceBlock } = require("../helper/time");
const { DeployerAddress, AliceAddress, BobAddress, TreasuryAddress } = require("../helper/address");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");

const { expect } = chai

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    const accessControlConfig = await getProxy(proxyFactory, "AccessControlConfig");
    const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");

    const wnativeAddr = await collateralTokenAdapter.collateralToken();
    const WNATIVE = await artifacts.initializeInterfaceAt("WNATIVE", "WNATIVE");

    return {
        collateralPoolConfig,
        accessControlConfig,
        WNATIVE,
        collateralTokenAdapter,
        wnativeAddr,
        bookKeeper
    }
}

describe("CollateralTokenAdapter", () => {
    // Contracts
    let collateralTokenAdapter
    let WNATIVE


    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            collateralPoolConfig,
            accessControlConfig,
            WNATIVE,
            collateralTokenAdapter,
            wnativeAddr,
            bookKeeper
        } = await loadFixture(setup));
    })
    describe("#totalShare", async () => {
        context("when all collateral tokens are deposited by deposit function", async () => {
            it("should return the correct net asset valuation", async () => {
                //Alice wraps NATIVE to WNATIVE
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 2000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
            })
        })

        context("when some one directly transfer collateral tokens to CollateralTokenAdapter", async () => {
            it("should only recognized collateral tokens from deposit function", async () => {
                //Alice wraps NATIVE to WNATIVE
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 2000000 }
                )
                //Bob wraps NATIVE to WNATIVE
                await WNATIVE.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(89), gasLimit: 1000000 })
                await WNATIVE.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("88"), { from: BobAddress })

                expect(await WNATIVE.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await WNATIVE.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
            })
        })
    })

    describe("#deposit", async () => {
        context("when CollateralTokenAdapter is not live", async () => {
            it("should revert", async () => {
                // Cage collateralTokenAdapter
                await collateralTokenAdapter.cage()
                await collateralTokenAdapter.addToWhitelist(DeployerAddress, { gasLimit: 1000000 });
                await expect(
                    collateralTokenAdapter.deposit(
                        DeployerAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [DeployerAddress])
                    )
                ).to.be.revertedWith("CollateralTokenAdapter/not-live")
            })
        })

        context("when all parameters are valid", async () => {
            it("should work", async () => {
                //Alice wraps NATIVE to WNATIVE
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("2"), { from: AliceAddress, gasLimit: 1000000 })
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    0,
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )


                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))

                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                //Bob wraps NATIVE to WNATIVE
                await WNATIVE.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4), gasLimit: 1000000 })
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.addToWhitelist(BobAddress, { gasLimit: 1000000 });
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                await collateralTokenAdapter.deposit(BobAddress, 0, ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]), { from: BobAddress })

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))

            })
        })
    })

    describe("#withdraw", async () => {
        context("when withdraw more than what CollateralTokenAdapter staked", async () => {
            it("should revert", async () => {
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                //Alice wraps NATIVE to WNATIVE
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                await expect(
                    collateralTokenAdapter.withdraw(
                        AliceAddress,
                        ethers.utils.parseEther("100"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                        { from: AliceAddress, gasLimit: 1000000 }
                    )
                ).to.be.revertedWith("CollateralTokenAdapter/insufficient collateral amount")
            })
        })

        context("when withdraw more than what he staked", async () => {
            it("should revert", async () => {
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                await collateralTokenAdapter.addToWhitelist(BobAddress, { gasLimit: 1000000 });
                await WNATIVE.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4), gasLimit: 1000000 })
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                await expect(
                    collateralTokenAdapter.withdraw(
                        AliceAddress,
                        ethers.utils.parseEther("2"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                        { from: AliceAddress, gasLimit: 1000000 }
                    )
                ).to.be.revertedWith("CollateralTokenAdapter/insufficient collateral amount")
            })
        })

        context("when CollateralTokenAdapter is not live", async () => {
            it("should still allow user to withdraw", async () => {
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                // Now Alice withdraw her position. 4 blocks have been passed.
                // CollateralTokenAdapter is caged, non of FXD has been harvested.
                // Staked collateralTokens have been emergencyWithdraw from FairLaunch.
                // The following conditions must be satisfy:
                // - Alice should get 0 FXD as cage before FXD get harvested.
                // - Alice should get 1 WNATIVE back.
                let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress)

                expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

            })

            it("should still allow user to withdraw with pending rewards (if any)", async () => {
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })

                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                await WNATIVE.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4), gasLimit: 1000000 })
                await collateralTokenAdapter.addToWhitelist(BobAddress, { gasLimit: 1000000 });

                // Bob join the party with 4 WNATIVE! 2 Blocks have been passed.
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                await advanceBlock()

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                // Now Alice withdraw her position. Only 200 FXD has been harvested from FairLaunch.
                // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
                // The following conditions must be satisfy:
                // - Alice pending rewards must be 200 FXD
                // - Bob pending rewards must be 0 FXD as all rewards after Bob deposited hasn't been harvested.
                // - Alice should get 180 (200 - 10%) FXD that is harvested before cage (when Bob deposited)
                // - Alice should get 1 WNATIVE back.
                // - treasury account should get 20 FXD.

                let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress)

                expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                let bobWNATIVEbefore = await WNATIVE.balanceOf(BobAddress)
                await collateralTokenAdapter.withdraw(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )
                let bobWNATIVEafter = await WNATIVE.balanceOf(BobAddress)

                expect(bobWNATIVEafter.sub(bobWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"))

            })
        })

        context("when all parameters are valid", async () => {
            it("should work", async () => {
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                //Alice wraps NATIVE to WNATIVE
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                // Now Alice withdraw her position. 1 block has been passed, hence Alice should get 90 (100 - 10%) FXD, treasury account should get 10 FXD.
                let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress)

                expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

            })
        })
        context("when bob withdraw collateral to alice", async () => {
            context("when bob doesn't has collateral", () => {
                it("should be revert", async () => {
                    await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                    await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                    // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                    await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                    await collateralTokenAdapter.deposit(
                        AliceAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                        { from: AliceAddress, gasLimit: 1000000 }
                    )
                    await collateralTokenAdapter.addToWhitelist(BobAddress, { gasLimit: 1000000 });
                    //checking with Subik-ji
                    let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();

                    expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                    await expect(
                        collateralTokenAdapter.withdraw(
                            AliceAddress,
                            ethers.utils.parseEther("1"),
                            ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                            { from: BobAddress }
                        )
                    ).to.be.revertedWith("CollateralTokenAdapter/insufficient collateral amount")
                })
            })
            context("when bob has collateral", async () => {
                it("should be able to call withdraw", async () => {
                    await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                    await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                    await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                    await collateralTokenAdapter.deposit(
                        AliceAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                        { from: AliceAddress, gasLimit: 1000000 }
                    )

                    expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                    let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                    expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                    await collateralTokenAdapter.addToWhitelist(BobAddress, { gasLimit: 1000000 });
                    await WNATIVE.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                    await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: BobAddress })
                    await collateralTokenAdapter.deposit(
                        BobAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                        { from: BobAddress }
                    )

                    let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress)
                    let bobWNATIVEbefore = await WNATIVE.balanceOf(BobAddress)
                    await collateralTokenAdapter.withdraw(AliceAddress, ethers.utils.parseEther("1"), "0x", { from: BobAddress })
                    let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress)
                    let bobWNATIVEafter = await WNATIVE.balanceOf(BobAddress)

                    expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"))
                    expect(bobWNATIVEafter.sub(bobWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("0"))
                })
            })
        })
    })

    describe("#emergencyWithdraw", async () => {
        context("when CollateralTokenAdapter is not live", async () => {
            it("should allow users to exit with emergencyWithdraw and normal withdraw", async () => {
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2), gasLimit: 1000000 })
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                await WNATIVE.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4), gasLimit: 1000000 })
                await collateralTokenAdapter.addToWhitelist(BobAddress, { gasLimit: 1000000 });
                // Bob join the party with 4 WNATIVE! 2 Blocks have been passed.
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
                await advanceBlock()

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                // Alice panic and decided to emergencyWithdraw.
                // The following states are expected:
                // - Alice should get 1 WNATIVE back.
                let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress)
                await collateralTokenAdapter.emergencyWithdraw(AliceAddress, { from: AliceAddress, gasLimit: 1000000 })
                let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress)

                expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))

                // Bob chose to withdraw normal.
                // But in real life situation, Bob would not be whitelisted so that he can
                // directly deposit and withdraw WNATIVE via CollateralTokenAdapter.
                // The following states are expected:
                // - Bob should get his 4 WNATIVE back
                let bobWNATIVEbefore = await WNATIVE.balanceOf(BobAddress)
                await collateralTokenAdapter.withdraw(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )
                let bobWNATIVEafter = await WNATIVE.balanceOf(BobAddress)

                expect(bobWNATIVEafter.sub(bobWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"))
            })
        })

        context("when all states are normal", async () => {
            it("can call emergencyWithdraw but the state will stay the same", async () => {
                await WNATIVE.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(1), gasLimit: 1000000 })
                await collateralTokenAdapter.addToWhitelist(AliceAddress, { gasLimit: 1000000 });
                await WNATIVE.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                // Alice feels in-secure, so she does emergencyWithdraw
                // However, the collateralTokenAdapter is not uncaged, therefore
                // - Alice cannot get here 1 WNATIVE back
                // - Alice's state stays the same.
                let aliceWNATIVEbefore = await WNATIVE.balanceOf(AliceAddress)
                await collateralTokenAdapter.emergencyWithdraw(AliceAddress, { from: AliceAddress, gasLimit: 1000000 });
                let aliceWNATIVEafter = await WNATIVE.balanceOf(AliceAddress)

                expect(aliceWNATIVEafter.sub(aliceWNATIVEbefore)).to.be.eq(ethers.utils.parseEther("0"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
            })
        })
    })


    describe("#cage/#uncage", async () => {
        context("when whitelist cage", async () => {
            it("should put CollateralTokenAdapter live = 0", async () => {
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)
            })
        })

        context("when caller not owner role cage", async () => {
            context("when assumptions still valid", async () => {
                it("should revert", async () => {
                    await expect(collateralTokenAdapter.cage({ from: AliceAddress, gasLimit: 1000000 })).to.be.revertedWith("CollateralTokenAdapter/not-authorized")
                })
            })

        })

    })
})
