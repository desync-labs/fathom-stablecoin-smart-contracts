// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (collateral_pool_id, stablecoinAmount) => {

  console.log("here1");

  const openLockXDCAndDrawAbi = [
      "function openLockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockXDCAndDrawAbi);
  const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockXDCAndDraw", [
      "0xFBb898b3ea40E4932F9958f16257100a01B8bf9f", //Position Manager
      "0x8Af122EBE23bFc4E37E87A448E692948b65B0B11", // StabilityFeeCollector
      "0x208EB9b89855fF06f7cd57AAa85140027304E6ef", //AnkrCollateralAdapter
      "0x7c8367a7CAb1e4b305e60ef7D324AfA49cCf0fD5", // StablecoinAdapter
      collateral_pool_id,
      stablecoinAmount, // wad
      "0x00",
  ])
  console.log("below is the encoded data");
  console.log(openPositionCall);
  // console.log("here2");
  // await proxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall, { from: from, value: ethers.constants.WeiPerEther })
}

module.exports = async function(deployer) {
  await openPositionAndDraw(COLLATERAL_POOL_ID, WeiPerWad.mul(2));
};