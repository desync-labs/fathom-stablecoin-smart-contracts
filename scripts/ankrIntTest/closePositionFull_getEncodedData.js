// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");
// const MaxUint256 = require("@ethersproject/constants");


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
    "0xFBb898b3ea40E4932F9958f16257100a01B8bf9f", //Position Manager
    "0x208EB9b89855fF06f7cd57AAa85140027304E6ef", //AnkrCollateralAdapter
    "0x7c8367a7CAb1e4b305e60ef7D324AfA49cCf0fD5", // StablecoinAdapter
      positionId,
      collateralAmount, // wad
      "0x00",
  ])

  console.log(closePositionCall);

}

module.exports = async function(deployer) {

  await wipeAllAndUnlockXDC(3, WeiPerWad.mul(10));
  
};