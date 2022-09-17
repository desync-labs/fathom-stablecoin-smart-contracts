const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");


const COLLATERAL_POOL_ID = formatBytes32String("WXDC")

let rawdata = fs.readFileSync('./scripts/g_globalStabilityFeeManipulation/cupcakes/0_deployment.json');
let addresses = JSON.parse(rawdata);

const stabilityFeeCollectorJSON = {
    address : addresses.stabilityFeeCollector
}

const bookKeeperJSON = {
    address : addresses.bookKeeper
}

const systemDebtEngineJSON = {
    address : addresses.systemDebtEngine
}

const collateralPoolConfigJSON = {
    address : addresses.collateralPoolConfig
}

async function main() {

    // BookKeeper attach
    const BookKeeper = await hre.ethers.getContractFactory("BookKeeper");
    const bookKeeper = await BookKeeper.attach(
        bookKeeperJSON.address // The deployed contract address
    )

    //CollateralPoolConfig attach
    const CollateralPoolConfig = await hre.ethers.getContractFactory("CollateralPoolConfig");
    const collateralPoolConfig = await CollateralPoolConfig.attach(
        collateralPoolConfigJSON.address // The deployed contract address
    )

    //StabilityFeeCollector attach
    const StabilityFeeCollector = await hre.ethers.getContractFactory("StabilityFeeCollector");
    const stabilityFeeCollector = await StabilityFeeCollector.attach(
    stabilityFeeCollectorJSON.address // The deployed contract address
    )

    console.log("Collateral pool accumulated rate: " + await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID));
    console.log("Debt engine stable coin balance in book keeper: " + await bookKeeper.stablecoin(systemDebtEngineJSON.address));

    // Travel to the future
    await hre.ethers.provider.send("evm_increaseTime", [BigNumber.from("31536000").toNumber()]);
    await hre.ethers.provider.send("evm_mine", []);
    console.log("one year passed");

    await stabilityFeeCollector.collect(COLLATERAL_POOL_ID);
    console.log("collected");

    console.log("Debt engine stable coin balance in book keeper: " + await bookKeeper.stablecoin(systemDebtEngineJSON.address));
    console.log("Collateral pool accumulated rate: " + await collateralPoolConfig.getDebtAccumulatedRate(COLLATERAL_POOL_ID));

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
