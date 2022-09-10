//https://docs.uniswap.org/protocol/V2/reference/smart-contracts/router-02

const hre = require("hardhat");

require("dotenv").config();
const fs = require('fs');

const { BigNumber } = require("ethers");
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


//Address were taken from deploying DEX on Ganache
//Address were taken from deploying DEX on Ganache
const UniswapFactory = process.env.UNISWAP_FACTORY;

const RouterAdderess = process.env.UNISWAP_ROUTER;

// the first address from ganache
const DeployerAddress = walletDeployer.address;



let rawdata = fs.readFileSync('./scripts/e_stableSwapScenario/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

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
        //WXDC attach
        const BEP20 = await hre.ethers.getContractFactory("BEP20");
        const WXDC = await BEP20.attach(
                WXDCJSON.address // The deployed contract address
        ).connect(walletDeployer)

        //USDT attach
        const USDT = await BEP20.attach(
                USDTJSON.address // The deployed contract address
        ).connect(walletDeployer)

        // Original Copyright Alpaca Fin Corporation 2022
// Copyright Fathom 2022
        const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
        const fathomStablecoin = await FathomStablecoin.attach(
            fathomStablecoinJSON.address 
        ).connect(walletDeployer)

        await WXDC.approve(RouterAdderess, parseEther("50000"));
        await USDT.approve(RouterAdderess, parseEther("50000"));
        await fathomStablecoin.approve(RouterAdderess, parseEther("50000"));

        await addLiquidity(WXDC.address,USDT.address,"WXDC","USDT",1000,2000,walletDeployer)
        await addLiquidity(fathomStablecoin.address,USDT.address,"FathomUSD","USDT",3000,3000,walletDeployer)
}

async function addLiquidity(token1Address, 
                                                        token2Address, 
                                                        token1Symbol, 
                                                        token2Symbol, 
                                                        token1Amount,
                                                        token2Amount, 
                                                        tokwnOwner) {


        console.log(`Addiung Liquidity for Pair ${token1Symbol}-${token2Symbol}`)
        
        const routerContract = new hre.ethers.Contract(RouterAdderess, UniswapV2Router02.abi, tokwnOwner)
        const factoryContract = new hre.ethers.Contract(UniswapFactory, IUniswapV2Factory.abi, tokwnOwner)

        await routerContract.addLiquidity(token1Address, 
                token2Address, 
                parseEther(token1Amount.toString()), 
                parseEther(token2Amount.toString()),    
                parseEther(token1Amount.toString()),    
                parseEther(token2Amount.toString()),    
                tokwnOwner.address, 
                await getDeadlineTimestamp(10000));

        let pairAddress    = await factoryContract.getPair(token1Address,token2Address) 
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