const { ethers } = require("hardhat");
const { expect } = require("chai");
const { smock } = require("@defi-wonderland/smock");

const { DeployerAddress, AddressZero } = require("../../helper/address");
const { formatBytes32String } = ethers.utils;

const GOV_ROLE = formatBytes32String("GOV_ROLE");
const OWNER_ROLE = formatBytes32String("OWNER_ROLE");

const randomAddr = "0xf2C2079379a1cCe4C02B401d497A12168407a2Bc";

const setup = async () => {
  return {
    adminControls,
    mockedAccessControlConfig,
  };
};

describe("AdminControls", () => {
  // Contract
  let adminControls;
  let mockedAccessControlConfig;

  beforeEach(async () => {
    const mockedLiquidationEngine = await smock.fake("LiquidationEngine");
    const mockedPositionManager = await smock.fake("PositionManager");
    const mockedStablecoinAdapter = await smock.fake("StablecoinAdapter");
    const mockedSystemDebtEngine = await smock.fake("SystemDebtEngine");
    const mockedPriceOracle = await smock.fake("PriceOracle");
    const mockedFlashMintModule = await smock.fake("FlashMintModule");
    const mockedBookKeeper = await smock.fake("BookKeeper");
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");

    mockedBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockedAccessControlConfig.OWNER_ROLE.returns(OWNER_ROLE);
    mockedAccessControlConfig.GOV_ROLE.returns(GOV_ROLE);
    mockedAccessControlConfig.hasRole.returns(false);

    mockedLiquidationEngine.pause.returns();
    mockedPositionManager.pause.returns();
    mockedStablecoinAdapter.pause.returns();
    mockedSystemDebtEngine.pause.returns();
    mockedPriceOracle.pause.returns();
    mockedFlashMintModule.pause.returns();
    mockedBookKeeper.pause.returns();

    mockedLiquidationEngine.unpause.returns();
    mockedPositionManager.unpause.returns();
    mockedStablecoinAdapter.unpause.returns();
    mockedSystemDebtEngine.unpause.returns();
    mockedPriceOracle.unpause.returns();
    mockedFlashMintModule.unpause.returns();
    mockedBookKeeper.unpause.returns();

    const AdminControlsFactory = await ethers.getContractFactory("MockAdminControls");
    adminControls = await AdminControlsFactory.deploy();
    await adminControls.deployed();

    await adminControls.initialize(
      mockedBookKeeper.address,
      mockedLiquidationEngine.address,
      mockedPriceOracle.address,
      mockedPositionManager.address,
      mockedSystemDebtEngine.address,
      mockedFlashMintModule.address,
      mockedStablecoinAdapter.address
    );
  });

  describe("#pause", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.pauseProtocol()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("emit LogPauseProtocol", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await expect(adminControls.pauseProtocol()).to.emit(adminControls, "LogPauseProtocol");
      });
    });
    context("user is gov", () => {
      it("emit LogPauseProtocol", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await expect(adminControls.pauseProtocol()).to.emit(adminControls, "LogPauseProtocol");
      });
    });
  });
  describe("#unpause", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.unpauseProtocol()).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("emit LogUnpauseProtocol", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await expect(adminControls.unpauseProtocol()).to.emit(adminControls, "LogUnpauseProtocol");
      });
    });
    context("user is gov", () => {
      it("emit LogUnpauseProtocol", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await expect(adminControls.unpauseProtocol()).to.emit(adminControls, "LogUnpauseProtocol");
      });
    });
  });

  describe("#setBookKeeper", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.setBookKeeper(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("zero address", () => {
      it("should revert", async () => {
        await expect(adminControls.setBookKeeper(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await adminControls.setBookKeeper(randomAddr);
        expect(await adminControls.bookKeeper()).to.be.equal(randomAddr);
      });
    });
    context("user is gov", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await adminControls.setBookKeeper(randomAddr);
        expect(await adminControls.bookKeeper()).to.be.equal(randomAddr);
      });
    });
  });
  describe("#setLiquidationEngine", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.setLiquidationEngine(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("zero address", () => {
      it("should revert", async () => {
        await expect(adminControls.setLiquidationEngine(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await adminControls.setLiquidationEngine(randomAddr);
        expect(await adminControls.liquidationEngine()).to.be.equal(randomAddr);
      });
    });
    context("user is gov", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await adminControls.setLiquidationEngine(randomAddr);
        expect(await adminControls.liquidationEngine()).to.be.equal(randomAddr);
      });
    });
  });
  describe("#setPriceOracle", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.setPriceOracle(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("zero address", () => {
      it("should revert", async () => {
        await expect(adminControls.setPriceOracle(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await adminControls.setPriceOracle(randomAddr);
        expect(await adminControls.priceOracle()).to.be.equal(randomAddr);
      });
    });
    context("user is gov", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await adminControls.setPriceOracle(randomAddr);
        expect(await adminControls.priceOracle()).to.be.equal(randomAddr);
      });
    });
  });
  describe("#setPositionManager", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.setPositionManager(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("zero address", () => {
      it("should revert", async () => {
        await expect(adminControls.setPositionManager(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await adminControls.setPositionManager(randomAddr);
        expect(await adminControls.positionManager()).to.be.equal(randomAddr);
      });
    });
    context("user is gov", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await adminControls.setPositionManager(randomAddr);
        expect(await adminControls.positionManager()).to.be.equal(randomAddr);
      });
    });
  });
  describe("#setFlashMintModule", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.setFlashMintModule(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("zero address", () => {
      it("should revert", async () => {
        await expect(adminControls.setFlashMintModule(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await adminControls.setFlashMintModule(randomAddr);
        expect(await adminControls.flashMintModule()).to.be.equal(randomAddr);
      });
    });
    context("user is gov", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await adminControls.setFlashMintModule(randomAddr);
        expect(await adminControls.flashMintModule()).to.be.equal(randomAddr);
      });
    });
  });
  describe("#setStablecoinAdapter", () => {
    context("user has no access", () => {
      it("should revert", async () => {
        await expect(adminControls.setStablecoinAdapter(randomAddr)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("zero address", () => {
      it("should revert", async () => {
        await expect(adminControls.setStablecoinAdapter(AddressZero)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("user is owner", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(OWNER_ROLE, DeployerAddress).returns(true);
        await adminControls.setStablecoinAdapter(randomAddr);
        expect(await adminControls.stablecoinAdapter()).to.be.equal(randomAddr);
      });
    });
    context("user is gov", () => {
      it("should succeed", async () => {
        mockedAccessControlConfig.hasRole.whenCalledWith(GOV_ROLE, DeployerAddress).returns(true);
        await adminControls.setStablecoinAdapter(randomAddr);
        expect(await adminControls.stablecoinAdapter()).to.be.equal(randomAddr);
      });
    });
  });
});
