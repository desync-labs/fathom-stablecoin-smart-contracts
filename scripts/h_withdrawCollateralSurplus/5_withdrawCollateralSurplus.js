const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");
const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const ProxyWalletRegistryArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWalletRegistry.sol/ProxyWalletRegistry.json");
const WXDCArtifact = require("../../artifacts/contracts/6.12/mocks/BEP20.sol/BEP20.json");
const LiquidationEngineArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/LiquidationEngine.sol/LiquidationEngine.json");
const BookKeeperArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/BookKeeper.sol/BookKeeper.json");
const SystemDebtEngineArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/SystemDebtEngine.sol/SystemDebtEngine.json");
const CollateralTokenAdapterArtifact = require("../../artifacts/contracts/6.12/stablecoin-core/adapters/FarmableTokenAdapter/CollateralTokenAdapter.sol/CollateralTokenAdapter.json");



const MaxUint256 = require("@ethersproject/constants");
const defaultAbiCoder = require("ethers/lib/utils.js");
const { Web3Provider } = require("@ethersproject/providers");

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

var positionCounter = 0;

let rawdata = fs.readFileSync('./scripts/h_withdrawCollateralSurplus/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const WXDCJSON = {
    address : addresses.WXDC
}
const liquidationEngine = {
    address : addresses.liquidationEngine
}

const positionManagerJSON = {
    address : addresses.positionManager
}

const stabilityFeeCollector = {
    address : addresses.stabilityFeeCollector
}

const collateralTokenAdapter = {
    address : addresses.collateralTokenAdapter
}

const stablecoinAdapter = {
    address : addresses.stablecoinAdapter
}

const fathomStablecoinProxyActions = {
    address : addresses.fathomStablecoinProxyActions
}

const bookKeeperJSON = {
    address : addresses.bookKeeper
}

const systemDebtEngineJSON = {
    address : addresses.systemDebtEngine
}

const simplePricefeedJSON = {
    address : addresses.simplePriceFeed
}

const fathomStablecoinJSON = {
    address : addresses.fathomStablecoin
}

const collateralPoolConfigJSON = {
    address : addresses.collateralPoolConfig
}

const fixedSpreadLiquidationStrategy = {
    address : addresses.fixedSpreadLiquidationStrategy
}

const liquidationEngineJSON = {
    address : addresses.liquidationEngine
}

const collateralTokenAdapterJSON = {
    address : addresses.collateralTokenAdapter
}

let rawdata2 = fs.readFileSync('./scripts/h_withdrawCollateralSurplus/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletBob = proxyWallets.proxyWalletBob;
const proxyWalletAbi = ProxyWalletArtifact.abi;

let rawdata3 = fs.readFileSync('./scripts/h_withdrawCollateralSurplus/cupcakes/3_positionHandlerAddresses.json');
let positionHandlers = JSON.parse(rawdata3);
const alicePositionAddress = positionHandlers.alicePositionAddress
const bobPositionAddress = positionHandlers.bobPositionAddress


async function main() {

        //Position Manager attach
        const PositionManager = await hre.ethers.getContractFactory("PositionManager");
        const positionManager = await PositionManager.attach(
            positionManagerJSON.address // The deployed contract address
        )

        //WXDC token attach
        const BEP20 = await hre.ethers.getContractFactory("BEP20");
        const WXDC = await BEP20.attach(
            WXDCJSON.address // The deployed contract address
                )
        
        //SystemDebtEngine attach
        const SystemDebtEngine = await hre.ethers.getContractFactory("SystemDebtEngine");
        const systemDebtEngine = await SystemDebtEngine.attach(
            systemDebtEngineJSON.address // The deployed contract address
        )

        //LiquidationEngine attach
        const LiquidationEngine = await hre.ethers.getContractFactory("LiquidationEngine");
        const liquidationEngine = await LiquidationEngine.attach(
            liquidationEngineJSON.address // The deployed contract address
        )

        //CollateralPoolConfig attach
        const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
        const collateralPoolConfig = await CollateralPoolConfig.attach(
            collateralPoolConfigJSON.address // The deployed contract address
        )

        //BookKeeper attach
        const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
        const bookKeeper = await BookKeeper.attach(
            bookKeeperJSON.address // The deployed contract address
        )

        //SimplePriceFeed attach
        const SimplePriceFeed = await hre.ethers.getContractFactory("SimplePriceFeed");
        const simplePriceFeed = await SimplePriceFeed.attach(
            simplePricefeedJSON.address // The deployed contract address
        )

        //CollateralTokenAdapter attach
        const CollateralTokenAdapter = await hre.ethers.getContractFactory("CollateralTokenAdapter");
        const collateralTokenAdapter = await CollateralTokenAdapter.attach(
            collateralTokenAdapterJSON.address // The deployed contract address
        )

        const collateralAmountDevAddressBeforeWithdrawl = await WXDC.balanceOf(DevAddress);

        console.log("collateralAmountDevAddressBeforeWithdrawl is " + collateralAmountDevAddressBeforeWithdrawl);

        // 1. check staked amount of SystemDebtEngine
        let SystemDebtEngineCollateralSurplus = await collateralTokenAdapter.stake(systemDebtEngine.address);
        console.log("SystemDebtEngineCollateralSurplus before withdrawl of collateral surplus is : " + SystemDebtEngineCollateralSurplus);

        // 2. withdrawCollateralSurplus    <- basically just moving staked value from systemDebtEngine to some other address
        //so that it can be withdrawable.
        const withdrawalAmount = BigNumber.from("23809523809523810");
        // moving CollateralSurplus to DevAddress
        await systemDebtEngine.withdrawCollateralSurplus(COLLATERAL_POOL_ID, collateralTokenAdapter.address, DevAddress, withdrawalAmount);
        console.log("....... CollateralSurplus withdrawn to Dev Address .......")
        // 3.check stake amount for
        // 1) systemDebtEngine
        // 2) DevAddress

        SystemDebtEngineCollateralSurplus = await collateralTokenAdapter.stake(systemDebtEngine.address);
        console.log("SystemDebtEngineCollateralSurplus after withdrawl of collateral surplus : " + SystemDebtEngineCollateralSurplus);

        let DevAddressStakeAmount = await collateralTokenAdapter.stake(DevAddress);
        console.log("DevAddressTakedAmount after withdrawCollateralSurplus is " + DevAddressStakeAmount);


        const withdrawalAmountReal = BigNumber.from("23809523809523810");


        // 4. withdrawCollateral token for real for DevAddress
        // I need to make collateralTokenAdapter as Dev Address

        const CollateralTokenAdapterAbi = CollateralTokenAdapterArtifact.abi;
        const CollateralTokenAdapterAsDev = new hre.ethers.Contract(collateralTokenAdapterJSON.address, CollateralTokenAdapterAbi, walletDev);
        await CollateralTokenAdapterAsDev.withdraw(DevAddress, withdrawalAmountReal, "0x00");
        console.log("....... Staked collateral withdrawn to Dev Address .......")

        DevAddressStakeAmount = await collateralTokenAdapter.stake(DevAddress);
        console.log("DevAddressTakedAmount after withdrawal of staked amount is " + DevAddressStakeAmount);

        const WXDCAmountAfterWithdrawl = await WXDC.balanceOf(DevAddress);

        console.log("collateralAmountDevAddressAfterWithdrawl is " + WXDCAmountAfterWithdrawl);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
