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

let rawdata = fs.readFileSync('./scripts/j_withdrawStablecoinSurplus/cupcakes/0_deployment.json');
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

const stablecoinAdapterJSON = {
    address : addresses.stablecoinAdapter
}

let rawdata2 = fs.readFileSync('./scripts/j_withdrawStablecoinSurplus/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletBob = proxyWallets.proxyWalletBob;
const proxyWalletAbi = ProxyWalletArtifact.abi;

let rawdata3 = fs.readFileSync('./scripts/j_withdrawStablecoinSurplus/cupcakes/3_positionHandlerAddresses.json');
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
        const bookKeeperAsDev = await BookKeeper.attach(
            bookKeeperJSON.address // The deployed contract address
        ).connect(walletDev);

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

        //stablecoin adapter as Dev
        const StablecoinAdapter = await hre.ethers.getContractFactory("StablecoinAdapter");
        const stablecoinAdapterAsDev = await StablecoinAdapter.attach(
            stablecoinAdapterJSON.address // The deployed contract address
        ).connect(walletDev);
        const stablecoinAdapter = await StablecoinAdapter.attach(
            stablecoinAdapterJSON.address // The deployed contract address
        )

        // Copyright Fathom 2022 stablecoin attach
        const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
        const fathomStablecoin = await FathomStablecoin.attach(
            fathomStablecoinJSON.address // The deployed contract address
        )
        

        // 1. check stablecoinSurplus amount
        const stablecoinSurplusAmountBeforeWithdrawl = await bookKeeper.stablecoin(systemDebtEngineJSON.address);
        console.log("StablecoinSurplusAmountBeforeWithdrawl is " + stablecoinSurplusAmountBeforeWithdrawl);

        // 3. withdrawStablecoinSurplus to DevAddress
        await systemDebtEngine.withdrawStablecoinSurplus(DevAddress, WeiPerRad.mul(2));

        // 4. check stablecoinSurplus amount after withdrawl
        const stablecoinSurplusAmountAfterWithdrawl = await bookKeeper.stablecoin(systemDebtEngineJSON.address);
        console.log("StablecoinSurplusAmountAfterWithdrawl is " + stablecoinSurplusAmountAfterWithdrawl);
        const stablecoinAmountForDevAddress = await bookKeeper.stablecoin(DevAddress);
        console.log("stablecoinAmountForDevAddress is "+ stablecoinAmountForDevAddress);

        // 5.    Withdraw stablecoin, stablecoinAdapterAsDev
        // withdraw will top up internal stablecoin balance of Stablecoin adapter in bookKeeper.sol as much as minted stablecoin amount.

        //in order to pass wish condition, Dev needs to whitelist Stablecoinadapter to manipulate his balance
        await bookKeeperAsDev.whitelist(stablecoinAdapter.address);

        const stablecoinBalanceOfDevBeforeWithdraw = await fathomStablecoin.balanceOf(DevAddress);
        console.log("How much stablecoin does Dev have before Withdrawl? "+ stablecoinBalanceOfDevBeforeWithdraw);

        await stablecoinAdapterAsDev.withdraw(DevAddress, WeiPerWad.mul(2), "0x00");

        // 6. check stablcoin balance of DevAddress
        const stablecoinBalanceOfDev = await fathomStablecoin.balanceOf(DevAddress);
        console.log("How much stablecoin does Dev have after Withdrawl?"+ stablecoinBalanceOfDev);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
