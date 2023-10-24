const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { formatBytes32String, keccak256, toUtf8Bytes } = ethers.utils

const { DeployerAddress, AliceAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../../helper/unit");
const { loadFixture } = require("../../helper/fixtures");

const loadFixtureHandler = async () => {
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    const mockBookKeeper = await createMock("BookKeeper");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");
    const mockFathomStablecoin = await createMock("FathomStablecoin");
    const mockERC20 = await createMock("ERC20Mintable");
    const mockStablecoinAdapter = await createMock("StablecoinAdapter");
    const mockSystemDebtEngine = await createMock("SystemDebtEngine");
    const mockMyFashLoan = await createMock("FlashLoanReceiverBase");

    await mockBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    await mockBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
    await mockStablecoinAdapter.mock.bookKeeper.returns(mockBookKeeper.address)
    await mockStablecoinAdapter.mock.stablecoin.returns(mockFathomStablecoin.address)
    await mockFathomStablecoin.mock.approve.returns(true)
    await mockBookKeeper.mock.whitelist.returns()
    await mockedAccessControlConfig.mock.hasRole.returns(true)
    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockMyFashLoan.mock.onFlashLoan.returns(formatBytes32String(1))

    const flashMintModule = getContract("FlashMintModule", DeployerAddress)
    const flashMintModuleAsAlice = getContract("FlashMintModule", AliceAddress)

    await flashMintModule.initialize(mockStablecoinAdapter.address, mockSystemDebtEngine.address)

    return {
        flashMintModule,
        flashMintModuleAsAlice,
        mockFathomStablecoin,
        mockMyFashLoan,
        mockERC20,
        mockBookKeeper,
        mockStablecoinAdapter,
        mockedAccessControlConfig
    }
}

describe("FlashMintModule", () => {
    // Contracts
    let mockFathomStablecoin
    let mockERC20
    let mockMyFashLoan
    let mockBookKeeper
    let mockStablecoinAdapter
    let mockedAccessControlConfig

    let flashMintModule
    let flashMintModuleAsAlice

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ; ({
            flashMintModule,
            flashMintModuleAsAlice,
            mockFathomStablecoin,
            mockMyFashLoan,
            mockERC20,
            mockBookKeeper,
            mockStablecoinAdapter,
            mockedAccessControlConfig,
        } = await loadFixture(loadFixtureHandler))
    })
    describe("#setMax", () => {
        context("when the caller is not the owner", () => {
            it("should be revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(flashMintModuleAsAlice.setMax(WeiPerWad.mul(100))).to.be.revertedWith("!ownerRole")
            })
        })
        context("when the caller is the owner", () => {
            it("should be able setMax", async () => {
                const maxBefore = await flashMintModule.max()
                expect(maxBefore).to.be.equal(0)

                await expect(flashMintModule.setMax(WeiPerWad.mul(100)))
                    .to.be.emit(flashMintModule, "LogSetMax")
                    .withArgs(WeiPerWad.mul(100))

                const maxAfter = await flashMintModule.max()
                expect(maxAfter).to.be.equal(WeiPerWad.mul(100))
            })
        })
    })
    describe("#setFeeRate", () => {
        context("when the caller is not the owner", () => {
            it("should be revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(flashMintModuleAsAlice.setFeeRate(WeiPerWad.div(10))).to.be.revertedWith("!ownerRole")
            })
        })
        context("when the caller is the owner", () => {
            it("should be able setFeeRate", async () => {
                const maxBefore = await flashMintModule.feeRate()
                expect(maxBefore).to.be.equal(0)

                await expect(flashMintModule.setFeeRate(WeiPerWad.div(10)))
                    .to.be.emit(flashMintModule, "LogSetFeeRate")
                    .withArgs(WeiPerWad.div(10))

                const maxAfter = await flashMintModule.feeRate()
                expect(maxAfter).to.be.equal(WeiPerWad.div(10))
            })
        })
    })
    describe("#flashFee", () => {
        context("when token invalid", () => {
            it("should be revert", async () => {
                expect(flashMintModule.flashFee(mockERC20.address, WeiPerWad.mul(10))).to.be.revertedWith(
                    "FlashMintModule/token-unsupported"
                )
            })
        })
        context("when token valid", () => {
            it("should be able to call flashFee", async () => {
                await flashMintModule.setFeeRate(WeiPerWad.div(10))
                const fee = await flashMintModule.flashFee(mockFathomStablecoin.address, WeiPerWad.mul(10))
                expect(fee).to.be.equal(WeiPerWad)
            })
        })
    })
    describe("#whitelisting and decentralization", () => {
        context("when not whitelisted and not decentralized ", () => {
            it("flashloan should be revert", async () => {
                await expect(
                    flashMintModule.flashLoan(
                        mockMyFashLoan.address,
                        mockERC20.address,
                        WeiPerWad.mul(10),
                        formatBytes32String("")
                    )
                ).to.be.revertedWith("FlashMintModule/flashMinter-not-whitelisted")
            })
            it("bookKeeper flashlon should revert", async () => {
                await expect(
                    flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
                ).to.be.revertedWith("FlashMintModule/flashMinter-not-whitelisted")
            })
        })
        context("when not whitelisted and decentralized ", () => {
            it("should be able to call flashLoan", async () => {
                await flashMintModule.setDecentralizedStatesStatus(true);
                await flashMintModule.setMax(WeiPerWad.mul(100))
                await flashMintModule.setFeeRate(WeiPerWad.div(10))

                await mockFathomStablecoin.mock.transferFrom.withArgs(
                    mockMyFashLoan.address,
                    flashMintModule.address,
                    WeiPerWad.mul(11)
                ).returns(true)
                await mockStablecoinAdapter.mock.deposit.withArgs(
                    flashMintModule.address,
                    WeiPerWad.mul(11),
                    ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
                ).returns()
                await mockBookKeeper.mock.settleSystemBadDebt.withArgs(WeiPerRad.mul(10)).returns()
                await mockBookKeeper.mock.mintUnbackedStablecoin.withArgs(
                    flashMintModule.address,
                    flashMintModule.address,
                    WeiPerRad.mul(10)
                ).returns()
                await mockStablecoinAdapter.mock.withdraw.withArgs(
                    mockMyFashLoan.address,
                    WeiPerWad.mul(10),
                    ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
                ).returns()
                await mockMyFashLoan.mock.onFlashLoan.returns(keccak256(toUtf8Bytes("ERC3156FlashBorrower.onFlashLoan")))
                await expect(
                    flashMintModule.flashLoan(
                        mockMyFashLoan.address,
                        mockFathomStablecoin.address,
                        WeiPerWad.mul(10),
                        formatBytes32String("")
                    )
                ).to.be.emit(flashMintModule, "LogFlashLoan")
            })
            it("should be able to call bookKeeper flashLoan", async () => {
                await flashMintModule.setDecentralizedStatesStatus(true);
                await flashMintModule.setMax(WeiPerWad.mul(100))
                await mockMyFashLoan.mock.onBookKeeperFlashLoan.returns(
                    keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan"))
                )

                await mockBookKeeper.mock.mintUnbackedStablecoin.withArgs(
                    flashMintModule.address,
                    mockMyFashLoan.address,
                    WeiPerRad.mul(10)
                ).returns()
                await mockBookKeeper.mock.settleSystemBadDebt.withArgs(
                    WeiPerRad.mul(10)
                ).returns()
                await mockBookKeeper.mock.stablecoin.returns(0)

                await expect(
                    flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
                ).to.be.emit(flashMintModule, "LogBookKeeperFlashLoan")
            })
        })
    })
    describe("#flashLoan", () => {
        context("when invalid token", () => {
            it("should be revert", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await expect(
                    flashMintModule.flashLoan(
                        mockMyFashLoan.address,
                        mockERC20.address,
                        WeiPerWad.mul(10),
                        formatBytes32String("")
                    )
                ).to.be.revertedWith("FlashMintModule/token-unsupported")
            })
        })
        context("when ceiling exceeded", () => {
            it("should be revert", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await expect(
                    flashMintModule.flashLoan(
                        mockMyFashLoan.address,
                        mockFathomStablecoin.address,
                        WeiPerWad.mul(10),
                        formatBytes32String("")
                    )
                ).to.be.revertedWith("FlashMintModule/ceiling-exceeded")
            })
        })
        context("when callback failed", () => {
            it("should be revert", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await flashMintModule.setMax(WeiPerWad.mul(100))
                await flashMintModule.setFeeRate(WeiPerWad.div(10))

                await mockBookKeeper.mock.mintUnbackedStablecoin.returns()
                await mockStablecoinAdapter.mock.withdraw.returns()

                await expect(
                    flashMintModule.flashLoan(
                        mockMyFashLoan.address,
                        mockFathomStablecoin.address,
                        WeiPerWad.mul(10),
                        formatBytes32String("")
                    )
                ).to.be.revertedWith("FlashMintModule/callback-failed")
            })
        })
        context("when parameters are valid", () => {
            it("should be able to call flashLoan", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await flashMintModule.setMax(WeiPerWad.mul(100))
                await flashMintModule.setFeeRate(WeiPerWad.div(10))

                await mockFathomStablecoin.mock.transferFrom.withArgs(
                    mockMyFashLoan.address,
                    flashMintModule.address,
                    WeiPerWad.mul(11)
                ).returns(true)
                await mockStablecoinAdapter.mock.deposit.withArgs(
                    flashMintModule.address,
                    WeiPerWad.mul(11),
                    ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
                ).returns()
                await mockBookKeeper.mock.settleSystemBadDebt.withArgs(WeiPerRad.mul(10)).returns()
                await mockBookKeeper.mock.mintUnbackedStablecoin.withArgs(
                    flashMintModule.address,
                    flashMintModule.address,
                    WeiPerRad.mul(10)
                ).returns()
                await mockStablecoinAdapter.mock.withdraw.withArgs(
                    mockMyFashLoan.address,
                    WeiPerWad.mul(10),
                    ethers.utils.defaultAbiCoder.encode(["uint256"], [0])
                ).returns()
                await mockMyFashLoan.mock.onFlashLoan.returns(keccak256(toUtf8Bytes("ERC3156FlashBorrower.onFlashLoan")))
                await expect(
                    flashMintModule.flashLoan(
                        mockMyFashLoan.address,
                        mockFathomStablecoin.address,
                        WeiPerWad.mul(10),
                        formatBytes32String("")
                    )
                ).to.be.emit(flashMintModule, "LogFlashLoan")
            })
        })
    })

    describe("#bookKeeperFlashLoan", () => {
        context("when ceiling exceeded", () => {
            it("should be revert", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await expect(
                    flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
                ).to.be.revertedWith("FlashMintModule/ceiling-exceeded")
            })
        })
        context("when callback failed", () => {
            it("should be revert", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await flashMintModule.setMax(WeiPerWad.mul(100))
                await flashMintModule.setFeeRate(WeiPerWad.div(10))

                await mockBookKeeper.mock.mintUnbackedStablecoin.returns()
                await mockBookKeeper.mock.stablecoin.returns(0)
                await mockBookKeeper.mock.settleSystemBadDebt.returns()
                await mockMyFashLoan.mock.onBookKeeperFlashLoan.returns(
                    keccak256(toUtf8Bytes(""))
                )

                await expect(
                    flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
                ).to.be.revertedWith("FlashMintModule/callback-failed")
            })
        })
        context("when insufficient fee", () => {
            it("should be revert", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await flashMintModule.setMax(WeiPerWad.mul(100))
                await flashMintModule.setFeeRate(WeiPerWad.div(10))

                await mockBookKeeper.mock.mintUnbackedStablecoin.returns()
                await mockBookKeeper.mock.settleSystemBadDebt.returns()
                await mockBookKeeper.mock.stablecoin.returns(0)

                await mockMyFashLoan.mock.onBookKeeperFlashLoan.returns(
                    keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan"))
                )
                await expect(
                    flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
                ).to.be.revertedWith("FlashMintModule/insufficient-fee")
            })
        })
        context("when parameters are valid", () => {
            it("should be able to call flashLoan", async () => {
                await flashMintModule.whitelist(DeployerAddress);
                await flashMintModule.setMax(WeiPerWad.mul(100))
                await mockMyFashLoan.mock.onBookKeeperFlashLoan.returns(
                    keccak256(toUtf8Bytes("BookKeeperFlashBorrower.onBookKeeperFlashLoan"))
                )

                await mockBookKeeper.mock.mintUnbackedStablecoin.withArgs(
                    flashMintModule.address,
                    mockMyFashLoan.address,
                    WeiPerRad.mul(10)
                ).returns()
                await mockBookKeeper.mock.settleSystemBadDebt.withArgs(
                    WeiPerRad.mul(10)
                ).returns()
                await mockBookKeeper.mock.stablecoin.returns(0)

                await expect(
                    flashMintModule.bookKeeperFlashLoan(mockMyFashLoan.address, WeiPerRad.mul(10), formatBytes32String(""))
                ).to.be.emit(flashMintModule, "LogBookKeeperFlashLoan")
            })
        })
    })
})
