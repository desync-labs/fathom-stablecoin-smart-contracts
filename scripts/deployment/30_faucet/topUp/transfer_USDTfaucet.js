const fs = require('fs');
const rawdata = fs.readFileSync('../../../../faucets.json');
let stablecoinAddress = JSON.parse(rawdata);
const { BigNumber } = require("ethers");
// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
const faucetAmount = BigNumber.from("300000000000000000000").toString();

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

const USDT = artifacts.require('./8.17/mocks/USDT.sol');

// Apothem V1
const USDTAddress = "0xCcdC0653935A251B6839F30359917977f994b5d9";

module.exports =  async function(deployer) {
  console.log(">> Transfering USDT to faucets")

  const USDTInstance = await USDT.at(USDTAddress);
  
  await USDTInstance.transfer(stablecoinAddress.faucetUSDT, faucetAmount);
};