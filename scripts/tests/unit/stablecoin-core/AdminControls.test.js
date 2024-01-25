const chai = require('chai');
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai
const { ethers } = require("ethers");

const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");
const { DeployerAddress, AddressZero } = require("../../helper/address");
const { formatBytes32String } = ethers.utils

const GOV_ROLE = formatBytes32String("GOV_ROLE")
const OWNER_ROLE = formatBytes32String("OWNER_ROLE")

const randomAddr = "0xf2C2079379a1cCe4C02B401d497A12168407a2Bc";

const setup = async () => {
    const mockedLiquidationEngine = await createMock("LiquidationEngine");
    const mockedPositionManager = await createMock("PositionManager");
    const mockedStablecoinAdapter = await createMock("StablecoinAdapter");
    const mockedSystemDebtEngine = await createMock("SystemDebtEngine");
    const mockedPriceOracle = await createMock("PriceOracle");
    const mockedFlashMintModule = await createMock("FlashMintModule");
    const mockedBookKeeper = await createMock("BookKeeper");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");

    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address);
    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(OWNER_ROLE)
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(GOV_ROLE)
    await mockedAccessControlConfig.mock.hasRole.returns(false);

    await mockedLiquidationEngine.mock.pause.returns();
    await mockedPositionManager.mock.pause.returns();
    await mockedStablecoinAdapter.mock.pause.returns();
    await mockedSystemDebtEngine.mock.pause.returns();
    await mockedPriceOracle.mock.pause.returns();
    await mockedFlashMintModule.mock.pause.returns();
    await mockedBookKeeper.mock.pause.returns();

    await mockedLiquidationEngine.mock.unpause.returns();
    await mockedPositionManager.mock.unpause.returns();
    await mockedStablecoinAdapter.mock.unpause.returns();
    await mockedSystemDebtEngine.mock.unpause.returns();
    await mockedPriceOracle.mock.unpause.returns();
    await mockedFlashMintModule.mock.unpause.returns();
    await mockedBookKeeper.mock.unpause.returns();

    const adminControls = getContract("MockAdminControls", DeployerAddress)

    await adminControls.initialize(
        mockedBookKeeper.address,
        mockedLiquidationEngine.address,
        mockedPriceOracle.address,
        mockedPositionManager.address,
        mockedSystemDebtEngine.address,
        mockedFlashMintModule.address,
        mockedStablecoinAdapter.address
    )

    return {
        adminControls,
        mockedAccessControlConfig
    }
}

describe("AdminControls", () => {
    // Contract
    let adminControls
    let mockedAccessControlConfig

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            adminControls,
            mockedAccessControlConfig
        } = await loadFixture(setup));
    })

    describe("#pause", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.pauseProtocol()).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("emit LogPauseProtocol", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await expect(adminControls.pauseProtocol()).to.emit(adminControls, "LogPauseProtocol");
            })
        })
        context("user is gov", () => {
            it("emit LogPauseProtocol", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await expect(adminControls.pauseProtocol()).to.emit(adminControls, "LogPauseProtocol");
            })
        })
    })
    describe("#unpause", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.unpauseProtocol()).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("emit LogUnpauseProtocol", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await expect(adminControls.unpauseProtocol()).to.emit(adminControls, "LogUnpauseProtocol");
            })
        })
        context("user is gov", () => {
            it("emit LogUnpauseProtocol", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await expect(adminControls.unpauseProtocol()).to.emit(adminControls, "LogUnpauseProtocol");
            })
        })
    })

    describe("#setBookKeeper", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.setBookKeeper(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("zero address", () => {
            it("should revert", async () => {
                await expect(adminControls.setBookKeeper(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await adminControls.setBookKeeper(randomAddr);
                expect(await adminControls.bookKeeper()).to.be.equal(randomAddr)
            })
        })
        context("user is gov", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await adminControls.setBookKeeper(randomAddr);
                expect(await adminControls.bookKeeper()).to.be.equal(randomAddr)
            })
        })
    })
    describe("#setLiquidationEngine", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.setLiquidationEngine(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("zero address", () => {
            it("should revert", async () => {
                await expect(adminControls.setLiquidationEngine(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await adminControls.setLiquidationEngine(randomAddr);
                expect(await adminControls.liquidationEngine()).to.be.equal(randomAddr)
            })
        })
        context("user is gov", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await adminControls.setLiquidationEngine(randomAddr);
                expect(await adminControls.liquidationEngine()).to.be.equal(randomAddr)
            })
        })
    })
    describe("#setPriceOracle", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.setPriceOracle(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("zero address", () => {
            it("should revert", async () => {
                await expect(adminControls.setPriceOracle(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await adminControls.setPriceOracle(randomAddr);
                expect(await adminControls.priceOracle()).to.be.equal(randomAddr)
            })
        })
        context("user is gov", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await adminControls.setPriceOracle(randomAddr);
                expect(await adminControls.priceOracle()).to.be.equal(randomAddr)
            })
        })
    })
    describe("#setPositionManager", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.setPositionManager(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("zero address", () => {
            it("should revert", async () => {
                await expect(adminControls.setPositionManager(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await adminControls.setPositionManager(randomAddr);
                expect(await adminControls.positionManager()).to.be.equal(randomAddr)
            })
        })
        context("user is gov", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await adminControls.setPositionManager(randomAddr);
                expect(await adminControls.positionManager()).to.be.equal(randomAddr)
            })
        })
    })
    describe("#setFlashMintModule", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.setFlashMintModule(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("zero address", () => {
            it("should revert", async () => {
                await expect(adminControls.setFlashMintModule(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await adminControls.setFlashMintModule(randomAddr);
                expect(await adminControls.flashMintModule()).to.be.equal(randomAddr)
            })
        })
        context("user is gov", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await adminControls.setFlashMintModule(randomAddr);
                expect(await adminControls.flashMintModule()).to.be.equal(randomAddr)
            })
        })
    })
    describe("#setStablecoinAdapter", () => {
        context("user has no access", () => {
            it("should revert", async () => {
                await expect(adminControls.setStablecoinAdapter(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("zero address", () => {
            it("should revert", async () => {
                await expect(adminControls.setStablecoinAdapter(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
            })
        })
        context("user is owner", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(OWNER_ROLE, DeployerAddress).returns(true);
                await adminControls.setStablecoinAdapter(randomAddr);
                expect(await adminControls.stablecoinAdapter()).to.be.equal(randomAddr)
            })
        })
        context("user is gov", () => {
            it("should succeed", async () => {
                await mockedAccessControlConfig.mock.hasRole.withArgs(GOV_ROLE, DeployerAddress).returns(true);
                await adminControls.setStablecoinAdapter(randomAddr);
                expect(await adminControls.stablecoinAdapter()).to.be.equal(randomAddr)
            })
        })
    })
})
