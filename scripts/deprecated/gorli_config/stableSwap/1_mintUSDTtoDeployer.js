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
    await USDT.mint("0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0", WeiPerWad.mul(3000000));
    console.log("Deployer's USDT balance is " + await USDT.balanceOf("0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0"));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
