const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');


const WeiPerWad = hre.ethers.constants.WeiPerEther

let rawdata = fs.readFileSync('addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

const privateKey1 = process.env.GORLI_DEPLOYER;
const url = "https://goerli.infura.io/v3/d85fb151be214d8eaee85c855d9d3dab";

async function main() {
    let provider = new ethers.providers.JsonRpcProvider(url);
    const walletDeployer = new ethers.Wallet(privateKey1,provider);

    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const USDT = await BEP20.attach(
        stablecoinAddress.USDT // The deployed contract address
    );

    const StableSwapModule = await hre.ethers.getContractFactory("StableSwapModule");
    const stableSwapModule = await StableSwapModule.attach(
        stablecoinAddress.stableSwapModule // The deployed contract address
    );

    const FathomStablecoin = await hre.ethers.getContractFactory("FathomStablecoin");
    const fathomStablecoin = await FathomStablecoin.attach(
        stablecoinAddress.fathomStablecoin // The deployed contract address
    );

    const deployerAddress = walletDeployer.address;

    // Approve 10,000 
   await USDT.approve(stablecoinAddress.authTokenAdapter, WeiPerWad.mul(3000000));


   await stableSwapModule.swapTokenToStablecoin(deployerAddress, WeiPerWad.mul(3000000));

   let fathomStablecoinUpdatedBalance = await fathomStablecoin.balanceOf(deployerAddress);

   console.log('fathomStablecoinBalanceBeforeSwap' + fathomStablecoinUpdatedBalance);

   fathomStablecoinUpdatedBalance = await fathomStablecoin.balanceOf(deployerAddress);

    console.log('fathomStablecoinBalanceAfterSwap' + fathomStablecoinUpdatedBalance);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
