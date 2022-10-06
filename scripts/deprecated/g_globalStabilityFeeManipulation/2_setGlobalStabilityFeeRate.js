const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { BigNumber } = require("ethers");

let rawdata = fs.readFileSync('./scripts/g_globalStabilityFeeManipulation/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const stabilityFeeCollectorJSON = {
    address : addresses.stabilityFeeCollector
}

async function main() {
    //StabilityFeeCollector attach
    const StabilityFeeCollector = await hre.ethers.getContractFactory("StabilityFeeCollector");
    const stabilityFeeCollector = await StabilityFeeCollector.attach(
    stabilityFeeCollectorJSON.address // The deployed contract address
    )

    // set 0.5% global stability fee
    await stabilityFeeCollector.setGlobalStabilityFeeRate(BigNumber.from("1000000000158153903837946258"));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
