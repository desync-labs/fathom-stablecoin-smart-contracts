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

    const wxdcAddr = await collateralTokenAdapter.collateralToken();
    const WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");

    return {
        collateralPoolConfig,
        accessControlConfig,
        WXDC,
        collateralTokenAdapter,
        wxdcAddr,
        bookKeeper
    }
}

describe("CollateralTokenAdapter", () => {
    // Contracts
    let collateralTokenAdapter
    let WXDC


    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            collateralPoolConfig,
            accessControlConfig,
            WXDC,
            collateralTokenAdapter,
            wxdcAddr,
            bookKeeper
        } = await loadFixture(setup));
    })
    describe("#totalShare", async () => {
        context("when all collateral tokens are deposited by deposit function", async () => {
            it("should return the correct net asset valuation", async () => {
                //Alice wraps XDC to WXDC
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
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
                //Alice wraps XDC to WXDC
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 2000000 }
                )
                //Bob wraps XDC to WXDC
                await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(89),  gasLimit: 1000000})
                await WXDC.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("88"), { from: BobAddress })

                expect(await WXDC.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await WXDC.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
            })
        })
    })

    describe("#deposit", async () => {
        context("when CollateralTokenAdapter is not live", async () => {
            it("should revert", async () => {
                // Cage collateralTokenAdapter
                await collateralTokenAdapter.cage()
                await collateralTokenAdapter.whitelist(DeployerAddress, {gasLimit: 1000000});
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
                //Alice wraps XDC to WXDC
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("2"), { from: AliceAddress, gasLimit: 1000000 })
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    0,
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )


                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                // expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID, AliceAddress).to.be.eq(ethers.utils.parseEther("1")))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                //Bob wraps XDC to WXDC
                await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4),  gasLimit: 1000000})
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                //Alice is whiteListed to directly call deposit function on CollateralTokenAdapter
                await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                // expect(await bookKeeper.collateralToken(COLLATERAL_POOL_ID, BobAddress).to.be.eq(ethers.utils.parseEther("4")))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                await collateralTokenAdapter.deposit(BobAddress, 0, ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]), { from: BobAddress })

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))

            })
        })
    })

    describe("#withdraw", async () => {
        context("when withdraw more than what CollateralTokenAdapter staked", async () => {
            it("should revert", async () => {
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                //Alice wraps XDC to WXDC
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
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
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});
                await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4),  gasLimit: 1000000})
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
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
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
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
                // - Alice should get 1 WXDC back.
                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

            })

            it("should still allow user to withdraw with pending rewards (if any)", async () => {
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})

                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4),  gasLimit: 1000000})
                await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});

                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
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
                // - Alice should get 1 WXDC back.
                // - treasury account should get 20 FXD.

                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                let bobWXDCbefore = await WXDC.balanceOf(BobAddress)
                await collateralTokenAdapter.withdraw(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )
                let bobWXDCafter = await WXDC.balanceOf(BobAddress)

                expect(bobWXDCafter.sub(bobWXDCbefore)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"))

            })
        })

        context("when all parameters are valid", async () => {
            it("should work", async () => {
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                //Alice wraps XDC to WXDC
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                // Now Alice withdraw her position. 1 block has been passed, hence Alice should get 90 (100 - 10%) FXD, treasury account should get 10 FXD.
                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

            })
        })
        context("when bob withdraw collateral to alice", async () => {
            context("when bob doesn't has collateral", () => {
                it("should be revert", async () => {
                    await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                    await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                    // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                    await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                    await collateralTokenAdapter.deposit(
                        AliceAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                        { from: AliceAddress, gasLimit: 1000000 }
                    )
                    await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});
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
                    await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                    await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                    await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                    await collateralTokenAdapter.deposit(
                        AliceAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                        { from: AliceAddress, gasLimit: 1000000 }
                    )

                    expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                    // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                    let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                    expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                    await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});
                    await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                    await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: BobAddress })
                    await collateralTokenAdapter.deposit(
                        BobAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                        { from: BobAddress }
                    )

                    let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                    let bobWXDCbefore = await WXDC.balanceOf(BobAddress)
                    await collateralTokenAdapter.withdraw(AliceAddress, ethers.utils.parseEther("1"), "0x", { from: BobAddress })
                    let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)
                    let bobWXDCafter = await WXDC.balanceOf(BobAddress)

                    expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                    expect(bobWXDCafter.sub(bobWXDCbefore)).to.be.eq(ethers.utils.parseEther("0"))
                })
            })
        })
    })

    describe("#emergencyWithdraw", async () => {
        context("when CollateralTokenAdapter is not live", async () => {
            xit("should allow users to exit with emergencyWithdraw and normal withdraw", async () => {
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4),  gasLimit: 1000000})
                await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});
                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("4"))


                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
                await advanceBlock()

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                // Alice panic and decided to emergencyWithdraw.
                // The following states are expected:
                // - collateralTokenAdapte should still has 200 FXD as Alice dismiss her rewards
                // - Alice should not get any FXD as she decided to do exit via emergency withdraw instead of withdraw
                // - Alice should get 1 WXDC back.
                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.emergencyWithdraw(AliceAddress, { from: AliceAddress, gasLimit: 1000000 })
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                // Bob is a cool guy. Not panic and withdraw normal.
                // The following states are expected:
                // - Bob should get his 4 WXDC back
                // - Bob hasn't earn any FXD yet so he didn't get any FXD
                // - CollateralTokenAdapter should still has 200 FXD that Alice dismissed
                let bobWXDCbefore = await WXDC.balanceOf(BobAddress)
                await collateralTokenAdapter.withdraw(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )
                let bobWXDCafter = await WXDC.balanceOf(BobAddress)

                expect(bobWXDCafter.sub(bobWXDCbefore)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(0)
            })
        })

        context("when all states are normal", async () => {
            xit("should work", async () => {
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Alice feels in-secure, so she does emergencyWithdraw
                // The following conditions must be satisfied:
                // - Alice should get here 1 WXDC back
                // - Alice shouldn't be paid by any FXD
                // - Alice's state should be reset
                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.emergencyWithdraw(AliceAddress, { from: AliceAddress, gasLimit: 1000000 })
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("100"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
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

        context("when uncage live CollateralTokenAdapter", async () => {
            it("should revert", async () => {
                await expect(collateralTokenAdapter.uncage()).to.be.revertedWith("CollateralTokenAdapter/not-caged")
            })
        })

        context("when cage and uncage", async () => {
            it("should resume operations perfectly", async () => {
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});
                await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4),  gasLimit: 1000000})
                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
                await advanceBlock()

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))


                await collateralTokenAdapter.uncage()
                expect(await collateralTokenAdapter.live()).to.be.eq(1)


                await advanceBlock()

                // Now Bob withdraw his position. Only 100 FXD has been harvested from FairLaunch.
                // Another 100 FXD is pending for CollateralTokenAdapter to harvest.
                // The following conditions must be satisfy:
                // - Bob should get 180 (200 - 10%) FXD as 2 blocks passed.
                // - Bob pending rewards must be 0 FXD as all rewards are harvested.
                // - Bob should get 4 WXDC back.
                // - Alice's FXD should remain the same.
                // - TreasuryAddress account should get 20 FXD.
                let bobWXDCbefore = await WXDC.balanceOf(BobAddress)
                await collateralTokenAdapter.withdraw(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )
                let bobWXDCafter = await WXDC.balanceOf(BobAddress)

                expect(bobWXDCafter.sub(bobWXDCbefore)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"))

            })
        })
    })

    describe("#complex", async () => {
        context("when Alice exit with emergency withdraw, but Bob wait for uncage and withdraw", async () => {
            xit("should only give Bob his rewards", async () => {
                await collateralTokenAdapter.whitelist(AliceAddress, {gasLimit: 1000000});
                await WXDC.deposit({ from: AliceAddress, value: ethers.constants.WeiPerEther.mul(2),  gasLimit: 1000000})
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                let collateralPoolIdFromAdapter = await collateralTokenAdapter.collateralPoolId();
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))


                await collateralTokenAdapter.whitelist(BobAddress, {gasLimit: 1000000});
                await WXDC.deposit({ from: BobAddress, value: ethers.constants.WeiPerEther.mul(4),  gasLimit: 1000000})

                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))

                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("4"))

                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
                await advanceBlock()

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                // Alice panic and decided to emergencyWithdraw.
                // The following states are expected:
                // - collateralTokenAdapte should still has 200 FXD as Alice dismiss her rewards
                // - Alice should not get any FXD as she decided to do exit via emergency withdraw instead of withdraw
                // - Alice should get 1 WXDC back.
                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.emergencyWithdraw(AliceAddress, { from: AliceAddress, gasLimit: 1000000 })
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("4"))

                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                // Everything is fine now. So CollateralTokenAdapter get uncage.
                // 1 Block is mined. However, CollateralTokenAdapter just deposit collateralTokens back
                // to FairLaunch at this block, hence it won't earn any FXD.
                // The following states are expected:
                // - CollateralTokenAdapter's live must be 1
                // - Bob pending FXD must be 0
                await collateralTokenAdapter.uncage()
                expect(await collateralTokenAdapter.live()).to.be.eq(1)
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)

                // Bob is a cool guy. Not panic, wait until everything becomes normal,
                // he will get his portion
                // The following states are expected:
                // - Bob should get his 4 WXDC back
                // - Bob earn 90 (100 - 10%) FXD as block diff that Bob exit and uncage = 1 block
                // - CollateralTokenAdapter should still has 200 FXD that Alice dismissed
                // - TreasuryAddress account should get 10 FXD.
                let bobWXDCbefore = await WXDC.balanceOf(BobAddress)
                await collateralTokenAdapter.withdraw(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )
                let bobWXDCafter = await WXDC.balanceOf(BobAddress)

                expect(bobWXDCafter.sub(bobWXDCbefore)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(ethers.utils.parseEther("90"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("225")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                // expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, AliceAddress)).to.be.eq(ethers.utils.parseEther("0"))

                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                // expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await bookKeeper.collateralToken(collateralPoolIdFromAdapter, BobAddress)).to.be.eq(ethers.utils.parseEther("0"))

                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("10"))
            })
        })
    })
})
