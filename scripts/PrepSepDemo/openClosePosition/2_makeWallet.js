require("dotenv").config();
const fs = require('fs');

const ProxyWalletRegistry = artifacts.require('./8.17/proxy-wallet/ProxyWalletRegistry.sol');

let rawdata = fs.readFileSync('../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);

module.exports = async function(deployer) {

    const AliceAddress = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204" // <-ganache deployer address as Alice

    const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);

    // ProxyWalletCreation for Alice
    const proxyWalletAlice = await CreateProxyWallet(AliceAddress);
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
    async function CreateProxyWallet(address) {
        await proxyWalletRegistry.build(address);
        const proxyWallet = await proxyWalletRegistry.proxies(address);
        // console.log("proxy Wallet of Alice is " + proxyWalletAlice);
        return proxyWallet;
    }
}