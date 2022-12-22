const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const { DeployerAddress, AddressZero } = require("../helper/address");
const { formatBytes32String } = require("ethers/lib/utils");
const { loadFixture } = require("../helper/fixtures");
const { getProxy } = require("../../common/proxies");

const { expect } = chai

const COLLATERAL_POOL_ID = formatBytes32String("USDT-COL")

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

const setup = async () => {
    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
    const collateralPoolConfig = await getProxy(proxyFactory, "CollateralPoolConfig");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper");
    const simplePriceFeed = await getProxy(proxyFactory, "SimplePriceFeed");
    const systemDebtEngine = await getProxy(proxyFactory, "SystemDebtEngine");
    const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
    const stableSwapModule = await getProxy(proxyFactory, "StableSwapModule");
    const authTokenAdapter = await getProxy(proxyFactory, "AuthTokenAdapter");
    const flashMintModule = await getProxy(proxyFactory, "FlashMintModule");
    const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

    const collateralTokenAdapterAddress = await collateralTokenAdapterFactory.adapters(COLLATERAL_POOL_ID)
    const collateralTokenAdapter = await artifacts.initializeInterfaceAt("CollateralTokenAdapter", collateralTokenAdapterAddress);
    const usdtAddr = await collateralTokenAdapter.collateralToken();
    const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

    await collateralPoolConfig.initCollateralPool(
        COLLATERAL_POOL_ID,
        WeiPerRad.mul(100000000000000),
        0,
        simplePriceFeed.address,
        WeiPerRay,
        WeiPerRay,
        authTokenAdapter.address,
        CLOSE_FACTOR_BPS,
        LIQUIDATOR_INCENTIVE_BPS,
        TREASURY_FEE_BPS,
        AddressZero
    )

    await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100000000000000), { gasLimit: 1000000 })
    await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay, { gasLimit: 1000000 })

    // Deploy Fathom Stablecoin
    await bookKeeper.whitelist(stablecoinAdapter.address, { gasLimit: 1000000 })

    await stableSwapModule.setFeeIn(ethers.utils.parseEther("0.001"), { gasLimit: 1000000 })
    await stableSwapModule.setFeeOut(ethers.utils.parseEther("0.001"), { gasLimit: 1000000 })
    await authTokenAdapter.grantRole(await authTokenAdapter.WHITELISTED(), stableSwapModule.address, { gasLimit: 1000000 })

    await flashMintModule.setMax(ethers.utils.parseEther("100000000"), { gasLimit: 1000000 })
    await flashMintModule.setFeeRate(ethers.utils.parseEther("25").div(10000), { gasLimit: 1000000 })

    return {
        bookKeeper,
        stablecoinAdapter,
        collateralPoolConfig,
        USDT,
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
    let USDT
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
            USDT,
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
                await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, 0, { gasLimit: 1000000 })

                // Mint 1000 USDT to deployer
                await USDT.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USDT to FXD
                await USDT.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
                await expect(
                    stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 3000000 })
                ).to.be.revertedWith("BookKeeper/ceiling-exceeded")
            })
        })

        context("swap USDT when USDT is insufficient", async () => {
            it("should revert", async () => {
                // Mint 1000 USDT to deployer
                await USDT.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USDT to FXD
                await USDT.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })

                await expect(
                    stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1001"), { gasLimit: 3000000 })
                ).to.be.revertedWith("!safeTransferFrom")
            })
        })
        context("swap USDT to FXD", async () => {
            it("should success", async () => {
                // Mint 1000 USDT to deployer
                await USDT.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USDT to FXD
                await USDT.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // 1000 * 0.001 = 1
                const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
                expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("1").mul(WeiPerRay))

                // stablecoinReceived = swapAmount - fee = 1000 - 1 = 999
                const stablecoinReceived = await fathomStablecoin.balanceOf(DeployerAddress)
                expect(stablecoinReceived).to.be.equal(ethers.utils.parseEther("999"))

                const USDTCollateralAmount = (await bookKeeper.positions(COLLATERAL_POOL_ID, stableSwapModule.address))
                    .lockedCollateral
                expect(USDTCollateralAmount).to.be.equal(ethers.utils.parseEther("1000"))
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

                // Swap 1000 FXD to USDT
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
                await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })).to.be
                    .reverted
            })
        })

        context("swap FXD to USDT", async () => {
            it("should success", async () => {
                // Mint 1000 USDT to deployer
                await USDT.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 1000 USDT to FXD
                await USDT.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

                // Swap 998 FXD to USDT
                await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
                await stableSwapModule.swapStablecoinToToken(DeployerAddress, ethers.utils.parseEther("998"), { gasLimit: 1000000 })

                // first swap = 1000 * 0.001 = 1 FXD
                // second swap = 998 * 0.001 = 0.998 FXD
                // total fee = 1 + 0.998 = 1.998
                const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
                expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("1.998").mul(WeiPerRay))

                const USDTReceived = await USDT.balanceOf(DeployerAddress)
                expect(USDTReceived).to.be.equal(ethers.utils.parseEther("998"))

                const USDTCollateralAmount = (await bookKeeper.positions(COLLATERAL_POOL_ID, stableSwapModule.address))
                    .lockedCollateral
                expect(USDTCollateralAmount).to.be.equal(ethers.utils.parseEther("2"))
            })
        })
    })
})
