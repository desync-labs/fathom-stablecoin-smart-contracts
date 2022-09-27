const fs = require('fs');
const rawdata = fs.readFileSync('../../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const { BigNumber } = require("ethers");
// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

const WXDC = artifacts.require('./8.17/mocks/WXDC.sol');

module.exports =  async function(deployer) {
  console.log(">> Initializing WXDC")

  const WXDCInstance = await WXDC.at(stablecoinAddress.WXDC);


  await WXDCInstance.mint(
    walletDeployer, BigNumber.from("10000000000000000000000000"), { gasLimit: 1000000 }
  )

  await WXDCInstance.mint(
    devAddress, BigNumber.from("10000000000000000000000000"), { gasLimit: 1000000 }
  )

};