// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");


const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (proxyWallet, collateral_pool_id, stablecoinAmount) => {
  const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "0xe485eDc3D5aba4dbEcD76a78e6c71c8F5E114F3b");
  const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "0x07a2C89774a3F3c57980AD7A528Aea6F262d8939");
  const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "0x62889248B6C81D31D7acc450cc0334D0AA58A14A");
  const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "0xc3c7f26ffD1cd5ec682E23C076471194DE8ce4f1");

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
      "0x00",
  ])
  console.log("here2");
  const tx = await proxyWallet.execute(openPositionCall, { value: ethers.constants.WeiPerEther.mul(10), gasLimit: 2000000})
  console.log(tx);
                                                                                                        // how much XDC to collateralize
}

module.exports = async function(deployer) {

  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
  const proxyWalletRegistry = await artifacts.initializeInterfaceAt("ProxyWalletRegistry", "ProxyWalletRegistry");

  //uncomment below to make wallet
  // await proxyWalletRegistry.build(apothemDeployerTest, { from: apothemDeployerTest, gasLimit: 2000000 })
  // const proxyWalletapothemDeployerTest = await proxyWalletRegistry.proxies("0xB4A0403376CA4f0a99b863840EfFf78bc061d71F")
  let proxyWalletapothemDeployerTest = "0x3a82aAdEeb6E1b3114A05bF9127D12748E800E93";
  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletapothemDeployerTest);
  // const proxyWalletAsAliceOwner = await proxyWalletAsAlice.owner();
  // console.log(apothemDeployerTest == proxyWalletAsAliceOwner);
                                                                                  //how much FXD to borrow
  await openPositionAndDraw(proxyWalletAsAlice, COLLATERAL_POOL_ID, WeiPerWad.mul(20));
};