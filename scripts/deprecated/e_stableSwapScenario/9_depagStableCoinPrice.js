//This script will reduce the price of stablecoin
//Check the current price of StableCoin and Print it
//Menupulate the price in such a way that it depagged it original value i.e. less then $1
//https://docs.uniswap.org/protocol/V2/reference/smart-contracts/router-02

const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const UNISWAP = require("@uniswap/sdk")
const { Token, WETH, Fetcher, Route, Trade, TokenAmount, TradeType, Percent} = require("@uniswap/sdk");
const { getAddress } = require("ethers/lib/utils");

const { BigNumber,ethers } = require("ethers");
const { Web3Provider } = require("@ethersproject/providers");
const UniswapV2Router02 = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')
const IUniswapV2ERC20    = require('@uniswap/v2-core/build/IUniswapV2ERC20.json')
const IUniswapV2Factory    = require('@uniswap/v2-core/build/IUniswapV2Factory.json')

const { parseEther} = require("ethers/lib/utils");



const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)


const privateKey2 = process.env.PRIVATE_KEY2;


const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);


//Address were taken from deploying DEX on Ganache
const UniswapFactory = process.env.UNISWAP_FACTORY;

const RouterAdderess = process.env.UNISWAP_ROUTER;


let rawdata = fs.readFileSync('./scripts/e_stableSwapScenario/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const DEXPriceOracleJSON = {
        address : addresses.dexPriceOracle
}
    
const FathomOraclePriceFeedJSON = {
        address : addresses.fathomOraclePriceFeed
}

const WXDCJSON = {
    address : addresses.WXDC
}

const USDTJSON = {
        address : addresses.USDT
}

const fathomStablecoinJSON = {
    address : addresses.fathomStablecoin
}

async function main() {
        //USDT attach
        const BEP20 = await hre.ethers.getContractFactory("BEP20");
        const USDT = await BEP20.attach(
                USDTJSON.address // The deployed contract address
        )

        // Copyright Fathom 2022
        const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
        const fathomStablecoin = await FathomStablecoin.attach(
            fathomStablecoinJSON.address 
        ).connect(walletAlice)

        //Mint some stablecoin to Alice
        //console.log("Minting 1000 Stablecoin to Alice...")
        // await fathomStablecoin.mint(walletAlice.address, parseEther("1000"))
     await fathomStablecoin.approve(RouterAdderess, parseEther("1000"));

     console.log('depagging the stablecoin price by buying more of USDT from FathomUSD-USDT pair.')
     await swapTokens(fathomStablecoin.address,USDT.address,100,walletAlice)
     console.log('depagged the stablecoin price.')
}

async function swapTokens(tokenIn, tokenOut, amountIn, wallet) {
        try {

                const routerContract = new ethers.Contract(RouterAdderess, UniswapV2Router02.abi, wallet)
     
                var gasPrice = '5000000000';
                var gasLimit = '231795'

                var amounts = await routerContract.getAmountsOut(amountIn, [tokenIn, tokenOut])
                const amountOutMin = amounts[1].sub(amounts[1].div(10));
                console.log(`amountOutMin: ${amountOutMin}`)

                var tx =    routerContract.swapExactTokensForTokens(
                        parseEther(amountIn.toString()),
                        parseEther(amountOutMin.toString()),
                        [tokenIn, tokenOut],
                        wallet.address,
                        Date.now() + 1000 * 60 * 3, //10 minutes
                        { 
                             gasPrice: gasPrice, 
                            gasLimit: gasLimit
                        }
                    );
        } catch(e) {
                console.log(e)
        }
}


main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
})