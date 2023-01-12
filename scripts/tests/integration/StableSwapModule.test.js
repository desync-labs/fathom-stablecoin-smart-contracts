const chai = require('chai');
const { ethers } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRay } = require("../helper/unit");
const { DeployerAddress } = require("../helper/address");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");
const pools = require("../../common/collateral");

const { expect } = chai

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const authTokenAdapter = await getProxy(proxyFactory, "AuthTokenAdapter");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

    const USDAddr = await authTokenAdapter.token();
    const USD = await artifacts.initializeInterfaceAt("ERC20Mintable", USDAddr);

    return {
        bookKeeper,
        stablecoinAdapter,
        collateralPoolConfig,
        USD,
        stableSwapModule,
        authTokenAdapter,
        fathomStablecoin,
        systemDebtEngine
    }
}

describe("StableSwapModule", () => {
    // Contracts
    let stablecoinAdapter
    let bookKeeper
    let USD
    let stableSwapModule
    let authTokenAdapter
    let fathomStablecoin
    let systemDebtEngine
    let collateralPoolConfig


    before(async () => {
        await snapshot.revertToSnapshot();
    })

    beforeEach(async () => {
        ({
            bookKeeper,
            stablecoinAdapter,
            collateralPoolConfig,
            USD,
            stableSwapModule,
            authTokenAdapter,
            fathomStablecoin,
            systemDebtEngine
        } = await loadFixture(setup));
    })

    describe("#swapTokenToStablecoin", async () => {
        context("exceed debtCeiling", async () => {
            it("should revert", async () => {
                // Set debtCeiling of StableSwapModule to 0
                await collateralPoolConfig.setDebtCeiling(pools.USD_STABLE, 0, { gasLimit: 1000000 })

                // Mint 1000 USD to deployer
                await USD.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USD to FXD
                await USD.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
                await expect(
                    stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 3000000 })
                ).to.be.revertedWith("BookKeeper/ceiling-exceeded")
            })
        })

        context("swap USD when USD is insufficient", async () => {
            it("should revert", async () => {
                // Mint 1000 USD to deployer
                await USD.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USD to FXD
                await USD.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })

                await expect(
                    stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1001"), { gasLimit: 3000000 })
                ).to.be.revertedWith("!safeTransferFrom")
            })
        })
        context("swap USD to FXD", async () => {
            it("should success", async () => {
                // Mint 1000 USD to deployer
                await USD.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USD to FXD
                await USD.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // 1000 * 0.01 = 10
                const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
                expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("10").mul(WeiPerRay))

                // stablecoinReceived = swapAmount - fee = 1000 - 10 = 990
                const stablecoinReceived = await fathomStablecoin.balanceOf(DeployerAddress)
                expect(stablecoinReceived).to.be.equal(ethers.utils.parseEther("990"))

                const USDCollateralAmount = (await bookKeeper.positions(pools.USD_STABLE, stableSwapModule.address))
                    .lockedCollateral
                expect(USDCollateralAmount).to.be.equal(ethers.utils.parseEther("1000"))
            })
        })
    })

    describe("#swapStablecoinToToken", async () => {
        context("collateral not enough", async () => {
            it("should revert", async () => {
                // Mint 1000 FXD to deployer
                await bookKeeper.mintUnbackedStablecoin(
                    DeployerAddress,
                    DeployerAddress,
                    ethers.utils.parseEther("1001").mul(WeiPerRay),
                    { gasLimit: 1000000 }
                )
                await stablecoinAdapter.withdraw(DeployerAddress, ethers.utils.parseEther("1001"), "0x", { gasLimit: 1000000 })

                // Swap 1000 FXD to USD
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
                await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })).to.be
                    .reverted
            })
        })

        context("swap FXD to USD", async () => {
            it("should success", async () => {
                // Mint 1000 USD to deployer
                await USD.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USD to FXD
                await USD.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 990 FXD to USD
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(DeployerAddress, ethers.utils.parseEther("900"), { gasLimit: 1000000 })

                // first swap = 1000 * 0.01 = 10 FXD
                // second swap = 900 * 0.01 = 9 FXD
                // total fee = 10 + 9 = 19 FXD
                const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
                expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("19").mul(WeiPerRay))

                const USDReceived = await USD.balanceOf(DeployerAddress)
                expect(USDReceived).to.be.equal(ethers.utils.parseEther("900"))

                const USDCollateralAmount = (await bookKeeper.positions(pools.USD_STABLE, stableSwapModule.address))
                    .lockedCollateral
                expect(USDCollateralAmount).to.be.equal(ethers.utils.parseEther("100"))
            })
        })
    })
})
