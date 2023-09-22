const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { BigNumber, ethers } = require("ethers");
const { formatBytes32String } = require("ethers/lib/utils");

const { formatBytes32BigNumber } = require("../../helper/format");
const { DeployerAddress, AliceAddress, AddressZero } = require("../../helper/address");
const UnitHelpers = require("../../helper/unit");
const { getContract, createMock } = require("../../helper/contracts");
const { loadFixture } = require("../../helper/fixtures");

const LIQUIDATION_ENGINE_ROLE = '0x73cc1824a5ac1764c2e141cf3615a9dcb73677c4e5be5154addc88d3e0cc1480'

const loadFixtureHandler = async () => {
    const mockedCollateralTokenAdapter = await createMock("TokenAdapter");
    const mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    const mockedBookKeeper = await createMock("BookKeeper");
    const mockedAccessControlConfig = await createMock("AccessControlConfig");
    const mockedLiquidationEngine = await createMock("LiquidationEngine");
    const mockedSystemDebtEngine = await createMock("SystemDebtEngine");
    const mockedPriceOracle = await createMock("PriceOracle");
    const mockedFlashLendingCallee = await createMock("IFlashLendingCallee");
    const mockedPriceFeed = await createMock("SimplePriceFeed");
    const mockedStablecoinAdapter = await createMock("StablecoinAdapter")

    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
    await mockedCollateralPoolConfig.mock.getPriceFeed.returns(mockedPriceFeed.address)

    await mockedBookKeeper.mock.totalStablecoinIssued.returns(BigNumber.from("0"))
    await mockedLiquidationEngine.mock.live.returns(BigNumber.from("1"))
    await mockedSystemDebtEngine.mock.surplusBuffer.returns(BigNumber.from("0"))
    await mockedPriceOracle.mock.stableCoinReferencePrice.returns(BigNumber.from("0"))
    await mockedAccessControlConfig.mock.hasRole.returns(true)
    
    await mockedAccessControlConfig.mock.LIQUIDATION_ENGINE_ROLE.returns(LIQUIDATION_ENGINE_ROLE) //keccak256 of LIQUIDATION_ENGINE_ROLE
    await mockedStablecoinAdapter.mock.stablecoin.returns(DeployerAddress);

    const fixedSpreadLiquidationStrategy = getContract("FixedSpreadLiquidationStrategy", DeployerAddress)
    const fixedSpreadLiquidationStrategyAsAlice = getContract("FixedSpreadLiquidationStrategy", AliceAddress)

    await fixedSpreadLiquidationStrategy.initialize(
        mockedBookKeeper.address,
        mockedPriceOracle.address,
        mockedLiquidationEngine.address,
        mockedSystemDebtEngine.address,
        mockedStablecoinAdapter.address
    );

    return {
        fixedSpreadLiquidationStrategy,
        fixedSpreadLiquidationStrategyAsAlice,
        mockedBookKeeper,
        mockedPriceOracle,
        mockedPriceFeed,
        mockedSystemDebtEngine,
        mockedFlashLendingCallee,
        mockedCollateralTokenAdapter,
        mockedCollateralPoolConfig,
        mockedAccessControlConfig
    }
}

