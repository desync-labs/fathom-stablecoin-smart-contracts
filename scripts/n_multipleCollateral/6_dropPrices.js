const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { BigNumber,ethers } = require("ethers");
const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");

const UniswapV2Router02 = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')

const COLLATERAL_POOL_ID_WXDC = formatBytes32String("WXDC")
const COLLATERAL_POOL_ID_WETH = formatBytes32String("WETH")

const privateKey2 = process.env.PRIVATE_KEY2;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);

//Address were taken from deploying DEX on Ganache
const FathomswapRouter = process.env.FATHOMSWAP_ROUTER

let rawdata = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const DEXPriceOracleJSON = {
    address : addresses.dexPriceOracle
}

const WXDCJSON = {
  address : addresses.WXDC
}
const WETHJSON = {
    address : addresses.WETH
  }

const USDTJSON = {
    address : addresses.USDT
}

const PriceOracleJSON = {
  address : addresses.priceOracle
}

async function main() {
     //USDT attach
     const BEP20 = await hre.ethers.getContractFactory("BEP20");
     const WXDC = BEP20.attach(
        WXDCJSON.address // The deployed contract address
     ).connect(walletAlice)

     const WETH = BEP20.attach(
        WETHJSON.address // The deployed contract address
     ).connect(walletAlice)

      //PriceOracle attach
  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.attach(
    PriceOracleJSON.address // The deployed contract address
  )
 
     //Mint some stablecoin to Alice
     //console.log("Minting 1000 Stablecoin to Alice...")
     // await fathomStablecoin.mint(walletAlice.address, parseEther("1000"))
    await WXDC.approve(FathomswapRouter, parseEther("1000"));
    await WETH.approve(FathomswapRouter, parseEther("1000"));
    
    await printPrices();

    await swapTokens(WETHJSON.address, USDTJSON.address,410,walletAlice)
    await swapTokens(WXDCJSON.address, USDTJSON.address,410,walletAlice)
    console.log("Tokens were swaped");

    await printPrices();

    await priceOracle.setPrice(COLLATERAL_POOL_ID_WXDC);
    await priceOracle.setPrice(COLLATERAL_POOL_ID_WETH);

    async function printPrices() {
        let currentPriceWETH = await fetchPrice(USDTJSON.address,WETHJSON.address)
        let currentPriceWXDC = await fetchPrice(USDTJSON.address,WXDCJSON.address)

        console.log("WETH Price : " + currentPriceWETH);
        console.log("WXDC Price : " + currentPriceWXDC);
    }
}

async function swapTokens(tokenIn, tokenOut, amountIn, wallet) {
    // Router attach
    const router = new ethers.Contract(FathomswapRouter, UniswapV2Router02.abi, wallet)

    var amounts = await router.getAmountsOut(parseEther(amountIn.toString()), [tokenIn, tokenOut])
    const amountOutMin = amounts[1].sub(amounts[1].div(10));

    await router.swapExactTokensForTokens(
        parseEther(amountIn.toString()),
        amountOutMin,
        [tokenIn, tokenOut],
        wallet.address,
        Date.now() + 1000 * 60 * 3 //10 minutes
        );
}

async function fetchPrice(token1, token2) {
    //DexPriceOracle attach
    const DexPriceOracle = await hre.ethers.getContractFactory("DexPriceOracle");
    const dexPriceOracle = await DexPriceOracle.attach(
      DEXPriceOracleJSON.address // The deployed contract address
    )
  
    const fathemStableCoinPrice = await dexPriceOracle.getPrice(token1, token2);
    return fathemStableCoinPrice[0];
  }


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})