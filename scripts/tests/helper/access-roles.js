const { formatBytes32String } = require("ethers/lib/utils");
const { DeployerAddress } = require("./address");
const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_USDT = formatBytes32String("USDT")

const DeployerWallet = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";

async function addRoles() {
    const accessControlConfig = await artifacts.initializeInterfaceAt("AccessControlConfig", "AccessControlConfig");
    const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");
    const collateralTokenAdapterFactory = await artifacts.initializeInterfaceAt("CollateralTokenAdapterFactory", "CollateralTokenAdapterFactory");
    const authTokenAdapter = await artifacts.initializeInterfaceAt("AuthTokenAdapter", "AuthTokenAdapter");
    const stableSwapModule = await artifacts.initializeInterfaceAt("StableSwapModule", "StableSwapModule");
    const flashMintModule = await artifacts.initializeInterfaceAt("FlashMintModule", "FlashMintModule");
    const showStopper = await artifacts.initializeInterfaceAt("ShowStopper", "ShowStopper");
    const priceOracle = await artifacts.initializeInterfaceAt("PriceOracle", "PriceOracle");
    const fixedSpreadLiquidationStrategy = await artifacts.initializeInterfaceAt("FixedSpreadLiquidationStrategy", "FixedSpreadLiquidationStrategy");
    const bookKeeper = await artifacts.initializeInterfaceAt("BookKeeper", "BookKeeper");
    const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
    const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
    const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
    const liquidationEngine = await artifacts.initializeInterfaceAt("LiquidationEngine", "LiquidationEngine");
  
    await accessControlConfig.initialize({ gasLimit: 1000000 });
    
    await accessControlConfig.grantRole(await accessControlConfig.BOOK_KEEPER_ROLE(), bookKeeper.address)
  
    await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), positionManager.address)
    await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), positionManager.address)
  
    await accessControlConfig.grantRole(await accessControlConfig.STABILITY_FEE_COLLECTOR_ROLE(), stabilityFeeCollector.address)
  
    await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), liquidationEngine.address)
  
    await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), fixedSpreadLiquidationStrategy.address)
    await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), fixedSpreadLiquidationStrategy.address)
  
    await accessControlConfig.grantRole(await accessControlConfig.LIQUIDATION_ENGINE_ROLE(), showStopper.address)
    await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), showStopper.address)
  
    await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), priceOracle.address)
  
    const collateralTokenAdapterWXDC = await collateralTokenAdapterFactory.getAdapter(COLLATERAL_POOL_ID_WXDC)
    const collateralTokenAdapterUSDT = await collateralTokenAdapterFactory.getAdapter(COLLATERAL_POOL_ID_USDT)
  
    await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), collateralTokenAdapterWXDC)
    await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), collateralTokenAdapterUSDT)
  
    await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), flashMintModule.address)
  
    await accessControlConfig.grantRole(accessControlConfig.ADAPTER_ROLE(), authTokenAdapter.address)
  
    await authTokenAdapter.grantRole(await authTokenAdapter.WHITELISTED(), stableSwapModule.address)
  
    await accessControlConfig.grantRole(await accessControlConfig.POSITION_MANAGER_ROLE(), stableSwapModule.address)
    await accessControlConfig.grantRole(await accessControlConfig.COLLATERAL_MANAGER_ROLE(), stableSwapModule.address)

    await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), stablecoinAdapter.address);
    await fathomStablecoin.grantRole(await fathomStablecoin.MINTER_ROLE(), DeployerAddress);

    await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), DeployerWallet)
    await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), DeployerWallet)
    await accessControlConfig.grantRole(await accessControlConfig.OWNER_ROLE(), DeployerWallet)
}

module.exports = { addRoles }