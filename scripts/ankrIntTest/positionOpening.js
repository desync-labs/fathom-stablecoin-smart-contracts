// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (proxyWallet, from, collateral_pool_id, stablecoinAmount) => {
  const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
  const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
  const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
  const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
  const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "AnkrCollateralAdapter");

  console.log("here1");

  const openLockXDCAndDrawAbi = [
      "function openLockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockXDCAndDrawAbi);
  const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockXDCAndDraw", [
      positionManager.address,
      stabilityFeeCollector.address,
      xdcAdapter.address,
      stablecoinAdapter.address,
      collateral_pool_id,
      stablecoinAmount, // wad
      ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ])
  console.log("here2");
  await proxyWallet.execute2(fathomStablecoinProxyActions.address, openPositionCall, { from: from, value: ethers.constants.WeiPerEther })
  console.log("here3");
}

module.exports = async function(deployer) {
  
  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
  const proxyWalletRegistry = await artifacts.initializeInterfaceAt("ProxyWalletRegistry", "ProxyWalletRegistry");

  //uncomment below to make wallet
  await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
  const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)

  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
  const proxyWalletAsAliceOwner = await proxyWalletAsAlice.owner({ from: AliceAddress });
  console.log(AliceAddress == proxyWalletAsAliceOwner);

  await openPositionAndDraw(proxyWalletAsAlice, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(3));
};