// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");

const { getProxy } = require("../common/proxies");

const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const lockXDCAndDraw = async (positionId, stablecoinAmount) => {

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");

  const lockXDCAndDrawAbi = [
      "function lockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const lockXDCAndDrawIFace = new ethers.utils.Interface(lockXDCAndDrawAbi);
  const topUpCall = lockXDCAndDrawIFace.encodeFunctionData("lockXDCAndDraw", [
      positionManager.address,
      stabilityFeeCollector.address,
      collateralTokenAdapter.address,
      stablecoinAdapter.address,
      positionId,
      stablecoinAmount, // wad
      "0x00",
  ])

  console.log(topUpCall);
}

module.exports = async function(deployer) {
  await lockXDCAndDraw(1, WeiPerWad.mul(0));
};