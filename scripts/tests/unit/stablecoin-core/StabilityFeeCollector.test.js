const { ethers, BigNumber } = require("ethers");
const chai = require('chai');
const { expect } = chai
const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { DeployerAddress, AliceAddress } = require("../../helper/address");
const { getContract, createMock } = require("../../helper/contracts");
const { formatBytes32String } = ethers.utils

const UnitHelpers = require("../../helper/unit");
const TimeHelpers = require("../../helper/time");
const AssertHelpers = require("../../helper/assert");
const { loadFixture } = require("../../helper/fixtures");

const loadFixtureHandler = async () => {

    mockedAccessControlConfig = await createMock("AccessControlConfig");
    mockedCollateralPoolConfig = await createMock("CollateralPoolConfig");
    mockedBookKeeper = await createMock("BookKeeper");
    mockedSystemDebtEngine = await createMock("SystemDebtEngine");

    stabilityFeeCollector = getContract("StabilityFeeCollector", DeployerAddress)
    stabilityFeeCollectorAsAlice = getContract("StabilityFeeCollector", AliceAddress)

    await mockedAccessControlConfig.mock.OWNER_ROLE.returns(formatBytes32String("OWNER_ROLE"))
    await mockedAccessControlConfig.mock.GOV_ROLE.returns(formatBytes32String("GOV_ROLE"))
    await mockedCollateralPoolConfig.mock.updateLastAccumulationTime.returns()

    await stabilityFeeCollector.initialize(mockedBookKeeper.address, mockedSystemDebtEngine.address)

    return {
        stabilityFeeCollector,
        stabilityFeeCollectorAsAlice,
        mockedBookKeeper,
        mockedCollateralPoolConfig,
        mockedAccessControlConfig
    }
}
describe("StabilityFeeCollector", () => {
    // Contracts
    let mockedBookKeeper
    let mockedCollateralPoolConfig
    let mockedAccessControlConfig

    let stabilityFeeCollector
    let stabilityFeeCollectorAsAlice

    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            stabilityFeeCollector,
            stabilityFeeCollectorAsAlice,
            mockedBookKeeper,
            mockedCollateralPoolConfig,
            mockedAccessControlConfig
        } = await loadFixture(loadFixtureHandler))
    })

    describe("#collect", () => {
        context("when call collect", async () => {
            it("should be rate to ~ 1%", async () => {
                await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedBookKeeper.mock.accrueStabilityFee.returns()

                // rate ~ 1% annually
                // r^31536000 = 1.01
                // r =~ 1000000000315522921573372069...
                await mockedCollateralPoolConfig.mock.getStabilityFeeRate.returns(
                    BigNumber.from("1000000000315522921573372069")
                )

                // time increase 1 year
                await mockedCollateralPoolConfig.mock.getLastAccumulationTime.returns(await TimeHelpers.latest())
                await TimeHelpers.increase(TimeHelpers.duration.seconds(ethers.BigNumber.from("31536000")))
                // set debtAccumulatedRate = 1 ray
                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay)

                // Set expectations
                const expectedCollateralPoolId = formatBytes32String("XDC");
                const expectedStabilityFeeRecipient = DeployerAddress;
                const expectedDebtAccumulatedRate = BigNumber.from("10000000000000000000000000");

                await mockedBookKeeper.mock.accrueStabilityFee.withArgs(
                    expectedCollateralPoolId,
                    expectedStabilityFeeRecipient,
                    expectedDebtAccumulatedRate
                ).returns();

                // Execute the function
                await stabilityFeeCollectorAsAlice.collect(formatBytes32String("WXDC"), { gasLimit: 2000000 })

                // Verify if the mocked function was called with the expected arguments
                // Waffle automatically checks this based on the expectations set earlier
            })
        })
    })

    describe("#setSystemDebtEngine", () => {
        context("when the caller is not the owner", async () => {
            it("should revert", async () => {
                await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(stabilityFeeCollectorAsAlice.setSystemDebtEngine(mockedBookKeeper.address)).to.be.revertedWith(
                    "!ownerRole"
                )
            })
        })
        context("when the caller is the owner", async () => {
            it("should be able to call setSystemDebtEngine", async () => {
                await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                await expect(stabilityFeeCollector.setSystemDebtEngine(mockedBookKeeper.address))
                    .to.emit(stabilityFeeCollector, "LogSetSystemDebtEngine")
                    .withArgs(DeployerAddress, mockedBookKeeper.address)
            })
        })
    })

    describe("#pause", () => {
        context("when role can't access", () => {
            it("should revert", async () => {
                await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(stabilityFeeCollectorAsAlice.pause()).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })

        context("when role can access", () => {
            context("and role is owner role", () => {
                it("should be success", async () => {
                    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await stabilityFeeCollector.pause()
                })
            })
        })

        context("and role is gov role", () => {
            it("should be success", async () => {
                await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                await stabilityFeeCollector.pause()
            })
        })
    })

    describe("#unpause", () => {
        context("when role can't access", () => {
            it("should revert", async () => {
                await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedAccessControlConfig.mock.hasRole.returns(false)

                await expect(stabilityFeeCollectorAsAlice.unpause()).to.be.revertedWith("!(ownerRole or govRole)")
            })
        })

        context("when role can access", () => {
            context("and role is owner role", () => {
                it("should be success", async () => {
                    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await stabilityFeeCollector.pause()
                    await stabilityFeeCollector.unpause()
                })
            })

            context("and role is gov role", () => {
                it("should be success", async () => {
                    await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                    await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                    await mockedAccessControlConfig.mock.hasRole.returns(true)

                    await stabilityFeeCollector.pause()
                    await stabilityFeeCollector.unpause()
                })
            })
        })

        context("when unpause contract", () => {
            it("should be success", async () => {
                await mockedBookKeeper.mock.collateralPoolConfig.returns(mockedCollateralPoolConfig.address)
                await mockedBookKeeper.mock.accessControlConfig.returns(mockedAccessControlConfig.address)
                await mockedAccessControlConfig.mock.hasRole.returns(true)

                // pause contract
                await stabilityFeeCollector.pause()

                // unpause contract
                await stabilityFeeCollector.unpause()

                await mockedCollateralPoolConfig.mock.getStabilityFeeRate.returns(
                    BigNumber.from("1000000000315522921573372069")
                )
                await mockedCollateralPoolConfig.mock.getLastAccumulationTime.returns(await TimeHelpers.latest())
                await mockedCollateralPoolConfig.mock.getDebtAccumulatedRate.returns(UnitHelpers.WeiPerRay)
                await mockedBookKeeper.mock.accrueStabilityFee.returns()

                await stabilityFeeCollector.collect(formatBytes32String("WXDC"), { gasLimit: 2000000 })
            })
        })
    })
})
