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
    "0xF1760BE07B3c3162Ff1782D4a619E8Fc2028a807", //Position Manager
    "0xd28a2B214F6b8047148e3CA323357766EC124061", //AnkrCollateralAdapter
    "0x0C57BeB61545B7899f2C6fCD5ECbC6c5D29be6cc", // StablecoinAdapter
      positionId,
      collateralAmount, // wad
      "0x00",
  ])

  console.log(closePositionCall);

}

module.exports = async function(deployer) {

  await wipeAllAndUnlockXDC(5, WeiPerWad.mul(10));
  
};