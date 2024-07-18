const fs = require('fs');
const rawdata = fs.readFileSync('../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const wipeAndUnlockXDC = async (positionId, collateralAmount, stablecoinAmount) => {

    const wipeAndUnlockXDCAbi = [
        "function wipeAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)"
    ];
    const wipeAndUnlockXDCIFace = new ethers.utils.Interface(wipeAndUnlockXDCAbi);
    const closePositionCall = wipeAndUnlockXDCIFace.encodeFunctionData("wipeAndUnlockXDC", [
        stablecoinAddress.positionManager,  //Position Manager
        stablecoinAddress.collateralTokenAdapter, // CollateralTokenAdapter
        stablecoinAddress.stablecoinAdapter, // StablecoinAdapter
        positionId,
        collateralAmount, // wad
        stablecoinAmount, // wad
        0x00,
    ])
    console.log("below is the encoded data for positionPartial closure");
    console.log(closePositionCall);
}

module.exports = async function (deployer) {
    await wipeAndUnlockXDC(161, WeiPerWad.mul(1), WeiPerWad.mul(1));
};