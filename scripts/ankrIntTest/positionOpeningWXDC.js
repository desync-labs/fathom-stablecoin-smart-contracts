// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");

const { getProxy } = require("../common/proxies");

const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const openLockTokenAndDraw = async (collateral_pool_id, collateralAmount, stablecoinAmount) => {
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  console.log("here1");

  const openLockTokenAndDrawAbi = [
      "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)"
  ];
  const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockTokenAndDrawAbi);
  const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
      positionManager.address,
      stabilityFeeCollector.address,
      collateralTokenAdapter.address,
      stablecoinAdapter.address,
      collateral_pool_id,
      collateralAmount,
      stablecoinAmount, // wad
      1,
      "0x00",
  ])
  console.log("below is the encoded data");
  console.log(openPositionCall);
  // console.log("here2");
  // await proxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall, { from: from, value: ethers.constants.WeiPerEther })
  // coralX execute --network development --path scripts/ankrIntTest/positionOpening_getEncodedData.js

}

module.exports = async function(deployer) {
  await openLockTokenAndDraw(COLLATERAL_POOL_ID, WeiPerWad.mul(10), WeiPerWad.mul(10));
};