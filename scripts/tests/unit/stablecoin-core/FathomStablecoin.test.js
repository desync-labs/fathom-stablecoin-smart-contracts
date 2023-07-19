const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, BobAddress, AddressZero } = require("../../helper/address");
const { getContract } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");

const loadFixtureHandler = async () => {
    const fathomStablecoin = getContract("FathomStablecoin", DeployerAddress)
    const fathomStablecoinAsAlice = getContract("FathomStablecoin", AliceAddress)

    await fathomStablecoin.initialize("Fatom", "FXD")

    return { fathomStablecoin, fathomStablecoinAsAlice }
}

describe("FathomStablecoin", () => {
    let fathomStablecoin
    let fathomStablecoinAsAlice

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            fathomStablecoin,
            fathomStablecoinAsAlice
        } = await loadFixture(loadFixtureHandler))
    })

    context("#transferFrom", () => {
        context("when alice transfer to bob", () => {
            context("when alice doesn't have enough token", () => {
                it("should be revert", async () => {
                    await expect(
                        fathomStablecoinAsAlice.transferFrom(AliceAddress, BobAddress, WeiPerWad.mul(100))
                    ).to.be.revertedWith("FathomStablecoin/insufficient-balance")
                })
            })
            context("amount is zero", () => {
                it("should be revert", async () => {
                    await expect(
                        fathomStablecoinAsAlice.transferFrom(AliceAddress, BobAddress, 0)
                    ).to.be.revertedWith("FathomStablecoin/zero-amount")
                })
            })
            context("destination is zero", () => {
                it("should revert", async () => {
                    await expect(
                        fathomStablecoinAsAlice.transferFrom(AliceAddress, AddressZero, 20)
                    ).to.be.revertedWith("FathomStablecoin/zero-destination")
                })
            })
            context("when alice has enough token", () => {
                context("when the caller is not the owner", async () => {
                    it("should revert", async () => {
                        await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                        await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))
                        await expect(
                            fathomStablecoin.transferFrom(AliceAddress, BobAddress, WeiPerWad.mul(100))
                        ).to.be.revertedWith("FathomStablecoin/insufficient-allowance")
                    })
                    context("when Alice set allowance", () => {
                        context("when allowance is not enough", () => {
                            it("should revert", async () => {
                                await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                                await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))
                                await fathomStablecoinAsAlice.approve(DeployerAddress, WeiPerWad)
                                await expect(
                                    fathomStablecoin.transferFrom(AliceAddress, BobAddress, WeiPerWad.mul(100))
                                ).to.be.revertedWith("FathomStablecoin/insufficient-allowance")
                            })
                        })
                        context("when allowance is enough", () => {
                            it("should be able to call transferFrom", async () => {
                                await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)

                                await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))
                                await fathomStablecoinAsAlice.approve(DeployerAddress, WeiPerWad.mul(100))

                                const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                                expect(allowanceDeployerAliceBefore).to.be.equal(WeiPerWad.mul(100))
                                const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(AliceAddress)
                                expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
                                const fathomStablecoinBobBefore = await fathomStablecoin.balanceOf(BobAddress)
                                expect(fathomStablecoinBobBefore).to.be.equal(WeiPerWad.mul(0))

                                await expect(fathomStablecoin.transferFrom(AliceAddress, BobAddress, WeiPerWad.mul(10)))
                                    .to.emit(fathomStablecoin, "Transfer")
                                    .withArgs(AliceAddress, BobAddress, WeiPerWad.mul(10))

                                const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                                expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad.mul(90))
                                const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(AliceAddress)
                                expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
                                const fathomStablecoinBobAfter = await fathomStablecoin.balanceOf(BobAddress)
                                expect(fathomStablecoinBobAfter).to.be.equal(WeiPerWad.mul(10))
                            })
                        })
                    })
                })
                context("when the caller is the owner", () => {
                    it("should be able to call transferFrom", async () => {
                        await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                        await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))

                        const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(AliceAddress)
                        expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
                        const fathomStablecoinBobBefore = await fathomStablecoin.balanceOf(BobAddress)
                        expect(fathomStablecoinBobBefore).to.be.equal(WeiPerWad.mul(0))

                        await expect(fathomStablecoinAsAlice.transferFrom(AliceAddress, BobAddress, WeiPerWad.mul(10)))
                            .to.emit(fathomStablecoin, "Transfer")
                            .withArgs(AliceAddress, BobAddress, WeiPerWad.mul(10))

                        const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(AliceAddress)
                        expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
                        const fathomStablecoinBobAfter = await fathomStablecoin.balanceOf(BobAddress)
                        expect(fathomStablecoinBobAfter).to.be.equal(WeiPerWad.mul(10))
                    })
                })
            })
        })
    })

    context("#approve", () => {
        it("should be able call approve", async () => {
            const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
            expect(allowanceDeployerAliceBefore).to.be.equal(0)

            await expect(fathomStablecoinAsAlice.approve(DeployerAddress, WeiPerWad))
                .to.emit(fathomStablecoin, "Approval")
                .withArgs(AliceAddress, DeployerAddress, WeiPerWad)

            const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
            expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad)
        })
    })

    context("#increaseAllowance", () => {
        it("should be able increase allowance", async () => {
            const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
            expect(allowanceDeployerAliceBefore).to.be.equal(0)

            await expect(fathomStablecoinAsAlice.increaseAllowance(DeployerAddress, WeiPerWad))
                .to.emit(fathomStablecoin, "Approval")
                .withArgs(AliceAddress, DeployerAddress, WeiPerWad)

            const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
            expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad)
        })
    })

    context("#decreaseAllowance", () => {
        context("decrease below zero", () => {
            it("should revert", async () => {
                const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                expect(allowanceDeployerAliceBefore).to.be.equal(0)

                await fathomStablecoinAsAlice.increaseAllowance(DeployerAddress, WeiPerWad)

                await expect(fathomStablecoinAsAlice.decreaseAllowance(DeployerAddress, WeiPerWad.add(1))).to.be.revertedWith("FathomStablecoin/decreased-allowance-below-zero");

                const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad)
            })
        })
        context("valid decrease", () => {
            it("should be able decrease allowance", async () => {
                const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                expect(allowanceDeployerAliceBefore).to.be.equal(0)

                await fathomStablecoinAsAlice.increaseAllowance(DeployerAddress, WeiPerWad.mul(2))

                await expect(fathomStablecoinAsAlice.decreaseAllowance(DeployerAddress, WeiPerWad))
                    .to.emit(fathomStablecoin, "Approval")
                    .withArgs(AliceAddress, DeployerAddress, WeiPerWad)

                const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad)
            })
        })
    })

    context("#mint", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await expect(fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))).to.be.revertedWith("!minterRole")
            })
        })
        context("when the caller is the owner", async () => {
            it("should be able to call mint", async () => {
                await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(AliceAddress)
                expect(fathomStablecoinAliceBefore).to.be.equal(0)
                const totalSupplyBefore = await fathomStablecoin.totalSupply()
                expect(totalSupplyBefore).to.be.equal(0)

                // mint 100 FUSD
                await expect(fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100)))
                    .to.emit(fathomStablecoin, "Transfer")
                    .withArgs(AddressZero, AliceAddress, WeiPerWad.mul(100))

                const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(AliceAddress)
                expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(100))
                const totalSupplyAfter = await fathomStablecoin.totalSupply()
                expect(totalSupplyAfter).to.be.equal(WeiPerWad.mul(100))
            })
        })
    })

    context("#burn", () => {
        context("when alice doesn't have enough token", () => {
            it("should be revert", async () => {
                await expect(fathomStablecoinAsAlice.burn(AliceAddress, WeiPerWad.mul(100))).to.be.revertedWith(
                    "FathomStablecoin/insufficient-balance"
                )
            })
        })
        context("when alice has enough token", () => {
            context("when the caller is not the owner", async () => {
                it("should revert", async () => {
                    await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                    await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))
                    await expect(fathomStablecoin.burn(AliceAddress, WeiPerWad.mul(100))).to.be.revertedWith(
                        "FathomStablecoin/insufficient-allowance"
                    )
                })
                context("when Alice set allowance", () => {
                    context("when allowance is not enough", () => {
                        it("should revert", async () => {
                            await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                            await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))
                            await fathomStablecoinAsAlice.approve(DeployerAddress, WeiPerWad)
                            await expect(fathomStablecoin.burn(AliceAddress, WeiPerWad.mul(100))).to.be.revertedWith(
                                "FathomStablecoin/insufficient-allowance"
                            )
                        })
                    })
                    context("when allowance is enough", () => {
                        it("should be able to call burn", async () => {
                            await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                            await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))
                            await fathomStablecoinAsAlice.approve(DeployerAddress, WeiPerWad.mul(100))

                            const allowanceDeployerAliceBefore = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                            expect(allowanceDeployerAliceBefore).to.be.equal(WeiPerWad.mul(100))
                            const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(AliceAddress)
                            expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
                            const totalSupplyBefore = await fathomStablecoin.totalSupply()
                            expect(totalSupplyBefore).to.be.equal(WeiPerWad.mul(100))

                            await expect(fathomStablecoin.burn(AliceAddress, WeiPerWad.mul(10)))
                                .to.emit(fathomStablecoin, "Transfer")
                                .withArgs(AliceAddress, AddressZero, WeiPerWad.mul(10))

                            const allowanceDeployerAliceAfter = await fathomStablecoin.allowance(AliceAddress, DeployerAddress)
                            expect(allowanceDeployerAliceAfter).to.be.equal(WeiPerWad.mul(90))
                            const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(AliceAddress)
                            expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
                            const totalSupplyAfter = await fathomStablecoin.totalSupply()
                            expect(totalSupplyAfter).to.be.equal(WeiPerWad.mul(90))
                        })
                    })
                })
            })
            context("when the caller is the owner", () => {
                it("should be able to call burn", async () => {
                    await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress)
                    await fathomStablecoin.mint(AliceAddress, WeiPerWad.mul(100))

                    const fathomStablecoinAliceBefore = await fathomStablecoin.balanceOf(AliceAddress)
                    expect(fathomStablecoinAliceBefore).to.be.equal(WeiPerWad.mul(100))
                    const totalSupplyBefore = await fathomStablecoin.totalSupply()
                    expect(totalSupplyBefore).to.be.equal(WeiPerWad.mul(100))

                    await expect(fathomStablecoinAsAlice.burn(AliceAddress, WeiPerWad.mul(10)))
                        .to.emit(fathomStablecoin, "Transfer")
                        .withArgs(AliceAddress, AddressZero, WeiPerWad.mul(10))

                    const fathomStablecoinAliceAfter = await fathomStablecoin.balanceOf(AliceAddress)
                    expect(fathomStablecoinAliceAfter).to.be.equal(WeiPerWad.mul(90))
                    const totalSupplyAfter = await fathomStablecoin.totalSupply()
                    expect(totalSupplyAfter).to.be.equal(WeiPerWad.mul(90))
                })
            })
        })
    })
})
