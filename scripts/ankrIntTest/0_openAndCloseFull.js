// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");

const { getProxy } = require("../common/proxies");

const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (proxyWallet, from, collateral_pool_id, stablecoinAmount) => {
  // const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "PositionManager");
  // const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "StablecoinAdapter");
  // const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "StabilityFeeCollector");
  // const fathomStablecoinProxyActions = await artifacts.initializeInterfaceAt("FathomStablecoinProxyActions", "FathomStablecoinProxyActions");
  // const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "AnkrCollateralAdapter");

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const stabilityFeeCollector = await getProxy(proxyFactory, "StabilityFeeCollector");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");

  console.log("here1");

  const openLockXDCAndDrawAbi = [
      "function openLockXDCAndDraw(address _manager, address _stabilityFeeCollector, address _xdcAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _stablecoinAmount, bytes calldata _data)"
  ];
  const openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockXDCAndDrawAbi);
  const openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockXDCAndDraw", [
      positionManager.address,
      stabilityFeeCollector.address,
      collateralTokenAdapter.address,
      stablecoinAdapter.address,
      collateral_pool_id,
      stablecoinAmount, // wad
      "0x00",
  ])
  console.log("here2");
  await proxyWallet.execute(openPositionCall, { from: from, value: ethers.constants.WeiPerEther.mul(20) })
  console.log("here3");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");
  const fathomBalance = await fathomStablecoin.balanceOf(from);
  console.log("FXD balance of Alice is " + fathomBalance);
  const provider = ethers.getDefaultProvider("http://127.0.0.1:8545");
  const endBalance = await provider.getBalance(from);
  console.log("ETH balance of Alice is " + endBalance);

                                                                                                        // how much XDC to collateralize
}

const wipeAllAndUnlockXDC = async (proxyWallet, from, positionId, collateralAmount, stablecoinAmount) => {

  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const positionManager = await getProxy(proxyFactory, "PositionManager");
  const collateralTokenAdapter = await getProxy(proxyFactory, "CollateralTokenAdapter");
  const stablecoinAdapter = await getProxy(proxyFactory, "StablecoinAdapter");
  const fathomStablecoin = await getProxy(proxyFactory, "FathomStablecoin");

  await fathomStablecoin.approve(proxyWallet.address, stablecoinAmount, { from: from})

  const wipeAllAndUnlockXDCAbi = [
      "function wipeAllAndUnlockXDC(address _manager, address _xdcAdapter, address _stablecoinAdapter, uint256 _positionId, uint256 _collateralAmount, bytes calldata _data)"
  ];
  const wipeAllAndUnlockXDCIFace = new ethers.utils.Interface(wipeAllAndUnlockXDCAbi);
  const closePositionCall = wipeAllAndUnlockXDCIFace.encodeFunctionData("wipeAllAndUnlockXDC", [
    positionManager.address,
    collateralTokenAdapter.address,
    stablecoinAdapter.address,
    positionId,
      collateralAmount, // wad
      ethers.utils.defaultAbiCoder.encode(["address"], [from]),
  ])

  await proxyWallet.execute(closePositionCall, { from: from })
  const fathomBalance = await fathomStablecoin.balanceOf(from);
  console.log("FXD balance of Alice is " + fathomBalance);
  const provider = ethers.getDefaultProvider("http://127.0.0.1:8545");
  const endBalance = await provider.getBalance(from);
  console.log("ETH balance of Alice is " + endBalance);

}

module.exports = async function(deployer) {
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
  const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");

  //uncomment below to make wallet
  await proxyWalletRegistry.build(AliceAddress, { from: AliceAddress, gasLimit: 2000000 })
  const proxyWalletAliceAddress = await proxyWalletRegistry.proxies(AliceAddress)

  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAliceAddress);
  const proxyWalletAsAliceOwner = await proxyWalletAsAlice.owner({ from: AliceAddress });
  console.log(AliceAddress == proxyWalletAsAliceOwner);
                                                                                  //how much FXD to borrow
  await openPositionAndDraw(proxyWalletAsAlice, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(11));
  await openPositionAndDraw(proxyWalletAsAlice, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(12));
  await openPositionAndDraw(proxyWalletAsAlice, AliceAddress, COLLATERAL_POOL_ID, WeiPerWad.mul(13));

  await wipeAllAndUnlockXDC(proxyWalletAsAlice, AliceAddress, 1, WeiPerWad.mul(20), WeiPerWad.mul(15));
};