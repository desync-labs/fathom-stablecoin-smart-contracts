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


const privateKey1 = process.env.PRIVATE_KEY1;
const privateKey2 = process.env.PRIVATE_KEY2;


const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletDeployer = new hre.ethers.Wallet(privateKey1,provider);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);


// the first address from ganache
const DeployerAddress = walletDeployer.address;


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
        ).connect(walletDeployer)

        const WXDC = await BEP20.attach(
            WXDCJSON.address // The deployed contract address
        ).connect(walletDeployer)

        // Copyright Fathom 2022
        const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
        const fathomStablecoin = await FathomStablecoin.attach(
            fathomStablecoinJSON.address 
        ).connect(walletDeployer)

     /// NOTE: (if you have 1 token0 how much you can sell it for token1)
     //let currentStableCoinPrice = await fetchPrice(USDT.address,fathomStablecoin.address)

     let deployerStableCoinBalance = await fathomStablecoin.balanceOf(walletDeployer.address)
     let deployerUSDTCoinBalance = await USDT.balanceOf(walletDeployer.address)
     let deployerWXDCCoinBalance = await WXDC.balanceOf(walletDeployer.address)

     //console.log(`Current price of Stablecoin is: ${currentStableCoinPrice}`)
     console.log(`Deployer balance of Stablecoin is: ${deployerStableCoinBalance}`)
     console.log(`Deployer balance of USDT is: ${deployerUSDTCoinBalance}`)
     console.log(`Deployer balance of WXDC is: ${deployerWXDCCoinBalance}`)
}

main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
})