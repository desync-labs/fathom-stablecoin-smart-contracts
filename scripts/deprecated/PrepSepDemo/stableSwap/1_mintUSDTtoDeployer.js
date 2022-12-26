const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');


const WeiPerWad = hre.ethers.constants.WeiPerEther

let rawdata = fs.readFileSync('addresses.json');
let stablecoinAddress = JSON.parse(rawdata);



async function main() {
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const USDT = await BEP20.attach(
        stablecoinAddress.USDT // The deployed contract address
    )
    const signers = await ethers.getSigners();
    const deployerAddress = signers[0].address;
    await USDT.mint(deployerAddress, WeiPerWad.mul(3000000));
    await USDT.mint(signers[1].address, WeiPerWad.mul(3000000));
    await USDT.mint(signers[2].address, WeiPerWad.mul(3000000));
    console.log("Deployer's USDT balance is " + await USDT.balanceOf(deployerAddress));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
