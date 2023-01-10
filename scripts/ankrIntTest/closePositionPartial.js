const { ethers } = require("ethers");

const { BigNumber } = require("ethers");
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");
const MaxUint256 = require("@ethersproject/constants");


const wipeAndUnlockXDC = async (proxyWallet, from, positionId, collateralAmount, stablecoinAmount) => {
  const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
  const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
  const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
  const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
  const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "AnkrCollateralAdapter");
  const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");

  // await fathomStablecoin.approve(proxyWallet.address, stablecoinAmount, { from: from})
  await fathomStablecoin.approve(proxyWallet.address, WeiPerWad.mul(10000), { from: from})

  console.log("parial closePosition");


  const wipeAndUnlockXDCAbi = [
      "function wipeAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const wipeAndUnlockXDCIFace = new ethers.utils.Interface(wipeAndUnlockXDCAbi);
  const closeParialPositionCall = wipeAndUnlockXDCIFace.encodeFunctionData("wipeAndUnlockXDC", [
      positionManager.address,
      xdcAdapter.address,
      stablecoinAdapter.address,
      positionId,
      collateralAmount, // wad
      stablecoinAmount, // wad
      ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ])
  console.log(closeParialPositionCall);
  console.log("closePosition2");
  await proxyWallet.execute2(fathomStablecoinProxyActions.address, closeParialPositionCall, { from: from })
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

  //here return 1 FXD and ask 0.5 XDC worth of aXDCc
  await wipeAndUnlockXDC(proxyWalletAsAlice, AliceAddress, 1, WeiPerWad.div(11), WeiPerWad);

  //what if I full liquidate with partial liq. fns?
  //well full liq works, this means sth is wrong with partial liq.
  //let's debug it line by lien with revert messages
  //2023 Jan 19th 
  // await wipeAndUnlockXDC(proxyWalletAsAlice, AliceAddress, 4, WeiPerWad, WeiPerWad.mul(2));

};

// 2 FXD borrowed, 1 XDC paid.

// when partiially closing, 0.5 XDC 1 FXD will pay

//