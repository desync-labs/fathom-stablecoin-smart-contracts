// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");
// const MaxUint256 = require("@ethersproject/constants");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const wipeAllAndUnlockXDC = async (proxyWallet, from, positionId, collateralAmount, stablecoinAmount) => {
  const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
  const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
  const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
  const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
  const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "AnkrCollateralAdapter");
  const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");

  await fathomStablecoin.approve(proxyWallet.address, stablecoinAmount, { from: from})

  console.log("closePosition1");


  const wipeAllAndUnlockXDCAbi = [
      "function wipeAllAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, bytes calldata _data)"
  ];
  const wipeAllAndUnlockXDCIFace = new ethers.utils.Interface(wipeAllAndUnlockXDCAbi);
  const closePositionCall = wipeAllAndUnlockXDCIFace.encodeFunctionData("wipeAllAndUnlockXDC", [
      positionManager.address,
      xdcAdapter.address,
      stablecoinAdapter.address,
      positionId,
      collateralAmount, // wad
      ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ])
  console.log(closePositionCall);
  console.log("closePosition2");
  await proxyWallet.execute2(fathomStablecoinProxyActions.address, closePositionCall, { from: from })
  console.log("closePosition3");
}

module.exports = async function(deployer) {

  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
  const proxyWalletRegistry = await artifacts.initializeInterfaceAt("ProxyWalletRegistry", "ProxyWalletRegistry");

  const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)

  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
  // const proxyWalletAsAliceOwner = await proxyWalletAsAlice.owner({ from: AliceAddress });
  // console.log(AliceAddress == proxyWalletAsAliceOwner);


  await wipeAllAndUnlockXDC(proxyWalletAsAlice, AliceAddress, 1, WeiPerWad, WeiPerWad.mul(3));
  
};