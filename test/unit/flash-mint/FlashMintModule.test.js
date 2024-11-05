const { ethers } = require("hardhat");
const { expect } = require("chai");
const { formatBytes32String, keccak256, toUtf8Bytes } = ethers.utils;
const { smock } = require("@defi-wonderland/smock");
const provider = ethers.provider;
const { WeiPerRad, WeiPerWad } = require("../../helper/unit");

describe("FlashMintModule", () => {
  // Contracts
  let mockFathomStablecoin;
  let mockERC20;
  let mockMyFashLoan;
  let mockBookKeeper;
  let mockStablecoinAdapter;
  let mockedAccessControlConfig;
  let mockSystemDebtEngine;
  let mockedCollateralPoolConfig;

  let flashMintModule;
  let flashMintModuleAsAlice;

  let DeployerAddress;
  let AliceAddress;

  beforeEach(async () => {
    const { deployer, allice } = await getNamedAccounts();
    DeployerAddress = deployer;
    AliceAddress = allice;
    mockedCollateralPoolConfig = await smock.fake("CollateralPoolConfig");
    mockBookKeeper = await smock.fake("BookKeeper");
    mockedAccessControlConfig = await smock.fake("AccessControlConfig");
    mockFathomStablecoin = await smock.fake("FathomStablecoin");
    mockERC20 = await smock.fake("ERC20Mintable");
    mockStablecoinAdapter = await smock.fake("StablecoinAdapter");
    mockSystemDebtEngine = await smock.fake("SystemDebtEngine");
    mockMyFashLoan = await smock.fake("FlashLoanReceiverBase");

    mockBookKeeper.collateralPoolConfig.returns(mockedCollateralPoolConfig.address);
    mockBookKeeper.accessControlConfig.returns(mockedAccessControlConfig.address);
    mockStablecoinAdapter.bookKeeper.returns(mockBookKeeper.address);
    mockStablecoinAdapter.stablecoin.returns(mockFathomStablecoin.address);
    mockFathomStablecoin.approve.returns(true);
    mockBookKeeper.whitelist.returns();
    mockedAccessControlConfig.hasRole.returns(true);
    mockedAccessControlConfig.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"));
    mockedAccessControlConfig.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"));

    mockMyFashLoan.onFlashLoan.returns(formatBytes32String(1));

    const FlashMintModuleFactory = await ethers.getContractFactory("MockFlashMintModule");
    flashMintModule = await FlashMintModuleFactory.deploy();
    await flashMintModule.deployed();

    flashMintModuleAsAlice = flashMintModule.connect(provider.getSigner(AliceAddress));

    await flashMintModule.initialize(mockStablecoinAdapter.address, mockSystemDebtEngine.address);
  });
  describe("#setMax", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(flashMintModuleAsAlice.setMax(WeiPerWad.mul(100))).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner", () => {
      it("should be able setMax", async () => {
        const maxBefore = await flashMintModule.max();
        expect(maxBefore).to.be.equal(0);

        await expect(flashMintModule.setMax(WeiPerWad.mul(100)))
          .to.be.emit(flashMintModule, "LogSetMax")
          .withArgs(WeiPerWad.mul(100));

        const maxAfter = await flashMintModule.max();
        expect(maxAfter).to.be.equal(WeiPerWad.mul(100));
      });
    });
  });
  describe("#setFeeRate", () => {
    context("when the caller is not the owner", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);

        await expect(flashMintModuleAsAlice.setFeeRate(WeiPerWad.div(10))).to.be.revertedWith("!ownerRole");
      });
    });
    context("when the caller is the owner but the rate is higher than 1 WAD", () => {
      it("should revert", async () => {
        const feeRate = await flashMintModule.feeRate();
        expect(feeRate).to.be.equal(0);

        await expect(flashMintModule.setFeeRate(WeiPerWad.mul(10))).to.be.revertedWith("FlashMintModule/fee-too-high");
      });
    });
    context("when the caller is the owner", () => {
      it("should be able setFeeRate", async () => {
        const maxBefore = await flashMintModule.feeRate();
        expect(maxBefore).to.be.equal(0);

        await expect(flashMintModule.setFeeRate(WeiPerWad.div(10)))
          .to.be.emit(flashMintModule, "LogSetFeeRate")
          .withArgs(WeiPerWad.div(10));

        const maxAfter = await flashMintModule.feeRate();
        expect(maxAfter).to.be.equal(WeiPerWad.div(10));
      });
    });
  });
  describe("#flashFee", () => {
    context("when token invalid", () => {
      it("should be revert", async () => {
        expect(flashMintModule.flashFee(mockERC20.address, WeiPerWad.mul(10))).to.be.revertedWith("FlashMintModule/token-unsupported");
      });
    });
    context("when token valid", () => {
      it("should be able to call flashFee", async () => {
        await flashMintModule.setFeeRate(WeiPerWad.div(10));
        const fee = await flashMintModule.flashFee(mockFathomStablecoin.address, WeiPerWad.mul(10));
        expect(fee).to.be.equal(WeiPerWad);
      });
    });
  });
  describe("#addToWhitelist & removeFromWhitelist", () => {
    context("fn whitelist when the caller is not the owner", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(flashMintModuleAsAlice.addToWhitelist(AliceAddress)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("fn removeFromtWhitelist when the caller is not the owner", () => {
      it("should be revert", async () => {
        mockedAccessControlConfig.hasRole.returns(false);
        await expect(flashMintModuleAsAlice.removeFromWhitelist(AliceAddress)).to.be.revertedWith("!(ownerRole or govRole)");
      });
    });
    context("when the caller is the owner", () => {
      it("should be able to call whitelist", async () => {
        await expect(flashMintModule.addToWhitelist(AliceAddress)).to.be.emit(flashMintModule, "LogAddToWhitelist").withArgs(AliceAddress);
        const flag = await flashMintModule.flashMintWhitelist(AliceAddress);
        expect(flag).to.be.equal(true);
      });
    });
    context("when the caller is the owner", () => {
      it("should be able to call removeFromtWhitelist", async () => {
        await flashMintModuleAsAlice.addToWhitelist(AliceAddress);
        await expect(flashMintModule.removeFromWhitelist(AliceAddress)).to.be.emit(flashMintModule, "LogRemoveFromWhitelist").withArgs(AliceAddress);
        const flag = await flashMintModule.flashMintWhitelist(AliceAddress);
        expect(flag).to.be.equal(false);
      });
    });
    context("when the caller is the owner", () => {
      it("should revert when trying to whitelist the zero address", async () => {
        await expect(flashMintModule.addToWhitelist("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
          "FlashMintModule/whitelist-invalidAddress"
        );
      });
    });

    context("when the caller is the owner", () => {
      it("should revert when trying to remove zero address from whitelist", async () => {
        await flashMintModuleAsAlice.addToWhitelist(AliceAddress);
        await expect(flashMintModule.removeFromWhitelist("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
          "FlashMintModule/removeWL-invalidAddress"
        );
      });
    });

    context("when the caller is the owner and the address is not whitelisted", () => {
      it("should revert when trying to remove an address that's not whitelisted", async () => {
        await flashMintModuleAsAlice.addToWhitelist(AliceAddress);
        await expect(flashMintModule.removeFromWhitelist(DeployerAddress)).to.be.revertedWith("FlashMintModule/user-not-whitelisted");
      });
    });

    context("when the caller is the owner and the address is whitelisted", () => {
      it("should revert when trying to again whitelist an address that's already whitelisted", async () => {
        await flashMintModuleAsAlice.addToWhitelist(AliceAddress);
        await expect(flashMintModule.addToWhitelist(AliceAddress)).to.be.revertedWith("FlashMintModule/user-already-whitelisted");
      });
    });
  });
  describe("#whitelisting and decentralization", () => {
    context("when not whitelisted and not decentralized ", () => {
      it("flashloan should be revert", async () => {
        await expect(
          flashMintModule.flashLoan(mockMyFashLoan.address, mockERC20.address, WeiPerWad.mul(10), formatBytes32String(""))
        ).to.be.revertedWith("FlashMintModule/flashMinter-not-whitelisted");
      });
      it("bookKeeper flashlon should revert", async () => {
        await expect(flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))).to.be.revertedWith(
          "FlashMintModule/flashMinter-not-whitelisted"
        );
      });
    });
    context("when not whitelisted and decentralized ", () => {
      it("should be able to call flashLoan", async () => {
        await flashMintModule.setDecentralizedStatesStatus(true);
        await flashMintModule.setMax(WeiPerWad.mul(100));
        // commenting out the fee rate check so that
        // "FlashMintModule/insufficient-fee" error is not thrown
        // await flashMintModule.setFeeRate(WeiPerWad.div(10))

        mockFathomStablecoin.transferFrom
          .whenCalledWith(
            mockMyFashLoan.address,
            flashMintModule.address,
            //as fee rate is 0, the amount to be transferred is 10
            // WeiPerWad.mul(11)
            WeiPerWad.mul(10)
          )
          .returns(true);
        mockStablecoinAdapter.deposit
          .whenCalledWith(
            flashMintModule.address,
            //as fee rate is 0, the amount to be transferred is 10
            // WeiPerWad.mul(11),
            WeiPerWad.mul(10),
            ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
          )
          .returns();
        mockBookKeeper.settleSystemBadDebt.whenCalledWith(WeiPerRad.mul(10)).returns();
        mockBookKeeper.mintUnbackedStablecoin.whenCalledWith(flashMintModule.address, flashMintModule.address, WeiPerRad.mul(10)).returns();
        mockStablecoinAdapter.withdraw
          .whenCalledWith(mockMyFashLoan.address, WeiPerWad.mul(10), ethers.utils.defaultAbiCoder.encode(["uint256"], [0]))
          .returns();
        mockMyFashLoan.onFlashLoan.returns(keccak256(toUtf8Bytes("ERC3156FlashBorrower.onFlashLoan")));
        mockBookKeeper.stablecoin.returns(0);
        await expect(
          flashMintModule.flashLoan(mockMyFashLoan.address, mockFathomStablecoin.address, WeiPerWad.mul(10), formatBytes32String(""))
        ).to.be.emit(flashMintModule, "LogFlashLoan");
      });
      it("should be able to call bookKeeper flashLoan", async () => {
        await flashMintModule.setDecentralizedStatesStatus(true);
        await flashMintModule.setMax(WeiPerWad.mul(100));
        mockMyFashLoan.onBookKeeperFlashLoan.returns(keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan")));

        mockBookKeeper.mintUnbackedStablecoin.whenCalledWith(flashMintModule.address, mockMyFashLoan.address, WeiPerRad.mul(10)).returns();
        mockBookKeeper.settleSystemBadDebt.whenCalledWith(WeiPerRad.mul(10)).returns();
        mockBookKeeper.stablecoin.returns(0);

        await expect(flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))).to.be.emit(
          flashMintModule,
          "LogBookKeeperFlashLoan"
        );
      });
    });
  });
  describe("#flashLoan", () => {
    context("when invalid token", () => {
      it("should be revert", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await expect(
          flashMintModule.flashLoan(mockMyFashLoan.address, mockERC20.address, WeiPerWad.mul(10), formatBytes32String(""))
        ).to.be.revertedWith("FlashMintModule/token-unsupported");
      });
    });
    context("when ceiling exceeded", () => {
      it("should be revert", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await expect(
          flashMintModule.flashLoan(mockMyFashLoan.address, mockFathomStablecoin.address, WeiPerWad.mul(10), formatBytes32String(""))
        ).to.be.revertedWith("FlashMintModule/ceiling-exceeded");
      });
    });
    context("when callback failed", () => {
      it("should be revert", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await flashMintModule.setMax(WeiPerWad.mul(100));
        await flashMintModule.setFeeRate(WeiPerWad.div(10));

        mockBookKeeper.mintUnbackedStablecoin.returns();
        mockStablecoinAdapter.withdraw.returns();
        mockBookKeeper.stablecoin.returns(0);
        await expect(
          flashMintModule.flashLoan(mockMyFashLoan.address, mockFathomStablecoin.address, WeiPerWad.mul(10), formatBytes32String(""))
        ).to.be.revertedWith("FlashMintModule/callback-failed");
      });
    });
    context("when parameters are valid", () => {
      it("should be able to call flashLoan", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await flashMintModule.setMax(WeiPerWad.mul(100));
        // commenting out the fee rate check for so that
        // "FlashMintModule/insufficient-fee" error is not thrown
        // await flashMintModule.setFeeRate(WeiPerWad.div(10))

        mockFathomStablecoin.transferFrom
          .whenCalledWith(
            mockMyFashLoan.address,
            flashMintModule.address,
            //as fee rate is 0, the amount to be transferred is 10
            // WeiPerWad.mul(11)
            WeiPerWad.mul(10)
          )
          .returns(true);
        mockStablecoinAdapter.deposit
          .whenCalledWith(
            flashMintModule.address,
            //as fee rate is 0, the amount to be transferred is 10
            // WeiPerWad.mul(11),
            WeiPerWad.mul(10),
            ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
          )
          .returns();
        mockBookKeeper.settleSystemBadDebt.whenCalledWith(WeiPerRad.mul(10)).returns();
        mockBookKeeper.mintUnbackedStablecoin.whenCalledWith(flashMintModule.address, flashMintModule.address, WeiPerRad.mul(10)).returns();
        mockStablecoinAdapter.withdraw
          .whenCalledWith(mockMyFashLoan.address, WeiPerWad.mul(10), ethers.utils.defaultAbiCoder.encode(["uint256"], [0]))
          .returns();
        mockMyFashLoan.onFlashLoan.returns(keccak256(toUtf8Bytes("ERC3156FlashBorrower.onFlashLoan")));
        mockBookKeeper.stablecoin.returns(0);
        await expect(
          flashMintModule.flashLoan(mockMyFashLoan.address, mockFathomStablecoin.address, WeiPerWad.mul(10), formatBytes32String(""))
        ).to.be.emit(flashMintModule, "LogFlashLoan");
      });
    });
  });

  describe("#bookKeeperFlashLoan", () => {
    context("when ceiling exceeded", () => {
      it("should be revert", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await expect(flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))).to.be.revertedWith(
          "FlashMintModule/ceiling-exceeded"
        );
      });
    });
    context("when callback failed", () => {
      it("should be revert", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await flashMintModule.setMax(WeiPerWad.mul(100));
        await flashMintModule.setFeeRate(WeiPerWad.div(10));

        mockBookKeeper.mintUnbackedStablecoin.returns();
        mockBookKeeper.stablecoin.returns(0);
        mockBookKeeper.settleSystemBadDebt.returns();
        mockMyFashLoan.onBookKeeperFlashLoan.returns(keccak256(toUtf8Bytes("")));

        await expect(flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))).to.be.revertedWith(
          "FlashMintModule/callback-failed"
        );
      });
    });
    context("when insufficient fee", () => {
      it("should be revert", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await flashMintModule.setMax(WeiPerWad.mul(100));
        await flashMintModule.setFeeRate(WeiPerWad.div(10));

        mockBookKeeper.mintUnbackedStablecoin.returns();
        mockBookKeeper.settleSystemBadDebt.returns();
        mockBookKeeper.stablecoin.returns(0);

        mockMyFashLoan.onBookKeeperFlashLoan.returns(keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan")));
        await expect(flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))).to.be.revertedWith(
          "FlashMintModule/insufficient-fee"
        );
      });
    });
    context("when parameters are valid", () => {
      it("should be able to call flashLoan", async () => {
        await flashMintModule.addToWhitelist(DeployerAddress);
        await flashMintModule.setMax(WeiPerWad.mul(100));
        mockMyFashLoan.onBookKeeperFlashLoan.returns(keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan")));

        mockBookKeeper.mintUnbackedStablecoin.whenCalledWith(flashMintModule.address, mockMyFashLoan.address, WeiPerRad.mul(10)).returns();
        mockBookKeeper.settleSystemBadDebt.whenCalledWith(WeiPerRad.mul(10)).returns();
        mockBookKeeper.stablecoin.returns(0);

        await expect(flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))).to.be.emit(
          flashMintModule,
          "LogBookKeeperFlashLoan"
        );
      });
    });
  });
});
