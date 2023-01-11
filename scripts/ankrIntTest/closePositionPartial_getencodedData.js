const { ethers } = require("ethers");

const { BigNumber } = require("ethers");
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");
const MaxUint256 = require("@ethersproject/constants");


const wipeAndUnlockXDC = async (positionId, collateralAmount, stablecoinAmount) => {

  console.log("parial closePosition");


  const wipeAndUnlockXDCAbi = [
      "function wipeAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const wipeAndUnlockXDCIFace = new ethers.utils.Interface(wipeAndUnlockXDCAbi);
  const closeParialPositionCall = wipeAndUnlockXDCIFace.encodeFunctionData("wipeAndUnlockXDC", [
    "0xFBb898b3ea40E4932F9958f16257100a01B8bf9f", //Position Manager
    "0x208EB9b89855fF06f7cd57AAa85140027304E6ef", //AnkrCollateralAdapter
    "0x7c8367a7CAb1e4b305e60ef7D324AfA49cCf0fD5", // StablecoinAdapter
      positionId,
      collateralAmount, // wad
      stablecoinAmount, // wad
      "0x00",
  ])
  console.log(closeParialPositionCall);

}

module.exports = async function(deployer) {

  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);

  await wipeAndUnlockXDC(3, WeiPerWad.mul(5), WeiPerWad);

};

// 2 FXD borrowed, 1 XDC paid.

// when partiially closing, 0.5 XDC 1 FXD will pay

//