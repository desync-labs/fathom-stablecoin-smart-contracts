const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

// getting artifact
const ProxyWalletRegistryArtifact = require("../../../artifacts/contracts/8.17/proxy-wallet/ProxyWalletRegistry.sol/ProxyWalletRegistry.json");

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

// The third address from ganache
const BobAddress = walletBob.address;


let rawdata = fs.readFileSync('addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

async function main() {
    const proxyWalletRegistryAbi = ProxyWalletRegistryArtifact.abi;
    const ProxyWalletRegistry = await hre.ethers.getContractFactory("ProxyWalletRegistry");
    const proxyWalletRegistry = await ProxyWalletRegistry.attach(
        stablecoinAddress.proxyWalletRegistry // The deployed contract address
    )

    // ProxyWalletCreation for bob
    const proxyWalletBob = await CreateProxyWallet(walletBob, BobAddress);
    console.log("Deployed proxyWallet of Bob is : "+ proxyWalletBob);

    let proxyWalletAddresses = { 
        proxyWalletBob: proxyWalletBob
    };

    let data = JSON.stringify(proxyWalletAddresses);
    fs.writeFileSync('./scripts/PrepSepDemo/closePosition/cupcakes/2_proxyWalletAddresses.json', data);


    // https://github.com/ethers-io/ethers.js/issues/1160
    // @DEV fn names with same names causes collision issue in ethers.js
    // so fn name of build() w/o parameter changed to build0
    // const proxyWalletDeployer = await proxyWalletRegistryAsDeployer.proxies(DeployerAddress);
    async function CreateProxyWallet(wallet, address) {
        const proxyWalletRegistryAsUser = new hre.ethers.Contract(proxyWalletRegistry.address, proxyWalletRegistryAbi, wallet);
        await proxyWalletRegistryAsUser.build(address);
        const proxyWallet = await proxyWalletRegistryAsUser.proxies(address);
        return proxyWallet;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
