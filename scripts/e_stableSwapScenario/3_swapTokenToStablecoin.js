const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { BigNumber } = require("ethers");
const { Web3Provider } = require("@ethersproject/providers");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)


const privateKey1 = process.env.PRIVATE_KEY1;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletDeployer = new hre.ethers.Wallet(privateKey1,provider);

// the first address from ganache
const DeployerAddress = walletDeployer.address;


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

async function main() {

        const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
        const bookKeeper = await BookKeeper.attach(
            bookKeeperJSON.address // The deployed contract address
        )
        
        const StableSwapModule = await hre.ethers.getContractFactory("StableSwapModule");
        const stableSwapModule = await StableSwapModule.attach(
                stableSwapModuleJSON.address // The deployed contract address
        )
        
        const AuthTokenAdapter = await hre.ethers.getContractFactory("AuthTokenAdapter");
        const authTokenAdapter = await AuthTokenAdapter.attach(
                authTokenAdapterJSON.address // The deployed contract address
        )
        
        //WXDC attach
        const BEP20 = await hre.ethers.getContractFactory("BEP20");
        const USDT = await BEP20.attach(
                USDTJSON.address // The deployed contract address
        )

        const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
        const fathomStablecoin = await FathomStablecoin.attach(
            fathomStablecoinJSON.address // The deployed contract address
        )

        const SystemDebtEngine = await hre.ethers.getContractFactory("SystemDebtEngine");
        const systemDebtEngine = await SystemDebtEngine.attach(
            systemDebtEngineJSON.address // The deployed contract address
        )
 
        //White list address in bookKeeper
        await bookKeeper.whitelist(stablecoinAdapter.address)

        //Set feeIn/feeOut
        await stableSwapModule.setFeeIn(WeiPerWad.div(1000))

        // Approve 10,000 
        await USDT.approve(authTokenAdapter.address, WeiPerWad.mul(5000))

        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(DeployerAddress)
        const USDTBalance = await USDT.balanceOf(DeployerAddress)


        console.log("Stablecoin balance before swap: " + fathomStablecoinBalance)
        console.log("USDT balance before swap: " + USDTBalance)    
        //console.log("Debt Engine balance before swap: " + debtEngineBalance)    

        //swapping 1000*10**18
        console.log(`Swaping ${WeiPerWad.mul(5000)} Token To Stablecoin.`)
        await stableSwapModule.swapTokenToStablecoin(DeployerAddress, WeiPerWad.mul(5000))

        const fathomStablecoinUpdatedBalance = await fathomStablecoin.balanceOf(DeployerAddress)
        const USDTUpdatedBalance = await USDT.balanceOf(DeployerAddress)

        //feein = 1000[input token] * 0.001[fee in] = 1
        //Amount of stable coin after swap should be 1000 - 1 (fee) = 999
        console.log("Stablecoin balance after swap: " + fathomStablecoinUpdatedBalance)
        console.log("USDT balance after swap: " + USDTUpdatedBalance)
    }

main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
});
    