const fs = require('fs');
const rawdata = fs.readFileSync('../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (collateral_pool_id, stablecoinAmount) => {

    console.log("here1");

    const openLockXDCAndDrawAbi = [
        "function openLockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
    ];
    const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockXDCAndDrawAbi);
    const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockXDCAndDraw", [
        stablecoinAddress.positionManager,  //Position Manager
        stablecoinAddress.stabilityFeeCollector, // StabilityFeeCollector
        stablecoinAddress.collateralTokenAdapter, // CollateralTokenAdapter
        stablecoinAddress.stablecoinAdapter, // StablecoinAdapter
        collateral_pool_id,
        stablecoinAmount, // wad
        "0x00",
    ])
    console.log("below is the encoded data for opening position");
    console.log(openPositionCall);

}

module.exports = async function (deployer) {
    await openPositionAndDraw(COLLATERAL_POOL_ID, WeiPerWad.mul(15));
};