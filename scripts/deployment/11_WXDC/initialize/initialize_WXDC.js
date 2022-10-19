const fs = require('fs');
// const rawdata = fs.readFileSync('../../../../addresses.json');
// let stablecoinAddress = JSON.parse(rawdata);
const { BigNumber } = require("ethers");
// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

// for ganache
const devAddress = accounts[0];

const WXDC = artifacts.require('./8.17/mocks/WXDC.sol');

// ApothemV1
const WXDCAddress = "0xcEc1609Efd3f12d0Da63250eF6761A7482Dda3BF";

module.exports =  async function(deployer) {
  console.log(">> Initializing WXDC")

  const WXDCInstance = await WXDC.at(WXDCAddress);
  // const WXDCInstance = await WXDC.at(stablecoinAddress.WXDC);

  await WXDCInstance.mint(
    devAddress, BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 }
  )

  //mint to V1 faucet
  // await WXDCInstance.mint(
  //   "0x5ec5B77C512fBd7A32b8fb6aE78a5cFbB500eb2b", BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 }
  // )

  // const balanceFaucet = await WXDCInstance.balanceOf("0x5ec5B77C512fBd7A32b8fb6aE78a5cFbB500eb2b");
  // console.log("balanceFaucetWXDC is " + balanceFaucet);

  // await WXDCInstance.mint(
  //   devAddress, BigNumber.from("10000000000000000000000000"), { gasLimit: 1000000 }
  // )

};