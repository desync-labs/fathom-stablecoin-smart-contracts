//https://docs.uniswap.org/protocol/V2/reference/smart-contracts/router-02

const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const UniswapV2Router02 = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')
const IUniswapV2ERC20  = require('@uniswap/v2-core/build/IUniswapV2ERC20.json')
const IUniswapV2Factory  = require('@uniswap/v2-core/build/IUniswapV2Factory.json')
const { parseEther} = require("ethers/lib/utils");

const privateKey1 = process.env.PRIVATE_KEY1;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletDeployer = new hre.ethers.Wallet(privateKey1,provider);

//Address were taken from deploying DEX on Ganache
const FathomswapFactory = process.env.FATHOMSWAP_FACTORY
const FathomswapRouter = process.env.FATHOMSWAP_ROUTER

let rawdata = fs.readFileSync('./scripts/n_multipleCollateral/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const WETHJSON= {
  address : addresses.WETH
}
const USDTJSON = {
    address : addresses.USDT
}
const WXDCJSON = {
  address : addresses.WXDC
}
const DEXPriceOracleJSON = {
    address : addresses.dexPriceOracle
}

async function main() {
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const WETH = BEP20.attach(WETHJSON.address).connect(walletDeployer)
    const WXDC = BEP20.attach(WXDCJSON.address).connect(walletDeployer)
    const USDT = BEP20.attach(USDTJSON.address).connect(walletDeployer)

    await WETH.approve(FathomswapRouter, parseEther("1000"));
    await WXDC.approve(FathomswapRouter, parseEther("1000"));
    await USDT.approve(FathomswapRouter, parseEther("200000"));

    await addLiquidity(WETH.address,USDT.address,"WETH","USDT", 1000, 100000, walletDeployer)
    await addLiquidity(WXDC.address,USDT.address,"WXDC","USDT", 1000, 100000, walletDeployer)

    let currentPriceWETH = await fetchPrice(USDTJSON.address,WETHJSON.address)
    let currentPriceWXDC = await fetchPrice(USDTJSON.address,WXDCJSON.address)

    console.log("WETH Price : " + currentPriceWETH);
    console.log("WXDC Price : " + currentPriceWXDC);
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

async function addLiquidity(token1Address, 
                            token2Address, 
                            token1Symbol, 
                            token2Symbol, 
                            token1Amount,
                            token2Amount, 
                            tokwnOwner) {


    console.log(`Addiung Liquidity for Pair ${token1Symbol}-${token2Symbol}`)
    
    const routerContract = new ethers.Contract(FathomswapRouter, UniswapV2Router02.abi, tokwnOwner)
    const factoryContract = new ethers.Contract(FathomswapFactory, IUniswapV2Factory.abi, tokwnOwner)

    await routerContract.addLiquidity(token1Address, 
        token2Address, 
        parseEther(token1Amount.toString()), 
        parseEther(token2Amount.toString()),  
        parseEther(token1Amount.toString()),  
        parseEther(token2Amount.toString()),  
        tokwnOwner.address, 
        await getDeadlineTimestamp(10000));

    let pairAddress  = await factoryContract.getPair(token1Address,token2Address) 
    let pairContract = new ethers.Contract(pairAddress, IUniswapV2ERC20.abi,tokwnOwner)
    console.log(`${token1Symbol}-${token2Symbol} Pair Added to Liquidity Pool at Address ${pairAddress}`)
    console.log(`Balance of LP token for pair ${token1Symbol}-${token2Symbol} is ${await pairContract.balanceOf(tokwnOwner.address)}`)
}

async function getDeadlineTimestamp(deadline) {
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    return blockBefore.timestamp + deadline;
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})