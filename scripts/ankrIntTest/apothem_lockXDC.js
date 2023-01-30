const { ethers } = require("ethers");

const { BigNumber } = require("ethers");
const { formatBytes32String } = require("ethers/lib/utils");

const COLLATERAL_POOL_ID = formatBytes32String("XDC");

const { AliceAddress } = require("../tests/helper/address");

const { WeiPerWad } = require("../tests/helper/unit");
const MaxUint256 = require("@ethersproject/constants");


const wipeAndUnlockXDC = async (proxyWallet, positionId) => {

  console.log("parial closePosition");


  const lockXDCXDCAbi = [
      "function lockXDC(address _manager, address _xdcAdapter, uint256 _positionId, bytes calldata _data)"
  ];
  const lockXCCIFace = new ethers.utils.Interface(lockXDCXDCAbi);
  const lockXDCCall = lockXCCIFace.encodeFunctionData("lockXDC", [
    "0xF1760BE07B3c3162Ff1782D4a619E8Fc2028a807", //Position Manager
    "0xd28a2B214F6b8047148e3CA323357766EC124061", //AnkrCollateralAdapter
      positionId,
      "0x00",
  ])
  // console.log(closeParialPositionCall);
  await proxyWallet.execute(lockXDCCall, { value: ethers.constants.WeiPerEther.mul(40), gasLimit: 2000000});
  console.log(`Position Number ${positionId} added XDC`);


}

module.exports = async function(deployer) {

  //making wallet
  // const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
  const proxyWalletAsAlice = await artifacts.initializeInterfaceAt("ProxyWallet", "0xaB9E9e40841F97a260E9E9ccc1A809A4663b7733");

  await wipeAndUnlockXDC(proxyWalletAsAlice, 37);

};

// 2 FXD borrowed, 1 XDC paid.

// when partiially closing, 0.5 XDC 1 FXD will pay

//