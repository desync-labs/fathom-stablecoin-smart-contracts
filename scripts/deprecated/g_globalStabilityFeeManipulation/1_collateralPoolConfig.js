const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const BookKeeperArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/BookKeeper.sol/BookKeeper.json");
const CollateralPoolConfigArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/config/CollateralPoolConfig.sol/CollateralPoolConfig.json");

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerBln = BigNumber.from(`1${"0".repeat(9)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

//config parameter

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

let rawdata = fs.readFileSync('./scripts/g_globalStabilityFeeManipulation/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);
const bookKeeperJSON = {
    address : addresses.bookKeeper
}
const collateralPoolConfigJSON = {
    address : addresses.collateralPoolConfig
}
const simplePriceFeedJSON = {
    address : addresses.simplePriceFeed
}
const collateralTokenAdapterJSON = {
    address : addresses.collateralTokenAdapter
}
const WXDCJSON = {
    address : addresses.WXDC
}
const fathomTokenJSON = {
    address : addresses.fathomToken
}

const fixedSpreadLiquidationStrategyJSON = {
    address : addresses.fixedSpreadLiquidationStrategy
}

async function main() {
        //BookKeeper attach
        const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
        const bookKeeper = await BookKeeper.attach(
            bookKeeperJSON.address // The deployed contract address
        )
        //CollateralPoolConfig attach
        const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
        const collateralPoolConfig = await CollateralPoolConfig.attach(
            collateralPoolConfigJSON.address // The deployed contract address
        )
        //SimplePriceFeed attach
        const SimplePriceFeed = await hre.ethers.getContractFactory("SimplePriceFeed");
        const simplePriceFeed = await SimplePriceFeed.attach(
            simplePriceFeedJSON.address // The deployed contract address
        )
        //CollateralTokenAdapter attach
        const CollateralTokenAdapter = await hre.ethers.getContractFactory("CollateralTokenAdapter");
        const collateralTokenAdapter = await CollateralTokenAdapter.attach(
            collateralTokenAdapterJSON.address // The deployed contract address
        )
        //WXDC attach
        const BEP20 = await hre.ethers.getContractFactory("BEP20");
        const WXDC = await BEP20.attach(
            WXDCJSON.address // The deployed contract address
        )
        //fathomToken attach
        const FATHOMToken = await hre.ethers.getContractFactory("FATHOMToken");
        const fathomToken = await FATHOMToken.attach(
            fathomTokenJSON.address // The deployed contract address
        )
        // fixedSpreadLiquidationStrategy attach
        const FixedSpreadLiquidationStrategy = await hre.ethers.getContractFactory("FixedSpreadLiquidationStrategy");
        const fixedSpreadLiquidationStrategy = await FixedSpreadLiquidationStrategy.attach(
            fixedSpreadLiquidationStrategyJSON.address // The deployed contract address
        )

    await collateralPoolConfig.initCollateralPool(
        COLLATERAL_POOL_ID,    //<-_collateralPoolId
        0,     //<-_debtCeiling
        0,     //<-_debtFloor
        simplePriceFeed.address,    //<-_priceFeed
        WeiPerRay,    //<-_liquidationRatio
        0,    //<-_stabilityFeeRate
        collateralTokenAdapter.address,     //<-_adapter
        CLOSE_FACTOR_BPS.mul(2),     // <-_closeFactorBps        mul(2) therefore 100%
        LIQUIDATOR_INCENTIVE_BPS,    //<-_liquidatorIncentiveBps
        TREASURY_FEE_BPS,    //<-_treasuryFeesBps
        AddressZero    //<-_strategy .. It is later 
    )
    await collateralPoolConfig.setStrategy(COLLATERAL_POOL_ID, fixedSpreadLiquidationStrategy.address)
    const debtCeilingSetUp = WeiPerRad.mul(10000000);
    await bookKeeper.setTotalDebtCeiling(debtCeilingSetUp)
    await collateralPoolConfig.setDebtCeiling(COLLATERAL_POOL_ID, debtCeilingSetUp)
    await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay)

    let params = { 
        COLLATERAL_POOL_ID: COLLATERAL_POOL_ID,
        DEBT_CEILING: debtCeilingSetUp,
        CLOSE_FACTOR_BPS: CLOSE_FACTOR_BPS,
        LIQUIDATOR_INCENTIVE_BPS : LIQUIDATOR_INCENTIVE_BPS,
        TREASURY_FEE_BPS: TREASURY_FEE_BPS,
    };
    
    let data = JSON.stringify(params);
    fs.writeFileSync('./scripts/g_globalStabilityFeeManipulation/cupcakes/1_collateralPoolConfig.json', data);

    console.log("Collateral pool was initiated");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
