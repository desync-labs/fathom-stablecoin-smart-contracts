const fs = require('fs');
const rawdata = fs.readFileSync('../../../../faucets.json');
let stablecoinAddress = JSON.parse(rawdata);
const { BigNumber } = require("ethers");
// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";

const faucetAmount = BigNumber.from("300000000000000000000").toString();

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

const WXDC = artifacts.require('./tests/mocks/WXDC.sol');

// Apothem V1
const WXDCAddress = "0xcEc1609Efd3f12d0Da63250eF6761A7482Dda3BF";

module.exports =  async function(deployer) {
  console.log(">> Transfering WXDC to faucets")

  const WXDCInstance = await WXDC.at(WXDCAddress);
  
  await WXDCInstance.transfer(stablecoinAddress.faucetWXDC, faucetAmount);

};