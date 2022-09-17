const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { BigNumber } = require("ethers");
const { Web3Provider } = require("@ethersproject/providers");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)


const privateKey = process.env.PRIVATE_KEY3;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletArbitrauger = new hre.ethers.Wallet(privateKey,provider);

// Contract addresses
// the first address from ganache
const arbitraugerAddress = walletArbitrauger.address;
// The second address from ganache
// The third address from ganache
// The fourth address from ganache


let rawdata = fs.readFileSync('./scripts/e_stableSwapScenario/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const USDTJSON = {
    address : addresses.USDT
}

const authTokenAdapterJSON = {
        address : addresses.authTokenAdapter
}

const stablecoinAdapter = {
    address : addresses.stablecoinAdapter
}

const bookKeeperJSON = {
    address : addresses.bookKeeper
}

const fathomStablecoinJSON = {
    address : addresses.fathomStablecoin
}

const stableSwapModuleJSON = {
        address : addresses.stableSwapModule
}

const systemDebtEngineJSON = {
        address : addresses.systemDebtEngine
}

const WXDCJSON = {
    address : addresses.WXDC
}


async function main() {

        const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
        const bookKeeper = await BookKeeper.attach(
            bookKeeperJSON.address // The deployed contract address
        )
        
        const StableSwapModule = await hre.ethers.getContractFactory("StableSwapModule");
        const stableSwapModule = await StableSwapModule.attach(
                stableSwapModuleJSON.address // The deployed contract address
        ).connect(walletArbitrauger)
        
        const AuthTokenAdapter = await hre.ethers.getContractFactory("AuthTokenAdapter");
        const authTokenAdapter = await AuthTokenAdapter.attach(
                authTokenAdapterJSON.address // The deployed contract address
        )
        
        //USDT attach
        const BEP20 = await hre.ethers.getContractFactory("BEP20");
        const USDT = await BEP20.attach(
            USDTJSON.address // The deployed contract address
        )

        const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
        const fathomStablecoin = await FathomStablecoin.attach(
            fathomStablecoinJSON.address // The deployed contract address
        ).connect(walletArbitrauger)

        const SystemDebtEngine = await hre.ethers.getContractFactory("SystemDebtEngine");
        const systemDebtEngine = await SystemDebtEngine.attach(
            systemDebtEngineJSON.address // The deployed contract address
        )
 
        //White list address in bookKeeper
        await bookKeeper.whitelist(authTokenAdapter.address)

        //Set feeIn/feeOut
        await stableSwapModule.setFeeOut(WeiPerWad.div(1000))

        await fathomStablecoin.approve(stableSwapModule.address, WeiPerWad.mul(1000))

        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(arbitraugerAddress)
        const USDTBalance = await USDT.balanceOf(arbitraugerAddress)

        console.log("Stablecoin balance before swap: " + fathomStablecoinBalance) 
        console.log("USDT balance before swap: " + USDTBalance)    
        //console.log("Debt Engine balance before swap: " + WeiPerRad.div(debtEngineBalance))    

        //Initial balance = 999
        //Fee out 998 * 001 = .998
        //total swap = 998 + .998
        //
        console.log(`Swaping ${WeiPerWad.mul(102)} Stablecoin to Token.`)
        await stableSwapModule.swapStablecoinToToken(arbitraugerAddress, WeiPerWad.mul(102))

        const fathomStablecoinUpdatedBalance = await fathomStablecoin.balanceOf(arbitraugerAddress)
        const updatedUSDTBalance = await USDT.balanceOf(arbitraugerAddress)

        console.log("Stablecoin balance after swap: " + fathomStablecoinUpdatedBalance) 
        console.log("USDT balance after swap: " + updatedUSDTBalance)
        //console.log("Debt Engine balance after swap: " + debtEngineUpdatedBalance)    
}

main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
});
    