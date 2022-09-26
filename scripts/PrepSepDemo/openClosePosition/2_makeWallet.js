const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const ProxyWalletRegistry = artifacts.require('./8.17/proxy-wallet/ProxyWalletRegistry.sol');

let rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports = async function(deployer) {
    const proxyWalletRegistryAbi = ProxyWalletRegistryArtifact.abi;
    const ProxyWalletRegistry = await hre.ethers.getContractFactory("ProxyWalletRegistry");
    const proxyWalletRegistry = await ProxyWalletRegistry.attach(
        stablecoinAddress.proxyWalletRegistry // The deployed contract address
    )
    // ProxyWalletCreation for Alice
    const proxyWalletAlice = await CreateProxyWallet(walletAlice, AliceAddress);
    console.log("Deployed proxyWallet of Alice is : "+ proxyWalletAlice);

    let proxyWalletAddresses = { 
        proxyWalletAlice: proxyWalletAlice
    };

    let data = JSON.stringify(proxyWalletAddresses);
    fs.writeFileSync('./scripts/PrepSepDemo/openClosePosition/cupcakes/2_proxyWalletAddresses.json', data);


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