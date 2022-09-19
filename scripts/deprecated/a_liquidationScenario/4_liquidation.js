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

let rawdata = fs.readFileSync('./scripts/a_liquidationScenario/cupcakes/0_deployment.json');
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

const systemDebtEngineJSON = {
    address : addresses.systemDebtEngine
}

let rawdata2 = fs.readFileSync('./scripts/a_liquidationScenario/cupcakes/2_proxyWalletAddresses.json');
let proxyWallets = JSON.parse(rawdata2);

const proxyWalletAlice = proxyWallets.proxyWalletAlice;
const proxyWalletBob = proxyWallets.proxyWalletBob;
const proxyWalletAbi = ProxyWalletArtifact.abi;

let rawdata3 = fs.readFileSync('./scripts/a_liquidationScenario/cupcakes/3_positionHandlerAddresses.json');
let positionHandlers = JSON.parse(rawdata3);
const alicePositionAddress = positionHandlers.alicePositionAddress
const bobPositionAddress = positionHandlers.bobPositionAddress


async function main() {

        //Position Manager attach
        const PositionManager = await hre.ethers.getContractFactory("PositionManager");
        const positionManager = await PositionManager.attach(
            positionManagerJSON.address // The deployed contract address
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

        // 3. WXDC price drop to 0.99 USD
        // await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.mul(1).sub(1));
        // await simplePriceFeed.setPrice(WeiPerRay.mul(1).sub(1).div(1e9));

        // 3. WXDC price drop to 0.50 USD <- experiment for liquidator's profit calculation
        await collateralPoolConfig.setPriceWithSafetyMargin(COLLATERAL_POOL_ID, WeiPerRay.div(2));
        // raw price 0.25 USD
        await simplePriceFeed.setPrice(WeiPerRay.div(2).div(1e9));
    
        const debtShareToRepay = parseEther("0.5")
    
        const bookKeeperAbi = BookKeeperArtifact.abi;
        const bookKeeperAsBob = new hre.ethers.Contract(bookKeeper.address, bookKeeperAbi, walletBob);
    
        const encodedResult2 = "0x00";
    
        await bookKeeperAsBob.whitelist(liquidationEngine.address)
        await bookKeeperAsBob.whitelist(fixedSpreadLiquidationStrategy.address)
    
        // 3.5 BobStakedAmount before liquidation
        const BobStakedAmountBeforeLQ = await collateralTokenAdapter.stake(BobAddress);
        console.log("BobStakedAmountBefore liquidation is : " + BobStakedAmountBeforeLQ);
        let SystemDebtEngineCollateralSurplusBL = await collateralTokenAdapter.stake(systemDebtEngineJSON.address);
        console.log("SystemDebtEngineCollateralSurplusBeforeLiquidation is : " + SystemDebtEngineCollateralSurplusBL);

        // 4. Mint unbackedStablecoin which can be strictly used for liquidation.
        // looking at parseUnits, it is possible to think that it is in RAD
        await bookKeeper.mintUnbackedStablecoin(systemDebtEngineJSON.address, BobAddress, parseUnits("3000", 45));
        // await bookKeeper.mintUnbackedStablecoin(DeployerAddress, BobAddress, WeiPerRad.mul("3000"));
        
        //bob's internal stablecoin amount before liquidation
        const BobInternalStablecoinAmountBFLiquidation = await bookKeeper.stablecoin(BobAddress);
        console.log("BobInternalStablecoinAmountBFLiquidation is "+ BobInternalStablecoinAmountBFLiquidation);

        const liquidationEngineAbi = LiquidationEngineArtifact.abi;
        const liquidationEngineAsBob = new hre.ethers.Contract(liquidationEngine.address, liquidationEngineAbi, walletBob);
        // 5. Liquidate fully Alice's position.
        await liquidationEngineAsBob.liquidate(COLLATERAL_POOL_ID, alicePositionAddress, debtShareToRepay.mul(2), MaxUint256.MaxUint256, BobAddress, "0x00")

        const BobStakedAmountAfterLQ = await collateralTokenAdapter.stake(BobAddress);
        console.log("BobStakedAmountAfter liquidation is : " + BobStakedAmountAfterLQ);

        let SystemDebtEngineCollateralSurplus = await collateralTokenAdapter.stake(systemDebtEngineJSON.address);
        console.log("SystemDebtEngineCollateralSurplusAfterLiquidation is : " + SystemDebtEngineCollateralSurplus);

        //bob's internal stablecoin amount after liquidation
        const BobInternalStablecoinAmountAFLiquidation = await bookKeeper.stablecoin(BobAddress);
        console.log("BobInternalStablecoinAmountAFLiquidation is "+ BobInternalStablecoinAmountAFLiquidation);

    
    let liquidationInfo = { 
        BobStakedAmountBFLQ: BobStakedAmountBeforeLQ,
        BobStakedAmountAFLQ: BobStakedAmountAfterLQ
    };

    let data = JSON.stringify(liquidationInfo);
    fs.writeFileSync('./scripts/a_liquidationScenario/cupcakes/4_liquidationInfo.json', data);


}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
