// const fs = require('fs');
// const rawdata = fs.readFileSync('../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { ethers } = require("ethers");


const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");


const { WeiPerWad } = require("../tests/helper/unit");


const openPositionAndDraw = async (proxyWallet, collateral_pool_id, stablecoinAmount) => {
  const positionManager = await artifacts.initializeInterfaceAt("PositionManager", "0xF1760BE07B3c3162Ff1782D4a619E8Fc2028a807");
  const stablecoinAdapter = await artifacts.initializeInterfaceAt("StablecoinAdapter", "0x0C57BeB61545B7899f2C6fCD5ECbC6c5D29be6cc");
  const stabilityFeeCollector = await artifacts.initializeInterfaceAt("StabilityFeeCollector", "0x37e52CF56C9a20330A544434210A39338958223D");
  const xdcAdapter = await artifacts.initializeInterfaceAt("AnkrCollateralAdapter", "0xd28a2B214F6b8047148e3CA323357766EC124061");

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
  // const proxyWalletRegistry = await artifacts.initializeInterfaceAt("ProxyWalletRegistry", "ProxyWalletRegistry");

  //uncomment below to make wallet
  // await proxyWalletRegistry.build(apothemDeployerTest, { from: apothemDeployerTest, gasLimit: 2000000 })
  // const proxyWalletapothemDeployerTest = await proxyWalletRegistry.proxies("0xB4A0403376CA4f0a99b863840EfFf78bc061d71F")
  // let proxyWalletapothemDeployerTest = "0xCd74911Bf1CaFE11c83A4d26597B2dCBe6Dd4993";
  let proxyWalletapothemDeployerTest = "0xaB9E9e40841F97a260E9E9ccc1A809A4663b7733";

  
  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletapothemDeployerTest);
  // const proxyWalletAsAliceOwner = await proxyWalletAsAlice.owner();
  // console.log(apothemDeployerTest == proxyWalletAsAliceOwner);
                                                                                  //how much FXD to borrow
  await openPositionAndDraw(proxyWalletAsAlice, COLLATERAL_POOL_ID, WeiPerWad.mul(700));
};