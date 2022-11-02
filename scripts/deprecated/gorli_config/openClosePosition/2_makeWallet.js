const hre = require("hardhat");

const fs = require('fs');

// getting artifact
const ProxyWalletRegistryArtifact = require("../../../artifacts/contracts/8.17/proxy-wallet/ProxyWalletRegistry.sol/ProxyWalletRegistry.json");





// The second address from ganache
const AliceAddress =   "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";


let rawdata = fs.readFileSync('gorli.json');
let stablecoinAddress = JSON.parse(rawdata);

async function main() {
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
    fs.writeFileSync('./scripts/gorli_config/openClosePosition/cupcakes/2_proxyWalletAddresses.json', data);


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
