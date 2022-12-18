const fs = require('fs');
const rawdata = fs.readFileSync('../../../../faucets.json');
let stablecoinAddress = JSON.parse(rawdata);
const { BigNumber } = require("ethers");
// for testnet
const walletDeployer = "0x46b5Da5314658b2ebEe832bB63a92Ac6BaedE2C0";
const faucetAmount = BigNumber.from("300000000000000000000").toString();

// for ganache
const devAddress = "0x0CF4bC892112518f96506Df151185d0F572CfF5f";

const FathomToken = artifacts.require('./tests/FathomToken.sol');

// Apothem V2
const FXDAddress = "";

module.exports =  async function(deployer) {
  console.log(">> Transfering FathomToken to faucets")

  const FathomTokenInstance = await FathomToken.at(FXDAddress);
  
  await FathomTokenInstance.transfer(stablecoinAddress.faucetFXD, faucetAmount);

};