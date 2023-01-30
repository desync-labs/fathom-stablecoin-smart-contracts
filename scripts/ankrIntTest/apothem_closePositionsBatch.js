// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");
// const MaxUint256 = require("@ethersproject/constants");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const wipeAllAndUnlockXDC = async (proxyWallet, positionId, collateralAmount) => {
  const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
  const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
  const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
  const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
  const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "AnkrCollateralAdapter");
  const fathomStablecoin = await artifacts.initializeInterfaceAt("FathomStablecoin", "FathomStablecoin");

  // await fathomStablecoin.approve(proxyWallet.address, stablecoinAmount)

  // console.log("closePosition1");


  const wipeAllAndUnlockXDCAbi = [
      "function wipeAllAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, bytes calldata _data)"
  ];
  const wipeAllAndUnlockXDCIFace = new ethers.utils.Interface(wipeAllAndUnlockXDCAbi);
  const closePositionCall = wipeAllAndUnlockXDCIFace.encodeFunctionData("wipeAllAndUnlockXDC", [
      "0xF1760BE07B3c3162Ff1782D4a619E8Fc2028a807",
      "0xd28a2B214F6b8047148e3CA323357766EC124061",
      "0x0C57BeB61545B7899f2C6fCD5ECbC6c5D29be6cc",
      positionId,
      collateralAmount, // wad
      "0x00",
  ])
  await proxyWallet.execute(closePositionCall, {gasLimit: 2000000})
  console.log(`Position Number ${positionId} closed`);
}

module.exports = async function(deployer) {

  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
  // const proxyWalletRegistry = await artifacts.initializeInterfaceAt("ProxyWalletRegistry", "ProxyWalletRegistry");

  // const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)

  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", "0xaB9E9e40841F97a260E9E9ccc1A809A4663b7733");

  for (let i = 35; i < 38; i++) {
    await wipeAllAndUnlockXDC(proxyWalletAsAlice, i, WeiPerWad.mul(10));
  }


};