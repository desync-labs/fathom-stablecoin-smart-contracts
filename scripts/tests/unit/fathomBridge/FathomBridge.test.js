const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { BigNumber, ethers } = require("ethers");

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { DeployerAddress, AliceAddress, BobAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");

const { formatBytes32String } = ethers.utils
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const ZeroAddress = "0x0000000000000000000000000000000000000000"

const loadFixtureHandler = async () => {
    const mockedAccessControlConfig = await createMock("AccessControlConfig");
    const mockedToken = await createMock("ERC20MintableStableSwap");

    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.MINTABLE_ROLE.returns(formatBytes32String("MINTABLE_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)
    await mockedToken.mock.transfer.returns(true)
    await mockedToken.mock.transferFrom.returns(true)
    await mockedToken.mock.balanceOf.returns(WeiPerRad)
    await mockedToken.mock.approve.returns(true)
    await mockedToken.mock.mint.returns()
    await mockedToken.mock.burn.returns()
    const fathomBridge = getContract("MockFathomBridge", DeployerAddress)

    await fathomBridge.initialize(mockedToken.address, mockedAccessControlConfig.address)

    return {
        mockedAccessControlConfig,
        fathomBridge,
        mockedToken
    }
}
describe("FathomBridge", () => {
    let mockedAccessControlConfig;
    let fathomBridge;
    let mockedToken

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            mockedAccessControlConfig,
            fathomBridge,
            mockedToken
        } = await loadFixture(loadFixtureHandler))
    })

    describe("#addToWhitelist", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.addToWhitelist(AliceAddress)
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await expect(fathomBridge.addToWhitelist(AliceAddress, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogAddToWhitelist")
                .withArgs(AliceAddress);
            })
        })
        context("when the caller is the owner but trying to add ZeroAddress", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await expect(
                    fathomBridge.addToWhitelist(ZeroAddress)
                ).to.be.revertedWith("FathomBridge/zero-address")
            })
        })
    })

    describe("#removeFromWhitelist", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.removeFromWhitelist(AliceAddress)
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await fathomBridge.addToWhitelist(AliceAddress)
                await expect(fathomBridge.removeFromWhitelist(AliceAddress, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogRemoveFromWhitelist")
                .withArgs(AliceAddress);
            })
        })
        context("when the caller is the owner but trying to add ZeroAddress", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await expect(
                    fathomBridge.removeFromWhitelist(ZeroAddress)
                ).to.be.revertedWith("FathomBridge/zero-address")
            })
        })
    })

    describe("#setDecentralizedMode", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.setDecentralizedMode(true)
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                const decentralizedModeBefore = await fathomBridge.isDecentralizedMode()
                expect(decentralizedModeBefore).to.be.equal(false)
                await expect(fathomBridge.setDecentralizedMode(true, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogSetDecentralizedMode")
                .withArgs(true);
                const decentralizedModeAfter = await fathomBridge.isDecentralizedMode()
                expect(decentralizedModeAfter).to.be.equal(true)
            })
        })
    })

    describe("#setFee", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.setFee(WeiPerRad)
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                const feeBefore = await fathomBridge.fixedBridgeFee()
                expect(feeBefore).to.be.equal(0)
                await expect(fathomBridge.setFee(WeiPerRad, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogSetFee")
                .withArgs(WeiPerRad);
                const feeAfter = await fathomBridge.fixedBridgeFee()
                expect(feeAfter).to.be.equal(WeiPerRad)
            })
        })
    })

    describe("#withdrawFees", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.withdrawFees(AliceAddress)
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await expect(fathomBridge.withdrawFees(AliceAddress, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogWithdrawFees")
                .withArgs(DeployerAddress, AliceAddress, WeiPerRad);
            })
        })
        context("when the caller is the owner but withdraw fee to ZeroAddress", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await expect(
                    fathomBridge.withdrawFees(ZeroAddress)
                ).to.be.revertedWith("FathomBridge/zero-address")
            })
        })
    })

    describe("#crossChainTransfer", () => {
        context("when the caller is not whitelisted", async () => {
            it("should revert", async () => {
                await fathomBridge.removeFromWhitelist(DeployerAddress);
                await expect(
                    fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerWad)
                ).to.be.revertedWith("FathomBridge/not-whitelisted")
            })
        })
        context("when the caller is the whitelisted", async () => {
            it("should work and emit LogCrossChainTransferOut", async () => {
                await fathomBridge.addToWhitelist(DeployerAddress)
                await expect(fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerWad, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogCrossChainTransferOut")
                .withArgs(5522, DeployerAddress, AliceAddress, WeiPerWad, 1);
            })
        })
        context("when the caller is the whitelisted", async () => {
            it("should work and emit LogFeeCollection", async () => {
                await fathomBridge.addToWhitelist(DeployerAddress)
                await expect(fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerWad, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogFeeCollection")
                .withArgs(DeployerAddress, 0, 1);
            })
        })
        context("when the caller is the whitelisted but try to send to ZeroAddress", async () => {
            it("should revert", async () => {
                await fathomBridge.addToWhitelist(DeployerAddress)
                await expect(
                    fathomBridge.crossChainTransfer(5522, ZeroAddress, WeiPerWad,)
                ).to.be.revertedWith("FathomBridge/zero-address")
            })
        })
        context("when the caller is the whitelisted and fee is set", async () => {
            it("should work and emit LogFeeCollection", async () => {
                await fathomBridge.addToWhitelist(DeployerAddress)
                const feeBefore = await fathomBridge.fixedBridgeFee()
                expect(feeBefore).to.be.equal(0)
                await expect(fathomBridge.setFee(WeiPerWad, { gasLimit: 1000000 }))
                const feeAfter = await fathomBridge.fixedBridgeFee()
                expect(feeAfter).to.be.equal(WeiPerWad)
                await expect(fathomBridge.crossChainTransfer(5522, AliceAddress, WeiPerRad, { gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogFeeCollection")
                .withArgs(DeployerAddress, WeiPerWad, 1);
            })
        })
    })

    describe("#Cage", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.cage()
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await expect(fathomBridge.cage({ gasLimit: 1000000 }))
                .to.be.emit(fathomBridge, "LogCage");
            })
        })
    })
    describe("#pause", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.pause()
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await fathomBridge.pause()
            })
        })
    })
    describe("#unpause", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)
                await expect(
                    fathomBridge.unpause()
                ).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })
        context("when the caller is the owner", async () => {
            it("should work", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await fathomBridge.pause()
            })
        })
    })
})
