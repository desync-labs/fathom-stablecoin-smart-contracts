const chai = require('chai');
const { ethers } = require("ethers");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { weiToRay } = require("../helper/unit");
const { advanceBlock } = require("../helper/time");
const { DeployerAddress, AliceAddress, BobAddress, TreasuryAddress } = require("../helper/address");
const { loadFixture } = require("../helper/fixtures");
const { addRoles } = require("../helper/access-roles");
const { initializeContracts } = require("../helper/initializer");

const { formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const setup = async () => {
    const collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
    const accessControlConfig = await artifacts.initializeInterfaceAt("AccessControlConfig", "AccessControlConfig");
    const fathomToken = await artifacts.initializeInterfaceAt("FathomToken", "FathomToken");
    const fairLaunch = await artifacts.initializeInterfaceAt("FairLaunch", "FairLaunch");
    const shield = await artifacts.initializeInterfaceAt("Shield", "Shield");
    const WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");

    const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");
    const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.adapters(COLLATERAL_POOL_ID)
    const collateralTokenAdapter = await artifacts.initializeInterfaceAt("CollateralTokenAdapter", collateralTokenAdapterAddress);

    await initializeContracts();
    await addRoles();

    return {
        collateralPoolConfig,
        accessControlConfig,
        fairLaunch,
        shield,
        WXDC,
        fathomToken,
        collateralTokenAdapter
    }
}

describe("CollateralTokenAdapter", () => {
    // Contracts
    let collateralTokenAdapter
    let WXDC
    let shield
    let fathomToken
    let fairLaunch

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            collateralPoolConfig,
            accessControlConfig,
            fairLaunch,
            shield,
            WXDC,
            fathomToken,
            collateralTokenAdapter
        } = await loadFixture(setup));
    })
    describe("#netAssetValuation", async () => {
        context("when all collateral tokens are deposited by deposit function", async () => {
            it("should return the correct net asset valuation", async () => {
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(0)
            })
        })

        context("when some one directly transfer collateral tokens to CollateralTokenAdapter", async () => {
            it("should only recognized collateral tokens from deposit function", async () => {
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 2000000 }
                )

                await WXDC.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("88"), { from: BobAddress })

                expect(await WXDC.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await WXDC.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                expect(await collateralTokenAdapter.netAssetValuation()).to.be.eq(0)
            })
        })
    })

    describe("#netAssetPerShare", async () => {
        context("when all collateral tokens are deposited by deposit function", async () => {
            it("should return the correct net asset per share", async () => {
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                // Expect netAssetPerShare = 1 as share = asset
                expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                // If total share = 0, the net asset per share = WAD
                expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))
            })
        })

        context("when some one directly transfer collateral tokens to CollateralTokenAdapter", async () => {
            it("should only recognized collateral tokens from deposit function", async () => {
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                await WXDC.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("88"), { from: BobAddress })

                expect(await WXDC.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))

                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                expect(await WXDC.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("88"))
                // If total share = 0, the net asset per share = WAD
                expect(await collateralTokenAdapter.netAssetPerShare()).to.be.eq(ethers.utils.parseEther("1"))
            })
        })
    })

    describe("#deposit", async () => {
        context("when CollateralTokenAdapter is not live", async () => {
            it("should revert", async () => {
                // Cage collateralTokenAdapter
                await collateralTokenAdapter.cage()
                await expect(
                    collateralTokenAdapter.deposit(
                        DeployerAddress,
                        ethers.utils.parseEther("1"),
                        ethers.utils.defaultAbiCoder.encode(["address"], [DeployerAddress])
                    )
                ).to.be.revertedWith("CollateralTokenAdapter/not live")
            })
        })

        context("when all parameters are valid", async () => {
            it("should work", async () => {
                // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("2"), { from: AliceAddress, gasLimit: 1000000 })
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Now Alice harvest rewards. 1 block has been passed, hence Alice should get 90 (100 - 10%) FXD, treasury account should get 10 FXD.
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    0,
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("100")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("0"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(ethers.utils.parseEther("100"))
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("10"))

                // Bob join the party! As 2 blocks moved. CollateralTokenAdapter earned 200 FXD
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("300")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(ethers.utils.parseEther("100"))
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("1200"))
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("10"))

                // Bob harvest FXD. CollateralTokenAdapter earned another 100 FXD.
                // CollateralTokenAdapter has another 100 FXD from previous block. Hence,
                // balanceOf(address(this)) should return 300 FXD.
                // Bob should get 72 (80 - 10%) FXD, treasury account should get 8 FXD.
                await collateralTokenAdapter.deposit(BobAddress, 0, ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]), { from: BobAddress })

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("220"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(ethers.utils.parseEther("72"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("320")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("220"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(ethers.utils.parseEther("100"))
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("1280"))
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("18"))
            })
        })
    })

    describe("#withdraw", async () => {
        context("when withdraw more than what CollateralTokenAdapter staked", async () => {
            it("should revert", async () => {
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
                ).to.be.revertedWith("withdraw: not good")
            })
        })

        context("when withdraw more than what he staked", async () => {
            it("should revert", async () => {
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("1"), { from: AliceAddress, gasLimit: 1000000 })
                await collateralTokenAdapter.deposit(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

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
                ).to.be.revertedWith("CollateralTokenAdapter/insufficient staked amount")
            })
        })

        context("when CollateralTokenAdapter is not live", async () => {
            it("should still allow user to withdraw", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

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
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
            })

            it("should still allow user to withdraw with pending rewards (if any)", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                // CollateralTokenAdapter should earned 200 FXD
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
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
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)

                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("20"))

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
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(0)
            })
        })

        context("when all parameters are valid", async () => {
            it("should work", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

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
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("90"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("100")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("10"))
            })
        })
        context("when bob withdraw collateral to alice", async () => {
            context("when bob doesn't has collateral", () => {
                it("should be revert", async () => {
                    // Assuming Alice is the first one to deposit hence no rewards to be harvested yet
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
                            ethers.utils.parseEther("1"),
                            ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                            { from: BobAddress }
                        )
                    ).to.be.revertedWith("CollateralTokenAdapter/insufficient staked amount")
                })
            })
            context("when bob has collateral", async () => {
                it("should be able to call withdraw", async () => {
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
                    expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                    expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

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
                    expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("250"))
                    expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq("0")
                    expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(ethers.utils.parseEther("45"))
                })
            })
        })
    })

    describe("#emergencyWithdraw", async () => {
        context("when CollateralTokenAdapter is not live", async () => {
            it("should allow users to exit with emergencyWithdraw and normal withdraw", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                // CollateralTokenAdapter should earned 200 FXD
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
                await advanceBlock()

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
                // Only 200 FXD has been harvested from FairLaunch.
                // The following conditions must be satisfy:
                // - Alice pending rewards must be 200 FXD
                // - Bob pending rewards must be 0 FXD as all rewards after Bob deposited hasn't been harvested.
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)

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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(0)
            })
        })

        context("when all states are normal", async () => {
            it("should work", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
            })
        })
    })

    describe("#pendingRewards", async () => {
        context("when CollateralTokenAdapter doesn't has any collateralTokens", async () => {
            it("should returns 0 pending FXD", async () => {
                expect(await collateralTokenAdapter.pendingRewards(DeployerAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(DeployerAddress)).to.be.eq(0)
            })
        })

        context("when CollateralTokenAdapter is not live", async () => {
            it("should return correct pending FXD for each user", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Bob deposit to collateralTokenAdapter, 2 blocks have passed. Hence collateralTokenAdapter should earned 200 FXD.
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                // The following conditions must be satisfy:
                // - collateralTokenAdapter must has 200 FXD as deposit trigger harvest
                // - collateralTokenAdapter.totalShare() must be 5 as Alice deposited 1 WXDC + Bob deposited 4 WXDC
                // - collateralTokenAdapter.accRewardPerShare() must be 200 as 0 + (2*100)/1 = 200
                // - collateralTokenAdapter.accRewardBalance() must be 200 as none of the rewards have been harvested
                // - collateralTokenAdapter.stake(alice) must be 1 WXDC
                // - collateralTokenAdapter.rewardDebts(alice) must be 0
                // - collateralTokenAdapter.stake(bob) must be 4 WXDC
                // - collateralTokenAdapter.rewardDebts(bob) must be 800
                // - collateralTokenAdapter.pendingRewards(alice) must be 200 FXD as she deposited 2 block ago
                // - collateralTokenAdapter.pendingRewards(bob) must be 0 FXD as he just deposited this block
                // - collateralTokenAdapter.pendingRewards(deployer) must be 0 FXD as he doesn't do anything
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(DeployerAddress)).to.be.eq(0)

                // Cage collateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(DeployerAddress)).to.be.eq(0)
            })
        })

        context("when multiple users use CollateralTokenAdapter", async () => {
            it("should returns correct pending FXD for each user", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Bob deposit to collateralTokenAdapter, 2 blocks have passed. Hence collateralTokenAdapter should earned 200 FXD.
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                // The following conditions must be satisfy:
                // - collateralTokenAdapter must has 200 FXD as deposit trigger harvest
                // - collateralTokenAdapter.totalShare() must be 5 as Alice deposited 1 WXDC + Bob deposited 4 WXDC
                // - collateralTokenAdapter.accRewardPerShare() must be 200 as 0 + (2*100)/1 = 200
                // - collateralTokenAdapter.accRewardBalance() must be 200 as none of the rewards have been harvested
                // - collateralTokenAdapter.stake(alice) must be 1 WXDC
                // - collateralTokenAdapter.rewardDebts(alice) must be 0
                // - collateralTokenAdapter.stake(bob) must be 4 WXDC
                // - collateralTokenAdapter.rewardDebts(bob) must be 800
                // - collateralTokenAdapter.pendingRewards(alice) must be 200 FXD as she deposited 2 block ago
                // - collateralTokenAdapter.pendingRewards(bob) must be 0 FXD as he just deposited this block
                // - collateralTokenAdapter.pendingRewards(deployer) must be 0 FXD as he doesn't do anything
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(DeployerAddress)).to.be.eq(0)

                // Move 1 Block to make FairLaunch produces 100 FXD
                await advanceBlock()

                // The following conditions must be satisfy:
                // - collateralTokenAdapter must has 200 FXD as no interaction to CollateralTokenAdapter, hence FXD balance still the same
                // - collateralTokenAdapter.totalShare() must be 5 as Alice deposited 1 WXDC + Bob deposited 4 WXDC
                // - collateralTokenAdapter.accRewardPerShare() must be 200 as no interaction to CollateralTokenAdapter, hence value still the same
                // - collateralTokenAdapter.accRewardBalance() must be 200 as no interaction to CollateralTokenAdapter, hence value still the same
                // - collateralTokenAdapter.stake(alice) must be 1 WXDC
                // - collateralTokenAdapter.rewardDebts(alice) must be 0
                // - collateralTokenAdapter.stake(bob) must be 4 WXDC
                // - collateralTokenAdapter.rewardDebts(bob) must be 800
                // - collateralTokenAdapter.pendingRewards(alice) must be 200 FXD + 100 * (1/5) = 220 FXD
                // - collateralTokenAdapter.pendingRewards(bob) must be 100 * (4/5) = 80 FXD
                // - collateralTokenAdapter.pendingRewards(deployer) must be 0 FXD as he doesn't do anything
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("220"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(ethers.utils.parseEther("80"))
                expect(await collateralTokenAdapter.pendingRewards(DeployerAddress)).to.be.eq(0)
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

            context("when shield's owner is changed", async () => {
                it("should put CollateralTokenAdapter live = 0", async () => {
                    await shield.transferOwnership(AliceAddress)
                    await collateralTokenAdapter.cage({ from: AliceAddress, gasLimit: 1000000 })
                    expect(await collateralTokenAdapter.live()).to.be.eq(0)
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                // CollateralTokenAdapter should earned 200 FXD
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
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
                // - TreasuryAddress account should get 20 FXD.
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)

                let aliceWXDCbefore = await WXDC.balanceOf(AliceAddress)
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    ethers.utils.parseEther("1"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )
                let aliceWXDCafter = await WXDC.balanceOf(AliceAddress)

                expect(aliceWXDCafter.sub(aliceWXDCbefore)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("20"))

                await collateralTokenAdapter.uncage()
                expect(await collateralTokenAdapter.live()).to.be.eq(1)

                // Move 1 block from where CollateralTokenAdapter get uncaged.
                // Hence CollateralTokenAdapter should earned 100 FXD.
                // The following conditions must be satisfy:
                // - CollateralTokenAdapter must has 100 pending FXD
                // - Alice pending rewards must be 100 FXD
                // - Bob pending rewards must be 0 FXD
                await advanceBlock()
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("100"))
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(ethers.utils.parseEther("100"))

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
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("180"))
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(ethers.utils.parseEther("180"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("250")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("40"))
            })
        })
    })

    describe("#complex", async () => {
        context("when someone sends reward token to CollateralTokenAdapter", async () => {
            it("should take them as rewards earned", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Assuming some bad luck dude transfer 150 FXD to CollateralTokenAdapter.
                // 1 Block get mined so CollateralTokenAdapter earned 100 FXD.
                // The following states are expected:
                // - Alice should has 250 pending FXD from collateralTokenAdapter
                // - collateralTokenAdapter should has 150 FXD from random dude
                // - collateralTokenAdapter should has 100 pending FXD from FairLaunch
                // - accRewardPerShare, accRewardBalance, and rewardDebts must be remain the same
                await fathomToken.transfer(collateralTokenAdapter.address, ethers.utils.parseEther("150"), { gasLimit: 1000000 })

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("150"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(0)
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("250"))
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("100"))

                // Now Alice wants to harvest the yields. 1 Block move, CollateralTokenAdapter earned another 100 FXD.
                // The following states are expected:
                // - Alice should get 315 (350 - 10%) FXD in her account
                // - Alice pending FXD from collateralTokenAdapter must be 0
                // - collateralTokenAdapter should has 0 FXD as all harvested by Alice
                // - collateralTokenAdapter should has 0 pending FXD as all harvested
                // - accRewardPershare, accRewardBalance, and rewardDebts must be updated correctly
                // - TreasuryAddress account should get 35 FXD.
                await collateralTokenAdapter.withdraw(
                    AliceAddress,
                    0,
                    ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress]),
                    { from: AliceAddress, gasLimit: 1000000 }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(ethers.utils.parseEther("315"))
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("350")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(ethers.utils.parseEther("350"))
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(0)
                expect(await fairLaunch.pendingFathom(0, collateralTokenAdapter.address)).to.be.eq(0)
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("35"))
            })
        })

        context("when Alice exit with emergency withdraw, but Bob wait for uncage and withdraw", async () => {
            it("should only give Bob his rewards", async () => {
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)

                // Bob join the party with 4 WXDC! 2 Blocks have been passed.
                // CollateralTokenAdapter should earned 200 FXD
                await WXDC.approve(collateralTokenAdapter.address, ethers.utils.parseEther("4"), { from: BobAddress })
                await collateralTokenAdapter.deposit(
                    BobAddress,
                    ethers.utils.parseEther("4"),
                    ethers.utils.defaultAbiCoder.encode(["address"], [BobAddress]),
                    { from: BobAddress }
                )

                expect(await fathomToken.balanceOf(collateralTokenAdapter.address)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await fathomToken.balanceOf(AliceAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.totalShare()).to.be.eq(ethers.utils.parseEther("5"))
                expect(await collateralTokenAdapter.accRewardPerShare()).to.be.eq(weiToRay(ethers.utils.parseEther("200")))
                expect(await collateralTokenAdapter.accRewardBalance()).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(ethers.utils.parseEther("1"))
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(ethers.utils.parseEther("800"))

                // Move 1 block so CollateralTokenAdapter make 100 FXD. However this portion
                // won't be added as CollateralTokenAdapter cage before it get harvested.
                await advanceBlock()

                // Cage CollateralTokenAdapter
                await collateralTokenAdapter.cage()
                expect(await collateralTokenAdapter.live()).to.be.eq(0)

                // CollateralTokenAdapter is caged. Staked collateralTokens have been emergencyWithdraw from FairLaunch.
                // Only 200 FXD has been harvested from FairLaunch.
                // The following conditions must be satisfy:
                // - Alice pending rewards must be 200 FXD
                // - Bob pending rewards must be 0 FXD as all rewards after Bob deposited hasn't been harvested.
                expect(await collateralTokenAdapter.pendingRewards(AliceAddress)).to.be.eq(ethers.utils.parseEther("200"))
                expect(await collateralTokenAdapter.pendingRewards(BobAddress)).to.be.eq(0)

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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(ethers.utils.parseEther("4"))
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
                expect(await collateralTokenAdapter.stake(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(AliceAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.stake(BobAddress)).to.be.eq(0)
                expect(await collateralTokenAdapter.rewardDebts(BobAddress)).to.be.eq(0)
                expect(await fathomToken.balanceOf(TreasuryAddress)).to.be.eq(ethers.utils.parseEther("10"))
            })
        })
    })
})
