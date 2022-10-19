require("@openzeppelin/test-helpers")

const chai = require('chai');
const { BigNumber, ethers } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");

const { solidity } = require("ethereum-waffle");
chai.use(solidity);

const { WeiPerRad, WeiPerRay, WeiPerWad } = require("../helper/unit");
const { DeployerAddress, AddressZero } = require("../helper/address");
const { formatBytes32String } = require("ethers/lib/utils");

const { expect } = chai

const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(12500)
const TREASURY_FEE_BPS = BigNumber.from(2500)

describe("StableSwapModule", () => {
  // Contracts
  let stablecoinAdapter
  let bookKeeper
  let WXDC
  let flashMintModule
  let stableSwapModule
  let authTokenAdapter
  let fathomStablecoin
  let systemDebtEngine
  let collateralPoolConfig

  beforeEach(async () => {
    await snapshot.revertToSnapshot();
    WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");
    bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
    collateralPoolConfig = await artifacts.initializeInterfaceAt("CollateralPoolConfig", "CollateralPoolConfig");
    stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
    fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");
    positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
    systemDebtEngine = await artifacts.initializeInterfaceAt("SystemDebtEngine", "SystemDebtEngine");
    flashMintModule = await artifacts.initializeInterfaceAt("FlashMintModule", "FlashMintModule");
    stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
    stableSwapModule = await artifacts.initializeInterfaceAt("StableSwapModule", "StableSwapModule");
    authTokenAdapter = await artifacts.initializeInterfaceAt("AuthTokenAdapter", "AuthTokenAdapter");
    const simplePriceFeed = await artifacts.initializeInterfaceAt("SimplePriceFeed", "SimplePriceFeed");
  
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
    1000000000000000
    await bookKeeper.setTotalDebtCeiling(WeiPerRad.mul(100000000000000), { gasLimit: 1000000 })
    await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay, { gasLimit: 1000000 })
  
    // Deploy Fathom Stablecoin
    await bookKeeper.whitelist(stablecoinAdapter.address, { gasLimit: 1000000 })
  
    await stableSwapModule.setFeeIn(ethers.utils.parseEther("0.001"), { gasLimit: 1000000 })
    await stableSwapModule.setFeeOut(ethers.utils.parseEther("0.001"), { gasLimit: 1000000 })
    await authTokenAdapter.grantRole(await authTokenAdapter.WHITELISTED(), stableSwapModule.address, { gasLimit: 1000000 })
  
    await flashMintModule.setMax(ethers.utils.parseEther("100000000"), { gasLimit: 1000000 })
    await flashMintModule.setFeeRate(ethers.utils.parseEther("25").div(10000), { gasLimit: 1000000 })
  })
  describe("#swapTokenToStablecoin", async () => {
    context("exceed debtCeiling", async () => {
      it("should revert", async () => {
        // Set debtCeiling of StableSwapModule to 0
        await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, 0, { gasLimit: 1000000 })

        // Mint 1000 WXDC to deployer
        await WXDC.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

        // Swap 1000 WXDC to FXD
        await WXDC.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 3000000 })
        ).to.be.revertedWith("BookKeeper/ceiling-exceeded")
      })
    })

    context("swap WXDC when WXDC is insufficient", async () => {
      it("should revert", async () => {
        // Mint 1000 WXDC to deployer
        await WXDC.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

        // Swap 1000 WXDC to FXD
        await WXDC.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })

        await expect(
          stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1001"), { gasLimit: 3000000 })
        ).to.be.revertedWith("!safeTransferFrom")
      })
    })
    context("swap WXDC to FXD", async () => {
      it("should success", async () => {
        // Mint 1000 WXDC to deployer
        await WXDC.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

        // Swap 1000 WXDC to FXD
        await WXDC.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
        await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

        // 1000 * 0.001 = 1
        const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
        expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("1").mul(WeiPerRay))

        // stablecoinReceived = swapAmount - fee = 1000 - 1 = 999
        const stablecoinReceived = await fathomStablecoin.balanceOf(DeployerAddress)
        expect(stablecoinReceived).to.be.equal(ethers.utils.parseEther("999"))

        const WXDCCollateralAmount = (await bookKeeper.positions(COLLATERAL_POOL_ID, stableSwapModule.address))
          .lockedCollateral
        expect(WXDCCollateralAmount).to.be.equal(ethers.utils.parseEther("1000"))
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

        // Swap 1000 FXD to WXDC
        await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
        await expect(stableSwapModule.swapStablecoinToToken(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })).to.be
          .reverted
      })
    })

    context("swap FXD to WXDC", async () => {
      it("should success", async () => {
        // Mint 1000 WXDC to deployer
        await WXDC.mint(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

        // Swap 1000 WXDC to FXD
        await WXDC.approve(authTokenAdapter.address, MaxUint256, { gasLimit: 1000000 })
        await stableSwapModule.swapTokenToStablecoin(DeployerAddress, ethers.utils.parseEther("1000"), { gasLimit: 1000000 })

        // Swap 998 FXD to WXDC
        await fathomStablecoin.approve(stableSwapModule.address, MaxUint256, { gasLimit: 1000000 })
        await stableSwapModule.swapStablecoinToToken(DeployerAddress, ethers.utils.parseEther("998"), { gasLimit: 1000000 })

        // first swap = 1000 * 0.001 = 1 FXD
        // second swap = 998 * 0.001 = 0.998 FXD
        // total fee = 1 + 0.998 = 1.998
        const feeFromSwap = await bookKeeper.stablecoin(systemDebtEngine.address)
        expect(feeFromSwap).to.be.equal(ethers.utils.parseEther("1.998").mul(WeiPerRay))

        const WXDCReceived = await WXDC.balanceOf(DeployerAddress)
        expect(WXDCReceived).to.be.equal(ethers.utils.parseEther("998"))

        const WXDCCollateralAmount = (await bookKeeper.positions(COLLATERAL_POOL_ID, stableSwapModule.address))
          .lockedCollateral
        expect(WXDCCollateralAmount).to.be.equal(ethers.utils.parseEther("2"))
      })
    })
  })
})
