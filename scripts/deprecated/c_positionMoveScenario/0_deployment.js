const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerBln = BigNumber.from(`1${"0".repeat(9)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const FATHOM_PER_BLOCK = parseEther("100")
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)
const TREASURY_FEE_BPS = BigNumber.from(5000)
const BPS = BigNumber.from(10000)

const privateKey1 = process.env.PRIVATE_KEY1;
const privateKey2 = process.env.PRIVATE_KEY2;
const privateKey3 = process.env.PRIVATE_KEY3;
const privateKey4 = process.env.PRIVATE_KEY4;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletDeployer = new hre.ethers.Wallet(privateKey1,provider);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);
const walletBob = new hre.ethers.Wallet(privateKey3,provider);
const walletDev = new hre.ethers.Wallet(privateKey4,provider);

// Contract addresses
const AddressZero = "0x0000000000000000000000000000000000000000";
// the first address from ganache
const DeployerAddress = walletDeployer.address;
// The second address from ganache
const AliceAddress = walletAlice.address;
// The third address from ganache
const BobAddress = walletBob.address;
// The fourth address from ganache
const DevAddress = walletDev.address;

async function main() {
    //Deploy CollateralPoolConfig
    const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
    const collateralPoolConfig = await CollateralPoolConfig.deploy();
    await collateralPoolConfig.deployed();
    console.log("collaterPoolConfig deployed to :", collateralPoolConfig.address);

    // Deploy mocked BookKeeper
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeper = await BookKeeper.deploy(collateralPoolConfig.address);
    await bookKeeper.deployed();
    console.log("bookKeeper deployed to :", bookKeeper.address);
    
    // Deploy mocked BEP20
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const WXDC = await BEP20.deploy("WXDC", "WXDC");
    await WXDC.deployed();
    await WXDC.mint(await AliceAddress, parseEther("1000000"))
    await WXDC.mint(await BobAddress, parseEther("100"))
    console.log("WXDC deployed to :", WXDC.address);

    // Deploy FathomToken
    const FATHOMToken = await hre.ethers.getContractFactory("FATHOMToken")
    const fathomToken = await FATHOMToken.deploy(88, 89)
    await fathomToken.deployed()
    console.log("fathomToken deployed to :", fathomToken.address);
    await fathomToken.mint(DeployerAddress, parseEther("150"))

    // Deploy Fathom's Fairlaunch
    const FairLaunch = await hre.ethers.getContractFactory("FairLaunch")
    const fairLaunch = await FairLaunch.deploy(fathomToken.address, DevAddress, FATHOM_PER_BLOCK, 0, 0, 0)
    await fairLaunch.deployed()
    console.log("fairLaunch deployed to :", fairLaunch.address);

    // Deploy Fathom's Shield
    const Shield = await hre.ethers.getContractFactory("Shield");
    const shield = await Shield.deploy(fairLaunch.address)
    await shield.deployed()
    console.log("shield deployed to :", shield.address);

    // Config Fathom's FairLaunch
    // Assuming Deployer is timelock for easy testing
    await fairLaunch.addPool(1, WXDC.address, true)

    // Deploy ShowStopper
    const ShowStopper = await hre.ethers.getContractFactory("ShowStopper")
    const showStopper = await ShowStopper.deploy(bookKeeper.address);
    await showStopper.deployed();
    console.log("showStopper deployed to :", showStopper.address);

    // Deploy PositionManager
    const PositionManager = await hre.ethers.getContractFactory("PositionManager")
    const positionManager = await PositionManager.deploy(bookKeeper.address, showStopper.address)
    await positionManager.deployed()
    console.log("positionManager deployed to :", positionManager.address);

    // Deploy CollateralTokenAdapter
    const CollateralTokenAdapter = await hre.ethers.getContractFactory("CollateralTokenAdapter")
    const collateralTokenAdapter = await CollateralTokenAdapter.deploy(
        bookKeeper.address,
        COLLATERAL_POOL_ID,
        WXDC.address,
        fathomToken.address,
        fairLaunch.address,
        0,
        shield.address,
        DeployerAddress,
        BigNumber.from(1000),
        DevAddress,
        positionManager.address
    );

    await collateralTokenAdapter.deployed()

    console.log("collateralTokenAdapter deployed to :", collateralTokenAdapter.address);

    //Deploy SimplePriceFeed
    const SimplePriceFeed = await hre.ethers.getContractFactory("SimplePriceFeed")
    const simplePriceFeed = await SimplePriceFeed.deploy()
    await simplePriceFeed.deployed()
    console.log("simplePriceFeed deployed to :", simplePriceFeed.address);

    // Deploy Fathom Stablecoin
    const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin")
    const fathomStablecoin = await FathomStablecoin.deploy("Fathom USD", "USXD") 
    await fathomStablecoin.deployed()

    console.log("fathomStablecoin deployed to :", fathomStablecoin.address);

    // Deploy StablecoinAdapter
    const StablecoinAdapter = await hre.ethers.getContractFactory("StablecoinAdapter")
    const stablecoinAdapter = await StablecoinAdapter.deploy(bookKeeper.address, fathomStablecoin.address)
    await stablecoinAdapter.deployed()
    console.log("stablecoinAdapter deployed to :", stablecoinAdapter.address);

    // Deploy FathomStablecoinProxyActions
    const FathomStablecoinProxyActions = await hre.ethers.getContractFactory("FathomStablecoinProxyActions")
    const fathomStablecoinProxyActions = await FathomStablecoinProxyActions.deploy()
    await fathomStablecoinProxyActions.deployed()
    console.log("fathomStablecoinProxyActions deployed to :", fathomStablecoinProxyActions.address);

    // Deploy SystemDebtEngine
    const SystemDebtEngine = await hre.ethers.getContractFactory("SystemDebtEngine")
    const systemDebtEngine = await SystemDebtEngine.deploy(bookKeeper.address)
    await systemDebtEngine.deployed()
    console.log("systemDebtEngine deployed to :", systemDebtEngine.address);


    // Deploy StabilityFeeCollector
    const StabilityFeeCollector = await hre.ethers.getContractFactory("StabilityFeeCollector");
    const stabilityFeeCollector = await StabilityFeeCollector.deploy(bookKeeper.address, systemDebtEngine.address);
    await stabilityFeeCollector.setSystemDebtEngine(systemDebtEngine.address)
    console.log("stabilityFeeCollector deployed to :", stabilityFeeCollector.address);

    // Deploy StabilityFeeCollector
    const LiquidationEngine = await hre.ethers.getContractFactory("LiquidationEngine");
    const liquidationEngine = await LiquidationEngine.deploy(bookKeeper.address, systemDebtEngine.address);
    await liquidationEngine.deployed();
    console.log("liquidationEngine deployed to :", liquidationEngine.address);

    // Deploy Price Oracle
    const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy(bookKeeper.address);
    await priceOracle.deployed();
    console.log("priceOracle deployed to :", priceOracle.address);


    // Deploy FSL strategy
    const FixedSpreadLiquidationStrategy = await hre.ethers.getContractFactory("FixedSpreadLiquidationStrategy");
    const fixedSpreadLiquidationStrategy = await FixedSpreadLiquidationStrategy.deploy(
        bookKeeper.address,
        priceOracle.address,
        liquidationEngine.address,
        systemDebtEngine.address
    );
    await fixedSpreadLiquidationStrategy.deployed();
    console.log("fixedSpreadLiquidationStrategy deployed to :", fixedSpreadLiquidationStrategy.address);

    // Deploy ProxyWalletFactory
    const ProxyWalletFactory = await hre.ethers.getContractFactory("ProxyWalletFactory");
    const proxyWalletFactory = await ProxyWalletFactory.deploy();
    await proxyWalletFactory.deployed();
    //ProxyWalletCache.sol is created when ProxyWalletFactory is deployed
    console.log("proxyWalletFactory deployed to :", proxyWalletFactory.address);

    // Deploy ProxyWalletRegistry
    const ProxyWalletRegistry = await hre.ethers.getContractFactory("ProxyWalletRegistry");
    const proxyWalletRegistry = await ProxyWalletRegistry.deploy(proxyWalletFactory.address);
    await proxyWalletRegistry.deployed();
    console.log("proxyWalletRegistry deployed to :", proxyWalletRegistry.address);

    let addresses = { 
        collateralPoolConfig: collateralPoolConfig.address,
        bookKeeper: bookKeeper.address,
        WXDC: WXDC.address,
        fathomToken: fathomToken.address,
        fairLaunch: fairLaunch.address,
        shield: shield.address,
        showStopper: showStopper.address,
        positionManager: positionManager.address,
        collateralTokenAdapter: collateralTokenAdapter.address,
        simplePriceFeed: simplePriceFeed.address,
        fathomStablecoin: fathomStablecoin.address,
        stablecoinAdapter: stablecoinAdapter.address,
        fathomStablecoinProxyActions: fathomStablecoinProxyActions.address,     
        systemDebtEngine: systemDebtEngine.address,
        stabilityFeeCollector: stabilityFeeCollector.address,
        liquidationEngine: liquidationEngine.address,
        priceOracle: priceOracle.address,
        fixedSpreadLiquidationStrategy: fixedSpreadLiquidationStrategy.address,
        proxyWalletFactory: proxyWalletFactory.address,
        proxyWalletRegistry: proxyWalletRegistry.address
    };
    
    let data = JSON.stringify(addresses);
    fs.writeFileSync('./scripts/c_positionMoveScenario/cupcakes/0_deployment.json', data);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
