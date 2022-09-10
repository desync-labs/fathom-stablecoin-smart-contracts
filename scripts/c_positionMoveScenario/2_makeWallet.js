const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const ProxyWalletRegistryArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWalletRegistry.sol/ProxyWalletRegistry.json");

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


let rawdata = fs.readFileSync('./scripts/c_positionMoveScenario/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);
const proxyWalletRegistryJSON = {
    address : addresses.proxyWalletRegistry
}

async function main() {
    const proxyWalletRegistryAbi = ProxyWalletRegistryArtifact.abi;
    const proxyWalletAbi = ProxyWalletArtifact.abi;
    const ProxyWalletRegistry = await hre.ethers.getContractFactory("ProxyWalletRegistry");
    const proxyWalletRegistry = await ProxyWalletRegistry.attach(
        proxyWalletRegistryJSON.address // The deployed contract address
    )
    // ProxyWalletCreation for Alice
    const proxyWalletAlice = await CreateProxyWallet(walletAlice, AliceAddress);
    const proxyWalletAsAlice = new hre.ethers.Contract(proxyWalletAlice, proxyWalletAbi, walletAlice);
    console.log("Deployed proxyWallet of Alice is : "+ proxyWalletAlice);
    // ProxyWalletCreation for bob
    const proxyWalletBob = await CreateProxyWallet(walletBob, BobAddress);
    const proxyWalletAsBob = new hre.ethers.Contract(proxyWalletBob, proxyWalletAbi, walletBob);
    console.log("Deployed proxyWallet of Bob is : "+ proxyWalletBob);

    let proxyWalletAddresses = { 
        proxyWalletAlice: proxyWalletAlice,
        proxyWalletBob: proxyWalletBob
    };

    let data = JSON.stringify(proxyWalletAddresses);
    fs.writeFileSync('./scripts/c_positionMoveScenario/cupcakes/2_proxyWalletAddresses.json', data);


    // https://github.com/ethers-io/ethers.js/issues/1160
    // @DEV fn names with same names causes collision issue in ethers.js
    // so fn name of build() w/o parameter changed to build0
    // const proxyWalletDeployer = await proxyWalletRegistryAsDeployer.proxies(DeployerAddress);
    async function CreateProxyWallet(wallet, address) {
        const proxyWalletRegistryAsUser = new hre.ethers.Contract(proxyWalletRegistry.address, proxyWalletRegistryAbi, wallet);
        await proxyWalletRegistryAsUser.build(address);
        const proxyWallet = await proxyWalletRegistryAsUser.proxies(address);
        // console.log("proxy Wallet of Alice is " + proxyWalletAlice);
        return proxyWallet;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
