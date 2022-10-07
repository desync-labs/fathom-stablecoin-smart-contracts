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

const uniswapFActory = process.env.UNISWAP_FACTORY;

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

let rawdata = fs.readFileSync('./scripts/y_uniswapPriceFeed/cupcakes/1_stableCoinDeployment.json');
let addresses = JSON.parse(rawdata);
const DEXPriceOracleJSON = {
    address : addresses.dexPriceOracle
}

const FathomOraclePriceFeedJSON = {
    address : addresses.fathomOraclePriceFeed
}

let rawdata2 = fs.readFileSync('./scripts/y_uniswapPriceFeed/cupcakes/0_deployTwoTokens.json');
let addresses2 = JSON.parse(rawdata2);
const WXDC = {
    address : addresses2.WXDC
}
const USDT = {
    address : addresses2.USDT
}

async function main() {
    const [signer] = await ethers.getSigners();

    //DexPriceOracle attach
    const DexPriceOracle = await hre.ethers.getContractFactory("DexPriceOracle");
    const dexPriceOracle = await DexPriceOracle.attach(
        DEXPriceOracleJSON.address // The deployed contract address
    )

    const FathomOraclePriceFeed = await hre.ethers.getContractFactory("FathomOraclePriceFeed");
    const fathomOraclePriceFeed = await FathomOraclePriceFeed.attach(
        FathomOraclePriceFeedJSON.address // The deployed contract address
    )
    

    const USDTPriceInWXDCFromDexOracle = await dexPriceOracle.getPrice(WXDC.address, USDT.address);
    console.log("USDTPriceInWXDCFromDexOracle is : " + USDTPriceInWXDCFromDexOracle[0]);
    // console.log(typeof(WXDCPrice));
    // 0.5WAD
    // since when creating a pair, 1000 was WXDC and 2000 was USDT, it is returning
    //price of USDT in terms of WXDC.

    //when WXDC 2000, USDT 1000, it returned
    // 2000000000000000000 which is 2 WAD.
    //so what is important is, when getting priceFeed, it is important to know
    //whether WXDC's price in USDT is being fetched, or USDT's price in WXDC is being fetched

    //eventually we need to make readPrice working with various of collateral_ID

    let WXDCPriceinUSDTFromPriceOracle= await fathomOraclePriceFeed.readPrice();
    // const isBigNumber = hre.ethers.BigNumber.isBigNumber(WXDCPriceFromPriceOracle);
    // console.log("WXDCPriceFromPriceOracle is bigNumber : " + isBigNumber);
    WXDCPriceinUSDTFromPriceOracle = parseInt(Number(WXDCPriceinUSDTFromPriceOracle));
    console.log("WXDCPriceFromPriceOracle is : " + WXDCPriceinUSDTFromPriceOracle);

    let prices = { 
        USDTPriceInWXDCFromDexOracle: USDTPriceInWXDCFromDexOracle[0],
        WXDCPriceFromPriceOracle: WXDCPriceinUSDTFromPriceOracle,
    };
    
    let data = JSON.stringify(prices);
    fs.writeFileSync('./scripts/y_uniswapPriceFeed/cupcakes/2_dexPriceOracle_getPrices.json', data);
}

async function createBEP20Token(name){
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const token = await BEP20.deploy(name, name);
    await token.deployed();
    console.log(`${name} deployed to : ${token.address}`);
    return token;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
