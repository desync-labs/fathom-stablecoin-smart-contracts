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

const loadFixtureHandler = async () => {
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");
    const mockedBookKeeper = await createMock("BookKeeper");
    const mockedStablecoinAdapter = await createMock("MockStablecoinAdapter");
    const mockedToken = await createMock("ERC20MintableStableSwap");


    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.MINTABLE_ROLE.returns(formatBytes32String("MINTABLE_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedAccessControlConfig.mock.BRIDGE_ROLE.returns(formatBytes32String("BRIDGE_ROLE"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)
    await mockedCollateralPoolConfig.mock.setTotalDebtShare.returns()
    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
    await mockedStablecoinAdapter.mock.stablecoin.returns(mockedToken.address)
    await mockedToken.mock.transfer.returns(true)
    await mockedToken.mock.transferFrom.returns(true)
    await mockedToken.mock.balanceOf.returns(WeiPerRad)
    const fathomBridge = getContract("MockFathomBridge", DeployerAddress)

    await fathomBridge.initialize(mockedBookKeeper.address, mockedStablecoinAdapter.address)

    return {
        mockedCollateralPoolConfig,
        mockedAccessControlConfig,
        mockedBookKeeper,
        mockedStablecoinAdapter,
        fathomBridge
    }
}
describe("FathomBridge", () => {
    let mockedCollateralPoolConfig;
    let mockedAccessControlConfig;
    let mockedBookKeeper;
    let mockedStablecoinAdapter;
    let fathomBridge;

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            mockedCollateralPoolConfig,
            mockedAccessControlConfig,
            mockedBookKeeper,
            mockedStablecoinAdapter,
            fathomBridge
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
    })
})