describe("FixedSpreadLiquidationStrategy", () => {
    // Contracts
    let mockedBookKeeper
    let mockedPriceOracle
    let mockedPriceFeed
    let mockedSystemDebtEngine
    let mockedFlashLendingCallee
    let mockedCollateralTokenAdapter
    let mockedCollateralPoolConfig
    let mockedAccessControlConfig

    let fixedSpreadLiquidationStrategy
    let fixedSpreadLiquidationStrategyAsAlice

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ; ({
            fixedSpreadLiquidationStrategy,
            fixedSpreadLiquidationStrategyAsAlice,
            mockedBookKeeper,
            mockedPriceOracle,
            mockedPriceFeed,
            mockedSystemDebtEngine,
            mockedFlashLendingCallee,
            mockedCollateralTokenAdapter,
            mockedCollateralPoolConfig,
            mockedAccessControlConfig,
        } = await loadFixture(loadFixtureHandler))
    })

    describe("#execute", () => {
        context("when the caller is not allowed", () => {
            it("should be revert", async () => {
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(
                    fixedSpreadLiquidationStrategyAsAlice.execute(
                        formatBytes32String("WXDC"),
                        UnitHelpers.WeiPerRad,
                        UnitHelpers.WeiPerWad,
                        AliceAddress,
                        UnitHelpers.WeiPerWad,
                        UnitHelpers.WeiPerWad,
                        DeployerAddress,
                        DeployerAddress,
                        "0x"
                    )
                ).to.be.revertedWith("!liquidationEngingRole")
            })
        })
        context("when input is invalid", () => {
            context("when positionDebtShare <= 0", () => {
                it("should be revert", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await expect(
                        fixedSpreadLiquidationStrategy.execute(
                            formatBytes32String("WXDC"),
                            0,
                            UnitHelpers.WeiPerWad,
                            AliceAddress,
                            UnitHelpers.WeiPerWad,
                            UnitHelpers.WeiPerWad,
                            DeployerAddress,
                            DeployerAddress,
                            "0x"
                        )
                    ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-debt")
                })
            })

            context("when positionCollateralAmount <= 0", () => {
                it("should be revert", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await expect(
                        fixedSpreadLiquidationStrategy.execute(
                            formatBytes32String("WXDC"),
                            UnitHelpers.WeiPerWad,
                            0,
                            AliceAddress,
                            UnitHelpers.WeiPerWad,
                            UnitHelpers.WeiPerWad,
                            DeployerAddress,
                            DeployerAddress,
                            "0x"
                        )
                    ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-collateral-amount")
                })
            })

            context("when positionAddress == 0", () => {
                it("should be revert", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await expect(
                        fixedSpreadLiquidationStrategy.execute(
                            formatBytes32String("WXDC"),
                            UnitHelpers.WeiPerWad,
                            UnitHelpers.WeiPerWad,
                            AddressZero,
                            UnitHelpers.WeiPerWad,
                            UnitHelpers.WeiPerWad,
                            DeployerAddress,
                            DeployerAddress,
                            ethers.utils.defaultAbiCoder.encode(["address", "bytes"], [DeployerAddress, []])
                        )
                    ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-position-address")
                })
            })
        })

        context("when feedprice is invalid", () => {
            context("when priceFeed marked price as not ok", () => {
                it("should be revert", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await mockedPriceFeed.mock.peekPrice.returns(
                        formatBytes32BigNumber(BigNumber.from("700000000000")),
                        false,
                    )

                    await expect(
                        fixedSpreadLiquidationStrategy.execute(
                            formatBytes32String("WXDC"),
                            UnitHelpers.WeiPerRad,
                            UnitHelpers.WeiPerWad,
                            AliceAddress,
                            UnitHelpers.WeiPerWad,
                            UnitHelpers.WeiPerWad,
                            DeployerAddress,
                            DeployerAddress,
                            "0x"
                        )
                    ).to.be.revertedWith("FixedSpreadLiquidationStrategy/invalid-price")
                })
            })
            context("feedprice <= 0", () => {
                it("should be revert", async () => {
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await mockedPriceOracle.mock.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)
                    await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(BigNumber.from("0")), true)

                    await expect(
                        fixedSpreadLiquidationStrategy.execute(
                            formatBytes32String("WXDC"),
                            UnitHelpers.WeiPerRad,
                            UnitHelpers.WeiPerWad,
                            AliceAddress,
                            UnitHelpers.WeiPerWad,
                            UnitHelpers.WeiPerWad,
                            DeployerAddress,
                            DeployerAddress,
                            "0x"
                        )
                    ).to.be.revertedWith("FixedSpreadLiquidationStrategy/zero-collateral-price")
                })
            })
        })

        context("when contract doesn't call FlashLending", () => {
            context("when feedprice == 1", () => {
                context("and debtAccumulatedRate == 2", () => {
                    xit("should be success", async () => {
                        await mockedAccessControlConfig.mock.hasRole.returns(true)
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(2))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(10 ** 10)
                        await mockedCollateralPoolConfig.mock.getCloseFactorBps.returns(10000)
                        await mockedCollateralPoolConfig.mock.getLiquidatorIncentiveBps.returns(10250)
                        await mockedCollateralPoolConfig.mock.getTreasuryFeesBps.returns(2500)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(10)
                        await mockedCollateralPoolConfig.mock.getAdapter.returns(mockedCollateralTokenAdapter.address)

                        await mockedBookKeeper.mock.confiscatePosition.withArgs(
                            formatBytes32String("WXDC"),
                            AliceAddress,
                            fixedSpreadLiquidationStrategy.address,
                            mockedSystemDebtEngine.address,
                            ethers.utils.parseEther("2.05").mul(-1),
                            UnitHelpers.WeiPerWad.mul(-1)
                        ).returns()
                        await mockedBookKeeper.mock.moveCollateral.withArgs(
                            formatBytes32String("WXDC"),
                            fixedSpreadLiquidationStrategy.address,
                            DeployerAddress,
                            ethers.utils.parseEther("2.0375")
                        ).returns()
                        await mockedBookKeeper.mock.moveCollateral.withArgs(
                            formatBytes32String("WXDC"),
                            fixedSpreadLiquidationStrategy.address,
                            mockedSystemDebtEngine.address,
                            ethers.utils.parseEther("0.0125")
                        ).returns()
                        await mockedBookKeeper.mock.moveStablecoin.returns()
                        await mockedPriceOracle.mock.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)
                        await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(UnitHelpers.WeiPerWad), true)

                        await expect(
                            fixedSpreadLiquidationStrategy.execute(
                                formatBytes32String("WXDC"),
                                UnitHelpers.WeiPerWad,
                                UnitHelpers.WeiPerWad.mul(7),
                                AliceAddress,
                                UnitHelpers.WeiPerWad,
                                UnitHelpers.WeiPerWad,
                                DeployerAddress,
                                DeployerAddress,
                                "0x"
                            )
                        )
                            .to.emit(fixedSpreadLiquidationStrategy, "LogFixedSpreadLiquidate")
                            .withArgs(
                                formatBytes32String("WXDC"),
                                UnitHelpers.WeiPerWad,
                                UnitHelpers.WeiPerWad.mul(7),
                                AliceAddress,
                                UnitHelpers.WeiPerWad,
                                UnitHelpers.WeiPerWad,
                                DeployerAddress,
                                DeployerAddress,
                                UnitHelpers.WeiPerWad,
                                UnitHelpers.WeiPerRad.mul(2),
                                ethers.utils.parseEther("2.05"),
                                ethers.utils.parseEther("0.0125")
                            )
                    })
                })

                context("and debtAccumulatedRate == 12345", () => {
                    xit("should be success", async () => {
                        await mockedAccessControlConfig.mock.hasRole.returns(true)
                        await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(12345))
                        await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay)
                        await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(10 ** 10)
                        await mockedCollateralPoolConfig.mock.getCloseFactorBps.returns(5000)
                        await mockedCollateralPoolConfig.mock.getLiquidatorIncentiveBps.returns(10300)
                        await mockedCollateralPoolConfig.mock.getTreasuryFeesBps.returns(700)
                        await mockedCollateralPoolConfig.mock.getDebtFloor.returns(10)
                        await mockedCollateralPoolConfig.mock.getAdapter.returns(mockedCollateralTokenAdapter.address)

                        await mockedBookKeeper.mock.confiscatePosition.withArgs(
                            formatBytes32String("WXDC"),
                            AliceAddress,
                            fixedSpreadLiquidationStrategy.address,
                            mockedSystemDebtEngine.address,
                            UnitHelpers.WeiPerWad.mul(-158941875).div(100000),
                            UnitHelpers.WeiPerWad.mul(-25).div(100)
                        ).returns()
                        await mockedBookKeeper.mock.moveCollateral.withArgs(
                            formatBytes32String("WXDC"),
                            fixedSpreadLiquidationStrategy.address,
                            DeployerAddress,
                            ethers.utils.parseEther("1586.1781875")
                        ).returns()
                        await mockedBookKeeper.mock.moveCollateral.withArgs(
                            formatBytes32String("WXDC"),
                            fixedSpreadLiquidationStrategy.address,
                            mockedSystemDebtEngine.address,
                            ethers.utils.parseEther("3.2405625")
                        ).returns()
                        await mockedBookKeeper.mock.moveStablecoin.returns()
                        await mockedPriceOracle.mock.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)
                        await mockedPriceFeed.mock.peekPrice.returns(
                            formatBytes32BigNumber(UnitHelpers.WeiPerWad.mul(2)),
                            true,
                        )

                        await fixedSpreadLiquidationStrategy.execute(
                            formatBytes32String("WXDC"),
                            UnitHelpers.WeiPerWad,
                            UnitHelpers.WeiPerWad.mul(98765),
                            AliceAddress,
                            UnitHelpers.WeiPerWad.div(4),
                            UnitHelpers.WeiPerWad.div(4),
                            DeployerAddress,
                            DeployerAddress,
                            "0x"
                        )
                    })
                })
            })
        })

        context("when contract call FlashLending", () => {
            xit("should be success", async () => {
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedAccessControlConfig.mock.hasRole.returns(true)
                await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32BigNumber(BigNumber.from("1")))
                await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32BigNumber(BigNumber.from("1")))
                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay.mul(3))
                await mockedCollateralPoolConfig.mock.getPriceWithSafetyMargin.returns(UnitHelpers.WeiPerRay)
                await mockedCollateralPoolConfig.mock.getLiquidationRatio.returns(10 ** 10)
                await mockedCollateralPoolConfig.mock.getCloseFactorBps.returns(5000)
                await mockedCollateralPoolConfig.mock.getLiquidatorIncentiveBps.returns(10001)
                await mockedCollateralPoolConfig.mock.getTreasuryFeesBps.returns(17)
                await mockedCollateralPoolConfig.mock.getDebtFloor.returns(10)
                await mockedCollateralPoolConfig.mock.getAdapter.returns(mockedCollateralTokenAdapter.address)

                await mockedBookKeeper.mock.confiscatePosition.withArgs(
                    formatBytes32String("WXDC"),
                    AliceAddress,
                    fixedSpreadLiquidationStrategy.address,
                    mockedSystemDebtEngine.address,
                    UnitHelpers.WeiPerWad.mul(-1110111).div(1000000),
                    UnitHelpers.WeiPerWad.mul(-37).div(100)
                ).returns()
                await mockedBookKeeper.mock.moveCollateral.withArgs(
                    formatBytes32String("WXDC"),
                    fixedSpreadLiquidationStrategy.address,
                    mockedFlashLendingCallee.address,
                    ethers.utils.parseEther("1.1101108113")
                ).returns()
                await mockedBookKeeper.mock.moveCollateral.withArgs(
                    formatBytes32String("WXDC"),
                    fixedSpreadLiquidationStrategy.address,
                    mockedSystemDebtEngine.address,
                    ethers.utils.parseEther("0.0000001887")
                ).returns()
                await mockedBookKeeper.mock.moveStablecoin.returns()
                await mockedPriceOracle.mock.stableCoinReferencePrice.returns(UnitHelpers.WeiPerRay)

                await mockedPriceFeed.mock.peekPrice.returns(formatBytes32BigNumber(UnitHelpers.WeiPerWad), true)
                await mockedFlashLendingCallee.mock.flashLendingCall.returns()

                await fixedSpreadLiquidationStrategy.setFlashLendingEnabled(1)

                await expect(
                    fixedSpreadLiquidationStrategy.execute(
                        formatBytes32String("WXDC"),
                        UnitHelpers.WeiPerWad,
                        UnitHelpers.WeiPerWad.mul(8),
                        AliceAddress,
                        UnitHelpers.WeiPerWad.mul(37).div(100),
                        UnitHelpers.WeiPerWad.mul(37).div(100),
                        DeployerAddress,
                        mockedFlashLendingCallee.address,
                        ethers.utils.defaultAbiCoder.encode(
                            ["bytes"],
                            [ethers.utils.defaultAbiCoder.encode(["address"], [AliceAddress])]
                        )
                    )
                )
                    .to.emit(fixedSpreadLiquidationStrategy, "LogFixedSpreadLiquidate")
                    .withArgs(
                        formatBytes32String("WXDC"),
                        UnitHelpers.WeiPerWad,
                        UnitHelpers.WeiPerWad.mul(8),
                        AliceAddress,
                        UnitHelpers.WeiPerWad.mul(37).div(100),
                        UnitHelpers.WeiPerWad.mul(37).div(100),
                        DeployerAddress,
                        mockedFlashLendingCallee.address,
                        UnitHelpers.WeiPerWad.mul(37).div(100),
                        ethers.utils.parseEther("1.11").mul(UnitHelpers.WeiPerRay),
                        ethers.utils.parseEther("1.110111"),
                        ethers.utils.parseEther("0.0000001887")
                    )
            })
        })
    })
})
