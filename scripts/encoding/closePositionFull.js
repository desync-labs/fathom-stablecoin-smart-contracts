const fs = require('fs');
const rawdata = fs.readFileSync('../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");

const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const wipeAllAndUnlockXDC = async (positionId, collateralAmount) => {

    const wipeAllAndUnlockXDCAbi = [
        "function wipeAllAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, bytes calldata _data)"
    ];
    const wipeAllAndUnlockXDCIFace = new ethers.utils.Interface(wipeAllAndUnlockXDCAbi);
    const closePositionCall = wipeAllAndUnlockXDCIFace.encodeFunctionData("wipeAllAndUnlockXDC", [
        stablecoinAddress.positionManager,  //Position Manager
        stablecoinAddress.collateralTokenAdapter, // CollateralTokenAdapter
        stablecoinAddress.stablecoinAdapter, // StablecoinAdapter
        positionId,
        collateralAmount, // wad
        0x00,
    ])
    console.log("below is the encoded data for full position closure");
    console.log(closePositionCall);
}

module.exports = async function (deployer) {
    await wipeAllAndUnlockXDC(161, WeiPerWad.mul(435));
};