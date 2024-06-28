const fs = require('fs');
const rawdata = fs.readFileSync('../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("NATIVE");

const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (collateralPoolId, stablecoinAmount) => {

    console.log("here1");

    const openLockNATIVEAndDrawAbi = [
        "function openLockNATIVEAndDraw(address _manager, address _stabilityFeeCollector, address _nativeAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
    ];
    const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockNATIVEAndDrawAbi);
    const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockNATIVEAndDraw", [
        stablecoinAddress.positionManager,  //Position Manager
        stablecoinAddress.stabilityFeeCollector, // StabilityFeeCollector
        stablecoinAddress.collateralTokenAdapter, // CollateralTokenAdapter
        stablecoinAddress.stablecoinAdapter, // StablecoinAdapter
        collateralPoolId,
        stablecoinAmount, // wad
        "0x00",
    ])
    console.log("below is the encoded data for opening position");
    console.log(openPositionCall);

}

module.exports = async function (deployer) {
    await openPositionAndDraw(COLLATERAL_POOL_ID, WeiPerWad.mul(15));
};